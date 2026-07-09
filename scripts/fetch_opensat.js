import fs from 'fs';
import path from 'path';

// URL to an open-source JSON dump of the College Board SAT Question Bank
const OPENSAT_URL = 'https://api.jsonsilo.com/public/942c3c3b-3a0c-4be3-81c2-12029def19f5';
const OUTPUT_FILE = path.resolve(process.cwd(), '../src/data/questions.json');

async function scrapeQuestions() {
  console.log('Fetching questions from OpenSAT JSON database...');
  try {
    const res = await fetch(OPENSAT_URL);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const data = await res.json();
    
    const formattedQuestions = [];

    // Process Math questions
    if (data.math && Array.isArray(data.math)) {
      data.math.forEach(q => {
        formattedQuestions.push(formatQuestion(q, "Math"));
      });
    }

    // Process Reading and Writing questions
    if (data.english && Array.isArray(data.english)) {
      data.english.forEach(q => {
        formattedQuestions.push(formatQuestion(q, "Reading and Writing"));
      });
    }

    // Write to file
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(formattedQuestions, null, 2));
    console.log(`Successfully scraped and formatted ${formattedQuestions.length} questions.`);
    console.log(`Saved to ${OUTPUT_FILE}`);

  } catch (err) {
    console.error('Failed to fetch/process questions:', err);
  }
}

function formatQuestion(raw, section) {
  const qData = raw.question || {};
  let questionText = qData.question || "";
  let passageText = "";
  if (qData.paragraph && qData.paragraph !== "null") {
    passageText = qData.paragraph;
  }
  
  // Format choices
  const isMultipleChoice = qData.choices && qData.choices !== "null" && Object.keys(qData.choices).length > 0;
  let options = [];
  if (isMultipleChoice) {
    for (const [key, value] of Object.entries(qData.choices)) {
      options.push({ id: key, text: value });
    }
  }
  
  // Map difficulty
  let difficulty = 2;
  if (raw.difficulty === "Easy") difficulty = 1;
  else if (raw.difficulty === "Hard") difficulty = 3;
  
  return {
    id: raw.id || Math.random().toString(36).substring(7),
    section: section,
    domain: raw.domain || "General",
    skill: raw.skill || raw.domain || "General",
    difficulty: difficulty,
    passageText: passageText,
    questionText: questionText,
    options: options,
    correctAnswer: qData.correct_answer || "",
    rationale: qData.explanation || "No explanation provided.",
    tags: [raw.id, section]
  };
}

scrapeQuestions();
