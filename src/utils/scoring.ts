import type { AppState, TestSession, Question } from '../types';

/**
 * Implements an adaptive scoring algorithm based on Item Response Theory (IRT) concepts.
 * Returns a predicted score from 400 to 800 per section.
 */
export function calculatePredictedScore(session: TestSession, questionBank: Question[]): number {
  let score = 400; // Base score
  let totalWeight = 0;
  let earnedWeight = 0;
  
  // Create a map of questions in the session for quick lookup
  const sessionQuestions = questionBank.filter(q => q.section === session.currentSection);
  
  if (sessionQuestions.length === 0) return 400;
  
  sessionQuestions.forEach(q => {
    // Weight difficulty: 1 = 1x, 2 = 1.5x, 3 = 2x
    const weight = q.difficulty === 3 ? 2 : (q.difficulty === 2 ? 1.5 : 1);
    totalWeight += weight;
    
    if (session.answers[q.id] === q.correctAnswer) {
      earnedWeight += weight;
    }
  });
  
  // Calculate percentage of weighted score earned
  const performanceRatio = earnedWeight / totalWeight;
  
  // Map ratio to 400-800 scale
  score = Math.round(400 + (performanceRatio * 400));
  
  // Snap to nearest 10
  score = Math.round(score / 10) * 10;
  
  return score;
}

/**
 * Calculates topic mastery based on correct answers in a domain
 */
export function updateTopicMastery(state: AppState): Record<string, number> {
  const { session, stats, questionBank } = state;
  if (!session) return stats.topicMastery;
  
  const updatedMastery = { ...stats.topicMastery };
  const topicCounts: Record<string, { total: number, correct: number }> = {};
  
  questionBank.forEach(q => {
    if (session.answers[q.id]) {
      if (!topicCounts[q.domain]) topicCounts[q.domain] = { total: 0, correct: 0 };
      topicCounts[q.domain].total++;
      
      if (session.answers[q.id] === q.correctAnswer) {
        topicCounts[q.domain].correct++;
      }
    }
  });
  
  for (const [domain, counts] of Object.entries(topicCounts)) {
    updatedMastery[domain] = Math.round((counts.correct / counts.total) * 100);
  }
  
  return updatedMastery;
}
