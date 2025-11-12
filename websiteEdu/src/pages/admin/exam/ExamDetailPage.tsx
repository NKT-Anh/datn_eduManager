import React, { useEffect, useState } from "react";
import { Tabs, Card, Typography, Space, Spin, Tag, message, Divider } from "antd";
import { useParams } from "react-router-dom";
import {
  CalendarDays,
  School,
  Users,
  BarChart3,
  FileText,
} from "lucide-react"; // ✅ icon từ lucide-react
import ExamSchedulePage from "./examDetail/ExamSchedulePage";
import ExamRoomPage from "./examDetail/ExamRoomPage";
import ExamStudentPage from "./examDetail/ExamStudentPage";
import ExamGradePage from "./examDetail/ExamGradePage";
import { examApi } from "@/services/exams/examApi";

const { Title, Text } = Typography;

export default function ExamDetailPage() {
  const { examId } = useParams<{ examId: string }>();
  const [exam, setExam] = useState<any>(null);
  const [loading, setLoading] = useState(false);

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
            ? exam.grades.map((g: number) => (
                <Tag color="blue" key={g}>
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
            </Space>
          </Space>

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
                    <School className="w-4 h-4" /> Phòng thi
                  </span>
                ),
children: <ExamRoomPage examId={examId!} exam={exam} />,

              },
              {
                key: "students",
                label: (
                  <span className="flex items-center gap-2">
                    <Users className="w-4 h-4" /> Học sinh
                  </span>
                ),
                children: <ExamStudentPage examId={examId!} />,
              },
              {
                key: "grades",
                label: (
                  <span className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" /> Điểm thi
                  </span>
                ),
                children: <ExamGradePage examId={examId!} />,
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
