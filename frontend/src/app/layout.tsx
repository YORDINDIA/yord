import type { Metadata } from "next";
import "./globals.css";
import { CustomCursor } from "@/components/ui/CustomCursor";
import { PHProvider } from "@/providers/PostHogProvider";
import PostHogPageView from "@/providers/PostHogPageView";

export const metadata: Metadata = {
  metadataBase: new URL("https://yordindia.com"),
  title: {
    default: "YORD India | Buy Premium Concert Merchandise Online",
    template: "%s | YORD India",
  },
  description:
    "India's #1 premium concert merchandise store. Shop exclusive fan-made designs for Coldplay, Diljit Dosanjh, Karan Aujla, Kanye West, Calvin Harris, DJ Snake, Linkin Park, Tiësto, Def Leppard, and 65+ artists. Free shipping above ₹1,999.",
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
      "India's leading concert merchandise store. Shop exclusive fan-made designs for 50+ artists. Premium quality, pan-India delivery.",
    type: "website",
    locale: "en_IN",
    siteName: "YORD India",
    url: "https://yordindia.com",
  },
  twitter: {
    card: "summary_large_image",
    title: "YORD India | Premium Concert Merchandise",
    description:
      "India's #1 concert merchandise store. Coldplay, Diljit, Karan Aujla, Ed Sheeran & 50+ artists.",
    creator: "@yordindia",
    site: "@yordindia",
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
  alternates: {
    canonical: "https://yordindia.com",
  },
  category: "E-Commerce",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-IN" className="dark">
      <PHProvider>
        <body
          suppressHydrationWarning
          className="antialiased"
        >
          <PostHogPageView />
          {/* Custom cursor for desktop */}
          <CustomCursor />
          {/* Noise texture overlay for luxury feel */}
          <div className="noise-overlay" aria-hidden="true" />
          {children}
        </body>
      </PHProvider>
    </html>
  );
}
