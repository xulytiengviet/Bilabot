# BilaBot Cloudflare Worker · Google GIS + XiaoZhi

Worker này chỉ là **cổng xác thực và chuyển tiếp giao thức thiết bị**. Google ID token chỉ dùng để xác minh danh tính đăng nhập BilaBot, không được dùng làm XiaoZhi OAuth token. Người dùng vẫn đăng nhập tại https://xiaozhi.me/console/agents, sau đó nhập mã OTA do XiaoZhi thực sự cấp.

## Tại sao cần Worker?

GitHub Pages chỉ phục vụ HTML/CSS/JS tĩnh; browser không tự gửi được các header Authorization, Protocol-Version, Device-Id và Client-Id khi bắt tay WebSocket. XiaoZhi OTA/vision cũng có thể chặn truy cập CORS từ browser. Worker tạo phiên relay có Turnstile + Google GIS, cho phép OTA, thêm header WSS và trả luồng âm thanh nguyên trạng; frontend vẫn xử lý UI, Opus WASM, micro, loa và MCP.

## Cấu hình một lần

1. Google Cloud Console → OAuth Web Client. Authorized JavaScript Origin: https://xulytiengviet.github.io. Chép Client ID công khai, không chép client secret.
2. Cloudflare Turnstile → thêm hostname xulytiengviet.github.io, lấy site key công khai và secret riêng.
3. Mở worker/wrangler.toml, điền PAGE_ORIGIN, GOOGLE_CLIENT_ID và TURNSTILE_SITE_KEY.
4. Cài đặt và khai báo secret:

    npm install
    npx wrangler login
    npx wrangler secret put TURNSTILE_SECRET
    npx wrangler secret put SESSION_SECRET
    npx wrangler secret put TICKET_KEY
    npm run deploy

SESSION_SECRET tối thiểu 32 ký tự (ví dụ openssl rand -base64 48); TICKET_KEY đúng 64 ký tự hex (openssl rand -hex 32). Không đưa secret vào GitHub.

5. Điền URL Worker và cùng Google Client ID trong docs/config.js, mở GitHub Pages. Kiểm tra /api/health bằng request với Origin của GitHub Pages; ready và googleConfigured phải true.

## Security design

- Worker kiểm tra origin allowlist và xác minh Turnstile trước khi cấp session.
- Nếu GOOGLE_CLIENT_ID được đặt, Worker **bắt buộc** có Google ID token hợp lệ; xác minh chữ ký RS256 qua Google JWK được cache tối đa 1 giờ, kiểm tra aud/iss/exp/iat.
- Transport session HMAC hết hạn sau 1 giờ, WebSocket ticket AES-GCM sau 60 giây; không đặt device token thô trong query string.
- OTA/WSS/vision có allowlist upstream. Bật Cloudflare WAF/rate limiting; không lưu log request body, token, audio hay ảnh.
- Google ID token chỉ tồn tại trong memory của tab, được gửi qua HTTPS tới Worker, không chuyển sang XiaoZhi hoặc lưu trong localStorage.
- Origin checking và Turnstile không thay cho xác thực tài khoản XiaoZhi; chính XiaoZhi quản lý AI Agent và kích hoạt thiết bị.

## API

- GET /api/health: ready, googleConfigured, turnstileSiteKey, version.
- POST /api/auth/session: body có turnstileToken và googleIdToken khi bật GIS, trả relay session + hồ sơ đã xác minh.
- GET /api/me: kiểm tra relay session.
- POST /api/ota/check và /api/ota/activate: chuyển tiếp OTA với device identity.
- POST /api/ws-ticket và GET /api/ws: cấp vé ngắn hạn, chuyển tiếp WebSocket và gắn custom headers.
- POST /api/vision/explain: chuyển tiếp ảnh khi người dùng đồng ý.

Tài liệu cài đặt chi tiết: ../docs/SETUP.md.
