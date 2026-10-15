import { CATEGORIES, SEGMENTS, segmentsOf, type Category, type Segment, type Product, type Maker } from './schema';

/** 클라이언트에 내려보내는 최소 형태. 페이지는 이걸 JSON으로 인라인한다. */
export type CatalogItem = { id: string; category: Category; segments: Segment[]; makerId: string; search: string };
export type Query = { cat?: Category; seg?: Segment; maker?: string; q?: string };

export function buildSearchText(p: Pick<Product, 'name' | 'summary'>, maker: Pick<Maker, 'name'>, segments: string[]): string {
  return [p.name.ko, p.name.en, p.name.ja, p.summary.ko, p.summary.en, p.summary.ja, maker.name, ...segments]
    .join(' ').toLowerCase();
}

export function filterProducts<T extends CatalogItem>(items: T[], q: Query): T[] {
  const tokens = (q.q ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  const seg = q.seg && (!q.cat || segmentsOf(q.cat).includes(q.seg)) ? q.seg : undefined;
  return items.filter((it) =>
    (!q.cat || it.category === q.cat) &&
    (!seg || it.segments.includes(seg)) &&
    (!q.maker || it.makerId === q.maker) &&
    tokens.every((tk) => it.search.includes(tk)));
}

export function countBySegment(items: CatalogItem[], cat: Category): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of segmentsOf(cat)) out[s] = items.filter((i) => i.category === cat && i.segments.includes(s)).length;
  return out;
}

export function countByCategory(items: CatalogItem[]): Record<Category, number> {
  return Object.fromEntries(CATEGORIES.map((c) => [c, items.filter((i) => i.category === c).length])) as Record<Category, number>;
}

export function parseQuery(search: string): Query {
  const sp = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const q: Query = {};
  const cat = sp.get('cat'); if (cat && (CATEGORIES as readonly string[]).includes(cat)) q.cat = cat as Category;
  const seg = sp.get('seg'); if (seg && (SEGMENTS as readonly string[]).includes(seg)) q.seg = seg as Segment;
  const maker = sp.get('maker'); if (maker) q.maker = maker;
  const text = sp.get('q')?.trim(); if (text) q.q = text;
  return q;
}

export function serializeQuery(q: Query): string {
  const sp = new URLSearchParams();
  if (q.cat) sp.set('cat', q.cat);
  if (q.seg) sp.set('seg', q.seg);
  if (q.maker) sp.set('maker', q.maker);
  if (q.q) sp.set('q', q.q);
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export type MakerItem = { id: string; name: string; categories: string[] };
export const initialOf = (name: string) => { const c = name.trim().charAt(0).toUpperCase(); return /[A-Z]/.test(c) ? c : '#'; };
export function filterMakers<T extends MakerItem>(items: T[], f: { cat?: string; letter?: string }): T[] {
  return items.filter((m) => (!f.cat || m.categories.includes(f.cat)) && (!f.letter || initialOf(m.name) === f.letter));
}
