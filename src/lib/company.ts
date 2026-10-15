import ko from '../content/company/ko.json';
import en from '../content/company/en.json';
import ja from '../content/company/ja.json';
import type { Locale } from './schema';

export type Company = {
  overview: string; lead: string;
  greeting: { title: string; paragraphs: string[]; signature: string };
  clients: string[];
};
export const company: Record<Locale, Company> = { ko, en, ja };

/** 고객사 로고 = src/assets/clients/partner01..18.gif, 순서는 clients 배열과 동일 */
export const CLIENT_LOGO_COUNT = 18;
