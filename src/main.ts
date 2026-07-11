import './styles/main.css';
import { store } from './state/Store';
import questionsData from './data/questions.json';
import { renderDashboard } from './views/Dashboard';
import { renderTestSession } from './views/TestSession';
import { renderReview } from './views/Review';
import { renderVocab } from './views/Vocab';
import { renderSaved } from './views/Saved';
import { renderAnalytics } from './views/Analytics';

// Initialize question bank — always clear any stale session from localStorage
// so that type changes don't break older stored sessions.
const savedRaw = localStorage.getItem('prepology_state') || localStorage.getItem('preplogy_state');
if (savedRaw) {
  try {
    const saved = JSON.parse(savedRaw);
    // If session exists in storage, wipe it — sessions should not survive page reloads.
    if (saved.session) {
      saved.session = null;
      saved.currentView = 'dashboard';
      localStorage.setItem('prepology_state', JSON.stringify(saved));
    }
  } catch {
    localStorage.removeItem('prepology_state');
    localStorage.removeItem('preplogy_state');
  }
}

store.setQuestionBank(questionsData as any);

const app = document.querySelector<HTMLDivElement>('#app')!;

function render() {
  const state = store.getState();
  app.innerHTML = ''; // Clear current view
  
  if (state.currentView === 'test') {
    app.appendChild(renderTestSession());
  } else {
    const shell = document.createElement('div');
    shell.className = 'app-shell';

    const sidebar = document.createElement('div');
    sidebar.className = 'app-sidebar';
    sidebar.innerHTML = `
      <div class="sidebar-brand" style="display:flex; flex-direction:column; align-items:center; text-align:center; padding: 2rem 1rem 1rem 1rem; gap: 0.75rem;">
        <img src="/prepology_logo.png" alt="Prepology Logo" style="width:64px; height:64px; object-fit:contain; border-radius:12px; filter: drop-shadow(0 4px 12px rgba(0,0,0,0.25));" />
        <div class="sidebar-brand-text" style="display:flex; flex-direction:column; align-items:center; gap:0.25rem;">
          <h2 style="font-size:1.35rem; font-weight:800; color:var(--c-text); margin:0;">Prepology</h2>
          <span class="sidebar-sat-pill">SAT</span>
        </div>
      </div>
      <div class="sidebar-menu">
        <div class="menu-group">
          <div class="menu-label">SAT</div>
          <button class="menu-item ${state.currentView === 'dashboard' ? 'active' : ''}" id="side-home">
            <svg class="menu-icon-svg" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
            Home
          </button>
        </div>
        <div class="menu-group">
          <div class="menu-label">PRACTICE</div>
          <button class="menu-item ${state.currentView === 'vocab' ? 'active' : ''}" id="side-vocab">
            <svg class="menu-icon-svg" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
            Vocab Cards
          </button>
        </div>
        <div class="menu-group">
          <div class="menu-label">PROGRESS</div>
          <button class="menu-item ${state.currentView === 'review' ? 'active' : ''}" id="side-review">
            <svg class="menu-icon-svg" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            Mistakes Log
          </button>
          <button class="menu-item ${state.currentView === 'saved' ? 'active' : ''}" id="side-saved">
            <svg class="menu-icon-svg" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
            Saved Questions
          </button>
          <button class="menu-item ${state.currentView === 'analytics' ? 'active' : ''}" id="side-analytics">
            <svg class="menu-icon-svg" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
            Analytics
          </button>
        </div>
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
      default:
        mainContent.appendChild(renderDashboard());
    }

    shell.appendChild(sidebar);
    shell.appendChild(mainContent);
    app.appendChild(shell);

    // Event listeners
    sidebar.querySelector('#side-home')?.addEventListener('click', () => store.setView('dashboard'));
    sidebar.querySelector('#side-vocab')?.addEventListener('click', () => store.setView('vocab'));
    sidebar.querySelector('#side-review')?.addEventListener('click', () => store.setView('review'));
    sidebar.querySelector('#side-saved')?.addEventListener('click', () => store.setView('saved'));
    sidebar.querySelector('#side-analytics')?.addEventListener('click', () => store.setView('analytics'));
  }

  // Trigger MathJax typeset to compile LaTeX math formulas
  setTimeout(() => {
    (window as any).MathJax?.typesetPromise?.();
  }, 10);
}

// Initial render
render();

// Subscribe to state changes for re-rendering
store.subscribe(() => {
  render();
});
