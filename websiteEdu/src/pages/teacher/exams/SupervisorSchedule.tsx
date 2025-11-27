import React, { useState, useEffect, useMemo } from 'react';
import { Card, Table, Tag, Space, Typography, Spin, message, Select } from 'antd';
import { CalendarOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { teacherExamApi, TeacherExamSchedule } from '@/services/exams/teacherExamApi';
import { getExams } from '@/services/examApi';

const { Title, Text } = Typography;
const { Option } = Select;

const HIDE_AFTER_DAYS = 7; // number of days to keep finished exams visible

const shouldDisplayExam = (exam: Exam, now: Date) => {
  if (!exam?.endDate) {
    return true;
  }

  const examEnd = new Date(exam.endDate);
  if (Number.isNaN(examEnd.getTime())) {
    return true;
  }

  examEnd.setHours(23, 59, 59, 999);

  const hideAfter = new Date(examEnd);
  hideAfter.setDate(hideAfter.getDate() + HIDE_AFTER_DAYS);

  return now <= hideAfter;
};

interface Exam {
  _id: string;
  name: string;
  year: string;
  semester: string;
  status: string;
  startDate?: string;
  endDate?: string;
  type?: string;
}

const SupervisorSchedule: React.FC = () => {
  const { backendUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [schedules, setSchedules] = useState<TeacherExamSchedule[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>('');

  useEffect(() => {
    if (backendUser?.teacherId || backendUser?._id) {
      fetchExams();
    }
  }, [backendUser]);

  useEffect(() => {
    if (backendUser?.teacherId || backendUser?._id) {
      fetchSchedules();
    }
  }, [backendUser, selectedExamId]);

  const fetchExams = async () => {
    try {
      const res = await getExams();
      const rawExams: Exam[] = (res.data?.data || res.data || []) as Exam[];
      // ✅ Chỉ lấy kỳ thi đã công bố
      const publishedExams = rawExams.filter((exam: Exam) => exam.status === 'published');
      const now = new Date();
      const visibleExams = publishedExams.filter((exam) => shouldDisplayExam(exam, now));

      setExams(visibleExams);

      setSelectedExamId((prev) => {
        if (prev && visibleExams.some((exam) => exam._id === prev)) {
          return prev;
        }
        return visibleExams[0]?._id || '';
      });

      if (visibleExams.length === 0) {
        setSchedules([]);
      }
    } catch (err: any) {
      console.error("Lỗi khi tải danh sách kỳ thi:", err);
    }
  };

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      const teacherId = backendUser?.teacherId || backendUser?._id;
      if (!teacherId) {
        message.error("Không tìm thấy thông tin giáo viên");
        return;
      }

      const res = await teacherExamApi.getSchedules(teacherId, selectedExamId || undefined);
      setSchedules(res.data || []);
    } catch (err: any) {
      console.error("Lỗi khi tải lịch coi thi:", err);
      message.error(err?.response?.data?.error || "Không thể tải lịch coi thi");
    } finally {
      setLoading(false);
    }
  };

  const examOptions = useMemo(() => 
    exams.map(e => ({ value: e._id, label: `${e.name} - ${e.year} - HK${e.semester}` })),
    [exams]
  );

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
      width: 200,
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
      width: 150,
      render: (subject: TeacherExamSchedule['subject']) => (
        <Text strong>{subject?.name || "Chưa có môn"}</Text>
      ),
    },
    {
      title: 'Ngày thi',
      dataIndex: 'date',
      key: 'date',
      width: 120,
      render: (date: string) => (
        <Space>
          <CalendarOutlined />
          <Text>{date ? new Date(date).toLocaleDateString('vi-VN') : "-"}</Text>
        </Space>
      ),
    },
    {
      title: 'Giờ thi',
      key: 'time',
      width: 180,
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
      title: 'Phòng gác thi',
      dataIndex: 'rooms',
      key: 'rooms',
      width: 200,
      render: (rooms: TeacherExamSchedule['rooms']) => {
        if (!rooms || rooms.length === 0) {
          return <Text type="secondary">Chưa có phòng</Text>;
        }
        return (
          <Space direction="vertical" size={4}>
            {rooms.map((room: any) => (
              <Tag key={room._id} color="blue">
                {room.roomCode}
              </Tag>
            ))}
          </Space>
        );
      },
    },
    {
      title: 'Vai trò',
      key: 'role',
      width: 150,
      render: (_: any, record: TeacherExamSchedule) => {
        const roles = record.rooms?.map((room: any) => room.invigilatorRole).filter(Boolean) || [];
        const uniqueRoles = [...new Set(roles)];
        if (uniqueRoles.length === 0) {
          return <Tag color="default">Chưa phân công</Tag>;
        }
        return (
          <Space direction="vertical" size={4}>
            {uniqueRoles.map((role: string) => (
              <Tag key={role} color={role === 'supervisor1' || role === 'main' ? 'gold' : 'purple'}>
                {role === 'supervisor1' || role === 'main' ? 'Giám thị chính' : 'Giám thị phụ'}
              </Tag>
            ))}
          </Space>
        );
      },
    },
    {
      title: 'Trạng thái',
      key: 'status',
      width: 120,
      render: (_: any, record: TeacherExamSchedule) =>
        getStatusTag(record.date, record.startTime, record.endTime),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <Title level={2} style={{ margin: 0 }}>
            📅 Lịch coi thi
          </Title>
          <Select
            style={{ width: 300 }}
            placeholder="Chọn kỳ thi"
            value={selectedExamId || undefined}
            onChange={(value) => setSelectedExamId(value)}
            allowClear
          >
            {examOptions.map(opt => (
              <Option key={opt.value} value={opt.value}>{opt.label}</Option>
            ))}
          </Select>
        </div>

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
