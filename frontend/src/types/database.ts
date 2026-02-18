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
  'akon',
  'anuv-jain',
  'ap-dhillon',
  'arijit-singh',
  'badshah',
  'behemoth',
  'billie-eilish',
  'bryan-adams',
  'bts',
  'calvin-harris',
  'cigarettes-after-sex',
  'coldplay',
  'def-leppard',
  'diljit-dosanjh',
  'divine',
  'dj-snake',
  'dream-theater',
  'dua-lipa',
  'ed-sheeran',
  'fred-again',
  'fujii-kaze',
  'glass-animals',
  'green-day',
  'guns-and-roses',
  'hanumankind',
  'honey-singh',
  'imagine-dragons',
  'jackson-wang',
  'john-mayer',
  'justin-bieber',
  'kanye-west',
  'karan-aujla',
  'kehlani',
  'keinemusik',
  'king',
  'krsna',
  'lana-del-rey',
  'lany',
  'linkin-park',
  'lollapalooza-india',
  'louis-tomlinson',
  'maroon-5',
  'marshmello',
  'martin-garrix',
  'mc-stan',
  'nick-jonas',
  'nucleya',
  'onerepublic',
  'playboi-carti',
  'post-malone',
  'prabh-deep',
  'prateek-kuhad',
  'raftaar',
  'ritviz',
  'seedhe-maut',
  'shawn-mendes',
  'sidhu-moosewala',
  'sunburn-festival',
  'talwiinder',
  'taylor-swift',
  'the-lumineers',
  'the-weeknd',
  'tiesto',
  'travis-scott',
  'yungblud',
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
  akon: {
    handle: 'akon',
    name: 'Akon',
    vendorName: 'Akon',
    tagline: 'Smack That Collection',
    bio: "Akon's iconic R&B and hip-hop style in premium merchandise. The Senegalese-American superstar has performed in India multiple times.",
    heroImage: '/artists/akon-hero.jpg',
    accentColor: '#FFD700',
    secondaryColor: '#1C1C1C',
  },
  'anuv-jain': {
    handle: 'anuv-jain',
    name: 'Anuv Jain',
    vendorName: 'Anuv Jain',
    tagline: 'Baarishein Vibes',
    bio: "India's indie-pop sensation. Premium merchandise for fans of Baarishein, Husn, and Alag Aasmaan.",
    heroImage: '/artists/anuv-jain-hero.jpg',
    accentColor: '#A8D8EA',
    secondaryColor: '#2C3E50',
  },
  'ap-dhillon': {
    handle: 'ap-dhillon',
    name: 'AP Dhillon',
    vendorName: 'AP Dhillon',
    tagline: 'The Brownprint',
    bio: "AP Dhillon's Indo-Canadian fusion sound redefined Punjabi music globally. Shop exclusive Brownprint Tour merchandise.",
    heroImage: '/artists/ap-dhillon-hero.jpg',
    accentColor: '#FF3D00',
    secondaryColor: '#1A1A2E',
  },
  'arijit-singh': {
    handle: 'arijit-singh',
    name: 'Arijit Singh',
    vendorName: 'Arijit Singh',
    tagline: "India's Voice",
    bio: "India's most beloved playback singer. Premium merchandise for fans of Tum Hi Ho, Channa Mereya, and Kesariya.",
    heroImage: '/artists/arijit-singh-hero.jpg',
    accentColor: '#E91E63',
    secondaryColor: '#1A1A1A',
  },
  badshah: {
    handle: 'badshah',
    name: 'Badshah',
    vendorName: 'Badshah',
    tagline: 'Paagal Collection',
    bio: "India's biggest commercial rapper. Shop Badshah merchandise featuring designs inspired by DJ Waale Babu and Kala Chashma.",
    heroImage: '/artists/badshah-hero.jpg',
    accentColor: '#FF9800',
    secondaryColor: '#212121',
  },
  'billie-eilish': {
    handle: 'billie-eilish',
    name: 'Billie Eilish',
    vendorName: 'Billie Eilish',
    tagline: 'Hit Me Hard and Soft',
    bio: "Billie Eilish's dark aesthetic meets premium fashion. Fan-made designs inspired by the Grammy-winning artist.",
    heroImage: '/artists/billie-eilish-hero.jpg',
    accentColor: '#00FF41',
    secondaryColor: '#0D0D0D',
  },
  'bryan-adams': {
    handle: 'bryan-adams',
    name: 'Bryan Adams',
    vendorName: 'Bryan Adams',
    tagline: 'So Happy It Hurts',
    bio: "Classic rock royalty. Premium Bryan Adams merchandise inspired by Summer of '69 and decades of rock anthems.",
    heroImage: '/artists/bryan-adams-hero.jpg',
    accentColor: '#B22222',
    secondaryColor: '#1C1C1C',
  },
  'cigarettes-after-sex': {
    handle: 'cigarettes-after-sex',
    name: 'Cigarettes After Sex',
    vendorName: 'Cigarettes After Sex',
    tagline: 'Apocalypse Aesthetic',
    bio: "Dream pop aesthetics in premium fashion. Minimalist merchandise for fans of Apocalypse, K., and Nothing's Gonna Hurt You Baby.",
    heroImage: '/artists/cas-hero.jpg',
    accentColor: '#B0BEC5',
    secondaryColor: '#0D0D0D',
  },
  coldplay: {
    handle: 'coldplay',
    name: 'Coldplay',
    vendorName: 'ColdPlay',
    tagline: 'Music of the Spheres',
    bio: "Experience the ethereal beauty of Coldplay's universe with exclusive concert couture. From the iconic Music of the Spheres World Tour, each piece captures the magic of live performance.",
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
  divine: {
    handle: 'divine',
    name: 'DIVINE',
    vendorName: 'DIVINE',
    tagline: 'Gully Gang',
    bio: "The pioneer of Indian street rap. DIVINE put Mumbai's hip-hop on the global map. Shop official Gully Boy-inspired merchandise.",
    heroImage: '/artists/divine-hero.jpg',
    accentColor: '#FF5722',
    secondaryColor: '#1C1C1C',
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
  'glass-animals': {
    handle: 'glass-animals',
    name: 'Glass Animals',
    vendorName: 'Glass Animals',
    tagline: 'Heat Waves',
    bio: 'Psychedelic pop aesthetics in premium fashion. Glass Animals merchandise inspired by Heat Waves and Dreamland.',
    heroImage: '/artists/glass-animals-hero.jpg',
    accentColor: '#FF6F61',
    secondaryColor: '#2E294E',
  },
  'green-day': {
    handle: 'green-day',
    name: 'Green Day',
    vendorName: 'Green Day',
    tagline: 'American Idiot',
    bio: "Punk rock meets premium fashion. Shop Green Day merchandise featuring designs inspired by American Idiot and Boulevard of Broken Dreams.",
    heroImage: '/artists/green-day-hero.jpg',
    accentColor: '#00FF00',
    secondaryColor: '#1C1C1C',
  },
  'guns-and-roses': {
    handle: 'guns-and-roses',
    name: "Guns N' Roses",
    vendorName: 'Guns and Roses',
    tagline: 'Rock Legends',
    bio: "Classic rock meets premium fashion. Channel your inner rock god with official Guns N' Roses merchandise.",
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
  'imagine-dragons': {
    handle: 'imagine-dragons',
    name: 'Imagine Dragons',
    vendorName: 'Imagine Dragons',
    tagline: 'Believer',
    bio: "Arena rock anthems meet premium fashion. Shop Imagine Dragons merchandise inspired by Believer, Radioactive, and Thunder.",
    heroImage: '/artists/imagine-dragons-hero.jpg',
    accentColor: '#FFD700',
    secondaryColor: '#2C2C2C',
  },
  'jackson-wang': {
    handle: 'jackson-wang',
    name: 'Jackson Wang',
    vendorName: 'Jackson Wang',
    tagline: 'TEAM WANG',
    bio: "K-pop meets luxury streetwear. Jackson Wang's TEAM WANG aesthetic in premium merchandise.",
    heroImage: '/artists/jackson-wang-hero.jpg',
    accentColor: '#FF1744',
    secondaryColor: '#0D0D0D',
  },
  'john-mayer': {
    handle: 'john-mayer',
    name: 'John Mayer',
    vendorName: 'John Mayer',
    tagline: 'Sob Rock',
    bio: "Guitar virtuoso meets premium fashion. John Mayer merchandise for fans of Gravity, Slow Dancing, and Waiting on the World to Change.",
    heroImage: '/artists/john-mayer-hero.jpg',
    accentColor: '#5C6BC0',
    secondaryColor: '#1A1A1A',
  },
  'justin-bieber': {
    handle: 'justin-bieber',
    name: 'Justin Bieber',
    vendorName: 'Justin Bieber',
    tagline: 'Justice World Tour',
    bio: "Premium Justin Bieber merchandise for Indian Beliebers. Designs inspired by the Justice and Purpose eras.",
    heroImage: '/artists/justin-bieber-hero.jpg',
    accentColor: '#E040FB',
    secondaryColor: '#1C1C1C',
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
  king: {
    handle: 'king',
    name: 'King',
    vendorName: 'King',
    tagline: 'Champagne Talk',
    bio: "India's pop sensation. Shop King merchandise inspired by Maan Meri Jaan and Tu Aake Dekhle.",
    heroImage: '/artists/king-hero.jpg',
    accentColor: '#FFB300',
    secondaryColor: '#1A1A2E',
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
  'lana-del-rey': {
    handle: 'lana-del-rey',
    name: 'Lana Del Rey',
    vendorName: 'Lana Del Rey',
    tagline: 'Born to Die',
    bio: "Vintage glamour meets premium fashion. Lana Del Rey merchandise with her signature melancholic aesthetic.",
    heroImage: '/artists/lana-del-rey-hero.jpg',
    accentColor: '#D4AF37',
    secondaryColor: '#1C0A0A',
  },
  'linkin-park': {
    handle: 'linkin-park',
    name: 'Linkin Park',
    vendorName: 'Linkin Park',
    tagline: 'From Zero',
    bio: "Linkin Park's iconic nu-metal aesthetic in premium merchandise. From Hybrid Theory to From Zero, wear the legacy.",
    heroImage: '/artists/linkin-park-hero.jpg',
    accentColor: '#FF0000',
    secondaryColor: '#0A0A0A',
  },
  'lollapalooza-india': {
    handle: 'lollapalooza-india',
    name: 'Lollapalooza India',
    vendorName: 'lollapalooza india',
    tagline: 'Festival Collection',
    bio: "Celebrate India's biggest music festival with exclusive Lollapalooza merchandise.",
    heroImage: '/artists/lolla-hero.jpg',
    accentColor: '#00BCD4',
    secondaryColor: '#E91E63',
  },
  'louis-tomlinson': {
    handle: 'louis-tomlinson',
    name: 'Louis Tomlinson',
    vendorName: 'Louis Tomlinson',
    tagline: 'Faith in the Future',
    bio: "Former One Direction star turned solo artist. Premium Louis Tomlinson merchandise for Directioners and solo fans.",
    heroImage: '/artists/louis-tomlinson-hero.jpg',
    accentColor: '#42A5F5',
    secondaryColor: '#1A1A1A',
  },
  'maroon-5': {
    handle: 'maroon-5',
    name: 'Maroon 5',
    vendorName: 'Maroon 5',
    tagline: 'Moves Like Jagger',
    bio: "Pop-rock perfection. Maroon 5 merchandise featuring designs inspired by their chart-topping hits and live shows.",
    heroImage: '/artists/maroon-5-hero.jpg',
    accentColor: '#C62828',
    secondaryColor: '#1C1C1C',
  },
  marshmello: {
    handle: 'marshmello',
    name: 'Marshmello',
    vendorName: 'Marshmello',
    tagline: 'Helmet On',
    bio: "The masked DJ's playful aesthetic in premium fashion. Marshmello merchandise for fans of Happier and Alone.",
    heroImage: '/artists/marshmello-hero.jpg',
    accentColor: '#FFFFFF',
    secondaryColor: '#1A1A1A',
  },
  'martin-garrix': {
    handle: 'martin-garrix',
    name: 'Martin Garrix',
    vendorName: 'Martin Garrix',
    tagline: 'Animals',
    bio: "World's #1 DJ. Martin Garrix merchandise featuring designs inspired by Animals and In the Name of Love.",
    heroImage: '/artists/martin-garrix-hero.jpg',
    accentColor: '#00BCD4',
    secondaryColor: '#0D0D0D',
  },
  'mc-stan': {
    handle: 'mc-stan',
    name: 'MC Stan',
    vendorName: 'MC Stan',
    tagline: 'Insaan',
    bio: "Pune's street rap king. MC Stan merchandise inspired by Insaan, Amin, and his raw street style.",
    heroImage: '/artists/mc-stan-hero.jpg',
    accentColor: '#FF5722',
    secondaryColor: '#0D0D0D',
  },
  'nick-jonas': {
    handle: 'nick-jonas',
    name: 'Nick Jonas',
    vendorName: 'Nick Jonas',
    tagline: 'Jealous',
    bio: "Nick Jonas merchandise for Indian fans. The Jonas Brother with deep India connections, married to Priyanka Chopra.",
    heroImage: '/artists/nick-jonas-hero.jpg',
    accentColor: '#7B1FA2',
    secondaryColor: '#1C1C1C',
  },
  nucleya: {
    handle: 'nucleya',
    name: 'Nucleya',
    vendorName: 'Nucleya',
    tagline: 'Bass Rani',
    bio: "India's bass music pioneer. Nucleya merchandise inspired by Laung Gawacha and his fusion of bass, hip-hop, and Indian folk.",
    heroImage: '/artists/nucleya-hero.jpg',
    accentColor: '#FF6F00',
    secondaryColor: '#1A1A1A',
  },
  onerepublic: {
    handle: 'onerepublic',
    name: 'OneRepublic',
    vendorName: 'OneRepublic',
    tagline: 'Counting Stars',
    bio: "Pop-rock excellence. OneRepublic merchandise for fans of Counting Stars, Apologize, and Secrets.",
    heroImage: '/artists/onerepublic-hero.jpg',
    accentColor: '#FFC107',
    secondaryColor: '#1C1C1C',
  },
  'post-malone': {
    handle: 'post-malone',
    name: 'Post Malone',
    vendorName: 'Post Malone',
    tagline: 'Rockstar',
    bio: "Post Malone's eclectic style in premium merchandise. Designs inspired by Rockstar, Sunflower, and Circles.",
    heroImage: '/artists/post-malone-hero.jpg',
    accentColor: '#FF8A65',
    secondaryColor: '#1C1C1C',
  },
  'prabh-deep': {
    handle: 'prabh-deep',
    name: 'Prabh Deep',
    vendorName: 'Prabh Deep',
    tagline: 'Tabia',
    bio: "Delhi's underground hip-hop pioneer. Prabh Deep merchandise for fans of Indian alternative hip-hop.",
    heroImage: '/artists/prabh-deep-hero.jpg',
    accentColor: '#3F51B5',
    secondaryColor: '#0D0D0D',
  },
  'prateek-kuhad': {
    handle: 'prateek-kuhad',
    name: 'Prateek Kuhad',
    vendorName: 'Prateek Kuhad',
    tagline: 'Cold/Mess',
    bio: "India's indie-folk icon, endorsed by Barack Obama. Premium Prateek Kuhad merchandise for fans of Cold/Mess and Kasoor.",
    heroImage: '/artists/prateek-kuhad-hero.jpg',
    accentColor: '#8D6E63',
    secondaryColor: '#2C2C2C',
  },
  raftaar: {
    handle: 'raftaar',
    name: 'Raftaar',
    vendorName: 'Raftaar',
    tagline: 'Swag Mera Desi',
    bio: "Indian rap heavyweight. Raftaar merchandise for fans of Swag Mera Desi and his Bollywood hits.",
    heroImage: '/artists/raftaar-hero.jpg',
    accentColor: '#F44336',
    secondaryColor: '#1C1C1C',
  },
  ritviz: {
    handle: 'ritviz',
    name: 'Ritviz',
    vendorName: 'Ritviz',
    tagline: 'Udd Gaye',
    bio: "India's electronic pop pioneer. Ritviz merchandise inspired by Udd Gaye, Sage, and Liggi.",
    heroImage: '/artists/ritviz-hero.jpg',
    accentColor: '#AB47BC',
    secondaryColor: '#1A1A2E',
  },
  'seedhe-maut': {
    handle: 'seedhe-maut',
    name: 'Seedhe Maut',
    vendorName: 'Seedhe Maut',
    tagline: 'Nayaab',
    bio: "India's most acclaimed hip-hop duo. Seedhe Maut merchandise for fans of Nayaab and their intricate rap flows.",
    heroImage: '/artists/seedhe-maut-hero.jpg',
    accentColor: '#4CAF50',
    secondaryColor: '#0D0D0D',
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
  'sunburn-festival': {
    handle: 'sunburn-festival',
    name: 'Sunburn Festival',
    vendorName: 'Sunburn Festival',
    tagline: "Asia's Biggest EDM Festival",
    bio: "Celebrate Asia's largest electronic dance music festival with exclusive Sunburn merchandise. Festival fashion for EDM lovers.",
    heroImage: '/artists/sunburn-hero.jpg',
    accentColor: '#FF6D00',
    secondaryColor: '#0D0D0D',
  },
  talwiinder: {
    handle: 'talwiinder',
    name: 'Talwiinder',
    vendorName: 'Talwiinder',
    tagline: 'Dil Da',
    bio: "India's rising R&B star. Talwiinder merchandise for fans of his smooth Punjabi R&B sound.",
    heroImage: '/artists/talwiinder-hero.jpg',
    accentColor: '#CE93D8',
    secondaryColor: '#1A1A2E',
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
  'the-weeknd': {
    handle: 'the-weeknd',
    name: 'The Weeknd',
    vendorName: 'The Weeknd',
    tagline: 'After Hours',
    bio: "The Weeknd's dark R&B aesthetic in premium merchandise. Designs inspired by After Hours and Blinding Lights.",
    heroImage: '/artists/the-weeknd-hero.jpg',
    accentColor: '#FF0000',
    secondaryColor: '#0A0A0A',
  },
  'travis-scott': {
    handle: 'travis-scott',
    name: 'Travis Scott',
    vendorName: 'Travis Scott',
    tagline: 'Utopia',
    bio: "Cactus Jack aesthetics in premium fashion. Travis Scott merchandise inspired by Utopia and SICKO MODE.",
    heroImage: '/artists/travis-scott-hero.jpg',
    accentColor: '#795548',
    secondaryColor: '#0A0A0A',
  },
  behemoth: {
    handle: 'behemoth',
    name: 'Behemoth',
    vendorName: 'Behemoth',
    tagline: 'Chant of the Eastern Lands',
    bio: "Extreme metal giants Behemoth bring their blackened death metal aesthetic. Premium merchandise for fans of Nergal and the most theatrical metal band in the world.",
    heroImage: '/artists/behemoth-hero.jpg',
    accentColor: '#8B0000',
    secondaryColor: '#0A0A0A',
  },
  bts: {
    handle: 'bts',
    name: 'BTS',
    vendorName: 'BTS',
    tagline: 'Beyond The Scene',
    bio: "BTS ARMY-inspired premium merchandise. Celebrate the global K-pop phenomenon with designs inspired by Dynamite, Butter, and the Bangtan Boys' iconic aesthetic.",
    heroImage: '/artists/bts-hero.jpg',
    accentColor: '#9B59B6',
    secondaryColor: '#1A1A2E',
  },
  'calvin-harris': {
    handle: 'calvin-harris',
    name: 'Calvin Harris',
    vendorName: 'Calvin Harris',
    tagline: 'India Debut 2026',
    bio: "The world's highest-paid DJ comes to India. Premium merch inspired by Summer, Feel So Close, One Kiss, and This Is What You Came For.",
    heroImage: '/artists/calvin-harris-hero.jpg',
    accentColor: '#FF6B35',
    secondaryColor: '#0D0D0D',
  },
  'def-leppard': {
    handle: 'def-leppard',
    name: 'Def Leppard',
    vendorName: 'Def Leppard',
    tagline: 'Rock of Ages',
    bio: "Rock & Roll Hall of Fame legends. Premium merch inspired by Pour Some Sugar on Me, Hysteria, and Animal. India Tour 2026.",
    heroImage: '/artists/def-leppard-hero.jpg',
    accentColor: '#C0392B',
    secondaryColor: '#1C1C1C',
  },
  'dj-snake': {
    handle: 'dj-snake',
    name: 'DJ Snake',
    vendorName: 'DJ Snake',
    tagline: 'India Tour 2026',
    bio: "French EDM superstar DJ Snake. Premium merchandise inspired by Turn Down for What, Lean On, Taki Taki, and his massive India tours.",
    heroImage: '/artists/dj-snake-hero.jpg',
    accentColor: '#27AE60',
    secondaryColor: '#0A0A0A',
  },
  'dream-theater': {
    handle: 'dream-theater',
    name: 'Dream Theater',
    vendorName: 'Dream Theater',
    tagline: '40th Anniversary',
    bio: "Progressive metal pioneers Dream Theater. Premium merch celebrating 40 years of technical mastery, from Metropolis to The Astonishing.",
    heroImage: '/artists/dream-theater-hero.jpg',
    accentColor: '#3498DB',
    secondaryColor: '#0D0D1A',
  },
  'fred-again': {
    handle: 'fred-again',
    name: 'Fred Again..',
    vendorName: 'Fred Again',
    tagline: 'USB Collection',
    bio: "Fred Again.. brings emotional electronic music to the mainstream. Premium merch inspired by Marea, Leavemealone, and Delilah (pull me out of this).",
    heroImage: '/artists/fred-again-hero.jpg',
    accentColor: '#E67E22',
    secondaryColor: '#1A1A1A',
  },
  'fujii-kaze': {
    handle: 'fujii-kaze',
    name: 'Fujii Kaze',
    vendorName: 'Fujii Kaze',
    tagline: 'Shinunoga E-Wa',
    bio: "Japanese singer-songwriter Fujii Kaze. Premium merch for fans of Shinunoga E-Wa, Matataki, and his genre-defying pop sound. Performed at Lollapalooza India 2026.",
    heroImage: '/artists/fujii-kaze-hero.jpg',
    accentColor: '#F39C12',
    secondaryColor: '#2C3E50',
  },
  'kanye-west': {
    handle: 'kanye-west',
    name: 'Ye (Kanye West)',
    vendorName: 'Kanye West',
    tagline: 'India Debut 2026',
    bio: "Ye (Kanye West) makes his India debut in 2026. Premium fan-made merch inspired by the most influential artist of the 21st century — Stronger, Gold Digger, Runaway, and the Yeezy aesthetic.",
    heroImage: '/artists/kanye-west-hero.jpg',
    accentColor: '#D4A574',
    secondaryColor: '#0A0A0A',
  },
  kehlani: {
    handle: 'kehlani',
    name: 'Kehlani',
    vendorName: 'Kehlani',
    tagline: 'Crash Collection',
    bio: "R&B sensation Kehlani. Premium merch for fans of Gangsta, Distraction, and her soulful vocals. Performed at Lollapalooza India 2026.",
    heroImage: '/artists/kehlani-hero.jpg',
    accentColor: '#E91E63',
    secondaryColor: '#1A0A1A',
  },
  keinemusik: {
    handle: 'keinemusik',
    name: 'Keinemusik',
    vendorName: 'Keinemusik',
    tagline: 'Berlin Sound',
    bio: "Berlin's boundary-pushing house and techno collective. &ME, Adam Port, and Rampa bring their genre-blending sound to India. Premium merch for deep house fans.",
    heroImage: '/artists/keinemusik-hero.jpg',
    accentColor: '#1ABC9C',
    secondaryColor: '#0D0D0D',
  },
  lany: {
    handle: 'lany',
    name: 'LANY',
    vendorName: 'LANY',
    tagline: 'ILYSB Collection',
    bio: "LANY's dreamy indie-pop in premium merchandise. Designs inspired by ILYSB, Malibu Nights, and their romantic sonic aesthetic. Performed at Lollapalooza India 2026.",
    heroImage: '/artists/lany-hero.jpg',
    accentColor: '#AED6F1',
    secondaryColor: '#1A1A2E',
  },
  'playboi-carti': {
    handle: 'playboi-carti',
    name: 'Playboi Carti',
    vendorName: 'Playboi Carti',
    tagline: 'Opium',
    bio: "Playboi Carti's avant-garde rap aesthetic in premium merch. Inspired by Magnolia, Shoota, and the Opium era. Headlined Lollapalooza India 2026.",
    heroImage: '/artists/playboi-carti-hero.jpg',
    accentColor: '#E74C3C',
    secondaryColor: '#0A0A0A',
  },
  'the-lumineers': {
    handle: 'the-lumineers',
    name: 'The Lumineers',
    vendorName: 'The Lumineers',
    tagline: 'Automatic World Tour',
    bio: "The Lumineers' folk-rock warmth in premium merchandise. Designs inspired by Ho Hey, Ophelia, Stubborn Love, and their Americana sound.",
    heroImage: '/artists/the-lumineers-hero.jpg',
    accentColor: '#D4A76A',
    secondaryColor: '#2C1810',
  },
  tiesto: {
    handle: 'tiesto',
    name: 'Tiësto',
    vendorName: 'Tiësto',
    tagline: 'India Tour 2026',
    bio: "The godfather of trance and EDM. Premium merch inspired by Red Lights, The Business, and 10:35. Tiësto toured India in January 2026.",
    heroImage: '/artists/tiesto-hero.jpg',
    accentColor: '#00BCD4',
    secondaryColor: '#0A0A1A',
  },
  yungblud: {
    handle: 'yungblud',
    name: 'YUNGBLUD',
    vendorName: 'YUNGBLUD',
    tagline: 'Punk Energy',
    bio: "YUNGBLUD's genre-bending punk energy in premium merch. Inspired by Fleabag, Parents, and his rebellious aesthetic. Performed at Lollapalooza India 2026.",
    heroImage: '/artists/yungblud-hero.jpg',
    accentColor: '#FF69B4',
    secondaryColor: '#0D0D0D',
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
