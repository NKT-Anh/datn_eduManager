import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Tabs, Button, Space, message, Spin } from "antd";
import PageHeader from "@/components/ui/PageHeader";
import ExamClasses from "./ExamClasses";
import ExamRooms from "./ExamRooms";
import ExamSchedules from "./ExamSchedules";
import ExamStudents from "./ExamStudents";
import RoomAssignments from "./RoomAssignments";
import * as api from "@/services/examApi";

export default function ExamDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [exam, setExam] = useState<{ name: string; year?: string; semester?: string } | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch exam details khi component mount hoặc id thay đổi
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.getExamById(id)
      .then(res => setExam(res.data))
      .catch(err => message.error(err?.message || "Lỗi khi tải kỳ thi"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 24 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader 
        title={`Kỳ thi: ${exam?.name || '—'}`} 
        subtitle={`${exam?.year || ''} — HK${exam?.semester || ''}`} 
      />

      <Space style={{ marginBottom: 12 }}>
        <Button onClick={() => navigate(`/admin/exams/${id}/edit`)}>Sửa kỳ thi</Button>
        <Button
          onClick={() => 
            api.generateSBD(id!)
              .then(() => alert('Tạo SBD xong'))
              .catch(e => alert(e.message))
          }
        >
          Generate SBD
        </Button>
        <Button
          onClick={() => 
            api.autoAssignRooms(id!)
              .then(() => alert('Xếp phòng xong'))
              .catch(e => alert(e.message))
          }
        >
          Auto assign rooms
        </Button>
      </Space>

      <Tabs defaultActiveKey="classes">
        <Tabs.TabPane tab="Lớp thi" key="classes">
          <ExamClasses examId={id!} />
        </Tabs.TabPane>
        <Tabs.TabPane tab="Phòng thi" key="rooms">
          <ExamRooms examId={id!} />
        </Tabs.TabPane>
        <Tabs.TabPane tab="Lịch thi" key="schedules">
          <ExamSchedules examId={id!} />
        </Tabs.TabPane>
        <Tabs.TabPane tab="Học sinh" key="students">
          <ExamStudents examId={id!} />
        </Tabs.TabPane>
        <Tabs.TabPane tab="Phân phòng" key="assignments">
          <RoomAssignments/>
        </Tabs.TabPane>
      </Tabs>
    </div>
  );
}
