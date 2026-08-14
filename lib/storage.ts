import type { AppState } from "./models";
import { createInitialState } from "./seed";
const KEY = "ueh-internship-journal:v1";
export function loadState(): AppState { if (typeof window === "undefined") return createInitialState(); try { const saved = localStorage.getItem(KEY); return saved ? JSON.parse(saved) : createInitialState(); } catch { return createInitialState(); } }
export function saveState(state: AppState) { localStorage.setItem(KEY, JSON.stringify(state)); }
export function resetState(withDemo = false) { const next = createInitialState(withDemo); saveState(next); return next; }
