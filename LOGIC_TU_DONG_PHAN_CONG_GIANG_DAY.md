# Logic Tự Động Phân Công Giảng Dạy

## 📋 Tổng quan
Chức năng tự động phân công giáo viên dạy các môn học cho các lớp dựa trên quy tắc:
- Phân công giáo viên phù hợp với môn học và khối lớp
- Cân bằng tải giảng dạy giữa các giáo viên
- Ưu tiên giáo viên đã dạy ở học kỳ trước (học kỳ 2)
- Tính toán động số lớp tối đa mỗi giáo viên

## 🔄 Quy trình xử lý

### 1. Khởi tạo dữ liệu
```typescript
// Input:
// - classes: Danh sách lớp
// - subjects: Danh sách môn học
// - teachers: Danh sách giáo viên
// - existingAssignments: Phân công hiện tại
// - year: Năm học (VD: "2024-2025")
// - semester: Học kỳ ("1" hoặc "2")
// - grades: Danh sách khối cần phân công (VD: ["10", "11", "12"])
```

### 2. Lọc phân công theo năm học và học kỳ
```typescript
// Chỉ lấy phân công của cùng năm học (để reset mỗi năm)
const currentYearAssignments = existingAssignments.filter(a => a.year === year);

// Lấy phân công của học kỳ hiện tại (để reset mỗi học kỳ)
const currentSemesterAssignments = currentYearAssignments.filter(
  a => a.semester === semester
);
```

### 3. Tính toán tải giảng viên (Teacher Load)
```typescript
// Tạo map đếm số lớp đã phân công cho mỗi giáo viên trong học kỳ hiện tại
const teacherLoadMap = new Map<string, number>();
teachers.forEach(t => teacherLoadMap.set(t._id, 0));

// Đếm số phân công hiện có của mỗi giáo viên
currentSemesterAssignments.forEach(a => {
  if (a.teacherId?._id) {
    teacherLoadMap.set(
      a.teacherId._id,
      (teacherLoadMap.get(a.teacherId._id) || 0) + 1
    );
  }
});
```

**Lưu ý**: Tải giảng viên được reset mỗi học kỳ, không tích lũy qua các học kỳ.

### 4. Map tránh trùng môn trong cùng lớp
```typescript
// Map để tránh phân công trùng môn trong cùng lớp
const assignedMap = new Map<string, Set<string>>();
// key = classId, value = Set<subjectId>

currentSemesterAssignments.forEach(a => {
  if (!assignedMap.has(a.classId._id)) {
    assignedMap.set(a.classId._id, new Set());
  }
  assignedMap.get(a.classId._id)!.add(a.subjectId._id);
});
```

### 5. Tính toán số lớp tối đa mỗi giáo viên (động)
```typescript
function calculateMaxClassPerTeacher(
  classes: ClassType[],
  subjects: Subject[],
  teachers: Teacher[],
  grade: string
): Map<string, number> {
  // Với mỗi môn học trong khối:
  // - Số lớp cần phân công = số lớp trong khối
  // - Số giáo viên đủ điều kiện = số giáo viên có thể dạy môn này
  // - Max lớp/giáo viên = ceil(số lớp / số giáo viên)
  
  // VD: Khối 10 có 10 lớp, môn Toán có 3 giáo viên
  // → Max = ceil(10/3) = 4 lớp/giáo viên
}
```

**Ví dụ**:
- Khối 10 có 10 lớp, môn Toán có 3 giáo viên → Max = 4 lớp/giáo viên
- Khối 11 có 8 lớp, môn Văn có 2 giáo viên → Max = 4 lớp/giáo viên

### 6. Lọc lớp theo khối được chọn
```typescript
// Chỉ phân công cho các lớp thuộc khối được chọn
const targetClasses = classes.filter(c => 
  grades.includes(String(c.grade))
);
```

### 7. Duyệt từng lớp và môn học

#### Bước 1: Lấy danh sách môn phù hợp với lớp
```typescript
// Lọc môn học phù hợp với khối của lớp
const classSubjects = subjects.filter(s => 
  s.grades.includes(cls.grade as any)
);
```

#### Bước 2: Kiểm tra môn đã được phân công chưa
```typescript
// Nếu lớp đã có phân công môn này trong học kỳ hiện tại → bỏ qua
if (assignedMap.get(cls._id)?.has(subj._id)) continue;
```

#### Bước 3: Chọn giáo viên

**Trường hợp 1: Học kỳ 2 - Ưu tiên giáo viên cũ**
```typescript
if (semester === "2") {
  // Tìm phân công của học kỳ 1 cùng năm học
  const prev = currentYearAssignments.find(
    a =>
      a.classId._id === cls._id &&
      a.subjectId._id === subj._id &&
      a.semester === "1"
  );
  
  // Nếu tìm thấy và giáo viên vẫn còn trong danh sách → ưu tiên
  if (prev && teachers.some(t => t._id === prev.teacherId._id)) {
    selectedTeacher = teachers.find(t => t._id === prev.teacherId._id);
  }
}
```

**Trường hợp 2: Học kỳ 1 hoặc không tìm thấy giáo viên cũ**
```typescript
if (!selectedTeacher) {
  // 1. Lọc giáo viên có thể dạy môn này (phải có subjectId và đúng khối)
  const candidateTeachers = teachers
    .filter(t =>
      t.subjects?.some(
        s =>
          s.subjectId._id === subj._id &&
          s.grades.includes(cls.grade as any)
      )
    )
    // 2. Sắp xếp theo tải hiện tại (giáo viên có ít lớp nhất trước)
    .sort(
      (a, b) =>
        (teacherLoadMap.get(a._id) || 0) - (teacherLoadMap.get(b._id) || 0)
    );
  
  // 3. Tính max lớp cho giáo viên-môn này
  const maxClassMap = calculateMaxClassPerTeacher(
    targetClasses, subjects, teachers, cls.grade as string
  );
  
  // 4. Chọn giáo viên đầu tiên chưa đạt max
  selectedTeacher = candidateTeachers.find(t => {
    const maxClass = maxClassMap.get(`${t._id}-${subj._id}`) || 5;
    return (teacherLoadMap.get(t._id) || 0) < maxClass;
  });
}
```

**Nếu không tìm thấy giáo viên:**
```typescript
if (!selectedTeacher) {
  unassigned.push({ 
    className: cls.className, 
    subjectName: subj.name 
  });
  console.warn(`⚠️ Không tìm thấy giáo viên cho môn ${subj.name} lớp ${cls.className}`);
  continue;
}
```

#### Bước 4: Tạo phân công mới
```typescript
const assignment: TeachingAssignmentPayload = {
  teacherId: selectedTeacher._id,
  subjectId: subj._id,
  classId: cls._id,
  year,
  semester,
};

newAssignments.push(assignment);

// Cập nhật map và tải giảng viên
if (!assignedMap.has(cls._id)) assignedMap.set(cls._id, new Set());
assignedMap.get(cls._id)!.add(subj._id);
teacherLoadMap.set(
  selectedTeacher._id,
  (teacherLoadMap.get(selectedTeacher._id) || 0) + 1
);
```

## 📊 Kết quả trả về

```typescript
// Trả về danh sách phân công mới (TeachingAssignmentPayload[])
return newAssignments;

// Các lớp/môn chưa được phân công được log vào console
if (unassigned.length > 0) {
  console.warn("⚠️ Các lớp chưa được phân công:", unassigned);
}
```

## 🎯 Quy tắc phân công

### Quy tắc 1: Tránh trùng môn trong cùng lớp
- **Không cho phép**: Một lớp không thể có 2 giáo viên dạy cùng 1 môn trong cùng học kỳ
- **Ví dụ**: Lớp 10A1 đã có giáo viên A dạy Toán học kỳ 1 → Không phân công giáo viên B dạy Toán cho lớp 10A1 học kỳ 1

### Quy tắc 2: Giáo viên phải phù hợp với môn và khối
- **Điều kiện**: Giáo viên phải có môn học (`subjectId`) và khối lớp (`grades`) trong danh sách `subjects` của mình
- **Ví dụ**: 
  - Giáo viên A có thể dạy Toán khối 10, 11 → Có thể phân công Toán cho lớp 10A1, 11B2 ✅
  - Giáo viên B chỉ có thể dạy Văn khối 10 → Không thể phân công Toán cho lớp 10A1 ❌

### Quy tắc 3: Cân bằng tải giảng dạy
- **Nguyên tắc**: Ưu tiên giáo viên có ít lớp nhất
- **Ví dụ**: 
  - Giáo viên A đã dạy 2 lớp, giáo viên B đã dạy 5 lớp
  - Phân công mới → Chọn giáo viên A ✅

### Quy tắc 4: Giới hạn số lớp tối đa (động)
- **Tính toán**: `max = ceil(số lớp trong khối / số giáo viên đủ điều kiện)`
- **Ví dụ**:
  - Khối 10 có 10 lớp, môn Toán có 3 giáo viên → Max = 4 lớp/giáo viên
  - Khối 11 có 8 lớp, môn Văn có 2 giáo viên → Max = 4 lớp/giáo viên
- **Nếu không đủ giáo viên**: Sử dụng giá trị mặc định = 5 lớp/giáo viên

### Quy tắc 5: Ưu tiên giáo viên cũ (học kỳ 2)
- **Nguyên tắc**: Nếu là học kỳ 2, ưu tiên giáo viên đã dạy môn đó cho lớp đó ở học kỳ 1 cùng năm học
- **Ví dụ**: 
  - Học kỳ 1: Giáo viên A dạy Toán lớp 10A1
  - Học kỳ 2: Tự động phân công giáo viên A dạy Toán lớp 10A1 (nếu giáo viên A vẫn còn trong hệ thống) ✅

### Quy tắc 6: Reset tải giảng viên mỗi học kỳ
- **Nguyên tắc**: Tải giảng viên được tính lại từ đầu mỗi học kỳ, không tích lũy
- **Ví dụ**: 
  - Học kỳ 1: Giáo viên A dạy 5 lớp
  - Học kỳ 2: Tải giảng viên A reset về 0, tính lại từ đầu

### Quy tắc 7: Reset toàn bộ mỗi năm học
- **Nguyên tắc**: Phân công được reset hoàn toàn mỗi năm học mới
- **Ví dụ**: 
  - Năm 2024-2025: Giáo viên A dạy Toán lớp 10A1
  - Năm 2025-2026: Phân công mới, không kế thừa từ năm trước

## 🔧 API Endpoint

### Frontend Service
```typescript
// websiteEdu/src/services/smartSystem/autoAssignTeaching.ts
export function autoAssignTeaching(
  classes: ClassType[],
  subjects: Subject[],
  teachers: Teacher[],
  existingAssignments: TeachingAssignment[],
  year: string,
  semester: "1" | "2",
  grades: string[]
): TeachingAssignmentPayload[]

// websiteEdu/src/services/assignmentApi.ts
assignmentApi.createBulk(payloads: TeachingAssignmentPayload[])
```

### Frontend UI
```typescript
// websiteEdu/src/pages/admin/TeachingAssignmentPage.tsx
// websiteEdu/src/components/dialogs/AutoAssignDialog.tsx

// Dialog cho phép chọn:
// - Năm học
// - Học kỳ (1 hoặc 2)
// - Khối (10, 11, 12 - có thể chọn nhiều)

// Sau khi chọn → Gọi autoAssignTeaching() → Gọi API createBulk()
```

## 📝 Lưu ý

1. **Dữ liệu đầu vào**: Cần có đầy đủ:
   - Danh sách lớp (classes)
   - Danh sách môn học (subjects) với thông tin `grades` (khối nào học môn này)
   - Danh sách giáo viên (teachers) với thông tin `subjects` (giáo viên dạy môn gì, khối nào)
   - Phân công hiện tại (existingAssignments) để tránh trùng

2. **Lọc theo khối**: Chỉ phân công cho các lớp thuộc khối được chọn trong dialog

3. **Học kỳ**: 
   - Học kỳ 1: Phân công mới hoàn toàn
   - Học kỳ 2: Ưu tiên giáo viên đã dạy ở học kỳ 1

4. **Tải giảng viên**: 
   - Reset mỗi học kỳ
   - Chỉ tính số lớp trong học kỳ hiện tại
   - Không tích lũy qua các học kỳ

5. **Số lớp tối đa**: 
   - Tính động dựa trên số lớp và số giáo viên
   - Đảm bảo phân công công bằng giữa các giáo viên

6. **Xử lý lỗi**: 
   - Các lớp/môn không tìm thấy giáo viên sẽ được ghi vào `unassigned` và log cảnh báo
   - Không ảnh hưởng đến các phân công khác

## 🎨 UI/UX

- Nút "Tự động phân công" nằm ở trang quản lý phân công giảng dạy
- Dialog cho phép chọn:
  - **Năm học**: Input text (VD: "2024-2025")
  - **Học kỳ**: Select (Học kỳ 1 / Học kỳ 2)
  - **Khối**: Checkbox (Khối 10, 11, 12 - có thể chọn nhiều)
- Sau khi xác nhận:
  - Hiển thị toast notification với số phân công đã tạo
  - Tự động refresh danh sách phân công
  - Log cảnh báo nếu có lớp/môn chưa được phân công

## 📝 Hướng dẫn thực hiện phân công tự động

### Điều kiện tiên quyết (Prerequisites)

Trước khi thực hiện phân công tự động, cần đảm bảo có đầy đủ dữ liệu sau:

#### 1. ✅ Danh sách lớp học (Classes)
- Đã tạo các lớp học trong hệ thống
- Mỗi lớp phải có thông tin:
  - `className`: Tên lớp (VD: "10A1", "11B2")
  - `grade`: Khối lớp ("10", "11", "12")
  - `year`: Năm học (VD: "2024-2025")

#### 2. ✅ Danh sách môn học (Subjects)
- Đã tạo các môn học trong hệ thống
- Mỗi môn phải có thông tin:
  - `name`: Tên môn học (VD: "Toán", "Văn", "Anh")
  - `grades`: Danh sách khối được học môn này (VD: ["10", "11", "12"])

#### 3. ✅ Danh sách giáo viên (Teachers)
- Đã tạo tài khoản giáo viên trong hệ thống
- Mỗi giáo viên phải có thông tin:
  - `name`: Tên giáo viên
  - `subjects`: Danh sách môn học giáo viên có thể dạy
    - Mỗi môn trong `subjects` phải có:
      - `subjectId`: ID môn học
      - `grades`: Danh sách khối có thể dạy (VD: ["10", "11"])

**Ví dụ cấu trúc giáo viên:**
```json
{
  "_id": "teacher123",
  "name": "Nguyễn Văn A",
  "subjects": [
    {
      "subjectId": { "_id": "math123", "name": "Toán" },
      "grades": ["10", "11"]
    },
    {
      "subjectId": { "_id": "physics123", "name": "Vật lý" },
      "grades": ["10", "11", "12"]
    }
  ]
}
```

#### 4. ✅ Năm học (School Year)
- Đã tạo năm học trong hệ thống
- Format: "YYYY-YYYY" (VD: "2024-2025")

### Quy trình thực hiện

#### Bước 1: Truy cập trang Phân công giảng dạy
```
Menu: Admin → Phân công giảng dạy
URL: /admin/teachingAssignmentPage
```

#### Bước 2: Mở dialog Tự động phân công
- Click nút **"Tự động phân công"** hoặc **"Auto Assign"** ở header trang

#### Bước 3: Thiết lập thông tin phân công
Dialog sẽ hiển thị các trường cần điền:

1. **Năm học** (Year)
   - Nhập năm học theo format: "YYYY-YYYY"
   - VD: "2024-2025"
   - Mặc định: Năm học hiện tại

2. **Học kỳ** (Semester)
   - Chọn: **Học kỳ 1** hoặc **Học kỳ 2**
   - Mặc định: Học kỳ 1

3. **Khối** (Grades)
   - Chọn một hoặc nhiều khối: **Khối 10**, **Khối 11**, **Khối 12**
   - Có thể chọn nhiều khối cùng lúc
   - Bắt buộc: Phải chọn ít nhất 1 khối

#### Bước 4: Xác nhận và thực hiện
- Click nút **"Xác nhận"** hoặc **"Confirm"**
- Hệ thống sẽ:
  1. Lọc các lớp thuộc khối đã chọn
  2. Lọc các môn học phù hợp với từng lớp
  3. Tìm giáo viên phù hợp cho mỗi môn/lớp
  4. Tạo phân công mới
  5. Lưu vào database

#### Bước 5: Kiểm tra kết quả
- Hệ thống hiển thị thông báo:
  ```
  ✅ Đã phân công tự động X môn/lớp cho năm Y, học kỳ Z, khối ...
  ```
- Danh sách phân công tự động cập nhật
- Kiểm tra console log nếu có lớp/môn chưa được phân công

### Xử lý các trường hợp đặc biệt

#### Trường hợp 1: Không có giáo viên phù hợp
**Nguyên nhân:**
- Không có giáo viên nào có thể dạy môn đó cho khối đó
- Tất cả giáo viên đã đạt số lớp tối đa

**Giải pháp:**
1. Kiểm tra lại cấu hình môn học của giáo viên
2. Thêm giáo viên mới hoặc cập nhật `subjects` của giáo viên hiện có
3. Tăng số lớp tối đa (nếu cần)
4. Phân công thủ công cho các lớp/môn này

**Log cảnh báo:**
```
⚠️ Không tìm thấy giáo viên cho môn [Tên môn] lớp [Tên lớp]
```

#### Trường hợp 2: Môn đã được phân công
**Hành vi:**
- Hệ thống tự động bỏ qua các môn đã có phân công trong học kỳ hiện tại
- Không tạo phân công trùng lặp

**Ví dụ:**
- Lớp 10A1 - Môn Toán đã có giáo viên A dạy học kỳ 1
- Phân công tự động học kỳ 1 → Bỏ qua môn Toán lớp 10A1

#### Trường hợp 3: Học kỳ 2 - Ưu tiên giáo viên cũ
**Hành vi:**
- Nếu là học kỳ 2, hệ thống tự động ưu tiên giáo viên đã dạy ở học kỳ 1
- Chỉ áp dụng nếu giáo viên vẫn còn trong hệ thống

**Ví dụ:**
- Học kỳ 1: Giáo viên A dạy Toán lớp 10A1
- Học kỳ 2: Tự động phân công giáo viên A dạy Toán lớp 10A1 (nếu giáo viên A vẫn còn)

### Kiểm tra sau khi phân công

#### 1. Kiểm tra danh sách phân công
- Xem danh sách phân công đã được tạo
- Lọc theo năm học, học kỳ, khối để kiểm tra

#### 2. Kiểm tra tải giảng viên
- Xem số lớp mỗi giáo viên đã được phân công
- Đảm bảo phân công cân bằng giữa các giáo viên

#### 3. Kiểm tra lớp chưa có đủ môn
- Xem các lớp còn thiếu môn học nào
- Phân công thủ công cho các môn còn thiếu

#### 4. Kiểm tra log cảnh báo
- Mở Developer Console (F12)
- Xem các cảnh báo về lớp/môn chưa được phân công

### Lưu ý quan trọng

1. **Phân công không xét lịch rảnh**
   - Phân công giảng dạy chỉ quyết định "ai dạy môn gì cho lớp nào"
   - Không xét đến lịch rảnh của giáo viên
   - Lịch rảnh sẽ được xét khi tạo thời khóa biểu (bước sau)

2. **Reset mỗi học kỳ**
   - Tải giảng viên được reset mỗi học kỳ
   - Phân công học kỳ 1 không ảnh hưởng đến tải giảng viên học kỳ 2

3. **Reset mỗi năm học**
   - Phân công được reset hoàn toàn mỗi năm học mới
   - Không kế thừa phân công từ năm trước

4. **Có thể chạy nhiều lần**
   - Có thể chạy phân công tự động nhiều lần
   - Hệ thống sẽ bỏ qua các môn đã có phân công
   - Chỉ tạo phân công mới cho các môn chưa có

5. **Có thể chỉnh sửa sau**
   - Sau khi phân công tự động, có thể chỉnh sửa thủ công
   - Xóa phân công không phù hợp
   - Thêm phân công mới

### Quy trình hoàn chỉnh

```
1. Chuẩn bị dữ liệu
   ├─ Tạo lớp học
   ├─ Tạo môn học
   ├─ Tạo giáo viên + cấu hình môn dạy
   └─ Tạo năm học

2. Phân công tự động
   ├─ Chọn năm học
   ├─ Chọn học kỳ
   ├─ Chọn khối
   └─ Xác nhận

3. Kiểm tra kết quả
   ├─ Xem danh sách phân công
   ├─ Kiểm tra tải giảng viên
   └─ Xử lý các trường hợp đặc biệt

4. Chỉnh sửa (nếu cần)
   ├─ Xóa phân công không phù hợp
   ├─ Thêm phân công thủ công
   └─ Cập nhật phân công

5. Bước tiếp theo
   └─ Tạo thời khóa biểu (có xét lịch rảnh)
```

## 🔍 Ví dụ minh họa

### Ví dụ 1: Phân công học kỳ 1
```
Input:
- Lớp: 10A1, 10A2, 10A3 (khối 10)
- Môn: Toán, Văn, Anh
- Giáo viên:
  + GV A: Toán (10, 11), Văn (10)
  + GV B: Toán (10, 11)
  + GV C: Văn (10, 11), Anh (10)

Quy trình:
1. Lớp 10A1 - Môn Toán:
   - Candidate: GV A (load=0), GV B (load=0)
   - Chọn: GV A (ít load hơn)
   - Load GV A: 0 → 1

2. Lớp 10A1 - Môn Văn:
   - Candidate: GV A (load=1), GV C (load=0)
   - Chọn: GV C (ít load hơn)
   - Load GV C: 0 → 1

3. Lớp 10A2 - Môn Toán:
   - Candidate: GV A (load=1), GV B (load=0)
   - Chọn: GV B (ít load hơn)
   - Load GV B: 0 → 1

Kết quả: Phân công cân bằng giữa các giáo viên
```

### Ví dụ 2: Phân công học kỳ 2 (ưu tiên giáo viên cũ)
```
Input:
- Học kỳ 1 đã có: GV A dạy Toán lớp 10A1
- Học kỳ 2: Phân công lại

Quy trình:
1. Lớp 10A1 - Môn Toán:
   - Tìm phân công học kỳ 1: Tìm thấy GV A
   - Chọn: GV A (ưu tiên giáo viên cũ)
   - Load GV A: 0 → 1

Kết quả: Giữ nguyên giáo viên đã dạy ở học kỳ 1
```

### Ví dụ 3: Tính toán max lớp động
```
Input:
- Khối 10: 10 lớp
- Môn Toán: 3 giáo viên (GV A, GV B, GV C)

Tính toán:
- Max lớp/giáo viên = ceil(10/3) = 4

Phân công:
- GV A: 4 lớp
- GV B: 3 lớp
- GV C: 3 lớp

Kết quả: Phân công công bằng, không có giáo viên nào quá tải
```

## ✅ Đánh giá tính hợp lý

### Điểm mạnh

1. **Logic phân công rõ ràng và có hệ thống**
   - Quy trình từng bước được mô tả chi tiết
   - Có xử lý các trường hợp đặc biệt (học kỳ 2, không có giáo viên)
   - Có cơ chế tránh trùng lặp

2. **Cân bằng tải giảng viên**
   - Tính toán động số lớp tối đa dựa trên số lớp và số giáo viên
   - Ưu tiên giáo viên có ít lớp nhất
   - Đảm bảo phân công công bằng

3. **Ưu tiên giáo viên cũ (học kỳ 2)**
   - Giữ tính liên tục trong giảng dạy
   - Giảm thiểu thay đổi không cần thiết

4. **Tách biệt với lịch rảnh**
   - Phân công giảng dạy và tạo thời khóa biểu là 2 bước riêng biệt
   - Logic hợp lý: Phân công trước → Xếp lịch sau

5. **Tài liệu đầy đủ**
   - Có hướng dẫn chi tiết từ điều kiện tiên quyết đến quy trình thực hiện
   - Có ví dụ minh họa cụ thể
   - Có xử lý các trường hợp đặc biệt

### Điểm cần lưu ý

1. **Không xét lịch rảnh khi phân công**
   - ✅ **Hợp lý**: Phân công chỉ quyết định "ai dạy môn gì"
   - ⚠️ **Lưu ý**: Có thể xảy ra trường hợp phân công giáo viên nhưng khi xếp lịch không có tiết rảnh
   - 💡 **Giải pháp**: Sau khi phân công, cần kiểm tra khi tạo thời khóa biểu

2. **Reset tải giảng viên mỗi học kỳ**
   - ✅ **Hợp lý**: Mỗi học kỳ là một chu kỳ mới
   - ⚠️ **Lưu ý**: Có thể không phản ánh tổng tải thực tế của giáo viên trong cả năm
   - 💡 **Cân nhắc**: Có thể thêm tính năng xem tổng tải cả năm (nếu cần)

3. **Tính toán max lớp động**
   - ✅ **Hợp lý**: Phân công công bằng dựa trên số lớp và số giáo viên
   - ⚠️ **Lưu ý**: Công thức `ceil(số lớp / số giáo viên)` có thể tạo ra giá trị lớn nếu ít giáo viên
   - 💡 **Cải thiện**: Có thể thêm giới hạn tối đa tuyệt đối (VD: tối đa 6 lớp/giáo viên)

4. **Xử lý trường hợp không có giáo viên**
   - ✅ **Hợp lý**: Log cảnh báo và bỏ qua, không làm gián đoạn quá trình
   - ⚠️ **Lưu ý**: Cần admin kiểm tra và xử lý thủ công
   - 💡 **Cải thiện**: Có thể thêm báo cáo tổng hợp các lớp/môn chưa được phân công

### So sánh với logic gán phòng

| Tiêu chí | Phân công giảng dạy | Gán phòng |
|----------|---------------------|-----------|
| **Xét lịch rảnh** | ❌ Không | ✅ Có (xét schedule) |
| **Tính toán động** | ✅ Có (max lớp/giáo viên) | ❌ Không |
| **Ưu tiên cũ** | ✅ Có (học kỳ 2) | ❌ Không |
| **Reset theo kỳ** | ✅ Có | ❌ Không |
| **Xử lý lỗi** | ✅ Log cảnh báo | ✅ Log chi tiết |

**Nhận xét**: Hai logic bổ trợ cho nhau:
- Phân công giảng dạy: Quyết định "ai dạy môn gì"
- Gán phòng: Quyết định "lớp học ở đâu" (có xét schedule)

### Kết luận

**✅ Logic phân công giảng dạy tự động là hợp lý và được thiết kế tốt:**

1. **Phù hợp với thực tế**: 
   - Tách biệt phân công và xếp lịch là đúng
   - Cân bằng tải giảng viên là cần thiết
   - Ưu tiên giáo viên cũ ở học kỳ 2 là hợp lý

2. **Xử lý tốt các trường hợp đặc biệt**:
   - Không có giáo viên phù hợp
   - Môn đã được phân công
   - Học kỳ 2 ưu tiên giáo viên cũ

3. **Tài liệu đầy đủ**:
   - Có hướng dẫn chi tiết
   - Có ví dụ minh họa
   - Có xử lý các trường hợp đặc biệt

4. **Có thể cải thiện** (tùy chọn):
   - Thêm giới hạn tối đa tuyệt đối cho số lớp/giáo viên
   - Thêm báo cáo tổng hợp các lớp/môn chưa được phân công
   - Thêm tính năng xem tổng tải giảng viên cả năm

**Tổng thể: Logic hiện tại là hợp lý và có thể sử dụng trong thực tế! ✅**

