import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'YORD India — Premium Concert Merchandise',
    short_name: 'YORD India',
    description:
      "India's leading premium concert merchandise store. Shop exclusive fan-made designs for Coldplay, Diljit Dosanjh, Karan Aujla, Ed Sheeran, and 50+ artists.",
    start_url: '/',
    display: 'standalone',
    // The splash window for a standalone PWA install is painted before any page
    // CSS loads, so it cannot follow the user's theme. Light is the product
    // default, so these match the light palette — a dark splash on a light site
    // reads as a flash of the wrong app.
    background_color: '#F4F4F2',
    theme_color: '#F4F4F2',
    icons: [
      { src: '/favicon.ico', sizes: '48x48', type: 'image/x-icon' },
    ],
  };
}
