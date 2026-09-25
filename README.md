# BilaBot · Trợ lý giọng nói XiaoZhi AI trên trình duyệt

**Trang web:** https://xulytiengviet.github.io/Bilabot/  
**Hướng dẫn cấu hình:** [docs/SETUP.md](docs/SETUP.md)  
**Worker:** [worker/README.md](worker/README.md)  
**Quyền riêng tư:** [docs/privacy-policy.html](docs/privacy-policy.html)

BilaBot có landing page tiếng Việt lấy cảm hứng thiết kế từ Olivia, cùng giao diện trò chuyện AI ESP32 ảo chạy trên Chrome, Edge và điện thoại. Dự án kế thừa kiến trúc [Olivia AI](https://github.com/roalfb/olivia-ai) (MIT), tương thích giao thức [XiaoZhi ESP32](https://github.com/78/xiaozhi-esp32) (MIT).

## Cấu hình lần đầu: hai phiên Google độc lập

1. **Google Identity Services cho BilaBot:** nếu chủ website đã thiết lập Client ID và Cloudflare Worker, nút Google GIS xác thực ID token tại Worker (chữ ký Google JWKS, aud, iss, exp) trước khi cấp relay session.
2. **Đăng nhập XiaoZhi chính thức:** người dùng mở https://xiaozhi.me/console/agents và đăng nhập Google riêng tại đó. BilaBot không đọc cookie/phiên XiaoZhi, không chia sẻ mật khẩu và không đồng nhất hai phiên.
3. **OTA tự động và mã kích hoạt thực:** sau khi Google được xác minh, BilaBot bắt đầu khởi tạo ESP32 ảo và gọi OTA XiaoZhi qua Worker (hoặc người dùng nhấn nút khởi tạo). Chỉ khi XiaoZhi trả mã, BilaBot mới hiển thị mã đó. Người dùng nhập mã tại bảng điều khiển XiaoZhi để liên kết AI Agent.
4. **Kết nối giọng nói:** BilaBot tự kiểm tra trạng thái, nhận device token và WSS URL, truyền Opus hai chiều qua WebSocket, nhận STT/TTS và thực thi các MCP được cấp quyền.

**GitHub Pages là hosting tĩnh.** Kết nối XiaoZhi chính thức yêu cầu Cloudflare Worker nhỏ để giải quyết OTA CORS, kiểm tra Google GIS/Turnstile, bổ sung header HTTP mà WebSocket trình duyệt không hỗ trợ. Không có mã kích hoạt thực trước khi chủ ứng dụng cung cấp Google Web Client ID, Worker URL và cấu hình secret cần thiết. Tài liệu [SETUP](docs/SETUP.md) liệt kê toàn bộ cấu hình.

## Chức năng

- Landing page và wizard tiếng Việt, nút Google GIS chính thức, trạng thái kết nối rõ ràng, giao diện responsive và dark visualizer.
- Định danh ESP32 ảo bền vững theo trợ lý: Device-Id / Client-Id, OTA check / activate, mã kích hoạt được máy chủ cấp.
- Giao diện đa trợ lý từ Olivia, mỗi trợ lý có hội thoại, avatar, âm lượng, mã ghép nối, token và WebSocket độc lập.
- Opus WASM, Web Audio, micro và loa, chuyển phát STT/TTS do XiaoZhi xử lý.
- MCP JSON-RPC 2.0 cho các công cụ mà ứng dụng và người dùng cho phép; ảnh/camera theo quyền.
- Tab nhật ký kết nối hỗ trợ chẩn đoán OTA và WebSocket.

## Kiến trúc

    BilaBot GitHub Pages (docs/)      Google GIS
       |                                   |
       | ID token + Turnstile             `→ Google JWT`
       v
    Cloudflare Worker (worker/src/index.js)
       ├── Google JWKS verification → relay session (1 giờ)
       ├── POST /api/ota/check     → XiaoZhi OTA
       ├── POST /api/ota/activate  → XiaoZhi OTA/activate
       ├── POST /api/ws-ticket    → WSS ticket AES-GCM ngắn hạn
       └── GET /api/ws            → XiaoZhi WSS (custom headers)
                                            |
                                            └── Opus, STT, TTS, MCP

Đăng nhập và ghép nối với tài khoản XiaoZhi được thực hiện **riêng tại xiaozhi.me**. BilaBot không có quyền tự thêm thiết bị vào tài khoản khi chưa có mã được người dùng nhập và XiaoZhi xác nhận.

## Tự triển khai

- Khai báo Google OAuth **Web Client ID** với Authorized JavaScript Origin https://xulytiengviet.github.io, điền cùng Client ID vào docs/config.js và worker/wrangler.toml.
- Triển khai Cloudflare Worker cùng TURNSTILE_SITE_KEY, TURNSTILE_SECRET, SESSION_SECRET, TICKET_KEY và PAGE_ORIGIN; điền Worker URL vào docs/config.js.
- Bật GitHub Pages → GitHub Actions; workflow .github/workflows/pages.yml tự triển khai docs/.

Kiểm tra cú pháp: node --check docs/auth.js && node --check worker/src/index.js.

**Giới hạn:** không thể kết nối thẳng server XiaoZhi chính thức qua JS WebSocket thuần nếu cần các header ESP32. Google đăng nhập tại BilaBot không phải SSO vào XiaoZhi. Opus và các mô hình STT/TTS phía XiaoZhi cần Internet khi trò chuyện.

## Giấy phép và ghi nhận

BilaBot (2026) — Long Ngo / xulytiengviet. Các phần nguồn dựa trên [Olivia AI](https://github.com/roalfb/olivia-ai) thuộc giấy phép MIT; tham khảo [78/xiaozhi-esp32](https://github.com/78/xiaozhi-esp32), MIT. Dự án độc lập, không đại diện cho hoặc được Google/XiaoZhi bảo trợ. Xem [LICENSE](LICENSE).
