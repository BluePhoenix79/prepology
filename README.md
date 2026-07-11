# Prepology — Premium SAT Prep Platform

Prepology is a comprehensive, high-fidelity SAT prep platform designed to help students master both the Reading & Writing and Mathematics sections of the digital SAT. Built as a fast, client-side single-page application using Vanilla TypeScript, CSS, and LocalStorage, it combines a flexible practice dashboard with a full-featured test session engine and a deep performance analytics suite.

---

## 🚀 Key Features

### 1. Dynamic Practice Engine (Dashboard)
- **Practice Drills & Official Questions**: Separate tabs for customized drills vs. official College Board question pools.
- **Granular Controls**: Filter questions instantly by section, difficulty level, domain, and specific skill.
- **Missed Only Mode**: Automatically isolates questions you've previously gotten wrong so you can target weak areas.
- **Randomized Practice**: Toggle dynamic random ordering of questions in practice sessions.

### 2. Advanced Test Session View
- **Relocated Central Timer**: Positioned in the middle of the navigation header. Includes a circular Pause control and Hide toggle.
  - **Smart Pause**: Pausing the timer freezes the clock and blurs the workspace with a glassmorphic pause card, preventing reading questions while the clock is stopped.
  - **Timer Hide**: Toggles the visibility of the timer (`—:—`) to simulate high-pressure testing conditions without visual distractions.
- **Custom Difficulty Overrides**: In the top-left header of diagnostic/legacy questions (originally missing difficulty tags), select your own rating (Easy, Medium, Hard). Ratings save instantly to `localStorage` and override the question bank dynamically.
- **Active Navigation Drawer**: Slide open a question grid map to view status flags (answered, unanswered, flagged) and jump between questions instantly.
- **Interactive Controls**: Supports keyboard shortcuts (`A`/`B`/`C`/`D` to select, `Enter` to check/advance), option elimination markers, bookmarks, and detailed step-by-step explanations.

### 3. Beautiful Performance & Analytics Dashboard
*A premium performance reporting center matching the dark glassmorphic design system.*
- **Core Statistics**: Track total questions attempted, overall accuracy %, bookmarked saves, and consecutive streak logs.
- **Activity Trend Chart**: A weekly stacked bar graph visualizing correct (green) and incorrect (red) answers, segmented and colored by question difficulty (darker = harder).
- **Study Time Donuts**: Conic-gradient rings showing section splits (English vs. Math) and activity splits (Questions vs. Practice Tests).
- **Point-Costing Topics Table**: Auto-identifies the top 5 areas costing you points, showing accuracy meters and quick-launch practice buttons.
- **Mastery Sliders**: Track accuracy progress bars across all English and Math domain areas (e.g., Algebra, Advanced Math, Standard English Conventions).
- **Time Share Rings**: Dynamic conic-gradient rings indicating average seconds spent per difficulty level for English and Math side-by-side.
- **Practice Activity Calendar**: A GitHub-style contribution calendar mapping daily practice intensities from February to July 2026.

### 4. Rich Mathematical Rendering
- Built-in **MathJax v3** integration compiles mathematical formulas and LaTeX expressions on-the-fly in passages, questions, and rationales.

---

## 🛠️ Tech Stack
- **Bundler / Dev Server**: [Vite](https://vite.dev/)
- **Core Engine**: Vanilla TypeScript
- **Styling**: Modern CSS (Custom Design Tokens, Glassmorphism, Responsive Grid System)
- **Math Engine**: MathJax CDN Integration
- **Storage**: LocalStorage API (Automatic State Serialization & Fallback Migrations)

---

## 📁 Project Structure

```
prepology/
├── index.html                  # Main SPA entry page
├── package.json                # Project configurations & scripts
├── tsconfig.json               # TypeScript compiler options
├── scripts/                    # Web scrapers and data-processing tools
│   ├── scrape_cb_qb.js         # Scrapes official questions from College Board
│   └── merge_official.js       # Merges and sanitizes raw question sets
└── src/
    ├── main.ts                 # App initialization, routing & shell layout
    ├── types.ts                # TypeScript interfaces (Question, Stats, Session)
    ├── data/
    │   └── questions.json      # Complete database of SAT questions
    ├── state/
    │   └── Store.ts            # Centralized AppState & LocalStorage synchronization
    ├── styles/
    │   └── main.css            # Custom theme variables, layout rules, and keyframes
    ├── utils/
    │   ├── rendering.ts        # LaTeX formatting and MathJax typesetting utility
    │   └── scoring.ts          # Score estimations for Reading and Math
    └── views/
        ├── Dashboard.ts        # Home dashboard with skill grids and practice hero
        ├── TestSession.ts      # Active practice session UI with header controls & timer
        ├── Analytics.ts        # Dynamic charts, mastery progress, and calendars
        ├── Review.ts           # Mistakes logs
        └── Saved.ts            # Saved/bookmarked questions library
```

---

## 🚦 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Development Server
```bash
npm run dev
```
Open the local address printed in your terminal (typically `http://localhost:5173`).

### 3. Build for Production
```bash
npm run build
```
Generates clean, static, production-ready assets inside the `dist/` directory.

---

## 💾 Storage Schema (LocalStorage)
Prepology uses two primary keys in `localStorage` to preserve progress:
- `prepology_state`: Stores user settings, difficulty overrides, mistakes log, and full solve history.
- `prepology_vocab_bookmarks`: Tracks flagged vocabulary cards.

*Note: Stored state from previous versions (`preplogy_`) is automatically detected and migrated on start.*

---

## 📝 Future Roadmap & Todo List

Here is a roadmap of features planned for the future evolution of Prepology:

### 🌟 Core Planned Features
- [ ] **Online log-in and account creation**: Allow users to register, sign in, secure their accounts with email/password or OAuth, and customize their profiles.
- [ ] **Cloud data storage**: Transition from pure client-side `localStorage` to a centralized cloud database (e.g., Firebase or Supabase) to securely save progress, custom difficulty settings, mistakes, and history.
- [ ] **Public hosting and deployment**: Host the web application on a public platform (e.g., Vercel, Netlify, or AWS) so users can access Prepology from any device.
- [ ] **Automatic & curated practice test creation**: Add a module that dynamically generates full-length, adaptive SAT mock exams using historical weighting and official subscore rules.

### 💡 Advanced Feature Ideas
- [ ] **Interactive AI Rationale Tutor**: Integrate a large language model (LLM) agent that students can chat with on any question to get customized, interactive hints rather than reading the plain-text answer key.
- [ ] **Spaced Repetition System (SRS) for Vocabulary**: Enhance the "Vocab Cards" tab by introducing a Leitner-system queue that resurfaces card reviews at mathematically optimized intervals.
- [ ] **Gamification & Badges**: Introduce experience points (XP), daily streak milestones, achievement badges, and level-ups to drive long-term engagement.
- [ ] **Interactive Score Analytics Graphing**: Enhance the Analytics tab with interactive line-charts tracking estimated SAT math & reading scores across time, offering projection modeling.
- [ ] **PDF Worksheet Export**: Enable users to export custom-filtered question pools or their mistakes list as formatted PDF worksheets with answer keys for offline paper-and-pencil practice.
- [ ] **Peer Challenge Arena**: Introduce a real-time multiplayer "challenge mode" where friends can compete in small, timed mini-tests to solve questions correctly.
- [ ] **Progressive Web App (PWA) Support**: Enable complete offline caching so students can continue practicing or studying vocabulary without an active internet connection.
