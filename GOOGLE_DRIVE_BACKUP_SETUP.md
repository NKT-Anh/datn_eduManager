# 📦 Hướng dẫn cấu hình Google Drive Backup

## ✅ Mục đích
Upload backup database lên Google Drive để lưu trữ an toàn (15GB miễn phí).

---

## 🔧 Bước 1: Tạo Google Cloud Project

1. Truy cập [Google Cloud Console](https://console.cloud.google.com/)
2. Đăng nhập bằng tài khoản Google
3. Tạo project mới:
   - Click vào dropdown project ở top bar
   - Click **"New Project"**
   - Đặt tên: `EduManage Backup` (hoặc tên khác)
   - Click **"Create"**

---

## 🔑 Bước 2: Bật Google Drive API

1. Trong Google Cloud Console, vào **"APIs & Services"** → **"Library"**
2. Tìm kiếm: **"Google Drive API"**
3. Click vào **"Google Drive API"**
4. Click **"Enable"** để bật API

---

## 🔐 Bước 3: Tạo Service Account

1. Vào **"APIs & Services"** → **"Credentials"**
2. Click **"+ CREATE CREDENTIALS"** → Chọn **"Service Account"**
3. Điền thông tin:
   - **Service account name**: `edumanage-backup`
   - **Service account ID**: Tự động tạo
   - Click **"Create and Continue"**
4. **Grant this service account access to project** (bỏ qua, click **"Continue"**)
5. Click **"Done"**

---

## 📄 Bước 4: Tạo JSON Key

1. Trong danh sách Service Accounts, click vào service account vừa tạo
2. Vào tab **"Keys"**
3. Click **"Add Key"** → **"Create new key"**
4. Chọn **"JSON"**
5. Click **"Create"**
6. File JSON sẽ tự động download về máy

**⚠️ LƯU Ý QUAN TRỌNG:**
- File JSON này chứa **private key**, cần bảo mật cẩn thận
- **KHÔNG** commit file này lên Git
- Lưu file ở nơi an toàn trên server

---

## 📁 Bước 5: Chia sẻ thư mục Google Drive

1. Mở [Google Drive](https://drive.google.com/)
2. Tạo thư mục mới: **"EduManage Backups"** (hoặc tên khác)
3. Click chuột phải vào thư mục → **"Share"**
4. Trong ô **"Add people and groups"**, nhập **email của Service Account**
   - Email có dạng: `edumanage-backup@your-project-id.iam.gserviceaccount.com`
   - Tìm email này trong file JSON vừa download (field `client_email`)
5. Chọn quyền: **"Editor"** hoặc **"Viewer"** (nếu chỉ upload)
6. Click **"Send"** (không cần gửi email, chỉ cần share)

---

## ⚙️ Bước 6: Cấu hình trong .env

Có **2 cách** cấu hình:

### Cách 1: Lưu JSON string trực tiếp trong .env (Không khuyến nghị)

```env
GOOGLE_DRIVE_CREDENTIALS={"type":"service_account","project_id":"your-project-id","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"edumanage-backup@your-project-id.iam.gserviceaccount.com","client_id":"...","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"..."}
```

**⚠️ Lưu ý:** Cần escape dấu ngoặc kép và xuống dòng trong JSON.

### Cách 2: Lưu đường dẫn file JSON (Khuyến nghị ✅)

1. Copy file JSON vào thư mục `backend/` (hoặc thư mục an toàn khác)
2. Đổi tên file: `google-drive-credentials.json`
3. Thêm vào `.gitignore`:
   ```
   google-drive-credentials.json
   ```
4. Cấu hình trong `.env`:
   ```env
   GOOGLE_DRIVE_CREDENTIALS=./google-drive-credentials.json
   ```

**Hoặc dùng đường dẫn tuyệt đối:**
```env
GOOGLE_DRIVE_CREDENTIALS=C:/datn/datn_eduManager/backend/google-drive-credentials.json
```

---

## 📂 Bước 7: Lấy Folder ID (Optional)

Nếu muốn chỉ định thư mục cụ thể trên Drive:

1. Mở thư mục **"EduManage Backups"** trên Google Drive
2. Xem URL trong trình duyệt:
   ```
   https://drive.google.com/drive/folders/1a2b3c4d5e6f7g8h9i0j
   ```
3. Copy phần ID sau `/folders/`: `1a2b3c4d5e6f7g8h9i0j`
4. Thêm vào `.env`:
   ```env
   GOOGLE_DRIVE_BACKUP_FOLDER_ID=1a2b3c4d5e6f7g8h9i0j
   ```

**Nếu không set:** Hệ thống sẽ tự động tạo thư mục "EduManage Backups" trên Drive.

---

## ✅ Bước 8: Kiểm tra cấu hình

1. Khởi động lại backend server
2. Tạo backup thử nghiệm từ UI
3. Kiểm tra:
   - File backup có được tạo trên server local không?
   - File có được upload lên Google Drive không?

---

## 🔒 Bảo mật

1. **KHÔNG** commit file JSON credentials lên Git
2. Thêm vào `.gitignore`:
   ```
   google-drive-credentials.json
   *.json
   !package*.json
   ```
3. Chỉ share thư mục Drive với Service Account email
4. Không share file JSON với ai

---

## 🐛 Xử lý lỗi

### Lỗi: "GOOGLE_DRIVE_CREDENTIALS không được cấu hình"
- Kiểm tra file `.env` có đúng không
- Kiểm tra đường dẫn file JSON có đúng không

### Lỗi: "Permission denied" khi upload
- Kiểm tra đã share thư mục Drive với Service Account email chưa
- Kiểm tra quyền của Service Account (phải là Editor hoặc Owner)

### Lỗi: "API not enabled"
- Kiểm tra đã bật Google Drive API trong Google Cloud Console chưa

---

## 📝 Ví dụ file .env hoàn chỉnh

```env
# MongoDB
MONGODB_URI=mongodb://localhost:27017/eduschool

# Backup - Local
BACKUP_DIR=./backups

# Backup - Google Drive (Optional)
GOOGLE_DRIVE_CREDENTIALS=./google-drive-credentials.json
GOOGLE_DRIVE_BACKUP_FOLDER_ID=1a2b3c4d5e6f7g8h9i0j
```

---

## 💡 Tips

1. **Chỉ dùng local backup:** Bỏ qua phần Google Drive, chỉ set `BACKUP_DIR`
2. **Dùng cả 2:** Cấu hình đầy đủ Google Drive để có backup dự phòng
3. **Kiểm tra dung lượng:** Google Drive free có 15GB, theo dõi dung lượng sử dụng
4. **Tự động cleanup:** Hệ thống tự động xóa backup cũ dựa trên `retentionMonths` trong Settings

---

## 📚 Tài liệu tham khảo

- [Google Drive API Documentation](https://developers.google.com/drive/api)
- [Service Accounts Guide](https://cloud.google.com/iam/docs/service-accounts)
- [Google Cloud Console](https://console.cloud.google.com/)

