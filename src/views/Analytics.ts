import { store } from '../state/Store';

export function renderAnalytics(): HTMLElement {
  const root = document.createElement('div');
  root.className = 'page-root';

  const state = store.getState();
  const { stats, questionBank } = state;
  const attempted = stats.questionsAttempted || 0;
  const correct = stats.correctAnswers || 0;
  const accuracy = attempted > 0 ? Math.round((correct / attempted) * 100) : 0;
  const streak = stats.streak || 0;
  const solvedMap = stats.solved || {};

  // Group solved questions by skill to find weak areas
  const skillStats: Record<string, { total: number; correct: number; domain: string; section: string }> = {};

  Object.entries(solvedMap).forEach(([qId, s]) => {
    const q = questionBank.find(x => x.id === qId);
    if (q) {
      if (!skillStats[q.skill]) {
        skillStats[q.skill] = { total: 0, correct: 0, domain: q.domain, section: q.section };
      }
      skillStats[q.skill].total++;
      if (s.correct) {
        skillStats[q.skill].correct++;
      }
    }
  });

  // Find weakest skills (minimum 3 attempts, sorted by accuracy ascending)
  const weakSkills = Object.entries(skillStats)
    .map(([skill, s]) => {
      const acc = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
      return { skill, ...s, accuracy: acc };
    })
    .filter(s => s.total >= 3)
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 3);

  // Group mastery by Domain
  const domainMastery: Record<string, { total: number; correct: number; pct: number }> = {};
  questionBank.forEach(q => {
    if (!domainMastery[q.domain]) {
      domainMastery[q.domain] = { total: 0, correct: 0, pct: 0 };
    }
    domainMastery[q.domain].total++;
    if (solvedMap[q.id] && solvedMap[q.id].correct) {
      domainMastery[q.domain].correct++;
    }
  });
  Object.keys(domainMastery).forEach(dom => {
    const d = domainMastery[dom];
    const solvedQuestions = questionBank.filter(q => q.domain === dom && solvedMap[q.id]);
    const correctSolves = solvedQuestions.filter(q => solvedMap[q.id].correct).length;
    d.pct = solvedQuestions.length > 0 ? Math.round((correctSolves / solvedQuestions.length) * 100) : 0;
  });

  root.innerHTML = `
    <div class="page-topbar">
      <div>
        <h1>Performance & Analytics</h1>
        <p>Analyze your progress, track your streak, and focus on weak areas</p>
      </div>
    </div>

    <div style="display:grid;grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));gap:1.5rem;margin-bottom:2.5rem;">
      <!-- Streak card -->
      <div class="glass" style="padding:1.5rem;border-radius:12px;position:relative;background:#fff;border:1px solid #e2e8f0;display:flex;align-items:center;gap:1.25rem;">
        <svg viewBox="0 0 24 24" width="28" height="28" stroke="#ef4444" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg>
        <div>
          <div style="font-size:0.75rem;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;font-weight:700;">Practice Streak</div>
          <div style="font-size:1.85rem;font-weight:800;color:#0f172a;line-height:1.2;">${streak} Day${streak !== 1 ? 's' : ''}</div>
          <div style="font-size:0.8rem;color:#64748b;margin-top:0.15rem;">Keep it up daily!</div>
        </div>
      </div>

      <!-- Attempted card -->
      <div class="glass" style="padding:1.5rem;border-radius:12px;position:relative;background:#fff;border:1px solid #e2e8f0;display:flex;align-items:center;gap:1.25rem;">
        <svg viewBox="0 0 24 24" width="28" height="28" stroke="#3b82f6" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
        <div>
          <div style="font-size:0.75rem;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;font-weight:700;">Total Practiced</div>
          <div style="font-size:1.85rem;font-weight:800;color:#0f172a;line-height:1.2;">${attempted}</div>
          <div style="font-size:0.8rem;color:#64748b;margin-top:0.15rem;">${correct} correct answers</div>
        </div>
      </div>

      <!-- Accuracy card -->
      <div class="glass" style="padding:1.5rem;border-radius:12px;position:relative;background:#fff;border:1px solid #e2e8f0;display:flex;align-items:center;gap:1.25rem;">
        <svg viewBox="0 0 24 24" width="28" height="28" stroke="#10b981" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>
        <div>
          <div style="font-size:0.75rem;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;font-weight:700;">Overall Accuracy</div>
          <div style="font-size:1.85rem;font-weight:800;color:#0f172a;line-height:1.2;">${accuracy}%</div>
          <div style="font-size:0.8rem;color:#64748b;margin-top:0.15rem;">Based on all solves</div>
        </div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns: 1.2fr 1fr;gap:2rem;align-items:start;">
      <!-- Weakest skills -->
      <div>
        <h2 style="font-size:1.25rem;font-weight:700;color:#0f172a;margin-bottom:1rem;">Targeted Recommendations</h2>
        <div class="glass" style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:1.5rem;box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
          <p style="font-size:0.875rem;color:#64748b;margin-bottom:1.25rem;">We analyzed your practice history. Focus on these skills to maximize your score:</p>
          
          <div style="display:flex;flex-direction:column;gap:1.25rem;" id="weak-skills-list">
            ${weakSkills.length === 0 
              ? `<div style="text-align:center;color:#64748b;font-size:0.875rem;padding:2rem 0;">Solved data is limited. Practice more questions to see target recommendations here.</div>`
              : weakSkills.map(s => `
                  <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:1rem;border-bottom:1px solid #f1f5f9;">
                    <div style="flex:1;margin-right:1rem;">
                      <div style="font-size:0.95rem;font-weight:700;color:#1e293b;margin-bottom:0.15rem;">${s.skill}</div>
                      <div style="font-size:0.75rem;color:#64748b;">Accuracy: <strong style="color:${s.accuracy >= 70 ? '#10b981' : s.accuracy >= 50 ? '#f59e0b' : '#ef4444'}">${s.accuracy}%</strong> (${s.correct}/${s.total} correct)</div>
                    </div>
                    <button class="btn btn-sm op-btn-primary practice-weak-btn" data-section="${s.section}" data-domain="${s.domain}" data-skill="${s.skill}">Practice →</button>
                  </div>
                `).join('')
            }
          </div>
        </div>
      </div>

      <!-- Domain Mastery list -->
      <div>
        <h2 style="font-size:1.25rem;font-weight:700;color:#0f172a;margin-bottom:1rem;">Domain Mastery</h2>
        <div class="glass" style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:1.5rem;box-shadow: 0 1px 3px rgba(0,0,0,0.02);display:flex;flex-direction:column;gap:1.25rem;">
          ${Object.entries(domainMastery).map(([domain, d]) => `
            <div>
              <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:0.4rem;">
                <span style="font-size:0.875rem;font-weight:600;color:#334155;">${domain}</span>
                <span style="font-size:0.875rem;font-weight:700;color:#0f172a;">${d.pct}%</span>
              </div>
              <div style="height:6px;background:#e2e8f0;border-radius:3px;overflow:hidden;">
                <div style="height:100%;background:#1a56db;width:${d.pct}%;border-radius:3px;transition:width 0.5s ease;"></div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  // Attach event listeners for targeted weakness practice
  root.querySelectorAll('.practice-weak-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = e.currentTarget as HTMLElement;
      const sec = target.dataset.section as any;
      const dom = target.dataset.domain;
      const skill = target.dataset.skill;
      store.startSession(sec, 0, dom, skill);
    });
  });

  return root;
}
