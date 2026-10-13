import clsx from 'clsx';
import EmptyState from '@/components/ui/EmptyState';
import styles from './data.module.css';

/**
 * The one table every admin list renders.
 *
 * Wraps `<table className="table">` in `.table-wrap` (so wide tables scroll
 * instead of overflowing), gives the header a sticky row, and renders the empty
 * state when there are no rows. Previously 11 pages hand-rolled the markup and
 * only 2 used EmptyState.
 *
 * No `'use client'`: server pages pass `render` functions in `columns`, which a
 * client component cannot receive. Only the `selectable` checkboxes need a
 * client, and the one caller that uses them (products-client) is one.
 *
 * Density comes from globals.css (12px type, 34px rows). The two density
 * opt-ins the design system does not define — the comfortable row height and
 * the 34px row-lead cell — live in `data.module.css` beside this component.
 */
export interface DataTableColumn<T> {
  key: string;
  header: string;
  /**
   * Renders the cell. Returning null renders an em dash placeholder.
   *
   * The cell is a plain `<td>`, so a media cell composes its own markers:
   * `.cell-media` (flex row) with `.thumb` + `.cell-media-title` /
   * `.cell-media-sub`, and numbers get `.table-num` for tabular figures.
   */
  render: (row: T) => React.ReactNode;
  /** Hide this column below the `md` breakpoint. */
  hideOnMobile?: boolean;
  /** Hide this column below the `lg` breakpoint. */
  hideOnTablet?: boolean;
  align?: 'left' | 'right';
}

export interface BulkColumn<T> {
  /** Unique per row; becomes the checkbox `value`. */
  id: (row: T) => number | string;
  /** Accessible label for a row's checkbox. */
  label: (row: T) => string;
}

export default function DataTable<T>({
  columns,
  rows,
  rowKey,
  caption,
  selectable,
  selected,
  onSelectionChange,
  emptyTitle = 'Nothing here yet',
  emptyHint,
  emptyIcon,
  leading,
  dense = true,
  stickyHeader = false,
  rowClassName,
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string | number;
  /** Accessible table name. */
  caption: string;
  /** Enables the leading checkbox column; requires `selected` + `onSelectionChange`. */
  selectable?: BulkColumn<T>;
  selected?: Set<string>;
  onSelectionChange?: (next: Set<string>) => void;
  emptyTitle?: string;
  emptyHint?: string;
  emptyIcon?: React.ReactNode;
  /**
   * Leading cell rendered before the columns, in a 34px column. Pass a
   * thumbnail (`<Thumb size="sm" />`, 26px — a 34px `md` thumb grows the dense
   * row to 42px) or an avatar (`<Avatar size="sm" />`, 22px). This is the
   * non-interactive twin of the checkbox column, so a row can carry both.
   */
  leading?: (row: T, index: number) => React.ReactNode;
  /** Dense 34px rows unless `false`, which adds `table-comfortable`. */
  dense?: boolean;
  /** Adds `sticky` to `.table-wrap`: capped scroll area with a pinned header. */
  stickyHeader?: boolean;
  /** Extra classes for a row, e.g. a tone on a refunded order. */
  rowClassName?: (row: T) => string | undefined;
}) {
  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} hint={emptyHint} icon={emptyIcon} />;
  }

  const selectionValues = selectable ? rows.map(selectable.id).map(String) : [];
  const selectedSet = selected ?? new Set<string>();
  const allOnThisPage = selectionValues.length > 0 && selectionValues.every((v) => selectedSet.has(v));

  function toggleAll() {
    if (!selectable || !onSelectionChange) return;
    const next = new Set(selectedSet);
    // Derived from the rendered rows, not from a mirrored `allChecked` state.
    // A mirrored copy went stale as soon as the page changed underneath it:
    // after a bulk update or a filter, the table kept claiming "all selected"
    // while showing a different set of rows, and clicking once then cleared
    // every checkbox instead of selecting the page.
    const target = !allOnThisPage;
    for (const value of selectionValues) {
      if (target) next.add(value);
      else next.delete(value);
    }
    onSelectionChange(next);
  }

  function toggleOne(value: string) {
    if (!onSelectionChange) return;
    const next = new Set(selectedSet);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onSelectionChange(next);
  }

  return (
    <div className={clsx('table-wrap', stickyHeader && 'sticky')}>
      <table className={clsx('table', !dense && [styles.comfortable, 'table-comfortable'])}>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {selectable && (
              <th scope="col" className="table-select">
                <input
                  type="checkbox"
                  checked={allOnThisPage}
                  onChange={toggleAll}
                  aria-label={`Select all rows on this page`}
                />
              </th>
            )}
            {leading && <th scope="col" className={clsx('table-leading', styles.leading)} />}
            {columns.map((column) => {
              const classes = [
                column.hideOnMobile ? 'hide-mobile' : '',
                column.hideOnTablet ? 'hide-tablet' : '',
                column.align === 'right' ? 'align-right' : '',
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <th key={column.key} scope="col" className={classes || undefined}>
                  {column.header}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const key = rowKey(row, index);
            const extraRowClass = rowClassName?.(row);
            return (
              <tr key={key} className={extraRowClass || undefined}>
                {selectable && (
                  <td className="table-select">
                    <input
                      type="checkbox"
                      checked={selectedSet.has(String(selectable.id(row)))}
                      onChange={() => toggleOne(String(selectable.id(row)))}
                      aria-label={selectable.label(row)}
                    />
                  </td>
                )}
                {leading && (
                  <td className={clsx('table-leading', styles.leading)}>{leading(row, index)}</td>
                )}
                {columns.map((column) => {
                  const content = column.render(row);
                  const classes = [
                    column.hideOnMobile ? 'hide-mobile' : '',
                    column.hideOnTablet ? 'hide-tablet' : '',
                    column.align === 'right' ? 'align-right' : '',
                  ]
                    .filter(Boolean)
                    .join(' ');
                  return (
                    <td key={column.key} className={classes || undefined}>
                      {content ?? <span className="helper">—</span>}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
