import { store } from '../state/Store';
import type { Question } from '../types';

let activeSection: 'Math' | 'Reading and Writing' = 'Reading and Writing';
let activeDifficulty: number = 0; // 0 = All, 1 = Easy, 2 = Medium, 3 = Hard
let activeSource: 'drills' | 'official' = 'drills';

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
    questionsForSection.forEach(q => {
      if (!domainMap[q.domain]) domainMap[q.domain] = {};
      if (!domainMap[q.domain][q.skill]) domainMap[q.domain][q.skill] = [];
      domainMap[q.domain][q.skill].push(q);
    });

    return `
      <div class="op-source-tabs">
        <button class="op-source-tab ${activeSource === 'drills' ? 'active' : ''}" id="src-drills">Practice Drills</button>
        <button class="op-source-tab ${activeSource === 'official' ? 'active' : ''}" id="src-official">Official CB Bank</button>
      </div>

      <div class="op-section-tabs">
        <button class="op-tab ${activeSection === 'Reading and Writing' ? 'active' : ''}" id="tab-rw">Reading & Writing</button>
        <button class="op-tab ${activeSection === 'Math' ? 'active' : ''}" id="tab-math">Mathematics</button>
      </div>

      <div class="op-header">
        <h1 class="op-title">${activeSection === 'Math' ? 'Mathematics' : 'Reading & Writing'}</h1>
        <div class="op-header-actions">
          <div class="op-search-box">
            <input type="text" id="qb-id-search" class="op-search-input" placeholder="Search CB Question ID..." autocomplete="off" />
            <button id="qb-search-btn" class="op-search-btn">Go</button>
          </div>
          <div class="op-filter-dropdown">
            <label for="difficulty-select" class="op-select-label">Filters</label>
            <select id="difficulty-select" class="op-select">
              <option value="0" ${activeDifficulty === 0 ? 'selected' : ''}>Difficulty: All</option>
              <option value="1" ${activeDifficulty === 1 ? 'selected' : ''}>Difficulty: Easy</option>
              <option value="2" ${activeDifficulty === 2 ? 'selected' : ''}>Difficulty: Medium</option>
              <option value="3" ${activeDifficulty === 3 ? 'selected' : ''}>Difficulty: Hard</option>
            </select>
          </div>
        </div>
      </div>

      <div class="op-practice-hero">
        <div class="op-practice-info">
          <h3>Practice all topics</h3>
          <p>Start practicing all skills in ${activeSection === 'Math' ? 'Mathematics' : 'Reading & Writing'} at the selected difficulty level.</p>
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
          return `
            <div class="op-domain-section">
              <h2 class="op-domain-title">${domainName}</h2>
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

                  return `
                    <div class="op-skill-row ${isPlayable ? '' : 'disabled'}" data-domain="${domainName}" data-skill="${skillName}">
                      <div class="op-col-topic">
                        <span class="op-play-icon">▶</span>
                        <span class="op-skill-name">${skillName}</span>
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

    // Handle Search by ID
    const searchInp = root.querySelector('#qb-id-search') as HTMLInputElement;
    const searchBtn = root.querySelector('#qb-search-btn');

    const handleSearch = () => {
      const val = searchInp.value.trim().toLowerCase();
      if (!val) return;
      const latestQB = store.getState().questionBank;
      const found = latestQB.find(q => q.id.toLowerCase() === val);
      if (found) {
        store.startTargetedSession([{ id: found.id, section: found.section }]);
      } else {
        alert(`Question ID "${searchInp.value.trim()}" not found in database. Make sure it is a valid 8-character ID.`);
      }
    };

    searchBtn?.addEventListener('click', handleSearch);
    searchInp?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleSearch();
    });

    root.querySelector('#btn-practice-all')?.addEventListener('click', () => {
      store.startSession(activeSection, activeDifficulty, undefined, undefined, activeSource === 'official');
    });

    root.querySelectorAll('.op-skill-row').forEach(row => {
      row.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        if (target.classList.contains('disabled')) return;
        const domain = target.dataset.domain;
        const skill = target.dataset.skill;
        store.startSession(activeSection, activeDifficulty, domain, skill, activeSource === 'official');
      });
    });
  }

  draw();
  return root;
}
