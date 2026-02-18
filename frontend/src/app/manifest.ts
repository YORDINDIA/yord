import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'YORD India — Premium Concert Merchandise',
    short_name: 'YORD India',
    description:
      "India's leading premium concert merchandise store. Shop exclusive fan-made designs for Coldplay, Diljit Dosanjh, Karan Aujla, Ed Sheeran, and 50+ artists.",
    start_url: '/',
    display: 'standalone',
    background_color: '#0A0A0A',
    theme_color: '#D4AF37',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
