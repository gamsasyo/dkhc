# DKHC 리뉴얼 — Plan 1: 기반 + 카탈로그(제품/공급사) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Astro 5 + Tailwind 4 정적 사이트 뼈대를 세우고, 현행 dkhc.co.kr에서 제품·메이커·연혁을 3개 언어로 긁어 JSON으로 만든 뒤, IMCD식 제품 탐색 페이지(분야 타일 → 세부 pill → 리스트 카드 + 검색)와 공급사 페이지를 완성하고, Google Sheet → 빌드 파이프라인(GitHub Actions → Pages)까지 연결한다.

**Architecture:** 데이터는 `src/data/*.json`(커밋된 스냅샷)이 단일 소스. 로컬/CI 모두 이 JSON으로 빌드하고, CI에서 `SHEET_ID`가 있으면 `scripts/fetch-sheet.ts`가 시트 CSV를 받아 JSON을 덮어쓴 뒤 빌드한다. 검증은 `src/lib/schema.ts`(zod) 하나를 스크래퍼·시트 페처·Astro 로더가 공유. 제품 필터/검색 로직은 `src/lib/catalog.ts` 순수 함수로 두고 vitest로 테스트, 페이지의 클라이언트 스크립트는 그 함수를 그대로 import.

**Tech Stack:** Astro 5 (i18n routing, 정적 출력), Tailwind CSS v4 (`@tailwindcss/vite`, `@theme` 토큰), Pretendard Variable + Noto Sans JP, zod, vitest, Node 23 (`.ts` 스크립트를 네이티브 type-stripping으로 실행), csv-parse, GitHub Actions + Pages.

**Spec:** `docs/superpowers/specs/2026-10-15-dkhc-website-design.md` — 이 플랜은 스펙 §1·§2·§3·§4(제품/공급사 부분)·§5·§6-1~3을 구현. 홈/회사/문의/메일/DNS/인수인계는 Plan 2.

**로케일 표기:** URL·데이터 키는 `ko` / `en` / `ja`(BCP47, `<html lang>` 정확성 때문). 구 사이트의 `/jp/...`는 Plan 2에서 `/ja/...`로 리다이렉트. 시트 칼럼도 `_ja`.

---

## File Structure

```
astro.config.mjs                     Astro 설정: i18n(ko/en/ja), tailwind vite 플러그인, site/base
vitest.config.ts                     getViteConfig 기반
package.json                         scripts: dev/build/preview/test/scrape/fetch-sheet
src/styles/global.css                @import tailwind + @theme 토큰 + base 스타일
src/lib/schema.ts                    zod 스키마 (Product/Maker/History) + Category/Segment 상수 — 유일한 데이터 정의
src/lib/data.ts                      JSON 로드 + 파싱(빌드 시) + 조회 헬퍼 (getProduct, productsByMaker…)
src/lib/catalog.ts                   순수 함수: filterProducts, countBySegment, buildSearchText, parseQuery/serializeQuery
src/lib/i18n.ts                      Locale 타입, LOCALES, t(), localizePath(), pickLocalized()
src/data/i18n/{ko,en,ja}.json        UI 문자열
src/data/products.json               스크래퍼 산출 → 시트가 덮어씀
src/data/makers.json                 〃
src/data/history.json                〃
src/assets/makers/*.png              메이커 로고 (스크래퍼가 다운로드)
src/assets/products/*.jpg            제품 이미지 (〃)
src/components/ui/Button.astro       알약 버튼 (primary/secondary/ghost, md/sm)
src/components/ui/Pill.astro         선택형 pill (count 표시)
src/components/ui/Eyebrow.astro      대문자 눈썹 라벨
src/components/ui/Container.astro    max-w 1200 + 좌우 패딩
src/components/Header.astro          로고 · 네비 · SearchCombo · 언어 · 모바일 메뉴
src/components/SearchCombo.astro     [분야 ▾ | 검색] 헤더 콤보 (submit → /products?q=)
src/components/Footer.astro
src/components/PageHero.astro        틴트 그라데이션 띠 + 눈썹 + 제목
src/components/CategoryTiles.astro   분야 타일 3개 (추상 그래픽 배경, 선택 체크)
src/components/SegmentPills.astro    세부 분야 pill 행
src/components/ProductListCard.astro IMCD식 풀폭 리스트 카드
src/components/MakerCard.astro       로고 + 이름 + 제품 N개
src/components/AlphaIndex.astro      A–Z 인덱스 바
src/components/islands/catalog.ts    /products 클라이언트 스크립트 (filter+search+URL 동기화)
src/components/islands/makers.ts     /makers 클라이언트 스크립트 (분야+A–Z 필터)
src/layouts/Base.astro               html/head/폰트/Header/Footer, hreflang
src/pages/index.astro                / → /ko 리다이렉트
src/pages/[lang]/index.astro         임시 홈 (Plan 2에서 교체)
src/pages/[lang]/styleguide.astro    토큰·컴포넌트 눈 확인용
src/pages/[lang]/products/index.astro
src/pages/[lang]/products/[id].astro
src/pages/[lang]/makers/index.astro
src/pages/[lang]/makers/[id].astro
scripts/scrape-legacy.ts             현행 사이트 → JSON + 이미지
scripts/fetch-sheet.ts               Google Sheet CSV → JSON (검증 실패 시 한국어 메시지 + exit 1)
scripts/apps-script/trigger-build.gs 시트 메뉴 [사이트 반영] → GitHub repository_dispatch (복붙용)
.github/workflows/deploy.yml         push/cron/dispatch → fetch-sheet → build → Pages
tests/catalog.test.ts, tests/schema.test.ts, tests/i18n.test.ts
docs/ops/sheet-setup.md              시트 만들기·공개 설정·탭/칼럼 (Plan 2 운영 가이드의 재료)
```

---

### Task 1: Astro 5 + Tailwind 4 + i18n 스캐폴드

**Files:**
- Create: `package.json`, `astro.config.mjs`, `tsconfig.json`, `src/styles/global.css`, `src/pages/index.astro`, `src/pages/[lang]/index.astro`, `src/env.d.ts`
- Modify: `.gitignore` (`src/data/*.json` 제외 줄 삭제 — JSON은 커밋한다)

- [ ] **Step 1: 프로젝트 생성**

Run (리포 루트 `/Users/jaeyoungshin/REN/github/dkhc`):
```bash
npm create astro@latest . -- --template minimal --no-install --no-git --typescript strict --yes
npm i
npm i tailwindcss @tailwindcss/vite zod csv-parse
npm i -D vitest @types/node
```
Expected: `package.json`에 `astro` ^5.x. 기존 `docs/`, `.gitignore`는 그대로 남음(템플릿이 덮어쓰려 하면 "n"으로 거부하거나 git으로 복원: `git checkout -- .gitignore`).

- [ ] **Step 2: `.gitignore` 정리**

`src/data/*.json` 줄을 삭제한다. 최종:
```
node_modules/
dist/
.astro/
.env
.env.*
.DS_Store
.playwright-mcp/
```

- [ ] **Step 3: `astro.config.mjs`**

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  site: process.env.SITE_URL ?? 'https://dkhc.co.kr',
  base,
  trailingSlash: 'ignore',
  i18n: {
    defaultLocale: 'ko',
    locales: ['ko', 'en', 'ja'],
    routing: { prefixDefaultLocale: true, redirectToDefaultLocale: false },
  },
  vite: { plugins: [tailwindcss()] },
});
```

- [ ] **Step 4: `src/styles/global.css` — 디자인 토큰 (스펙 §5)**

```css
@import "tailwindcss";

@theme {
  /* 색: 네이비 1 · 포인트 블루 1 · 회색 5단계 · 분야 틴트 3 */
  --color-brand: #14255c;
  --color-brand-deep: #0c1740;
  --color-accent: #0a8fe0;
  --color-accent-hover: #077ac0;
  --color-ink: #1b1f2a;
  --color-ink-2: #4b5160;
  --color-ink-3: #8a90a0;
  --color-line: #e3e6ec;
  --color-surface: #f5f6f8;
  --color-tint-special: #e4f0ff;
  --color-tint-medical: #e6f7f1;
  --color-tint-eco: #f0f6e4;

  /* 타이포 */
  --font-sans: "Pretendard Variable", Pretendard, "Noto Sans JP", system-ui, sans-serif;
  --font-jp: "Noto Sans JP", "Pretendard Variable", system-ui, sans-serif;

  /* 형 */
  --radius-card: 16px;
  --radius-input: 12px;
  --radius-pill: 999px;
  --shadow-card: 0 8px 24px -12px rgb(20 37 92 / 0.18);

  /* 여백 */
  --spacing-section: 6rem;
  --spacing-section-sm: 4rem;
  --container-site: 1200px;
}

@layer base {
  html { font-family: var(--font-sans); color: var(--color-ink); letter-spacing: -0.01em; }
  html[lang="ja"] { font-family: var(--font-jp); letter-spacing: 0; }
  body { background: #fff; font-size: 16px; line-height: 1.6; }
  h1, h2, h3, h4 { font-weight: 600; color: var(--color-brand); line-height: 1.25; }
  a { transition: color .2s, background-color .2s, border-color .2s; }
  :focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }
}
```

- [ ] **Step 5: 루트 리다이렉트 + 임시 홈**

`src/pages/index.astro`:
```astro
---
export const prerender = true;
return Astro.redirect(`${import.meta.env.BASE_URL.replace(/\/$/, '')}/ko/`);
---
```

`src/pages/[lang]/index.astro`:
```astro
---
import '../../styles/global.css';
export function getStaticPaths() {
  return ['ko', 'en', 'ja'].map((lang) => ({ params: { lang } }));
}
const { lang } = Astro.params;
---
<html lang={lang}>
  <head><meta charset="utf-8" /><title>DKHC</title></head>
  <body class="p-8">
    <h1 class="text-3xl">(주)대경하이켐 — {lang}</h1>
    <a class="text-accent underline" href={`${import.meta.env.BASE_URL.replace(/\/$/, '')}/${lang}/products/`}>products</a>
  </body>
</html>
```

- [ ] **Step 6: 빌드 확인**

Run: `npm run build`
Expected: `dist/ko/index.html`, `dist/en/index.html`, `dist/ja/index.html`, `dist/index.html`(리다이렉트) 생성, 에러 없음.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: Astro 5 + Tailwind 4 + i18n(ko/en/ja) 스캐폴드, 디자인 토큰"
```

---

### Task 2: 스키마 (`src/lib/schema.ts`) — TDD

**Files:**
- Create: `src/lib/schema.ts`, `tests/schema.test.ts`, `vitest.config.ts`
- Modify: `package.json` (scripts.test)

- [ ] **Step 1: vitest 설정**

`vitest.config.ts`:
```ts
import { getViteConfig } from 'astro/config';
export default getViteConfig({ test: { include: ['tests/**/*.test.ts'] } });
```
`package.json` scripts에 추가: `"test": "vitest run"`, `"test:watch": "vitest"`.

- [ ] **Step 2: 실패하는 테스트**

`tests/schema.test.ts`:
```ts
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
```

- [ ] **Step 3: 실패 확인**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/lib/schema'`.

- [ ] **Step 4: 구현**

`src/lib/schema.ts`:
```ts
import { z } from 'zod';

export const LOCALES = ['ko', 'en', 'ja'] as const;
export type Locale = (typeof LOCALES)[number];

export const CATEGORIES = ['special', 'medical', 'eco'] as const;
export type Category = (typeof CATEGORIES)[number];

/** 세부 분야. category와 1:N. 라벨 번역은 i18n JSON의 `segment.<id>`. */
export const SEGMENT_DEFS = [
  { id: 'resin', category: 'special' },
  { id: 'film', category: 'special' },
  { id: 'metal', category: 'special' },
  { id: 'machine', category: 'special' },
  { id: 'thermal', category: 'special' },
  { id: 'absorption', category: 'medical' },
  { id: 'syringe', category: 'medical' },
  { id: 'vial', category: 'medical' },
  { id: 'packaging', category: 'medical' },
  { id: 'bio-resin', category: 'eco' },
  { id: 'biodegradable', category: 'eco' },
] as const;
export const SEGMENTS = SEGMENT_DEFS.map((s) => s.id);
export type Segment = (typeof SEGMENT_DEFS)[number]['id'];
export const segmentsOf = (c: Category): Segment[] =>
  SEGMENT_DEFS.filter((s) => s.category === c).map((s) => s.id);

/** ko 필수, en/ja 비면 ko로 폴백 (회사가 검수하며 채움). */
const Localized = z
  .object({ ko: z.string().min(1), en: z.string().default(''), ja: z.string().default('') })
  .transform((v) => ({ ko: v.ko, en: v.en || v.ko, ja: v.ja || v.ko }));
const LocalizedOptional = z
  .object({ ko: z.string().default(''), en: z.string().default(''), ja: z.string().default('') })
  .transform((v) => ({ ko: v.ko, en: v.en || v.ko, ja: v.ja || v.ko }));
const LocalizedList = z
  .object({ ko: z.array(z.string()).default([]), en: z.array(z.string()).default([]), ja: z.array(z.string()).default([]) })
  .transform((v) => ({ ko: v.ko, en: v.en.length ? v.en : v.ko, ja: v.ja.length ? v.ja : v.ko }));

export const ProductSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/, 'id는 영소문자·숫자·하이픈만'),
    makerId: z.string().min(1),
    category: z.enum(CATEGORIES),
    segments: z.array(z.enum(SEGMENTS as [Segment, ...Segment[]])).min(1),
    name: Localized,
    summary: LocalizedOptional,
    body: LocalizedOptional,
    features: LocalizedList,
    image: z.string().default(''),
    images: z.array(z.string()).default([]),
    datasheetUrl: z.string().default(''),
    order: z.number().int().default(999),
    published: z.boolean().default(true),
  })
  .superRefine((p, ctx) => {
    const allowed = segmentsOf(p.category);
    for (const s of p.segments) {
      if (!allowed.includes(s)) {
        ctx.addIssue({ code: 'custom', path: ['segments'], message: `segment '${s}'는 category '${p.category}'에 속하지 않음` });
      }
    }
  });
export type Product = z.infer<typeof ProductSchema>;

export const MakerSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  country: z.string().default(''), // ISO 3166-1 alpha-2 또는 빈칸
  logo: z.string().default(''),    // src/assets/makers/ 안 파일명
  url: z.string().default(''),
  desc: LocalizedOptional,
  order: z.number().int().default(999),
  published: z.boolean().default(true),
});
export type Maker = z.infer<typeof MakerSchema>;

export const HistorySchema = z.object({
  year: z.string().min(4),
  text: Localized,
});
export type HistoryItem = z.infer<typeof HistorySchema>;
```

- [ ] **Step 5: 통과 확인**

Run: `npm test`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/schema.ts tests/schema.test.ts vitest.config.ts package.json
git commit -m "feat(data): zod 스키마 + 분야/세부 분야 택소노미"
```

---

### Task 3: 현행 사이트 스크래퍼 → JSON + 이미지

구조(분석 결과): 세부 분야 목록 페이지 `/{lang}/sub/product/list.asp?s_cate=<4자리>` 의 `#prod_list li a[href="?mode=view&idx=N..."]` 가 **메이커 엔트리**(로고 img + 이름 p). 상세 `?mode=view&idx=N` 의 `#prod_view .top dl dt`=메이커명, `dd`=메이커 소개, `#tabSt2 > ul > li` 각각이 **제품 라인**: `a`=제품명, `.pd_txt p`=설명, `.characteristic li p`=특징, `.info1 .img img`=대표 이미지, `.list li img`=추가 이미지. 같은 idx가 세 언어에서 동일. 메이커 한 곳이 여러 idx(여러 세부 분야)에 등장할 수 있음 → 이름으로 병합. 기본 UA는 403이라 브라우저 UA 필수.

**Files:**
- Create: `scripts/scrape-legacy.ts`, `scripts/lib/legacy-parse.ts`, `tests/legacy-parse.test.ts`
- Modify: `package.json` (scripts.scrape)

- [ ] **Step 1: 파서 테스트 (HTML 샘플은 `docs/analysis/raw/`에 있음)**

`tests/legacy-parse.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseListPage, parseViewPage, slugify } from '../scripts/lib/legacy-parse';

const list = readFileSync('docs/analysis/raw/ko_sub_product_list.asp_s_cate_1010', 'utf8');
const view = readFileSync('docs/analysis/raw/v11.html', 'utf8');

describe('legacy-parse', () => {
  it('parses maker entries from a list page', () => {
    const entries = parseListPage(list);
    expect(entries.length).toBe(4);
    expect(entries[0]).toEqual({ idx: 17, name: 'KURARAY', logo: '/upload/prod/kuraray modified.png' });
  });
  it('parses maker + product lines from a view page', () => {
    const v = parseViewPage(view);
    expect(v.maker.name).toBe('Kuraray Plastics');
    expect(v.maker.desc).toContain('풍요로운 미래 사회');
    expect(v.products.length).toBe(1);
    expect(v.products[0].name).toBe('EARNESTON®');
    expect(v.products[0].features.length).toBe(6);
    expect(v.products[0].image).toBe('/upload/prod/아네스톤.jpg');
  });
  it('slugifies', () => {
    expect(slugify('Kuraray Plastics')).toBe('kuraray-plastics');
    expect(slugify('Panaxia : 내열 고접동성 필름')).toBe('panaxia');
    expect(slugify('EARNESTON®')).toBe('earneston');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- legacy`
Expected: FAIL — module not found.

- [ ] **Step 3: 파서 구현 (정규식 기반, 의존성 0)**

`scripts/lib/legacy-parse.ts`:
```ts
const strip = (html: string) =>
  html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();

export const slugify = (s: string) =>
  s.normalize('NFKD').replace(/[®™©]/g, '').split(/[:：(]/)[0]
   .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'item';

export type ListEntry = { idx: number; name: string; logo: string };
export function parseListPage(html: string): ListEntry[] {
  const out: ListEntry[] = [];
  const re = /<a href="\?mode=view&idx=(\d+)[^"]*">\s*<div class="img"><img src="([^"]*)"[^>]*><\/div>\s*<div class="txt">\s*<p>([\s\S]*?)<\/p>/g;
  for (const m of html.matchAll(re)) out.push({ idx: Number(m[1]), logo: m[2], name: strip(m[3]) });
  return out;
}

export type ViewProduct = { name: string; body: string; features: string[]; image: string; images: string[] };
export type ViewPage = { maker: { name: string; desc: string }; products: ViewProduct[] };
export function parseViewPage(html: string): ViewPage {
  const art = html.split('<article id="prod_view">')[1]?.split('</article>')[0] ?? '';
  const name = strip(art.match(/<dt>([\s\S]*?)<\/dt>/)?.[1] ?? '');
  const desc = strip(art.match(/<dd>([\s\S]*?)<\/dd>/)?.[1] ?? '');
  const tabs = art.split('<div id="tabSt2">')[1] ?? '';
  const products: ViewProduct[] = [];
  const liRe = /<li>\s*<a href="javascript:;">([\s\S]*?)<img[\s\S]*?<div class="tab_con">([\s\S]*?)<\/div>\s*<\/li>\s*(?=<li>\s*<a href="javascript:;">|<\/ul>\s*<\/div>\s*<\/div>)/g;
  for (const m of tabs.matchAll(liRe)) {
    const con = m[2];
    const body = strip(con.match(/<div class="pd_txt">[\s\S]*?<p>([\s\S]*?)<\/p>/)?.[1] ?? '');
    const features = [...(con.match(/<div class="characteristic">([\s\S]*?)<\/ul>/)?.[1] ?? '').matchAll(/<p>([\s\S]*?)<\/p>/g)]
      .map((f) => strip(f[1])).filter(Boolean);
    const image = con.match(/<div class="info1 clearfix">\s*<div class="img"><img src="([^"]*)"/)?.[1] ?? '';
    const images = [...(con.match(/<div class="list">([\s\S]*?)<\/div>/)?.[1] ?? '').matchAll(/<img src="([^"]*)"/g)].map((i) => i[1]);
    products.push({ name: strip(m[1]), body, features, image, images });
  }
  return { maker: { name, desc }, products };
}
```

- [ ] **Step 4: 통과 확인**

Run: `npm test -- legacy`
Expected: PASS (3 tests). 만약 `liRe`가 2탭 페이지에서 1개만 잡으면 `docs/analysis/raw/`에 없는 `idx=9`(Saxin, 탭 2개)를 받아 테스트에 추가하고 정규식을 고친다 — 실제 데이터로 확인할 것: 스크래퍼 실행 후 `saxin` 제품이 2개(New Lite, Panaxia)여야 한다.

- [ ] **Step 5: 스크래퍼 본체**

`scripts/scrape-legacy.ts`:
```ts
/**
 * 현행 dkhc.co.kr → src/data/{products,makers,history}.json + src/assets/{makers,products}/
 * 실행: npm run scrape
 */
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { basename, extname } from 'node:path';
import { parseListPage, parseViewPage, slugify } from './lib/legacy-parse.ts';
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
async function download(path: string, dir: string): Promise<string> {
  if (!path) return '';
  const name = slugify(basename(path, extname(path))) + extname(path).toLowerCase();
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
  const P = [...products.values()].map((p) => ProductSchema.parse(p));
  const M = [...makers.values()].map((m) => MakerSchema.parse(m));
  const H = history.map((h) => HistorySchema.parse(h));
  writeFileSync('src/data/products.json', JSON.stringify(P, null, 2));
  writeFileSync('src/data/makers.json', JSON.stringify(M, null, 2));
  writeFileSync('src/data/history.json', JSON.stringify(H, null, 2));
  console.log(`제품 ${P.length} · 메이커 ${M.length} · 연혁 ${H.length} 저장`);
}
main().catch((e) => { console.error(e); process.exit(1); });
```
`package.json` scripts: `"scrape": "node scripts/scrape-legacy.ts"`.

주의: 연혁 `<dt>년도</dt><dd>` 패턴은 `docs/analysis/raw/ko_sub_company_summary.asp`에서 실제 마크업을 확인해 정규식을 맞춘다.

- [ ] **Step 6: 실행 + 눈 검증**

Run: `npm run scrape`
Expected 출력 예: `메이커 엔트리 26개` → `제품 3x · 메이커 2x · 연혁 10 저장`. 확인:
```bash
node -e "const p=require('./src/data/products.json');console.log(p.length, p.filter(x=>x.makerId==='saxin').map(x=>x.name.ko))"
node -e "const m=require('./src/data/makers.json');console.log(m.map(x=>x.id+':'+x.logo).join('\n'))"
ls src/assets/makers | wc -l
```
Expected: saxin 제품 2개(`New Lite`, `Panaxia…`), 메이커 로고 파일 대부분 존재(실패한 건 `logo: ''`), `denka` 메이커가 1개로 병합되고 그 제품들의 `segments`에 film/thermal/absorption 등이 섞여 있음.
JSON에서 EN/JA 본문이 한국어와 동일한 항목이 있으면 그건 구 사이트도 그랬던 것 — 그대로 둔다(회사 검수 대상).

- [ ] **Step 7: Commit**

```bash
git add scripts src/data src/assets tests/legacy-parse.test.ts package.json
git commit -m "feat(data): 현행 사이트 스크래퍼 + 제품/메이커/연혁 3언어 JSON 시딩"
```

---

### Task 4: 데이터 로더 + i18n 헬퍼 + 카탈로그 순수 함수 — TDD

**Files:**
- Create: `src/lib/data.ts`, `src/lib/i18n.ts`, `src/lib/catalog.ts`, `src/data/i18n/ko.json`, `src/data/i18n/en.json`, `src/data/i18n/ja.json`, `tests/catalog.test.ts`, `tests/i18n.test.ts`

- [ ] **Step 1: 테스트**

`tests/catalog.test.ts`:
```ts
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
```

`tests/i18n.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { t, localizePath, isLocale, otherLocales } from '../src/lib/i18n';

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
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test`
Expected: FAIL — modules not found.

- [ ] **Step 3: i18n 문자열 + 헬퍼**

`src/data/i18n/ko.json`:
```json
{
  "site.name": "(주)대경하이켐",
  "site.tagline": "첨단 소재를 잇는 가장 신뢰할 수 있는 파트너",
  "nav.products": "제품", "nav.makers": "공급사", "nav.company": "회사소개", "nav.contact": "문의하기",
  "search.placeholder": "제품명 · 메이커 · 소재로 검색", "search.all": "전체 분야", "search.submit": "검색",
  "products.title": "제품", "products.eyebrow": "PRODUCT",
  "products.selectCategory": "분야를 선택하세요", "products.selectSegment": "{category}의 세부 분야",
  "products.allSegments": "전체", "products.results": "{category} 결과 {count}개", "products.resultsAll": "전체 제품 {count}개",
  "products.empty": "조건에 맞는 제품이 없어요", "products.emptyHint": "검색어를 바꾸거나 분야 전체를 둘러보세요.",
  "products.viewDetail": "자세히 보기", "products.requestQuote": "견적 문의", "products.requestDocs": "자료 요청",
  "products.principal": "공급사", "products.sameMaker": "같은 공급사의 제품", "products.sameSegment": "같은 분야의 제품",
  "products.features": "제품 특징", "products.description": "제품 설명", "products.backToList": "목록으로",
  "makers.title": "공급사", "makers.eyebrow": "SUPPLIERS", "makers.count": "제품 {count}개", "makers.all": "전체",
  "makers.products": "취급 제품", "makers.website": "웹사이트",
  "category.special": "Special Material", "category.medical": "Medical", "category.eco": "Eco-Friendly",
  "category.special.desc": "엔지니어링 플라스틱 · 필름 · 금속 · 설비 · 방열", "category.medical.desc": "의료용 포장 · 실린지 · 바이알 · 흡수재",
  "category.eco.desc": "바이오 수지 · 생분해 소재",
  "segment.resin": "Resin", "segment.film": "Film", "segment.metal": "Metal", "segment.machine": "Machine", "segment.thermal": "Thermal Management",
  "segment.absorption": "Absorption Products", "segment.syringe": "Syringe", "segment.vial": "Vial", "segment.packaging": "Special Packaging",
  "segment.bio-resin": "Bio Resin", "segment.biodegradable": "Biodegradable",
  "country.JP": "일본", "country.CN": "중국", "country.TW": "대만", "country.US": "미국", "country.FI": "핀란드", "country.KR": "한국",
  "footer.address": "서울특별시 영등포구 양평로12길 17-1 대경빌딩 3층", "footer.tel": "02-3272-9581~5", "footer.fax": "02-3272-9586",
  "footer.email": "info@dkhc.co.kr", "footer.privacy": "개인정보 취급방침", "footer.copyright": "© 2026 Daekyung Hichem Co., Ltd. All rights reserved."
}
```
`src/data/i18n/en.json` — 같은 키, 영어 값. 분야/세부 분야 키는 동일 영문, 그 외:
```json
{
  "site.name": "Daekyung Hichem Co., Ltd.", "site.tagline": "Your most trusted partner for advanced materials",
  "nav.products": "Products", "nav.makers": "Suppliers", "nav.company": "Company", "nav.contact": "Contact",
  "search.placeholder": "Search products, suppliers, materials", "search.all": "All categories", "search.submit": "Search",
  "products.title": "Products", "products.eyebrow": "PRODUCT",
  "products.selectCategory": "Select a category", "products.selectSegment": "Segments in {category}",
  "products.allSegments": "All", "products.results": "{count} results in {category}", "products.resultsAll": "{count} products",
  "products.empty": "No products match", "products.emptyHint": "Try another keyword or browse the whole category.",
  "products.viewDetail": "View details", "products.requestQuote": "Request quote", "products.requestDocs": "Request documents",
  "products.principal": "Principal", "products.sameMaker": "More from this supplier", "products.sameSegment": "More in this segment",
  "products.features": "Key features", "products.description": "Description", "products.backToList": "Back to list",
  "makers.title": "Suppliers", "makers.eyebrow": "SUPPLIERS", "makers.count": "{count} products", "makers.all": "All",
  "makers.products": "Products", "makers.website": "Website",
  "category.special": "Special Material", "category.medical": "Medical", "category.eco": "Eco-Friendly",
  "category.special.desc": "Engineering plastics · films · metals · machinery · thermal", "category.medical.desc": "Medical packaging · syringes · vials · absorbents",
  "category.eco.desc": "Bio resins · biodegradable materials",
  "segment.resin": "Resin", "segment.film": "Film", "segment.metal": "Metal", "segment.machine": "Machine", "segment.thermal": "Thermal Management",
  "segment.absorption": "Absorption Products", "segment.syringe": "Syringe", "segment.vial": "Vial", "segment.packaging": "Special Packaging",
  "segment.bio-resin": "Bio Resin", "segment.biodegradable": "Biodegradable",
  "country.JP": "Japan", "country.CN": "China", "country.TW": "Taiwan", "country.US": "USA", "country.FI": "Finland", "country.KR": "Korea",
  "footer.address": "3F Daekyung Bldg, 17-1 Yangpyeong-ro 12-gil, Yeongdeungpo-gu, Seoul, Korea", "footer.tel": "+82-2-3272-9581~5", "footer.fax": "+82-2-3272-9586",
  "footer.email": "info@dkhc.co.kr", "footer.privacy": "Privacy Policy", "footer.copyright": "© 2026 Daekyung Hichem Co., Ltd. All rights reserved."
}
```
`src/data/i18n/ja.json` — 같은 키, 일본어:
```json
{
  "site.name": "㈱大京ハイケム", "site.tagline": "先端素材をつなぐ、最も信頼できるパートナー",
  "nav.products": "製品", "nav.makers": "サプライヤー", "nav.company": "会社案内", "nav.contact": "お問い合わせ",
  "search.placeholder": "製品名・メーカー・素材で検索", "search.all": "すべての分野", "search.submit": "検索",
  "products.title": "製品", "products.eyebrow": "PRODUCT",
  "products.selectCategory": "分野を選択", "products.selectSegment": "{category}の細分野",
  "products.allSegments": "すべて", "products.results": "{category}の結果 {count}件", "products.resultsAll": "全製品 {count}件",
  "products.empty": "条件に合う製品がありません", "products.emptyHint": "キーワードを変えるか、分野全体をご覧ください。",
  "products.viewDetail": "詳細を見る", "products.requestQuote": "見積依頼", "products.requestDocs": "資料請求",
  "products.principal": "メーカー", "products.sameMaker": "同じメーカーの製品", "products.sameSegment": "同じ分野の製品",
  "products.features": "製品特徴", "products.description": "製品説明", "products.backToList": "一覧へ",
  "makers.title": "サプライヤー", "makers.eyebrow": "SUPPLIERS", "makers.count": "製品 {count}件", "makers.all": "すべて",
  "makers.products": "取扱製品", "makers.website": "ウェブサイト",
  "category.special": "Special Material", "category.medical": "Medical", "category.eco": "Eco-Friendly",
  "category.special.desc": "エンプラ・フィルム・金属・設備・放熱", "category.medical.desc": "医療用包装・シリンジ・バイアル・吸収材",
  "category.eco.desc": "バイオ樹脂・生分解性素材",
  "segment.resin": "Resin", "segment.film": "Film", "segment.metal": "Metal", "segment.machine": "Machine", "segment.thermal": "Thermal Management",
  "segment.absorption": "Absorption Products", "segment.syringe": "Syringe", "segment.vial": "Vial", "segment.packaging": "Special Packaging",
  "segment.bio-resin": "Bio Resin", "segment.biodegradable": "Biodegradable",
  "country.JP": "日本", "country.CN": "中国", "country.TW": "台湾", "country.US": "アメリカ", "country.FI": "フィンランド", "country.KR": "韓国",
  "footer.address": "ソウル特別市永登浦区楊坪路12ギル17-1 大京ビル3F", "footer.tel": "+82-2-3272-9581~5", "footer.fax": "+82-2-3272-9586",
  "footer.email": "info@dkhc.co.kr", "footer.privacy": "個人情報保護方針", "footer.copyright": "© 2026 Daekyung Hichem Co., Ltd. All rights reserved."
}
```

`src/lib/i18n.ts`:
```ts
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
```

- [ ] **Step 4: 카탈로그 순수 함수**

`src/lib/catalog.ts`:
```ts
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
```

- [ ] **Step 5: 데이터 로더**

`src/lib/data.ts`:
```ts
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
```
`tsconfig.json`에 `"resolveJsonModule": true` 가 포함되어 있는지 확인(astro strict 템플릿은 기본 포함).

- [ ] **Step 6: 통과 확인**

Run: `npm test`
Expected: PASS (schema 6 + legacy 3 + catalog 10 + i18n 3).

- [ ] **Step 7: Commit**

```bash
git add src/lib src/data/i18n tests
git commit -m "feat(lib): i18n 헬퍼, 카탈로그 필터/검색 순수 함수, 데이터 로더"
```

---

### Task 5: UI 프리미티브 + 스타일가이드 페이지

**Files:**
- Create: `src/components/ui/Button.astro`, `src/components/ui/Pill.astro`, `src/components/ui/Eyebrow.astro`, `src/components/ui/Container.astro`, `src/pages/[lang]/styleguide.astro`

- [ ] **Step 1: Button**

`src/components/ui/Button.astro`:
```astro
---
type Props = {
  href?: string; variant?: 'primary' | 'secondary' | 'ghost'; size?: 'md' | 'sm';
  type?: 'button' | 'submit'; class?: string; [k: string]: unknown;
};
const { href, variant = 'primary', size = 'md', type = 'button', class: cls = '', ...rest } = Astro.props;
const base = 'inline-flex items-center justify-center gap-2 rounded-pill font-semibold whitespace-nowrap transition-colors duration-200 disabled:opacity-50';
const sizes = { md: 'h-12 px-6 text-[15px]', sm: 'h-10 px-4 text-sm' };
const variants = {
  primary: 'bg-accent text-white hover:bg-accent-hover',
  secondary: 'bg-white text-brand border border-line hover:border-accent hover:text-accent',
  ghost: 'text-accent hover:bg-tint-special',
};
const className = `${base} ${sizes[size]} ${variants[variant]} ${cls}`;
---
{href ? <a href={href} class={className} {...rest}><slot /></a> : <button type={type} class={className} {...rest}><slot /></button>}
```

- [ ] **Step 2: Pill / Eyebrow / Container**

`src/components/ui/Pill.astro`:
```astro
---
type Props = { active?: boolean; count?: number; value: string; class?: string; href?: string };
const { active = false, count, value, class: cls = '', href } = Astro.props;
const dim = count === 0 ? 'opacity-40' : '';
const className = `pill inline-flex h-9 items-center gap-1.5 rounded-pill border px-3.5 text-sm font-medium transition-colors duration-200 ${
  active ? 'border-accent bg-accent text-white' : 'border-line bg-white text-ink-2 hover:border-accent hover:text-accent'} ${dim} ${cls}`;
---
{href
  ? <a href={href} class={className} data-value={value} aria-pressed={active}><slot />{count !== undefined && <span class="text-xs opacity-80">{count}</span>}</a>
  : <button type="button" class={className} data-value={value} aria-pressed={active}><slot />{count !== undefined && <span class="text-xs opacity-80">{count}</span>}</button>}
```

`src/components/ui/Eyebrow.astro`:
```astro
---
const { class: cls = '' } = Astro.props;
---
<span class={`block text-xs font-semibold uppercase tracking-[0.08em] text-ink-3 ${cls}`}><slot /></span>
```

`src/components/ui/Container.astro`:
```astro
---
const { class: cls = '' } = Astro.props;
---
<div class={`mx-auto w-full max-w-site px-4 md:px-6 ${cls}`}><slot /></div>
```

- [ ] **Step 3: 스타일가이드 페이지**

`src/pages/[lang]/styleguide.astro`:
```astro
---
import '../../styles/global.css';
import Button from '../../components/ui/Button.astro';
import Pill from '../../components/ui/Pill.astro';
import Eyebrow from '../../components/ui/Eyebrow.astro';
import Container from '../../components/ui/Container.astro';
export const getStaticPaths = () => ['ko', 'en', 'ja'].map((lang) => ({ params: { lang } }));
const { lang } = Astro.params;
---
<html lang={lang}>
<head>
  <meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Styleguide</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" />
</head>
<body class="py-16">
  <Container class="space-y-12">
    <section><Eyebrow>Typography</Eyebrow>
      <h1 class="text-5xl mt-2">세계가 나아가는 길, 그 속에</h1>
      <h2 class="text-3xl mt-4">Special Material</h2>
      <p class="mt-4 max-w-2xl text-ink-2">(주)대경하이켐은 글로벌 첨단 소재 제조사로부터 우수한 제품을 수입 및 수출하여 고객에게 공급하는 무역상사입니다.</p>
    </section>
    <section><Eyebrow>Colors</Eyebrow>
      <div class="mt-3 grid grid-cols-4 gap-3 md:grid-cols-8">
        {['bg-brand','bg-brand-deep','bg-accent','bg-ink','bg-ink-2','bg-ink-3','bg-line','bg-surface','bg-tint-special','bg-tint-medical','bg-tint-eco'].map((c) =>
          <div class={`h-16 rounded-card ${c} border border-line`} title={c}></div>)}
      </div>
    </section>
    <section><Eyebrow>Buttons</Eyebrow>
      <div class="mt-3 flex flex-wrap gap-3">
        <Button>견적 문의</Button><Button variant="secondary">자료 요청</Button><Button variant="ghost">자세히 보기 ›</Button>
        <Button size="sm">견적 문의</Button><Button size="sm" variant="secondary">자료 요청</Button>
      </div>
    </section>
    <section><Eyebrow>Pills</Eyebrow>
      <div class="mt-3 flex flex-wrap gap-2">
        <Pill value="all" active>전체</Pill><Pill value="resin" count={8}>Resin</Pill><Pill value="film" count={9}>Film</Pill><Pill value="x" count={0}>Thermal</Pill>
      </div>
    </section>
  </Container>
</body>
</html>
```

- [ ] **Step 4: 눈 확인**

Run: `npm run dev` → 브라우저(또는 Playwright)로 `http://localhost:4321/ko/styleguide/` 스크린샷. 기준: 버튼 높이 48px·알약, 폰트 Pretendard 적용, 틴트 3색이 "연하게" 보이는지. 재영 확인 포인트 — 네이비/블루 값은 여기서 조정하고 `global.css` 토큰만 바꾼다.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui src/pages/\[lang\]/styleguide.astro
git commit -m "feat(ui): Button/Pill/Eyebrow/Container + 스타일가이드"
```

---

### Task 6: 레이아웃 + 헤더(검색 콤보) + 푸터

**Files:**
- Create: `src/layouts/Base.astro`, `src/components/Header.astro`, `src/components/SearchCombo.astro`, `src/components/Footer.astro`, `src/components/PageHero.astro`
- Modify: `src/pages/[lang]/index.astro`, `src/pages/[lang]/styleguide.astro` (Base 레이아웃 사용)

- [ ] **Step 1: Base 레이아웃**

`src/layouts/Base.astro`:
```astro
---
import '../styles/global.css';
import Header from '../components/Header.astro';
import Footer from '../components/Footer.astro';
import { isLocale, localizePath, otherLocales, t, type Locale } from '../lib/i18n';
type Props = { title: string; description?: string; path: string /* 로케일 제외 경로, 예 '/products/' */ };
const { title, description = '', path } = Astro.props;
const lang = Astro.params.lang;
if (!isLocale(lang)) throw new Error(`unknown locale ${lang}`);
const locale: Locale = lang;
const canonical = new URL(localizePath(locale, path), Astro.site);
---
<!doctype html>
<html lang={locale}>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{title} | {t(locale, 'site.name')}</title>
  {description && <meta name="description" content={description} />}
  <link rel="canonical" href={canonical} />
  {[locale, ...otherLocales(locale)].map((l) => <link rel="alternate" hreflang={l} href={new URL(localizePath(l, path), Astro.site)} />)}
  <meta property="og:title" content={title} />
  <meta property="og:site_name" content={t(locale, 'site.name')} />
  <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" />
  {locale === 'ja' && <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;600;700&display=swap" />}
</head>
<body class="min-h-dvh flex flex-col">
  <Header locale={locale} path={path} />
  <main class="flex-1"><slot /></main>
  <Footer locale={locale} />
</body>
</html>
```

- [ ] **Step 2: SearchCombo (헤더 상시 검색, IMCD식)**

`src/components/SearchCombo.astro`:
```astro
---
import { t, localizePath, type Locale } from '../lib/i18n';
import { CATEGORIES } from '../lib/schema';
type Props = { locale: Locale; class?: string };
const { locale, class: cls = '' } = Astro.props;
---
<form method="get" action={localizePath(locale, '/products/')} role="search"
  class={`flex h-12 items-center rounded-pill border border-line bg-white pl-2 pr-1 focus-within:border-accent ${cls}`}>
  <select name="cat" aria-label={t(locale, 'search.all')}
    class="h-10 max-w-[11rem] rounded-pill bg-surface px-3 text-sm font-medium text-ink-2 outline-none">
    <option value="">{t(locale, 'search.all')}</option>
    {CATEGORIES.map((c) => <option value={c}>{t(locale, `category.${c}`)}</option>)}
  </select>
  <input name="q" type="search" placeholder={t(locale, 'search.placeholder')} autocomplete="off"
    class="h-10 min-w-0 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-ink-3" />
  <button type="submit" aria-label={t(locale, 'search.submit')}
    class="grid h-10 w-10 place-items-center rounded-pill text-ink-2 hover:bg-surface hover:text-accent">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
  </button>
</form>
```

- [ ] **Step 3: Header**

`src/components/Header.astro`:
```astro
---
import Container from './ui/Container.astro';
import Button from './ui/Button.astro';
import SearchCombo from './SearchCombo.astro';
import { t, localizePath, LOCALES, type Locale } from '../lib/i18n';
type Props = { locale: Locale; path: string };
const { locale, path } = Astro.props;
const nav = [
  { key: 'nav.products', href: '/products/' },
  { key: 'nav.makers', href: '/makers/' },
  { key: 'nav.company', href: '/company/' },
];
const isActive = (href: string) => path.startsWith(href);
const LABEL: Record<Locale, string> = { ko: 'KO', en: 'EN', ja: 'JA' };
---
<header class="sticky top-0 z-40 border-b border-line bg-white/90 backdrop-blur">
  <Container class="flex h-[72px] items-center gap-4">
    <a href={localizePath(locale, '/')} class="shrink-0 text-lg font-bold tracking-tight text-brand">DAEKYUNG HICHEM</a>
    <SearchCombo locale={locale} class="hidden flex-1 md:flex md:max-w-xl" />
    <nav class="ml-auto hidden items-center gap-6 md:flex" aria-label="main">
      {nav.map((n) => <a href={localizePath(locale, n.href)}
        class={`text-[15px] font-medium ${isActive(n.href) ? 'text-accent' : 'text-ink-2 hover:text-accent'}`}>{t(locale, n.key)}</a>)}
    </nav>
    <div class="hidden items-center gap-1 text-xs font-semibold text-ink-3 md:flex" aria-label="language">
      {LOCALES.map((l, i) => <>{i > 0 && <span>/</span>}<a href={localizePath(l, path)} class={l === locale ? 'text-brand' : 'hover:text-accent'} hreflang={l}>{LABEL[l]}</a></>)}
    </div>
    <Button href={localizePath(locale, '/contact/')} size="sm" class="hidden md:inline-flex">{t(locale, 'nav.contact')}</Button>
    <button type="button" class="ml-auto grid h-10 w-10 place-items-center rounded-pill md:hidden" aria-label="menu" data-menu-toggle aria-expanded="false">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
    </button>
  </Container>
  <div class="hidden border-t border-line bg-white md:hidden" data-menu>
    <Container class="space-y-4 py-4">
      <SearchCombo locale={locale} />
      <nav class="flex flex-col gap-3">
        {nav.map((n) => <a href={localizePath(locale, n.href)} class="text-base font-medium text-ink">{t(locale, n.key)}</a>)}
        <a href={localizePath(locale, '/contact/')} class="text-base font-medium text-accent">{t(locale, 'nav.contact')}</a>
      </nav>
      <div class="flex gap-3 text-sm font-semibold text-ink-3">
        {LOCALES.map((l) => <a href={localizePath(l, path)} class={l === locale ? 'text-brand' : ''}>{LABEL[l]}</a>)}
      </div>
    </Container>
  </div>
</header>
<script>
  document.querySelectorAll<HTMLButtonElement>('[data-menu-toggle]').forEach((btn) => {
    const panel = btn.closest('header')!.querySelector<HTMLElement>('[data-menu]')!;
    btn.addEventListener('click', () => {
      const open = panel.classList.toggle('hidden') === false;
      btn.setAttribute('aria-expanded', String(open));
    });
  });
</script>
```

- [ ] **Step 4: Footer + PageHero**

`src/components/Footer.astro`:
```astro
---
import Container from './ui/Container.astro';
import { t, localizePath, type Locale } from '../lib/i18n';
const { locale } = Astro.props as { locale: Locale };
---
<footer class="mt-section-sm bg-brand-deep text-white/80">
  <Container class="grid gap-8 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
    <div>
      <div class="text-lg font-bold text-white">DAEKYUNG HICHEM</div>
      <p class="mt-3 text-sm leading-relaxed">{t(locale, 'footer.address')}</p>
      <p class="mt-2 text-sm">Tel {t(locale, 'footer.tel')} · Fax {t(locale, 'footer.fax')}</p>
      <p class="text-sm"><a class="hover:text-white" href={`mailto:${t(locale, 'footer.email')}`}>{t(locale, 'footer.email')}</a></p>
    </div>
    <nav class="flex flex-col gap-2 text-sm">
      <a class="hover:text-white" href={localizePath(locale, '/products/')}>{t(locale, 'nav.products')}</a>
      <a class="hover:text-white" href={localizePath(locale, '/makers/')}>{t(locale, 'nav.makers')}</a>
      <a class="hover:text-white" href={localizePath(locale, '/company/')}>{t(locale, 'nav.company')}</a>
      <a class="hover:text-white" href={localizePath(locale, '/contact/')}>{t(locale, 'nav.contact')}</a>
    </nav>
    <div class="text-sm md:text-right">
      <a class="hover:text-white" href={localizePath(locale, '/privacy/')}>{t(locale, 'footer.privacy')}</a>
      <p class="mt-6 text-xs text-white/50">{t(locale, 'footer.copyright')}</p>
    </div>
  </Container>
</footer>
```

`src/components/PageHero.astro` (IMCD의 틴트 띠 + 눈썹 + 제목):
```astro
---
import Container from './ui/Container.astro';
import Eyebrow from './ui/Eyebrow.astro';
type Props = { eyebrow: string; title: string; tint?: 'special' | 'medical' | 'eco' | 'neutral' };
const { eyebrow, title, tint = 'neutral' } = Astro.props;
const bg = { special: 'from-tint-special', medical: 'from-tint-medical', eco: 'from-tint-eco', neutral: 'from-surface' }[tint];
---
<section class={`relative overflow-hidden bg-gradient-to-r ${bg} to-white`} data-hero-tint={tint}>
  <div class="pointer-events-none absolute -right-24 -top-32 h-96 w-96 rounded-full bg-white/60 blur-3xl"></div>
  <Container class="relative py-14 md:py-20">
    <Eyebrow>{eyebrow}</Eyebrow>
    <h1 class="mt-2 text-4xl md:text-5xl">{title}</h1>
  </Container>
</section>
```

- [ ] **Step 5: 임시 홈/스타일가이드를 Base로 전환**

`src/pages/[lang]/index.astro`:
```astro
---
import Base from '../../layouts/Base.astro';
import Container from '../../components/ui/Container.astro';
import Button from '../../components/ui/Button.astro';
import { t, localizePath, isLocale } from '../../lib/i18n';
export const getStaticPaths = () => ['ko', 'en', 'ja'].map((lang) => ({ params: { lang } }));
const { lang } = Astro.params; if (!isLocale(lang)) return Astro.redirect('/ko/');
---
<Base title={t(lang, 'site.name')} path="/">
  <Container class="py-section-sm">
    <h1 class="text-4xl">{t(lang, 'site.tagline')}</h1>
    <Button class="mt-8" href={localizePath(lang, '/products/')}>{t(lang, 'nav.products')}</Button>
  </Container>
</Base>
```
스타일가이드도 `<html>…` 직접 작성 대신 `<Base title="Styleguide" path="/styleguide/">` 로 감싼다(내용 동일).

- [ ] **Step 6: 빌드 + 확인**

Run: `npm run build && grep -c 'hreflang' dist/en/index.html`
Expected: 빌드 성공, hreflang 3개. `npm run preview` 로 `/ko/` 열어 헤더 검색 콤보·언어 전환(`/en/`)·모바일(375px) 햄버거 동작 확인.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(layout): Base 레이아웃, 헤더(검색 콤보·언어), 푸터, PageHero"
```

---

### Task 7: 제품 목록 페이지 (IMCD식: 분야 타일 → 세부 pill → 리스트 카드 + 검색 + URL 상태)

**Files:**
- Create: `src/components/CategoryTiles.astro`, `src/components/SegmentPills.astro`, `src/components/ProductListCard.astro`, `src/components/islands/catalog.ts`, `src/pages/[lang]/products/index.astro`

설계: 서버가 **모든 제품 카드를 HTML로 렌더**(SEO)하고, 각 카드에 `data-id`를 붙인다. 클라이언트 스크립트는 인라인 JSON(`catalogItems`)으로 `filterProducts`를 돌려 카드를 `hidden` 토글 + pill 개수 갱신 + URL 동기화만 한다. JS 꺼져도 전체 목록은 보인다.

- [ ] **Step 1: CategoryTiles**

`src/components/CategoryTiles.astro`:
```astro
---
import { t, type Locale } from '../lib/i18n';
import { CATEGORIES, type Category } from '../lib/schema';
type Props = { locale: Locale; counts: Record<Category, number>; active?: Category; hrefFor?: (c: Category) => string };
const { locale, counts, active, hrefFor } = Astro.props;
const art: Record<Category, string> = {
  special: 'from-[#9cc7ff] via-[#dbe9ff] to-[#f3f7ff]',
  medical: 'from-[#8fe0c0] via-[#d7f5ea] to-[#f2fbf7]',
  eco: 'from-[#c2e08a] via-[#e9f4d2] to-[#f7fbef]',
};
---
<div class="grid grid-cols-1 gap-3 sm:grid-cols-3" data-category-tiles>
  {CATEGORIES.map((c) => {
    const Tag = hrefFor ? 'a' : 'button';
    return <Tag {...(hrefFor ? { href: hrefFor(c) } : { type: 'button' })} data-category={c} aria-pressed={active === c}
      class={`group relative h-28 overflow-hidden rounded-card border-2 text-left transition-colors duration-200 ${active === c ? 'border-accent' : 'border-transparent hover:border-line'}`}>
      <div class={`absolute inset-0 bg-gradient-to-br ${art[c]}`}></div>
      <div class="absolute -right-6 -bottom-10 h-28 w-28 rounded-full bg-white/50 blur-2xl"></div>
      <div class="relative flex h-full flex-col justify-end p-4">
        <span class="text-base font-semibold text-brand">{t(locale, `category.${c}`)}</span>
        <span class="text-xs text-ink-2">{t(locale, `category.${c}.desc`)}</span>
      </div>
      <span data-count class="absolute right-3 top-3 rounded-pill bg-white/80 px-2 py-0.5 text-xs font-semibold text-brand">{counts[c]}</span>
      <span data-check class={`absolute left-3 top-3 grid h-6 w-6 place-items-center rounded-full bg-accent text-white ${active === c ? '' : 'hidden'}`}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5L20 7"/></svg>
      </span>
    </Tag>;
  })}
</div>
```

- [ ] **Step 2: SegmentPills**

`src/components/SegmentPills.astro`:
```astro
---
import Pill from './ui/Pill.astro';
import { t, type Locale } from '../lib/i18n';
import { CATEGORIES, segmentsOf } from '../lib/schema';
type Props = { locale: Locale; counts: Record<string, Record<string, number>> /* cat → seg → n */ };
const { locale, counts } = Astro.props;
---
<div data-segment-rows>
  {CATEGORIES.map((c) => (
    <div data-segments-for={c} class="hidden flex-wrap gap-2 [&:not(.hidden)]:flex">
      <p class="w-full text-sm font-medium text-ink-2">{t(locale, 'products.selectSegment', { category: t(locale, `category.${c}`) })}</p>
      <Pill value="" active>{t(locale, 'products.allSegments')}</Pill>
      {segmentsOf(c).map((s) => <Pill value={s} count={counts[c][s]}>{t(locale, `segment.${s}`)}</Pill>)}
    </div>
  ))}
</div>
```

- [ ] **Step 3: ProductListCard (IMCD 풀폭 가로 카드)**

`src/components/ProductListCard.astro`:
```astro
---
import { Image } from 'astro:assets';
import Button from './ui/Button.astro';
import Eyebrow from './ui/Eyebrow.astro';
import { t, localizePath, pick, type Locale } from '../lib/i18n';
import type { Product, Maker } from '../lib/schema';
type Props = { locale: Locale; product: Product; maker: Maker };
const { locale, product: p, maker } = Astro.props;
const href = localizePath(locale, `/products/${p.id}/`);
const logos = import.meta.glob<{ default: ImageMetadata }>('../assets/makers/*', { eager: true });
const logo = maker.logo ? logos[`../assets/makers/${maker.logo}`]?.default : undefined;
const quoteHref = localizePath(locale, `/contact/?product=${encodeURIComponent(p.name.ko)}`);
---
<article class="group relative rounded-card border border-line bg-white p-5 transition-shadow duration-200 hover:shadow-card md:p-6"
  data-product-card data-id={p.id}>
  <div class="grid gap-4 md:grid-cols-[1fr_150px]">
    <div>
      <Eyebrow>{t(locale, `category.${p.category}`)} · {p.segments.map((s) => t(locale, `segment.${s}`)).join(' · ')}</Eyebrow>
      <h3 class="mt-1 text-xl"><a href={href} class="after:absolute after:inset-0">{pick(p.name, locale)}</a></h3>
      <p class="mt-2 line-clamp-2 text-[15px] text-ink-2">{pick(p.summary, locale) || pick(p.body, locale)}</p>
    </div>
    <div class="flex flex-row items-center gap-3 border-line md:flex-col md:justify-center md:border-l md:pl-5">
      {logo ? <Image src={logo} alt={maker.name} height={40} class="h-10 w-auto max-w-[120px] object-contain" /> : <span class="text-sm font-semibold text-brand">{maker.name}</span>}
      <span class="text-xs text-ink-3">{t(locale, 'products.principal')} · <b class="font-semibold text-ink-2">{maker.name}</b></span>
    </div>
  </div>
  <div class="relative z-10 mt-4 flex flex-wrap gap-2">
    <Button size="sm" variant="secondary" href={quoteHref}>{t(locale, 'products.requestDocs')}</Button>
    <Button size="sm" href={quoteHref}>{t(locale, 'products.requestQuote')}</Button>
    <a href={href} class="ml-auto self-center text-sm font-semibold text-accent">{t(locale, 'products.viewDetail')} ›</a>
  </div>
</article>
```

- [ ] **Step 4: 클라이언트 스크립트**

`src/components/islands/catalog.ts`:
```ts
import { filterProducts, countBySegment, countByCategory, parseQuery, serializeQuery, type CatalogItem, type Query } from '../../lib/catalog';
import { CATEGORIES, type Category } from '../../lib/schema';

export function initCatalog(root: HTMLElement) {
  const items: CatalogItem[] = JSON.parse(root.querySelector('#catalog-data')!.textContent!);
  const labels = JSON.parse(root.dataset.labels!) as { results: string; resultsAll: string; category: Record<string, string> };
  const tiles = root.querySelectorAll<HTMLElement>('[data-category]');
  const rows = root.querySelectorAll<HTMLElement>('[data-segments-for]');
  const cards = root.querySelectorAll<HTMLElement>('[data-product-card]');
  const searches = [...root.querySelectorAll<HTMLInputElement>('[data-search]')]; // 데스크톱·모바일 2개, 값 동기화
  const result = root.querySelector<HTMLElement>('[data-result-count]')!;
  const empty = root.querySelector<HTMLElement>('[data-empty]')!;
  const clearBtn = root.querySelector<HTMLButtonElement>('[data-clear]');

  let q: Query = parseQuery(location.search);
  if (!q.cat) q.cat = (root.dataset.defaultCat as Category) || undefined; // 처음 진입: 기본 분야 없음 = 전체

  function render(push = true) {
    const visible = new Set(filterProducts(items, q).map((i) => i.id));
    cards.forEach((c) => c.classList.toggle('hidden', !visible.has(c.dataset.id!)));
    // 타일
    tiles.forEach((tl) => {
      const on = tl.dataset.category === q.cat;
      tl.setAttribute('aria-pressed', String(on));
      tl.classList.toggle('border-accent', on); tl.classList.toggle('border-transparent', !on);
      tl.querySelector('[data-check]')?.classList.toggle('hidden', !on);
    });
    // 세부 pill 행 + 개수 (검색어/메이커 반영한 개수)
    const scoped = filterProducts(items, { q: q.q, maker: q.maker });
    rows.forEach((row) => {
      const cat = row.dataset.segmentsFor as Category;
      row.classList.toggle('hidden', cat !== q.cat);
      const counts = countBySegment(scoped, cat);
      row.querySelectorAll<HTMLElement>('.pill').forEach((pill) => {
        const v = pill.dataset.value!;
        const on = (v || undefined) === q.seg;
        pill.setAttribute('aria-pressed', String(on));
        pill.classList.toggle('border-accent', on); pill.classList.toggle('bg-accent', on); pill.classList.toggle('text-white', on);
        pill.classList.toggle('border-line', !on); pill.classList.toggle('bg-white', !on); pill.classList.toggle('text-ink-2', !on);
        const n = v ? counts[v] : scoped.filter((i) => i.category === cat).length;
        const span = pill.querySelector('span'); if (span) span.textContent = String(n);
        pill.classList.toggle('opacity-40', n === 0);
      });
    });
    const catCounts = countByCategory(scoped);
    tiles.forEach((tl) => { const el = tl.querySelector('[data-count]'); if (el) el.textContent = String(catCounts[tl.dataset.category as Category]); });
    // 결과 문구
    result.textContent = q.cat
      ? labels.results.replace('{category}', labels.category[q.cat]).replace('{count}', String(visible.size))
      : labels.resultsAll.replace('{count}', String(visible.size));
    empty.classList.toggle('hidden', visible.size > 0);
    if (clearBtn) clearBtn.classList.toggle('hidden', !q.cat && !q.seg && !q.q && !q.maker);
    if (push) history.replaceState(null, '', location.pathname + serializeQuery(q));
  }

  tiles.forEach((tl) => tl.addEventListener('click', (e) => {
    e.preventDefault();
    const c = tl.dataset.category as Category;
    q = { ...q, cat: q.cat === c ? undefined : c, seg: undefined };
    render();
  }));
  rows.forEach((row) => row.addEventListener('click', (e) => {
    const pill = (e.target as HTMLElement).closest<HTMLElement>('.pill'); if (!pill) return;
    q = { ...q, seg: (pill.dataset.value || undefined) as Query['seg'] };
    render();
  }));
  let timer: number | undefined;
  const setSearch = (v: string) => searches.forEach((s) => { if (s.value !== v) s.value = v; });
  setSearch(q.q ?? '');
  searches.forEach((s) => s.addEventListener('input', () => {
    setSearch(s.value);
    clearTimeout(timer);
    timer = window.setTimeout(() => { q = { ...q, q: s.value.trim() || undefined }; render(); }, 120);
  }));
  clearBtn?.addEventListener('click', () => { q = {}; setSearch(''); render(); });
  window.addEventListener('popstate', () => { q = parseQuery(location.search); setSearch(q.q ?? ''); render(false); });
  render(false);
}
```

- [ ] **Step 5: 페이지**

`src/pages/[lang]/products/index.astro`:
```astro
---
import Base from '../../../layouts/Base.astro';
import Container from '../../../components/ui/Container.astro';
import PageHero from '../../../components/PageHero.astro';
import CategoryTiles from '../../../components/CategoryTiles.astro';
import SegmentPills from '../../../components/SegmentPills.astro';
import ProductListCard from '../../../components/ProductListCard.astro';
import Button from '../../../components/ui/Button.astro';
import { t, isLocale, localizePath } from '../../../lib/i18n';
import { products, getMaker, catalogItems } from '../../../lib/data';
import { countByCategory, countBySegment } from '../../../lib/catalog';
import { CATEGORIES } from '../../../lib/schema';
export const getStaticPaths = () => ['ko', 'en', 'ja'].map((lang) => ({ params: { lang } }));
const { lang } = Astro.params; if (!isLocale(lang)) return Astro.redirect('/ko/');
const catCounts = countByCategory(catalogItems);
const segCounts = Object.fromEntries(CATEGORIES.map((c) => [c, countBySegment(catalogItems, c)]));
const labels = { results: t(lang, 'products.results'), resultsAll: t(lang, 'products.resultsAll'),
  category: Object.fromEntries(CATEGORIES.map((c) => [c, t(lang, `category.${c}`)])) };
---
<Base title={t(lang, 'products.title')} description={t(lang, 'site.tagline')} path="/products/">
  <PageHero eyebrow={t(lang, 'products.eyebrow')} title={t(lang, 'products.title')} tint="special" />
  <Container class="py-10 md:py-14" data-catalog data-labels={JSON.stringify(labels)}>
    <script type="application/json" id="catalog-data" set:html={JSON.stringify(catalogItems)} />

    <div class="mb-6 md:hidden">
      <label class="flex h-12 items-center gap-2 rounded-pill border border-line px-4 focus-within:border-accent">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
        <input data-search type="search" placeholder={t(lang, 'search.placeholder')} class="min-w-0 flex-1 bg-transparent text-sm outline-none" />
      </label>
    </div>

    <h2 class="text-base font-semibold text-brand">{t(lang, 'products.selectCategory')}</h2>
    <div class="mt-3"><CategoryTiles locale={lang} counts={catCounts} /></div>

    <div class="mt-8"><SegmentPills locale={lang} counts={segCounts} /></div>

    <div class="mt-10 flex items-center justify-between gap-4 border-b border-line pb-4">
      <p class="text-lg font-semibold text-brand" data-result-count></p>
      <div class="hidden items-center gap-3 md:flex">
        <input data-search type="search" placeholder={t(lang, 'search.placeholder')}
          class="h-10 w-72 rounded-pill border border-line px-4 text-sm outline-none focus:border-accent" />
        <button type="button" data-clear class="hidden text-sm font-medium text-ink-3 hover:text-accent">✕ reset</button>
      </div>
    </div>

    <div class="mt-6 flex flex-col gap-4" data-product-list>
      {products.map((p) => <ProductListCard locale={lang} product={p} maker={getMaker(p.makerId)!} />)}
    </div>

    <div data-empty class="hidden rounded-card border border-dashed border-line p-12 text-center">
      <p class="text-lg font-semibold text-brand">{t(lang, 'products.empty')}</p>
      <p class="mt-2 text-sm text-ink-2">{t(lang, 'products.emptyHint')}</p>
      <Button class="mt-6" variant="secondary" href={localizePath(lang, '/contact/')}>{t(lang, 'nav.contact')}</Button>
    </div>
  </Container>
</Base>
<script>
  import { initCatalog } from '../../../components/islands/catalog';
  document.querySelectorAll<HTMLElement>('[data-catalog]').forEach(initCatalog);
</script>
```
- [ ] **Step 6: 빌드 + 동작 확인**

Run: `npm run build && npm run preview`
확인 체크리스트(Playwright 또는 수동, 1280px·375px):
- `/ko/products/` 처음: 타일 3개 선택 없음, 전체 N개, 카드 전부 표시
- Special 타일 클릭 → 체크 배지 + pill 행 교체 + URL `?cat=special` + 결과 문구
- Film pill 클릭 → 카드 필터 + `?cat=special&seg=film`
- 검색 "denka" → 즉시 필터, pill 개수 갱신
- `/en/products/?cat=medical&q=syringe` 직접 진입 → 상태 복원
- 뒤로가기 → 이전 상태
- JS 끈 상태(DevTools) → 전체 카드가 그대로 보임

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(products): IMCD식 제품 탐색 — 분야 타일, 세부 pill, 검색, URL 동기화, 리스트 카드"
```

---

### Task 8: 제품 상세 페이지

**Files:**
- Create: `src/pages/[lang]/products/[id].astro`

- [ ] **Step 1: 페이지**

```astro
---
import { Image } from 'astro:assets';
import Base from '../../../layouts/Base.astro';
import Container from '../../../components/ui/Container.astro';
import Button from '../../../components/ui/Button.astro';
import Eyebrow from '../../../components/ui/Eyebrow.astro';
import ProductListCard from '../../../components/ProductListCard.astro';
import { t, isLocale, localizePath, pick, pickList, LOCALES } from '../../../lib/i18n';
import { products, getMaker, productsByMaker } from '../../../lib/data';

export function getStaticPaths() {
  return LOCALES.flatMap((lang) => products.map((p) => ({ params: { lang, id: p.id }, props: { product: p } })));
}
const { lang } = Astro.params; if (!isLocale(lang)) return Astro.redirect('/ko/');
const { product: p } = Astro.props;
const maker = getMaker(p.makerId)!;
const logos = import.meta.glob<{ default: ImageMetadata }>('../../../assets/makers/*', { eager: true });
const imgs = import.meta.glob<{ default: ImageMetadata }>('../../../assets/products/*', { eager: true });
const logo = maker.logo ? logos[`../../../assets/makers/${maker.logo}`]?.default : undefined;
const hero = p.image ? imgs[`../../../assets/products/${p.image}`]?.default : undefined;
const gallery = p.images.map((f) => imgs[`../../../assets/products/${f}`]?.default).filter(Boolean);
const sameMaker = productsByMaker(p.makerId).filter((x) => x.id !== p.id).slice(0, 3);
const sameSeg = products.filter((x) => x.id !== p.id && x.makerId !== p.makerId && x.segments.some((s) => p.segments.includes(s))).slice(0, 3);
const quoteHref = localizePath(lang, `/contact/?product=${encodeURIComponent(p.name.ko)}`);
const features = pickList(p.features, lang);
---
<Base title={pick(p.name, lang)} description={pick(p.summary, lang)} path={`/products/${p.id}/`}>
  <Container class="py-10 md:py-14">
    <a href={localizePath(lang, `/products/?cat=${p.category}`)} class="text-sm font-medium text-ink-3 hover:text-accent">‹ {t(lang, 'products.backToList')}</a>
    <div class="mt-4 grid gap-10 lg:grid-cols-[1fr_320px]">
      <article>
        <Eyebrow>{t(lang, `category.${p.category}`)} · {p.segments.map((s) => t(lang, `segment.${s}`)).join(' · ')}</Eyebrow>
        <h1 class="mt-2 text-4xl">{pick(p.name, lang)}</h1>
        {hero && <Image src={hero} alt={pick(p.name, lang)} width={960} class="mt-8 w-full rounded-card border border-line object-contain" />}
        <section class="mt-10">
          <h2 class="text-xl">{t(lang, 'products.description')}</h2>
          <p class="mt-3 whitespace-pre-line text-[17px] leading-relaxed text-ink-2">{pick(p.body, lang)}</p>
        </section>
        {features.length > 0 && <section class="mt-10">
          <h2 class="text-xl">{t(lang, 'products.features')}</h2>
          <ul class="mt-4 grid gap-3 sm:grid-cols-2">
            {features.map((f) => <li class="flex gap-3 rounded-card bg-surface p-4 text-[15px] text-ink"><span class="mt-1 h-2 w-2 shrink-0 rounded-full bg-accent"></span>{f}</li>)}
          </ul>
        </section>}
        {gallery.length > 0 && <section class="mt-10 grid grid-cols-2 gap-3 md:grid-cols-4">
          {gallery.map((g) => <Image src={g!} alt="" width={400} class="aspect-square w-full rounded-card border border-line object-cover" />)}
        </section>}
      </article>

      <aside class="h-fit rounded-card border border-line bg-white p-6 lg:sticky lg:top-24">
        <Eyebrow>{t(lang, 'products.principal')}</Eyebrow>
        <a href={localizePath(lang, `/makers/${maker.id}/`)} class="mt-3 block">
          {logo ? <Image src={logo} alt={maker.name} height={44} class="h-11 w-auto max-w-[180px] object-contain" /> : null}
          <span class="mt-2 block text-lg font-semibold text-brand">{maker.name}</span>
          {maker.country && <span class="text-sm text-ink-3">{t(lang, `country.${maker.country}`)}</span>}
        </a>
        <div class="mt-6 flex flex-col gap-2">
          <Button href={quoteHref}>{t(lang, 'products.requestQuote')}</Button>
          <Button href={quoteHref} variant="secondary">{t(lang, 'products.requestDocs')}</Button>
          {p.datasheetUrl && <Button href={p.datasheetUrl} variant="ghost" target="_blank" rel="noopener">Datasheet ↗</Button>}
        </div>
      </aside>
    </div>

    {sameMaker.length > 0 && <section class="mt-16">
      <h2 class="text-2xl">{t(lang, 'products.sameMaker')}</h2>
      <div class="mt-5 flex flex-col gap-4">{sameMaker.map((x) => <ProductListCard locale={lang} product={x} maker={maker} />)}</div>
    </section>}
    {sameSeg.length > 0 && <section class="mt-16">
      <h2 class="text-2xl">{t(lang, 'products.sameSegment')}</h2>
      <div class="mt-5 flex flex-col gap-4">{sameSeg.map((x) => <ProductListCard locale={lang} product={x} maker={getMaker(x.makerId)!} />)}</div>
    </section>}
  </Container>
</Base>
```

- [ ] **Step 2: 빌드 + 확인**

Run: `npm run build && ls dist/ko/products | head`
Expected: 제품 id별 폴더 생성(3언어). `/ja/products/kuraray-plastics-earneston/` 열어 일본어 본문·우측 고정 박스·같은 공급사 제품 확인. 이미지 없는 제품은 이미지 영역 없이 깨지지 않아야 함.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(products): 제품 상세 — 본문/특징/갤러리, 공급사 고정 박스, 연관 제품"
```

---

### Task 9: 공급사 목록(분야 타일 + A–Z) + 상세

**Files:**
- Create: `src/components/MakerCard.astro`, `src/components/AlphaIndex.astro`, `src/components/islands/makers.ts`, `src/pages/[lang]/makers/index.astro`, `src/pages/[lang]/makers/[id].astro`
- Create test: `tests/makers.test.ts`

- [ ] **Step 1: A–Z 필터 순수 함수 테스트** (`src/lib/catalog.ts`에 추가)

`tests/makers.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { filterMakers, initialOf } from '../src/lib/catalog';

const makers = [
  { id: 'denka', name: 'Denka', categories: ['special', 'medical'] },
  { id: 'upm', name: 'UPM', categories: ['eco'] },
  { id: 'kuraray', name: 'KURARAY', categories: ['special'] },
  { id: 'x', name: '(주)기타', categories: ['special'] },
];
describe('makers', () => {
  it('initialOf', () => { expect(initialOf('Denka')).toBe('D'); expect(initialOf('(주)기타')).toBe('#'); });
  it('filters by category and letter', () => {
    expect(filterMakers(makers, { cat: 'special' }).map((m) => m.id)).toEqual(['denka', 'kuraray', 'x']);
    expect(filterMakers(makers, { letter: 'K' }).map((m) => m.id)).toEqual(['kuraray']);
    expect(filterMakers(makers, { cat: 'eco', letter: 'U' }).map((m) => m.id)).toEqual(['upm']);
  });
});
```
`src/lib/catalog.ts`에 추가:
```ts
export type MakerItem = { id: string; name: string; categories: string[] };
export const initialOf = (name: string) => { const c = name.trim().charAt(0).toUpperCase(); return /[A-Z]/.test(c) ? c : '#'; };
export function filterMakers<T extends MakerItem>(items: T[], f: { cat?: string; letter?: string }): T[] {
  return items.filter((m) => (!f.cat || m.categories.includes(f.cat)) && (!f.letter || initialOf(m.name) === f.letter));
}
```
Run: `npm test -- makers` → PASS.

- [ ] **Step 2: MakerCard + AlphaIndex**

`src/components/MakerCard.astro`:
```astro
---
import { Image } from 'astro:assets';
import { t, localizePath, type Locale } from '../lib/i18n';
import type { Maker } from '../lib/schema';
type Props = { locale: Locale; maker: Maker; count: number; categories: string[] };
const { locale, maker, count, categories } = Astro.props;
const logos = import.meta.glob<{ default: ImageMetadata }>('../assets/makers/*', { eager: true });
const logo = maker.logo ? logos[`../assets/makers/${maker.logo}`]?.default : undefined;
---
<a href={localizePath(locale, `/makers/${maker.id}/`)} data-maker-card data-id={maker.id} data-name={maker.name} data-categories={categories.join(',')}
  class="group flex flex-col overflow-hidden rounded-card border border-line bg-white transition-shadow duration-200 hover:shadow-card">
  <div class="grid h-32 place-items-center bg-surface p-6">
    {logo ? <Image src={logo} alt={maker.name} height={48} class="max-h-12 w-auto max-w-[70%] object-contain" /> : <span class="text-xl font-bold text-brand">{maker.name}</span>}
  </div>
  <div class="flex items-center justify-between p-4">
    <div>
      <div class="font-semibold text-brand">{maker.name}</div>
      <div class="text-sm text-ink-3">{t(locale, 'makers.count', { count })}{maker.country && ` · ${t(locale, `country.${maker.country}`)}`}</div>
    </div>
    <span class="text-ink-3 transition-colors group-hover:text-accent">›</span>
  </div>
</a>
```

`src/components/AlphaIndex.astro`:
```astro
---
type Props = { available: Set<string>; allLabel: string };
const { available, allLabel } = Astro.props;
const letters = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '#'];
---
<div class="flex flex-wrap gap-1 border-b border-line pb-3 text-sm font-semibold" data-alpha-index>
  <button type="button" data-letter="" aria-pressed="true" class="alpha px-2 py-1 text-accent underline underline-offset-4">{allLabel}</button>
  {letters.map((L) => <button type="button" data-letter={L} aria-pressed="false" disabled={!available.has(L)}
    class="alpha px-2 py-1 text-ink-2 hover:text-accent disabled:text-ink-3/40 disabled:hover:text-ink-3/40">{L}</button>)}
</div>
```

- [ ] **Step 3: 클라이언트 스크립트**

`src/components/islands/makers.ts`:
```ts
import { filterMakers, initialOf, type MakerItem } from '../../lib/catalog';
export function initMakers(root: HTMLElement) {
  const cards = [...root.querySelectorAll<HTMLElement>('[data-maker-card]')];
  const items: (MakerItem & { el: HTMLElement })[] = cards.map((el) => ({ el, id: el.dataset.id!, name: el.dataset.name!, categories: el.dataset.categories!.split(',').filter(Boolean) }));
  const tiles = root.querySelectorAll<HTMLElement>('[data-category]');
  const alphas = root.querySelectorAll<HTMLButtonElement>('.alpha');
  let cat: string | undefined = new URLSearchParams(location.search).get('cat') || undefined;
  let letter: string | undefined;
  function render() {
    const vis = new Set(filterMakers(items, { cat, letter }).map((m) => m.id));
    items.forEach((m) => m.el.classList.toggle('hidden', !vis.has(m.id)));
    tiles.forEach((tl) => { const on = tl.dataset.category === cat; tl.setAttribute('aria-pressed', String(on));
      tl.classList.toggle('border-accent', on); tl.classList.toggle('border-transparent', !on); tl.querySelector('[data-check]')?.classList.toggle('hidden', !on); });
    const avail = new Set(filterMakers(items, { cat }).map((m) => initialOf(m.name)));
    alphas.forEach((a) => { const L = a.dataset.letter!; const on = (L || undefined) === letter;
      a.disabled = !!L && !avail.has(L); a.setAttribute('aria-pressed', String(on));
      a.classList.toggle('text-accent', on); a.classList.toggle('underline', on); });
    history.replaceState(null, '', location.pathname + (cat ? `?cat=${cat}` : ''));
  }
  tiles.forEach((tl) => tl.addEventListener('click', (e) => { e.preventDefault(); const c = tl.dataset.category!; cat = cat === c ? undefined : c; letter = undefined; render(); }));
  alphas.forEach((a) => a.addEventListener('click', () => { letter = a.dataset.letter || undefined; render(); }));
  render();
}
```

- [ ] **Step 4: 목록 페이지**

`src/pages/[lang]/makers/index.astro`:
```astro
---
import Base from '../../../layouts/Base.astro';
import Container from '../../../components/ui/Container.astro';
import PageHero from '../../../components/PageHero.astro';
import CategoryTiles from '../../../components/CategoryTiles.astro';
import AlphaIndex from '../../../components/AlphaIndex.astro';
import MakerCard from '../../../components/MakerCard.astro';
import { t, isLocale } from '../../../lib/i18n';
import { makersWithProducts, productsByMaker, catalogItems } from '../../../lib/data';
import { countByCategory, initialOf } from '../../../lib/catalog';
export const getStaticPaths = () => ['ko', 'en', 'ja'].map((lang) => ({ params: { lang } }));
const { lang } = Astro.params; if (!isLocale(lang)) return Astro.redirect('/ko/');
const list = makersWithProducts().map((m) => {
  const ps = productsByMaker(m.id);
  return { maker: m, count: ps.length, categories: [...new Set(ps.map((p) => p.category))] };
}).sort((a, b) => a.maker.name.localeCompare(b.maker.name, 'en'));
const available = new Set(list.map((x) => initialOf(x.maker.name)));
---
<Base title={t(lang, 'makers.title')} path="/makers/">
  <PageHero eyebrow={t(lang, 'makers.eyebrow')} title={t(lang, 'makers.title')} tint="medical" />
  <Container class="py-10 md:py-14" data-makers>
    <h2 class="text-base font-semibold text-brand">{t(lang, 'products.selectCategory')}</h2>
    <div class="mt-3"><CategoryTiles locale={lang} counts={countByCategory(catalogItems)} /></div>
    <div class="mt-8"><AlphaIndex available={available} allLabel={t(lang, 'makers.all')} /></div>
    <div class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {list.map((x) => <MakerCard locale={lang} maker={x.maker} count={x.count} categories={x.categories} />)}
    </div>
  </Container>
</Base>
<script>
  import { initMakers } from '../../../components/islands/makers';
  document.querySelectorAll<HTMLElement>('[data-makers]').forEach(initMakers);
</script>
```
`CategoryTiles`의 `data-count`는 메이커 페이지에서는 제품 수를 보여준다 — 그대로 둔다(IMCD도 동일 타일 재사용).

- [ ] **Step 5: 상세 페이지**

`src/pages/[lang]/makers/[id].astro`:
```astro
---
import { Image } from 'astro:assets';
import Base from '../../../layouts/Base.astro';
import Container from '../../../components/ui/Container.astro';
import Eyebrow from '../../../components/ui/Eyebrow.astro';
import Button from '../../../components/ui/Button.astro';
import ProductListCard from '../../../components/ProductListCard.astro';
import { t, isLocale, localizePath, pick, LOCALES } from '../../../lib/i18n';
import { makersWithProducts, productsByMaker } from '../../../lib/data';
export function getStaticPaths() {
  return LOCALES.flatMap((lang) => makersWithProducts().map((m) => ({ params: { lang, id: m.id }, props: { maker: m } })));
}
const { lang } = Astro.params; if (!isLocale(lang)) return Astro.redirect('/ko/');
const { maker } = Astro.props;
const ps = productsByMaker(maker.id);
const logos = import.meta.glob<{ default: ImageMetadata }>('../../../assets/makers/*', { eager: true });
const logo = maker.logo ? logos[`../../../assets/makers/${maker.logo}`]?.default : undefined;
---
<Base title={maker.name} description={pick(maker.desc, lang)} path={`/makers/${maker.id}/`}>
  <Container class="py-10 md:py-14">
    <a href={localizePath(lang, '/makers/')} class="text-sm font-medium text-ink-3 hover:text-accent">‹ {t(lang, 'makers.title')}</a>
    <header class="mt-4 flex flex-col gap-6 rounded-card border border-line p-6 md:flex-row md:items-center md:p-8">
      <div class="grid h-24 w-48 shrink-0 place-items-center rounded-card bg-surface p-4">
        {logo ? <Image src={logo} alt={maker.name} height={56} class="max-h-14 w-auto object-contain" /> : <span class="text-xl font-bold text-brand">{maker.name}</span>}
      </div>
      <div class="min-w-0">
        <Eyebrow>{t(lang, 'products.principal')}{maker.country && ` · ${t(lang, `country.${maker.country}`)}`}</Eyebrow>
        <h1 class="mt-1 text-3xl">{maker.name}</h1>
        {pick(maker.desc, lang) && <p class="mt-3 whitespace-pre-line text-[15px] text-ink-2">{pick(maker.desc, lang)}</p>}
        {maker.url && <Button href={maker.url} variant="ghost" size="sm" class="mt-3" target="_blank" rel="noopener">{t(lang, 'makers.website')} ↗</Button>}
      </div>
    </header>
    <section class="mt-12">
      <h2 class="text-2xl">{t(lang, 'makers.products')} <span class="text-ink-3">{ps.length}</span></h2>
      <div class="mt-5 flex flex-col gap-4">{ps.map((p) => <ProductListCard locale={lang} product={p} maker={maker} />)}</div>
    </section>
  </Container>
</Base>
```

- [ ] **Step 6: 빌드 + 확인**

Run: `npm run build && npm run preview`
확인: `/ko/makers/` 타일 클릭 → 카드 필터 + A–Z 사용 가능 글자 갱신; `D` 클릭 → Denka/Daicel만; `/en/makers/denka/` → 제품 리스트 카드들이 film/thermal/absorption 등 여러 세부 분야 섞여 보임.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(makers): 공급사 목록(분야 타일 + A–Z) 및 상세"
```

---

### Task 10: Google Sheet 연동 — 시트 템플릿, fetch 스크립트, 검증

**Files:**
- Create: `scripts/fetch-sheet.ts`, `scripts/export-sheet-seed.ts`, `docs/ops/sheet-setup.md`, `tests/sheet-rows.test.ts`, `scripts/lib/sheet-rows.ts`
- Modify: `package.json` (scripts)

시트 → JSON 매핑 규칙: 탭 `products` 의 칼럼은 `id, category, segments, maker_id, name_ko, name_en, name_ja, summary_ko…, body_ko…, features_ko…, image, images, datasheet_url, order, published`. `segments`/`images`는 쉼표 구분, `features_*`는 줄바꿈 구분, `published`는 `TRUE/FALSE`(체크박스). 탭 `makers`: `id, name, country, logo, url, desc_ko, desc_en, desc_ja, order, published`. 탭 `history`: `year, text_ko, text_en, text_ja`.

- [ ] **Step 1: 행 변환 함수 테스트**

`tests/sheet-rows.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { rowToProduct, rowToMaker, rowToHistory, productToRow } from '../scripts/lib/sheet-rows';

describe('sheet rows', () => {
  it('converts a product row', () => {
    const p = rowToProduct({ id: 'denka-film', category: 'special', segments: 'film, thermal', maker_id: 'denka',
      name_ko: '덴카 필름', name_en: '', name_ja: '', summary_ko: '요약', summary_en: '', summary_ja: '',
      body_ko: '본문', body_en: '', body_ja: '', features_ko: '내열\n절연', features_en: '', features_ja: '',
      image: 'a.jpg', images: 'b.jpg, c.jpg', datasheet_url: '', order: '3', published: 'TRUE' });
    expect(p.segments).toEqual(['film', 'thermal']);
    expect(p.features.ko).toEqual(['내열', '절연']);
    expect(p.images).toEqual(['b.jpg', 'c.jpg']);
    expect(p.order).toBe(3);
    expect(p.published).toBe(true);
  });
  it('treats FALSE/blank published correctly', () => {
    expect(rowToProduct({ id: 'x', category: 'eco', segments: 'bio-resin', maker_id: 'm', name_ko: 'n', published: 'FALSE' } as any).published).toBe(false);
    expect(rowToProduct({ id: 'x', category: 'eco', segments: 'bio-resin', maker_id: 'm', name_ko: 'n', published: '' } as any).published).toBe(true);
  });
  it('maker + history', () => {
    expect(rowToMaker({ id: 'upm', name: 'UPM', country: 'FI', logo: 'upm.png', url: '', desc_ko: '', desc_en: '', desc_ja: '', order: '', published: 'TRUE' }).order).toBe(999);
    expect(rowToHistory({ year: '1990', text_ko: '대경무역 설립', text_en: 'Founded', text_ja: '' }).text.ja).toBe('대경무역 설립');
  });
  it('round-trips product → row → product', () => {
    const p = rowToProduct({ id: 'a-b', category: 'medical', segments: 'syringe', maker_id: 'maeda', name_ko: 'A', body_ko: 'B', features_ko: 'x\ny', order: '1', published: 'TRUE' } as any);
    expect(rowToProduct(productToRow(p))).toEqual(p);
  });
});
```

- [ ] **Step 2: 실패 확인** — `npm test -- sheet` → FAIL (module not found).

- [ ] **Step 3: 변환 함수**

`scripts/lib/sheet-rows.ts`:
```ts
import { ProductSchema, MakerSchema, HistorySchema, type Product, type Maker, type HistoryItem } from '../../src/lib/schema.ts';
type Row = Record<string, string | undefined>;
const s = (v?: string) => (v ?? '').trim();
const list = (v?: string) => s(v).split(',').map((x) => x.trim()).filter(Boolean);
const lines = (v?: string) => s(v).split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
const bool = (v?: string) => s(v).toUpperCase() !== 'FALSE';
const int = (v?: string) => (s(v) === '' ? 999 : Number(s(v)));
const loc = (r: Row, k: string) => ({ ko: s(r[`${k}_ko`]), en: s(r[`${k}_en`]), ja: s(r[`${k}_ja`]) });

export const rowToProduct = (r: Row): Product => ProductSchema.parse({
  id: s(r.id), category: s(r.category), segments: list(r.segments), makerId: s(r.maker_id),
  name: loc(r, 'name'), summary: loc(r, 'summary'), body: loc(r, 'body'),
  features: { ko: lines(r.features_ko), en: lines(r.features_en), ja: lines(r.features_ja) },
  image: s(r.image), images: list(r.images), datasheetUrl: s(r.datasheet_url), order: int(r.order), published: bool(r.published),
});
export const rowToMaker = (r: Row): Maker => MakerSchema.parse({
  id: s(r.id), name: s(r.name), country: s(r.country), logo: s(r.logo), url: s(r.url), desc: loc(r, 'desc'), order: int(r.order), published: bool(r.published),
});
export const rowToHistory = (r: Row): HistoryItem => HistorySchema.parse({ year: s(r.year), text: loc(r, 'text') });

export const PRODUCT_COLUMNS = ['id','category','segments','maker_id','name_ko','name_en','name_ja','summary_ko','summary_en','summary_ja',
  'body_ko','body_en','body_ja','features_ko','features_en','features_ja','image','images','datasheet_url','order','published'] as const;
export const MAKER_COLUMNS = ['id','name','country','logo','url','desc_ko','desc_en','desc_ja','order','published'] as const;
export const HISTORY_COLUMNS = ['year','text_ko','text_en','text_ja'] as const;

export const productToRow = (p: Product): Row => ({
  id: p.id, category: p.category, segments: p.segments.join(', '), maker_id: p.makerId,
  name_ko: p.name.ko, name_en: p.name.en, name_ja: p.name.ja, summary_ko: p.summary.ko, summary_en: p.summary.en, summary_ja: p.summary.ja,
  body_ko: p.body.ko, body_en: p.body.en, body_ja: p.body.ja,
  features_ko: p.features.ko.join('\n'), features_en: p.features.en.join('\n'), features_ja: p.features.ja.join('\n'),
  image: p.image, images: p.images.join(', '), datasheet_url: p.datasheetUrl, order: String(p.order), published: p.published ? 'TRUE' : 'FALSE',
});
export const makerToRow = (m: Maker): Row => ({ id: m.id, name: m.name, country: m.country, logo: m.logo, url: m.url,
  desc_ko: m.desc.ko, desc_en: m.desc.en, desc_ja: m.desc.ja, order: String(m.order), published: m.published ? 'TRUE' : 'FALSE' });
export const historyToRow = (h: HistoryItem): Row => ({ year: h.year, text_ko: h.text.ko, text_en: h.text.en, text_ja: h.text.ja });
```
Run: `npm test -- sheet` → PASS.

- [ ] **Step 4: 시드 CSV 내보내기 (시트에 처음 붙여넣을 용도)**

`scripts/export-sheet-seed.ts`:
```ts
import { writeFileSync, mkdirSync } from 'node:fs';
import { stringify } from 'csv-stringify/sync';
import { PRODUCT_COLUMNS, MAKER_COLUMNS, HISTORY_COLUMNS, productToRow, makerToRow, historyToRow } from './lib/sheet-rows.ts';
import products from '../src/data/products.json' with { type: 'json' };
import makers from '../src/data/makers.json' with { type: 'json' };
import history from '../src/data/history.json' with { type: 'json' };
mkdirSync('tmp', { recursive: true });
writeFileSync('tmp/products.csv', stringify((products as any[]).map(productToRow), { header: true, columns: [...PRODUCT_COLUMNS] }));
writeFileSync('tmp/makers.csv', stringify((makers as any[]).map(makerToRow), { header: true, columns: [...MAKER_COLUMNS] }));
writeFileSync('tmp/history.csv', stringify((history as any[]).map(historyToRow), { header: true, columns: [...HISTORY_COLUMNS] }));
console.log('tmp/*.csv 생성 — 구글 시트 각 탭에 파일 > 가져오기');
```
`npm i csv-stringify`, `.gitignore`에 `tmp/` 추가, `package.json`: `"sheet:seed": "node scripts/export-sheet-seed.ts"`.

- [ ] **Step 5: fetch 스크립트**

`scripts/fetch-sheet.ts`:
```ts
/**
 * Google Sheet(공개 CSV) → src/data/*.json
 * 환경변수 SHEET_ID 없으면 아무것도 안 하고 종료(로컬 개발은 커밋된 JSON 사용).
 * 검증 실패 시 어떤 탭/행/칼럼인지 한국어로 출력하고 exit 1 → 빌드 중단.
 */
import { writeFileSync } from 'node:fs';
import { parse } from 'csv-parse/sync';
import { rowToProduct, rowToMaker, rowToHistory } from './lib/sheet-rows.ts';

const SHEET_ID = process.env.SHEET_ID;
if (!SHEET_ID) { console.log('SHEET_ID 없음 — 커밋된 JSON으로 빌드'); process.exit(0); }

const csvUrl = (tab: string) => `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`;
async function rows(tab: string): Promise<Record<string, string>[]> {
  const res = await fetch(csvUrl(tab));
  if (!res.ok) throw new Error(`시트 탭 '${tab}' 읽기 실패 (${res.status}). 시트가 "링크가 있는 모든 사용자 - 뷰어"로 공유되어 있는지 확인`);
  return parse(await res.text(), { columns: true, skip_empty_lines: true, bom: true });
}
function convert<T>(tab: string, rs: Record<string, string>[], fn: (r: Record<string, string>) => T): T[] {
  const out: T[] = []; const errors: string[] = [];
  rs.forEach((r, i) => {
    if (!Object.values(r).some((v) => v && v.trim())) return; // 빈 행 무시
    try { out.push(fn(r)); }
    catch (e: any) {
      const issues = e?.issues?.map((x: any) => `${x.path.join('.')}: ${x.message}`).join('; ') ?? e.message;
      errors.push(`[${tab} 탭 ${i + 2}행, id=${r.id ?? r.year ?? '?'}] ${issues}`);
    }
  });
  if (errors.length) { console.error(`\n시트 내용에 문제가 있어 사이트 반영을 중단했습니다:\n` + errors.join('\n') + '\n'); process.exit(1); }
  return out;
}
const [p, m, h] = await Promise.all([rows('products'), rows('makers'), rows('history')]);
const products = convert('products', p, rowToProduct);
const makers = convert('makers', m, rowToMaker);
const history = convert('history', h, rowToHistory);
const makerIds = new Set(makers.map((x) => x.id));
const orphan = products.filter((x) => !makerIds.has(x.makerId));
if (orphan.length) { console.error('products 탭의 maker_id가 makers 탭에 없음: ' + orphan.map((x) => `${x.id}→${x.makerId}`).join(', ')); process.exit(1); }
const dup = products.map((x) => x.id).filter((id, i, a) => a.indexOf(id) !== i);
if (dup.length) { console.error('products 탭에 중복 id: ' + [...new Set(dup)].join(', ')); process.exit(1); }
writeFileSync('src/data/products.json', JSON.stringify(products, null, 2));
writeFileSync('src/data/makers.json', JSON.stringify(makers, null, 2));
writeFileSync('src/data/history.json', JSON.stringify(history, null, 2));
console.log(`시트 반영: 제품 ${products.length} · 메이커 ${makers.length} · 연혁 ${history.length}`);
```
`package.json`: `"fetch-sheet": "node scripts/fetch-sheet.ts"`, `"build": "npm run fetch-sheet && astro build"`.

- [ ] **Step 6: 시트 만들기 (수동, 재영 계정 → 나중에 회사 계정으로 이전)**

`docs/ops/sheet-setup.md`에 아래를 기록하고 그대로 수행:
1. `npm run sheet:seed` → `tmp/*.csv` 3개.
2. Google Drive에서 새 스프레드시트 "DKHC 웹사이트 데이터". 탭 이름을 정확히 `products`, `makers`, `history`로 만들고 각 탭에 파일 > 가져오기 > 업로드 > "현재 시트 바꾸기"로 CSV 넣기.
3. `published` 열: 데이터 > 데이터 확인 > 체크박스. `category` 열: 드롭다운(special/medical/eco). 첫 행 고정 + 굵게.
4. 공유 > "링크가 있는 모든 사용자: 뷰어". 편집자는 회사 직원 계정 추가.
5. URL의 `/d/<여기>/edit` 가 `SHEET_ID`.
6. 로컬 확인: `SHEET_ID=... npm run fetch-sheet` → `git diff src/data` 가 **비어 있어야** 함(시드와 동일). 비어 있지 않으면 CSV 가져오기 옵션(줄바꿈/따옴표)을 확인.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(sheet): Google Sheet CSV → JSON 페처(한국어 검증 메시지), 시드 내보내기, 시트 설정 문서"
```

---

### Task 11: GitHub Actions 배포 + 시트 [사이트 반영] 버튼

**Files:**
- Create: `.github/workflows/deploy.yml`, `scripts/apps-script/trigger-build.gs`
- Modify: `docs/ops/sheet-setup.md` (버튼 설치 절차 추가)

- [ ] **Step 1: 워크플로**

`.github/workflows/deploy.yml`:
```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  schedule:
    - cron: '0 19 * * *'   # 매일 04:00 KST — 버튼 안 눌러도 하루 1회 시트 반영
  repository_dispatch:
    types: [sheet-updated]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 23
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
        env:
          SHEET_ID: ${{ secrets.SHEET_ID }}
          BASE_PATH: ${{ vars.BASE_PATH || '/' }}
          SITE_URL: ${{ vars.SITE_URL || 'https://dkhc.co.kr' }}
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: 리포 생성 + 첫 배포**

```bash
gh repo create gamsasyo/dkhc --private --source=. --remote=origin --push
gh secret set SHEET_ID --body "<시트 ID>"
gh variable set BASE_PATH --body "/dkhc/"
gh variable set SITE_URL --body "https://gamsasyo.github.io/dkhc"
gh api -X POST repos/gamsasyo/dkhc/pages -f build_type=workflow   # Pages를 Actions 소스로 활성화
git push -u origin main
gh run watch
```
Expected: 워크플로 성공 → `https://gamsasyo.github.io/dkhc/ko/products/` 접속됨(커스텀 도메인은 Plan 2에서 연결하면서 `BASE_PATH=/`, `SITE_URL=https://dkhc.co.kr`로 변경).
주의: private 리포의 GitHub Pages는 GitHub Pro/Team 이상에서만 가능. 무료 계정이면 **리포를 public으로** 만들거나(코드만 공개, 시트 ID는 시크릿이라 안전) 유료 플랜 — NEWSCAPE·64 Moves 전례대로 public 권장. 재영에게 확인 후 결정.

- [ ] **Step 3: Apps Script — 시트 메뉴 버튼**

`scripts/apps-script/trigger-build.gs` (시트 > 확장 프로그램 > Apps Script 에 복붙):
```js
/** 시트 메뉴 [사이트] > [사이트 반영] → GitHub Actions repository_dispatch */
const REPO = 'gamsasyo/dkhc';

function onOpen() {
  SpreadsheetApp.getUi().createMenu('사이트').addItem('사이트 반영 (1~2분 소요)', 'triggerBuild').addToUi();
}

function triggerBuild() {
  const token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!token) { SpreadsheetApp.getUi().alert('GITHUB_TOKEN이 설정되지 않았습니다. 관리자(신재영)에게 문의하세요.'); return; }
  const res = UrlFetchApp.fetch(`https://api.github.com/repos/${REPO}/dispatches`, {
    method: 'post', contentType: 'application/json',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
    payload: JSON.stringify({ event_type: 'sheet-updated' }), muteHttpExceptions: true,
  });
  const code = res.getResponseCode();
  SpreadsheetApp.getUi().alert(code === 204
    ? '반영을 시작했습니다. 1~2분 뒤 사이트를 새로고침하세요.\n시트 내용에 오류가 있으면 반영되지 않습니다 — 그때는 관리자에게 알려주세요.'
    : `실패 (${code}). 관리자에게 문의하세요.\n${res.getContentText()}`);
}
```
설치 절차(`docs/ops/sheet-setup.md`에 추가):
1. GitHub에서 fine-grained PAT 발급: 리포 `gamsasyo/dkhc`만, 권한 **Contents: Read and write**(repository_dispatch에 필요), 만료 1년(캘린더에 갱신 알림).
2. Apps Script 편집기 > 프로젝트 설정 > 스크립트 속성에 `GITHUB_TOKEN` 저장.
3. 시트 새로고침 → 메뉴 `사이트 > 사이트 반영` 클릭 → 첫 실행 시 권한 승인 → `gh run list`에 `repository_dispatch` 실행이 보이면 성공.

- [ ] **Step 4: 끝-끝 확인**

시트 `products` 탭에서 제품 하나의 `summary_ko`를 바꾸고 → 버튼 → 2분 뒤 라이브 카드에 반영. 이어서 `category`를 `bogus`로 바꾸고 → 버튼 → Actions 실패, 로그에 `[products 탭 N행, id=…] category: Invalid enum value…` 한국어 메시지. 원복 후 다시 버튼 → 성공.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "ci: GitHub Pages 배포(푸시·cron·시트 dispatch) + 시트 [사이트 반영] 메뉴"
git push
```

---

## Plan 1 완료 기준

- `npm test` 전부 통과, `npm run build` 3언어 × (products 목록·상세, makers 목록·상세, styleguide, 임시 홈) 생성
- `https://gamsasyo.github.io/dkhc/ko/products/` 에서 IMCD식 탐색(타일 → pill → 카드, 검색, URL 공유) 동작, 모바일 375px 정상
- 시트 수정 → 버튼 → 반영, 잘못된 입력은 한국어 오류로 차단
- Lighthouse(모바일, `/ko/products/`) 성능·접근성·SEO 90+ — 미달 시 이미지 크기/폰트 로딩 조정

## Plan 2 (다음 플랜에서)

홈(추상 그래픽 히어로·숫자 띠·대표 제품·고객사 로고), 회사소개(개요·인사말·연혁·오시는 길), 문의 폼 + Apps Script 메일(`info@dkhc.co.kr`) + `inquiries` 탭 + Turnstile, privacy, 구 URL(`/ko/sub/...`, `/jp/...`) 리다이렉트, 가비아 DNS → 커스텀 도메인, 시트 소유권 회사 계정 이전, 직원용 운영 가이드 1장.
