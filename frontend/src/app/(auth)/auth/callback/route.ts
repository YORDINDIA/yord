import { createServerClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const redirect = searchParams.get('redirect') || '/account';

  if (code) {
    const supabase = await createServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Redirect to the original destination or account page
      return NextResponse.redirect(new URL(redirect, origin));
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(new URL('/auth/login?error=auth_failed', origin));
}
