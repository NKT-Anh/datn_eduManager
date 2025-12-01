# 📋 Test Plan - Hệ thống Khảo sát Đánh giá Giáo viên

## 🎯 Mục tiêu Test
Kiểm tra toàn bộ flow của hệ thống khảo sát từ tạo khảo sát đến xem kết quả và trao danh hiệu.

---

## ✅ Test Flow 1: Học sinh làm khảo sát

### Prerequisites (Điều kiện cần có)
- [ ] Có ít nhất 1 học sinh đã đăng nhập
- [ ] Có ít nhất 1 giáo viên trong hệ thống
- [ ] Có ít nhất 1 môn học
- [ ] Có ít nhất 1 lớp học
- [ ] Có khảo sát đã được Admin tạo và mở (status = 'active')

### Test Steps

#### 1.1. Đăng nhập với tài khoản học sinh
- [ ] Đăng nhập thành công với role = 'student'
- [ ] Kiểm tra sidebar có menu "Khảo sát đánh giá" (`/student/surveys`)

#### 1.2. Xem danh sách khảo sát
- [ ] Truy cập `/student/surveys`
- [ ] Kiểm tra hiển thị danh sách khảo sát có sẵn
- [ ] Kiểm tra mỗi khảo sát hiển thị:
  - [ ] Tên khảo sát
  - [ ] Môn học
  - [ ] Học kỳ, năm học
  - [ ] Danh sách giáo viên cần đánh giá
  - [ ] Trạng thái (Chưa làm / Đã hoàn thành / Chưa bắt đầu / Đã kết thúc)

#### 1.3. Kiểm tra trạng thái khảo sát
- [ ] **Khảo sát chưa bắt đầu** (startDate > now):
  - [ ] Hiển thị badge "Chưa bắt đầu" với số ngày còn lại
  - [ ] Nút "Đánh giá" bị disable hoặc không hiển thị
  - [ ] Click vào khảo sát → Hiển thị toast "Khảo sát chưa bắt đầu"

- [ ] **Khảo sát đang active** (startDate <= now <= endDate):
  - [ ] Hiển thị badge "Chưa làm" hoặc "Sắp kết thúc" (nếu còn ≤ 3 ngày)
  - [ ] Nút "Đánh giá" có thể click

- [ ] **Khảo sát đã kết thúc** (endDate < now):
  - [ ] Hiển thị badge "Đã kết thúc" (màu đỏ)
  - [ ] Nút "Đánh giá" bị disable
  - [ ] Click vào khảo sát → Hiển thị toast "Khảo sát đã kết thúc"

#### 1.4. Đánh giá giáo viên
- [ ] Click nút "Đánh giá" cho một giáo viên
- [ ] Kiểm tra dialog hiển thị:
  - [ ] Tên khảo sát
  - [ ] Tên giáo viên
  - [ ] Danh sách 5 câu hỏi mặc định
  - [ ] Radio buttons (1-5) cho mỗi câu hỏi

#### 1.5. Validation form đánh giá
- [ ] **Test case 1: Không chọn đủ câu hỏi**
  - [ ] Chỉ chọn 1-2 câu hỏi
  - [ ] Click "Gửi đánh giá"
  - [ ] Hiển thị toast lỗi: "Vui lòng đánh giá tất cả X câu hỏi. Bạn còn thiếu Y câu hỏi."

- [ ] **Test case 2: Chọn đủ câu hỏi**
  - [ ] Chọn điểm (1-5) cho tất cả 5 câu hỏi
  - [ ] Click "Gửi đánh giá"
  - [ ] Hiển thị toast thành công: "Đã gửi đánh giá thành công. Cảm ơn bạn đã tham gia khảo sát!"
  - [ ] Dialog đóng lại
  - [ ] Trạng thái khảo sát cập nhật thành "Đã hoàn thành" (màu xanh)

#### 1.6. Kiểm tra submit 1 lần/GV/khảo sát
- [ ] Thử đánh giá lại cùng một giáo viên cho cùng khảo sát
- [ ] Click "Đánh giá" → Hiển thị toast: "Bạn đã đánh giá giáo viên này rồi"
- [ ] Hoặc nếu mở dialog → Click "Gửi đánh giá" → Hiển thị lỗi: "Bạn đã đánh giá giáo viên này rồi. Mỗi học sinh chỉ có thể đánh giá một giáo viên một lần cho mỗi khảo sát."

#### 1.7. Đánh giá nhiều giáo viên
- [ ] Đánh giá giáo viên thứ 2, thứ 3... (nếu có)
- [ ] Kiểm tra mỗi giáo viên có thể đánh giá riêng biệt
- [ ] Kiểm tra trạng thái từng giáo viên cập nhật độc lập

---

## ✅ Test Flow 2: Giáo viên xem thống kê

### Prerequisites
- [ ] Có ít nhất 1 giáo viên đã đăng nhập
- [ ] Đã có ít nhất 1 khảo sát với phản hồi từ học sinh

### Test Steps

#### 2.1. Đăng nhập với tài khoản giáo viên
- [ ] Đăng nhập thành công với role = 'teacher'
- [ ] Kiểm tra sidebar có menu:
  - [ ] "Danh hiệu / Khen thưởng" (`/gvbm/awards` hoặc `/gvcn/awards` hoặc `/qlbm/awards`)
  - [ ] "Thống kê khảo sát" (`/gvbm/survey-statistics` hoặc `/gvcn/survey-statistics` hoặc `/qlbm/survey-statistics`)

#### 2.2. Xem thống kê khảo sát
- [ ] Truy cập `/gvbm/survey-statistics` (hoặc tương ứng với role)
- [ ] Kiểm tra hiển thị:
  - [ ] **Tổng quan thống kê:**
    - [ ] Tổng số khảo sát đã tham gia
    - [ ] Điểm trung bình tổng thể
    - [ ] Xếp loại hiện tại (Xuất sắc / Khá / Trung bình / Cần cải thiện)

  - [ ] **Biểu đồ điểm trung bình từng câu hỏi:**
    - [ ] Bar chart hiển thị điểm trung bình cho 5 câu hỏi
    - [ ] Mỗi câu hỏi có điểm từ 1-5

  - [ ] **Bảng thống kê theo khảo sát:**
    - [ ] Danh sách các khảo sát đã tham gia
    - [ ] Điểm trung bình mỗi khảo sát
    - [ ] Số lượng phản hồi

  - [ ] **Biểu đồ phân bố xếp loại:**
    - [ ] Pie chart hiển thị tỷ lệ các mức xếp loại

#### 2.3. Filter dữ liệu
- [ ] **Filter theo năm học:**
  - [ ] Chọn năm học khác → Dữ liệu cập nhật theo năm học

- [ ] **Filter theo học kỳ:**
  - [ ] Chọn "Học kỳ 1" → Chỉ hiển thị khảo sát học kỳ 1
  - [ ] Chọn "Học kỳ 2" → Chỉ hiển thị khảo sát học kỳ 2
  - [ ] Chọn "Tất cả" → Hiển thị tất cả

- [ ] **Filter theo khảo sát cụ thể:**
  - [ ] Chọn một khảo sát → Biểu đồ và bảng cập nhật theo khảo sát đó

#### 2.4. Kiểm tra tính ẩn danh
- [ ] Kiểm tra không hiển thị tên học sinh nào đánh giá
- [ ] Chỉ hiển thị điểm trung bình và thống kê tổng hợp

#### 2.5. Xem danh hiệu / Khen thưởng
- [ ] Truy cập `/gvbm/awards` (hoặc tương ứng)
- [ ] Kiểm tra hiển thị:
  - [ ] Xếp loại hiện tại
  - [ ] Tổng số danh hiệu
  - [ ] Điểm khảo sát trung bình
  - [ ] Danh sách danh hiệu/khen thưởng:
    - [ ] Tên danh hiệu
    - [ ] Năm học, học kỳ
    - [ ] Lý do khen thưởng
    - [ ] Ngày trao danh hiệu
    - [ ] Điểm khảo sát liên quan (nếu có)

- [ ] **Filter theo năm học/học kỳ:**
  - [ ] Chọn năm học/học kỳ → Danh sách cập nhật

---

## ✅ Test Flow 3: BGH xem dashboard

### Prerequisites
- [ ] Có tài khoản BGH (teacher với `isLeader = true`)
- [ ] Đã có ít nhất 2-3 khảo sát với phản hồi từ học sinh
- [ ] Đã có ít nhất 3-5 giáo viên được đánh giá

### Test Steps

#### 3.1. Đăng nhập với tài khoản BGH
- [ ] Đăng nhập thành công với role = 'teacher' và `isLeader = true`
- [ ] Kiểm tra sidebar có menu "Dashboard khảo sát" (`/bgh/survey-dashboard`)

#### 3.2. Xem dashboard tổng quan
- [ ] Truy cập `/bgh/survey-dashboard`
- [ ] Kiểm tra hiển thị:
  - [ ] **Tổng quan thống kê:**
    - [ ] Tổng số giáo viên được đánh giá
    - [ ] Điểm trung bình toàn trường
    - [ ] Tổng số phản hồi
    - [ ] Tổng số khảo sát

#### 3.3. Xem xếp hạng giáo viên
- [ ] Kiểm tra bảng xếp hạng giáo viên:
  - [ ] Sắp xếp theo điểm trung bình (cao → thấp)
  - [ ] Hiển thị: Tên GV, Mã GV, Điểm TB, Xếp loại, Số phản hồi
  - [ ] Top 3 giáo viên có điểm cao nhất được highlight

#### 3.4. Thống kê theo môn học
- [ ] Kiểm tra bảng thống kê theo môn:
  - [ ] Mỗi môn học hiển thị:
    - [ ] Số giáo viên
    - [ ] Điểm trung bình môn
    - [ ] Số phản hồi
  - [ ] Có thể sort theo điểm trung bình

#### 3.5. Thống kê theo bộ môn
- [ ] Kiểm tra bảng thống kê theo bộ môn:
  - [ ] Mỗi bộ môn hiển thị:
    - [ ] Số giáo viên
    - [ ] Điểm trung bình bộ môn
    - [ ] Số phản hồi

#### 3.6. Thống kê theo lớp
- [ ] Kiểm tra bảng thống kê theo lớp:
  - [ ] Mỗi lớp hiển thị:
    - [ ] Số giáo viên được đánh giá
    - [ ] Điểm trung bình lớp
    - [ ] Số phản hồi

#### 3.7. Phân bố điểm (biểu đồ)
- [ ] Kiểm tra Pie chart phân bố điểm:
  - [ ] Hiển thị tỷ lệ các mức điểm (1-2, 3, 4, 5)
  - [ ] Hoặc tỷ lệ xếp loại (Xuất sắc, Khá, Trung bình, Cần cải thiện)

#### 3.8. Filter dữ liệu
- [ ] **Filter theo năm học:**
  - [ ] Chọn năm học → Tất cả dữ liệu cập nhật

- [ ] **Filter theo học kỳ:**
  - [ ] Chọn "Học kỳ 1" → Chỉ hiển thị dữ liệu học kỳ 1
  - [ ] Chọn "Học kỳ 2" → Chỉ hiển thị dữ liệu học kỳ 2

- [ ] **Filter theo môn học:**
  - [ ] Chọn một môn → Chỉ hiển thị thống kê môn đó

- [ ] **Filter theo bộ môn:**
  - [ ] Chọn một bộ môn → Chỉ hiển thị thống kê bộ môn đó

- [ ] **Filter theo lớp:**
  - [ ] Chọn một lớp → Chỉ hiển thị thống kê lớp đó

- [ ] **Kết hợp nhiều filter:**
  - [ ] Chọn năm học + học kỳ + môn → Dữ liệu cập nhật chính xác

#### 3.9. Kiểm tra tính ẩn danh
- [ ] Kiểm tra không hiển thị tên học sinh nào đánh giá
- [ ] Chỉ hiển thị thống kê tổng hợp

---

## ✅ Test Flow 4: Admin trao danh hiệu

### Prerequisites
- [ ] Có tài khoản Admin đã đăng nhập
- [ ] Đã có ít nhất 1 giáo viên trong hệ thống
- [ ] Đã có ít nhất 1 khảo sát với phản hồi (để có điểm trung bình)

### Test Steps

#### 4.1. Đăng nhập với tài khoản Admin
- [ ] Đăng nhập thành công với role = 'admin'
- [ ] Kiểm tra sidebar có menu "Khảo sát" → "Danh hiệu / Khen thưởng" (`/admin/awards`)

#### 4.2. Xem danh sách giáo viên có danh hiệu
- [ ] Truy cập `/admin/awards`
- [ ] Kiểm tra hiển thị:
  - [ ] Bảng danh sách giáo viên
  - [ ] Cột: Tên GV, Mã GV, Xếp loại, Điểm TB, Số danh hiệu, Thao tác
  - [ ] Filter tìm kiếm theo tên/mã GV
  - [ ] Filter theo năm học

#### 4.3. Trao danh hiệu cho giáo viên
- [ ] Click nút "Trao danh hiệu" (ở header hoặc trong bảng)
- [ ] Kiểm tra dialog hiển thị:
  - [ ] Dropdown chọn giáo viên
  - [ ] Input "Danh hiệu / Khen thưởng" (bắt buộc)
  - [ ] Input "Năm học"
  - [ ] Dropdown "Học kỳ" (Tất cả / Học kỳ 1 / Học kỳ 2)
  - [ ] Textarea "Lý do khen thưởng"
  - [ ] Input "Điểm khảo sát trung bình" (nếu có)

#### 4.4. Validation form trao danh hiệu
- [ ] **Test case 1: Không điền đủ thông tin bắt buộc**
  - [ ] Không chọn giáo viên hoặc không điền "Danh hiệu"
  - [ ] Click "Trao danh hiệu"
  - [ ] Hiển thị toast lỗi: "Vui lòng điền đầy đủ thông tin bắt buộc"

- [ ] **Test case 2: Điền đủ thông tin**
  - [ ] Chọn giáo viên
  - [ ] Điền "Danh hiệu" (VD: "Giáo viên xuất sắc")
  - [ ] Chọn năm học
  - [ ] Chọn học kỳ (hoặc "Tất cả")
  - [ ] Điền lý do (tùy chọn)
  - [ ] Điền điểm khảo sát (tùy chọn)
  - [ ] Click "Trao danh hiệu"
  - [ ] Hiển thị toast thành công: "Đã trao danh hiệu/khen thưởng thành công"
  - [ ] Dialog đóng lại
  - [ ] Danh sách giáo viên cập nhật (số danh hiệu tăng lên)

#### 4.5. Trao danh hiệu từ danh sách giáo viên
- [ ] Click nút "Trao danh hiệu" ở một giáo viên cụ thể trong bảng
- [ ] Kiểm tra dialog tự động chọn giáo viên đó (dropdown disabled)
- [ ] Điền thông tin và trao danh hiệu
- [ ] Kiểm tra danh hiệu được thêm vào giáo viên đó

#### 4.6. Xem danh hiệu của giáo viên
- [ ] Sau khi trao danh hiệu, kiểm tra giáo viên đó có thể xem danh hiệu:
  - [ ] Đăng nhập với tài khoản giáo viên đó
  - [ ] Truy cập "Danh hiệu / Khen thưởng"
  - [ ] Kiểm tra danh hiệu vừa trao hiển thị trong danh sách

#### 4.7. Filter và tìm kiếm
- [ ] **Tìm kiếm theo tên:**
  - [ ] Nhập tên giáo viên → Danh sách lọc theo tên

- [ ] **Tìm kiếm theo mã:**
  - [ ] Nhập mã giáo viên → Danh sách lọc theo mã

- [ ] **Filter theo năm học:**
  - [ ] Chọn năm học → Chỉ hiển thị giáo viên có danh hiệu trong năm học đó

---

## 🔍 Test Cases Bổ sung

### Test Case: Khảo sát chưa bắt đầu
- [ ] Tạo khảo sát với `startDate` trong tương lai
- [ ] Học sinh không thể đánh giá
- [ ] Hiển thị thông báo "Chưa bắt đầu" với số ngày còn lại

### Test Case: Khảo sát đã kết thúc
- [ ] Tạo khảo sát với `endDate` trong quá khứ
- [ ] Học sinh không thể đánh giá
- [ ] Hiển thị thông báo "Đã kết thúc"

### Test Case: Khảo sát sắp kết thúc
- [ ] Tạo khảo sát với `endDate` còn ≤ 3 ngày
- [ ] Học sinh thấy badge "Sắp kết thúc" (màu cam)
- [ ] Vẫn có thể đánh giá

### Test Case: Tính điểm trung bình
- [ ] Có 3 học sinh đánh giá cùng 1 giáo viên:
  - [ ] Học sinh 1: [5, 5, 5, 5, 5] → TB = 5.0
  - [ ] Học sinh 2: [4, 4, 4, 4, 4] → TB = 4.0
  - [ ] Học sinh 3: [3, 3, 3, 3, 3] → TB = 3.0
- [ ] Kiểm tra điểm trung bình giáo viên = (5.0 + 4.0 + 3.0) / 3 = 4.0

### Test Case: Phân loại giáo viên
- [ ] Điểm TB ≥ 4.5 → "Xuất sắc"
- [ ] Điểm TB ≥ 4.0 → "Khá"
- [ ] Điểm TB ≥ 3.0 → "Trung bình"
- [ ] Điểm TB < 3.0 → "Cần cải thiện"

### Test Case: Notification khi mở khảo sát
- [ ] Admin mở khảo sát với `sendNotification = true`
- [ ] Kiểm tra học sinh nhận được notification:
  - [ ] Notification hiển thị trong hệ thống
  - [ ] Có link đến `/student/surveys`

---

## 🐛 Bug Checklist

### Lỗi thường gặp cần kiểm tra:
- [ ] Lỗi khi submit khảo sát (validation)
- [ ] Lỗi khi tính điểm trung bình
- [ ] Lỗi khi filter dữ liệu
- [ ] Lỗi khi trao danh hiệu
- [ ] Lỗi hiển thị biểu đồ (nếu không có dữ liệu)
- [ ] Lỗi permission (BGH/GV không thể truy cập trang Admin)
- [ ] Lỗi khi khảo sát không có phản hồi

---

## 📝 Ghi chú Test

### Môi trường Test:
- Frontend: `http://localhost:8080`
- Backend: `http://localhost:3000`

### Tài khoản Test đề xuất:
- **Admin**: admin@example.com
- **BGH**: bgh@example.com (teacher với isLeader = true)
- **GVCN**: gvcn@example.com (teacher với isHomeroom = true)
- **GVBM**: gvbm@example.com (teacher thường)
- **Student**: student@example.com

### Dữ liệu Test đề xuất:
- Tạo ít nhất 3-5 khảo sát
- Mỗi khảo sát có ít nhất 2-3 giáo viên
- Mỗi giáo viên có ít nhất 3-5 phản hồi từ học sinh

---

## ✅ Kết quả Test

Sau khi hoàn thành test, điền kết quả:

- [ ] **Flow 1 (Học sinh)**: ✅ Pass / ❌ Fail
- [ ] **Flow 2 (Giáo viên)**: ✅ Pass / ❌ Fail
- [ ] **Flow 3 (BGH)**: ✅ Pass / ❌ Fail
- [ ] **Flow 4 (Admin)**: ✅ Pass / ❌ Fail

### Ghi chú lỗi (nếu có):
```
[Ghi lại các lỗi phát hiện được]
```

---

**Ngày test**: _______________
**Người test**: _______________

