# BilaBot — Giao diện và Hono trên cùng Cloudflare Pages

BilaBot là trợ lý giọng nói XiaoZhi AI tiếng Việt dựa trên [Olivia AI](https://github.com/roalfb/olivia-ai) (MIT), hỗ trợ thiết bị ESP32 ảo, mã kích hoạt OTA **thực**, WebSocket, Opus/WASM, STT/TTS và MCP. Không cần đăng nhập Google riêng trong BilaBot.

**Điểm truy cập:** https://xulytiengviet.github.io/Bilabot/ — khi chủ dự án cấu hình địa chỉ Cloudflare Pages thật, URL này tự điều hướng tới ứng dụng đầy đủ. GitHub Pages thuần không thể chạy Hono hoặc gắn custom WebSocket headers.

## Kiến trúc

```text
GitHub Pages (điểm truy cập) → Cloudflare Pages (một dự án)
                                  ├─ docs/: landing và web app tiếng Việt
                                  └─ _worker.js: Hono → OTA/WS/vision relay
                                                           │
                                                           ▼
                                                   XiaoZhi chính thức
```

Trình duyệt xử lý UI, Web Audio, Opus WASM và MCP. Hono gắn Device-Id, Client-Id và Authorization khi bắt tay WebSocket. Gateway yêu cầu Turnstile, HMAC transport session và vé WebSocket AES-GCM 60 giây; không đưa token thiết bị thô vào URL. Người dùng đăng nhập Google **chỉ trên** https://xiaozhi.me/console/agents và nhập mã thực do OTA trả về. BilaBot không thể đọc cookie phiên XiaoZhi.

## Chạy thử và triển khai

```bash
npm ci
npm test
npm run build:pages
npx wrangler pages dev dist
```

Kết nối repo `xulytiengviet/Bilabot` với Cloudflare Pages (Git integration, nhánh `main`): build `npm run build:pages`, output `dist`, Node 22. Cấu hình Turnstile và ba secret trên Cloudflare; sau khi site thật hoạt động, đặt GitHub Actions variable `CLOUDFLARE_PAGES_URL` để tự điều hướng địa chỉ GitHub Pages. Hướng dẫn 3 bước: [docs/SETUP.md](docs/SETUP.md).

**Bảo mật:** Không lưu mật khẩu, Google token hoặc XiaoZhi website cookie trong BilaBot. Token thiết bị và hội thoại có thể lưu cục bộ trên thiết bị người dùng. Bật WAF/rate-limiting khi triển khai công khai. Phần mềm độc lập, không phải sản phẩm chính thức XiaoZhi. Xem [chính sách quyền riêng tư](docs/privacy-policy.html) và [LICENSE](LICENSE).
