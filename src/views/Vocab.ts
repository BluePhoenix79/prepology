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
  { word: 'Anomalous',     def: 'Deviating from what is standard, normal, or expected.',                        ex: 'The scientists noted an anomalous temperature reading in the Arctic.' },
  { word: 'Assiduous',     def: 'Showing great care and perseverance.',                                        ex: 'She was assiduous in her prep, spending hours reviewing every question.' },
  { word: 'Capricious',    def: 'Given to sudden and unaccountable changes of mood or behavior.',              ex: 'The administration made capricious decisions that confused teachers.' },
  { word: 'Chicanery',     def: 'The use of trickery to achieve a political, financial, or legal purpose.',    ex: 'The lawyer exposed the corporate chicanery behind the secret merger.' },
  { word: 'Diatribe',      def: 'A forceful and bitter verbal attack against someone or something.',            ex: 'The columnist wrote a harsh diatribe criticizing the new transit plan.' },
  { word: 'Egregious',     def: 'Outstandingly bad; shocking.',                                                ex: 'The editor made an egregious typo on the front page of the magazine.' },
  { word: 'Eschew',        def: 'Deliberately avoid using; abstain from.',                                     ex: 'Strict athletes eschew processed foods in favor of whole ingredients.' },
  { word: 'Fastidious',    def: 'Very attentive to and concerned about accuracy and detail.',                  ex: 'The fastidious gardener trimmed every hedge to a perfect geometric angle.' },
  { word: 'Garrulous',     def: 'Excessively talkative, especially on trivial matters.',                       ex: 'He became garrulous after a few cups of coffee, talking for hours.' },
  { word: 'Iconoclast',    def: 'A person who attacks cherished beliefs or institutions.',                     ex: 'The modern artist was hailed as an iconoclast who challenged conventions.' },
  { word: 'Impulsive',     def: 'Acting or done without forethought.',                                         ex: 'His impulsive purchase of a sports car shocked his family.' },
  { word: 'Inchoate',      def: 'Just begun and so not fully formed or developed; rudimentary.',               ex: 'She voiced an inchoate idea that needed much more development.' },
  { word: 'Incipient',     def: 'In an initial stage; beginning to happen or develop.',                         ex: 'We noticed the incipient signs of recovery in the local housing market.' },
  { word: 'Intractable',   def: 'Hard to control or deal with; stubborn.',                                     ex: 'The dispute proved to be intractable, defying all attempts at mediation.' },
  { word: 'Intransigent',  def: 'Unwilling or refusing to change one\'s views or to agree.',                   ex: 'The union remained intransigent, refusing the management\'s final offer.' },
  { word: 'Inveterate',    def: 'Having a particular habit or interest that is long-established.',             ex: 'As an inveterate reader, he never left home without a book.' },
  { word: 'Maverick',      def: 'An unorthodox or independent-minded person.',                                 ex: 'The senator was known as a maverick who regularly voted against his party.' },
  { word: 'Mendacious',    def: 'Not telling the truth; lying.',                                               ex: 'The report was filled with mendacious claims designed to mislead investors.' },
  { word: 'Nefarious',     def: 'Wicked, evil, or criminal.',                                                  ex: 'The plotters met in secret to draft their nefarious scheme.' },
  { word: 'Obsequious',    def: 'Obedient or attentive to an excessive or servile degree.',                    ex: 'The servers were obsequious, hovering constantly around the VIP table.' },
  { word: 'Ostentatious',  def: 'Characterized by vulgar or pretentious display; designed to impress.',        ex: 'Her ostentatious gold jewelry attracted a lot of unwanted attention.' },
  { word: 'Paucity',       def: 'The presence of something only in small or insufficient quantities.',         ex: 'There is a paucity of reliable data on the new drug\'s side effects.' },
  { word: 'Pristine',      def: 'In its original condition; clean and fresh as if new.',                        ex: 'The forest was in a pristine state, untouched by logging or roads.' },
  { word: 'Proclivity',    def: 'A tendency to choose or do something regularly; inclination.',                ex: 'He has a strong proclivity for taking risks, especially in business.' },
  { word: 'Querulous',     def: 'Complaining in a petulant or whining manner.',                                ex: 'The querulous passenger grumbled about the minor flight delay.' },
  { word: 'Recalcitrant',  def: 'Obstinately uncooperative toward authority or discipline.',                   ex: 'The recalcitrant horse refused to follow the rider\'s command.' },
  { word: 'Sanguine',      def: 'Optimistic or positive, especially in a bad situation.',                      ex: 'Despite the early losses, the coach remained sanguine about the finals.' },
  { word: 'Taciturn',      def: 'Reserved or uncommunicative in speech; saying little.',                       ex: 'He was a taciturn man who preferred listening to speaking.' },
  { word: 'Tenuous',       def: 'Very weak, slight, or fragile.',                                              ex: 'The coalition held a tenuous majority of only one vote in parliament.' },
  { word: 'Transient',     def: 'Lasting only for a short time; impermanent.',                                 ex: 'The storm was transient, leaving behind clear blue skies in an hour.' },
  { word: 'Vacillate',     def: 'Alternate or waver between different opinions or actions.',                   ex: 'She began to vacillate between staying or taking the new job offer.' },
  { word: 'Venerate',      def: 'Regard with great respect; revere.',                                          ex: 'Many cultures venerate their elders as sources of ancient wisdom.' },
  { word: 'Vociferous',    def: 'Vehement or clamorous; expressing opinions loudly.',                          ex: 'The proposal met with vociferous opposition from local residents.' },
];

let idx = 0;
let flipped = false;
let filterMode: 'all' | 'saved' | 'learned' = 'all';

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

function getLearnedVocab(): string[] {
  try {
    const list = localStorage.getItem('prepology_vocab_learned');
    return list ? JSON.parse(list) : [];
  } catch (e) {
    return [];
  }
}

function toggleLearned(word: string) {
  let list = getLearnedVocab();
  if (list.includes(word)) {
    list = list.filter(w => w !== word);
  } else {
    list.push(word);
  }
  localStorage.setItem('prepology_vocab_learned', JSON.stringify(list));
}

export function renderVocab(): HTMLElement {
  const root = document.createElement('div');
  root.className = 'page-root';
  root.style.cssText = 'display:flex;flex-direction:column;';

  function draw() {
    root.innerHTML = '';
    const bookmarks = getBookmarkedVocab();
    const learned = getLearnedVocab();

    let filteredList = VOCAB;
    if (filterMode === 'all') {
      filteredList = VOCAB.filter(w => !learned.includes(w.word));
      if (filteredList.length === 0 && VOCAB.length > 0) {
        // Fallback to show all if all words are marked as learned
        filteredList = VOCAB;
      }
    } else if (filterMode === 'saved') {
      filteredList = VOCAB.filter(w => bookmarks.includes(w.word));
    } else if (filterMode === 'learned') {
      filteredList = VOCAB.filter(w => learned.includes(w.word));
    }

    if (idx >= filteredList.length) {
      idx = Math.max(0, filteredList.length - 1);
    }

    const hasWords = filteredList.length > 0;
    const w = hasWords ? filteredList[idx] : null;
    const isBookmarked = w ? bookmarks.includes(w.word) : false;
    const isLearned = w ? learned.includes(w.word) : false;

    root.innerHTML = `
      <div class="page-topbar">
        <div>
          <h1>Vocabulary Flashcards</h1>
          <p>Study key digital SAT vocabulary words · ${bookmarks.length} bookmarked · ${learned.length} learned</p>
        </div>
        <div style="display:flex;gap:0.75rem;align-items:center;">
          <select id="vocab-filter-select" class="op-select" style="font-size:0.85rem;padding:0.25rem 1.5rem 0.25rem 0.5rem;background:#1e293b;border:1px solid #475569;color:#fff;">
            <option value="all" ${filterMode === 'all' ? 'selected' : ''}>Study Deck (Unlearned: ${VOCAB.filter(w => !learned.includes(w.word)).length})</option>
            <option value="saved" ${filterMode === 'saved' ? 'selected' : ''}>Bookmarked (${bookmarks.length})</option>
            <option value="learned" ${filterMode === 'learned' ? 'selected' : ''}>Learned Words (${learned.length})</option>
          </select>
          <button class="btn-ghost btn" id="back-btn" style="font-size:0.875rem;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:0.25rem;"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
            Dashboard
          </button>
        </div>
      </div>

      <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.75rem;padding-bottom:2rem;">

        ${hasWords && w ? `
          <div class="vocab-scene">
            <div class="vocab-card ${flipped ? 'flipped' : ''}" id="card">

              <div class="vocab-face vocab-front" style="background: linear-gradient(135deg, var(--c-surface) 0%, var(--c-card) 100%);">
                <div style="position:absolute;top:1rem;right:1rem;z-index:100;cursor:pointer;" id="bookmark-toggle" title="Bookmark word">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="${isBookmarked ? '#f59e0b' : 'none'}" stroke="${isBookmarked ? '#f59e0b' : 'currentColor'}" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                </div>
                <p style="font-size:0.7rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:var(--c-text-3);margin-bottom:0.875rem;">Word ${idx + 1} of ${filteredList.length}</p>
                <h2 style="font-size:2.5rem;font-weight:800;letter-spacing:-0.03em;color:var(--c-blue);line-height:1.1;">${w.word}</h2>
                <p style="margin-top:1rem;font-size:0.8rem;color:var(--c-text-3);">Click card or press spacebar to reveal definition</p>
              </div>

              <div class="vocab-face vocab-back" style="background: var(--c-card);">
                <div style="position:absolute;top:1rem;right:1rem;z-index:100;cursor:pointer;" id="bookmark-toggle-back" title="Bookmark word">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="${isBookmarked ? '#f59e0b' : 'none'}" stroke="${isBookmarked ? '#f59e0b' : 'currentColor'}" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                </div>
                <h3 style="font-size:1.25rem;font-weight:800;color:var(--c-blue);margin-bottom:0.75rem;">${w.word}</h3>
                <p style="font-size:1rem;line-height:1.65;color:var(--c-text);margin-bottom:0.875rem;">${w.def}</p>
                <p style="font-size:0.875rem;font-style:italic;line-height:1.55;color:var(--c-text-2);border-top:1px dashed var(--c-border);padding-top:0.75rem;margin-top:0.5rem;">"${w.ex}"</p>
                <div style="margin-top: 1rem; display: flex; gap: 0.5rem; justify-content: center;" id="learned-action">
                  <button class="btn btn-ghost mark-learned-btn" style="font-size: 0.75rem; padding: 0.3rem 0.65rem; border-radius: 6px; border: 1px solid var(--c-border); color: ${isLearned ? 'var(--c-amber)' : 'var(--c-green)'}; background: transparent; cursor: pointer; font-family: var(--font);">
                    ${isLearned ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:0.25rem;"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg> Move to Study Deck' : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:0.25rem;"><polyline points="20 6 9 17 4 12"></polyline></svg> Mark as Learned'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div style="display:flex;gap:0.75rem;align-items:center;">
            <button class="btn-ghost btn" id="prev-btn" ${idx === 0 ? 'disabled' : ''} style="font-size:0.875rem;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:0.2rem;"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
              Prev
            </button>
            <button class="btn-ghost btn" id="flip-btn" style="font-size:0.875rem;">Flip (Space)</button>
            <button class="btn" id="next-btn" ${idx === filteredList.length - 1 ? 'disabled' : ''} style="font-size:0.875rem;">
              Next
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:0.2rem;"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
            </button>
          </div>

          <div class="vocab-dot-nav">
            ${filteredList.map((_, i) => `<div class="vocab-dot${i === idx ? ' active' : ''}"></div>`).join('')}
          </div>
        ` : `
          <div class="glass empty-state" style="padding: 3rem; text-align: center; max-width: 400px; background: var(--c-card); border: 1px solid var(--c-border); border-radius: 12px; font-family: var(--font);">
            <h2>No words found</h2>
            <p style="color: var(--c-text-2); margin-top: 0.5rem; font-size: 0.9rem;">There are no words matching the selected filter in your deck.</p>
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
        const target = e.target as HTMLElement;
        if (target.closest('#bookmark-toggle') || target.closest('#bookmark-toggle-back') || target.closest('#learned-action')) return;
        handleFlip();
      });
      root.querySelector('#flip-btn')?.addEventListener('click', handleFlip);

      const handleBookmarkToggle = () => {
        toggleBookmark(w.word);
        draw();
      };
      root.querySelector('#bookmark-toggle')?.addEventListener('click', handleBookmarkToggle);
      root.querySelector('#bookmark-toggle-back')?.addEventListener('click', handleBookmarkToggle);

      root.querySelector('.mark-learned-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleLearned(w.word);
        draw();
      });

      root.querySelector('#prev-btn')?.addEventListener('click', () => { if (idx > 0) { idx--; flipped = false; draw(); } });
      root.querySelector('#next-btn')?.addEventListener('click', () => { if (idx < filteredList.length - 1) { idx++; flipped = false; draw(); } });
    }
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (store.getState().currentView !== 'vocab') {
      window.removeEventListener('keydown', handleKeyDown);
      return;
    }
    const bookmarks = getBookmarkedVocab();
    const learned = getLearnedVocab();

    let list = VOCAB;
    if (filterMode === 'all') {
      list = VOCAB.filter(w => !learned.includes(w.word));
      if (list.length === 0 && VOCAB.length > 0) list = VOCAB;
    } else if (filterMode === 'saved') {
      list = VOCAB.filter(w => bookmarks.includes(w.word));
    } else if (filterMode === 'learned') {
      list = VOCAB.filter(w => learned.includes(w.word));
    }

    if (e.key === ' ') {
      e.preventDefault();
      flipped = !flipped;
      draw();
    } else if (e.key === 'ArrowRight') {
      if (idx < list.length - 1) {
        idx++;
        flipped = false;
        draw();
      }
    } else if (e.key === 'ArrowLeft') {
      if (idx > 0) {
        idx--;
        flipped = false;
        draw();
      }
    }
  };

  window.addEventListener('keydown', handleKeyDown);

  draw();
  return root;
}
