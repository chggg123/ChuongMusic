# Chương Music

## Chạy trên máy cá nhân

Ứng dụng cần cả API server lẫn giao diện. Mở hai cửa sổ terminal riêng tại thư mục gốc `Project_Music`:

```powershell
npm start
```

```powershell
Set-Location client
npm run dev
```

`npm start` ở thư mục gốc sẽ khởi chạy API trong thư mục `server`.

Frontend mặc định gọi API tại `http://localhost:5000/api` khi chạy ở chế độ phát triển. Nếu API chạy ở địa chỉ khác, đặt `VITE_API_BASE` thành URL kết thúc bằng `/api` trước khi khởi động/build frontend.

Để mở giao diện dev từ laptop khác trong cùng mạng Wi-Fi/LAN, máy chạy project phải khởi động cả server và frontend. Mở `http://<IP-máy-chạy-project>:5173` trên laptop; frontend sẽ tự gọi API tại cùng hostname trên cổng `5000`. Nếu Windows Firewall hỏi, cho phép Node.js truy cập mạng Private. Không dùng `localhost` trên laptop để gọi server của máy khác.

YouTube và TikTok phát bằng player nhúng chính thức nên không áp dụng DSP. TikTok dùng endpoint `/api/tiktok/resolve` để lấy ID bài đăng (hỗ trợ link `/video/ID`, `/photo/ID` và link rút gọn), sau đó phát bằng TikTok Embed Player. Người nghe dùng nút điều khiển trong player TikTok hoặc nút phát/tạm dừng của ứng dụng; TikTok có thể không cho nhúng một số bài đăng.

Video YouTube cũng mặc định ẩn; bật **Bật Video** để hiện player. File audio trong Playlist được lưu cục bộ trong IndexedDB của trình duyệt, không tải lên server; xóa bài khỏi playlist sẽ xóa file tương ứng. DSP áp dụng cho file Playlist cả khi **Phát nền** bật; khả năng tiếp tục phát khi ẩn tab vẫn tùy trình duyệt và hệ điều hành.

Nút **Phát nền** cho phép tiếp tục phát file Playlist khi chuyển tab; trên trình duyệt hỗ trợ Media Session, tên bài và các nút điều khiển có thể xuất hiện trên màn hình khóa. Hãy bật tính năng này và bắt đầu phát trước khi khóa màn hình. Việc phát khi khóa màn hình/thoát trình duyệt còn tùy hệ điều hành và trình duyệt; player YouTube hoặc luồng TikTok có thể bị hệ thống tạm dừng. Nếu điện thoại chặn tự động phát YouTube, hãy chạm nút Phát trong ứng dụng hoặc trong player YouTube.

## Deploy frontend và backend

- Deploy backend như một Node.js web service, đặt thư mục gốc là `server`, lệnh cài đặt `npm install` và lệnh khởi động `npm start`. Dùng phiên bản Node đáp ứng trường `engines` trong `server/package.json`.
- Tạo database PostgreSQL trên Neon, đặt `DATABASE_URL` trong phần Environment của dịch vụ Render. Backend tự tạo bảng tài khoản, phiên đăng nhập và dữ liệu đồng bộ khi khởi động; nếu database không kết nối được, các API tìm/phát nhạc vẫn khởi động nhưng tài khoản sẽ tạm thời không khả dụng.
- Đặt `ADMIN_BOOTSTRAP_PASSWORD` trong Environment của Render để tạo tài khoản `admin`. Giá trị chỉ được đọc ở server và mật khẩu được băm bằng scrypt trước khi lưu; không đặt giá trị này trong frontend, Git hay biến `VITE_*`. Đổi biến này bằng mật khẩu mạnh, riêng biệt để cập nhật mật khẩu quản trị ở lần deploy tiếp theo; các phiên admin cũ sẽ bị thu hồi.
- Đặt `CORS_ORIGINS` thành danh sách origin được phép dùng tài khoản, phân tách bằng dấu phẩy (ví dụ `https://chuong-music.vercel.app`). Thêm domain riêng hoặc origin phát triển nếu có.
- Deploy frontend trên Vercel từ thư mục `client`; `client/vercel.json` chuyển tiếp `/api/*` đến backend để cookie phiên HttpOnly hoạt động cùng domain. Giữ `VITE_API_BASE` chưa đặt trên Vercel thông thường; nếu frontend deploy ở nơi khác, đặt biến này thành URL backend kết thúc bằng `/api`.
- Đăng ký bằng tên đăng nhập (3–30 ký tự) và mật khẩu tối thiểu 12 ký tự. Phiên đăng nhập được lưu trong cookie HttpOnly/Secure; mật khẩu không lưu trong trình duyệt. Khách tiếp tục dùng dữ liệu trên thiết bị và có thể gộp dữ liệu đó vào tài khoản khi đăng nhập.
- Favorites, playlist metadata, cài đặt, lịch sử tìm kiếm/phát và avatar được đồng bộ. File audio tải lên, file nền tùy chỉnh và nội dung file trong IndexedDB chỉ nằm trên thiết bị; bài nhạc local không được tải lên.
- Tài khoản admin có mục **Quản lý hệ thống** trong menu: xem người dùng có heartbeat trong 5 phút gần nhất, tìm tài khoản, khóa/mở khóa và xem nhật ký. Khóa tài khoản sẽ thu hồi các phiên đăng nhập; admin không thể tự khóa hoặc khóa tài khoản admin.
- Thống kê truy cập ghi nhận page view và khách duy nhất theo ngày bằng mã ngẫu nhiên lưu trên trình duyệt và mã băm theo ngày trên server. Không lưu địa chỉ IP; mã khách theo ngày được dọn sau 30 ngày và số liệu tổng hợp được giữ tối đa 365 ngày. Việc ghi nhận phụ thuộc vào quyền lưu trữ của trình duyệt và khả năng gọi API.
- Giao diện **Sáng/Tối** có lựa chọn riêng trong **Cài đặt**, cùng hiệu ứng và tùy chỉnh LED RGB.
- API tìm kiếm dùng cache phía server 2 phút và cache trong giao diện 1 phút; các yêu cầu đồng thời cùng từ khóa được gộp thành một truy vấn YouTube.
- Backend có endpoint kiểm tra trạng thái `https://ten-backend.onrender.com/api/health`. Mở URL này để xác nhận backend đã khởi động; `accountPersistence: "ready"` nghĩa là kết nối PostgreSQL đã sẵn sàng.
- Khi cập nhật mã nguồn, build/deploy lại frontend `client`; backend cần chạy endpoint `/api/tiktok/resolve` để phân giải link rút gọn. API này không tải media và không phụ thuộc TikWM. YouTube và TikTok được phát bằng player chính thức của từng nền tảng.
- `/api/health` chỉ xác nhận backend đã khởi động. Link TikTok phải là bài đăng công khai và cho phép nhúng; nếu player báo không khả dụng, mở bài đăng trực tiếp trên TikTok.
- Nếu dùng gói hosting có cold start, lần gọi đầu sau thời gian nhàn rỗi có thể chậm. Health check xác nhận dịch vụ chạy nhưng không đảm bảo YouTube cho phép mọi yêu cầu tìm/phát.

Một số video có thể không cho phép nhúng; khi đó hãy mở video trực tiếp trên YouTube. Không đưa cookie hoặc thông tin đăng nhập YouTube vào mã nguồn hay biến build frontend.
