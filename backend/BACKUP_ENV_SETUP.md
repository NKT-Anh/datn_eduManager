# 📝 Hướng dẫn cấu hình Backup trong .env

## 📍 Vị trí file `.env`

File `.env` nằm trong thư mục **`backend/`** (cùng cấp với `app.js`)

```
datn_eduManager/
├── backend/
│   ├── .env          ← File này (tạo mới nếu chưa có)
│   ├── app.js
│   ├── package.json
│   └── ...
```

---

## ✅ Cách tạo file `.env`

1. **Copy từ template:**
   ```bash
   cd backend
   cp ENV_TEMPLATE.txt .env
   ```

2. **Hoặc tạo mới:**
   - Tạo file mới tên `.env` trong thư mục `backend/`
   - Copy nội dung từ `ENV_TEMPLATE.txt`

---

## 🔧 Thêm cấu hình Backup vào `.env`

Mở file `backend/.env` và thêm các dòng sau:

### Option 1: Chỉ dùng Local Backup (Đơn giản nhất ✅)

```env
# Backup directory (local)
BACKUP_DIR=./backups
```

**Xong!** Backup sẽ được lưu trong thư mục `backend/backups/`

---

### Option 2: Local + Google Drive Backup

```env
# Backup directory (local)
BACKUP_DIR=./backups

# Google Drive credentials (đường dẫn file JSON)
GOOGLE_DRIVE_CREDENTIALS=./google-drive-credentials.json

# Folder ID trên Google Drive (Optional)
GOOGLE_DRIVE_BACKUP_FOLDER_ID=1a2b3c4d5e6f7g8h9i0j
```

**Lưu ý:**
- File `google-drive-credentials.json` cũng đặt trong thư mục `backend/`
- Xem hướng dẫn chi tiết trong `GOOGLE_DRIVE_BACKUP_SETUP.md`

---

## 📋 Ví dụ file `.env` hoàn chỉnh

```env
# MongoDB
MONGODB_URI=mongodb://localhost:27017/eduschool

# Server Port
PORT=3000

# Firebase Admin
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-client-email

# Backup Configuration
BACKUP_DIR=./backups
GOOGLE_DRIVE_CREDENTIALS=./google-drive-credentials.json
GOOGLE_DRIVE_BACKUP_FOLDER_ID=1a2b3c4d5e6f7g8h9i0j
```

---

## ⚠️ Lưu ý bảo mật

1. **KHÔNG commit file `.env` lên Git**
2. Đảm bảo `.env` đã có trong `.gitignore`:
   ```
   .env
   *.env
   ```
3. **KHÔNG commit file `google-drive-credentials.json`** lên Git

---

## 🧪 Kiểm tra cấu hình

Sau khi thêm vào `.env`, khởi động lại backend:

```bash
cd backend
npm start
```

Nếu cấu hình đúng, bạn sẽ thấy:
- ✅ Server khởi động thành công
- ✅ Thư mục `backups/` được tạo tự động (nếu chưa có)

---

## 📚 Tài liệu tham khảo

- Chi tiết Google Drive setup: `GOOGLE_DRIVE_BACKUP_SETUP.md`
- Template mẫu: `backend/ENV_TEMPLATE.txt`


