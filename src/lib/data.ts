import productsJson from '../data/products.json';
import makersJson from '../data/makers.json';
import historyJson from '../data/history.json';
import { ProductSchema, MakerSchema, HistorySchema, type Product, type Maker, type HistoryItem } from './schema';
import { buildSearchText, type CatalogItem } from './catalog';

// 빌드 시 1회 파싱. 잘못된 행은 여기서 빌드를 멈춘다(어느 id인지 메시지에 포함).
function parseAll<T>(rows: unknown[], schema: { parse: (x: unknown) => T }, label: string): T[] {
  return rows.map((r, i) => {
    try { return schema.parse(r); }
    catch (e) { throw new Error(`[${label} ${i + 1}번째 행, id=${(r as any)?.id ?? '?'}] ${(e as Error).message}`); }
  });
}

export const makers: Maker[] = parseAll(makersJson, MakerSchema, 'makers').filter((m) => m.published).sort((a, b) => a.order - b.order);
const makerById = new Map(makers.map((m) => [m.id, m]));

export const products: Product[] = parseAll(productsJson, ProductSchema, 'products')
  .filter((p) => p.published && makerById.has(p.makerId))
  .sort((a, b) => a.order - b.order);

export const history: HistoryItem[] = parseAll(historyJson, HistorySchema, 'history').sort((a, b) => b.year.localeCompare(a.year));

export const getMaker = (id: string) => makerById.get(id);
export const getProduct = (id: string) => products.find((p) => p.id === id);
export const productsByMaker = (makerId: string) => products.filter((p) => p.makerId === makerId);
export const makersWithProducts = () => makers.filter((m) => productsByMaker(m.id).length > 0);

export const catalogItems: CatalogItem[] = products.map((p) => ({
  id: p.id, category: p.category, segments: p.segments, makerId: p.makerId,
  search: buildSearchText(p, makerById.get(p.makerId)!, p.segments),
}));
