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

export function renderVocab(): HTMLElement {
  const root = document.createElement('div');
  root.className = 'page-root';
  root.style.cssText = 'display:flex;flex-direction:column;';

  let idx     = 0;
  let flipped = false;

  function draw() {
    root.innerHTML = '';
    const w = VOCAB[idx];

    root.innerHTML = `
      <div class="page-topbar">
        <div>
          <h1>Vocabulary</h1>
          <p>Click a card to reveal its definition · ${VOCAB.length} words</p>
        </div>
        <button class="btn-ghost btn" id="back-btn" style="font-size:0.875rem;">← Dashboard</button>
      </div>

      <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.75rem;padding-bottom:2rem;">

        <div class="vocab-scene">
          <div class="vocab-card ${flipped ? 'flipped' : ''}" id="card">

            <div class="vocab-face vocab-front">
              <p style="font-size:0.7rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:var(--c-text-3);margin-bottom:0.875rem;">Word ${idx + 1} of ${VOCAB.length}</p>
              <h2 style="font-size:2.25rem;font-weight:800;letter-spacing:-0.03em;color:var(--c-blue);line-height:1.1;">${w.word}</h2>
              <p style="margin-top:1rem;font-size:0.8rem;color:var(--c-text-3);">Click to reveal definition</p>
            </div>

            <div class="vocab-face vocab-back">
              <h3 style="font-size:1rem;font-weight:700;color:var(--c-blue);margin-bottom:0.75rem;">${w.word}</h3>
              <p style="font-size:1rem;line-height:1.65;color:var(--c-text);margin-bottom:0.875rem;">${w.def}</p>
              <p style="font-size:0.875rem;font-style:italic;line-height:1.55;color:var(--c-text-2);">"${w.ex}"</p>
            </div>
          </div>
        </div>

        <div style="display:flex;gap:0.75rem;align-items:center;">
          <button class="btn-ghost btn" id="prev-btn" ${idx === 0 ? 'disabled' : ''} style="font-size:0.875rem;">← Prev</button>
          <button class="btn-ghost btn" id="flip-btn" style="font-size:0.875rem;">Flip</button>
          <button class="btn" id="next-btn" ${idx === VOCAB.length - 1 ? 'disabled' : ''} style="font-size:0.875rem;">Next →</button>
        </div>

        <div class="vocab-dot-nav">
          ${VOCAB.map((_, i) => `<div class="vocab-dot${i === idx ? ' active' : ''}"></div>`).join('')}
        </div>
      </div>
    `;

    root.querySelector('#back-btn')?.addEventListener('click', () => store.setView('dashboard'));
    root.querySelector('#card')?.addEventListener('click', () => { flipped = !flipped; draw(); });
    root.querySelector('#flip-btn')?.addEventListener('click', () => { flipped = !flipped; draw(); });
    root.querySelector('#prev-btn')?.addEventListener('click', () => { if (idx > 0) { idx--; flipped = false; draw(); } });
    root.querySelector('#next-btn')?.addEventListener('click', () => { if (idx < VOCAB.length - 1) { idx++; flipped = false; draw(); } });
  }

  draw();
  return root;
}
