# BilaBot — trợ lý XiaoZhi AI và bảng điều khiển đơn sắc

BilaBot là ứng dụng trợ lý giọng nói tiếng Việt chạy trên trình duyệt, phát triển dựa trên [Olivia AI](https://github.com/roalfb/olivia-ai) (MIT). BilaBot hỗ trợ nhiều trợ lý, thiết bị ESP32 ảo, mã OTA **do XiaoZhi cấp**, WebSocket, Opus, STT/TTS và MCP.

**Mở ứng dụng:** https://xulytiengviet.github.io/Bilabot/  
**Bảng điều khiển tiếng Việt:** https://xulytiengviet.github.io/Bilabot/#bb-dashboard  
**Lấy mã và ghép nối:** https://xulytiengviet.github.io/Bilabot/#bb-setup

## Dashboard cài đặt đơn sắc (đen · trắng · xám)

Dashboard hiển thị trực tiếp trong giao diện trợ lý kiểu Olivia AI. Trên thanh bên hoặc tiêu đề hội thoại, nhấn **Cài đặt / Bảng điều khiển**. Bảy mục được Việt hóa: **Tổng quan**, **Trợ lý AI**, **Kết nối XiaoZhi**, **Thiết bị ảo**, **Giao thức**, **Giọng nói** và **Sao lưu & dữ liệu**.

- **Tổng quan:** tên và số lượng trợ lý, trạng thái ghép nối, WebSocket và gateway; truy cập nhanh màn hình nhận mã OTA.
- **Kết nối XiaoZhi:** nhập URL Cloudflare Pages gateway HTTPS, kiểm tra `GET /api/health`, lưu cấu hình, chỉnh WebSocket / OTA cho từng trợ lý, mở giao diện nhập mã.
- **Thiết bị / Giao thức / Giọng nói:** chỉnh Device ID (MAC), Client ID (UUID), phiên bản giao thức, khung âm thanh, chế độ lắng nghe, micro và TTS.
- **Dữ liệu:** sử dụng đúng chức năng xuất/nhập backup JSON đã có của Olivia/BilaBot. Các ID điều khiển và cơ chế lưu hiện hữu được giữ nguyên.

Giao diện di động có thanh chọn mục ngang và bảng cài đặt toàn màn hình. Nút **Lấy mã OTA** mở lại cửa sổ ghép nối ngay trong BilaBot; mã có số 0 ở đầu được giữ nguyên, có nút sao chép và theo dõi phản hồi ghép nối. Chỉ xác nhận kết nối sau khi XiaoZhi trả `hello` qua WebSocket.

## Kiến trúc và triển khai

```text
GitHub Pages — UI Olivia + Dashboard tiếng Việt
                 │  HTTPS/CORS/WebSocket ticket
                 ▼
Cloudflare Pages — giao diện + Hono gateway
                 │  OTA / WebSocket / âm thanh
                 ▼
        Máy chủ XiaoZhi chính thức
```

GitHub Pages **không thể tự chạy Hono hoặc thêm custom WebSocket headers**. Cần triển khai Cloudflare Pages từ cùng repository và cấu hình Turnstile/secrets trước khi nhận mã OTA thật. Điểm truy cập GitHub **không tự chuyển hướng**: frontend sử dụng `CLOUDFLARE_PAGES_URL` hoặc URL gateway bạn tự nhập tại Dashboard. Cloudflare phải cho phép origin `https://xulytiengviet.github.io` và Turnstile phải hỗ trợ hostname đang chạy.

[Hướng dẫn Cloudflare Pages chi tiết](docs/SETUP.md).

```bash
npm ci
npm test
npm run build:pages
npx wrangler pages dev dist
```

**Giới hạn:** Khi chưa cấu hình gateway, nút kiểm tra sẽ thông báo chưa sẵn sàng; không tạo mã hoặc báo ghép nối giả. Không yêu cầu mật khẩu, access token Google hay cookie của tài khoản XiaoZhi. Token thiết bị có thể lưu cục bộ trên trình duyệt; chỉ sử dụng gateway do bạn tin cậy. Đăng nhập XiaoZhi riêng tại https://xiaozhi.me/console/agents.

BilaBot là dự án độc lập, không phải sản phẩm chính thức của XiaoZhi. Xem [LICENSE](LICENSE) và [chính sách quyền riêng tư](docs/privacy-policy.html).
