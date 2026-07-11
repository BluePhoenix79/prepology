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
          ${sectionMistakes.length > 0 ? `<button class="btn" id="practice-btn" style="font-size:0.875rem;">Practice Weak Areas →</button>` : ''}
          <button class="btn-ghost btn" id="back-btn" style="font-size:0.875rem;">← Dashboard</button>
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
        <div class="rationale-block">
          <div class="rationale-answer">✓ Correct Answer: ${q.correctAnswer}</div>
          <div class="rationale-text">${q.rationale}</div>
        </div>
        <p style="margin-top:0.625rem;font-size:0.7rem;color:var(--c-text-3);">ID: ${q.id.replace(/_(read|math)$/i, '')}</p>
      `;
      listEl.appendChild(card);
    });
  }

  draw();
  return root;
}
