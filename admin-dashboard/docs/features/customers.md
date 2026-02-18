# Customers

## Goals
- View and manage customer profiles, tags, and marketing consent.

## Data Tables
- `customers`, `customer_addresses`, `customer_marketing_consent`, `orders`.

## Customer List
- Search by email, phone, name.
- Filters: tags, accepts_marketing, total_spent range.

## Customer Detail
- Profile data, tags, notes.
- Default address and address history.
- Order history with links to orders.

## Marketing Consent
- Update email/SMS consent based on `customer_marketing_consent`.

## Data Gap
- If customer PII is missing, display banner and link to remediation notes.
