import { store } from '../state/Store';
import type { Question } from '../types';

let activeSection: 'Math' | 'Reading and Writing' = 'Reading and Writing';
let activeDifficulty: number = 0; // 0 = All, 1 = Easy, 2 = Medium, 3 = Hard
let activeSource: 'drills' | 'official' = 'official';
let shouldRandomize: boolean = false;
let missedOnly: boolean = false;

export function renderDashboard(): HTMLElement {
  const root = document.createElement('div');
  root.className = 'op-dashboard-root';

  const state = store.getState();
  const { stats, questionBank } = state;
  const solvedMap = stats.solved || {};

  function renderGrid() {
    const questionsForSection = questionBank.filter(q => {
      if (q.section !== activeSection) return false;
      const isOfficial = !!q.official;
      if (activeSource === 'official') return isOfficial;
      return !isOfficial; // drills
    });

    // Group questions by domain and then by skill
    const domainMap: Record<string, Record<string, Question[]>> = {};

    const questionsFiltered = missedOnly
      ? questionsForSection.filter(q => solvedMap[q.id] && !solvedMap[q.id].correct)
      : questionsForSection;

    questionsFiltered.forEach(q => {
      if (!domainMap[q.domain]) domainMap[q.domain] = {};
      if (!domainMap[q.domain][q.skill]) domainMap[q.domain][q.skill] = [];
      domainMap[q.domain][q.skill].push(q);
    });

    // Overall stats from unfiltered section questions
    const allQs = activeDifficulty === 0 ? questionsForSection : questionsForSection.filter(q => q.difficulty === activeDifficulty);
    let totalSolved = 0, totalCorrect = 0;
    allQs.forEach(q => { if (solvedMap[q.id]) { totalSolved++; if (solvedMap[q.id].correct) totalCorrect++; } });
    const overallAccuracy = totalSolved > 0 ? Math.round((totalCorrect / totalSolved) * 100) : null;
    const missedCount = allQs.filter(q => solvedMap[q.id] && !solvedMap[q.id].correct).length;

  return `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; flex-wrap:wrap; gap:1rem;">
        <div>
          <h1 style="font-size:1.75rem; font-weight:800; color:var(--c-text); margin:0;">Dashboard</h1>
          <p style="font-size:0.875rem; color:var(--c-text-2); margin:0.25rem 0 0 0;">Master the Digital SAT with adaptive practice drills and full session analytics.</p>
        </div>
        <div style="display:flex; align-items:center; gap:0.75rem;">
          <button class="btn op-btn-primary" id="btn-start-session-modal" style="background:var(--c-blue); color:#fff; font-weight:700; font-size:0.9rem; padding:0.6rem 1.25rem; border-radius:10px; cursor:pointer; box-shadow:var(--shadow-md);">
            Start Test Session
          </button>
        </div>
      </div>

      <div class="op-source-tabs">
        <button class="op-source-tab ${activeSource === 'drills' ? 'active' : ''}" id="src-drills">Practice Drills</button>
        <button class="op-source-tab ${activeSource === 'official' ? 'active' : ''}" id="src-official">Official CB Bank</button>
      </div>

      ${(() => {
        const newQs = store.getState().questionBank.filter(q => q.isNew);
        if (newQs.length > 0) {
          return `
            <div style="margin-bottom: 1.5rem; padding: 1.25rem; background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(139, 92, 246, 0.1)); border: 1px solid var(--c-blue); border-radius: 12px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 15px rgba(59, 130, 246, 0.15);">
              <div>
                <h3 style="margin: 0 0 0.25rem 0; color: var(--c-blue); font-size: 1.1rem; font-weight: 800;">✨ You have ${newQs.length} newly added questions!</h3>
                <p style="margin: 0; color: var(--c-text-2); font-size: 0.85rem;">Practice them now before they blend into the rest of the question bank.</p>
              </div>
              <button class="btn op-btn-primary" id="btn-practice-new" style="background: var(--c-blue); box-shadow: 0 4px 12px rgba(59,130,246,0.3); padding: 0.6rem 1.2rem;">Practice New Questions</button>
            </div>
          `;
        }
        return '';
      })()}

      <div class="op-section-tabs">
        <button class="op-tab ${activeSection === 'Reading and Writing' ? 'active' : ''}" id="tab-rw">Reading &amp; Writing</button>
        <button class="op-tab ${activeSection === 'Math' ? 'active' : ''}" id="tab-math">Mathematics</button>
      </div>

      <div class="op-header">
        <h1 class="op-title">
          ${activeSection === 'Math' ? 'Mathematics' : 'Reading &amp; Writing'}
          ${overallAccuracy !== null ? `<span style="font-size:0.8rem;font-weight:500;color:${overallAccuracy >= 80 ? '#10b981' : overallAccuracy >= 60 ? '#f59e0b' : '#ef4444'};margin-left:0.75rem;">${overallAccuracy}% overall</span>` : ''}
        </h1>
        <div class="op-header-actions">
          <label class="op-switch-container" for="randomize-checkbox">
            <span>Randomize</span>
            <div class="op-switch">
              <input type="checkbox" id="randomize-checkbox" ${shouldRandomize ? 'checked' : ''} />
              <span class="op-slider"></span>
            </div>
          </label>
          <label class="op-switch-container" for="missed-only-checkbox">
            <span style="color:${missedOnly ? '#ef4444' : 'inherit'};">Missed Only ${missedCount > 0 ? `<span style="background:${missedOnly ? '#ef4444' : '#fee2e2'};color:${missedOnly ? '#fff' : '#b91c1c'};font-size:0.7rem;border-radius:999px;padding:0.1rem 0.4rem;font-weight:700;">${missedCount}</span>` : ''}</span>
            <div class="op-switch">
              <input type="checkbox" id="missed-only-checkbox" ${missedOnly ? 'checked' : ''} />
              <span class="op-slider" style="${missedOnly ? '--op-switch-on: #ef4444;' : ''}"></span>
            </div>
          </label>
          <div class="op-filter-dropdown">
            <label for="difficulty-select" class="op-select-label">Difficulty</label>
            <select id="difficulty-select" class="op-select">
              <option value="0" ${activeDifficulty === 0 ? 'selected' : ''}>All</option>
              <option value="1" ${activeDifficulty === 1 ? 'selected' : ''}>Easy</option>
              <option value="2" ${activeDifficulty === 2 ? 'selected' : ''}>Medium</option>
              <option value="3" ${activeDifficulty === 3 ? 'selected' : ''}>Hard</option>
            </select>
          </div>
        </div>
      </div>

      <div class="op-practice-hero">
        <div class="op-practice-info">
          <h3 style="display:flex;align-items:center;gap:0.5rem;">${missedOnly ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg> Review Missed Questions' : 'Free Practice'}</h3>
          <p>${missedOnly
            ? `Practice the ${missedCount} question${missedCount !== 1 ? 's' : ''} you've gotten wrong.`
            : `Practice all topics in ${activeSection === 'Math' ? 'Mathematics' : 'Reading &amp; Writing'} freely.`
          }</p>
        </div>
        <button class="btn op-btn-primary" id="btn-practice-all">Start practice</button>
      </div>

      <div class="op-table-header">
        <div class="op-col-topic">Topic</div>
        <div class="op-col-progress">Progress</div>
        <div class="op-col-accuracy">Accuracy</div>
      </div>

      <div class="op-domains-container">
        ${Object.entries(domainMap).map(([domainName, skillMap]) => {
          const domainQs = Object.values(skillMap).flat();
          const filteredDomainQs = activeDifficulty === 0 ? domainQs : domainQs.filter(q => q.difficulty === activeDifficulty);
          let domSolved = 0, domCorrect = 0;
          filteredDomainQs.forEach(q => { if (solvedMap[q.id]) { domSolved++; if (solvedMap[q.id].correct) domCorrect++; } });
          const domAccuracy = domSolved > 0 ? Math.round((domCorrect / domSolved) * 100) : null;
          const isWeakDomain = domAccuracy !== null && domAccuracy < 60;

          return `
            <div class="op-domain-section">
              <h2 class="op-domain-title">
                ${domainName}
                ${isWeakDomain ? `<span style="font-size:0.68rem;background:#fee2e2;color:#b91c1c;padding:0.15rem 0.5rem;border-radius:999px;margin-left:0.5rem;font-weight:700;vertical-align:middle;">Weak Spot</span>` : ''}
                ${domAccuracy !== null ? `<span style="font-size:0.75rem;color:${domAccuracy >= 80 ? '#10b981' : domAccuracy >= 60 ? '#f59e0b' : '#ef4444'};margin-left:0.5rem;font-weight:500;">${domAccuracy}%</span>` : ''}
                <span style="font-size:0.7rem;color:#94a3b8;margin-left:0.35rem;font-weight:400;">${filteredDomainQs.length} q</span>
              </h2>
              <div class="op-skills-list">
                ${Object.entries(skillMap).map(([skillName, questions]) => {
                  const filteredQuestions = activeDifficulty === 0
                    ? questions
                    : questions.filter(q => q.difficulty === activeDifficulty);

                  const total = filteredQuestions.length;
                  let solved = 0;
                  let correct = 0;
                  filteredQuestions.forEach(q => {
                    if (solvedMap[q.id]) {
                      solved++;
                      if (solvedMap[q.id].correct) correct++;
                    }
                  });

                  const accuracy = solved > 0 ? Math.round((correct / solved) * 100) : 0;
                  const progressPct = total > 0 ? (solved / total) * 100 : 0;
                  const accuracyDotColor = solved === 0 ? '#cbd5e1' : accuracy >= 80 ? '#10b981' : accuracy >= 50 ? '#f59e0b' : '#ef4444';
                  const accuracyText = solved === 0 ? '—' : `${accuracy}%`;
                  const isPlayable = total > 0;
                  const isSkillWeak = solved >= 3 && accuracy < 60;

                  return `
                    <div class="op-skill-row ${isPlayable ? '' : 'disabled'}" data-domain="${domainName}" data-skill="${skillName}">
                      <div class="op-col-topic">
                        <span class="op-play-icon">▶</span>
                        <span class="op-skill-name">${skillName}${isSkillWeak ? ' <span style="font-size:0.65rem;color:#b91c1c;font-weight:700;">↓</span>' : ''}</span>
                      </div>
                      <div class="op-col-progress">
                        <div class="op-progress-bar-container">
                          <div class="op-progress-bar-track">
                            <div class="op-progress-bar-fill" style="width: ${progressPct}%"></div>
                          </div>
                          <span class="op-progress-text">${solved}/${total}</span>
                        </div>
                      </div>
                      <div class="op-col-accuracy">
                        <span class="op-accuracy-dot" style="background-color: ${accuracyDotColor}"></span>
                        <span class="op-accuracy-pct">${accuracyText}</span>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          `;
        }).join('')}
        ${Object.keys(domainMap).length === 0 ? `
          <div style="text-align:center;padding:3rem 1rem;color:#94a3b8;font-size:0.95rem;">
            ${missedOnly ? 'No missed questions — great job!' : 'No questions found for the selected filters.'}
          </div>
        ` : ''}
      </div>

      <!-- Reported Issues section -->
      ${stats.reportedIssues && stats.reportedIssues.length > 0 ? `
        <div class="glass" style="margin-top: 2rem; padding: 1.5rem; border: 1px solid var(--c-border); border-radius: 12px; background: var(--c-card);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <h2 style="font-size: 1.1rem; font-weight: 700; color: var(--c-text); margin: 0; display: flex; align-items: center; gap: 0.5rem;">
              Reported Issues (${stats.reportedIssues.length})
            </h2>
            <div style="display: flex; gap: 0.5rem;">
              <button class="btn btn-ghost" id="copy-all-issues-btn" style="font-size: 0.75rem; padding: 0.4rem 0.8rem; border-radius: 6px; cursor: pointer; border: 1px solid var(--c-border-md);">Copy All Prompts</button>
              <button class="btn btn-ghost" id="clear-all-issues-btn" style="font-size: 0.75rem; padding: 0.4rem 0.8rem; border-radius: 6px; cursor: pointer; border: 1px solid var(--c-red); color: var(--c-red);">Delete All Prompts</button>
            </div>
          </div>
          <p style="font-size: 0.75rem; color: var(--c-text-2); margin-bottom: 1rem;">Here are the issues you've flagged. You can copy the details to prompt me to fix them.</p>
          <div style="display: flex; flex-direction: column; gap: 0.75rem; max-height: 250px; overflow-y: auto; padding-right: 0.5rem;">
            ${stats.reportedIssues.map((issue) => {
              const displayId = issue.questionId.replace(/_(read|math)$/i, '');
              const dateStr = new Date(issue.timestamp).toLocaleDateString();
              return `
                <div style="background: var(--c-elevated); padding: 0.75rem 1rem; border-radius: 8px; border: 1px solid var(--c-border); display: flex; justify-space: space-between; align-items: center; gap: 1rem;">
                  <div style="flex: 1; text-align: left;">
                    <div style="font-size: 0.8125rem; font-weight: 700; color: var(--c-blue);">Question ${displayId} <span style="font-size: 0.7rem; font-weight: 400; color: var(--c-text-3); margin-left: 0.5rem;">${dateStr}</span></div>
                    <div style="font-size: 0.8125rem; color: var(--c-text); margin-top: 0.25rem; font-style: italic;">"${issue.description}"</div>
                  </div>
                  <button class="btn btn-ghost copy-issue-btn" data-desc="For question ID ${issue.questionId}, I reported the following issue: ${issue.description}. Please fix this question." style="font-size: 0.7rem; padding: 0.35rem 0.7rem; border-radius: 6px; white-space: nowrap; cursor: pointer;">Copy Prompt</button>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      ` : ''}
    `;
  }

  function openStartSessionModal() {
    const modal = document.createElement('div');
    modal.id = 'start-session-modal';
    Object.assign(modal.style, {
      position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
      background: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(6px)',
      zIndex: '100000', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1.25rem'
    });

    const domainsMap: Record<string, string[]> = {
      'Reading and Writing': [
        'Information and Ideas',
        'Craft and Structure',
        'Expression of Ideas',
        'Standard English Conventions'
      ],
      'Math': [
        'Algebra',
        'Advanced Math',
        'Problem-Solving and Data Analysis',
        'Geometry and Trigonometry'
      ]
    };

    modal.innerHTML = `
      <div style="background:var(--c-card); border:1px solid var(--c-border); border-radius:20px; max-width:520px; width:100%; padding:1.75rem; box-shadow:var(--shadow-xl); font-family:var(--font); color:var(--c-text);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; border-bottom:1px solid var(--c-border); padding-bottom:1rem;">
          <div>
            <h2 style="font-size:1.35rem; font-weight:800; color:var(--c-text); margin:0;">Start Test Session</h2>
            <p style="font-size:0.8rem; color:var(--c-text-2); margin:0.2rem 0 0 0;">Customize your targeted SAT practice session.</p>
          </div>
          <button id="close-modal-x" style="background:var(--c-elevated); border:1px solid var(--c-border); color:var(--c-text-2); width:32px; height:32px; border-radius:50%; font-size:1rem; cursor:pointer; display:flex; align-items:center; justify-content:center;">&#10005;</button>
        </div>

        <div style="display:flex; flex-direction:column; gap:1.25rem;">
          <!-- Section Select -->
          <div>
            <label style="font-size:0.8rem; font-weight:700; color:var(--c-text-2); display:block; margin-bottom:0.4rem; text-transform:uppercase; letter-spacing:0.05em;">1. Section</label>
            <select id="modal-sec-select" class="op-select" style="width:100%; padding:0.6rem 0.8rem; border-radius:10px; font-weight:600; font-size:0.9rem;">
              <option value="Reading and Writing">Reading & Writing</option>
              <option value="Math">Mathematics</option>
            </select>
          </div>

          <!-- Checkbox Topics List -->
          <div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
              <label style="font-size:0.8rem; font-weight:700; color:var(--c-text-2); text-transform:uppercase; letter-spacing:0.05em;">2. Select Topics / Domains</label>
              <button id="modal-toggle-all-topics" style="background:none; border:none; color:var(--c-blue); font-size:0.75rem; font-weight:700; cursor:pointer; padding:0;">Select All</button>
            </div>
            <div id="modal-topics-grid" style="display:grid; grid-template-columns:1fr; gap:0.5rem; max-height:170px; overflow-y:auto; padding:0.6rem; border:1px solid var(--c-border); border-radius:12px; background:var(--c-elevated);"></div>
          </div>

          <!-- Difficulty & Question Pool side-by-side -->
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
            <div>
              <label style="font-size:0.8rem; font-weight:700; color:var(--c-text-2); display:block; margin-bottom:0.4rem; text-transform:uppercase; letter-spacing:0.05em;">3. Difficulty</label>
              <select id="modal-diff-select" class="op-select" style="width:100%; padding:0.55rem 0.75rem; border-radius:10px; font-size:0.85rem;">
                <option value="0">All Difficulties</option>
                <option value="1">Easy</option>
                <option value="2">Medium</option>
                <option value="3">Hard</option>
              </select>
            </div>
            <div>
              <label style="font-size:0.8rem; font-weight:700; color:var(--c-text-2); display:block; margin-bottom:0.4rem; text-transform:uppercase; letter-spacing:0.05em;">4. Question Pool</label>
              <select id="modal-src-select" class="op-select" style="width:100%; padding:0.55rem 0.75rem; border-radius:10px; font-size:0.85rem;">
                <option value="official">Official College Board</option>
                <option value="drills">Practice Drills</option>
              </select>
            </div>
          </div>

          <!-- Additional Checkboxes -->
          <div style="display:flex; flex-direction:column; gap:0.6rem; padding:0.75rem; background:var(--c-elevated); border:1px solid var(--c-border); border-radius:10px;">
            <label style="display:flex; align-items:center; gap:0.6rem; font-size:0.85rem; color:var(--c-text); cursor:pointer; font-weight:500;">
              <input type="checkbox" id="modal-rand-check" checked style="width:16px; height:16px; accent-color:var(--c-blue); cursor:pointer;" />
              Randomize question order
            </label>
            <label style="display:flex; align-items:center; gap:0.6rem; font-size:0.85rem; color:var(--c-text); cursor:pointer; font-weight:500;">
              <input type="checkbox" id="modal-missed-check" style="width:16px; height:16px; accent-color:var(--c-red); cursor:pointer;" />
              Only include previously missed questions
            </label>
          </div>
        </div>

        <!-- Actions Footer -->
        <div style="display:flex; justify-content:flex-end; gap:0.75rem; margin-top:1.5rem; border-top:1px solid var(--c-border); padding-top:1rem;">
          <button class="btn btn-ghost" id="modal-cancel-btn" style="padding:0.6rem 1.25rem; border-radius:10px;">Cancel</button>
          <button class="btn op-btn-primary" id="modal-start-btn" style="background:var(--c-blue); color:#fff; font-weight:700; padding:0.6rem 1.5rem; border-radius:10px; box-shadow:var(--shadow-md);">Start Session</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const secSelect = modal.querySelector('#modal-sec-select') as HTMLSelectElement;
    const topicsGrid = modal.querySelector('#modal-topics-grid') as HTMLElement;
    const toggleAllBtn = modal.querySelector('#modal-toggle-all-topics') as HTMLButtonElement;

    function populateTopics(sec: string) {
      const list = domainsMap[sec] || [];
      topicsGrid.innerHTML = list.map(domain => `
        <label style="display:flex; align-items:center; gap:0.6rem; padding:0.45rem 0.75rem; background:var(--c-card); border:1px solid var(--c-border); border-radius:8px; cursor:pointer; font-size:0.825rem; color:var(--c-text); transition:all 0.15s ease;">
          <input type="checkbox" class="modal-topic-cb" value="${domain}" checked style="width:15px; height:15px; accent-color:var(--c-blue); cursor:pointer;" />
          <span>${domain}</span>
        </label>
      `).join('');
    }

    populateTopics(secSelect.value);

    secSelect.addEventListener('change', () => {
      populateTopics(secSelect.value);
    });

    let allChecked = true;
    toggleAllBtn?.addEventListener('click', () => {
      allChecked = !allChecked;
      toggleAllBtn.textContent = allChecked ? 'Select All' : 'Deselect All';
      modal.querySelectorAll<HTMLInputElement>('.modal-topic-cb').forEach(cb => {
        cb.checked = allChecked;
      });
    });

    modal.querySelector('#close-modal-x')?.addEventListener('click', () => modal.remove());
    modal.querySelector('#modal-cancel-btn')?.addEventListener('click', () => modal.remove());
    modal.querySelector('#modal-start-btn')?.addEventListener('click', () => {
      const sec = secSelect.value as any;
      const diff = parseInt((modal.querySelector('#modal-diff-select') as HTMLSelectElement).value, 10);
      const src = (modal.querySelector('#modal-src-select') as HTMLSelectElement).value;
      const rand = (modal.querySelector('#modal-rand-check') as HTMLInputElement).checked;
      const missed = (modal.querySelector('#modal-missed-check') as HTMLInputElement).checked;

      const selectedTopics: string[] = [];
      modal.querySelectorAll<HTMLInputElement>('.modal-topic-cb:checked').forEach(cb => {
        selectedTopics.push(cb.value);
      });

      modal.remove();
      store.startSession(sec, diff, selectedTopics.length > 0 ? selectedTopics : undefined, undefined, src === 'official', rand, missed ? 'missed' : undefined, undefined, true);
    });
  }

  function draw() {
    root.innerHTML = renderGrid();

    root.querySelector('#theme-toggle-btn')?.addEventListener('click', () => {
      const currentTheme = store.getState().theme || 'dark';
      store.setTheme(currentTheme === 'dark' ? 'light' : 'dark');
      draw();
    });

    root.querySelector('#btn-start-session-modal')?.addEventListener('click', () => {
      openStartSessionModal();
    });

    root.querySelector('#tab-rw')?.addEventListener('click', () => {
      activeSection = 'Reading and Writing';
      draw();
    });

    root.querySelector('#tab-math')?.addEventListener('click', () => {
      activeSection = 'Math';
      draw();
    });

    root.querySelector('#src-drills')?.addEventListener('click', () => {
      activeSource = 'drills';
      draw();
    });

    root.querySelector('#src-official')?.addEventListener('click', () => {
      activeSource = 'official';
      draw();
    });

    const diffSelect = root.querySelector('#difficulty-select') as HTMLSelectElement;
    diffSelect?.addEventListener('change', (e) => {
      activeDifficulty = parseInt((e.target as HTMLSelectElement).value, 10);
      draw();
    });

    const randCheckbox = root.querySelector('#randomize-checkbox') as HTMLInputElement;
    randCheckbox?.addEventListener('change', (e) => {
      shouldRandomize = (e.target as HTMLInputElement).checked;
    });

    const missedCheckbox = root.querySelector('#missed-only-checkbox') as HTMLInputElement;
    missedCheckbox?.addEventListener('change', (e) => {
      missedOnly = (e.target as HTMLInputElement).checked;
      draw();
    });

    root.querySelector('#btn-practice-all')?.addEventListener('click', () => {
      store.startSession(activeSection, activeDifficulty, undefined, undefined, activeSource === 'official', shouldRandomize, missedOnly ? 'missed' : undefined);
    });

    root.querySelectorAll('.op-skill-row').forEach(row => {
      row.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        if (target.classList.contains('disabled')) return;
        const domain = target.dataset.domain;
        const skill = target.dataset.skill;
        store.startSession(activeSection, activeDifficulty, domain, skill, activeSource === 'official', shouldRandomize, missedOnly ? 'missed' : undefined);
      });
    });

    root.querySelectorAll('.copy-issue-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const desc = (e.currentTarget as HTMLElement).dataset.desc || '';
        navigator.clipboard.writeText(desc).then(() => {
          const originalText = (e.currentTarget as HTMLElement).textContent || 'Copy Prompt';
          (e.currentTarget as HTMLElement).textContent = 'Copied!';
          setTimeout(() => {
            (e.currentTarget as HTMLElement).textContent = originalText;
          }, 1500);
        });
      });
    });

    root.querySelector('#copy-all-issues-btn')?.addEventListener('click', (e) => {
      const stats = store.getState().stats;
      if (!stats.reportedIssues || stats.reportedIssues.length === 0) return;
      const combined = stats.reportedIssues.map(issue => `For question ID ${issue.questionId}, I reported the following issue: ${issue.description}. Please fix this question.`).join('\n\n');
      navigator.clipboard.writeText(combined).then(() => {
        const btn = e.currentTarget as HTMLElement;
        const originalText = btn.textContent || 'Copy All Prompts';
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = originalText; }, 1500);
      });
    });

    root.querySelector('#clear-all-issues-btn')?.addEventListener('click', () => {
      if (confirm('Are you sure you want to delete all prompts?')) {
        store.clearReportedIssues();
        draw();
      }
    });

    root.querySelector('#btn-practice-new')?.addEventListener('click', () => {
      // Start a session with new questions (filterMode = 'new')
      store.startSession(activeSection, activeDifficulty, undefined, undefined, undefined, true, 'new');
    });
  }

  draw();
  return root;
}
