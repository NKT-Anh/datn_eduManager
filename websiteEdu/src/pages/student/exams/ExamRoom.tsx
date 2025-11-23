import React, { useState, useEffect } from 'react';
import { Card, Table, Tag, Space, Typography, Spin, message, Select, Descriptions } from 'antd';
import { CalendarOutlined, ClockCircleOutlined, BookOutlined, HomeOutlined, UserOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { studentExamApi, StudentExam, StudentExamSchedule, StudentExamRoom } from '@/services/exams/studentExamApi';

const { Title, Text } = Typography;

const ExamRoom: React.FC = () => {
  const { backendUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [exams, setExams] = useState<StudentExam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>("");
  const [schedules, setSchedules] = useState<StudentExamSchedule[]>([]);
  const [roomInfo, setRoomInfo] = useState<Record<string, StudentExamRoom>>({});

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

  useEffect(() => {
    if (schedules.length > 0 && (backendUser?.studentId || backendUser?._id)) {
      fetchAllRoomInfo();
    }
  }, [schedules, backendUser]);

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

  const fetchAllRoomInfo = async () => {
    try {
      const studentId = backendUser?.studentId || backendUser?._id;
      if (!studentId) return;

      const roomInfoMap: Record<string, StudentExamRoom> = {};
      
      for (const schedule of schedules) {
        try {
          const roomData = await studentExamApi.getRoom(schedule._id, studentId);
          roomInfoMap[schedule._id] = roomData;
        } catch (err: any) {
          // Nếu không tìm thấy phòng, bỏ qua
          console.warn(`Không tìm thấy phòng cho lịch ${schedule._id}:`, err);
        }
      }
      
      setRoomInfo(roomInfoMap);
    } catch (err: any) {
      console.error("Lỗi khi tải thông tin phòng thi:", err);
    }
  };

  const getRoomTypeTag = (type?: string) => {
    if (!type) return null;
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
      key: 'room',
      render: (_: any, record: StudentExamSchedule) => {
        const room = roomInfo[record._id];
        if (!room) {
          return <Text type="secondary">Chưa xếp phòng</Text>;
        }
        return (
          <Space>
            <HomeOutlined />
            <Tag color="blue">{room.room || "-"}</Tag>
            {getRoomTypeTag(room.roomType)}
          </Space>
        );
      },
    },
    {
      title: 'Số báo danh',
      key: 'sbd',
      render: (_: any, record: StudentExamSchedule) => {
        const room = roomInfo[record._id];
        return room?.sbd ? (
          <Tag color="purple" style={{ fontSize: 14, padding: '4px 8px' }}>
            {room.sbd}
          </Tag>
        ) : (
          <Text type="secondary">-</Text>
        );
      },
    },
    {
      title: 'Số thứ tự',
      key: 'seatNumber',
      render: (_: any, record: StudentExamSchedule) => {
        const room = roomInfo[record._id];
        return room?.seatNumber ? (
          <Tag color="cyan">{room.seatNumber}</Tag>
        ) : (
          <Text type="secondary">-</Text>
        );
      },
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <Title level={2} style={{ marginBottom: 24 }}>
          🏫 Thông tin phòng thi
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
              expandable={{
                expandedRowRender: (record) => {
                  const room = roomInfo[record._id];
                  if (!room) {
                    return (
                      <div style={{ padding: 16 }}>
                        <Text type="secondary">Chưa có thông tin phòng thi</Text>
                      </div>
                    );
                  }
                  return (
                    <Descriptions bordered column={2} style={{ margin: 16 }}>
                      <Descriptions.Item label="Môn thi">
                        {record.subject?.name || "Chưa có môn"}
                      </Descriptions.Item>
                      <Descriptions.Item label="Ngày thi">
                        {record.date ? new Date(record.date).toLocaleDateString('vi-VN') : "-"}
                      </Descriptions.Item>
                      <Descriptions.Item label="Thời gian">
                        {record.startTime || "-"} - {record.endTime || "-"}
                      </Descriptions.Item>
                      <Descriptions.Item label="Phòng thi">
                        <Space>
                          <Tag color="blue">{room.room || "-"}</Tag>
                          {getRoomTypeTag(room.roomType)}
                        </Space>
                      </Descriptions.Item>
                      <Descriptions.Item label="Số báo danh">
                        <Tag color="purple">{room.sbd || "-"}</Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="Số thứ tự">
                        <Tag color="cyan">{room.seatNumber || "-"}</Tag>
                      </Descriptions.Item>
                    </Descriptions>
                  );
                },
              }}
            />
          )}
        </Spin>
      </Card>
    </div>
  );
};

export default ExamRoom;
