'use client';

import { Suspense } from 'react';
import { RegisterForm, RegisterFallback } from '@/features/auth/RegisterForm';

export default function RegisterPage() {
  return (
    <Suspense fallback={<RegisterFallback />}>
      <RegisterForm />
    </Suspense>
  );
}
