import { store } from '../state/Store';
import {
  MAX_BOX,
  buildQueue,
  deckStats,
  formatDue,
  formatInterval,
  isMastered,
  isNew,
  loadSrs,
  migrateLegacyLearned,
  newCard,
  review,
  saveSrs,
} from '../utils/srs';

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

type Mode = 'review' | 'saved' | 'mastered' | 'all';

const WORDS = VOCAB.map(v => v.word);
const BY_WORD = new Map(VOCAB.map(v => [v.word, v]));

let mode: Mode = 'review';
let queue: string[] = [];
let qIdx = 0;
let flipped = false;
let reviewedThisSession = 0;

function getBookmarkedVocab(): string[] {
  try {
    const list = localStorage.getItem('prepology_vocab_bookmarks') || localStorage.getItem('preplogy_vocab_bookmarks');
    return list ? JSON.parse(list) : [];
  } catch {
    return [];
  }
}

function toggleBookmark(word: string) {
  let list = getBookmarkedVocab();
  list = list.includes(word) ? list.filter(w => w !== word) : [...list, word];
  localStorage.setItem('prepology_vocab_bookmarks', JSON.stringify(list));
}

export function renderVocab(): HTMLElement {
  const root = document.createElement('div');
  root.className = 'page-root vocab-page';

  let srs = migrateLegacyLearned(loadSrs());

  /** Scheduled queue in review mode; a plain filtered list when browsing. */
  function buildList(): string[] {
    const bookmarks = getBookmarkedVocab();
    switch (mode) {
      case 'review':   return buildQueue(WORDS, srs);
      case 'saved':    return WORDS.filter(w => bookmarks.includes(w));
      case 'mastered': return WORDS.filter(w => isMastered(srs[w] || newCard()));
      default:         return WORDS;
    }
  }

  function refreshQueue() {
    queue = buildList();
    if (qIdx >= queue.length) qIdx = Math.max(0, queue.length - 1);
    flipped = false;
  }

  function grade(word: string, recalled: boolean) {
    srs = { ...srs, [word]: review(srs[word] || newCard(), recalled) };
    saveSrs(srs);
    reviewedThisSession++;

    // A graded card leaves the queue and the next one takes its slot.
    queue = queue.filter(w => w !== word);
    if (qIdx >= queue.length) qIdx = 0;
    flipped = false;
    draw();
  }

  function progressBarHTML(stats: ReturnType<typeof deckStats>): string {
    const segments = [
      { label: 'Mastered', count: stats.mastered, cls: 'is-mastered' },
      { label: 'Learning', count: stats.learning, cls: 'is-learning' },
      { label: 'New',      count: stats.fresh,    cls: 'is-fresh' },
    ].filter(s => s.count > 0);

    return `
      <div class="vocab-progress" role="img"
           aria-label="${stats.mastered} mastered, ${stats.learning} learning, ${stats.fresh} new">
        ${segments.map(s => `<div class="vocab-progress-seg ${s.cls}" style="flex:${s.count}" title="${s.label}: ${s.count}"></div>`).join('')}
      </div>`;
  }

  function emptyStateHTML(stats: ReturnType<typeof deckStats>): string {
    if (mode === 'review') {
      const next = stats.nextDue ? formatDue(stats.nextDue) : null;
      return `
        <div class="vocab-empty">
          <div class="vocab-empty-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
          <h2>All caught up</h2>
          <p>${next
            ? `Nothing is due right now — your next card comes back in ${next}.`
            : 'Every word is scheduled. Check back later for your next review.'}</p>
          <button class="btn btn-ghost" id="study-anyway">Browse all words</button>
        </div>`;
    }
    const what = mode === 'saved' ? 'bookmarked words' : mode === 'mastered' ? 'mastered words yet' : 'words';
    return `
      <div class="vocab-empty">
        <h2>Nothing here yet</h2>
        <p>You have no ${what} to show.</p>
        <button class="btn btn-ghost" id="study-anyway">Browse all words</button>
      </div>`;
  }

  function draw() {
    const stats = deckStats(WORDS, srs);
    const bookmarks = getBookmarkedVocab();
    const word = queue[qIdx];
    const entry = word ? BY_WORD.get(word) : undefined;
    const card = word ? (srs[word] || newCard()) : newCard();
    const bookmarked = word ? bookmarks.includes(word) : false;
    const isReview = mode === 'review';

    const star = (id: string) => `
      <button class="vocab-star ${bookmarked ? 'active' : ''}" id="${id}"
              aria-label="${bookmarked ? 'Remove bookmark' : 'Bookmark word'}">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="${bookmarked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
      </button>`;

    const modeTabs: Array<[Mode, string]> = [
      ['review', `Review${stats.due + stats.fresh > 0 ? ` (${stats.due + stats.fresh})` : ''}`],
      ['saved', `Bookmarked (${bookmarks.length})`],
      ['mastered', `Mastered (${stats.mastered})`],
      ['all', `All (${stats.total})`],
    ];

    root.innerHTML = `
      <div class="page-topbar">
        <div>
          <h1>Vocabulary Flashcards</h1>
          <p>Spaced repetition — words you miss come back sooner${reviewedThisSession > 0 ? ` · ${reviewedThisSession} reviewed this session` : ''}</p>
        </div>
        <div class="vocab-modes" role="tablist">
          ${modeTabs.map(([m, label]) => `
            <button class="vocab-mode-btn ${mode === m ? 'active' : ''}" data-mode="${m}" role="tab" aria-selected="${mode === m}">${label}</button>
          `).join('')}
        </div>
      </div>

      <div class="vocab-stats">
        <div class="vocab-stat"><span class="vocab-stat-num">${stats.due}</span><span class="vocab-stat-label">Due now</span></div>
        <div class="vocab-stat"><span class="vocab-stat-num">${stats.fresh}</span><span class="vocab-stat-label">New</span></div>
        <div class="vocab-stat"><span class="vocab-stat-num">${stats.learning}</span><span class="vocab-stat-label">Learning</span></div>
        <div class="vocab-stat"><span class="vocab-stat-num">${stats.mastered}</span><span class="vocab-stat-label">Mastered</span></div>
      </div>
      ${progressBarHTML(stats)}

      <div class="vocab-stage">
        ${!entry ? emptyStateHTML(stats) : `
          <div class="vocab-meta-row">
            <span class="vocab-box-pill" title="Leitner box ${card.box} of ${MAX_BOX}">Box ${card.box}/${MAX_BOX}</span>
            ${isNew(card) ? '<span class="vocab-box-pill is-new">New word</span>' : ''}
            ${card.lapses > 0 ? `<span class="vocab-box-pill is-lapsed">${card.lapses} lapse${card.lapses > 1 ? 's' : ''}</span>` : ''}
            <span class="vocab-count">${qIdx + 1} of ${queue.length}</span>
          </div>

          <div class="vocab-scene">
            <div class="vocab-card ${flipped ? 'flipped' : ''}" id="card">
              <div class="vocab-face vocab-front">
                ${star('bm-front')}
                <p class="vocab-hint-label">${isReview ? 'Do you remember this word?' : 'Tap to reveal'}</p>
                <h2 class="vocab-word">${entry.word}</h2>
                <p class="vocab-hint">Click the card or press <kbd>Space</kbd></p>
              </div>
              <div class="vocab-face vocab-back">
                ${star('bm-back')}
                <h3 class="vocab-word-sm">${entry.word}</h3>
                <p class="vocab-def">${entry.def}</p>
                <p class="vocab-ex">${entry.ex}</p>
              </div>
            </div>
          </div>

          ${isReview ? `
            <div class="vocab-grade ${flipped ? '' : 'is-hidden'}">
              <button class="vocab-grade-btn is-again" id="grade-again">
                <span class="vocab-grade-key">1</span>
                <span class="vocab-grade-name">Forgot</span>
                <span class="vocab-grade-when">back in ${formatInterval(1)}</span>
              </button>
              <button class="vocab-grade-btn is-good" id="grade-good">
                <span class="vocab-grade-key">2</span>
                <span class="vocab-grade-name">Got it</span>
                <span class="vocab-grade-when">back in ${formatInterval(Math.min(card.box + 1, MAX_BOX))}</span>
              </button>
            </div>
            ${flipped ? '' : '<p class="vocab-reveal-nudge">Reveal the definition to grade yourself</p>'}
          ` : `
            <div class="vocab-browse-nav">
              <button class="btn btn-ghost" id="prev-btn" ${qIdx === 0 ? 'disabled' : ''}>Previous</button>
              <button class="btn btn-ghost" id="flip-btn">Flip</button>
              <button class="btn" id="next-btn" ${qIdx >= queue.length - 1 ? 'disabled' : ''}>Next</button>
            </div>
          `}
        `}
      </div>
    `;

    /* ── events ── */
    root.querySelectorAll<HTMLButtonElement>('.vocab-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        mode = btn.dataset.mode as Mode;
        qIdx = 0;
        refreshQueue();
        draw();
      });
    });

    root.querySelector('#study-anyway')?.addEventListener('click', () => {
      mode = 'all';
      qIdx = 0;
      refreshQueue();
      draw();
    });

    if (!entry) return;

    const flip = () => { flipped = !flipped; draw(); };
    root.querySelector('#card')?.addEventListener('click', e => {
      if ((e.target as HTMLElement).closest('.vocab-star')) return;
      flip();
    });
    root.querySelector('#flip-btn')?.addEventListener('click', flip);

    const onBookmark = (e: Event) => {
      e.stopPropagation();
      toggleBookmark(entry.word);
      draw();
    };
    root.querySelector('#bm-front')?.addEventListener('click', onBookmark);
    root.querySelector('#bm-back')?.addEventListener('click', onBookmark);

    root.querySelector('#grade-again')?.addEventListener('click', () => grade(entry.word, false));
    root.querySelector('#grade-good')?.addEventListener('click', () => grade(entry.word, true));

    root.querySelector('#prev-btn')?.addEventListener('click', () => {
      if (qIdx > 0) { qIdx--; flipped = false; draw(); }
    });
    root.querySelector('#next-btn')?.addEventListener('click', () => {
      if (qIdx < queue.length - 1) { qIdx++; flipped = false; draw(); }
    });
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (store.getState().currentView !== 'vocab') {
      window.removeEventListener('keydown', onKeyDown);
      return;
    }
    const word = queue[qIdx];
    if (e.key === ' ') {
      e.preventDefault();
      if (word) flip_();
    } else if (mode === 'review' && flipped && word && (e.key === '1' || e.key === '2')) {
      e.preventDefault();
      grade(word, e.key === '2');
    } else if (mode !== 'review' && e.key === 'ArrowRight') {
      if (qIdx < queue.length - 1) { qIdx++; flipped = false; draw(); }
    } else if (mode !== 'review' && e.key === 'ArrowLeft') {
      if (qIdx > 0) { qIdx--; flipped = false; draw(); }
    }
  };
  function flip_() { flipped = !flipped; draw(); }
  window.addEventListener('keydown', onKeyDown);

  refreshQueue();
  draw();
  return root;
}
