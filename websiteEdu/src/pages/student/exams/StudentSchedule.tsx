import React, { useState, useEffect } from 'react';
import { Card, Table, Tag, Space, Typography, Spin, message } from 'antd';
import { CalendarOutlined, ClockCircleOutlined, BookOutlined, DownOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { studentExamApi, StudentExam, StudentExamSchedule, StudentExamRoom } from '@/services/exams/studentExamApi';
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
  const [roomInfo, setRoomInfo] = useState<Record<string, Record<string, StudentExamRoom | any>>>({});

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
      // ✅ Sắp xếp theo ngày bắt đầu (ngày gần nhất lên đầu)
      const sortedExams = publishedExams.sort((a: any, b: any) => {
        const dateA = a.startDate ? new Date(a.startDate).getTime() : 0;
        const dateB = b.startDate ? new Date(b.startDate).getTime() : 0;
        return dateB - dateA; // Ngày mới nhất lên đầu
      });
      setExams(sortedExams.map((exam: any) => ({ ...exam, schedules: [], schedulesLoading: false })));
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
      
      // ✅ Sắp xếp schedules theo ngày và giờ (ngày gần nhất lên đầu)
      const sortedSchedules = (data || []).sort((a: any, b: any) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        if (dateA !== dateB) {
          return dateA - dateB; // Ngày sớm hơn lên đầu
        }
        // Nếu cùng ngày, sắp xếp theo giờ bắt đầu
        const timeA = a.startTime || "00:00";
        const timeB = b.startTime || "00:00";
        return timeA.localeCompare(timeB);
      });
      
      // ✅ Cập nhật schedules cho exam này
      setExams(prev => prev.map(exam => 
        exam._id === examId 
          ? { ...exam, schedules: sortedSchedules, schedulesLoading: false }
          : exam
      ));

      // ✅ Tải thông tin phòng thi để lấy SBD & seatNumber cho từng lịch
      const map: Record<string, StudentExamRoom | any> = {};
      for (const s of sortedSchedules) {
        try {
          const r = await studentExamApi.getRoom(s._id, String(studentId));
          map[s._id] = r as any;
        } catch {
          // ignore when not assigned yet
        }
      }
      setRoomInfo(prev => ({ ...prev, [examId]: map }));
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

  // ✅ Columns cho table lịch thi (build theo examId để truy cập roomInfo tương ứng)
  const buildScheduleColumns = (examId: string) => [
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
      width: 160,
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
      key: 'room',
      width: 120,
      align: 'center' as const,
      render: (_: any, record: StudentExamSchedule) => {
        const r = roomInfo[examId]?.[record._id] as any;
        const roomLabel = r?.room || r?.roomCode || record.room?.roomCode;
        return roomLabel ? <Tag color="blue">{roomLabel}</Tag> : <Text type="secondary">Chưa xếp phòng</Text>;
      },
    },
    {
      title: 'SBD',
      key: 'sbd',
      width: 100,
      align: 'center' as const,
      render: (_: any, record: StudentExamSchedule) => {
        const sbd = (record as any)?.sbd
          ?? (record as any)?.examStudent?.sbd
          ?? (record as any)?.studentExam?.sbd
          ?? (record as any)?.student?.sbd;
        if (sbd) return <Tag color="purple">{sbd}</Tag>;
        const r = roomInfo[examId]?.[record._id] as any;
        return r?.sbd ? <Tag color="purple">{r.sbd}</Tag> : <Text type="secondary">-</Text>;
      },
    },
    {
      title: 'Số thứ tự',
      dataIndex: 'seatNumber',
      key: 'seatNumber',
      width: 100,
      align: 'center' as const,
      render: (seatNumber: number, record: StudentExamSchedule) => {
        const r = roomInfo[examId]?.[record._id] as any;
        const value = r?.seatNumber ?? seatNumber;
        return value ? <Tag color="cyan">{value}</Tag> : <Text type="secondary">-</Text>;
      },
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
                        {(() => {
                          const studentName = (backendUser as any)?.name || (backendUser as any)?.fullName || '-';
                          const className =
                            (record as any)?.class?.className ||
                            (record as any)?.class?.name ||
                            (backendUser as any)?.class?.className ||
                            (backendUser as any)?.className ||
                            '-';
                          const sbdForExam = (() => {
                            const found = examData?.schedules?.find((s: any) => s?.sbd || s?.examStudent?.sbd || s?.studentExam?.sbd || s?.student?.sbd);
                            if (found) return found.sbd ?? found.examStudent?.sbd ?? found.studentExam?.sbd ?? found.student?.sbd;
                            const rMap = roomInfo[record._id];
                            if (rMap) {
                              const first: any = Object.values(rMap).find((r: any) => r?.sbd);
                              if (first) return first.sbd;
                            }
                            return undefined;
                          })();
                          return (
                            <div style={{ marginBottom: 12, background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 8, padding: 12 }}>
                              <Space size={24} wrap>
                                <div>
                                  <Text type="secondary">Họ tên</Text>
                                  <div><Text strong>{studentName}</Text></div>
                                </div>
                                <div>
                                  <Text type="secondary">Lớp</Text>
                                  <div>{className !== '-' ? <Tag color="blue">{className}</Tag> : <Text type="secondary">-</Text>}</div>
                                </div>
                                <div>
                                  <Text type="secondary">SBD</Text>
                                  <div>{sbdForExam ? <Tag color="purple">{sbdForExam}</Tag> : <Text type="secondary">-</Text>}</div>
                                </div>
                              </Space>
                            </div>
                          );
                        })()}
                        <Text strong style={{ marginBottom: 16, display: 'block' }}>
                          Danh sách lịch thi:
                        </Text>
                        <Table
                          columns={buildScheduleColumns(record._id)}
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
