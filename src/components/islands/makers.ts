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
