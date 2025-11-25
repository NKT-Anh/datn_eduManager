import React, { useState, useEffect, useMemo } from 'react';
import { Card, Table, Tag, Space, Typography, Spin, message, Select } from 'antd';
import { CalendarOutlined, ClockCircleOutlined, UserOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { teacherExamApi, TeacherExamRoom } from '@/services/exams/teacherExamApi';
import { getExams } from '@/services/examApi';

const { Title, Text } = Typography;
const { Option } = Select;

interface Exam {
  _id: string;
  name: string;
  year: string;
  semester: string;
  status: string;
}

const SupervisorRooms: React.FC = () => {
  const { backendUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [rooms, setRooms] = useState<TeacherExamRoom[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>('');

  useEffect(() => {
    if (backendUser?.teacherId || backendUser?._id) {
      fetchExams();
    }
  }, [backendUser]);

  useEffect(() => {
    if (backendUser?.teacherId || backendUser?._id) {
      fetchRooms();
    }
  }, [backendUser, selectedExamId]);

  const fetchExams = async () => {
    try {
      const res = await getExams();
      // ✅ Chỉ lấy kỳ thi đã công bố
      const publishedExams = (res.data?.data || res.data || []).filter((exam: Exam) => exam.status === 'published');
      setExams(publishedExams);
      if (publishedExams.length > 0 && !selectedExamId) {
        setSelectedExamId(publishedExams[0]._id);
      }
    } catch (err: any) {
      console.error("Lỗi khi tải danh sách kỳ thi:", err);
    }
  };

  const fetchRooms = async () => {
    try {
      setLoading(true);
      const teacherId = backendUser?.teacherId || backendUser?._id;
      if (!teacherId) {
        message.error("Không tìm thấy thông tin giáo viên");
        return;
      }

      const res = await teacherExamApi.getRooms(teacherId, selectedExamId || undefined);
      setRooms(res.data || []);
    } catch (err: any) {
      console.error("Lỗi khi tải phòng thi:", err);
      message.error(err?.response?.data?.error || "Không thể tải danh sách phòng thi");
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

  const getRoomTypeTag = (type: string) => {
    const typeMap: Record<string, { color: string; label: string }> = {
      normal: { color: "green", label: "Phòng thường" },
      lab: { color: "orange", label: "Phòng Lab" },
      computer: { color: "cyan", label: "Phòng máy" },
    };
    const roomType = typeMap[type] || { color: "default", label: type };
    return <Tag color={roomType.color}>{roomType.label}</Tag>;
  };

  const columns = [
    {
      title: 'Kỳ thi',
      dataIndex: ['exam', 'name'],
      key: 'exam',
      render: (_: any, record: TeacherExamRoom) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.exam?.name}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.exam?.year} - HK{record.exam?.semester}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Môn thi',
      dataIndex: ['schedule', 'subject', 'name'],
      key: 'subject',
      render: (_: any, record: TeacherExamRoom) => (
        <Text strong>{record.schedule?.subject?.name || "Chưa có môn"}</Text>
      ),
    },
    {
      title: 'Ngày thi',
      dataIndex: ['schedule', 'date'],
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
      render: (_: any, record: TeacherExamRoom) => (
        <Space>
          <ClockCircleOutlined />
          <Text>
            {record.schedule?.startTime || "-"} - {record.schedule?.endTime || "-"}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Phòng thi',
      dataIndex: ['room', 'roomCode'],
      key: 'room',
      render: (roomCode: string, record: TeacherExamRoom) => (
        <Space direction="vertical" size={0}>
          <Tag color="blue" style={{ fontSize: 14, padding: '4px 8px' }}>
            {roomCode || "-"}
          </Tag>
          {getRoomTypeTag(record.room?.type || "normal")}
        </Space>
      ),
    },
    {
      title: 'Vai trò',
      dataIndex: 'invigilatorRole',
      key: 'role',
      render: (role: string) => (
        <Tag color={role === 'supervisor1' ? 'gold' : 'purple'}>
          {role === 'supervisor1' ? 'Giám thị 1' : 'Giám thị 2'}
        </Tag>
      ),
    },
    {
      title: 'Số thí sinh',
      dataIndex: 'studentCount',
      key: 'studentCount',
      render: (count: number) => (
        <Space>
          <UserOutlined />
          <Text strong>{count || 0}</Text>
        </Space>
      ),
    },
    {
      title: 'Trạng thái',
      key: 'status',
      render: (_: any, record: TeacherExamRoom) =>
        getStatusTag(
          record.schedule?.date || "",
          record.schedule?.startTime || "",
          record.schedule?.endTime || ""
        ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <Title level={2} style={{ margin: 0 }}>
            🏫 Phòng thi đảm nhận
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
          {rooms.length === 0 && !loading ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Text type="secondary">Chưa có phòng thi nào được phân công</Text>
            </div>
          ) : (
            <Table
              columns={columns}
              dataSource={rooms}
              rowKey="_id"
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showTotal: (total) => `Tổng ${total} phòng thi`,
              }}
            />
          )}
        </Spin>
      </Card>
    </div>
  );
};

export default SupervisorRooms;
