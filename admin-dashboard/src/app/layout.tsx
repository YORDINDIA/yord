import type { Metadata } from 'next';
import { Fraunces, Spline_Sans } from 'next/font/google';
import './globals.css';
import { PHProvider } from '@/providers/PostHogProvider';
import PostHogPageView from '@/providers/PostHogPageView';
import { ToastProvider } from '@/components/ui/ToastProvider';

const display = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
});

const body = Spline_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['300', '400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'YORD Admin',
  description: 'Admin dashboard for YORD India',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("yord-admin-theme");if(t!=="light"&&t!=="dark"){t="dark"}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme="dark"}})();`,
          }}
        />
      </head>
      <PHProvider>
        <body className={`${display.variable} ${body.variable}`}>
          {/* The toast provider sits at the root so every route can raise
              feedback — including /login, which previously had no host and
              silently dropped its toasts. */}
          <ToastProvider>
            <PostHogPageView />
            {children}
          </ToastProvider>
        </body>
      </PHProvider>
    </html>
  );
}
