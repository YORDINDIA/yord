# UX and Navigation

## Global Navigation
The sidebar groups sections by the way the work flows; `src/lib/sections.ts` is the
single source for labels, icons, descriptions and the per-section accent hue.

| Group | Sections |
| --- | --- |
| Sell | Dashboard, Orders, Customers, Discounts |
| Catalog | Catalog (products), Collections, Inventory, Media |
| Create | Content (blogs + articles), AI Studio |
| System | Analytics, Settings |

- The sidebar collapses to icons and remembers the choice (`yord-admin-sidebar`); below 1024px it becomes an overlay drawer.
- `Cmd`/`Ctrl` + `K` opens the command palette: pages plus live products, orders, customers and collections (`/api/search`).
- The topbar carries breadcrumbs, the palette trigger, and the theme toggle.
- Density, palette, component vocabulary and the QA harness are specified in `06-ui-system.md`.

## Global UX Patterns
- Powerful search + filters on every list view.
- Bulk actions with explicit confirmations.
- Draft and publish controls with clear status chips.
- Change preview before saving (diff view for text and tags).
- Contextual side panel for quick edits.

## Core User Flows
- Create product -> add variants -> upload images -> publish.
- Edit product -> review diff -> save -> audit log.
- Build collection -> add rules or manual products -> publish.
- Fulfill order -> add tracking -> update status.
- Refund order -> select items -> confirm -> audit log.
- Create blog post -> add media -> preview -> publish/schedule.
- Run AI improvement -> preview -> approve -> apply.
