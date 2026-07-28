import { store, areAnswersEquivalent } from '../state/Store';
import type { Question } from '../types';

let currentSessionId: string | null = null;
let currentQuestionIndex = 0;
let isDrawerOpen = false;
let isElimMode = false;

// Persistent timer states across renders
let isTimerPaused = false;
let isTimerHidden = false;
let lastTimerTick = Date.now();
let lastRenderedIdx = -1;
let questionTimerEl: HTMLElement | null = null;
let timerInterval: ReturnType<typeof setInterval> | null = null;

// Floating Highlight & Annotation state
let activeHighlightToolbar: HTMLElement | null = null;
let activeNotePopover: HTMLElement | null = null;

function removeHighlightToolbar() {
  if (activeHighlightToolbar) {
    activeHighlightToolbar.remove();
    activeHighlightToolbar = null;
  }
  if (activeNotePopover) {
    activeNotePopover.remove();
    activeNotePopover = null;
  }
}

function showHighlightToolbar(x: number, y: number, targetMark: HTMLElement | null, range: Range | null) {
  removeHighlightToolbar();

  const toolbar = document.createElement('div');
  toolbar.className = 'bb-highlight-toolbar';
  toolbar.style.left = `${Math.max(10, Math.min(x - 80, window.innerWidth - 220))}px`;
  toolbar.style.top = `${Math.max(10, y - 44)}px`;

  // Swatches
  const yellowSwatch = document.createElement('button');
  yellowSwatch.className = 'bb-hl-swatch bb-hl-swatch--yellow' + (targetMark?.classList.contains('bb-hl-yellow') ? ' active' : '');
  yellowSwatch.title = 'Yellow Highlight';

  const blueSwatch = document.createElement('button');
  blueSwatch.className = 'bb-hl-swatch bb-hl-swatch--blue' + (targetMark?.classList.contains('bb-hl-blue') ? ' active' : '');
  blueSwatch.title = 'Blue Highlight';

  const pinkSwatch = document.createElement('button');
  pinkSwatch.className = 'bb-hl-swatch bb-hl-swatch--pink' + (targetMark?.classList.contains('bb-hl-pink') ? ' active' : '');
  pinkSwatch.title = 'Pink Highlight';

  const divider = document.createElement('div');
  divider.className = 'bb-hl-divider';

  const underlineBtn = document.createElement('button');
  underlineBtn.className = 'bb-hl-btn' + (targetMark?.classList.contains('bb-hl-underline') ? ' active' : '');
  underlineBtn.title = 'Underline';
  underlineBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"/><line x1="4" y1="21" x2="20" y2="21"/></svg>`;

  const noteBtn = document.createElement('button');
  noteBtn.className = 'bb-hl-btn' + (targetMark?.dataset.note ? ' active' : '');
  noteBtn.title = 'Add Note';
  noteBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`;

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'bb-hl-btn bb-hl-btn--delete';
  deleteBtn.title = 'Remove Highlight';
  deleteBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`;

  function applyStyleToSelection(className: string) {
    if (targetMark) {
      targetMark.className = className;
    } else if (range) {
      const mark = document.createElement('mark');
      mark.className = className;
      mark.style.cursor = 'pointer';
      try {
        range.surroundContents(mark);
      } catch (_) {
        const frag = range.extractContents();
        mark.appendChild(frag);
        range.insertNode(mark);
      }
      addMarkListeners(mark);
    }
    removeHighlightToolbar();
    window.getSelection()?.removeAllRanges();
  }

  yellowSwatch.addEventListener('click', (e) => { e.stopPropagation(); applyStyleToSelection('bb-hl-yellow'); });
  blueSwatch.addEventListener('click', (e) => { e.stopPropagation(); applyStyleToSelection('bb-hl-blue'); });
  pinkSwatch.addEventListener('click', (e) => { e.stopPropagation(); applyStyleToSelection('bb-hl-pink'); });
  underlineBtn.addEventListener('click', (e) => { e.stopPropagation(); applyStyleToSelection('bb-hl-underline'); });

  noteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    let mark = targetMark;
    if (!mark && range) {
      mark = document.createElement('mark');
      mark.className = 'bb-hl-yellow';
      mark.style.cursor = 'pointer';
      try { range.surroundContents(mark); } catch (_) {
        const frag = range.extractContents();
        mark.appendChild(frag);
        range.insertNode(mark);
      }
      addMarkListeners(mark);
    }
    if (mark) {
      showNotePopover(x, y + 40, mark);
    }
  });

  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (targetMark && targetMark.parentNode) {
      const parent = targetMark.parentNode;
      while (targetMark.firstChild) {
        parent.insertBefore(targetMark.firstChild, targetMark);
      }
      parent.removeChild(targetMark);
      parent.normalize();
    }
    removeHighlightToolbar();
    window.getSelection()?.removeAllRanges();
  });

  toolbar.appendChild(yellowSwatch);
  toolbar.appendChild(blueSwatch);
  toolbar.appendChild(pinkSwatch);
  toolbar.appendChild(divider);
  toolbar.appendChild(underlineBtn);
  toolbar.appendChild(noteBtn);
  toolbar.appendChild(deleteBtn);

  document.body.appendChild(toolbar);
  activeHighlightToolbar = toolbar;
}

function showNotePopover(x: number, y: number, mark: HTMLElement) {
  if (activeNotePopover) activeNotePopover.remove();
  const popover = document.createElement('div');
  popover.className = 'bb-hl-note-popover';
  popover.style.left = `${Math.max(10, Math.min(x - 100, window.innerWidth - 240))}px`;
  popover.style.top = `${y}px`;

  popover.innerHTML = `
    <span style="font-size:0.75rem; font-weight:700; color:#334155;">Annotation Note</span>
    <textarea placeholder="Enter your note...">${mark.dataset.note || ''}</textarea>
    <div style="display:flex; justify-content:flex-end; gap:0.5rem;">
      <button class="btn btn-ghost" id="note-cancel" style="font-size:0.75rem; padding:0.25rem 0.5rem; border-radius:4px; border:1px solid #cbd5e1; cursor:pointer;">Close</button>
      <button class="btn" id="note-save" style="font-size:0.75rem; padding:0.25rem 0.6rem; background:#1a56db; color:#fff; border:none; border-radius:4px; cursor:pointer;">Save</button>
    </div>
  `;

  popover.querySelector('#note-cancel')?.addEventListener('click', (e) => {
    e.stopPropagation();
    popover.remove();
    activeNotePopover = null;
  });

  popover.querySelector('#note-save')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const txt = popover.querySelector('textarea')?.value.trim() || '';
    if (txt) {
      mark.dataset.note = txt;
      mark.title = `Note: ${txt}`;
    } else {
      delete mark.dataset.note;
      mark.removeAttribute('title');
    }
    popover.remove();
    activeNotePopover = null;
    removeHighlightToolbar();
  });

  document.body.appendChild(popover);
  activeNotePopover = popover;
}

function addMarkListeners(mark: HTMLElement) {
  mark.addEventListener('click', (e) => {
    e.stopPropagation();
    const rect = mark.getBoundingClientRect();
    showHighlightToolbar(rect.left + window.scrollX, rect.top + window.scrollY, mark, null);
  });
}

// Directions Modal Function (Image 3)
function openDirectionsModal(isMath: boolean, isSpr: boolean) {
  const existing = document.getElementById('bb-directions-modal');
  if (existing) existing.remove();

  const backdrop = document.createElement('div');
  backdrop.id = 'bb-directions-modal-backdrop';
  backdrop.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(15,23,42,0.4);backdrop-filter:blur(2px);z-index:100004;';

  const modal = document.createElement('div');
  modal.id = 'bb-directions-modal';
  modal.className = 'bb-directions-modal';

  if (isMath || isSpr) {
    modal.innerHTML = `
      <div class="bb-directions-header">
        <h3 class="bb-directions-title">Directions for Student-Produced Response Questions</h3>
        <button class="bb-close-btn" id="close-directions-btn" style="background:none;border:none;font-size:1.25rem;cursor:pointer;color:#64748b;line-height:1;">&#10005;</button>
      </div>
      <div class="bb-directions-body">
        <p>For <strong>student-produced response questions</strong>, solve each problem and enter your answer as described below.</p>
        <ul>
          <li>If you find <strong>more than one correct answer</strong>, enter only one answer.</li>
          <li>You can enter up to 5 characters for a <strong>positive answer</strong> and up to 6 characters (including the negative sign) for a <strong>negative answer</strong>.</li>
          <li>If your answer is a <strong>fraction</strong> that doesn't fit in the provided space, enter the decimal equivalent.</li>
          <li>If your answer is a <strong>decimal</strong> that doesn't fit in the provided space, enter it by truncating or rounding at the fourth digit.</li>
          <li>If your answer is a <strong>mixed number</strong> (such as 3½), enter it as an improper fraction (7/2) or its decimal equivalent (3.5).</li>
          <li>Don't enter <strong>symbols</strong> such as a percent sign, comma, or dollar sign.</li>
        </ul>

        <table class="bb-spr-table">
          <thead>
            <tr>
              <th>Answer</th>
              <th>Acceptable ways to enter answer</th>
              <th class="unacceptable">Unacceptable: will NOT receive credit</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>3.5</strong></td>
              <td>3.5<br>3.50<br>7/2</td>
              <td>31/2<br>3 1/2</td>
            </tr>
            <tr>
              <td><strong>2/3</strong></td>
              <td>2/3<br>.6666<br>.6667<br>0.666<br>0.6667</td>
              <td>0.66<br>.66<br>0.67<br>.67</td>
            </tr>
            <tr>
              <td><strong>-1/3</strong></td>
              <td>-1/3<br>-.3333<br>-0.333</td>
              <td>-.33<br>-0.33</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  } else {
    modal.innerHTML = `
      <div class="bb-directions-header">
        <h3 class="bb-directions-title">Section Directions</h3>
        <button class="bb-close-btn" id="close-directions-btn" style="background:none;border:none;font-size:1.25rem;cursor:pointer;color:#64748b;line-height:1;">&#10005;</button>
      </div>
      <div class="bb-directions-body">
        <p>The questions in this section address a number of important reading and writing skills. Each question includes one or more passages, which may include a table or graph. Read each passage and question carefully, then choose the best answer to the question based on the passage(s).</p>
        <p>All questions in this section are multiple-choice with four answer choices. Each question has a single best answer.</p>
      </div>
    `;
  }

  const closeModal = () => {
    backdrop.remove();
    modal.remove();
  };

  backdrop.addEventListener('click', closeModal);
  document.body.appendChild(backdrop);
  document.body.appendChild(modal);

  modal.querySelector('#close-directions-btn')?.addEventListener('click', closeModal);
}

/* ── Simple inline-math renderer: *text* → <em>, ^n → superscript, basic fractions ── */
function renderMath(text: string): string {
  if (!text) return '';
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
}

function getChoiceExplanation(rationale: string, choiceId: string): string {
  if (!rationale) return '';
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = rationale;
  const paragraphs = Array.from(tempDiv.querySelectorAll('p, div'));
  if (paragraphs.length === 0) {
    return rationale;
  }
  const matchedParagraphs: string[] = [];
  const choiceLetter = choiceId.toUpperCase();
  paragraphs.forEach(p => {
    const text = p.textContent || '';
    const prefix = text.slice(0, 40).toUpperCase();
    if (
      prefix.includes(`CHOICE ${choiceLetter}`) ||
      prefix.includes(`CHOICES ${choiceLetter}`) ||
      (prefix.includes('CHOICES') && prefix.includes(choiceLetter))
    ) {
      matchedParagraphs.push(p.outerHTML);
    }
  });
  if (matchedParagraphs.length === 0) {
    const otherChoices = ['A', 'B', 'C', 'D'].filter(c => c !== choiceLetter);
    paragraphs.forEach(p => {
      const text = (p.textContent || '').slice(0, 40).toUpperCase();
      const isOtherChoice = otherChoices.some(c => text.includes(`CHOICE ${c}`));
      if (!isOtherChoice) {
        matchedParagraphs.push(p.outerHTML);
      }
    });
  }
  return matchedParagraphs.join('');
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
  targetSvg: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="2"/></svg>`,
  ref: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>`
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
  let highlightMode = false;

  function startTimer() {
    lastTimerTick = Date.now();
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      const state = store.getState();
      const sess = state.session;
      if (!sess) {
        stopTimer();
        return;
      }
      const q = questions[idx];
      if (!q) return;

      if (isTimerPaused) {
        lastTimerTick = Date.now();
        return;
      }
      const now = Date.now();
      const delta = Math.floor((now - lastTimerTick) / 1000);
      if (delta >= 1) {
        if (!sess.questionTimes) sess.questionTimes = {};
        sess.questionTimes[q.id] = (sess.questionTimes[q.id] || 0) + delta;
        lastTimerTick = now;
        store.updateQuestionTime(q.id, sess.questionTimes[q.id]);
      }
      
      const accumulated = sess.questionTimes?.[q.id] || 0;
      if (!questionTimerEl) return;
      if (isTimerHidden) {
        questionTimerEl.textContent = '—:—';
      } else {
        const m = Math.floor(accumulated / 60).toString().padStart(2, '0');
        const s = (accumulated % 60).toString().padStart(2, '0');
        questionTimerEl.textContent = `${m}:${s}`;
      }
    }, 1000);
  }

  function stopTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  }

  function draw() {
    currentQuestionIndex = idx;
    isDrawerOpen = drawerOpen;
    isElimMode = elimMode;
    stopTimer();
    removeHighlightToolbar();
    root.innerHTML = '';

    if (lastRenderedIdx !== idx) {
      lastRenderedIdx = idx;
      lastTimerTick = Date.now();
    }

    const q      = questions[idx];
    const sess   = store.getState().session!;
    const isMath = q.section === 'Math';
    const isSpr  = !q.options || q.options.length === 0;

    const checked    = sess.checked    ?? new Set<string>();
    const eliminated = sess.eliminatedOptions[q.id] ?? new Set<string>();
    const selected   = sess.answers[q.id] ?? null;
    const isFlagged  = sess.flagged.has(q.id);
    const isSaved    = store.getState().stats.savedQuestions?.includes(q.id) ?? false;
    const isChecked  = checked.has(q.id);
    const isLast     = idx === questions.length - 1;
    const diffLabel  = q.difficulty === 1 ? 'Easy' : q.difficulty === 2 ? 'Medium' : 'Hard';
    const displayId  = q.id.replace(/_(read|math)$/i, '');

    const sectionLabel = q.section === 'Math' ? 'Section 2: Math' : 'Section 1: Reading and Writing';

    /* ───── NAV BAR ───── */
    const nav = document.createElement('div');
    nav.className = 'bb-nav';
    nav.innerHTML = `
      <div class="bb-nav-left">
        <span class="bb-nav-title">${sectionLabel}</span>
        <button class="bb-dir-btn" id="dir-btn" title="Read directions">Directions &#9662;</button>
        ${(q.id.includes('-DC') || (q as any)._raw !== undefined) ? `
          <div class="bb-difficulty-edit-container" style="position: relative;">
            <button class="bb-set-diff-btn" id="set-diff-btn" title="Set Difficulty" style="display:flex;align-items:center;gap:0.3rem;font-size:0.8125rem;font-weight:500;color:var(--c-blue, #1a56db);background:transparent;border:1px solid #1a56db;border-radius:4px;cursor:pointer;padding:0.25rem 0.5rem;">
              Set Difficulty: ${diffLabel} &#9662;
            </button>
            <div id="diff-dropdown" class="bb-diff-dropdown" style="position: absolute; top: 100%; left: 0; margin-top: 4px; background: white; border: 1px solid #e4e4e4; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); z-index: 10001; min-width: 100px;">
              <button class="diff-opt-btn" data-val="1" style="display: block; width: 100%; text-align: left; padding: 0.5rem 0.75rem; background: none; border: none; font-size: 0.8125rem; cursor: pointer; color: #333; font-family: var(--font);">Easy</button>
              <button class="diff-opt-btn" data-val="2" style="display: block; width: 100%; text-align: left; padding: 0.5rem 0.75rem; background: none; border: none; font-size: 0.8125rem; cursor: pointer; color: #333; font-family: var(--font); border-top: 1px solid #f3f4f6;">Medium</button>
              <button class="diff-opt-btn" data-val="3" style="display: block; width: 100%; text-align: left; padding: 0.5rem 0.75rem; background: none; border: none; font-size: 0.8125rem; cursor: pointer; color: #333; font-family: var(--font); border-top: 1px solid #f3f4f6;">Hard</button>
            </div>
          </div>
        ` : ''}
      </div>
      <div class="bb-nav-center" style="display:flex; flex-direction:column; align-items:center; justify-content:center; gap: 2px; height: 100%;">
        <div id="q-timer" style="font-size: 1.15rem; font-weight: 700; color: #111; font-family: monospace; line-height: 1.1;">00:00</div>
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <button id="pause-timer-btn" style="width: 20px; height: 20px; border-radius: 50%; border: 1px solid #d1d5db; background: white; display: flex; align-items: center; justify-content: center; cursor: pointer; padding: 0;" title="${isTimerPaused ? 'Resume' : 'Pause'}">
            ${isTimerPaused 
              ? `<svg width="8" height="8" viewBox="0 0 24 24" fill="#4b5563" stroke="#4b5563" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>`
              : `<svg width="8" height="8" viewBox="0 0 24 24" fill="#4b5563" stroke="#4b5563" stroke-width="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`
            }
          </button>
          <button id="hide-timer-btn" style="padding: 1px 10px; border-radius: 9999px; border: 1px solid #d1d5db; background: white; color: #1a56db; font-size: 0.7rem; font-weight: 500; cursor: pointer;">
            ${isTimerHidden ? 'Show' : 'Hide'}
          </button>
        </div>
      </div>
      <div class="bb-nav-right">
        ${isMath ? `<button class="bb-calc-btn" id="calc-btn">${SVG.calc}&nbsp;Calculator</button><button class="bb-calc-btn" id="ref-btn" style="margin-right: 0.5rem;">${SVG.ref}&nbsp;Reference</button>` : ''}
        <button class="bb-tool bb-annotate-btn ${highlightMode ? 'active' : ''}" id="highlight-btn" title="Highlight text (select text to highlight)">
          <span class="bb-tool-icon">${SVG.pencil}</span>
          <span class="bb-tool-label">Highlight</span>
        </button>
        <button class="bb-exit" id="exit-btn">Exit Practice</button>
      </div>
    `;
    root.appendChild(nav);

    nav.querySelector('#dir-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      openDirectionsModal(isMath, isSpr);
    });

    /* Dotted Color bar */
    const bar = document.createElement('div');
    bar.className = 'bb-color-bar';
    root.appendChild(bar);

    /* ───── MAIN ───── */
    const main = document.createElement('div');
    main.className = 'bb-main';
    main.style.position = 'relative';

    let hasMedia = false;
    let leftHTML = '';
    let rightHTML = q.questionText;

    if (isMath) {
      try {
        const div = document.createElement('div');
        div.innerHTML = q.questionText;
        const media = div.querySelector('svg, img:not(.math-img):not([role="math"])') as HTMLElement | null;
        if (media) {
          hasMedia = true;
          media.removeAttribute('width');
          media.removeAttribute('height');
          media.setAttribute('style', 'width: 100%; height: auto; max-width: 800px; max-height: 85vh; object-fit: contain;');
          const wrapper = media.parentElement;
          if (wrapper && (wrapper.tagName === 'FIGURE' || wrapper.className.includes('standalone_image') || wrapper.className.includes('image'))) {
            leftHTML = `<div class="bb-math-graphic-container" style="display:flex;align-items:center;justify-content:center;height:100%;padding:1.5rem;box-sizing:border-box;width:100%;">${media.outerHTML}</div>`;
            wrapper.remove();
          } else {
            leftHTML = `<div class="bb-math-graphic-container" style="display:flex;align-items:center;justify-content:center;height:100%;padding:1.5rem;box-sizing:border-box;width:100%;">${media.outerHTML}</div>`;
            media.remove();
          }
          rightHTML = div.innerHTML;
        } else if (q.passageText) {
          hasMedia = true;
          leftHTML = q.passageText;
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
        <button class="bb-q-tool-btn" id="report-issue-btn" style="color:var(--c-red, #f43f5e);">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-top:-2px;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>&nbsp;Report Issue
        </button>
        <div class="bb-q-sep"></div>
        <button class="bb-q-tool-btn ${elimMode ? 'active' : ''}" id="elim-btn" title="Toggle Eliminate Mode" ${isSpr ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : ''}>
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
      passCol.id = 'left-col';
      passCol.innerHTML = `
        <button class="bb-expand-btn" title="Expand passage">&#10548;</button>
        <div class="bb-passage-text">${renderMath(leftHTML)}</div>
      `;
      main.appendChild(passCol);

      const resizer = document.createElement('div');
      resizer.className = 'bb-divider';
      resizer.id = 'split-resizer';
      main.appendChild(resizer);

      const qCol = document.createElement('div');
      qCol.className = 'bb-question-col';
      qCol.id = 'right-col';
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

    // Resizable split screen logic
    if (!isMath || hasMedia) {
      const resizer = main.querySelector('#split-resizer') as HTMLElement | null;
      const leftCol = main.querySelector('#left-col') as HTMLElement | null;
      if (resizer && leftCol) {
        resizer.addEventListener('mousedown', (e: MouseEvent) => {
          e.preventDefault();
          resizer.classList.add('dragging');
          const onMouseMove = (moveEvent: MouseEvent) => {
            const containerWidth = main.clientWidth;
            if (containerWidth <= 0) return;
            const rect = main.getBoundingClientRect();
            let pct = ((moveEvent.clientX - rect.left) / containerWidth) * 100;
            if (pct < 25) pct = 25;
            if (pct > 75) pct = 75;
            leftCol.style.width = `${pct}%`;
          };
          const onMouseUp = () => {
            resizer.classList.remove('dragging');
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
          };
          window.addEventListener('mousemove', onMouseMove);
          window.addEventListener('mouseup', onMouseUp);
        });
      }
    }

    /* ───── FOOTER ───── */
    const footer = document.createElement('div');
    footer.className = 'bb-footer';
    footer.innerHTML = `
      <button class="bb-footer-back" id="back-btn" ${idx === 0 ? 'disabled' : ''}>Back</button>
      <div style="display:flex;align-items:center;gap:0.75rem;">
        <button class="bb-q-counter ${drawerOpen ? 'active' : ''}" id="nav-counter">Question ${idx + 1} of ${questions.length} &and;</button>
      </div>
      <button class="bb-next-btn" id="next-btn">${isLast ? 'Finish' : 'Next'}</button>
    `;
    root.appendChild(footer);
    questionTimerEl = nav.querySelector('#q-timer');
    startTimer();

    if (questionTimerEl) {
      if (isTimerPaused) {
        questionTimerEl.style.color = '#ef4444';
        questionTimerEl.textContent = 'PAUSED';
      } else {
        questionTimerEl.style.color = '#111';
        const accumulated = sess.questionTimes?.[q.id] || 0;
        const m = Math.floor(accumulated / 60).toString().padStart(2, '0');
        const s = (accumulated % 60).toString().padStart(2, '0');
        questionTimerEl.textContent = isTimerHidden ? '—:—' : `${m}:${s}`;
      }
    }

    /* ───── OPTIONS ───── */
    const optsEl = root.querySelector('#opts')!;
    const actionEl = root.querySelector('#action')!;

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

          if (elimMode && !isChecked) {
            div.querySelector('.bb-opt-elim-btn')?.addEventListener('click', (e) => {
              e.stopPropagation();
              store.toggleEliminateOption(q.id, opt.id);
              draw();
            });
          }
        }

        div.addEventListener('click', () => {
          if (!isElim && (!isChecked || !isCorrect)) {
            if (isChecked) {
              sess.checked.delete(q.id);
            }
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
      /* SPR / grid-in (Student-Produced Response) */
      const isCorrect = isChecked && areAnswersEquivalent(q.correctAnswer, selected || '');
      const sprCls = isChecked ? (isCorrect ? 'spr-input correct' : 'spr-input incorrect') : 'spr-input';

      optsEl.innerHTML = `
        <div class="bb-spr-container">
          <label style="font-weight:700; font-size:0.9375rem; color:#1e293b;">Your answer:</label>
          <input type="text" class="${sprCls}" id="spr-input-${q.id}" value="${selected || ''}" ${(isChecked && isCorrect) ? 'disabled' : ''} placeholder="Enter answer" autocomplete="off" />
        </div>
      `;

      const inp = optsEl.querySelector(`#spr-input-${q.id}`) as HTMLInputElement;
      if (inp) {
        inp.addEventListener('input', e => {
          const val = (e.target as HTMLInputElement).value;
          if (isChecked && !isCorrect) {
            sess.checked.delete(q.id);
          }
          // SILENT UPDATE: does not destroy DOM, preserving input focus and cursor!
          store.answerQuestion(q.id, val, true);

          // Dynamically manage Check Answer button without re-rendering view
          let checkBtn = actionEl.querySelector('.bb-check-btn') as HTMLButtonElement | null;
          if (val.trim() !== '') {
            if (!checkBtn && !isChecked) {
              checkBtn = document.createElement('button');
              checkBtn.className = 'bb-check-btn';
              checkBtn.textContent = 'Check Answer';
              checkBtn.addEventListener('click', () => { store.checkAnswer(q.id, sess.questionTimes?.[q.id] || 0); draw(); });
              actionEl.appendChild(checkBtn);
            }
          } else if (checkBtn && !isChecked) {
            checkBtn.remove();
          }
        });
        inp.addEventListener('change', e => {
          store.answerQuestion(q.id, (e.target as HTMLInputElement).value, true);
        });
      }
    }

    /* ───── ACTION AREA ───── */
    if (selected && !isChecked) {
      const btn = document.createElement('button');
      btn.className = 'bb-check-btn';
      btn.textContent = 'Check Answer';
      btn.addEventListener('click', () => { store.checkAnswer(q.id, sess.questionTimes?.[q.id] || 0); draw(); });
      actionEl.appendChild(btn);
    }

    if (isChecked) {
      const ok = areAnswersEquivalent(q.correctAnswer, selected || '');
      const isMcq = q.options && q.options.length > 0;
      const choiceExplanation = isMcq ? getChoiceExplanation(q.rationale, selected || '') : q.rationale;
      const fb = document.createElement('div');
      fb.className = `bb-feedback ${ok ? 'bb-feedback--correct' : 'bb-feedback--incorrect'}`;
      fb.innerHTML = `
        <div class="bb-feedback-label" style="display:flex; justify-content:space-between; align-items:center;">
          <span>${ok ? `${SVG.check} Correct` : `${SVG.cross} Incorrect`}</span>
          ${isMcq ? `<button class="btn btn-ghost show-full-rationale-btn" style="font-size:0.7rem; padding:0.25rem 0.5rem; border-radius:4px; height:24px; color:inherit; border:1px solid currentColor; cursor:pointer;">Show Full Explanation</button>` : ''}
        </div>
        <div class="bb-feedback-body" id="explanation-body" style="margin-top:0.5rem; line-height:1.6;">
          ${renderMath(choiceExplanation || q.rationale)}
        </div>
        ${!ok ? `<div class="bb-feedback-hint" style="margin-top:0.5rem; font-size:0.75rem; opacity:0.85;">${isMcq ? 'Select another option to try again.' : 'Enter another answer to try again.'}</div>` : ''}
      `;
      
      if (isMcq) {
        fb.querySelector('.show-full-rationale-btn')?.addEventListener('click', (e) => {
          e.stopPropagation();
          const body = fb.querySelector('#explanation-body');
          const btn = e.currentTarget as HTMLElement;
          if (body) {
            const isFull = btn.textContent === 'Show Specific Explanation';
            if (isFull) {
              body.innerHTML = renderMath(choiceExplanation || q.rationale);
              btn.textContent = 'Show Full Explanation';
            } else {
              body.innerHTML = renderMath(q.rationale);
              btn.textContent = 'Show Specific Explanation';
            }
          }
        });
      }
      
      actionEl.appendChild(fb);
    }

    /* ───── EVENTS ───── */
    // Difficulty edit controls
    if (q.id.includes('-DC') || (q as any)._raw !== undefined) {
      const setDiffBtn = nav.querySelector('#set-diff-btn');
      const diffDropdown = nav.querySelector('#diff-dropdown');
      if (setDiffBtn && diffDropdown) {
        setDiffBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          diffDropdown.classList.toggle('show');
        });

        const closeDropdown = () => {
          diffDropdown.classList.remove('show');
          document.removeEventListener('click', closeDropdown);
        };
        document.addEventListener('click', closeDropdown);

        diffDropdown.querySelectorAll('.diff-opt-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const val = parseInt((e.currentTarget as HTMLElement).dataset.val || '2', 10);
            store.setQuestionDifficulty(q.id, val as any);
          });
        });
      }
    }

    // Timer controls
    const pauseBtn = nav.querySelector('#pause-timer-btn');
    if (pauseBtn) {
      pauseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        isTimerPaused = !isTimerPaused;
        if (!isTimerPaused) {
          lastTimerTick = Date.now();
        }
        draw();
      });
    }

    const hideBtn = nav.querySelector('#hide-timer-btn');
    if (hideBtn) {
      hideBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        isTimerHidden = !isTimerHidden;
        if (questionTimerEl) {
          if (isTimerHidden) {
            questionTimerEl.textContent = '—:—';
          } else {
            const qTime = sess.questionTimes?.[q.id] || 0;
            const m = Math.floor(qTime / 60).toString().padStart(2, '0');
            const s = (qTime % 60).toString().padStart(2, '0');
            questionTimerEl.textContent = `${m}:${s}`;
          }
        }
        hideBtn.textContent = isTimerHidden ? 'Show' : 'Hide';
      });
    }

    root.querySelector('#exit-btn')?.addEventListener('click', () => {
      document.getElementById('desmos-modal')?.remove();
      document.body.classList.remove('calc-docked');
      removeHighlightToolbar();
      stopTimer();
      store.endSession();
    });
    root.querySelector('#flag-btn')?.addEventListener('click', () => { store.toggleFlag(q.id); draw(); });
    root.querySelector('#save-btn')?.addEventListener('click', () => { store.toggleSaveQuestion(q.id); draw(); });
    root.querySelector('#report-issue-btn')?.addEventListener('click', () => {
      let modal = document.getElementById('report-issue-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'report-issue-modal';
        modal.className = 'glass';
        Object.assign(modal.style, {
          position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          width: '450px', padding: '1.5rem', background: 'var(--c-card)',
          border: '1px solid var(--c-border)', borderRadius: '12px',
          boxShadow: 'var(--shadow-xl)', zIndex: '100000', display: 'flex', flexDirection: 'column',
          gap: '1rem'
        });
        modal.innerHTML = `
          <h3 style="font-size:1.15rem;font-weight:700;color:var(--c-text);margin:0;display:flex;align-items:center;gap:0.5rem;font-family:var(--font);">
            Report Issue: Question ${displayId}
          </h3>
          <p style="font-size:0.8rem;color:var(--c-text-2);margin:0;line-height:1.4;font-family:var(--font);">Describe the issue (e.g. incorrect answer key, typo, missing parts) so you can prompt me to fix it later.</p>
          <textarea id="issue-desc" placeholder="Describe the problem in detail..." style="width:100%;height:120px;border-radius:8px;border:1px solid var(--c-border);background:var(--c-elevated);color:var(--c-text);padding:0.75rem;font-family:var(--font);font-size:0.875rem;resize:none;outline:none;"></textarea>
          <div style="display:flex;justify-content:flex-end;gap:0.75rem;font-family:var(--font);">
            <button class="btn btn-ghost" id="issue-cancel" style="font-size:0.8rem;padding:0.4rem 1rem;cursor:pointer;">Cancel</button>
            <button class="btn" id="issue-submit" style="font-size:0.8rem;padding:0.4rem 1rem;background:var(--c-red, #f43f5e);color:#fff;cursor:pointer;">Submit Report</button>
          </div>
        `;
        document.body.appendChild(modal);

        modal.querySelector('#issue-cancel')?.addEventListener('click', () => {
          modal!.remove();
        });

        modal.querySelector('#issue-submit')?.addEventListener('click', () => {
          const desc = (modal!.querySelector('#issue-desc') as HTMLTextAreaElement).value.trim();
          if (!desc) {
            alert('Please enter a description of the issue.');
            return;
          }
          store.reportIssue(q.id, desc);
          modal!.remove();

          const t = document.createElement('div');
          t.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#10b981;color:#fff;padding:0.4rem 1.2rem;border-radius:999px;font-size:0.85rem;font-weight:600;z-index:99999;opacity:1;transition:opacity 0.4s;pointer-events:none;font-family:var(--font);';
          t.textContent = 'Issue reported successfully!';
          document.body.appendChild(t);
          setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 400); }, 1500);
        });
      }
    });
    root.querySelector('#back-btn')?.addEventListener('click', () => { if (idx > 0) { idx--; draw(); } });
    root.querySelector('#next-btn')?.addEventListener('click', () => { if (isLast) { stopTimer(); store.endSession(); } else { idx++; draw(); } });
    root.querySelector('#nav-counter')?.addEventListener('click', () => { drawerOpen = !drawerOpen; draw(); });

    /* Highlight button toggle */
    root.querySelector('#highlight-btn')?.addEventListener('click', () => {
      highlightMode = !highlightMode;
      const btn = root.querySelector('#highlight-btn') as HTMLElement | null;
      if (btn) btn.classList.toggle('active', highlightMode);
      document.body.style.cursor = highlightMode ? 'text' : '';
      if (!highlightMode) {
        removeHighlightToolbar();
      }
    });

    /* Mouseup listener: Trigger floating Highlight toolbar on text selection (Image 2) */
    root.addEventListener('mouseup', (e: MouseEvent) => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);

      const container = root.querySelector('.bb-passage-text, .bb-q-text, .bb-single-inner');
      if (!container || !container.contains(range.commonAncestorContainer)) return;

      const text = range.toString().trim();
      if (text.length === 0) return;

      showHighlightToolbar(e.pageX, e.pageY - 10, null, range);
    });

    // Attach click handlers to existing marks
    root.querySelectorAll('mark').forEach(m => addMarkListeners(m as HTMLElement));

    root.querySelector('#elim-btn')?.addEventListener('click', () => {
      if (!isSpr) {
        elimMode = !elimMode;
        draw();
      }
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
          document.body.appendChild(modal);

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
          let ox = 0, oy = 0;

          const onMouseMove = (e: MouseEvent) => {
            if (!document.body.classList.contains('calc-docked')) {
              modal!.style.left = `${e.clientX - ox}px`;
              modal!.style.top = `${e.clientY - oy}px`;
              modal!.style.right = 'unset';
            }
          };

          const onMouseUp = () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            const calc = document.getElementById('desmos-calc');
            if (calc) calc.style.pointerEvents = 'auto';
          };

          dh.addEventListener('mousedown', e => {
            if (document.body.classList.contains('calc-docked')) return;
            ox = e.clientX - modal!.offsetLeft;
            oy = e.clientY - modal!.offsetTop;
            const calc = document.getElementById('desmos-calc');
            if (calc) calc.style.pointerEvents = 'none';
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
          });
          
          document.getElementById('dc')?.addEventListener('click', () => {
            document.body.classList.remove('calc-docked');
            modal!.remove();
          });

          const dockBtn = document.getElementById('d-dock')!;
          dockBtn.addEventListener('click', () => {
            const isDocked = document.body.classList.toggle('calc-docked');
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
      
      root.querySelector('#ref-btn')?.addEventListener('click', () => {
        let modal = document.getElementById('reference-modal');
        if (!modal) {
          modal = document.createElement('div');
          modal.id = 'reference-modal';
          Object.assign(modal.style, {
            position: 'fixed', top: '70px', right: '480px',
            width: '450px', height: '520px',
            background: '#fff', border: '1px solid #cbd5e1',
            borderRadius: '12px', boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
            zIndex: '9999', display: 'flex', flexDirection: 'column',
            overflow: 'hidden', resize: 'both',
          });
          modal.innerHTML = `
            <div id="rfh" style="background:#1e293b;color:#fff;padding:0.625rem 1rem;cursor:move;display:flex;justify-content:space-between;align-items:center;border-radius:12px 12px 0 0;flex-shrink:0;user-select:none;">
              <span style="font-size:0.875rem;font-weight:600;">Reference</span>
              <button id="rfc" style="background:transparent;border:none;color:#94a3b8;cursor:pointer;font-size:1rem;line-height:1;">&#10005;</button>
            </div>
            <div style="flex:1; overflow-y:auto; padding:1.25rem; font-family:var(--font); font-size:0.8rem; color:#1e293b; line-height:1.4; background:#f8fafc;">
              <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
                <div style="background:#fff; border:1px solid #e2e8f0; border-radius:8px; padding:0.75rem; text-align:center; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                  <div style="font-weight:700; font-size:0.85rem; margin-bottom:0.25rem; color:#0f172a;">Circle</div>
                  <div style="font-size:0.75rem; color:#475569;">$A = \\pi r^2$</div>
                  <div style="font-size:0.75rem; color:#475569;">$C = 2\\pi r$</div>
                </div>
                <div style="background:#fff; border:1px solid #e2e8f0; border-radius:8px; padding:0.75rem; text-align:center; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                  <div style="font-weight:700; font-size:0.85rem; margin-bottom:0.25rem; color:#0f172a;">Rectangle</div>
                  <div style="font-size:0.75rem; color:#475569;">$A = l w$</div>
                </div>
                <div style="background:#fff; border:1px solid #e2e8f0; border-radius:8px; padding:0.75rem; text-align:center; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                  <div style="font-weight:700; font-size:0.85rem; margin-bottom:0.25rem; color:#0f172a;">Triangle</div>
                  <div style="font-size:0.75rem; color:#475569;">$A = \\frac{1}{2} b h$</div>
                </div>
                <div style="background:#fff; border:1px solid #e2e8f0; border-radius:8px; padding:0.75rem; text-align:center; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                  <div style="font-weight:700; font-size:0.85rem; margin-bottom:0.25rem; color:#0f172a;">Right Triangle</div>
                  <div style="font-size:0.75rem; color:#475569;">$c^2 = a^2 + b^2$</div>
                </div>
              </div>
            </div>
          `;
          document.body.appendChild(modal);

          const rfh = document.getElementById('rfh')!;
          let ox = 0, oy = 0;
          const onMouseMove = (e: MouseEvent) => {
            modal!.style.left = `${e.clientX - ox}px`;
            modal!.style.top = `${e.clientY - oy}px`;
            modal!.style.right = 'unset';
          };
          const onMouseUp = () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
          };
          rfh.addEventListener('mousedown', e => {
            ox = e.clientX - modal!.offsetLeft;
            oy = e.clientY - modal!.offsetTop;
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
          });

          document.getElementById('rfc')?.addEventListener('click', () => {
            modal!.remove();
          });

          (window as any).MathJax?.typesetPromise?.([modal]);
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
          <span class="bb-drawer-title">${sectionLabel}</span>
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
        const isQChecked   = sess.checked.has(qItem.id);
        const solvedInfo   = store.getState().stats.solved?.[qItem.id];
        const isQCorrect   = isQChecked && solvedInfo?.correct;
        const isQIncorrect = isQChecked && solvedInfo && !solvedInfo.correct;

        const cell = document.createElement('div');
        cell.className = 'bb-drawer-cell';

        const marker = document.createElement('span');
        marker.className = 'bb-drawer-curr-marker';
        if (isCurrent) {
          marker.innerHTML = SVG.targetSvg;
        }
        cell.appendChild(marker);

        const btn = document.createElement('button');
        btn.className = [
          'bb-drawer-item',
          isQCorrect ? 'bb-drawer-item--correct' : (isQIncorrect ? 'bb-drawer-item--incorrect' : (isQAnswered ? 'bb-drawer-item--answered' : 'bb-drawer-item--unanswered')),
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

    setTimeout(() => {
      (window as any).MathJax?.typesetPromise?.();
    }, 10);
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (store.getState().currentView !== 'test') {
      document.getElementById('desmos-modal')?.remove();
      document.body.classList.remove('calc-docked');
      removeHighlightToolbar();
      stopTimer();
      window.removeEventListener('keydown', handleKeyDown);
      return;
    }

    const active = document.activeElement;
    const isSprInput = !!(active && active.id && active.id.startsWith('spr-input-'));
    
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

    if (e.key === 'Enter') {
      e.preventDefault();
      if (selected && !isChecked) {
        store.checkAnswer(q.id, sess.questionTimes?.[q.id] || 0);
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
