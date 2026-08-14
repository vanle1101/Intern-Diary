# Nhật ký thực tập UEH

Web app cá nhân hỗ trợ ghi chép và hoàn thiện Nhật ký thực tập tốt nghiệp ngành Kiểm toán theo cấu trúc UEH 2026.

## Chạy local

```bash
npm install
cp .env.example .env.local
npm run dev
```

Mở `http://localhost:3000`. Dữ liệu Phase 1 được lưu cục bộ trên trình duyệt.

## Gemini

Đặt `GEMINI_API_KEY` trong `.env.local`. API route `/api/ai` chỉ sử dụng dữ liệu nguồn do người dùng gửi và được ràng buộc không tự tạo sự kiện, số liệu, khách hàng hoặc chứng từ.

## Phạm vi Phase 1

- Dashboard và theo dõi tiến độ.
- Daily Log đầy đủ trường, tìm kiếm, lọc, tag, sửa/xoá/nhân bản.
- Kế hoạch thực tập 12 tuần.
- Gom nhiều Daily Log thành hoạt động chính.
- Editor kết luận và kiểm tra yêu cầu cơ bản.
- Autosave local-first, cờ dữ liệu nhạy cảm.

Chi tiết kiến trúc và data model nằm trong `ARCHITECTURE.md`.
