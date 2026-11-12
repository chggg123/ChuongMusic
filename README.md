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

YouTube và TikTok đều phát bằng player nhúng chính thức; ứng dụng không trích xuất audio TikTok và không áp dụng DSP cho video TikTok. Link TikTok đầy đủ dạng `tiktok.com/@ten/video/ID` mở trực tiếp; link rút gọn được phân giải qua backend trước khi nhúng. Nếu không phân giải được link rút gọn, ứng dụng hiện nút mở video trực tiếp trên TikTok.

Player YouTube cần hiển thị trên trang để hoạt động ổn định trên điện thoại, vì vậy video YouTube sẽ luôn hiện khi chọn bài. File audio trong Playlist được lưu cục bộ trong IndexedDB của trình duyệt, không tải lên server; xóa bài khỏi playlist sẽ xóa file tương ứng. Khi **Phát nền** bật, file Playlist dùng audio gốc của trình duyệt để tương thích phát nền; tắt **Phát nền** nếu muốn dùng DSP.

Nút **Phát nền** cho phép tiếp tục phát file Playlist khi chuyển tab; trên trình duyệt hỗ trợ Media Session, tên bài và các nút điều khiển có thể xuất hiện trên màn hình khóa. Hãy bật tính năng này và bắt đầu phát trước khi khóa màn hình. Việc phát khi khóa màn hình/thoát trình duyệt còn tùy hệ điều hành và trình duyệt; player nhúng YouTube/TikTok có thể bị hệ thống tạm dừng và ứng dụng web không thể ép nguồn đó phát nền. Nếu điện thoại chặn tự động phát YouTube, hãy chạm nút Phát trong ứng dụng hoặc trong player YouTube.

## Deploy frontend và backend

- Deploy backend như một Node.js web service, đặt thư mục gốc là `server`, lệnh cài đặt `npm install` và lệnh khởi động `npm start`. Dùng phiên bản Node đáp ứng trường `engines` trong `server/package.json`.
- Deploy frontend như một static site từ thư mục `client`, lệnh build `npm run build` và thư mục publish `dist`.
- Đặt biến môi trường build `VITE_API_BASE` của frontend thành URL backend kết thúc bằng `/api` (ví dụ `https://ten-backend.onrender.com/api`) rồi build lại.
- API tìm kiếm dùng cache phía server 2 phút và cache trong giao diện 1 phút; các yêu cầu đồng thời cùng từ khóa được gộp thành một truy vấn YouTube.
- Backend đã bật CORS và có endpoint kiểm tra trạng thái `https://ten-backend.onrender.com/api/health`. Mở URL này để xác nhận backend đã khởi động; endpoint trả JSON với `status: "ok"`.
- Khi cập nhật mã nguồn, deploy lại backend `server` và build/deploy lại frontend `client`. Link TikTok rút gọn cần backend `/api/tiktok/resolve`; link TikTok đầy đủ và YouTube phát trực tiếp bằng player nhúng chính thức.
- Nếu dùng gói hosting có cold start, lần gọi đầu sau thời gian nhàn rỗi có thể chậm. Health check xác nhận dịch vụ chạy nhưng không đảm bảo YouTube cho phép mọi yêu cầu tìm/phát.

Một số video có thể không cho phép nhúng; khi đó hãy mở video trực tiếp trên YouTube. Không đưa cookie hoặc thông tin đăng nhập YouTube vào mã nguồn hay biến build frontend.
