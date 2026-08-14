import InternshipApp, { type View } from "../../components/internship-app";
const views: Record<string, View> = { "nhat-ky": "logs", "ke-hoach": "plan", "hoat-dong": "activities", "ket-luan": "conclusion", "tai-lieu-tham-khao": "references", "phu-luc": "appendices", "xem-truoc": "preview", "kiem-tra": "compliance", "cai-dat": "settings" };
export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) { const { section } = await params; return <InternshipApp view={views[section] ?? "dashboard"} />; }
