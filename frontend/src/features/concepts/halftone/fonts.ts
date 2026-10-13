import localFont from 'next/font/local';

/* Boska and Panchang: Indian Type Foundry Free Font License (Fontshare),
   self-hosted variable fonts. */
export const boska = localFont({
  src: [
    { path: '../fonts/boska-var.woff2', style: 'normal' },
    { path: '../fonts/boska-italic-var.woff2', style: 'italic' },
  ],
  weight: '200 900',
  variable: '--font-boska',
  display: 'swap',
});

export const panchang = localFont({
  src: '../fonts/panchang-var.woff2',
  weight: '200 800',
  variable: '--font-panchang',
  display: 'swap',
});
