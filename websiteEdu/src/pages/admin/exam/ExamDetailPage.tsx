import React, { useEffect, useState } from "react";
import { Tabs, Card, Typography, Space, Spin, Tag, message, Divider, Button, Popconfirm } from "antd";
import { useParams } from "react-router-dom";
import {
  CalendarDays,
  School,
  Users,
  BarChart3,
  FileText,
} from "lucide-react"; // ✅ icon từ lucide-react
import { UserAddOutlined } from "@ant-design/icons";
import ExamSchedulePage from "./examDetail/ExamSchedulePage";
import ExamRoomPage from "./examDetail/ExamRoomPage";
import ExamStudentPage from "./examDetail/ExamStudentPage";
import ExamGradePage from "./examDetail/ExamGradePage";
import FixedExamRoomPage from "./examDetail/FixedExamRoomPage";
import { examApi } from "@/services/exams/examApi";
import { examStudentApi } from "@/services/exams/examStudentApi";
import { usePermissions } from "@/hooks/usePermissions";

const { Title, Text } = Typography;

export default function ExamDetailPage() {
  const { hasPermission, PERMISSIONS } = usePermissions();
  const { examId } = useParams<{ examId: string }>();
  const [exam, setExam] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [addingStudents, setAddingStudents] = useState(false);

  /** 🧠 Lấy thông tin kỳ thi */
  const fetchExam = async () => {
    if (!examId) return;
    try {
      setLoading(true);
      const res = await examApi.getById(examId);
      setExam(res);
    } catch (err) {
      console.error("Lỗi tải kỳ thi:", err);
      message.error("Không thể tải thông tin kỳ thi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExam();
  }, [examId]);

  /** ➕ Thêm tất cả học sinh theo khối tham gia */
  const handleAddAllStudents = async () => {
    if (!examId) return;
    try {
      setAddingStudents(true);
      const res = await examStudentApi.addAllStudentsByGrades(examId);
      message.success(res.message || `✅ Đã thêm ${res.added || 0} học sinh mới`);
      fetchExam(); // Refresh để cập nhật thông tin
    } catch (err: any) {
      console.error("Lỗi thêm học sinh:", err);
      message.error(err?.response?.data?.error || "❌ Lỗi khi thêm học sinh");
    } finally {
      setAddingStudents(false);
    }
  };


  const typeMap: Record<string, { label: string; color: string }> = {
    regular: { label: "Chính thức", color: "green" },
    mock: { label: "Thử", color: "blue" },
    graduation: { label: "Tốt nghiệp", color: "purple" },
  };

  const statusMap: Record<string, { label: string; color: string }> = {
    draft: { label: "Khởi tạo", color: "default" },
    published: { label: "Đã công bố", color: "blue" },
    locked: { label: "Đã khóa", color: "orange" },
    archived: { label: "Kết thúc", color: "gray" },
  };

  return (
    <Card
      style={{
        borderRadius: 16,
        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
        padding: 24,
      }}
    >
      {loading ? (
        <div style={{ textAlign: "center", padding: 50 }}>
          <Spin size="large" />
        </div>
      ) : exam ? (
        <>
          {/* 🏷️ Header thông tin kỳ thi */}
          <Space direction="vertical" style={{ width: "100%", marginBottom: 20 }}>
            <Title level={3} style={{ margin: 0 }}>
              {exam.name}
            </Title>
            <Text type="secondary">
              Mã kỳ thi: <b>{exam.examId}</b> | Năm học: <b>{exam.year}</b> | Học kỳ:{" "}
              <b>{exam.semester}</b>
              <Space>     |
          {exam.grades?.length
            ? exam.grades.map((g: string | number) => (
                <Tag color="blue" key={String(g)}>
                  Khối {g}
                </Tag>
              ))
            : <Text type="secondary">Chưa có khối tham gia</Text>}
        </Space>
            </Text>

            <Space wrap style={{ marginTop: 4 }}>
              <Tag color={typeMap[exam.type || "regular"]?.color}>
                {typeMap[exam.type || "regular"]?.label}
              </Tag>
              <Tag color={statusMap[exam.status || "draft"]?.color}>
                {statusMap[exam.status || "draft"]?.label}
              </Tag>
              {typeof exam.gradesPublished !== "undefined" && (
                <Tag color={exam.gradesPublished ? "green" : "red"}>
                  {exam.gradesPublished ? "Đã công bố điểm" : "Chưa công bố điểm"}
                </Tag>
              )}
            </Space>
          </Space>

          {/* 🎯 Nút thêm tất cả học sinh và phòng thi */}
          {exam.status !== "locked" && exam.status !== "archived" && hasPermission(PERMISSIONS.EXAM_UPDATE) && (
            <Card
              style={{
                marginBottom: 16,
                background: "#f0f9ff",
                borderColor: "#91d5ff",
              }}
            >
              <Space direction="vertical" style={{ width: "100%" }} size="middle">
                <Text strong>⚡ Thao tác nhanh:</Text>
                <Space wrap>
                  <Popconfirm
                    title="Thêm tất cả học sinh?"
                    description={`Hệ thống sẽ tự động thêm tất cả học sinh khối ${exam.grades?.join(", ") || ""} của niên khóa ${exam.year} vào kỳ thi. Chỉ thêm những học sinh chưa có.`}
                    onConfirm={handleAddAllStudents}
                    okText="Xác nhận"
                    cancelText="Hủy"
                  >
                    <Button
                      type="primary"
                      icon={<UserAddOutlined />}
                      loading={addingStudents}
                      size="large"
                    >
                      ➕ Thêm tất cả học sinh theo khối
                    </Button>
                  </Popconfirm>
                </Space>
              </Space>
            </Card>
          )}

          <Divider />
{exam.status === "locked" || exam.status === "archived" ? (
  <Card
    style={{
      marginBottom: 16,
      background: "#fff8e1",
      borderColor: "#ffe58f",
    }}
  >
    <Text type="warning">
      ⚠️ Kỳ thi này đã {exam.status === "locked" ? "khóa" : "kết thúc"}. 
      Bạn chỉ có thể xem thông tin, không thể chỉnh sửa.
    </Text>
  </Card>
) : null}

          {/* 🧭 Tabs điều hướng */}
          <Tabs
            defaultActiveKey="schedule"
            type="card"
            size="large"
            items={[
              {
                key: "schedule",
                label: (
                  <span className="flex items-center gap-2">
                    <CalendarDays className="w-4 h-4" /> Lịch thi
                  </span>
                ),
                children: <ExamSchedulePage examId={examId!} exam={exam} />,

              },
              {
                key: "rooms",
                label: (
                  <span className="flex items-center gap-2">
                    <School className="w-4 h-4" /> Danh sách phòng
                  </span>
                ),
                children: <ExamRoomPage examId={examId!} exam={exam} />,
              },
              {
                key: "fixed-rooms",
                label: (
                  <span className="flex items-center gap-2">
                    <School className="w-4 h-4" /> Phòng nhóm
                  </span>
                ),
                children: <FixedExamRoomPage examId={examId!} exam={exam} />,
              },
              {
                key: "students",
                label: (
                  <span className="flex items-center gap-2">
                    <Users className="w-4 h-4" /> Học sinh
                  </span>
                ),
                children: <ExamStudentPage examId={examId!} exam={exam} />,
              },
              {
                key: "grades",
                label: (
                  <span className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" /> Điểm thi
                  </span>
                ),
                children: <ExamGradePage examId={examId!} exam={exam} />,
              },
            ]}
          />
        </>
      ) : (
        <Text type="danger">Không tìm thấy kỳ thi</Text>
      )}
    </Card>
  );
}
