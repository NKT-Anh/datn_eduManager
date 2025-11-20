import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import gradesApi from "@/services/gradesApi";
import schoolConfigApi from "@/services/schoolConfigApi";
// ✅ Sử dụng hooks thay vì API trực tiếp
import { useSchoolYears } from "@/hooks";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { assignmentApi } from "@/services/assignmentApi";

const TeacherEnterGradesPage: React.FC = () => {
  const { backendUser, loading: authLoading } = useAuth();
  const [schoolYears, setSchoolYears] = useState<{ code: string; name: string }[]>([]);
  const [semesters, setSemesters] = useState<{ code: string; name: string }[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [selectedSemester, setSelectedSemester] = useState<string>("");

  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [selectedSubject, setSelectedSubject] = useState<string>("");

  const [students, setStudents] = useState<any[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  

  // ✅ Lấy danh sách năm học từ hooks
  const { schoolYears: allSchoolYears } = useSchoolYears();
  useEffect(() => {
    setSchoolYears(allSchoolYears.map(y => ({ code: y.code, name: y.name })));
  }, [allSchoolYears]);

  // 🔹 Lấy danh sách học kỳ
  useEffect(() => {
    const fetchSemesters = async () => {
      try {
        const semestersRes = await schoolConfigApi.getSemesters();
        setSemesters(semestersRes.data);
      } catch (err) {
        console.error("Load semesters failed", err);
      }
    };
    fetchSemesters();
  }, []);

  // 🔹 Lấy danh sách lớp & môn theo teacher + năm học + học kỳ
  useEffect(() => {
    const fetchAssignments = async () => {
      if (!backendUser || backendUser.role !== "teacher" || !selectedYear || !selectedSemester) {
        setClasses([]);
        setSubjects([]);
        return;
      }
      try {
        const assignments = await assignmentApi.getByTeacher(
  backendUser.teacherId,
  selectedYear,
  selectedSemester
);


        if (!assignments || assignments.length === 0) {
          toast.error("Không tìm thấy lớp hoặc môn học nào được phân công!");
          setClasses([]);
          setSubjects([]);
          return;
        }

        const uniqueClasses = Array.from(
          new Map(
            assignments.filter(a => a.classId?._id)
                       .map(a => [a.classId._id, a.classId])
          ).values()
        );

        const uniqueSubjects = Array.from(
          new Map(
            assignments.filter(a => a.subjectId?._id)
                       .map(a => [a.subjectId._id, a.subjectId])
          ).values()
        );

        setClasses(uniqueClasses);
        setSubjects(uniqueSubjects);

        // Reset selected nếu không còn tồn tại trong danh sách
        if (!uniqueClasses.find(c => c._id === selectedClass)) setSelectedClass("");
        if (!uniqueSubjects.find(s => s._id === selectedSubject)) setSelectedSubject("");

      } catch (err) {
        console.error("Failed to load assignments", err);
        toast.error("Không thể tải danh sách lớp và môn học");
        setClasses([]);
        setSubjects([]);
      }
    };
    console.log("Fetching assignments for teacher",backendUser?.teacherId, backendUser?.uid, selectedYear, selectedSemester);
    fetchAssignments();
  }, [backendUser, selectedYear, selectedSemester]);

  // 🔹 Lấy danh sách học sinh trong lớp
  useEffect(() => {
    const fetchStudents = async () => {
      if (!selectedClass || !selectedSubject || !selectedYear || !selectedSemester) return;
      try {
        const res = await gradesApi.getClassSubjectSummary({
          classId: selectedClass,
          subjectId: selectedSubject,
          schoolYear: selectedYear,
          semester: selectedSemester,
        });
        setStudents(res.data || []);
      } catch (err) {
        console.error("Failed to load students", err);
        setStudents([]);
      }
    };
    fetchStudents();
  }, [selectedClass, selectedSubject, selectedYear, selectedSemester]);

  // 🔹 Cập nhật điểm
  const handleScoreChange = (studentId: string, value: string) => {
    const num = parseFloat(value);
    setScores(prev => ({ ...prev, [studentId]: isNaN(num) ? 0 : num }));
  };

  // 🔹 Lưu điểm
  const handleSaveScores = async () => {
    if (!selectedClass || !selectedSubject || !selectedYear || !selectedSemester) {
      toast.error("Vui lòng chọn đủ thông tin lớp, môn, năm học, học kỳ");
      return;
    }

    setSaving(true);
    try {
      for (const [studentId, score] of Object.entries(scores)) {
        await gradesApi.upsertGradeItem({
          studentId,
          subjectId: selectedSubject,
          classId: selectedClass,
          schoolYear: selectedYear,
          semester: selectedSemester,
          component: "final",
          score,
        });
      }
      toast.success("Đã lưu điểm thành công!");
    } catch (err) {
      console.error("Save scores failed", err);
      toast.error("Lưu điểm thất bại");
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) return <p>Đang tải thông tin đăng nhập...</p>;
  if (!backendUser || backendUser.role !== "teacher") return <p>Bạn không có quyền truy cập trang này.</p>;

  return (
    <Card className="p-4">
      <CardHeader>
        <CardTitle>Nhập điểm cho học sinh</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid md:grid-cols-4 gap-4">
          <Select onValueChange={setSelectedYear} value={selectedYear}>
            <SelectTrigger><SelectValue placeholder="Chọn năm học" /></SelectTrigger>
            <SelectContent>
              {schoolYears.map(y => <SelectItem key={y.code} value={y.code}>{y.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select onValueChange={setSelectedSemester} value={selectedSemester}>
            <SelectTrigger><SelectValue placeholder="Chọn học kỳ" /></SelectTrigger>
            <SelectContent>
              {semesters.map(s => <SelectItem key={s.code} value={s.code}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select onValueChange={setSelectedClass} value={selectedClass}>
            <SelectTrigger><SelectValue placeholder="Chọn lớp học" /></SelectTrigger>
            <SelectContent>
              {classes.map(c => <SelectItem key={c._id} value={c._id}>{c.className} ({c.grade})</SelectItem>)}
            </SelectContent>
          </Select>

          <Select onValueChange={setSelectedSubject} value={selectedSubject}>
            <SelectTrigger><SelectValue placeholder="Chọn môn học" /></SelectTrigger>
            <SelectContent>
              {subjects.map(s => <SelectItem key={s._id} value={s._id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {students.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm border">
              <thead>
                <tr className="bg-gray-100 text-left">
                  <th className="p-2 border">STT</th>
                  <th className="p-2 border">Họ và tên</th>
                  <th className="p-2 border">Điểm</th>
                </tr>
              </thead>
              <tbody>
                {students.map((st, i) => (
                  <tr key={st._id} className="border">
                    <td className="p-2 border">{i + 1}</td>
                    <td className="p-2 border">{st.name}</td>
                    <td className="p-2 border">
                      <Input type="number" step="0.1" min="0" max="10"
                        value={scores[st._id] ?? st.score ?? ""}
                        onChange={e => handleScoreChange(st._id, e.target.value)}
                        className="w-24" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-4 flex justify-end">
              <Button onClick={handleSaveScores} disabled={saving}>
                {saving ? "Đang lưu..." : "💾 Lưu điểm"}
              </Button>
            </div>
          </div>
        ) : <p className="text-gray-500">Chưa có dữ liệu học sinh</p>}
      </CardContent>
    </Card>
  );
};

export default TeacherEnterGradesPage;
