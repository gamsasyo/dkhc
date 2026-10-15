import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseListPage, parseViewPage, slugify, imageFileName } from '../scripts/lib/legacy-parse';

const list = readFileSync('docs/analysis/raw/ko_sub_product_list.asp_s_cate_1010', 'utf8');
const view = readFileSync('docs/analysis/raw/v11.html', 'utf8');
const view2 = readFileSync('docs/analysis/raw/v9.html', 'utf8');

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
  it('parses both product lines from a two-tab view page (Saxin, idx=9)', () => {
    const v = parseViewPage(view2);
    expect(v.maker.name).toBe('Saxin');
    expect(v.products.map((p) => p.name)).toEqual(['New Lite', 'Panaxia : 내열 고접동성 필름']);
    expect(v.products[0].image).toBe('/upload/prod/뉴라이트 로고.png');
    expect(v.products[0].images.length).toBe(4);
    expect(v.products[1].images).toEqual(['/upload/prod/파나시아.jpg']);
  });
  it('slugifies', () => {
    expect(slugify('Kuraray Plastics')).toBe('kuraray-plastics');
    expect(slugify('Panaxia : 내열 고접동성 필름')).toBe('panaxia');
    expect(slugify('EARNESTON®')).toBe('earneston');
  });
  it('names image files without collisions', () => {
    const used = new Map<string, string>();
    expect(imageFileName('/upload/prod/kuraray modified.png', used)).toBe('kuraray-modified.png');
    // 같은 원본을 다시 물으면 같은 이름
    expect(imageFileName('/upload/prod/kuraray modified.png', used)).toBe('kuraray-modified.png');
    // 다른 원본이 같은 슬러그로 떨어지면 해시 접미사
    const n2 = imageFileName('/upload/prod/kuraray modified(0).png', used);
    expect(n2).toMatch(/^kuraray-modified-[0-9a-f]{8}\.png$/);
    // 한국어만 있는 이름은 슬러그가 비므로 해시로, 서로 다르게
    const k1 = imageFileName('/upload/prod/덴카 홈페이지 로고.png', used);
    const k2 = imageFileName('/upload/prod/덴카 홈페이지 로고(0).png', used);
    expect(k1).toMatch(/^[0-9a-f]{8}\.png$/);
    expect(k2).toMatch(/^[0-9a-f]{8}\.png$/);
    expect(k1).not.toBe(k2);
    // 확장자는 소문자화
    expect(imageFileName('/upload/prod/logo.JPG', used)).toBe('logo.jpg');
  });
});
