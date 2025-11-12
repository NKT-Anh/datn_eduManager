import React, { useState, useEffect } from "react";
import {
  Button,
  Table,
  Space,
  Popconfirm,
  Spin,
  Tag,
  Card,
  Typography,
  Divider,
  Select,
  Modal,
  Row,
  Col,
  message,
} from "antd";
import {
  PlusOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  IdcardOutlined,
  PartitionOutlined,
  FileTextOutlined,
  BookOutlined,
  LockOutlined,
  CalendarOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import ExamForm from "./ExamForm";
import * as api from "@/services/examApi";
import { useIsMobile } from "@/hooks/use-mobile";

const { Title, Text } = Typography;
const { Option } = Select;

export default function ExamList() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingExamId, setEditingExamId] = useState<string | null>(null);
  const [modalKey, setModalKey] = useState(0);

  // --------- Fetch Exams ----------
  const fetchExams = async () => {
    setLoading(true);
    try {
      const res = await api.getExams();
      setExams(
        res.data.sort((a: any, b: any) =>
          a.grades && b.grades
            ? a.grades[0].localeCompare(b.grades[0])
            : 0
        )
      ); // sắp xếp khối áp dụng tăng dần
    } catch (err: any) {
      message.error(err.message || "Lỗi tải danh sách");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExams();
  }, []);

  // --------- Handlers ----------
  const openModal = (id?: string) => {
    setEditingExamId(id || null);
    setModalKey((prev) => prev + 1);
    setModalOpen(true);
  };

  const deleteExam = async (id: string) => {
    setBusyAction(id);
    try {
      await api.deleteExam(id);
      setExams((prev) => prev.filter((x) => x._id !== id));
      message.success("Xóa thành công");
    } catch (err: any) {
      message.error(err.message || "Lỗi xóa kỳ thi");
    } finally {
      setBusyAction(null);
    }
  };

  const changeStatus = async (id: string, status: string) => {
    setBusyAction(id);
    try {
      const res = await api.updateExam(id, { status });
      setExams((prev) =>
        prev.map((x) => (x._id === id ? res.data : x))
      );
      message.success("Cập nhật trạng thái thành công");
    } catch (err: any) {
      message.error(err.message || "Lỗi cập nhật trạng thái");
    } finally {
      setBusyAction(null);
    }
  };

  const generateSBD = async (id: string) => {
    setBusyAction(id);
    try {
      await api.generateSBD(id);
      message.success("Tạo SBD thành công");
    } catch (err: any) {
      message.error(err.message || "Lỗi tạo SBD");
    } finally {
      setBusyAction(null);
    }
  };

  const autoAssignRooms = async (id: string) => {
    setBusyAction(id);
    try {
      await api.autoAssignRooms(id);
      message.success("Phân phòng hoàn tất");
    } catch (err: any) {
      message.error(err.message || "Lỗi phân phòng");
    } finally {
      setBusyAction(null);
    }
  };

  const formatDateRange = (s?: string, e?: string) => {
    if (!s && !e) return <Text type="secondary">-</Text>;
    const start = s ? new Date(s).toLocaleDateString("vi-VN") : "";
    const end = e ? new Date(e).toLocaleDateString("vi-VN") : "";
    return <Text>{start}{start && end && " đến "}{end}</Text>;
  };

  const statusConfig: Record<
    string,
    { color: string; label: string; icon: React.ReactNode }
  > = {
    draft: { color: "default", label: "Đang khởi tạo", icon: <FileTextOutlined /> },
    published: { color: "blue", label: "Đã công bố", icon: <BookOutlined /> },
    locked: { color: "orange", label: "Khóa", icon: <LockOutlined /> },
    archived: { color: "gray", label: "Kết thúc", icon: <CalendarOutlined /> },
  };

  // --------- Columns ----------
  const columns = [
    {
      title: <Text strong>Tên kỳ thi</Text>,
      key: "info",
      render: (_: any, r: any) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ fontSize: 15, color: "#1a1a1a" }}>
            {r.examId ?? r._id}
          </Text>
          <Text type="secondary">{r.name}</Text>
          {!isMobile && <Text type="secondary">{formatDateRange(r.startDate, r.endDate)}</Text>}
        </Space>
      ),
    },
    !isMobile && {
      title: "Khối áp dụng",
      dataIndex: "grades",
      width: 180,
      align: "center",
      render: (grades: string[]) =>
        grades && grades.length > 0
      ?[...grades].sort((a,b) => Number(a) - Number(b))
          .map((g) => <Tag key={g} color="blue">{g}</Tag>)
          : <Text type="secondary">-</Text>,
    },
    !isMobile && {
      title: "Năm học",
      dataIndex: "year",
      width: 110,
      align: "center",
      render: (v: any) => <Tag color="purple">{v || "-"}</Tag>,
    },
    !isMobile && {
      title: "Học kỳ",
      dataIndex: "semester",
      width: 90,
      align: "center",
      render: (v: any) => <Tag color="volcano">{v || "-"}</Tag>,
    },
    !isMobile && {
      title: <Text strong>Trạng thái</Text>,
      dataIndex: "status",
      width: 180,
      align: "center",
      render: (v: any, r: any) => {
        const current = v || "draft";
        const disabled = ["locked", "archived"].includes(current);
        return (
          <Select
            value={current}
            onChange={(val) => changeStatus(r._id, val)}
            disabled={busyAction === r._id || disabled}
            style={{ width: "100%" }}
            loading={busyAction === r._id}
          >
            {Object.entries(statusConfig).map(([key, { color, label, icon }]) => (
              <Option key={key} value={key}>
                <Space size={4}>
                  {icon}
                  <Tag color={color} style={{ margin: 0 }}>{label}</Tag>
                </Space>
              </Option>
            ))}
          </Select>
        );
      },
    },
    !isMobile && {
      title: <Text strong>Hành động</Text>,
      key: "actions",
      width: 520,
      align: "center",
      render: (_: any, r: any) => (
        <Space size={4} wrap>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/admin/exams/${r._id}`)}
          >
            Chi tiết
          </Button>
          <Button
            size="small"
            type="primary"
            ghost
            icon={<EditOutlined />}
            onClick={() => openModal(r._id)}
          >
            Sửa
          </Button>
          <Popconfirm
            title="Xóa kỳ thi này?"
            onConfirm={() => deleteExam(r._id)}
            okText="Xóa"
            cancelText="Hủy"
          >
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              loading={busyAction === r._id}
            >
              Xóa
            </Button>
          </Popconfirm>
          <Button
            size="small"
            type="dashed"
            icon={<IdcardOutlined />}
            loading={busyAction === r._id}
            onClick={() => generateSBD(r._id)}
          >
            Tạo SBD
          </Button>
          <Button
            size="small"
            icon={<PartitionOutlined />}
            loading={busyAction === r._id}
            onClick={() => autoAssignRooms(r._id)}
            style={{ borderColor: "#52c41a", color: "#52c41a" }}
          >
            Phân phòng
          </Button>
        </Space>
      ),
    },
  ].filter(Boolean);

  return (
    <Card
      style={{
        borderRadius: 16,
        boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
        overflow: "hidden",
        padding: 24,
        background: "#f5f7fa",
        minHeight: "100vh",
      }}
    >
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={3} style={{ margin: 0, color: "#1a1a1a" }}>Quản lý Kỳ thi</Title>
        </Col>
        <Col>
          <Button
            type="primary"
            size="large"
            icon={<PlusOutlined />}
            onClick={() => openModal()}
            style={{ borderRadius: 12 }}
          >
            Tạo kỳ thi mới
          </Button>
        </Col>
      </Row>

      <Divider />

      {loading ? (
        <Spin size="large" style={{ display: "block", margin: "60px auto" }} />
      ) : (
        <Table
          rowKey={(r) => r._id}
          dataSource={exams}
          columns={columns as any}
          pagination={{ pageSize: 10 }}
          scroll={{ x: isMobile ? 600 : 1350 }}
        />
      )}

      <Modal
        key={modalKey}
        open={modalOpen}
        title={editingExamId ? "Chỉnh sửa Kỳ thi" : "Tạo Kỳ thi Mới"}
        footer={null}
        onCancel={() => setModalOpen(false)}
        width={isMobile ? "95%" : 800}
        destroyOnHidden
        maskClosable={false}
      >
        <ExamForm
          id={editingExamId || undefined}
          onSuccess={(exam) => {
            setModalOpen(false);
            if (editingExamId) {
              setExams((prev) =>
                prev.map((x) => (x._id === exam._id ? exam : x))
              );
            } else {
              setExams((prev) => [exam, ...prev]);
            }
          }}
        />
      </Modal>
    </Card>
  );
}
