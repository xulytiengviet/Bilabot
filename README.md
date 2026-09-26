# BilaBot — trợ lý XiaoZhi AI và bảng điều khiển đơn sắc

BilaBot là ứng dụng trợ lý giọng nói tiếng Việt chạy trên trình duyệt, phát triển dựa trên [Olivia AI](https://github.com/roalfb/olivia-ai) (MIT). BilaBot hỗ trợ nhiều trợ lý, thiết bị ESP32 ảo, mã OTA **do XiaoZhi cấp**, WebSocket, Opus, STT/TTS và MCP.

**Mở ứng dụng:** https://xulytiengviet.github.io/Bilabot/  
**Bảng điều khiển tiếng Việt:** https://xulytiengviet.github.io/Bilabot/#bb-dashboard  
**Lấy mã và ghép nối:** https://xulytiengviet.github.io/Bilabot/#bb-setup

## Sử dụng giống Olivia AI — không cần tự triển khai đối với người dùng

**Người dùng BilaBot:** mở website → chọn trợ lý / nhấn **Lấy mã OTA** → nhận mã sáu chữ số do XiaoZhi cấp → đăng nhập XiaoZhi.me và nhập mã → BilaBot tự theo dõi trạng thái và kết nối WebSocket khi máy chủ xác nhận. Nút Lấy mã trên sidebar, header và Dashboard khởi động OTA bằng một thao tác. Giao diện kiểm tra gateway mặc định tự động; URL gateway và thông số máy chủ chỉ hiện trong vùng **Dành cho quản trị viên**.

**Chủ dự án (chỉ làm một lần):** triển khai Hono lên Cloudflare Pages, cấu hình Turnstile và secret của hệ thống, cho phép origin GitHub Pages rồi đặt `CLOUDFLARE_PAGES_URL` trong GitHub Actions để tất cả người dùng tự dùng gateway đã triển khai. GitHub Pages thuần không thể xử lý OTA/WebSocket chuẩn XiaoZhi; không có cách tự tạo mã từ đăng nhập Google nếu không có yêu cầu OTA của thiết bị ảo.

**Lưu ý:** OliviaAI.dev cũng dùng backend Hono do tác giả đã triển khai sẵn. Olivia gốc không đòi người dùng cấu hình Cloudflare; BilaBot áp dụng cơ chế an toàn bổ sung (Turnstile và phiên gateway), nhưng thao tác đó thuộc về chủ dự án, không phải người sử dụng cuối. Khi `CLOUDFLARE_PAGES_URL` chưa được thiết lập, giao diện có thể xem nhưng chưa thể nhận mã OTA thực.

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
