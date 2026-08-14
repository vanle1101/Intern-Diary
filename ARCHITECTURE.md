# Kiến trúc Phase 1 — Nhật ký thực tập UEH

## Phân tích phạm vi

Phase 1 tập trung vào một nguồn dữ liệu cá nhân, local-first: Dashboard, Daily Log, kế hoạch 12 tuần, hoạt động chính và kết luận. Mọi dữ liệu nghiệp vụ đi qua một `AppState` có version; UI không truy cập trực tiếp `localStorage`. Cách tách này cho phép thay adapter lưu trữ bằng Supabase/PostgreSQL mà không đổi component.

Các nguyên tắc không được phá vỡ:

- Kế hoạch và kết quả thực tế là hai dữ liệu độc lập; kết quả không ghi đè kế hoạch.
- Activity chỉ tham chiếu Daily Log bằng id, nên một log có thể được gom và truy vết.
- AI tương lai chỉ nhận dữ liệu người dùng đã chọn, không nhận file mặc định và không được bổ sung sự kiện.
- Nội dung nhạy cảm được đánh dấu tại record; bước ẩn danh hoá sẽ nằm trước bước gửi AI/xuất tài liệu.

## Cấu trúc thư mục

```text
app/                    route, metadata và style toàn cục
components/             App shell và các màn hình nghiệp vụ
lib/models.ts           mô hình dữ liệu đầy đủ
lib/seed.ts             dữ liệu demo có thể xoá
lib/storage.ts          adapter local-first có version
public/                 tài nguyên tĩnh
```

Khi nâng cấp cloud: thêm `server/repositories`, schema PostgreSQL và API route; giữ nguyên types và props ở tầng UI.

## Data model

- `Profile`: thông tin sinh viên, trường/khoa/ngành.
- `Internship`: kỳ thực tập, công ty, vị trí, mốc 12 tuần.
- `InternshipPlan`: kế hoạch theo tuần với đủ 6 cột UEH.
- `DailyLog`: đủ tất cả trường công việc, kết quả, khó khăn, bài học, tag, file metadata và cờ nhạy cảm.
- `Activity`: mô tả hoạt động chính và quan hệ nhiều-nhiều qua `dailyLogIds` (`ActivityDailyLog` khi chuyển sang SQL).
- `WeeklySummary`: tóm tắt tuần, bản nháp AI và trạng thái duyệt.
- `Conclusion`: bảng so sánh 12 tuần và 8 phần tổng kết.
- `Reference`, `Appendix`, `Settings`: đã định nghĩa sẵn cho các phase sau.

## Routes/pages

`/`, `/nhat-ky`, `/ke-hoach`, `/hoat-dong`, `/ket-luan`, `/tai-lieu-tham-khao`, `/phu-luc`, `/xem-truoc`, `/kiem-tra`, `/cai-dat`.

## Component chính

`InternshipApp`, `DashboardView`, `DailyLogView`, `PlanView`, `ActivityView`, `ConclusionView`, `ComplianceView`, `SettingsView`.

