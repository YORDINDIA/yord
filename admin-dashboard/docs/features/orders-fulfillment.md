# Orders and Fulfillment

## Goals
- View, manage, and update order status.
- Support fulfillment and refunds within Supabase schema.

## Data Tables
- `orders`, `line_items`, `shipping_lines`, `transactions`, `fulfillments`, `refunds`, and related tables.

## Order List
- Filters: date range, financial_status, fulfillment_status, total, customer.
- Search by order name, email, phone.

## Order Detail
- Customer summary, line items, pricing breakdown.
- Status controls: financial and fulfillment status.
- Timeline of events (created, paid, fulfilled, refunded).

## Fulfillment
- Create fulfillment: tracking company/number, status.
- Map line items to fulfillment_line_items.

## Refunds
- Select items, quantities, and restock flag.
- Create refund record + link to transaction.
- Trigger payment gateway refund (Razorpay) via server-side function.
- Use `transactions.gateway` + `transactions.payment_id` to map the refund call.

## Notes
- Manual operations only (no automatic carrier integrations in initial scope).
