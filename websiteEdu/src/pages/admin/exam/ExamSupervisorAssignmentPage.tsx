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
  Modal,
  Form,
  Checkbox,
} from "antd";
import {
  RefreshCcw,
  UserCheck,
  Zap,
  Edit,
  Users,
} from "lucide-react";
import { examApi } from "@/services/exams/examApi";
import { examScheduleApi } from "@/services/exams/examScheduleApi";
import { examRoomApi } from "@/services/exams/examRoomApi";
import { teacherApi } from "@/services/teacherApi";
import dayjs from "dayjs";

const { Title } = Typography;
const { Option } = Select;

interface ExamRoom {
  _id: string;
  roomCode: string;
  schedule?: {
    _id: string;
    subject?: {
      name: string;
    };
    date: string;
    startTime: string;
    grade: number;
  };
  invigilators?: Array<{
    teacher: {
      _id: string;
      name: string;
      teacherCode?: string;
    };
    role: "main" | "assistant";
  }>;
  capacity?: number;
  fixedExamRoom?: {
    code: string;
    capacity: number;
  };
}

interface Teacher {
  _id: string;
  name: string;
  teacherCode?: string;
}

export default function ExamSupervisorAssignmentPage() {
  const [rooms, setRooms] = useState<ExamRoom[]>([]);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [exams, setExams] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedExam, setSelectedExam] = useState<string>("");
  const [selectedSchedule, setSelectedSchedule] = useState<string>("");
  const [editingRoom, setEditingRoom] = useState<ExamRoom | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  // Fetch exams - chỉ lấy exam đã công bố (published)
  const fetchExams = async () => {
    try {
      const res = await examApi.getAll({ status: "published" });
      const examsData = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
      // ✅ Chỉ lấy exam có status = "published"
      setExams(examsData.filter((exam: any) => exam.status === "published"));
    } catch (err) {
      console.error("❌ Lỗi tải kỳ thi:", err);
    }
  };

  // Fetch schedules by exam - chỉ lấy lịch thi đã xác nhận (confirmed)
  const fetchSchedules = async (examId: string) => {
    try {
      if (!examId) {
        setSchedules([]);
        return;
      }
      const res = await examScheduleApi.getByExam(examId);
      const schedulesData = Array.isArray(res) ? res : (res?.data || []);
      // ✅ Chỉ lấy lịch thi đã xác nhận (confirmed) hoặc không có status (mặc định là confirmed)
      setSchedules(schedulesData.filter((schedule: any) => 
        !schedule.status || schedule.status === "confirmed" || schedule.status === "published"
      ));
    } catch (err) {
      console.error("❌ Lỗi tải lịch thi:", err);
      setSchedules([]);
    }
  };

  // Fetch teachers
  const fetchTeachers = async () => {
    try {
      const res = await teacherApi.getAll();
      setTeachers(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error("❌ Lỗi tải giáo viên:", err);
    }
  };

  // Fetch rooms
  const fetchRooms = async () => {
    if (!selectedExam) {
      setRooms([]);
      return;
    }
    try {
      setLoading(true);
      let data;
      if (selectedSchedule) {
        // Lấy phòng theo schedule cụ thể
        const res = await examRoomApi.getBySchedule(selectedSchedule);
        data = res?.data || res;
      } else {
        // Lấy tất cả phòng theo exam
        const res = await examRoomApi.getByExam(selectedExam);
        data = res?.data || res;
      }
      setRooms(Array.isArray(data) ? data : []);
    } catch (err: any) {
      message.error(err?.response?.data?.error || "Không thể tải danh sách phòng thi");
      setRooms([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExams();
    fetchTeachers();
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
    fetchRooms();
  }, [selectedExam, selectedSchedule]);

  // Auto assign invigilators
  const handleAutoAssign = async () => {
    if (!selectedSchedule || !selectedExam) {
      message.warning("Vui lòng chọn kỳ thi và lịch thi");
      return;
    }
    try {
      setAssigning(true);
      const res = await examRoomApi.autoAssignInvigilators({
        examId: selectedExam,
        scheduleId: selectedSchedule,
      });
      message.success(res?.message || "✅ Đã phân công giám thị tự động");
      fetchRooms();
    } catch (err: any) {
      message.error(err?.response?.data?.error || "❌ Lỗi khi phân công giám thị");
    } finally {
      setAssigning(false);
    }
  };

  // Auto assign for entire exam
  const handleAutoAssignForExam = async () => {
    if (!selectedExam) {
      message.warning("Vui lòng chọn kỳ thi");
      return;
    }
    try {
      setAssigning(true);
      const res = await examRoomApi.autoAssignInvigilatorsForExam({
        examId: selectedExam,
      });
      message.success(res?.message || "✅ Đã phân công giám thị tự động cho toàn bộ kỳ thi");
      fetchRooms();
    } catch (err: any) {
      message.error(err?.response?.data?.error || "❌ Lỗi khi phân công giám thị");
    } finally {
      setAssigning(false);
    }
  };

  // Open edit modal
  const handleEdit = (room: ExamRoom) => {
    setEditingRoom(room);
    const currentInvigilators = room.invigilators || [];
    form.setFieldsValue({
      mainInvigilator: currentInvigilators.find((i) => i.role === "main")?.teacher?._id,
      assistantInvigilator: currentInvigilators.find((i) => i.role === "assistant")?.teacher?._id,
    });
    setModalOpen(true);
  };

  // Save invigilators
  const handleSave = async (values: any) => {
    if (!editingRoom) return;

    try {
      const invigilators: Array<{ teacherId: string; role: string }> = [];
      
      if (values.mainInvigilator) {
        invigilators.push({
          teacherId: values.mainInvigilator,
          role: "main",
        });
      }
      
      if (values.assistantInvigilator) {
        invigilators.push({
          teacherId: values.assistantInvigilator,
          role: "assistant",
        });
      }

      await examRoomApi.assignInvigilators(editingRoom._id, invigilators);
      message.success("✅ Đã cập nhật giám thị thành công");
      setModalOpen(false);
      setEditingRoom(null);
      form.resetFields();
      fetchRooms();
    } catch (err: any) {
      message.error(err?.response?.data?.error || "❌ Lỗi khi cập nhật giám thị");
    }
  };

  const columns = [
    {
      title: "Phòng thi",
      dataIndex: "roomCode",
      key: "roomCode",
      align: "center" as const,
      width: 120,
      fixed: "left" as const,
      render: (v: string) => <Tag color="blue">{v || "-"}</Tag>,
    },
    {
      title: "Môn thi",
      key: "subject",
      align: "center" as const,
      width: 150,
      render: (_: any, record: ExamRoom) =>
        record.schedule?.subject?.name || "-",
    },
    {
      title: "Ngày thi",
      key: "date",
      align: "center" as const,
      width: 120,
      render: (_: any, record: ExamRoom) =>
        record.schedule?.date
          ? dayjs(record.schedule.date).format("DD/MM/YYYY")
          : "-",
    },
    {
      title: "Giờ thi",
      key: "startTime",
      align: "center" as const,
      render: (_: any, record: ExamRoom) => {
        if (!record.schedule?.startTime) return "-";
        const startTime = record.schedule.startTime;
        const endTime = record.schedule.endTime;
        if (endTime) {
          return `${startTime} - ${endTime}`;
        }
        return startTime;
      },
    },
    {
      title: "Sức chứa",
      key: "capacity",
      align: "center" as const,
      width: 100,
      render: (_: any, record: ExamRoom) => {
        const capacity = record.capacity || record.fixedExamRoom?.capacity || 0;
        return capacity > 0 ? <Tag color="blue">{capacity}</Tag> : "-";
      },
    },
    {
      title: "Giám thị chính",
      key: "mainInvigilator",
      align: "center" as const,
      width: 200,
      render: (_: any, record: ExamRoom) => {
        const main = record.invigilators?.find((i) => i.role === "main");
        return main?.teacher ? (
          <Tag color="green">
            {main.teacher.name} {main.teacher.teacherCode ? `(${main.teacher.teacherCode})` : ""}
          </Tag>
        ) : (
          <Tag color="default">Chưa phân công</Tag>
        );
      },
    },
    {
      title: "Giám thị phụ",
      key: "assistantInvigilator",
      align: "center" as const,
      width: 200,
      render: (_: any, record: ExamRoom) => {
        const assistant = record.invigilators?.find((i) => i.role === "assistant");
        return assistant?.teacher ? (
          <Tag color="orange">
            {assistant.teacher.name} {assistant.teacher.teacherCode ? `(${assistant.teacher.teacherCode})` : ""}
          </Tag>
        ) : (
          <Tag color="default">Chưa phân công</Tag>
        );
      },
    },
    {
      title: "Hành động",
      align: "center" as const,
      width: 120,
      fixed: "right" as const,
      render: (_: any, record: ExamRoom) => (
        <Button
          size="small"
          icon={<Edit size={16} />}
          onClick={() => handleEdit(record)}
        >
          Phân công
        </Button>
      ),
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
            Phân công giám thị
          </Title>
          <p className="text-muted-foreground">
            Quản lý phân công giám thị cho các phòng thi
          </p>
        </div>
        <Button icon={<RefreshCcw size={16} />} onClick={fetchRooms}>
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
                placeholder="Chọn lịch thi (để trống = tất cả lịch thi)"
                value={selectedSchedule || undefined}
                onChange={setSelectedSchedule}
                allowClear
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

          {selectedExam && (
            <div className="flex items-center gap-2 flex-wrap">
              {selectedSchedule && (
                <Button
                  type="primary"
                  icon={<Zap size={16} />}
                  onClick={handleAutoAssign}
                  loading={assigning}
                >
                  Tự động phân công (lịch này)
                </Button>
              )}
              <Button
                type="primary"
                icon={<Zap size={16} />}
                onClick={handleAutoAssignForExam}
                loading={assigning}
              >
                Tự động phân công (toàn bộ kỳ thi)
              </Button>
            </div>
          )}
        </Space>
      </Card>

      {/* Info Card */}
      {selectedExamData && (
        <Card>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Kỳ thi</p>
              <p className="font-semibold">{selectedExamData.name}</p>
            </div>
            {selectedScheduleData && (
              <div>
                <p className="text-sm text-muted-foreground">Môn thi</p>
                <p className="font-semibold">
                  {selectedScheduleData.subject?.name || "-"}
                </p>
              </div>
            )}
            <div>
              <p className="text-sm text-muted-foreground">Tổng số phòng</p>
              <p className="font-semibold">{rooms.length}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Table */}
      <Card>
        {!selectedExam ? (
          <div className="text-center py-12 text-muted-foreground">
            Vui lòng chọn kỳ thi để xem danh sách phòng thi
          </div>
        ) : (
          <Table
            dataSource={rooms}
            columns={columns}
            rowKey={(r) => r._id}
            loading={loading}
            pagination={{ 
              pageSize: 20, 
              showSizeChanger: true,
              showTotal: (total) => `Tổng ${total} phòng thi`,
              pageSizeOptions: ["10", "20", "50", "100"],
            }}
            scroll={{ x: 1200 }}
          />
        )}
      </Card>

      {/* Edit Modal */}
      <Modal
        title="Phân công giám thị"
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setEditingRoom(null);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        okText="Lưu"
        width={600}
      >
        {editingRoom && (
          <div className="mb-4">
            <p className="text-sm text-muted-foreground">Phòng thi</p>
            <p className="font-semibold">{editingRoom.roomCode}</p>
            {editingRoom.schedule && (
              <>
                <p className="text-sm text-muted-foreground mt-2">Môn thi</p>
                <p className="font-semibold">
                  {editingRoom.schedule.subject?.name || "-"}
                </p>
              </>
            )}
          </div>
        )}

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
        >
          <Form.Item
            name="mainInvigilator"
            label="Giám thị chính"
          >
            <Select
              placeholder="Chọn giám thị chính"
              allowClear
              showSearch
              filterOption={(input, option) =>
                (option?.children as string)
                  ?.toLowerCase()
                  .includes(input.toLowerCase())
              }
            >
              {teachers.map((teacher) => (
                <Option key={teacher._id} value={teacher._id}>
                  {teacher.name} ({teacher.teacherCode || "-"})
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="assistantInvigilator"
            label="Giám thị phụ"
          >
            <Select
              placeholder="Chọn giám thị phụ"
              allowClear
              showSearch
              filterOption={(input, option) =>
                (option?.children as string)
                  ?.toLowerCase()
                  .includes(input.toLowerCase())
              }
            >
              {teachers.map((teacher) => (
                <Option key={teacher._id} value={teacher._id}>
                  {teacher.name} ({teacher.teacherCode || "-"})
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

