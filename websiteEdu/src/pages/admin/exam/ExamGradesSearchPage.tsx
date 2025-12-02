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
} from "antd";
import {
  SearchOutlined,
  ReloadOutlined,
  FileExcelOutlined,
} from "@ant-design/icons";
import { examApi } from "@/services/exams/examApi";
import { examGradeApi } from "@/services/exams/examGradeApi";
import { useSchoolYears } from "@/hooks";
import { ArrowUpOutlined, ArrowDownOutlined } from "@ant-design/icons";

const { Option } = Select;
const { Text, Title } = Typography;

export default function ExamGradesSearchPage() {
  const { schoolYears, currentYear } = useSchoolYears();
  const [exams, setExams] = useState<any[]>([]);
  const [selectedExam, setSelectedExam] = useState<string>("");
  const [grades, setGrades] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [gradesLoading, setGradesLoading] = useState(false);
  const [examInfo, setExamInfo] = useState<any>(null);
  const [hk1Exam, setHk1Exam] = useState<any>(null);
  const [hk1Grades, setHk1Grades] = useState<any[]>([]);

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

      // Lấy điểm của kỳ thi hiện tại
      const gradesRes = await examGradeApi.getByExam(selectedExam);
      // ✅ examGradeApi.getByExam() có thể trả về { data: [...] } hoặc array trực tiếp
      let gradesData: any[] = [];
      if (Array.isArray(gradesRes)) {
        gradesData = gradesRes;
      } else if (gradesRes?.data && Array.isArray(gradesRes.data)) {
        gradesData = gradesRes.data;
      } else if (gradesRes?.data && !Array.isArray(gradesRes.data)) {
        // Nếu data là object, có thể là paginated response
        gradesData = gradesRes.data?.data || [];
      }
      setGrades(gradesData);

      // Nếu là HK2, tìm và lấy điểm HK1 cùng năm học
      if (exam.semester === "2" && exam.year) {
        const hk1ExamData = exams.find(
          (e) => e.semester === "1" && e.year === exam.year && e.type === exam.type
        );
        
        if (hk1ExamData) {
          setHk1Exam(hk1ExamData);
          const hk1Res = await examGradeApi.getByExam(hk1ExamData._id);
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
    if (!Array.isArray(grades)) return [];

    // Tạo map điểm kỳ thi hiện tại theo examStudent._id và subject._id
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

    // Group theo học sinh
    const studentMap = new Map<string, any>();
    
    grades.forEach((grade) => {
      const examStudentId = grade.examStudent?._id || grade.student?._id || grade.student;
      if (!examStudentId) return;

      if (!studentMap.has(examStudentId)) {
        studentMap.set(examStudentId, {
          student: grade.student,
          examStudent: grade.examStudent,
          subjects: {},
        });
      }

      const subjectId = grade.subject?._id || grade.subject;
      if (subjectId) {
        const currentGrade = currentMap.get(`${examStudentId}_${subjectId}`);
        const compareGrade = compareMap.get(`${examStudentId}_${subjectId}`);
        
        // Tính xu hướng (chỉ khi có cả 2 điểm)
        let trend: "up" | "down" | "same" | null = null;
        let trendValue: number | null = null;
        
        // Nếu là HK2 và có điểm HK1 để so sánh
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
        const currentScore = currentGrade?.gradeValue ?? null;
        const compareScore = examInfo?.semester === "2" && hk1Exam 
          ? (compareGrade?.gradeValue ?? null)
          : null;

        studentMap.get(examStudentId).subjects[subjectId] = {
          subject: grade.subject,
          hk1: examInfo?.semester === "2" && hk1Exam ? compareScore : null,
          hk2: examInfo?.semester === "2" ? currentScore : null,
          current: currentScore,
          trend,
          trendValue,
          teacher: currentGrade?.teacher || compareGrade?.teacher || null,
        };
      }
    });

    return Array.from(studentMap.values());
  }, [grades, hk1Grades, examInfo, hk1Exam]);

  // 📚 Lấy danh sách môn học từ dữ liệu điểm
  const subjects = useMemo(() => {
    const subjectSet = new Set<string>();
    grades.forEach((grade) => {
      const subjectId = grade.subject?._id || grade.subject;
      if (subjectId) subjectSet.add(String(subjectId));
    });
    
    const subjectMap = new Map();
    grades.forEach((grade) => {
      const subjectId = grade.subject?._id || grade.subject;
      if (subjectId && !subjectMap.has(String(subjectId))) {
        subjectMap.set(String(subjectId), grade.subject);
      }
    });
    
    return Array.from(subjectMap.values());
  }, [grades]);

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

  // 📊 Tạo cột cho bảng
  const columns = useMemo(() => {
    const cols: any[] = [
      {
        title: "MSHS",
        dataIndex: ["student", "studentCode"],
        align: "center" as const,
        width: 100,
        fixed: "left" as const,
      },
      {
        title: "Họ và Tên",
        dataIndex: ["student", "name"],
        width: 200,
        fixed: "left" as const,
        render: (v: string) => <span className="font-medium">{v}</span>,
      },
      {
        title: "Lớp",
        dataIndex: ["student", "className"],
        align: "center" as const,
        width: 100,
        fixed: "left" as const,
        render: (v: string) => (
          <Tag style={{ background: "#e9ecef", color: "#495057", border: "none" }}>
            {v}
          </Tag>
        ),
      },
    ];

    // Thêm cột cho từng môn học
    subjects.forEach((subject) => {
      cols.push({
        title: subject.name,
        align: "center" as const,
        width: 150,
        render: (_: any, record: any) => {
          const subjectData = record.subjects[subject._id];
          if (!subjectData) {
            return <span style={{ color: "#999" }}>-</span>;
          }

          const hk1Score = subjectData.hk1;
          const hk2Score = subjectData.hk2;
          const currentScore = subjectData.current;
          const trend = subjectData.trend;
          const trendValue = subjectData.trendValue;
          const teacher = subjectData.teacher;

          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ display: "flex", gap: 8, justifyContent: "center", alignItems: "center" }}>
                {hk1Exam && hk1Score !== null && (
                  <>
                    <div
                      style={{
                        background: getScoreColor(hk1Score),
                        padding: "4px 8px",
                        borderRadius: "4px",
                        fontSize: "12px",
                        minWidth: "40px",
                      }}
                    >
                      {hk1Score.toFixed(1)}
                    </div>
                    <span style={{ fontSize: "12px", color: "#999" }}>→</span>
                  </>
                )}
                <div
                  style={{
                    background: getScoreColor(currentScore),
                    padding: "4px 8px",
                    borderRadius: "4px",
                    fontSize: "12px",
                    fontWeight: "bold",
                    minWidth: "40px",
                  }}
                >
                  {currentScore !== null && currentScore !== undefined ? currentScore.toFixed(1) : "-"}
                </div>
              </div>
              {hk1Exam && trend !== null && (
                <div style={{ fontSize: "11px" }}>
                  {renderTrend(trend, trendValue)}
                </div>
              )}
              {teacher && (
                <div style={{ fontSize: "10px", color: "#666", textAlign: "center", marginTop: 2 }}>
                  {typeof teacher === 'object' ? (teacher.name || teacher.teacherCode || '') : ''}
                </div>
              )}
            </div>
          );
        },
      });
    });

    return cols;
  }, [subjects, hk1Exam]);

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

        {/* 📊 Bảng điểm thi */}
        {selectedExam && (
          <Card>
            <div style={{ marginBottom: 16 }}>
              <Title level={4}>Bảng Điểm Thi</Title>
              {hk1Exam && (
                <Text type="secondary">
                  So sánh điểm HK2 với HK1 - Màu xanh: tăng, Màu đỏ: giảm
                </Text>
              )}
            </div>

            <Spin spinning={gradesLoading}>
              {groupedData.length === 0 && !gradesLoading ? (
                <div style={{ textAlign: "center", padding: 40 }}>
                  <Text type="secondary">Chưa có dữ liệu điểm thi</Text>
                </div>
              ) : (
                <Table
                  dataSource={groupedData}
                  columns={columns}
                  rowKey={(r) => {
                    const studentId = r.student?._id || r.examStudent?._id || "";
                    return `student_${studentId}`;
                  }}
                  pagination={{
                    pageSize: 20,
                    showSizeChanger: true,
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

        {!selectedExam && (
          <Card>
            <Text type="secondary">Vui lòng chọn kỳ thi để xem điểm</Text>
          </Card>
        )}
      </Card>
    </div>
  );
}

