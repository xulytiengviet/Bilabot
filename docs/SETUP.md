# BilaBot · Thiết lập Google GIS, XiaoZhi và GitHub Pages

Luồng: Google Identity Services (BilaBot) → đăng nhập riêng trên XiaoZhi → OTA nhận mã thực → ghép nối AI Agent → WebSocket / Opus / STT / TTS / MCP.

**Hai phiên đăng nhập độc lập:** Google GIS chỉ xác thực tại BilaBot. Trang GitHub Pages không thể sử dụng lại cookie, access token hay phiên Google của xiaozhi.me. Chỉ OTA XiaoZhi có quyền cấp mã kích hoạt thiết bị.

## A. Cấu hình Google Identity Services

1. Vào https://console.cloud.google.com/apis/credentials, thiết lập OAuth consent screen và tạo OAuth 2.0 Client ID loại **Web application**.
2. Trong **Authorized JavaScript origins**, khai báo chính xác **https://xulytiengviet.github.io**; khi thử trên localhost thêm **http://localhost:5173**. Không nhập đường dẫn /Bilabot vào trường origin.
3. Điền public Client ID (kết thúc bằng .apps.googleusercontent.com) vào **googleClientId** trong docs/config.js.
4. Điền chính xác cùng public Client ID vào biến **GOOGLE_CLIENT_ID** trong worker/wrangler.toml.

Không bao giờ commit OAuth Client Secret, JWT cá nhân hay cookie. Nút đăng nhập dùng google.accounts.id.initialize() và renderButton(). Google ID token được gửi qua HTTPS tới Worker để xác minh chữ ký từ Google JWKS, audience, issuer và hạn dùng trước khi cấp transport session.

## B. Thiết lập Cloudflare Worker

1. Tạo Cloudflare Turnstile widget với hostname xulytiengviet.github.io, điền site key công khai vào TURNSTILE_SITE_KEY trong worker/wrangler.toml.
2. Giữ PAGE_ORIGIN = "https://xulytiengviet.github.io" và khai báo GOOGLE_CLIENT_ID.
3. Mở terminal ở thư mục worker và chạy lần lượt:

    npm install

    npx wrangler login

    npx wrangler secret put TURNSTILE_SECRET

    npx wrangler secret put SESSION_SECRET

    npx wrangler secret put TICKET_KEY

    npm run deploy

SESSION_SECRET ít nhất 32 ký tự; tạo bằng openssl rand -base64 48. TICKET_KEY đúng 64 ký tự hex; tạo bằng openssl rand -hex 32.

4. Chép URL Worker sau triển khai vào **workerUrl** trong docs/config.js; ví dụ https://bilabot-gateway.YOUR-SUBDOMAIN.workers.dev.
5. Kiểm tra /api/health bằng request có Origin https://xulytiengviet.github.io; phản hồi cần có ready=true, googleConfigured=true và turnstileSiteKey. Truy cập URL trực tiếp không có Origin có thể nhận HTTP 403 theo thiết kế.

**Bảo vệ:** Worker dùng origin allowlist, Turnstile, xác minh Google ID token, relay session 1 giờ và vé WebSocket AES-GCM ngắn hạn. Chỉ cho phép các endpoint XiaoZhi được chỉ định. Bật thêm Cloudflare WAF/rate limit trước khi sử dụng công khai.

## C. Công bố GitHub Pages

Trong repository → Settings → Pages chọn **GitHub Actions**. Workflow .github/workflows/pages.yml xuất bản thư mục docs trên nhánh main lên https://xulytiengviet.github.io/Bilabot/ .

Kiểm tra cú pháp trước khi đẩy lên GitHub:

    node --check docs/auth.js
    node --check docs/static/app.js
    node --check worker/src/index.js

## D. Luồng người dùng

1. Nhấn **Đăng nhập Google** trên BilaBot. Khi Worker xác minh thành công và hoàn tất Turnstile, autoPair=true bắt đầu OTA tự động.
2. Mở https://xiaozhi.me/console/agents, đăng nhập Google **tại trang chính thức**, chọn thêm thiết bị AI Agent.
3. BilaBot hiển thị **mã thực** máy chủ OTA trả về. Nhập mã trên XiaoZhi; BilaBot tự thăm dò OTA/activate, kiểm tra lại OTA/check, nhận URL WSS và device token.
4. Sau ghép nối, trình duyệt sử dụng micro/loa, Opus qua WebSocket, STT/TTS và MCP. Không cần ESP32 vật lý.

Nếu thiếu Worker hoặc sai cấu hình, ứng dụng hiện lỗi và **không tạo mã giả**. Google Client ID chưa điền thì landing vẫn hoạt động ở chế độ xem, chưa có GIS thực. Chế độ direct chỉ dành cho máy chủ tự quản hỗ trợ CORS và xác thực WebSocket từ trình duyệt; không được xem là giải pháp kết nối thẳng với server chính thức.

## E. Khắc phục sự cố và quyền riêng tư

- Google origin_mismatch: origin của OAuth Web Client phải là https://xulytiengviet.github.io, không chứa /Bilabot.
- Worker 503: thiếu secret hoặc Turnstile site key. Google login lỗi: kiểm tra client ID frontend và Worker phải trùng.
- Không nhận mã: kiểm tra /api/ota/check và tab Debug; mã chỉ hợp lệ khi chính OTA trả về.
- WebSocket thất bại: kiểm tra ghép nối, Worker và mã token, vì browser không tự gửi được custom WS headers như ESP32.
- ID token Google chỉ giữ trong bộ nhớ trang, không ghi vào localStorage hay chuyển tới XiaoZhi. Worker xác minh chữ ký, sessionStorage giữ transport session và hồ sơ đã xác minh; localStorage có thể giữ token thiết bị theo cơ chế ứng dụng. Tránh máy dùng chung.

Xem chính sách quyền riêng tư tại docs/privacy-policy.html và upstream Olivia AI (MIT): https://github.com/roalfb/olivia-ai .
