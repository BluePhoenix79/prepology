/**
 * CB Question Bank Scraper - Network Interceptor Edition v3
 * ==========================================================
 * 
 * HOW TO USE:
 * 1. Go to: https://satsuiteeducatorquestionbank.collegeboard.org/digital/results
 * 2. Log in if prompted, apply any filters you want
 * 3. Open DevTools → Console tab
 * 4. Paste this ENTIRE script and press Enter
 * 5. Click "View Questions" or scroll/paginate through results
 * 6. Type: scraperStatus()  to see what was captured
 * 7. Type: inspectRaw()     to see the raw API structure (useful for debugging)
 * 8. Type: downloadQuestions()  when done to save your JSON
 *
 * MERGE INTO PROJECT:
 *   Move downloaded JSON to project root, then run:
 *   node scripts/merge_official.js
 */

(function installInterceptor() {
  'use strict';

  window.__CB_QUESTIONS__ = window.__CB_QUESTIONS__ || new Map();
  window.__CB_RAW_RESPONSES__ = window.__CB_RAW_RESPONSES__ || [];
  window.__CB_METADATA__ = window.__CB_METADATA__ || new Map();

  // ─────────────────────────────────────────────────────────────────────────────
  // Utility: strip HTML tags and decode entities, preserving $ LaTeX $
  // ─────────────────────────────────────────────────────────────────────────────
  function clean(html) {
    if (!html || typeof html !== 'string') return '';
    
    try {
      const div = document.createElement('div');
      div.innerHTML = html;

      // 1. Remove screen reader text that would otherwise print on screen
      const srOnly = div.querySelectorAll('.sr-only, [class*="sr-only"], .visual-cue, [aria-hidden="true"]');
      srOnly.forEach(el => el.remove());

      // 2. Convert relative image paths to absolute College Board links
      const imgNodes = div.querySelectorAll('img');
      imgNodes.forEach(img => {
        let src = img.getAttribute('src');
        if (src) {
          if (src.startsWith('/')) {
            src = 'https://satsuiteeducatorquestionbank.collegeboard.org' + src;
          }
          img.setAttribute('src', src);
        }
      });
      
      html = div.innerHTML;
    } catch (e) {
      // Fallback if parsing fails
    }

    // Collapse all newlines and whitespace into single spaces to prevent renderMath from injecting <br> tags into HTML markup
    return html
      .replace(/\r?\n/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .trim();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Domain / skill normalizers
  // ─────────────────────────────────────────────────────────────────────────────
  function normalizeDomain(raw) {
    if (!raw) return '';
    const r = (typeof raw === 'string' ? raw : JSON.stringify(raw)).toLowerCase();
    if (r.includes('advanced math')) return 'Advanced Math';
    if (r.includes('algebra')) return 'Algebra';
    if (r.includes('geometry') || r.includes('trigonometry')) return 'Geometry and Trigonometry';
    if (r.includes('problem') || r.includes('data analysis') || r.includes('statistics')) return 'Problem-Solving and Data Analysis';
    if (r.includes('information') || r.includes('ideas')) return 'Information and Ideas';
    if (r.includes('craft') || r.includes('structure')) return 'Craft and Structure';
    if (r.includes('standard english') || r.includes('conventions')) return 'Standard English Conventions';
    if (r.includes('expression')) return 'Expression of Ideas';
    return typeof raw === 'string' ? raw : '';
  }

  // Decode CB parenttemplatename codes (e.g. "OSP-065-INF" → Information and Ideas)
  function domainFromPTN(ptn) {
    if (!ptn) return '';
    const code = ptn.split('-').pop().toUpperCase();
    return {
      'INF': 'Information and Ideas',
      'CRA': 'Craft and Structure',
      'SEC': 'Standard English Conventions',
      'EXP': 'Expression of Ideas',
      'ALG': 'Algebra',
      'ADV': 'Advanced Math',
      'GEO': 'Geometry and Trigonometry',
      'DAT': 'Problem-Solving and Data Analysis',
      'PSA': 'Problem-Solving and Data Analysis',
    }[code] || '';
  }

  // Extract domain/skill/difficulty from an API URL's query params
  function metaFromUrl(url) {
    try {
      const u = new URL(url, location.href);
      const domain = normalizeDomain(
        u.searchParams.get('domain') ||
        u.searchParams.get('contentDomain') ||
        u.searchParams.get('category') ||
        ''
      );
      const skill = u.searchParams.get('skill') || u.searchParams.get('reportingCategory') || '';
      const rawDiff = (u.searchParams.get('difficulty') || u.searchParams.get('difficultyBand') || '').toLowerCase();
      const difficulty = rawDiff === 'easy' ? 1 : rawDiff === 'hard' ? 3 : rawDiff === 'medium' ? 2 : 0;
      return { domain, skill, difficulty };
    } catch (_) { return {}; }
  }

  // Extract domain/skill/difficulty from POST request payloads recursively
  function metaFromPayload(body) {
    if (!body) return {};
    let obj = {};
    if (typeof body === 'string') {
      try { obj = JSON.parse(body); } catch (_) { return {}; }
    } else if (typeof body === 'object') {
      obj = body;
    }
    
    let domain = '';
    let skill = '';
    let difficulty = 0;
    
    function scan(o) {
      if (!o || typeof o !== 'object') return;
      if (Array.isArray(o)) {
        o.forEach(scan);
        return;
      }
      
      const rawDomain = o.domain || o.contentDomain || o.category || o.domainCode || o.subjectCode || o.contentArea || '';
      if (rawDomain && !domain) {
        domain = normalizeDomain(rawDomain) || domainFromPTN(rawDomain);
      }
      
      const rawSkill = o.skill || o.reportingCategory || o.skillCode || o.skillName || '';
      if (rawSkill && !skill) {
        skill = rawSkill;
      }
      
      const rawDiff = o.difficulty || o.difficultyBand || o.difficulty_band || o.difficultyLevel || o.difficulty_level || o.difficultyCode || o.difficulty_code || o.difficultyband || o.difficultylevel || o.difficultycode || '';
      if (rawDiff && !difficulty) {
        const d = String(rawDiff).toLowerCase();
        if (d === 'easy' || d === '1' || d === 'e') difficulty = 1;
        else if (d === 'medium' || d === '2' || d === 'm') difficulty = 2;
        else if (d === 'hard' || d === '3' || d === 'h') difficulty = 3;
      }
      
      for (const val of Object.values(o)) {
        if (val && typeof val === 'object') scan(val);
      }
    }
    
    scan(obj);
    return { domain, skill, difficulty };
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
        if (t.includes('quadratic') || t.includes('exponential')) return 'Quadratic and exponential word problems';
        if (t.includes('radical') || t.includes('rational') || t.includes('denominator')) return 'Radicals and rational equations';
        return 'Nonlinear functions';
      }
      if (domain === 'Geometry and Trigonometry') {
        if (t.includes('volume') || t.includes('area')) return 'Area and volume';
        if (t.includes('circle') || t.includes('radius') || t.includes('arc')) return 'Circles';
        if (t.includes('trig') || t.includes('sin') || t.includes('cos') || t.includes('right triangle')) return 'Right triangles and trigonometry';
        return 'Angles, triangles, and polygons';
      }
      if (domain === 'Problem-Solving and Data Analysis') {
        if (t.includes('ratio') || t.includes('percent') || t.includes('rate')) return 'Ratio, proportion, units, and percentage';
        if (t.includes('probability') || t.includes('random')) return 'Probability and conditional probability';
        if (t.includes('scatter') || t.includes('line of best fit')) return 'Two-variable data: models and scatterplots';
        return 'One-variable data: distributions and measures of center and spread';
      }
    } else {
      if (domain === 'Information and Ideas') {
        if (t.includes('table') || t.includes('graph') || t.includes('evidence')) return 'Command of Evidence';
        if (t.includes('infer') || t.includes('conclusion') || t.includes('suggest')) return 'Inferences';
        return 'Central Ideas and Details';
      }
      if (domain === 'Craft and Structure') {
        if (t.includes('word') || t.includes('means') || t.includes('vocabulary')) return 'Words in Context';
        if (t.includes('purpose') || t.includes('function') || t.includes('structure')) return 'Text Structure and Purpose';
        return 'Cross-Text Connections';
      }
      if (domain === 'Standard English Conventions') {
        if (t.includes('punctuation') || t.includes('comma') || t.includes('colon') || t.includes('semicolon')) return 'Boundaries';
        return 'Form, Structure, and Sense';
      }
      if (domain === 'Expression of Ideas') {
        if (t.includes('transition') || t.includes('furthermore') || t.includes('however') || t.includes('therefore')) return 'Transitions';
        return 'Rhetorical Synthesis';
      }
    }
    return domain;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Map a raw CB question object → our schema
  // Handles every CB API format variant we've seen
  // ─────────────────────────────────────────────────────────────────────────────
  function mapQuestion(raw, parentMeta) {
    // ── ID ──────────────────────────────────────────────────────────────────────
    const id = raw.externalid || raw.externalId || raw.external_id || raw.questionId || raw.question_id || raw.id || raw.vaultid || raw.vault_id || raw.itemId || raw.item_id || null;
    if (!id) return null;

    const metadata = (window.__CB_METADATA__ && window.__CB_METADATA__.get(String(id))) || {};

    // ── Domain — CB stores this at PARENT level (URL params, wrapper object, or PTN code)
    const rawDomain =
      metadata.domain ||
      (parentMeta && parentMeta.domain) ||
      (parentMeta && parentMeta.contentDomain) ||
      raw.domain ||
      raw.contentDomain ||
      raw.primaryDomain ||
      raw.skill_category ||
      raw.primaryClassification?.domain ||
      raw.classification?.domain ||
      raw.contentAreaName ||
      raw.reportingCategory ||
      domainFromPTN(raw.parenttemplatename) ||   // decode OSP-065-INF → domain
      '';
    const domain = normalizeDomain(rawDomain) || 'Unknown';

    // ── Section ──────────────────────────────────────────────────────────────────
    const mathDomains = ['Algebra', 'Advanced Math', 'Geometry and Trigonometry', 'Problem-Solving and Data Analysis'];
    const rawTest = raw.testCode || raw.assessmentCode || raw.section || raw.subject || raw.testDomain || '';
    const isMath = mathDomains.includes(domain) || /math/i.test(rawTest) || /math/i.test(rawDomain);
    const section = isMath ? 'Math' : 'Reading and Writing';

    // ── Difficulty ────────────────────────────────────────────────────────────────
    let difficulty = metadata.difficulty || (parentMeta && parentMeta.difficulty) || 2;
    if (!difficulty || difficulty === 2) {
      const diff = (
        raw.difficulty ||
        raw.difficultyBand ||
        raw.difficulty_band ||
        raw.difficultyLevel ||
        raw.difficulty_level ||
        raw.difficultyCode ||
        raw.difficulty_code ||
        raw.difficultyband ||
        raw.difficultylevel ||
        raw.difficultycode ||
        ''
      ).toString().toLowerCase();
      if (diff === '1' || diff === 'easy' || diff === 'e') difficulty = 1;
      else if (diff === '3' || diff === 'hard' || diff === 'h') difficulty = 3;
      else if (diff === '2' || diff === 'medium' || diff === 'm') difficulty = 2;
    }

    // ── Question text (stem) ──────────────────────────────────────────────────────
    // CB uses: stem, body, question, prompt, itemStem, questionText
    const rawStem =
      raw.stem ||
      raw.body ||
      raw.question ||
      raw.prompt ||
      raw.itemStem ||
      raw.item_stem ||
      raw.questionText ||
      raw.question_text ||
      raw.questionStem ||
      raw.question_stem ||
      raw.questionContent ||
      raw.question_content ||
      '';
    const questionText = clean(typeof rawStem === 'object' ? JSON.stringify(rawStem) : rawStem);

    // ── Passage / stimulus ────────────────────────────────────────────────────────
    const rawPassage =
      raw.stimulus ||
      raw.passage ||
      raw.context ||
      raw.sharedPassage ||
      raw.shared_passage ||
      raw.passageText ||
      raw.passage_text ||
      raw.readingPassage ||
      raw.reading_passage ||
      raw.primaryText ||
      raw.primary_text ||
      raw.excerpt ||
      '';
    const passageText = clean(typeof rawPassage === 'object' ? JSON.stringify(rawPassage) : rawPassage) || null;

    // ── Answer choices ────────────────────────────────────────────────────────────
    // CB uses 'answerOptions' with {id: UUID, content: HTML} — UUIDs are positional
    const rawChoices =
      raw.answerOptions ||
      raw.answer_options ||
      raw.answerChoices ||
      raw.answer_choices ||
      raw.choices ||
      raw.options ||
      raw.answers ||
      raw.distractors ||
      [];

    let options = [];
    if (Array.isArray(rawChoices) && rawChoices.length > 0) {
      options = rawChoices.map((c, i) => {
        // CB answer options use UUID ids — assign letters by position (A, B, C, D)
        const letterId = String.fromCharCode(65 + i);
        let text = '';
        if (typeof c === 'string') {
          text = c;
        } else {
          // CB stores content as HTML in c.content
          text = c.content || c.body || c.text || c.value || c.html || c.choiceText || '';
          if (typeof text === 'object') text = JSON.stringify(text);
        }
        // Store UUID so we can cross-ref with 'keys' array for correct answer
        return { id: letterId, text: clean(text), _uuid: c.id || c.uuid || '' };
      }).filter(o => o.text);
    }

    // ── Correct answer ────────────────────────────────────────────────────────────
    // CB format 1: correct_answer: ["B"]  (letter in array)
    // CB format 2: keys: ["UUID-of-correct-option"]  (UUID to cross-ref with options)
    let correctAnswer = '';
    if (Array.isArray(raw.correct_answer) && raw.correct_answer.length > 0) {
      // Direct letter: ["B"]
      correctAnswer = String(raw.correct_answer[0]).toUpperCase().charAt(0);
    } else if (Array.isArray(raw.keys) && raw.keys.length > 0) {
      // UUID lookup: find which position (A/B/C/D) the UUID maps to
      const keyUuid = raw.keys[0];
      const matchIdx = options.findIndex(o => o._uuid === keyUuid);
      if (matchIdx >= 0) {
        correctAnswer = String.fromCharCode(65 + matchIdx);
      }
    } else {
      // Fallback to older field names
      const ca = raw.correctAnswer || raw.correct_answer_field || raw.answer || raw.correctChoice || raw.correct_choice || raw.answerKey || raw.answer_key || '';
      if (typeof ca === 'string') {
        correctAnswer = ca.trim().toUpperCase().replace(/^CHOICE_?/i, '').charAt(0);
      }
    }
    // Clean up _uuid helper field from options before saving
    options = options.map(({ _uuid, ...o }) => o);

    // ── Rationale ─────────────────────────────────────────────────────────────────
    const rawRationale =
      raw.rationale ||
      raw.explanation ||
      raw.solution ||
      raw.answerExplanation ||
      raw.rationaleHtml ||
      '';
    const rationale = clean(typeof rawRationale === 'object' ? JSON.stringify(rawRationale) : rawRationale);

    // ── Skill ─────────────────────────────────────────────────────────────────────
    const rawSkill =
      metadata.skill ||
      raw.skill ||
      raw.skillDescription ||
      raw.primarySkill?.description ||
      raw.primaryClassification?.skill ||
      raw.subDomain ||
      raw.reportingSkill ||
      raw.contentSkill ||
      '';
    const skill = rawSkill || classifySkill(section, domain, questionText + ' ' + rationale);

    if (!questionText && !passageText && options.length === 0) return null;

    return {
      id: String(id),
      section,
      domain,
      skill,
      difficulty,
      passageText: passageText || null,
      questionText,
      options,
      correctAnswer,
      rationale,
      official: true,
      tags: [domain, skill].filter(Boolean),
      _raw: raw,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CB-specific question detector
  // ─────────────────────────────────────────────────────────────────────────────
  function looksLikeQuestion(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
    // If it has any sort of ID, it might be a question. We will let mapQuestion decide.
    return !!(obj.externalid || obj.external_id || obj.vaultid || obj.vault_id || obj.questionId || obj.question_id || obj.externalId || obj.itemId || obj.item_id || obj.id);
  }

  // Visited set to avoid re-processing the same object (WeakSet has no .clear() — use let + reassign)
  let _visited = new WeakSet();

  // Brute-force: walk EVERY key at EVERY depth — no depth limit, no key filter
  // parentMeta carries domain/skill/difficulty from the URL or parent wrapper
  function tryExtract(obj, parentMeta) {
    if (!obj || typeof obj !== 'object') return;
    if (_visited.has(obj)) return;
    _visited.add(obj);

    // Save metadata if this object has an ID and some metadata fields
    const id = obj.externalid || obj.external_id || obj.vaultid || obj.vault_id || obj.questionId || obj.question_id || obj.externalId || obj.itemId || obj.item_id || obj.id;
    if (id) {
      const rawDiff = obj.difficulty || obj.difficultyBand || obj.difficulty_band || obj.difficultyLevel || obj.difficulty_level || obj.difficultyCode || obj.difficulty_code || obj.difficultyband || obj.difficultylevel || obj.difficultycode;
      const rawDomain = obj.domain || obj.contentDomain || obj.category || obj.domainCode || obj.subjectCode || obj.contentArea || '';
      const rawSkill = obj.skill || obj.reportingCategory || obj.skillCode || obj.skillName || '';

      if (rawDiff || rawDomain || rawSkill) {
        let difficultyVal = 0;
        if (rawDiff) {
          const d = String(rawDiff).toLowerCase();
          if (d === 'easy' || d === '1' || d === 'e') difficultyVal = 1;
          else if (d === 'medium' || d === '2' || d === 'm') difficultyVal = 2;
          else if (d === 'hard' || d === '3' || d === 'h') difficultyVal = 3;
        }

        const domainVal = normalizeDomain(rawDomain);
        const skillVal = rawSkill;

        const existingMeta = window.__CB_METADATA__.get(String(id)) || {};
        window.__CB_METADATA__.set(String(id), {
          difficulty: difficultyVal || existingMeta.difficulty || 0,
          domain: domainVal || existingMeta.domain || '',
          skill: skillVal || existingMeta.skill || '',
        });
      }
    }

    // ← KEY FIX: check the TOP-LEVEL object itself before walking into it
    if (!Array.isArray(obj) && looksLikeQuestion(obj)) {
      const mapped = mapQuestion(obj, parentMeta);
      if (mapped && (mapped.questionText || mapped.passageText || mapped.options.length > 0)) {
        window.__CB_QUESTIONS__.set(mapped.id, mapped);
      }
    }

    if (Array.isArray(obj)) {
      for (const item of obj) {
        if (item && typeof item === 'object') {
          if (looksLikeQuestion(item)) {
            const mapped = mapQuestion(item, parentMeta);
            if (mapped && (mapped.questionText || mapped.passageText || mapped.options.length > 0)) {
              window.__CB_QUESTIONS__.set(mapped.id, mapped);
            }
          }
          tryExtract(item, parentMeta);
        }
      }
      return;
    }

    // Capture domain/skill from this object to pass down to children
    const localMeta = {
      domain: (parentMeta && parentMeta.domain) || normalizeDomain(obj.domain || obj.contentDomain || obj.category || ''),
      skill: (parentMeta && parentMeta.skill) || obj.skill || obj.reportingCategory || '',
      difficulty: (parentMeta && parentMeta.difficulty) || 0,
    };

    // Object: walk every value
    for (const [key, val] of Object.entries(obj)) {
      if (!val || typeof val !== 'object') {
        if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
          try { tryExtract(JSON.parse(val), localMeta); } catch (_) {}
        }
        continue;
      }
      if (looksLikeQuestion(val)) {
        const mapped = mapQuestion(val, localMeta);
        if (mapped && (mapped.questionText || mapped.passageText || mapped.options.length > 0)) {
          window.__CB_QUESTIONS__.set(mapped.id, mapped);
        }
      }
      tryExtract(val, localMeta);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Process a captured API response
  // ─────────────────────────────────────────────────────────────────────────────
  function processResponse(url, json, requestMeta) {
    const before = window.__CB_QUESTIONS__.size;
    _visited = new WeakSet();
    // Pull domain/skill/difficulty from URL query params (the filter context)
    const urlMeta = metaFromUrl(url);
    // Merge with request body payload metadata (payload overrides URL query)
    const combinedMeta = {
      domain: requestMeta?.domain || urlMeta.domain || '',
      skill: requestMeta?.skill || urlMeta.skill || '',
      difficulty: requestMeta?.difficulty || urlMeta.difficulty || 0,
    };
    tryExtract(json, combinedMeta);
    const after = window.__CB_QUESTIONS__.size;
    const newCount = after - before;
    if (newCount > 0) {
      console.log(`%c✅ +${newCount} questions captured (total: ${after})`, 'color: #16a34a; font-weight: bold');
    } else {
      const keys = Array.isArray(json) ? `[Array of ${json.length}]` : Object.keys(json).slice(0, 8).join(', ');
      console.log(`%c📦 API response captured. Top keys: ${keys}`, 'color: #f59e0b');
    }
  }

  // Manual helper: call with __CB_RAW_RESPONSES__[i].data to re-extract
  window.extractFrom = function(obj, urlHint, requestMeta) {
    _visited = new WeakSet();
    const before = window.__CB_QUESTIONS__.size;
    const urlMeta = urlHint ? metaFromUrl(urlHint) : {};
    const combinedMeta = {
      domain: requestMeta?.domain || urlMeta.domain || '',
      skill: requestMeta?.skill || urlMeta.skill || '',
      difficulty: requestMeta?.difficulty || urlMeta.difficulty || 0,
    };
    tryExtract(obj, combinedMeta);
    console.log(`Extracted ${window.__CB_QUESTIONS__.size - before} new questions. Total: ${window.__CB_QUESTIONS__.size}`);
  };


  // ─────────────────────────────────────────────────────────────────────────────
  // Intercept fetch()
  // ─────────────────────────────────────────────────────────────────────────────
  if (!window.__CB_FETCH_PATCHED__) {
    window.__CB_FETCH_PATCHED__ = true;
    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
      const url = (typeof args[0] === 'string' ? args[0] : (args[0]?.url ?? ''));
      const options = args[1];
      let requestMeta = {};
      if (options && options.body) {
        requestMeta = metaFromPayload(options.body);
      }
      
      const response = await originalFetch.apply(this, args);
      // Capture everything except static assets
      if (!/\.(js|css|png|jpg|svg|woff|ico)(\?|$)/i.test(url)) {
        try {
          const clone = response.clone();
          const text = await clone.text();
          if (text && (text.trimStart().startsWith('{') || text.trimStart().startsWith('['))) {
            const json = JSON.parse(text);
            window.__CB_RAW_RESPONSES__.push({ url, data: json, requestMeta });
            processResponse(url, json, requestMeta);
          }
        } catch (_) {}
      }
      return response;
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Intercept XMLHttpRequest
  // ─────────────────────────────────────────────────────────────────────────────
  if (!window.__CB_XHR_PATCHED__) {
    window.__CB_XHR_PATCHED__ = true;
    const OrigXHR = window.XMLHttpRequest;
    window.XMLHttpRequest = function () {
      const xhr = new OrigXHR();
      let _url = '';
      let _requestMeta = {};
      
      const origOpen = xhr.open.bind(xhr);
      xhr.open = function (method, url, ...rest) {
        _url = url || '';
        return origOpen(method, url, ...rest);
      };
      
      const origSend = xhr.send.bind(xhr);
      xhr.send = function (body) {
        if (body) {
          _requestMeta = metaFromPayload(body);
        }
        return origSend(body);
      };
      
      xhr.addEventListener('load', function () {
        if (/\.(js|css|png|jpg|svg|woff|ico)(\?|$)/i.test(_url)) return;
        try {
          const text = xhr.responseText;
          if (!text || (!text.trimStart().startsWith('{') && !text.trimStart().startsWith('['))) return;
          const json = JSON.parse(text);
          window.__CB_RAW_RESPONSES__.push({ url: _url, data: json, requestMeta: _requestMeta });
          processResponse(_url, json, _requestMeta);
        } catch (_) {}
      });
      return xhr;
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // React fiber scan (runs immediately + on demand)
  // ─────────────────────────────────────────────────────────────────────────────
  function fiberScan(fiber, depth) {
    if (!fiber || depth > 80) return;
    try {
      // Props
      if (looksLikeQuestion(fiber.memoizedProps)) {
        const m = mapQuestion(fiber.memoizedProps);
        if (m) window.__CB_QUESTIONS__.set(m.id, m);
      }
      // Hooks state
      let hook = fiber.memoizedState;
      let hDepth = 0;
      while (hook && hDepth < 50) {
        const val = hook.memoizedState;
        if (val && typeof val === 'object') tryExtract(val, 0);
        hook = hook.next;
        hDepth++;
      }
    } catch (_) {}
    fiberScan(fiber.child, depth + 1);
    fiberScan(fiber.sibling, depth + 1);
  }

  function doFiberScan() {
    const el = document.getElementById('__next') || document.getElementById('root') || document.body;
    if (!el) return 0;
    const fKey = Object.keys(el).find(k => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance'));
    if (!fKey) return 0;
    const before = window.__CB_QUESTIONS__.size;
    fiberScan(el[fKey], 0);
    return window.__CB_QUESTIONS__.size - before;
  }

  const immediateCount = doFiberScan();
  if (immediateCount > 0) {
    console.log(`%c✅ ${immediateCount} questions found from React state immediately`, 'color: #16a34a; font-weight: bold');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────────────────────
  window.scraperStatus = function () {
    doFiberScan(); // Try fiber again
    const count = window.__CB_QUESTIONS__.size;
    console.log(`%c📊 Scraper Status`, 'color: #2563eb; font-size: 14px; font-weight: bold');
    console.log(`   Questions captured: ${count}`);
    console.log(`   Raw API responses: ${window.__CB_RAW_RESPONSES__.length}`);
    if (count > 0) {
      const sample = Array.from(window.__CB_QUESTIONS__.values())[0];
      console.log(`   Sample question ID: ${sample.id}`);
      console.log(`   Sample options: ${sample.options.length} choices`);
      console.log(`   Sample correctAnswer: ${sample.correctAnswer}`);
    }
  };

  // Show the structure of the last raw response so we can see the CB schema
  window.inspectRaw = function (index) {
    const responses = window.__CB_RAW_RESPONSES__;
    if (responses.length === 0) { console.log('No raw responses yet. Navigate/click "View Questions" first.'); return; }
    const resp = responses[index !== undefined ? index : responses.length - 1];
    console.log(`%cURL: ${resp.url}`, 'color: #6366f1');
    console.log('%cTop-level keys:', 'color: #6366f1', Object.keys(resp.data));
    console.log('%cFull response:', 'color: #6366f1', resp.data);
  };

  // Force re-run extraction on all captured raw responses
  window.reprocess = function () {
    const before = window.__CB_QUESTIONS__.size;
    window.__CB_METADATA__ = new Map(); // Clear and rebuild metadata!
    window.__CB_RAW_RESPONSES__.forEach(r => processResponse(r.url, r.data));
    doFiberScan();
    console.log(`Reprocessed ${window.__CB_RAW_RESPONSES__.length} responses. Questions: ${before} → ${window.__CB_QUESTIONS__.size}`);
  };

  window.downloadQuestions = function () {
    doFiberScan();
    const questions = Array.from(window.__CB_QUESTIONS__.values());
    if (questions.length === 0) {
      console.warn('%c⚠️ No questions captured!', 'color: orange; font-weight: bold');
      console.log(`Raw responses captured: ${window.__CB_RAW_RESPONSES__.length}`);
      console.log("Call inspectRaw() to see what the API is returning, then share it so the mapping can be fixed.");
      return;
    }
    const output = {
      exported_at: new Date().toISOString(),
      source: 'College Board SAT Suite Educator Question Bank',
      count: questions.length,
      questions,
    };
    const blob = new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: `cb_questions_${Date.now()}.json` });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log(`%c✅ Downloaded ${questions.length} questions!`, 'color: green; font-size: 14px; font-weight: bold');
    console.log("Move the file to your project root, then run: node scripts/merge_official.js");
  };

  console.log('%c─────────────────────────────────────────────', 'color: #94a3b8');
  console.log('%c📚 Preplogy CB Scraper v3 Ready!', 'color: #2563eb; font-size: 14px; font-weight: bold');
  console.log('%c• Click "View Questions" to load data', 'color: #64748b');
  console.log('%c• scraperStatus()    → check capture count', 'color: #64748b');
  console.log('%c• inspectRaw()       → see raw API structure', 'color: #64748b');
  console.log('%c• reprocess()        → retry extraction', 'color: #64748b');
  console.log('%c• downloadQuestions() → save JSON file', 'color: #64748b');
  console.log('%c─────────────────────────────────────────────', 'color: #94a3b8');
})();
