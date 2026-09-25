# BilaBot GitHub Pages — triển khai để người dùng đăng nhập Google

Giao diện https://xulytiengviet.github.io/Bilabot/ kế thừa Olivia AI (MIT), có landing page tiếng Việt, trợ lý đa phiên, Google Identity Services và tự kích hoạt thiết bị ảo bằng giao thức XiaoZhi OTA.

**Chủ repository cấu hình một lần; khách chỉ cần đăng nhập Google.**

1. Google Cloud Console → APIs & Services → Credentials → OAuth Client ID → Web application. Thêm `https://xulytiengviet.github.io` (không có `/Bilabot`) vào Authorized JavaScript origins.
2. Triển khai [Cloudflare Worker](../worker/README.md) ở thư mục `worker/`. Đặt `GOOGLE_CLIENT_ID` trùng Google Web Client ID, `SESSION_SECRET` là chuỗi ngẫu nhiên ít nhất 32 ký tự, `TICKET_KEY` là chuỗi hex 64 ký tự. PAGE_ORIGIN mặc định là `https://xulytiengviet.github.io`.
3. Điền hai giá trị công khai `googleClientId`, `workerUrl` vào `docs/config.js`. Không commit secrets hay mật khẩu vào GitHub.
4. Repository → Settings → Pages → chọn GitHub Actions nếu chưa bật. Workflow `.github/workflows/pages.yml` đăng toàn bộ thư mục `docs/`.
5. Người dùng vào site → Đăng nhập Google → Worker xác thực chữ ký Google → BilaBot tạo Device-ID, gọi OTA/check. **Máy chủ XiaoZhi mới là bên cấp mã kích hoạt**, không phải Google. Người dùng đăng nhập https://xiaozhi.me/console/login?redirect=%2Fconsole%2F rồi thêm thiết bị/nhập mã một lần. Sau đó BilaBot nhận token thiết bị, mở WSS qua vé AES-GCM và trò chuyện Opus, STT/TTS, MCP.

Nếu thiếu Worker hay Google Client ID, giao diện **không giả vờ cấp mã**. Người dùng tự triển khai có thể nhập hai cấu hình công khai trong mục Tự cấu hình để thử backend riêng (hai giá trị được lưu trên trình duyệt).

Giới hạn: GitHub Pages không chạy server-side; cần Cloudflare Worker cho Google ID token verification, OTA CORS và WebSocket custom headers. Đây không phải SSO trực tiếp vào XiaoZhi, tài khoản XiaoZhi vẫn phải ghép nối.