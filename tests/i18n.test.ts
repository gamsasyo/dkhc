import { describe, it, expect } from 'vitest';
import { t, localizePath, isLocale, otherLocales } from '../src/lib/i18n';
import ko from '../src/data/i18n/ko.json';
import en from '../src/data/i18n/en.json';
import ja from '../src/data/i18n/ja.json';

describe('i18n', () => {
  it('translates with fallback to ko', () => {
    expect(t('ko', 'nav.products')).toBe('제품');
    expect(t('en', 'nav.products')).toBe('Products');
    expect(t('ja', 'nav.products')).toBe('製品');
    expect(t('en', 'does.not.exist')).toBe('does.not.exist');
  });
  it('localizes paths with base', () => {
    expect(localizePath('en', '/products/', '/')).toBe('/en/products/');
    expect(localizePath('ko', '/', '/dkhc/')).toBe('/dkhc/ko/');
  });
  it('locale guards', () => {
    expect(isLocale('ja')).toBe(true);
    expect(isLocale('jp')).toBe(false);
    expect(otherLocales('ko')).toEqual(['en', 'ja']);
  });
  it('en/ja dictionaries have exactly the ko key set', () => {
    const keys = Object.keys(ko).sort();
    expect(Object.keys(en).sort()).toEqual(keys);
    expect(Object.keys(ja).sort()).toEqual(keys);
  });
});
