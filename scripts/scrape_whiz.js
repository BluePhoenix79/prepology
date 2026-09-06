/**
 * Whiz.study Question Scraper - Universal Multi-Engine Edition (v2.0)
 * ====================================================================
 * 
 * Extracts questions from whiz.study across ALL test modes:
 * - Full-Length Practice Exams (SAT, ACT, AP, PSAT)
 * - Practice Drills & Skill Quizzes
 * - Diagnostic Tests & Checkpoints
 * - Score Reports, Review Screens & Mistake Logs
 * 
 * EXTRACTION ENGINES:
 * 1. React Fiber Tree Extraction (extracts directly from React Component memory)
 * 2. Next.js RSC Flight Stream Scanner (extracts preloaded Server Component data)
 * 3. Global JSON & Network Interceptor (Fetch, XHR, JSON.parse hooks)
 * 4. LocalStorage & SessionStorage Inspector
 * 5. Semantic DOM Parser with KaTeX / MathJax LaTeX preservation
 * 
 * HOW TO USE:
 * 1. Open https://whiz.study and log in.
 * 2. Open any practice test, drill, or question review screen.
 * 3. Press F12 (or right-click -> Inspect -> Console tab).
 * 4. Paste this ENTIRE script and press Enter.
 * 5. A floating HUD will appear in the bottom-right corner of the page with buttons:
 *    [📊 Questions: X] [⚡ Auto-Advance] [🔍 Deep Scan] [📥 Download JSON] [📋 Copy]
 * 
 * CONSOLE COMMANDS:
 * - scraperStatus()    → Print full breakdown table of captured questions
 * - downloadQuestions()→ Save and download whiz_questions.json
 * - deepScan()         → Force immediate extraction from React fibers, storage & DOM
 * - autoAdvance(ms)    → Automatically click Next through all test questions
 * - copyToClipboard()  → Copy clean JSON to clipboard
 * - whizDebug()        → Print diagnostic information
 */

(function initWhizUniversalScraper() {
  'use strict';

  // Prevent multiple duplicate HUDs
  const EXISTING_HUD = document.getElementById('__whiz_scraper_hud__');
  if (EXISTING_HUD) EXISTING_HUD.remove();

  // Storage buffers
  window.__WHIZ_QUESTIONS__ = window.__WHIZ_QUESTIONS__ || new Map();
  window.__WHIZ_RAW_PAYLOADS__ = window.__WHIZ_RAW_PAYLOADS__ || [];
  window.__WHIZ_METADATA__ = window.__WHIZ_METADATA__ || new Map();

  console.log('%c🚀 Whiz Universal Scraper v2.0 Activated!', 'background: #4f46e5; color: white; padding: 6px 12px; border-radius: 6px; font-weight: bold; font-size: 14px;');
  console.log('%cCommands: scraperStatus() | downloadQuestions() | deepScan() | autoAdvance(ms) | copyToClipboard()', 'color: #38bdf8; font-weight: bold;');

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Text & HTML Sanitizer (Preserves MathKaTeX / MathJax LaTeX)
  // ─────────────────────────────────────────────────────────────────────────────
  function cleanText(html) {
    if (!html || typeof html !== 'string') return '';

    try {
      const container = document.createElement('div');
      container.innerHTML = html;

      // Extract LaTeX from KaTeX / MathML annotations
      const mathAnnotations = container.querySelectorAll('.katex-mathml annotation[encoding="application/x-tex"], annotation[encoding="application/x-tex"], [data-tex]');
      mathAnnotations.forEach(ann => {
        const tex = ann.getAttribute('data-tex') || ann.textContent || '';
        const replacement = document.createTextNode(` $${tex.trim()}$ `);
        const katexParent = ann.closest('.katex') || ann.closest('.katex-display') || ann;
        katexParent.replaceWith(replacement);
      });

      // Remove screen reader elements and irrelevant svg icons
      const srElements = container.querySelectorAll('.sr-only, [class*="sr-only"], [aria-hidden="true"]');
      srElements.forEach(el => {
        if (!el.textContent.includes('$') && !el.querySelector('annotation')) {
          el.remove();
        }
      });

      // Fix image sources
      const images = container.querySelectorAll('img');
      images.forEach(img => {
        let src = img.getAttribute('src');
        if (src && src.startsWith('/')) {
          img.setAttribute('src', 'https://www.whiz.study' + src);
        }
      });

      html = container.innerHTML;
    } catch (_) {}

    return html
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/\\\[(.*?)\\\]/gs, ' $$ $1 $$ ')
      .replace(/\\\((.*?)\\\)/gs, ' $ $1 $ ')
      .replace(/<br\s*[\/]?>/gi, '\n')
      .replace(/<p\b[^>]*>/gi, '')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, ' ') // strip remaining html tags
      .replace(/\r?\n\s*\n/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .trim();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Taxonomy Normalizer
  // ─────────────────────────────────────────────────────────────────────────────
  function normalizeDomain(raw) {
    if (!raw) return '';
    const r = String(raw).toLowerCase().trim();
    if (r.includes('algebra') || r === 'alg' || r === 'a') return 'Algebra';
    if (r.includes('advanced math') || r.includes('advanced') || r === 'adv' || r === 'h') return 'Advanced Math';
    if (r.includes('geometry') || r.includes('trigonometry') || r === 'geo' || r === 'g') return 'Geometry and Trigonometry';
    if (r.includes('problem') || r.includes('data analysis') || r.includes('statistics') || r === 'psa' || r === 'dat' || r === 'p') return 'Problem-Solving and Data Analysis';
    if (r.includes('information') || r.includes('ideas') || r === 'inf' || r === 'i') return 'Information and Ideas';
    if (r.includes('craft') || r.includes('structure') || r === 'cra' || r === 'c') return 'Craft and Structure';
    if (r.includes('standard english') || r.includes('conventions') || r === 'sec' || r === 's') return 'Standard English Conventions';
    if (r.includes('expression') || r.includes('ideas') || r === 'exp' || r === 'e') return 'Expression of Ideas';
    return raw.trim();
  }

  function classifySkill(section, domain, text) {
    const t = (text || '').toLowerCase();
    if (section === 'Math') {
      if (domain === 'Algebra') {
        if (t.includes('system') || t.includes('two linear')) return 'Systems of two linear equations in two variables';
        if (t.includes('inequal')) return 'Linear inequalities in one or two variables';
        if (t.includes('linear function') || t.includes('f(x)') || t.includes('slope')) return 'Linear functions';
        return 'Linear equations in one variable';
      }
      if (domain === 'Advanced Math') {
        if (t.includes('quadratic') || t.includes('exponential') || t.includes('parabola')) return 'Nonlinear functions';
        if (t.includes('radical') || t.includes('rational') || t.includes('polynomial')) return 'Nonlinear equations in one variable and systems of equations in two variables';
        return 'Equivalent expressions';
      }
      if (domain === 'Geometry and Trigonometry') {
        if (t.includes('volume') || t.includes('area') || t.includes('perimeter')) return 'Area and volume';
        if (t.includes('circle') || t.includes('radius') || t.includes('arc') || t.includes('radians')) return 'Circles';
        if (t.includes('sin') || t.includes('cos') || t.includes('tan') || t.includes('trig') || t.includes('hypotenuse')) return 'Right triangles and trigonometry';
        return 'Lines, angles, and triangles';
      }
      if (domain === 'Problem-Solving and Data Analysis') {
        if (t.includes('ratio') || t.includes('percent') || t.includes('rate') || t.includes('proportion')) return 'Ratios, rates, proportional relationships, and units';
        if (t.includes('probability') || t.includes('random') || t.includes('chance')) return 'Probability and conditional probability';
        if (t.includes('scatter') || t.includes('line of best fit') || t.includes('two-variable')) return 'Two-variable data: Models and scatterplots';
        return 'One-variable data: Distributions and measures of center and spread';
      }
    } else {
      if (domain === 'Information and Ideas') {
        if (t.includes('table') || t.includes('graph') || t.includes('figure') || t.includes('chart') || t.includes('data')) return 'Command of Evidence';
        if (t.includes('infer') || t.includes('suggest') || t.includes('conclude') || t.includes('most likely')) return 'Inferences';
        return 'Central Ideas and Details';
      }
      if (domain === 'Craft and Structure') {
        if (t.includes('as used in') || t.includes('most nearly means') || t.includes('meaning') || t.includes('vocabulary')) return 'Words in Context';
        if (t.includes('function') || t.includes('purpose') || t.includes('structure') || t.includes('main purpose')) return 'Text Structure and Purpose';
        return 'Cross-Text Connections';
      }
      if (domain === 'Standard English Conventions') {
        if (t.includes('comma') || t.includes('semicolon') || t.includes('colon') || t.includes('dash') || t.includes('punctuation')) return 'Boundaries';
        return 'Form, Structure, and Sense';
      }
      if (domain === 'Expression of Ideas') {
        if (t.includes('transition') || t.includes('however') || t.includes('furthermore') || t.includes('therefore')) return 'Transitions';
        return 'Rhetorical Synthesis';
      }
    }
    return domain || 'General';
  }

  function normalizeDifficulty(raw, text) {
    if (typeof raw === 'number' && raw >= 1 && raw <= 3) return raw;
    const r = String(raw || '').toLowerCase().trim();
    if (r === 'easy' || r === '1' || r === 'e' || r === 'tier1' || r.includes('easy')) return 1;
    if (r === 'hard' || r === '3' || r === 'h' || r === 'tier3' || r.includes('hard')) return 3;
    if (r === 'medium' || r === '2' || r === 'm' || r === 'tier2' || r.includes('med')) return 2;

    if (text) {
      const len = text.length;
      if (len > 350) return 3;
      if (len < 120) return 1;
    }
    return 2;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Question Schema Formatter
  // ─────────────────────────────────────────────────────────────────────────────
  function mapQuestion(raw, meta = {}) {
    if (!raw || typeof raw !== 'object') return null;

    // Detect unique ID
    let rawId = raw.id || raw._id || raw.question_id || raw.questionId || raw.uuid || raw.external_id || raw.itemId || raw.slug;
    
    // Stem / Passage
    let rawStem = raw.question_text || raw.questionText || raw.stem || raw.prompt || raw.body || raw.content || raw.question || raw.text || '';
    let rawPassage = raw.passage_text || raw.passageText || raw.passage || raw.context || raw.stimulus || raw.sharedPassage || raw.reading_passage || '';

    if (typeof rawStem === 'object') {
      rawStem = rawStem.text || rawStem.content || rawStem.body || JSON.stringify(rawStem);
    }
    if (typeof rawPassage === 'object') {
      rawPassage = rawPassage.text || rawPassage.content || rawPassage.body || JSON.stringify(rawPassage);
    }

    const questionText = cleanText(rawStem);
    const passageText = cleanText(rawPassage) || undefined;

    if (!questionText && !passageText) return null;

    if (!rawId) {
      rawId = 'whiz-' + Math.abs(hashCode(questionText + (passageText || ''))).toString(36);
    }

    const id = String(rawId).startsWith('whiz-') ? String(rawId) : `whiz-${rawId}`;

    // Domain & Section
    const rawDomain = raw.domain || raw.content_domain || raw.category || raw.topic || raw.subjectCode || meta.domain || '';
    const domain = normalizeDomain(rawDomain) || 'Algebra';
    const mathDomains = ['Algebra', 'Advanced Math', 'Geometry and Trigonometry', 'Problem-Solving and Data Analysis'];
    const rawSection = raw.section || raw.subject || raw.test || meta.section || '';
    const isMath = mathDomains.includes(domain) || /math/i.test(rawSection) || /math/i.test(questionText) || /\$|\\frac|\\sqrt|=/.test(questionText);
    const section = isMath ? 'Math' : 'Reading and Writing';

    // Skill
    const rawSkill = raw.skill || raw.skill_name || raw.subtopic || raw.reporting_category || meta.skill || '';
    const skill = rawSkill || classifySkill(section, domain, `${questionText} ${passageText || ''}`);

    // Difficulty
    const difficulty = normalizeDifficulty(raw.difficulty || raw.difficulty_level || raw.difficultyBand || meta.difficulty, questionText);

    // Choices (A, B, C, D)
    const rawChoices = raw.choices || raw.options || raw.answers || raw.answer_choices || raw.answerOptions || raw.distractors || [];
    let options = [];

    if (Array.isArray(rawChoices) && rawChoices.length > 0) {
      options = rawChoices.map((choice, i) => {
        const letter = String.fromCharCode(65 + i);
        let text = '';
        let optId = letter;

        if (typeof choice === 'string') {
          text = cleanText(choice);
        } else if (choice && typeof choice === 'object') {
          text = cleanText(choice.text || choice.content || choice.body || choice.value || choice.label || choice.html || '');
          if (choice.id && typeof choice.id === 'string' && /^[A-D]$/i.test(choice.id)) {
            optId = choice.id.toUpperCase();
          } else if (choice.label && typeof choice.label === 'string' && /^[A-D]$/i.test(choice.label)) {
            optId = choice.label.toUpperCase();
          }
        }
        return { id: optId, text };
      }).filter(o => o.text);
    }

    // Correct Answer
    let correctAnswer = '';
    const rawAnswer = raw.correct_answer || raw.correctAnswer || raw.answer || raw.correct_choice || raw.correctChoice || raw.key || raw.answerKey || '';
    if (typeof rawAnswer === 'string') {
      const match = rawAnswer.trim().match(/^[A-D]$/i);
      if (match) {
        correctAnswer = match[0].toUpperCase();
      } else if (!isNaN(Number(rawAnswer))) {
        const num = Number(rawAnswer);
        if (num >= 0 && num < options.length) {
          correctAnswer = String.fromCharCode(65 + num);
        } else {
          correctAnswer = rawAnswer.trim();
        }
      } else {
        correctAnswer = rawAnswer.trim();
      }
    } else if (typeof rawAnswer === 'number' && rawAnswer >= 0 && rawAnswer < options.length) {
      correctAnswer = String.fromCharCode(65 + rawAnswer);
    } else if (Array.isArray(rawAnswer) && rawAnswer.length > 0) {
      correctAnswer = String(rawAnswer[0]).trim();
    }

    // Explanation / Rationale
    const rawRationale = raw.rationale || raw.explanation || raw.solution || raw.feedback || raw.step_by_step || raw.detailed_solution || '';
    const rationale = cleanText(typeof rawRationale === 'object' ? (rawRationale.text || JSON.stringify(rawRationale)) : rawRationale);

    // Tags
    const tags = ['Whiz', 'SAT', section];
    if (domain) tags.push(domain);
    if (raw.test_name || meta.test_name) tags.push(raw.test_name || meta.test_name);
    if (raw.module || meta.module) tags.push(`Module ${raw.module || meta.module}`);

    return {
      id,
      section,
      domain,
      skill,
      difficulty,
      passageText,
      questionText,
      options,
      correctAnswer: correctAnswer || (options.length > 0 ? 'A' : ''),
      rationale: rationale || 'Step-by-step rationale not provided.',
      tags: Array.from(new Set(tags)),
      official: false,
      isNew: true
    };
  }

  function hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }

  function registerQuestion(q) {
    if (!q || !q.id || !q.questionText) return;
    if (!window.__WHIZ_QUESTIONS__.has(q.id)) {
      window.__WHIZ_QUESTIONS__.set(q.id, q);
      console.log(`%c[Whiz Scraper] +1 Captured: [${q.section}] ${q.domain} (${q.id})`, 'color: #10b981; font-weight: bold;');
      updateHUD();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. ENGINE 1: React Fiber Deep Traversal
  // ─────────────────────────────────────────────────────────────────────────────
  function scanReactFibers() {
    let countBefore = window.__WHIZ_QUESTIONS__.size;
    const visitedFibers = new Set();

    function inspectObject(obj, depth = 0) {
      if (!obj || typeof obj !== 'object' || depth > 8) return;
      
      if (Array.isArray(obj)) {
        obj.forEach(item => inspectObject(item, depth + 1));
        return;
      }

      // Check if object is a Question
      const hasStem = obj.stem || obj.prompt || obj.question_text || obj.questionText || obj.question || (obj.body && (obj.choices || obj.options));
      const hasChoices = obj.choices || obj.options || obj.answers || obj.answerOptions;
      
      if ((hasStem && hasChoices) || (hasStem && obj.id) || (obj.questionText && obj.options)) {
        const q = mapQuestion(obj);
        if (q && q.questionText) registerQuestion(q);
      }

      // Check for array of questions inside state (e.g. questions: [...], items: [...])
      for (const [k, v] of Object.entries(obj)) {
        if (v && typeof v === 'object' && k !== 'options' && k !== 'choices') {
          inspectObject(v, depth + 1);
        }
      }
    }

    function traverseFiber(fiber, depth = 0) {
      if (!fiber || depth > 200 || visitedFibers.has(fiber)) return;
      visitedFibers.add(fiber);

      // Check memoizedProps
      if (fiber.memoizedProps) {
        inspectObject(fiber.memoizedProps);
      }

      // Check memoizedState (React hooks)
      if (fiber.memoizedState) {
        let stateNode = fiber.memoizedState;
        while (stateNode) {
          if (stateNode.memoizedState) {
            inspectObject(stateNode.memoizedState);
          }
          stateNode = stateNode.next;
        }
      }

      if (fiber.child) traverseFiber(fiber.child, depth + 1);
      if (fiber.sibling) traverseFiber(fiber.sibling, depth + 1);
    }

    // Find all DOM nodes and scan their attached fibers
    const elements = document.querySelectorAll('*');
    for (const el of elements) {
      for (const key in el) {
        if (key.startsWith('__reactFiber$') || key.startsWith('__reactInternalInstance$')) {
          traverseFiber(el[key]);
        }
        if (key.startsWith('__reactProps$')) {
          inspectObject(el[key]);
        }
      }
    }

    const added = window.__WHIZ_QUESTIONS__.size - countBefore;
    if (added > 0) {
      console.log(`%c[React Fiber Engine] Extracted ${added} questions from React component tree!`, 'color: #a855f7; font-weight: bold;');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. ENGINE 2: Next.js RSC Flight Scanner & Script Tags
  // ─────────────────────────────────────────────────────────────────────────────
  function scanNextFlightStreams() {
    let countBefore = window.__WHIZ_QUESTIONS__.size;

    // Scan window.__next_f
    if (Array.isArray(window.__next_f)) {
      window.__next_f.forEach(entry => {
        if (Array.isArray(entry) && typeof entry[1] === 'string') {
          scanTextForQuestions(entry[1]);
        }
      });
    }

    // Scan all <script> tags on page
    const scripts = document.querySelectorAll('script');
    scripts.forEach(s => {
      const text = s.textContent || '';
      if (text.includes('question') || text.includes('choices') || text.includes('passage')) {
        scanTextForQuestions(text);
      }
    });

    const added = window.__WHIZ_QUESTIONS__.size - countBefore;
    if (added > 0) {
      console.log(`%c[Next.js RSC Engine] Extracted ${added} questions from preloaded Flight streams!`, 'color: #3b82f6; font-weight: bold;');
    }
  }

  function scanTextForQuestions(text) {
    try {
      // Find JSON object matches
      const matches = text.match(/\{[^{}]*(?:questionText|question_text|choices|passage)[^{}]*\}/g) || [];
      matches.forEach(jsonStr => {
        try {
          const parsed = JSON.parse(jsonStr);
          const q = mapQuestion(parsed);
          if (q && q.questionText) registerQuestion(q);
        } catch (_) {}
      });
    } catch (_) {}
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. ENGINE 3: Global Network & JSON.parse Interceptor
  // ─────────────────────────────────────────────────────────────────────────────
  function hookNetworkAndJson() {
    // Monkey-patch JSON.parse to catch any object decoded anywhere
    const origJsonParse = JSON.parse;
    JSON.parse = function(...args) {
      const result = origJsonParse.apply(this, args);
      try {
        if (result && typeof result === 'object') {
          scanObject(result);
        }
      } catch (_) {}
      return result;
    };

    function scanObject(obj) {
      if (!obj || typeof obj !== 'object') return;
      if (Array.isArray(obj)) {
        obj.forEach(scanObject);
        return;
      }
      if ((obj.questionText || obj.question_text || obj.stem || obj.prompt) && (obj.choices || obj.options || obj.answers)) {
        const q = mapQuestion(obj);
        if (q && q.questionText) registerQuestion(q);
      }
      for (const [k, v] of Object.entries(obj)) {
        if (v && typeof v === 'object' && k !== 'choices' && k !== 'options') {
          scanObject(v);
        }
      }
    }

    // Hook fetch
    const origFetch = window.fetch;
    window.fetch = async function(...args) {
      const res = await origFetch.apply(this, args);
      try {
        const clone = res.clone();
        clone.text().then(text => {
          try {
            const data = JSON.parse(text);
            scanObject(data);
          } catch (_) {
            scanTextForQuestions(text);
          }
        }).catch(() => {});
      } catch (_) {}
      return res;
    };

    // Hook XHR
    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function() {
      return origOpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function() {
      this.addEventListener('load', function() {
        try {
          if (this.responseText) {
            const data = JSON.parse(this.responseText);
            scanObject(data);
          }
        } catch (_) {}
      });
      return origSend.apply(this, arguments);
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. ENGINE 4: Storage Inspector (LocalStorage / SessionStorage)
  // ─────────────────────────────────────────────────────────────────────────────
  function scanStorage() {
    const storages = [localStorage, sessionStorage];
    storages.forEach(store => {
      try {
        for (let i = 0; i < store.length; i++) {
          const key = store.key(i);
          if (!key) continue;
          const val = store.getItem(key);
          if (val && (val.includes('question') || val.includes('passage') || val.includes('test'))) {
            try {
              const parsed = JSON.parse(val);
              if (Array.isArray(parsed)) {
                parsed.forEach(item => {
                  const q = mapQuestion(item);
                  if (q && q.questionText) registerQuestion(q);
                });
              } else if (parsed && typeof parsed === 'object') {
                const q = mapQuestion(parsed);
                if (q && q.questionText) registerQuestion(q);
              }
            } catch (_) {}
          }
        }
      } catch (_) {}
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 8. ENGINE 5: Semantic DOM Parser (Current Visible Screen)
  // ─────────────────────────────────────────────────────────────────────────────
  function scrapeVisibleDOM() {
    try {
      // Find passage (typically left side or split pane)
      const passageCandidates = [
        document.querySelector('[data-testid*="passage"]'),
        document.querySelector('[class*="passage"]'),
        document.querySelector('[class*="stimulus"]'),
        document.querySelector('main > div > div:first-child [class*="prose"]'),
        document.querySelector('.split-pane-left')
      ].filter(Boolean);

      let passageText = '';
      if (passageCandidates.length > 0) {
        passageText = cleanText(passageCandidates[0].innerHTML);
      }

      // Find question stem / prompt
      const stemCandidates = [
        document.querySelector('[data-testid*="stem"]'),
        document.querySelector('[data-testid*="question-text"]'),
        document.querySelector('[class*="question-text"]'),
        document.querySelector('[class*="stem"]'),
        document.querySelector('[class*="prompt"]'),
        document.querySelector('main [class*="card"] h2'),
        document.querySelector('main [class*="card"] p')
      ].filter(Boolean);

      let questionText = '';
      if (stemCandidates.length > 0) {
        questionText = cleanText(stemCandidates[0].innerHTML);
      }

      // If stem not found via specific classes, extract from main text block
      if (!questionText) {
        const mainContent = document.querySelector('main');
        if (mainContent) {
          const paragraphs = Array.from(mainContent.querySelectorAll('p, h2, h3, div')).map(p => cleanText(p.innerHTML)).filter(t => t.length > 20);
          if (paragraphs.length > 0) questionText = paragraphs[0];
        }
      }

      // Find options (A, B, C, D)
      const choiceButtons = Array.from(document.querySelectorAll('button, [role="button"], [data-slot="card"], label')).filter(el => {
        const t = el.textContent.trim();
        return /^[A-D][.\s)]/i.test(t) || el.getAttribute('data-choice') || el.classList.contains('choice') || el.querySelector('input[type="radio"]');
      });

      const options = [];
      let correctAnswer = '';

      if (choiceButtons.length >= 2) {
        choiceButtons.slice(0, 4).forEach((btn, idx) => {
          const letter = String.fromCharCode(65 + idx);
          const rawHtml = btn.innerHTML;
          const text = cleanText(rawHtml).replace(/^[A-D][.\s)]\s*/i, '');
          options.push({ id: letter, text });

          if (btn.classList.contains('correct') || btn.getAttribute('data-correct') === 'true' || btn.querySelector('[class*="correct"], [class*="success"]')) {
            correctAnswer = letter;
          }
        });
      }

      // Find explanation / rationale
      const rationaleEl = document.querySelector('[data-testid*="explanation"], [class*="rationale"], [class*="solution"], [class*="feedback"]');
      const rationale = rationaleEl ? cleanText(rationaleEl.innerHTML) : '';

      if (questionText || (passageText && options.length > 0)) {
        const id = 'whiz-dom-' + Math.abs(hashCode(questionText + (passageText || ''))).toString(36);
        const q = mapQuestion({
          id,
          questionText: questionText || 'Question stem',
          passageText: passageText || undefined,
          choices: options,
          correctAnswer,
          rationale
        });
        if (q) registerQuestion(q);
      }
    } catch (e) {
      console.debug('DOM Scrape Error:', e);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 9. Floating On-Screen HUD (UI Controls)
  // ─────────────────────────────────────────────────────────────────────────────
  function createHUD() {
    const hud = document.createElement('div');
    hud.id = '__whiz_scraper_hud__';
    hud.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 999999;
      background: rgba(15, 23, 42, 0.92);
      backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 16px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
      padding: 16px;
      color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      min-width: 280px;
      user-select: none;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    `;

    hud.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: #10b981; box-shadow: 0 0 10px #10b981;"></span>
          <strong style="font-size: 14px; letter-spacing: -0.2px;">Whiz Scraper</strong>
        </div>
        <span id="__whiz_q_count__" style="background: rgba(79, 70, 229, 0.3); color: #a5b4fc; border: 1px solid rgba(99, 102, 241, 0.4); padding: 2px 10px; border-radius: 12px; font-weight: bold; font-size: 12px;">
          ${window.__WHIZ_QUESTIONS__.size} Captured
        </span>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px;">
        <button id="__whiz_btn_deep_scan__" style="background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.15); color: #e2e8f0; padding: 8px 12px; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s;">
          🔍 Deep Scan
        </button>
        <button id="__whiz_btn_auto__" style="background: #3b82f6; border: none; color: white; padding: 8px 12px; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s;">
          ⚡ Auto-Advance
        </button>
      </div>

      <div style="display: flex; gap: 8px;">
        <button id="__whiz_btn_download__" style="flex: 2; background: #4f46e5; border: none; color: white; padding: 10px 14px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.4);">
          📥 Download JSON
        </button>
        <button id="__whiz_btn_copy__" style="flex: 1; background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.15); color: #cbd5e1; padding: 10px 10px; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s;">
          📋 Copy
        </button>
      </div>

      <div style="margin-top: 10px; text-align: center;">
        <span style="font-size: 11px; color: #94a3b8;">Or type <code>scraperStatus()</code> in console</span>
      </div>
    `;

    document.body.appendChild(hud);

    // Event listeners
    document.getElementById('__whiz_btn_deep_scan__').onclick = () => {
      window.deepScan();
    };

    let autoRunning = false;
    const autoBtn = document.getElementById('__whiz_btn_auto__');
    autoBtn.onclick = () => {
      if (!autoRunning) {
        autoRunning = true;
        autoBtn.textContent = '⏹️ Stop Auto';
        autoBtn.style.background = '#ef4444';
        window.autoAdvance(1200);
      } else {
        autoRunning = false;
        autoBtn.textContent = '⚡ Auto-Advance';
        autoBtn.style.background = '#3b82f6';
        if (window.__stopAutoAdvance) window.__stopAutoAdvance();
      }
    };

    document.getElementById('__whiz_btn_download__').onclick = () => {
      window.downloadQuestions();
    };

    document.getElementById('__whiz_btn_copy__').onclick = () => {
      window.copyToClipboard();
    };
  }

  function updateHUD() {
    const badge = document.getElementById('__whiz_q_count__');
    if (badge) {
      badge.textContent = `${window.__WHIZ_QUESTIONS__.size} Captured`;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 10. Public Methods & Commands
  // ─────────────────────────────────────────────────────────────────────────────
  window.deepScan = function() {
    console.log('%c🔍 Running Deep Scan across all extraction engines...', 'color: #38bdf8; font-weight: bold;');
    scanReactFibers();
    scanNextFlightStreams();
    scanStorage();
    scrapeVisibleDOM();
    updateHUD();
    window.scraperStatus();
  };

  window.scraperStatus = window.whizStatus = function() {
    const list = Array.from(window.__WHIZ_QUESTIONS__.values());
    console.clear();
    console.log(`%c📊 Whiz Scraper: ${list.length} Questions in Buffer`, 'font-size: 16px; font-weight: bold; color: #4f46e5;');

    if (list.length === 0) {
      console.warn('⚠️ 0 questions currently in buffer.');
      console.log('%cTip: Navigate to an active practice test or drill, then click "Deep Scan" or type deepScan()!', 'color: #f59e0b;');
      return;
    }

    const sections = {};
    const domains = {};
    const diffs = { '1 (Easy)': 0, '2 (Medium)': 0, '3 (Hard)': 0 };

    list.forEach(q => {
      sections[q.section] = (sections[q.section] || 0) + 1;
      domains[q.domain] = (domains[q.domain] || 0) + 1;
      if (q.difficulty === 1) diffs['1 (Easy)']++;
      else if (q.difficulty === 3) diffs['3 (Hard)']++;
      else diffs['2 (Medium)']++;
    });

    console.table(sections);
    console.table(domains);
    console.table(diffs);
  };

  window.downloadQuestions = window.saveQuestions = function(filename = 'whiz_questions.json') {
    window.deepScan();
    const list = Array.from(window.__WHIZ_QUESTIONS__.values());
    if (list.length === 0) {
      alert('⚠️ No questions captured yet! Make sure you are on a test/drill screen and click "Deep Scan".');
      return;
    }

    const jsonStr = JSON.stringify(list, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log(`%c✅ Successfully downloaded ${list.length} questions to ${filename}!`, 'color: #10b981; font-weight: bold;');
  };

  window.copyToClipboard = function() {
    window.deepScan();
    const list = Array.from(window.__WHIZ_QUESTIONS__.values());
    const jsonStr = JSON.stringify(list, null, 2);
    navigator.clipboard.writeText(jsonStr).then(() => {
      console.log(`%c📋 Copied ${list.length} questions to clipboard!`, 'color: #10b981; font-weight: bold;');
      alert(`Copied ${list.length} questions to clipboard!`);
    }).catch(err => {
      console.error('Failed to copy to clipboard:', err);
    });
  };

  window.autoAdvance = function(delayMs = 1200) {
    console.log(`%c▶️ Auto-Advancer started (Delay: ${delayMs}ms)`, 'color: #3b82f6; font-weight: bold;');
    
    const interval = setInterval(() => {
      window.deepScan();

      // Look for Next / Continue buttons or question navigator bubbles
      const buttons = Array.from(document.querySelectorAll('button, a, [role="button"]'));
      
      const nextBtn = buttons.find(b => {
        const t = b.textContent.trim().toLowerCase();
        return (t === 'next' || t === 'continue' || t === '→' || t.includes('next question')) && !b.disabled;
      });

      if (nextBtn) {
        nextBtn.click();
      } else {
        // Try clicking next number in question navigation bar (1, 2, 3...)
        const navButtons = buttons.filter(b => /^\d+$/.test(b.textContent.trim()));
        const activeNavIdx = navButtons.findIndex(b => b.classList.contains('active') || b.getAttribute('aria-current') === 'true' || b.getAttribute('data-state') === 'active');
        if (activeNavIdx !== -1 && activeNavIdx + 1 < navButtons.length) {
          navButtons[activeNavIdx + 1].click();
        } else {
          console.log('%c⏹️ Auto-Advancer reached end of section.', 'color: #f59e0b;');
          clearInterval(interval);
          window.scraperStatus();
        }
      }
    }, delayMs);

    window.__stopAutoAdvance = () => {
      clearInterval(interval);
      console.log('Auto-advancer stopped.');
    };
  };

  window.whizDebug = function() {
    console.log('--- Whiz Scraper Diagnostic Info ---');
    console.log('Current URL:', location.href);
    console.log('Captured Questions Count:', window.__WHIZ_QUESTIONS__.size);
    console.log('Raw Payloads Count:', window.__WHIZ_RAW_PAYLOADS__.length);
    console.log('Next.js Flight Chunks:', Array.isArray(window.__next_f) ? window.__next_f.length : 'none');
    console.log('Sample Captured Question:', Array.from(window.__WHIZ_QUESTIONS__.values())[0] || 'none');
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // 11. Initial Run
  // ─────────────────────────────────────────────────────────────────────────────
  hookNetworkAndJson();
  createHUD();
  window.deepScan();

  // Listen for DOM changes to automatically catch questions on page turns
  let mutationTimeout;
  const observer = new MutationObserver(() => {
    clearTimeout(mutationTimeout);
    mutationTimeout = setTimeout(() => {
      scanReactFibers();
      scrapeVisibleDOM();
      updateHUD();
    }, 400);
  });
  observer.observe(document.body, { childList: true, subtree: true });

})();
