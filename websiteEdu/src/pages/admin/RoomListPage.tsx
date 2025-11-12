import React, { useEffect, useState } from "react";
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  message,
  Space,
  Tag,
  Popconfirm,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { roomApi, Room } from "@/services/roomApi";

const { Option } = Select;

export default function RoomListPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [form] = Form.useForm();
  const [filter, setFilter] = useState({ status: "all", type: "all", keyword: "" });

  /** 📦 Lấy danh sách phòng */
  const fetchRooms = async () => {
    setLoading(true);
    try {
      const data = await roomApi.getAll(filter);
      setRooms(data);
    } catch {
      message.error("Không thể tải danh sách phòng");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, [filter]);

  /** 💾 Lưu phòng (thêm hoặc cập nhật) */
  const onFinish = async (values: any) => {
    try {
      const payload = { ...values };
      delete payload.capacity; // ❌ Không lưu capacity nữa
      if (editingRoom) {
        await roomApi.update(editingRoom._id!, payload);
        message.success("Đã cập nhật phòng");
      } else {
        await roomApi.create(payload);
        message.success("Đã thêm phòng mới");
      }
      setModalOpen(false);
      form.resetFields();
      fetchRooms();
    } catch {
      message.error("Lỗi khi lưu phòng");
    }
  };

  /** 🗑️ Xóa phòng */
  const deleteRoom = async (id: string) => {
    try {
      await roomApi.remove(id);
      message.success("Đã xóa phòng");
      fetchRooms();
    } catch {
      message.error("Lỗi khi xóa phòng");
    }
  };

  /** 🎨 Hiển thị màu sắc */
  const typeColors: Record<string, string> = {
    normal: "blue",
    lab: "orange",
    computer: "purple",
  };

  const statusColors: Record<string, string> = {
    available: "green",
    exam: "geekblue",
    maintenance: "gold",
    inactive: "red",
  };

  const typeLabels: Record<string, string> = {
    normal: "Phòng học",
    lab: "Phòng thí nghiệm",
    computer: "Phòng máy tính",
  };

  const statusLabels: Record<string, string> = {
    available: "Đang học",
    exam: "Phòng thi",
    maintenance: "Bảo trì",
    inactive: "Ngưng dùng",
  };

  /** 📋 Cột bảng */
  const columns: ColumnsType<Room> = [
    { title: "Mã phòng", dataIndex: "roomCode", key: "roomCode", align: "center" },
    { title: "Tên phòng", dataIndex: "name", key: "name", align: "center" },
    {
      title: "Loại phòng",
      dataIndex: "type",
      align: "center",
      render: (v: string) => (
        <Tag color={typeColors[v] || "default"}>{typeLabels[v] || v}</Tag>
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      align: "center",
      render: (v: string) => (
        <Tag color={statusColors[v] || "default"}>{statusLabels[v] || v}</Tag>
      ),
    },
    {
      title: "Hành động",
      key: "actions",
      align: "center",
      render: (_, record) => (
        <Space>
          <Button
            icon={<EditOutlined />}
            size="small"
            onClick={() => {
              setEditingRoom(record);
              form.setFieldsValue(record);
              setModalOpen(true);
            }}
          >
            Sửa
          </Button>
          <Popconfirm
            title="Xóa phòng này?"
            okText="Xóa"
            cancelText="Hủy"
            onConfirm={() => deleteRoom(record._id!)}
          >
            <Button danger size="small" icon={<DeleteOutlined />}>
              Xóa
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div
      style={{
        padding: 24,
        background: "#fff",
        borderRadius: 12,
        boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
      }}
    >
      {/* 🎛️ Bộ lọc */}
      <Space style={{ marginBottom: 16, flexWrap: "wrap" }}>
        <Input
          placeholder="Tìm kiếm phòng..."
          prefix={<SearchOutlined />}
          style={{ width: 220 }}
          onChange={(e) => setFilter((f) => ({ ...f, keyword: e.target.value }))}
        />
        <Select
          value={filter.type}
          style={{ width: 160 }}
          onChange={(v) => setFilter((f) => ({ ...f, type: v }))}
        >
          <Option value="all">Tất cả loại</Option>
          <Option value="normal">Phòng học</Option>
          <Option value="lab">Phòng thí nghiệm</Option>
          <Option value="computer">Phòng máy tính</Option>
        </Select>
        <Select
          value={filter.status}
          style={{ width: 160 }}
          onChange={(v) => setFilter((f) => ({ ...f, status: v }))}
        >
          <Option value="all">Tất cả trạng thái</Option>
          <Option value="available">Đang học</Option>
          <Option value="exam">Phòng thi</Option>
          <Option value="maintenance">Bảo trì</Option>
          <Option value="inactive">Ngưng dùng</Option>
        </Select>
        <Button icon={<ReloadOutlined />} onClick={fetchRooms}>
          Làm mới
        </Button>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditingRoom(null);
            form.resetFields();
            setModalOpen(true);
          }}
        >
          Thêm phòng
        </Button>
      </Space>

      {/* 📊 Bảng danh sách phòng */}
      <Table<Room>
        rowKey="_id"
        columns={columns}
        dataSource={rooms}
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      {/* 🧾 Modal thêm/sửa phòng */}
      <Modal
        open={modalOpen}
        title={editingRoom ? "Cập nhật phòng" : "Thêm phòng"}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        okText="Lưu"
        cancelText="Hủy"
        destroyOnClose
      >
        <Form layout="vertical" form={form} onFinish={onFinish}>
          <Form.Item
            label="Mã phòng"
            name="roomCode"
            rules={[{ required: true, message: "Vui lòng nhập mã phòng" }]}
          >
            <Input placeholder="VD: 10A1, 11B2..." />
          </Form.Item>
          <Form.Item label="Tên phòng" name="name">
            <Input placeholder="VD: Phòng Toán 1, Phòng Tin học 2..." />
          </Form.Item>
          <Form.Item label="Loại phòng" name="type" initialValue="normal">
            <Select>
              <Option value="normal">Phòng học</Option>
              <Option value="lab">Phòng thí nghiệm</Option>
              <Option value="computer">Phòng máy tính</Option>
            </Select>
          </Form.Item>
          <Form.Item label="Trạng thái" name="status" initialValue="available">
            <Select>
              <Option value="available">Đang học</Option>
              <Option value="exam">Phòng thi</Option>
              <Option value="maintenance">Bảo trì</Option>
              <Option value="inactive">Ngưng dùng</Option>
            </Select>
          </Form.Item>
          <Form.Item label="Ghi chú" name="note">
            <Input.TextArea rows={2} placeholder="Ghi chú thêm nếu có..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
