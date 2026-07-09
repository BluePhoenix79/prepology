import { store } from '../state/Store';
import { generateTargetedPractice } from '../utils/recommendation';

export function renderReview(): HTMLElement {
  const root = document.createElement('div');
  root.className = 'page-root';

  const state   = store.getState();
  const { mistakes, questionsAttempted, correctAnswers } = state.stats;

  root.innerHTML = `
    <div class="page-topbar">
      <div>
        <h1>Mistakes Log</h1>
        <p>${mistakes.length} mistake${mistakes.length !== 1 ? 's' : ''} · ${questionsAttempted} questions attempted · ${correctAnswers} correct</p>
      </div>
      <div style="display:flex;gap:0.5rem;align-items:center;">
        ${mistakes.length > 0 ? `<button class="btn" id="practice-btn" style="font-size:0.875rem;">Practice Weak Areas →</button>` : ''}
        <button class="btn-ghost btn" id="back-btn" style="font-size:0.875rem;">← Dashboard</button>
      </div>
    </div>
    <div id="list"></div>
  `;

  root.querySelector('#back-btn')?.addEventListener('click', () => store.setView('dashboard'));

  root.querySelector('#practice-btn')?.addEventListener('click', () => {
    const recs = generateTargetedPractice(state, 10);
    if (recs.length === 0) { alert('No matching questions found.'); return; }
    store.startTargetedSession(recs);
  });

  const list = root.querySelector('#list')!;

  if (mistakes.length === 0) {
    list.innerHTML = `
      <div class="glass empty-state">
        <h2>No mistakes yet!</h2>
        <p>Practice to identify areas for improvement.</p>
      </div>
    `;
    return root;
  }

  mistakes.forEach(id => {
    const q = state.questionBank.find(x => x.id === id);
    if (!q) return;

    const card = document.createElement('div');
    card.className = 'mistake-card';
    card.innerHTML = `
      <div class="mistake-tags">
        <span class="m-tag">${q.section}</span>
        <span class="m-tag">${q.domain}</span>
        <span class="m-tag">${q.skill}</span>
        ${q.tags.map(t => `<span class="m-tag">#${t}</span>`).join('')}
        <span class="m-tag m-tag--err">Difficulty ${q.difficulty}</span>
      </div>
      <p style="font-size:0.9375rem;line-height:1.65;margin-bottom:0.25rem;">${q.questionText}</p>
      ${q.passageText ? `
        <details style="margin:0.625rem 0;">
          <summary style="cursor:pointer;font-size:0.8125rem;color:var(--c-blue);font-weight:500;user-select:none;">View passage ▸</summary>
          <p style="margin-top:0.75rem;font-family:var(--font-serif);font-size:0.9375rem;line-height:1.85;color:var(--c-text-2);padding:0.75rem 0;">${q.passageText}</p>
        </details>
      ` : ''}
      <div class="rationale-block">
        <div class="rationale-answer">✓ Correct Answer: ${q.correctAnswer}</div>
        <div class="rationale-text">${q.rationale}</div>
      </div>
      <p style="margin-top:0.625rem;font-size:0.7rem;color:var(--c-text-3);">ID: ${q.id}</p>
    `;
    list.appendChild(card);
  });

  return root;
}
