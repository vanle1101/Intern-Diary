export type Id = string;
export interface Profile { id: Id; fullName: string; studentId: string; university: string; faculty: string; major: string; className: string; }
export interface Internship { id: Id; profileId: Id; organization: string; position: string; supervisor: string; startDate: string; endDate: string; totalWeeks: number; type: "graduation_internship"; }
export interface InternshipPlan { id: Id; internshipId: Id; week: number; workContent: string; target: string; method: string; supportRequired: string; expectedResult: string; }
export interface FileReference { id: Id; name: string; type: string; size?: number; localUrl?: string; }
export interface DailyLog { id: Id; internshipId: Id; date: string; week: number; title: string; assignedWork: string; actionsTaken: string; relatedDocuments: string; tools: string; appliedKnowledge: string; result: string; difficulties: string; resolution: string; lessonsLearned: string; additionalNotes: string; workType: string; tags: string[]; files: FileReference[]; sensitive: boolean; createdAt: string; updatedAt: string; }
export interface Activity { id: Id; internshipId: Id; name: string; startDate: string; endDate: string; dailyLogIds: Id[]; objective: string; method: "Trải nghiệm thực tế" | "Tự nghiên cứu và đúc kết" | "Phương pháp khác"; actualProcess: string; companyProcedures: string; workingPapers: string; recordsUsed: string; recordStorage: string; directSteps: string; result: string; difficulties: string; resolution: string; knowledgeAndSkills: string; appendixIds: Id[]; sensitive: boolean; createdAt: string; updatedAt: string; }
export interface ActivityDailyLog { activityId: Id; dailyLogId: Id; }
export interface WeeklySummary { id: Id; internshipId: Id; week: number; dailyLogIds: Id[]; content: string; aiDraft?: string; approved: boolean; }
export interface ConclusionRow { week: number; plannedTarget: string; actualTarget: string; plannedWork: string; actualWork: string; limitations: string; correctiveSolution: string; solutionExecution: string; }
export interface Conclusion { id: Id; internshipId: Id; rows: ConclusionRow[]; completedWork: string; professionalKnowledge: string; developedSkills: string; lessons: string; personalLimitations: string; personalChanges: string; internshipValue: string; finalConclusion: string; updatedAt: string; }
export interface Reference { id: Id; author: string; year: string; title: string; source: string; url: string; accessedDate: string; }
export interface Appendix { id: Id; name: string; description: string; activityId?: Id; files: FileReference[]; sensitive: boolean; }
export interface Settings { theme: "light" | "dark" | "system"; autosave: boolean; aiConsentRequired: boolean; defaultAnonymization: boolean; }
export interface AppState { version: 1; profile: Profile; internship: Internship; plans: InternshipPlan[]; dailyLogs: DailyLog[]; activities: Activity[]; weeklySummaries: WeeklySummary[]; conclusion: Conclusion; references: Reference[]; appendices: Appendix[]; settings: Settings; }

