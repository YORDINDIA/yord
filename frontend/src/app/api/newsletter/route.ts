import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isRateLimited, clientIp, rateLimitResponse, EMAIL_RE } from '@/lib/rate-limit';
import { logDbError } from '@/lib/logger';

function getClients() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return { supabase: createClient(url, serviceKey) };
}

export async function POST(request: NextRequest) {
  try {
    if (isRateLimited(`newsletter:${clientIp(request)}`, 5, 60 * 60 * 1000)) {
      return rateLimitResponse();
    }

    const clients = getClients();
    if (!clients) {
      logDbError('newsletter', { code: 'MISCONFIGURED', message: 'Missing Supabase env vars' });
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }
    const { supabase } = clients;

    const { email } = await request.json();

    if (typeof email !== 'string' || !EMAIL_RE.test(email.trim()) || email.length > 254) {
      return NextResponse.json(
        { error: 'Valid email address is required' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if email already exists
    const { data: existing } = await supabase
      .from('newsletter_subscribers')
      .select('id')
      .eq('email', normalizedEmail)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'Email already subscribed' },
        { status: 409 }
      );
    }

    // Insert new subscriber
    const { error: insertError } = await supabase
      .from('newsletter_subscribers')
      .insert({
        email: normalizedEmail,
        subscribed_at: new Date().toISOString(),
      });

    if (insertError) {
      logDbError('newsletter', insertError);
      return NextResponse.json(
        { error: 'Failed to subscribe. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logDbError('newsletter', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
