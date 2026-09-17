import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';
import { getNextId } from '@/lib/utils/ids';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

async function createDiscount(formData: FormData) {
  'use server';
  const supabase = await createServerClient();
  const title = String(formData.get('title') || '').trim();
  const code = String(formData.get('code') || '').trim();
  if (!title || !code) return;
  const value = Number(formData.get('value') || 0);
  const valueType = String(formData.get('value_type') || 'percentage');
  const startsAtRaw = String(formData.get('starts_at') || '').trim();
  const endsAtRaw = String(formData.get('ends_at') || '').trim();
  const startsAt = startsAtRaw ? new Date(startsAtRaw).toISOString() : new Date().toISOString();
  const endsAt = endsAtRaw ? new Date(endsAtRaw).toISOString() : '';

  const priceRuleId = await getNextId('price_rules');
  const codeId = await getNextId('discount_codes');
  const now = new Date().toISOString();

  const { error: ruleError } = await supabase.from('price_rules').insert({
    id: priceRuleId,
    title,
    value,
    value_type: valueType,
    customer_selection: 'all',
    target_type: 'line_item',
    target_selection: 'all',
    allocation_method: 'across',
    once_per_customer: false,
    starts_at: startsAt,
    ends_at: endsAt || null,
    created_at: now,
    updated_at: now,
  });
  if (ruleError) throw new Error(ruleError.message);

  const { error: codeError } = await supabase.from('discount_codes').insert({
    id: codeId,
    price_rule_id: priceRuleId,
    code,
    created_at: now,
    updated_at: now,
  });
  if (codeError) throw new Error(codeError.message);
  revalidatePath('/discounts');
  redirect('/discounts');
}

export default function NewDiscountPage() {
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="section-title">New Discount</div>
          <div className="helper">Create a price rule and code.</div>
        </div>
        <Link className="button" href="/discounts">Back</Link>
      </div>
      <form action={createDiscount} className="form-grid">
        <div>
          <label className="helper">Title</label>
          <input className="input" name="title" required />
        </div>
        <div>
          <label className="helper">Code</label>
          <input className="input" name="code" required />
        </div>
        <div>
          <label className="helper">Value</label>
          <input className="input" name="value" type="number" step="0.01" required />
        </div>
        <div>
          <label className="helper">Value Type</label>
          <select className="select" name="value_type" defaultValue="percentage">
            <option value="percentage">Percentage</option>
            <option value="fixed_amount">Fixed Amount</option>
          </select>
        </div>
        <div>
          <label className="helper">Starts At</label>
          <input className="input" name="starts_at" type="datetime-local" />
        </div>
        <div>
          <label className="helper">Ends At</label>
          <input className="input" name="ends_at" type="datetime-local" />
        </div>
        <button className="button primary" type="submit">Create Discount</button>
      </form>
    </div>
  );
}
