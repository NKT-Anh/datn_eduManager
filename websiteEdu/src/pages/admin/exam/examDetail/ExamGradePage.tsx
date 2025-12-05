import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  Card,
  Table,
  Button,
  Tag,
  Space,
  InputNumber,
  message,
  Upload,
  Popconfirm,
  Spin,
  Select,
  Input,
  Row,
  Col,
  Typography,
  Modal,
  Popover,
  Checkbox,
} from "antd";
import {
  SaveOutlined,
  UploadOutlined,
  FileExcelOutlined,
  LockOutlined,
  ReloadOutlined,
  SearchOutlined,
  SendOutlined,
  EditOutlined,
  AppstoreOutlined,
} from "@ant-design/icons";
import { examGradeApi } from "@/services/exams/examGradeApi";
import { examStudentApi } from "@/services/exams/examStudentApi";
// ✅ Sử dụng hooks thay vì API trực tiếp
import { useSubjects, useClasses } from "@/hooks";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/contexts/AuthContext";

const { Option } = Select;
const { Text } = Typography;

interface ExamGradePageProps {
  examId: string;
  exam?: any;
}

export default function ExamGradePage({ examId, exam }: ExamGradePageProps) {
  const { hasPermission, hasAnyPermission, PERMISSIONS } = usePermissions();
  const { backendUser } = useAuth();
  const [grades, setGrades] = useState<any[]>([]);
  const [examStudents, setExamStudents] = useState<any[]>([]);
  // ✅ Sử dụng hooks
  const { subjects } = useSubjects();
  // ✅ Lấy classes theo năm học của kỳ thi
  const { classes: allClasses } = useClasses();
  
  // ✅ Filter classes theo năm học của kỳ thi
  const classes = useMemo(() => {
    if (!exam?.year) return allClasses;
    return allClasses.filter((c) => c.year === exam.year);
  }, [allClasses, exam?.year]);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [isPublished, setIsPublished] = useState<boolean>(Boolean(exam?.gradesPublished));
  const [publishedAt, setPublishedAt] = useState<string | null>(exam?.gradesPublishedAt || null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingStudent, setEditingStudent] = useState<any>(null);
  const [editingScores, setEditingScores] = useState<Record<string, number | null>>({});
  const [selectedSubjects, setSelectedSubjects] = useState<Set<string>>(new Set());

  // 🔍 Filters
  const [filters, setFilters] = useState({
    class: "Tất cả",
    keyword: "",
  });

  useEffect(() => {
    setIsPublished(Boolean(exam?.gradesPublished));
    setPublishedAt(exam?.gradesPublishedAt || null);
  }, [exam?.gradesPublished, exam?.gradesPublishedAt]);

  const fetchData = async () => {
    try {
      setLoading(true);
      // ✅ Lấy cả examStudents và grades - không giới hạn số lượng
      const [studentsRes, gradesRes] = await Promise.all([
        examStudentApi.getByExam(examId, { limit: 0 }), // ✅ limit = 0 để lấy tất cả
        examGradeApi.getByExam(examId),
      ]);
      
      // ✅ Xử lý examStudents
      const studentsData = Array.isArray(studentsRes) ? studentsRes : (studentsRes?.data || []);
      setExamStudents(studentsData);
      
      // ✅ Xử lý grades
      const gradesData = Array.isArray(gradesRes) ? gradesRes : (gradesRes?.data || []);
      setGrades(gradesData);

      // Debug log
      console.log('[ExamGradePage] examStudents:', studentsData);
      console.log('[ExamGradePage] grades:', gradesData);
    } catch (err) {
      console.error("Lỗi tải dữ liệu:", err);
      message.error("Không thể tải dữ liệu");
      setExamStudents([]);
      setGrades([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (examId) {
      fetchData();
    }
  }, [examId]);

  const canPublishGrades =
    backendUser?.role === "admin" ||
    backendUser?.teacherFlags?.isLeader ||
    backendUser?.teacherFlags?.isDepartmentHead;

  const handlePublishGrades = async () => {
    try {
      setPublishing(true);
      const res = await examGradeApi.publish(examId);
      message.success(res?.message || "✅ Đã công bố điểm thi");
      setIsPublished(true);
      setPublishedAt(new Date().toISOString());
      fetchData();
    } catch (err: any) {
      console.error("Lỗi công bố điểm:", err);
      message.error(err?.response?.data?.error || "❌ Lỗi khi công bố điểm");
    } finally {
      setPublishing(false);
    }
  };

  const handleSave = async (examStudentId: string, subjectId: string, value: number | null) => {
    if (value === null || value === undefined) return;
    
    try {
      setUpdating(true);
      // ✅ Đúng key cho backend: examStudent
      await examGradeApi.addOrUpdate({
        exam: examId,
        examStudent: examStudentId, // Đúng key cho backend
        subject: subjectId,
        gradeValue: Number(value),
      });
      message.success("✅ Lưu điểm thành công", 2);
      fetchData();
    } catch (err: any) {
      console.error("Lỗi lưu điểm:", err);
      message.error(err?.response?.data?.error || "❌ Lỗi khi lưu điểm");
    } finally {
      setUpdating(false);
    }
  };

  /** 📚 Lấy danh sách môn học từ dữ liệu điểm */
  const examSubjects = useMemo(() => {
    const subjectSet = new Set<string>();
    grades.forEach((grade) => {
      const subjectId = grade.subject?._id || grade.subject;
      if (subjectId) subjectSet.add(String(subjectId));
    });
    
    return subjects.filter((s) => subjectSet.has(String(s._id)));
  }, [grades, subjects]);

  /** 📋 Lấy danh sách môn học được chọn để hiển thị */
  const visibleSubjects = useMemo(() => {
    return examSubjects.filter((s) => selectedSubjects.has(String(s._id)));
  }, [examSubjects, selectedSubjects]);

  /** 🎯 Xử lý chọn/bỏ chọn môn học */
  const handleSubjectToggle = (subjectId: string, checked: boolean) => {
    const newSelected = new Set(selectedSubjects);
    if (checked) {
      newSelected.add(subjectId);
    } else {
      newSelected.delete(subjectId);
    }
    setSelectedSubjects(newSelected);
  };

  /** 🎯 Chọn tất cả môn học */
  const handleSelectAll = () => {
    setSelectedSubjects(new Set(examSubjects.map((s) => String(s._id))));
  };

  /** 🎯 Bỏ chọn tất cả môn học */
  const handleDeselectAll = () => {
    setSelectedSubjects(new Set());
  };

  /** ✏️ Mở modal chỉnh sửa điểm */
  const handleEdit = useCallback((student: any) => {
    setEditingStudent(student);
    const scores: Record<string, number | null> = {};
    examSubjects.forEach((subject) => {
      const scoreData = student.scores?.[subject._id];
      scores[subject._id] = scoreData?.gradeValue ?? null;
    });
    setEditingScores(scores);
    setEditModalVisible(true);
  }, [examSubjects]);

  /** 💾 Lưu điểm từ modal */
  const handleSaveFromModal = async () => {
    if (!editingStudent) return;
    
    try {
      setUpdating(true);
      const examStudentId = editingStudent.examStudent?._id;
      if (!examStudentId) {
        message.error("Không tìm thấy thông tin học sinh");
        return;
      }
      
      const promises = examSubjects.map((subject) => {
        const value = editingScores[subject._id];
        if (value === null || value === undefined) return Promise.resolve();
        return examGradeApi.addOrUpdate({
          exam: examId,
          examStudent: examStudentId, // Đúng key cho backend
          subject: subject._id,
          gradeValue: Number(value),
        });
      });
      
      await Promise.all(promises);
      message.success("✅ Lưu điểm thành công", 2);
      setEditModalVisible(false);
      fetchData();
    } catch (err: any) {
      console.error("Lỗi lưu điểm:", err);
      message.error(err?.response?.data?.error || "❌ Lỗi khi lưu điểm");
    } finally {
      setUpdating(false);
    }
  };

  const handleImport = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("examId", examId);
    try {
      const res = await examGradeApi.importExcel(formData);
      message.success(res.message || "✅ Import điểm thành công");
      fetchData();
    } catch {
      message.error("❌ Lỗi khi import file");
    }
    return false;
  };

  const handleLock = async () => {
    try {
      await examGradeApi.lock(examId);
      message.success("🔒 Đã khóa toàn bộ điểm");
      fetchData();
    } catch {
      message.error("❌ Lỗi khi khóa điểm");
    }
  };

  /** 🔄 Transform dữ liệu: lấy học sinh từ examStudents và map với điểm từ grades */
  const groupedGrades = useMemo(() => {
    if (!Array.isArray(examStudents)) return [];
    
    // Tạo map điểm theo examStudent._id và subject._id (luôn ép kiểu string)
    const gradeMap = new Map<string, any>();
    grades.forEach((grade) => {
      const examStudentId = grade.student?._id || grade.student;
      const subjectId = grade.subject?._id || grade.subject;
      if (examStudentId && subjectId) {
        gradeMap.set(`${String(examStudentId)}_${String(subjectId)}`, grade);
      }
    });

    // Debug: print mapping keys
    console.log('[ExamGradePage] gradeMap keys:', Array.from(gradeMap.keys()));
    console.log('[ExamGradePage] examStudents IDs:', examStudents.map(s => String(s._id)));

    // Map examStudents với điểm
    return examStudents.map((examStudent) => {
      const studentInfo = examStudent.student || {};
      const classInfo = studentInfo.classId || examStudent.class || {};

      // Lấy điểm cho từng môn
      const scores: Record<string, any> = {};
      examSubjects.forEach((subject) => {
        const grade = gradeMap.get(`${String(examStudent._id)}_${String(subject._id)}`);
        if (grade) {
          scores[subject._id] = {
            gradeValue: grade.gradeValue,
            record: grade,
          };
        } else if (Array.isArray(examStudent.subjects)) {
          // Nếu chưa có điểm từ ExamGrade, lấy tạm từ examStudent.subjects[].score
          const subjObj = examStudent.subjects.find(s => String(s.subject) === String(subject._id));
          if (subjObj && typeof subjObj.score === 'number') {
            scores[subject._id] = {
              gradeValue: subjObj.score,
              record: null,
            };
          }
        }
      });

      return {
        examStudent,
        student: {
          _id: studentInfo._id,
          name: studentInfo.name || "",
          studentCode: studentInfo.studentCode || "",
          className: classInfo.className || classInfo.name || "",
          classCode: classInfo.classCode || "",
          grade: classInfo.grade || examStudent.grade || "",
          classId: classInfo._id || classInfo,
        },
        scores,
      };
    });
  }, [examStudents, grades, examSubjects]);

  /** 🔍 Lọc danh sách điểm */
  const filteredGrades = useMemo(() => {
    if (!Array.isArray(groupedGrades)) return [];
    let result = [...groupedGrades];

    // Tìm kiếm theo keyword
    if (filters.keyword.trim()) {
      const keyword = filters.keyword.toLowerCase();
      result = result.filter(
        (item) =>
          item.student?.name?.toLowerCase().includes(keyword) ||
          item.student?.studentCode?.toLowerCase().includes(keyword) ||
          item.student?.className?.toLowerCase().includes(keyword)
      );
    }

    // Lọc theo lớp
    if (filters.class !== "Tất cả") {
      result = result.filter((item) => {
        const classId = item.student?.classId?._id || item.student?.classId;
        return String(classId) === String(filters.class);
      });
    }

    return result;
  }, [groupedGrades, filters]);

  /** 🎨 Lấy màu nền cho điểm số */
  const getScoreColor = (score: number | null | undefined): string => {
    if (score === null || score === undefined) return "";
    if (score >= 8.0) return "#d4edda"; // Xanh lá (green)
    if (score >= 6.5) return "#d1ecf1"; // Xanh dương (blue)
    return "#f8d7da"; // Đỏ (red) cho điểm thấp
  };

  /** 📊 Tạo cột cho bảng */
  const columns = useMemo(() => {
    const canEdit = hasAnyPermission([PERMISSIONS.EXAM_GRADE_ENTER, PERMISSIONS.EXAM_UPDATE]);
    
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

    // Thêm cột cho từng môn học được chọn
    visibleSubjects.forEach((subject) => {
      cols.push({
        title: subject.name,
        align: "center" as const,
        width: 100,
        render: (_: any, record: any) => {
          const scoreData = record.scores[subject._id];
          const score = scoreData?.gradeValue ?? null;
          const bgColor = getScoreColor(score);
          const teacher = scoreData?.record?.teacher;
          
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
              <div
                style={{
                  background: bgColor,
                  padding: "8px",
                  borderRadius: "4px",
                  minWidth: "60px",
                  display: "inline-block",
                }}
              >
                {score !== null && score !== undefined ? score.toFixed(1) : "-"}
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

    // Thêm cột Thao Tác
    cols.push({
      title: "Thao Tác",
      align: "center" as const,
      width: 100,
      fixed: "right" as const,
      render: (_: any, record: any) => {
        if (!canEdit) return null;
        return (
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => {
              console.log('[ExamGradePage] Edit student record:', record);
              handleEdit(record);
            }}
          />
        );
      },
    });

    return cols;
  }, [visibleSubjects, hasAnyPermission, PERMISSIONS, handleEdit]);

  return (
    <Card
      title="📊 Quản lý điểm thi"
      extra={
        <Space wrap>
          <Button icon={<ReloadOutlined />} onClick={fetchData}>
            Làm mới
          </Button>
          {canPublishGrades && (
            <Popconfirm
              title={isPublished ? "Đồng bộ lại điểm?" : "Công bố điểm kỳ thi?"}
              description="Điểm sẽ được đồng bộ vào bảng điểm chính của học sinh."
              onConfirm={handlePublishGrades}
              okButtonProps={{ loading: publishing }}
            >
              <Button
                type="primary"
                ghost={isPublished}
                icon={<SendOutlined />}
                loading={publishing}
              >
                {isPublished ? "Đồng bộ lại điểm" : "Công bố điểm"}
              </Button>
            </Popconfirm>
          )}
          {hasAnyPermission([PERMISSIONS.EXAM_GRADE_ENTER, PERMISSIONS.EXAM_UPDATE]) && (
            <Upload beforeUpload={handleImport} showUploadList={false}>
              <Button icon={<UploadOutlined />} style={{ background: "#2ecc71", color: "#fff" }}>
                Import Excel
              </Button>
            </Upload>
          )}
          <Button
            icon={<FileExcelOutlined />}
            onClick={async () => {
              const blob = await examGradeApi.exportExcel(examId);
              const url = URL.createObjectURL(new Blob([blob]));
              const a = document.createElement("a");
              a.href = url;
              a.download = `DiemThi_${examId}.xlsx`;
              a.click();
            }}
          >
            Xuất Excel
          </Button>
          {hasPermission(PERMISSIONS.EXAM_UPDATE) && (
            <Popconfirm title="Khóa toàn bộ điểm?" onConfirm={handleLock}>
              <Button icon={<LockOutlined />} danger>
                Khóa điểm
              </Button>
            </Popconfirm>
          )}
        </Space>
      }
    >
      <Card
        style={{
          marginBottom: 16,
          background: isPublished ? "#f6ffed" : "#fff1f0",
          borderColor: isPublished ? "#b7eb8f" : "#ffa39e",
        }}
      >
        <Space direction="vertical" size={4}>
          <Text strong>
            {isPublished ? "Đã công bố điểm thi" : "Chưa công bố điểm thi"}
          </Text>
          <Text type="secondary">
            {isPublished
              ? `Điểm đã được đồng bộ tới bảng điểm học sinh${
                  publishedAt ? ` (lần cuối: ${new Date(publishedAt).toLocaleString("vi-VN")})` : ""
                }.`
              : "Điểm chỉ hiển thị với giáo viên cho tới khi Trưởng bộ môn hoặc BGH công bố."}
          </Text>
        </Space>
      </Card>

      {/* 🔍 Tìm Kiếm & Lọc */}
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
              {classes.map((c) => (
                <Option key={c._id} value={c._id}>
                  {c.className}
                </Option>
              ))}
            </Select>
          </Col>
        </Row>
      </Card>

      {/* 📊 Bảng Điểm Thi */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <Text strong style={{ fontSize: 18 }}>Bảng Điểm Thi</Text>
            <div>
              <Text type="secondary">Hiển thị {filteredGrades.length} học sinh</Text>
            </div>
          </div>
          <Space>
            <Popover
              title="Chọn môn học hiển thị"
              content={
                <div style={{ maxHeight: 400, overflowY: "auto", minWidth: 200 }}>
                  <div style={{ marginBottom: 8, borderBottom: "1px solid #f0f0f0", paddingBottom: 8 }}>
                    <Space>
                      <Button size="small" type="link" onClick={handleSelectAll}>
                        Chọn tất cả
                      </Button>
                      <Button size="small" type="link" onClick={handleDeselectAll}>
                        Bỏ chọn tất cả
                      </Button>
                    </Space>
                  </div>
                  <Checkbox.Group
                    value={Array.from(selectedSubjects)}
                    onChange={(checkedValues) => {
                      const newSelected = new Set<string>();
                      checkedValues.forEach((v) => newSelected.add(String(v)));
                      setSelectedSubjects(newSelected);
                    }}
                    style={{ display: "flex", flexDirection: "column", gap: 8 }}
                  >
                    {examSubjects.map((subject) => (
                      <Checkbox key={subject._id} value={String(subject._id)}>
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
                Chọn Môn ({visibleSubjects.length}/{examSubjects.length})
              </Button>
            </Popover>
            <Button
              icon={<FileExcelOutlined />}
              onClick={async () => {
                try {
                  const blob = await examGradeApi.exportExcel(examId);
                  const url = URL.createObjectURL(new Blob([blob]));
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `DiemThi_${examId}.xlsx`;
                  a.click();
                } catch (err) {
                  message.error("❌ Lỗi khi xuất Excel");
                }
              }}
            >
              Xuất Excel
            </Button>
          </Space>
        </div>

        <Spin spinning={loading || updating}>
          <Table
            dataSource={filteredGrades}
            columns={columns}
            rowKey={(r) => {
              const studentId = r.student?._id || r.student || '';
              return `student_${studentId}`;
            }}
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              showTotal: (total) => `Tổng ${total} học sinh`,
            }}
            bordered
            scroll={{ x: "max-content" }}
          />
        </Spin>
      </Card>

      {/* ✏️ Modal chỉnh sửa điểm */}
      <Modal
        title={`Chỉnh sửa điểm - ${editingStudent?.student?.name || ""}`}
        open={editModalVisible}
        onOk={handleSaveFromModal}
        onCancel={() => setEditModalVisible(false)}
        okText="Lưu"
        cancelText="Hủy"
        width={600}
        confirmLoading={updating}
      >
        {editingStudent && (
          <div style={{ marginTop: 16 }}>
            <div style={{ marginBottom: 16 }}>
              <Text strong>MSHS: </Text>
              <Text>{editingStudent.student?.studentCode}</Text>
              <br />
              <Text strong>Lớp: </Text>
              <Text>{editingStudent.student?.className}</Text>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
              {examSubjects.map((subject) => (
                <div key={subject._id}>
                  <Text strong style={{ display: "block", marginBottom: 8 }}>
                    {subject.name}
                  </Text>
                  <InputNumber
                    min={0}
                    max={10}
                    step={0.1}
                    precision={1}
                    value={editingScores[subject._id] ?? undefined}
                    onChange={(value) =>
                      setEditingScores((prev) => ({ ...prev, [subject._id]: value ?? null }))
                    }
                    style={{ width: "100%" }}
                    placeholder="Nhập điểm"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </Card>
  );
}
