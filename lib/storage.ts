import type { AppState } from "./models";
import { createInitialState } from "./seed";
function scheduleWeeks(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00`).getTime(), end = new Date(`${endDate}T00:00:00`).getTime();
  return startDate && endDate && end >= start ? Math.max(1, Math.ceil((end - start + 86400000) / 604800000)) : 12;
}
export function normalizeState(value: unknown): AppState {
  const fallback = createInitialState(false);
  if (!value || typeof value !== "object") return createInitialState();
  const saved = value as Partial<AppState>;
  const plans = fallback.plans.map(plan => ({ ...plan, ...(saved.plans?.find(item => item?.week === plan.week) ?? {}) }));
  const rows = fallback.conclusion.rows.map(row => ({ ...row, ...(saved.conclusion?.rows?.find(item => item?.week === row.week) ?? {}) }));
  const internship = { ...fallback.internship, ...saved.internship };
  internship.totalWeeks = scheduleWeeks(internship.startDate, internship.endDate);
  return {
    ...fallback,
    ...saved,
    version: 1,
    profile: { ...fallback.profile, ...saved.profile },
    internship,
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

export function removeUntouchedDemoData(state: AppState): AppState | null {
  const demoLogs = state.dailyLogs.length === 4 && state.dailyLogs.every(log => log.additionalNotes === "Dữ liệu minh hoạ — có thể xoá trong Cài đặt.");
  if (!demoLogs) return null;
  const clean = createInitialState(false);
  return {
    ...clean,
    profile: {
      ...state.profile,
      fullName: state.profile.fullName === "Sinh viên UEH" ? "" : state.profile.fullName,
    },
    internship: {
      ...clean.internship,
      profileId: state.profile.id,
      organization: state.internship.organization === "Đơn vị thực tập" ? "" : state.internship.organization,
      topicName: state.internship.topicName,
      position: state.internship.position,
      supervisor: state.internship.supervisor,
      startDate: state.internship.startDate === "2026-01-05" ? "" : state.internship.startDate,
      endDate: state.internship.endDate === "2026-03-27" ? "" : state.internship.endDate,
    },
  };
}
