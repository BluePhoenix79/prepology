import './styles/main.css';
import { store } from './state/Store';
import { getCachedQuestions, setCachedQuestions } from './utils/dbCache';
import {
  SCOPED_KEYS,
  adoptAnonymousData,
  getUser,
  isConfigured,
  onAuthChange,
  renderGoogleButton,
  signOut,
} from './utils/auth';
import { renderDashboard } from './views/Dashboard';
import { renderTestSession } from './views/TestSession';
import { renderReview } from './views/Review';
import { renderVocab } from './views/Vocab';
import { renderSaved } from './views/Saved';
import { renderAnalytics } from './views/Analytics';

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

const app = document.querySelector<HTMLDivElement>('#app')!;

/* ── Account ─────────────────────────────────────────────── */

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() || '').join('') || '?';
}

function accountBlockHTML(): string {
  const user = getUser();
  if (user) {
    return `
      <div class="account-block">
        <div class="account-identity">
          ${user.picture
            ? `<img class="account-avatar" src="${user.picture}" alt="" referrerpolicy="no-referrer" />`
            : `<div class="account-avatar account-avatar--initials">${initials(user.name)}</div>`}
          <div class="account-text">
            <span class="account-name">${user.name}</span>
            <span class="account-email">${user.email}</span>
          </div>
        </div>
        <button class="account-action" id="account-signout">Sign out</button>
      </div>`;
  }
  if (!isConfigured()) {
    return `
      <div class="account-block">
        <p class="account-note">Google sign-in isn't configured. Set <code>VITE_GOOGLE_CLIENT_ID</code> to enable accounts.</p>
      </div>`;
  }
  return `
    <div class="account-block">
      <button class="account-signin" id="account-signin">
        <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.9z"/><path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24z"/><path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.6V6.7H1.4a12 12 0 0 0 0 10.8l4-3.1z"/><path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.7l4 3.1C6.3 6.9 8.9 4.8 12 4.8z"/></svg>
        Sign in with Google
      </button>
    </div>`;
}

function openSignInModal() {
  document.getElementById('signin-modal')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'signin-modal';
  overlay.className = 'signin-overlay';
  overlay.innerHTML = `
    <div class="signin-card" role="dialog" aria-modal="true" aria-labelledby="signin-title">
      <button class="signin-close" id="signin-close" aria-label="Close">&#10005;</button>
      <img class="signin-logo" src="/prepology_logo.png" alt="" />
      <h2 id="signin-title">Sign in to Prepology</h2>
      <p>Keep your practice history, mistakes log, and vocabulary schedule under your own account on this device.</p>
      <div class="signin-button-slot" id="signin-button-slot">
        <span class="signin-loading">Loading Google sign-in…</span>
      </div>
      <p class="signin-fineprint">
        Progress is stored in this browser and is not uploaded anywhere. Signing in keeps
        separate progress for each account sharing this device.
      </p>
    </div>`;

  const close = () => overlay.remove();
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  overlay.querySelector('#signin-close')?.addEventListener('click', close);
  document.addEventListener('keydown', function onEsc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onEsc); }
  });

  document.body.appendChild(overlay);

  const slot = overlay.querySelector<HTMLElement>('#signin-button-slot')!;
  renderGoogleButton(slot).then(ok => {
    if (!ok) {
      slot.innerHTML = `<p class="signin-error">Couldn't load Google sign-in. Check your connection and that <code>VITE_GOOGLE_CLIENT_ID</code> is a valid OAuth client for this origin.</p>`;
    }
  });
}

// Signing in or out swaps which storage namespace the app reads from.
onAuthChange(user => {
  if (user) adoptAnonymousData(SCOPED_KEYS);
  document.getElementById('signin-modal')?.remove();
  store.reloadForActiveUser();
});

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
      <div style="padding: 1rem; border-top: 1px solid var(--c-border); margin-top: auto;">
        ${accountBlockHTML()}
        <button class="btn" id="side-theme-toggle" style="width:100%; background:var(--c-elevated); border:1px solid var(--c-border); color:var(--c-text); font-size:0.8rem; padding:0.5rem; border-radius:8px; cursor:pointer;">
          ${state.theme === 'light' ? 'Dark Mode' : 'Light Mode'}
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
    sidebar.querySelector('#side-theme-toggle')?.addEventListener('click', () => {
      const cur = store.getState().theme || 'dark';
      store.setTheme(cur === 'dark' ? 'light' : 'dark');
    });
    sidebar.querySelector('#account-signin')?.addEventListener('click', openSignInModal);
    sidebar.querySelector('#account-signout')?.addEventListener('click', () => signOut());
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
