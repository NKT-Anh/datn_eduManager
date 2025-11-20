import React, { useState, useEffect } from 'react';
import { Card, Table, Tag, Space, Typography, Spin, message, Select } from 'antd';
import { CalendarOutlined, ClockCircleOutlined, BookOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { studentExamApi, StudentExam, StudentExamSchedule } from '@/services/exams/studentExamApi';

const { Title, Text } = Typography;

const StudentSchedule: React.FC = () => {
  const { backendUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [exams, setExams] = useState<StudentExam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>("");
  const [schedules, setSchedules] = useState<StudentExamSchedule[]>([]);

  useEffect(() => {
    if (backendUser?.studentId || backendUser?._id) {
      fetchExams();
    }
  }, [backendUser]);

  useEffect(() => {
    if (selectedExamId && (backendUser?.studentId || backendUser?._id)) {
      fetchSchedules();
    }
  }, [selectedExamId, backendUser]);

  const fetchExams = async () => {
    try {
      setLoading(true);
      const studentId = backendUser?.studentId || backendUser?._id;
      if (!studentId) {
        message.error("Không tìm thấy thông tin học sinh");
        return;
      }

      const data = await studentExamApi.getExams(studentId);
      setExams(data || []);
      if (data && data.length > 0) {
        setSelectedExamId(data[0]._id);
      }
    } catch (err: any) {
      console.error("Lỗi khi tải danh sách kỳ thi:", err);
      message.error(err?.response?.data?.error || "Không thể tải danh sách kỳ thi");
    } finally {
      setLoading(false);
    }
  };

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      const studentId = backendUser?.studentId || backendUser?._id;
      if (!studentId || !selectedExamId) return;

      const data = await studentExamApi.getSchedules(selectedExamId, studentId);
      setSchedules(data || []);
    } catch (err: any) {
      console.error("Lỗi khi tải lịch thi:", err);
      message.error(err?.response?.data?.error || "Không thể tải lịch thi");
      setSchedules([]);
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
      title: 'Môn thi',
      dataIndex: 'subject',
      key: 'subject',
      render: (subject: StudentExamSchedule['subject']) => (
        <Space>
          <BookOutlined />
          <Text strong>{subject?.name || "Chưa có môn"}</Text>
        </Space>
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
      key: 'time',
      render: (_: any, record: StudentExamSchedule) => (
        <Space>
          <ClockCircleOutlined />
          <Text>
            {record.startTime || "-"} - {record.endTime || "-"}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Phòng thi',
      dataIndex: 'room',
      key: 'room',
      render: (room: StudentExamSchedule['room']) => (
        room ? <Tag color="blue">{room.roomCode}</Tag> : <Text type="secondary">Chưa xếp phòng</Text>
      ),
    },
    {
      title: 'Số thứ tự',
      dataIndex: 'seatNumber',
      key: 'seatNumber',
      render: (seatNumber: number) => (
        seatNumber ? <Tag color="cyan">{seatNumber}</Tag> : <Text type="secondary">-</Text>
      ),
    },
    {
      title: 'Trạng thái',
      key: 'status',
      render: (_: any, record: StudentExamSchedule) =>
        getStatusTag(record.date, record.startTime, record.endTime),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <Title level={2} style={{ marginBottom: 24 }}>
          📅 Lịch thi
        </Title>

        {exams.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <Space>
              <Text strong>Chọn kỳ thi:</Text>
              <Select
                value={selectedExamId}
                onChange={setSelectedExamId}
                style={{ width: 300 }}
                placeholder="Chọn kỳ thi"
              >
                {exams.map((exam) => (
                  <Select.Option key={exam._id} value={exam._id}>
                    {exam.name} - {exam.year} - HK{exam.semester}
                  </Select.Option>
                ))}
              </Select>
            </Space>
          </div>
        )}

        <Spin spinning={loading}>
          {schedules.length === 0 && !loading ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Text type="secondary">
                {selectedExamId ? "Chưa có lịch thi nào" : "Vui lòng chọn kỳ thi"}
              </Text>
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

export default StudentSchedule;
