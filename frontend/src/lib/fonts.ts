import { Playfair_Display, Cormorant_Garamond, Plus_Jakarta_Sans, Bebas_Neue } from 'next/font/google';
import localFont from 'next/font/local';

export const playfairDisplay = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-playfair',
});

export const cormorantGaramond = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-cormorant',
});

export const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-jakarta',
});

export const bebasNeue = Bebas_Neue({
  subsets: ['latin'],
  weight: ['400'],
  display: 'swap',
  variable: '--font-bebas',
});

/* Bevellier: Indian Type Foundry Free Font License (Fontshare), self-hosted
   variable font. The Stagelight display face; catalog prices and listing
   titles use it too, via `font-display-alt`. */
export const bevellier = localFont({
  src: '../features/concepts/fonts/bevellier-var.woff2',
  weight: '100 900',
  variable: '--font-bevellier',
  display: 'swap',
});
