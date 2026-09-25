# BilaBot — Giao diện và Hono trên cùng Cloudflare Pages

BilaBot là trợ lý giọng nói XiaoZhi AI tiếng Việt dựa trên [Olivia AI](https://github.com/roalfb/olivia-ai) (MIT), hỗ trợ thiết bị ESP32 ảo, mã kích hoạt OTA **thực**, WebSocket, Opus/WASM, STT/TTS và MCP. Không cần đăng nhập Google riêng trong BilaBot.

**Điểm truy cập:** https://xulytiengviet.github.io/Bilabot/ — khi chủ dự án cấu hình địa chỉ Cloudflare Pages thật, URL này tự điều hướng tới ứng dụng đầy đủ. GitHub Pages thuần không thể chạy Hono hoặc gắn custom WebSocket headers.

## Giao diện Olivia-style Studio

Landing BilaBot được thiết kế như không gian trò chuyện AI: thanh bên đa trợ lý minh họa, khung hội thoại, tông màu đêm tím-xanh, hiệu ứng âm thanh, thẻ ghép nối nổi bật và bố cục tối ưu máy tính lẫn điện thoại. Giao diện ứng dụng trợ lý thật nằm bên trong `docs/static/app.js`; phần minh họa trang chủ được đánh dấu rõ để không nhầm với kết nối thực.

**Luồng người dùng:** mở `https://xulytiengviet.github.io/Bilabot/#bb-setup` → đăng nhập riêng tại XiaoZhi.me → nhấn **Lấy mã kích hoạt** → xem mã do OTA trả về → **Sao chép mã** và nhập trong phần thêm thiết bị của AI Agent trên XiaoZhi → BilaBot tự thăm dò kết quả, kiểm tra lại OTA và nhận token thiết bị → đợi WebSocket nhận `hello` → giao diện trò chuyện tự mở. Trong khi chờ, trang hiển thị tiến trình và thời hạn mã. Có nút hủy và thử lại.

**Không tạo mã giả:** nếu máy chủ chưa cấp mã, proxy chưa triển khai, Turnstile lỗi hoặc ghép nối hết hạn, BilaBot hiển thị thông báo cụ thể. Nút kiểm tra gateway đọc `GET /api/health`; chỉ coi gateway sẵn sàng khi `ready:true` và có Turnstile site key.

**Triển khai bắt buộc để nhận mã thật:** trang GitHub Pages chỉ phục vụ HTML/CSS/JS. Cần kết nối cùng repository vào **Cloudflare Pages** bằng `npm run build:pages` (thư mục `dist`), cấu hình Turnstile và ba secret như [hướng dẫn](docs/SETUP.md), rồi khai báo `CLOUDFLARE_PAGES_URL` cho GitHub Actions để điểm truy cập GitHub tự chuyển sang ứng dụng có Hono. Có thể nhập URL gateway thủ công trong phần Cấu hình nâng cao nếu muốn giữ trang GitHub Pages (đồng thời cần cấu hình origin tương ứng trên gateway).

**Kiểm thử:** `npm test` bao gồm kiểm thử mô phỏng OTA thực giả lập, xác nhận sau OTA/check, mã có số 0 đầu, sao chép, trạng thái, hủy ghép nối và cấu trúc responsive. Đây không thay thế kiểm thử OTA trực tiếp sau khi Cloudflare và XiaoZhi đã được thiết lập.

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
