import { store } from '../state/Store';

let activeSavedSection: 'Reading and Writing' | 'Math' = 'Reading and Writing';

export function renderSaved(): HTMLElement {
  const root = document.createElement('div');
  root.className = 'page-root';

  function draw() {
    const state = store.getState();
    const { savedQuestions } = state.stats;
    const list = savedQuestions || [];

    // Filter bookmarked questions by active section
    const sectionSaved = list.filter(id => {
      const q = state.questionBank.find(x => x.id === id);
      return q && q.section === activeSavedSection;
    });

    root.innerHTML = `
      <div class="page-topbar">
        <div>
          <h1>Saved Questions</h1>
          <p>${sectionSaved.length} bookmarked question${sectionSaved.length !== 1 ? 's' : ''} in ${activeSavedSection === 'Math' ? 'Mathematics' : 'Reading & Writing'}</p>
        </div>
        <div style="display:flex;gap:0.5rem;align-items:center;">
          ${sectionSaved.length > 0 ? `<button class="btn" id="practice-saved-btn" style="font-size:0.875rem;">Practice Bookmarks →</button>` : ''}
          <button class="btn-ghost btn" id="back-btn" style="font-size:0.875rem;">← Dashboard</button>
        </div>
      </div>

      <div class="op-section-tabs" style="margin-bottom:1.5rem;">
        <button class="op-tab ${activeSavedSection === 'Reading and Writing' ? 'active' : ''}" id="tab-rw">Reading & Writing</button>
        <button class="op-tab ${activeSavedSection === 'Math' ? 'active' : ''}" id="tab-math">Mathematics</button>
      </div>

      <div id="saved-list"></div>
    `;

    root.querySelector('#back-btn')?.addEventListener('click', () => store.setView('dashboard'));

    root.querySelector('#tab-rw')?.addEventListener('click', () => {
      activeSavedSection = 'Reading and Writing';
      draw();
    });

    root.querySelector('#tab-math')?.addEventListener('click', () => {
      activeSavedSection = 'Math';
      draw();
    });

    root.querySelector('#practice-saved-btn')?.addEventListener('click', () => {
      const questionsToPractice = sectionSaved
        .map(id => state.questionBank.find(q => q.id === id))
        .filter((q): q is typeof state.questionBank[0] => !!q)
        .map(q => ({ id: q.id, section: q.section }));

      if (questionsToPractice.length === 0) return;
      store.startTargetedSession(questionsToPractice);
    });

    const savedListEl = root.querySelector('#saved-list')!;

    if (sectionSaved.length === 0) {
      savedListEl.innerHTML = `
        <div class="glass empty-state">
          <h2>No bookmarks yet!</h2>
          <p>Save questions during practice to build a study list in ${activeSavedSection === 'Math' ? 'Mathematics' : 'Reading & Writing'}.</p>
        </div>
      `;
      return;
    }

    sectionSaved.forEach(id => {
      const q = state.questionBank.find(x => x.id === id);
      if (!q) return;

      const card = document.createElement('div');
      card.className = 'mistake-card'; // Reuse style
      card.innerHTML = `
        <div class="mistake-tags">
          <span class="m-tag">${q.section}</span>
          <span class="m-tag">${q.domain}</span>
          <span class="m-tag">${q.skill}</span>
          <span class="m-tag m-tag--err">Difficulty ${q.difficulty === 1 ? 'Easy' : q.difficulty === 2 ? 'Medium' : 'Hard'}</span>
        </div>
        <div style="font-size:0.9375rem;line-height:1.65;margin-bottom:0.25rem;">${q.questionText}</div>
        ${q.passageText ? `
          <details style="margin:0.625rem 0;">
            <summary style="cursor:pointer;font-size:0.8125rem;color:var(--c-blue);font-weight:500;user-select:none;">View passage ▸</summary>
            <div style="margin-top:0.75rem;font-family:var(--font-serif);font-size:0.9375rem;line-height:1.85;color:var(--c-text-2);padding:0.75rem 0;">${q.passageText}</div>
          </details>
        ` : ''}

        <div style="margin-top: 1rem; border-top: 1px solid var(--c-border); padding-top: 1rem;">
          <details style="margin:0.5rem 0;">
            <summary style="cursor:pointer;font-size:0.8125rem;color:var(--c-blue);font-weight:500;user-select:none;">Show Answer & Explanation ▸</summary>
            <div class="rationale-block" style="margin-top: 0.5rem;">
              <div class="rationale-answer">✓ Correct Answer: ${q.correctAnswer}</div>
              <div class="rationale-text">${q.rationale}</div>
            </div>
          </details>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:1rem;">
          <span style="font-size:0.7rem;color:var(--c-text-3);">ID: ${q.id.replace(/_(read|math)$/i, '')}</span>
          <button class="btn-ghost btn btn-sm remove-bookmark-btn" data-id="${q.id}" style="padding: 0.25rem 0.75rem; font-size: 0.75rem;">Remove Bookmark</button>
        </div>
      `;

      card.querySelector('.remove-bookmark-btn')?.addEventListener('click', (e) => {
        const qId = (e.currentTarget as HTMLElement).dataset.id!;
        store.toggleSaveQuestion(qId);
        draw();
      });

      savedListEl.appendChild(card);
    });
  }

  draw();
  return root;
}
