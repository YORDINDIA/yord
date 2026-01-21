import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');
  const limit = parseInt(searchParams.get('limit') || '20');

  if (!query || query.trim().length < 2) {
    return NextResponse.json({ products: [] });
  }

  try {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        product_variants (
          id, title, price, compare_at_price,
          inventory_quantity, position
        ),
        product_images (
          id, src, supabase_url, alt, position
        )
      `)
      .eq('status', 'active')
      .or(`title.ilike.%${query}%,vendor.ilike.%${query}%,tags.ilike.%${query}%`)
      .order('published_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Search error:', error);
      return NextResponse.json({ products: [] });
    }

    return NextResponse.json({ products: data || [] });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json({ products: [] });
  }
}
