import type { AppState } from "./models";
import { createInitialState } from "./seed";
export function normalizeState(value: unknown): AppState {
  const fallback = createInitialState(false);
  if (!value || typeof value !== "object") return createInitialState();
  const saved = value as Partial<AppState>;
  const plans = fallback.plans.map(plan => ({ ...plan, ...(saved.plans?.find(item => item?.week === plan.week) ?? {}) }));
  const rows = fallback.conclusion.rows.map(row => ({ ...row, ...(saved.conclusion?.rows?.find(item => item?.week === row.week) ?? {}) }));
  return {
    ...fallback,
    ...saved,
    version: 1,
    profile: { ...fallback.profile, ...saved.profile },
    internship: { ...fallback.internship, ...saved.internship },
    plans,
    dailyLogs: Array.isArray(saved.dailyLogs) ? saved.dailyLogs.map(log => ({ ...log, tags: Array.isArray(log.tags) ? log.tags : [], files: Array.isArray(log.files) ? log.files : [] })) : [],
    activities: Array.isArray(saved.activities) ? saved.activities.map(activity => ({ ...activity, dailyLogIds: Array.isArray(activity.dailyLogIds) ? activity.dailyLogIds : [], appendixIds: Array.isArray(activity.appendixIds) ? activity.appendixIds : [] })) : [],
    weeklySummaries: Array.isArray(saved.weeklySummaries) ? saved.weeklySummaries : [],
    conclusion: { ...fallback.conclusion, ...saved.conclusion, rows },
    references: Array.isArray(saved.references) ? saved.references : [],
    appendices: Array.isArray(saved.appendices) ? saved.appendices : [],
    settings: { ...fallback.settings, ...saved.settings },
  };
}

export function resetState(withDemo = false) { return createInitialState(withDemo); }
