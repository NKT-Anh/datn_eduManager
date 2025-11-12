import React, { useState, useEffect } from "react";
import { Table, Button, Space, Modal, Form, InputNumber, Input, message, Select } from "antd";
import * as api from "@/services/examApi";
import { classApiNoToken } from "@/services/classApi";
import { ClassType } from "@/types/class";

type ExamClass = {
  _id: string;
  examId: string;
  classId: string;
  totalStudents: number;
  blockCode?: string;
  sbdStart?: string;
  sbdEnd?: string;
  status?: 'active' | 'inactive';
};

export default function ExamClasses({ examId }: { examId: string }) {
  const [data, setData] = useState<ExamClass[]>([]);
  const [classes, setClasses] = useState<ClassType[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ExamClass | null>(null);
  const [form] = Form.useForm();
  const { Option } = Select;

  // ==================== FETCH ====================
  const fetchClasses = async () => {
    try {
      const classesList: ClassType[] = await classApiNoToken.getAll();
      setClasses(classesList);
    } catch (e: any) {
      message.error(e?.message || "Lỗi khi tải danh sách lớp");
    }
  };

  const fetchData = async () => {
    if (!examId) return;
    setLoading(true);
    try {
      const res = await api.getExamClasses(examId);
      setData(res.data);
    } catch (e: any) {
      message.error(e?.message || "Lỗi khi tải lớp thi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClasses();
    fetchData();
  }, [examId]);

  // ==================== MODAL ====================
  const onAdd = () => {
    setEditing(null);
    form.resetFields();
    setOpen(true);
  };

  const onEdit = (row: ExamClass) => {
    setEditing(row);
    form.setFieldsValue(row);
    setOpen(true);
  };

  const onSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editing) {
        await api.updateExamClass(editing._id, values);
        message.success("Cập nhật thành công");
      } else {
        await api.createExamClass({ ...values, examId });
        message.success("Thêm lớp thi thành công");
      }
      setOpen(false);
      fetchData();
    } catch (e: any) {
      message.error(e?.message || "Lỗi khi lưu");
    }
  };

  // ==================== AUTO GENERATE ====================
  const handleAutoGenerateClasses = async () => {
    if (!examId) return;
    try {
      const res = await api.handleAutoGenerateClasses(examId);
      console.log("Lớp thi đã tạo:", res.data.created);
      console.log("Lớp thi bỏ qua:", res.data.skipped);
      message.success("Đã tạo tự động các lớp thi");
      fetchData();
    } catch (e: any) {
      console.error(e);
      message.error(e?.message || "Lỗi khi tạo tự động lớp thi");
    }
  };

  const handleGenerateSBD = async () => {
    if (!examId) return;
    try {
      await api.generateSBD(examId);
      message.success("SBD đã được tạo");
      fetchData();
    } catch (e: any) {
      message.error(e?.message || "Lỗi tạo SBD");
    }
  };

  // ==================== HELPER ====================
  const getClassName = (id: string) => {
    const cls = classes.find((c) => c._id === id);
    return cls ? cls.className : id;
  };

  // ==================== TABLE COLUMNS ====================
  const columns = [
    { title: "Lớp", dataIndex: "classId", render: (id: string) => getClassName(id) },
    { title: "Sỉ số", dataIndex: "totalStudents" },
    { title: "Block", dataIndex: "blockCode" },
    { title: "SBD từ", dataIndex: "sbdStart" },
    { title: "SBD đến", dataIndex: "sbdEnd" },
    { 
      title: "Trạng thái", 
      dataIndex: "status",
      render: (status: string) => status === 'active' ? 'Hoạt động' : 'Không hoạt động'
    },
    {
      title: "Hành động",
      render: (_: any, row: ExamClass) => (
        <Space>
          <Button onClick={() => onEdit(row)}>Sửa</Button>
        </Space>
      ),
    },
  ];

  // ==================== RENDER ====================
  return (
    <div>
      <Space style={{ marginBottom: 12 }}>
        <Button type="primary" onClick={onAdd}>Thêm lớp thi</Button>
        <Button onClick={handleGenerateSBD}>Generate SBD</Button>
        <Button onClick={handleAutoGenerateClasses}>Tạo tự động lớp thi</Button>
      </Space>

      <Table
        rowKey="_id"
        dataSource={data}
        columns={columns}
        loading={loading}
      />

      <Modal
        open={open}
        onCancel={() => setOpen(false)}
        onOk={onSubmit}
        title={editing ? "Sửa lớp thi" : "Thêm lớp thi"}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="classId"
            label="Lớp"
            rules={[{ required: true, message: "Vui lòng chọn lớp" }]}
          >
            <Select placeholder="Chọn lớp">
              {classes.map(c => (
                <Option key={c._id} value={c._id}>
                  {c.className}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="totalStudents"
            label="Sỉ số"
            rules={[{ required: true, message: "Vui lòng nhập sỉ số" }]}
          >
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item name="blockCode" label="Block">
            <Input placeholder="Nhập block code" />
          </Form.Item>

          <Form.Item name="sbdStart" label="SBD từ">
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item name="sbdEnd" label="SBD đến">
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item name="status" label="Trạng thái">
            <Select>
              <Option value="active">Hoạt động</Option>
              <Option value="inactive">Không hoạt động</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
