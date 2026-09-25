# Hướng dẫn cài đặt BilaBot

Ứng dụng: https://xulytiengviet.github.io/Bilabot/  
Dashboard đơn sắc: https://xulytiengviet.github.io/Bilabot/#bb-dashboard  
Nhận mã XiaoZhi: https://xulytiengviet.github.io/Bilabot/#bb-setup

BilaBot hoạt động trực tiếp tại GitHub Pages. Giao diện có bảy mục cài đặt tiếng Việt; bảng điều khiển mở bằng nút **Cài đặt** ở thanh bên hoặc tiêu đề hội thoại.

## Bước 1: Tạo Cloudflare Pages

Vào Cloudflare Dashboard, kết nối GitHub repository `xulytiengviet/Bilabot`, chọn nhánh `main`. Build command: `npm run build:pages`; thư mục đầu ra: `dist`; Node.js 22. Giao diện và proxy Hono thuộc cùng dự án Cloudflare Pages, trong khi GitHub Pages vẫn là điểm truy cập quen thuộc.

## Bước 2: Cấu hình gateway an toàn

Tạo Cloudflare Turnstile cho hostname Cloudflare Pages thực tế và `xulytiengviet.github.io`. Trong phần môi trường của Cloudflare Pages, cấu hình public `TURNSTILE_SITE_KEY` và các secret phía máy chủ `TURNSTILE_SECRET`, `SESSION_SECRET`, `TICKET_KEY`. Bảo đảm `SESSION_SECRET` có ít nhất 32 ký tự và `TICKET_KEY` là 64 ký tự hex. Không lưu giá trị các khóa trong GitHub.

Nếu người dùng truy cập từ GitHub Pages, thêm `PAGE_ORIGIN=https://xulytiengviet.github.io` trong Cloudflare Pages để cho phép trình duyệt gửi yêu cầu. Triển khai lại và mở endpoint `/api/health` trên tên miền Cloudflare Pages: kết quả phải có `ready:true`. Không dùng mã OTA giả để kiểm tra.

## Bước 3: Cấu hình trực tiếp tại Dashboard

Mở **Dashboard → Kết nối XiaoZhi**, nhập origin HTTPS Cloudflare Pages vừa được cấp, ví dụ `https://ten-du-an.pages.dev`, nhấn **Kiểm tra kết nối** rồi **Lưu và tải lại**. Cấu hình được lưu tại trình duyệt. Nếu muốn đặt URL mặc định cho mọi người dùng, thêm `CLOUDFLARE_PAGES_URL` vào GitHub Actions Variables rồi chạy lại workflow GitHub Pages; BilaBot không tự chuyển hướng khỏi GitHub Pages.

## Bước 4: Ghép nối XiaoZhi

Đăng nhập riêng tại https://xiaozhi.me/console/agents và chọn AI Agent. Trở lại BilaBot, chọn **Lấy mã OTA**, sao chép mã thực được máy chủ cấp, nhập vào mục **Thêm thiết bị** tại XiaoZhi. BilaBot tự kiểm tra trạng thái ghép nối và chỉ mở trò chuyện sau khi WebSocket được xác nhận. Quyền micro do trình duyệt yêu cầu khi sử dụng giọng nói.

## Kiểm tra mã nguồn

Chạy `npm ci`, `npm test` và `npm run build:pages` tại thư mục repository. Các bài thử mô phỏng không thay thế kiểm thử OTA thực tế với gateway đã triển khai.

Lõi ứng dụng: `docs/static/app.js`. Dashboard: `docs/monochrome-dashboard.js` và `docs/monochrome-dashboard.css`. Gateway Hono: `cloudflare/src/index.js`.
