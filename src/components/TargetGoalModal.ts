import { store } from '../state/Store';
import { getSatPercentile } from '../utils/scoreTrend';

export function openTargetGoalModal(onSave?: (newGoal: number) => void) {
  const existing = document.getElementById('sat-goal-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'sat-goal-modal';
  modal.style.position = 'fixed';
  modal.style.inset = '0';
  modal.style.zIndex = '100000';
  modal.style.display = 'flex';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';
  modal.style.background = 'rgba(0, 0, 0, 0.7)';
  modal.style.backdropFilter = 'blur(6px)';

  const currentGoal = store.getState().stats.targetScore || 1500;

  modal.innerHTML = `
    <div style="background:var(--c-card); border:1px solid var(--c-border); border-radius:18px; width:min(460px, 92vw); padding:1.75rem; box-shadow:0 25px 50px rgba(0,0,0,0.5); font-family:var(--font);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem;">
        <div>
          <h3 style="margin:0; font-size:1.25rem; font-weight:800; color:var(--c-text); display:flex; align-items:center; gap:0.5rem;">
            🎯 Set Target SAT Score
          </h3>
          <p style="margin:0.25rem 0 0 0; font-size:0.8rem; color:var(--c-text-2);">
            Customize your benchmark goal shown on your Estimated Score Tracker.
          </p>
        </div>
        <button id="goal-modal-close" style="background:none; border:none; color:var(--c-text-2); font-size:1.25rem; cursor:pointer; padding:0.25rem 0.5rem;">✕</button>
      </div>

      <div style="display:flex; flex-direction:column; gap:1.25rem;">
        <div>
          <label style="font-size:0.75rem; font-weight:700; color:var(--c-text-2); display:block; margin-bottom:0.5rem; text-transform:uppercase; letter-spacing:0.05em;">
            Target Score (400 – 1600)
          </label>
          <div style="position:relative; display:flex; align-items:center;">
            <input type="number" id="goal-score-input" min="400" max="1600" step="10" value="${currentGoal}"
                   style="width:100%; padding:0.75rem 1rem; border-radius:12px; border:1px solid var(--c-border); background:var(--c-elevated); color:var(--c-text); font-size:1.4rem; font-weight:800; font-family:var(--font); outline:none;" />
            <span style="position:absolute; right:1rem; font-size:0.9rem; font-weight:600; color:var(--c-text-3);">/ 1600</span>
          </div>
          
          <div id="goal-percentile-hint" style="margin-top:0.45rem; font-size:0.75rem; font-weight:700; color:var(--c-blue);">
            ${getSatPercentile(currentGoal)}
          </div>

          <!-- Quick Preset Chips -->
          <div style="display:flex; gap:0.4rem; margin-top:0.85rem; flex-wrap:wrap;">
            ${[1300, 1350, 1400, 1450, 1500, 1550, 1600].map(s => `
              <button type="button" class="btn btn-sm goal-preset-btn" data-val="${s}" style="padding:0.3rem 0.65rem; font-size:0.75rem; font-weight:700; border-radius:8px; background:var(--c-elevated); border:1px solid var(--c-border); color:var(--c-text-2); cursor:pointer;">
                ${s}
              </button>
            `).join('')}
          </div>
        </div>
      </div>

      <div style="display:flex; justify-content:flex-end; gap:0.75rem; margin-top:1.75rem; border-top:1px solid var(--c-border); padding-top:1.25rem;">
        <button id="goal-cancel-btn" class="btn btn-ghost" style="padding:0.6rem 1.25rem; border-radius:10px;">Cancel</button>
        <button id="goal-save-btn" class="btn op-btn-primary" style="background:var(--c-blue); color:#fff; font-weight:700; padding:0.6rem 1.5rem; border-radius:10px; cursor:pointer; box-shadow:var(--shadow-md);">Save Goal</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const inputEl = modal.querySelector<HTMLInputElement>('#goal-score-input')!;
  const hintEl = modal.querySelector<HTMLElement>('#goal-percentile-hint')!;

  const updateHint = () => {
    const val = parseInt(inputEl.value, 10);
    if (!isNaN(val) && val >= 400 && val <= 1600) {
      hintEl.textContent = getSatPercentile(val);
    } else {
      hintEl.textContent = 'Enter a score between 400 and 1600';
    }
  };

  inputEl.addEventListener('input', updateHint);

  modal.querySelectorAll('.goal-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const v = (btn as HTMLElement).dataset.val;
      if (v) {
        inputEl.value = v;
        updateHint();
      }
    });
  });

  const close = () => modal.remove();
  modal.querySelector('#goal-modal-close')?.addEventListener('click', close);
  modal.querySelector('#goal-cancel-btn')?.addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

  modal.querySelector('#goal-save-btn')?.addEventListener('click', () => {
    const raw = parseInt(inputEl.value, 10);
    const goal = isNaN(raw) ? 1500 : Math.max(400, Math.min(1600, raw));
    store.setTargetScore(goal);
    close();
    if (onSave) onSave(goal);
  });
}
