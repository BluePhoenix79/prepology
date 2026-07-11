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
      <div class="op-source-tabs">
        <button class="op-source-tab ${activeSource === 'drills' ? 'active' : ''}" id="src-drills">Practice Drills</button>
        <button class="op-source-tab ${activeSource === 'official' ? 'active' : ''}" id="src-official">Official CB Bank</button>
      </div>

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
          <h3>${missedOnly ? '🔁 Review Missed Questions' : 'Practice all topics'}</h3>
          <p>${missedOnly
            ? `Practice the ${missedCount} question${missedCount !== 1 ? 's' : ''} you've gotten wrong.`
            : `Start practicing all skills in ${activeSection === 'Math' ? 'Mathematics' : 'Reading &amp; Writing'} at the selected difficulty level.`
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
          // Domain-level accuracy
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
                ${isWeakDomain ? `<span style="font-size:0.68rem;background:#fee2e2;color:#b91c1c;padding:0.15rem 0.5rem;border-radius:999px;margin-left:0.5rem;font-weight:700;vertical-align:middle;">⚠ Weak Spot</span>` : ''}
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
            ${missedOnly ? '🎉 No missed questions — great job!' : 'No questions found for the selected filters.'}
          </div>
        ` : ''}
      </div>
    `;
  }

  function draw() {
    root.innerHTML = renderGrid();

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
  }

  draw();
  return root;
}
