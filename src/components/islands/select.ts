// 직접 그린 선택 목록 (WAI-ARIA listbox). 값은 숨긴 <select> 에 넣어 폼 전송은 그대로.
// 키보드: ↓↑ 이동 · Home/End · Enter/Space 선택 · Esc 닫기 · Tab 닫고 다음으로 · 글자 입력으로 바로 이동
import { animate } from 'motion';

export function initSelect(root: HTMLElement) {
  if (root.dataset.bound) return; // ClientRouter: astro:page-load 마다 호출되므로 1회만
  root.dataset.bound = '1';
  const select = root.querySelector('select')!;
  const btn = root.querySelector<HTMLButtonElement>('[data-select-btn]')!;
  const label = root.querySelector<HTMLElement>('[data-select-label]')!;
  const list = root.querySelector<HTMLElement>('[data-select-list]')!;
  const opts = [...list.querySelectorAll<HTMLElement>('[role=option]')];
  const uid = 'sel' + Math.random().toString(36).slice(2, 8);
  opts.forEach((o, i) => (o.id = `${uid}-${i}`));
  list.id = `${uid}-list`;
  btn.setAttribute('aria-controls', list.id);
  // JS 가 돌면 기본 select 는 화면에서만 숨김 (폼 값은 계속 이걸로)
  select.classList.add('sr-only');
  select.tabIndex = -1;
  select.setAttribute('aria-hidden', 'true');
  btn.classList.remove('hidden');
  btn.classList.add('flex');

  let active = 0;
  const isOpen = () => btn.getAttribute('aria-expanded') === 'true';
  const setActive = (i: number) => {
    active = (i + opts.length) % opts.length;
    opts.forEach((o, j) => o.toggleAttribute('data-active', j === active));
    list.setAttribute('aria-activedescendant', opts[active].id);
    opts[active].scrollIntoView({ block: 'nearest' });
  };
  const sync = () => {
    const i = Math.max(0, opts.findIndex((o) => o.dataset.value === select.value));
    opts.forEach((o, j) => o.setAttribute('aria-selected', String(j === i)));
    label.textContent = opts[i].querySelector('.block')!.textContent;
    return i;
  };
  const open = () => {
    if (isOpen()) return;
    btn.setAttribute('aria-expanded', 'true');
    list.classList.remove('hidden');
    setActive(sync());
    list.focus({ preventScroll: true });
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches)
      animate(list, { opacity: [0, 1], y: [-6, 0], scale: [0.98, 1] }, { duration: 0.16, ease: 'easeOut' });
  };
  const close = (focusBtn = true) => {
    if (!isOpen()) return;
    btn.setAttribute('aria-expanded', 'false');
    list.classList.add('hidden');
    if (focusBtn) btn.focus({ preventScroll: true });
  };
  const choose = (i: number) => {
    select.value = opts[i].dataset.value!;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    sync();
    close();
  };

  btn.addEventListener('click', () => (isOpen() ? close() : open()));
  btn.addEventListener('keydown', (e) => {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); open(); }
  });
  let typed = '', typedAt = 0;
  list.addEventListener('keydown', (e) => {
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); setActive(active + 1); break;
      case 'ArrowUp': e.preventDefault(); setActive(active - 1); break;
      case 'Home': e.preventDefault(); setActive(0); break;
      case 'End': e.preventDefault(); setActive(opts.length - 1); break;
      case 'Enter': case ' ': e.preventDefault(); choose(active); break;
      case 'Escape': e.preventDefault(); close(); break;
      case 'Tab': close(false); break;
      default:
        if (e.key.length === 1) {
          typed = (Date.now() - typedAt > 600 ? '' : typed) + e.key.toLowerCase(); typedAt = Date.now();
          const i = opts.findIndex((o) => o.textContent!.trim().toLowerCase().startsWith(typed));
          if (i >= 0) setActive(i);
        }
    }
  });
  opts.forEach((o, i) => {
    o.addEventListener('pointermove', () => active !== i && setActive(i));
    o.addEventListener('click', () => choose(i));
  });
  document.addEventListener('pointerdown', (e) => { if (!root.contains(e.target as Node)) close(false); });
  sync();
}
