# Gateway độc lập (tùy chọn / legacy)

BilaBot chính dùng **Hono tích hợp trên Cloudflare Pages**, không cần triển khai riêng thư mục `worker/`. Mã proxy OTA, WebSocket và vision tại `worker/src/index.js` được **tái sử dụng** bởi `cloudflare/src/index.js`.

Chỉ triển khai `worker/` độc lập nếu muốn giữ UI GitHub Pages ở miền riêng. Khi đó cần khai báo origin và Turnstile cho miền GitHub Pages. Mặc định GitHub Pages sẽ chuyển hướng đến Cloudflare Pages sau khi khai báo địa chỉ deploy chính thức.

Xem [hướng dẫn 3 bước](../docs/SETUP.md). Không cần Google OAuth hay đăng nhập BilaBot riêng.
