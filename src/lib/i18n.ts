import ko from '../data/i18n/ko.json';
import en from '../data/i18n/en.json';
import ja from '../data/i18n/ja.json';
import { LOCALES, type Locale } from './schema';
export { LOCALES, type Locale };

const DICT: Record<Locale, Record<string, string>> = { ko, en, ja };

export const isLocale = (x: unknown): x is Locale => typeof x === 'string' && (LOCALES as readonly string[]).includes(x);
export const otherLocales = (l: Locale) => LOCALES.filter((x) => x !== l);

/** `{name}` 치환 지원. 키 없으면 ko → 키 문자열 순으로 폴백. */
export function t(locale: Locale, key: string, vars: Record<string, string | number> = {}): string {
  const raw = DICT[locale][key] ?? DICT.ko[key] ?? key;
  return raw.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}

/** `/products/` → `/{base}/{locale}/products/` */
export function localizePath(locale: Locale, path: string, base: string = import.meta.env?.BASE_URL ?? '/'): string {
  const b = base.replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${b}/${locale}${p === '/' ? '/' : p}`;
}

export const pick = <T extends Record<Locale, string>>(obj: T, l: Locale) => obj[l] || obj.ko;
export const pickList = <T extends Record<Locale, string[]>>(obj: T, l: Locale) => (obj[l]?.length ? obj[l] : obj.ko);
