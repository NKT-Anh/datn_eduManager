import React, { useState, useEffect } from 'react';
import { Card, Table, Tag, Space, Typography, Spin, message } from 'antd';
import { CalendarOutlined, ClockCircleOutlined, BookOutlined, DownOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { studentExamApi, StudentExam, StudentExamSchedule } from '@/services/exams/studentExamApi';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

interface ExamWithSchedules extends StudentExam {
  schedules?: StudentExamSchedule[];
  schedulesLoading?: boolean;
}

const StudentSchedule: React.FC = () => {
  const { backendUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [exams, setExams] = useState<ExamWithSchedules[]>([]);

  useEffect(() => {
    if (backendUser?.studentId || backendUser?._id) {
      fetchExams();
    }
  }, [backendUser]);

  const fetchExams = async () => {
    try {
      setLoading(true);
      const studentId = backendUser?.studentId || backendUser?._id;
      if (!studentId) {
        message.error("Không tìm thấy thông tin học sinh");
        return;
      }

      const data = await studentExamApi.getExams(studentId);
      // ✅ Filter chỉ lấy exam đã công bố (status = "published")
      const publishedExams = (data || []).filter((exam: any) => exam.status === "published");
      setExams(publishedExams.map((exam: any) => ({ ...exam, schedules: [], schedulesLoading: false })));
    } catch (err: any) {
      console.error("Lỗi khi tải danh sách kỳ thi:", err);
      message.error(err?.response?.data?.error || "Không thể tải danh sách kỳ thi");
    } finally {
      setLoading(false);
    }
  };

  const fetchSchedulesForExam = async (examId: string) => {
    try {
      const studentId = backendUser?.studentId || backendUser?._id;
      if (!studentId || !examId) return;

      // ✅ Set loading cho exam này
      setExams(prev => prev.map(exam => 
        exam._id === examId 
          ? { ...exam, schedulesLoading: true }
          : exam
      ));

      const data = await studentExamApi.getSchedules(examId, studentId);
      
      // ✅ Cập nhật schedules cho exam này
      setExams(prev => prev.map(exam => 
        exam._id === examId 
          ? { ...exam, schedules: data || [], schedulesLoading: false }
          : exam
      ));
    } catch (err: any) {
      console.error(`Lỗi khi tải lịch thi cho kỳ thi ${examId}:`, err);
      setExams(prev => prev.map(exam => 
        exam._id === examId 
          ? { ...exam, schedules: [], schedulesLoading: false }
          : exam
      ));
    }
  };

  const handleExpand = async (expanded: boolean, record: ExamWithSchedules) => {
    // ✅ Khi expand, nếu chưa có schedules thì fetch
    if (expanded && (!record.schedules || record.schedules.length === 0) && !record.schedulesLoading) {
      await fetchSchedulesForExam(record._id);
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

  // ✅ Columns cho table kỳ thi
  const examColumns = [
    {
      title: 'STT',
      key: 'stt',
      width: 60,
      align: 'center' as const,
      render: (_: any, __: any, index: number) => index + 1,
    },
    {
      title: 'Tên kỳ thi',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (name: string, record: ExamWithSchedules) => (
        <Space direction="vertical" size={0}>
          <Text strong>{name}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.year} - HK{record.semester}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Loại',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      align: 'center' as const,
      render: (type: string) => (
        <Tag color={type === 'midterm' ? 'blue' : type === 'final' ? 'red' : 'default'}>
          {type === 'midterm' ? 'Giữa kỳ' : type === 'final' ? 'Cuối kỳ' : type || 'Khác'}
        </Tag>
      ),
    },
    {
      title: 'Ngày bắt đầu',
      dataIndex: 'startDate',
      key: 'startDate',
      width: 120,
      render: (date: string) => (
        date ? dayjs(date).format('DD/MM/YYYY') : '-'
      ),
    },
    {
      title: 'Ngày kết thúc',
      dataIndex: 'endDate',
      key: 'endDate',
      width: 120,
      render: (date: string) => (
        date ? dayjs(date).format('DD/MM/YYYY') : '-'
      ),
    },
    {
      title: 'Số lịch thi',
      key: 'schedulesCount',
      width: 100,
      align: 'center' as const,
      render: (_: any, record: ExamWithSchedules) => (
        <Tag color="blue">{record.schedules?.length || 0}</Tag>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      align: 'center' as const,
      render: (status: string) => (
        <Tag color={status === 'published' ? 'green' : 'default'}>
          {status === 'published' ? 'Đã công bố' : status || '-'}
        </Tag>
      ),
    },
  ];

  // ✅ Columns cho table lịch thi
  const scheduleColumns = [
    {
      title: 'STT',
      key: 'stt',
      width: 60,
      align: 'center' as const,
      render: (_: any, __: any, index: number) => index + 1,
    },
    {
      title: 'Môn thi',
      dataIndex: 'subject',
      key: 'subject',
      width: 150,
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
      width: 120,
      render: (date: string) => (
        <Space>
          <CalendarOutlined />
          <Text>{date ? dayjs(date).format('DD/MM/YYYY') : "-"}</Text>
        </Space>
      ),
    },
    {
      title: 'Giờ thi',
      key: 'time',
      width: 180,
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
      title: 'Nhóm phòng',
      dataIndex: 'fixedRoomCode',
      key: 'fixedRoomCode',
      width: 120,
      align: 'center' as const,
      render: (fixedRoomCode: string) => (
        fixedRoomCode ? (
          <Tag color="purple">{fixedRoomCode}</Tag>
        ) : (
          <Text type="secondary">-</Text>
        )
      ),
    },
    {
      title: 'Phòng thi',
      dataIndex: 'room',
      key: 'room',
      width: 120,
      align: 'center' as const,
      render: (room: StudentExamSchedule['room']) => (
        room?.roomCode ? (
          <Tag color="blue">{room.roomCode}</Tag>
        ) : (
          <Text type="secondary">Chưa xếp phòng</Text>
        )
      ),
    },
    {
      title: 'Số thứ tự',
      dataIndex: 'seatNumber',
      key: 'seatNumber',
      width: 100,
      align: 'center' as const,
      render: (seatNumber: number) => (
        seatNumber ? <Tag color="cyan">{seatNumber}</Tag> : <Text type="secondary">-</Text>
      ),
    },
    {
      title: 'Trạng thái',
      key: 'status',
      width: 120,
      render: (_: any, record: StudentExamSchedule) =>
        getStatusTag(record.date, record.startTime, record.endTime),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <Title level={2} style={{ marginBottom: 24 }}>
          📅 Lịch thi - Các kỳ thi đã công bố
        </Title>

        <Spin spinning={loading}>
          {exams.length === 0 && !loading ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Text type="secondary">Chưa có kỳ thi nào đã công bố</Text>
            </div>
          ) : (
            <div className="space-y-4">
              {/* ✅ Table hiển thị tất cả kỳ thi đã công bố */}
              <Table
                columns={examColumns}
                dataSource={exams}
                rowKey="_id"
                pagination={{
                  pageSize: 10,
                  showSizeChanger: true,
                  showTotal: (total) => `Tổng ${total} kỳ thi đã công bố`,
                }}
                expandable={{
                  expandedRowRender: (record: ExamWithSchedules) => {
                    const examData = exams.find(e => e._id === record._id);
                    
                    if (examData?.schedulesLoading) {
                      return (
                        <div style={{ padding: 16, textAlign: 'center' }}>
                          <Spin size="small" />
                          <Text type="secondary" style={{ marginLeft: 8 }}>Đang tải lịch thi...</Text>
                        </div>
                      );
                    }

                    if (!examData?.schedules || examData.schedules.length === 0) {
                      return (
                        <div style={{ padding: 16, textAlign: 'center' }}>
                          <Text type="secondary">Chưa có lịch thi nào cho kỳ thi này</Text>
                        </div>
                      );
                    }

                    return (
                      <div style={{ padding: '16px 0' }}>
                        <Text strong style={{ marginBottom: 16, display: 'block' }}>
                          Danh sách lịch thi:
                        </Text>
                        <Table
                          columns={scheduleColumns}
                          dataSource={examData.schedules}
                          rowKey="_id"
                          pagination={false}
                          size="small"
                        />
                      </div>
                    );
                  },
                  rowExpandable: (record: ExamWithSchedules) => true,
                  onExpand: handleExpand,
                  expandIcon: ({ expanded, onExpand, record }) => (
                    <DownOutlined
                      style={{ cursor: 'pointer' }}
                      rotate={expanded ? 180 : 0}
                      onClick={(e) => onExpand(record, e)}
                    />
                  ),
                }}
              />
            </div>
          )}
        </Spin>
      </Card>
    </div>
  );
};

export default StudentSchedule;
