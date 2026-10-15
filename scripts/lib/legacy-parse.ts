import { createHash } from 'node:crypto';
import { basename, extname } from 'node:path';

const strip = (html: string) =>
  html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();

export const slugify = (s: string) =>
  s.normalize('NFKD').replace(/[®™©]/g, '').split(/[:：(]/)[0]
   .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'item';

/**
 * 이미지 저장 파일명. slugify(기본이름)+확장자 — 단, 슬러그가 비거나('item')
 * 다른 원본 경로가 이미 같은 이름을 썼으면 원본 경로의 sha1 앞 8자리로 대체한다.
 * `used`는 파일명 → 원본 경로 맵(호출자가 디렉터리별로 유지).
 */
export function imageFileName(path: string, used: Map<string, string>): string {
  const ext = extname(path).toLowerCase();
  const slug = slugify(basename(path, extname(path)));
  const hash = createHash('sha1').update(path).digest('hex').slice(0, 8);
  let name = `${slug}${ext}`;
  if (slug === 'item') name = `${hash}${ext}`;
  else if (used.has(name) && used.get(name) !== path) name = `${slug}-${hash}${ext}`;
  used.set(name, path);
  return name;
}

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
