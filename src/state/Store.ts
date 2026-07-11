import type { AppState, Question, TestSession } from '../types';
import { calculatePredictedScore, updateTopicMastery } from '../utils/scoring';

function parseFractionOrDecimal(val: string): number {
  const s = val.trim();
  if (s.includes('/')) {
    const parts = s.split('/');
    if (parts.length === 2) {
      const num = Number(parts[0]);
      const den = Number(parts[1]);
      if (!isNaN(num) && !isNaN(den) && den !== 0) {
        return num / den;
      }
    }
  }
  return Number(s);
}

function areAnswersEquivalent(ans1: string, ans2: string): boolean {
  if (!ans1 || !ans2) return false;
  const a1 = ans1.trim().toUpperCase();
  const a2 = ans2.trim().toUpperCase();
  if (a1 === a2) return true;
  
  const v1 = parseFractionOrDecimal(a1);
  const v2 = parseFractionOrDecimal(a2);
  if (!isNaN(v1) && !isNaN(v2)) {
    return Math.abs(v1 - v2) < 1e-6;
  }
  return false;
}

type Listener = (state: AppState) => void;

const defaultState: AppState = {
  currentView: 'dashboard',
  session: null,
  stats: {
    predictedMathScore: 400,
    predictedRWScore: 400,
    questionsAttempted: 0,
    correctAnswers: 0,
    mistakes: [],
    topicMastery: {},
    solved: {},
    savedQuestions: [],
    streak: 0,
    solveHistory: []
  },
  questionBank: [],
  difficultyOverrides: {}
};

function loadState(): AppState {
  const saved = localStorage.getItem('prepology_state') || localStorage.getItem('preplogy_state');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      // ALWAYS wipe session on reload — sessions should never persist across page loads.
      // This prevents crashes from stale/incompatible session structures.
      parsed.session = null;
      parsed.currentView = 'dashboard';
      if (parsed.stats) {
        if (!parsed.stats.solved) parsed.stats.solved = {};
        if (!parsed.stats.savedQuestions) parsed.stats.savedQuestions = [];
        if (parsed.stats.streak === undefined) parsed.stats.streak = 0;
        if (!parsed.stats.solveHistory) parsed.stats.solveHistory = [];
      }
      if (!parsed.difficultyOverrides) {
        parsed.difficultyOverrides = {};
      }
      // SELF-REPAIR: If old large questionBank exists in localStorage, prune it to free up quota
      if (parsed.questionBank) {
        delete parsed.questionBank;
        try {
          localStorage.setItem('prepology_state', JSON.stringify(parsed));
        } catch (err) {
          console.error('Failed to prune legacy questionBank', err);
        }
      }
      return { 
        ...defaultState, 
        ...parsed, 
        stats: { ...defaultState.stats, ...parsed.stats },
        difficultyOverrides: parsed.difficultyOverrides || {},
        questionBank: [] // Reset questionBank so it is loaded fresh from JSON
      };
    } catch (e) {
      console.error('Failed to load state', e);
      localStorage.removeItem('prepology_state');
      localStorage.removeItem('preplogy_state');
    }
  }
  return defaultState;
}

function saveState(state: AppState) {
  // Convert Sets to Arrays for JSON serialization, and omit static questionBank to save storage space
  const { questionBank, ...rest } = state;
  const stateToSave = JSON.parse(JSON.stringify(rest, (_key, value) => {
    if (value instanceof Set) {
      return Array.from(value);
    }
    return value;
  }));
  localStorage.setItem('prepology_state', JSON.stringify(stateToSave));
}

class Store {
  private state: AppState;
  private listeners: Listener[] = [];

  constructor() {
    this.state = loadState();
    this.checkStreak();
  }

  public subscribe(listener: Listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    saveState(this.state);
    this.listeners.forEach(listener => listener(this.state));
  }

  public getState(): AppState {
    return this.state;
  }

  // Actions
  public setView(view: AppState['currentView']) {
    this.state.currentView = view;
    // Simple path-based routing (update URL without reloading)
    window.history.pushState({}, '', `/${view === 'dashboard' ? '' : view}`);
    this.notify();
  }

  public setQuestionBank(questions: Question[]) {
    const overrides = this.state.difficultyOverrides || {};
    this.state.questionBank = questions.map(q => {
      if (overrides[q.id] !== undefined) {
        return { ...q, difficulty: overrides[q.id] };
      }
      return q;
    });
    
    this.notify();
  }

  public startSession(section: TestSession['currentSection'], difficulty?: number, domain?: string, skill?: string, isOfficial?: boolean, randomize?: boolean, filterMode?: 'missed' | undefined) {
    let filtered = this.state.questionBank.filter(q => q.section === section);
    if (isOfficial !== undefined) {
      filtered = filtered.filter(q => !!q.official === isOfficial);
    }
    if (difficulty && difficulty !== 0) {
      filtered = filtered.filter(q => q.difficulty === difficulty);
    }
    if (domain && domain !== 'All') {
      filtered = filtered.filter(q => q.domain === domain);
    }
    if (skill && skill !== 'All') {
      filtered = filtered.filter(q => q.skill === skill);
    }
    // Missed-only mode: only questions answered incorrectly
    if (filterMode === 'missed') {
      const solvedMap = this.state.stats.solved || {};
      filtered = filtered.filter(q => solvedMap[q.id] && !solvedMap[q.id].correct);
    }
    
    if (randomize) {
      for (let i = filtered.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [filtered[i], filtered[j]] = [filtered[j], filtered[i]];
      }
    }
    
    this.state.session = {
      id: crypto.randomUUID(),
      startTime: Date.now(),
      timeRemaining: 0,
      currentSection: section,
      filteredQuestionIds: filtered.map(q => q.id),
      answers: {},
      checked: new Set(),
      attempts: {},
      flagged: new Set(),
      eliminatedOptions: {},
      completed: false
    };
    this.state.currentView = 'test';
    window.history.pushState({}, '', `/test`);
    this.notify();
  }

  public answerQuestion(questionId: string, optionId: string) {
    if (this.state.session) {
      this.state.session.answers[questionId] = optionId;
      this.notify();
    }
  }
  
  public checkAnswer(questionId: string, timeSpent?: number) {
    if (this.state.session) {
      this.state.session.checked.add(questionId);
      if (!this.state.session.attempts[questionId]) {
        this.state.session.attempts[questionId] = 0;
      }
      this.state.session.attempts[questionId]++;

      // INCREMENTAL SAVE: Save progress immediately when checked
      const qId = questionId;
      const optionId = this.state.session.answers[qId];
      const q = this.state.questionBank.find(x => x.id === qId);
      if (q && optionId !== undefined) {
        if (!this.state.stats.solved) {
          this.state.stats.solved = {};
        }
        
        // Only update stats.questionsAttempted if this is the first attempt at checking this question
        const isFirstAttempt = this.state.session.attempts[qId] === 1;
        const prevSolved = this.state.stats.solved[qId];
        
        if (isFirstAttempt && !prevSolved) {
          this.state.stats.questionsAttempted++;
        }
        
        const isCorrect = areAnswersEquivalent(q.correctAnswer, optionId);
        
        this.state.stats.solved[qId] = {
          attempts: this.state.session.attempts[qId],
          correct: isCorrect && this.state.session.attempts[qId] <= 1
        };

        if (isCorrect && this.state.session.attempts[qId] <= 1 && (!prevSolved || !prevSolved.correct)) {
          this.state.stats.correctAnswers++;
        } else if ((!isCorrect || this.state.session.attempts[qId] > 1) && (!prevSolved || prevSolved.correct)) {
          if (!this.state.stats.mistakes.includes(q.id)) {
            this.state.stats.mistakes.push(q.id);
          }
        }

        // Save attempt in solveHistory
        if (!this.state.stats.solveHistory) {
          this.state.stats.solveHistory = [];
        }
        const existingIdx = this.state.stats.solveHistory.findIndex(h => h.id === qId);
        const historyEntry = {
          id: qId,
          timestamp: Date.now(),
          correct: isCorrect && this.state.session.attempts[qId] <= 1,
          timeSpent: timeSpent || 45,
          difficulty: q.difficulty,
          section: q.section,
          domain: q.domain,
          skill: q.skill
        };
        if (existingIdx !== -1) {
          this.state.stats.solveHistory[existingIdx] = historyEntry;
        } else {
          this.state.stats.solveHistory.push(historyEntry);
        }
      }

      this.notify();
    }
  }

  public setQuestionDifficulty(questionId: string, difficulty: 1 | 2 | 3) {
    if (!this.state.difficultyOverrides) {
      this.state.difficultyOverrides = {};
    }
    this.state.difficultyOverrides[questionId] = difficulty;

    // Apply to loaded questionBank
    this.state.questionBank = this.state.questionBank.map(q => {
      if (q.id === questionId) {
        return { ...q, difficulty };
      }
      return q;
    });

    // Also update in solveHistory if present there
    if (this.state.stats.solveHistory) {
      this.state.stats.solveHistory = this.state.stats.solveHistory.map(h => {
        if (h.id === questionId) {
          return { ...h, difficulty };
        }
        return h;
      });
    }

    this.notify();
  }

  public toggleFlag(questionId: string) {
    if (this.state.session) {
      if (this.state.session.flagged.has(questionId)) {
        this.state.session.flagged.delete(questionId);
      } else {
        this.state.session.flagged.add(questionId);
      }
      this.notify();
    }
  }

  public toggleEliminateOption(questionId: string, optionId: string) {
    if (this.state.session) {
      if (!this.state.session.eliminatedOptions[questionId]) {
        this.state.session.eliminatedOptions[questionId] = new Set();
      }
      const eliminated = this.state.session.eliminatedOptions[questionId];
      if (eliminated.has(optionId)) {
        eliminated.delete(optionId);
      } else {
        eliminated.add(optionId);
      }
      this.notify();
    }
  }
  
  public endSession() {
    if (this.state.session) {
      this.state.session.completed = true;
      
      // Compute score and update stats
      const score = calculatePredictedScore(this.state.session, this.state.questionBank);
      if (this.state.session.currentSection === 'Math') {
        this.state.stats.predictedMathScore = score;
      } else {
        this.state.stats.predictedRWScore = score;
      }
      
      // Update mastery and mistakes
      this.state.stats.topicMastery = updateTopicMastery(this.state);
      
      if (!this.state.stats.solved) {
        this.state.stats.solved = {};
      }

      let correctInSession = 0;
      for (const [qId, optionId] of Object.entries(this.state.session.answers)) {
        const q = this.state.questionBank.find(x => x.id === qId);
        if (q) {
          const prevSolved = this.state.stats.solved[qId];
          const attemptCount = this.state.session.attempts[qId] || 0;

          // If the student answered but never checked the answer, record it now!
          if (!prevSolved) {
            this.state.stats.questionsAttempted++;
            const isCorrect = areAnswersEquivalent(q.correctAnswer, optionId);
            
            this.state.stats.solved[qId] = {
              attempts: Math.max(1, attemptCount),
              correct: isCorrect
            };

            if (isCorrect) {
              correctInSession++;
            } else {
              if (!this.state.stats.mistakes.includes(q.id)) {
                this.state.stats.mistakes.push(q.id);
              }
            }
          }
        }
      }
      
      this.state.stats.correctAnswers += correctInSession;
      
      this.state.session = null;
      this.checkStreak();
      this.setView('dashboard');
    }
  }

  public startTargetedSession(questions: { id: string; section: string }[]) {
    if (questions.length === 0) return;
    const section = questions[0].section as any;
    this.state.session = {
      id: crypto.randomUUID(),
      startTime: Date.now(),
      timeRemaining: 0,
      currentSection: section,
      filteredQuestionIds: questions.map(q => q.id),
      answers: {},
      checked: new Set(),
      attempts: {},
      flagged: new Set(),
      eliminatedOptions: {},
      completed: false
    };
    this.state.currentView = 'test';
    window.history.pushState({}, '', '/test');
    this.notify();
  }

  public updateTime(secondsLeft: number) {
    if (this.state.session) {
      this.state.session.timeRemaining = secondsLeft;
      // Do not notify() here to prevent full app re-renders every second.
      // The UI should listen to a custom timer event or manage it locally.
      window.dispatchEvent(new CustomEvent('time-updated', { detail: secondsLeft }));
    }
  }

  public checkStreak() {
    const today = new Date().toISOString().split('T')[0];
    const stats = this.state.stats;
    if (!stats.lastActiveDate) {
      stats.streak = 0;
    }
    
    // Check if we should increment or reset streak
    if (stats.lastActiveDate && stats.lastActiveDate !== today) {
      const lastDate = new Date(stats.lastActiveDate);
      const currentDate = new Date(today);
      const diffTime = Math.abs(currentDate.getTime() - lastDate.getTime());
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) {
        // Active on consecutive day
        stats.streak = (stats.streak || 0) + 1;
      } else if (diffDays > 1) {
        // Broke streak
        stats.streak = 1;
      }
    } else if (!stats.lastActiveDate) {
      // First activity ever
      stats.streak = 1;
    }
    stats.lastActiveDate = today;
  }

  public toggleSaveQuestion(questionId: string) {
    if (!this.state.stats.savedQuestions) {
      this.state.stats.savedQuestions = [];
    }
    const idx = this.state.stats.savedQuestions.indexOf(questionId);
    if (idx === -1) {
      this.state.stats.savedQuestions.push(questionId);
    } else {
      this.state.stats.savedQuestions.splice(idx, 1);
    }
    this.notify();
  }
}

export const store = new Store();

// Listen to popstate for back button
window.addEventListener('popstate', () => {
  const path = window.location.pathname.replace('/', '');
  const validViews = ['dashboard', 'test', 'review', 'vocab', 'saved', 'analytics'];
  if (validViews.includes(path)) {
    store.setView(path as any);
  } else if (path === '') {
    store.setView('dashboard');
  }
});
