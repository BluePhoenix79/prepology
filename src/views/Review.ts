import { store } from '../state/Store';
import { generateTargetedPractice } from '../utils/recommendation';

let activeReviewSection: 'Reading and Writing' | 'Math' = 'Reading and Writing';

export function renderReview(): HTMLElement {
  const root = document.createElement('div');
  root.className = 'page-root';

  function draw() {
    const state = store.getState();
    const { mistakes } = state.stats;

    // Filter mistakes by active section
    const sectionMistakes = mistakes.filter(id => {
      const q = state.questionBank.find(x => x.id === id);
      return q && q.section === activeReviewSection;
    });

    root.innerHTML = `
      <div class="page-topbar">
        <div>
          <h1>Mistakes Log</h1>
          <p>${sectionMistakes.length} mistake${sectionMistakes.length !== 1 ? 's' : ''} in ${activeReviewSection === 'Math' ? 'Mathematics' : 'Reading & Writing'}</p>
        </div>
        <div style="display:flex;gap:0.5rem;align-items:center;">
          ${sectionMistakes.length > 0 ? `
            <button class="btn" id="practice-btn" style="font-size:0.875rem;">Practice Weak Areas</button>
            <button class="btn" id="practice-missed-btn" style="font-size:0.875rem; background: var(--c-red, #f43f5e); color:#fff; border:none; cursor:pointer;">Practice Missed Questions</button>
          ` : ''}
          <button class="btn-ghost btn" id="back-btn" style="font-size:0.875rem;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:0.25rem;"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
            Dashboard
          </button>
        </div>
      </div>

      <div class="op-section-tabs" style="margin-bottom:1.5rem;">
        <button class="op-tab ${activeReviewSection === 'Reading and Writing' ? 'active' : ''}" id="tab-rw">Reading & Writing</button>
        <button class="op-tab ${activeReviewSection === 'Math' ? 'active' : ''}" id="tab-math">Mathematics</button>
      </div>

      <div id="list"></div>
    `;

    root.querySelector('#back-btn')?.addEventListener('click', () => store.setView('dashboard'));

    root.querySelector('#tab-rw')?.addEventListener('click', () => {
      activeReviewSection = 'Reading and Writing';
      draw();
    });

    root.querySelector('#tab-math')?.addEventListener('click', () => {
      activeReviewSection = 'Math';
      draw();
    });

    root.querySelector('#practice-btn')?.addEventListener('click', () => {
      const recs = generateTargetedPractice(state, 10).filter(q => q.section === activeReviewSection);
      if (recs.length === 0) {
        alert('No matching questions found.');
        return;
      }
      store.startTargetedSession(recs);
    });

    root.querySelector('#practice-missed-btn')?.addEventListener('click', () => {
      const missedQs = sectionMistakes.map(id => state.questionBank.find(x => x.id === id)).filter(Boolean) as any;
      if (missedQs.length === 0) {
        alert('No missed questions found.');
        return;
      }
      store.startTargetedSession(missedQs);
    });

    const listEl = root.querySelector('#list')!;

    if (sectionMistakes.length === 0) {
      listEl.innerHTML = `
        <div class="glass empty-state">
          <h2>No mistakes yet!</h2>
          <p>Great job! You have no recorded mistakes in ${activeReviewSection === 'Math' ? 'Mathematics' : 'Reading & Writing'}.</p>
        </div>
      `;
      return;
    }

    sectionMistakes.forEach(id => {
      const q = state.questionBank.find(x => x.id === id);
      if (!q) return;

      const isMathQ = q.section === 'Math';
      const card = document.createElement('div');
      card.className = 'mistake-card';
      card.innerHTML = `
        <div class="mistake-tags">
          <span class="m-tag">${q.section}</span>
          <span class="m-tag">${q.domain}</span>
          <span class="m-tag">${q.skill}</span>
          <span class="m-tag m-tag--err">Difficulty ${q.difficulty === 1 ? 'Easy' : q.difficulty === 2 ? 'Medium' : 'Hard'}</span>
        </div>
        ${q.passageText && isMathQ ? `
          <div style="margin-bottom:0.75rem;padding:0.75rem;background:var(--c-surface-2,#f8f9fa);border-radius:0.5rem;text-align:center;">${q.passageText}</div>
        ` : ''}
        <div style="font-size:0.9375rem;line-height:1.65;margin-bottom:0.25rem;">${q.questionText}</div>
        ${q.passageText && !isMathQ ? `
          <details style="margin:0.625rem 0;">
            <summary style="cursor:pointer;font-size:0.8125rem;color:var(--c-blue);font-weight:500;user-select:none;">View passage &#9658;</summary>
            <div style="margin-top:0.75rem;font-family:var(--font-serif);font-size:0.9375rem;line-height:1.85;color:var(--c-text-2);padding:0.75rem 0;">${q.passageText}</div>
          </details>
        ` : ''}
        <div class="rationale-block" style="margin-top: 1rem;">
          <button class="btn btn-ghost show-explanation-btn" style="font-size: 0.78rem; padding: 0.35rem 0.75rem; border-radius: 6px; border: 1px solid var(--c-border); color: var(--c-blue); background: transparent; cursor: pointer; font-family: var(--font);">Show Explanation</button>
          <div class="explanation-content" style="display: none; margin-top: 1rem;">
            <div class="rationale-answer" style="margin-bottom: 0.5rem; font-weight: 700; color: #10b981; display:flex; align-items:center;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:0.25rem;"><polyline points="20 6 9 17 4 12"></polyline></svg>
              Correct Answer: ${q.correctAnswer}
            </div>
            <div class="rationale-text">${q.rationale}</div>
          </div>
        </div>
        <p style="margin-top:0.625rem;font-size:0.7rem;color:var(--c-text-3);">ID: ${q.id.replace(/_(read|math)$/i, '')}</p>
      `;
      listEl.appendChild(card);
    });

    root.querySelectorAll('.show-explanation-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const parent = (e.currentTarget as HTMLElement).parentElement;
        const content = parent?.querySelector('.explanation-content') as HTMLElement | null;
        if (content) {
          const isHidden = content.style.display === 'none';
          content.style.display = isHidden ? 'block' : 'none';
          (e.currentTarget as HTMLElement).textContent = isHidden ? 'Hide Explanation' : 'Show Explanation';
        }
      });
    });
  }

  draw();
  return root;
}
