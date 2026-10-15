import { describe, it, expect } from 'vitest';
import { ProductSchema, MakerSchema, CATEGORIES, SEGMENTS, segmentsOf } from '../src/lib/schema';

const baseProduct = {
  id: 'kuraray-plastics-earneston',
  makerId: 'kuraray-plastics',
  category: 'special',
  segments: ['resin'],
  name: { ko: 'EARNESTON®', en: 'EARNESTON®', ja: 'EARNESTON®' },
  summary: { ko: '열가소성 엘라스토머', en: 'TPE compound', ja: '熱可塑性エラストマー' },
  body: { ko: '본문', en: 'body', ja: '本文' },
  features: { ko: ['a'], en: ['a'], ja: ['a'] },
  image: '', images: [], datasheetUrl: '', order: 1, published: true,
};

describe('ProductSchema', () => {
  it('accepts a valid product', () => {
    expect(ProductSchema.parse(baseProduct).id).toBe('kuraray-plastics-earneston');
  });
  it('rejects a segment that does not belong to the category', () => {
    expect(() => ProductSchema.parse({ ...baseProduct, segments: ['syringe'] })).toThrow(/segment/);
  });
  it('rejects empty korean name', () => {
    expect(() => ProductSchema.parse({ ...baseProduct, name: { ...baseProduct.name, ko: '' } })).toThrow();
  });
  it('falls back en/ja to ko when empty', () => {
    const p = ProductSchema.parse({ ...baseProduct, summary: { ko: '한', en: '', ja: '' } });
    expect(p.summary.en).toBe('한');
    expect(p.summary.ja).toBe('한');
  });
});

describe('MakerSchema', () => {
  it('accepts a valid maker', () => {
    const m = MakerSchema.parse({ id: 'denka', name: 'Denka', country: 'JP', logo: 'denka.png', url: 'https://www.denka.co.jp',
      desc: { ko: '', en: '', ja: '' }, order: 1, published: true });
    expect(m.country).toBe('JP');
  });
});

describe('taxonomy', () => {
  it('has 3 categories and 11 segments', () => {
    expect(CATEGORIES).toEqual(['special', 'medical', 'eco']);
    expect(SEGMENTS.length).toBe(11);
    expect(segmentsOf('medical')).toEqual(['absorption', 'syringe', 'vial', 'packaging']);
  });
});
