# Chương Music

## Chạy trên máy cá nhân

Ứng dụng cần cả API server lẫn giao diện. Mở hai cửa sổ terminal riêng:

```powershell
cd ..\server
npm start
```

```powershell
cd ..\client
npm run dev
```

Frontend mặc định gọi API tại `http://localhost:5000/api` khi chạy ở chế độ phát triển. Nếu API chạy ở địa chỉ khác, đặt `VITE_API_BASE` thành URL kết thúc bằng `/api` trước khi khởi động/build frontend.

Video mặc định tắt; có thể bật/tắt bằng nút Video ở thanh điều khiển.

DSP dùng Web Audio để xử lý audio stream tương thích. Nếu playback chuyển sang YouTube iframe dự phòng, DSP không thể xử lý tiếng bên trong iframe.

## Deploy frontend và backend

- Deploy backend như một Node.js web service, đặt thư mục gốc là `server`, lệnh cài đặt `npm install` và lệnh khởi động `npm start`. Dùng phiên bản Node đáp ứng trường `engines` trong `server/package.json`.
- Deploy frontend như một static site từ thư mục `client`, lệnh build `npm run build` và thư mục publish `dist`.
- Đặt biến môi trường build `VITE_API_BASE` của frontend thành URL backend kết thúc bằng `/api` (ví dụ `https://ten-backend.onrender.com/api`) rồi build lại.
- Backend đã bật CORS và có endpoint kiểm tra trạng thái `https://ten-backend.onrender.com/api/health`. Mở URL này để xác nhận backend đã khởi động; endpoint trả JSON với `status: "ok"`.
- Khi cập nhật mã nguồn, cần deploy lại backend `server` và build/deploy lại frontend `client`. Kiểm tra `/api/stream?id=<YouTube-ID>` phải trả audio stream (`200` hoặc `206`), không phải JSON lỗi `502`; health check thành công riêng lẻ chưa xác nhận được chức năng phát nhạc.
- Nếu dùng gói hosting có cold start, lần gọi đầu sau thời gian nhàn rỗi có thể chậm. Health check xác nhận dịch vụ chạy nhưng không đảm bảo YouTube cho phép mọi yêu cầu tìm/phát.

YouTube có thể giới hạn hoặc thay đổi quyền truy cập stream. Dự án không cấu hình cookie đăng nhập, PO token, proxy dân cư hay dịch vụ vượt bot-check. Không đưa cookie hoặc thông tin đăng nhập YouTube vào mã nguồn hay biến build frontend.
