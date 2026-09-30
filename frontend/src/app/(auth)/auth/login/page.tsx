'use client';

import { Suspense } from 'react';
import { LoginForm, LoginFallback } from '@/features/auth/LoginForm';

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  );
}
