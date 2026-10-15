import { animate } from 'motion/mini';
import { inView, spring, stagger } from 'motion';

/** OS 설정 "동작 줄이기" — 켜져 있으면 모든 JS 모션을 건너뛴다. */
export const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const REVEALED = 'revealed';
const FADE_UP = { opacity: [0, 1], y: [16, 0] } as const;
const FADE_OPTS = { duration: 0.5, ease: 'easeOut' } as const;

/** 같은 프레임에 들어온 요소들을 한 묶음으로 60ms 간격 stagger. */
let pending: HTMLElement[] = [];
let flushQueued = false;
function queueReveal(el: HTMLElement) {
  pending.push(el);
  if (flushQueued) return;
  flushQueued = true;
  requestAnimationFrame(() => {
    const batch = pending; pending = []; flushQueued = false;
    batch.forEach((b) => b.classList.add(REVEALED));
    animate(batch, FADE_UP, { ...FADE_OPTS, delay: stagger(0.06) });
  });
}

function revealTargets(root: ParentNode): HTMLElement[] {
  const out: HTMLElement[] = [];
  root.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el) => out.push(el));
  root.querySelectorAll<HTMLElement>('[data-reveal-group]:not([data-reveal-group="once"])')
    .forEach((g) => out.push(...([...g.children] as HTMLElement[])));
  return out;
}

/**
 * 스크롤 리빌. `[data-reveal]`·`[data-reveal-group] > *` 는 20% 보이면 한 번 fade-up.
 * `[data-reveal-group="once"]` (필터되는 목록) 는 첫 화면에 보이는 자식만 stagger 하고 나머지는 즉시 노출 — 필터 변경마다 다시 안 움직인다.
 */
export function initReveal(root: ParentNode = document) {
  if (reduced()) return;
  for (const el of revealTargets(root)) {
    if (el.dataset.revealBound || el.classList.contains(REVEALED)) continue;
    el.dataset.revealBound = '1';
    inView(el, () => { queueReveal(el); }, { amount: 0.2 });
  }
  root.querySelectorAll<HTMLElement>('[data-reveal-group="once"]').forEach((g) => {
    if (g.dataset.revealBound) return;
    g.dataset.revealBound = '1';
    const kids = [...g.children] as HTMLElement[];
    const onScreen = kids.filter((k) => {
      if (k.classList.contains('hidden')) return false;
      const r = k.getBoundingClientRect();
      return r.bottom > 0 && r.top < innerHeight;
    });
    kids.forEach((k) => { if (!onScreen.includes(k)) k.classList.add(REVEALED); });
    if (onScreen.length) {
      onScreen.forEach((k) => k.classList.add(REVEALED));
      animate(onScreen, FADE_UP, { ...FADE_OPTS, delay: stagger(0.06) });
    }
  });
}

/** 숫자 띠 카운트업. `data-countup` = 최종값, `data-countup-from` = 시작값(기본 0). (`data-count` 는 분야 타일 배지가 이미 씀) 끝나면 SSR 텍스트 그대로 복원. */
export function initCountUp(root: ParentNode = document) {
  if (reduced()) return;
  root.querySelectorAll<HTMLElement>('[data-countup]').forEach((el) => {
    if (el.dataset.countBound) return;
    el.dataset.countBound = '1';
    const final = el.textContent ?? '';
    const to = Number(el.dataset.countup);
    const from = Number(el.dataset.countupFrom ?? 0);
    if (!Number.isFinite(to)) return;
    inView(el, () => {
      const t0 = performance.now();
      const tick = (now: number) => {
        const p = Math.min(1, (now - t0) / 1200);
        const e = 1 - Math.pow(1 - p, 3); // easeOut(cubic)
        el.textContent = p < 1 ? String(Math.round(from + (to - from) * e)) : final;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { amount: 0.5 });
  });
}

/** 버튼 눌림: pointerdown 0.97 → 놓으면 스프링 복귀. document 위임이라 한 번만 바인딩. */
export function initPress() {
  const html = document.documentElement;
  if (html.dataset.pressBound || reduced()) return;
  html.dataset.pressBound = '1';
  const target = (e: Event) => (e.target as Element | null)?.closest<HTMLElement>('[data-press]') ?? null;
  document.addEventListener('pointerdown', (e) => {
    const el = target(e); if (!el) return;
    animate(el, { scale: 0.97 }, { duration: 0.1, ease: 'easeOut' });
    const release = () => {
      animate(el, { scale: 1 }, { type: spring, stiffness: 500, damping: 30 });
      el.removeEventListener('pointerup', release); el.removeEventListener('pointerleave', release); el.removeEventListener('pointercancel', release);
    };
    el.addEventListener('pointerup', release); el.addEventListener('pointerleave', release); el.addEventListener('pointercancel', release);
  }, { passive: true });
}

/** 분야 타일 체크 배지 — hidden → 표시로 바뀔 때만 호출. */
export function popCheck(el: Element) {
  if (reduced()) return;
  animate(el, { scale: [0.4, 1] }, { type: spring, stiffness: 500, damping: 25 });
}

/** 페이지 공통 init. ClientRouter 전환마다 astro:page-load 에서 다시 부른다. */
export function initMotion() {
  initPress();
  // 카탈로그/메이커 스크립트가 같은 이벤트에서 hidden 토글을 끝낸 뒤 측정하도록 한 프레임 미룬다.
  requestAnimationFrame(() => { initReveal(); initCountUp(); });
}
