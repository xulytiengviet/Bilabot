# BilaBot · Một dự án Cloudflare Pages (giao diện + Hono)

**Điểm truy cập quen thuộc:** https://xulytiengviet.github.io/Bilabot/  
**Ứng dụng đầy đủ:** địa chỉ `https://<tên-dự-án>.pages.dev/` do Cloudflare cấp khi tạo dự án.

Không cần Google Identity Services riêng cho BilaBot, không cần Workers độc lập. Người dùng đăng nhập Google **chỉ tại** https://xiaozhi.me/console/agents, nhận mã OTA thật tại BilaBot rồi ghép nối AI Agent trên XiaoZhi.

## Ba bước thiết lập duy nhất một lần

1. Cloudflare Dashboard → **Workers & Pages → Create → Pages → Connect to Git** → kết nối repository `xulytiengviet/Bilabot`, chọn `main`. Chọn preset None, build command `npm run build:pages`, output directory `dist`, Node.js 22. Đây là **Git integration**, không cần Cloudflare API token trong GitHub Secrets.
2. Sau khi Cloudflare cấp địa chỉ Pages, tạo **Cloudflare Turnstile** cho hostname Pages chính thức (ví dụ `your-project.pages.dev`). Trong Pages → Settings → Variables and Secrets đặt biến **TURNSTILE_SITE_KEY** (công khai) và ba biến dạng **Secret**: `TURNSTILE_SECRET`, `SESSION_SECRET` (ít nhất 32 ký tự) và `TICKET_KEY` (64 ký tự hex). Sinh hai khóa bằng Node trên Windows/macOS/Linux:
   ```bash
   node -e "console.log(require('node:crypto').randomBytes(48).toString('base64'))"
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```
   Dòng 1 cho SESSION_SECRET, dòng 2 cho TICKET_KEY. Không commit secrets. Chạy **Retry deployment** sau khi thêm biến. Không phải điền workerUrl: Hono tự phát hiện origin hiện tại trên Cloudflare Pages.
3. Khi bản Cloudflare đã hoạt động và `/api/health` trả `ready:true`, vào GitHub → **Settings → Secrets and variables → Actions → Variables** tạo **CLOUDFLARE_PAGES_URL** bằng địa chỉ Pages HTTPS thật. Chạy lại workflow **Deploy BilaBot GitHub Pages**. URL GitHub Pages cũ sẽ tự điều hướng tới bản Cloudflare Pages.

Không được suy đoán địa chỉ `pages.dev` trước khi Cloudflare xác nhận dự án đã được tạo. Nếu muốn giữ nguyên UI trên GitHub Pages thay vì chuyển hướng, cần cấu hình thêm `PAGE_ORIGIN=https://xulytiengviet.github.io` trên Cloudflare và Turnstile cho cả hai hostname; mặc định không cần bước phụ này.

## Kiểm tra nhanh

```bash
npm ci
npm test
npm run build:pages
npx wrangler pages dev dist
```

Bản chạy local cần secrets thử nghiệm riêng bằng `.dev.vars` (không commit) và hostname localhost được Turnstile hỗ trợ nếu muốn thử thực tế. `/api/health` trả `ready:false` khi chưa cấu hình, không tạo mã kích hoạt giả. Bật Cloudflare WAF/rate limiting trước khi công bố ở quy mô lớn.

## Người dùng: hai thao tác

1. Mở https://xiaozhi.me/console/agents, đăng nhập Google trên trang chính thức và chọn AI Agent để thêm thiết bị.
2. Vào BilaBot → **Tạo mã kích hoạt**, nhập mã OTA thực do BilaBot nhận được vào bảng điều khiển XiaoZhi. Sau ghép nối, ứng dụng chuyển âm thanh Opus/WASM, STT/TTS và MCP qua proxy Hono cùng tên miền. Không cần ESP32 vật lý.

**Mã nguồn:** `docs/` là UI dùng chung, `cloudflare/src/index.js` là Hono Pages Advanced Mode, `worker/src/index.js` là lõi OTA/WebSocket/vision tái sử dụng, `dist/_worker.js` là bundle deploy. GitHub Pages thuần không thể thực thi Hono; điểm truy cập GitHub sẽ chuyển hướng sau khi bạn khai báo địa chỉ Cloudflare thật.
