/**
 * YORD India - Database Types
 * Generated from Supabase schema for type-safe queries
 */

export interface Database {
  public: {
    Tables: {
      products: {
        Row: Product;
        Insert: Omit<Product, 'created_at' | 'updated_at'>;
        Update: Partial<Product>;
      };
      product_variants: {
        Row: ProductVariant;
        Insert: Omit<ProductVariant, 'created_at' | 'updated_at'>;
        Update: Partial<ProductVariant>;
      };
      product_images: {
        Row: ProductImage;
        Insert: Omit<ProductImage, 'created_at' | 'updated_at'>;
        Update: Partial<ProductImage>;
      };
      product_options: {
        Row: ProductOption;
        Insert: ProductOption;
        Update: Partial<ProductOption>;
      };
      collections: {
        Row: Collection;
        Insert: Collection;
        Update: Partial<Collection>;
      };
      customers: {
        Row: Customer;
        Insert: Omit<Customer, 'created_at' | 'updated_at'>;
        Update: Partial<Customer>;
      };
      orders: {
        Row: Order;
        Insert: Omit<Order, 'created_at'>;
        Update: Partial<Order>;
      };
      line_items: {
        Row: LineItem;
        Insert: LineItem;
        Update: Partial<LineItem>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// CORE ENTITIES
// ═══════════════════════════════════════════════════════════════════════════

export interface Product {
  id: number;
  title: string;
  body_html: string | null;
  vendor: string | null;
  product_type: string | null;
  handle: string;
  status: 'active' | 'archived' | 'draft';
  published_at: string | null;
  published_scope: string | null;
  template_suffix: string | null;
  tags: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductVariant {
  id: number;
  product_id: number;
  title: string | null;
  price: number;
  compare_at_price: number | null;
  position: number;
  sku: string | null;
  barcode: string | null;
  grams: number | null;
  weight: number | null;
  weight_unit: string | null;
  inventory_item_id: number | null;
  inventory_quantity: number;
  inventory_policy: string | null;
  inventory_management: string | null;
  fulfillment_service: string | null;
  requires_shipping: boolean;
  taxable: boolean;
  option1: string | null;
  option2: string | null;
  option3: string | null;
  image_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface ProductImage {
  id: number;
  product_id: number;
  position: number;
  src: string;
  alt: string | null;
  width: number | null;
  height: number | null;
  supabase_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductOption {
  id: number;
  product_id: number;
  name: string;
  position: number;
  values: string[] | null;
}

export interface Collection {
  id: number;
  title: string;
  handle: string | null;
  body_html: string | null;
  collection_type: 'smart' | 'custom';
  published: boolean;
  published_at: string | null;
  published_scope: string | null;
  sort_order: string | null;
  template_suffix: string | null;
  disjunctive: boolean | null;
  image_src: string | null;
  image_alt: string | null;
  updated_at: string;
}

export interface Customer {
  id: number;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  state: string | null;
  note: string | null;
  tags: string | null;
  verified_email: boolean;
  tax_exempt: boolean;
  orders_count: number;
  total_spent: number;
  accepts_marketing: boolean;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: number;
  customer_id: number | null;
  name: string | null;
  order_number: number | null;
  email: string | null;
  phone: string | null;
  financial_status: string | null;
  fulfillment_status: string | null;
  cancel_reason: string | null;
  cancelled_at: string | null;
  currency: string;
  total_price: number;
  subtotal_price: number | null;
  total_discounts: number | null;
  total_tax: number | null;
  total_shipping_price: number | null;
  created_at: string;
  processed_at: string | null;
  closed_at: string | null;
}

export interface LineItem {
  id: number;
  order_id: number;
  product_id: number | null;
  variant_id: number | null;
  title: string;
  variant_title: string | null;
  sku: string | null;
  price: number;
  quantity: number;
  total_discount: number | null;
  fulfillment_status: string | null;
  requires_shipping: boolean;
  taxable: boolean;
  gift_card: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// ENRICHED TYPES (for frontend use)
// ═══════════════════════════════════════════════════════════════════════════

export interface ProductWithDetails extends Product {
  product_variants: ProductVariant[];
  product_images: ProductImage[];
  product_options?: ProductOption[];
}

export interface ProductWithRelations extends ProductWithDetails {
  collections?: Collection[];
}

// ═══════════════════════════════════════════════════════════════════════════
// ARTIST DATA
// ═══════════════════════════════════════════════════════════════════════════

// List of collection handles that represent artists (not product categories)
// These collections have products linked via the collects junction table
export const ARTIST_COLLECTION_HANDLES = [
  'alan-walker',
  'coldplay',
  'diljit-dosanjh',
  'dua-lipa',
  'ed-sheeran',
  'guns-and-roses',
  'hanumankind',
  'honey-singh',
  'karan-aujla',
  'krsna',
  'lollapalooza-india',
  'shawn-mendes',
  'sidhu-moosewala',
  'taylor-swift',
] as const;

export type ArtistHandle = typeof ARTIST_COLLECTION_HANDLES[number];

// Helper to check if a collection handle is an artist
export function isArtistCollection(handle: string): boolean {
  return ARTIST_COLLECTION_HANDLES.includes(handle as ArtistHandle);
}

export interface ArtistData {
  handle: string;
  name: string;
  vendorName: string;
  tagline?: string;
  bio?: string;
  heroImage?: string;
  logoImage?: string;
  accentColor?: string;
  secondaryColor?: string;
  productCount?: number;
}

// Helper to convert vendor name to URL-safe handle
export function vendorToHandle(vendor: string): string {
  return vendor.toLowerCase().replace(/\s+/g, '-');
}

// Helper to get artist metadata from ARTISTS config by vendor name
export function getArtistMetadata(vendorName: string): Partial<ArtistData> | null {
  const handle = vendorToHandle(vendorName);
  return ARTISTS[handle] || null;
}

// Static artist configuration - used as metadata fallback for colors, images, etc.
export const ARTISTS: Record<string, ArtistData> = {
  'alan-walker': {
    handle: 'alan-walker',
    name: 'Alan Walker',
    vendorName: 'Alan Walker',
    tagline: 'Faded Collection',
    bio: 'Electronic dance music meets premium fashion. Experience the signature Alan Walker aesthetic with exclusive concert merchandise.',
    heroImage: '/artists/alan-walker-hero.jpg',
    accentColor: '#00D4FF',
    secondaryColor: '#0A1628',
  },
  coldplay: {
    handle: 'coldplay',
    name: 'Coldplay',
    vendorName: 'ColdPlay',
    tagline: 'Music of the Spheres',
    bio: 'Experience the ethereal beauty of Coldplay\'s universe with exclusive concert couture. From the iconic Music of the Spheres World Tour, each piece captures the magic of live performance.',
    heroImage: '/artists/coldplay-hero.jpg',
    accentColor: '#FFD700',
    secondaryColor: '#1E90FF',
  },
  'diljit-dosanjh': {
    handle: 'diljit-dosanjh',
    name: 'Diljit Dosanjh',
    vendorName: 'Diljit Dosanjh',
    tagline: 'Dil-Luminati Tour',
    bio: 'Celebrate Punjabi pride with exclusive Diljit concert fashion. Bold, vibrant, and unmistakably G.O.A.T. — wear your devotion with pride.',
    heroImage: '/artists/diljit-hero.jpg',
    accentColor: '#FF6B35',
    secondaryColor: '#004E64',
  },
  'dua-lipa': {
    handle: 'dua-lipa',
    name: 'Dua Lipa',
    vendorName: 'Dua Lipa',
    tagline: 'Future Nostalgia',
    bio: 'Disco-inspired fashion for the modern pop era. Embrace the Future Nostalgia aesthetic with premium Dua Lipa merchandise.',
    heroImage: '/artists/dua-lipa-hero.jpg',
    accentColor: '#FF69B4',
    secondaryColor: '#4B0082',
  },
  'ed-sheeran': {
    handle: 'ed-sheeran',
    name: 'Ed Sheeran',
    vendorName: 'ED Sheeran',
    tagline: 'Mathematics Tour',
    bio: 'Acoustic vibes meet premium fan designs. An artist-inspired collection for the devoted Sheerios.',
    heroImage: '/artists/ed-sheeran-hero.jpg',
    accentColor: '#FF4500',
    secondaryColor: '#228B22',
  },
  'guns-and-roses': {
    handle: 'guns-and-roses',
    name: 'Guns N\' Roses',
    vendorName: 'Guns and Roses',
    tagline: 'Rock Legends',
    bio: 'Classic rock meets premium fashion. Channel your inner rock god with official Guns N\' Roses merchandise.',
    heroImage: '/artists/gnr-hero.jpg',
    accentColor: '#FFD700',
    secondaryColor: '#8B0000',
  },
  hanumankind: {
    handle: 'hanumankind',
    name: 'Hanumankind',
    vendorName: 'Hanumankind',
    tagline: 'Big Dawgs',
    bio: 'Indian hip-hop meets luxury streetwear. Rep the movement with official Hanumankind merchandise.',
    heroImage: '/artists/hanumankind-hero.jpg',
    accentColor: '#FF5722',
    secondaryColor: '#1C1C1C',
  },
  'honey-singh': {
    handle: 'honey-singh',
    name: 'Yo Yo Honey Singh',
    vendorName: 'Honey Singh',
    tagline: 'Desi Kalakaar',
    bio: 'The original Desi Kalakaar. Premium merchandise for true Honey Singh fans.',
    heroImage: '/artists/honey-singh-hero.jpg',
    accentColor: '#FFC107',
    secondaryColor: '#212121',
  },
  'karan-aujla': {
    handle: 'karan-aujla',
    name: 'Karan Aujla',
    vendorName: 'Karan Aujla',
    tagline: 'Tauba Tauba',
    bio: 'Punjabi music sensation. Official Karan Aujla merchandise for the real ones.',
    heroImage: '/artists/karan-aujla-hero.jpg',
    accentColor: '#E53935',
    secondaryColor: '#1C1C1C',
  },
  krsna: {
    handle: 'krsna',
    name: 'KRSNA',
    vendorName: 'KRSNA',
    tagline: 'Indian Hip-Hop',
    bio: 'Desi hip-hop royalty. Official KRSNA merchandise for the real ones.',
    heroImage: '/artists/krsna-hero.jpg',
    accentColor: '#9C27B0',
    secondaryColor: '#1C1C1C',
  },
  'lollapalooza-india': {
    handle: 'lollapalooza-india',
    name: 'Lollapalooza India',
    vendorName: 'lollapalooza india',
    tagline: 'Festival Collection',
    bio: 'Celebrate India\'s biggest music festival with exclusive Lollapalooza merchandise.',
    heroImage: '/artists/lolla-hero.jpg',
    accentColor: '#00BCD4',
    secondaryColor: '#E91E63',
  },
  'shawn-mendes': {
    handle: 'shawn-mendes',
    name: 'Shawn Mendes',
    vendorName: 'Shawn Mendes',
    tagline: 'Wonder',
    bio: 'Heartfelt melodies meet premium fashion. Official Shawn Mendes collection for the Mendes Army.',
    heroImage: '/artists/shawn-mendes-hero.jpg',
    accentColor: '#87CEEB',
    secondaryColor: '#2F4F4F',
  },
  'sidhu-moosewala': {
    handle: 'sidhu-moosewala',
    name: 'Sidhu Moosewala',
    vendorName: 'Sidhu Moosewala',
    tagline: 'Legend Never Dies',
    bio: 'Honor the legend. Premium Sidhu Moosewala tribute merchandise for true fans.',
    heroImage: '/artists/sidhu-hero.jpg',
    accentColor: '#8B4513',
    secondaryColor: '#1C1C1C',
  },
  'taylor-swift': {
    handle: 'taylor-swift',
    name: 'Taylor Swift',
    vendorName: 'Taylor Swift',
    tagline: 'The Eras Tour',
    bio: 'Dress for every era with premium Taylor Swift merchandise. Celebrate the journey through all the iconic eras with fashion that tells your story.',
    heroImage: '/artists/taylor-hero.jpg',
    accentColor: '#C71585',
    secondaryColor: '#FFB6C1',
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// TRANSFORMED PRODUCT TYPES (for UI display)
// ═══════════════════════════════════════════════════════════════════════════

export type BadgeType = 'NEW' | 'SALE' | 'LIMITED' | 'BESTSELLER' | 'TRENDING';

export interface TransformedProduct {
  id: string;
  handle: string;
  title: string;
  artist: string;
  price: number;
  compareAtPrice: number | null;
  image: string | null;
  badge: BadgeType | null;
  accentColor: string;
}

/**
 * Extended TransformedProduct that includes the original product data
 * Used by server components that need to pass full product data to client components
 */
export interface TransformedProductWithSource extends TransformedProduct {
  originalProduct: ProductWithDetails;
}

// ═══════════════════════════════════════════════════════════════════════════
// CART TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface CartItem {
  variantId: number;
  productId: number;
  productHandle: string;
  title: string;
  variantTitle: string | null;
  price: number;
  compareAtPrice: number | null;
  quantity: number;
  image: string | null;
  maxQuantity: number;
  artist: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════
// API RESPONSE TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiError {
  message: string;
  code?: string;
  details?: unknown;
}

// ═══════════════════════════════════════════════════════════════════════════
// BLOG TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface Blog {
  id: number;
  title: string;
  handle: string | null;
  commentable: 'no' | 'moderate' | 'yes';
  feedburner: string | null;
  feedburner_location: string | null;
  tags: string | null;
  template_suffix: string | null;
  created_at: string;
  updated_at: string;
}

export interface Article {
  id: number;
  blog_id: number;
  title: string;
  handle: string | null;
  author: string | null;
  body_html: string | null;
  summary_html: string | null;
  tags: string | null;
  image_src: string | null;
  image_alt: string | null;
  image_width: number | null;
  image_height: number | null;
  supabase_image_url: string | null;
  published: boolean;
  published_at: string | null;
  template_suffix: string | null;
  user_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface ArticleWithBlog extends Article {
  blog: Blog;
}
