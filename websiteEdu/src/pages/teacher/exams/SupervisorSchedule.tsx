import React, { useState, useEffect } from 'react';
import { Card, Table, Tag, Space, Typography, Spin, message } from 'antd';
import { CalendarOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { teacherExamApi, TeacherExamSchedule } from '@/services/exams/teacherExamApi';

const { Title, Text } = Typography;

const SupervisorSchedule: React.FC = () => {
  const { backendUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [schedules, setSchedules] = useState<TeacherExamSchedule[]>([]);

  useEffect(() => {
    if (backendUser?.teacherId || backendUser?._id) {
      fetchSchedules();
    }
  }, [backendUser]);

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      const teacherId = backendUser?.teacherId || backendUser?._id;
      if (!teacherId) {
        message.error("Không tìm thấy thông tin giáo viên");
        return;
      }

      const res = await teacherExamApi.getSchedules(teacherId);
      setSchedules(res.data || []);
    } catch (err: any) {
      console.error("Lỗi khi tải lịch coi thi:", err);
      message.error(err?.response?.data?.error || "Không thể tải lịch coi thi");
    } finally {
      setLoading(false);
    }
  };

  const getStatusTag = (date: string, startTime: string, endTime: string) => {
    const now = new Date();
    const examDate = new Date(date);
    const [startH, startM] = (startTime || "00:00").split(":").map(Number);
    const [endH, endM] = (endTime || "00:00").split(":").map(Number);
    
    examDate.setHours(startH, startM, 0, 0);
    const endDateTime = new Date(examDate);
    endDateTime.setHours(endH, endM, 0, 0);

    if (now < examDate) {
      return <Tag color="blue">Sắp diễn ra</Tag>;
    } else if (now >= examDate && now <= endDateTime) {
      return <Tag color="green">Đang diễn ra</Tag>;
    } else {
      return <Tag color="default">Đã kết thúc</Tag>;
    }
  };

  const columns = [
    {
      title: 'Kỳ thi',
      dataIndex: 'exam',
      key: 'exam',
      render: (exam: TeacherExamSchedule['exam']) => (
        <Space direction="vertical" size={0}>
          <Text strong>{exam?.name}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {exam?.year} - HK{exam?.semester}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Môn thi',
      dataIndex: 'subject',
      key: 'subject',
      render: (subject: TeacherExamSchedule['subject']) => (
        <Text strong>{subject?.name || "Chưa có môn"}</Text>
      ),
    },
    {
      title: 'Ngày thi',
      dataIndex: 'date',
      key: 'date',
      render: (date: string) => (
        <Space>
          <CalendarOutlined />
          <Text>{date ? new Date(date).toLocaleDateString('vi-VN') : "-"}</Text>
        </Space>
      ),
    },
    {
      title: 'Thời gian',
      dataIndex: ['startTime', 'endTime'],
      key: 'time',
      render: (_: any, record: TeacherExamSchedule) => (
        <Space>
          <ClockCircleOutlined />
          <Text>
            {record.startTime || "-"} - {record.endTime || "-"}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Khối',
      dataIndex: 'grade',
      key: 'grade',
      render: (grade: string) => <Tag color="cyan">Khối {grade}</Tag>,
    },
    {
      title: 'Số phòng',
      dataIndex: 'rooms',
      key: 'rooms',
      render: (rooms: TeacherExamSchedule['rooms']) => (
        <Text strong>{rooms?.length || 0}</Text>
      ),
    },
    {
      title: 'Trạng thái',
      key: 'status',
      render: (_: any, record: TeacherExamSchedule) =>
        getStatusTag(record.date, record.startTime, record.endTime),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <Title level={2} style={{ marginBottom: 24 }}>
          📅 Lịch coi thi
        </Title>

        <Spin spinning={loading}>
          {schedules.length === 0 && !loading ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Text type="secondary">Chưa có lịch coi thi nào</Text>
            </div>
          ) : (
            <Table
              columns={columns}
              dataSource={schedules}
              rowKey="_id"
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showTotal: (total) => `Tổng ${total} lịch thi`,
              }}
            />
          )}
        </Spin>
      </Card>
    </div>
  );
};

export default SupervisorSchedule;
