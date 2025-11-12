import React, { useEffect, useState } from "react";
import {
  Table,
  Button,
  Space,
  message,
  Modal,
  Tag,
  Typography,
  Select,
  Spin,
  Popconfirm,
  Form,
  Input,
  InputNumber,
  Card,
} from "antd";
import {
  ReloadOutlined,
  FilePdfOutlined,
  TeamOutlined,
  UserSwitchOutlined,
  ThunderboltOutlined,
  BarChartOutlined,
} from "@ant-design/icons";
import { examRoomApi } from "@/services/exams/examRoomApi";
import { teacherApi } from "@/services/teacherApi";
import { examScheduleApi } from "@/services/exams/examScheduleApi";

const { Title, Text } = Typography;
const { Option } = Select;

interface ExamRoomPageProps {
  examId: string;
  exam: any;
}

export default function ExamRoomPage({ examId, exam }: ExamRoomPageProps) {
  const [rooms, setRooms] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [stats, setStats] = useState<any | null>(null);

  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);

  // create modal
  const [openCreate, setOpenCreate] = useState(false);
  const [createForm] = Form.useForm();

  // assign modal
  const [selectedRoom, setSelectedRoom] = useState<any | null>(null);
  const [selectedInvigilators, setSelectedInvigilators] = useState<string[]>([]);

  /** 🧾 Lấy danh sách phòng thi */
  const fetchRooms = async () => {
    try {
      setLoading(true);
      const res = await examRoomApi.getByExam(examId);
      setRooms(res);
    } catch (err) {
      console.error(err);
      message.error("❌ Không thể tải danh sách phòng thi");
    } finally {
      setLoading(false);
    }
  };

  /** 👩‍🏫 Lấy danh sách giáo viên */
  const fetchTeachers = async () => {
    try {
      const res = await teacherApi.getAll();
      setTeachers(res);
    } catch (err) {
      console.error(err);
      message.error("❌ Lỗi khi tải danh sách giáo viên");
    }
  };

  /** 🗓️ Lấy schedules của kỳ thi */
  const fetchSchedules = async () => {
    try {
      const res = await examScheduleApi.getByExam(examId);
      setSchedules(res);
    } catch (err) {
      console.warn("Không lấy được schedules:", err);
    }
  };

  /** 📊 Lấy thống kê phòng thi */
  const fetchStats = async () => {
    try {
      const res = await examRoomApi.getStats(examId);
      setStats(res);
    } catch (err) {
      console.error("Lỗi lấy thống kê:", err);
    }
  };

  useEffect(() => {
    if (examId) {
      fetchRooms();
      fetchTeachers();
      fetchSchedules();
      fetchStats();
    }
  }, [examId]);

  /** ➕ Tạo phòng thủ công */
  const handleCreate = async (values: any) => {
    try {
      const payload: any = {
        exam: examId,
        roomCode: values.roomCode,
        capacity: values.capacity,
        type: values.type,
        grade: values.grade || (exam?.grades?.[0] ?? undefined),
        schedule: values.schedule || undefined,
        note: values.note || undefined,
      };
      await examRoomApi.create(payload);
      message.success("✅ Đã thêm phòng thi");
      setOpenCreate(false);
      createForm.resetFields();
      fetchRooms();
    } catch (err: any) {
      console.error(err);
      message.error(err?.response?.data?.error || err?.message || "❌ Lỗi tạo phòng");
    }
  };

  /** ⚙️ Gán giám thị cho phòng (thủ công) */
  const handleAssignInvigilators = async () => {
    if (!selectedRoom || !selectedInvigilators.length)
      return message.warning("Vui lòng chọn ít nhất 1 giám thị.");

    const invigilatorsPayload = selectedInvigilators.map((tId, idx) => ({
      teacherId: tId,
      role: idx === 0 ? "main" : "assistant",
    }));

    try {
      setAssigning(true);
      await examRoomApi.assignInvigilators(selectedRoom._id, invigilatorsPayload);
      message.success("✅ Gán giám thị thành công!");
      setSelectedRoom(null);
      setSelectedInvigilators([]);
      fetchRooms();
    } catch (err) {
      console.error(err);
      message.error("❌ Gán giám thị thất bại.");
    } finally {
      setAssigning(false);
    }
  };

  /** ⚡ Tự động chia học sinh */
  const handleAutoDistribute = async () => {
    Modal.confirm({
      title: "Tự động chia phòng thi?",
      content: "Hệ thống sẽ tự động xếp học sinh vào phòng thi theo tên.",
      okText: "Xác nhận",
      cancelText: "Hủy",
      onOk: async () => {
        try {
          setLoading(true);
          const scheduleId = rooms[0]?.schedule?._id || schedules[0]?._id;
          const grade = exam?.grades?.[0] || 12;
          const res = await examRoomApi.autoDistribute({ examId, scheduleId, grade });
          message.success(res.message || "✅ Đã chia phòng thi thành công!");
          fetchRooms();
        } catch (err: any) {
          console.error(err);
          message.error(err?.response?.data?.error || "❌ Lỗi khi chia phòng thi");
        } finally {
          setLoading(false);
        }
      },
    });
  };

  /** ⚙️ Tạo phòng thi tự động */
  const handleAutoGenerate = async () => {
    Modal.confirm({
      title: "Tự động tạo phòng thi?",
      content: "Hệ thống sẽ tạo phòng thi dựa trên danh sách phòng học có sẵn.",
      onOk: async () => {
        try {
          setLoading(true);
          await examRoomApi.autoGenerateRooms({ examId });
          message.success("✅ Đã tạo phòng thi tự động thành công!");
          fetchRooms();
        } catch (err: any) {
          console.error(err);
          message.error(err?.response?.data?.error || err?.message || "❌ Lỗi khi tạo phòng thi");
        } finally {
          setLoading(false);
        }
      },
    });
  };

  /** 🤖 Tự động gán giám thị */
  const handleAutoAssignInvigilators = async () => {
    const scheduleId = rooms[0]?.schedule?._id || schedules[0]?._id;
    if (!scheduleId) return message.warning("Không có lịch thi để gán giám thị.");
    Modal.confirm({
      title: "Tự động gán giám thị?",
      content: "Hệ thống sẽ tự động chọn giám thị phù hợp cho từng phòng thi.",
      okText: "Xác nhận",
      cancelText: "Hủy",
      onOk: async () => {
        try {
          setLoading(true);
          const res = await examRoomApi.autoAssignInvigilators({ examId, scheduleId });
          message.success(res.message || "✅ Đã gán giám thị tự động thành công!");
          fetchRooms();
        } catch (err: any) {
          console.error(err);
          message.error(err?.response?.data?.error || "❌ Lỗi khi gán giám thị tự động");
        } finally {
          setLoading(false);
        }
      },
    });
  };

  /** 🧱 Cấu hình bảng hiển thị */
  const columns = [
    {
      title: "Mã phòng",
      dataIndex: "roomCode",
      align: "center" as const,
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: "Loại phòng",
      dataIndex: "type",
      align: "center" as const,
      render: (v: string) =>
        v === "lab" ? (
          <Tag color="orange">Phòng Lab</Tag>
        ) : v === "computer" ? (
          <Tag color="cyan">Phòng Máy</Tag>
        ) : (
          <Tag color="green">Thường</Tag>
        ),
    },
    { title: "Khối", dataIndex: "grade", align: "center" as const },
    { title: "Sức chứa", dataIndex: "capacity", align: "center" as const },
    { title: "Số học sinh", align: "center" as const, render: (r: any) => r.students?.length || 0 },
    { title: "Giám thị", align: "center" as const, render: (r: any) => r.invigilators?.length || 0 },
    {
      title: "Thao tác",
      align: "center" as const,
      render: (_: any, record: any) => (
        <Space>
          <Button
            icon={<TeamOutlined />}
            onClick={() => {
              setSelectedRoom(record);
              setSelectedInvigilators(
                (record.invigilators || []).map((i: any) => i.teacher?._id || i.teacherId)
              );
            }}
          >
            Gán giám thị
          </Button>
          <Button icon={<FilePdfOutlined />} onClick={() => examRoomApi.exportPdf(record._id)}>
            PDF
          </Button>
          <Popconfirm
            title="Xóa phòng thi này?"
            onConfirm={async () => {
              try {
                await examRoomApi.remove(record._id);
                message.success("🗑️ Đã xóa phòng thi");
                fetchRooms();
              } catch (err: any) {
                console.error(err);
                message.error(err?.response?.data?.error || "❌ Lỗi xóa phòng");
              }
            }}
          >
            <Button danger>Xóa</Button>
          </Popconfirm>
        </Space>
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
      <Space direction="vertical" style={{ width: "100%", marginBottom: 16 }} size="large">
        <Space style={{ width: "100%", justifyContent: "space-between" }} align="center">
          <div>
            <Title level={3} style={{ margin: 0 }}>
              Danh sách phòng thi
            </Title>
            <Text type="secondary">
              {exam?.name} • Năm học {exam?.year} • HK{exam?.semester}
            </Text>
          </div>

          <Space wrap>
            <Button icon={<ThunderboltOutlined />} onClick={handleAutoGenerate}>
              Tạo tự động
            </Button>
            <Button icon={<UserSwitchOutlined />} onClick={handleAutoDistribute}>
              Chia học sinh
            </Button>
            <Button icon={<TeamOutlined />} onClick={handleAutoAssignInvigilators}>
              Gán giám thị tự động
            </Button>
            <Button icon={<BarChartOutlined />} onClick={fetchStats}>
              Thống kê
            </Button>
            <Button icon={<ReloadOutlined />} onClick={fetchRooms}>
              Làm mới
            </Button>
            <Button type="primary" onClick={() => setOpenCreate(true)}>
              ➕ Tạo phòng thủ công
            </Button>
          </Space>
        </Space>
      </Space>

      <Spin spinning={loading}>
        <Table dataSource={rooms} columns={columns} rowKey={(r) => r._id} pagination={{ pageSize: 10 }} bordered />
      </Spin>

      {/* Modal gán giám thị */}
      <Modal
        open={!!selectedRoom}
        title={`Gán giám thị - ${selectedRoom?.roomCode || ""}`}
        onCancel={() => {
          setSelectedRoom(null);
          setSelectedInvigilators([]);
        }}
        onOk={handleAssignInvigilators}
        confirmLoading={assigning}
      >
        <p>Chọn giám thị (người đầu tiên là Giám thị chính):</p>
        <Select
          mode="multiple"
          placeholder="Chọn giám thị..."
          value={selectedInvigilators}
          onChange={(vals) => setSelectedInvigilators(vals)}
          style={{ width: "100%" }}
        >
          {teachers.map((t) => (
            <Option key={t._id} value={t._id}>
              {t.name}
            </Option>
          ))}
        </Select>
      </Modal>

      {/* Modal tạo phòng thủ công */}
      <Modal
        open={openCreate}
        title="Tạo phòng thi"
        onCancel={() => {
          setOpenCreate(false);
          createForm.resetFields();
        }}
        onOk={() => createForm.submit()}
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="roomCode" label="Mã phòng" rules={[{ required: true, message: "Nhập mã phòng" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="capacity" label="Sức chứa" initialValue={24}>
            <InputNumber min={1} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="type" label="Loại phòng" initialValue="normal">
            <Select>
              <Option value="normal">Thường</Option>
              <Option value="lab">Lab</Option>
              <Option value="computer">Phòng máy</Option>
            </Select>
          </Form.Item>
          <Form.Item name="grade" label="Khối (tùy chọn)">
            <InputNumber min={10} max={12} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="schedule" label="Gắn vào lịch (tùy chọn)">
            <Select allowClear placeholder="Chọn lịch thi">
              {schedules.map((s) => (
                <Option key={s._id} value={s._id}>
                  {s.subject} — {new Date(s.date).toLocaleDateString()}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="note" label="Ghi chú">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Thống kê */}
      {stats && (
        <Card style={{ marginTop: 24, background: "#fafafa" }} title="📊 Thống kê phòng thi">
          {stats.data?.map((s: any, i: number) => (
            <p key={i}>
              Lịch: <b>{s._id || "Chưa rõ"}</b> — Phòng: {s.totalRooms} — Sức chứa: {s.totalSeats} — Đầy: {s.fullRooms}
            </p>
          ))}
        </Card>
      )}
    </div>
  );
}
