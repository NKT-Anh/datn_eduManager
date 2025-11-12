import React, { useEffect, useState, useMemo } from "react";
import {
  Table,
  Button,
  Modal,
  Form,
  DatePicker,
  Select,
  Space,
  Tag,
  message,
  Typography,
  Popconfirm,
  Card,
  TimePicker,
  Input,
} from "antd";
import dayjs from "dayjs";
import {
  Plus,
  Pencil,
  Trash2,
  RefreshCcw,
  Zap,
  CalendarDays,
} from "lucide-react";
import { examScheduleApi } from "@/services/exams/examScheduleApi";
import { subjectApi } from "@/services/subjectApi";

interface ExamSchedulePageProps {
  examId: string;
}

const { Title } = Typography;
const { Option } = Select;

export default function ExamSchedulePage({ examId }: ExamSchedulePageProps) {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [form] = Form.useForm();
  const [editing, setEditing] = useState<any>(null);
  const [selectedGrade, setSelectedGrade] = useState<number>(10);

  /* =========================================================
     🧠 Lấy danh sách lịch thi
  ========================================================= */
  const fetchSchedules = async () => {
    try {
      setLoading(true);
      const res = await examScheduleApi.getByExam(examId);
      setSchedules(res);
    } catch {
      message.error("Không thể tải danh sách lịch thi.");
    } finally {
      setLoading(false);
    }
  };

  /* =========================================================
     📚 Lấy danh sách môn học
  ========================================================= */
const fetchSubjects = async () => {
  try {
    const list = await subjectApi.getSubjects();
    setSubjects(list);
  } catch (err) {
    console.error("❌ Lỗi tải môn học:", err);
    message.error("Không thể tải danh sách môn học.");
  }
};


  useEffect(() => {
    if (examId) fetchSchedules();
    fetchSubjects();
  }, [examId]);

  /* =========================================================
     🧩 Mở Modal thêm/sửa
  ========================================================= */
  const openModal = (record?: any) => {
    if (record) {
      setEditing(record);
      form.setFieldsValue({
        ...record,
        date: record.date ? dayjs(record.date) : null,
        startTime: record.startTime
          ? dayjs(record.startTime, "HH:mm")
          : undefined,
      });
    } else {
      setEditing(null);
      form.resetFields();
    }
    setModalOpen(true);
  };

  /* =========================================================
     💾 Lưu lịch thi (thêm/sửa)
  ========================================================= */
  const handleSubmit = async (values: any) => {
    try {
      const payload = {
        ...values,
        exam: examId,
        date: values.date.toISOString(),
        startTime: values.startTime
          ? dayjs(values.startTime).format("HH:mm")
          : "",
      };

      if (editing) {
        await examScheduleApi.update(editing._id, payload);
        message.success("✅ Cập nhật lịch thi thành công!");
      } else {
        await examScheduleApi.create(payload);
        message.success("✅ Tạo lịch thi mới thành công!");
      }

      setModalOpen(false);
      fetchSchedules();
    } catch (err: any) {
      console.error("❌ Lỗi lưu lịch thi:", err);
      message.error(err.response?.data?.error || "Lưu thất bại.");
    }
  };

  /* =========================================================
     ⚡ Tự động tạo lịch
  ========================================================= */
  const handleAutoGenerate = async () => {
    try {
      message.loading({ content: "Đang tạo lịch thi tự động...", key: "auto" });
      const res = await examScheduleApi.autoGenerate(examId!, selectedGrade);
      message.success({
        content: `✅ Tạo ${res.total} lịch thi thành công!`,
        key: "auto",
      });
      fetchSchedules();
    } catch (err: any) {
      message.error(err.response?.data?.error || "Lỗi khi tạo lịch tự động.");
    }
  };

  /* =========================================================
     🗑️ Xóa lịch thi
  ========================================================= */
  const handleDelete = async (id: string) => {
    try {
      await examScheduleApi.remove(id);
      message.success("🗑️ Đã xóa lịch thi.");
      fetchSchedules();
    } catch {
      message.error("Xóa thất bại.");
    }
  };

  /* =========================================================
     🔍 Lọc môn học khả dụng (không trùng)
  ========================================================= */
  const availableSubjects = useMemo(() => {
    const grade = form.getFieldValue("grade");
    if (!grade) return subjects;
    return subjects.filter((sub) => {
      const exists = schedules.some(
        (s) => s.grade === grade && s.subject?._id === sub._id
      );
      return !exists;
    });
  }, [subjects, schedules, form]);

  /* =========================================================
     📋 Cột bảng
  ========================================================= */
  const columns = [
    {
      title: "Khối",
      dataIndex: "grade",
      align: "center" as const,
      render: (v: number) => <Tag color="blue">Khối {v}</Tag>,
    },
    {
      title: "Môn học",
      dataIndex: ["subject", "name"],
      align: "center" as const,
    },
    {
      title: "Ngày thi",
      dataIndex: "date",
      align: "center" as const,
      render: (v: string) => (
        <Space>
          <CalendarDays size={16} />
          {dayjs(v).format("DD/MM/YYYY")}
        </Space>
      ),
    },
    {
      title: "Giờ bắt đầu",
      dataIndex: "startTime",
      align: "center" as const,
    },
    {
      title: "Giờ kết thúc",
      dataIndex: "endTime",
      align: "center" as const,
      render: (v: string) => v || "-",
    },
    {
      title: "Thời lượng (phút)",
      dataIndex: "duration",
      align: "center" as const,
    },
    {
      title: "Loại",
      dataIndex: "examType",
      align: "center" as const,
      render: (v: string) =>
        v === "final" ? (
          <Tag color="red">Cuối kỳ</Tag>
        ) : (
          <Tag color="green">Giữa kỳ</Tag>
        ),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      align: "center" as const,
      render: (v: string) => {
        const map: Record<string, { color: string; label: string }> = {
          draft: { color: "default", label: "Khởi tạo" },
          confirmed: { color: "blue", label: "Đã xác nhận" },
          completed: { color: "green", label: "Hoàn tất" },
        };
        const info = map[v] || { color: "gray", label: "Không xác định" };
        return <Tag color={info.color}>{info.label}</Tag>;
      },
    },
    {
      title: "Hành động",
      align: "center" as const,
      render: (_: any, record: any) => (
        <Space>
          <Button
            icon={<Pencil size={16} />}
            onClick={() => openModal(record)}
            size="small"
          />
          <Popconfirm
            title="Xóa lịch thi này?"
            onConfirm={() => handleDelete(record._id)}
          >
            <Button danger size="small" icon={<Trash2 size={16} />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  /* =========================================================
     🧱 Render giao diện
  ========================================================= */
  return (
    <Card
      style={{
        borderRadius: 16,
        boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
        padding: 24,
      }}
    >
      {/* 🎛 Header */}
      <Space
        style={{ width: "100%", justifyContent: "space-between" }}
        align="center"
      >
        <Title level={3} style={{ margin: 0 }}>
          Quản lý lịch thi
        </Title>

        <Space>
          <Select
            value={selectedGrade}
            onChange={(v) => setSelectedGrade(v)}
            style={{ width: 120 }}
          >
            <Option value={10}>Khối 10</Option>
            <Option value={11}>Khối 11</Option>
            <Option value={12}>Khối 12</Option>
          </Select>

          <Button
            icon={<Zap size={16} />}
            onClick={handleAutoGenerate}
            type="primary"
          >
            Tạo tự động
          </Button>

          <Button icon={<Plus size={16} />} onClick={() => openModal()}>
            Thêm mới
          </Button>

          <Button icon={<RefreshCcw size={16} />} onClick={fetchSchedules}>
            Làm mới
          </Button>
        </Space>
      </Space>

      {/* 📋 Danh sách */}
      <Table
        style={{ marginTop: 16 }}
        dataSource={schedules}
        columns={columns}
        rowKey={(r) => r._id}
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      {/* 🧱 Modal thêm/sửa */}
      <Modal
        title={editing ? "Cập nhật lịch thi" : "Thêm lịch thi mới"}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        okText="Lưu"
        destroyOnHidden
      >
        <Form
          layout="vertical"
          form={form}
          onFinish={handleSubmit}
          onValuesChange={(changed) => {
            // Nếu đổi khối thì reset môn
            if ("grade" in changed) form.setFieldValue("subject", undefined);
          }}
        >
          <Form.Item
            name="grade"
            label="Khối"
            rules={[{ required: true, message: "Chọn khối" }]}
          >
            <Select placeholder="Chọn khối">
              <Option value={10}>Khối 10</Option>
              <Option value={11}>Khối 11</Option>
              <Option value={12}>Khối 12</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="subject"
            label="Môn học"
            rules={[{ required: true, message: "Chọn môn học" }]}
          >
            <Select placeholder="Chọn môn học">
              {availableSubjects.map((s) => (
                <Option key={s._id} value={s._id}>
                  {s.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="date"
            label="Ngày thi"
            rules={[{ required: true, message: "Chọn ngày thi" }]}
          >
            <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
          </Form.Item>

          <Form.Item
            name="startTime"
            label="Giờ bắt đầu"
            rules={[{ required: true, message: "Chọn giờ bắt đầu" }]}
          >
            <TimePicker
              format="HH:mm"
              style={{ width: "100%" }}
              placeholder="Chọn giờ"
            />
          </Form.Item>

          <Form.Item
            name="duration"
            label="Thời lượng (phút)"
            initialValue={90}
            rules={[{ required: true, message: "Nhập thời lượng" }]}
          >
            <Input type="number" />
          </Form.Item>

          <Form.Item
            name="examType"
            label="Loại bài thi"
            initialValue="midterm"
          >
            <Select>
              <Option value="midterm">Giữa kỳ</Option>
              <Option value="final">Cuối kỳ</Option>
            </Select>
          </Form.Item>

          <Form.Item name="notes" label="Ghi chú">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
