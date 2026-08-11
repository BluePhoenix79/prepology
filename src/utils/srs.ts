/**
 * Leitner-box spaced repetition scheduling for vocabulary cards.
 *
 * A card lives in a numbered box. Recalling it promotes it one box and pushes
 * the next review further out; forgetting it drops it back to box 1. The box
 * intervals widen geometrically so well-known words stop consuming review time.
 *
 * Scheduling here is pure — persistence is the small load/save pair at the
 * bottom, so the maths can be reasoned about (and tested) on its own.
 */

const STORAGE_KEY = 'prepology_vocab_srs';
const LEGACY_LEARNED_KEY = 'prepology_vocab_learned';

/** Days until the next review, indexed by box - 1. */
export const BOX_INTERVALS_DAYS = [0, 1, 3, 7, 14, 30];
export const MAX_BOX = BOX_INTERVALS_DAYS.length;

const DAY_MS = 24 * 60 * 60 * 1000;
/** A lapsed card comes back later in the same sitting, not immediately. */
const RELEARN_DELAY_MS = 60 * 1000;

export interface CardState {
  box: number;          // 1 .. MAX_BOX
  due: number;          // epoch ms; review is due when due <= now
  lastReviewed: number; // epoch ms, 0 if never
  reps: number;         // total successful recalls
  lapses: number;       // times forgotten after being learned
}

export type SrsStore = Record<string, CardState>;

export function newCard(): CardState {
  return { box: 1, due: 0, lastReviewed: 0, reps: 0, lapses: 0 };
}

/** A card is "new" when it has never been reviewed. */
export function isNew(card: CardState): boolean {
  return card.lastReviewed === 0;
}

/** Reaching the final box means the word is considered mastered. */
export function isMastered(card: CardState): boolean {
  return card.box >= MAX_BOX && !isNew(card);
}

export function isDue(card: CardState, now: number = Date.now()): boolean {
  return !isNew(card) && card.due <= now;
}

/** Milliseconds a card in `box` waits before its next review. */
export function intervalMs(box: number): number {
  const clamped = Math.min(Math.max(box, 1), MAX_BOX);
  return BOX_INTERVALS_DAYS[clamped - 1] * DAY_MS;
}

/**
 * Apply a review outcome. Returns a new state; does not mutate the input.
 * `recalled` false sends the card back to box 1 and counts a lapse.
 */
export function review(card: CardState, recalled: boolean, now: number = Date.now()): CardState {
  if (!recalled) {
    return {
      box: 1,
      due: now + RELEARN_DELAY_MS,
      lastReviewed: now,
      reps: card.reps,
      lapses: card.lapses + (isNew(card) ? 0 : 1),
    };
  }
  const box = Math.min(card.box + 1, MAX_BOX);
  return {
    box,
    due: now + intervalMs(box),
    lastReviewed: now,
    reps: card.reps + 1,
    lapses: card.lapses,
  };
}

/** Human-readable gap until the next review of a card in `box`. */
export function formatInterval(box: number): string {
  const days = BOX_INTERVALS_DAYS[Math.min(Math.max(box, 1), MAX_BOX) - 1];
  if (days === 0) return 'soon';
  if (days === 1) return '1 day';
  return `${days} days`;
}

/** Short relative description of when a card next comes up. */
export function formatDue(due: number, now: number = Date.now()): string {
  const delta = due - now;
  if (delta <= 0) return 'now';
  const days = Math.ceil(delta / DAY_MS);
  if (days <= 1) {
    const hours = Math.ceil(delta / (60 * 60 * 1000));
    return hours <= 1 ? 'under an hour' : `${hours} hours`;
  }
  return `${days} days`;
}

export interface DeckStats {
  total: number;
  due: number;
  fresh: number;      // never reviewed
  learning: number;   // seen, not yet mastered
  mastered: number;
  boxCounts: number[]; // length MAX_BOX, index 0 = box 1
  nextDue: number | null;
}

export function deckStats(words: string[], store: SrsStore, now: number = Date.now()): DeckStats {
  const boxCounts = new Array(MAX_BOX).fill(0);
  let due = 0, fresh = 0, learning = 0, mastered = 0;
  let nextDue: number | null = null;

  for (const word of words) {
    const card = store[word] || newCard();
    boxCounts[Math.min(card.box, MAX_BOX) - 1]++;

    if (isNew(card)) {
      fresh++;
    } else if (isMastered(card)) {
      mastered++;
    } else {
      learning++;
    }

    if (isDue(card, now)) {
      due++;
    } else if (!isNew(card) && (nextDue === null || card.due < nextDue)) {
      nextDue = card.due;
    }
  }

  return { total: words.length, due, fresh, learning, mastered, boxCounts, nextDue };
}

/**
 * The review queue: everything currently due, soonest first, then new words to
 * introduce. `newLimit` caps how many unseen words enter one sitting so a fresh
 * deck doesn't dump all of them at once.
 */
export function buildQueue(
  words: string[],
  store: SrsStore,
  now: number = Date.now(),
  newLimit: number = 10,
): string[] {
  const due: Array<{ word: string; at: number }> = [];
  const fresh: string[] = [];

  for (const word of words) {
    const card = store[word] || newCard();
    if (isNew(card)) fresh.push(word);
    else if (isDue(card, now)) due.push({ word, at: card.due });
  }

  due.sort((a, b) => a.at - b.at);
  return [...due.map(d => d.word), ...fresh.slice(0, newLimit)];
}

/* ── Persistence ───────────────────────────────────────────── */

export function loadSrs(): SrsStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as SrsStore;
  } catch {
    /* corrupt payload — fall through to a clean store */
  }
  return {};
}

export function saveSrs(store: SrsStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* quota or private mode — scheduling still works for this session */
  }
}

/**
 * Words previously flagged with the old "learned" toggle start partway up the
 * ladder instead of being re-taught from box 1.
 */
export function migrateLegacyLearned(store: SrsStore, now: number = Date.now()): SrsStore {
  let legacy: string[] = [];
  try {
    const raw = localStorage.getItem(LEGACY_LEARNED_KEY);
    legacy = raw ? JSON.parse(raw) : [];
  } catch {
    return store;
  }
  if (!Array.isArray(legacy) || legacy.length === 0) return store;

  let changed = false;
  for (const word of legacy) {
    if (typeof word !== 'string' || store[word]) continue;
    const box = 4;
    store[word] = { box, due: now + intervalMs(box), lastReviewed: now, reps: 1, lapses: 0 };
    changed = true;
  }
  if (changed) saveSrs(store);
  return store;
}
