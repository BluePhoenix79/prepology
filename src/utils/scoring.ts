import type { AppState, TestSession, Question } from '../types';
import { areAnswersEquivalent } from '../state/Store';

/**
 * Implements an adaptive scoring algorithm based on Item Response Theory (IRT) concepts.
 * Returns a predicted score from 200 to 800 per section.
 */
export function calculatePredictedScore(session: TestSession, questionBank: Question[]): number {
  let totalWeight = 0;
  let earnedWeight = 0;
  
  // Only score the questions in this practice session
  const qSet = new Set(session.filteredQuestionIds);
  const sessionQuestions = questionBank.filter(q => qSet.has(q.id) && q.section === session.currentSection);
  
  if (sessionQuestions.length === 0) return 400;
  
  sessionQuestions.forEach(q => {
    // Weight difficulty: 1 = 1x, 2 = 1.5x, 3 = 2x
    const weight = q.difficulty === 3 ? 2 : (q.difficulty === 2 ? 1.5 : 1);
    totalWeight += weight;
    
    const userAns = session.answers[q.id];
    if (userAns && areAnswersEquivalent(q.correctAnswer, userAns)) {
      earnedWeight += weight;
    }
  });
  
  if (totalWeight === 0) return 400;

  // Calculate percentage of weighted score earned
  const performanceRatio = earnedWeight / totalWeight;
  
  // Map ratio to 200-800 scale (official digital SAT section score range)
  let score = Math.round(200 + (performanceRatio * 600));
  
  // Snap to nearest 10
  score = Math.round(score / 10) * 10;
  
  return Math.min(800, Math.max(200, score));
}

/**
 * Calculates topic mastery based on correct answers in a domain
 */
export function updateTopicMastery(state: AppState): Record<string, number> {
  const { session, stats, questionBank } = state;
  if (!session) return stats.topicMastery;
  
  const updatedMastery = { ...stats.topicMastery };
  const topicCounts: Record<string, { total: number; correct: number }> = {};
  
  const qSet = new Set(session.filteredQuestionIds);
  questionBank.forEach(q => {
    if (qSet.has(q.id) && session.answers[q.id]) {
      if (!topicCounts[q.domain]) topicCounts[q.domain] = { total: 0, correct: 0 };
      topicCounts[q.domain].total++;
      
      const userAns = session.answers[q.id];
      if (areAnswersEquivalent(q.correctAnswer, userAns)) {
        topicCounts[q.domain].correct++;
      }
    }
  });
  
  for (const [domain, counts] of Object.entries(topicCounts)) {
    updatedMastery[domain] = Math.round((counts.correct / counts.total) * 100);
  }
  
  return updatedMastery;
}
