/**
 * Global pointer-driven interaction effects.
 *
 * Two behaviours, both delegated from the document so they survive the app's
 * full re-render on every state change:
 *
 *  - Spotlight: elements marked `.u-spotlight` get `--mx`/`--my` set to the
 *    cursor position within their own box, which CSS turns into a radial sheen.
 *  - Ripple: `.u-ripple` elements emit a circle from the click point.
 */

const SPOTLIGHT_SELECTOR = '.u-spotlight';
const RIPPLE_SELECTOR = [
  '.u-ripple',
  '.btn',
  '.op-btn-primary',
  '.bb-check-btn',
  '.bb-next-btn',
  '.menu-item',
  '.op-source-tab',
].join(',');

const reducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let pending: { el: HTMLElement; x: number; y: number } | null = null;
let frame = 0;

function flush() {
  frame = 0;
  if (!pending) return;
  const { el, x, y } = pending;
  pending = null;
  el.style.setProperty('--mx', `${x}px`);
  el.style.setProperty('--my', `${y}px`);
}

function onPointerMove(e: PointerEvent) {
  const target = (e.target as Element | null)?.closest<HTMLElement>(SPOTLIGHT_SELECTOR);
  if (!target) return;
  const rect = target.getBoundingClientRect();
  pending = { el: target, x: e.clientX - rect.left, y: e.clientY - rect.top };
  if (!frame) frame = requestAnimationFrame(flush);
}

function onPointerDown(e: PointerEvent) {
  if (e.button !== 0) return;
  const target = (e.target as Element | null)?.closest<HTMLElement>(RIPPLE_SELECTOR);
  if (!target || target.hasAttribute('disabled')) return;

  const rect = target.getBoundingClientRect();
  const ripple = document.createElement('span');
  ripple.className = 'u-ripple-wave';
  // Cover the furthest corner from the click so the wave always fills the box.
  const radius = Math.hypot(
    Math.max(e.clientX - rect.left, rect.right - e.clientX),
    Math.max(e.clientY - rect.top, rect.bottom - e.clientY),
  );
  ripple.style.width = ripple.style.height = `${radius * 2}px`;
  ripple.style.left = `${e.clientX - rect.left - radius}px`;
  ripple.style.top = `${e.clientY - rect.top - radius}px`;
  ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
  target.appendChild(ripple);
}

export function initInteractions() {
  if (reducedMotion()) return;
  document.addEventListener('pointermove', onPointerMove, { passive: true });
  document.addEventListener('pointerdown', onPointerDown, { passive: true });
}
