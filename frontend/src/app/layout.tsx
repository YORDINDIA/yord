import type { Metadata } from "next";
import { Playfair_Display, Cormorant_Garamond, Plus_Jakarta_Sans, Bebas_Neue } from "next/font/google";
import "./globals.css";
import { CustomCursor } from "@/components/ui/CustomCursor";

// Display font - For hero headlines
const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// Heading font - Luxury serif for section titles
const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

// Body font - Modern, readable sans-serif
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

// Accent font - Impact labels and CTAs
const bebas = Bebas_Neue({
  variable: "--font-bebas",
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "YORD India | Luxury Concert Fashion",
  description: "Where Music Meets Luxury. Premium artist merchandise and concert couture for devoted fans. Coldplay, Taylor Swift, Diljit Dosanjh, and more.",
  keywords: ["concert merchandise", "luxury fashion", "artist merch", "Coldplay", "Taylor Swift", "Diljit Dosanjh", "concert fashion", "premium apparel"],
  authors: [{ name: "YORD India" }],
  openGraph: {
    title: "YORD India | Luxury Concert Fashion",
    description: "Where Music Meets Luxury. Premium artist merchandise and concert couture.",
    type: "website",
    locale: "en_IN",
    siteName: "YORD India",
  },
  twitter: {
    card: "summary_large_image",
    title: "YORD India | Luxury Concert Fashion",
    description: "Where Music Meets Luxury. Premium artist merchandise and concert couture.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        suppressHydrationWarning
        className={`${playfair.variable} ${cormorant.variable} ${jakarta.variable} ${bebas.variable} antialiased`}
      >
        {/* Custom cursor for desktop */}
        <CustomCursor />
        {/* Noise texture overlay for luxury feel */}
        <div className="noise-overlay" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
