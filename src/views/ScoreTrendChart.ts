import { store } from '../state/Store';
import type { ScoreTrendData } from '../utils/scoreTrend';
import { openTargetGoalModal } from '../components/TargetGoalModal';

const W = 880;
const H = 300;
const PAD = { top: 25, right: 35, bottom: 38, left: 55 };

type ViewMode = 'total' | 'both' | 'math' | 'rw';
let activeMode: ViewMode = 'total';

function getModeYConfig(mode: ViewMode) {
  if (mode === 'total') {
    return { min: 400, max: 1600, grid: [600, 800, 1000, 1200, 1400, 1600] };
  }
  return { min: 200, max: 800, grid: [200, 400, 600, 800] };
}

function calcX(idx: number, totalPoints: number): number {
  const plotW = W - PAD.left - PAD.right;
  if (totalPoints <= 1) return PAD.left + plotW / 2;
  if (totalPoints === 2) {
    return PAD.left + plotW * (0.28 + idx * 0.44);
  }
  if (totalPoints === 3) {
    return PAD.left + plotW * (0.16 + idx * 0.34);
  }
  return PAD.left + (idx / (totalPoints - 1)) * plotW;
}

function calcY(score: number, yMin: number, yMax: number): number {
  const clamped = Math.max(yMin, Math.min(yMax, score));
  const t = (clamped - yMin) / (yMax - yMin);
  return H - PAD.bottom - t * (H - PAD.top - PAD.bottom);
}

// Generate smooth cubic bezier SVG curve string
function generateSmoothPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  if (points.length === 2) {
    return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)} L ${points[1].x.toFixed(1)} ${points[1].y.toFixed(1)}`;
  }

  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

export function renderScoreTrendChart(data: ScoreTrendData): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'trend-card';

  const { points, targetScore, percentile, totalSolves } = data;

  if (points.length < 2) {
    wrap.innerHTML = `
      <div class="trend-head">
        <div>
          <div style="display:flex; align-items:center; gap:0.5rem;">
            <h3 style="margin:0; font-size:1.15rem; font-weight:800; color:var(--c-text);">Estimated Score Tracker</h3>
            <span class="trend-badge-pill" style="background:rgba(59,130,246,0.15); color:var(--c-blue);">SAT Adaptive IRT</span>
          </div>
          <p style="margin:0.25rem 0 0 0; font-size:0.8rem; color:var(--c-text-2);">
            Real-time projection modeled on the digital SAT difficulty curve.
          </p>
        </div>
      </div>
      <div class="trend-empty" style="text-align:center; padding:2.5rem 1rem;">
        <div style="width:48px; height:48px; border-radius:50%; background:var(--c-elevated); display:flex; align-items:center; justify-content:center; margin:0 auto 1rem auto; color:var(--c-blue);">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        </div>
        <h4 style="font-size:1.05rem; font-weight:700; color:var(--c-text); margin:0 0 0.4rem 0;">No Score Data Yet</h4>
        <p style="font-size:0.85rem; color:var(--c-text-2); max-width:440px; margin:0 auto 1.25rem auto;">
          Answer at least 3 practice questions to activate your dynamic SAT score trajectory curve.
        </p>
        <button class="btn op-btn-primary" id="btn-trend-start-drills" style="background:var(--c-blue); color:#fff; font-weight:700; font-size:0.85rem; padding:0.5rem 1.25rem; border-radius:8px; cursor:pointer;">
          Start Practice Drill
        </button>
      </div>
    `;

    wrap.querySelector('#btn-trend-start-drills')?.addEventListener('click', () => {
      store.setView('dashboard');
    });
    return wrap;
  }

  const yConfig = getModeYConfig(activeMode);
  const n = points.length;

  // Prepare coordinate arrays for each series
  const totalCoords = points
    .filter(p => p.totalScore !== null)
    .map(p => {
      const idx = points.indexOf(p);
      return { x: calcX(idx, n), y: calcY(p.totalScore!, yConfig.min, yConfig.max), score: p.totalScore! };
    });

  const mathCoords = points
    .filter(p => p.mathScore !== null)
    .map(p => {
      const idx = points.indexOf(p);
      return { x: calcX(idx, n), y: calcY(p.mathScore!, yConfig.min, yConfig.max), score: p.mathScore! };
    });

  const rwCoords = points
    .filter(p => p.rwScore !== null)
    .map(p => {
      const idx = points.indexOf(p);
      return { x: calcX(idx, n), y: calcY(p.rwScore!, yConfig.min, yConfig.max), score: p.rwScore! };
    });

  // Calculate paths
  const totalLine = generateSmoothPath(totalCoords);
  const mathLine = generateSmoothPath(mathCoords);
  const rwLine = generateSmoothPath(rwCoords);

  const baselineY = H - PAD.bottom;
  const firstX = calcX(0, n).toFixed(1);
  const lastX = calcX(n - 1, n).toFixed(1);

  const totalArea = totalCoords.length > 0 ? `${totalLine} L ${lastX} ${baselineY} L ${firstX} ${baselineY} Z` : '';
  const mathArea = mathCoords.length > 0 ? `${mathLine} L ${lastX} ${baselineY} L ${firstX} ${baselineY} Z` : '';
  const rwArea = rwCoords.length > 0 ? `${rwLine} L ${lastX} ${baselineY} L ${firstX} ${baselineY} Z` : '';

  // Target score line position
  let targetY: number | null = null;
  if (activeMode === 'total' && targetScore >= yConfig.min && targetScore <= yConfig.max) {
    targetY = calcY(targetScore, yConfig.min, yConfig.max);
  } else if (activeMode !== 'total') {
    const halfTarget = Math.round(targetScore / 2);
    if (halfTarget >= yConfig.min && halfTarget <= yConfig.max) {
      targetY = calcY(halfTarget, yConfig.min, yConfig.max);
    }
  }

  // Pick 4-5 evenly distributed X-axis ticks
  const xTickIndices: number[] = [];
  const tickCount = Math.min(5, n);
  for (let i = 0; i < tickCount; i++) {
    const idx = Math.round((i / (tickCount - 1)) * (n - 1));
    if (!xTickIndices.includes(idx)) xTickIndices.push(idx);
  }

  // Header display score
  let currentDisplayScore = data.latestTotal || 800;
  let currentDisplayChange = data.totalChange;
  if (activeMode === 'math') {
    currentDisplayScore = data.latestMath || 400;
    currentDisplayChange = data.mathChange;
  } else if (activeMode === 'rw') {
    currentDisplayScore = data.latestRW || 400;
    currentDisplayChange = data.rwChange;
  }

  wrap.innerHTML = `
    <div class="trend-head" style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:1rem; margin-bottom:1rem;">
      <div>
        <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
          <h3 style="font-size:1.15rem; font-weight:800; color:var(--c-text); margin:0;">Estimated Score Tracker</h3>
          <span class="trend-badge-pill" style="background:linear-gradient(135deg, rgba(59,130,246,0.2), rgba(139,92,246,0.2)); color:var(--c-blue); border:1px solid rgba(59,130,246,0.3); padding:0.15rem 0.5rem; border-radius:999px; font-size:0.7rem; font-weight:700;">
            ${percentile}
          </span>
        </div>
        <p style="font-size:0.75rem; color:var(--c-text-2); margin:0.25rem 0 0 0;">
          Rolling performance modeling based on difficulty weighting across ${totalSolves} practice items.
        </p>
      </div>

      <!-- Current Score & Metric Display -->
      <div style="display:flex; align-items:center; gap:1.25rem;">
        <div style="text-align:right;">
          <div style="font-size:0.7rem; color:var(--c-text-2); font-weight:600; text-transform:uppercase; letter-spacing:0.04em;">
            ${activeMode === 'total' ? 'Projected Total' : activeMode === 'math' ? 'Math Estimate' : activeMode === 'rw' ? 'R&W Estimate' : 'Combined Estimate'}
          </div>
          <div style="display:flex; align-items:baseline; justify-content:flex-end; gap:0.35rem;">
            <span style="font-size:1.6rem; font-weight:900; color:var(--c-text); line-height:1;">
              ${currentDisplayScore}
            </span>
            <span style="font-size:0.75rem; color:var(--c-text-3); font-weight:600;">/ ${activeMode === 'total' ? '1600' : '800'}</span>
            ${currentDisplayChange !== null && currentDisplayChange !== 0 ? `
              <span style="font-size:0.75rem; font-weight:700; color:${currentDisplayChange > 0 ? 'var(--c-green)' : 'var(--c-red)'}; margin-left:0.25rem;">
                ${currentDisplayChange > 0 ? '+' : ''}${currentDisplayChange}
              </span>
            ` : ''}
          </div>
        </div>

        <!-- Target Goal Pill with edit button -->
        <button id="btn-edit-target-goal" title="Click to adjust Target SAT Score" style="background:var(--c-elevated); border:1px solid var(--c-border); padding:0.35rem 0.65rem; border-radius:8px; cursor:pointer; text-align:left; display:flex; flex-direction:column;">
          <span style="font-size:0.6rem; font-weight:600; color:var(--c-text-3); text-transform:uppercase;">Goal</span>
          <span style="font-size:0.85rem; font-weight:800; color:var(--c-amber); display:flex; align-items:center; gap:0.25rem;">
            ${targetScore}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </span>
        </button>
      </div>
    </div>

    <!-- Mode Filter Tabs -->
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; flex-wrap:wrap; gap:0.75rem;">
      <div class="trend-tabs" style="display:flex; gap:0.35rem; background:var(--c-elevated); padding:0.25rem; border-radius:8px; border:1px solid var(--c-border);">
        <button class="trend-tab-btn ${activeMode === 'total' ? 'active' : ''}" data-mode="total" style="padding:0.3rem 0.75rem; border-radius:6px; font-size:0.75rem; font-weight:700; border:none; cursor:pointer;">
          Total SAT (400–1600)
        </button>
        <button class="trend-tab-btn ${activeMode === 'both' ? 'active' : ''}" data-mode="both" style="padding:0.3rem 0.75rem; border-radius:6px; font-size:0.75rem; font-weight:700; border:none; cursor:pointer;">
          Both Sections (200–800)
        </button>
        <button class="trend-tab-btn ${activeMode === 'math' ? 'active' : ''}" data-mode="math" style="padding:0.3rem 0.75rem; border-radius:6px; font-size:0.75rem; font-weight:700; border:none; cursor:pointer;">
          Math
        </button>
        <button class="trend-tab-btn ${activeMode === 'rw' ? 'active' : ''}" data-mode="rw" style="padding:0.3rem 0.75rem; border-radius:6px; font-size:0.75rem; font-weight:700; border:none; cursor:pointer;">
          Reading &amp; Writing
        </button>
      </div>

      <!-- Legend -->
      <div style="display:flex; align-items:center; gap:1rem; font-size:0.75rem; font-weight:600; color:var(--c-text-2);">
        ${activeMode === 'total' ? `
          <span style="display:flex; align-items:center; gap:0.35rem;">
            <i style="width:10px; height:10px; border-radius:3px; background:linear-gradient(135deg, #3b82f6, #8b5cf6); display:inline-block;"></i> Total Composite
          </span>
        ` : ''}
        ${activeMode === 'both' || activeMode === 'rw' ? `
          <span style="display:flex; align-items:center; gap:0.35rem;">
            <i style="width:10px; height:10px; border-radius:3px; background:var(--c-blue); display:inline-block;"></i> R&amp;W (${data.latestRW || 400})
          </span>
        ` : ''}
        ${activeMode === 'both' || activeMode === 'math' ? `
          <span style="display:flex; align-items:center; gap:0.35rem;">
            <i style="width:10px; height:10px; border-radius:3px; background:var(--c-purple); display:inline-block;"></i> Math (${data.latestMath || 400})
          </span>
        ` : ''}
        ${targetY !== null ? `
          <span style="display:flex; align-items:center; gap:0.35rem; color:var(--c-amber);">
            <span style="width:12px; height:2px; background:var(--c-amber); border-top:1px dashed var(--c-amber); display:inline-block;"></span> Target Goal
          </span>
        ` : ''}
      </div>
    </div>

    <!-- Plot Viewport -->
    <div class="trend-plot" style="position:relative; width:100%; overflow:hidden;">
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Interactive SAT Estimated Score Tracker" style="width:100%; height:auto; max-height:300px; overflow:visible; display:block;">
        <defs>
          <linearGradient id="totalGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.32" />
            <stop offset="60%" stop-color="#8b5cf6" stop-opacity="0.10" />
            <stop offset="100%" stop-color="#8b5cf6" stop-opacity="0.0" />
          </linearGradient>
          <linearGradient id="mathGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--c-purple)" stop-opacity="0.28" />
            <stop offset="100%" stop-color="var(--c-purple)" stop-opacity="0.0" />
          </linearGradient>
          <linearGradient id="rwGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--c-blue)" stop-opacity="0.28" />
            <stop offset="100%" stop-color="var(--c-blue)" stop-opacity="0.0" />
          </linearGradient>
          <linearGradient id="totalLineGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#3b82f6" />
            <stop offset="100%" stop-color="#8b5cf6" />
          </linearGradient>
        </defs>

        <!-- Y Axis Grid Lines & Values -->
        ${yConfig.grid.map(v => {
          const yPos = calcY(v, yConfig.min, yConfig.max);
          return `
            <line x1="${PAD.left}" x2="${W - PAD.right}" y1="${yPos}" y2="${yPos}" stroke="var(--c-border)" stroke-width="1" stroke-dasharray="${v % 400 === 0 ? 'none' : '3 3'}" opacity="0.6"/>
            <text x="${PAD.left - 8}" y="${yPos + 4}" text-anchor="end" fill="var(--c-text-3)" font-size="10" font-family="var(--font)" font-weight="600">${v}</text>
          `;
        }).join('')}

        <!-- X Axis Base Line -->
        <line x1="${PAD.left}" x2="${W - PAD.right}" y1="${H - PAD.bottom}" y2="${H - PAD.bottom}" stroke="var(--c-border)" stroke-width="1.2" />

        <!-- X Axis Date Labels -->
        ${xTickIndices.map(idx => {
          const p = points[idx];
          const xPos = calcX(idx, n);
          return `
            <line x1="${xPos}" x2="${xPos}" y1="${H - PAD.bottom}" y2="${H - PAD.bottom + 4}" stroke="var(--c-border)" stroke-width="1.2" />
            <text x="${xPos}" y="${H - PAD.bottom + 16}" text-anchor="middle" fill="var(--c-text-3)" font-size="10" font-family="var(--font)" font-weight="500">${p.dateLabel}</text>
          `;
        }).join('')}

        <!-- Target Goal Line -->
        ${targetY !== null ? `
          <line x1="${PAD.left}" x2="${W - PAD.right}" y1="${targetY}" y2="${targetY}" stroke="var(--c-amber)" stroke-width="1.5" stroke-dasharray="4 4" opacity="0.85" />
          <rect x="${W - PAD.right - 80}" y="${targetY - 10}" width="76" height="18" rx="4" fill="var(--c-card)" stroke="var(--c-amber)" stroke-width="1" />
          <text x="${W - PAD.right - 42}" y="${targetY + 3}" text-anchor="middle" fill="var(--c-amber)" font-size="9" font-family="var(--font)" font-weight="800">
            GOAL ${activeMode === 'total' ? targetScore : Math.round(targetScore / 2)}
          </text>
        ` : ''}

        <!-- Render Series: Area & Lines based on activeMode -->
        ${activeMode === 'total' && totalCoords.length > 0 ? `
          <path d="${totalArea}" fill="url(#totalGradient)" />
          <path d="${totalLine}" fill="none" stroke="url(#totalLineGrad)" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" style="filter:drop-shadow(0 2px 8px rgba(59,130,246,0.3));" />
        ` : ''}

        ${(activeMode === 'both' || activeMode === 'rw') && rwCoords.length > 0 ? `
          <path d="${rwArea}" fill="url(#rwGradient)" />
          <path d="${rwLine}" fill="none" stroke="var(--c-blue)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
        ` : ''}

        ${(activeMode === 'both' || activeMode === 'math') && mathCoords.length > 0 ? `
          <path d="${mathArea}" fill="url(#mathGradient)" />
          <path d="${mathLine}" fill="none" stroke="var(--c-purple)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
        ` : ''}

        <!-- Hover Cursor Line -->
        <line id="trend-cursor-line" x1="0" x2="0" y1="${PAD.top}" y2="${H - PAD.bottom}" stroke="var(--c-text-2)" stroke-width="1.5" stroke-dasharray="3 3" style="opacity:0; pointer-events:none; transition:opacity 0.15s ease;" />

        <!-- Hover Hit Indicator Circles -->
        <circle id="trend-hit-total" r="5" fill="#8b5cf6" stroke="#fff" stroke-width="2" style="opacity:0; pointer-events:none; transition:opacity 0.15s ease;" />
        <circle id="trend-hit-math" r="5" fill="var(--c-purple)" stroke="#fff" stroke-width="2" style="opacity:0; pointer-events:none; transition:opacity 0.15s ease;" />
        <circle id="trend-hit-rw" r="5" fill="var(--c-blue)" stroke="#fff" stroke-width="2" style="opacity:0; pointer-events:none; transition:opacity 0.15s ease;" />
      </svg>

      <!-- Floating Interactive Tooltip -->
      <div id="trend-hover-tooltip" class="trend-tooltip glass" style="position:absolute; top:12px; display:none; pointer-events:none; z-index:10; background:var(--c-card); border:1px solid var(--c-border); border-radius:10px; padding:0.6rem 0.85rem; box-shadow:var(--shadow-lg); min-width:160px;"></div>
    </div>
  `;

  // Attach tab switching event listeners
  wrap.querySelectorAll<HTMLButtonElement>('.trend-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const mode = (e.currentTarget as HTMLElement).dataset.mode as ViewMode;
      if (mode && mode !== activeMode) {
        activeMode = mode;
        const fresh = renderScoreTrendChart(data);
        wrap.replaceWith(fresh);
      }
    });
  });

  // Target Goal edit modal
  wrap.querySelector('#btn-edit-target-goal')?.addEventListener('click', () => {
    openTargetGoalModal();
  });

  // Hover interaction handling
  const svg = wrap.querySelector('svg')!;
  const cursorLine = wrap.querySelector<SVGLineElement>('#trend-cursor-line')!;
  const hitTotal = wrap.querySelector<SVGCircleElement>('#trend-hit-total')!;
  const hitMath = wrap.querySelector<SVGCircleElement>('#trend-hit-math')!;
  const hitRW = wrap.querySelector<SVGCircleElement>('#trend-hit-rw')!;
  const tooltip = wrap.querySelector<HTMLElement>('#trend-hover-tooltip')!;

  function onPointerMove(e: PointerEvent) {
    const rect = svg.getBoundingClientRect();
    if (rect.width <= 0) return;
    const svgX = ((e.clientX - rect.left) / rect.width) * W;

    let closestIdx = 0;
    let minDistance = Infinity;
    for (let j = 0; j < n; j++) {
      const dist = Math.abs(calcX(j, n) - svgX);
      if (dist < minDistance) {
        minDistance = dist;
        closestIdx = j;
      }
    }

    const p = points[closestIdx];
    if (!p) return;

    const xPos = calcX(closestIdx, n);
    cursorLine.setAttribute('x1', String(xPos));
    cursorLine.setAttribute('x2', String(xPos));
    cursorLine.style.opacity = '1';

    let tipRows = `<div style="font-size:0.75rem; font-weight:700; color:var(--c-text); margin-bottom:0.35rem; border-bottom:1px solid var(--c-border); padding-bottom:0.25rem;">${p.dateLabel} · Item #${p.solvesCount}</div>`;

    if (activeMode === 'total') {
      if (p.totalScore !== null) {
        const yPos = calcY(p.totalScore, yConfig.min, yConfig.max);
        hitTotal.setAttribute('cx', String(xPos));
        hitTotal.setAttribute('cy', String(yPos));
        hitTotal.style.opacity = '1';
        tipRows += `
          <div style="display:flex; justify-content:space-between; gap:1rem; font-size:0.8rem; font-weight:700; color:var(--c-text);">
            <span style="display:flex; align-items:center; gap:0.3rem;"><span style="width:8px; height:8px; border-radius:2px; background:#8b5cf6; display:inline-block;"></span>Total SAT:</span>
            <span>${p.totalScore}</span>
          </div>
        `;
      }
      hitMath.style.opacity = '0';
      hitRW.style.opacity = '0';
    } else {
      hitTotal.style.opacity = '0';
      if ((activeMode === 'both' || activeMode === 'rw') && p.rwScore !== null) {
        const yPos = calcY(p.rwScore, yConfig.min, yConfig.max);
        hitRW.setAttribute('cx', String(xPos));
        hitRW.setAttribute('cy', String(yPos));
        hitRW.style.opacity = '1';
        tipRows += `
          <div style="display:flex; justify-content:space-between; gap:1rem; font-size:0.8rem; font-weight:600; color:var(--c-text-2);">
            <span style="display:flex; align-items:center; gap:0.3rem;"><span style="width:8px; height:8px; border-radius:2px; background:var(--c-blue); display:inline-block;"></span>R&W:</span>
            <strong style="color:var(--c-text);">${p.rwScore}</strong>
          </div>
        `;
      } else {
        hitRW.style.opacity = '0';
      }

      if ((activeMode === 'both' || activeMode === 'math') && p.mathScore !== null) {
        const yPos = calcY(p.mathScore, yConfig.min, yConfig.max);
        hitMath.setAttribute('cx', String(xPos));
        hitMath.setAttribute('cy', String(yPos));
        hitMath.style.opacity = '1';
        tipRows += `
          <div style="display:flex; justify-content:space-between; gap:1rem; font-size:0.8rem; font-weight:600; color:var(--c-text-2);">
            <span style="display:flex; align-items:center; gap:0.3rem;"><span style="width:8px; height:8px; border-radius:2px; background:var(--c-purple); display:inline-block;"></span>Math:</span>
            <strong style="color:var(--c-text);">${p.mathScore}</strong>
          </div>
        `;
      } else {
        hitMath.style.opacity = '0';
      }
    }

    tooltip.style.display = 'block';
    tooltip.innerHTML = tipRows;
    const leftPct = (xPos / W) * 100;
    tooltip.style.left = `${leftPct}%`;
    tooltip.style.transform = leftPct > 65 ? 'translateX(-105%)' : 'translateX(10px)';
  }

  function onPointerLeave() {
    cursorLine.style.opacity = '0';
    hitTotal.style.opacity = '0';
    hitMath.style.opacity = '0';
    hitRW.style.opacity = '0';
    tooltip.style.display = 'none';
  }

  svg.addEventListener('pointermove', onPointerMove);
  svg.addEventListener('pointerleave', onPointerLeave);

  return wrap;
}
