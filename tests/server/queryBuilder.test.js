import { describe, it, expect } from 'vitest';
import {
  sanitizeOperator,
  formatSqlValue,
  buildFilterCondition,
  buildQueryDirect,
  DEFAULT_QUERY_LIMIT,
} from '../../server/src/utils/queryBuilder.js';

describe('sanitizeOperator', () => {
  it('returns the operator uppercased when valid', () => {
    expect(sanitizeOperator('in')).toBe('IN');
    expect(sanitizeOperator('between')).toBe('BETWEEN');
    expect(sanitizeOperator('LIKE')).toBe('LIKE');
    expect(sanitizeOperator('=')).toBe('=');
  });

  it('defaults to = for invalid or missing operator', () => {
    expect(sanitizeOperator('DROP TABLE')).toBe('=');
    expect(sanitizeOperator(null)).toBe('=');
    expect(sanitizeOperator(undefined)).toBe('=');
  });
});

describe('formatSqlValue', () => {
  it('formats strings with single-quote escaping', () => {
    expect(formatSqlValue('hello')).toBe("'hello'");
    expect(formatSqlValue("it's")).toBe("'it''s'");
  });

  it('returns numbers as-is', () => {
    expect(formatSqlValue(42)).toBe(42);
    expect(formatSqlValue(3.14)).toBe(3.14);
  });

  it('formats booleans', () => {
    expect(formatSqlValue(true)).toBe('TRUE');
    expect(formatSqlValue(false)).toBe('FALSE');
  });

  it('returns NULL for null/undefined', () => {
    expect(formatSqlValue(null)).toBe('NULL');
    expect(formatSqlValue(undefined)).toBe('NULL');
  });
});

describe('buildFilterCondition', () => {
  it('builds an IN condition from values array', () => {
    const result = buildFilterCondition(
      { operator: 'in', values: ['US', 'EU'] },
      'REGION'
    );
    expect(result).toBe(`"REGION" IN ('US', 'EU')`);
  });

  it('builds a BETWEEN condition from value/value2', () => {
    const result = buildFilterCondition(
      { operator: 'between', value: 10, value2: 100 },
      'AMOUNT'
    );
    expect(result).toBe('"AMOUNT" BETWEEN 10 AND 100');
  });

  it('builds a BETWEEN condition from values array fallback', () => {
    const result = buildFilterCondition(
      { operator: 'between', values: [10, 100] },
      'AMOUNT'
    );
    expect(result).toBe('"AMOUNT" BETWEEN 10 AND 100');
  });

  it('builds a LIKE (ILIKE) condition', () => {
    const result = buildFilterCondition(
      { operator: 'like', value: 'test' },
      'NAME'
    );
    expect(result).toBe(`"NAME" ILIKE '%test%'`);
  });

  it('builds an equality condition', () => {
    const result = buildFilterCondition(
      { operator: '=', value: 'active' },
      'STATUS'
    );
    expect(result).toBe(`"STATUS" = 'active'`);
  });

  it('builds IS NULL condition', () => {
    const result = buildFilterCondition(
      { operator: 'is null' },
      'FIELD'
    );
    expect(result).toBe('"FIELD" IS NULL');
  });

  it('returns null when no usable value is provided for = operator', () => {
    const result = buildFilterCondition({ operator: '>' }, 'X');
    expect(result).toBeNull();
  });

  it('handles custom expression', () => {
    const result = buildFilterCondition(
      { operator: 'CUSTOM', customExpression: '[[AMOUNT]] > 100' },
      'AMOUNT'
    );
    expect(result).toBe('"AMOUNT" > 100');
  });
});

describe('buildQueryDirect', () => {
  const baseArgs = {
    semanticViewFQN: 'DB.SCHEMA.MY_VIEW',
    dimensions: ['REGION'],
    measures: [{ name: 'REVENUE', aggregation: 'SUM' }],
  };

  it('returns a placeholder when no semanticViewFQN is provided', () => {
    const sql = buildQueryDirect({ semanticViewFQN: '' });
    expect(sql).toContain('--');
  });

  it('generates a SELECT statement with FROM clause', () => {
    const sql = buildQueryDirect(baseArgs);
    expect(sql).toContain('SELECT');
    expect(sql).toContain('DB.SCHEMA.MY_VIEW');
    expect(sql).toContain('"REGION"');
    expect(sql).toContain('SUM("REVENUE")');
  });

  it('applies filters as WHERE conditions', () => {
    const sql = buildQueryDirect({
      ...baseArgs,
      filters: [{ field: 'REGION', operator: 'IN', values: ['US', 'EU'] }],
    });
    expect(sql).toContain('WHERE');
    expect(sql).toContain("'US'");
    expect(sql).toContain("'EU'");
  });

  it('adds GROUP BY when dimensions are present', () => {
    const sql = buildQueryDirect(baseArgs);
    expect(sql).toContain('GROUP BY');
  });

  it('adds ORDER BY when orderBy is specified', () => {
    const sql = buildQueryDirect({
      ...baseArgs,
      orderBy: [{ field: 'REVENUE', direction: 'DESC' }],
    });
    expect(sql).toContain('ORDER BY');
    expect(sql).toContain('DESC');
  });

  it('defaults limit to DEFAULT_QUERY_LIMIT', () => {
    const sql = buildQueryDirect(baseArgs);
    expect(sql).toContain(`LIMIT ${DEFAULT_QUERY_LIMIT}`);
  });

  it('accepts a custom limit', () => {
    const sql = buildQueryDirect({ ...baseArgs, limit: 50 });
    expect(sql).toContain('LIMIT 50');
  });
});
