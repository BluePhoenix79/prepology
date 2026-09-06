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
let activeKeyDownHandler: ((e: KeyboardEvent) => void) | null = null;

export function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

export function cleanupTestSession() {
  stopTimer();
  if (activeKeyDownHandler) {
    window.removeEventListener('keydown', activeKeyDownHandler);
    activeKeyDownHandler = null;
  }
  removeHighlightToolbar();
  document.getElementById('desmos-modal')?.remove();
  document.getElementById('scratchpad-modal')?.remove();
  document.getElementById('reference-modal')?.remove();
  document.getElementById('report-issue-modal')?.remove();
  document.getElementById('session-summary-modal')?.remove();
  document.body.classList.remove('calc-docked');
  document.body.style.cursor = '';
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    lastTimerTick = Date.now();
  });
}

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
    const marksToRemove: HTMLElement[] = [];
    if (targetMark) {
      marksToRemove.push(targetMark);
    } else if (range) {
      const container = range.commonAncestorContainer.nodeType === 1 ? (range.commonAncestorContainer as HTMLElement) : range.commonAncestorContainer.parentElement;
      if (container) {
        if (container.tagName === 'MARK') {
          marksToRemove.push(container);
        } else {
          container.querySelectorAll('mark').forEach(m => {
            if (range.intersectsNode(m)) {
              marksToRemove.push(m as HTMLElement);
            }
          });
        }
      }
    }

    marksToRemove.forEach(mark => {
      if (mark && mark.parentNode) {
        const parent = mark.parentNode;
        while (mark.firstChild) {
          parent.insertBefore(mark.firstChild, mark);
        }
        parent.removeChild(mark);
        parent.normalize();
      }
    });

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

/* College Board tables can be wider than the column they land in. Wrap each one
   so it scrolls on its own instead of stretching the passage/question layout. */
function wrapContentTables(scope: HTMLElement) {
  scope.querySelectorAll('table').forEach(table => {
    if (table.classList.contains('bb-spr-table')) return;
    if (table.parentElement?.classList.contains('bb-table-scroll')) return;
    const wrap = document.createElement('div');
    wrap.className = 'bb-table-scroll';
    table.replaceWith(wrap);
    wrap.appendChild(table);
  });
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
    isTimerPaused = false;
    isTimerHidden = false;
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
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      const state = store.getState();
      const sess = state.session;
      if (!sess || state.currentView !== 'test') {
        cleanupTestSession();
        return;
      }
      const q = questions[idx];
      if (!q) return;

      if (isTimerPaused || (sess.checked && sess.checked.has(q.id))) {
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
    const hideDetails = store.getState().hideQuestionDetails;

    const sectionLabel = q.section === 'Math' ? 'Math' : 'Reading & Writing';

    /* ───── NAV BAR ───── */
    const nav = document.createElement('div');
    nav.className = 'bb-nav';
    nav.innerHTML = `
      <div class="bb-nav-left" style="display:flex; align-items:center; gap:0.5rem;">
        <span class="bb-nav-title" style="font-weight: 700; color: #1e293b; margin-right: 0.5rem;">${sectionLabel}</span>
        <button class="bb-hdr-btn" id="dir-btn" title="Read directions">Directions &#9662;</button>
        <button class="bb-hdr-btn" id="toggle-info-btn" title="Toggle question info visibility">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-top:-1px;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>&nbsp;${hideDetails ? 'Show Info' : 'Hide Info'}
        </button>
        ${isMath ? `
          <button class="bb-hdr-btn" id="draw-btn" title="Math Scratchpad Canvas">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="vertical-align:middle;margin-top:-1px;"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.5 7.5"/></svg>&nbsp;Scratchpad
          </button>
        ` : ''}
        ${q.id.includes('-DC') ? `
          <div class="bb-difficulty-edit-container" style="position: relative;">
            <button class="bb-hdr-btn" id="set-diff-btn" title="Set Difficulty" style="color:var(--c-blue, #1a56db); border-color:#3b82f6;">
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
        <div id="q-timer" style="font-size: 1.15rem; font-weight: 700; color: var(--c-text); font-family: monospace; line-height: 1.1;">00:00</div>
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <button id="pause-timer-btn" style="width: 22px; height: 22px; border-radius: 50%; border: 1px solid #cbd5e1; background: #ffffff; display: flex; align-items: center; justify-content: center; cursor: pointer; padding: 0; box-shadow: 0 1px 2px rgba(0,0,0,0.05);" title="${isTimerPaused ? 'Resume' : 'Pause'}">
            ${isTimerPaused 
              ? `<svg width="8" height="8" viewBox="0 0 24 24" fill="#334155" stroke="#334155" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>`
              : `<svg width="8" height="8" viewBox="0 0 24 24" fill="#334155" stroke="#334155" stroke-width="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`
            }
          </button>
          <button id="hide-timer-btn" style="padding: 2px 10px; border-radius: 9999px; border: 1px solid #cbd5e1; background: #ffffff; color: #2563eb; font-size: 0.7rem; font-weight: 600; cursor: pointer; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
            ${isTimerHidden ? 'Show' : 'Hide'}
          </button>
        </div>
      </div>
      <div class="bb-nav-right" style="display:flex; align-items:center; justify-content:flex-end; gap:0.5rem;">
        ${isMath ? `
          <button class="bb-hdr-btn" id="calc-btn">${SVG.calc}&nbsp;Calculator</button>
          <button class="bb-hdr-btn" id="ref-btn">${SVG.ref}&nbsp;Reference</button>
        ` : ''}
        <button class="bb-hdr-btn ${highlightMode ? 'active' : ''}" id="highlight-btn" title="Highlight text (select text to highlight)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="vertical-align:middle;margin-top:-1px;"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>&nbsp;Highlight
        </button>
        <button class="bb-hdr-btn" id="exit-btn" style="font-weight:700;">${sess.isStructuredSession ? 'End Session' : 'Exit Practice'}</button>
      </div>
    `;
    root.appendChild(nav);

    nav.querySelector('#toggle-info-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      store.toggleHideQuestionDetails();
      draw();
    });
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

      <div class="bb-q-meta" ${hideDetails ? 'style="display:none;"' : ''}>
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

    wrapContentTables(main);

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
            wrapContentTables(body as HTMLElement);
          }
        });
      }

      wrapContentTables(fb);
      actionEl.appendChild(fb);
    }

    /* ───── EVENTS ───── */
    // Difficulty edit controls
    if (q.id.includes('-DC')) {
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
      cleanupTestSession();
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

    /* Official College Board Desmos calculator */
    if (isMath) {
      root.querySelector('#calc-btn')?.addEventListener('click', () => {
        let modal = document.getElementById('desmos-modal');
        if (!modal) {
          modal = document.createElement('div');
          modal.id = 'desmos-modal';
          Object.assign(modal.style, {
            position: 'fixed', top: '70px', right: '24px',
            width: '460px', height: '540px',
            background: 'var(--c-surface)', border: '1px solid var(--c-border-md)',
            borderRadius: '12px', boxShadow: 'var(--shadow-xl)',
            zIndex: '9999', display: 'flex', flexDirection: 'column',
            overflow: 'hidden', resize: 'both',
          });
          modal.innerHTML = `
            <div id="dh" style="background:#ffffff;color:#0f172a;padding:0.625rem 1rem;cursor:move;display:flex;justify-content:space-between;align-items:center;border-radius:12px 12px 0 0;border-bottom:1px solid #e2e8f0;flex-shrink:0;user-select:none;">
              <span style="font-size:0.875rem;font-weight:700;">Desmos Graphing Calculator</span>
              <div style="display:flex;align-items:center;gap:0.75rem;">
                <button id="d-dock" style="background:transparent;border:none;color:#64748b;cursor:pointer;font-size:0.85rem;line-height:1;font-weight:600;font-family:var(--font);" title="Dock to Left side">Dock</button>
                <button id="dc" style="background:transparent;border:none;color:#64748b;cursor:pointer;font-size:1.1rem;line-height:1;">&#10005;</button>
              </div>
            </div>
            <div style="flex:1; width:100%; height:100%; overflow:hidden; position:relative;">
              <iframe src="https://www.desmos.com/testing/cb/graphing" style="position:absolute; top:-52px; left:0; width:100%; height:calc(100% + 52px); border:none;" title="Official College Board Desmos Calculator"></iframe>
            </div>
          `;
          document.body.appendChild(modal);

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
          };

          dh.addEventListener('mousedown', e => {
            if (document.body.classList.contains('calc-docked')) return;
            ox = e.clientX - modal!.offsetLeft;
            oy = e.clientY - modal!.offsetTop;
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
              modal!.style.width = '460px';
              modal!.style.height = '540px';
            }
          });
        } else {
          modal.style.display = modal.style.display === 'none' ? 'flex' : 'none';
        }
      });

      /* Math Scratchpad Canvas Tool */
      root.querySelector('#draw-btn')?.addEventListener('click', () => {
        let modal = document.getElementById('scratchpad-modal');
        if (!modal) {
          modal = document.createElement('div');
          modal.id = 'scratchpad-modal';
          Object.assign(modal.style, {
            position: 'fixed', top: '70px', left: '24px',
            width: '540px', height: '420px', minWidth: '340px', minHeight: '260px',
            background: '#ffffff', border: '1px solid #cbd5e1',
            borderRadius: '12px', boxShadow: '0 12px 32px rgba(0,0,0,0.15)',
            zIndex: '10000', display: 'flex', flexDirection: 'column',
            overflow: 'hidden', resize: 'both'
          });
          modal.innerHTML = `
            <div id="sph" style="background:#ffffff;color:#0f172a;padding:0.6rem 1rem;cursor:move;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e2e8f0;flex-shrink:0;user-select:none;">
              <span style="font-size:0.875rem;font-weight:700;display:flex;align-items:center;gap:0.35rem;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.5 7.5"/></svg>Math Scratchpad</span>
              <div style="display:flex;align-items:center;gap:0.5rem;">
                <button id="sp-clear" style="background:#ffffff;border:1px solid #cbd5e1;color:#334155;padding:2px 8px;border-radius:4px;cursor:pointer;font-size:0.75rem;font-weight:600;">Clear</button>
                <button id="sp-close" style="background:transparent;border:none;color:#64748b;cursor:pointer;font-size:1.1rem;line-height:1;">&#10005;</button>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:0.5rem;padding:0.4rem 0.75rem;background:#f8fafc;border-bottom:1px solid #e2e8f0;flex-wrap:wrap;">
              <span style="font-size:0.75rem;color:#475569;font-weight:700;">Tool:</span>
              <button id="sp-mode-pen" class="sp-tool-btn active" style="padding:3px 10px;border-radius:6px;border:1px solid #2563eb;background:#eff6ff;color:#2563eb;font-size:0.75rem;font-weight:600;cursor:pointer;">Marker</button>
              <button id="sp-mode-eraser" class="sp-tool-btn" style="padding:3px 10px;border-radius:6px;border:1px solid #cbd5e1;background:#ffffff;color:#475569;font-size:0.75rem;font-weight:600;cursor:pointer;">Eraser</button>
              <div style="width:1px;height:16px;background:#cbd5e1;margin:0 2px;"></div>
              <span style="font-size:0.75rem;color:#475569;font-weight:700;">Colors:</span>
              <div id="sp-colors" style="display:flex;gap:5px;align-items:center;"></div>
              <div style="width:1px;height:16px;background:#cbd5e1;margin:0 2px;"></div>
              <span style="font-size:0.75rem;color:#475569;font-weight:700;">Size:</span>
              <input type="range" id="sp-size" min="1" max="15" value="3" style="width:60px;" />
            </div>
            <div id="sp-canvas-wrapper" style="flex:1;position:relative;background:#ffffff;overflow:hidden;">
              <canvas id="sp-canvas" style="width:100%;height:100%;display:block;cursor:crosshair;background:#ffffff;"></canvas>
            </div>
          `;
          document.body.appendChild(modal);

          const colors = ['#000000', '#2563eb', '#ef4444', '#16a34a', '#eab308', '#9333ea', '#f97316', '#64748b'];
          const colorsContainer = modal.querySelector('#sp-colors')!;
          let currentColor = '#2563eb';
          let currentMode: 'pen' | 'eraser' = 'pen';
          let currentSize = 3;

          colors.forEach(c => {
            const btn = document.createElement('button');
            btn.style.cssText = `width:16px;height:16px;border-radius:50%;background:${c};border:${c === currentColor ? '2px solid #000' : '1px solid rgba(0,0,0,0.2)'};cursor:pointer;padding:0;box-shadow:0 1px 2px rgba(0,0,0,0.1);`;
            btn.addEventListener('click', () => {
              currentColor = c;
              currentMode = 'pen';
              colorsContainer.querySelectorAll('button').forEach(b => (b as HTMLElement).style.border = '1px solid rgba(0,0,0,0.2)');
              btn.style.border = '2px solid #000';

              penBtn.style.border = '1px solid #2563eb';
              penBtn.style.background = '#eff6ff';
              penBtn.style.color = '#2563eb';
              eraserBtn.style.border = '1px solid #cbd5e1';
              eraserBtn.style.background = '#ffffff';
              eraserBtn.style.color = '#475569';
            });
            colorsContainer.appendChild(btn);
          });

          const canvas = modal.querySelector('#sp-canvas') as HTMLCanvasElement;
          const wrapper = modal.querySelector('#sp-canvas-wrapper') as HTMLElement;
          const ctx = canvas.getContext('2d')!;

          setTimeout(() => {
            canvas.width = wrapper.clientWidth || 500;
            canvas.height = wrapper.clientHeight || 300;
            const saved = sess.drawings?.[q.id];
            if (saved) {
              const img = new Image();
              img.onload = () => ctx.drawImage(img, 0, 0);
              img.src = saved;
            }
          }, 50);

          const resizeObserver = new ResizeObserver(() => {
            if (wrapper.clientWidth > 0 && wrapper.clientHeight > 0) {
              const tempCanvas = document.createElement('canvas');
              tempCanvas.width = canvas.width;
              tempCanvas.height = canvas.height;
              const tempCtx = tempCanvas.getContext('2d');
              if (tempCtx && canvas.width > 0 && canvas.height > 0) {
                tempCtx.drawImage(canvas, 0, 0);
              }

              canvas.width = wrapper.clientWidth;
              canvas.height = wrapper.clientHeight;
              if (tempCanvas.width > 0 && tempCanvas.height > 0) {
                ctx.drawImage(tempCanvas, 0, 0);
              }
            }
          });
          resizeObserver.observe(wrapper);

          let drawing = false;
          let lx = 0, ly = 0;

          const getPos = (e: MouseEvent) => {
            const rect = canvas.getBoundingClientRect();
            return { x: e.clientX - rect.left, y: e.clientY - rect.top };
          };

          canvas.addEventListener('mousedown', e => {
            drawing = true;
            const p = getPos(e);
            lx = p.x; ly = p.y;
          });

          canvas.addEventListener('mousemove', e => {
            if (!drawing) return;
            const p = getPos(e);
            ctx.beginPath();
            ctx.moveTo(lx, ly);
            ctx.lineTo(p.x, p.y);
            ctx.strokeStyle = currentMode === 'eraser' ? '#ffffff' : currentColor;
            ctx.lineWidth = currentMode === 'eraser' ? currentSize * 4 : currentSize;
            ctx.lineCap = 'round';
            ctx.stroke();
            lx = p.x; ly = p.y;
          });

          const stopDrawing = () => {
            if (drawing) {
              drawing = false;
              store.saveDrawing(q.id, canvas.toDataURL());
            }
          };

          canvas.addEventListener('mouseup', stopDrawing);
          canvas.addEventListener('mouseleave', stopDrawing);

          const penBtn = modal.querySelector('#sp-mode-pen') as HTMLElement;
          const eraserBtn = modal.querySelector('#sp-mode-eraser') as HTMLElement;

          penBtn?.addEventListener('click', () => {
            currentMode = 'pen';
            penBtn.style.border = '1px solid #2563eb';
            penBtn.style.background = '#eff6ff';
            penBtn.style.color = '#2563eb';
            eraserBtn.style.border = '1px solid #cbd5e1';
            eraserBtn.style.background = '#ffffff';
            eraserBtn.style.color = '#475569';
          });
          eraserBtn?.addEventListener('click', () => {
            currentMode = 'eraser';
            eraserBtn.style.border = '1px solid #2563eb';
            eraserBtn.style.background = '#eff6ff';
            eraserBtn.style.color = '#2563eb';
            penBtn.style.border = '1px solid #cbd5e1';
            penBtn.style.background = '#ffffff';
            penBtn.style.color = '#475569';
          });
          modal.querySelector('#sp-size')?.addEventListener('input', (e) => {
            currentSize = parseInt((e.target as HTMLInputElement).value, 10);
          });
          modal.querySelector('#sp-clear')?.addEventListener('click', () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            store.saveDrawing(q.id, '');
          });
          modal.querySelector('#sp-close')?.addEventListener('click', () => {
            modal!.style.display = 'none';
          });

          const sph = modal.querySelector('#sph') as HTMLElement;
          let ox = 0, oy = 0;
          const onMouseMove = (e: MouseEvent) => {
            modal!.style.left = `${e.clientX - ox}px`;
            modal!.style.top = `${e.clientY - oy}px`;
          };
          const onMouseUp = () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
          };
          sph.addEventListener('mousedown', (e: MouseEvent) => {
            ox = e.clientX - modal!.offsetLeft;
            oy = e.clientY - modal!.offsetTop;
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
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
        const isQFlagged   = sess.flagged.has(qItem.id);
        const isQChecked   = sess.checked.has(qItem.id);
        const solvedInfo   = store.getState().stats.solved?.[qItem.id];

        let isQCorrect = false;
        let isQIncorrect = false;
        let isQAnswered = false;

        if (isQChecked) {
          isQCorrect = !!solvedInfo?.correct;
          isQIncorrect = !!(solvedInfo && !solvedInfo.correct);
          isQAnswered = true;
        } else if (sess.answers[qItem.id]) {
          isQAnswered = true;
        } else if (solvedInfo) {
          isQCorrect = !!solvedInfo.correct;
          isQIncorrect = !solvedInfo.correct;
          isQAnswered = true;
        }

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
          stopTimer();
          showSessionSummaryModal();
        } else {
          idx++;
          currentQuestionIndex = idx;
          draw();
        }
      }
    }
  };

  if (activeKeyDownHandler) {
    window.removeEventListener('keydown', activeKeyDownHandler);
  }
  activeKeyDownHandler = handleKeyDown;
  window.addEventListener('keydown', handleKeyDown);

  draw();
  return root;
}

export function showSessionSummaryModal() {
  const sess = store.getState().session;
  if (!sess) {
    store.setView('dashboard');
    return;
  }

  const qIds = sess.filteredQuestionIds;
  const total = qIds.length;
  const questions = store.getState().questionBank.filter(q => qIds.includes(q.id));
  const answeredCount = Object.keys(sess.answers).length;
  
  let correctCount = 0;
  questions.forEach(q => {
    const userAns = sess.answers[q.id];
    if (userAns && areAnswersEquivalent(q.correctAnswer, userAns)) {
      correctCount++;
    }
  });

  const accuracyPct = answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0;
  
  let totalTime = 0;
  if (sess.questionTimes) {
    totalTime = Object.values(sess.questionTimes).reduce((a, b) => a + b, 0);
  }
  const avgSec = answeredCount > 0 ? Math.round(totalTime / answeredCount) : 0;

  const domainStats: Record<string, { total: number; correct: number }> = {};
  questions.forEach(q => {
    if (!domainStats[q.domain]) domainStats[q.domain] = { total: 0, correct: 0 };
    domainStats[q.domain].total++;
    const userAns = sess.answers[q.id];
    if (userAns && areAnswersEquivalent(q.correctAnswer, userAns)) {
      domainStats[q.domain].correct++;
    }
  });

  const modal = document.createElement('div');
  modal.id = 'session-summary-modal';
  Object.assign(modal.style, {
    position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
    background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(6px)',
    zIndex: '1000000', display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '1.5rem'
  });

  modal.innerHTML = `
    <div style="background:var(--c-surface); border:1px solid var(--c-border-md); border-radius:18px; max-width:600px; width:100%; max-height:90vh; overflow-y:auto; padding:2rem; box-shadow:var(--shadow-xl); font-family:var(--font); color:var(--c-text);">
      <div style="text-align:center; margin-bottom:1.5rem;">
        <h2 style="font-size:1.5rem; font-weight:800; color:var(--c-text); margin-top:0.5rem;">Session Summary</h2>
        <p style="font-size:0.875rem; color:var(--c-text-2); margin-top:0.25rem;">Great work! Here is how you performed in this practice session.</p>
      </div>

      <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:1rem; margin-bottom:1.5rem;">
        <div style="background:var(--c-card); border:1px solid var(--c-border); border-radius:12px; padding:1rem; text-align:center;">
          <div style="font-size:0.75rem; color:var(--c-text-2); font-weight:600;">Accuracy</div>
          <div style="font-size:1.5rem; font-weight:800; color:var(--c-blue); margin-top:0.25rem;">${accuracyPct}%</div>
          <div style="font-size:0.7rem; color:var(--c-text-3);">${correctCount} of ${answeredCount} correct</div>
        </div>
        <div style="background:var(--c-card); border:1px solid var(--c-border); border-radius:12px; padding:1rem; text-align:center;">
          <div style="font-size:0.75rem; color:var(--c-text-2); font-weight:600;">Avg Time / Question</div>
          <div style="font-size:1.5rem; font-weight:800; color:var(--c-green); margin-top:0.25rem;">${avgSec}s</div>
          <div style="font-size:0.7rem; color:var(--c-text-3);">Pace estimate</div>
        </div>
        <div style="background:var(--c-card); border:1px solid var(--c-border); border-radius:12px; padding:1rem; text-align:center;">
          <div style="font-size:0.75rem; color:var(--c-text-2); font-weight:600;">Questions Completed</div>
          <div style="font-size:1.5rem; font-weight:800; color:var(--c-purple); margin-top:0.25rem;">${answeredCount}/${total}</div>
          <div style="font-size:0.7rem; color:var(--c-text-3);">${total - answeredCount} skipped</div>
        </div>
      </div>

      <h3 style="font-size:1rem; font-weight:700; color:var(--c-text); margin-bottom:0.75rem;">Topic Breakdown</h3>
      <div style="display:flex; flex-direction:column; gap:0.5rem; margin-bottom:1.5rem;">
        ${Object.entries(domainStats).map(([dom, st]) => {
          const pct = Math.round((st.correct / st.total) * 100);
          return `
            <div style="background:var(--c-card); border:1px solid var(--c-border); border-radius:10px; padding:0.75rem 1rem; display:flex; align-items:center; justify-content:space-between;">
              <div>
                <div style="font-size:0.85rem; font-weight:600; color:var(--c-text);">${dom}</div>
                <div style="font-size:0.75rem; color:var(--c-text-2);">${st.correct} / ${st.total} correct</div>
              </div>
              <div style="font-size:1rem; font-weight:800; color:${pct >= 70 ? 'var(--c-green)' : (pct >= 40 ? 'var(--c-amber)' : 'var(--c-red)')};">${pct}%</div>
            </div>
          `;
        }).join('')}
      </div>

      <div style="display:flex; justify-content:flex-end; gap:0.75rem;">
        <button class="btn btn-ghost" id="sum-review-btn" style="border:1px solid var(--c-border-md);">Review Questions</button>
        <button class="btn btn-primary" id="sum-finish-btn" style="background:var(--c-blue); color:#fff;">Return to Dashboard</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelector('#sum-review-btn')?.addEventListener('click', () => {
    cleanupTestSession();
    modal.remove();
    store.setView('review');
  });

  modal.querySelector('#sum-finish-btn')?.addEventListener('click', () => {
    cleanupTestSession();
    modal.remove();
    store.endSession();
  });
}
