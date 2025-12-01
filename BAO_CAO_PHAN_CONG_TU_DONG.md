# 📋 BÁO CÁO KIỂM TRA LOGIC PHÂN CÔNG TỰ ĐỘNG

## 📌 TÓM TẮT CẢI THIỆN MỚI NHẤT

### ✅ Các cải thiện đã thực hiện cho phân công giảng dạy tự động:

1. **Shuffle tasks để tránh thiên vị** ✅
   - Xáo trộn ngẫu nhiên danh sách tasks trước khi phân công
   - Tránh thiên vị theo thứ tự lớp (lớp đầu được ưu tiên hơn)

2. **Cải thiện logic chọn giáo viên** ✅
   - Thêm **tỷ lệ tải (Load Ratio)** để cân bằng tốt hơn
   - Ưu tiên giáo viên có tỷ lệ tải thấp hơn thay vì chỉ dựa vào số tuyệt đối
   - Chọn ngẫu nhiên trong top 3 candidates khi có nhiều giáo viên cùng điểm số
   - Thêm random factor khi tất cả tiêu chí đều bằng nhau

3. **Làm nhẹ kiểm tra availableMatrix** ✅
   - Chỉ kiểm tra giáo viên có ít nhất một slot rảnh
   - Không kiểm tra chi tiết số slot vì sẽ xử lý khi xếp TKB
   - Phù hợp với quy trình: **phân công trước, xếp TKB sau**

---

## 1. PHÂN CÔNG GIẢNG DẠY TỰ ĐỘNG (`autoAssignTeaching`)

### ✅ Logic hiện tại:

#### **Bước 1: Lọc và chuẩn bị dữ liệu**
- Lọc lớp theo khối (`grades`)
- Lọc môn học có ít nhất một khối trong `grades`
- Lọc giáo viên: `status='active'`, `isLeader != true`, `isDeleted != true`
- Lấy phân công hiện có (cùng năm học và học kỳ)
- Áp dụng proposal từ trưởng bộ môn (nếu `applyProposals=true`)

#### **Bước 2: Khởi tạo counters và maps**
- `teacherLoadMap`: Số lớp mỗi giáo viên đang dạy (tổng)
- `teacherWeeklyLessonsMap`: Số tiết/tuần mỗi giáo viên đang dạy
- `teacherSubjectLessonsMap`: Số tiết mỗi giáo viên dạy cho mỗi môn (để cân bằng)
- `teacherSubjectGradeCountMap`: Số lớp mỗi giáo viên dạy cho mỗi môn/khối (để chia đều)
- `teacherGradeCountMap`: Số lớp mỗi giáo viên dạy cho mỗi khối (để kiểm tra `maxClassPerGrade`)

#### **Bước 3: Tính tải hiện tại từ phân công cũ**
- Cập nhật tất cả counters dựa trên phân công hiện có (cùng năm học và học kỳ)

#### **Bước 4: Generate tasks (lớp + môn)**
- Tạo danh sách tasks: mỗi lớp × mỗi môn học phù hợp với khối
- Bỏ qua môn đã có phân công

#### **Bước 4.5: Shuffle tasks** - **CẢI THIỆN MỚI**
- Xáo trộn ngẫu nhiên danh sách tasks trước khi phân công
- Tránh thiên vị theo thứ tự lớp (lớp đầu được ưu tiên hơn)

#### **Bước 5: Xử lý từng task**

**5.1. Ưu tiên giáo viên cũ (nếu học kỳ 2)**
- Nếu là học kỳ 2, ưu tiên giáo viên đã dạy môn đó ở học kỳ 1 cùng năm học
- Kiểm tra lại các ràng buộc cho giáo viên cũ

**5.2. Tìm danh sách giáo viên có thể dạy**
- Loại bỏ BGH (`isLeader != true`)
- Chỉ giáo viên đang hoạt động (`status='active'`)
- Giáo viên phải có môn học này trong danh sách `subjects` hoặc `mainSubject`
- Giáo viên phải được phân quyền dạy khối này

**5.3. Lọc theo các ràng buộc (`canTeacherTeach`)**
- ✅ **Ràng buộc 1**: Không trùng lặp phân công
- ✅ **Ràng buộc 2**: Không vượt `maxClasses` (tổng)
- ✅ **Ràng buộc 3**: Không vượt `weeklyLessons` (sử dụng `effectiveWeeklyLessons`)
- ✅ **Ràng buộc 4**: Không vượt `maxClassPerGrade` (số lớp tối đa cho mỗi khối)
- ✅ **Ràng buộc 5**: Không vượt số lớp tính theo số tiết (`maxClassesByLessons = floor(maxWeeklyLessons / periodsPerWeek)`)
- ✅ **Ràng buộc 6**: Kiểm tra `availableMatrix` (lịch rảnh) - có ít nhất một slot rảnh
  - **CẢI THIỆN**: Chỉ kiểm tra cơ bản (có slot rảnh hay không), không kiểm tra chi tiết số slot
  - Lý do: Phân công trước, xếp TKB sau → sẽ xử lý chi tiết khi xếp TKB

**5.4. Sắp xếp và chọn giáo viên**
- ✅ **Ưu tiên 1**: `mainSubject` (giáo viên có môn này là môn chính)
- ✅ **Ưu tiên 2**: **Tỷ lệ tải thấp nhất** (Load Ratio = (số tiết hiện tại + số tiết mới) / số tiết tối đa) - **CẢI THIỆN MỚI**
- ✅ **Ưu tiên 3**: Giáo viên ít số tiết cho môn này nhất (cân bằng số tiết giữa các giáo viên cùng môn)
- ✅ **Ưu tiên 4**: Giáo viên ít lớp cho môn/khối này nhất (chia đều)
- ✅ **Ưu tiên 5**: Giáo viên ít lớp nhất (tổng)
- ✅ **Ưu tiên 6**: **Random** (khi tất cả đều bằng nhau) - **CẢI THIỆN MỚI**

**5.4.1. Chọn ngẫu nhiên trong top candidates** - **CẢI THIỆN MỚI**
- Khi có nhiều giáo viên có cùng điểm số cao nhất, chọn ngẫu nhiên trong top 3
- Tránh thiên vị khi có nhiều giáo viên phù hợp như nhau

**5.5. Tạo phân công và cập nhật counters**
- Tạo phân công mới
- Cập nhật tất cả counters

### ✅ CẢI THIỆN ĐÃ THỰC HIỆN:

1. **Shuffle tasks để tránh thiên vị** ✅
   - Xáo trộn ngẫu nhiên danh sách tasks trước khi phân công
   - Tránh thiên vị theo thứ tự lớp

2. **Cải thiện logic chọn giáo viên** ✅
   - Thêm **tỷ lệ tải (Load Ratio)** để cân bằng tốt hơn
   - Ưu tiên giáo viên có tỷ lệ tải thấp hơn thay vì chỉ dựa vào số tuyệt đối
   - Chọn ngẫu nhiên trong top 3 candidates khi có nhiều giáo viên cùng điểm số

3. **Làm nhẹ kiểm tra availableMatrix** ✅
   - Chỉ kiểm tra giáo viên có ít nhất một slot rảnh
   - Không kiểm tra chi tiết số slot vì sẽ xử lý khi xếp TKB
   - Phù hợp với quy trình: **phân công trước, xếp TKB sau**

### ⚠️ VẤN ĐỀ CÒN LẠI:

1. **Chưa xử lý trường hợp không tìm thấy giáo viên**:
   - Nếu không tìm thấy giáo viên phù hợp, task bị bỏ qua và thêm vào `unassigned`
   - **Khuyến nghị**: Có thể thêm logic "fallback" - nếu không tìm thấy giáo viên lý tưởng, có thể chọn giáo viên gần nhất (ví dụ: bỏ qua một số ràng buộc không quan trọng)

2. **Chưa kiểm tra conflict với thời khóa biểu đã xếp**:
   - Logic hiện tại chỉ kiểm tra `availableMatrix` (lịch rảnh của giáo viên)
   - Chưa kiểm tra xem giáo viên đã có tiết dạy ở các lớp khác vào thời điểm đó chưa
   - **Lưu ý**: Điều này sẽ được xử lý khi xếp TKB, không cần kiểm tra ở bước phân công

3. **Logic tính `effectiveWeeklyLessons`**:
   - Sử dụng `teacher.effectiveWeeklyLessons` nhưng chưa rõ logic tính toán
   - **Khuyến nghị**: Cần kiểm tra xem `effectiveWeeklyLessons` có được tính đúng không

---

## 2. PHÂN CÔNG GIÁO VIÊN CHỦ NHIỆM TỰ ĐỘNG (`autoAssignHomeroomTeachers`)

### ✅ Logic hiện tại:

#### **Bước 1: Lọc lớp cần gán GVCN**
- Nếu `reassignAll=true`: Lấy tất cả lớp (kể cả đã có GVCN)
- Nếu không: Chỉ lấy lớp chưa có GVCN (`teacherId=null`)

#### **Bước 2: Tìm môn ưu tiên**
- Tìm môn Văn (Ngữ văn)
- Tìm môn Toán

#### **Bước 3: Lấy danh sách giáo viên**
- Lấy tất cả giáo viên `status='active'`, `isDeleted != true`
- Tạo Set để check giáo viên đã làm GVCN

#### **Bước 4: Duyệt từng lớp**

**4.1. Nếu `reassignAll=true` và lớp đã có GVCN**:
- Gỡ GVCN cũ: Reset `cls.teacherId = null`
- Kiểm tra GVCN cũ còn lớp chủ nhiệm nào trong năm học đó không
- Nếu không còn → Gỡ flag `isHomeroom` trong `yearRoles` cho năm học đó
- Nếu lớp thuộc năm học hiện tại → Reset `currentHomeroomClassId` của GVCN cũ

**4.2. Tìm giáo viên phù hợp**:
- Lọc giáo viên chưa làm GVCN
- Lọc giáo viên không phải QLBM trong năm học đó (`isDepartmentHead != true` trong `yearRoles`)
- Lọc giáo viên có dạy khối của lớp (nếu có `subjects`)

**4.3. Sắp xếp giáo viên theo độ ưu tiên**:
- ✅ **Ưu tiên 1**: Giáo viên dạy Văn
- ✅ **Ưu tiên 2**: Giáo viên dạy Toán
- ✅ **Ưu tiên 3**: Giáo viên có `mainSubject`

**4.4. Gán GVCN và cập nhật**:
- Gán `cls.teacherId = selectedTeacher._id`
- Cập nhật `homeroomClassIds` (lịch sử)
- Cập nhật `isHomeroom = true`
- Nếu lớp thuộc năm học hiện tại → Cập nhật `currentHomeroomClassId`
- ✅ **Cập nhật `yearRoles`** cho năm học của lớp:
  - `isHomeroom = true`
  - `currentHomeroomClassId = cls._id`

### ⚠️ VẤN ĐỀ PHÁT HIỆN:

1. **Logic cập nhật `yearRoles` đã đúng**:
   - ✅ Sử dụng `updateTeacherYearRole` với `targetYear` là năm học của lớp
   - ✅ Cập nhật đúng `isHomeroom` và `currentHomeroomClassId` trong `yearRoles`

2. **Chưa kiểm tra giáo viên có thể làm GVCN nhiều lớp không**:
   - Logic hiện tại chỉ kiểm tra giáo viên chưa làm GVCN (`teachersWithHomeroom`)
   - **Khuyến nghị**: Có thể cho phép giáo viên làm GVCN nhiều lớp (nếu cần) hoặc thêm ràng buộc `maxHomeroomClasses`

3. **Chưa kiểm tra tải giảng dạy của giáo viên**:
   - Logic hiện tại không kiểm tra xem giáo viên có quá tải giảng dạy không
   - **Khuyến nghị**: Nên kiểm tra `weeklyLessons` và `maxClasses` trước khi gán GVCN

---

## 3. PHÂN CÔNG LỚP HỌC TỰ ĐỘNG (`autoAssignGrade`)

### ✅ Logic hiện tại:

#### **Bước 1: Lấy danh sách lớp và học sinh**
- Lấy tất cả lớp theo `year` và `grade`
- Lấy học sinh: `grade`, `admissionYear=year`, `entranceScore >= minScore`, `classId=null`
- Sắp xếp học sinh: `entranceScore` giảm dần, sau đó `name` tăng dần

#### **Bước 2: Phân công học sinh vào lớp**
- Dùng thuật toán "round-robin" (luân phiên)
- Mỗi học sinh được gán vào lớp có `left > 0` (còn chỗ)
- Sau khi gán, giảm `left` và chuyển sang lớp tiếp theo

#### **Bước 3: Tạo bảng điểm cho học sinh đã được gán**
- Sau khi transaction commit, tạo bảng điểm cho học sinh đã được gán
- Gọi `initGradesForStudent` cho cả 2 học kỳ

### ⚠️ VẤN ĐỀ PHÁT HIỆN:

1. **Logic phân công đơn giản nhưng hiệu quả**:
   - ✅ Sử dụng round-robin để chia đều học sinh vào các lớp
   - ✅ Sắp xếp theo `entranceScore` để đảm bảo học sinh giỏi được phân đều

2. **Chưa kiểm tra `capacity` của lớp**:
   - Logic hiện tại sử dụng `left = capacity - currentSize`
   - ✅ Đã kiểm tra `left > 0` trước khi gán

3. **Chưa xử lý trường hợp học sinh không đủ điểm**:
   - Logic hiện tại chỉ lấy học sinh có `entranceScore >= minScore`
   - **Khuyến nghị**: Có thể thêm logic xử lý học sinh không đủ điểm (ví dụ: gán vào lớp cuối cùng hoặc tạo lớp mới)

---

## 4. TỔNG KẾT VÀ KHUYẾN NGHỊ

### ✅ ĐIỂM MẠNH:

1. **Logic phân công giảng dạy rất chi tiết và cân bằng**:
   - ✅ **Cân bằng tải giảng dạy** bằng tỷ lệ tải (Load Ratio) - **CẢI THIỆN MỚI**
   - Cân bằng số tiết giữa các giáo viên cùng môn
   - Chia đều số lớp giữa các giáo viên
   - Ưu tiên giáo viên có `mainSubject`
   - Kiểm tra nhiều ràng buộc
   - ✅ **Tránh thiên vị** bằng shuffle tasks và random selection - **CẢI THIỆN MỚI**
   - ✅ **Phù hợp với quy trình**: Phân công trước, xếp TKB sau - **CẢI THIỆN MỚI**

2. **Logic phân công GVCN đơn giản và hiệu quả**:
   - Ưu tiên giáo viên dạy Văn/Toán
   - Cập nhật đúng `yearRoles`

3. **Logic phân công lớp học đơn giản và công bằng**:
   - Round-robin để chia đều
   - Sắp xếp theo điểm để đảm bảo công bằng

### ⚠️ CẢI THIỆN CẦN THIẾT (CÒN LẠI):

1. **Phân công giảng dạy**:
   - ✅ ~~Kiểm tra số slot rảnh >= số tiết/tuần của môn học~~ (Đã làm nhẹ - sẽ xử lý khi xếp TKB)
   - ✅ ~~Kiểm tra conflict với `Schedule` đã xếp~~ (Không cần - sẽ xử lý khi xếp TKB)
   - ⚠️ Thêm logic "fallback" khi không tìm thấy giáo viên lý tưởng (chưa thực hiện)

2. **Phân công GVCN**:
   - ✅ Kiểm tra tải giảng dạy của giáo viên trước khi gán GVCN
   - ✅ Có thể thêm ràng buộc `maxHomeroomClasses`

3. **Phân công lớp học**:
   - ✅ Xử lý trường hợp học sinh không đủ điểm

### 📝 GHI CHÚ:

- Tất cả logic đã sử dụng `yearRoles` đúng cách
- Logic cập nhật `yearRoles` khi gán/gỡ GVCN đã được xử lý đúng
- Logic tính toán tải giảng dạy đã được xử lý chi tiết

