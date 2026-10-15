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
