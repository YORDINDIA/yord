#!/usr/bin/env python3
"""
Image Optimization Script for Supabase Storage

Features:
- Compresses images > 500KB while maintaining clarity
- Converts all images to WebP format
- Detects and removes green backgrounds
- Updates database references
- Supports resume from checkpoint
- Parallel processing

Usage:
    python optimize_images.py              # Full optimization
    python optimize_images.py --dry-run    # Test without changes
    python optimize_images.py --resume     # Resume from checkpoint
    python optimize_images.py --sample 10  # Process only 10 images
    python optimize_images.py --workers 8  # Use 8 parallel workers
"""

import os
import sys
import io
import json
import time
import argparse
from datetime import datetime
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Optional, Tuple, List, Dict, Any
from urllib.parse import urlparse, unquote

import cv2
import numpy as np
from PIL import Image
import requests
from dotenv import load_dotenv
from supabase import Client
from tqdm import tqdm

sys.path.insert(0, str(Path(__file__).parent))
from utils.supabase_helpers import get_supabase_client

# Load environment variables
load_dotenv()

# Configuration
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_SERVICE_ROLE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
STORAGE_BUCKET = os.getenv('SUPABASE_STORAGE_BUCKET', 'products')

# Optimization settings
TARGET_SIZE_KB = 500
MIN_QUALITY = 60
MAX_QUALITY = 95
DEFAULT_QUALITY = 90
MAX_WORKERS = 5
BATCH_SIZE = 50

# Green detection settings
GREEN_THRESHOLD = 0.15  # 15% of image must be green
GREEN_HUE_RANGE = (35, 85)
GREEN_SAT_MIN = 40
GREEN_VAL_MIN = 40
EDGE_GREEN_THRESHOLD = 0.30  # 30% of edges must be green


class ImageProcessor:
    """Handles image compression, WebP conversion, and green background removal."""

    def compress_to_target_size(
        self,
        image: Image.Image,
        target_size_kb: int = TARGET_SIZE_KB,
        min_quality: int = MIN_QUALITY,
        max_quality: int = MAX_QUALITY
    ) -> Tuple[bytes, int]:
        """
        Binary search for optimal quality to achieve target size.
        Returns (compressed_bytes, final_quality)
        """
        # Ensure RGBA mode for transparency support
        if image.mode not in ('RGBA', 'RGB'):
            image = image.convert('RGBA')

        low, high = min_quality, max_quality
        best_result = None
        best_quality = max_quality

        while low <= high:
            mid = (low + high) // 2

            buffer = io.BytesIO()
            image.save(buffer, format='WEBP', quality=mid, method=6)
            size_kb = len(buffer.getvalue()) / 1024

            if size_kb <= target_size_kb:
                best_result = buffer.getvalue()
                best_quality = mid
                low = mid + 1  # Try higher quality
            else:
                high = mid - 1  # Need lower quality

        # If still over target at min_quality, use that result
        if best_result is None:
            buffer = io.BytesIO()
            image.save(buffer, format='WEBP', quality=min_quality, method=6)
            return buffer.getvalue(), min_quality

        return best_result, best_quality

    def convert_to_webp(
        self,
        image: Image.Image,
        quality: int = DEFAULT_QUALITY
    ) -> bytes:
        """Convert image to WebP without aggressive compression."""
        if image.mode not in ('RGBA', 'RGB'):
            image = image.convert('RGBA')

        buffer = io.BytesIO()
        image.save(buffer, format='WEBP', quality=quality, method=6)
        return buffer.getvalue()

    def detect_green_background(
        self,
        image_array: np.ndarray
    ) -> Tuple[bool, np.ndarray]:
        """
        Detect if image has green background using HSV analysis.
        Returns (has_green_bg, green_mask)
        """
        # Convert BGR to HSV (OpenCV uses BGR by default)
        hsv = cv2.cvtColor(image_array, cv2.COLOR_BGR2HSV)

        # Define green color range in HSV
        lower_green = np.array([GREEN_HUE_RANGE[0], GREEN_SAT_MIN, GREEN_VAL_MIN])
        upper_green = np.array([GREEN_HUE_RANGE[1], 255, 255])

        # Create mask for green pixels
        green_mask = cv2.inRange(hsv, lower_green, upper_green)

        # Calculate percentage of green pixels
        total_pixels = image_array.shape[0] * image_array.shape[1]
        green_pixels = cv2.countNonZero(green_mask)
        green_percentage = green_pixels / total_pixels

        # Check if green is primarily at edges (typical of green screen)
        edge_green_ratio = self._calculate_edge_green_ratio(green_mask)

        has_green_bg = (
            green_percentage >= GREEN_THRESHOLD and
            edge_green_ratio >= EDGE_GREEN_THRESHOLD
        )

        return has_green_bg, green_mask

    def _calculate_edge_green_ratio(self, mask: np.ndarray) -> float:
        """Calculate how much of the image edges are green."""
        h, w = mask.shape
        edge_width = min(20, h // 10, w // 10)  # 20 pixels or 10% of dimension

        if edge_width < 5:
            edge_width = 5

        # Extract edge regions
        top = mask[:edge_width, :]
        bottom = mask[-edge_width:, :]
        left = mask[:, :edge_width]
        right = mask[:, -edge_width:]

        edge_pixels = np.concatenate([
            top.flatten(), bottom.flatten(),
            left.flatten(), right.flatten()
        ])

        if len(edge_pixels) == 0:
            return 0.0

        return np.count_nonzero(edge_pixels) / len(edge_pixels)

    def remove_green_background(
        self,
        image_array: np.ndarray,
        green_mask: np.ndarray,
        feather_amount: int = 3
    ) -> Image.Image:
        """
        Remove green background and make it transparent.
        Returns Pillow Image with RGBA (transparency).
        """
        # Invert mask (foreground = white, background = black)
        foreground_mask = cv2.bitwise_not(green_mask)

        # Apply morphological operations to clean up mask
        kernel = np.ones((3, 3), np.uint8)
        foreground_mask = cv2.morphologyEx(foreground_mask, cv2.MORPH_CLOSE, kernel)
        foreground_mask = cv2.morphologyEx(foreground_mask, cv2.MORPH_OPEN, kernel)

        # Feather edges for smoother transition
        if feather_amount > 0:
            foreground_mask = cv2.GaussianBlur(
                foreground_mask,
                (feather_amount * 2 + 1, feather_amount * 2 + 1),
                0
            )

        # Convert BGR to RGBA
        rgba = cv2.cvtColor(image_array, cv2.COLOR_BGR2RGBA)

        # Apply mask as alpha channel
        rgba[:, :, 3] = foreground_mask

        # Convert to Pillow Image
        return Image.fromarray(rgba)

    def bytes_to_cv2(self, file_data: bytes) -> np.ndarray:
        """Convert bytes to OpenCV image array."""
        nparr = np.frombuffer(file_data, np.uint8)
        return cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    def bytes_to_pil(self, file_data: bytes) -> Image.Image:
        """Convert bytes to Pillow Image."""
        return Image.open(io.BytesIO(file_data))


class StorageManager:
    """Handles Supabase storage operations."""

    def __init__(self, supabase: Client):
        self.supabase = supabase
        self.bucket = STORAGE_BUCKET

    def get_all_images_to_process(self) -> List[Dict[str, Any]]:
        """Get all product images that have been migrated to Supabase."""
        images = []
        offset = 0
        limit = 1000

        while True:
            response = self.supabase.table('product_images').select(
                'id, product_id, supabase_url, src'
            ).not_.is_('supabase_url', 'null').neq(
                'supabase_url', ''
            ).range(offset, offset + limit - 1).execute()

            if not response.data:
                break

            for row in response.data:
                path = self._extract_path_from_url(row['supabase_url'])
                if path:
                    images.append({
                        'id': row['id'],
                        'product_id': row['product_id'],
                        'path': path,
                        'url': row['supabase_url'],
                        'original_src': row.get('src', '')
                    })

            offset += limit
            if len(response.data) < limit:
                break

        return images

    def _extract_path_from_url(self, url: str) -> Optional[str]:
        """Extract storage path from Supabase public URL."""
        # URL: https://xxx.supabase.co/storage/v1/object/public/products/123/456.jpg
        parts = url.split(f'/public/{self.bucket}/')
        if len(parts) > 1:
            return parts[1]
        return None

    def download_image(self, path: str, max_retries: int = 3) -> bytes:
        """Download image from Supabase storage with retry logic."""
        # TODO: route this loop through utils.retry.retry_with_backoff
        # (adds Retry-After + jitter); left as-is to avoid behavior change
        # in the threaded optimize path without test cover.
        last_error = None
        for attempt in range(max_retries):
            try:
                response = self.supabase.storage.from_(self.bucket).download(path)
                return response
            except Exception as e:
                last_error = e
                if attempt < max_retries - 1:
                    time.sleep(2 ** attempt)  # Exponential backoff: 1s, 2s, 4s
        raise last_error

    def upload_image(self, path: str, data: bytes, content_type: str = 'image/webp', max_retries: int = 3) -> str:
        """Upload image to Supabase storage and return public URL with retry logic."""
        last_error = None
        for attempt in range(max_retries):
            try:
                self.supabase.storage.from_(self.bucket).upload(
                    path,
                    data,
                    file_options={
                        'content-type': content_type,
                        'upsert': 'true'
                    }
                )
                return self.supabase.storage.from_(self.bucket).get_public_url(path)
            except Exception as e:
                last_error = e
                if attempt < max_retries - 1:
                    time.sleep(2 ** attempt)
        raise last_error

    def delete_image(self, path: str) -> bool:
        """Delete image from Supabase storage."""
        try:
            self.supabase.storage.from_(self.bucket).remove([path])
            return True
        except Exception:
            return False

    def get_file_size(self, path: str) -> int:
        """Get file size in bytes by downloading (Supabase doesn't have metadata API)."""
        data = self.download_image(path)
        return len(data)


class DatabaseManager:
    """Handles database URL updates."""

    def __init__(self, supabase: Client):
        self.supabase = supabase

    def update_product_image_url(self, image_id: int, new_url: str):
        """Update product_images.supabase_url with new WebP URL."""
        self.supabase.table('product_images').update({
            'supabase_url': new_url
        }).eq('id', image_id).execute()


class OptimizationOrchestrator:
    """Coordinates the optimization workflow."""

    def __init__(self, dry_run: bool = False):
        self.supabase: Client = get_supabase_client()
        self.storage = StorageManager(self.supabase)
        self.db = DatabaseManager(self.supabase)
        self.processor = ImageProcessor()
        self.dry_run = dry_run

        self.checkpoint_file = Path(__file__).parent / 'optimization_checkpoint.json'
        self.error_log_file = Path(__file__).parent / 'optimization_errors.json'

        self.stats = {
            'total': 0,
            'processed': 0,
            'compressed': 0,
            'green_removed': 0,
            'skipped': 0,
            'failed': 0,
            'errors': []
        }

    def _change_extension(self, path: str, new_ext: str) -> str:
        """Change file extension to new_ext (e.g., '.webp')."""
        parts = path.rsplit('.', 1)
        if len(parts) == 2:
            return f"{parts[0]}{new_ext}"
        return f"{path}{new_ext}"

    def save_checkpoint(self, processed_ids: set, failed_ids: set):
        """Save progress for recovery."""
        with open(self.checkpoint_file, 'w') as f:
            json.dump({
                'timestamp': datetime.now().isoformat(),
                'processed': list(processed_ids),
                'failed': list(failed_ids),
                'total_processed': len(processed_ids),
                'total_failed': len(failed_ids)
            }, f, indent=2)

    def load_checkpoint(self) -> Tuple[set, set]:
        """Load previous progress."""
        if self.checkpoint_file.exists():
            with open(self.checkpoint_file, 'r') as f:
                data = json.load(f)
                return set(data.get('processed', [])), set(data.get('failed', []))
        return set(), set()

    def process_single_image(self, image_info: Dict[str, Any]) -> Dict[str, Any]:
        """Process a single image through the optimization pipeline."""
        result = {
            'id': image_info['id'],
            'product_id': image_info['product_id'],
            'original_path': image_info['path'],
            'success': False,
            'actions': [],
            'error': None
        }

        try:
            # Step 1: Download image
            file_data = self.storage.download_image(image_info['path'])
            original_size = len(file_data)
            result['original_size_kb'] = round(original_size / 1024, 2)

            # Skip if already WebP and under target size (already optimized)
            if image_info['path'].lower().endswith('.webp') and original_size <= TARGET_SIZE_KB * 1024:
                # Still check for green background
                image_array = self.processor.bytes_to_cv2(file_data)
                has_green, green_mask = self.processor.detect_green_background(image_array)

                if not has_green:
                    result['success'] = True
                    result['skipped'] = True
                    result['actions'].append('already_optimized')
                    return result

            # Step 2: Load image
            image_array = self.processor.bytes_to_cv2(file_data)
            pil_image = self.processor.bytes_to_pil(file_data)

            # Step 3: Detect green background
            has_green, green_mask = self.processor.detect_green_background(image_array)
            result['has_green_background'] = has_green

            # Step 4: Remove green background if detected
            if has_green:
                pil_image = self.processor.remove_green_background(image_array, green_mask)
                result['actions'].append('green_bg_removed')
            else:
                # Ensure RGBA for consistency
                if pil_image.mode not in ('RGBA', 'RGB'):
                    pil_image = pil_image.convert('RGBA')

            # Step 5: Compress/convert to WebP
            needs_compression = original_size > TARGET_SIZE_KB * 1024

            if needs_compression:
                compressed_data, quality = self.processor.compress_to_target_size(pil_image)
                result['actions'].append(f'compressed_q{quality}')
            else:
                compressed_data = self.processor.convert_to_webp(pil_image)

            result['actions'].append('converted_to_webp')
            result['final_size_kb'] = round(len(compressed_data) / 1024, 2)
            result['compression_ratio'] = round(original_size / len(compressed_data), 2)

            if self.dry_run:
                result['success'] = True
                result['actions'].append('dry_run_skipped')
                return result

            # Step 6: Upload new WebP version
            old_path = image_info['path']
            new_path = self._change_extension(old_path, '.webp')

            new_url = self.storage.upload_image(new_path, compressed_data, 'image/webp')
            result['new_path'] = new_path
            result['new_url'] = new_url

            # Step 7: Delete old file if extension changed
            if old_path.lower() != new_path.lower():
                self.storage.delete_image(old_path)
                result['actions'].append('deleted_original')

            # Step 8: Update database
            self.db.update_product_image_url(image_info['id'], new_url)
            result['actions'].append('db_updated')

            result['success'] = True

        except Exception as e:
            result['error'] = str(e)
            result['actions'].append(f'error: {str(e)}')

        return result

    def optimize_all(
        self,
        max_workers: int = MAX_WORKERS,
        sample_size: int = 0,
        resume: bool = False
    ):
        """Main optimization function with parallel processing."""
        print("\n" + "=" * 60)
        print("IMAGE OPTIMIZATION: Supabase Storage")
        print("=" * 60)

        if self.dry_run:
            print("\n*** DRY RUN MODE - No changes will be made ***\n")

        # Load checkpoint if resuming
        processed_ids, failed_ids = set(), set()
        if resume:
            processed_ids, failed_ids = self.load_checkpoint()
            print(f"Resuming from checkpoint: {len(processed_ids)} processed, {len(failed_ids)} failed")

        # Get all images to process
        print("\nFetching images from database...")
        all_images = self.storage.get_all_images_to_process()
        self.stats['total'] = len(all_images)

        print(f"Total images in storage: {len(all_images)}")

        # Filter already processed
        images_to_process = [
            img for img in all_images
            if img['id'] not in processed_ids
        ]

        if sample_size > 0:
            images_to_process = images_to_process[:sample_size]
            print(f"Sample mode: Processing only {sample_size} images")

        print(f"Images to process: {len(images_to_process)}")
        print("-" * 60)

        if not images_to_process:
            print("\nNo images to process!")
            return

        # Process images
        with tqdm(total=len(images_to_process), desc="Optimizing") as pbar:
            for batch_start in range(0, len(images_to_process), BATCH_SIZE):
                batch = images_to_process[batch_start:batch_start + BATCH_SIZE]

                with ThreadPoolExecutor(max_workers=max_workers) as executor:
                    futures = {
                        executor.submit(self.process_single_image, img): img
                        for img in batch
                    }

                    for future in as_completed(futures):
                        result = future.result()
                        pbar.update(1)

                        if result['success']:
                            processed_ids.add(result['id'])
                            self.stats['processed'] += 1

                            if result.get('skipped'):
                                self.stats['skipped'] += 1
                            else:
                                if 'compressed_q' in ''.join(result.get('actions', [])):
                                    self.stats['compressed'] += 1
                                if 'green_bg_removed' in result.get('actions', []):
                                    self.stats['green_removed'] += 1
                        else:
                            failed_ids.add(result['id'])
                            self.stats['failed'] += 1
                            self.stats['errors'].append({
                                'id': result['id'],
                                'product_id': result['product_id'],
                                'error': result['error']
                            })

                # Save checkpoint after each batch
                if not self.dry_run:
                    self.save_checkpoint(processed_ids, failed_ids)

        self.print_summary()

        # Save error log
        if self.stats['errors']:
            with open(self.error_log_file, 'w') as f:
                json.dump(self.stats['errors'], f, indent=2)
            print(f"\nError log saved to: {self.error_log_file}")

    def print_summary(self):
        """Print optimization summary."""
        print("\n" + "=" * 60)
        print("OPTIMIZATION SUMMARY")
        print("=" * 60)
        print(f"Total images:           {self.stats['total']}")
        print(f"Successfully processed: {self.stats['processed']}")
        print(f"  - Compressed (>500KB): {self.stats['compressed']}")
        print(f"  - Green BG removed:    {self.stats['green_removed']}")
        print(f"  - Already optimized:   {self.stats['skipped']}")
        print(f"Failed:                 {self.stats['failed']}")

        if self.stats['errors']:
            print(f"\n{len(self.stats['errors'])} errors occurred:")
            for err in self.stats['errors'][:5]:
                print(f"  - Image {err['id']}: {err['error']}")
            if len(self.stats['errors']) > 5:
                print(f"  ... and {len(self.stats['errors']) - 5} more errors")

        print("=" * 60)


def main():
    # TODO: build this parser on utils.cli.create_parser() for the shared
    # --dry-run/--execute/--checkpoint-file/--batch-size/--verbose surface
    # (kept bespoke for now: --sample/--workers have no shared equivalent).
    parser = argparse.ArgumentParser(
        description='Optimize images in Supabase storage',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python optimize_images.py              # Full optimization
  python optimize_images.py --dry-run    # Test without changes
  python optimize_images.py --resume     # Resume from checkpoint
  python optimize_images.py --sample 10  # Process only 10 images
  python optimize_images.py --workers 8  # Use 8 parallel workers
        """
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Test without making changes'
    )
    parser.add_argument(
        '--resume',
        action='store_true',
        help='Resume from previous checkpoint'
    )
    parser.add_argument(
        '--sample',
        type=int,
        default=0,
        help='Process only N images (for testing)'
    )
    parser.add_argument(
        '--workers',
        type=int,
        default=MAX_WORKERS,
        help=f'Number of parallel workers (default: {MAX_WORKERS})'
    )

    args = parser.parse_args()

    # Validate environment
    required_vars = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
    missing = [var for var in required_vars if not os.getenv(var)]

    if missing:
        print(f"\nError: Missing required environment variables: {', '.join(missing)}")
        print("Please check your .env file")
        sys.exit(1)

    try:
        orchestrator = OptimizationOrchestrator(dry_run=args.dry_run)
        orchestrator.optimize_all(
            max_workers=args.workers,
            sample_size=args.sample,
            resume=args.resume
        )

        print("\n" + "=" * 60)
        print("IMAGE OPTIMIZATION COMPLETE")
        print("=" * 60)

    except KeyboardInterrupt:
        print("\n\nOptimization interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\nFatal error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
