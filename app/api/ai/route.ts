import { NextRequest, NextResponse } from "next/server";
import { getSession } from "../../../lib/auth";

type AiAction = "rewrite" | "weekly_summary" | "activity_draft" | "conclusion_draft" | "review" | "translate_vi_en" | "assistant";

const instructions: Record<AiAction, string> = {
  rewrite: "Viết lại ghi chú thành văn phong phù hợp với Nhật ký thực tập đại học.",
  weekly_summary: "Tổng hợp các bản ghi nhật ký thành bản tổng kết tuần có cấu trúc rõ ràng.",
  activity_draft: "Tổng hợp các bản ghi nhật ký liên quan thành bản nháp mô tả một hoạt động chính.",
  conclusion_draft: "Tổng hợp dữ liệu đã cung cấp thành bản nháp kết luận thực tập.",
  review: "Rà soát và chỉ ra nội dung sơ sài, thiếu kết quả, bài học, quy trình hoặc không nhất quán.",
  translate_vi_en: "Dịch nguyên văn nội dung từ tiếng Việt sang tiếng Anh tự nhiên, phù hợp văn phong nhật ký thực tập ngành Kiểm toán.",
  assistant: "Trả lời như trợ lý thao tác trong web app Nhật ký thực tập. Ưu tiên hướng dẫn bước tiếp theo thật ngắn, rõ, đúng dữ liệu hiện có.",
};

export async function POST(request: NextRequest) {
  if (!getSession(request)) return NextResponse.json({ error: "Phiên đăng nhập đã hết hạn." }, { status: 401 });
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Chưa cấu hình GEMINI_API_KEY." }, { status: 503 });

  const body = await request.json().catch(() => null) as { action?: AiAction; sourceData?: unknown; instruction?: string } | null;
  if (!body?.action || !(body.action in instructions) || body.sourceData == null) {
    return NextResponse.json({ error: "Thiếu action hoặc sourceData hợp lệ." }, { status: 400 });
  }
  const serialized = JSON.stringify(body.sourceData);
  if (serialized.length > 120_000) return NextResponse.json({ error: "Dữ liệu vượt giới hạn 120.000 ký tự." }, { status: 413 });

  const translating = body.action === "translate_vi_en", assistant = body.action === "assistant";
  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.GEMINI_MODEL ?? "gemini-3.6-flash",
      messages: [
        { role: "system", content: translating
          ? "You are a Vietnamese-to-English translator specializing in economics, accounting and auditing. Use standard professional terminology used in audit working papers and academic internship reports (for example: audit evidence, audit sampling, substantive procedures, internal controls, fixed assets, prepaid expenses, reconciliation, vouching, tracing and review). Preserve every fact, number, Vietnamese account code such as TK 152/TK 211/TK 242, proper noun and line break. Choose the technically correct accounting or auditing meaning when a Vietnamese term is ambiguous. Do not explain, summarize, expand, censor or invent anything. Return only the English translation without quotation marks or Markdown. If the input is already English, return it unchanged."
          : assistant
            ? "Bạn là trợ lý agent trong web app Nhật ký thực tập UEH. Trả lời bằng tiếng Việt, thân thiện, ngắn gọn. Nếu người dùng muốn thao tác trong app, chỉ rõ tab/nơi cần vào. Không bịa dữ liệu nhật ký, công ty, chứng từ hoặc số liệu."
            : "Bạn hỗ trợ viết Nhật ký thực tập tốt nghiệp ngành Kiểm toán. Chỉ được dùng dữ liệu người dùng cung cấp. Tuyệt đối không tự tạo số liệu, tên khách hàng, chứng từ, thủ tục hoặc công việc. Nếu dữ liệu thiếu, đánh dấu [CẦN BỔ SUNG]. Trả lời bằng tiếng Việt, văn phong học thuật tự nhiên." },
        { role: "user", content: translating && typeof body.sourceData === "string"
          ? body.sourceData
          : `${instructions[body.action]}\n${body.instruction ?? ""}\n\nDỮ LIỆU NGUỒN:\n${serialized}` },
      ],
    }),
  });
  const payload = await response.json().catch(() => null) as { choices?: { message?: { content?: string } }[]; error?: { message?: string } } | null;
  if (!response.ok) return NextResponse.json({ error: payload?.error?.message ?? "Gemini API không phản hồi thành công." }, { status: response.status });
  return NextResponse.json({ text: payload?.choices?.[0]?.message?.content ?? "", model: process.env.GEMINI_MODEL ?? "gemini-3.6-flash" });
}
