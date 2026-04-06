import { describe, it, expect, beforeEach } from 'vitest';
import {
  getCacheKey,
  getCachedResult,
  setCachedResult,
  clearWidgetCache,
  invalidateCacheForView,
} from '../../client/src/utils/widgetCache';

describe('widgetCache', () => {
  beforeEach(() => {
    clearWidgetCache();
  });

  describe('getCacheKey', () => {
    it('returns a deterministic JSON string', () => {
      const key = getCacheKey('db.schema.view', ['dim1'], ['measure1']);
      expect(typeof key).toBe('string');
      expect(JSON.parse(key)).toEqual({
        semanticView: 'db.schema.view',
        dimensions: ['dim1'],
        measures: ['measure1'],
        filters: [],
        sorts: [],
        customColumns: [],
        aggregatedFields: [],
      });
    });

    it('sorts dimensions and measures for consistency', () => {
      const a = getCacheKey('v', ['b', 'a'], ['y', 'x']);
      const b = getCacheKey('v', ['a', 'b'], ['x', 'y']);
      expect(a).toBe(b);
    });

    it('normalises filter values by sorting them', () => {
      const a = getCacheKey('v', [], [], [{ field: 'f', values: ['b', 'a'] }]);
      const b = getCacheKey('v', [], [], [{ field: 'f', values: ['a', 'b'] }]);
      expect(a).toBe(b);
    });

    it('includes sorts in the key', () => {
      const noSort = getCacheKey('v', [], []);
      const withSort = getCacheKey('v', [], [], [], [{ field: 'f', direction: 'ASC' }]);
      expect(noSort).not.toBe(withSort);
    });

    it('includes customColumns in the key', () => {
      const plain = getCacheKey('v', [], []);
      const withCalc = getCacheKey('v', [], [], [], [], [{ name: 'calc', expression: '1+1' }]);
      expect(plain).not.toBe(withCalc);
    });
  });

  describe('setCachedResult / getCachedResult', () => {
    it('stores and retrieves data', () => {
      const key = 'test-key';
      const data = { rows: [1, 2, 3] };
      setCachedResult(key, data);
      expect(getCachedResult(key)).toEqual(data);
    });

    it('returns null for a missing key', () => {
      expect(getCachedResult('nonexistent')).toBeNull();
    });

    it('returns null for expired entries', () => {
      const key = 'old-key';
      setCachedResult(key, { rows: [] });

      const cache = getCachedResult(key);
      expect(cache).not.toBeNull();
    });
  });

  describe('clearWidgetCache', () => {
    it('removes all entries', () => {
      setCachedResult('a', 1);
      setCachedResult('b', 2);
      clearWidgetCache();
      expect(getCachedResult('a')).toBeNull();
      expect(getCachedResult('b')).toBeNull();
    });
  });

  describe('invalidateCacheForView', () => {
    it('removes only entries whose key contains the view FQN', () => {
      const keyA = getCacheKey('db.schema.viewA', ['d'], ['m']);
      const keyB = getCacheKey('db.schema.viewB', ['d'], ['m']);
      setCachedResult(keyA, 'dataA');
      setCachedResult(keyB, 'dataB');

      invalidateCacheForView('db.schema.viewA');

      expect(getCachedResult(keyA)).toBeNull();
      expect(getCachedResult(keyB)).toBe('dataB');
    });
  });
});
