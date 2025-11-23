import React, { useEffect, useState, useMemo } from "react";
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
} from "antd";
import {
  SaveOutlined,
  UploadOutlined,
  FileExcelOutlined,
  LockOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { examGradeApi } from "@/services/exams/examGradeApi";
// ✅ Sử dụng hooks thay vì API trực tiếp
import { useSubjects } from "@/hooks";
import { usePermissions } from "@/hooks/usePermissions";

const { Option } = Select;
const { Text } = Typography;

interface ExamGradePageProps {
  examId: string;
  exam?: any;
}

export default function ExamGradePage({ examId, exam }: ExamGradePageProps) {
  const { hasPermission, hasAnyPermission, PERMISSIONS } = usePermissions();
  const [grades, setGrades] = useState<any[]>([]);
  // ✅ Sử dụng hooks
  const { subjects } = useSubjects();
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);

  // 🔍 Filters
  const [filters, setFilters] = useState({
    subject: "Tất cả",
    grade: "Tất cả",
    keyword: "",
  });

  const fetchGrades = async () => {
    try {
      setLoading(true);
      const res = await examGradeApi.getByExam(examId);
      // ✅ Đảm bảo res là array
      const gradesData = Array.isArray(res) ? res : (res?.data || []);
      setGrades(gradesData);
    } catch (err) {
      console.error("Lỗi tải điểm:", err);
      message.error("Không thể tải danh sách điểm");
      setGrades([]); // Set empty array nếu lỗi
    } finally {
      setLoading(false);
    }
  };

  // ✅ Không cần fetchSubjects nữa vì đã dùng hooks

  useEffect(() => {
    if (examId) {
      fetchGrades();
    }
  }, [examId]);

  const handleSave = async (record: any, value: number | null) => {
    if (value === null || value === undefined) return;
    
    try {
      setUpdating(true);
      await examGradeApi.addOrUpdate({
        exam: examId,
        student: record.student._id,
        subject: record.subject._id,
        gradeValue: Number(value),
      });
      message.success("✅ Lưu điểm thành công", 2);
      fetchGrades();
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
      fetchGrades();
    } catch {
      message.error("❌ Lỗi khi import file");
    }
    return false;
  };

  const handleLock = async () => {
    try {
      await examGradeApi.lock(examId);
      message.success("🔒 Đã khóa toàn bộ điểm");
      fetchGrades();
    } catch {
      message.error("❌ Lỗi khi khóa điểm");
    }
  };

  /** 🔍 Lọc danh sách điểm */
  const filteredGrades = useMemo(() => {
    if (!Array.isArray(grades)) return [];
    let result = [...grades];

    // Lọc theo môn học
    if (filters.subject !== "Tất cả") {
      result = result.filter(
        (r) => r.subject?._id === filters.subject || r.subject === filters.subject
      );
    }

    // Lọc theo khối (thông qua student)
    if (filters.grade !== "Tất cả") {
      const gradeStr = String(filters.grade);
      result = result.filter((r) => {
        // Có thể lọc qua examStudent hoặc student grade
        return String(r.student?.grade) === gradeStr || String(r.examStudent?.grade) === gradeStr;
      });
    }

    // Tìm kiếm theo keyword
    if (filters.keyword.trim()) {
      const keyword = filters.keyword.toLowerCase();
      result = result.filter(
        (r) =>
          r.student?.name?.toLowerCase().includes(keyword) ||
          r.student?.studentCode?.toLowerCase().includes(keyword) ||
          r.student?.className?.toLowerCase().includes(keyword) ||
          r.subject?.name?.toLowerCase().includes(keyword)
      );
    }

    return result;
  }, [grades, filters]);

  const columns = [
    {
      title: "STT",
      render: (_: any, __: any, i: number) => i + 1,
      align: "center" as const,
      width: 70,
    },
    {
      title: "Họ tên",
      dataIndex: ["student", "name"],
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: "Lớp",
      dataIndex: ["student", "className"],
      align: "center" as const,
    },
    {
      title: "Môn học",
      dataIndex: ["subject", "name"],
      align: "center" as const,
    },
    {
      title: "Điểm",
      dataIndex: "gradeValue",
      align: "center" as const,
      render: (v: number, record: any) => {
        const canEdit = hasAnyPermission([PERMISSIONS.EXAM_GRADE_ENTER, PERMISSIONS.EXAM_UPDATE]);
        return (
          <InputNumber
            min={0}
            max={10}
            step={0.1}
            precision={1}
            defaultValue={v || undefined}
            disabled={!canEdit}
            onBlur={(e) => {
              if (!canEdit) return;
              const value = e.target.value;
              if (value && !isNaN(Number(value))) {
                handleSave(record, Number(value));
              }
            }}
            onPressEnter={(e) => {
              if (!canEdit) return;
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

  return (
    <Card
      title="📊 Quản lý điểm thi"
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchGrades}>
            Làm mới
          </Button>
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
      {/* 🔍 Bộ lọc và tìm kiếm */}
      <Card style={{ marginBottom: 16, background: "#fafafa" }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={8} md={6}>
            <Select
              value={filters.subject}
              onChange={(v) => setFilters((f) => ({ ...f, subject: v }))}
              style={{ width: "100%" }}
              placeholder="Lọc theo môn học"
            >
              <Option value="Tất cả">Tất cả môn học</Option>
              {subjects.map((s) => (
                <Option key={s._id} value={s._id}>
                  {s.name}
                </Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={8} md={6}>
            <Select
              value={filters.grade}
              onChange={(v) => setFilters((f) => ({ ...f, grade: v }))}
              style={{ width: "100%" }}
              placeholder="Lọc theo khối"
            >
              <Option value="Tất cả">Tất cả khối</Option>
              {exam?.grades?.map((g: string | number) => (
                <Option key={String(g)} value={String(g)}>
                  Khối {g}
                </Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={8} md={12}>
            <Input
              placeholder="Tìm theo tên HS, mã HS, lớp, môn học..."
              prefix={<SearchOutlined />}
              value={filters.keyword}
              onChange={(e) => setFilters((f) => ({ ...f, keyword: e.target.value }))}
              allowClear
            />
          </Col>
        </Row>
      </Card>

      <Spin spinning={loading || updating}>
        <Table
          dataSource={filteredGrades}
          columns={columns}
          rowKey={(r) => r._id}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total) => `Tổng ${total} điểm` }}
          bordered
        />
      </Spin>
    </Card>
  );
}
