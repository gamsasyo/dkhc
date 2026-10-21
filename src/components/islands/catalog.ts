import { filterProducts, countBySegment, countByCategory, parseQuery, serializeQuery, type CatalogItem, type Query } from '../../lib/catalog';
import { CATEGORIES, type Category } from '../../lib/schema';
import { popCheck } from '../../lib/motion';

export function initCatalog(root: HTMLElement) {
  if (root.dataset.bound) return; // ClientRouter: astro:page-load 마다 호출되므로 1회만
  root.dataset.bound = '1';
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
      tl.setAttribute('aria-pressed', String(on)); // 선택 모양은 aria-pressed 로 CSS가 그림 (CategoryTiles)
      const check = tl.querySelector('[data-check]');
      if (check && on && check.classList.contains('hidden')) popCheck(check);
      check?.classList.toggle('hidden', !on);
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
    if (push) history.replaceState(history.state, '', location.pathname + serializeQuery(q)); // history.state 유지 — ClientRouter 가 뒤로가기 판단에 쓴다
  }

  // 고른 결과가 화면 밖(아래)에 있으면 결과 줄까지 내려주고, 결과 문구를 한 번 반짝 — 눌렀는데 아무 일 없는 것처럼 보이지 않게
  function showResult() {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (result.getBoundingClientRect().top > innerHeight * .75)
      result.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    if (!reduce) result.animate([{ color: 'var(--color-accent)', transform: 'translateY(-2px)' }, { color: '', transform: 'none' }], { duration: 700, easing: 'ease-out' });
  }

  tiles.forEach((tl) => tl.addEventListener('click', (e) => {
    e.preventDefault();
    const c = tl.dataset.category as Category;
    q = { ...q, cat: q.cat === c ? undefined : c, seg: undefined };
    render();
    showResult();
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
  window.addEventListener('popstate', () => { if (!root.isConnected) return; q = parseQuery(location.search); setSearch(q.q ?? ''); render(false); });
  render(false);
}
