# 📧 Hướng dẫn cấu hình SMTP Email

## 📋 Các trường cần điền trong cấu hình SMTP

Khi vào trang **Settings** → **Cấu hình Email (SMTP)**, bạn cần điền các thông tin sau:

### 1. **SMTP Host** (Bắt buộc)
- Địa chỉ máy chủ SMTP của nhà cung cấp email
- Ví dụ:
  - Gmail: `smtp.gmail.com`
  - Outlook: `smtp-mail.outlook.com`
  - Yahoo: `smtp.mail.yahoo.com`
  - Zoho: `smtp.zoho.com`

### 2. **SMTP Port** (Bắt buộc)
- Cổng kết nối SMTP
- Thường dùng:
  - **587** (TLS/STARTTLS) - Khuyến nghị
  - **465** (SSL) - Cần bật SSL/TLS
  - **25** (Không mã hóa) - Không khuyến nghị

### 3. **SMTP User** (Bắt buộc)
- Email đăng nhập hoặc username
- Ví dụ: `your-email@gmail.com` hoặc `your-email@outlook.com`

### 4. **SMTP Pass** (Bắt buộc)
- Mật khẩu email hoặc **App Password** (khuyến nghị)
- ⚠️ **Lưu ý**: Với Gmail, cần dùng **App Password** thay vì mật khẩu thường

### 5. **From Email** (Tùy chọn)
- Email người gửi (hiển thị trong email nhận được)
- Nếu để trống, sẽ dùng **SMTP User**

### 6. **From Name** (Tùy chọn)
- Tên người gửi (hiển thị trong email nhận được)
- Ví dụ: `Hệ thống trường học`, `Trường THPT ABC`

### 7. **SSL/TLS** (Tùy chọn)
- Bật nếu dùng port **465** (SSL)
- Tắt nếu dùng port **587** (STARTTLS)

---

## 🔧 Cấu hình cho các nhà cung cấp email phổ biến

### 📮 Gmail (Google)

**Cách 1: Dùng App Password (Khuyến nghị)**

1. Vào Google Account: https://myaccount.google.com/
2. Bật **2-Step Verification** (nếu chưa bật)
3. Tạo **App Password**:
   - Vào: https://myaccount.google.com/apppasswords
   - Chọn app: **Mail**
   - Chọn device: **Other (Custom name)**
   - Nhập tên: `EduManager System`
   - Copy **App Password** (16 ký tự, không có dấu cách)

4. Cấu hình trong hệ thống:
   ```
   SMTP Host: smtp.gmail.com
   SMTP Port: 587
   SMTP User: your-email@gmail.com
   SMTP Pass: [App Password 16 ký tự]
   From Email: your-email@gmail.com
   From Name: Hệ thống trường học
   SSL/TLS: TẮT
   ```

**Cách 2: Dùng OAuth2 (Nâng cao)**
- Cần cấu hình OAuth2 credentials
- Phức tạp hơn, không khuyến nghị cho người dùng thường

---

### 📮 Outlook / Hotmail / Live.com

1. Cấu hình trong hệ thống:
   ```
   SMTP Host: smtp-mail.outlook.com
   SMTP Port: 587
   SMTP User: your-email@outlook.com
   SMTP Pass: [Mật khẩu email của bạn]
   From Email: your-email@outlook.com
   From Name: Hệ thống trường học
   SSL/TLS: TẮT
   ```

**Lưu ý**: Có thể cần bật "Less secure app access" trong Microsoft Account

---

### 📮 Yahoo Mail

1. Tạo **App Password**:
   - Vào: https://login.yahoo.com/account/security
   - Bật **2-Step Verification**
   - Tạo **App Password**

2. Cấu hình trong hệ thống:
   ```
   SMTP Host: smtp.mail.yahoo.com
   SMTP Port: 587
   SMTP User: your-email@yahoo.com
   SMTP Pass: [App Password]
   From Email: your-email@yahoo.com
   From Name: Hệ thống trường học
   SSL/TLS: TẮT
   ```

---

### 📮 Zoho Mail

1. Cấu hình trong hệ thống:
   ```
   SMTP Host: smtp.zoho.com
   SMTP Port: 587
   SMTP User: your-email@zoho.com
   SMTP Pass: [Mật khẩu email]
   From Email: your-email@zoho.com
   From Name: Hệ thống trường học
   SSL/TLS: TẮT
   ```

---

### 📮 SendGrid (Dịch vụ email chuyên nghiệp)

1. Đăng ký tài khoản: https://sendgrid.com/
2. Tạo **API Key** trong SendGrid Dashboard
3. Cấu hình trong hệ thống:
   ```
   SMTP Host: smtp.sendgrid.net
   SMTP Port: 587
   SMTP User: apikey
   SMTP Pass: [API Key từ SendGrid]
   From Email: your-verified-email@domain.com
   From Name: Hệ thống trường học
   SSL/TLS: TẮT
   ```

**Ưu điểm**: 
- Free tier: 100 emails/ngày
- Tỷ lệ gửi thành công cao
- Không cần App Password

---

### 📮 Mailgun (Dịch vụ email chuyên nghiệp)

1. Đăng ký tài khoản: https://www.mailgun.com/
2. Lấy **SMTP credentials** từ Mailgun Dashboard
3. Cấu hình trong hệ thống:
   ```
   SMTP Host: smtp.mailgun.org
   SMTP Port: 587
   SMTP User: [Mailgun SMTP Username]
   SMTP Pass: [Mailgun SMTP Password]
   From Email: your-verified-email@domain.com
   From Name: Hệ thống trường học
   SSL/TLS: TẮT
   ```

---

## ✅ Cách kiểm tra cấu hình

Sau khi điền xong, click nút **"Test Email"** để kiểm tra:

1. ✅ **Thành công**: Email test sẽ được gửi đến **SMTP User**
2. ❌ **Thất bại**: Kiểm tra lại:
   - SMTP Host có đúng không?
   - Port có đúng không?
   - User/Pass có đúng không?
   - Có cần App Password không? (Gmail, Yahoo)
   - Firewall có chặn port không?

---

## 🔒 Bảo mật

### ⚠️ Lưu ý quan trọng:

1. **Không dùng mật khẩu chính** cho Gmail/Yahoo
   - Luôn dùng **App Password**
   - Bảo vệ tài khoản chính

2. **Kiểm tra email test**
   - Đảm bảo email test đến đúng hộp thư
   - Kiểm tra cả thư mục **Spam**

3. **Giới hạn quyền truy cập**
   - Chỉ Admin mới có quyền cấu hình SMTP
   - Không chia sẻ thông tin SMTP

---

## 🐛 Xử lý lỗi thường gặp

### Lỗi: "Authentication failed"
- **Nguyên nhân**: User/Pass sai hoặc cần App Password
- **Giải pháp**: 
  - Kiểm tra lại User/Pass
  - Với Gmail: Dùng App Password thay vì mật khẩu thường

### Lỗi: "Connection timeout"
- **Nguyên nhân**: Firewall chặn port hoặc SMTP Host sai
- **Giải pháp**: 
  - Kiểm tra SMTP Host
  - Kiểm tra firewall/antivirus
  - Thử port khác (587 → 465)

### Lỗi: "Relay access denied"
- **Nguyên nhân**: Email không được verify hoặc không có quyền gửi
- **Giải pháp**: 
  - Verify email trong nhà cung cấp
  - Kiểm tra quyền gửi email

### Lỗi: "Invalid credentials"
- **Nguyên nhân**: User/Pass không đúng
- **Giải pháp**: 
  - Kiểm tra lại User/Pass
  - Với Gmail: Đảm bảo đã bật 2-Step Verification và dùng App Password

---

## 📝 Ví dụ cấu hình hoàn chỉnh

### Gmail với App Password:
```
SMTP Host: smtp.gmail.com
SMTP Port: 587
SMTP User: school.system@gmail.com
SMTP Pass: abcd efgh ijkl mnop
From Email: school.system@gmail.com
From Name: Hệ thống Quản lý Trường học
SSL/TLS: TẮT
```

### Outlook:
```
SMTP Host: smtp-mail.outlook.com
SMTP Port: 587
SMTP User: school@outlook.com
SMTP Pass: [Mật khẩu email]
From Email: school@outlook.com
From Name: Hệ thống Quản lý Trường học
SSL/TLS: TẮT
```

---

## 🎯 Khuyến nghị

1. **Cho môi trường Production**:
   - Dùng dịch vụ email chuyên nghiệp (SendGrid, Mailgun)
   - Tỷ lệ gửi thành công cao
   - Có analytics và tracking

2. **Cho môi trường Development/Testing**:
   - Dùng Gmail với App Password
   - Dễ cấu hình
   - Free và đủ dùng

3. **Tối ưu bảo mật**:
   - Luôn dùng App Password cho Gmail/Yahoo
   - Không lưu mật khẩu chính trong hệ thống
   - Thay đổi App Password định kỳ

---

## 📞 Hỗ trợ

Nếu gặp vấn đề, vui lòng:
1. Kiểm tra log backend console để xem lỗi chi tiết
2. Test email trước khi sử dụng
3. Kiểm tra email trong thư mục Spam
4. Liên hệ quản trị viên nếu cần hỗ trợ

