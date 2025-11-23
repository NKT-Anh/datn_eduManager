# Hướng dẫn Setup MongoDB Atlas (Cloud)

## Bước 1: Tạo tài khoản MongoDB Atlas

1. Truy cập: https://www.mongodb.com/cloud/atlas/register
2. Đăng ký tài khoản miễn phí (Free tier)
3. Xác thực email

## Bước 2: Tạo Cluster

1. Sau khi đăng nhập, chọn **"Build a Database"**
2. Chọn **"M0 FREE"** (Free tier - 512MB storage)
3. Chọn Cloud Provider và Region:
   - **AWS** hoặc **Google Cloud**
   - Chọn region gần bạn nhất (ví dụ: Singapore, Tokyo)
4. Đặt tên cluster (ví dụ: `Cluster0`)
5. Click **"Create"** (mất khoảng 3-5 phút để tạo)

## Bước 3: Tạo Database User

1. Trong màn hình **"Security"** → **"Database Access"**
2. Click **"Add New Database User"**
3. Chọn **"Password"** authentication
4. Nhập:
   - **Username**: (ví dụ: `admin` hoặc tên bạn muốn)
   - **Password**: Tạo password mạnh (lưu lại để dùng sau)
5. Chọn **"Built-in Role"** → **"Atlas admin"** (hoặc **"Read and write to any database"**)
6. Click **"Add User"**

## Bước 4: Whitelist IP Address (Cho phép kết nối)

1. Trong **"Security"** → **"Network Access"**
2. Click **"Add IP Address"**
3. Có 2 lựa chọn:
   - **"Add Current IP Address"**: Chỉ cho phép IP hiện tại
   - **"Allow Access from Anywhere"**: Cho phép từ mọi nơi (0.0.0.0/0) - **Khuyến nghị cho development**
4. Click **"Confirm"**

⚠️ **Lưu ý**: Cho phép từ mọi nơi (0.0.0.0/0) chỉ nên dùng cho development. Production nên whitelist IP cụ thể.

## Bước 5: Lấy Connection String

1. Vào **"Database"** → Click **"Connect"** trên cluster của bạn
2. Chọn **"Connect your application"**
3. Chọn **"Node.js"** và version (3.6 or late r)
4. Copy connection string, ví dụ:
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
5. Thay thế:
   - `<username>` → username bạn đã tạo ở Bước 3
   - `<password>` → password bạn đã tạo ở Bước 3
   - Thêm tên database vào cuối, ví dụ:
   ```
   mongodb+srv://admin:mypassword@cluster0.xxxxx.mongodb.net/eduManager?retryWrites=true&w=majority
   ```

## Bước 6: Cấu hình trong Project

1. Tạo file `.env` trong thư mục `backend/` (nếu chưa có)
2. Thêm dòng:
   ```
   MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/eduManager?retryWrites=true&w=majority
   ```
   (Thay thế bằng connection string thực tế của bạn)

3. Lưu file và restart server

## Bước 7: Test kết nối

1. Chạy lại server:
   ```bash
   npm start
   # hoặc
   npm run dev
   ```

2. Nếu thấy message: `✅ MongoDB connected successfully` → Thành công!

## Troubleshooting

### Lỗi: "authentication failed"
- Kiểm tra lại username và password trong connection string
- Đảm bảo đã tạo database user đúng cách

### Lỗi: "IP not whitelisted"
- Kiểm tra Network Access đã whitelist IP của bạn chưa
- Nếu đang dùng VPN, có thể cần whitelist IP của VPN

### Lỗi: "connection timeout"
- Kiểm tra firewall/antivirus có chặn kết nối không
- Thử whitelist IP 0.0.0.0/0 (chỉ cho development)

## Lưu ý bảo mật

1. **KHÔNG commit file `.env` lên Git**
2. File `.env` đã được thêm vào `.gitignore`
3. Sử dụng biến môi trường trên hosting (Heroku, Vercel, etc.) khi deploy

## Tài liệu tham khảo

- MongoDB Atlas Documentation: https://docs.atlas.mongodb.com/
- Connection String Format: https://docs.mongodb.com/manual/reference/connection-string/

