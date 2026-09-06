export type Section = 'Math' | 'Reading and Writing';
export type Difficulty = 1 | 2 | 3;

export interface Option {
  id: string; // e.g., "A", "B", "C", "D"
  text: string;
}

export interface Question {
  id: string;
  section: Section;
  domain: string; // e.g., "Information and Ideas", "Algebra"
  skill: string; // e.g., "Central Ideas and Details", "Linear equations in one variable"
  difficulty: Difficulty;
  passageText?: string;
  questionText: string;
  options: Option[];
  correctAnswer: string; // The id of the correct option
  rationale: string;
  tags: string[];
  official?: boolean;
  isNew?: boolean;
}

export interface Annotation {
  id: string;
  text: string;
  style: string;
  note?: string;
}

export interface TestSession {
  id: string;
  startTime: number;
  timeRemaining: number; // in seconds (unused now)
  currentSection: Section;
  filteredQuestionIds: string[]; // List of questions selected for this practice
  answers: Record<string, string>; // questionId -> optionId
  checked: Set<string>; // questionIds that have been checked
  attempts: Record<string, number>; // questionId -> number of times checked
  flagged: Set<string>; // questionIds that are marked for review
  eliminatedOptions: Record<string, Set<string>>; // questionId -> set of optionIds
  questionTimes?: Record<string, number>; // questionId -> accumulated seconds
  completed: boolean;
  annotations?: Record<string, Annotation[]>; // questionId -> list of annotations
  drawings?: Record<string, string>; // questionId -> canvas data URL
  isStructuredSession?: boolean;
  sessionConfig?: {
    section?: Section | 'Both';
    difficulty?: number;
    domain?: string | string[];
    skill?: string;
    questionCount?: number;
  };
}

export interface ReportedIssue {
  questionId: string;
  timestamp: number;
  description: string;
}

export interface UserStats {
  predictedMathScore: number;
  predictedRWScore: number;
  questionsAttempted: number;
  correctAnswers: number;
  mistakes: string[]; // Array of questionIds
  topicMastery: Record<string, number>; // Domain -> percentage mastery
  solved?: Record<string, { attempts: number; correct: boolean }>; // questionId -> solve status
  savedQuestions?: string[]; // Array of bookmarked questionIds
  streak?: number; // Daily practice streak
  lastActiveDate?: string; // YYYY-MM-DD
  reportedIssues?: ReportedIssue[]; // User reported issues for questions
  solveHistory?: Array<{
    id: string;
    timestamp: number;
    correct: boolean;
    timeSpent: number; // in seconds
    difficulty: Difficulty;
    section: Section;
    domain: string;
    skill: string;
  }>;
  targetScore?: number; // e.g. 1500
  satTestDate?: string; // YYYY-MM-DD
}

export interface AppState {
  currentView: 'dashboard' | 'test' | 'review' | 'vocab' | 'saved' | 'analytics';
  session: TestSession | null;
  stats: UserStats;
  questionBank: Question[];
  difficultyOverrides?: Record<string, Difficulty>;
  theme?: 'dark' | 'light';
  hideQuestionDetails?: boolean;
}


