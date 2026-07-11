import { store } from '../state/Store';

const VOCAB = [
  { word: 'Ubiquitous',    def: 'Present, appearing, or found everywhere.',                                     ex: 'Smartphones have become ubiquitous in modern society.' },
  { word: 'Ephemeral',     def: 'Lasting for a very short time; transitory.',                                   ex: 'The ephemeral beauty of cherry blossoms draws millions to Japan each spring.' },
  { word: 'Sycophant',     def: 'A person who acts obsequiously toward someone important to gain advantage.',   ex: 'The politician was surrounded by sycophants who praised his every move.' },
  { word: 'Pernicious',    def: 'Having a harmful effect, especially in a gradual or subtle way.',              ex: 'The pernicious spread of misinformation eroded public trust over time.' },
  { word: 'Alacrity',      def: 'Brisk and cheerful readiness.',                                               ex: 'She accepted the challenge with alacrity, eager to prove herself.' },
  { word: 'Mellifluous',   def: '(Of a voice or words) pleasingly smooth and musical to hear.',                ex: 'The speaker\'s mellifluous voice kept the audience completely captivated.' },
  { word: 'Perfunctory',   def: 'Carried out with minimal effort or attention.',                               ex: 'The officer gave only a perfunctory glance at the documents before signing.' },
  { word: 'Recondite',     def: 'Not known by many people; obscure.',                                          ex: 'Her thesis explored the recondite history of medieval manuscript production.' },
  { word: 'Equivocate',    def: 'Use ambiguous language to conceal the truth or avoid commitment.',             ex: 'When pressed on the budget, the official began to equivocate.' },
  { word: 'Tendentious',   def: 'Promoting a particular cause or point of view; biased.',                      ex: 'Critics dismissed the documentary as tendentious rather than objective.' },
  { word: 'Inimical',      def: 'Tending to obstruct or harm; hostile.',                                       ex: 'Such high pollution levels are inimical to public health.' },
  { word: 'Prodigious',    def: 'Remarkably great in extent, size, or degree.',                                ex: 'Mozart showed a prodigious musical talent from a very young age.' },
  { word: 'Laconic',       def: 'Using very few words; brief and concise.',                                    ex: 'His laconic reply—"I\'ll try"—left little room for optimism.' },
  { word: 'Loquacious',    def: 'Tending to talk a great deal; talkative.',                                    ex: 'The loquacious host kept the party energized with endless anecdotes.' },
  { word: 'Solicitous',    def: 'Showing interest or concern; anxious about someone\'s wellbeing.',            ex: 'The nurse was solicitous of the patient\'s comfort throughout treatment.' },
];

let idx = 0;
let flipped = false;
let filterMode: 'all' | 'saved' = 'all';

function getBookmarkedVocab(): string[] {
  try {
    const list = localStorage.getItem('prepology_vocab_bookmarks') || localStorage.getItem('preplogy_vocab_bookmarks');
    return list ? JSON.parse(list) : [];
  } catch (e) {
    return [];
  }
}

function toggleBookmark(word: string) {
  let list = getBookmarkedVocab();
  if (list.includes(word)) {
    list = list.filter(w => w !== word);
  } else {
    list.push(word);
  }
  localStorage.setItem('prepology_vocab_bookmarks', JSON.stringify(list));
}

export function renderVocab(): HTMLElement {
  const root = document.createElement('div');
  root.className = 'page-root';
  root.style.cssText = 'display:flex;flex-direction:column;';

  function draw() {
    root.innerHTML = '';
    const bookmarks = getBookmarkedVocab();

    const filteredList = filterMode === 'all' 
      ? VOCAB 
      : VOCAB.filter(w => bookmarks.includes(w.word));

    if (idx >= filteredList.length) {
      idx = Math.max(0, filteredList.length - 1);
    }

    const hasWords = filteredList.length > 0;
    const w = hasWords ? filteredList[idx] : null;
    const isBookmarked = w ? bookmarks.includes(w.word) : false;

    root.innerHTML = `
      <div class="page-topbar">
        <div>
          <h1>Vocabulary Flashcards</h1>
          <p>Study key digital SAT vocabulary words · ${bookmarks.length} bookmarked</p>
        </div>
        <div style="display:flex;gap:0.75rem;align-items:center;">
          <select id="vocab-filter-select" class="op-select" style="font-size:0.85rem;padding:0.25rem 1.5rem 0.25rem 0.5rem;background:#1e293b;border:1px solid #475569;color:#fff;">
            <option value="all" ${filterMode === 'all' ? 'selected' : ''}>Show: All Words (${VOCAB.length})</option>
            <option value="saved" ${filterMode === 'saved' ? 'selected' : ''}>Show: Bookmarked (${bookmarks.length})</option>
          </select>
          <button class="btn-ghost btn" id="back-btn" style="font-size:0.875rem;">← Dashboard</button>
        </div>
      </div>

      <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.75rem;padding-bottom:2rem;">

        ${hasWords && w ? `
          <div class="vocab-scene">
            <div class="vocab-card ${flipped ? 'flipped' : ''}" id="card">

              <div class="vocab-face vocab-front">
                <div style="position:absolute;top:1rem;right:1rem;z-index:100;cursor:pointer;" id="bookmark-toggle" title="Bookmark word">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="${isBookmarked ? '#f59e0b' : 'none'}" stroke="${isBookmarked ? '#f59e0b' : 'currentColor'}" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                </div>
                <p style="font-size:0.7rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:var(--c-text-3);margin-bottom:0.875rem;">Word ${idx + 1} of ${filteredList.length}</p>
                <h2 style="font-size:2.25rem;font-weight:800;letter-spacing:-0.03em;color:var(--c-blue);line-height:1.1;">${w.word}</h2>
                <p style="margin-top:1rem;font-size:0.8rem;color:var(--c-text-3);">Click card or press Flip button to reveal definition</p>
              </div>

              <div class="vocab-face vocab-back">
                <div style="position:absolute;top:1rem;right:1rem;z-index:100;cursor:pointer;" id="bookmark-toggle-back" title="Bookmark word">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="${isBookmarked ? '#f59e0b' : 'none'}" stroke="${isBookmarked ? '#f59e0b' : 'currentColor'}" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                </div>
                <h3 style="font-size:1.1rem;font-weight:800;color:var(--c-blue);margin-bottom:0.75rem;">${w.word}</h3>
                <p style="font-size:1rem;line-height:1.65;color:var(--c-text);margin-bottom:0.875rem;">${w.def}</p>
                <p style="font-size:0.875rem;font-style:italic;line-height:1.55;color:var(--c-text-2);border-top:1px dashed var(--c-border);padding-top:0.75rem;margin-top:0.5rem;">"${w.ex}"</p>
              </div>
            </div>
          </div>

          <div style="display:flex;gap:0.75rem;align-items:center;">
            <button class="btn-ghost btn" id="prev-btn" ${idx === 0 ? 'disabled' : ''} style="font-size:0.875rem;">← Prev</button>
            <button class="btn-ghost btn" id="flip-btn" style="font-size:0.875rem;">Flip</button>
            <button class="btn" id="next-btn" ${idx === filteredList.length - 1 ? 'disabled' : ''} style="font-size:0.875rem;">Next →</button>
          </div>

          <div class="vocab-dot-nav">
            ${filteredList.map((_, i) => `<div class="vocab-dot${i === idx ? ' active' : ''}"></div>`).join('')}
          </div>
        ` : `
          <div class="glass empty-state" style="padding: 3rem; text-align: center; max-width: 400px; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px;">
            <h2>No bookmarked words</h2>
            <p style="color: #64748b; margin-top: 0.5rem; font-size: 0.9rem;">Bookmark words during study to review them here.</p>
          </div>
        `}
      </div>
    `;

    root.querySelector('#back-btn')?.addEventListener('click', () => store.setView('dashboard'));
    root.querySelector('#vocab-filter-select')?.addEventListener('change', (e) => {
      filterMode = (e.target as HTMLSelectElement).value as any;
      idx = 0;
      flipped = false;
      draw();
    });

    if (hasWords && w) {
      const handleFlip = () => { flipped = !flipped; draw(); };
      root.querySelector('#card')?.addEventListener('click', (e) => {
        // Prevent flipping if they clicked the bookmark star
        const target = e.target as HTMLElement;
        if (target.closest('#bookmark-toggle') || target.closest('#bookmark-toggle-back')) return;
        handleFlip();
      });
      root.querySelector('#flip-btn')?.addEventListener('click', handleFlip);

      const handleBookmarkToggle = () => {
        toggleBookmark(w.word);
        draw();
      };
      root.querySelector('#bookmark-toggle')?.addEventListener('click', handleBookmarkToggle);
      root.querySelector('#bookmark-toggle-back')?.addEventListener('click', handleBookmarkToggle);

      root.querySelector('#prev-btn')?.addEventListener('click', () => { if (idx > 0) { idx--; flipped = false; draw(); } });
      root.querySelector('#next-btn')?.addEventListener('click', () => { if (idx < filteredList.length - 1) { idx++; flipped = false; draw(); } });
    }
  }

  draw();
  return root;
}
