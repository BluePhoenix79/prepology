import type { Question } from '../types';

const DB_NAME = 'prepology_cache';
const DB_VERSION = 1;
const STORE_NAME = 'questions_store';
const CACHE_KEY = 'question_bank_v3';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getCachedQuestions(): Promise<Question[] | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(CACHE_KEY);
      req.onsuccess = () => {
        const result = req.result;
        if (result && Array.isArray(result.data) && result.data.length > 0) {
          resolve(result.data);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch (e) {
    console.warn('Failed to read questions from IndexedDB cache:', e);
    return null;
  }
}

export async function setCachedQuestions(questions: Question[]): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const record = {
        data: questions,
        timestamp: Date.now()
      };
      const req = store.put(record, CACHE_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('Failed to save questions to IndexedDB cache:', e);
  }
}
