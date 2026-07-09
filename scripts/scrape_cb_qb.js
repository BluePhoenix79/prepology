        if (!obj || typeof obj !== 'object') return;
        if (Array.isArray(obj)) {
          for (const item of obj) {
            if (item && item.questionId && item.answerChoices) {
              results.push(item);
            } else {
              extractQuestions(item);
            }
          }
        } else {
          for (const val of Object.values(obj)) {
            extractQuestions(val);
          }
        }
      }
      extractQuestions(data);
    } catch(e) { console.error('__NEXT_DATA__ extraction failed:', e); }
  }
  
  // Try method 2: React Fiber (works on most React apps)
  function getFiberFromDOM(el) {
    const key = Object.keys(el).find(k => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance'));
    return key ? el[key] : null;
  }
  
  function extractPropsFromFiber(fiber, depth = 0) {
    if (!fiber || depth > 50) return;
    const props = fiber.memoizedProps;
    if (props) {
      // Look for question data shapes
      if (props.questionId && props.stem) {
        results.push({
          questionId: props.questionId,
          stem: props.stem,
          answerChoices: props.answerChoices,
          correctAnswer: props.correctAnswer,
          rationale: props.rationale,
          domain: props.domain,
          skill: props.skill,
          difficulty: props.difficulty,
          section: props.section
        });
      }
    }
    extractPropsFromFiber(fiber.child, depth + 1);
    extractPropsFromFiber(fiber.sibling, depth + 1);
  }
  
  const rootEl = document.getElementById('__next') || document.getElementById('root') || document.body;
  const rootFiber = getFiberFromDOM(rootEl);
  if (rootFiber) {
    console.log('Found React Fiber root. Extracting question props...');
    extractPropsFromFiber(rootFiber);
  }
  
  // Try method 3: Intercept XHR/fetch calls that return question data
  // (Already happened by page load time, so check XHR response cache via performance entries)
  console.log(`Found ${results.length} questions via React. Attempting network interception next...`);
  
  // Try method 4: Look for questions in window or global vars
  const globalKeys = Object.keys(window).filter(k => 
    k.toLowerCase().includes('question') || k.toLowerCase().includes('bank')
  );
  if (globalKeys.length) {
    console.log('Found potential question globals:', globalKeys);
  }
  
  // Convert to our schema
  function mapToSchema(raw) {
    return {
      id: raw.questionId || raw.id || `Q${Math.random().toString(36).substr(2,6)}`,
      section: (raw.section || '').includes('Math') ? 'Math' : 'Reading and Writing',
      domain: raw.domain || raw.primaryClassification?.domain || 'Unknown',
      skill: raw.skill || raw.primaryClassification?.skill || 'Unknown',
      difficulty: typeof raw.difficulty === 'number' ? raw.difficulty : 
                  (raw.difficulty === 'easy' ? 1 : raw.difficulty === 'medium' ? 2 : 3),
      passageText: raw.stimulus || raw.passage || raw.context || null,
      questionText: raw.stem || raw.questionText || raw.question || '',
      options: Array.isArray(raw.answerChoices)
        ? raw.answerChoices.map((c, i) => ({ id: c.id || String.fromCharCode(65+i), text: c.content || c.text || c }))
        : [],
      correctAnswer: raw.correctAnswer || raw.answer || '',
      rationale: raw.rationale || raw.explanation || '',
      tags: [raw.domain, raw.skill].filter(Boolean)
    };
  }
  
  const mapped = results.map(mapToSchema).filter(q => q.questionText && q.options.length > 0);
  
  if (mapped.length === 0) {
    console.warn('No questions found automatically. The CB site may require authentication or uses a different data structure. Try the manual instructions below.');
    console.log(`
MANUAL METHOD:
1. Go to: https://satsuite.collegeboard.org/digital/digital-practice-preparation/question-bank
2. Use filters to select a domain/skill
3. Open Network tab in DevTools
4. Click "View Questions" 
5. Look for a fetch/XHR request to an API endpoint (like /api/questions or similar)
6. Copy the response JSON
7. Use our parse script to map it: node scripts/parse_qb.js <your-file.json>
    `);
    return;
  }
  
  // Download as JSON
  const blob = new Blob([JSON.stringify(mapped, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'questions.json';
  a.click();
  URL.revokeObjectURL(url);
  console.log(`✅ Downloaded ${mapped.length} questions as questions.json`);
  console.log('Place this file at: src/data/questions.json and restart the dev server.');
})();
