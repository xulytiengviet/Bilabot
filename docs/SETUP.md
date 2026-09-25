# Thiết lập BilaBot GitHub Pages — đăng nhập trên XiaoZhi

BilaBot mở [bảng điều khiển AI Agent chính thức](https://xiaozhi.me/console/agents) để người dùng tự đăng nhập bằng Google **tại XiaoZhi**, sau đó quay lại BilaBot và yêu cầu cấp mã kích hoạt **thật từ OTA của XiaoZhi**. BilaBot không tạo tài khoản Google, không lấy cookie từ xiaozhi.me, không đọc email hay mật khẩu.

## Hai cách kết nối

| Chế độ | Máy chủ XiaoZhi chính thức | Trình duyệt thuần | Lưu ý |
|---|---|---|---|
| Proxy tối giản (mặc định) | Có, sau khi cấu hình Worker | UI/Opus/MCP chạy trong trình duyệt; Worker chỉ gắn custom headers | Cần triển khai Cloudflare Worker, Turnstile và cấp phép domain |
| Trực tiếp (máy chủ tự quản tương thích) | Không được bảo đảm | Có, **nếu** server chấp nhận CORS cho OTA/vision và một dạng WebSocket authentication không cần custom headers | Không đưa token vào query string để giả lập xác thực chính thức |

**Giới hạn kỹ thuật:** GitHub Pages không thể truy cập cookie đăng nhập Google/XiaoZhi từ một origin khác. Browser `WebSocket` API không hỗ trợ các custom handshake headers `Authorization`, `Device-Id`, `Client-Id`, `Protocol-Version` của thiết bị ESP32. Kết nối trực tiếp máy chủ XiaoZhi chính thức không được tuyên bố hoạt động nếu phía họ chưa cấp API Web OAuth/CORS và cơ chế WebSocket được hỗ trợ. Không sử dụng dịch vụ giả mạo trang đăng nhập.

## Chủ repository: triển khai một lần

1. Xem [worker/README.md](../worker/README.md), tạo Cloudflare Turnstile widget cho domain `xulytiengviet.github.io`. Thiết lập các biến `TURNSTILE_SITE_KEY` (công khai), secret `TURNSTILE_SECRET`, `SESSION_SECRET` (>=32 ký tự), `TICKET_KEY` (64 chữ số hex).
2. Chạy `cd worker && npm install && npx wrangler login && npm run deploy`. Sao chép URL `https://bilabot-gateway.<tài-khoản>.workers.dev`.
3. Sửa `docs/config.js`, điền `workerUrl` công khai. Giữ `mode: 'gateway'`. **Không cần Google OAuth Client ID, OAuth Secret hay mật khẩu XiaoZhi.**
4. Repository GitHub → Settings → Pages: chọn GitHub Actions. Workflow `.github/workflows/pages.yml` đưa thư mục `docs/` lên `https://xulytiengviet.github.io/Bilabot/`.

Nếu chưa triển khai gateway, trang vẫn hiển thị và bạn vẫn có thể vào giao diện BilaBot; **nó sẽ không tự cấp mã thật khi mạng/CORS không đáp ứng**.

## Người dùng: ba bước

1. Trên BilaBot, nhấn **Đăng nhập Google trên XiaoZhi**. Liên kết dẫn trực tiếp đến `https://xiaozhi.me/console/agents` (nếu cần, XiaoZhi tự đưa bạn sang trang login).
2. Quay lại BilaBot, nhấn **Tôi đã đăng nhập · Tạo mã kích hoạt**. BilaBot tạo Device-ID/Client-ID riêng và gọi `POST OTA/check` qua gateway; khi XiaoZhi trả mã kích hoạt, ứng dụng hiển thị mã và tự kiểm tra trạng thái bằng OTA/activate.
3. Trong trang `/console/agents`, chọn thêm thiết bị và nhập mã. Trên BilaBot, sau khi kích hoạt được xác nhận, WebSocket bắt đầu truyền Opus từ micro; STT/TTS/MCP được xử lý bởi AI Agent bạn đã cấu hình trên XiaoZhi.

BilaBot không thể lấy danh sách AI Agent hay thông số riêng của tài khoản đang mở trên xiaozhi.me chỉ từ tab trình duyệt. Cấu hình Agent thực hiện trên giao diện **chính thức**, sau đó kết nối thiết bị đã được liên kết.

## Quyền riêng tư và bảo mật

- Cloudflare Turnstile chỉ ngăn abuse trên gateway công cộng; **không thay cho login XiaoZhi** và không xác minh người dùng đã đăng nhập.
- Gateway phát hành phiên relay HMAC tối đa 1 giờ sau khi Turnstile được xác nhận. Với mỗi WebSocket, proxy cấp vé AES-GCM 60 giây, chỉ cho phép host XiaoZhi trong allowlist; không phát token gốc trong query URL.
- Worker phải được thiết lập rate limit/WAF. Không ghi raw OTA token, Opus, Google cookie hay hình ảnh vào log.
- Ở chế độ máy chủ tự quản, phải cấu hình máy chủ tin cậy chủ động cho phép CORS và phương thức xác thực WebSocket cho browser; chế độ này không vượt qua bảo vệ truy cập của XiaoZhi.
