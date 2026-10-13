import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowLeft, TicketPlus } from 'lucide-react';
import NewDiscountForm from '@/components/discounts/NewDiscountForm';
import PageHeader from '@/components/ui/PageHeader';

export const metadata: Metadata = { title: 'New Discount · YORD Admin' };

/**
 * New-discount route. Thin by design: the header is chrome, every field and every
 * write lives in `NewDiscountForm` → `createDiscountAction`.
 */
export default function NewDiscountPage() {
  return (
    <>
      <PageHeader
        icon={TicketPlus}
        title="New discount"
        description="A price rule plus the coupon code shoppers type at checkout."
        actions={
          <Link className="button" href="/discounts">
            <ArrowLeft size={13} aria-hidden />
            Back to discounts
          </Link>
        }
      />
      <NewDiscountForm />
    </>
  );
}
