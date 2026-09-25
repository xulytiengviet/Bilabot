# Cloudflare Worker tối giản cho BilaBot (không đăng nhập Google lần hai)

Người dùng đăng nhập Google **chỉ tại** [xiaozhi.me/console/agents](https://xiaozhi.me/console/agents). Worker không nhận cookie của trang này, không lấy access token Google, không truy cập Gmail và không cấp mã kích hoạt XiaoZhi. Đây chỉ là cầu nối giao thức thiết bị cho browser và bảo vệ bằng **Cloudflare Turnstile** chống truy cập ồ ạt.

## Vì sao cần Worker khi kết nối XiaoZhi chính thức?

ESP32 gửi OTA với `Activation-Version`, `Device-Id`, `Client-Id`; WebSocket yêu cầu custom `Authorization`, `Protocol-Version`, `Device-Id`, `Client-Id`. Browser thông thường không tự tạo được tất cả handshake headers trên WebSocket, còn CORS có thể chặn OTA/vision từ GitHub Pages. Worker chỉ chuyển tiếp các request này, còn Opus, UI, MCP vẫn ở phía trình duyệt.

## Thiết lập Cloudflare

1. Trên Cloudflare Turnstile, tạo site với hostname `xulytiengviet.github.io`. Sao chép **site key** (công khai) và **secret key** (bí mật).
2. Điền `TURNSTILE_SITE_KEY` công khai vào `worker/wrangler.toml`:
   ```toml
   [vars]
   PAGE_ORIGIN = "https://xulytiengviet.github.io"
   TURNSTILE_SITE_KEY = "YOUR_PUBLIC_TURNSTILE_SITE_KEY"
   ```
3. Trong thư mục `worker/`:
   ```bash
   npm install
   npx wrangler login
   npx wrangler secret put TURNSTILE_SECRET
   npx wrangler secret put SESSION_SECRET
   npx wrangler secret put TICKET_KEY
   npm run deploy
   ```
   `SESSION_SECRET` phải dài tối thiểu 32 ký tự, có thể tạo bằng `openssl rand -base64 48`. `TICKET_KEY` là chuỗi 64 ký tự HEX tạo bằng `openssl rand -hex 32`.
4. Chép URL Worker công khai vào `docs/config.js`:
   ```js
   window.BILABOT_CONFIG = Object.freeze({
     workerUrl: 'https://bilabot-gateway.YOUR-SUBDOMAIN.workers.dev',
     mode: 'gateway',
     autoPair: false
   });
   ```
5. Bật GitHub Pages (Actions) trên repository. Người dùng không cần điền bất cứ khóa hay client ID nào.

## Luồng xác thực và truyền dữ liệu

```text
[XiaoZhi official Google login] -- riêng trên xiaozhi.me/console/agents
[BilaBot GitHub Pages] -- Cloudflare Turnstile --> [BilaBot Worker]
[Worker] -- Session HMAC 1 giờ --> [Browser]
[Browser] -- OTA check (Device-ID/Client-ID) --> [Worker] --> [XiaoZhi OTA]
[XiaoZhi OTA] -- activation.code --> [BilaBot hiện mã]
[User] -- nhập mã trên xiaozhi.me/console/agents --> [XiaoZhi kích hoạt thiết bị]
[BilaBot] -- OTA activate/check --> [XiaoZhi cấp token thiết bị, WSS URL]
[BilaBot] -- WS ticket AES-GCM 60s --> [Worker] --> [XiaoZhi WSS với header]
```

Người dùng thấy mã **chỉ khi máy chủ OTA trả mã thật**. Không tạo mã ngẫu nhiên giả lập. Worker không thể tự biết người dùng đã đăng nhập Google trên tab khác.

## Giới hạn bảo mật

Origin check không phải cơ chế chống lạm dụng duy nhất; Cloudflare Turnstile được bắt buộc trước khi cấp session. Thiết lập thêm WAF/rate limits cho `/api/auth/session`, `/api/ota/*`, `/api/ws-ticket` và WebSocket; tránh ghi secrets và payload vào access logs. Token thiết bị nằm ở trình duyệt và Worker nhận ngắn hạn để tạo header cho endpoint chính thức. Sử dụng HTTPS, không chia sẻ mã và token trên máy công cộng.

Để vận hành hoàn toàn **không gateway**, cần máy chủ XiaoZhi tương thích với browser, công khai CORS và cơ chế xác thực qua WebSocket API trình duyệt; phiên cookie trên xiaozhi.me không thể chia sẻ với github.io.
