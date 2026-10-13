import type { Metadata } from 'next';

// Stagelight is live at `/`; this route renders the same page for the concept switcher.
export { default } from '../../page';

export const revalidate = 3600;
export const metadata: Metadata = {
  title: 'Concept C Stagelight',
  alternates: { canonical: '/' },
};
