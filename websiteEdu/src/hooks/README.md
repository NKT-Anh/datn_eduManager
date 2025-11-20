# React Query Hooks

Tài liệu về các custom hooks sử dụng React Query để tối ưu API calls.

## 📁 Cấu trúc

```
hooks/
├── assignments/     # Phân công giảng dạy
├── auth/           # Authentication & Students
├── classes/        # Lớp học
├── grades/         # Khối lớp & Điểm
├── schoolYear/     # Năm học
├── subjects/       # Môn học
├── teachers/       # Giáo viên
└── index.ts        # Export tất cả hooks
```

## 🎯 Lợi ích

1. **Caching tự động**: Data được cache, giảm số lần gọi API
2. **Auto refetch**: Tự động refetch khi cần thiết
3. **Optimistic updates**: Cập nhật UI ngay lập tức
4. **Error handling**: Xử lý lỗi tập trung
5. **Loading states**: Quản lý trạng thái loading dễ dàng

## 📚 Cách sử dụng

### Import hooks

```typescript
import { useSubjects, useAssignments, useClasses } from "@/hooks";
```

### Ví dụ: Lấy danh sách môn học

```typescript
function SubjectsPage() {
  const { subjects, isLoading, error } = useSubjects();

  if (isLoading) return <div>Đang tải...</div>;
  if (error) return <div>Lỗi: {error.message}</div>;

  return (
    <div>
      {subjects.map(subject => (
        <div key={subject._id}>{subject.name}</div>
      ))}
    </div>
  );
}
```

### Ví dụ: Tạo môn học mới

```typescript
function CreateSubjectForm() {
  const { create, isLoading } = useSubjects();

  const handleSubmit = async (data) => {
    try {
      await create(data);
      // Tự động invalidate cache và refetch
    } catch (error) {
      console.error(error);
    }
  };

  return <form onSubmit={handleSubmit}>...</form>;
}
```

### Ví dụ: Lọc dữ liệu

```typescript
// Lấy lớp theo năm học và khối
const { classes } = useClasses({ year: "2024-2025", grade: "10" });

// Lấy phân công theo năm học và học kỳ
const { assignments } = useAssignments({ year: "2024-2025", semester: "1" });
```

## 📋 Danh sách hooks

### Grades
- `useGrades()` - Quản lý khối lớp
- `useStudentGrades()` - Điểm của học sinh

### Subjects
- `useSubjects()` - Quản lý môn học
- `useSubject(id)` - Chi tiết môn học
- `useSubjectDetail(id)` - Chi tiết đầy đủ môn học (bao gồm teachers, classes, assignments)

### Assignments
- `useAssignments(params?)` - Quản lý phân công giảng dạy
- `useAssignmentsByTeacher(teacherId, params?)` - Phân công theo giáo viên
- `useAssignment(id)` - Chi tiết phân công

### Classes
- `useClasses(params?)` - Quản lý lớp học
- `useClass(id)` - Chi tiết lớp
- `useAutoAssignRooms()` - Tự động gán phòng

### Teachers
- `useTeachers(params?)` - Quản lý giáo viên
- `useTeacher(id)` - Chi tiết giáo viên
- `useUpdateTeacherAvailability()` - Cập nhật lịch rảnh
- `useTeacherAvailability(id)` - Lấy lịch rảnh

### School Years
- `useSchoolYears()` - Quản lý năm học
- `useCurrentSchoolYear()` - Năm học hiện tại

### Students
- `useStudents(params?)` - Quản lý học sinh
- `useStudent(id)` - Chi tiết học sinh

### Profile
- `useProfile()` - Thông tin profile
- `useUpdateProfile()` - Cập nhật profile

## 🔄 Cache Management

Hooks tự động quản lý cache thông qua React Query:

- **staleTime**: Thời gian data được coi là "fresh" (mặc định: 2-5 phút)
- **invalidateQueries**: Tự động invalidate khi có mutation
- **refetch**: Có thể gọi thủ công khi cần

## 💡 Best Practices

1. **Sử dụng hooks thay vì gọi API trực tiếp**
2. **Tận dụng params để filter data** thay vì filter ở component
3. **Sử dụng `enabled` option** để control khi nào query chạy
4. **Xử lý loading và error states** trong component
5. **Sử dụng `mutateAsync`** cho mutations để có thể await

## 🚀 Migration Guide

### Trước (gọi API trực tiếp):
```typescript
const [subjects, setSubjects] = useState([]);
const [loading, setLoading] = useState(false);

useEffect(() => {
  setLoading(true);
  subjectApi.getSubjects()
    .then(setSubjects)
    .finally(() => setLoading(false));
}, []);
```

### Sau (dùng hooks):
```typescript
const { subjects, isLoading } = useSubjects();
```

**Lợi ích:**
- ✅ Ít code hơn
- ✅ Tự động cache
- ✅ Tự động refetch
- ✅ Error handling tốt hơn

