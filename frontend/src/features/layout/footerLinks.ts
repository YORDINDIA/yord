import { Instagram, Youtube, Twitter } from 'lucide-react';

export interface FooterLink {
  label: string;
  href: string;
}

export interface FooterColumnData {
  title: string;
  links: readonly FooterLink[];
}

/**
 * The four link columns. They used to be the same 15 lines of markup written
 * out four times; `FooterColumn` renders them from this list instead.
 */
export const FOOTER_COLUMNS: readonly FooterColumnData[] = [
  {
    title: 'SHOP',
    links: [
      { label: 'New Arrivals', href: '/collection/new-arrivals' },
      { label: 'Bestsellers', href: '/collection/bestsellers' },
      { label: 'Limited Editions', href: '/collection/limited-edition' },
      { label: 'All Products', href: '/products' },
      { label: 'Concert Merchandise', href: '/concert-merchandise-india' },
    ],
  },
  {
    title: 'CONCERTS',
    links: [
      { label: 'All Concerts', href: '/concerts' },
      { label: 'Mumbai Concerts', href: '/concerts/city/mumbai' },
      { label: 'Delhi Concerts', href: '/concerts/city/delhi' },
      { label: 'Bengaluru Concerts', href: '/concerts/city/bengaluru' },
      { label: 'Pune Concerts', href: '/concerts/city/pune' },
    ],
  },
  {
    title: 'SUPPORT',
    links: [
      { label: 'Contact Us', href: '/contact' },
      { label: 'Shipping Info', href: '/shipping' },
      { label: 'Returns & Exchanges', href: '/returns' },
      { label: 'Size Guide', href: '/size-guide' },
      { label: 'FAQs', href: '/faq' },
      { label: 'Track Order', href: '/track-order' },
    ],
  },
  {
    title: 'COMPANY',
    links: [
      { label: 'Our Story', href: '/about' },
      { label: 'Blog', href: '/blog' },
    ],
  },
];

export const SOCIAL_LINKS = [
  { label: 'Instagram', href: 'https://instagram.com/yordindia', icon: Instagram },
  { label: 'YouTube', href: 'https://youtube.com/@yordindia', icon: Youtube },
  { label: 'Twitter', href: 'https://twitter.com/yordindia', icon: Twitter },
] as const;

export const LEGAL_LINKS: readonly FooterLink[] = [
  { label: 'Privacy Policy', href: '/privacy' },
  { label: 'Terms of Service', href: '/terms' },
  { label: 'Cookies', href: '/cookies' },
];
