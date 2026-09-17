"""Shared CLI flags for migration scripts.

Standard surface: ``--dry-run`` / ``--execute``, ``--checkpoint-file``,
``--batch-size``, ``--verbose``. Dry-run is the default: nothing is written
unless ``--execute`` is passed without ``--dry-run``.

Usage:
    from utils.cli import create_parser, resolve_execute, configure_logging

    parser = create_parser("What this script does")
    parser.add_argument("--resume", action="store_true", ...)  # script-specific
    args = parser.parse_args()
    configure_logging(args.verbose)
    execute = resolve_execute(args)  # False -> dry-run, print the hint below
    if not execute:
        print("DRY-RUN mode: no writes will be made. Pass --execute to write.")
"""

import argparse
import logging

from .config import BATCH_SIZE, SUPABASE_UPSERT_BATCH_SIZE


def create_parser(description: str, default_checkpoint: str | None = None) -> argparse.ArgumentParser:
    """Build an argparse parser with the standard migration flags."""
    parser = argparse.ArgumentParser(description=description)
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--execute", action="store_true",
                       help="Write to Supabase (default is dry-run)")
    group.add_argument("--dry-run", action="store_true",
                       help="Preview without writing (default)")
    if default_checkpoint:
        parser.add_argument("--checkpoint-file", default=default_checkpoint,
                            help=f"Checkpoint file for resume (default: {default_checkpoint})")
    else:
        parser.add_argument("--checkpoint-file", default=None,
                            help="Checkpoint file for resume (optional)")
    parser.add_argument("--batch-size", type=int, default=BATCH_SIZE,
                        help=f"Records per batch (default: {BATCH_SIZE})")
    parser.add_argument("--verbose", action="store_true",
                        help="Debug-level logging")
    return parser


def resolve_execute(args: argparse.Namespace) -> bool:
    """True only when --execute was passed (and --dry-run was not)."""
    return bool(args.execute) and not bool(args.dry_run)


def configure_logging(verbose: bool = False) -> None:
    """Set root log level from --verbose (call once, before other setup)."""
    logging.getLogger().setLevel(logging.DEBUG if verbose else logging.INFO)


def upsert_batch_size(args: argparse.Namespace | None = None) -> int:
    """Supabase upsert batch size: explicit CLI value wins, else the default (500)."""
    if args is not None and getattr(args, "batch_size", None):
        return int(args.batch_size)
    return SUPABASE_UPSERT_BATCH_SIZE
