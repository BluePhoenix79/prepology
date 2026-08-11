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

## 🔐 Google Sign-In Setup

Sign-in is optional. With no client ID configured the app behaves exactly as before and the UI says so instead of showing a button that cannot work.

1. Create an **OAuth 2.0 Client ID** (type *Web application*) at [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials).
2. Under **Authorised JavaScript origins**, add every origin you serve from, e.g. `http://localhost:5173` and your deployed domain. Google Identity Services uses origins, not redirect URIs.
3. Copy `.env.example` to `.env.local` and set the value:
   ```
   VITE_GOOGLE_CLIENT_ID=your-id.apps.googleusercontent.com
   ```

The client ID is a public value — this flow has no client secret, so it is safe in the bundle.

> **Scope of this feature.** Prepology is a static app with no backend, so the Google ID token is decoded in the browser and **not verified** against Google's keys. The identity labels the profile and namespaces locally-stored progress; it is not an authorisation boundary and grants access to nothing. Progress still lives only in this browser — cloud sync remains on the roadmap, and that is the point at which tokens must be verified server-side.

---

## 💾 Storage Schema (LocalStorage)
Prepology uses these keys in `localStorage` to preserve progress:
- `prepology_state`: Stores user settings, difficulty overrides, mistakes log, and full solve history.
- `prepology_vocab_bookmarks`: Tracks flagged vocabulary cards.
- `prepology_auth`: The signed-in Google profile, when sign-in is configured and used.

*Note: Stored state from previous versions (`preplogy_`) is automatically detected and migrated on start.*

*When signed in, per-account keys are suffixed with `__u_<google-account-id>` so several people can share a browser without seeing each other's progress. Signing in for the first time carries any existing anonymous progress into the new account.*

---

## 📝 Future Roadmap & Todo List

Here is a roadmap of features planned for the future evolution of Prepology:

### 🌟 Core Planned Features
- [x] **Online log-in and account creation**: Google OAuth sign-in via Google Identity Services, with progress kept separately per account on the device. See [Google sign-in](#-google-sign-in-setup). *(Client-side only — cloud sync is still open, below.)*
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

---

## 🕷️ OnePrep Scrape Plan & Architecture

To support scaling Prepology with thousands of high-fidelity SAT practice questions, the following architecture is proposed to build an automated scraper targeting the official College Board Question Bank (referred to as **OnePrep**).

### 1. Target Data Architecture
The scraped dataset should resolve to the standard `Question` schema defined in `src/types.ts`:
- **Unique Identification**: Stable UUID hashes based on College Board API question IDs.
- **Hierarchical Taxonomies**: Map scraped domain names to standard digital SAT groups (e.g., Algebra, Craft and Structure).
- **Text Formats**: Sanitized LaTeX/MathJax mathematical formulas.
- **Passage Links**: Connect complex stimulus reading passages correctly to their target questions.

### 2. Scraping Flow & Network Protocol
College Board's official question bank is accessed via a JSON API. We can bypass heavy headless browsers in favor of fast HTTP requests:
1. **Discovery Request**: Send a `POST` request to the search endpoint `/questionbank/search` to retrieve a list of all question metadata, IDs, and domain mappings.
2. **Batch Retrieval**: Loop through discovered IDs, issuing concurrent requests to the detail API `/questionbank/question/{id}` to fetch complete HTML bodies, rationale texts, and option lists.
3. **Asset Mirroring**: Parse image URLs (e.g., base64 PNGs and SVG assets) and download them to `/public/assets/` to ensure offline availability.

### 3. Sanitization & Normalization Pipeline
1. **Passage Merging**: Identify duplicate passage strings and reference them by a single ID to minimize bundle size.
2. **Text Cleaning**: Strip redundant HTML wrappers, normalize non-breaking spaces, and convert raw Unicode math symbols to standard LaTeX strings (e.g., `\sqrt{x}`).
3. **Blank Replacements**: Detect missing text underscores in Reading & Writing questions, inserting standardized `_____` blanks.
4. **Answer Key Extraction**: Map option letters (`A`, `B`, `C`, `D`) to their respective keys, recovering grid-in (SPR) numerical values.
