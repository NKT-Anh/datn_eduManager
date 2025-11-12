import React, { useEffect, useState } from "react";
import {
  Table,
  Button,
  Space,
  message,
  Card,
  Typography,
  Popconfirm,
  Tag,
  Spin,
} from "antd";
import {
  ReloadOutlined,
  FilePdfOutlined,
  TeamOutlined,
  RetweetOutlined,
} from "@ant-design/icons";
import { useParams } from "react-router-dom";
import { roomAssignmentApi } from "@/services/exams/roomAssignmentApi";

const { Title, Text } = Typography;

interface Assignment {
  _id: string;
  sbd: string;
  seatNumber: number;
  examRoom?: { roomCode: string };
  examStudent?: {
    student?: {
      name: string;
      className: string;
      gender: string;
      studentCode: string;
    };
  };
}

export default function ExamRoomAssignmentPage() {
  const { scheduleId } = useParams<{ scheduleId: string }>();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);

  /** 📦 Lấy danh sách học sinh đã xếp chỗ */
  const fetchAssignments = async () => {
    try {
      if (!scheduleId) return;
      setLoading(true);
      const data = await roomAssignmentApi.getBySchedule(scheduleId);
      setAssignments(Array.isArray(data) ? data : []);
    } catch (err: any) {
      message.error(err?.response?.data?.error || "Không thể tải danh sách xếp phòng");
    } finally {
      setLoading(false);
    }
  };

  /** ⚙️ Tự động xếp phòng */
  const handleAutoAssign = async () => {
    try {
      if (!scheduleId) return;
      setAssigning(true);
      const res = await roomAssignmentApi.autoAssign(scheduleId);
      message.success(res?.message || "✅ Đã xếp phòng thi tự động");
      fetchAssignments();
    } catch (err: any) {
      message.error(err?.response?.data?.error || "❌ Lỗi khi xếp phòng thi");
    } finally {
      setAssigning(false);
    }
  };

  /** 🧾 Xuất PDF */
  const handleExportPDF = async () => {
    try {
      if (!scheduleId) return;
      message.loading({ content: "Đang xuất PDF...", key: "pdf" });
      await roomAssignmentApi.exportPdf(scheduleId);
      const url = `/api/room-assignments/export/${scheduleId}/pdf`;
      window.open(url, "_blank");
      message.success({ content: "✅ Xuất PDF thành công", key: "pdf" });
    } catch {
      message.error({ content: "❌ Xuất PDF thất bại", key: "pdf" });
    }
  };

  /** 🗑️ Reset danh sách */
  const handleReset = async () => {
    try {
      if (!scheduleId) return;
      await roomAssignmentApi.reset(scheduleId);
      message.success("🗑️ Đã reset danh sách xếp phòng thi");
      fetchAssignments();
    } catch (err: any) {
      message.error(err?.response?.data?.error || "❌ Lỗi khi reset danh sách");
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, [scheduleId]);

  /** 🧱 Cột bảng */
  const columns = [
    {
      title: "STT",
      dataIndex: "seatNumber",
      key: "seatNumber",
      align: "center" as const,
      width: 80,
      render: (v: number) => <Text strong>{v}</Text>,
    },
    {
      title: "SBD",
      dataIndex: "sbd",
      key: "sbd",
      align: "center" as const,
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: "Họ tên",
      key: "studentName",
      render: (_: any, record: Assignment) => (
        <Text strong>{record.examStudent?.student?.name || "-"}</Text>
      ),
    },
    {
      title: "Lớp",
      key: "className",
      align: "center" as const,
      render: (_: any, record: Assignment) =>
        record.examStudent?.student?.className || "-",
    },
    {
      title: "Giới tính",
      key: "gender",
      align: "center" as const,
      render: (_: any, record: Assignment) =>
        record.examStudent?.student?.gender || "-",
    },
    {
      title: "Phòng thi",
      key: "examRoom",
      align: "center" as const,
      render: (_: any, record: Assignment) =>
        record.examRoom?.roomCode ? (
          <Tag color="geekblue">{record.examRoom.roomCode}</Tag>
        ) : (
          "-"
        ),
    },
  ];

  return (
    <Card
      style={{
        borderRadius: 16,
        boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
        padding: 24,
        background: "#fff",
      }}
    >
      {/* === HEADER === */}
      <Space
        direction="vertical"
        style={{ width: "100%", marginBottom: 16 }}
        size="large"
      >
        <Space
          style={{ width: "100%", justifyContent: "space-between" }}
          align="center"
        >
          <Title level={3} style={{ margin: 0 }}>
            Danh sách xếp phòng thi
          </Title>

          <Space>
            <Button
              type="primary"
              icon={<TeamOutlined />}
              onClick={handleAutoAssign}
              loading={assigning}
              style={{ borderRadius: 8 }}
            >
              Tự động xếp phòng
            </Button>
            <Button
              icon={<FilePdfOutlined />}
              onClick={handleExportPDF}
              style={{ background: "#e67e22", color: "#fff", borderRadius: 8 }}
            >
              Xuất PDF
            </Button>
            <Popconfirm
              title="Bạn có chắc muốn reset danh sách xếp phòng?"
              okText="Đồng ý"
              cancelText="Hủy"
              onConfirm={handleReset}
            >
              <Button
                danger
                icon={<RetweetOutlined />}
                style={{ borderRadius: 8 }}
              >
                Reset danh sách
              </Button>
            </Popconfirm>
            <Button
              icon={<ReloadOutlined />}
              onClick={fetchAssignments}
              style={{ borderRadius: 8 }}
            >
              Làm mới
            </Button>
          </Space>
        </Space>
      </Space>

      {/* === TABLE === */}
      <Spin spinning={loading}>
        <Table
          dataSource={assignments}
          columns={columns}
          rowKey={(r) => r._id}
          pagination={{ pageSize: 20 }}
          bordered
        />
      </Spin>
    </Card>
  );
}
