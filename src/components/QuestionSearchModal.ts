import { store } from '../state/Store';

export function openQuestionSearchModal() {
  const existing = document.getElementById('question-search-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'question-search-modal';
  modal.className = 'glass';
  Object.assign(modal.style, {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: 'min(760px, 92vw)',
    maxHeight: '86vh',
    background: 'var(--c-card)',
    border: '1px solid var(--c-border)',
    borderRadius: '16px',
    boxShadow: '0 20px 45px rgba(0,0,0,0.45)',
    zIndex: '100000',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  });

  const backdrop = document.createElement('div');
  backdrop.id = 'question-search-backdrop';
  Object.assign(backdrop.style, {
    position: 'fixed',
    inset: '0',
    background: 'rgba(0,0,0,0.6)',
    backdropFilter: 'blur(4px)',
    zIndex: '99999'
  });

  modal.innerHTML = `
    <!-- Header -->
    <div style="padding:1.25rem 1.5rem; border-bottom:1px solid var(--c-border); display:flex; justify-content:space-between; align-items:center; background:var(--c-elevated);">
      <div>
        <h3 style="margin:0; font-size:1.15rem; font-weight:800; color:var(--c-text); display:flex; align-items:center; gap:0.5rem;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          Question Bank Search &amp; ID Lookup
        </h3>
        <p style="margin:0.25rem 0 0 0; font-size:0.75rem; color:var(--c-text-2);">
          Search all 6,000+ SAT questions by Question ID (e.g. 070615-DC) or keyword.
        </p>
      </div>
      <button id="search-modal-close" class="btn btn-ghost" style="border:none; font-size:1.25rem; cursor:pointer; color:var(--c-text-2); padding:0.25rem 0.5rem;">✕</button>
    </div>

    <!-- Search Input & Filters -->
    <div style="padding:1rem 1.5rem; border-bottom:1px solid var(--c-border); display:flex; gap:0.75rem; align-items:center; flex-wrap:wrap;">
      <div style="flex:1; min-width:260px; position:relative;">
        <input type="text" id="q-search-input" placeholder="Search by ID (e.g. 022222-DC) or prompt keywords..." 
               style="width:100%; padding:0.6rem 1rem 0.6rem 2.2rem; border-radius:8px; border:1px solid var(--c-border); background:var(--c-elevated); color:var(--c-text); font-size:0.875rem; outline:none; font-family:var(--font);" autofocus />
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="position:absolute; left:0.75rem; top:50%; transform:translateY(-50%); color:var(--c-text-3);">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
      </div>
      <select id="q-search-section" class="op-select" style="padding:0.5rem 1.25rem 0.5rem 0.65rem; font-size:0.8rem;">
        <option value="all">All Sections</option>
        <option value="Math">Math</option>
        <option value="Reading and Writing">Reading &amp; Writing</option>
      </select>
    </div>

    <!-- Results Body -->
    <div id="q-search-results" style="flex:1; overflow-y:auto; padding:1rem 1.5rem; display:flex; flex-direction:column; gap:0.75rem; min-height:260px; max-height:55vh;">
      <div style="text-align:center; color:var(--c-text-3); font-size:0.85rem; padding:3rem 0;">
        Type an ID (e.g. "070615" or "022222") or topic name to search questions.
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);
  document.body.appendChild(modal);

  const close = () => {
    backdrop.remove();
    modal.remove();
  };

  backdrop.addEventListener('click', close);
  modal.querySelector('#search-modal-close')?.addEventListener('click', close);

  const input = modal.querySelector<HTMLInputElement>('#q-search-input')!;
  const sectionSelect = modal.querySelector<HTMLSelectElement>('#q-search-section')!;
  const resultsContainer = modal.querySelector<HTMLElement>('#q-search-results')!;

  input.focus();

  function performSearch() {
    const term = input.value.trim().toLowerCase();
    const sectionFilter = sectionSelect.value;
    const allQuestions = store.getState().questionBank;

    if (!term && sectionFilter === 'all') {
      resultsContainer.innerHTML = `
        <div style="text-align:center; color:var(--c-text-3); font-size:0.85rem; padding:3rem 0;">
          Type an ID (e.g. "070615" or "022222") or topic name to search questions.
        </div>
      `;
      return;
    }

    const matched = allQuestions.filter(q => {
      if (sectionFilter !== 'all' && q.section !== sectionFilter) return false;
      if (!term) return true;

      // Match ID
      if (q.id.toLowerCase().includes(term)) return true;
      // Match domain / skill
      if (q.domain.toLowerCase().includes(term) || q.skill.toLowerCase().includes(term)) return true;
      // Match question prompt text
      if (q.questionText && q.questionText.toLowerCase().includes(term)) return true;
      if (q.passageText && q.passageText.toLowerCase().includes(term)) return true;
      return false;
    });

    if (matched.length === 0) {
      resultsContainer.innerHTML = `
        <div style="text-align:center; color:var(--c-text-2); font-size:0.85rem; padding:3rem 0;">
          No questions found matching "<strong>${term}</strong>". Try another keyword or question ID.
        </div>
      `;
      return;
    }

    const previewList = matched.slice(0, 35);

    resultsContainer.innerHTML = `
      <div style="font-size:0.75rem; color:var(--c-text-3); margin-bottom:0.25rem;">
        Showing ${previewList.length} of ${matched.length} questions
      </div>
      ${previewList.map(q => {
        const cleanText = q.questionText.replace(/<[^>]+>/g, ' ').slice(0, 140);
        const diffLabel = q.difficulty === 3 ? 'Hard' : q.difficulty === 2 ? 'Medium' : 'Easy';
        const diffColor = q.difficulty === 3 ? 'var(--c-red)' : q.difficulty === 2 ? 'var(--c-amber)' : 'var(--c-green)';

        return `
          <div class="q-search-item" data-id="${q.id}" style="background:var(--c-elevated); border:1px solid var(--c-border); border-radius:10px; padding:0.85rem 1rem; cursor:pointer; display:flex; justify-content:space-between; align-items:center; gap:1rem; transition:border-color 0.15s ease;">
            <div style="flex:1; min-width:0;">
              <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.3rem; flex-wrap:wrap;">
                <strong style="font-size:0.85rem; color:var(--c-blue); font-family:monospace;">${q.id}</strong>
                <span style="font-size:0.7rem; background:var(--c-card); border:1px solid var(--c-border); border-radius:4px; padding:0.1rem 0.4rem; color:var(--c-text-2);">
                  ${q.section}
                </span>
                <span style="font-size:0.7rem; color:${diffColor}; font-weight:700;">
                  ● ${diffLabel}
                </span>
                <span style="font-size:0.7rem; color:var(--c-text-3);">
                  ${q.skill}
                </span>
              </div>
              <div style="font-size:0.8rem; color:var(--c-text-2); line-height:1.4; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                ${cleanText}...
              </div>
            </div>
            <button class="btn btn-sm op-btn-primary btn-practice-single" data-id="${q.id}" style="font-size:0.75rem; padding:0.35rem 0.75rem; border-radius:6px; background:var(--c-blue); color:#fff; flex-shrink:0;">
              Practice →
            </button>
          </div>
        `;
      }).join('')}
    `;

    // Attach click listeners
    resultsContainer.querySelectorAll('.btn-practice-single').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = (e.currentTarget as HTMLElement).dataset.id!;
        const targetQ = allQuestions.find(x => x.id === id);
        if (targetQ) {
          close();
          store.startTargetedSession([targetQ]);
        }
      });
    });

    resultsContainer.querySelectorAll('.q-search-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).dataset.id!;
        const targetQ = allQuestions.find(x => x.id === id);
        if (targetQ) {
          close();
          store.startTargetedSession([targetQ]);
        }
      });
    });
  }

  let searchTimeout: any = null;
  input.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(performSearch, 150);
  });
  sectionSelect.addEventListener('change', performSearch);
}
