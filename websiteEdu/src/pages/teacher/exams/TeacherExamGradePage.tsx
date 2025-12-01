import React, { useEffect, useState, useMemo } from "react";
import {
  Card,
  Table,
  Button,
  Tag,
  Space,
  InputNumber,
  message,
  Spin,
  Select,
  Input,
  Row,
  Col,
  Typography,
  Alert,
} from "antd";
import {
  SaveOutlined,
  ReloadOutlined,
  SearchOutlined,
  BookOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { examGradeApi } from "@/services/exams/examGradeApi";
import { examApi } from "@/services/exams/examApi";
import { examStudentApi } from "@/services/exams/examStudentApi";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { assignmentApi } from "@/services/assignmentApi";
import { useSchoolYears } from "@/hooks";
import { useCurrentAcademicYear } from "@/hooks/useCurrentAcademicYear";

const { Option } = Select;
const { Title, Text } = Typography;

export default function TeacherExamGradePage() {
  const { backendUser } = useAuth();
  const { hasPermission, PERMISSIONS } = usePermissions();
  const { currentYearCode } = useCurrentAcademicYear();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [exams, setExams] = useState<any[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>("");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [grades, setGrades] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [filters, setFilters] = useState({
    keyword: "",
  });

  // Lấy danh sách phân công giảng dạy của giáo viên
  useEffect(() => {
    const fetchAssignments = async () => {
      if (!backendUser || !currentYearCode) return;
      
      const teacherId = typeof backendUser.teacherId === 'object' && backendUser.teacherId !== null
        ? (backendUser.teacherId as any)._id
        : backendUser.teacherId;
      
      if (!teacherId) return;

      try {
        const res = await assignmentApi.getByTeacher(teacherId, {
          year: currentYearCode,
        });
        setAssignments(Array.isArray(res) ? res : []);
      } catch (err) {
        console.error("Lỗi tải phân công:", err);
      }
    };

    fetchAssignments();
  }, [backendUser, currentYearCode]);

  // Lấy danh sách kỳ thi (chỉ các kỳ thi có môn học mà giáo viên dạy)
  useEffect(() => {
    const fetchExams = async () => {
      if (!currentYearCode || assignments.length === 0) {
        setExams([]);
        return;
      }

      try {
        setLoading(true);
        const res = await examApi.getAll({
          year: currentYearCode,
          status: "published",
        });

        const allExams = res.data || [];
        
        // Lấy danh sách môn học mà giáo viên dạy
        const teacherSubjectIds = new Set<string>();
        assignments.forEach((a: any) => {
          const subjectId = typeof a.subjectId === 'object' && a.subjectId !== null
            ? a.subjectId._id
            : a.subjectId;
          if (subjectId) {
            teacherSubjectIds.add(String(subjectId));
          }
        });

        // Lọc kỳ thi: chỉ lấy các kỳ thi có ít nhất 1 môn học mà giáo viên dạy
        // (Kiểm tra qua ExamSchedule hoặc ExamGrade)
        const filteredExams = allExams.filter((exam: any) => {
          // Tạm thời hiển thị tất cả kỳ thi đã công bố
          // Sẽ lọc chính xác hơn khi có dữ liệu ExamSchedule
          return exam.status === "published";
        });

        setExams(filteredExams);
        
        if (filteredExams.length > 0 && !selectedExamId) {
          setSelectedExamId(filteredExams[0]._id);
        }
      } catch (err) {
        console.error("Lỗi tải kỳ thi:", err);
        message.error("Không thể tải danh sách kỳ thi");
      } finally {
        setLoading(false);
      }
    };

    fetchExams();
  }, [currentYearCode, assignments, selectedExamId]);

  // Lấy danh sách môn học từ kỳ thi và phân công
  const availableSubjects = useMemo(() => {
    if (!selectedExamId || assignments.length === 0) return [];

    // Lấy các môn học từ assignments của giáo viên
    const teacherSubjects = assignments
      .map((a: any) => {
        const subjectId = typeof a.subjectId === 'object' && a.subjectId !== null
          ? a.subjectId._id
          : a.subjectId;
        const subjectName = typeof a.subjectId === 'object' && a.subjectId !== null
          ? a.subjectId.name
          : "";
        return { _id: String(subjectId), name: subjectName };
      })
      .filter((s: any) => s._id && s.name);

    // Loại bỏ trùng lặp
    const uniqueSubjects = Array.from(
      new Map(teacherSubjects.map((s: any) => [s._id, s])).values()
    );

    return uniqueSubjects;
  }, [selectedExamId, assignments]);

  // Lấy danh sách lớp từ học sinh dự thi (lớp gốc của học sinh - Student.classId)
  const [availableClasses, setAvailableClasses] = useState<Array<{ _id: string; name: string }>>([]);
  
  useEffect(() => {
    const fetchClasses = async () => {
      if (!selectedExamId || !selectedSubjectId) {
        setAvailableClasses([]);
        return;
      }

      try {
        // Lấy danh sách học sinh dự thi
        const studentsRes = await examStudentApi.getByExam(selectedExamId);
        const allExamStudents = Array.isArray(studentsRes) ? studentsRes : (studentsRes?.data || []);

        // Lấy các lớp gốc từ Student.classId (không phải ExamStudent.class)
        const classMap = new Map<string, { _id: string; name: string }>();
        
        allExamStudents.forEach((es: any) => {
          // ✅ Lấy từ Student.classId (lớp gốc), không phải ExamStudent.class (nhóm lớp)
          const studentClassId = es.student?.classId?._id || es.student?.classId;
          const studentClassName = es.student?.classId?.className || es.student?.classId?.name;
          
          if (studentClassId && studentClassName) {
            const classIdStr = String(studentClassId);
            if (!classMap.has(classIdStr)) {
              classMap.set(classIdStr, {
                _id: classIdStr,
                name: studentClassName,
              });
            }
          }
        });

        // Chỉ lấy các lớp mà giáo viên dạy môn đã chọn
        const teacherClassIds = new Set(
          assignments
            .filter((a: any) => {
              const subjectId = typeof a.subjectId === 'object' && a.subjectId !== null
                ? a.subjectId._id
                : a.subjectId;
              return String(subjectId) === String(selectedSubjectId);
            })
            .map((a: any) => {
              const classId = typeof a.classId === 'object' && a.classId !== null
                ? a.classId._id
                : a.classId;
              return String(classId);
            })
        );

        // Lọc chỉ các lớp mà giáo viên dạy
        const filteredClasses = Array.from(classMap.values()).filter((c) =>
          teacherClassIds.has(c._id)
        );

        // Sắp xếp theo tên lớp
        filteredClasses.sort((a, b) => a.name.localeCompare(b.name));
        
        setAvailableClasses(filteredClasses);
      } catch (err) {
        console.error("Lỗi tải danh sách lớp:", err);
        setAvailableClasses([]);
      }
    };

    fetchClasses();
  }, [selectedExamId, selectedSubjectId, assignments]);

  // Tự động chọn môn học và lớp đầu tiên
  useEffect(() => {
    if (availableSubjects.length > 0 && !selectedSubjectId) {
      setSelectedSubjectId(availableSubjects[0]._id);
    }
  }, [availableSubjects, selectedSubjectId]);

  useEffect(() => {
    if (availableClasses.length > 0 && !selectedClassId) {
      setSelectedClassId(availableClasses[0]._id);
    }
  }, [availableClasses, selectedClassId]);

  // Lấy danh sách điểm thi (bao gồm cả học sinh chưa có điểm)
  useEffect(() => {
    const fetchGrades = async () => {
      if (!selectedExamId || !selectedSubjectId || !selectedClassId) {
        setGrades([]);
        return;
      }

      try {
        setLoading(true);
        
        // Lấy danh sách điểm đã có (chỉ filter theo subjectId, không filter classId ở backend)
        const gradesRes = await examGradeApi.getByExam(selectedExamId, {
          subjectId: selectedSubjectId,
        });
        const allExistingGrades = Array.isArray(gradesRes) ? gradesRes : (gradesRes?.data || []);
        
        // Lấy danh sách học sinh dự thi
        const studentsRes = await examStudentApi.getByExam(selectedExamId);
        const allExamStudents = Array.isArray(studentsRes) ? studentsRes : (studentsRes?.data || []);
        
        // ✅ Lọc học sinh theo lớp gốc (Student.classId), không phải nhóm lớp (ExamStudent.class)
        const examStudents = allExamStudents.filter((es: any) => {
          // Lấy từ Student.classId (lớp gốc)
          const studentClassId = es.student?.classId?._id || es.student?.classId;
          return String(studentClassId) === String(selectedClassId);
        });
        
        // Lọc điểm theo lớp gốc ở frontend
        const existingGrades = allExistingGrades.filter((g: any) => {
          // ✅ Backend trả về field "student" (ExamStudent), không phải "examStudent"
          const examStudent = g.student || g.examStudent; // Fallback cho tương thích
          const student = examStudent?.student || g.student?.student;
          // ✅ Lấy từ Student.classId (lớp gốc), không phải ExamStudent.class (nhóm lớp)
          const studentClassId = student?.classId?._id || 
                                 student?.classId;
          return String(studentClassId) === String(selectedClassId);
        });
        
        // Tạo map điểm theo examStudent
        const gradeMap = new Map();
        existingGrades.forEach((g: any) => {
          // ✅ Backend trả về field "student" (ExamStudent)
          const examStudent = g.student || g.examStudent; // Fallback cho tương thích
          const examStudentId = examStudent?._id || examStudent;
          if (examStudentId) {
            gradeMap.set(String(examStudentId), g);
          }
        });
        
        // Kết hợp: học sinh đã có điểm + học sinh chưa có điểm
        const allGrades: any[] = [];
        examStudents.forEach((es: any) => {
          const examStudentId = es._id;
          const existingGrade = gradeMap.get(String(examStudentId));
          
          if (existingGrade) {
            allGrades.push(existingGrade);
          } else {
            // Tạo record giả cho học sinh chưa có điểm
            // ✅ Đảm bảo key unique: dùng examStudentId + subjectId (không dùng timestamp để tránh duplicate khi re-render)
            const uniqueKey = `temp_${examStudentId}_${selectedSubjectId}`;
            allGrades.push({
              _id: uniqueKey,
              exam: selectedExamId,
              examStudent: es,
              student: es,
              subject: { _id: selectedSubjectId },
              gradeValue: null,
            });
          }
        });
        
        setGrades(allGrades);
      } catch (err) {
        console.error("Lỗi tải điểm:", err);
        message.error("Không thể tải danh sách điểm");
        setGrades([]);
      } finally {
        setLoading(false);
      }
    };

    fetchGrades();
  }, [selectedExamId, selectedSubjectId, selectedClassId]);

  const handleSave = async (record: any, value: number | null) => {
    if (value === null || value === undefined) return;
    if (value < 0 || value > 10) {
      message.error("Điểm phải từ 0 đến 10");
      return;
    }

    try {
      setSaving(record._id);
      
      // Tìm examStudent từ record
      let examStudentId: string | null = null;
      
      // ✅ Backend trả về field "student" (ExamStudent), không phải "examStudent"
      if (record.student) {
        examStudentId = typeof record.student === 'object' && record.student !== null
          ? (record.student._id || record.student)
          : record.student;
      } else if (record.examStudent) {
        // Fallback cho tương thích
        examStudentId = typeof record.examStudent === 'object' && record.examStudent !== null
          ? (record.examStudent._id || record.examStudent)
          : record.examStudent;
      }
      
      if (!examStudentId) {
        message.error("Không tìm thấy thông tin học sinh dự thi");
        return;
      }

      // Nếu record có _id bắt đầu bằng "temp_", cần tìm examStudent thực tế
      if (record._id && record._id.startsWith('temp_')) {
        // examStudentId đã là _id của ExamStudent
        // Không cần làm gì thêm
      }

      const savedGradeRes = await examGradeApi.addOrUpdate({
        exam: selectedExamId,
        examStudent: examStudentId,
        subject: selectedSubjectId,
        gradeValue: Number(value),
        teacher: typeof backendUser?.teacherId === 'object' && backendUser?.teacherId !== null
          ? (backendUser.teacherId as any)._id
          : backendUser?.teacherId,
      });

      message.success("✅ Đã lưu điểm thành công", 2);
      
      // ✅ Cập nhật state ngay lập tức từ response
      const savedGrade = savedGradeRes?.grade || savedGradeRes;
      if (savedGrade) {
        setGrades((prevGrades: any[]) => {
          // ✅ Tìm và cập nhật grade đã có (có thể là temp hoặc đã có _id thật)
          const updatedGrades = prevGrades.map((g: any) => {
            const examStudent = g.student || g.examStudent;
            const esId = examStudent?._id || examStudent;
            if (String(esId) === String(examStudentId)) {
              // ✅ Cập nhật grade này với dữ liệu từ backend
              return {
                ...savedGrade,
                examStudent: savedGrade.student || g.examStudent, // ✅ Giữ lại examStudent cho frontend
                student: savedGrade.student, // ✅ Backend trả về field "student" (ExamStudent)
              };
            }
            return g;
          });
          
          // ✅ Nếu không tìm thấy trong danh sách hiện tại, thêm mới
          const found = updatedGrades.some((g: any) => {
            const examStudent = g.student || g.examStudent;
            const esId = examStudent?._id || examStudent;
            return String(esId) === String(examStudentId);
          });
          
          if (!found) {
            updatedGrades.push({
              ...savedGrade,
              examStudent: savedGrade.student, // ✅ Backend trả về field "student" (ExamStudent)
            });
          }
          
          return updatedGrades;
        });
      } else {
        // ✅ Fallback: Reload lại danh sách điểm nếu không có response
        const gradesRes = await examGradeApi.getByExam(selectedExamId, {
          subjectId: selectedSubjectId,
        });
        const allExistingGrades = Array.isArray(gradesRes) ? gradesRes : (gradesRes?.data || []);
        
        const studentsRes = await examStudentApi.getByExam(selectedExamId);
        const allExamStudents = Array.isArray(studentsRes) ? studentsRes : (studentsRes?.data || []);
        
        // ✅ Lọc học sinh theo lớp gốc (Student.classId), không phải nhóm lớp (ExamStudent.class)
        const examStudents = allExamStudents.filter((es: any) => {
          const studentClassId = es.student?.classId?._id || es.student?.classId;
          return String(studentClassId) === String(selectedClassId);
        });
        
        // ✅ Lọc điểm theo lớp gốc ở frontend
        const existingGrades = allExistingGrades.filter((g: any) => {
          // ✅ Backend trả về field "student" (ExamStudent)
          const examStudent = g.student || g.examStudent; // Fallback cho tương thích
          const student = examStudent?.student || g.student?.student;
          const studentClassId = student?.classId?._id || 
                                 student?.classId;
          return String(studentClassId) === String(selectedClassId);
        });
        
        const gradeMap = new Map();
        existingGrades.forEach((g: any) => {
          // ✅ Backend trả về field "student" (ExamStudent)
          const examStudent = g.student || g.examStudent; // Fallback cho tương thích
          const examStudentId = examStudent?._id || examStudent;
          if (examStudentId) {
            gradeMap.set(String(examStudentId), g);
          }
        });
        
        const allGrades: any[] = [];
        examStudents.forEach((es: any) => {
          const esId = es._id;
          const existingGrade = gradeMap.get(String(esId));
          
          if (existingGrade) {
            allGrades.push(existingGrade);
          } else {
            // ✅ Đảm bảo key unique: dùng examStudentId + subjectId (không dùng timestamp để tránh duplicate khi re-render)
            const uniqueKey = `temp_${esId}_${selectedSubjectId}`;
            allGrades.push({
              _id: uniqueKey,
              exam: selectedExamId,
              examStudent: es, // ✅ Giữ lại để frontend dùng
              student: es, // ✅ Backend dùng field "student" (ExamStudent)
              subject: { _id: selectedSubjectId },
              gradeValue: null,
            });
          }
        });
        
        setGrades(allGrades);
      }
    } catch (err: any) {
      console.error("Lỗi lưu điểm:", err);
      message.error(err?.response?.data?.error || "❌ Lỗi khi lưu điểm");
    } finally {
      setSaving(null);
    }
  };

  const filteredGrades = useMemo(() => {
    if (!filters.keyword.trim()) return grades;

    const keyword = filters.keyword.toLowerCase();
    return grades.filter((g: any) => {
      const student = g.examStudent?.student || g.student || g.examStudent;
      const name = student?.name || student?.fullName || "";
      const code = student?.studentCode || student?.code || "";
      const className = student?.className || student?.classId?.className || student?.class?.name || "";
      
      return (
        name.toLowerCase().includes(keyword) ||
        code.toLowerCase().includes(keyword) ||
        className.toLowerCase().includes(keyword)
      );
    });
  }, [grades, filters.keyword]);

  const columns = [
    {
      title: "STT",
      render: (_: any, __: any, index: number) => index + 1,
      align: "center" as const,
      width: 70,
    },
    {
      title: "Họ tên",
      render: (record: any) => {
        // ✅ Backend trả về field "student" (ExamStudent), không phải "examStudent"
        const examStudent = record.student || record.examStudent; // Fallback cho tương thích
        const student = examStudent?.student || record.student?.student || record.examStudent?.student;
        const name = student?.name || student?.fullName || "N/A";
        return <Tag color="blue">{name}</Tag>;
      },
    },
    {
      title: "Mã HS",
      render: (record: any) => {
        const examStudent = record.student || record.examStudent;
        const student = examStudent?.student || record.student?.student || record.examStudent?.student;
        return student?.studentCode || student?.code || "N/A";
      },
      align: "center" as const,
      width: 100,
    },
    {
      title: "Lớp",
      render: (record: any) => {
        const examStudent = record.student || record.examStudent;
        const student = examStudent?.student || record.student?.student || record.examStudent?.student;
        // ✅ Lấy lớp gốc từ Student.classId
        const classInfo = student?.classId;
        return classInfo?.className || classInfo?.name || "N/A";
      },
      align: "center" as const,
      width: 120,
    },
    {
      title: "Điểm",
      dataIndex: "gradeValue",
      align: "center" as const,
      width: 150,
      render: (v: number, record: any) => {
        const canEdit = hasPermission(PERMISSIONS.EXAM_GRADE_ENTER);
        const isSaving = saving === record._id;
        
        return (
          <InputNumber
            min={0}
            max={10}
            step={0.1}
            precision={1}
            defaultValue={v || undefined}
            disabled={!canEdit || isSaving}
            onBlur={(e) => {
              if (!canEdit || isSaving) return;
              const value = e.target.value;
              if (value && !isNaN(Number(value))) {
                handleSave(record, Number(value));
              }
            }}
            onPressEnter={(e) => {
              if (!canEdit || isSaving) return;
              const target = e.target as HTMLInputElement;
              const value = target.value;
              if (value && !isNaN(Number(value))) {
                handleSave(record, Number(value));
              }
            }}
            style={{ width: 100 }}
          />
        );
      },
    },
  ];

  const selectedExam = exams.find((e: any) => e._id === selectedExamId);
  const selectedSubject = availableSubjects.find((s: any) => s._id === selectedSubjectId);
  const selectedClass = availableClasses.find((c: any) => c._id === selectedClassId);

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <Title level={2} style={{ marginBottom: 24 }}>
          📝 Nhập điểm thi
        </Title>

        {!hasPermission(PERMISSIONS.EXAM_GRADE_ENTER) && (
          <Alert
            message="Không có quyền"
            description="Bạn không có quyền nhập điểm thi. Vui lòng liên hệ quản trị viên."
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        {/* Bộ lọc */}
        <Card style={{ marginBottom: 16, background: "#fafafa" }}>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} md={8}>
              <Space direction="vertical" style={{ width: "100%" }} size={4}>
                <Text strong>Kỳ thi</Text>
                <Select
                  value={selectedExamId}
                  onChange={(value) => {
                    setSelectedExamId(value);
                    setSelectedSubjectId("");
                    setSelectedClassId("");
                  }}
                  style={{ width: "100%" }}
                  placeholder="Chọn kỳ thi"
                  loading={loading}
                >
                  {exams.map((exam: any) => (
                    <Option key={exam._id} value={exam._id}>
                      {exam.name} - {exam.year} - HK{exam.semester}
                    </Option>
                  ))}
                </Select>
              </Space>
            </Col>

            <Col xs={24} sm={12} md={8}>
              <Space direction="vertical" style={{ width: "100%" }} size={4}>
                <Text strong>Môn học</Text>
                <Select
                  value={selectedSubjectId}
                  onChange={(value) => {
                    setSelectedSubjectId(value);
                    setSelectedClassId("");
                  }}
                  style={{ width: "100%" }}
                  placeholder="Chọn môn học"
                  disabled={!selectedExamId}
                >
                  {availableSubjects.map((subject: any) => (
                    <Option key={subject._id} value={subject._id}>
                      {subject.name}
                    </Option>
                  ))}
                </Select>
              </Space>
            </Col>

            <Col xs={24} sm={12} md={8}>
              <Space direction="vertical" style={{ width: "100%" }} size={4}>
                <Text strong>Lớp</Text>
                <Select
                  value={selectedClassId}
                  onChange={setSelectedClassId}
                  style={{ width: "100%" }}
                  placeholder="Chọn lớp"
                  disabled={!selectedSubjectId}
                >
                  {availableClasses.map((classItem: any) => (
                    <Option key={classItem._id} value={classItem._id}>
                      {classItem.name}
                    </Option>
                  ))}
                </Select>
              </Space>
            </Col>

            <Col xs={24} sm={12} md={24}>
              <Space direction="vertical" style={{ width: "100%" }} size={4}>
                <Text strong>Tìm kiếm</Text>
                <Input
                  placeholder="Tìm theo tên HS, mã HS, lớp..."
                  prefix={<SearchOutlined />}
                  value={filters.keyword}
                  onChange={(e) => setFilters((f) => ({ ...f, keyword: e.target.value }))}
                  allowClear
                />
              </Space>
            </Col>
          </Row>
        </Card>

        {/* Thông tin đã chọn */}
        {selectedExam && selectedSubject && selectedClass && (
          <Card style={{ marginBottom: 16, background: "#e6f7ff", borderColor: "#91d5ff" }}>
            <Space direction="vertical" size={8}>
              <Text strong>
                <BookOutlined /> {selectedSubject.name} - {selectedClass.name}
              </Text>
              <Text type="secondary">
                Kỳ thi: {selectedExam.name} ({selectedExam.year} - HK{selectedExam.semester})
              </Text>
            </Space>
          </Card>
        )}

        {/* Bảng điểm */}
        <Spin spinning={loading}>
          {selectedExamId && selectedSubjectId && selectedClassId ? (
            <Table
              dataSource={filteredGrades}
              columns={columns}
              rowKey={(r, index) => {
                // ✅ Đảm bảo key unique: dùng _id nếu có, nếu không dùng examStudentId + subjectId + index
                if (r._id) {
                  return String(r._id);
                }
                const examStudent = r.student || r.examStudent;
                const esId = examStudent?._id || examStudent || '';
                const subjectId = r.subject?._id || r.subject || '';
                return `grade_${esId}_${subjectId}_${index}`;
              }}
              pagination={{
                pageSize: 20,
                showSizeChanger: true,
                showTotal: (total) => `Tổng ${total} học sinh`,
              }}
              bordered
              locale={{
                emptyText: "Chưa có dữ liệu điểm thi",
              }}
            />
          ) : (
            <Card>
              <div style={{ textAlign: "center", padding: 40 }}>
                <UserOutlined style={{ fontSize: 48, color: "#d9d9d9", marginBottom: 16 }} />
                <Text type="secondary">
                  Vui lòng chọn kỳ thi, môn học và lớp để xem danh sách điểm thi
                </Text>
              </div>
            </Card>
          )}
        </Spin>
      </Card>
    </div>
  );
}

