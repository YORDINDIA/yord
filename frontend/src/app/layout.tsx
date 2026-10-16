import type { Metadata, Viewport } from "next";
import { GoogleAnalytics } from "@next/third-parties/google";
import "./globals.css";
import { playfairDisplay, cormorantGaramond, plusJakartaSans, bebasNeue, bevellier } from "@/lib/fonts";
import { ClientProviders } from "@/providers/ClientProviders";

// Google Analytics is enabled in every storefront build. Search Console
// verification remains environment-gated.
const googleSiteVerification = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION;

// Origins the first paint needs a connection to: R2 serves every product image
// through the custom loader, Supabase answers the client-side reads (search,
// auth). React hoists these <link>s into <head>; both are skipped when unset so
// a backend-less build preconnects to nothing.
const mediaBaseUrl = process.env.NEXT_PUBLIC_MEDIA_BASE_URL;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

export const viewport: Viewport = {
  // Matches the light/dark page surfaces. The storefront's own theme is a
  // `data-theme` attribute next-themes writes pre-paint, which a meta tag
  // cannot follow, so the OS preference is the closest available signal.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F4F4F2" },
    { media: "(prefers-color-scheme: dark)", color: "#0A0A0A" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL("https://yordindia.com"),
  title: {
    default: "YORD India | Buy Premium Concert Merchandise Online",
    template: "%s | YORD India",
  },
  description:
    "India's #1 premium concert merchandise store. Shop exclusive fan-made designs for Coldplay, Diljit Dosanjh, Karan Aujla, Kanye West, Calvin Harris, DJ Snake, Linkin Park, Tiësto, Def Leppard, and 65+ artists. Free shipping on every order.",
  keywords: [
    "concert merchandise India",
    "buy concert merch online India",
    "artist merchandise India",
    "concert t-shirts India",
    "Coldplay merchandise India",
    "Diljit Dosanjh merch",
    "Karan Aujla merchandise",
    "Kanye West merchandise India",
    "Calvin Harris merch India",
    "DJ Snake merchandise India",
    "Linkin Park merchandise India",
    "Tiësto merch India",
    "Def Leppard merchandise India",
    "Dream Theater merch India",
    "Ed Sheeran merch India",
    "Taylor Swift merchandise India",
    "AP Dhillon merch",
    "concert fashion India",
    "premium concert apparel",
    "band merchandise India",
    "music festival merch India",
    "Lollapalooza India merch",
    "Sunburn Festival merchandise",
    "luxury concert fashion",
    "fan merchandise India",
    "artist inspired clothing India",
  ],
  authors: [{ name: "YORD India", url: "https://yordindia.com" }],
  creator: "YORD India",
  publisher: "YORD India",
  openGraph: {
    title: "YORD India | Buy Premium Concert Merchandise Online",
    description:
      "India's leading concert merchandise store. Shop exclusive fan-made designs for 65+ artists. Premium quality, pan-India delivery.",
    type: "website",
    locale: "en_IN",
    siteName: "YORD India",
    url: "https://yordindia.com",
    images: [
      {
        url: "/brand/yord-logo-1500x750.png",
        alt: "YORD India — Premium Concert Merchandise",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "YORD India | Premium Concert Merchandise",
    description:
      "India's #1 concert merchandise store. Coldplay, Diljit, Karan Aujla, Ed Sheeran & 65+ artists.",
    creator: "@yordindia",
    site: "@yordindia",
    images: ["/brand/yord-logo-1500x750.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  // No `alternates` here on purpose. Next merges metadata down the tree, so a
  // canonical set at the root was inherited by every page that did not override
  // it — 27 of 39 pages, all of which told Google they were the homepage. A
  // page without its own canonical now self-canonicalizes, which is correct.
  // Google Search Console meta-tag verification; omitted entirely when unset.
  verification: googleSiteVerification ? { google: googleSiteVerification } : undefined,
  category: "E-Commerce",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning belongs on <html>, not <body>: next-themes writes
    // `data-theme` onto this element from a pre-paint script, so React's
    // hydration snapshot of <html> is expected to differ from the DOM.
    <html
      lang="en-IN"
      suppressHydrationWarning
      className={`${playfairDisplay.variable} ${cormorantGaramond.variable} ${plusJakartaSans.variable} ${bebasNeue.variable} ${bevellier.variable}`}
    >
      <body className="antialiased">
        {/* Connection warm-up for the two origins every route touches. React
            hoists these into <head>. `crossOrigin` on Supabase because its
            REST calls carry headers, which use a different connection pool
            than a plain (no-CORS) fetch. */}
        {mediaBaseUrl ? <link rel="preconnect" href={mediaBaseUrl} /> : null}
        {supabaseUrl ? <link rel="preconnect" href={supabaseUrl} crossOrigin="anonymous" /> : null}
        {supabaseUrl ? <link rel="dns-prefetch" href={supabaseUrl} /> : null}

        {/* Static texture, deliberately outside the client boundary so it costs
            no JS. Note for follow-up: globals.css hides it under
            `prefers-reduced-motion`, which is the wrong gate for a static
            texture — reduced-motion visitors lose it while everyone else pays
            for the layer. */}
        <div className="noise-overlay" aria-hidden="true" />

        <ClientProviders>{children}</ClientProviders>
        {/* Google tag: pageviews (including SPA route changes) are automatic. */}
        <GoogleAnalytics gaId="GT-KF6P3KGX" />
      </body>
    </html>
  );
}
