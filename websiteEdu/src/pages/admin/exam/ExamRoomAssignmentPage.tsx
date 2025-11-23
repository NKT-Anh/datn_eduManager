import React, { useEffect, useState } from "react";
import {
  Table,
  Button,
  Space,
  message,
  Card,
  Typography,
  Select,
  Tag,
  Input,
} from "antd";
import {
  FilePdfOutlined,
} from "@ant-design/icons";
import {
  RefreshCcw,
  Search,
  Zap,
} from "lucide-react";
import { examApi } from "@/services/exams/examApi";
import { examScheduleApi } from "@/services/exams/examScheduleApi";
import { roomAssignmentApi } from "@/services/exams/roomAssignmentApi";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";

const { Title } = Typography;
const { Option } = Select;

interface Invigilator {
  teacher?: {
    _id: string;
    name: string;
    teacherCode?: string;
  };
  role: "main" | "assistant";
}

interface RoomAssignment {
  _id: string;
  sbd: string;
  seatNumber: number;
  examRoom?: {
    roomCode: string;
    roomName?: string;
    _id: string;
    invigilators?: Invigilator[];
  };
  examStudent?: {
    student?: {
      name: string;
      className?: string;
      gender: string;
      studentCode: string;
      classId?: {
        className: string;
        classCode: string;
        grade: string;
      };
    };
  };
  schedule?: {
    _id: string;
    subject?: {
      name: string;
      code?: string;
    };
    date: string;
    startTime: string;
    endTime?: string;
    grade?: string;
  };
}

export default function ExamRoomAssignmentPage() {
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState<RoomAssignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [exams, setExams] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [selectedExam, setSelectedExam] = useState<string>("");
  const [selectedSchedule, setSelectedSchedule] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch exams
  const fetchExams = async () => {
    try {
      const res = await examApi.getAll();
      setExams(Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []));
    } catch (err) {
      console.error("❌ Lỗi tải kỳ thi:", err);
    }
  };

  // Fetch schedules by exam
  const fetchSchedules = async (examId: string) => {
    try {
      if (!examId) {
        setSchedules([]);
        return;
      }
      const res = await examScheduleApi.getByExam(examId);
      setSchedules(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error("❌ Lỗi tải lịch thi:", err);
      setSchedules([]);
    }
  };

  // Fetch assignments
  const fetchAssignments = async () => {
    if (!selectedSchedule) {
      setAssignments([]);
      return;
    }
    try {
      setLoading(true);
      const data = await roomAssignmentApi.getBySchedule(selectedSchedule);
      // ✅ Đảm bảo data là mảng
      const assignmentsData = Array.isArray(data) ? data : (data?.data && Array.isArray(data.data) ? data.data : []);
      setAssignments(assignmentsData);
      if (assignmentsData.length === 0) {
        message.info("Chưa có dữ liệu phân phòng. Vui lòng nhấn 'Tự động xếp phòng' để tạo phân phòng.");
      }
    } catch (err: any) {
      console.error("❌ Lỗi khi tải phân phòng:", err);
      message.error(err?.response?.data?.error || err?.message || "Không thể tải danh sách xếp phòng");
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExams();
  }, []);

  useEffect(() => {
    if (selectedExam) {
      fetchSchedules(selectedExam);
    } else {
      setSchedules([]);
      setSelectedSchedule("");
    }
  }, [selectedExam]);

  useEffect(() => {
    fetchAssignments();
  }, [selectedSchedule]);

  // Auto assign
  const handleAutoAssign = async () => {
    if (!selectedSchedule) {
      message.warning("Vui lòng chọn lịch thi");
      return;
    }
    try {
      setAssigning(true);
      const res = await roomAssignmentApi.autoAssign(selectedSchedule);
      message.success(res?.message || "✅ Đã xếp phòng thi tự động");
      fetchAssignments();
    } catch (err: any) {
      message.error(err?.response?.data?.error || "❌ Lỗi khi xếp phòng thi");
    } finally {
      setAssigning(false);
    }
  };

  // Export PDF
  const handleExportPDF = async () => {
    if (!selectedSchedule) {
      message.warning("Vui lòng chọn lịch thi");
      return;
    }
    if (assignments.length === 0) {
      message.warning("Chưa có dữ liệu phân phòng để xuất PDF");
      return;
    }
    try {
      message.loading({ content: "Đang xuất PDF...", key: "pdf" });
      const url = `/api/exam/room-assignments/export/${selectedSchedule}/pdf`;
      window.open(url, "_blank");
      message.success({ content: "✅ Xuất PDF thành công", key: "pdf" });
    } catch {
      message.error({ content: "❌ Xuất PDF thất bại", key: "pdf" });
    }
  };

  // Reset
  const handleReset = async () => {
    if (!selectedSchedule) {
      message.warning("Vui lòng chọn lịch thi");
      return;
    }
    try {
      await roomAssignmentApi.reset(selectedSchedule);
      message.success("🗑️ Đã reset danh sách xếp phòng thi");
      fetchAssignments();
    } catch (err: any) {
      message.error(err?.response?.data?.error || "❌ Lỗi khi reset danh sách");
    }
  };

  // Filter assignments
  const filteredAssignments = assignments.filter((a) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      a.sbd?.toLowerCase().includes(term) ||
      a.examStudent?.student?.name?.toLowerCase().includes(term) ||
      a.examStudent?.student?.studentCode?.toLowerCase().includes(term) ||
      a.examRoom?.roomCode?.toLowerCase().includes(term)
    );
  });

  // ✅ Group assignments by room
  const assignmentsByRoom = React.useMemo(() => {
    const grouped: Record<string, RoomAssignment[]> = {};
    filteredAssignments.forEach((assignment) => {
      const roomId = assignment.examRoom?._id || "unknown";
      if (!grouped[roomId]) {
        grouped[roomId] = [];
      }
      grouped[roomId].push(assignment);
    });
    return grouped;
  }, [filteredAssignments]);

  // ✅ Get invigilator names for a room
  const getInvigilatorNames = (room: RoomAssignment["examRoom"]) => {
    if (!room?.invigilators || room.invigilators.length === 0) {
      return "Chưa phân công";
    }
    const mainSupervisors = room.invigilators
      .filter((inv) => inv.role === "main" && inv.teacher)
      .map((inv) => inv.teacher?.name)
      .filter(Boolean);
    const assistantSupervisors = room.invigilators
      .filter((inv) => inv.role === "assistant" && inv.teacher)
      .map((inv) => inv.teacher?.name)
      .filter(Boolean);
    
    const parts: string[] = [];
    if (mainSupervisors.length > 0) {
      parts.push(`GT chính: ${mainSupervisors.join(", ")}`);
    }
    if (assistantSupervisors.length > 0) {
      parts.push(`GT phụ: ${assistantSupervisors.join(", ")}`);
    }
    return parts.length > 0 ? parts.join(" | ") : "Chưa phân công";
  };

  const columns = [
    {
      title: "STT",
      dataIndex: "seatNumber",
      key: "seatNumber",
      align: "center" as const,
      width: 80,
      fixed: "left" as const,
    },
    {
      title: "SBD",
      dataIndex: "sbd",
      key: "sbd",
      align: "center" as const,
      width: 120,
      render: (v: string) => <Tag color="blue">{v || "-"}</Tag>,
    },
    {
      title: "Họ tên",
      key: "studentName",
      width: 200,
      render: (_: any, record: RoomAssignment) =>
        record.examStudent?.student?.name || "-",
    },
    {
      title: "Lớp",
      key: "className",
      align: "center" as const,
      width: 120,
      render: (_: any, record: RoomAssignment) => {
        const className = 
          record.examStudent?.student?.classId?.className || 
          record.examStudent?.student?.className || 
          "-";
        return className;
      },
    },
    {
      title: "Phòng thi",
      key: "examRoom",
      align: "center" as const,
      width: 120,
      render: (_: any, record: RoomAssignment) =>
        record.examRoom?.roomCode ? (
          <Tag color="geekblue">{record.examRoom.roomCode}</Tag>
        ) : (
          <Tag color="default">-</Tag>
        ),
    },
    {
      title: "Môn thi",
      key: "subject",
      align: "center" as const,
      width: 150,
      render: (_: any, record: RoomAssignment) =>
        record.schedule?.subject?.name || "-",
    },
    {
      title: "Ngày thi",
      key: "date",
      align: "center" as const,
      width: 120,
      render: (_: any, record: RoomAssignment) =>
        record.schedule?.date
          ? dayjs(record.schedule.date).format("DD/MM/YYYY")
          : "-",
    },
    {
      title: "Giờ thi",
      key: "startTime",
      align: "center" as const,
      width: 150,
      render: (_: any, record: RoomAssignment) => {
        if (!record.schedule?.startTime) return "-";
        const startTime = record.schedule.startTime;
        const endTime = record.schedule.endTime;
        if (endTime) {
          return `${startTime} - ${endTime}`;
        }
        return startTime;
      },
    },
  ];

  const selectedScheduleData = schedules.find((s) => s._id === selectedSchedule);
  const selectedExamData = exams.find((e) => e._id === selectedExam);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Title level={2} style={{ margin: 0 }}>
            Quản lý phân phòng thi
          </Title>
          <p className="text-muted-foreground">
            Xem và quản lý phân phòng thi cho các lịch thi
          </p>
        </div>
        <Button icon={<RefreshCcw size={16} />} onClick={fetchAssignments}>
          Làm mới
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Kỳ thi</label>
              <Select
                style={{ width: "100%" }}
                placeholder="Chọn kỳ thi"
                value={selectedExam || undefined}
                onChange={(v) => {
                  setSelectedExam(v);
                  setSelectedSchedule("");
                }}
              >
                {exams.map((exam) => (
                  <Option key={exam._id} value={exam._id}>
                    {exam.name} ({exam.year} - HK{exam.semester})
                  </Option>
                ))}
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Lịch thi</label>
              <Select
                style={{ width: "100%" }}
                placeholder="Chọn lịch thi"
                value={selectedSchedule || undefined}
                onChange={setSelectedSchedule}
                disabled={!selectedExam}
              >
                {schedules.map((schedule) => (
                  <Option key={schedule._id} value={schedule._id}>
                    {schedule.subject?.name || "Môn học"} - Khối {schedule.grade} -{" "}
                    {schedule.date ? dayjs(schedule.date).format("DD/MM/YYYY") : ""}
                  </Option>
                ))}
              </Select>
            </div>
          </div>

          {selectedSchedule && (
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                type="primary"
                icon={<Zap size={16} />}
                onClick={handleAutoAssign}
                loading={assigning}
              >
                Tự động xếp phòng
              </Button>
              <Button
                icon={<FilePdfOutlined />}
                onClick={handleExportPDF}
              >
                Xuất PDF
              </Button>
              <Button danger onClick={handleReset}>
                Reset
              </Button>
            </div>
          )}
        </Space>
      </Card>

      {/* Info Card */}
      {selectedScheduleData && selectedExamData && (
        <Card>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Kỳ thi</p>
              <p className="font-semibold">{selectedExamData.name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Môn thi</p>
              <p className="font-semibold">
                {selectedScheduleData.subject?.name || "-"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Tổng số học sinh</p>
              <p className="font-semibold">{filteredAssignments.length}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Search */}
      {selectedSchedule && (
        <Card>
          <Input
            placeholder="Tìm kiếm theo SBD, tên học sinh, lớp, phòng thi..."
            prefix={<Search size={16} />}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            allowClear
          />
        </Card>
      )}

      {/* Tables grouped by room */}
      <div className="space-y-6">
        {!selectedSchedule ? (
          <Card>
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-lg mb-2">Vui lòng chọn kỳ thi và lịch thi</p>
              <p className="text-sm">Sau khi chọn lịch thi, bạn có thể xem và quản lý phân phòng thi</p>
            </div>
          </Card>
        ) : filteredAssignments.length === 0 && !loading ? (
          <Card>
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-lg mb-2">Chưa có dữ liệu phân phòng</p>
              <p className="text-sm mb-4">Nhấn nút "Tự động xếp phòng" để tạo phân phòng cho lịch thi này</p>
              <Button
                type="primary"
                icon={<Zap size={16} />}
                onClick={handleAutoAssign}
                loading={assigning}
              >
                Tự động xếp phòng
              </Button>
            </div>
          </Card>
        ) : (
          Object.entries(assignmentsByRoom).map(([roomId, roomAssignments]) => {
            const firstAssignment = roomAssignments[0];
            const roomCode = firstAssignment?.examRoom?.roomCode || "Unknown";
            const invigilators = getInvigilatorNames(firstAssignment?.examRoom);
            
            return (
              <Card key={roomId} className="shadow-sm">
                <div className="mb-4 pb-4 border-b">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Tag color="blue" style={{ fontSize: "14px", padding: "4px 12px" }}>
                          Phòng thi: {roomCode}
                        </Tag>
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        <strong>Giám thị:</strong> {invigilators}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Số học sinh: <strong>{roomAssignments.length}</strong> học sinh
                      </p>
                    </div>
                  </div>
                </div>
                <Table
                  dataSource={roomAssignments}
                  columns={columns}
                  rowKey={(r) => r._id}
                  loading={loading}
                  pagination={{ 
                    pageSize: 50,
                    showSizeChanger: false,
                    hideOnSinglePage: true,
                  }}
                  scroll={{ x: 1200 }}
                  size="small"
                />
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

