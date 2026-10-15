import { describe, it, expect } from 'vitest';
import { filterProducts, countBySegment, buildSearchText, parseQuery, serializeQuery, type CatalogItem } from '../src/lib/catalog';

const items: CatalogItem[] = [
  { id: 'a', category: 'special', segments: ['resin'], makerId: 'kuraray', search: 'genestar pa9t kuraray 내열 resin' },
  { id: 'b', category: 'special', segments: ['film', 'thermal'], makerId: 'denka', search: 'denka film thermal 방열' },
  { id: 'c', category: 'medical', segments: ['syringe'], makerId: 'maeda', search: 'maeda dual chamber syringe 실린지' },
];

describe('filterProducts', () => {
  it('returns all when no filter', () => expect(filterProducts(items, {}).map((i) => i.id)).toEqual(['a', 'b', 'c']));
  it('filters by category', () => expect(filterProducts(items, { cat: 'medical' }).map((i) => i.id)).toEqual(['c']));
  it('filters by segment (any match)', () => expect(filterProducts(items, { seg: 'thermal' }).map((i) => i.id)).toEqual(['b']));
  it('filters by maker', () => expect(filterProducts(items, { maker: 'kuraray' }).map((i) => i.id)).toEqual(['a']));
  it('searches case-insensitively across tokens', () => {
    expect(filterProducts(items, { q: 'PA9T' }).map((i) => i.id)).toEqual(['a']);
    expect(filterProducts(items, { q: '실린지' }).map((i) => i.id)).toEqual(['c']);
    expect(filterProducts(items, { q: 'denka 방열' }).map((i) => i.id)).toEqual(['b']);
  });
  it('ignores seg not in cat', () => expect(filterProducts(items, { cat: 'medical', seg: 'resin' }).map((i) => i.id)).toEqual(['c']));
});

describe('countBySegment', () => {
  it('counts within category', () => {
    expect(countBySegment(items, 'special')).toEqual({ resin: 1, film: 1, metal: 0, machine: 0, thermal: 1 });
  });
});

describe('query', () => {
  it('round-trips', () => {
    const q = { cat: 'special', seg: 'film', q: 'denka' } as const;
    expect(parseQuery(serializeQuery(q))).toEqual(q);
    expect(serializeQuery({})).toBe('');
    expect(parseQuery('?cat=bogus&seg=resin')).toEqual({ seg: 'resin' });
  });
});

describe('buildSearchText', () => {
  it('joins localized fields and maker name lowercased', () => {
    const t = buildSearchText({ name: { ko: 'GENESTAR', en: 'GENESTAR', ja: 'ジェネスタ' }, summary: { ko: '내열', en: 'heat', ja: '耐熱' } } as any,
      { name: 'Kuraray' } as any, ['resin']);
    expect(t).toContain('genestar');
    expect(t).toContain('ジェネスタ');
    expect(t).toContain('kuraray');
    expect(t).toContain('resin');
  });
});
