import { store } from '../state/Store';
import type { Question } from '../types';

let currentSessionId: string | null = null;
let currentQuestionIndex = 0;
let isDrawerOpen = false;
let isElimMode = false;

/* ── Simple inline-math renderer: *text* → <em>, ^n → superscript, basic fractions ── */
function renderMath(text: string): string {
  if (!text) return '';
  return text
    // bold **text**
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // italic *text*
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // newlines → <br>
    .replace(/\n/g, '<br>');
}

/* SVG icons — no emojis */
const SVG = {
  flag:   `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>`,
  flagFilled: `<svg width="16" height="16" viewBox="0 0 24 24" fill="#c0392b" stroke="#c0392b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>`,
  bookmark: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`,
  bookmarkFilled: `<svg width="16" height="16" viewBox="0 0 24 24" fill="#1a56db" stroke="#1a56db" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`,
  calc:    `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="10" y2="10"/><line x1="14" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="10" y2="14"/><line x1="14" y1="14" x2="16" y2="14"/><line x1="8" y1="18" x2="10" y2="18"/><line x1="14" y1="18" x2="16" y2="18"/></svg>`,
  pencil:  `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  check:   `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  cross:   `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  elimSvg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity: 0.65;"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>`,
  targetSvg: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="2"/></svg>`
};

export function renderTestSession(): HTMLElement {
  const root = document.createElement('div');
  root.className = 'bb-root';

  const state   = store.getState();
  const session = state.session;

  if (!session) { store.setView('dashboard'); return root; }

  if (currentSessionId !== session.id) {
    currentSessionId = session.id;
    currentQuestionIndex = 0;
    isDrawerOpen = false;
    isElimMode = false;
  }

  const qIds: string[] = (session.filteredQuestionIds?.length)
    ? session.filteredQuestionIds
    : state.questionBank.filter(q => q.section === session.currentSection).map(q => q.id);

  const questions: Question[] = qIds
    .map(id => state.questionBank.find(q => q.id === id))
    .filter((q): q is Question => q != null);

  if (questions.length === 0) {
    root.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:1.5rem;background:#f9f9f9;color:#333;">
        <h2 style="font-size:1.25rem;font-weight:600;">No questions match your filters</h2>
        <p style="color:#6b7280;font-size:0.9rem;">Try adjusting the Section, Domain, or Difficulty.</p>
        <button style="padding:0.5rem 1.25rem;background:#1a56db;color:#fff;border:none;border-radius:8px;font-size:0.9rem;font-weight:600;cursor:pointer;" id="gb">Back to Dashboard</button>
      </div>
    `;
    root.querySelector('#gb')?.addEventListener('click', () => store.endSession());
    return root;
  }

  let idx = currentQuestionIndex;
  let drawerOpen = isDrawerOpen;
  let elimMode = isElimMode;

  function draw() {
    currentQuestionIndex = idx;
    isDrawerOpen = drawerOpen;
    isElimMode = elimMode;

    root.innerHTML = '';

    const q      = questions[idx];
    const sess   = store.getState().session!;
    const isMath = q.section === 'Math';

    const checked    = sess.checked    ?? new Set<string>();
    const eliminated = sess.eliminatedOptions[q.id] ?? new Set<string>();
    const selected   = sess.answers[q.id] ?? null;
    const isFlagged  = sess.flagged.has(q.id);
    const isSaved    = store.getState().stats.savedQuestions?.includes(q.id) ?? false;
    const isChecked  = checked.has(q.id);
    const isLast     = idx === questions.length - 1;
    const diffLabel  = q.difficulty === 1 ? 'Easy' : q.difficulty === 2 ? 'Medium' : 'Hard';
    const displayId  = q.id.replace(/_(read|math)$/i, '');

    const sectionLabel = q.section === 'Math' ? 'Math' : 'R+W';

    /* ───── NAV BAR ───── */
    const nav = document.createElement('div');
    nav.className = 'bb-nav';
    nav.innerHTML = `
      <div class="bb-nav-left">
        <span class="bb-nav-title">${sectionLabel}</span>
        <button class="bb-dir-btn" title="Read directions">Directions &#9662;</button>
      </div>
      <div class="bb-nav-center"></div>
      <div class="bb-nav-right">
        ${isMath ? `<button class="bb-calc-btn" id="calc-btn">${SVG.calc}&nbsp;Calculator</button>` : ''}
        <div class="bb-tool" title="Annotate">
          <span class="bb-tool-icon">${SVG.pencil}</span>
          <span class="bb-tool-label">Annotate</span>
        </div>
        <button class="bb-exit" id="exit-btn">Exit Practice</button>
      </div>
    `;
    root.appendChild(nav);

    /* Dotted Color bar */
    const bar = document.createElement('div');
    bar.className = 'bb-color-bar';
    root.appendChild(bar);

    /* ───── MAIN ───── */
    const main = document.createElement('div');
    main.className = 'bb-main';

    // Detect if Math question has media (SVG or IMG) to show in split-screen layout
    let hasMedia = false;
    let leftHTML = '';
    let rightHTML = q.questionText;

    if (isMath) {
      try {
        const div = document.createElement('div');
        div.innerHTML = q.questionText;
        const media = div.querySelector('svg, img');
        if (media) {
          hasMedia = true;
          // Strip fixed width/height attributes so the SVG/Image scales fluidly to fill the container
          media.removeAttribute('width');
          media.removeAttribute('height');
          media.setAttribute('style', 'width: 100%; height: auto; max-width: 800px; max-height: 85vh; object-fit: contain;');
          
          // Put the graphic on the left
          leftHTML = `<div class="bb-math-graphic-container" style="display:flex;align-items:center;justify-content:center;height:100%;padding:1.5rem;box-sizing:border-box;width:100%;">${media.outerHTML}</div>`;
          media.remove();
          rightHTML = div.innerHTML;
        }
      } catch (_) {}
    } else {
      leftHTML = q.passageText || '';
    }

    const qColHTML = `
      <div class="bb-q-header">
        <div class="bb-q-num-box">${idx + 1}</div>
        <button class="bb-q-tool-btn ${isFlagged ? 'flagged' : ''}" id="flag-btn">
          ${isFlagged ? SVG.flagFilled : SVG.flag}&nbsp;Mark for Review
        </button>
        <button class="bb-q-tool-btn ${isSaved ? 'saved' : ''}" id="save-btn">
          ${isSaved ? SVG.bookmarkFilled : SVG.bookmark}&nbsp;Bookmark
        </button>
        <div class="bb-q-sep"></div>
        <button class="bb-q-tool-btn ${elimMode ? 'active' : ''}" id="elim-btn" title="Toggle Eliminate Mode">
          <span style="text-decoration:line-through;font-weight:700;font-size:0.8rem;">ABC</span>&nbsp;Eliminate
        </button>
      </div>

      <div class="bb-q-meta">
        <span class="bb-meta-pill">${q.skill}</span>
        <span class="bb-meta-pill bb-meta-pill--diff">${diffLabel}</span>
        <span class="bb-meta-id">ID: ${displayId}</span>
      </div>

      <div class="bb-q-text">${renderMath(rightHTML)}</div>

      <div class="bb-options" id="opts"></div>
      <div id="action"></div>
    `;

    if (!isMath || hasMedia) {
      /* Two-column layout */
      const passCol = document.createElement('div');
      passCol.className = 'bb-passage-col';
      passCol.innerHTML = `
        <button class="bb-expand-btn" title="Expand passage">&#10548;</button>
        <div class="bb-passage-text">${isMath ? leftHTML : renderMath(leftHTML)}</div>
      `;
      main.appendChild(passCol);

      const qCol = document.createElement('div');
      qCol.className = 'bb-question-col';
      qCol.innerHTML = qColHTML;
      main.appendChild(qCol);
    } else {
      /* Single centered column for Math */
      const single = document.createElement('div');
      single.className = 'bb-single-col';
      const inner = document.createElement('div');
      inner.className = 'bb-single-inner';
      inner.innerHTML = qColHTML;
      single.appendChild(inner);
      main.appendChild(single);
    }

    root.appendChild(main);

    /* ───── FOOTER ───── */
    const footer = document.createElement('div');
    footer.className = 'bb-footer';
    footer.innerHTML = `
      <button class="bb-footer-back" id="back-btn" ${idx === 0 ? 'disabled' : ''}>Back</button>
      <button class="bb-q-counter ${drawerOpen ? 'active' : ''}" id="nav-counter">Question ${idx + 1} of ${questions.length} &and;</button>
      <button class="bb-next-btn" id="next-btn">${isLast ? 'Finish' : 'Next'}</button>
    `;
    root.appendChild(footer);

    /* ───── OPTIONS ───── */
    const optsEl = root.querySelector('#opts')!;

    if (q.options && q.options.length > 0) {
      q.options.forEach(opt => {
        const isElim    = eliminated.has(opt.id);
        const isSel     = selected === opt.id;
        const isCorrect = isChecked && opt.id === q.correctAnswer;
        const isWrong   = isChecked && isSel && !isCorrect;

        const cls = [
          'bb-opt',
          isElim    ? 'bb-opt--eliminated' : '',
          isChecked ? (isCorrect ? 'bb-opt--correct' : (isWrong ? 'bb-opt--incorrect' : '')) : (isSel ? 'bb-opt--selected' : ''),
        ].filter(Boolean).join(' ');

        const div = document.createElement('div');
        div.className = cls;

        if (isElim) {
          div.innerHTML = `
            <div class="bb-opt-circle"><span>${opt.id}</span></div>
            <div class="bb-opt-text" style="text-decoration: line-through; opacity: 0.5;">${renderMath(opt.text)}</div>
            <button class="bb-opt-undo-btn" style="background:none;border:none;color:#1a56db;font-weight:700;font-size:0.85rem;cursor:pointer;padding:0.5rem;font-family:var(--font);margin-left:auto; z-index:10;">Undo</button>
          `;
          // Click on Undo un-eliminates
          div.querySelector('.bb-opt-undo-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            store.toggleEliminateOption(q.id, opt.id);
            draw();
          });
        } else {
          div.innerHTML = `
            <div class="bb-opt-circle"><span>${opt.id}</span></div>
            <div class="bb-opt-text">${renderMath(opt.text)}</div>
            ${isChecked && isCorrect ? `<div class="bb-opt-icon correct">${SVG.check}</div>` : ''}
            ${isChecked && isWrong   ? `<div class="bb-opt-icon wrong">${SVG.cross}</div>`  : ''}
            ${!isChecked && elimMode ? `
              <button class="bb-opt-elim-btn" style="background:none;border:none;color:#ef4444;font-size:1.1rem;cursor:pointer;padding:0.5rem;display:flex;align-items:center;justify-content:center;margin-left:auto;border-radius:50%;width:30px;height:30px;border:1px solid #fecaca; z-index:10;" title="Eliminate option">
                ${SVG.elimSvg}
              </button>
            ` : ''}
          `;

          // Clicking the eliminate button eliminates the option
          if (elimMode && !isChecked) {
            div.querySelector('.bb-opt-elim-btn')?.addEventListener('click', (e) => {
              e.stopPropagation();
              store.toggleEliminateOption(q.id, opt.id);
              draw();
            });
          }
        }

        // Clicking the card selects it (unless eliminated or checked)
        div.addEventListener('click', () => {
          if (!isElim && !isChecked) {
            store.answerQuestion(q.id, opt.id);
            draw();
          }
        });

        div.addEventListener('contextmenu', e => {
          e.preventDefault();
          if (!isChecked) {
            store.toggleEliminateOption(q.id, opt.id);
            draw();
          }
        });

        optsEl.appendChild(div);
      });
    } else {
      /* SPR / grid-in */
      const isCorrect = isChecked && (selected === q.correctAnswer || Number(selected) === Number(q.correctAnswer));
      const sprCls = isChecked ? (isCorrect ? 'spr-input correct' : 'spr-input incorrect') : 'spr-input';

      optsEl.innerHTML = `
        <div class="bb-spr-container">
          <label>Your answer:</label>
          <input type="text" class="${sprCls}" id="spr-input-${q.id}" value="${selected || ''}" ${isChecked ? 'disabled' : ''} placeholder="Enter answer" autocomplete="off" />
        </div>
      `;

      const inp = optsEl.querySelector(`#spr-input-${q.id}`) as HTMLInputElement;
      if (inp) {
        inp.addEventListener('change', e => {
          store.answerQuestion(q.id, (e.target as HTMLInputElement).value);
        });
        inp.addEventListener('blur', e => {
          store.answerQuestion(q.id, (e.target as HTMLInputElement).value);
        });
      }
    }

    /* ───── ACTION AREA ───── */
    const actionEl = root.querySelector('#action')!;

    if (selected && !isChecked) {
      const btn = document.createElement('button');
      btn.className = 'bb-check-btn';
      btn.textContent = 'Check Answer';
      btn.addEventListener('click', () => { store.checkAnswer(q.id); draw(); });
      actionEl.appendChild(btn);
    }

    if (isChecked) {
      const ok = selected === q.correctAnswer;
      const fb = document.createElement('div');
      fb.className = `bb-feedback ${ok ? 'bb-feedback--correct' : 'bb-feedback--incorrect'}`;
      fb.innerHTML = `
        <div class="bb-feedback-label">${ok ? `${SVG.check} Correct` : `${SVG.cross} Incorrect`}</div>
        <div class="bb-feedback-body">${renderMath(q.rationale)}</div>
        ${!ok ? '<div class="bb-feedback-hint">Select another option to try again.</div>' : ''}
      `;
      actionEl.appendChild(fb);
    }

    /* ───── EVENTS ───── */
    root.querySelector('#exit-btn')?.addEventListener('click', () => {
      store.endSession();
    });
    root.querySelector('#flag-btn')?.addEventListener('click', () => { store.toggleFlag(q.id); draw(); });
    root.querySelector('#save-btn')?.addEventListener('click', () => { store.toggleSaveQuestion(q.id); draw(); });
    root.querySelector('#back-btn')?.addEventListener('click', () => { if (idx > 0) { idx--; draw(); } });
    root.querySelector('#next-btn')?.addEventListener('click', () => { if (isLast) { store.endSession(); } else { idx++; draw(); } });
    root.querySelector('#nav-counter')?.addEventListener('click', () => { drawerOpen = !drawerOpen; draw(); });

    root.querySelector('#elim-btn')?.addEventListener('click', () => {
      elimMode = !elimMode;
      draw();
    });

    /* Desmos calculator */
    if (isMath) {
      root.querySelector('#calc-btn')?.addEventListener('click', () => {
        let modal = document.getElementById('desmos-modal');
        if (!modal) {
          modal = document.createElement('div');
          modal.id = 'desmos-modal';
          Object.assign(modal.style, {
            position: 'fixed', top: '70px', right: '24px',
            width: '440px', height: '520px',
            background: '#fff', border: '1px solid #e0e0e0',
            borderRadius: '12px', boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
            zIndex: '9999', display: 'flex', flexDirection: 'column',
            overflow: 'hidden', resize: 'both',
          });
          modal.innerHTML = `
            <div id="dh" style="background:#1e293b;color:#fff;padding:0.625rem 1rem;cursor:move;display:flex;justify-content:space-between;align-items:center;border-radius:12px 12px 0 0;flex-shrink:0;user-select:none;">
              <span style="font-size:0.875rem;font-weight:600;">Graphing Calculator</span>
              <div style="display:flex;align-items:center;gap:0.75rem;">
                <button id="d-dock" style="background:transparent;border:none;color:#94a3b8;cursor:pointer;font-size:0.85rem;line-height:1;font-weight:600;font-family:var(--font);" title="Dock to Left side">Dock</button>
                <button id="dc" style="background:transparent;border:none;color:#94a3b8;cursor:pointer;font-size:1rem;line-height:1;">&#10005;</button>
              </div>
            </div>
            <div id="desmos-calc" style="flex:1;"></div>
          `;
          root.appendChild(modal);

          let calcInstance: any = null;
          const load = () => {
            const el = document.getElementById('desmos-calc')!;
            calcInstance = (window as any).Desmos?.GraphingCalculator(el);
          };
          if (!(window as any).Desmos) {
            const s = document.createElement('script');
            s.src = 'https://www.desmos.com/api/v1.8/calculator.js?apiKey=dcb31709b452b1cf9dc26972add0fda6';
            s.onload = load;
            document.head.appendChild(s);
          } else load();

          const dh = document.getElementById('dh')!;
          let drag = false, ox = 0, oy = 0;
          dh.addEventListener('mousedown', e => {
            if (root.classList.contains('calc-docked')) return;
            drag = true;
            ox = e.clientX - modal!.offsetLeft;
            oy = e.clientY - modal!.offsetTop;
          });
          window.addEventListener('mousemove', e => {
            if (drag && !root.classList.contains('calc-docked')) {
              modal!.style.left = `${e.clientX - ox}px`;
              modal!.style.top = `${e.clientY - oy}px`;
              modal!.style.right = 'unset';
            }
          });
          window.addEventListener('mouseup', () => { drag = false; });
          
          document.getElementById('dc')?.addEventListener('click', () => {
            root.classList.remove('calc-docked');
            modal!.remove();
          });

          const dockBtn = document.getElementById('d-dock')!;
          dockBtn.addEventListener('click', () => {
            const isDocked = root.classList.toggle('calc-docked');
            dockBtn.textContent = isDocked ? 'Float' : 'Dock';
            if (isDocked) {
              modal!.style.left = '';
              modal!.style.top = '';
              modal!.style.width = '';
              modal!.style.height = '';
            } else {
              modal!.style.left = 'unset';
              modal!.style.top = '70px';
              modal!.style.right = '24px';
              modal!.style.width = '440px';
              modal!.style.height = '520px';
            }
            setTimeout(() => {
              if (calcInstance) calcInstance.resize();
            }, 310);
          });
        } else {
          modal.style.display = modal.style.display === 'none' ? 'flex' : 'none';
        }
      });
    }

    /* ───── QUESTION NAVIGATOR DRAWER ───── */
    if (drawerOpen) {
      const overlay = document.createElement('div');
      overlay.className = 'bb-drawer-overlay';
      overlay.addEventListener('click', () => { drawerOpen = false; draw(); });
      root.appendChild(overlay);

      const drawer = document.createElement('div');
      drawer.className = 'bb-nav-drawer';

      drawer.innerHTML = `
        <div class="bb-drawer-header">
          <span class="bb-drawer-title">${sectionLabel} Module 1</span>
          <button class="bb-drawer-close" id="close-drawer-btn">&#10005;</button>
        </div>
        <div class="bb-drawer-legend">
          <span class="bb-legend-item">
            <span style="color:#1a56db;display:flex;align-items:center;justify-content:center;">${SVG.targetSvg}</span> Current
          </span>
          <span class="bb-legend-item">
            <span class="bb-legend-box unanswered"></span> Unanswered
          </span>
          <span class="bb-legend-item">
            <span class="bb-legend-box flagged"></span> For Review
          </span>
        </div>
        <div class="bb-drawer-grid" id="drawer-grid"></div>
        <button class="bb-drawer-action-btn" id="close-drawer-btn2">Go to Review Page</button>
      `;

      root.appendChild(drawer);

      drawer.addEventListener('click', e => e.stopPropagation());

      const grid = drawer.querySelector('#drawer-grid')!;
      questions.forEach((qItem, qIdx) => {
        const isCurrent    = qIdx === idx;
        const isQAnswered  = !!sess.answers[qItem.id];
        const isQFlagged   = sess.flagged.has(qItem.id);

        const cell = document.createElement('div');
        cell.className = 'bb-drawer-cell';

        // Target marker above current question
        const marker = document.createElement('span');
        marker.className = 'bb-drawer-curr-marker';
        if (isCurrent) {
          marker.innerHTML = SVG.targetSvg;
        }
        cell.appendChild(marker);

        const btn = document.createElement('button');
        btn.className = [
          'bb-drawer-item',
          isQAnswered ? 'bb-drawer-item--answered' : 'bb-drawer-item--unanswered',
          isCurrent   ? 'bb-drawer-item--current'  : '',
        ].filter(Boolean).join(' ');
        btn.textContent = String(qIdx + 1);

        if (isQFlagged) {
          const flag = document.createElement('span');
          flag.className = 'bb-drawer-flag-marker';
          btn.appendChild(flag);
        }

        btn.addEventListener('click', () => {
          idx = qIdx;
          drawerOpen = false;
          draw();
        });

        cell.appendChild(btn);
        grid.appendChild(cell);
      });

      drawer.querySelector('#close-drawer-btn')?.addEventListener('click', () => { drawerOpen = false; draw(); });
      drawer.querySelector('#close-drawer-btn2')?.addEventListener('click', () => { drawerOpen = false; draw(); });
    }

    // Trigger MathJax typeset to compile LaTeX math formulas
    setTimeout(() => {
      (window as any).MathJax?.typesetPromise?.();
    }, 10);
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (store.getState().currentView !== 'test') {
      window.removeEventListener('keydown', handleKeyDown);
      return;
    }

    const active = document.activeElement;
    const isSprInput = !!(active && active.id && active.id.startsWith('spr-input-'));
    
    // If typing in SPR input, ignore all shortcut keys except Enter
    if (isSprInput && e.key !== 'Enter') {
      return;
    }

    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA') && !isSprInput) {
      return;
    }

    const q = questions[idx];
    const sess = store.getState().session!;
    if (!sess) return;
    const checked = sess.checked ?? new Set<string>();
    const isChecked = checked.has(q.id);
    const selected = sess.answers[q.id];

    // MCQ keys
    if (!isChecked && q.options && q.options.length > 0) {
      const key = e.key.toUpperCase();
      if (['A', 'B', 'C', 'D'].includes(key)) {
        const opt = q.options.find(o => o.id === key);
        const isEliminated = sess.eliminatedOptions[q.id]?.has(opt?.id || '');
        if (opt && !isEliminated) {
          store.answerQuestion(q.id, opt.id);
          draw();
          return;
        }
      }
    }

    // Enter actions
    if (e.key === 'Enter') {
      e.preventDefault();
      if (selected && !isChecked) {
        store.checkAnswer(q.id);
        draw();
      } else if (isChecked) {
        const isLast = idx === questions.length - 1;
        if (isLast) {
          store.endSession();
        } else {
          idx++;
          currentQuestionIndex = idx;
          draw();
        }
      }
    }
  };

  window.addEventListener('keydown', handleKeyDown);

  draw();
  return root;
}
