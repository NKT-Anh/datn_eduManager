import React, { useEffect, useState } from "react";
import {
  Table,
  Button,
  Space,
  message,
  Modal,
  Select,
  Spin,
  Popconfirm,
  Tag,
  Typography,
  Form,
} from "antd";
import {
  ReloadOutlined,
  PlusOutlined,
  DeleteOutlined,
  FileExcelOutlined,
} from "@ant-design/icons";
import { examStudentApi } from "@/services/exams/examStudentApi";
import schoolConfigApi from "@/services/schoolConfigApi";

const { Title, Text } = Typography;
const { Option } = Select;

interface ExamStudentPageProps {
  examId: string;
  exam: any;
}

export default function ExamStudentPage({ examId, exam }: ExamStudentPageProps) {
  const [data, setData] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Modal thêm học sinh
  const [openCreate, setOpenCreate] = useState(false);
  const [createForm] = Form.useForm();

  /** 📋 Lấy danh sách học sinh dự thi */
  const fetchExamStudents = async () => {
    try {
      setLoading(true);
      const res = await examStudentApi.getByExam(examId);
      setData(res.data || res);
    } catch (err) {
      console.error(err);
      message.error("❌ Không thể tải danh sách học sinh dự thi");
    } finally {
      setLoading(false);
    }
  };

  /** 🏫 Lấy danh sách khối học */
  const fetchGrades = async () => {
    try {
      const res = await schoolConfigApi.getGrades();
      setGrades(res.data || res);
    } catch (err) {
      console.error(err);
      message.error("❌ Không thể tải danh sách khối học");
    }
  };

  useEffect(() => {
    if (examId) {
      fetchExamStudents();
      fetchGrades();
    }
  }, [examId]);

  /** ➕ Thêm học sinh của 1 khối vào kỳ thi */
  const handleAddByGrade = async (values: any) => {
    try {
      const payload = {
        examId,
        grade: values.grade,
      };

      await examStudentApi.addOrAssign(payload);

      message.success(`✅ Đã thêm toàn bộ học sinh khối ${values.grade} vào kỳ thi!`);
      setOpenCreate(false);
      createForm.resetFields();
      fetchExamStudents();
    } catch (err: any) {
      console.error(err);
      message.error(err?.response?.data?.error || "❌ Lỗi khi thêm học sinh");
    }
  };

  /** 🗑️ Xóa 1 học sinh khỏi danh sách */
  const handleDelete = async (id: string) => {
    try {
      await examStudentApi.remove(id);
      message.success("🗑️ Đã xóa học sinh khỏi kỳ thi");
      fetchExamStudents();
    } catch (err: any) {
      message.error(err?.response?.data?.error || "❌ Lỗi khi xóa");
    }
  };

  /** 📦 Xuất danh sách */
  const handleExport = () => {
    message.info("📄 Tính năng xuất Excel đang được phát triển...");
  };

  /** 📘 Cột bảng */
  const columns = [
    {
      title: "Mã HS",
      render: (r: any) => r.student?.studentCode || "-",
      align: "center" as const,
    },
    {
      title: "Họ tên",
      render: (r: any) => r.student?.name || "-",
      align: "center" as const,
    },
    {
      title: "Lớp",
      render: (r: any) => r.student?.className || "-",
      align: "center" as const,
    },
    {
      title: "Khối",
      dataIndex: "grade",
      align: "center" as const,
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      align: "center" as const,
      render: (v: string) => (
        <Tag color={v === "absent" ? "red" : v === "excluded" ? "orange" : "green"}>
          {v === "present"
            ? "Có mặt"
            : v === "absent"
            ? "Vắng"
            : v === "excluded"
            ? "Đình chỉ"
            : "Đăng ký"}
        </Tag>
      ),
    },
    {
      title: "Thao tác",
      align: "center" as const,
      render: (r: any) => (
        <Popconfirm
          title="Xóa học sinh này khỏi kỳ thi?"
          onConfirm={() => handleDelete(r._id)}
        >
          <Button danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  return (
    <div
      style={{
        borderRadius: 16,
        boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
        padding: 20,
        background: "#fff",
      }}
    >
      {/* Header */}
      <Space
        direction="vertical"
        style={{ width: "100%", marginBottom: 16 }}
        size="large"
      >
        <Space style={{ width: "100%", justifyContent: "space-between" }}>
          <div>
            <Title level={3}>Danh sách học sinh dự thi</Title>
            <Text type="secondary">
              {exam?.name} • Năm {exam?.year} • HK{exam?.semester}
            </Text>
          </div>

          <Space>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setOpenCreate(true)}
            >
              Thêm học sinh theo khối
            </Button>
            <Button icon={<FileExcelOutlined />} onClick={handleExport}>
              Xuất Excel
            </Button>
            <Button icon={<ReloadOutlined />} onClick={fetchExamStudents}>
              Làm mới
            </Button>
          </Space>
        </Space>
      </Space>

      <Spin spinning={loading}>
        <Table
          dataSource={data}
          columns={columns}
          rowKey={(r) => r._id}
          pagination={{ pageSize: 10 }}
          bordered
        />
      </Spin>

      {/* Modal thêm học sinh theo khối */}
      <Modal
        open={openCreate}
        title="Thêm học sinh theo khối học"
        onCancel={() => setOpenCreate(false)}
        onOk={() => createForm.submit()}
        okText="Thêm"
      >
        <Form form={createForm} layout="vertical" onFinish={handleAddByGrade}>
          <Form.Item
            name="grade"
            label="Chọn khối học"
            rules={[{ required: true, message: "Vui lòng chọn khối học" }]}
          >
            <Select placeholder="Chọn khối...">
              {grades.map((g) => (
                <Option key={g.code} value={Number(g.code)}>
                  {g.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
