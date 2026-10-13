import { SMART_RULE_COLUMNS, SMART_RULE_RELATIONS } from '@/lib/constants';
import type { SmartRuleColumn, SmartRuleRelation } from '@/lib/constants';

/**
 * Smart-collection rule compiler.
 *
 * The rules panel used to store `smart_collection_rules` rows that nothing ever
 * read: the storefront never evaluated them and no action materialised them,
 * so a "smart" collection behaved exactly like an empty custom one. This module
 * turns a rule row into the PostgREST filter the products query can run, which
 * is what makes "Preview matches" and "Apply now" possible.
 *
 * Two escaping contexts, deliberately kept apart — both were verified against a
 * live PostgREST (`/rest/v1/products`, production data) before being pinned in
 * tests:
 *
 *  - Chained filters (`.eq/.neq/.ilike`, the default AND mode): the value
 *    travels as a query parameter, so postgrest-js' URL encoding protects the
 *    filter grammar and only the LIKE wildcards need escaping. Verified: a title
 *    containing `,`, `"`, `.` or `()` matches its own row, and `\_` reaches SQL
 *    as a literal underscore while a bare `_` stays a wildcard.
 *  - `or=(...)` (the "match any rule" mode): PostgREST's reserved characters
 *    must be **double-quoted**, and quoting is the only form that works — the
 *    earlier backslash escaping produced `PGRST100 failed to parse logic tree`
 *    for a comma in the condition, and returned HTTP 200 with zero rows (a wrong
 *    answer, no error) for a closing parenthesis. Inside the quotes PostgREST
 *    consumes one level of backslash, so every backslash the SQL LIKE pattern
 *    needs is doubled here (`\\_` → `\_`); verified: the undoubled form matched
 *    rows it should not have.
 *
 * Rules the compiler cannot evaluate are reported, never silently dropped: the
 * table is plain varchar and the Shopify migration copied `rules[].column`
 * verbatim, so it can hold columns this builder does not offer (`tag`, `type`,
 * `variant_price`, …) or relations outside `equals`/`contains`/`not_equals`.
 *
 * Pure and dependency-free on purpose: the semantics are unit-tested without a
 * database.
 */

export interface RuleInput {
  column_name: string;
  relation: string;
  condition: string;
}

export interface CompiledFilter {
  column: SmartRuleColumn;
  /** PostgREST operator. */
  op: 'eq' | 'neq' | 'ilike';
  /** The raw condition, unescaped and without wildcards. */
  value: string;
}

/** Filter-syntax characters: `,` separates or() terms, `()` group them, `"` quotes. */
const FILTER_GRAMMAR = /[\\(),"]/g;
/** LIKE wildcards — only meaningful inside a `like`/`ilike` pattern. */
const LIKE_WILDCARDS = /[%_*]/g;
/** Characters PostgREST's quoted-value parser treats as escapes. */
const QUOTE_ESCAPES = /[\\"]/g;

/** Escape the characters that change the shape of an unquoted filter value. */
export function escapeFilterGrammar(value: string): string {
  return value.replace(FILTER_GRAMMAR, (match) => `\\${match}`);
}

/**
 * Escape both the filter grammar and the LIKE wildcards, for a value used in an
 * unquoted context (the chained `.eq/.neq/.ilike` path).
 */
export function escapeLikeValue(value: string): string {
  return escapeFilterGrammar(value).replace(LIKE_WILDCARDS, (match) => `\\${match}`);
}

/** The SQL LIKE pattern for a `contains` condition, wildcards escaped. */
export function likePattern(value: string): string {
  return `%${value.replace(LIKE_WILDCARDS, (match) => `\\${match}`)}%`;
}

/**
 * Quote a value for a PostgREST filter-tree value (`or=(column.op."value")`).
 *
 * Reserved characters (`,`, `.`, `:`, `()`, `"`) are only literal inside the
 * quotes. PostgREST then consumes one backslash of every escape pair, so a
 * backslash the SQL pattern needs (our LIKE escapes) has to be doubled here.
 */
export function quoteFilterValue(value: string): string {
  return `"${value.replace(QUOTE_ESCAPES, (match) => `\\${match}`)}"`;
}

/** Is this column one the builder offers (and the products query can run)? */
export function isSupportedColumn(column: string): column is SmartRuleColumn {
  return (SMART_RULE_COLUMNS as readonly string[]).includes(column);
}

/** Is this relation one the builder offers? */
export function isSupportedRelation(relation: string): relation is SmartRuleRelation {
  return (SMART_RULE_RELATIONS as readonly string[]).includes(relation);
}

export interface UnsupportedRule {
  /** Why the rule was skipped. */
  reason: 'column' | 'relation';
  column_name: string;
  relation: string;
  condition: string;
}

/**
 * Split stored rules into the ones this compiler can run and the ones it cannot.
 *
 * `rules` is generic so a caller keeps the full row (id, collection_id) on both
 * sides of the split.
 */
export function partitionRules<T extends RuleInput>(
  rules: T[],
): { compilable: T[]; unsupported: (UnsupportedRule & { rule: T })[] } {
  const compilable: T[] = [];
  const unsupported: (UnsupportedRule & { rule: T })[] = [];
  for (const rule of rules) {
    if (!isSupportedColumn(rule.column_name)) {
      unsupported.push({ reason: 'column', ...pick(rule), rule });
      continue;
    }
    if (!isSupportedRelation(rule.relation)) {
      unsupported.push({ reason: 'relation', ...pick(rule), rule });
      continue;
    }
    compilable.push(rule);
  }
  return { compilable, unsupported };
}

function pick(rule: RuleInput): Omit<UnsupportedRule, 'reason'> {
  return {
    column_name: rule.column_name,
    relation: rule.relation,
    condition: rule.condition,
  };
}

/**
 * Compile one rule. `contains` is a case-insensitive substring match.
 *
 * The `%` wildcards are added where the filter is applied (`toOrFilter` for OR,
 * `ilike` for AND), not here — wrapping them in the compiled value made the
 * escaping double up on its own wildcards.
 */
export function compileRule(rule: RuleInput): CompiledFilter {
  const column = rule.column_name as SmartRuleColumn;
  const condition = rule.condition.trim();
  switch (rule.relation as SmartRuleRelation) {
    case 'not_equals':
      return { column, op: 'neq', value: condition };
    case 'contains':
      return { column, op: 'ilike', value: condition };
    case 'equals':
    default:
      return { column, op: 'eq', value: condition };
  }
}

/**
 * Compile the rules the query can run, dropping blank conditions and any rule
 * whose column or relation this builder does not implement.
 *
 * Dropping is paired with `partitionRules` at the call site, which reports the
 * skipped rows: a rule that has no effect must be visible, not silent.
 */
export function compileRules(rules: RuleInput[]): CompiledFilter[] {
  return partitionRules(rules)
    .compilable.filter((rule) => rule.condition.trim().length > 0)
    .map(compileRule);
}

/**
 * Render compiled filters as a PostgREST `or()` string, used when the
 * collection is `disjunctive` ("match any rule"). Without it the caller chains
 * `.eq()`/`.ilike()`/`.neq()` calls, which PostgREST ANDs together.
 *
 * Every value is quoted (see `quoteFilterValue`): an unquoted reserved
 * character inside `or()` either fails the whole request or, worse, silently
 * matches nothing.
 */
export function toOrFilter(filters: CompiledFilter[]): string {
  return filters
    .map(({ column, op, value }) => {
      const pattern = op === 'ilike' ? likePattern(value) : value;
      return `${column}.${op}.${quoteFilterValue(pattern)}`;
    })
    .join(',');
}
