import type { AppState, Question } from '../types';

/**
 * Generates a targeted practice set by analyzing a user's mistakes.
 * It finds unattempted questions that share similar domains/tags with missed questions.
 */
export function generateTargetedPractice(state: AppState, numQuestions = 10): Question[] {
  const { stats, questionBank } = state;
  if (stats.mistakes.length === 0) {
    // If no mistakes, just return random unattempted questions or random questions
    return questionBank.slice(0, numQuestions);
  }

  // Count tag frequencies from mistakes
  const mistakeTags = new Map<string, number>();
  const mistakeDomains = new Map<string, number>();
  
  stats.mistakes.forEach(mistakeId => {
    const q = questionBank.find(x => x.id === mistakeId);
    if (q) {
      mistakeDomains.set(q.domain, (mistakeDomains.get(q.domain) || 0) + 1);
      q.tags.forEach(tag => {
        mistakeTags.set(tag, (mistakeTags.get(tag) || 0) + 1);
      });
    }
  });

  // Calculate similarity score for all unattempted questions (not in mistakes and not already correct)
  // For simplicity, any question not in mistakes is eligible.
  const eligibleQuestions = questionBank.filter(q => !stats.mistakes.includes(q.id));
  
  const scoredQuestions = eligibleQuestions.map(q => {
    let score = 0;
    if (mistakeDomains.has(q.domain)) {
      score += mistakeDomains.get(q.domain)! * 2;
    }
    q.tags.forEach(tag => {
      if (mistakeTags.has(tag)) {
        score += mistakeTags.get(tag)!;
      }
    });
    return { q, score };
  });

  // Sort by highest score first
  scoredQuestions.sort((a, b) => b.score - a.score);

  return scoredQuestions.slice(0, numQuestions).map(x => x.q);
}
