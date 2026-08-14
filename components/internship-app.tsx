"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Activity, AppState, Conclusion, DailyLog, InternshipPlan } from "../lib/models";
import { getComplianceItems, getProgress } from "../lib/progress";
import { resetState } from "../lib/storage";

export type View = "dashboard" | "logs" | "plan" | "activities" | "conclusion" | "references" | "appendices" | "preview" | "compliance" | "settings";
const nav: { view: View; href: string; label: string; icon: string }[] = [
  { view: "dashboard", href: "/", label: "Tổng quan", icon: "⌂" }, { view: "logs", href: "/nhat-ky", label: "Nhật ký hằng ngày", icon: "✎" },
  { view: "plan", href: "/ke-hoach", label: "Kế hoạch thực tập", icon: "▦" }, { view: "activities", href: "/hoat-dong", label: "Hoạt động chính", icon: "◇" },
  { view: "conclusion", href: "/ket-luan", label: "Kết luận", icon: "✓" }, { view: "references", href: "/tai-lieu-tham-khao", label: "Tài liệu tham khảo", icon: "≡" },
  { view: "appendices", href: "/phu-luc", label: "Phụ lục", icon: "⊞" }, { view: "preview", href: "/xem-truoc", label: "Xem trước", icon: "◉" },
  { view: "compliance", href: "/kiem-tra", label: "Kiểm tra yêu cầu", icon: "☑" }, { view: "settings", href: "/cai-dat", label: "Cài đặt", icon: "⚙" },
];
const uid = () => crypto.randomUUID(), iso = () => new Date().toISOString(), today = () => new Date().toISOString().slice(0, 10);
type SaveStatus = "loading" | "locked" | "saving" | "saved" | "error";
type AuthMode = "login" | "register";
type CurrentUser = { id: string; username: string; fullName: string };

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

export default function InternshipApp({ view }: { view: View }) {
  const [state, setState] = useState<AppState | null>(null), [status, setStatus] = useState<SaveStatus>("loading"), [menu, setMenu] = useState(false), [message, setMessage] = useState("");
  const [authMode, setAuthMode] = useState<AuthMode>("login"), [fullName, setFullName] = useState(""), [username, setUsername] = useState(""), [password, setPassword] = useState(""), [user, setUser] = useState<CurrentUser | null>(null), [authWorking, setAuthWorking] = useState(false);
  const skipInitialSave = useRef(true);
  const openJournal = async (currentUser: CurrentUser, showLoading = true) => {
    if (showLoading) setStatus("loading");
    setMessage("");
    try {
      const cloudState = await requestCloudState();
      skipInitialSave.current = true;
      setUser(currentUser);
      setState(cloudState);
      setStatus("saved");
    } catch (error) {
      setState(null); setStatus("locked"); setMessage(error instanceof Error ? error.message : "Không thể mở dữ liệu.");
    }
  };
  useEffect(() => {
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
    setState(null); setUser(null); setPassword(""); setMessage(""); setStatus("locked"); setMenu(false);
  };
  if (status === "locked") return <div className="access-page"><form className="access-card" aria-busy={authWorking} onSubmit={e => { e.preventDefault(); void submitAuth(); }}><span className="brand-mark">N</span><small>NHẬT KÝ THỰC TẬP UEH</small><div className="auth-tabs"><button type="button" disabled={authWorking} className={authMode === "login" ? "active" : ""} onClick={() => { setAuthMode("login"); setMessage(""); }}>Đăng nhập</button><button type="button" disabled={authWorking} className={authMode === "register" ? "active" : ""} onClick={() => { setAuthMode("register"); setMessage(""); }}>Đăng ký</button></div><h1>{authMode === "login" ? "Chào mừng bạn quay lại" : "Tạo tài khoản mới"}</h1><p>{authMode === "login" ? "Đăng nhập để mở nhật ký đã lưu trên Vercel." : "Mỗi tài khoản có một không gian nhật ký riêng."}</p>{authMode === "register" && <label><span>Họ và tên</span><input disabled={authWorking} autoComplete="name" value={fullName} onChange={e => setFullName(e.target.value)} minLength={2} maxLength={80} required /></label>}<label><span>Tên đăng nhập</span><input disabled={authWorking} autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} minLength={3} maxLength={32} pattern="[A-Za-z0-9._-]+" required /></label><label><span>Mật khẩu</span><input disabled={authWorking} type="password" autoComplete={authMode === "login" ? "current-password" : "new-password"} value={password} onChange={e => setPassword(e.target.value)} minLength={6} maxLength={128} required /></label>{message && <div className="access-error">{message}</div>}<button className={`primary-btn auth-submit${authWorking ? " busy" : ""}`} disabled={authWorking}>{authWorking ? authMode === "login" ? "Đang đăng nhập…" : "Đang tạo tài khoản…" : authMode === "login" ? "Đăng nhập" : "Tạo tài khoản"}</button></form></div>;
  if (!state) return <div className="loading">Đang tải dữ liệu từ Vercel…</div>;
  const update = (fn: (s: AppState) => AppState) => setState(previous => previous ? fn(previous) : previous);
  return <div className="app-shell"><aside className={menu ? "sidebar open" : "sidebar"}>
    <Link className="brand" href="/"><span className="brand-mark">N</span><span><b>Nhật ký thực tập</b><small>UEH · KIỂM TOÁN 2026</small></span></Link>
    <nav>{nav.map(item => <Link key={item.view} href={item.href} className={view === item.view ? "active" : ""}><span>{item.icon}</span>{item.label}{item.view === "compliance" && <em>{getComplianceItems(state).filter(item => item.status === "Đạt").length}</em>}</Link>)}</nav>
    <div className="sidebar-foot"><span>●</span><div><b>Đám mây riêng tư</b><small>Tự động lưu trên Vercel</small></div></div>
  </aside>{menu && <button className="scrim" onClick={() => setMenu(false)} aria-label="Đóng menu" />}
  <main><header className="topbar"><button className="menu-btn" onClick={() => setMenu(true)} aria-label="Mở trình đơn">☰</button><div className="crumb">Không gian làm việc <span>/</span> {nav.find(n => n.view === view)?.label}</div><div className={status === "saved" ? "save saved" : status === "error" ? "save error" : "save"}><i />{status === "saved" ? "Đã lưu trên Vercel" : status === "error" ? "Lỗi lưu dữ liệu" : "Đang lưu…"}</div><span className="account-name">{user?.username}</span><button className="logout-btn" onClick={() => void logout()}>Đăng xuất</button></header>
  <div className="page">{view === "dashboard" && <Dashboard state={state} update={update} />}{view === "logs" && <Logs state={state} update={update} />}{view === "plan" && <Plan state={state} update={update} />}{view === "activities" && <Activities state={state} update={update} />}{view === "conclusion" && <ConclusionView state={state} update={update} />}{view === "compliance" && <Compliance state={state} />}{view === "settings" && <Settings state={state} setState={setState} />}{["references", "appendices", "preview"].includes(view) && <Soon view={view} />}</div></main></div>;
}

function Title({ eyebrow, title, desc, action }: { eyebrow?: string; title: string; desc: string; action?: React.ReactNode }) { return <div className="page-title"><div><small>{eyebrow}</small><h1>{title}</h1><p>{desc}</p></div>{action}</div>; }
function scheduleWeeks(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00`).getTime(), end = new Date(`${endDate}T00:00:00`).getTime();
  return startDate && endDate && end >= start ? Math.max(1, Math.ceil((end - start + 86400000) / 604800000)) : 12;
}
function ScheduleFields({ state, update }: { state: AppState; update: (fn: (s: AppState) => AppState) => void }) {
  const setDate = (key: "startDate" | "endDate", value: string) => update(s => {
    const internship = { ...s.internship, [key]: value };
    return { ...s, internship: { ...internship, totalWeeks: scheduleWeeks(internship.startDate, internship.endDate) } };
  });
  return <section className="schedule-panel"><div><small>THỜI GIAN THỰC TẬP</small><b>Thiết lập lịch của bạn</b></div><Field label="Ngày bắt đầu"><input type="date" value={state.internship.startDate} max={state.internship.endDate || undefined} onChange={e => setDate("startDate", e.target.value)} /></Field><Field label="Ngày kết thúc"><input type="date" value={state.internship.endDate} min={state.internship.startDate || undefined} onChange={e => setDate("endDate", e.target.value)} /></Field></section>;
}
function Dashboard({ state, update }: { state: AppState; update: (fn: (s: AppState) => AppState) => void }) {
  const [currentTime] = useState(() => Date.now());
  const start = new Date(`${state.internship.startDate}T00:00:00`).getTime(), end = new Date(`${state.internship.endDate}T23:59:59`).getTime();
  const scheduleReady = !!state.internship.startDate && !!state.internship.endDate && end >= start;
  const totalWeeks = scheduleReady ? scheduleWeeks(state.internship.startDate, state.internship.endDate) : 12;
  const week = !scheduleReady || currentTime < start ? 0 : Math.min(totalWeeks, Math.floor((currentTime - start) / 604800000) + 1);
  const scheduleNote = !scheduleReady ? "Chưa thiết lập lịch thực tập" : currentTime < start ? "Kỳ thực tập chưa bắt đầu" : currentTime > end ? "Kỳ thực tập đã kết thúc" : `${Math.max(0, totalWeeks - week)} tuần còn lại`;
  const progress = getProgress(state), checks = getComplianceItems(state), reached = checks.filter(item => item.status === "Đạt").length;
  return <><Title eyebrow="THỰC TẬP TỐT NGHIỆP" title={`Xin chào, ${state.profile.fullName.trim() || "bạn"} 👋`} desc="Theo dõi tiến độ và hoàn thiện nhật ký thực tập của bạn." action={<Link className="primary-btn" href="/nhat-ky">＋ Thêm nhật ký</Link>} />
  <ScheduleFields state={state} update={update} />
  <section className="hero"><div className="ring" style={{ "--p": `${progress.overall * 3.6}deg` } as React.CSSProperties}><span>{progress.overall}<small>%</small></span></div><div><small>TIẾN ĐỘ TỔNG THỂ</small><h2>{progress.overall ? "Bạn đang đi đúng hướng" : "Bắt đầu nhật ký của bạn"}</h2><p>Tiếp tục cập nhật nhật ký hằng ngày để hệ thống tổng hợp chính xác.</p><div className="milestones"><span className={progress.planComplete === 12 ? "done" : "current"}>1 Kế hoạch</span><span className={state.activities.length >= 3 ? "done" : "current"}>2 Hoạt động chính</span><span className={progress.conclusionFields === 8 ? "done" : "current"}>3 Kết luận</span></div></div><div className="week-card"><small>TUẦN HIỆN TẠI</small><strong>{week || "—"}<em>/{totalWeeks}</em></strong><div><span style={{ width: `${week / totalWeeks * 100}%` }} /></div><p>{scheduleNote}</p></div></section>
  <section className="stats"><Stat icon="▤" value={state.dailyLogs.length} label="Ngày đã ghi nhật ký" note="Dữ liệu thực tế đã lưu" /><Stat icon="◇" value={state.activities.length} label="Hoạt động chính" note={`${Math.max(0, 3 - state.activities.length)} hoạt động nữa để đạt yêu cầu`} /><Stat icon="▦" value={progress.totalPages} label="Trang ước tính" note="Ước tính 500 từ mỗi trang" /><Stat icon="☑" value={`${reached}/${checks.length}`} label="Yêu cầu đã đạt" note="Cần tự kiểm tra trước khi nộp" /></section>
  <section className="dashboard-grid"><div className="panel"><Head title="Tiến độ các phần" sub="Dựa trên nội dung bạn đã nhập" /><Progress no="01" title="Kế hoạch thực tập" value={Math.round(progress.planComplete / 12 * 100)} /><Progress no="02" title="Báo cáo hoạt động chính" value={Math.round(Math.min(100, state.activities.length / 3 * 100))} tone="orange" /><Progress no="03" title="Kết luận" value={Math.round(progress.conclusionFields / 8 * 100)} tone="purple" /></div><div className="panel"><Head title="Việc cần làm tiếp theo" sub="Ưu tiên để hoàn thiện hồ sơ" /><Task done={progress.planComplete === 12} text="Hoàn thiện kế hoạch 12 tuần" sub={`${progress.planComplete}/12 tuần đã đủ nội dung`} href="/ke-hoach" /><Task done={state.activities.length >= 3} text="Tạo ít nhất 3 hoạt động chính" sub={`${state.activities.length}/3 hoạt động`} href="/hoat-dong" /><Task done={!!state.conclusion.lessons} text="Bổ sung bài học kinh nghiệm" sub="Phần 3 · Kết luận" href="/ket-luan" /></div></section></>;
}
function Stat({ icon, value, label, note }: { icon: string; value: string | number; label: string; note: string }) { return <div className="stat"><span>{icon}</span><strong>{value}</strong><b>{label}</b><small>{note}</small></div>; }
function Head({ title, sub }: { title: string; sub: string }) { return <div className="panel-head"><h3>{title}</h3><p>{sub}</p></div>; }
function Progress({ no, title, value, tone = "green" }: { no: string; title: string; value: number; tone?: string }) { return <div className="progress"><span className={tone}>{no}</span><div><b>{title}</b><i><em className={tone} style={{ width: `${value}%` }} /></i></div><strong>{value}%</strong></div>; }
function Task({ done, text, sub, href }: { done: boolean; text: string; sub: string; href: string }) { return <Link className="task" href={href}><span className={done ? "done" : ""}>{done ? "✓" : ""}</span><div><b>{text}</b><small>{sub}</small></div><em>›</em></Link>; }

function Logs({ state, update }: { state: AppState; update: (fn: (s: AppState) => AppState) => void }) {
  const [query, setQuery] = useState(""), [week, setWeek] = useState(0), [workType, setWorkType] = useState(""), [editing, setEditing] = useState<DailyLog | null>(null);
  const workTypes = Array.from(new Set(state.dailyLogs.map(log => log.workType).filter(Boolean))).sort((a, b) => a.localeCompare(b, "vi"));
  const filtered = state.dailyLogs.filter(l => (!week || l.week === week) && (!workType || l.workType === workType) && `${l.title} ${l.assignedWork} ${l.tags.join(" ")}`.toLowerCase().includes(query.trim().toLowerCase()));
  const blank = (): DailyLog => ({ id: uid(), internshipId: state.internship.id, date: today(), week: 1, title: "", assignedWork: "", actionsTaken: "", relatedDocuments: "", tools: "", appliedKnowledge: "", result: "", difficulties: "", resolution: "", lessonsLearned: "", additionalNotes: "", workType: "", tags: [], files: [], sensitive: false, createdAt: iso(), updatedAt: iso() });
  const save = (log: DailyLog) => update(s => ({ ...s, dailyLogs: s.dailyLogs.some(x => x.id === log.id) ? s.dailyLogs.map(x => x.id === log.id ? { ...log, updatedAt: iso() } : x) : [{ ...log, updatedAt: iso() }, ...s.dailyLogs] }));
  return <><Title eyebrow="DỮ LIỆU THỰC TẾ" title="Nhật ký hằng ngày" desc="Ghi lại sự kiện đúng như bạn đã thực hiện; hệ thống sẽ dùng chúng cho báo cáo." action={<button className="primary-btn" onClick={() => setEditing(blank())}>＋ Thêm nhật ký</button>} />
  <div className="toolbar"><label className="search">⌕<input aria-label="Tìm nhật ký" value={query} onChange={e => setQuery(e.target.value)} placeholder="Tìm công việc hoặc thẻ…" /></label><select aria-label="Lọc theo tuần" value={week} onChange={e => setWeek(+e.target.value)}><option value={0}>Tất cả 12 tuần</option>{Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>Tuần {i + 1}</option>)}</select><select aria-label="Lọc theo loại công việc" value={workType} onChange={e => setWorkType(e.target.value)}><option value="">Mọi loại công việc</option>{workTypes.map(type => <option key={type}>{type}</option>)}</select><span>{filtered.length} bản ghi</span></div>
  <div className="log-list">{filtered.map(log => <article className="log-card" key={log.id}><div className="date"><b>{new Date(log.date).getDate()}</b><span>TH{new Date(log.date).getMonth() + 1}</span></div><div className="log-body"><small>TUẦN {log.week} · {log.workType || "CHƯA PHÂN LOẠI"}</small><h3>{log.title}</h3><p>{log.actionsTaken || log.assignedWork}</p><div className="tags">{log.tags.map(t => <span key={t}>{t}</span>)}</div></div><div className="card-actions"><button onClick={() => setEditing(log)}>Sửa</button><button onClick={() => setEditing({ ...log, id: uid(), title: `${log.title} (bản sao)`, createdAt: iso() })}>Nhân bản</button><button className="danger" onClick={() => confirm("Xoá nhật ký này?") && update(s => ({ ...s, dailyLogs: s.dailyLogs.filter(x => x.id !== log.id), activities: s.activities.map(a => ({ ...a, dailyLogIds: a.dailyLogIds.filter(id => id !== log.id) })) }))}>Xoá</button></div></article>)}{!filtered.length && <Empty text="Chưa có nhật ký phù hợp bộ lọc." />}</div>
  {editing && <LogModal log={editing} onClose={() => setEditing(null)} onSave={log => { save(log); setEditing(null); }} />}</>;
}
function LogModal({ log, onClose, onSave }: { log: DailyLog; onClose: () => void; onSave: (l: DailyLog) => void }) {
  const [form, setForm] = useState(log), set = (key: keyof DailyLog, value: unknown) => setForm(f => ({ ...f, [key]: value }));
  const fields: [keyof DailyLog, string][] = [["assignedWork", "Mô tả ngắn công việc được giao"], ["actionsTaken", "Tôi đã thực hiện những gì"], ["relatedDocuments", "File / chứng từ / tài liệu liên quan"], ["tools", "Công cụ / phần mềm sử dụng"], ["appliedKnowledge", "Kiến thức hoặc kỹ năng áp dụng"], ["result", "Kết quả"], ["difficulties", "Khó khăn gặp phải"], ["resolution", "Cách xử lý"], ["lessonsLearned", "Điều học được"], ["additionalNotes", "Ghi chú thêm"]];
  return <Modal title={log.title ? "Chỉnh sửa bản ghi" : "Thêm nhật ký mới"} onClose={onClose} onSubmit={() => form.title.trim() && onSave({ ...form, title: form.title.trim(), tags: Array.from(new Set(form.tags.map(tag => tag.trim()).filter(Boolean))) })} footer="Tự động lưu trên Vercel sau khi xác nhận"><div className="form-grid">
    <Field label="Ngày"><input type="date" value={form.date} onChange={e => set("date", e.target.value)} required /></Field>
    <Field label="Tuần thực tập"><select value={form.week} onChange={e => set("week", +e.target.value)}>{Array.from({ length: 12 }, (_, i) => <option key={i}>{i + 1}</option>)}</select></Field>
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
  return <Modal title={activity.name ? "Chỉnh sửa hoạt động" : "Tạo từ nhật ký"} onClose={onClose} onSubmit={() => form.name.trim() && onSave({ ...form, name: form.name.trim() })} footer="Phụ lục sẽ được liên kết ở giai đoạn 2"><div className="form-grid">
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
function Settings({ state, setState }: { state: AppState; setState: (s: AppState) => void }) { const update = (fn: (s: AppState) => AppState) => setState(fn(state)); return <><Title eyebrow="CÁ NHÂN HOÁ" title="Cài đặt" desc="Quản lý hồ sơ và dữ liệu trên Vercel." /><div className="settings"><section className="panel"><h3>Hồ sơ thực tập</h3><Field label="Họ và tên"><input value={state.profile.fullName} onChange={e => setState({ ...state, profile: { ...state.profile, fullName: e.target.value } })} /></Field><Field label="Đơn vị thực tập"><input value={state.internship.organization} onChange={e => setState({ ...state, internship: { ...state.internship, organization: e.target.value } })} /></Field></section><section className="panel"><h3>Dữ liệu trên Vercel</h3><p>Mọi thay đổi được tự động lưu trên Vercel.</p><button className="danger-btn clear-data-btn" onClick={() => confirm("Xoá toàn bộ nội dung nhật ký trên Vercel?") && setState(resetState(false))}>Xoá dữ liệu và bắt đầu trống</button></section></div><ScheduleFields state={state} update={update} /></>; }
function Soon({ view }: { view: View }) { const names: Record<string, string> = { references: "Tài liệu tham khảo", appendices: "Phụ lục", preview: "Xem trước tài liệu" }; return <><Title eyebrow="GIAI ĐOẠN 2" title={names[view]} desc="Cấu trúc dữ liệu đã sẵn sàng; tính năng tài liệu sẽ được triển khai ở giai đoạn kế tiếp." /><div className="coming"><span>⌁</span><h2>Đã có trong lộ trình giai đoạn 2</h2><p>Bản xem trước A4, phần kiểm tra yêu cầu hoàn chỉnh, chức năng xuất Word và PDF sẽ dùng chung dữ liệu của giai đoạn 1.</p><Link href="/">Về Tổng quan</Link></div></>; }
type TranslationControl = { text: string; onTranslated: (value: string) => void };
function Field({ label, children, wide = false, translate }: { label: string; children: React.ReactNode; wide?: boolean; translate?: TranslationControl }) { return <label className={wide ? "field wide" : "field"}><span>{label}{translate && <TranslateButton {...translate} />}</span>{children}</label>; }
function TranslateButton({ text, onTranslated }: TranslationControl) {
  const [working, setWorking] = useState(false), [error, setError] = useState("");
  return <><button type="button" className="translate-btn" disabled={working || !text.trim()} onClick={event => { event.preventDefault(); event.stopPropagation(); setWorking(true); setError(""); void translateToEnglish(text).then(onTranslated).catch(reason => setError(reason instanceof Error ? reason.message : "Không thể dịch.")).finally(() => setWorking(false)); }}>{working ? "Đang dịch…" : "VI → EN"}</button>{error && <small className="translate-error" title={error}>!</small>}</>;
}
function Empty({ text }: { text: string }) { return <div className="empty"><span>＋</span><p>{text}</p></div>; }
function Modal({ title, onClose, onSubmit, footer, children }: { title: string; onClose: () => void; onSubmit: () => void; footer: string; children: React.ReactNode }) { return <div className="modal-back"><form className="modal" onSubmit={e => { e.preventDefault(); onSubmit(); }}><div className="modal-head"><div><small>NHẬT KÝ THỰC TẬP</small><h2>{title}</h2></div><button type="button" onClick={onClose}>×</button></div>{children}<div className="modal-foot"><span>● {footer}</span><button type="button" className="ghost-btn" onClick={onClose}>Huỷ</button><button className="primary-btn">Lưu</button></div></form></div>; }
