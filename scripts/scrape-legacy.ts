/**
 * 현행 dkhc.co.kr → src/data/{products,makers,history}.json + src/assets/{makers,products}/
 * 실행: npm run scrape
 */
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { parseListPage, parseViewPage, slugify, imageFileName } from './lib/legacy-parse.ts';
import { ProductSchema, MakerSchema, HistorySchema, type Category, type Segment } from '../src/lib/schema.ts';

const ORIGIN = 'http://dkhc.co.kr';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/129.0 Safari/537.36';
const LANGS = { ko: 'ko', en: 'en', ja: 'jp' } as const; // 새 로케일 → 구 경로
const SEG_BY_CATE: Record<string, { category: Category; segment: Segment }> = {
  '1010': { category: 'special', segment: 'resin' }, '1011': { category: 'special', segment: 'film' },
  '1012': { category: 'special', segment: 'metal' }, '1013': { category: 'special', segment: 'machine' },
  '1014': { category: 'special', segment: 'thermal' }, '1110': { category: 'medical', segment: 'absorption' },
  '1111': { category: 'medical', segment: 'syringe' }, '1113': { category: 'medical', segment: 'vial' },
  '1112': { category: 'medical', segment: 'packaging' }, '1212': { category: 'eco', segment: 'bio-resin' },
  '1213': { category: 'eco', segment: 'biodegradable' },
};
// 구 사이트에 국가 정보가 없어 아는 만큼만. 빈칸은 회사가 시트에서 채움.
const COUNTRY: Record<string, string> = {
  kuraray: 'JP', 'kuraray-plastics': 'JP', 'mitsui-chemicals': 'JP', 'daicel-polymer': 'JP', denka: 'JP',
  'mitsubishi-gas-chemical': 'JP', 'maeda-industry': 'JP', kurabo: 'JP', chukoh: 'JP', saxin: 'JP',
  kawata: 'JP', 'kohan-kogyo': 'JP', 'sojitz-pla-net': 'JP', upm: 'FI', 'suzhou-iwatani-metal': 'CN',
  'raynergy-tek': 'TW', chasm: 'US',
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function get(path: string): Promise<string> {
  const res = await fetch(ORIGIN + path, { headers: { 'User-Agent': UA, 'Accept-Language': 'ko' } });
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  await sleep(150);
  return res.text();
}
// 디렉터리별 파일명 → 원본 경로 (슬러그 충돌 방지용)
const usedNames = new Map<string, Map<string, string>>();
async function download(path: string, dir: string): Promise<string> {
  if (!path) return '';
  const used = usedNames.get(dir) ?? new Map<string, string>();
  usedNames.set(dir, used);
  const name = imageFileName(path, used);
  const dest = `${dir}/${name}`;
  if (!existsSync(dest)) {
    const res = await fetch(ORIGIN + encodeURI(path), { headers: { 'User-Agent': UA } });
    if (!res.ok) { console.warn(`이미지 실패 ${path}`); return ''; }
    writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  }
  return name;
}

type Loc = Record<'ko' | 'en' | 'ja', string>;
const loc = (): Loc => ({ ko: '', en: '', ja: '' });

async function main() {
  mkdirSync('src/assets/makers', { recursive: true });
  mkdirSync('src/assets/products', { recursive: true });
  mkdirSync('src/data', { recursive: true });

  // 1) 목록 페이지(ko)로 idx ↔ 세부분야 매핑 + 로고
  const idxMeta = new Map<number, { name: string; logo: string; cates: string[] }>();
  for (const cate of Object.keys(SEG_BY_CATE)) {
    for (const e of parseListPage(await get(`/ko/sub/product/list.asp?s_cate=${cate}`))) {
      const m = idxMeta.get(e.idx) ?? { name: e.name, logo: e.logo, cates: [] };
      m.cates.push(cate);
      idxMeta.set(e.idx, m);
    }
  }
  console.log(`메이커 엔트리 ${idxMeta.size}개`);

  // 2) 상세 × 3언어
  const makers = new Map<string, any>();
  const products = new Map<string, any>();
  let order = 0;
  for (const [idx, meta] of idxMeta) {
    const makerId = slugify(meta.name);
    const views = {} as Record<'ko' | 'en' | 'ja', ReturnType<typeof parseViewPage>>;
    for (const [l, p] of Object.entries(LANGS) as ['ko' | 'en' | 'ja', string][]) {
      views[l] = parseViewPage(await get(`/${p}/sub/product/list.asp?mode=view&idx=${idx}&s_cate=${meta.cates[0]}`));
    }
    const mk = makers.get(makerId) ?? {
      id: makerId, name: meta.name, country: COUNTRY[makerId] ?? '', logo: await download(meta.logo, 'src/assets/makers'),
      url: '', desc: loc(), order: makers.size + 1, published: true,
    };
    for (const l of ['ko', 'en', 'ja'] as const) if (!mk.desc[l]) mk.desc[l] = views[l].maker.desc;
    makers.set(makerId, mk);

    const cat = SEG_BY_CATE[meta.cates[0]].category;
    const segs = [...new Set(meta.cates.map((c) => SEG_BY_CATE[c].segment))];
    const firstSentence = (s: string) => s.split(/(?<=[.。다])\s/)[0].slice(0, 90);
    for (const [i, kp] of views.ko.products.entries()) {
      if (!kp.name) { console.warn(`이름 없는 제품 탭 건너뜀: idx=${idx} (${meta.name})`); continue; }
      const id = `${makerId}-${slugify(kp.name)}`;
      const ep = views.en.products[i] ?? kp, jp = views.ja.products[i] ?? kp;
      const existing = products.get(id);
      if (existing) { existing.segments = [...new Set([...existing.segments, ...segs])]; continue; }
      products.set(id, {
        id, makerId, category: cat, segments: segs,
        name: { ko: kp.name, en: ep.name, ja: jp.name },
        summary: { ko: firstSentence(kp.body), en: firstSentence(ep.body), ja: firstSentence(jp.body) },
        body: { ko: kp.body, en: ep.body, ja: jp.body },
        features: { ko: kp.features, en: ep.features, ja: jp.features },
        image: await download(kp.image, 'src/assets/products'),
        images: await Promise.all(kp.images.map((p) => download(p, 'src/assets/products'))),
        datasheetUrl: '', order: ++order, published: true,
      });
    }
  }

  // 3) 연혁 (개요 페이지)
  const history: any[] = [];
  const sum = {} as Record<'ko' | 'en' | 'ja', string>;
  for (const [l, p] of Object.entries(LANGS) as ['ko' | 'en' | 'ja', string][]) sum[l] = await get(`/${p}/sub/company/summary.asp`);
  const rows = (html: string) => [...html.matchAll(/<dt>(\d{4})<\/dt>\s*<dd>([\s\S]*?)<\/dd>/g)].map((m) => ({ year: m[1], text: m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() }));
  const ko = rows(sum.ko), en = rows(sum.en), ja = rows(sum.ja);
  ko.forEach((r, i) => history.push({ year: r.year, text: { ko: r.text, en: en[i]?.text ?? '', ja: ja[i]?.text ?? '' } }));

  // 4) 검증 + 저장
  const check = <T,>(label: string, rows: any[], schema: { safeParse: (x: unknown) => any }): T[] =>
    rows.map((r) => {
      const res = schema.safeParse(r);
      if (!res.success) throw new Error(`[${label} id=${r.id ?? r.year}] ${res.error.issues.map((i: any) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
      return res.data as T;
    });
  const P = check<any>('products', [...products.values()], ProductSchema);
  const M = check<any>('makers', [...makers.values()], MakerSchema);
  const H = check<any>('history', history, HistorySchema);
  writeFileSync('src/data/products.json', JSON.stringify(P, null, 2));
  writeFileSync('src/data/makers.json', JSON.stringify(M, null, 2));
  writeFileSync('src/data/history.json', JSON.stringify(H, null, 2));
  console.log(`제품 ${P.length} · 메이커 ${M.length} · 연혁 ${H.length} 저장`);
}
main().catch((e) => { console.error(e); process.exit(1); });
