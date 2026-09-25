# Kiến trúc BilaBot

**Tham chiếu chính:** [Olivia AI](https://github.com/roalfb/olivia-ai) — MIT; [78/xiaozhi-esp32](https://github.com/78/xiaozhi-esp32) — MIT.

## Data flow

1. Mỗi trợ lý có một Device-ID (MAC giả lập, hex thường), Client-ID UUID, phiên WebSocket, token, lịch sử riêng.
2. Đăng nhập tài khoản tại trang **chính thức** xiaozhi.me. **Không nhúng trang login, không truy cập cookie và không lưu mật khẩu**.
3. BilaBot gọi `POST /api/ota/check` → Hono thêm Device-ID, Client-ID, Activation-Version → máy chủ OTA trả `activation.code`.
4. Người dùng nhập mã trên dashboard. BilaBot định kỳ gọi `POST /api/ota/activate` → nhận 200 → gọi lại check để lấy `websocket.url` và token của **thiết bị ảo**.
5. BilaBot gọi `GET /api/ws`; Cloudflare Worker tạo upstream WSS với các header mà browser WebSocket không đặt được.
6. Handshake: `hello` (Opus 16kHz mono/60ms, MCP true) → `hello` ACK có session_id; `listen.start`, audio frames nhị phân Opus → `stt`; `tts.start`, Opus nhị phân, `tts.sentence_start`, `tts.stop`.
7. `type=mcp` bọc JSON-RPC 2.0: `initialize` → `tools/list` → `tools/call`. Mô-đun camera chỉ trả dữ liệu khi đã được cấp quyền.

## Mô-đun chính

| Mô-đun | Trách nhiệm |
|---|---|
| `src/index.tsx` | Hono / Cloudflare Worker; OTA, WSS relay, vision proxy với whitelist host |
| `public/static/app.js` | DeviceEmulator, ProvisioningManager, ProtocolClient, SessionManager, ChatEngine |
| `AudioEngine` | getUserMedia → PCM Float32 → libopus-wasm → 16kHz/60ms Opus; TTS Opus → Web Audio |
| `MCP` | JSON-RPC, liệt kê công cụ và thực thi có phạm vi |
| `public/static/style.css` | responsive desktop/mobile, dark mode, onboarding tiếng Việt |

## Tính xác thực

BilaBot không sở hữu API đăng nhập xiaozhi.me. Đăng nhập vào trang chính thức **không tương đương OAuth** dành cho BilaBot. Ghép nối thiết bị là bước bắt buộc khi kết nối máy chủ bằng giao thức thiết bị mà chưa có token hợp lệ. Sau ghép nối, token thiết bị được lưu ở `localStorage`, chỉ áp dụng trên trình duyệt đang sử dụng.

## An toàn

Không truyền token tài khoản vào URL, không tự thu thập cookie trang khác. Bản nền Olivia chuyển **token thiết bị** qua query của proxy WebSocket; triển khai production nên kiểm soát log truy cập, HTTPS, CSP, giới hạn tốc độ, cập nhật thư viện, cô lập origin và cân nhắc cơ chế token phiên ngắn hạn phía Worker. Không cho công cụ MCP tự do truy cập tệp, shell hoặc vị trí nếu người dùng chưa đồng ý.
