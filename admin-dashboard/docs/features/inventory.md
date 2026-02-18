# Inventory and Locations

## Goals
- Track inventory at variant and location levels.
- Support manual adjustments and low-stock visibility.

## Data Tables
- `inventory_items`, `inventory_levels`, `locations`, `product_variants`.

## Location Management
- Create/edit locations (address, active, legacy).
- Default location for fulfillment.

## Inventory Views
- Per-product inventory summary.
- Per-location inventory with adjustments.

## Adjustments
- Manual adjust with reason codes (damage, return, restock).
- Optional audit log entry for each adjustment.

## Alerts
- Low stock thresholds per variant.
- Dashboard widgets for out-of-stock and low-stock items.
