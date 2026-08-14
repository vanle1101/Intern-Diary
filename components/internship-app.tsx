"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Activity, AppState, Conclusion, DailyLog, InternshipPlan } from "../lib/models";
import { getComplianceItems, getProgress } from "../lib/progress";
import { resetState } from "../lib/storage";

export type View = "dashboard" | "logs" | "plan" | "activities" | "conclusion" | "compliance" | "settings";
const nav: { view: View; href: string; label: string; icon: string }[] = [
  { view: "dashboard", href: "/", label: "Tổng quan", icon: "⌂" }, { view: "logs", href: "/nhat-ky", label: "Nhật ký hằng ngày", icon: "✎" },
  { view: "plan", href: "/ke-hoach", label: "Kế hoạch thực tập", icon: "▦" }, { view: "activities", href: "/hoat-dong", label: "Hoạt động chính", icon: "◇" },
  { view: "conclusion", href: "/ket-luan", label: "Kết luận", icon: "✓" }, { view: "compliance", href: "/kiem-tra", label: "Kiểm tra yêu cầu", icon: "☑" },
  { view: "settings", href: "/cai-dat", label: "Cài đặt", icon: "⚙" },
];
const uid = () => crypto.randomUUID(), iso = () => new Date().toISOString(), today = () => new Date().toISOString().slice(0, 10);
type SaveStatus = "loading" | "locked" | "saving" | "saved" | "error";
type AuthMode = "login" | "register";
type CurrentUser = { id: string; username: string; fullName: string };
let memoryState: AppState | null = null;
let memoryUser: CurrentUser | null = null;

async function requestCloudState() {
  const response = await fetch("/api/state", { cache: "no-store" });
  const data = await response.json() as { state?: AppState; error?: string };
  if (!response.ok || !data.state) throw new Error(data.error || "Không thể mở dữ liệu.");
  return data.state;
}

async function persistCloudState(state: AppState) {
  const response = await fetch("/api/state", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ state }),
  });
  const data = await response.json() as { error?: string };
  if (!response.ok) throw new Error(data.error || "Không thể lưu dữ liệu.");
}

async function translateToEnglish(sourceData: string) {
  if (!sourceData.trim()) return sourceData;
  const response = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "translate_vi_en", sourceData }),
  });
  const data = await response.json() as { text?: string; error?: string };
  if (!response.ok || !data.text) throw new Error(data.error || "Không thể dịch nội dung.");
  return data.text.trim();
}
async function askAssistant(sourceData: unknown, instruction: string) {
  const response = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "assistant", sourceData, instruction }),
  });
  const data = await response.json() as { text?: string; error?: string };
  if (!response.ok || !data.text) throw new Error(data.error || "Trợ lý chưa phản hồi được.");
  return data.text.trim();
}

export default function InternshipApp({ view }: { view: View }) {
  const router = useRouter();
  const [state, setState] = useState<AppState | null>(() => memoryState), [status, setStatus] = useState<SaveStatus>(() => memoryState && memoryUser ? "saved" : "loading"), [menu, setMenu] = useState(false), [message, setMessage] = useState("");
  const [authMode, setAuthMode] = useState<AuthMode>("login"), [fullName, setFullName] = useState(""), [username, setUsername] = useState(""), [password, setPassword] = useState(""), [showPassword, setShowPassword] = useState(false), [user, setUser] = useState<CurrentUser | null>(() => memoryUser), [authWorking, setAuthWorking] = useState(false);
  const skipInitialSave = useRef(true);
  const isLocalPreviewUser = user?.id === "local-preview";
  const openJournal = async (currentUser: CurrentUser, showLoading = true) => {
    if (showLoading) setStatus("loading");
    setMessage("");
    try {
      const cloudState = await requestCloudState();
      skipInitialSave.current = true;
      memoryState = cloudState;
      memoryUser = currentUser;
      setUser(currentUser);
      setState(cloudState);
      setStatus("saved");
    } catch (error) {
      setState(null); setStatus("locked"); setMessage(error instanceof Error ? error.message : "Không thể mở dữ liệu.");
    }
  };
  useEffect(() => {
    if (memoryState && memoryUser) return;
    if (location.hostname === "localhost" && new URLSearchParams(location.search).get("dev") === "1") {
      const previewUser = { id: "local-preview", username: "preview", fullName: "Sinh viên UEH" };
      skipInitialSave.current = true;
      memoryState = resetState(false);
      memoryUser = previewUser;
      setUser(previewUser);
      setState(memoryState);
      setStatus("saved");
      return;
    }
    queueMicrotask(() => {
      void fetch("/api/auth/me", { cache: "no-store" }).then(async response => {
        const data = await response.json() as { user?: CurrentUser };
        if (!response.ok || !data.user) { setStatus("locked"); return; }
        await openJournal(data.user);
      }).catch(() => setStatus("locked"));
    });
  }, []);
  useEffect(() => {
    if (!state || !user) return;
    memoryState = state;
    memoryUser = user;
  }, [state, user]);
  useEffect(() => {
    if (!state || !user) return;
    if (isLocalPreviewUser) { setStatus("saved"); return; }
    if (skipInitialSave.current) { skipInitialSave.current = false; return; }
    const timer = setTimeout(() => {
      setStatus("saving");
      void persistCloudState(state).then(() => setStatus("saved")).catch(error => { setStatus("error"); setMessage(error instanceof Error ? error.message : "Không thể lưu dữ liệu."); });
    }, 700);
    return () => clearTimeout(timer);
  }, [state, user]);
  useEffect(() => { const warn = (e: BeforeUnloadEvent) => { if (status === "saving") e.preventDefault(); }; addEventListener("beforeunload", warn); return () => removeEventListener("beforeunload", warn); }, [status]);
  const submitAuth = async () => {
    if (authWorking) return;
    setAuthWorking(true); setMessage("");
    try {
      const response = await fetch(`/api/auth/${authMode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fullName: fullName.trim(), username: username.trim(), password }) });
      const data = await response.json() as { user?: CurrentUser; error?: string };
      if (!response.ok || !data.user) throw new Error(data.error || "Không thể xác thực tài khoản.");
      setPassword("");
      await openJournal(data.user, false);
    } catch (error) {
      setStatus("locked"); setMessage(error instanceof Error ? error.message : "Không thể xác thực tài khoản.");
    } finally {
      setAuthWorking(false);
    }
  };
  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    memoryState = null; memoryUser = null;
    setState(null); setUser(null); setPassword(""); setMessage(""); setStatus("locked"); setMenu(false);
  };
  const initials = (user?.fullName || user?.username || "LH").split(/\s+/).filter(Boolean).slice(-2).map(part => part[0]).join("").toUpperCase();
  const isRegister = authMode === "register";
  if (status === "locked") return <div className="access-page"><section className="access-intro locked-art" aria-label="Nhật ký thực tập UEH" onContextMenu={e => e.preventDefault()}><div className="auth-art-bg" aria-hidden="true" /><div className="auth-art-dots" aria-hidden="true" /><div className="auth-art-content"><img className="auth-art-logo" src="/ueh-wordmark-transparent.png?v=sharp-v1" alt="UEH University" draggable={false} /><h2><span>NHẬT KÝ</span><b>THỰC TẬP UEH</b></h2><i className="auth-art-rule" /><p>Lưu lại hành trình thực tập, phát triển kỹ năng và hoàn thiện bản thân mỗi ngày.</p><div className="auth-art-features"><article><span>▣</span><b>Theo dõi hằng ngày</b><small>Dễ dàng ghi chép và quản lý tiến độ</small></article><article><span>▤</span><b>Báo cáo tổng quan</b><small>Thống kê và đánh giá quá trình thực tập</small></article><article><span>▥</span><b>Xuất báo cáo</b><small>Tạo báo cáo chuyên nghiệp nhanh chóng</small></article></div></div><strong className="auth-art-quote">“Học để làm – Làm để dẫn đầu – Lead the Change”</strong></section><form className="access-card" aria-busy={authWorking} onSubmit={e => { e.preventDefault(); void submitAuth(); }}><div className="access-form"><small className="auth-kicker">NHẬT KÝ THỰC TẬP</small><i className="auth-rule" /><h1>{isRegister ? "Tạo tài khoản nhật ký" : "Chào mừng bạn quay lại!"}</h1><p>{isRegister ? "Đăng ký để bắt đầu quản lý nhật ký thực tập cá nhân." : "Đăng nhập để tiếp tục nhật ký thực tập"}</p>{isRegister && <label><span>Họ và tên</span><div className="auth-input"><em className="auth-field-icon user" aria-hidden="true" /><input disabled={authWorking} autoComplete="name" placeholder="Nhập họ và tên của bạn" value={fullName} onChange={e => setFullName(e.target.value)} minLength={2} maxLength={80} required /></div></label>}<label><span>Tên đăng nhập</span><div className="auth-input"><em className="auth-field-icon user" aria-hidden="true" /><input disabled={authWorking} autoComplete="username" placeholder="Nhập tên đăng nhập" value={username} onChange={e => setUsername(e.target.value)} minLength={3} maxLength={32} pattern="[A-Za-z0-9._-]+" required /></div></label><label><span>Mật khẩu</span><div className="auth-input"><em className="auth-field-icon lock" aria-hidden="true" /><input disabled={authWorking} type={showPassword ? "text" : "password"} autoComplete={isRegister ? "new-password" : "current-password"} placeholder="Nhập mật khẩu" value={password} onChange={e => setPassword(e.target.value)} minLength={6} maxLength={128} required /><button type="button" className="auth-eye" disabled={authWorking} aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="3" /></svg></button></div></label>{!isRegister && <div className="auth-row"><label className="remember"><input type="checkbox" disabled={authWorking} />Ghi nhớ đăng nhập</label></div>}{message && <div className="access-error">{message}</div>}<button className="primary-btn auth-submit" disabled={authWorking}>{isRegister ? "Tạo tài khoản" : "Đăng nhập"}</button><button type="button" className="auth-mini-switch" disabled={authWorking} onClick={() => { setAuthMode(isRegister ? "login" : "register"); setMessage(""); }}>{isRegister ? "Quay lại đăng nhập" : "Tạo tài khoản mới"}</button></div><footer><strong>Pay to Pass</strong><nav><span>Dự án cá nhân</span><span>Nhật ký thực tập UEH</span></nav></footer></form></div>;
  if (!state) return null;
  const update = (fn: (s: AppState) => AppState) => setState(previous => previous ? fn(previous) : previous);
  return <div className="app-shell"><aside className={menu ? "sidebar open" : "sidebar"}>
    <Link className="brand ueh-sidebar-logo locked-art" href="/" onContextMenu={e => e.preventDefault()}><img src="/ueh-wordmark.png?v=locked-v3" alt="UEH University" draggable={false} /></Link>
    <nav>{nav.map(item => <Link key={item.view} href={item.href} className={view === item.view ? "active" : ""}><span>{item.icon}</span>{item.label}{item.view === "compliance" && <em>{getComplianceItems(state).filter(item => item.status === "Đạt").length}</em>}</Link>)}</nav>
  </aside>{menu && <button className="scrim" onClick={() => setMenu(false)} aria-label="Đóng menu" />}
  <main><header className="topbar"><button className="menu-btn" onClick={() => setMenu(true)} aria-label="Mở trình đơn">☰</button><div className="crumb">Không gian làm việc <span>/</span> {nav.find(n => n.view === view)?.label}</div><span className="account-name">{user?.username}</span><span className="user-avatar">{initials || "LH"}</span><button className="logout-btn" onClick={() => void logout()}>Đăng xuất</button></header>
  <div className="page">{view === "dashboard" && <Dashboard state={state} />}{view === "logs" && <Logs state={state} update={update} />}{view === "plan" && <Plan state={state} update={update} />}{view === "activities" && <Activities state={state} update={update} />}{view === "conclusion" && <ConclusionView state={state} update={update} />}{view === "compliance" && <Compliance state={state} />}{view === "settings" && <Settings state={state} setState={setState} />}</div><footer className="app-footer"><span>Pay to Pass · Dự án cá nhân · Nhật ký thực tập UEH</span></footer></main><AssistantAgent state={state} view={view} navigate={href => { router.push(href); setMenu(false); }} /></div>;
}

function Title({ eyebrow, title, desc, action }: { eyebrow?: string; title: string; desc: string; action?: React.ReactNode }) { return <div className="page-title"><div><small>{eyebrow}</small><h1>{title}</h1><p>{desc}</p></div>{action}</div>; }
function scheduleWeeks(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00`).getTime(), end = new Date(`${endDate}T00:00:00`).getTime();
  return startDate && endDate && end >= start ? Math.max(1, Math.ceil((end - start + 86400000) / 604800000)) : 12;
}
function weekFromDate(date: string, internship: AppState["internship"]) {
  const start = new Date(`${internship.startDate}T00:00:00`).getTime(), current = new Date(`${date}T00:00:00`).getTime();
  if (!date || !internship.startDate || !Number.isFinite(start) || !Number.isFinite(current)) return 1;
  return Math.min(scheduleWeeks(internship.startDate, internship.endDate), Math.max(1, Math.floor((current - start) / 604800000) + 1));
}
function updateInternship(state: AppState, patch: Partial<AppState["internship"]>) {
  const internship = { ...state.internship, ...patch };
  return { ...state, internship: { ...internship, totalWeeks: scheduleWeeks(internship.startDate, internship.endDate) } };
}
function formatInternshipDate(value: string) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return day && month && year ? `${day}/${month}/${year}` : value;
}
function DashboardSchedule({ state }: { state: AppState }) {
  const { organization, startDate, endDate } = state.internship;
  const hasSchedule = Boolean(startDate && endDate);
  return <section className="dashboard-schedule"><div className="internship-info"><span>▦</span><div><small>THÔNG TIN THỰC TẬP</small><b>{organization || "Chưa thiết lập đơn vị thực tập"}</b>{hasSchedule ? <p>{formatInternshipDate(startDate)} – {formatInternshipDate(endDate)}</p> : <Link href="/cai-dat">Thiết lập thời gian trong Cài đặt</Link>}</div></div><Link className="primary-btn add-log-btn" href="/nhat-ky">＋ Thêm nhật ký</Link></section>;
}
function Dashboard({ state }: { state: AppState }) {
  const [currentTime] = useState(() => Date.now());
  const start = new Date(`${state.internship.startDate}T00:00:00`).getTime(), end = new Date(`${state.internship.endDate}T23:59:59`).getTime();
  const scheduleReady = !!state.internship.startDate && !!state.internship.endDate && end >= start;
  const totalWeeks = scheduleReady ? scheduleWeeks(state.internship.startDate, state.internship.endDate) : 12;
  const week = !scheduleReady || currentTime < start ? 0 : Math.min(totalWeeks, Math.floor((currentTime - start) / 604800000) + 1);
  const scheduleNote = !scheduleReady ? "Chưa thiết lập lịch thực tập" : currentTime < start ? "Kỳ thực tập chưa bắt đầu" : currentTime > end ? "Kỳ thực tập đã kết thúc" : `${Math.max(0, totalWeeks - week)} tuần còn lại`;
  const progress = getProgress(state), checks = getComplianceItems(state), reached = checks.filter(item => item.status === "Đạt").length;
  return <><section className="dashboard-welcome"><div><small>CHÀO MỪNG BẠN ĐẾN VỚI</small><h1>Nhật ký thực tập <span>👋</span></h1><p>Ghi lại hành trình thực tập, phát triển kỹ năng và hoàn thiện báo cáo thực tập cùng UEH.</p></div><blockquote>“Kiến thức tạo ra giá trị.<br />Hành động tạo nên sự khác biệt.”<small>– UEH</small></blockquote></section>
  <DashboardSchedule state={state} />
  <section className="hero"><div className="ring" style={{ "--p": `${progress.overall * 3.6}deg` } as React.CSSProperties}><span>{progress.overall}<small>%</small></span></div><div><small>TIẾN ĐỘ TỔNG THỂ</small><h2>{progress.overall ? "Bạn đang đi đúng hướng" : "Bắt đầu nhật ký của bạn"}</h2><p>Tiếp tục cập nhật nhật ký hằng ngày để hệ thống tổng hợp chính xác.</p><div className="milestones"><span className={progress.planComplete === 12 ? "done" : "current"}>1 Kế hoạch</span><span className={state.activities.length >= 3 ? "done" : "current"}>2 Hoạt động chính</span><span className={progress.conclusionFields === 8 ? "done" : "current"}>3 Kết luận</span></div></div><div className="week-card"><small>TUẦN HIỆN TẠI</small><strong>{week || "—"}<em>/{totalWeeks}</em></strong><div><span style={{ width: `${week / totalWeeks * 100}%` }} /></div><p>{scheduleNote}</p></div></section>
  <section className="stats"><Stat icon="▤" value={state.dailyLogs.length} label="Ngày đã ghi nhật ký" note="Dữ liệu thực tế đã lưu" /><Stat icon="◇" value={state.activities.length} label="Hoạt động chính" note={`${Math.max(0, 3 - state.activities.length)} hoạt động nữa để đạt yêu cầu`} /><Stat icon="▦" value={progress.totalPages} label="Trang ước tính" note="Ước tính 500 từ mỗi trang" /><Stat icon="☑" value={`${reached}/${checks.length}`} label="Yêu cầu đã đạt" note="Cần tự kiểm tra trước khi nộp" /></section>
  <section className="dashboard-grid"><div className="panel"><Head title="Tiến độ các phần" sub="Dựa trên nội dung bạn đã nhập" /><Progress no="01" title="Kế hoạch thực tập" value={Math.round(progress.planComplete / 12 * 100)} /><Progress no="02" title="Báo cáo hoạt động chính" value={Math.round(Math.min(100, state.activities.length / 3 * 100))} tone="orange" /><Progress no="03" title="Kết luận" value={Math.round(progress.conclusionFields / 8 * 100)} tone="purple" /></div><div className="panel"><Head title="Việc cần làm tiếp theo" sub="Ưu tiên để hoàn thiện hồ sơ" /><Task done={progress.planComplete === 12} text="Hoàn thiện kế hoạch 12 tuần" sub={`${progress.planComplete}/12 tuần đã đủ nội dung`} href="/ke-hoach" /><Task done={state.activities.length >= 3} text="Tạo ít nhất 3 hoạt động chính" sub={`${state.activities.length}/3 hoạt động`} href="/hoat-dong" /><Task done={!!state.conclusion.lessons} text="Bổ sung bài học kinh nghiệm" sub="Phần 3 · Kết luận" href="/ket-luan" /></div></section></>;
}
function Stat({ icon, value, label, note }: { icon: string; value: string | number; label: string; note: string }) { return <div className="stat"><span>{icon}</span><strong>{value}</strong><b>{label}</b><small>{note}</small></div>; }
function Head({ title, sub }: { title: string; sub: string }) { return <div className="panel-head"><h3>{title}</h3><p>{sub}</p></div>; }
function Progress({ no, title, value, tone = "green" }: { no: string; title: string; value: number; tone?: string }) { return <div className="progress"><span className={tone}>{no}</span><div><b>{title}</b><i><em className={tone} style={{ width: `${value}%` }} /></i></div><strong>{value}%</strong></div>; }
function Task({ done, text, sub, href }: { done: boolean; text: string; sub: string; href: string }) { return <Link className="task" href={href}><span className={done ? "done" : ""}>{done ? "✓" : ""}</span><div><b>{text}</b><small>{sub}</small></div><em>›</em></Link>; }
type AgentMessage = { role: "agent" | "user"; text: string };
const agentRoutes: { href: string; title: string; patterns: RegExp[] }[] = [
  { href: "/nhat-ky", title: "Nhật ký hằng ngày", patterns: [/nh[aậ]p|ghi|th[eê]m|vi[eế]t/, /nh[aậ]t k[yý]|log|c[oô]ng vi[eệ]c/] },
  { href: "/ke-hoach", title: "Kế hoạch thực tập", patterns: [/k[eế] ho[aạ]ch|12 tu[aầ]n|m[uụ]c ti[eê]u/] },
  { href: "/hoat-dong", title: "Hoạt động chính", patterns: [/ho[aạ]t [đd][oộ]ng|gom|ph[aầ]n 2/] },
  { href: "/ket-luan", title: "Kết luận", patterns: [/k[eế]t lu[aậ]n|b[aà]i h[oọ]c|h[aạ]n ch[eế]|ph[aầ]n 3/] },
  { href: "/kiem-tra", title: "Kiểm tra yêu cầu", patterns: [/ki[eể]m tra|thi[eế]u|[đd][aạ]t|y[eê]u c[aầ]u/] },
  { href: "/", title: "Tổng quan", patterns: [/t[oổ]ng quan|dashboard|ng[aà]y b[aắ]t [đd][aầ]u|ng[aà]y k[eế]t th[uú]c|[đd][oơ]n v[iị]|setup|thi[eế]t l[aậ]p/] },
  { href: "/cai-dat", title: "Cài đặt", patterns: [/c[aà]i [đd][aặ]t|h[oồ] s[oơ]|x[oó]a d[uữ] li[eệ]u/] },
  { href: "/kiem-tra", title: "Kiểm tra yêu cầu", patterns: [/xem tr[uư][oớ]c|preview|xu[aấ]t|b[aá]o c[aá]o/] },
];
function findAgentRoute(text: string) {
  const normalized = text.toLowerCase();
  const exact = agentRoutes.find(route => route.patterns.every(pattern => pattern.test(normalized)));
  return exact ?? (/nh[aậ]p|ghi|vi[eế]t|th[eê]m/.test(normalized) ? agentRoutes[0] : undefined);
}
function AssistantAgent({ state, view, navigate }: { state: AppState; view: View; navigate: (href: string) => void }) {
  const [open, setOpen] = useState(false), [input, setInput] = useState(""), [working, setWorking] = useState(false), [mounted, setMounted] = useState(false);
  const [messages, setMessages] = useState<AgentMessage[]>([{ role: "agent", text: "Bạn cần nhập nhật ký, lập kế hoạch hay kiểm tra thiếu gì cứ nói mình mở đúng chỗ cho." }]);
  useEffect(() => setMounted(true), []);
  const summary = () => ({ currentTab: nav.find(item => item.view === view)?.label, internship: state.internship, counts: { dailyLogs: state.dailyLogs.length, activities: state.activities.length, plansDone: state.plans.filter(plan => plan.workContent.trim()).length, conclusionDone: Object.values(state.conclusion).filter(value => typeof value === "string" && value.trim()).length } });
  const send = async (preset?: string) => {
    const text = (preset ?? input).trim();
    if (!text || working) return;
    setInput(""); setMessages(items => [...items, { role: "user", text }]);
    const route = findAgentRoute(text);
    if (route) {
      navigate(route.href);
      setMessages(items => [...items, { role: "agent", text: `Ok, mình mở tab ${route.title} cho bạn. Nếu muốn nhập mới thì bấm nút thêm/chỉnh sửa trong tab này.` }]);
      setOpen(true);
      return;
    }
    const translating = /^dịch|^dich|vi\s*->\s*en/i.test(text);
    setWorking(true);
    try {
      const answer = translating ? await translateToEnglish(text.replace(/^dịch\s*|^dich\s*|vi\s*->\s*en\s*/i, "")) : await askAssistant(summary(), text);
      setMessages(items => [...items, { role: "agent", text: answer }]);
    } catch (error) {
      setMessages(items => [...items, { role: "agent", text: error instanceof Error ? error.message : "Mình chưa xử lý được câu này." }]);
    } finally {
      setWorking(false); setOpen(true);
    }
  };
  const widget = <div className={open ? "agent-widget open" : "agent-widget"}><button className="agent-fab" onClick={() => setOpen(value => !value)} aria-label="Mở trợ lý AI"><span>✦</span><em><b>Trợ lý AI</b><small>Mở tab & hỗ trợ nhập</small></em></button>{open && <section className="agent-panel" aria-label="Trợ lý AI"><header><div><small>TRỢ LÝ AGENT</small><b>Muốn làm gì, nói mình mở đúng tab</b></div><button onClick={() => setOpen(false)} aria-label="Đóng">×</button></header><div className="agent-messages">{messages.map((message, index) => <p key={index} className={message.role}>{message.text}</p>)}{working && <p className="agent">Đang nghĩ chút…</p>}</div><div className="agent-suggest"><button onClick={() => void send("Tôi muốn nhập nhật ký")}>Nhập nhật ký</button><button onClick={() => void send("Kiểm tra tôi còn thiếu gì")}>Kiểm tra thiếu gì</button><button onClick={() => void send("Setup ngày bắt đầu")}>Setup lịch</button></div><form onSubmit={event => { event.preventDefault(); void send(); }}><input value={input} onChange={event => setInput(event.target.value)} placeholder="Ví dụ: t muốn nhập nhật ký hôm nay" /><button disabled={working}>Gửi</button></form></section>}</div>;
  return mounted ? createPortal(widget, document.body) : null;
}

function Logs({ state, update }: { state: AppState; update: (fn: (s: AppState) => AppState) => void }) {
  const [query, setQuery] = useState(""), [week, setWeek] = useState(0), [workType, setWorkType] = useState(""), [editing, setEditing] = useState<DailyLog | null>(null);
  const totalWeeks = scheduleWeeks(state.internship.startDate, state.internship.endDate);
  const workTypes = Array.from(new Set(state.dailyLogs.map(log => log.workType).filter(Boolean))).sort((a, b) => a.localeCompare(b, "vi"));
  const filtered = state.dailyLogs.filter(l => (!week || l.week === week) && (!workType || l.workType === workType) && `${l.title} ${l.assignedWork} ${l.tags.join(" ")}`.toLowerCase().includes(query.trim().toLowerCase()));
  const blank = (): DailyLog => { const date = today(); return { id: uid(), internshipId: state.internship.id, date, week: weekFromDate(date, state.internship), title: "", assignedWork: "", actionsTaken: "", relatedDocuments: "", tools: "", appliedKnowledge: "", result: "", difficulties: "", resolution: "", lessonsLearned: "", additionalNotes: "", workType: "", tags: [], files: [], sensitive: false, createdAt: iso(), updatedAt: iso() }; };
  const save = (log: DailyLog) => update(s => { const normalized = { ...log, week: Math.min(scheduleWeeks(s.internship.startDate, s.internship.endDate), Math.max(1, log.week)), updatedAt: iso() }; return { ...s, dailyLogs: s.dailyLogs.some(x => x.id === log.id) ? s.dailyLogs.map(x => x.id === log.id ? normalized : x) : [normalized, ...s.dailyLogs] }; });
  return <><Title eyebrow="DỮ LIỆU THỰC TẾ" title="Nhật ký hằng ngày" desc="Ghi lại sự kiện đúng như bạn đã thực hiện; hệ thống sẽ dùng chúng cho báo cáo." action={<button className="primary-btn" onClick={() => setEditing(blank())}>＋ Thêm nhật ký</button>} />
  <div className="toolbar"><label className="search">⌕<input aria-label="Tìm nhật ký" value={query} onChange={e => setQuery(e.target.value)} placeholder="Tìm công việc hoặc thẻ…" /></label><select aria-label="Lọc theo tuần" value={week} onChange={e => setWeek(+e.target.value)}><option value={0}>Tất cả {totalWeeks} tuần</option>{Array.from({ length: totalWeeks }, (_, i) => <option key={i} value={i + 1}>Tuần {i + 1}</option>)}</select><select aria-label="Lọc theo loại công việc" value={workType} onChange={e => setWorkType(e.target.value)}><option value="">Mọi loại công việc</option>{workTypes.map(type => <option key={type}>{type}</option>)}</select><span>{filtered.length} bản ghi</span></div>
  <div className="log-list">{filtered.map(log => <article className="log-card" key={log.id}><div className="date"><b>{new Date(log.date).getDate()}</b><span>TH{new Date(log.date).getMonth() + 1}</span></div><div className="log-body"><small>TUẦN {log.week} · {log.workType || "CHƯA PHÂN LOẠI"}</small><h3>{log.title}</h3><p>{log.actionsTaken || log.assignedWork}</p><div className="tags">{log.tags.map(t => <span key={t}>{t}</span>)}</div></div><div className="card-actions"><button onClick={() => setEditing(log)}>Sửa</button><button onClick={() => setEditing({ ...log, id: uid(), title: `${log.title} (bản sao)`, createdAt: iso() })}>Nhân bản</button><button className="danger" onClick={() => confirm("Xoá nhật ký này?") && update(s => ({ ...s, dailyLogs: s.dailyLogs.filter(x => x.id !== log.id), activities: s.activities.map(a => ({ ...a, dailyLogIds: a.dailyLogIds.filter(id => id !== log.id) })) }))}>Xoá</button></div></article>)}{!filtered.length && <Empty text="Chưa có nhật ký phù hợp bộ lọc." />}</div>
  {editing && <LogModal log={editing} internship={state.internship} onClose={() => setEditing(null)} onSave={log => { save(log); setEditing(null); }} />}</>;
}
function LogModal({ log, internship, onClose, onSave }: { log: DailyLog; internship: AppState["internship"]; onClose: () => void; onSave: (l: DailyLog) => void }) {
  const [form, setForm] = useState(log), set = (key: keyof DailyLog, value: unknown) => setForm(f => ({ ...f, [key]: value }));
  const totalWeeks = scheduleWeeks(internship.startDate, internship.endDate);
  const fields: [keyof DailyLog, string][] = [["assignedWork", "Mô tả ngắn công việc được giao"], ["actionsTaken", "Tôi đã thực hiện những gì"], ["relatedDocuments", "File / chứng từ / tài liệu liên quan"], ["tools", "Công cụ / phần mềm sử dụng"], ["appliedKnowledge", "Kiến thức hoặc kỹ năng áp dụng"], ["result", "Kết quả"], ["difficulties", "Khó khăn gặp phải"], ["resolution", "Cách xử lý"], ["lessonsLearned", "Điều học được"], ["additionalNotes", "Ghi chú thêm"]];
  return <Modal title={log.title ? "Chỉnh sửa bản ghi" : "Thêm nhật ký mới"} onClose={onClose} onSubmit={() => form.title.trim() && onSave({ ...form, title: form.title.trim(), tags: Array.from(new Set(form.tags.map(tag => tag.trim()).filter(Boolean))) })} footer="Tự động lưu sau khi xác nhận"><div className="form-grid">
    <Field label="Ngày"><input type="date" value={form.date} onChange={e => { const date = e.target.value; setForm(f => ({ ...f, date, week: weekFromDate(date, internship) })); }} required /></Field>
    <Field label="Tuần thực tập"><select value={form.week} onChange={e => set("week", +e.target.value)}>{Array.from({ length: totalWeeks }, (_, i) => <option key={i}>{i + 1}</option>)}</select></Field>
    <Field label="Tên công việc" wide translate={{ text: form.title, onTranslated: value => set("title", value) }}><input value={form.title} onChange={e => set("title", e.target.value)} required placeholder="Ví dụ: Kiểm tra chứng từ TK 152" /></Field>
    <Field label="Loại công việc" translate={{ text: form.workType, onTranslated: value => set("workType", value) }}><input value={form.workType} onChange={e => set("workType", e.target.value)} /></Field>
    <Field label="Thẻ (cách nhau bằng dấu phẩy)"><input value={form.tags.join(", ")} onChange={e => set("tags", e.target.value.split(",").map(x => x.trim()).filter(Boolean))} /></Field>
    {fields.map(([key, label]) => { const value = String(form[key] ?? ""); return <Field key={key} label={label} wide translate={{ text: value, onTranslated: translated => set(key, translated) }}><textarea value={value} onChange={e => set(key, e.target.value)} rows={2} /></Field>; })}
  </div></Modal>;
}

function Plan({ state, update }: { state: AppState; update: (fn: (s: AppState) => AppState) => void }) {
  const setPlan = (id: string, key: keyof InternshipPlan, value: string) => update(s => ({ ...s, plans: s.plans.map(p => p.id === id ? { ...p, [key]: value } : p), conclusion: { ...s.conclusion, rows: s.conclusion.rows.map(r => { const p = s.plans.find(x => x.id === id); return p?.week === r.week ? { ...r, ...(key === "target" ? { plannedTarget: value } : {}), ...(key === "workContent" ? { plannedWork: value } : {}) } : r; }) } }));
  return <><Title eyebrow="PHẦN 1" title="Kế hoạch thực tập" desc="Kế hoạch được giữ nguyên để đối chiếu với kết quả thực tế, không tự ghi đè." action={<span className="status-pill">{state.plans.filter(p => p.workContent).length}/12 tuần</span>} /><div className="table-wrap"><table><thead><tr><th>Tuần</th><th>Nội dung công việc</th><th>Mục tiêu cần đạt</th><th>Phương pháp sử dụng</th><th>Yêu cầu hỗ trợ</th><th>Yêu cầu kết quả</th></tr></thead><tbody>{state.plans.map(p => <tr key={p.id}><th>{p.week}</th>{(["workContent", "target", "method", "supportRequired", "expectedResult"] as (keyof InternshipPlan)[]).map(key => { const value = String(p[key]); return <td key={key}><TranslateButton text={value} onTranslated={translated => setPlan(p.id, key, translated)} /><textarea value={value} onChange={e => setPlan(p.id, key, e.target.value)} placeholder="Nhập nội dung…" /></td>; })}</tr>)}</tbody></table></div></>;
}

function Activities({ state, update }: { state: AppState; update: (fn: (s: AppState) => AppState) => void }) {
  const [selected, setSelected] = useState<string[]>([]), [editing, setEditing] = useState<Activity | null>(null);
  const blank = (): Activity => ({ id: uid(), internshipId: state.internship.id, name: "", startDate: "", endDate: "", dailyLogIds: selected, objective: "", method: "Trải nghiệm thực tế", actualProcess: "", companyProcedures: "", workingPapers: "", recordsUsed: "", recordStorage: "", directSteps: "", result: "", difficulties: "", resolution: "", knowledgeAndSkills: "", appendixIds: [], sensitive: false, createdAt: iso(), updatedAt: iso() });
  const save = (a: Activity) => update(s => ({ ...s, activities: s.activities.some(x => x.id === a.id) ? s.activities.map(x => x.id === a.id ? { ...a, updatedAt: iso() } : x) : [...s.activities, { ...a, updatedAt: iso() }] }));
  return <><Title eyebrow="PHẦN 2 · TỐI THIỂU 3 HOẠT ĐỘNG" title="Hoạt động chính" desc="Chọn các bản ghi nhật ký liên quan rồi gom thành một hoạt động có thể truy vết." action={<button className="primary-btn" onClick={() => setEditing(blank())}>＋ Tạo hoạt động</button>} />
  <div className="activity-layout"><aside className="picker"><h3>Chọn bản ghi nhật ký</h3><p>{selected.length} bản ghi đã chọn</p>{state.dailyLogs.map(l => <label key={l.id}><input aria-label={`Chọn ${l.title}`} type="checkbox" checked={selected.includes(l.id)} onChange={e => setSelected(v => e.target.checked ? Array.from(new Set([...v, l.id])) : v.filter(x => x !== l.id))} /><span><b>{l.title}</b><small>Tuần {l.week} · {l.date}</small></span></label>)}<button className="secondary-btn" disabled={!selected.length} onClick={() => setEditing(blank())}>Gom thành hoạt động ({selected.length})</button></aside><div className="activity-list">{state.activities.map((a, i) => <article className="activity-card" key={a.id}><span>{String(i + 1).padStart(2, "0")}</span><div><small>{a.startDate || "Chưa có ngày"} — {a.endDate || "Chưa có ngày"}</small><h3>{a.name}</h3><p>{a.objective || "Chưa nhập mục tiêu hoạt động."}</p><div className="tags"><span>{a.method}</span><span>{a.dailyLogIds.length} bản ghi</span></div></div><div className="card-actions"><button className="ghost-btn" onClick={() => setEditing(a)}>Chỉnh sửa</button><button className="danger" onClick={() => confirm("Xoá hoạt động này?") && update(s => ({ ...s, activities: s.activities.filter(item => item.id !== a.id) }))}>Xoá</button></div></article>)}{!state.activities.length && <Empty text="Chưa có hoạt động chính. Chọn nhật ký bên trái để bắt đầu." />}</div></div>
  {editing && <ActivityModal activity={editing} logs={state.dailyLogs} onClose={() => setEditing(null)} onSave={a => { save(a); setSelected([]); setEditing(null); }} />}</>;
}
function ActivityModal({ activity, logs, onClose, onSave }: { activity: Activity; logs: DailyLog[]; onClose: () => void; onSave: (a: Activity) => void }) {
  const [form, setForm] = useState(activity), set = (key: keyof Activity, value: unknown) => setForm(f => ({ ...f, [key]: value }));
  const fields: [keyof Activity, string][] = [["objective", "Mục tiêu hoạt động"], ["actualProcess", "Quy trình thực hiện thực tế"], ["companyProcedures", "Quy định / quy trình công ty liên quan"], ["workingPapers", "Giấy làm việc sử dụng"], ["recordsUsed", "Hồ sơ / chứng từ sử dụng"], ["recordStorage", "Cách lưu hồ sơ"], ["directSteps", "Các bước tôi trực tiếp thực hiện"], ["result", "Kết quả đạt được"], ["difficulties", "Khó khăn"], ["resolution", "Cách xử lý"], ["knowledgeAndSkills", "Kiến thức / kỹ năng học được"]];
  return <Modal title={activity.name ? "Chỉnh sửa hoạt động" : "Tạo từ nhật ký"} onClose={onClose} onSubmit={() => form.name.trim() && onSave({ ...form, name: form.name.trim() })} footer="Hoạt động này dùng cho Phần 2 của Nhật ký thực tập"><div className="form-grid">
    <Field label="Tên hoạt động" wide translate={{ text: form.name, onTranslated: value => set("name", value) }}><input value={form.name} onChange={e => set("name", e.target.value)} required /></Field>
    <Field label="Từ ngày"><input type="date" value={form.startDate} onChange={e => set("startDate", e.target.value)} /></Field>
    <Field label="Đến ngày"><input type="date" value={form.endDate} onChange={e => set("endDate", e.target.value)} /></Field>
    <Field label="Phương pháp" wide><select value={form.method} onChange={e => set("method", e.target.value)}><option>Trải nghiệm thực tế</option><option>Tự nghiên cứu và đúc kết</option><option>Phương pháp khác</option></select></Field>
    <Field label="Bản ghi nhật ký liên quan" wide><div className="log-options">{logs.map(log => <label key={log.id}><input type="checkbox" checked={form.dailyLogIds.includes(log.id)} onChange={e => set("dailyLogIds", e.target.checked ? Array.from(new Set([...form.dailyLogIds, log.id])) : form.dailyLogIds.filter(id => id !== log.id))} /><span>{log.title}</span></label>)}</div></Field>
    {fields.map(([key, label]) => { const value = String(form[key] ?? ""); return <Field key={key} label={label} wide translate={{ text: value, onTranslated: translated => set(key, translated) }}><textarea rows={2} value={value} onChange={e => set(key, e.target.value)} /></Field>; })}
  </div></Modal>;
}

function ConclusionView({ state, update }: { state: AppState; update: (fn: (s: AppState) => AppState) => void }) {
  const set = (key: keyof Conclusion, value: string) => update(s => ({ ...s, conclusion: { ...s.conclusion, [key]: value, updatedAt: iso() } }));
  const setRow = (week: number, key: "actualTarget" | "actualWork" | "limitations" | "correctiveSolution" | "solutionExecution", value: string) => update(s => ({ ...s, conclusion: { ...s.conclusion, updatedAt: iso(), rows: s.conclusion.rows.map(row => row.week === week ? { ...row, [key]: value } : row) } }));
  const fields: [keyof Conclusion, string, string][] = [["completedWork", "Những công việc đã thực hiện", "Tóm tắt các nhóm công việc nổi bật…"], ["professionalKnowledge", "Kiến thức chuyên môn đã học được", "Liên hệ kiến thức kiểm toán đã áp dụng…"], ["developedSkills", "Kỹ năng đã phát triển", "Excel, giao tiếp, quản lý hồ sơ…"], ["lessons", "Bài học kinh nghiệm", "Những đúc kết quan trọng…"], ["personalLimitations", "Hạn chế của bản thân", "Nêu cụ thể và trung thực…"], ["personalChanges", "Sự thay đổi sau kỳ thực tập", "Nhận thức, tác phong, định hướng…"], ["internshipValue", "Giá trị nhận được", "Giá trị chuyên môn và cá nhân…"], ["finalConclusion", "Kết luận", "Khép lại quá trình thực tập…"]];
  // Textarea được lồng trực tiếp trong label có nội dung hiển thị; luật lint không nhận diện cấu trúc rút gọn này.
  // eslint-disable-next-line jsx-a11y/label-has-associated-control
  return <><Title eyebrow="PHẦN 3 · TỐI THIỂU 5 TRANG" title="Kết luận" desc="Tổng kết dựa trên dữ liệu thực tế; bạn luôn là người duyệt nội dung cuối cùng." /><section className="panel summary"><h3>3.1. Tổng kết quá trình thực tập</h3><p>Kế hoạch được giữ nguyên; các cột thực tế, hạn chế và giải pháp có thể chỉnh sửa độc lập.</p><div className="table-wrap conclusion-table"><table><thead><tr><th>Tuần</th><th>Mục tiêu kế hoạch</th><th>Mục tiêu thực tế</th><th>Công việc kế hoạch</th><th>Công việc thực tế</th><th>Hạn chế</th><th>Giải pháp khắc phục</th><th>Kết quả thực hiện</th></tr></thead><tbody>{state.conclusion.rows.map(row => <tr key={row.week}><th>{row.week}</th><td>{row.plannedTarget || "Chưa có"}</td><td><textarea aria-label={`Mục tiêu thực tế tuần ${row.week}`} value={row.actualTarget} onChange={e => setRow(row.week, "actualTarget", e.target.value)} /></td><td>{row.plannedWork || "Chưa có"}</td><td><textarea aria-label={`Công việc thực tế tuần ${row.week}`} value={row.actualWork} onChange={e => setRow(row.week, "actualWork", e.target.value)} /></td><td><textarea aria-label={`Hạn chế tuần ${row.week}`} value={row.limitations} onChange={e => setRow(row.week, "limitations", e.target.value)} /></td><td><textarea aria-label={`Giải pháp tuần ${row.week}`} value={row.correctiveSolution} onChange={e => setRow(row.week, "correctiveSolution", e.target.value)} /></td><td><textarea aria-label={`Kết quả thực hiện tuần ${row.week}`} value={row.solutionExecution} onChange={e => setRow(row.week, "solutionExecution", e.target.value)} /></td></tr>)}</tbody></table></div></section><h2 className="section-title">3.2. Tổng kết kết quả thực tập</h2><section className="conclusion-grid">{fields.map(([key, label, placeholder]) => <label className="editor" key={key}><span><b>{label}</b><small>{String(state.conclusion[key] || "").length} ký tự</small></span><textarea rows={6} value={String(state.conclusion[key] ?? "")} onChange={e => set(key, e.target.value)} placeholder={placeholder} /></label>)}</section></>;
}
function Compliance({ state }: { state: AppState }) { const checks = getComplianceItems(state); return <><Title eyebrow="UEH 2026" title="Kiểm tra yêu cầu" desc="Đối chiếu tiến độ hiện tại với các yêu cầu của nhật ký thực tập." /><div className="checks">{checks.map(item => <div key={item.label}><span className={item.status === "Đạt" ? "ok" : "pending"}>{item.status === "Đạt" ? "✓" : item.status === "Cần kiểm tra" ? "?" : "!"}</span><b>{item.label}</b><em>{item.status}</em></div>)}</div></>; }
function Settings({ state, setState }: { state: AppState; setState: (s: AppState) => void }) { const setInternship = (patch: Partial<AppState["internship"]>) => setState(updateInternship(state, patch)); return <><Title eyebrow="CÁ NHÂN HOÁ" title="Cài đặt" desc="Quản lý hồ sơ và dữ liệu của bạn." /><div className="settings"><section className="panel"><h3>Hồ sơ thực tập</h3><Field label="Họ và tên"><input value={state.profile.fullName} onChange={e => setState({ ...state, profile: { ...state.profile, fullName: e.target.value } })} onBlur={e => setState({ ...state, profile: { ...state.profile, fullName: e.target.value.trim() } })} /></Field><Field label="Đơn vị thực tập"><input value={state.internship.organization} placeholder="Nhập tên công ty/đơn vị" onChange={e => setInternship({ organization: e.target.value })} onBlur={e => setInternship({ organization: e.target.value.trim() })} /></Field><Field label="Ngày bắt đầu"><input type="date" value={state.internship.startDate} max={state.internship.endDate || undefined} onChange={e => setInternship({ startDate: e.target.value })} /></Field><Field label="Ngày kết thúc"><input type="date" value={state.internship.endDate} min={state.internship.startDate || undefined} onChange={e => setInternship({ endDate: e.target.value })} /></Field></section><section className="panel"><h3>Dữ liệu nhật ký</h3><p>Mọi thay đổi được tự động lưu vào dữ liệu của tài khoản hiện tại.</p><button className="danger-btn clear-data-btn" onClick={() => confirm("Xoá toàn bộ nội dung nhật ký?") && setState(resetState(false))}>Xoá dữ liệu và bắt đầu trống</button></section></div></>; }
type TranslationControl = { text: string; onTranslated: (value: string) => void };
function Field({ label, children, wide = false, translate }: { label: string; children: React.ReactNode; wide?: boolean; translate?: TranslationControl }) { return <label className={wide ? "field wide" : "field"}><span>{label}{translate && <TranslateButton {...translate} />}</span>{children}</label>; }
function TranslateButton({ text, onTranslated }: TranslationControl) {
  const [working, setWorking] = useState(false), [error, setError] = useState("");
  return <><button type="button" className="translate-btn" disabled={working || !text.trim()} onClick={event => { event.preventDefault(); event.stopPropagation(); setWorking(true); setError(""); void translateToEnglish(text).then(onTranslated).catch(reason => setError(reason instanceof Error ? reason.message : "Không thể dịch.")).finally(() => setWorking(false)); }}>{working ? "Đang dịch…" : "VI → EN"}</button>{error && <small className="translate-error" title={error}>!</small>}</>;
}
function Empty({ text }: { text: string }) { return <div className="empty"><span>＋</span><p>{text}</p></div>; }
function Modal({ title, onClose, onSubmit, footer, children }: { title: string; onClose: () => void; onSubmit: () => void; footer: string; children: React.ReactNode }) { return <div className="modal-back"><form className="modal" onSubmit={e => { e.preventDefault(); onSubmit(); }}><div className="modal-head"><div><small>NHẬT KÝ THỰC TẬP</small><h2>{title}</h2></div><button type="button" onClick={onClose}>×</button></div>{children}<div className="modal-foot"><span>● {footer}</span><button type="button" className="ghost-btn" onClick={onClose}>Huỷ</button><button className="primary-btn">Lưu</button></div></form></div>; }
