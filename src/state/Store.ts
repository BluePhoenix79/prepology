import type { AppState, Question, TestSession } from '../types';
import { calculatePredictedScore, updateTopicMastery } from '../utils/scoring';

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
    streak: 0
  },
  questionBank: []
};

function loadState(): AppState {
  const saved = localStorage.getItem('preplogy_state');
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
      }
      return { ...defaultState, ...parsed, stats: { ...defaultState.stats, ...parsed.stats } };
    } catch (e) {
      console.error('Failed to load state', e);
      localStorage.removeItem('preplogy_state');
    }
  }
  return defaultState;
}

function saveState(state: AppState) {
  // Convert Sets to Arrays for JSON serialization
  const stateToSave = JSON.parse(JSON.stringify(state, (_key, value) => {
    if (value instanceof Set) {
      return Array.from(value);
    }
    return value;
  }));
  localStorage.setItem('preplogy_state', JSON.stringify(stateToSave));
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
    this.state.questionBank = questions;
    this.notify();
  }

  public startSession(section: TestSession['currentSection'], difficulty?: number, domain?: string, skill?: string) {
    let filtered = this.state.questionBank.filter(q => q.section === section);
    if (difficulty && difficulty !== 0) {
      filtered = filtered.filter(q => q.difficulty === difficulty);
    }
    if (domain && domain !== 'All') {
      filtered = filtered.filter(q => q.domain === domain);
    }
    if (skill && skill !== 'All') {
      filtered = filtered.filter(q => q.skill === skill);
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
  
  public checkAnswer(questionId: string) {
    if (this.state.session) {
      this.state.session.checked.add(questionId);
      if (!this.state.session.attempts[questionId]) {
        this.state.session.attempts[questionId] = 0;
      }
      this.state.session.attempts[questionId]++;
      this.notify();
    }
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
          this.state.stats.questionsAttempted++;
          const isCorrect = q.correctAnswer === optionId;
          const attemptCount = this.state.session.attempts[qId] || 0;
          
          this.state.stats.solved[qId] = {
            attempts: attemptCount,
            correct: isCorrect && attemptCount <= 1
          };

          if (isCorrect && attemptCount <= 1) {
            correctInSession++;
          } else if (!isCorrect || attemptCount > 1) {
            if (!this.state.stats.mistakes.includes(q.id)) {
              this.state.stats.mistakes.push(q.id);
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
