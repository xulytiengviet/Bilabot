# BilaBot · Cấu hình trực tiếp theo giao diện Olivia AI

**Ứng dụng chính:** https://xulytiengviet.github.io/Bilabot/  
**Mở thẳng bảng cấu hình:** https://xulytiengviet.github.io/Bilabot/#bb-setup

Trang web hiện mở ngay giao diện đa trợ lý giống cách sử dụng Olivia AI: trò chuyện, danh sách trợ lý, cấu hình từng trợ lý, nhật ký, camera, sao lưu. Nhấn **Lấy mã / Cấu hình** ở thanh bên hoặc nút **Cấu hình** bên cạnh kết nối để mở bảng thiết lập XiaoZhi trong ứng dụng. Khi chưa ghép nối, bảng cấu hình mở lần đầu. Đã ghép nối thì vào thẳng hội thoại.

Người dùng chỉ đăng nhập **tại XiaoZhi.me**. BilaBot không sử dụng cookie XiaoZhi hay Google Identity Services riêng.

## A. Triển khai Hono một lần (người quản trị)

GitHub Pages không có backend để gọi OTA, chèn các header ESP32 hoặc chuyển tiếp WebSocket. Cần một Cloudflare Pages ứng dụng cùng repository; **không cần Cloudflare Worker độc lập**. Website chính vẫn ở GitHub Pages, Cloudflare chỉ cung cấp Hono API.

1. Cloudflare → **Workers & Pages → Create → Pages → Connect to Git**, chọn `xulytiengviet/Bilabot` và nhánh `main`. Build command `npm run build:pages`; output directory `dist`; Node.js 22. Sau triển khai, Cloudflare cấp địa chỉ thực `https://<tên-dự-án>.pages.dev`.
2. Cloudflare Turnstile → tạo widget cho **cả hai hostname**: `xulytiengviet.github.io` và hostname `<tên-dự-án>.pages.dev`. Trong **Pages → Settings → Variables and Secrets**, đặt:
   - `TURNSTILE_SITE_KEY`: site key công khai.
   - `TURNSTILE_SECRET`: secret Turnstile (loại Secret).
   - `SESSION_SECRET`: chuỗi ngẫu nhiên ít nhất 32 ký tự (loại Secret).
   - `TICKET_KEY`: đúng 64 ký tự hex cho vé WebSocket AES-GCM (loại Secret).
   - `PAGE_ORIGIN`: `https://xulytiengviet.github.io` (public variable). Hono tự thêm origin Cloudflare hiện tại.
3. Tạo chuỗi ngẫu nhiên cục bộ bằng Node.js, **chỉ nhập vào Cloudflare**:
   ```bash
   node -e "console.log(require('node:crypto').randomBytes(48).toString('base64'))"
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```
   Dòng đầu cho `SESSION_SECRET`, dòng sau cho `TICKET_KEY`. Không commit secret. Sau khi lưu biến, triển khai lại ứng dụng Cloudflare.
4. Mở `https://<tên-dự-án>.pages.dev/api/health`. Kết quả cần có `ready:true` và `turnstileSiteKey` không rỗng.
5. GitHub → **Settings → Secrets and variables → Actions → Variables** → đặt `CLOUDFLARE_PAGES_URL` bằng URL Cloudflare HTTPS thật. Chạy lại workflow **Deploy BilaBot GitHub Pages** (hoặc push một commit ở `docs/`).

**Lưu ý:** sau bước 5, URL GitHub Pages *không chuyển hướng*: BilaBot mở thẳng ứng dụng tại địa chỉ quen thuộc và gọi gateway Cloudflare qua HTTPS. Khi chưa có `CLOUDFLARE_PAGES_URL`, người dùng vẫn thấy toàn bộ ứng dụng và có thể mở **Cấu hình nâng cao** để nhập URL gateway tin cậy thủ công. Nếu cấu hình thủ công, gateway phải cho phép GitHub origin và Turnstile widget phải đăng ký hostname GitHub.

## B. Cấu hình trực tiếp trong BilaBot (người sử dụng)

1. Mở https://xulytiengviet.github.io/Bilabot/ . Trợ lý chưa ghép nối sẽ hiện bảng thiết lập. Có thể mở lại bất cứ lúc nào bằng nút **Lấy mã / Cấu hình**.
2. Mở https://xiaozhi.me/console/agents trong tab riêng, đăng nhập và chuẩn bị **Thêm thiết bị** vào AI Agent mong muốn.
3. Nhấn **Kiểm tra lại kết nối** (biểu tượng làm mới) nếu muốn xem trạng thái gateway. Nếu chưa kết nối, mở **Cấu hình nâng cao**, nhập URL Cloudflare HTTPS, chọn chế độ **XiaoZhi chính thức · Proxy Hono**, nhấn **Lưu cấu hình**, sau đó kiểm tra lại.
4. Nhấn **Lấy mã kích hoạt**. Sau khi Turnstile xác minh, OTA trả mã thực, hiển thị tại BilaBot cùng bộ đếm thời hạn. Nhấn **Sao chép mã**, nhập mã trong XiaoZhi và xác nhận.
5. BilaBot tự thăm dò kích hoạt, kiểm tra lại OTA sau khi được chấp thuận, lấy thiết lập WebSocket và đợi server `hello`. Khi thành công, bảng thiết lập đóng, giao diện trò chuyện mở sẵn. Cho phép micro khi trình duyệt hỏi.

Để điều chỉnh **tên trợ lý, avatar, OTA URL, WebSocket URL, Device ID, Client ID, phiên bản giao thức, khung âm thanh, micro và loa**, chọn **Thiết lập trợ lý (OTA, WebSocket, thiết bị)** trong bảng ghép nối hoặc biểu tượng bánh răng cạnh trợ lý ở thanh bên. Mỗi trợ lý có mã và định danh độc lập.

## C. Kiểm tra và chẩn đoán

```bash
npm ci
npm test
npm run build:pages
npx wrangler pages dev dist
```

- Gateway lỗi hoặc thiếu secret: `/api/health` trả `ready:false`, BilaBot không tạo mã giả. Kiểm tra Cloudflare Secrets, `PAGE_ORIGIN` và hai hostname Turnstile.
- OTA trả `test-token` nhưng không có `activation.code`: thiết bị mới chưa được coi là đã ghép nối. Không tự tạo mã ngẫu nhiên.
- Ghép nối thành công nhưng không có giọng nói: kiểm tra trạng thái WebSocket, cấp quyền micro, HTTPS và bộ mã hóa Opus; tab **Nhật ký** có thêm thông tin.
- Không bao giờ nhập mật khẩu XiaoZhi, token Google, cookie hoặc các secret Cloudflare vào cấu hình công khai. Chỉ chọn gateway bạn kiểm soát.

**Kiến trúc:** `docs/` là ứng dụng HTML/JS, `docs/direct-setup.js` quản lý bảng thiết lập, `docs/auth.js` phụ trách phiên relay và trạng thái mã, `cloudflare/src/index.js` là Hono Pages Advanced Mode, `worker/src/index.js` là lõi OTA/WS dùng lại từ Olivia-style bridge. Giữ ghi nhận giấy phép MIT tại [LICENSE](../LICENSE).
