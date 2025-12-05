import React, { useEffect, useState, useMemo } from "react";
import {
  Card,
  Table,
  Button,
  Tag,
  Space,
  Input,
  Select,
  message,
  Spin,
  Typography,
  Row,
  Col,
  Popover,
  Checkbox,
  Modal,
} from "antd";
import {
  SearchOutlined,
  ReloadOutlined,
  FileExcelOutlined,
  AppstoreOutlined,
  EditOutlined,
} from "@ant-design/icons";
import { examApi } from "@/services/exams/examApi";
import { examGradeApi } from "@/services/exams/examGradeApi";
import { examStudentApi } from "@/services/exams/examStudentApi";
import { useSchoolYears, useClasses, useSubjects } from "@/hooks";
import { ArrowUpOutlined, ArrowDownOutlined } from "@ant-design/icons";

const { Option } = Select;
const { Text, Title } = Typography;

export default function ExamGradesSearchPage() {
  const { schoolYears, currentYear } = useSchoolYears();
  const { classes: allClasses } = useClasses();
  const [exams, setExams] = useState<any[]>([]);
  const [selectedExam, setSelectedExam] = useState<string>("");
  const [grades, setGrades] = useState<any[]>([]);
  const [examStudents, setExamStudents] = useState<any[]>([]);
    // Lấy danh sách môn học toàn trường (giống ExamGradePage)
    const { subjects } = useSubjects();
  const [loading, setLoading] = useState(false);
  const [gradesLoading, setGradesLoading] = useState(false);
  const [examInfo, setExamInfo] = useState<any>(null);
  const [hk1Exam, setHk1Exam] = useState<any>(null);
  const [hk1Grades, setHk1Grades] = useState<any[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState({
    class: "Tất cả",
    keyword: "",
  });
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [viewRecord, setViewRecord] = useState<any | null>(null);
  const [userAdjustedSubjects, setUserAdjustedSubjects] = useState(false);

  // 🔍 Fetch danh sách kỳ thi
  const fetchExams = async () => {
    try {
      setLoading(true);
      const res = await examApi.getAll({ 
        year: currentYear,
        status: "published", // ✅ Chỉ lấy kỳ thi đã công bố
        limit: 1000 
      });
      // ✅ examApi.getAll() trả về { total, page, limit, totalPages, data }
      const examsData = res?.data || [];
      // ✅ Sắp xếp theo ngày bắt đầu (mới nhất lên đầu)
      const sortedExams = examsData.sort((a: any, b: any) => {
        const dateA = a.startDate ? new Date(a.startDate).getTime() : 0;
        const dateB = b.startDate ? new Date(b.startDate).getTime() : 0;
        return dateB - dateA;
      });
      setExams(sortedExams);
    } catch (err: any) {
      console.error("Lỗi tải kỳ thi:", err);
      message.error(err?.response?.data?.error || "Không thể tải danh sách kỳ thi");
      setExams([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExams();
  }, [currentYear]);

  // 📊 Fetch điểm thi và so sánh với HK1
  const fetchGrades = async () => {
    if (!selectedExam) {
      setGrades([]);
      setHk1Grades([]);
      setExamInfo(null);
      setHk1Exam(null);
      return;
    }

    try {
      setGradesLoading(true);
      const exam = exams.find((e) => e._id === selectedExam);
      if (!exam) return;

      setExamInfo(exam);

      // Lấy toàn bộ học sinh dự thi
      const studentsRes = await examStudentApi.getByExam(selectedExam, { limit: 0 });
      const examStudentsData = Array.isArray(studentsRes) ? studentsRes : (studentsRes?.data || []);
      setExamStudents(examStudentsData);

      // Lấy điểm của kỳ thi hiện tại
      const gradesRes = await examGradeApi.getByExam(selectedExam, { limit: 0 });
      let gradesData: any[] = [];
      if (Array.isArray(gradesRes)) {
        gradesData = gradesRes;
      } else if (gradesRes?.data && Array.isArray(gradesRes.data)) {
        gradesData = gradesRes.data;
      } else if (gradesRes?.data && !Array.isArray(gradesRes.data)) {
        gradesData = gradesRes.data?.data || [];
      }

      // Merge: đảm bảo tất cả học sinh dự thi đều xuất hiện
      // Tạo map điểm theo examStudentId + subjectId
      const gradeMap = new Map<string, any>();
      gradesData.forEach((grade) => {
        const examStudentId = grade.examStudent?._id || grade.student?._id || grade.student;
        const subjectId = grade.subject?._id || grade.subject;
        if (examStudentId && subjectId) {
          gradeMap.set(`${examStudentId}_${subjectId}`, grade);
        }
      });

      // Tạo danh sách merged: mỗi học sinh dự thi sẽ có điểm từng môn nếu có, nếu không thì null
      const mergedGrades: any[] = [];
      examStudentsData.forEach((es) => {
        // Lấy thông tin học sinh
        const studentInfo = es.student || {};
        // Lấy danh sách môn học từ hook subjects (giống ExamGradePage)
        subjects.forEach((subject) => {
          const subjectId = subject._id || subject;
          const grade = gradeMap.get(`${es._id}_${subjectId}`);
          mergedGrades.push({
            examStudent: es,
            student: studentInfo,
            subject,
            gradeValue: grade?.gradeValue ?? null,
            teacher: grade?.teacher || null,
          });
        });
      });

      setGrades(mergedGrades);

      // Nếu là HK2, tìm và lấy điểm HK1 cùng năm học
      if (exam.semester === "2" && exam.year) {
        const hk1ExamData = exams.find(
          (e) => e.semester === "1" && e.year === exam.year && e.type === exam.type
        );
        
        if (hk1ExamData) {
          setHk1Exam(hk1ExamData);
          const hk1Res = await examGradeApi.getByExam(hk1ExamData._id, { limit: 0 });
          // ✅ Xử lý response tương tự như trên
          let hk1Data: any[] = [];
          if (Array.isArray(hk1Res)) {
            hk1Data = hk1Res;
          } else if (hk1Res?.data && Array.isArray(hk1Res.data)) {
            hk1Data = hk1Res.data;
          } else if (hk1Res?.data && !Array.isArray(hk1Res.data)) {
            hk1Data = hk1Res.data?.data || [];
          }
          setHk1Grades(hk1Data);
        } else {
          setHk1Exam(null);
          setHk1Grades([]);
        }
      } else {
        setHk1Exam(null);
        setHk1Grades([]);
      }
    } catch (err: any) {
      console.error("Lỗi tải điểm:", err);
      message.error(err?.response?.data?.error || "Không thể tải điểm thi");
      setGrades([]);
      setHk1Grades([]);
      setHk1Exam(null);
    } finally {
      setGradesLoading(false);
    }
  };

  useEffect(() => {
    if (selectedExam) {
      fetchGrades();
    }
  }, [selectedExam]);

  // 🔄 Transform dữ liệu: group theo học sinh và map với điểm so sánh
  const groupedData = useMemo(() => {
    // Tạo map điểm hiện tại
    const currentMap = new Map<string, any>();
    grades.forEach((grade) => {
      const examStudentId = grade.examStudent?._id || grade.student?._id || grade.student;
      const subjectId = grade.subject?._id || grade.subject;
      if (examStudentId && subjectId) {
        currentMap.set(`${examStudentId}_${subjectId}`, grade);
      }
    });

    // Tạo map điểm so sánh (HK1 nếu kỳ thi hiện tại là HK2)
    const compareMap = new Map<string, any>();
    if (hk1Grades.length > 0) {
      hk1Grades.forEach((grade) => {
        const examStudentId = grade.examStudent?._id || grade.student?._id || grade.student;
        const subjectId = grade.subject?._id || grade.subject;
        if (examStudentId && subjectId) {
          compareMap.set(`${examStudentId}_${subjectId}`, grade);
        }
      });
    }

    // Group theo học sinh: lấy từ examStudents (giống ExamGradePage)
    return examStudents.map((es) => {
      const studentInfo = es.student || {};
      const classInfo = studentInfo.classId || es.class || {};
      // Lấy điểm cho từng môn
      const subjectsMap: Record<string, any> = {};
      subjects.forEach((subject) => {
        const subjectId = String(subject._id || subject);
        const currentGrade = currentMap.get(`${es._id}_${subjectId}`);
        const compareGrade = compareMap.get(`${es._id}_${subjectId}`);

        // Tính xu hướng (chỉ khi có cả 2 điểm)
        let trend: "up" | "down" | "same" | null = null;
        let trendValue: number | null = null;
        if (examInfo?.semester === "2" && hk1Exam) {
          const currentScore = currentGrade?.gradeValue;
          const compareScore = compareGrade?.gradeValue;
          if (currentScore !== null && currentScore !== undefined &&
              compareScore !== null && compareScore !== undefined) {
            trendValue = currentScore - compareScore;
            if (trendValue > 0) trend = "up";
            else if (trendValue < 0) trend = "down";
            else trend = "same";
          }
        }
        // Xác định điểm hiện tại và điểm so sánh
        let currentScore = currentGrade?.gradeValue ?? null;
        const compareScore = examInfo?.semester === "2" && hk1Exam 
          ? (compareGrade?.gradeValue ?? null)
          : null;
        let teacher = currentGrade?.teacher || compareGrade?.teacher || null;

        // Nếu chưa có điểm, lấy tạm từ examStudent.subjects[].score
        if ((currentScore === null || currentScore === undefined) && Array.isArray(es.subjects)) {
          const subjObj = es.subjects.find((s: any) => {
            const sId = s.subject?._id || s.subject || s;
            return String(sId) === String(subjectId);
          });
          if (subjObj && typeof subjObj.score === 'number') {
            currentScore = subjObj.score;
            teacher = subjObj.teacher || teacher;
          }
        }

        subjectsMap[subjectId] = {
          subject,
          hk1: examInfo?.semester === "2" && hk1Exam ? compareScore : null,
          hk2: examInfo?.semester === "2" ? currentScore : null,
          current: currentScore,
          trend,
          trendValue,
          teacher,
        };
      });
      return {
        examStudent: es,
        student: {
          _id: studentInfo._id,
          name: studentInfo.name || "",
          studentCode: studentInfo.studentCode || "",
          className: classInfo.className || classInfo.name || "",
          classCode: classInfo.classCode || "",
          grade: classInfo.grade || es.grade || "",
          classId: classInfo._id || classInfo,
        },
        subjects: subjectsMap,
      };
    });
  }, [grades, hk1Grades, examInfo, hk1Exam, examStudents, subjects]);

  // Đã lấy subjects từ useSubjects ở trên, không cần useMemo nữa

  // Mặc định hiển thị số môn phù hợp màn hình (tối đa 7)
  useEffect(() => {
    if (subjects.length > 0 && selectedSubjects.size === 0 && !userAdjustedSubjects) {
      if (typeof window !== "undefined") {
        const viewport = window.innerWidth || 1280;
        const LEFT_FIXED_WIDTH = 90 + 180 + 90; // MSHS + Họ và Tên + Lớp
        const ACTION_WIDTH = 72;
        const PADDING = 64; // khoảng trống lề
        const SUBJECT_COL_WIDTH = 110; // mỗi cột môn ~110px
        const available = Math.max(320, viewport - (LEFT_FIXED_WIDTH + ACTION_WIDTH + PADDING));
        const maxFit = Math.max(1, Math.floor(available / SUBJECT_COL_WIDTH));
        const defaultCount = Math.min(7, Math.max(3, maxFit));
        setSelectedSubjects(new Set(subjects.slice(0, defaultCount).map((s: any) => String(s._id))));
      } else {
        setSelectedSubjects(new Set(subjects.slice(0, 7).map((s: any) => String(s._id))));
      }
    }
  }, [subjects, selectedSubjects.size, userAdjustedSubjects]);

  // Danh sách môn hiển thị theo lựa chọn
  const visibleSubjects = useMemo(() => {
    if (!selectedSubjects.size) return subjects;
    return subjects.filter((s: any) => selectedSubjects.has(String(s._id)));
  }, [subjects, selectedSubjects]);

  // Lọc danh sách học sinh theo tìm kiếm và lớp
  const classes = useMemo(() => {
    if (!examInfo?.year) return allClasses;
    return allClasses.filter((c) => c.year === examInfo.year);
  }, [allClasses, examInfo?.year]);

  const filteredRows = useMemo(() => {
    let result = Array.isArray(groupedData) ? [...groupedData] : [];

    // Keyword filter
    if (filters.keyword.trim()) {
      const kw = filters.keyword.toLowerCase();
      result = result.filter((item: any) =>
        item.student?.name?.toLowerCase().includes(kw) ||
        item.student?.studentCode?.toLowerCase().includes(kw) ||
        item.student?.className?.toLowerCase().includes(kw)
      );
    }

    // Class filter
    if (filters.class !== "Tất cả") {
      result = result.filter((item: any) => {
        const classId = item.student?.classId?._id || item.student?.classId;
        return String(classId) === String(filters.class);
      });
    }

    return result;
  }, [groupedData, filters]);

  // 🎨 Render xu hướng
  const renderTrend = (trend: "up" | "down" | "same" | null, trendValue: number | null) => {
    if (trend === null || trendValue === null) {
      return <span style={{ color: "#999" }}>-</span>;
    }
    
    if (trend === "up") {
      return (
        <Space>
          <ArrowUpOutlined style={{ color: "#52c41a" }} />
          <span style={{ color: "#52c41a" }}>+{trendValue.toFixed(1)}</span>
        </Space>
      );
    } else if (trend === "down") {
      return (
        <Space>
          <ArrowDownOutlined style={{ color: "#ff4d4f" }} />
          <span style={{ color: "#ff4d4f" }}>{trendValue.toFixed(1)}</span>
        </Space>
      );
    } else {
      return <span style={{ color: "#999" }}>0.0</span>;
    }
  };

  // 🎨 Lấy màu nền cho điểm số
  const getScoreColor = (score: number | null | undefined): string => {
    if (score === null || score === undefined) return "";
    if (score >= 8.0) return "#d4edda";
    if (score >= 6.5) return "#d1ecf1";
    return "#f8d7da";
  };

  // 📊 Tạo cột cho bảng theo style của ExamGradePage
  const columns = useMemo(() => {
    const cols: any[] = [
      {
        title: "MSHS",
        dataIndex: ["student", "studentCode"],
        align: "center" as const,
        width: 90,
        fixed: "left" as const,
      },
      {
        title: "Họ và Tên",
        dataIndex: ["student", "name"],
        width: 180,
        fixed: "left" as const,
        render: (v: string) => <span className="font-medium">{v}</span>,
      },
      {
        title: "Lớp",
        dataIndex: ["student", "className"],
        align: "center" as const,
        width: 90,
        fixed: "left" as const,
        render: (v: string) => (
          <Tag style={{ background: "#e9ecef", color: "#495057", border: "none" }}>
            {v}
          </Tag>
        ),
      },
    ];

    // Thêm cột cho từng môn học hiển thị
    visibleSubjects.forEach((subject: any) => {
      cols.push({
        title: subject.name,
        align: "center" as const,
        width: 110,
        render: (_: any, record: any) => {
          const subjectData = record.subjects[subject._id];
          if (!subjectData) return <span style={{ color: "#999" }}>-</span>;

          const currentScore = subjectData.current;
          const teacher = subjectData.teacher;

          const bgColor = getScoreColor(currentScore);
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
              <div
                style={{
                  background: bgColor,
                  padding: "6px",
                  borderRadius: "4px",
                  minWidth: "52px",
                  display: "inline-block",
                }}
              >
                {currentScore !== null && currentScore !== undefined ? Number(currentScore).toFixed(1) : "-"}
              </div>
              {teacher && (
                <div style={{ fontSize: "10px", color: "#666", textAlign: "center" }}>
                  {typeof teacher === 'object' ? (teacher.name || teacher.teacherCode || '') : ''}
                </div>
              )}
            </div>
          );
        },
      });
    });

    // Cột thao tác (xem toàn bộ điểm của học sinh trong kỳ thi)
    cols.push({
      title: "Thao tác",
      align: "center" as const,
      width: 72,
      fixed: "right" as const,
      render: (_: any, record: any) => (
        <Button
          type="text"
          icon={<EditOutlined />}
          onClick={() => {
            setViewRecord(record);
            setViewModalOpen(true);
          }}
        />
      ),
    });

    return cols;
  }, [visibleSubjects]);

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <Title level={2} style={{ marginBottom: 24 }}>
          📊 Tìm Kiếm Điểm Thi
        </Title>

        {/* 🔍 Tìm kiếm kỳ thi */}
        <Card style={{ marginBottom: 16 }}>
          <Row gutter={[16, 16]} align="middle">
            <Col xs={24} sm={12} md={10}>
              <div style={{ marginBottom: 8 }}>
                <Text strong>Chọn kỳ thi:</Text>
              </div>
              <Select
                placeholder="Chọn kỳ thi để xem điểm"
                value={selectedExam}
                onChange={setSelectedExam}
                style={{ width: "100%" }}
                size="large"
                showSearch
                loading={loading}
                notFoundContent={loading ? <Spin size="small" /> : "Không tìm thấy kỳ thi"}
                filterOption={(input, option) => {
                  const children = option?.children;
                  const text = typeof children === 'string' ? children : String(children || '');
                  return text.toLowerCase().includes(input.toLowerCase());
                }}
              >
                {exams.map((exam) => (
                  <Option key={exam._id} value={exam._id}>
                    {exam.name} - {exam.year} - HK{exam.semester} {exam.type === 'midterm' ? '(Giữa kỳ)' : exam.type === 'final' ? '(Cuối kỳ)' : ''}
                  </Option>
                ))}
              </Select>
            </Col>
            <Col xs={24} sm={12} md={14}>
              {examInfo && (
                <div>
                  <div style={{ marginBottom: 8 }}>
                    <Text strong>Thông tin kỳ thi:</Text>
                  </div>
                  <Space wrap>
                    <Tag color="blue" style={{ fontSize: 14, padding: "4px 12px" }}>
                      {examInfo.name}
                    </Tag>
                    <Tag style={{ fontSize: 14, padding: "4px 12px" }}>
                      {examInfo.year}
                    </Tag>
                    <Tag color="green" style={{ fontSize: 14, padding: "4px 12px" }}>
                      HK{examInfo.semester}
                    </Tag>
                    <Tag color={examInfo.type === 'midterm' ? 'cyan' : examInfo.type === 'final' ? 'red' : 'default'} style={{ fontSize: 14, padding: "4px 12px" }}>
                      {examInfo.type === 'midterm' ? 'Giữa kỳ' : examInfo.type === 'final' ? 'Cuối kỳ' : examInfo.type || 'Khác'}
                    </Tag>
                    {hk1Exam && (
                      <Tag color="orange" style={{ fontSize: 14, padding: "4px 12px" }}>
                        So sánh với: {hk1Exam.name} - HK1
                      </Tag>
                    )}
                  </Space>
                </div>
              )}
            </Col>
          </Row>
          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col xs={24} sm={12} md={12}>
              <Space>
                <Button icon={<ReloadOutlined />} onClick={fetchExams} loading={loading}>
                  Làm mới danh sách
                </Button>
                {selectedExam && (
                  <Button
                    icon={<FileExcelOutlined />}
                    onClick={async () => {
                      try {
                        const blob = await examGradeApi.exportExcel(selectedExam);
                        const url = URL.createObjectURL(new Blob([blob]));
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `DiemThi_${examInfo?.name || selectedExam}_${new Date().getTime()}.xlsx`;
                        a.click();
                        message.success("✅ Đã xuất file Excel");
                      } catch (err: any) {
                        console.error("Lỗi xuất Excel:", err);
                        message.error(err?.response?.data?.error || "❌ Lỗi khi xuất Excel");
                      }
                    }}
                  >
                    Xuất Excel
                  </Button>
                )}
              </Space>
            </Col>
          </Row>
        </Card>

        {/* 🔍 Tìm Kiếm & Lọc (style giống ExamGradePage) */}
        {selectedExam && (
          <Card style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 12 }}>
              <Text strong style={{ fontSize: 16 }}>Tìm Kiếm & Lọc</Text>
            </div>
            <Text type="secondary" style={{ display: "block", marginBottom: 16 }}>
              Tìm kiếm theo MSHS, họ tên hoặc lớp
            </Text>
            <Row gutter={[16, 16]} align="middle">
              <Col xs={24} sm={12} md={12}>
                <Input
                  placeholder="Tìm kiếm..."
                  prefix={<SearchOutlined />}
                  value={filters.keyword}
                  onChange={(e) => setFilters((f) => ({ ...f, keyword: e.target.value }))}
                  allowClear
                  size="large"
                />
              </Col>
              <Col xs={24} sm={12} md={12}>
                <Select
                  value={filters.class}
                  onChange={(v) => setFilters((f) => ({ ...f, class: v }))}
                  style={{ width: "100%" }}
                  placeholder="Tất cả lớp"
                  size="large"
                >
                  <Option value="Tất cả">Tất cả lớp</Option>
                  {classes.map((c: any) => (
                    <Option key={c._id} value={c._id}>
                      {c.className}
                    </Option>
                  ))}
                </Select>
              </Col>
            </Row>
          </Card>
        )}

        {/* 📊 Bảng điểm thi */}
        {selectedExam && (
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <Text strong style={{ fontSize: 18 }}>Bảng Điểm Thi</Text>
                <div>
                  <Text type="secondary">Hiển thị {filteredRows.length} học sinh</Text>
                </div>
              </div>
              <Space>
                <Popover
                  title="Chọn môn học hiển thị"
                  content={
                    <div style={{ maxHeight: 400, overflowY: "auto", minWidth: 200 }}>
                      <div style={{ marginBottom: 8, borderBottom: "1px solid #f0f0f0", paddingBottom: 8 }}>
                        <Space>
                          <Button size="small" type="link" onClick={() => setSelectedSubjects(new Set(subjects.map((s: any) => String(s._id))))}>
                            Chọn tất cả
                          </Button>
                          <Button size="small" type="link" onClick={() => setSelectedSubjects(new Set())}>
                            Bỏ chọn tất cả
                          </Button>
                        </Space>
                      </div>
                      <Checkbox.Group
                        value={Array.from(selectedSubjects)}
                        onChange={(checkedValues) => {
                          const next = new Set<string>();
                          (checkedValues as any[]).forEach((v) => next.add(String(v)));
                          setSelectedSubjects(next);
                          setUserAdjustedSubjects(true);
                        }}
                        style={{ display: "flex", flexDirection: "column", gap: 8 }}
                      >
                        {subjects.map((subject: any, idx: number) => (
                          <Checkbox key={subject._id || idx} value={String(subject._id)}>
                            {subject.name}
                          </Checkbox>
                        ))}
                      </Checkbox.Group>
                    </div>
                  }
                  trigger="click"
                  placement="bottomRight"
                >
                  <Button icon={<AppstoreOutlined />}>
                    Chọn Môn ({visibleSubjects.length}/{subjects.length})
                  </Button>
                </Popover>
              </Space>
            </div>

            <Spin spinning={gradesLoading}>
              {filteredRows.length === 0 && !gradesLoading ? (
                <div style={{ textAlign: "center", padding: 40 }}>
                  <Text type="secondary">Chưa có dữ liệu điểm thi</Text>
                </div>
              ) : (
                <Table
                  dataSource={filteredRows}
                  columns={columns}
                  rowKey={(r) => {
                    const studentId = r.student?._id || r.examStudent?._id || "";
                    return `student_${studentId}`;
                  }}
                  pagination={{
                    pageSize: 50,
                    showSizeChanger: true,
                    pageSizeOptions: ["10", "20", "50", "100"],
                    showTotal: (total) => `Tổng ${total} học sinh`,
                  }}
                  bordered
                  scroll={{ x: "max-content", y: "calc(100vh - 500px)" }}
                  size="small"
                />
              )}
            </Spin>
          </Card>
        )}

        {/* Modal xem toàn bộ điểm của học sinh trong kỳ thi */}
        <Modal
          title={
            viewRecord
              ? `Điểm thi - ${viewRecord.student?.name || ''} (${viewRecord.student?.studentCode || ''})`
              : "Điểm thi"
          }
          open={viewModalOpen}
          onCancel={() => setViewModalOpen(false)}
          footer={[
            <Button key="close" onClick={() => setViewModalOpen(false)}>
              Đóng
            </Button>,
          ]}
          width={700}
        >
          {viewRecord ? (
            <div>
              <div style={{ marginBottom: 12 }}>
                <Space wrap>
                  <Tag color="blue">Lớp: {viewRecord.student?.className || '-'}</Tag>
                </Space>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {subjects.map((subject: any, idx: number) => {
                  const data = viewRecord.subjects?.[subject._id];
                  const score = data?.current ?? null;
                  const teacher = data?.teacher;
                  return (
                    <Card key={subject._id || idx} size="small">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontWeight: 600 }}>{subject.name}</div>
                        <div style={{
                          background: getScoreColor(score),
                          padding: '4px 10px',
                          borderRadius: 4,
                          minWidth: 50,
                          textAlign: 'center',
                          fontWeight: 600,
                        }}>
                          {score !== null && score !== undefined ? Number(score).toFixed(1) : '-'}
                        </div>
                      </div>
                      {teacher && (
                        <div style={{ marginTop: 6, fontSize: 12, color: '#666' }}>
                          GV: {typeof teacher === 'object' ? (teacher.name || teacher.teacherCode || '') : ''}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            </div>
          ) : <Spin />}
        </Modal>

        {!selectedExam && (
          <Card>
            <Text type="secondary">Vui lòng chọn kỳ thi để xem điểm</Text>
          </Card>
        )}
      </Card>
    </div>
  );
}

