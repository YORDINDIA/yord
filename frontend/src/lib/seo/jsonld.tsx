import type { ProductWithDetails } from '@/types/database';
import type { Concert } from '@/lib/data/concerts';

const BASE_URL = 'https://yordindia.com';

// ═══════════════════════════════════════════════════════════════════════════
// JSON-LD Component
// ═══════════════════════════════════════════════════════════════════════════

export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ORGANIZATION SCHEMA
// ═══════════════════════════════════════════════════════════════════════════

export function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'YORD India',
    url: BASE_URL,
    logo: `${BASE_URL}/icon-512.png`,
    description:
      "India's premium concert merchandise store. Shop exclusive fan-made designs for 50+ artists including Coldplay, Diljit Dosanjh, Karan Aujla, Ed Sheeran, Taylor Swift, and more.",
    foundingCountry: 'IN',
    sameAs: [
      'https://instagram.com/yordindia',
      'https://youtube.com/@yordindia',
      'https://twitter.com/yordindia',
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      availableLanguage: ['English', 'Hindi'],
    },
    areaServed: {
      '@type': 'Country',
      name: 'India',
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// WEBSITE SCHEMA (enables sitelinks search box)
// ═══════════════════════════════════════════════════════════════════════════

export function websiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'YORD India',
    url: BASE_URL,
    description: "India's leading premium concert merchandise platform.",
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${BASE_URL}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// PRODUCT SCHEMA
// ═══════════════════════════════════════════════════════════════════════════

export function productSchema(product: ProductWithDetails) {
  const variant = product.product_variants?.[0];
  const image = product.product_images?.[0];
  const price = variant?.price || 0;
  const inStock = (variant?.inventory_quantity || 0) > 0;
  const description = product.body_html
    ? product.body_html.replace(/<[^>]*>/g, '').slice(0, 500)
    : `Shop ${product.title} from ${product.vendor || 'YORD India'}. Premium concert merchandise.`;

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description,
    image: image?.supabase_url || image?.src || undefined,
    url: `${BASE_URL}/product/${product.handle}`,
    brand: {
      '@type': 'Brand',
      name: product.vendor || 'YORD India',
    },
    offers: {
      '@type': 'Offer',
      price: price.toFixed(2),
      priceCurrency: 'INR',
      availability: inStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      url: `${BASE_URL}/product/${product.handle}`,
      seller: {
        '@type': 'Organization',
        name: 'YORD India',
      },
      shippingDetails: {
        '@type': 'OfferShippingDetails',
        shippingDestination: {
          '@type': 'DefinedRegion',
          addressCountry: 'IN',
        },
      },
    },
    ...(product.product_images && product.product_images.length > 1
      ? {
          additionalProperty: [
            {
              '@type': 'PropertyValue',
              name: 'category',
              value: product.product_type || 'Concert Merchandise',
            },
          ],
        }
      : {}),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// BREADCRUMB SCHEMA
// ═══════════════════════════════════════════════════════════════════════════

export function breadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url.startsWith('http') ? item.url : `${BASE_URL}${item.url}`,
    })),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ARTICLE SCHEMA
// ═══════════════════════════════════════════════════════════════════════════

export function articleSchema(article: {
  title: string;
  handle: string | null;
  author: string | null;
  body_html: string | null;
  published_at: string | null;
  image_src: string | null;
  supabase_image_url: string | null;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    url: `${BASE_URL}/blog/${article.handle}`,
    datePublished: article.published_at || undefined,
    author: article.author
      ? { '@type': 'Person', name: article.author }
      : { '@type': 'Organization', name: 'YORD India' },
    publisher: {
      '@type': 'Organization',
      name: 'YORD India',
      url: BASE_URL,
    },
    image: article.supabase_image_url || article.image_src || undefined,
    description: article.body_html
      ? article.body_html.replace(/<[^>]*>/g, '').slice(0, 160)
      : `Read ${article.title} on the YORD India blog.`,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// FAQ SCHEMA
// ═══════════════════════════════════════════════════════════════════════════

export function faqSchema(faqs: { question: string; answer: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// EVENT SCHEMA (for concert pages)
// ═══════════════════════════════════════════════════════════════════════════

export function eventSchema(concert: Concert) {
  return {
    '@context': 'https://schema.org',
    '@type': 'MusicEvent',
    name: `${concert.artist} — ${concert.tourName}`,
    description: concert.description,
    startDate: concert.date,
    eventStatus:
      concert.status === 'completed'
        ? 'https://schema.org/EventScheduled'
        : concert.status === 'upcoming'
          ? 'https://schema.org/EventScheduled'
          : 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: {
      '@type': 'Place',
      name: concert.venue,
      address: {
        '@type': 'PostalAddress',
        addressLocality: concert.city,
        addressCountry: 'IN',
      },
    },
    performer: {
      '@type': 'MusicGroup',
      name: concert.artist,
    },
    organizer: {
      '@type': 'Organization',
      name: 'YORD India',
      url: BASE_URL,
    },
    url: `${BASE_URL}/concerts/${concert.slug}`,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// MUSIC GROUP / ARTIST SCHEMA
// ═══════════════════════════════════════════════════════════════════════════

export function musicGroupSchema(artist: {
  handle: string;
  name: string;
  bio?: string;
  heroImage?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'MusicGroup',
    name: artist.name,
    description:
      artist.bio ||
      `Shop exclusive ${artist.name} merchandise at YORD India. Premium fan-made concert fashion.`,
    url: `${BASE_URL}/artist/${artist.handle}`,
    image: artist.heroImage || undefined,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ITEM LIST SCHEMA (for product/collection listing pages)
// ═══════════════════════════════════════════════════════════════════════════

export function itemListSchema(
  items: { name: string; url: string; image?: string; position: number }[]
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    numberOfItems: items.length,
    itemListElement: items.map((item) => ({
      '@type': 'ListItem',
      position: item.position,
      name: item.name,
      url: item.url.startsWith('http') ? item.url : `${BASE_URL}${item.url}`,
      ...(item.image ? { image: item.image } : {}),
    })),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// COLLECTION PAGE SCHEMA
// ═══════════════════════════════════════════════════════════════════════════

export function collectionPageSchema(collection: {
  title: string;
  handle: string | null;
  description?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: collection.title,
    url: `${BASE_URL}/collection/${collection.handle}`,
    description:
      collection.description ||
      `Shop ${collection.title} at YORD India. Premium concert merchandise collection.`,
    isPartOf: {
      '@type': 'WebSite',
      name: 'YORD India',
      url: BASE_URL,
    },
  };
}
