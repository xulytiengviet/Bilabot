# BilaBot Gateway — Cloudflare Worker

Proxy tự lưu trữ cho frontend GitHub Pages `https://xulytiengviet.github.io/Bilabot/`.

## Yêu cầu

- Tài khoản Cloudflare và `npx wrangler login`
- Google Cloud OAuth 2.0 **Web application Client ID** (không phải Gmail API)
- Thêm origin `https://xulytiengviet.github.io` vào Authorized JavaScript origins
- Có tài khoản XiaoZhi tại `https://xiaozhi.me`

## Thiết lập

```bash
cd worker
npm install
npx wrangler login
npx wrangler secret put GOOGLE_CLIENT_ID
# Dán YOUR_CLIENT_ID.apps.googleusercontent.com
npx wrangler secret put SESSION_SECRET
# Dán một chuỗi ngẫu nhiên >=32 ký tự, VD: openssl rand -base64 48
npx wrangler secret put TICKET_KEY
# Dán chuỗi HEX 64 ký tự tạo bằng openssl rand -hex 32
npm run deploy
```

Sao chép địa chỉ Worker dạng `https://bilabot-gateway.<your-account>.workers.dev`.
Đặt tên miền đó và Google Client ID công khai vào `docs/config.js` ở repository chính:

```js
window.BILABOT_CONFIG = Object.freeze({
  workerUrl: 'https://bilabot-gateway.YOUR-ACCOUNT.workers.dev',
  googleClientId: 'YOUR_CLIENT_ID.apps.googleusercontent.com',
  autoPair: true
});
```

Không commit `SESSION_SECRET`, `TICKET_KEY`, Gmail password hoặc access token vào GitHub.
Nếu không muốn sửa config.js, có thể nhập hai **giá trị công khai** trên giao diện “Tự cấu hình” lưu riêng trong trình duyệt.

## Luồng

Google Identity Services → mã JWT (ID token) → Worker kiểm tra chữ ký RS256 bằng Google JWKS, issuer, audience, hạn dùng, email verified → session HMAC 1 giờ. OTA/check trả **mã kích hoạt XiaoZhi thực** (nếu thiết bị chưa ghép nối). Người dùng nhập mã tại bảng điều khiển XiaoZhi một lần. OTA/activate báo 200, client lấy device token và WS URL. Client lấy opaque AES-GCM WS ticket 60 giây, sau đó nối WSS với Worker. Worker thêm custom headers và relay Opus/JSON/MCP tới máy chủ XiaoZhi.

Google không phát hành mã ghép nối XiaoZhi. Cách triển khai này không sử dụng cookie đăng nhập XiaoZhi và không hứa SSO xuyên tên miền.

## Kiểm thử

```bash
cd worker
npx wrangler dev
```

Truy cập frontend `https://xulytiengviet.github.io/Bilabot/`; Worker chỉ chấp nhận Origin cấu hình `PAGE_ORIGIN`. Bạn có thể thêm `http://localhost:8000` vào `PAGE_ORIGIN` phân tách bằng dấu phẩy khi phát triển. Với Production, cấu hình Cloudflare Rate Limiting và quan sát log **không ghi token**. Lưu ý cookie đăng nhập Google độc lập với tài khoản XiaoZhi.
