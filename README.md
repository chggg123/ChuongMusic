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

YouTube phát bằng player nhúng chính thức nên không áp dụng DSP. TikTok được xử lý qua backend `/api/tiktok` và `/api/tiktok-stream`; audio phát trong player của ứng dụng để có thanh điều khiển và DSP, còn video tắt mặc định. Nút **Bật Video** sẽ ghi nhớ lựa chọn cho các bài tiếp theo. Khung TikTok có kích thước ngang như player YouTube; video giữ tỷ lệ gốc bên trong khung. Dùng nút phóng to ở góc dưới bên phải để mở toàn màn hình. Link TikTok dạng `/video/ID` hoặc `/photo/ID` đều được hỗ trợ; việc tải media phụ thuộc dịch vụ TikWM mà backend sử dụng.

Video YouTube cũng mặc định ẩn; bật **Bật Video** để hiện player. File audio trong Playlist được lưu cục bộ trong IndexedDB của trình duyệt, không tải lên server; xóa bài khỏi playlist sẽ xóa file tương ứng. DSP áp dụng cho file Playlist cả khi **Phát nền** bật; khả năng tiếp tục phát khi ẩn tab vẫn tùy trình duyệt và hệ điều hành.

Nút **Phát nền** cho phép tiếp tục phát file Playlist khi chuyển tab; trên trình duyệt hỗ trợ Media Session, tên bài và các nút điều khiển có thể xuất hiện trên màn hình khóa. Hãy bật tính năng này và bắt đầu phát trước khi khóa màn hình. Việc phát khi khóa màn hình/thoát trình duyệt còn tùy hệ điều hành và trình duyệt; player YouTube hoặc luồng TikTok có thể bị hệ thống tạm dừng. Nếu điện thoại chặn tự động phát YouTube, hãy chạm nút Phát trong ứng dụng hoặc trong player YouTube.

## Deploy frontend và backend

- Deploy backend như một Node.js web service, đặt thư mục gốc là `server`, lệnh cài đặt `npm install` và lệnh khởi động `npm start`. Dùng phiên bản Node đáp ứng trường `engines` trong `server/package.json`.
- Deploy frontend như một static site từ thư mục `client`, lệnh build `npm run build` và thư mục publish `dist`.
- Đặt biến môi trường build `VITE_API_BASE` của frontend thành URL backend kết thúc bằng `/api` (ví dụ `https://ten-backend.onrender.com/api`) rồi build lại.
- API tìm kiếm dùng cache phía server 2 phút và cache trong giao diện 1 phút; các yêu cầu đồng thời cùng từ khóa được gộp thành một truy vấn YouTube.
- Backend đã bật CORS và có endpoint kiểm tra trạng thái `https://ten-backend.onrender.com/api/health`. Mở URL này để xác nhận backend đã khởi động; endpoint trả JSON với `status: "ok"`.
- Khi cập nhật mã nguồn, deploy lại backend `server` và build/deploy lại frontend `client`. TikTok cần backend `/api/tiktok` và `/api/tiktok-stream` để lấy audio/video; YouTube phát bằng player nhúng chính thức.
- `/api/health` không kiểm tra nhà cung cấp media. Để xác nhận TikTok DSP hoạt động, thử `/api/tiktok?url=<link-TikTok>` và kiểm tra phản hồi có `audioUrl`; HTTP 502 nghĩa là backend chưa lấy được media từ TikWM.
- Nếu dùng gói hosting có cold start, lần gọi đầu sau thời gian nhàn rỗi có thể chậm. Health check xác nhận dịch vụ chạy nhưng không đảm bảo YouTube cho phép mọi yêu cầu tìm/phát.

Một số video có thể không cho phép nhúng; khi đó hãy mở video trực tiếp trên YouTube. Không đưa cookie hoặc thông tin đăng nhập YouTube vào mã nguồn hay biến build frontend.
