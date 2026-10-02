import 'server-only';

import { sanitizeSearch } from '@/lib/pagination';
import { reader, rows } from './client';

/**
 * Global admin search (the command palette's live results).
 *
 * Three bounded `ilike` queries in parallel through the shared `reader()`,
 * mirroring the per-list filters so a palette hit and a list hit agree:
 *
 *  - products  → `title` / `handle`  (same columns as `listProducts`)
 *  - orders    → `name` / `email`    (same columns as `listOrders`)
 *  - customers → `first_name` / `last_name` / `email` (same as `listCustomers`)
 *
 * The term goes through `sanitizeSearch()` first: it strips the characters
 * PostgREST reads as filter syntax (`%`, `(`, `)`, `,`, `"`) plus the LIKE
 * wildcard aliases (`_`, `*`) and caps the length at `MAX_SEARCH_LENGTH`, so a
 * hostile query string cannot reshape the filter, silently widen the match or
 * turn into a slow query. Every branch is `.order(...).limit(...)`-bounded —
 * this is a palette, not an export.
 */

export interface SearchProduct {
  id: string;
  title: string;
  /** Secondary line: status plus handle, whichever exist. */
  meta: string;
}

export interface SearchOrder {
  id: string;
  name: string;
  email: string;
}

export interface SearchCustomer {
  id: string;
  name: string;
  email: string;
}

export interface SearchResults {
  products: SearchProduct[];
  orders: SearchOrder[];
  customers: SearchCustomer[];
}

/** Rows per entity. Small on purpose: the palette shows a handful per group. */
export const SEARCH_LIMIT = 5;

/** Upper bound for a caller-supplied limit, so no request can ask for everything. */
const SEARCH_LIMIT_MAX = 25;

/** The empty result shape, shared by the route handler and the palette. */
export function emptySearchResults(): SearchResults {
  return { products: [], orders: [], customers: [] };
}

interface ProductSeed {
  id: number;
  title: string;
  handle: string | null;
  status: string | null;
}

interface OrderSeed {
  id: number | string;
  name: string | null;
  email: string | null;
}

interface CustomerSeed {
  id: number | string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
}

export async function searchAll(q: string, limit = SEARCH_LIMIT): Promise<SearchResults> {
  const search = sanitizeSearch(q);
  // A term that sanitizes to nothing (or was blank) is not a failure — it is an
  // empty result. Never build a `.or()` from it: PostgREST rejects an empty
  // filter and `%` would match every row.
  if (!search) return emptySearchResults();

  const take = Math.min(Math.max(1, Math.floor(limit)), SEARCH_LIMIT_MAX);
  const pattern = `%${search}%`;
  const supabase = await reader();

  const [products, orders, customers] = await Promise.all([
    rows<ProductSeed>(
      'products',
      supabase
        .from('products')
        .select('id, title, handle, status')
        .or(`title.ilike.${pattern},handle.ilike.${pattern}`)
        .order('updated_at', { ascending: false })
        .limit(take),
    ),
    rows<OrderSeed>(
      'orders',
      supabase
        .from('orders')
        .select('id, name, email')
        .or(`name.ilike.${pattern},email.ilike.${pattern}`)
        .order('created_at', { ascending: false })
        .limit(take),
    ),
    rows<CustomerSeed>(
      'customers',
      supabase
        .from('customers')
        .select('id, email, first_name, last_name')
        .or(`first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern}`)
        .order('created_at', { ascending: false })
        .limit(take),
    ),
  ]);

  return {
    products: products.map((row) => ({
      // BIGINT ids travel as strings into route params, as they do everywhere
      // else in the admin.
      id: String(row.id),
      title: row.title,
      meta: [row.status, row.handle ? `/${row.handle}` : null].filter(Boolean).join(' · '),
    })),
    orders: orders.map((row) => ({
      id: String(row.id),
      name: row.name || `#${row.id}`,
      email: row.email ?? '',
    })),
    customers: customers.map((row) => {
      const name = [row.first_name, row.last_name].filter(Boolean).join(' ').trim();
      return {
        id: String(row.id),
        name: name || row.email || 'Unnamed customer',
        email: row.email ?? '',
      };
    }),
  };
}
