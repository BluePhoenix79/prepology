import type { SectionTrend } from '../utils/scoreTrend';
import { WINDOW, combinedLatest } from '../utils/scoreTrend';

/**
 * Interactive score-trend line chart.
 *
 * Inline SVG rather than a charting dependency — two series over a fixed
 * 200-800 axis is not worth a library, and this keeps the bundle flat.
 * Hover is handled with a single pointer listener that snaps to the nearest
 * day, so it stays responsive with a long history.
 */

const W = 720;
const H = 260;
const PAD = { top: 18, right: 16, bottom: 30, left: 44 };
const Y_MIN = 200;
const Y_MAX = 800;

const SERIES_COLOR: Record<string, string> = {
  'Reading and Writing': 'var(--c-blue)',
  Math: 'var(--c-purple)',
};

function x(i: number, n: number): number {
  if (n <= 1) return PAD.left;
  return PAD.left + (i / (n - 1)) * (W - PAD.left - PAD.right);
}

function y(score: number): number {
  const t = (score - Y_MIN) / (Y_MAX - Y_MIN);
  return H - PAD.bottom - t * (H - PAD.top - PAD.bottom);
}

function linePath(points: Array<{ score: number }>): string {
  return points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i, points.length).toFixed(1)},${y(p.score).toFixed(1)}`)
    .join(' ');
}

function areaPath(points: Array<{ score: number }>): string {
  if (points.length === 0) return '';
  const top = linePath(points);
  const lastX = x(points.length - 1, points.length).toFixed(1);
  const firstX = x(0, points.length).toFixed(1);
  const base = (H - PAD.bottom).toFixed(1);
  return `${top} L${lastX},${base} L${firstX},${base} Z`;
}

function shortDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function renderScoreTrendChart(trends: SectionTrend[]): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'trend-card';

  const active = trends.filter(t => t.points.length >= 2);
  const combined = combinedLatest(trends);

  if (active.length === 0) {
    wrap.innerHTML = `
      <div class="trend-head">
        <div>
          <h3>Score trend</h3>
          <p>Estimated section scores over time, from a rolling window of your last ${WINDOW} questions.</p>
        </div>
      </div>
      <div class="trend-empty">
        <p>Not enough history yet — answer a few more questions and your estimated
        Reading &amp; Writing and Math scores will start plotting here.</p>
      </div>`;
    return wrap;
  }

  const gridLines = [200, 400, 600, 800];

  wrap.innerHTML = `
    <div class="trend-head">
      <div>
        <h3>Score trend</h3>
        <p>Rolling estimate from your last ${WINDOW} questions per section, weighted by difficulty.</p>
      </div>
      <div class="trend-legend">
        ${active.map(t => `
          <span class="trend-key">
            <i style="background:${SERIES_COLOR[t.section]}"></i>
            ${t.section === 'Math' ? 'Math' : 'Reading &amp; Writing'}
            <strong>${t.latest}</strong>
            ${t.change !== null && t.change !== 0
              ? `<em class="${t.change > 0 ? 'up' : 'down'}">${t.change > 0 ? '+' : ''}${t.change}</em>`
              : ''}
          </span>`).join('')}
        ${combined !== null ? `<span class="trend-key trend-key--total">Total <strong>${combined}</strong></span>` : ''}
      </div>
    </div>

    <div class="trend-plot">
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img"
           aria-label="Estimated section scores over time">
        <defs>
          ${active.map((t, i) => `
            <linearGradient id="trendFill${i}" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="${SERIES_COLOR[t.section]}" stop-opacity="0.22"/>
              <stop offset="100%" stop-color="${SERIES_COLOR[t.section]}" stop-opacity="0"/>
            </linearGradient>`).join('')}
        </defs>

        ${gridLines.map(v => `
          <line class="trend-grid" x1="${PAD.left}" x2="${W - PAD.right}" y1="${y(v)}" y2="${y(v)}"/>
          <text class="trend-axis" x="${PAD.left - 8}" y="${y(v) + 4}" text-anchor="end">${v}</text>
        `).join('')}

        ${active.map((t, i) => `
          <path class="trend-area" d="${areaPath(t.points)}" fill="url(#trendFill${i})"/>
          <path class="trend-line" d="${linePath(t.points)}" stroke="${SERIES_COLOR[t.section]}"/>
          ${t.projection !== null ? `
            <line class="trend-projection" stroke="${SERIES_COLOR[t.section]}"
                  x1="${x(t.points.length - 1, t.points.length)}" y1="${y(t.points[t.points.length - 1].score)}"
                  x2="${W - PAD.right}" y2="${y(t.projection)}"/>
            <circle class="trend-proj-dot" cx="${W - PAD.right}" cy="${y(t.projection)}" r="3"
                    fill="${SERIES_COLOR[t.section]}"/>` : ''}
        `).join('')}

        <line class="trend-cursor" id="trend-cursor" y1="${PAD.top}" y2="${H - PAD.bottom}" x1="0" x2="0" style="opacity:0"/>
        ${active.map(t => `<circle class="trend-hit" data-section="${t.section}" r="4"
             fill="${SERIES_COLOR[t.section]}" style="opacity:0"/>`).join('')}
      </svg>
      <div class="trend-tooltip" id="trend-tooltip" hidden></div>
    </div>

    ${active.some(t => t.projection !== null) ? `
      <p class="trend-foot">
        Dashed lines project the recent trend two weeks out. They extrapolate your last few
        sessions, not a prediction of test day.
      </p>` : ''}
  `;

  /* ── hover ── */
  const svg = wrap.querySelector('svg')!;
  const cursor = wrap.querySelector<SVGLineElement>('#trend-cursor')!;
  const tooltip = wrap.querySelector<HTMLElement>('#trend-tooltip')!;
  const dots = [...wrap.querySelectorAll<SVGCircleElement>('.trend-hit')];
  const longest = active.reduce((a, b) => (a.points.length >= b.points.length ? a : b));

  function onMove(e: PointerEvent) {
    const rect = svg.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * W;
    const n = longest.points.length;
    const span = (W - PAD.left - PAD.right) / Math.max(1, n - 1);
    const i = Math.max(0, Math.min(n - 1, Math.round((svgX - PAD.left) / span)));

    cursor.setAttribute('x1', String(x(i, n)));
    cursor.setAttribute('x2', String(x(i, n)));
    cursor.style.opacity = '1';

    const rows: string[] = [];
    dots.forEach(dot => {
      const trend = active.find(t => t.section === dot.dataset.section)!;
      const p = trend.points[Math.min(i, trend.points.length - 1)];
      if (!p) { dot.style.opacity = '0'; return; }
      const px = x(Math.min(i, trend.points.length - 1), trend.points.length);
      dot.setAttribute('cx', String(px));
      dot.setAttribute('cy', String(y(p.score)));
      dot.style.opacity = '1';
      rows.push(
        `<span><i style="background:${SERIES_COLOR[trend.section]}"></i>${
          trend.section === 'Math' ? 'Math' : 'R&amp;W'
        }<strong>${p.score}</strong></span>`,
      );
    });

    const ref = longest.points[i];
    tooltip.hidden = false;
    tooltip.innerHTML = `<div class="trend-tip-date">${shortDate(ref.timestamp)}</div>${rows.join('')}`;
    const leftPct = (x(i, n) / W) * 100;
    tooltip.style.left = `${leftPct}%`;
    tooltip.classList.toggle('flip', leftPct > 70);
  }

  function onLeave() {
    cursor.style.opacity = '0';
    dots.forEach(d => (d.style.opacity = '0'));
    tooltip.hidden = true;
  }

  svg.addEventListener('pointermove', onMove);
  svg.addEventListener('pointerleave', onLeave);

  return wrap;
}
