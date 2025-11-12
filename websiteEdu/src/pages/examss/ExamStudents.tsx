// src/pages/admin/exams/ExamSchedules.tsx
import React, { useState, useEffect } from "react";
import { Table, Button, Modal, Form, Input, DatePicker, TimePicker, InputNumber, message, Space, Spin, Popconfirm } from "antd";
import * as api from "@/services/examApi";
import dayjs from "dayjs";

export type ExamSchedule = {
  _id: string;
  examId: string;
  examClassId: string;
  subjectId: string;
  roomId: string;
  date: string;
  startTime: string;
  duration: number;
  studentsInRoom?: number;
};

export default function ExamSchedules({ examId }: { examId: string }) {
  const [schedules, setSchedules] = useState<ExamSchedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ExamSchedule | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [form] = Form.useForm();

  // Load schedules
  const fetchSchedules = async () => {
    if (!examId) return;
    setLoading(true);
    try {
      const res = await api.getExamSchedules(examId);
      setSchedules(res.data);
    } catch (err: any) {
      message.error(err?.message || "Lỗi khi tải lịch thi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, [examId]);

  const onAdd = () => {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };

  const onEdit = (schedule: ExamSchedule) => {
    setEditing(schedule);
    form.setFieldsValue({
      ...schedule,
      date: schedule.date ? dayjs(schedule.date) : null,
      startTime: schedule.startTime ? dayjs(schedule.startTime, "HH:mm") : null,
    });
    setModalOpen(true);
  };

  const onSubmit = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        examId: values.examId,
        examClassId: values.examClassId,
        subjectId: values.subjectId,
        roomId: values.roomId,
        date: values.date.toISOString(),
        startTime: values.startTime.format("HH:mm"),
        duration: values.duration,
      };
      if (editing) {
        await api.updateExamSchedule(editing._id, payload);
        message.success("Cập nhật lịch thi thành công");
      } else {
        await api.createExamSchedule(payload);
        message.success("Tạo lịch thi thành công");
      }
      setModalOpen(false);
      fetchSchedules();
    } catch (err: any) {
      message.error(err?.message || "Lỗi khi lưu lịch thi");
    }
  };

  const onDelete = async (id: string) => {
    try {
      setBusyId(id);
      await api.deleteExamSchedule(id);
      message.success("Xóa lịch thi thành công");
      fetchSchedules();
    } catch (err: any) {
      message.error(err?.message || "Lỗi khi xóa lịch thi");
    } finally {
      setBusyId(null);
    }
  };

  const columns = [
    { title: "Môn", dataIndex: "subjectId" },
    { title: "Ngày", dataIndex: "date", render: (d: any) => (d ? new Date(d).toLocaleDateString() : "-") },
    { title: "Giờ bắt đầu", dataIndex: "startTime" },
    { title: "Phòng", dataIndex: "roomId" },
    { title: "Số HS", dataIndex: "studentsInRoom" },
    {
      title: "Hành động",
      render: (_: any, record: ExamSchedule) => (
        <Space>
          <Button onClick={() => onEdit(record)}>Sửa</Button>
          <Popconfirm
            title="Bạn có chắc muốn xóa lịch thi này?"
            onConfirm={() => onDelete(record._id)}
            okText="Xóa"
            cancelText="Hủy"
          >
            <Button danger loading={busyId === record._id}>Xóa</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Button type="primary" onClick={onAdd}>Thêm lịch thi</Button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 24 }}>
          <Spin size="large" />
        </div>
      ) : (
        <Table rowKey="_id" dataSource={schedules} columns={columns} pagination={{ pageSize: 10 }} />
      )}

      <Modal
        open={modalOpen}
        title={editing ? "Sửa lịch thi" : "Thêm lịch thi"}
        onCancel={() => setModalOpen(false)}
        onOk={onSubmit}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="examId" label="examId" initialValue={examId} hidden>
            <Input />
          </Form.Item>
          <Form.Item name="examClassId" label="ExamClassId" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="subjectId" label="Môn" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="roomId" label="Phòng" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="date" label="Ngày" rules={[{ required: true }]}>
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="startTime" label="Giờ bắt đầu" rules={[{ required: true }]}>
            <TimePicker format="HH:mm" style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="duration" label="Thời lượng (phút)" rules={[{ required: true }]}>
            <InputNumber min={5} style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
