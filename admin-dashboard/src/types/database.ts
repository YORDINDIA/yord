export interface Database {
  public: {
    Tables: {
      products: { Row: Product; Insert: Partial<Product>; Update: Partial<Product> };
      product_variants: { Row: ProductVariant; Insert: Partial<ProductVariant>; Update: Partial<ProductVariant> };
      product_images: { Row: ProductImage; Insert: Partial<ProductImage>; Update: Partial<ProductImage> };
      product_options: { Row: ProductOption; Insert: Partial<ProductOption>; Update: Partial<ProductOption> };
      collections: { Row: Collection; Insert: Partial<Collection>; Update: Partial<Collection> };
      collects: { Row: Collect; Insert: Partial<Collect>; Update: Partial<Collect> };
      smart_collection_rules: { Row: SmartCollectionRule; Insert: Partial<SmartCollectionRule>; Update: Partial<SmartCollectionRule> };
      inventory_items: { Row: InventoryItem; Insert: Partial<InventoryItem>; Update: Partial<InventoryItem> };
      inventory_levels: { Row: InventoryLevel; Insert: Partial<InventoryLevel>; Update: Partial<InventoryLevel> };
      locations: { Row: Location; Insert: Partial<Location>; Update: Partial<Location> };
      customers: { Row: Customer; Insert: Partial<Customer>; Update: Partial<Customer> };
      customer_addresses: { Row: CustomerAddress; Insert: Partial<CustomerAddress>; Update: Partial<CustomerAddress> };
      customer_marketing_consent: { Row: CustomerMarketingConsent; Insert: Partial<CustomerMarketingConsent>; Update: Partial<CustomerMarketingConsent> };
      orders: { Row: Order; Insert: Partial<Order>; Update: Partial<Order> };
      line_items: { Row: LineItem; Insert: Partial<LineItem>; Update: Partial<LineItem> };
      transactions: { Row: Transaction; Insert: Partial<Transaction>; Update: Partial<Transaction> };
      fulfillments: { Row: Fulfillment; Insert: Partial<Fulfillment>; Update: Partial<Fulfillment> };
      refunds: { Row: Refund; Insert: Partial<Refund>; Update: Partial<Refund> };
      refund_transactions: { Row: RefundTransaction; Insert: Partial<RefundTransaction>; Update: Partial<RefundTransaction> };
      price_rules: { Row: PriceRule; Insert: Partial<PriceRule>; Update: Partial<PriceRule> };
      discount_codes: { Row: DiscountCode; Insert: Partial<DiscountCode>; Update: Partial<DiscountCode> };
      blogs: { Row: Blog; Insert: Partial<Blog>; Update: Partial<Blog> };
      articles: { Row: Article; Insert: Partial<Article>; Update: Partial<Article> };
      admin_users: { Row: AdminUser; Insert: Partial<AdminUser>; Update: Partial<AdminUser> };
      admin_audit_log: { Row: AdminAuditLog; Insert: Partial<AdminAuditLog>; Update: Partial<AdminAuditLog> };
      ai_jobs: { Row: AiJob; Insert: Partial<AiJob>; Update: Partial<AiJob> };
      ai_suggestions: { Row: AiSuggestion; Insert: Partial<AiSuggestion>; Update: Partial<AiSuggestion> };
      ai_assets: { Row: AiAsset; Insert: Partial<AiAsset>; Update: Partial<AiAsset> };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

export interface Product {
  id: number;
  title: string;
  body_html: string | null;
  vendor: string | null;
  product_type: string | null;
  handle: string | null;
  status: 'active' | 'archived' | 'draft' | string;
  published_at: string | null;
  published_scope: string | null;
  template_suffix: string | null;
  tags: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface ProductVariant {
  id: number;
  product_id: number;
  title: string | null;
  price: number | null;
  compare_at_price: number | null;
  position: number | null;
  sku: string | null;
  barcode: string | null;
  grams: number | null;
  weight: number | null;
  weight_unit: string | null;
  inventory_item_id: number | null;
  inventory_quantity: number | null;
  inventory_policy: string | null;
  inventory_management: string | null;
  fulfillment_service: string | null;
  requires_shipping: boolean | null;
  taxable: boolean | null;
  option1: string | null;
  option2: string | null;
  option3: string | null;
  image_id: number | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface ProductImage {
  id: number;
  product_id: number;
  position: number | null;
  src: string | null;
  alt: string | null;
  width: number | null;
  height: number | null;
  supabase_url: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface ProductOption {
  id: number;
  product_id: number;
  name: string;
  position: number | null;
  values: string[] | null;
}

export interface Collection {
  id: number;
  title: string;
  handle: string | null;
  body_html: string | null;
  collection_type: 'smart' | 'custom' | string;
  published: boolean | null;
  published_at: string | null;
  published_scope: string | null;
  sort_order: string | null;
  template_suffix: string | null;
  disjunctive: boolean | null;
  image_src: string | null;
  image_alt: string | null;
  updated_at: string | null;
}

export interface Collect {
  id: number;
  collection_id: number;
  product_id: number;
  position: number | null;
  sort_value: string | null;
  created_at: string | null;
}

export interface SmartCollectionRule {
  id: number;
  collection_id: number;
  column_name: string;
  relation: string;
  condition: string;
}

export interface InventoryItem {
  id: number;
  sku: string | null;
  cost: number | null;
  tracked: boolean | null;
  requires_shipping: boolean | null;
  country_code_of_origin: string | null;
  province_code_of_origin: string | null;
  harmonized_system_code: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface InventoryLevel {
  inventory_item_id: number;
  location_id: number;
  available: number | null;
  updated_at: string | null;
}

export interface Location {
  id: number;
  name: string;
  active: boolean | null;
  legacy: boolean | null;
  address1: string | null;
  address2: string | null;
  city: string | null;
  province: string | null;
  province_code: string | null;
  country: string | null;
  country_code: string | null;
  zip: string | null;
  phone: string | null;
  created_at: string | null;
  updated_at: string | null;
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
  verified_email: boolean | null;
  tax_exempt: boolean | null;
  orders_count: number | null;
  total_spent: number | null;
  last_order_id: number | null;
  last_order_name: string | null;
  currency: string | null;
  accepts_marketing: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface CustomerAddress {
  id: number;
  customer_id: number;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  address1: string | null;
  address2: string | null;
  city: string | null;
  province: string | null;
  province_code: string | null;
  country: string | null;
  country_code: string | null;
  zip: string | null;
  phone: string | null;
  is_default: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface CustomerMarketingConsent {
  customer_id: number;
  email_state: string | null;
  email_opt_in_level: string | null;
  email_consent_updated_at: string | null;
  sms_state: string | null;
  sms_opt_in_level: string | null;
  sms_consent_updated_at: string | null;
  sms_consent_collected_from: string | null;
}

export interface Order {
  id: number;
  customer_id: number | null;
  name: string | null;
  order_number: number | null;
  email: string | null;
  phone: string | null;
  note: string | null;
  tags: string | null;
  financial_status: string | null;
  fulfillment_status: string | null;
  cancel_reason: string | null;
  cancelled_at: string | null;
  currency: string | null;
  presentment_currency: string | null;
  total_price: number | null;
  subtotal_price: number | null;
  total_line_items_price: number | null;
  total_discounts: number | null;
  total_tax: number | null;
  total_shipping_price: number | null;
  total_tip_received: number | null;
  total_weight: number | null;
  total_outstanding: number | null;
  taxes_included: boolean | null;
  tax_exempt: boolean | null;
  buyer_accepts_marketing: boolean | null;
  test: boolean | null;
  browser_ip: string | null;
  customer_locale: string | null;
  landing_site: string | null;
  referring_site: string | null;
  source_name: string | null;
  confirmation_number: string | null;
  token: string | null;
  order_status_url: string | null;
  app_id: number | null;
  location_id: number | null;
  created_at: string | null;
  processed_at: string | null;
  closed_at: string | null;
  updated_at: string | null;
}

export interface LineItem {
  id: number;
  order_id: number;
  product_id: number | null;
  variant_id: number | null;
  title: string | null;
  name: string | null;
  variant_title: string | null;
  sku: string | null;
  vendor: string | null;
  price: number | null;
  quantity: number | null;
  current_quantity: number | null;
  fulfillable_quantity: number | null;
  total_discount: number | null;
  grams: number | null;
  requires_shipping: boolean | null;
  taxable: boolean | null;
  gift_card: boolean | null;
  fulfillment_service: string | null;
  fulfillment_status: string | null;
  product_exists: boolean | null;
  currency: string | null;
}

export interface Transaction {
  id: number;
  order_id: number;
  parent_id: number | null;
  kind: string | null;
  status: string | null;
  amount: number | null;
  currency: string | null;
  gateway: string | null;
  authorization: string | null;
  authorization_expires_at: string | null;
  message: string | null;
  error_code: string | null;
  source_name: string | null;
  payment_id: string | null;
  test: boolean | null;
  receipt: unknown | null;
  created_at: string | null;
  processed_at: string | null;
}

export interface Fulfillment {
  id: number;
  order_id: number;
  location_id: number | null;
  status: string | null;
  shipment_status: string | null;
  service: string | null;
  name: string | null;
  tracking_company: string | null;
  tracking_number: string | null;
  tracking_numbers: unknown | null;
  tracking_url: string | null;
  tracking_urls: unknown | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface Refund {
  id: number;
  order_id: number;
  note: string | null;
  restock: boolean | null;
  user_id: number | null;
  created_at: string | null;
  processed_at: string | null;
}

export interface RefundTransaction {
  refund_id: number;
  transaction_id: number;
  created_at: string | null;
}

export interface PriceRule {
  id: number;
  title: string;
  value: number;
  value_type: string;
  customer_selection: string;
  target_type: string;
  target_selection: string;
  allocation_method: string;
  allocation_limit: number | null;
  once_per_customer: boolean | null;
  usage_limit: number | null;
  starts_at: string;
  ends_at: string | null;
  entitled_product_ids: unknown | null;
  entitled_variant_ids: unknown | null;
  entitled_collection_ids: unknown | null;
  prerequisite_product_ids: unknown | null;
  prerequisite_variant_ids: unknown | null;
  prerequisite_collection_ids: unknown | null;
  prerequisite_customer_ids: unknown | null;
  prerequisite_subtotal_range: unknown | null;
  prerequisite_quantity_range: unknown | null;
  prerequisite_shipping_price_range: unknown | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface DiscountCode {
  id: number;
  price_rule_id: number;
  code: string;
  usage_count: number | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface Blog {
  id: number;
  title: string;
  handle: string | null;
  commentable: string | null;
  feedburner: string | null;
  feedburner_location: string | null;
  tags: string | null;
  template_suffix: string | null;
  created_at: string | null;
  updated_at: string | null;
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
  published: boolean | null;
  published_at: string | null;
  template_suffix: string | null;
  user_id: number | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface AdminUser {
  user_id: string;
  role: string;
  is_active: boolean | null;
  created_at: string | null;
}

export interface AdminAuditLog {
  id: number;
  actor_id: string;
  action: string;
  entity: string;
  entity_id: string;
  before: unknown | null;
  after: unknown | null;
  created_at: string | null;
}

export interface AiJob {
  id: number;
  type: string;
  status: string;
  input_ref: string | null;
  created_by: string | null;
  created_at: string | null;
}

export interface AiSuggestion {
  id: number;
  job_id: number;
  entity_type: string;
  entity_id: string;
  payload_json: unknown;
  created_at: string | null;
}

export interface AiAsset {
  id: number;
  job_id: number;
  storage_path: string;
  preview_url: string | null;
  metadata: unknown | null;
  created_at: string | null;
}
