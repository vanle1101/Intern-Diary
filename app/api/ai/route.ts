import { NextResponse } from "next/server";

type AiAction = "rewrite" | "weekly_summary" | "activity_draft" | "conclusion_draft" | "review";

const instructions: Record<AiAction, string> = {
  rewrite: "Viết lại ghi chú thành văn phong phù hợp với Nhật ký thực tập đại học.",
  weekly_summary: "Tổng hợp các Daily Log thành bản tổng kết tuần có cấu trúc rõ ràng.",
  activity_draft: "Tổng hợp các Daily Log liên quan thành bản nháp mô tả một hoạt động chính.",
  conclusion_draft: "Tổng hợp dữ liệu đã cung cấp thành bản nháp kết luận thực tập.",
  review: "Rà soát và chỉ ra nội dung sơ sài, thiếu kết quả, bài học, quy trình hoặc không nhất quán.",
};

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Chưa cấu hình GEMINI_API_KEY." }, { status: 503 });

  const body = await request.json().catch(() => null) as { action?: AiAction; sourceData?: unknown; instruction?: string } | null;
  if (!body?.action || !(body.action in instructions) || body.sourceData == null) {
    return NextResponse.json({ error: "Thiếu action hoặc sourceData hợp lệ." }, { status: 400 });
  }
  const serialized = JSON.stringify(body.sourceData);
  if (serialized.length > 120_000) return NextResponse.json({ error: "Dữ liệu vượt giới hạn 120.000 ký tự." }, { status: 413 });

  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.GEMINI_MODEL ?? "gemini-3.6-flash",
      messages: [
        { role: "system", content: "Bạn hỗ trợ viết Nhật ký thực tập tốt nghiệp ngành Kiểm toán. Chỉ được dùng dữ liệu người dùng cung cấp. Tuyệt đối không tự tạo số liệu, tên khách hàng, chứng từ, thủ tục hoặc công việc. Nếu dữ liệu thiếu, đánh dấu [CẦN BỔ SUNG]. Không suy đoán thông tin nhạy cảm. Trả lời bằng tiếng Việt, văn phong học thuật tự nhiên." },
        { role: "user", content: `${instructions[body.action]}\n${body.instruction ?? ""}\n\nDỮ LIỆU NGUỒN:\n${serialized}` },
      ],
    }),
  });
  const payload = await response.json().catch(() => null) as { choices?: { message?: { content?: string } }[]; error?: { message?: string } } | null;
  if (!response.ok) return NextResponse.json({ error: payload?.error?.message ?? "Gemini API không phản hồi thành công." }, { status: response.status });
  return NextResponse.json({ text: payload?.choices?.[0]?.message?.content ?? "", model: process.env.GEMINI_MODEL ?? "gemini-3.6-flash" });
}
