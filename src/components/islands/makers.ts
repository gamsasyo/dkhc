import { filterMakers, initialOf, type MakerItem } from '../../lib/catalog';
import { popCheck } from '../../lib/motion';
export function initMakers(root: HTMLElement) {
  if (root.dataset.bound) return; // ClientRouter: astro:page-load 마다 호출되므로 1회만
  root.dataset.bound = '1';
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
      tl.classList.toggle('border-accent', on); tl.classList.toggle('border-transparent', !on);
      const check = tl.querySelector('[data-check]');
      if (check && on && check.classList.contains('hidden')) popCheck(check);
      check?.classList.toggle('hidden', !on); });
    const avail = new Set(filterMakers(items, { cat }).map((m) => initialOf(m.name)));
    alphas.forEach((a) => { const L = a.dataset.letter!; const on = (L || undefined) === letter;
      a.disabled = !!L && !avail.has(L); a.setAttribute('aria-pressed', String(on));
      a.classList.toggle('text-accent', on); a.classList.toggle('underline', on); });
    history.replaceState(history.state, '', location.pathname + (cat ? `?cat=${cat}` : '')); // history.state 유지 — ClientRouter 가 뒤로가기 판단에 쓴다
  }
  tiles.forEach((tl) => tl.addEventListener('click', (e) => { e.preventDefault(); const c = tl.dataset.category!; cat = cat === c ? undefined : c; letter = undefined; render(); }));
  alphas.forEach((a) => a.addEventListener('click', () => { letter = a.dataset.letter || undefined; render(); }));
  render();
}
