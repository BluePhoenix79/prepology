import './styles/main.css';
import { registerSW } from 'virtual:pwa-register';
import { store } from './state/Store';
import { getCachedQuestions, setCachedQuestions } from './utils/dbCache';
import { initInteractions } from './utils/interactions';
import { renderDashboard } from './views/Dashboard';
import { renderTestSession } from './views/TestSession';
import { renderReview } from './views/Review';
import { renderVocab } from './views/Vocab';
import { renderSaved } from './views/Saved';
import { renderAnalytics } from './views/Analytics';
import { renderExam } from './views/Exam';

// Ultra-fast async question bank initialization with IndexedDB caching
async function initQuestionBank() {
  // 1. Instant load from IndexedDB cache (< 30ms)
  const cached = await getCachedQuestions();
  if (cached && cached.length > 0) {
    store.setQuestionBank(cached as any);
  }

  // 2. Background sync / First-load fetch
  try {
    const res = await fetch('/questions.json');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        store.setQuestionBank(data as any);
        // Save to IndexedDB cache asynchronously for instant future boots
        setCachedQuestions(data as any);
      }
    }
  } catch (e) {
    console.warn('Network fetch for questions.json failed:', e);
    // Fallback if no cache and fetch failed
    if (!cached || cached.length === 0) {
      const fallbackModule = await import('./data/questions.json');
      store.setQuestionBank((fallbackModule.default || fallbackModule) as any);
    }
  }
}

initQuestionBank();

if ('serviceWorker' in navigator) {
  registerSW({ immediate: true });
}

const app = document.querySelector<HTMLDivElement>('#app')!;

type NavView = 'dashboard' | 'vocab' | 'review' | 'saved' | 'analytics' | 'exam';

const NAV_GROUPS: Array<{ label: string; items: Array<{ view: NavView; label: string; icon: string }> }> = [
  {
    label: 'SAT',
    items: [
      { view: 'dashboard', label: 'Home', icon: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline>' },
    ],
  },
  {
    label: 'Practice',
    items: [
      { view: 'vocab', label: 'Vocab Cards', icon: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>' },
      { view: 'exam', label: 'Practice Tests', icon: '<path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>' },
    ],
  },
  {
    label: 'Progress',
    items: [
      { view: 'review', label: 'Mistakes Log', icon: '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>' },
      { view: 'saved', label: 'Saved Questions', icon: '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>' },
      { view: 'analytics', label: 'Analytics', icon: '<line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line>' },
    ],
  },
];

function navGroupHTML(current: string): string {
  return NAV_GROUPS.map(group => `
    <div class="menu-group">
      <div class="menu-label">${group.label}</div>
      ${group.items.map(item => `
        <button class="menu-item ${current === item.view ? 'active' : ''}" data-view="${item.view}"
                aria-current="${current === item.view ? 'page' : 'false'}" data-tip="${item.label}">
          <svg class="menu-icon-svg" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round">${item.icon}</svg>
          <span class="menu-item-label">${item.label}</span>
        </button>
      `).join('')}
    </div>
  `).join('');
}

function render() {
  const state = store.getState();
  app.innerHTML = ''; // Clear current view
  
  if (state.currentView === 'test') {
    app.appendChild(renderTestSession());
  } else {
    // Clean up modals and docked layouts if not in testing room
    document.getElementById('desmos-modal')?.remove();
    document.getElementById('scratchpad-modal')?.remove();
    document.getElementById('reference-modal')?.remove();
    document.body.classList.remove('calc-docked');

    const shell = document.createElement('div');
    shell.className = 'app-shell';

    const sidebar = document.createElement('div');
    sidebar.className = 'app-sidebar';
    const isLight = state.theme === 'light';
    sidebar.innerHTML = `
      <div class="sidebar-brand">
        <img class="sidebar-logo" src="/prepology_logo.png" alt="" />
        <div class="sidebar-brand-text">
          <h2>Prepology</h2>
          <span class="sidebar-sat-pill">SAT</span>
        </div>
      </div>
      <nav class="sidebar-menu" aria-label="Main">
        ${navGroupHTML(state.currentView)}
      </nav>
      <div class="sidebar-footer">
        <button class="theme-toggle" id="side-theme-toggle" data-tip="${isLight ? 'Dark mode' : 'Light mode'}"
                aria-label="Switch to ${isLight ? 'dark' : 'light'} mode">
          <svg class="theme-toggle-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            ${isLight
              ? '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>'
              : '<circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"></path>'}
          </svg>
          <span class="menu-item-label">${isLight ? 'Dark mode' : 'Light mode'}</span>
        </button>
      </div>
    `;

    const mainContent = document.createElement('div');
    mainContent.className = 'app-main-content';

    switch (state.currentView) {
      case 'dashboard':
        mainContent.appendChild(renderDashboard());
        break;
      case 'review':
        mainContent.appendChild(renderReview());
        break;
      case 'vocab':
        mainContent.appendChild(renderVocab());
        break;
      case 'saved':
        mainContent.appendChild(renderSaved());
        break;
      case 'analytics':
        mainContent.appendChild(renderAnalytics());
        break;
      case 'exam':
        mainContent.appendChild(renderExam());
        break;
      default:
        mainContent.appendChild(renderDashboard());
    }

    shell.appendChild(sidebar);
    shell.appendChild(mainContent);
    app.appendChild(shell);

    // Event listeners
    sidebar.querySelectorAll<HTMLButtonElement>('.menu-item[data-view]').forEach(btn => {
      btn.addEventListener('click', () => store.setView(btn.dataset.view as NavView));
    });
    sidebar.querySelector('#side-theme-toggle')?.addEventListener('click', () => {
      const cur = store.getState().theme || 'dark';
      store.setTheme(cur === 'dark' ? 'light' : 'dark');
    });

    mainContent.classList.add('view-enter');
  }

  // Trigger MathJax typeset to compile LaTeX math formulas
  setTimeout(() => {
    (window as any).MathJax?.typesetPromise?.();
  }, 10);
}

// Initial render
initInteractions();
render();

// Subscribe to state changes for re-rendering
store.subscribe(() => {
  render();
});
