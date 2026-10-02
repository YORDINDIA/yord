import clsx from 'clsx';
import DataTable, { type DataTableColumn } from '@/components/data/DataTable';
import styles from './settings.module.css';

/**
 * Before/after rendering for one audit entry.
 *
 * Two views of the same two payloads, because they answer different questions:
 *
 *  - the key/value table answers "what changed?" — one row per top-level key,
 *    the changed ones marked and both values in the same row;
 *  - the raw panels answer "what exactly was written?" — pretty-printed,
 *    monospaced, independently scrollable, nothing truncated.
 *
 * Pure and directive-free: the client modal renders it, and a test or a server
 * surface can render it without a browser.
 *
 * Nested values beyond the first level are shown as compact JSON in the table
 * (`{"is_active":true}`) rather than exploded into dotted paths — an audit row
 * written by these actions is a handful of scalars, and a flat table stays
 * scannable where a recursive tree does not. The raw panels keep the structure.
 */
export default function AuditDiff({ before, after }: { before: unknown; after: unknown }) {
  const beforeRecorded = before !== null && before !== undefined;
  const afterRecorded = after !== null && after !== undefined;

  if (!beforeRecorded && !afterRecorded) {
    return (
      <p className="helper">
        This action recorded no before/after payload, so there is nothing to diff. The action,
        entity, and actor above are the whole record.
      </p>
    );
  }

  const beforeRecord = beforeRecorded ? asRecord(before) : null;
  const afterRecord = afterRecorded ? asRecord(after) : null;
  // A payload that is not a plain object (an array, a string, a bare number) has
  // no keys to line up, so it gets the raw view only.
  const comparable = (!beforeRecorded || beforeRecord !== null) && (!afterRecorded || afterRecord !== null);
  const cells = comparable ? diffCells(beforeRecord, afterRecord) : [];

  return (
    <div className={styles.diff}>
      {cells.length > 0 ? (
        <>
          <div className={styles.diffScroll}>
            <DataTable
              caption="Before and after values"
              columns={COLUMNS}
              rows={cells}
              rowKey={(cell) => cell.key}
              rowClassName={(cell) => (cell.changed ? styles.diffRowChanged : undefined)}
            />
          </div>
          <details className={styles.rawDetails}>
            <summary>Raw JSON</summary>
            {rawPanels(before, after, beforeRecorded, afterRecorded)}
          </details>
        </>
      ) : (
        rawPanels(before, after, beforeRecorded, afterRecorded)
      )}
    </div>
  );
}

interface DiffCell {
  key: string;
  before: string;
  after: string;
  changed: boolean;
}

const COLUMNS: DataTableColumn<DiffCell>[] = [
  {
    key: 'key',
    header: 'Key',
    render: (cell) => <span className={clsx('mono', styles.diffKey)}>{cell.key}</span>,
  },
  {
    key: 'before',
    header: 'Before',
    render: (cell) => (
      <span className={styles.diffValue} title={cell.before}>
        {cell.before}
      </span>
    ),
  },
  {
    key: 'after',
    header: 'After',
    render: (cell) => (
      <span className={styles.diffValue} title={cell.after}>
        {cell.after}
      </span>
    ),
  },
];

/** `{}` is not a record for our purposes: it has no keys to compare. */
function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/** One-line rendering of any JSON value, for a table cell. */
function display(value: unknown): string {
  if (value === undefined) return '—';
  if (value === null) return 'null';
  if (typeof value === 'string') return value === '' ? '""' : value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

/** Pretty-printed rendering, for the scrollable panels. */
function pretty(value: unknown): string {
  if (value === undefined) return 'undefined';
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
}

function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

/** Union of both sides' keys, in a stable order: before-first, then new keys. */
function diffCells(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): DiffCell[] {
  const keys = new Set<string>();
  for (const key of Object.keys(before ?? {})) keys.add(key);
  for (const key of Object.keys(after ?? {})) keys.add(key);

  return [...keys].map((key) => {
    const from = before ? before[key] : undefined;
    const to = after ? after[key] : undefined;
    return {
      key,
      before: display(from),
      after: display(to),
      changed: !sameValue(from, to),
    };
  });
}

function rawPanels(
  before: unknown,
  after: unknown,
  beforeRecorded: boolean,
  afterRecorded: boolean,
) {
  return (
    <div className={styles.rawGrid}>
      <div>
        <span className={styles.rawLabel}>
          Before{beforeRecorded ? '' : ' · not recorded'}
        </span>
        <pre className={styles.rawPre}>{beforeRecorded ? pretty(before) : '—'}</pre>
      </div>
      <div>
        <span className={styles.rawLabel}>After{afterRecorded ? '' : ' · not recorded'}</span>
        <pre className={styles.rawPre}>{afterRecorded ? pretty(after) : '—'}</pre>
      </div>
    </div>
  );
}
