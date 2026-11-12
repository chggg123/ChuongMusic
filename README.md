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

TikTok và YouTube phát bằng player nhúng chính thức. Với TikTok, dùng link bài đăng đầy đủ dạng `tiktok.com/@ten/video/ID`; link rút gọn cần mở ra trước rồi sao chép link cuối cùng.

YouTube và TikTok không tách hoặc proxy audio stream; DSP không áp dụng cho hai player nhúng này. Để dùng DSP, mở Playlists, chọn một playlist rồi thêm file audio. File được lưu cục bộ trong IndexedDB của trình duyệt, không tải lên server; xóa bài khỏi playlist sẽ xóa file tương ứng.

Nút **Phát nền** cho phép tiếp tục phát khi chuyển tab; trên trình duyệt hỗ trợ Media Session, tên bài và các nút điều khiển có thể xuất hiện trên màn hình khóa. Hãy bật tính năng này và bắt đầu phát trước khi khóa màn hình. Việc phát khi khóa màn hình/thoát trình duyệt còn tùy hệ điều hành, trình duyệt và nguồn phát; player nhúng YouTube/TikTok có thể bị hệ thống tạm dừng và ứng dụng web không thể ép nguồn đó phát nền.

## Deploy frontend và backend

- Deploy backend như một Node.js web service, đặt thư mục gốc là `server`, lệnh cài đặt `npm install` và lệnh khởi động `npm start`. Dùng phiên bản Node đáp ứng trường `engines` trong `server/package.json`.
- Deploy frontend như một static site từ thư mục `client`, lệnh build `npm run build` và thư mục publish `dist`.
- Đặt biến môi trường build `VITE_API_BASE` của frontend thành URL backend kết thúc bằng `/api` (ví dụ `https://ten-backend.onrender.com/api`) rồi build lại.
- Backend đã bật CORS và có endpoint kiểm tra trạng thái `https://ten-backend.onrender.com/api/health`. Mở URL này để xác nhận backend đã khởi động; endpoint trả JSON với `status: "ok"`.
- Khi cập nhật mã nguồn, cần deploy lại backend `server` và build/deploy lại frontend `client`. Kiểm tra `/api/health` để xác nhận backend hoạt động; YouTube phát trực tiếp bằng IFrame Player chính thức, không phụ thuộc endpoint `/api/stream`.
- Nếu dùng gói hosting có cold start, lần gọi đầu sau thời gian nhàn rỗi có thể chậm. Health check xác nhận dịch vụ chạy nhưng không đảm bảo YouTube cho phép mọi yêu cầu tìm/phát.

Một số video có thể không cho phép nhúng; khi đó hãy mở video trực tiếp trên YouTube. Không đưa cookie hoặc thông tin đăng nhập YouTube vào mã nguồn hay biến build frontend.
