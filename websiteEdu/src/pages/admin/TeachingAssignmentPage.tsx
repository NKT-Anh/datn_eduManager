import { useEffect, useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { assignmentApi } from "@/services/assignmentApi";
import { teacherApi } from "@/services/teacherApi";
import { subjectApi } from "@/services/subjectApi";
import { classApi } from "@/services/classApi";

import { Teacher } from "@/types/auth";
import { Subject, ClassType } from "@/types/class";
import { TeachingAssignment, TeachingAssignmentPayload } from "@/types/class";

import { autoAssignTeaching ,payloadsToAssignments} from "@/services/smartSystem/autoAssignTeaching";

// Schema cho form thêm mới
const assignmentSchema = z.object({
  teacherId: z.string().min(1, "Vui lòng chọn giáo viên"),
  subjectId: z.string().min(1, "Vui lòng chọn môn học"),
  classId: z.string().min(1, "Vui lòng chọn lớp"),
  year: z.string().min(1, "Vui lòng chọn năm học"),

  semester: z.enum(["1", "2"], { required_error: "Chọn học kỳ" }),
});

type AssignmentFormData = z.infer<typeof assignmentSchema>;

export default function TeachingAssignmentPage() {
  const [assignments, setAssignments] = useState<TeachingAssignment[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<ClassType[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [open, setOpen] = useState(false);
  const [filterYear, setFilterYear] = useState<string>("all");
  const [filterSemester, setFilterSemester] = useState<string>("all");

  

  const getCurrentSchoolYear = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    return month >= 8 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
  };

  // State cho dialog auto assign
const [autoAssignOpen, setAutoAssignOpen] = useState(false);
const [autoYear, setAutoYear] = useState(getCurrentSchoolYear());
const [autoSemester, setAutoSemester] = useState<"1" | "2">("1");
const [selectedGrades, setSelectedGrades] = useState<string[]>(["10"]);


  const form = useForm<AssignmentFormData>({
    resolver: zodResolver(assignmentSchema),
    defaultValues: { year: getCurrentSchoolYear(), semester: "1" },
  });

  // Load dữ liệu
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [teacherRes, subjectRes, classRes, assignmentRes] = await Promise.all([
          teacherApi.getAll(),
          subjectApi.getSubjects(),
          classApi.getAll(),
          assignmentApi.getAll(),
        ]);

        setTeachers(teacherRes);
        setSubjects(subjectRes);
        setClasses(classRes);

        // Sắp xếp lớp lên đầu
        const sortedAssignments = assignmentRes.sort((a, b) =>
          a.classId?.className.localeCompare(b.classId?.className)
        );
        setAssignments(sortedAssignments);
      } catch (err) {
        console.error("Lỗi load data:", err);
      }
    };
    fetchData();
  }, []);

  // Thêm mới
  const handleSubmit = async (data: AssignmentFormData) => {
    try {
       const exists = assignments.some(
      a => a.classId._id === data.classId && a.subjectId._id === data.subjectId
    );
    if (exists) {
      alert("Lớp này đã được phân công cho môn học này rồi!");
      return;
    }
      const payload: TeachingAssignmentPayload = {
        teacherId: data.teacherId,
        subjectId: data.subjectId,
        classId: data.classId,
        semester: data.semester,
        year: data.year,
      };
      const newAssignment = await assignmentApi.create(payload);
      setAssignments(prev => [newAssignment, ...prev]);
      setOpen(false);
      form.reset({ year: getCurrentSchoolYear() });
    } catch (err) {
      console.error("Lỗi khi phân công:", err);
    }
  };
  // Lấy danh sách môn chưa được phân công cho lớp
  const getAvailableSubjects = (classId: string) => {
  // 1. Lọc danh sách môn đã được phân công cho lớp này
  const assignedSubjectIds = assignments
    .filter(a => a.classId._id === classId)
    .map(a => a.subjectId._id);

  // 2. Lọc danh sách môn theo lớp (grade) và chưa được phân công
  const classObj = classes.find(c => c._id === classId);
  if (!classObj) return [];

  return subjects.filter(
    // s => s.grades.includes(classObj.grade) && !assignedSubjectIds.includes(s._id!)
    sub => !assignedSubjectIds.includes(sub._id)
  );
};


  // Delete
  const handleDelete = async (id: string) => {
    try {
      await assignmentApi.delete(id);
      setAssignments(prev => prev.filter(a => a._id !== id));
    } catch (err) {
      console.error("Lỗi xóa phân công:", err);
    }
  };
  const availableYears  = useMemo(() => {
    const years  = assignments.map(a => a.year);
    return Array.from(new Set(years )).sort((a, b) => b.localeCompare(a));

  }, [assignments]);
const filteredAssignments = useMemo(() => {
  return assignments.filter(a => {
    const matchSearch =
      !searchTerm ||
      a.teacherId?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.classId?.className.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.subjectId?.name.toLowerCase().includes(searchTerm.toLowerCase());

    const matchYear = filterYear === "all" || a.year === filterYear;
    const matchSemester = filterSemester === "all" || a.semester === filterSemester;

    return matchSearch && matchYear && matchSemester;
  });
}, [assignments, searchTerm, filterYear, filterSemester]);

  // Inline update
//   const handleUpdate = async (id: string, field: "teacherId" | "subjectId" | "classId", value: string) => {
//     try {
//       const updated = await assignmentApi.update(id, { [field]: value });
//       setAssignments(prev => prev.map(a => (a._id === id ? updated : a)));
//     } catch (err) {
//       console.error("Lỗi cập nhật phân công:", err);
//     }
//   };
// Inline update
const handleUpdate = async (
  id: string,
  field: "teacherId" | "subjectId",
  value: string
) => {
  const current = assignments.find(a => a._id === id);
  if (!current) return;

  // Update state tạm thời
  setAssignments(prev =>
    prev.map(a => {
      if (a._id !== id) return a;

      if (field === "subjectId") {
        const newSubject = subjects.find(s => s._id === value);
        return {
          ...a,
          subjectId: newSubject
            ? { _id: newSubject._id!, name: newSubject.name }
            : a.subjectId,
          teacherId: { _id: "", name: "" }, // reset giáo viên
        } as TeachingAssignment;
      }

      if (field === "teacherId") {
        const newTeacher = teachers.find(t => t._id === value);
        return {
          ...a,
          teacherId: newTeacher
            ? { _id: newTeacher._id, name: newTeacher.name }
            : a.teacherId,
        } as TeachingAssignment;
      }

      return a;
    })
  );

  // Nếu là update teacher hoặc teacher đã được chọn → gọi API
  if (field === "teacherId" || (field === "subjectId" && current.teacherId._id)) {
    try {
      const payload: TeachingAssignmentPayload = {
        teacherId: field === "teacherId" ? value : current.teacherId._id,
        subjectId: field === "subjectId" ? value : current.subjectId._id,
        classId: current.classId._id,
        year: current.year,
        semester: current.semester,
      };
      await assignmentApi.update(id, payload);
    } catch (err) {
      console.error("Lỗi cập nhật phân công:", err);
      // rollback nếu lỗi
      setAssignments(prev =>
        prev.map(a => (a._id === id ? current : a))
      );
    }
  }
};


// Helper lọc giáo viên theo môn
// Helper lọc giáo viên theo môn + đúng khối lớp
const getAvailableTeachers = (subjectId?: string, classGrade?: string) => {
  if (!subjectId || !classGrade) return [];
  return teachers.filter(t =>
    t.subjects?.some(
      s => s.subjectId._id === subjectId && s.grades.includes(classGrade as any)
    )
  );
};
// 
const handleAutoAssign = async () => {
  try {
    const currentYear = getCurrentSchoolYear();
    const selectedGrades = ["10", "11", "12"]; // hoặc lấy từ form

    if (!selectedGrades.length) {
      alert("Vui lòng chọn ít nhất một khối.");
      return;
    }

    const autoPayloads = autoAssignTeaching(
      classes,
      subjects,
      teachers,
      assignments,
      currentYear,
      "1", // hoặc lấy từ form
      selectedGrades
    );

    if (autoPayloads.length === 0) {
      alert("Không có phân công mới nào được tạo.");
      return;
    }

    // Gọi API backend
    await assignmentApi.createBulk(autoPayloads);

    // Gọi lại getAll để lấy bản đầy đủ (có populate teacher/subject/class)
    const updatedAssignments = await assignmentApi.getAll();
    const sortedAssignments = updatedAssignments.sort((a, b) =>
      a.classId?.className.localeCompare(b.classId?.className)
    );
    setAssignments(sortedAssignments);

    alert(`✅ Đã phân công tự động ${autoPayloads.length} môn/lớp!`);
  } catch (error) {
    console.error("❌ Lỗi phân công tự động:", error);
    alert("Có lỗi xảy ra khi phân công tự động.");
  }
};

const handleConfirmAutoAssign = async () => {
  try {
    if (selectedGrades.length === 0) {
      alert("Vui lòng chọn ít nhất một khối.");
      return;
    }

    const autoPayloads = autoAssignTeaching(
      classes,
      subjects,
      teachers,
      assignments,
      autoYear,
      autoSemester,
      selectedGrades
    );

    if (autoPayloads.length === 0) {
      alert("Không có phân công mới nào được tạo.");
      return;
    }

    await assignmentApi.createBulk(autoPayloads);
    const updatedAssignments = await assignmentApi.getAll();

    const sortedAssignments = updatedAssignments.sort((a, b) =>
      a.classId?.className.localeCompare(b.classId?.className)
    );
    setAssignments(sortedAssignments);

    alert(
      `✅ Đã phân công tự động ${autoPayloads.length} môn/lớp cho năm ${autoYear}, học kỳ ${autoSemester}, khối ${selectedGrades.join(", ")}!`
    );
    setAutoAssignOpen(false);
  } catch (error) {
    console.error("❌ Lỗi phân công tự động:", error);
    alert("Có lỗi xảy ra khi phân công tự động.");
  }
};





  // Filter
  // const filteredAssignments = useMemo(() => {
  //   if (!searchTerm) return assignments;
  //   return assignments.filter(a =>
  //     a.teacherId?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
  //     a.classId?.className.toLowerCase().includes(searchTerm.toLowerCase()) ||
  //     a.subjectId?.name.toLowerCase().includes(searchTerm.toLowerCase())
  //   );
  // }, [assignments, searchTerm]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Phân công giảng dạy</h2>
         <div className="flex gap-2">
        <Button onClick={() => setOpen(true)}>+ Thêm phân công</Button>
        <Button variant="secondary" onClick={() => setAutoAssignOpen(true)}>🤖 Phân công tự động</Button>
        </div>
      </div>

            

      {/* Search chung */}
      <Input
        placeholder="Tìm giáo viên / lớp / môn học..."
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        className="mb-4"
      />
      <div className="flex gap-4 items-center mb-4">
  {/* Lọc theo năm học */}
  <Select value={filterYear} onValueChange={setFilterYear}>
    <SelectTrigger className="w-[150px]">
      <SelectValue placeholder="Chọn năm học" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="all">Tất cả năm</SelectItem>
      {availableYears.map(y => (
        <SelectItem key={y} value={y}>{y}</SelectItem>
      ))}
    </SelectContent>
  </Select>

  {/* Lọc theo học kỳ */}
  <Select value={filterSemester} onValueChange={setFilterSemester}>
    <SelectTrigger className="w-[150px]">
      <SelectValue placeholder="Chọn học kỳ" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="all">Tất cả học kỳ</SelectItem>
      <SelectItem value="1">Học kỳ 1</SelectItem>
      <SelectItem value="2">Học kỳ 2</SelectItem>
    </SelectContent>
  </Select>
</div>


      {/* Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Lớp</TableHead>

            <TableHead>Môn học</TableHead>
            <TableHead>Giáo viên</TableHead>
            
            <TableHead>Năm học</TableHead>
            <TableHead>Học kỳ</TableHead>
            <TableHead>Hành động</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredAssignments.length > 0 ? (
            filteredAssignments.map(a => (
              <TableRow key={a._id}>
                {/* Lớp */}
                {/* <TableCell>
                  <Select
                    value={a.classId?._id || ""}
                    onValueChange={v => handleUpdate(a._id, "classId", v)}
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue placeholder="Chọn lớp" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map(c => (
                        <SelectItem key={c._id} value={c._id}>{c.className}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell> */}
                <TableCell>                
                  {a.classId.className}
                </TableCell>


                {/* Môn học
                <TableCell>
                  <Select
                    value={a.subjectId?._id || ""}
                    onValueChange={v => handleUpdate(a._id, "subjectId", v)}
                  >
                    <SelectTrigger className="w-36">
                      <SelectValue placeholder="Chọn môn học" />
                    </SelectTrigger>
                    <SelectContent>
                      {subjects.map(s => (
                        <SelectItem key={s._id} value={s._id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell> */}

                  <TableCell>
                    <Select
                      value={a.subjectId?._id || ""}
                      onValueChange={v => handleUpdate(a._id, "subjectId", v)}
                    >
                      <SelectTrigger className="w-36">
                        <SelectValue placeholder="Chọn môn học" />
                      </SelectTrigger>
                      <SelectContent>
                        {/* Luôn render môn hiện tại nếu có */}
                        {a.subjectId && (
                          <SelectItem key={a.subjectId._id} value={a.subjectId._id}>
                            {a.subjectId.name}
                          </SelectItem>
                        )}

                        {/* Render các môn khả dụng khác (lọc trừ môn hiện tại để tránh trùng) */}
                        {getAvailableSubjects(a.classId._id)
                          .filter(s => s._id !== a.subjectId?._id)
                          .map(s => (
                            <SelectItem key={s._id} value={s._id}>
                              {s.name}
                            </SelectItem>
                          ))}

                        {/* Nếu không còn môn nào */}
                        {(!a.subjectId && getAvailableSubjects(a.classId._id).length === 0) && (
                          <div className="p-2 text-sm text-muted-foreground">
                            Không còn môn nào khả dụng
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                  </TableCell>


                      
                {/* Giáo viên */}
<TableCell>
  <Select
    value={a.teacherId?._id || ""}
    onValueChange={v => handleUpdate(a._id, "teacherId", v)}
  >
    <SelectTrigger className="w-36">
      <SelectValue placeholder="Chọn giáo viên" />
    </SelectTrigger>
    <SelectContent>
      {getAvailableTeachers(a.subjectId?._id, a.classId?.grade).length > 0 ? (
        getAvailableTeachers(a.subjectId?._id, a.classId?.grade).map(t => (
          <SelectItem key={t._id} value={t._id}>
            {t.name}
          </SelectItem>
        ))
      ) : (
        <div className="p-2 text-sm text-muted-foreground">
          Hãy chọn môn học trước
        </div>
      )}
    </SelectContent>
  </Select>
</TableCell>

                <TableCell>{a.year}</TableCell>
                <TableCell>{a.semester}</TableCell>
                <TableCell>
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(a._id)}>Xóa</Button>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                Chưa có phân công nào
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* Dialog Thêm phân công */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Thêm phân công giảng dạy</DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} noValidate  className="space-y-4">
              {/* Chọn lớp */}
              <FormField
                control={form.control}
                name="classId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lớp</FormLabel>
                    <FormControl>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger>
                          <SelectValue placeholder="Chọn lớp" />
                        </SelectTrigger>
                        <SelectContent>
                          {classes.map(c => (
                            <SelectItem key={c._id} value={c._id}>{c.className}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Chọn môn học */}
              <FormField
                control={form.control}
                name="subjectId"
                render={({ field }) => {
                  const selectedClassId = form.watch("classId");
                  const selectedClass = classes.find(c => c._id === selectedClassId);
                  const availableSubjects = selectedClass
                    ? subjects.filter(s => s.grades.includes(selectedClass.grade as "10" | "11" | "12"))
                    : [];
                  return (
                    <FormItem>
                    <FormLabel>Môn học</FormLabel>
                    <FormControl>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger>
                          <SelectValue placeholder="Chọn môn học" />
                        </SelectTrigger>
                        <SelectContent>
                          {selectedClass ? (
                            getAvailableSubjects(selectedClass._id).length > 0 ? (
                              getAvailableSubjects(selectedClass._id).map((s) => (
                                <SelectItem key={s._id} value={s._id}>
                                  {s.name}
                                </SelectItem>
                              ))
                            ) : (
                              <div className="p-2 text-sm text-muted-foreground">
                                Tất cả môn đã được phân công cho lớp này
                              </div>
                            )
                          ) : (
                            <div className="p-2 text-sm text-muted-foreground">
                              Hãy chọn lớp trước
                            </div>
                          )}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>

                  );
                }}
              />

              {/* Chọn giáo viên */}
             <FormField
  control={form.control}
  name="teacherId"
  render={({ field }) => {
    const selectedSubjectId = form.watch("subjectId");
    const selectedClassId = form.watch("classId");
    const selectedClass = classes.find(c => c._id === selectedClassId);

    const availableTeachers = selectedSubjectId && selectedClass
      ? teachers.filter(t =>
          t.subjects?.some(
            s =>
              s.subjectId._id === selectedSubjectId &&
              s.grades.includes(selectedClass.grade as any)
          )
        )
      : [];

    return (
      <FormItem>
        <FormLabel>Giáo viên</FormLabel>
        <FormControl>
          <Select onValueChange={field.onChange} value={field.value}>
            <SelectTrigger><SelectValue placeholder="Chọn giáo viên" /></SelectTrigger>
            <SelectContent>
              {selectedSubjectId && selectedClass ? (
                availableTeachers.length > 0 ? (
                  availableTeachers.map(t => (
                    <SelectItem key={t._id} value={t._id}>{t.name}</SelectItem>
                  ))
                ) : (
                  <div className="p-2 text-sm text-muted-foreground">
                    Không có giáo viên dạy môn này cho khối {selectedClass.grade}
                  </div>
                )
              ) : (
                <div className="p-2 text-sm text-muted-foreground">
                  Hãy chọn lớp và môn học trước
                </div>
              )}
            </SelectContent>
          </Select>
        </FormControl>
        <FormMessage />
      </FormItem>
    );
  }}
/>


              {/* Học kỳ */}
              <FormField
                control={form.control}
                name="semester"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Học kỳ</FormLabel>
                    <FormControl>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger>
                          <SelectValue placeholder="Chọn học kỳ" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">Học kỳ 1</SelectItem>
                          <SelectItem value="2">Học kỳ 2</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Năm học */}
              <FormField
                control={form.control}
                name="year"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Năm học</FormLabel>
                    <FormControl>
                      <Input {...field} readOnly />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Hủy</Button>
                <Button type="submit">Lưu</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      {/* Dialog chọn thông tin phân công tự động */}
<Dialog open={autoAssignOpen} onOpenChange={setAutoAssignOpen}>
  <DialogContent className="max-w-md">
    <DialogHeader>
      <DialogTitle>Thiết lập thông tin phân công tự động</DialogTitle>
    </DialogHeader>

    <div className="space-y-4 mt-2">
      {/* Năm học */}
      <div>
        <label className="block mb-1 text-sm font-medium">Năm học</label>
        <Input
          value={autoYear}
          onChange={(e) => setAutoYear(e.target.value)}
          placeholder="VD: 2024-2025"
        />
      </div>

      {/* Học kỳ */}
      <div>
        <label className="block mb-1 text-sm font-medium">Học kỳ</label>
        <Select value={autoSemester} onValueChange={(v) => setAutoSemester(v as "1" | "2")}>
          <SelectTrigger>
            <SelectValue placeholder="Chọn học kỳ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Học kỳ 1</SelectItem>
            <SelectItem value="2">Học kỳ 2</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Chọn khối */}
      <div>
        <label className="block mb-1 text-sm font-medium">Chọn khối</label>
        <div className="flex flex-col space-y-2">
          {["10", "11", "12"].map((grade) => (
            <label key={grade} className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={selectedGrades.includes(grade)}
                onChange={(e) => {
                  if (e.target.checked)
                    setSelectedGrades([...selectedGrades, grade]);
                  else
                    setSelectedGrades(selectedGrades.filter((g) => g !== grade));
                }}
              />
              <span>Khối {grade}</span>
            </label>
          ))}
        </div>
      </div>
    </div>

    <DialogFooter className="mt-4">
      <Button variant="outline" onClick={() => setAutoAssignOpen(false)}>Hủy</Button>
      <Button onClick={handleConfirmAutoAssign}>Xác nhận</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>

    </div>
  );
}
