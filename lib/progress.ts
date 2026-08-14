import type { AppState } from "./models";

export type ComplianceStatus = "Đạt" | "Chưa đạt" | "Cần kiểm tra";
export interface ComplianceItem { label: string; status: ComplianceStatus; }

const words = (value: string) => value.trim() ? value.trim().split(/\s+/u).length : 0;
const pages = (value: string) => {
  const count = words(value);
  return count === 0 ? 0 : Math.max(1, Math.ceil(count / 500));
};
const join = (values: unknown[]) => values.filter(value => typeof value === "string" && value.trim()).join(" ");

export function getProgress(state: AppState) {
  const planText = state.plans.map(plan => join([plan.workContent, plan.target, plan.method, plan.supportRequired, plan.expectedResult])).join(" ");
  const logText = state.dailyLogs.map(log => join([log.title, log.assignedWork, log.actionsTaken, log.relatedDocuments, log.tools, log.appliedKnowledge, log.result, log.difficulties, log.resolution, log.lessonsLearned, log.additionalNotes])).join(" ");
  const activityText = state.activities.map(activity => join([activity.name, activity.objective, activity.actualProcess, activity.companyProcedures, activity.workingPapers, activity.recordsUsed, activity.recordStorage, activity.directSteps, activity.result, activity.difficulties, activity.resolution, activity.knowledgeAndSkills])).join(" ");
  const conclusionText = join([state.conclusion.completedWork, state.conclusion.professionalKnowledge, state.conclusion.developedSkills, state.conclusion.lessons, state.conclusion.personalLimitations, state.conclusion.personalChanges, state.conclusion.internshipValue, state.conclusion.finalConclusion, ...state.conclusion.rows.flatMap(row => [row.actualTarget, row.actualWork, row.limitations, row.correctiveSolution, row.solutionExecution])]);
  const planComplete = state.plans.filter(plan => plan.workContent.trim() && plan.target.trim()).length;
  const conclusionFields = [state.conclusion.completedWork, state.conclusion.professionalKnowledge, state.conclusion.developedSkills, state.conclusion.lessons, state.conclusion.personalLimitations, state.conclusion.personalChanges, state.conclusion.internshipValue, state.conclusion.finalConclusion].filter(value => value.trim()).length;
  const part1Pages = pages(planText);
  const part2Pages = pages(`${logText} ${activityText}`);
  const part3Pages = pages(conclusionText);
  const totalPages = part1Pages + part2Pages + part3Pages;
  const overall = Math.round(Math.min(100, planComplete / 12 * 30 + Math.min(3, state.activities.length) / 3 * 40 + conclusionFields / 8 * 30));
  return { planComplete, conclusionFields, part1Pages, part2Pages, part3Pages, totalPages, overall };
}

export function getComplianceItems(state: AppState): ComplianceItem[] {
  const progress = getProgress(state);
  const hasSummary = state.conclusion.rows.some(row => row.actualTarget.trim() || row.actualWork.trim());
  const hasConclusion = Boolean(state.conclusion.lessons.trim() && state.conclusion.finalConclusion.trim());
  return [
    { label: "Nội dung chính ≥ 20 trang", status: progress.totalPages >= 20 ? "Đạt" : "Chưa đạt" },
    { label: "Phần 2 ≥ 10 trang", status: progress.part2Pages >= 10 ? "Đạt" : "Chưa đạt" },
    { label: "Có ≥ 3 hoạt động chính", status: state.activities.length >= 3 ? "Đạt" : "Chưa đạt" },
    { label: "Phần 3 ≥ 5 trang", status: progress.part3Pages >= 5 ? "Đạt" : "Chưa đạt" },
    { label: "Có kế hoạch thực tập", status: progress.planComplete === 12 ? "Đạt" : "Chưa đạt" },
    { label: "Có bảng tổng kết thực tập", status: hasSummary ? "Đạt" : "Chưa đạt" },
    { label: "Có kết luận và bài học kinh nghiệm", status: hasConclusion ? "Đạt" : "Chưa đạt" },
    { label: "Có trang bìa", status: "Cần kiểm tra" },
    { label: "Có mục lục", status: "Cần kiểm tra" },
    { label: "Có danh mục từ viết tắt", status: "Cần kiểm tra" },
    { label: "Có tài liệu tham khảo nếu sử dụng nguồn", status: state.references.length ? "Đạt" : "Cần kiểm tra" },
    { label: "Có phụ lục nếu có minh chứng", status: state.appendices.length ? "Đạt" : "Cần kiểm tra" },
  ];
}
