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
    if (isRateLimited(`contact:${clientIp(request)}`, 5, 60 * 60 * 1000)) {
      return rateLimitResponse();
    }

    const clients = getClients();
    if (!clients) {
      logDbError('contact', { code: 'MISCONFIGURED', message: 'Missing Supabase env vars' });
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }
    const { supabase } = clients;

    const { name, email, subject, message } = await request.json();

    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    if (
      typeof name !== 'string' || typeof email !== 'string' ||
      typeof subject !== 'string' || typeof message !== 'string' ||
      name.trim().length === 0 || name.length > 100 ||
      !EMAIL_RE.test(email.trim()) || email.length > 254 ||
      subject.trim().length === 0 || subject.length > 200 ||
      message.trim().length === 0 || message.length > 5000
    ) {
      return NextResponse.json(
        { error: 'Valid name, email, subject, and message are required' },
        { status: 400 }
      );
    }

    // Insert contact submission
    const { error: insertError } = await supabase
      .from('contact_submissions')
      .insert({
        name: name.trim().slice(0, 100),
        email: email.toLowerCase().trim(),
        subject: subject.trim().slice(0, 200),
        message: message.trim().slice(0, 5000),
        created_at: new Date().toISOString(),
        status: 'new',
      });

    if (insertError) {
      logDbError('contact', insertError);
      return NextResponse.json(
        { error: 'Failed to submit message. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logDbError('contact', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
