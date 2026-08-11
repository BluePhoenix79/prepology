import { store } from '../state/Store';
import {
  MODULE_SPEC,
  SECTION_ORDER,
  UPPER_ROUTE_THRESHOLD,
  buildExam,
  buildModule,
  formatDuration,
  loadExam,
  pickTier,
  plannedTotalQuestions,
  plannedTotalSeconds,
  saveExam,
  scoreExam,
  totalScore,
  usedIds,
} from '../utils/practiceTest';
import type { ExamPlan } from '../utils/practiceTest';

/**
 * Full-length practice test runner.
 *
 * Owns the adaptive routing: when a module-1 result comes back from the
 * session, this decides which module 2 to assemble and appends it to the plan.
 */
export function renderExam(): HTMLElement {
  const root = document.createElement('div');
  root.className = 'page-root';

  let plan = loadExam();

  // Fold in the module that was just submitted, if any.
  const result = store.consumeExamResult();
  if (plan && result) {
    if (!plan.results.some(r => r.moduleId === result.moduleId)) {
      plan.results.push(result);
    }
    const finished = plan.modules.find(m => m.id === result.moduleId);

    // A routing module determines which module 2 that section gets.
    if (finished && finished.moduleNumber === 1) {
      const tier = pickTier(result.correct, result.total);
      const next = buildModule(
        store.getState().questionBank,
        finished.section,
        2,
        tier,
        usedIds(plan),
      );
      const insertAt = plan.modules.findIndex(m => m.id === finished.id) + 1;
      plan.modules.splice(insertAt, 0, next);
    }

    plan.currentModule = Math.min(plan.currentModule + 1, plan.modules.length);
    plan.completed = plan.results.length >= plan.modules.length && plan.modules.length >= 4;
    saveExam(plan);
  }

  function startExam() {
    const bank = store.getState().questionBank;
    if (bank.length === 0) return;
    plan = buildExam(bank);
    saveExam(plan);
    launchCurrent();
  }

  function launchCurrent() {
    if (!plan) return;
    const mod = plan.modules[plan.currentModule];
    if (!mod) return;
    store.startExamModule(mod.id, mod.section, mod.questionIds);
  }

  function discard() {
    saveExam(null);
    plan = null;
    draw();
  }

  function introHTML(): string {
    const rw = MODULE_SPEC['Reading and Writing'];
    const math = MODULE_SPEC.Math;
    return `
      <div class="exam-intro">
        <div class="exam-hero">
          <h2>Full-length practice test</h2>
          <p>
            An adaptive exam built to the digital SAT's shape — ${plannedTotalQuestions()} questions
            across four modules, ${formatDuration(plannedTotalSeconds())} of testing time.
            How you do on each section's first module decides how hard its second one is.
          </p>
          <button class="btn exam-start-btn" id="start-exam">Start practice test</button>
        </div>

        <div class="exam-blueprint">
          ${[
            { section: 'Reading and Writing' as const, spec: rw, label: 'Reading &amp; Writing' },
            { section: 'Math' as const, spec: math, label: 'Math' },
          ].map(({ spec, label }) => `
            <div class="exam-bp-card">
              <h3>${label}</h3>
              <p class="exam-bp-meta">2 modules · ${spec.questionsPerModule} questions each · ${spec.timeLimitSec / 60} min per module</p>
              <ul class="exam-bp-domains">
                ${Object.entries(spec.domains).map(([domain, n]) => `
                  <li><span>${domain}</span><span class="exam-bp-count">${n}</span></li>
                `).join('')}
              </ul>
            </div>
          `).join('')}
        </div>

        <p class="exam-note">
          Scores are an approximation. Routing into the harder second module puts a section
          in the 400–800 band; the standard module caps it around 600 — the same way the real
          exam's adaptive stage bounds your result.
        </p>
      </div>`;
  }

  function progressHTML(p: ExamPlan): string {
    const done = new Set(p.results.map(r => r.moduleId));
    const rows = p.modules.map((m, i) => {
      const res = p.results.find(r => r.moduleId === m.id);
      const state = done.has(m.id) ? 'done' : i === p.currentModule ? 'current' : 'upcoming';
      return `
        <li class="exam-mod ${state}">
          <span class="exam-mod-dot"></span>
          <span class="exam-mod-label">${m.label}</span>
          <span class="exam-mod-meta">
            ${res ? `${res.correct}/${res.total} correct` : `${m.questionIds.length} questions · ${m.timeLimitSec / 60} min`}
          </span>
        </li>`;
    }).join('');

    const next = p.modules[p.currentModule];
    return `
      <div class="exam-progress">
        <div class="page-topbar">
          <div>
            <h1>Practice test in progress</h1>
            <p>${p.results.length} of ${Math.max(4, p.modules.length)} modules submitted</p>
          </div>
          <button class="btn btn-ghost" id="discard-exam">Discard test</button>
        </div>
        <ul class="exam-mod-list">${rows}</ul>
        ${next ? `
          <div class="exam-next">
            <div>
              <h3>Up next — ${next.label}</h3>
              <p>${next.questionIds.length} questions · ${next.timeLimitSec / 60} minutes</p>
            </div>
            <button class="btn" id="continue-exam">Continue</button>
          </div>` : ''}
      </div>`;
  }

  function reportHTML(p: ExamPlan): string {
    const scores = scoreExam(p);
    const total = totalScore(scores);
    return `
      <div class="exam-report">
        <div class="page-topbar">
          <div>
            <h1>Score report</h1>
            <p>Full-length practice test · ${new Date(p.createdAt).toLocaleDateString()}</p>
          </div>
          <button class="btn" id="start-exam">Take another</button>
        </div>

        <div class="exam-total">
          <span class="exam-total-num">${total}</span>
          <span class="exam-total-label">Total score · 400–1600</span>
        </div>

        <div class="exam-section-scores">
          ${scores.map(s => `
            <div class="exam-score-card">
              <h3>${s.section === 'Math' ? 'Math' : 'Reading &amp; Writing'}</h3>
              <div class="exam-score-num">${s.scaled}</div>
              <p>${s.correct} of ${s.total} correct</p>
              <span class="exam-tier-pill ${s.tier === 'upper' ? 'is-upper' : ''}">
                ${s.tier === 'upper' ? 'Routed to the harder module' : 'Standard second module'}
              </span>
            </div>`).join('')}
        </div>

        <ul class="exam-mod-list">
          ${p.modules.map(m => {
            const r = p.results.find(x => x.moduleId === m.id);
            return `
              <li class="exam-mod done">
                <span class="exam-mod-dot"></span>
                <span class="exam-mod-label">${m.label}</span>
                <span class="exam-mod-meta">${r ? `${r.correct}/${r.total}` : 'not taken'}</span>
              </li>`;
          }).join('')}
        </ul>

        <p class="exam-note">
          Routing threshold: ${Math.round(UPPER_ROUTE_THRESHOLD * 100)}% on a section's first module.
          Scaled scores approximate the real exam's banding rather than reproducing
          College Board's equating tables, which aren't published.
        </p>
        <button class="btn btn-ghost" id="discard-exam">Clear this result</button>
      </div>`;
  }

  function draw() {
    const bankReady = store.getState().questionBank.length > 0;
    if (!plan) {
      root.innerHTML = introHTML();
    } else if (plan.completed || (plan.results.length >= plan.modules.length && plan.modules.length >= 4)) {
      root.innerHTML = reportHTML(plan);
    } else {
      root.innerHTML = progressHTML(plan);
    }

    const startBtn = root.querySelector<HTMLButtonElement>('#start-exam');
    if (startBtn) {
      startBtn.disabled = !bankReady;
      if (!bankReady) startBtn.textContent = 'Loading questions…';
      startBtn.addEventListener('click', startExam);
    }
    root.querySelector('#continue-exam')?.addEventListener('click', launchCurrent);
    root.querySelector('#discard-exam')?.addEventListener('click', discard);
  }

  draw();
  return root;
}

export { SECTION_ORDER };
