import React, { useEffect, useState } from "react";
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
} from "antd";
import {
  SaveOutlined,
  UploadOutlined,
  FileExcelOutlined,
  LockOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { examGradeApi } from "@/services/exams/examGradeApi";

interface ExamGradePageProps {
  examId: string;
}

export default function ExamGradePage({ examId }: ExamGradePageProps) {
  const [grades, setGrades] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);

  const fetchGrades = async () => {
    try {
      setLoading(true);
      const res = await examGradeApi.getByExam(examId);
      setGrades(res.data || res);
    } catch {
      message.error("Không thể tải danh sách điểm");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGrades();
  }, [examId]);

  const handleSave = async (record: any, value: number) => {
    try {
      setUpdating(true);
      await examGradeApi.addOrUpdate({
        exam: examId,
        student: record.student._id,
        subject: record.subject._id,
        gradeValue: value,
      });
      message.success("✅ Lưu điểm thành công");
      fetchGrades();
    } catch {
      message.error("❌ Lỗi khi lưu điểm");
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
      render: (v: number, record: any) => (
        <InputNumber
          min={0}
          max={10}
          defaultValue={v}
          onBlur={(e) =>
            handleSave(record, Number((e.target as HTMLInputElement).value))
          }
        />
      ),
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
          <Upload beforeUpload={handleImport} showUploadList={false}>
            <Button icon={<UploadOutlined />} style={{ background: "#2ecc71", color: "#fff" }}>
              Import Excel
            </Button>
          </Upload>
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
          <Popconfirm title="Khóa toàn bộ điểm?" onConfirm={handleLock}>
            <Button icon={<LockOutlined />} danger>
              Khóa điểm
            </Button>
          </Popconfirm>
        </Space>
      }
    >
      <Spin spinning={loading || updating}>
        <Table
          dataSource={grades}
          columns={columns}
          rowKey={(r) => r._id}
          pagination={{ pageSize: 20 }}
          bordered
        />
      </Spin>
    </Card>
  );
}
