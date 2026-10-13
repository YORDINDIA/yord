import { describe, expect, it } from 'vitest';
import {
  compileRule,
  compileRules,
  escapeFilterGrammar,
  escapeLikeValue,
  isSupportedColumn,
  isSupportedRelation,
  likePattern,
  partitionRules,
  quoteFilterValue,
  toOrFilter,
  type RuleInput,
} from '@/lib/collection-rules';

/**
 * The smart-collection rule compiler.
 *
 * The rules table was write-only: nothing evaluated it, so "smart" collections
 * were permanently empty. These pin the translation from a stored rule row to
 * the PostgREST filter that "Preview matches" / "Apply now" run.
 */
describe('compileRule', () => {
  it('maps equals to eq', () => {
    expect(compileRule({ column_name: 'vendor', relation: 'equals', condition: 'YORD' })).toEqual({
      column: 'vendor',
      op: 'eq',
      value: 'YORD',
    });
  });

  it('maps contains to a case-insensitive ilike with no wildcards of its own', () => {
    // The `%` wrappers belong to the query builder: compiling them here made
    // escapeFilterValue escape its own wildcards and match nothing.
    expect(
      compileRule({ column_name: 'title', relation: 'contains', condition: 'coldplay' }),
    ).toEqual({ column: 'title', op: 'ilike', value: 'coldplay' });
  });

  it('maps not_equals to neq', () => {
    expect(
      compileRule({ column_name: 'status', relation: 'not_equals', condition: 'archived' }),
    ).toEqual({ column: 'status', op: 'neq', value: 'archived' });
  });

  it('trims the condition so a trailing space cannot produce a no-match rule', () => {
    expect(compileRule({ column_name: 'tags', relation: 'equals', condition: '  glow  ' }).value).toBe(
      'glow',
    );
  });

  it('defaults an unknown relation to equals', () => {
    // The DB column is a plain varchar; a hand-edited or imported row must not
    // silently become a wildcard match.
    expect(compileRule({ column_name: 'title', relation: 'what', condition: 'x' }).op).toBe('eq');
  });
});

describe('compileRules', () => {
  it('drops blank conditions instead of matching everything', () => {
    expect(
      compileRules([
        { column_name: 'title', relation: 'contains', condition: 'coldplay' },
        { column_name: 'tags', relation: 'contains', condition: '   ' },
      ]),
    ).toHaveLength(1);
  });

  it('returns nothing when every rule is blank', () => {
    expect(compileRules([{ column_name: 'title', relation: 'contains', condition: '' }])).toEqual([]);
  });
});

describe('escapeLikeValue', () => {
  it('escapes both the filter grammar and the LIKE wildcards', () => {
    // Used for `ilike` values: `,` separates filters in or(), () group them,
    // and * / % / _ are wildcards inside a LIKE pattern.
    expect(escapeLikeValue('a,b(c)d*e%f_g"h')).toBe('a\\,b\\(c\\)d\\*e\\%f\\_g\\"h');
  });
});

describe('escaping contexts', () => {
  it('escapes filter grammar for equality and LIKE wildcards only for LIKE', () => {
    // The unquoted (chained-filter) context: `%` and `_` are LIKE wildcards, not
    // filter syntax, and escaping them for `eq` compared the backslash text
    // itself (`50\%\_off` never equals `50%_off`).
    expect(escapeFilterGrammar('50% off')).toBe('50% off');
    expect(escapeLikeValue('50% off')).toBe('50\\% off');
    expect(escapeFilterGrammar('a,b')).toBe('a\\,b');
    expect(escapeLikeValue('a,b')).toBe('a\\,b');
    expect(escapeLikeValue('a_b')).toBe('a\\_b');
    // `*` is a LIKE wildcard too, so the grammar helper leaves it alone.
    expect(escapeFilterGrammar('50"~*()')).toBe('50\\"~*\\(\\)');
    expect(escapeLikeValue('50"~*()')).toBe('50\\"~\\*\\(\\)');
    expect(escapeFilterGrammar('back\\slash')).toBe('back\\\\slash');
  });

  it('keeps the LIKE helper a strict superset of the grammar one', () => {
    const escapes = (value: string) => (value.match(/\\/g) ?? []).length;
    for (const value of ['a_b%c,d', '50% off', 'Muse, Live', 'x(y)"z', '']) {
      expect(escapes(escapeLikeValue(value))).toBeGreaterThanOrEqual(
        escapes(escapeFilterGrammar(value)),
      );
    }
    // …and actually escapes something extra on a wildcard-bearing value.
    expect(escapes(escapeLikeValue('50%_off'))).toBeGreaterThan(
      escapes(escapeFilterGrammar('50%_off')),
    );
  });

  it('builds a wildcard pattern and a quoted value the two ways the query needs', () => {
    expect(likePattern('coldplay')).toBe('%coldplay%');
    expect(likePattern('50%')).toBe('%50\\%%');
    expect(quoteFilterValue('Coldplay, Live')).toBe('"Coldplay, Live"');
    expect(quoteFilterValue('t_shirt')).toBe('"t_shirt"');
    // The quoted form needs the wildcard escape doubled for PostgREST to pass
    // one backslash on to SQL.
    expect(quoteFilterValue(likePattern('t_shirt'))).toBe('"%t\\\\_shirt%"');
  });
});

describe('operator coverage in escaped output', () => {
  it('quotes an equality value without escaping its LIKE-significant characters', () => {
    // `%` is not special to `eq`, and inside the quotes it is literal.
    const filters = compileRules([
      { column_name: 'title', relation: 'equals', condition: '50% off' },
    ]);
    expect(toOrFilter(filters)).toBe('title.eq."50% off"');
  });
});

describe('rule support', () => {
  it('knows which columns and relations the products query can run', () => {
    expect(isSupportedColumn('tags')).toBe(true);
    expect(isSupportedColumn('product_type')).toBe(true);
    // Shopify's own vocabulary: the migration copied `rules[].column` verbatim,
    // so these rows exist in the table and compile to a missing-column error.
    expect(isSupportedColumn('tag')).toBe(false);
    expect(isSupportedColumn('type')).toBe(false);
    expect(isSupportedColumn('variant_price')).toBe(false);
    expect(isSupportedRelation('contains')).toBe(true);
    expect(isSupportedRelation('starts_with')).toBe(false);
    expect(isSupportedRelation('greater_than')).toBe(false);
  });

  it('splits stored rules instead of silently compiling unsupported ones', () => {
    // Shaped like the rows the table actually holds: plain varchar columns,
    // populated by the Shopify migration as well as by the rule builder.
    const rules: (RuleInput & { id: number })[] = [
      { id: 1, column_name: 'title', relation: 'contains', condition: 'coldplay' },
      { id: 2, column_name: 'tag', relation: 'equals', condition: 'coldplay' },
      { id: 3, column_name: 'vendor', relation: 'starts_with', condition: 'YOR' },
    ];
    const { compilable, unsupported } = partitionRules(rules);

    expect(compilable.map((r) => r.id)).toEqual([1]);
    expect(unsupported.map((u) => [u.rule.id, u.reason])).toEqual([
      [2, 'column'],
      [3, 'relation'],
    ]);
    // The compiler never runs the unsupported rows, so no filter targets a
    // column that does not exist and no operator quietly becomes `eq`.
    expect(compileRules(rules)).toHaveLength(1);
  });
});

describe('toOrFilter', () => {
  it('joins compiled rules with commas, quoting each value', () => {
    // Values are double-quoted: inside `or=()` PostgREST only treats reserved
    // characters as literal within quotes. Verified against a live PostgREST —
    // the unquoted, backslash-escaped form of a comma value is rejected with
    // PGRST100 and the paren form silently returns zero rows.
    const filters = compileRules([
      { column_name: 'title', relation: 'contains', condition: 'coldplay' },
      { column_name: 'tags', relation: 'contains', condition: 'glow' },
    ]);
    expect(toOrFilter(filters)).toBe('title.ilike."%coldplay%",tags.ilike."%glow%"');
  });

  it('quotes a comma-bearing condition so one rule stays one filter', () => {
    const filters = compileRules([
      { column_name: 'title', relation: 'equals', condition: 'Muse, Live' },
    ]);
    expect(toOrFilter(filters)).toBe('title.eq."Muse, Live"');
  });

  it('quotes parentheses instead of escaping them', () => {
    const filters = compileRules([
      { column_name: 'title', relation: 'equals', condition: 'Wristband (Pack of 2)' },
    ]);
    expect(toOrFilter(filters)).toBe('title.eq."Wristband (Pack of 2)"');
  });

  it('escapes an embedded double quote and backslash inside the quotes', () => {
    const filters = compileRules([
      { column_name: 'title', relation: 'equals', condition: 'the "Live" set C:\\songs' },
    ]);
    expect(toOrFilter(filters)).toBe('title.eq."the \\"Live\\" set C:\\\\songs"');
  });

  it('doubles the LIKE escape so the wildcard stays literal after PostgREST decodes it', () => {
    // PostgREST consumes one backslash inside a quoted value, so the SQL LIKE
    // pattern needs `\\%` here to receive `\%`: verified live — the single
    // backslash form matched rows it should not have.
    const filters = compileRules([
      { column_name: 'title', relation: 'contains', condition: '50% off' },
    ]);
    expect(toOrFilter(filters)).toBe('title.ilike."%50\\\\% off%"');
  });

  it('keeps a literal underscore literal', () => {
    const filters = compileRules([
      { column_name: 'product_type', relation: 'contains', condition: 't_shirt' },
    ]);
    expect(toOrFilter(filters)).toBe('product_type.ilike."%t\\\\_shirt%"');
  });

  it('quotes the value for every operator, including not_equals', () => {
    const filters = compileRules([
      { column_name: 'vendor', relation: 'not_equals', condition: 'A,B' },
    ]);
    expect(toOrFilter(filters)).toBe('vendor.neq."A,B"');
  });
});
