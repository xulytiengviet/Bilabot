# BilaBot — Web AI trên GitHub Pages

**Giao diện:** https://xulytiengviet.github.io/Bilabot/  
**Mã nguồn:** https://github.com/xulytiengviet/Bilabot  
**Thiết lập Pages + Google OAuth + Cloudflare Worker:** [docs/SETUP.md](docs/SETUP.md)  
**Triển khai Gateway:** [worker/README.md](worker/README.md)

Trang GitHub Pages có landing tiếng Việt theo phong cách Olivia, đăng nhập Google Identity Services, tự chạy OTA provisioning để **nhận mã kích hoạt do máy chủ XiaoZhi cấp**, sau đó ghép nối trên xiaozhi.me và sử dụng WebSocket, Opus, STT/TTS, MCP. Chủ ứng dụng **phải triển khai Cloudflare Worker và cấu hình Google OAuth Client ID** một lần trước khi khách truy cập sử dụng. Google không đăng nhập hộ người dùng vào XiaoZhi; bước ghép nối đầu tiên vẫn bắt buộc.

---

# BilaBot — XiaoZhi Web AI (thiết bị ESP32 ảo)

Ứng dụng giọng nói tiếng Việt trên Chrome, Edge và điện thoại. BilaBot được phát triển dựa trên kiến trúc và mã nguồn [Olivia AI](https://github.com/roalfb/olivia-ai) (MIT), tương thích giao thức [XiaoZhi ESP32](https://github.com/78/xiaozhi-esp32) (MIT).

**Tính năng:** ghép nối tài khoản tại [xiaozhi.me](https://xiaozhi.me/console/login?redirect=%2Fconsole%2F) bằng mã kích hoạt, kết nối WebSocket có xác thực, âm thanh Opus thật qua WASM, nhận dạng giọng nói (STT) và tổng hợp tiếng nói (TTS) qua XiaoZhi, MCP JSON-RPC 2.0, camera, nhiều trợ lý độc lập, nhật ký giao thức và giao diện PWA.

> **Lưu ý quan trọng về SSO:** xiaozhi.me chưa công bố cơ chế OAuth/SSO dành cho trang web bên thứ ba trong tài liệu giao thức thiết bị. Đăng nhập tại trang chính thức không cho phép BilaBot đọc cookie hoặc lấy token đăng nhập của bạn. Ở lần đầu, bạn **đăng nhập xiaozhi.me và nhập mã kích hoạt thiết bị ảo** do BilaBot hiển thị. Những lần sau, BilaBot sử dụng định danh và token thiết bị đã ghép nối để kết nối lại. **Không nhập mật khẩu XiaoZhi vào BilaBot.**

## Chạy thử

Yêu cầu Node.js >= 20 và npm.

```bash
git clone https://github.com/xulytiengviet/Bilabot.git
cd Bilabot
npm install
npm run dev
```

Mở địa chỉ localhost do Vite cung cấp; cho phép trình duyệt sử dụng micro/camera khi cần. Có thể dùng `npm run build && npm run preview` để thử cấu hình Cloudflare Pages.

## Kết nối XiaoZhi

1. Mở BilaBot, chọn **Đăng nhập XiaoZhi** để đăng nhập tại trang **chính thức**.
2. Quay lại BilaBot, nhấn **Kết nối**. Nếu đây là thiết bị mới, BilaBot thực hiện OTA provisioning và hiển thị mã kích hoạt.
3. Vào bảng điều khiển XiaoZhi, thêm/ghép nối thiết bị bằng mã hiển thị; chờ trạng thái **Đã kết nối**. Cấu hình AI Agent, giọng nói và mô hình trên trang chính thức.
4. Cho phép micro, nhấn nút micro để trò chuyện. BilaBot chuyển âm thanh Opus qua WebSocket; STT/TTS và mô hình chạy ở dịch vụ XiaoZhi đã cấu hình.

Không cần bo mạch ESP32, API key của LLM hoặc chia sẻ mật khẩu với BilaBot. Cần Internet khi trò chuyện với máy chủ chính thức.

## Kiến trúc

```text
PWA trình duyệt (JS + Web Audio + Opus/WASM)
  |  OTA/check, OTA/activate, WebSocket, vision
  v
Hono + Cloudflare Pages Functions (xác thực / proxy)
  |  TLS/WSS: Activation-Version, Device-Id, Client-Id, Authorization
  v
XiaoZhi Cloud (AI Agent / STT / LLM / TTS / MCP)
```

* `src/index.tsx`: backend Hono, các tuyến proxy OTA, WebSocket và camera.
* `public/static/app.js`: đa trợ lý, OTA, nhận dạng tiếng nói từ máy chủ, âm thanh Opus, TTS streaming, MCP.
* `public/static/style.css`: giao diện đáp ứng, chế độ sáng/tối.
* `public/static/manifest.json`: cài ứng dụng PWA.
* `vite.config.ts`: Vite, Hono dev server, Cloudflare build.

**Không thể dùng GitHub Pages thuần** với máy chủ chính thức khi phải gửi WebSocket handshake chứa các header tuỳ chỉnh. Nếu muốn sử dụng tên miền GitHub Pages, cần thêm proxy Cloudflare Worker ở miền do bạn kiểm soát. Bản này triển khai trọn bộ trên Cloudflare Pages.

## Triển khai Cloudflare Pages

```bash
npm ci
npm run build
npx wrangler login
npm run deploy
```

Bạn cũng có thể kết nối GitHub repository với Cloudflare Pages, cấu hình lệnh build `npm run build`, thư mục đầu ra `dist` và runtime tương thích Worker. Hãy bật HTTPS trên tên miền triển khai.

## Bảo mật và giới hạn

* Proxy chỉ chuyển tiếp tới các máy chủ XiaoZhi được cho phép; không chia sẻ token và không công khai khoá trong mã nguồn.
* Token thiết bị được lưu cục bộ trên trình duyệt của bạn như bản Olivia gốc. Không sử dụng trên máy tính công cộng; xóa dữ liệu trang khi cần hủy ghép nối. Nên dùng tên miền riêng và HTTPS khi triển khai thực tế.
* Browser WebSocket API không cho phép tự đặt `Authorization`, `Device-Id` và `Client-Id`; Hono đóng vai trò proxy. Khả năng kết nối phụ thuộc máy chủ XiaoZhi chấp nhận thiết bị ảo, trạng thái kích hoạt, cấu hình mô hình và quyền tài khoản.
* Tính năng MCP chỉ hoạt động với các công cụ mà bản web đăng ký và người dùng cho phép; **không cấp quyền tùy ý truy cập tập tin hay điều khiển toàn bộ máy tính**.
* Opus WASM được tải từ CDN bên thứ ba khi dùng lần đầu; trò chuyện trực tuyến, không bảo đảm hoạt động ngoại tuyến.
* Không tuyên bố có đăng nhập SSO một cú nhấp cho trang bên thứ ba nếu phía XiaoZhi chưa cung cấp OAuth chính thức.

## Ghi nhận tác giả và giấy phép

BilaBot (2026) — Long Ngo / xulytiengviet. Phần ứng dụng phái sinh và cấu trúc giao thức kế thừa [Olivia AI](https://github.com/roalfb/olivia-ai), bản quyền © 2025 Olivia Contributors, **MIT License**. Giao thức và ý tưởng firmware tham khảo [78/xiaozhi-esp32](https://github.com/78/xiaozhi-esp32), MIT. Dự án độc lập, không phải sản phẩm chính thức hoặc được XiaoZhi bảo trợ. Xem [LICENSE](LICENSE).
