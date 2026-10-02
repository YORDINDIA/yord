import EmptyState from '@/components/ui/EmptyState';

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
 */
export interface DataTableColumn<T> {
  key: string;
  header: string;
  /** Renders the cell. Returning null renders an em dash placeholder. */
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
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string | number;
  /** Accessible table name. Also used as the empty-state heading prefix. */
  caption: string;
  /** Enables the leading checkbox column; requires `selected` + `onSelectionChange`. */
  selectable?: BulkColumn<T>;
  selected?: Set<string>;
  onSelectionChange?: (next: Set<string>) => void;
  emptyTitle?: string;
  emptyHint?: string;
  emptyIcon?: React.ReactNode;
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
    <div className="table-wrap">
      <table className="table">
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
            return (
              <tr key={key}>
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
