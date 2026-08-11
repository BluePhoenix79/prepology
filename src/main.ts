import './styles/main.css';
import { registerSW } from 'virtual:pwa-register';
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
import { initInteractions } from './utils/interactions';
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

if ('serviceWorker' in navigator) {
  registerSW({ immediate: true });
}

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
      <button class="account-signin" id="account-signin" data-tip="Sign in with Google">
        <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.9z"/><path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24z"/><path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.6V6.7H1.4a12 12 0 0 0 0 10.8l4-3.1z"/><path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.7l4 3.1C6.3 6.9 8.9 4.8 12 4.8z"/></svg>
        <span class="menu-item-label">Sign in with Google</span>
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

type NavView = 'dashboard' | 'vocab' | 'review' | 'saved' | 'analytics';

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
        ${accountBlockHTML()}
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
    sidebar.querySelector('#account-signin')?.addEventListener('click', openSignInModal);
    sidebar.querySelector('#account-signout')?.addEventListener('click', () => signOut());

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
