// src/pages/admin/exams/ExamRooms.tsx
import React, { useState, useEffect } from "react";
import { Table, Button, Modal, Form, Input, InputNumber, Select, message, Spin, Space } from "antd";
import * as api from "@/services/examApi";

const { Option } = Select;

export type ExamRoom = {
  _id: string;
  roomId?: string;
  code: string;
  capacity: number;
  type: "normal" | "computer";
  status: "available" | "maintenance";
};

export default function ExamRooms({ examId }: { examId?: string }) {
  const [rooms, setRooms] = useState<ExamRoom[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ExamRoom | null>(null);
  const [form] = Form.useForm();

  // load rooms
  const fetchRooms = async () => {
    if (!examId) return;
    setLoading(true);
    try {
      const res = await api.getExamRooms(examId);
      setRooms(res.data);
    } catch (err: any) {
      message.error(err?.message || "Lỗi khi tải phòng thi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, [examId]);

  const onAdd = () => {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };

  const onEdit = (room: ExamRoom) => {
    setEditing(room);
    form.setFieldsValue(room);
    setModalOpen(true);
  };

  const onSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editing) {
        // update
        await api.updateExamRoom(editing._id, values);
        message.success("Cập nhật phòng thành công");
      } else {
        // create
        await api.createExamRoom({ ...values, examId });
        message.success("Tạo phòng thành công");
      }
      setModalOpen(false);
      fetchRooms();
    } catch (err: any) {
      message.error(err?.message || "Lỗi khi lưu phòng");
    }
  };

  const columns = [
    { title: "Mã phòng", dataIndex: "code" },
    { title: "Sức chứa", dataIndex: "capacity" },
    { title: "Loại", dataIndex: "type" },
    { title: "Trạng thái", dataIndex: "status" },
    {
      title: "Hành động",
      render: (_: any, record: ExamRoom) => (
        <Space>
          <Button onClick={() => onEdit(record)}>Sửa</Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Button type="primary" onClick={onAdd}>Thêm phòng</Button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 24 }}>
          <Spin size="large" />
        </div>
      ) : (
        <Table rowKey="_id" dataSource={rooms} columns={columns} pagination={{ pageSize: 10 }} />
      )}

      <Modal
        open={modalOpen}
        title={editing ? "Sửa phòng" : "Thêm phòng"}
        onCancel={() => setModalOpen(false)}
        onOk={onSubmit}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="roomId" label="roomId">
            <Input />
          </Form.Item>
          <Form.Item name="code" label="Mã phòng" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="capacity" label="Sức chứa" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="type" label="Loại" rules={[{ required: true }]}>
            <Select>
              <Option value="normal">Normal</Option>
              <Option value="computer">Computer</Option>
            </Select>
          </Form.Item>
          <Form.Item name="status" label="Trạng thái" rules={[{ required: true }]}>
            <Select>
              <Option value="available">Available</Option>
              <Option value="maintenance">Maintenance</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
