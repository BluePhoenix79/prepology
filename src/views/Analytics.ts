import { store } from '../state/Store';

export function renderAnalytics(): HTMLElement {
  const root = document.createElement('div');
  root.className = 'page-root';

  const state = store.getState();
  const { stats } = state;
  const history = stats.solveHistory || [];

  // 1. Metric Cards calculation
  const attempted = history.length;
  const correct = history.filter(h => h.correct).length;
  const wrong = attempted - correct;
  const accuracy = attempted > 0 ? Math.round((correct / attempted) * 100) : 0;
  const streak = stats.streak || 0;
  const savedCount = stats.savedQuestions?.length || 0;

  // Formatting time helper (e.g. 5h 12m or 32m)
  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  // 2. Activity Trend: group by day (Last 30 days)
  const endMs = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;
  const startMs = endMs - (30 * oneDayMs);
  const dayCount = 30;

  // Initialize daily bins
  const dailyData = Array.from({ length: dayCount }, (_, i) => {
    const dayStart = new Date(startMs + i * oneDayMs);
    const label = dayStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return {
      label,
      correct: { 1: 0, 2: 0, 3: 0 },
      wrong: { 1: 0, 2: 0, 3: 0 },
      total: 0
    };
  });

  history.forEach(h => {
    if (h.timestamp >= startMs && h.timestamp <= endMs) {
      const dayIdx = Math.floor((h.timestamp - startMs) / oneDayMs);
      if (dayIdx >= 0 && dayIdx < dayCount) {
        const bin = dailyData[dayIdx];
        const diff = h.difficulty as 1 | 2 | 3;
        if (h.correct) {
          bin.correct[diff]++;
        } else {
          bin.wrong[diff]++;
        }
        bin.total++;
      }
    }
  });

  // Calculate max daily total to scale heights
  const maxDailyTotal = Math.max(...dailyData.map(w => w.total), 1);
  const chartHeightPx = 180;

  // 3. Donut chart A: Section Time (Reading & Writing vs Math)
  const rwTimeSecs = history.filter(h => h.section === 'Reading and Writing').reduce((sum, h) => sum + h.timeSpent, 0);
  const mathTimeSecs = history.filter(h => h.section === 'Math').reduce((sum, h) => sum + h.timeSpent, 0);
  const totalSectionTime = rwTimeSecs + mathTimeSecs;
  const rwPct = totalSectionTime > 0 ? Math.round((rwTimeSecs / totalSectionTime) * 100) : 0;

  const donutBgA = totalSectionTime === 0
    ? 'var(--c-elevated)'
    : `conic-gradient(var(--c-purple) 0% ${rwPct}%, var(--c-blue) ${rwPct}% 100%)`;

  // Donut chart B: Attempts by Difficulty
  let easyAttempts = 0;
  let mediumAttempts = 0;
  let hardAttempts = 0;
  history.forEach(h => {
    if (h.difficulty === 1) easyAttempts++;
    else if (h.difficulty === 2) mediumAttempts++;
    else if (h.difficulty === 3) hardAttempts++;
  });
  const totalAttempts = easyAttempts + mediumAttempts + hardAttempts;
  const easyPct = totalAttempts > 0 ? Math.round((easyAttempts / totalAttempts) * 100) : 0;
  const mediumPct = totalAttempts > 0 ? Math.round((mediumAttempts / totalAttempts) * 100) : 0;
  const hardPct = totalAttempts > 0 ? Math.max(0, 100 - easyPct - mediumPct) : 0;

  const difficultyChartBg = totalAttempts === 0
    ? 'var(--c-elevated)'
    : `conic-gradient(var(--c-green) 0% ${easyPct}%, var(--c-amber) ${easyPct}% ${easyPct + mediumPct}%, var(--c-red) ${easyPct + mediumPct}% 100%)`;

  // 4. Top 5 Topics costing the most points
  const skillCounts: Record<string, { total: number; correct: number; section: string; domain: string }> = {};
  history.forEach(h => {
    if (!skillCounts[h.skill]) {
      skillCounts[h.skill] = { total: 0, correct: 0, section: h.section, domain: h.domain };
    }
    skillCounts[h.skill].total++;
    if (h.correct) {
      skillCounts[h.skill].correct++;
    }
  });

  const topCostingTopics = Object.entries(skillCounts)
    .map(([skill, s]) => {
      const incorrectCount = s.total - s.correct;
      const acc = Math.round((s.correct / s.total) * 100);
      return { skill, ...s, incorrectCount, accuracy: acc };
    })
    .filter(item => item.incorrectCount > 0) // Only show if they actually missed questions
    .sort((a, b) => b.incorrectCount - a.incorrectCount)
    .slice(0, 5);

  // 5. English and Math Domain Accuracy Sliders
  const rwDomains = ['Information and Ideas', 'Craft and Structure', 'Expression of Ideas', 'Standard English Conventions'];
  const mathDomains = ['Algebra', 'Advanced Math', 'Problem-Solving and Data Analysis', 'Geometry and Trigonometry'];

  const getDomainStats = (domain: string) => {
    const domHistory = history.filter(h => h.domain === domain);
    const total = domHistory.length;
    const correct = domHistory.filter(h => h.correct).length;
    const acc = total > 0 ? Math.round((correct / total) * 100) : 0;
    return { total, correct, accuracy: acc };
  };

  const getAccuracyColor = (acc: number, total: number) => {
    if (total === 0) return 'var(--c-text-3)'; // Dim gray if no attempts
    if (acc >= 85) return 'var(--c-green)'; // Theme green
    if (acc >= 60) return 'var(--c-amber)'; // Theme amber
    return 'var(--c-red)'; // Theme red
  };

  // 6. Time share by difficulty
  const getTimeShare = (section: string, diff: number) => {
    const diffHistory = history.filter(h => h.section === section && h.difficulty === diff);
    const total = diffHistory.length;
    if (total === 0) return 0;
    const totalSecs = diffHistory.reduce((sum, h) => sum + h.timeSpent, 0);
    return Math.round(totalSecs / total);
  };

  const formatSeconds = (secs: number) => {
    if (secs === 0) return '0s';
    if (secs < 60) return `${secs}s`;
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s}s`;
  };

  // English averages
  const enEasyTime = getTimeShare('Reading and Writing', 1);
  const enMedTime = getTimeShare('Reading and Writing', 2);
  const enHardTime = getTimeShare('Reading and Writing', 3);
  const totalEnTime = enEasyTime + enMedTime + enHardTime;
  const enEasyPct = totalEnTime > 0 ? Math.round((enEasyTime / totalEnTime) * 100) : 0;
  const enMedPct = totalEnTime > 0 ? Math.round((enMedTime / totalEnTime) * 100) : 0;

  const enTimeShareBg = totalEnTime === 0
    ? 'var(--c-elevated)'
    : `conic-gradient(#a5b4fc 0% ${enEasyPct}%, var(--c-blue) ${enEasyPct}% ${enEasyPct + enMedPct}%, #312e81 ${enEasyPct + enMedPct}% 100%)`;

  // Math averages
  const mathEasyTime = getTimeShare('Math', 1);
  const mathMedTime = getTimeShare('Math', 2);
  const mathHardTime = getTimeShare('Math', 3);
  const totalMathTime = mathEasyTime + mathMedTime + mathHardTime;
  const mathEasyPct = totalMathTime > 0 ? Math.round((mathEasyTime / totalMathTime) * 100) : 0;
  const mathMedPct = totalMathTime > 0 ? Math.round((mathMedTime / totalMathTime) * 100) : 0;

  const mathTimeShareBg = totalMathTime === 0
    ? 'var(--c-elevated)'
    : `conic-gradient(#fca5a5 0% ${mathEasyPct}%, var(--c-red) ${mathEasyPct}% ${mathEasyPct + mathMedPct}%, #7f1d1d ${mathEasyPct + mathMedPct}% 100%)`;

  // 7. GitHub Style Contribution Heatmap Calendar
  const calendarWeeks: Array<Array<{ dateStr: string; count: number; active: boolean }>> = [];
  const dayMs = 24 * 60 * 60 * 1000;
  const calStartMs = new Date('2026-02-01T00:00:00').getTime();

  // Create lookup map for solve counts per YYYY-MM-DD
  const solveCountMap: Record<string, number> = {};
  history.forEach(h => {
    const dStr = new Date(h.timestamp).toISOString().split('T')[0];
    solveCountMap[dStr] = (solveCountMap[dStr] || 0) + 1;
  });

  const calWeekCount = Math.ceil((endMs - calStartMs) / (7 * dayMs));
  for (let w = 0; w < calWeekCount; w++) {
    const weekDays = [];
    for (let d = 0; d < 7; d++) {
      const curMs = calStartMs + (w * 7 + d) * dayMs;
      const curDate = new Date(curMs);
      const dateStr = curDate.toISOString().split('T')[0];
      const count = solveCountMap[dateStr] || 0;
      const active = curMs <= endMs;
      weekDays.push({ dateStr, count, active });
    }
    calendarWeeks.push(weekDays);
  }

  // Find most active day
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayActivityCount: Record<string, number> = {};
  history.forEach(h => {
    const day = dayNames[new Date(h.timestamp).getDay()];
    dayActivityCount[day] = (dayActivityCount[day] || 0) + 1;
  });
  
  let mostActiveDay = '—';
  let maxActiveCount = 0;
  Object.entries(dayActivityCount).forEach(([d, count]) => {
    if (count > maxActiveCount) {
      maxActiveCount = count;
      mostActiveDay = d;
    }
  });

  root.innerHTML = `
    <!-- Top Bar -->
    <div class="page-topbar" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">
      <div>
        <h1 style="font-size:1.75rem; font-weight:700; color:var(--c-text); display:flex; align-items:center; gap:0.5rem;">
          <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2.5" fill="none" style="opacity:0.8; color:var(--c-blue);"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
          Analytics
        </h1>
      </div>
      <div style="display:flex; gap:0.5rem; align-items:center;">
        <select class="op-select" style="padding:0.4rem 1.5rem 0.4rem 0.75rem; font-size:0.8125rem; font-weight:500; height:32px; border-radius:6px; border:1px solid var(--c-border); background:var(--c-elevated); color:var(--c-text);">
          <option>All time</option>
          <option>Last 30 days</option>
          <option>Last 7 days</option>
        </select>
        <button class="btn" style="padding:0.4rem 0.75rem; font-size:0.8125rem; font-weight:500; height:32px; border-radius:6px; border:1px solid var(--c-border); background:var(--c-card); color:var(--c-text); display:flex; align-items:center; gap:4px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
          More options
        </button>
      </div>
    </div>

    <!-- Metric Cards Grid -->
    <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:1.25rem; margin-bottom:1.5rem;">
      <div class="glass" style="background:var(--c-card); border:1px solid var(--c-border); border-radius:12px; padding:1.25rem; display:flex; justify-content:space-between; align-items:center; position:relative;">
        <div>
          <div style="font-size:0.8125rem; color:var(--c-text-2); font-weight:600;">Questions Attempted</div>
          <div style="font-size:2rem; font-weight:800; color:var(--c-text); margin-top:0.25rem;">${attempted}</div>
        </div>
        <div style="width:36px; height:36px; border-radius:50%; background:var(--c-elevated); color:var(--c-green); display:flex; align-items:center; justify-content:center; opacity:0.85;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
      </div>

      <div class="glass" style="background:var(--c-card); border:1px solid var(--c-border); border-radius:12px; padding:1.25rem; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div style="font-size:0.8125rem; color:var(--c-text-2); font-weight:600;">Current Accuracy</div>
          <div style="font-size:2rem; font-weight:800; color:var(--c-text); margin-top:0.25rem;">${accuracy}%</div>
        </div>
        <div style="width:36px; height:36px; border-radius:50%; background:var(--c-elevated); color:var(--c-blue); display:flex; align-items:center; justify-content:center; opacity:0.85;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
        </div>
      </div>

      <div class="glass" style="background:var(--c-card); border:1px solid var(--c-border); border-radius:12px; padding:1.25rem; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div style="font-size:0.8125rem; color:var(--c-text-2); font-weight:600;">Saved Questions</div>
          <div style="font-size:2rem; font-weight:800; color:var(--c-text); margin-top:0.25rem;">${savedCount}</div>
        </div>
        <button id="view-saved-btn" style="background:var(--c-elevated); color:var(--c-text-2); border:1px solid var(--c-border); padding:0.25rem 0.6rem; border-radius:6px; font-size:0.7rem; font-weight:700; cursor:pointer;">View Saved</button>
      </div>

      <div class="glass" style="background:var(--c-card); border:1px solid var(--c-border); border-radius:12px; padding:1.25rem; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div style="font-size:0.8125rem; color:var(--c-text-2); font-weight:600;">Study Streak</div>
          <div style="font-size:2rem; font-weight:800; color:var(--c-text); margin-top:0.25rem;">${streak}</div>
        </div>
        <div style="width:36px; height:36px; border-radius:50%; background:rgba(249,115,22,0.15); color:var(--c-amber); display:flex; align-items:center; justify-content:center;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
        </div>
      </div>
    </div>

    <!-- Activity Trend stacked bar chart -->
    <div class="glass" style="background:var(--c-card); border:1px solid var(--c-border); border-radius:12px; padding:1.5rem; margin-bottom:1.5rem;">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
        <div>
          <h2 style="font-size:1.1rem; font-weight:700; color:var(--c-text);">Activity Trend</h2>
          <p style="font-size:0.75rem; color:var(--c-text-2); margin-top:0.25rem;">Daily practice breakdown showing correct vs. incorrect question attempts.</p>
        </div>

        <!-- Legend Badges -->
        <div style="display:flex; gap:1.25rem; align-items:center;">
          <div style="display:flex; align-items:center; gap:0.4rem; font-size:0.8rem; font-weight:600; color:var(--c-text);">
            <span style="width:12px; height:12px; border-radius:3px; background:var(--c-green); display:inline-block;"></span> Correct (${correct})
          </div>
          <div style="display:flex; align-items:center; gap:0.4rem; font-size:0.8rem; font-weight:600; color:var(--c-text);">
            <span style="width:12px; height:12px; border-radius:3px; background:var(--c-red); display:inline-block;"></span> Incorrect (${wrong})
          </div>
        </div>
      </div>

      <!-- Daily Columns Chart Container -->
      <div style="height:${chartHeightPx + 40}px; display:flex; align-items:flex-end; gap:8px; border-bottom:1px solid var(--c-border); padding-bottom:4px; margin-top:1.5rem; overflow-x:auto;">
        ${dailyData.map((bin, i) => {
          const correctSum = bin.correct[1] + bin.correct[2] + bin.correct[3];
          const wrongSum = bin.wrong[1] + bin.wrong[2] + bin.wrong[3];
          const total = bin.total;

          // Scaled height
          const pctHeight = (total / maxDailyTotal) * chartHeightPx;
          // Show label every 7 days (e.g. weekly) to avoid clutter, or last day
          const showLabel = i % 7 === 0 || i === dailyData.length - 1;

          // Simple 2-color breakdown (Correct vs Wrong)
          const correctPct = total > 0 ? (correctSum / total) * 100 : 0;
          const wrongPct = total > 0 ? (wrongSum / total) * 100 : 0;

          return `
            <div style="display:flex; flex-direction:column; align-items:center; flex:1; min-width:24px;">
              <div class="weekly-bar-stacked" style="height:${Math.max(4, pctHeight)}px; width:16px; border-radius:4px; overflow:hidden; display:flex; flex-direction:column-reverse; background:var(--c-elevated); cursor:pointer;" title="Date: ${bin.label} | ${total} attempts (${correctSum} correct, ${wrongSum} wrong)">
                <div style="height:${correctPct}%; background:var(--c-green); width:100%;"></div>
                <div style="height:${wrongPct}%; background:var(--c-red); width:100%;"></div>
              </div>
              <div style="font-size:0.6rem; color:var(--c-text-3); margin-top:8px; height:12px; white-space:nowrap;">
                ${showLabel ? bin.label : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>

    <!-- Donut Charts Side-by-Side -->
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:1.5rem; margin-bottom:1.5rem;">
      <!-- Section Time Donut -->
      <div class="glass" style="background:var(--c-card); border:1px solid var(--c-border); border-radius:12px; padding:1.5rem; display:flex; flex-direction:column; justify-content:space-between;">
        <div>
          <h2 style="font-size:1.1rem; font-weight:700; color:var(--c-text);">Study time by section</h2>
          <p style="font-size:0.75rem; color:var(--c-text-2); margin-top:0.25rem;">Question time only excluding rush, tests & vocab</p>
        </div>
        
        <div style="display:flex; align-items:center; gap:2.5rem; margin-top:1.5rem;">
          <!-- Conic-gradient donut -->
          <div style="width:110px; height:110px; border-radius:50%; background:${donutBgA}; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
            <div style="width:80px; height:80px; border-radius:50%; background:var(--c-card); display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center;">
              <span style="font-size:0.95rem; font-weight:800; color:var(--c-text); line-height:1.1;">${formatTime(totalSectionTime)}</span>
              <span style="font-size:0.6rem; color:var(--c-text-2); font-weight:500;">question time</span>
            </div>
          </div>
          
          <!-- Legend list -->
          <div style="flex:1; display:flex; flex-direction:column; gap:0.75rem;">
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.8125rem;">
              <div style="display:flex; align-items:center; gap:0.5rem; color:var(--c-text-2); font-weight:500;">
                <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:var(--c-purple);"></span>
                English
              </div>
              <span style="font-weight:700; color:var(--c-text);">${formatTime(rwTimeSecs)}</span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.8125rem; border-top:1px solid var(--c-border); padding-top:0.5rem;">
              <div style="display:flex; align-items:center; gap:0.5rem; color:var(--c-text-2); font-weight:500;">
                <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:var(--c-blue);"></span>
                Math
              </div>
              <span style="font-weight:700; color:var(--c-text);">${formatTime(mathTimeSecs)}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Attempts by Difficulty Donut -->
      <div class="glass" style="background:var(--c-card); border:1px solid var(--c-border); border-radius:12px; padding:1.5rem; display:flex; flex-direction:column; justify-content:space-between;">
        <div>
          <h2 style="font-size:1.1rem; font-weight:700; color:var(--c-text);">Attempts by difficulty</h2>
          <p style="font-size:0.75rem; color:var(--c-text-2); margin-top:0.25rem;">Total resolved questions grouped by easy, medium, and hard</p>
        </div>

        <div style="display:flex; align-items:center; gap:2.5rem; margin-top:1.5rem;">
          <!-- Conic-gradient donut -->
          <div style="width:110px; height:110px; border-radius:50%; background:${difficultyChartBg}; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
            <div style="width:80px; height:80px; border-radius:50%; background:var(--c-card); display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center;">
              <span style="font-size:1.15rem; font-weight:800; color:var(--c-text); line-height:1.1;">${totalAttempts}</span>
              <span style="font-size:0.6rem; color:var(--c-text-2); font-weight:500;">attempts</span>
            </div>
          </div>

          <!-- Legend list -->
          <div style="flex:1; display:flex; flex-direction:column; gap:0.5rem;">
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.8125rem;">
              <div style="display:flex; align-items:center; gap:0.5rem; color:var(--c-text-2); font-weight:500;">
                <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:var(--c-green);"></span>
                Easy
              </div>
              <span style="font-weight:700; color:var(--c-text);">${easyAttempts} (${easyPct}%)</span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.8125rem; border-top:1px solid var(--c-border); padding-top:0.35rem;">
              <div style="display:flex; align-items:center; gap:0.5rem; color:var(--c-text-2); font-weight:500;">
                <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:var(--c-amber);"></span>
                Medium
              </div>
              <span style="font-weight:700; color:var(--c-text);">${mediumAttempts} (${mediumPct}%)</span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.8125rem; border-top:1px solid var(--c-border); padding-top:0.35rem;">
              <div style="display:flex; align-items:center; gap:0.5rem; color:var(--c-text-2); font-weight:500;">
                <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:var(--c-red);"></span>
                Hard
              </div>
              <span style="font-weight:700; color:var(--c-text);">${hardAttempts} (${hardPct}%)</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Topics Costing the Most Points -->
    <div class="glass" style="background:var(--c-card); border:1px solid var(--c-border); border-radius:12px; padding:1.5rem; margin-bottom:1.5rem;">
      <h2 style="font-size:1.1rem; font-weight:700; color:var(--c-text); margin-bottom:1rem;">5 topics costing the most points</h2>
      <div style="display:flex; flex-direction:column; gap:0px;">
        ${topCostingTopics.length === 0 
          ? `<div style="text-align:center; color:var(--c-text-2); font-size:0.85rem; padding:2rem 0;">No incorrect answers recorded yet. Practice more to analyze weak topics!</div>`
          : topCostingTopics.map((item, i) => {
              const ringColor = item.accuracy >= 65 ? 'var(--c-green)' : item.accuracy >= 45 ? 'var(--c-amber)' : 'var(--c-red)';
              return `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:1rem 0; border-top:1px solid var(--c-border);">
                  <div style="display:flex; align-items:center; gap:1.25rem; flex:1; min-width:0;">
                    <div style="font-size:1.25rem; font-weight:700; color:var(--c-text-3); width:28px;">0${i + 1}</div>
                    <div style="min-width:0; flex:1;">
                      <div style="font-size:0.75rem; color:var(--c-text-2); font-weight:500;">
                        Needs work · ${item.section === 'Math' ? 'Math' : 'Reading & Writing'} · ${item.total} attempts
                      </div>
                      <div style="font-size:0.95rem; font-weight:700; color:var(--c-text); margin-top:1px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                        ${item.skill}
                      </div>
                    </div>
                  </div>

                  <div style="display:flex; align-items:center; gap:1.5rem;">
                    <div style="display:flex; align-items:center; gap:0.5rem;">
                      <div style="width:28px; height:28px; border-radius:50%; background:conic-gradient(${ringColor} 0% ${item.accuracy}%, var(--c-elevated) ${item.accuracy}% 100%); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                        <div style="width:20px; height:20px; border-radius:50%; background:var(--c-card); display:flex; align-items:center; justify-content:center; font-size:0.6rem; font-weight:700; color:var(--c-text);">
                          ${item.accuracy}%
                        </div>
                      </div>
                      <span style="font-size:0.75rem; font-weight:600; color:var(--c-text-2);">Accuracy</span>
                    </div>

                    <button class="btn btn-ghost btn-sm practice-weak-btn" data-section="${item.section}" data-domain="${item.domain}" data-skill="${item.skill}" style="border:1px solid var(--c-border); background:var(--c-elevated); font-size:0.75rem; font-weight:600; color:var(--c-blue); padding:0.25rem 0.6rem; border-radius:6px; cursor:pointer;">
                      Practice →
                    </button>
                  </div>
                </div>
              `;
            }).join('')
        }
      </div>
    </div>

    <!-- Sliders Domain Accuracy Grid side-by-side -->
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:1.5rem; margin-bottom:1.5rem;">
      <!-- English Domain Accuracy -->
      <div class="glass" style="background:var(--c-card); border:1px solid var(--c-border); border-radius:12px; padding:1.5rem;">
        <h2 style="font-size:1.1rem; font-weight:700; color:var(--c-text);">English</h2>
        <p style="font-size:0.75rem; color:var(--c-text-2); margin-top:0.15rem; margin-bottom:1.25rem;">Accuracy by topic</p>
        
        <!-- Legend bar -->
        <div style="display:flex; gap:0.75rem; justify-content:flex-end; font-size:0.65rem; color:var(--c-text-2); font-weight:600; margin-bottom:1rem;">
          <span style="display:flex; align-items:center; gap:3px;"><span style="display:block; width:6px; height:6px; border-radius:50%; background:var(--c-green);"></span> &ge; 85%</span>
          <span style="display:flex; align-items:center; gap:3px;"><span style="display:block; width:6px; height:6px; border-radius:50%; background:var(--c-amber);"></span> 60 &ndash; 84%</span>
          <span style="display:flex; align-items:center; gap:3px;"><span style="display:block; width:6px; height:6px; border-radius:50%; background:var(--c-red);"></span> &lt; 60%</span>
        </div>

        <div style="display:flex; flex-direction:column; gap:1rem;">
          ${rwDomains.map(dom => {
            const stats = getDomainStats(dom);
            const color = getAccuracyColor(stats.accuracy, stats.total);
            return `
              <div>
                <div style="display:flex; justify-content:space-between; align-items:baseline; font-size:0.8125rem; margin-bottom:0.25rem;">
                  <div style="min-width:0; flex:1; margin-right:0.5rem;">
                    <div style="font-weight:700; color:var(--c-text-2); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${dom}</div>
                    <div style="font-size:0.65rem; color:var(--c-text-3); font-weight:500;">${stats.total} attempts</div>
                  </div>
                  <span style="font-weight:800; color:${color};">${stats.total > 0 ? `${stats.accuracy}%` : '—'}</span>
                </div>
                <div style="height:6px; background:var(--c-elevated); border-radius:3px; position:relative; overflow:visible;">
                  <div style="height:100%; background:${color}; width:${stats.total > 0 ? stats.accuracy : 0}%; border-radius:3px;"></div>
                  <div style="width:10px; height:10px; border-radius:50%; background:var(--c-text); border:2px solid ${color}; position:absolute; top:-2px; left:calc(${stats.total > 0 ? stats.accuracy : 0}% - 5px); box-shadow:0 1px 3px rgba(0,0,0,0.3);"></div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Math Domain Accuracy -->
      <div class="glass" style="background:var(--c-card); border:1px solid var(--c-border); border-radius:12px; padding:1.5rem;">
        <h2 style="font-size:1.1rem; font-weight:700; color:var(--c-text);">Math</h2>
        <p style="font-size:0.75rem; color:var(--c-text-2); margin-top:0.15rem; margin-bottom:1.25rem;">Accuracy by topic</p>

        <!-- Legend bar -->
        <div style="display:flex; gap:0.75rem; justify-content:flex-end; font-size:0.65rem; color:var(--c-text-2); font-weight:600; margin-bottom:1rem;">
          <span style="display:flex; align-items:center; gap:3px;"><span style="display:block; width:6px; height:6px; border-radius:50%; background:var(--c-green);"></span> &ge; 85%</span>
          <span style="display:flex; align-items:center; gap:3px;"><span style="display:block; width:6px; height:6px; border-radius:50%; background:var(--c-amber);"></span> 60 &ndash; 84%</span>
          <span style="display:flex; align-items:center; gap:3px;"><span style="display:block; width:6px; height:6px; border-radius:50%; background:var(--c-red);"></span> &lt; 60%</span>
        </div>

        <div style="display:flex; flex-direction:column; gap:1rem;">
          ${mathDomains.map(dom => {
            const stats = getDomainStats(dom);
            const color = getAccuracyColor(stats.accuracy, stats.total);
            return `
              <div>
                <div style="display:flex; justify-content:space-between; align-items:baseline; font-size:0.8125rem; margin-bottom:0.25rem;">
                  <div style="min-width:0; flex:1; margin-right:0.5rem;">
                    <div style="font-weight:700; color:var(--c-text-2); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${dom}</div>
                    <div style="font-size:0.65rem; color:var(--c-text-3); font-weight:500;">${stats.total} attempts</div>
                  </div>
                  <span style="font-weight:800; color:${color};">${stats.total > 0 ? `${stats.accuracy}%` : '—'}</span>
                </div>
                <div style="height:6px; background:var(--c-elevated); border-radius:3px; position:relative; overflow:visible;">
                  <div style="height:100%; background:${color}; width:${stats.total > 0 ? stats.accuracy : 0}%; border-radius:3px;"></div>
                  <div style="width:10px; height:10px; border-radius:50%; background:var(--c-text); border:2px solid ${color}; position:absolute; top:-2px; left:calc(${stats.total > 0 ? stats.accuracy : 0}% - 5px); box-shadow:0 1px 3px rgba(0,0,0,0.3);"></div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>

    <!-- Time share by difficulty side-by-side -->
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:1.5rem; margin-bottom:1.5rem;">
      <!-- English Time Share -->
      <div class="glass" style="background:var(--c-card); border:1px solid var(--c-border); border-radius:12px; padding:1.5rem;">
        <h2 style="font-size:1.1rem; font-weight:700; color:var(--c-text);">English</h2>
        <p style="font-size:0.75rem; color:var(--c-text-2); margin-top:0.15rem; margin-bottom:1.5rem;">Time share by difficulty · gray averages are platform-wide.</p>
        
        <div style="display:flex; align-items:center; gap:2.5rem;">
          <!-- Dynamic Circular Ring display -->
          <div style="width:110px; height:110px; border-radius:50%; background:${enTimeShareBg}; display:flex; align-items:center; justify-content:center; flex-shrink:0; position:relative;">
            <div style="width:94px; height:94px; border-radius:50%; background:var(--c-card); display:flex; align-items:center; justify-content:center; text-align:center;">
              <div style="display:flex; flex-direction:column; align-items:center; text-align:center;">
                <span style="font-size:0.95rem; font-weight:800; color:var(--c-text); line-height:1.1;">
                  ${totalEnTime > 0 ? formatSeconds(Math.round(totalEnTime/3)) : '0s'}
                </span>
                <span style="font-size:0.6rem; color:var(--c-text-2); font-weight:500;">avg</span>
              </div>
            </div>
          </div>

          <!-- Difficulty timings -->
          <div style="flex:1; display:flex; flex-direction:column; gap:0.65rem;">
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.8125rem;">
              <div style="display:flex; align-items:center; gap:0.5rem; color:var(--c-text-2); font-weight:600;">
                <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#a5b4fc;"></span>
                Easy
              </div>
              <div style="text-align:right;">
                <div style="font-weight:700; color:var(--c-text);">${formatSeconds(enEasyTime)}</div>
                <div style="font-size:0.65rem; color:var(--c-text-3);">avg 1m 11s</div>
              </div>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.8125rem; border-top:1px solid var(--c-border); padding-top:0.4rem;">
              <div style="display:flex; align-items:center; gap:0.5rem; color:var(--c-text-2); font-weight:600;">
                <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:var(--c-blue);"></span>
                Medium
              </div>
              <div style="text-align:right;">
                <div style="font-weight:700; color:var(--c-text);">${formatSeconds(enMedTime)}</div>
                <div style="font-size:0.65rem; color:var(--c-text-3);">avg 1m 23s</div>
              </div>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.8125rem; border-top:1px solid var(--c-border); padding-top:0.4rem;">
              <div style="display:flex; align-items:center; gap:0.5rem; color:var(--c-text-2); font-weight:600;">
                <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#312e81;"></span>
                Hard
              </div>
              <div style="text-align:right;">
                <div style="font-weight:700; color:var(--c-text);">${formatSeconds(enHardTime)}</div>
                <div style="font-size:0.65rem; color:var(--c-text-3);">avg 2m 52s</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Math Time Share -->
      <div class="glass" style="background:var(--c-card); border:1px solid var(--c-border); border-radius:12px; padding:1.5rem;">
        <h2 style="font-size:1.1rem; font-weight:700; color:var(--c-text);">Math</h2>
        <p style="font-size:0.75rem; color:var(--c-text-2); margin-top:0.15rem; margin-bottom:1.5rem;">Time share by difficulty · gray averages are platform-wide.</p>

        <div style="display:flex; align-items:center; gap:2.5rem;">
          <!-- Dynamic Circular Ring display -->
          <div style="width:110px; height:110px; border-radius:50%; background:${mathTimeShareBg}; display:flex; align-items:center; justify-content:center; flex-shrink:0; position:relative;">
            <div style="width:94px; height:94px; border-radius:50%; background:var(--c-card); display:flex; align-items:center; justify-content:center; text-align:center;">
              <div style="display:flex; flex-direction:column; align-items:center; text-align:center;">
                <span style="font-size:0.95rem; font-weight:800; color:var(--c-text); line-height:1.1;">
                  ${totalMathTime > 0 ? formatSeconds(Math.round(totalMathTime/3)) : '0s'}
                </span>
                <span style="font-size:0.6rem; color:var(--c-text-2); font-weight:500;">avg</span>
              </div>
            </div>
          </div>

          <!-- Difficulty timings -->
          <div style="flex:1; display:flex; flex-direction:column; gap:0.65rem;">
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.8125rem;">
              <div style="display:flex; align-items:center; gap:0.5rem; color:var(--c-text-2); font-weight:600;">
                <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#fca5a5;"></span>
                Easy
              </div>
              <div style="text-align:right;">
                <div style="font-weight:700; color:var(--c-text);">${formatSeconds(mathEasyTime)}</div>
                <div style="font-size:0.65rem; color:var(--c-text-3);">avg 1m 11s</div>
              </div>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.8125rem; border-top:1px solid var(--c-border); padding-top:0.4rem;">
              <div style="display:flex; align-items:center; gap:0.5rem; color:var(--c-text-2); font-weight:600;">
                <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:var(--c-red);"></span>
                Medium
              </div>
              <div style="text-align:right;">
                <div style="font-weight:700; color:var(--c-text);">${formatSeconds(mathMedTime)}</div>
                <div style="font-size:0.65rem; color:var(--c-text-3);">avg 1m 35s</div>
              </div>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.8125rem; border-top:1px solid var(--c-border); padding-top:0.4rem;">
              <div style="display:flex; align-items:center; gap:0.5rem; color:var(--c-text-2); font-weight:600;">
                <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#7f1d1d;"></span>
                Hard
              </div>
              <div style="text-align:right;">
                <div style="font-weight:700; color:var(--c-text);">${formatSeconds(mathHardTime)}</div>
                <div style="font-size:0.65rem; color:var(--c-text-3);">avg 3m 8s</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- GitHub contribution practice calendar heatmap -->
    <div class="glass" style="background:var(--c-card); border:1px solid var(--c-border); border-radius:12px; padding:1.5rem; margin-bottom:1.5rem;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem;">
        <div>
          <h2 style="font-size:1.1rem; font-weight:700; color:var(--c-text);">Your practice activity</h2>
          <span style="font-size:0.75rem; color:var(--c-text-2); font-weight:500;">Most active: <strong style="color:var(--c-text);">${mostActiveDay}</strong>.</span>
        </div>
        <div style="font-size:1.1rem; font-weight:700; color:var(--c-text);">
          ${attempted} <span style="font-size:0.8rem; color:var(--c-text-2); font-weight:500;">questions answered.</span>
        </div>
      </div>

      <!-- Calendar Heatmap Grid -->
      <div style="display:flex; justify-content:center; overflow-x:auto;">
        <div style="display:flex; flex-direction:column; gap:4px; font-family:var(--font); font-size:0.65rem; color:var(--c-text-2); margin-right:8px; justify-content:space-around; height:74px; padding:2px 0;">
          <span>Mon</span>
          <span>Wed</span>
          <span>Fri</span>
        </div>

        <div style="display:flex; gap:3px;">
          ${calendarWeeks.map((week, wIdx) => {
            const firstDayOfWeek = new Date(calStartMs + wIdx * 7 * dayMs);
            const isFirstWeekOfMonth = firstDayOfWeek.getDate() <= 7;
            const monthLabel = firstDayOfWeek.toLocaleDateString('en-US', { month: 'short' });

            return `
              <div style="display:flex; flex-direction:column; gap:3px; position:relative;">
                ${isFirstWeekOfMonth ? `
                  <div style="position:absolute; top:-16px; left:0; font-size:0.6rem; color:var(--c-text-2); font-weight:600; white-space:nowrap;">
                    ${monthLabel}
                  </div>
                ` : ''}
                ${week.map(day => {
                  let cellColor = 'rgba(255,255,255,0.03)'; // 0 solves
                  let border = '1px solid transparent';
                  if (day.active) {
                    if (day.count > 0) {
                      if (day.count <= 2) cellColor = 'rgba(59,130,246,0.18)';
                      else if (day.count <= 5) cellColor = 'rgba(59,130,246,0.4)';
                      else if (day.count <= 9) cellColor = 'rgba(59,130,246,0.7)';
                      else cellColor = 'var(--c-blue)';
                    }
                  } else {
                    cellColor = 'rgba(255,255,255,0.01)';
                    border = '1px solid rgba(255,255,255,0.02)';
                  }

                  return `
                    <div style="width:10px; height:10px; border-radius:2px; background:${cellColor}; border:${border}; cursor:pointer;" 
                         title="${day.dateStr}: ${day.count} questions solved">
                    </div>
                  `;
                }).join('')}
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Heatmap Legend -->
      <div style="display:flex; justify-content:center; align-items:center; gap:4px; font-size:0.65rem; color:var(--c-text-2); font-weight:600; margin-top:1.25rem;">
        <span>Less</span>
        <div style="width:8px; height:8px; border-radius:1px; background:rgba(255,255,255,0.03);"></div>
        <div style="width:8px; height:8px; border-radius:1px; background:rgba(59,130,246,0.18);"></div>
        <div style="width:8px; height:8px; border-radius:1px; background:rgba(59,130,246,0.4);"></div>
        <div style="width:8px; height:8px; border-radius:1px; background:rgba(59,130,246,0.7);"></div>
        <div style="width:8px; height:8px; border-radius:1px; background:var(--c-blue);"></div>
        <span>More</span>
      </div>
    </div>
  `;

  // Attach event listeners for recommendations
  root.querySelectorAll('.practice-weak-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = e.currentTarget as HTMLElement;
      const sec = target.dataset.section as any;
      const dom = target.dataset.domain;
      const skill = target.dataset.skill;
      store.startSession(sec, 0, dom, skill);
    });
  });

  // Saved questions quick navigation
  root.querySelector('#view-saved-btn')?.addEventListener('click', () => {
    store.setView('saved');
  });

  return root;
}
