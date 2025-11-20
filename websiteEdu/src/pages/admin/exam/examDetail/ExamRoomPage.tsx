import React, { useEffect, useState, useMemo } from "react";
import {
  Table,
  Button,
  Space,
  message,
  Modal,
  Tag,
  Typography,
  Select,
  Spin,
  Popconfirm,
  Form,
  Input,
  InputNumber,
  Card,
  Row,
  Col,
  Divider,
} from "antd";
import {
  ReloadOutlined,
  FilePdfOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  BarChartOutlined,
  SearchOutlined,
  EyeOutlined,
  AppstoreOutlined,
  UnorderedListOutlined,
  CalendarOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import { examRoomApi } from "@/services/exams/examRoomApi";
// ✅ Sử dụng hooks thay vì API trực tiếp
import { useTeachers } from "@/hooks";
import { examScheduleApi } from "@/services/exams/examScheduleApi";
import { examStudentApi } from "@/services/exams/examStudentApi";
import { roomAssignmentApi } from "@/services/exams/roomAssignmentApi";
import { roomApi } from "@/services/roomApi";
import { usePermissions } from "@/hooks/usePermissions";

const { Title, Text } = Typography;
const { Option } = Select;

interface ExamRoomPageProps {
  examId: string;
  exam: any;
}

/** 🎨 Component hiển thị phòng thi theo dạng trực quan (grid) */
interface VisualRoomViewProps {
  examId: string;
  selectedDate: string;
  schedules: any[];
  rooms: any[];
  allPhysicalRooms: any[];
  loading: boolean;
  onMoveFixedRoom: (examRoomId: string, newRoomId: string, scheduleId: string) => Promise<void>;
  onAssignFixedRoomToPhysicalRoom: (fixedRoomId: string, roomId: string, scheduleId: string) => Promise<void>; // ✅ Hàm để lưu trực tiếp khi kéo FixedExamRoom
  draggingFixedRoom: any | null;
  setDraggingFixedRoom: (room: any | null) => void;
  pendingMappings: Array<{ fixedRoomId: string; roomId: string; scheduleId: string }>;
  setPendingMappings: React.Dispatch<React.SetStateAction<Array<{ fixedRoomId: string; roomId: string; scheduleId: string }>>>;
  fixedRooms: any[]; // ✅ Danh sách FixedExamRooms
  loadingFixedRooms: boolean;
}

const VisualRoomView: React.FC<VisualRoomViewProps> = ({
  examId,
  selectedDate,
  schedules,
  rooms,
  allPhysicalRooms,
  loading,
  onMoveFixedRoom,
  onAssignFixedRoomToPhysicalRoom,
  draggingFixedRoom,
  setDraggingFixedRoom,
  pendingMappings,
  setPendingMappings,
  fixedRooms,
  loadingFixedRooms,
}) => {
  // Lấy exam rooms theo ngày và schedule
  const getRoomInfoForDate = (physicalRoomId: string, scheduleId: string) => {
    const examRoom = rooms.find(
      (r) => r.room?._id === physicalRoomId && r.schedule?._id === scheduleId
    );
    return examRoom;
  };

  // ✅ Các mốc thời gian để hiển thị
  const timeMarkers = ["07:00", "08:00", "09:00", "10:00", "11:00", "12:00", "12:30", "13:00", "14:00", "15:00", "16:00", "17:00"];

  // Lấy tất cả schedules cho ngày đã chọn và sắp xếp theo thời gian
  const schedulesForDate = useMemo(() => {
    if (!selectedDate) return [];
    // selectedDate đã là format YYYY-MM-DD từ input date
    const dateStr = selectedDate;
    const filtered = schedules.filter((s) => {
      if (!s?.date) return false;
      // Chuyển đổi date về format YYYY-MM-DD để so sánh (tránh timezone issues)
      const scheduleDate = new Date(s.date);
      // Lấy năm, tháng, ngày theo local timezone
      const year = scheduleDate.getFullYear();
      const month = String(scheduleDate.getMonth() + 1).padStart(2, '0');
      const day = String(scheduleDate.getDate()).padStart(2, '0');
      const scheduleDateStr = `${year}-${month}-${day}`;
      return scheduleDateStr === dateStr;
    });
    
    // ✅ Sắp xếp theo thời gian bắt đầu
    return filtered.sort((a, b) => {
      const timeA = a.startTime || "00:00";
      const timeB = b.startTime || "00:00";
      return timeA.localeCompare(timeB);
    });
  }, [selectedDate, schedules]);

  // Xử lý drag start
  const handleDragStart = (e: React.DragEvent, examRoom: any) => {
    setDraggingFixedRoom(examRoom);
    e.dataTransfer.effectAllowed = "move";
  };

  // Xử lý drag over
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  // Xử lý drop
  const handleDrop = async (e: React.DragEvent, targetRoomId: string, scheduleId: string) => {
    e.preventDefault();
    
    // ✅ Kiểm tra nếu kéo từ panel phải (FixedExamRoom chưa xếp) - LƯU TRỰC TIẾP
    if (draggingFixedRoom?.type === "fixedRoom") {
      const fixedRoom = draggingFixedRoom.fixedRoom;
      if (fixedRoom && fixedRoom._id) {
        await onAssignFixedRoomToPhysicalRoom(String(fixedRoom._id), targetRoomId, scheduleId);
        setDraggingFixedRoom(null);
        return;
      }
    }

    // ✅ Kéo từ phòng vật lý (ExamRoom)
    if (!draggingFixedRoom || draggingFixedRoom.type === "fixedRoom") {
      setDraggingFixedRoom(null);
      return;
    }

    const examRoomId = draggingFixedRoom._id;
    const fromRoomId = draggingFixedRoom.room?._id;
    if (!examRoomId || !fromRoomId || fromRoomId === targetRoomId) {
      setDraggingFixedRoom(null);
      return;
    }

    await onMoveFixedRoom(examRoomId, targetRoomId, scheduleId);
    setDraggingFixedRoom(null);
  };

  if (!selectedDate) {
    return (
      <Card>
        <Text type="secondary">Vui lòng chọn ngày để xem phòng thi</Text>
      </Card>
    );
  }

  return (
    <Spin spinning={loading}>
      <div style={{ marginTop: 16 }}>
        {/* ✅ Timeline với các mốc thời gian */}
        {schedulesForDate.length > 0 && (
          <Card size="small" style={{ marginBottom: 16, backgroundColor: "#f5f5f5" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <Text strong style={{ marginRight: 8 }}>Mốc thời gian:</Text>
              {timeMarkers.map((time) => {
                // Kiểm tra xem có schedule nào bắt đầu tại mốc thời gian này không
                const hasSchedule = schedulesForDate.some((s) => {
                  const [sh, sm] = (s.startTime || "00:00").split(":").map(Number);
                  const [th, tm] = time.split(":").map(Number);
                  return sh === th && sm === tm;
                });
                
                return (
                  <Tag
                    key={time}
                    color={hasSchedule ? "blue" : "default"}
                    style={{
                      cursor: "default",
                      fontWeight: hasSchedule ? "bold" : "normal",
                    }}
                  >
                    {time}
                  </Tag>
                );
              })}
            </div>
          </Card>
        )}

        {schedulesForDate.length === 0 ? (
          <Card>
            <Text type="secondary">Không có lịch thi nào trong ngày này</Text>
          </Card>
        ) : (
          schedulesForDate.map((schedule) => {
            const scheduleRooms = rooms.filter((r) => r.schedule?._id === schedule._id);
            const usedRoomIds = scheduleRooms.map((r) => r.room?._id).filter(Boolean);
            
            // ✅ Lấy các FixedExamRoom đã được xếp vào phòng thi vật lý cho schedule này
            const assignedFixedRoomIds = new Set(
              scheduleRooms.map((r) => String(r.fixedExamRoom?._id || r.fixedExamRoom)).filter(Boolean)
            );
            
            // ✅ Lấy các FixedExamRoom chưa được xếp (cùng grade với schedule và cùng exam)
            // ✅ Check theo exam, không chỉ theo schedule
            const unassignedFixedRooms = fixedRooms.filter(
              (fr) => {
                // ✅ Phải cùng grade với schedule
                if (String(fr.grade) !== String(schedule.grade)) return false;
                
                // ✅ Phải cùng exam (kiểm tra exam._id hoặc exam nếu là string)
                const frExamId = String(fr.exam?._id || fr.exam || "");
                const scheduleExamId = String(schedule.exam?._id || schedule.exam || examId);
                if (frExamId && scheduleExamId && frExamId !== scheduleExamId) return false;
                
                // ✅ Chưa được xếp vào schedule này
                if (assignedFixedRoomIds.has(String(fr._id))) return false;
                
                // ✅ Không có trong pendingMappings cho schedule này
                if (pendingMappings.some((m) => m.fixedRoomId === String(fr._id) && m.scheduleId === schedule._id)) return false;
                
                return true;
              }
            );

            // ✅ Tính vị trí trên timeline dựa trên thời gian bắt đầu
            const getTimePosition = (timeStr: string) => {
              const [h, m] = timeStr.split(":").map(Number);
              const totalMinutes = h * 60 + m;
              // Tính vị trí từ 7h (420 phút) đến 17h (1020 phút) = 600 phút
              const startMinutes = 7 * 60; // 7h = 420 phút
              const endMinutes = 17 * 60; // 17h = 1020 phút
              const range = endMinutes - startMinutes; // 600 phút
              const position = ((totalMinutes - startMinutes) / range) * 100;
              return Math.max(0, Math.min(100, position));
            };

            const startPosition = getTimePosition(schedule.startTime || "07:00");
            const [endH, endM] = (schedule.endTime || schedule.startTime || "08:00").split(":").map(Number);
            const endTotalMinutes = endH * 60 + endM;
            const [startH, startM] = (schedule.startTime || "07:00").split(":").map(Number);
            const startTotalMinutes = startH * 60 + startM;
            const durationMinutes = endTotalMinutes - startTotalMinutes;
            const widthPercent = (durationMinutes / (17 * 60 - 7 * 60)) * 100;

            return (
              <Card
                key={schedule._id}
                title={
                  <Space>
                    <Tag color="blue">
                      {schedule.subject?.name || 
                       (typeof schedule.subject === 'object' && schedule.subject?.name) || 
                       (typeof schedule.subject === 'string' ? schedule.subject : "Chưa có môn")}
                    </Tag>
                    <Text>Khối {schedule.grade}</Text>
                    <Tag color="orange" style={{ fontWeight: "bold" }}>
                      🕐 {schedule.startTime} - {schedule.endTime}
                    </Tag>
                    <Text type="secondary">
                      {new Date(schedule.date).toLocaleDateString()}
                    </Text>
                  </Space>
                }
                style={{ marginBottom: 16 }}
                extra={
                  <div style={{ 
                    position: "relative", 
                    width: "220px", 
                    height: "28px", 
                    backgroundColor: "#f5f5f5", 
                    borderRadius: "14px",
                    border: "1px solid #e8e8e8",
                    boxShadow: "inset 0 1px 3px rgba(0,0,0,0.08)",
                    overflow: "hidden"
                  }}>
                    {/* Timeline bar - Đẹp hơn */}
                    <div
                      style={{
                        position: "absolute",
                        left: `${startPosition}%`,
                        width: `${Math.max(8, widthPercent)}%`,
                        height: "100%",
                        background: "linear-gradient(135deg, #1890ff 0%, #096dd9 100%)",
                        borderRadius: "14px",
                        boxShadow: "0 2px 6px rgba(24, 144, 255, 0.4), inset 0 1px 0 rgba(255,255,255,0.2)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        minWidth: "55px",
                        transition: "all 0.2s ease",
                      }}
                    >
                      <Text 
                        style={{ 
                          fontSize: "12px", 
                          color: "white", 
                          fontWeight: "bold",
                          textShadow: "0 1px 2px rgba(0,0,0,0.3)",
                          whiteSpace: "nowrap",
                          letterSpacing: "0.5px"
                        }}
                      >
                        {schedule.startTime}
                      </Text>
                    </div>
                  </div>
                }
              >
                <Row gutter={[16, 16]}>
                  {/* ✅ Panel trái: Phòng vật lý (Room) */}
                  <Col xs={24} lg={16}>
                    <Card size="small" title="Phòng vật lý (Room)" style={{ height: "100%" }}>
                      <Row gutter={[12, 12]}>
                        {allPhysicalRooms.map((physicalRoom) => {
                    // ✅ physicalRoom là Room (phòng vật lý thật)
                    // ✅ Tìm ExamRoom nào đang sử dụng Room này cho schedule này
                    const examRoom = getRoomInfoForDate(physicalRoom._id, schedule._id);
                    const isUsed = !!examRoom;
                    const isDragging = draggingFixedRoom?.room?._id === physicalRoom._id;

                    return (
                      <Col xs={12} sm={8} md={6} lg={4} key={physicalRoom._id}>
                        <div
                          draggable={isUsed}
                          onDragStart={(e) => isUsed && examRoom && handleDragStart(e, examRoom)}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, physicalRoom._id, schedule._id)}
                          style={{
                            padding: 12,
                            border: `2px solid ${
                              isUsed
                                ? "#52c41a"
                                : isDragging
                                ? "#1890ff"
                                : "#d9d9d9"
                            }`,
                            borderRadius: 8,
                            backgroundColor: isUsed ? "#f6ffed" : isDragging ? "#e6f7ff" : "#fafafa",
                            cursor: isUsed ? "grab" : "default",
                            minHeight: 100,
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "center",
                            alignItems: "center",
                            transition: "all 0.2s",
                            opacity: isDragging ? 0.5 : 1,
                          }}
                        >
                          {/* ✅ Hiển thị thông tin Room (phòng vật lý thật) */}
                          <Text strong style={{ fontSize: 14, marginBottom: 4 }}>
                            {physicalRoom.roomCode}
                          </Text>
                          {physicalRoom.type && (
                            <Tag
                              color={
                                physicalRoom.type === "lab"
                                  ? "orange"
                                  : physicalRoom.type === "computer"
                                  ? "cyan"
                                  : "green"
                              }
                              style={{ marginBottom: 4 }}
                            >
                              {physicalRoom.type === "lab"
                                ? "Lab"
                                : physicalRoom.type === "computer"
                                ? "Máy"
                                : "Thường"}
                            </Tag>
                          )}
                          {isUsed ? (
                            <div style={{ textAlign: "center", marginTop: 4 }}>
                              {/* ✅ Nếu Room này đang được sử dụng bởi ExamRoom */}
                              <Text strong style={{ color: "#52c41a", fontSize: 12 }}>
                                {schedule.subject?.name || 
                                 (typeof schedule.subject === 'object' && schedule.subject?.name) || 
                                 (typeof schedule.subject === 'string' ? schedule.subject : "Chưa có môn")}
                              </Text>
                              <br />
                              <Text type="secondary" style={{ fontSize: 11 }}>
                                Khối {schedule.grade}
                              </Text>
                              {/* ✅ Hiển thị FixedExamRoom (phòng nhóm) đang được gán vào Room này */}
                              {examRoom?.fixedExamRoom?.code && (
                                <div style={{ marginTop: 4 }}>
                                  <Tag color="purple" style={{ fontSize: 10 }}>
                                    Nhóm: {examRoom.fixedExamRoom.code}
                                  </Tag>
                                </div>
                              )}
                              {/* Hiển thị nếu có trong pendingMappings */}
                              {pendingMappings.some(
                                (m) => m.roomId === physicalRoom._id && m.scheduleId === schedule._id
                              ) && (
                                <div style={{ marginTop: 4 }}>
                                  <Tag color="orange" style={{ fontSize: 9 }}>
                                    Chờ lưu
                                  </Tag>
                                </div>
                              )}
                            </div>
                          ) : (
                            <Text type="secondary" style={{ fontSize: 11, marginTop: 4 }}>
                              Trống
                            </Text>
                          )}
                        </div>
                      </Col>
                    );
                  })}
                      </Row>
                    </Card>
                  </Col>
                  
                  {/* ✅ Panel phải: FixedExamRoom (phòng nhóm) chưa được xếp vào Room (phòng vật lý) */}
                  <Col xs={24} lg={8}>
                    <Card 
                      size="small" 
                      title={`Phòng nhóm (FixedExamRoom) chưa xếp (${unassignedFixedRooms.length})`}
                      style={{ height: "100%" }}
                    >
                      <Spin spinning={loadingFixedRooms}>
                        {unassignedFixedRooms.length === 0 ? (
                          <Text type="secondary">Tất cả phòng nhóm đã được xếp</Text>
                        ) : (
                          <div style={{ maxHeight: "600px", overflowY: "auto" }}>
                            {unassignedFixedRooms.map((fixedRoom) => (
                              <div
                                key={fixedRoom._id}
                                draggable
                                onDragStart={(e) => {
                                  setDraggingFixedRoom({ 
                                    type: "fixedRoom", 
                                    fixedRoom,
                                    scheduleId: schedule._id 
                                  });
                                  e.dataTransfer.effectAllowed = "move";
                                }}
                                onDragEnd={() => setDraggingFixedRoom(null)}
                                style={{
                                  padding: 12,
                                  marginBottom: 8,
                                  border: "2px dashed #d9d9d9",
                                  borderRadius: 8,
                                  backgroundColor: "#fafafa",
                                  cursor: "grab",
                                  transition: "all 0.2s",
                                }}
                              >
                                <Text strong style={{ fontSize: 13, display: "block", marginBottom: 4 }}>
                                  {fixedRoom.code}
                                </Text>
                                <Text type="secondary" style={{ fontSize: 11 }}>
                                  {fixedRoom.capacity || fixedRoom.studentsCount || 0} học sinh
                                </Text>
                                {pendingMappings.some(
                                  (m) => m.fixedRoomId === String(fixedRoom._id) && m.scheduleId === schedule._id
                                ) && (
                                  <Tag color="orange" style={{ fontSize: 9, marginTop: 4, display: "block" }}>
                                    Chờ lưu
                                  </Tag>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </Spin>
                    </Card>
                  </Col>
                </Row>
              </Card>
            );
          })
        )}
      </div>
    </Spin>
  );
};

export default function ExamRoomPage({ examId, exam }: ExamRoomPageProps) {
  const { hasPermission, PERMISSIONS } = usePermissions();
  const [rooms, setRooms] = useState<any[]>([]);
  // ✅ Sử dụng hooks
  const { teachers } = useTeachers();
  const [schedules, setSchedules] = useState<any[]>([]);
  const [stats, setStats] = useState<any | null>(null);

  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);

  // 🔍 Filters
  const [filters, setFilters] = useState({
    schedule: "Tất cả",
    grade: "Tất cả",
    keyword: "",
  });
  const [pageSize, setPageSize] = useState(10);

  // 🎨 View mode: "table" | "visual"
  const [viewMode, setViewMode] = useState<"table" | "visual">("table");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [allPhysicalRooms, setAllPhysicalRooms] = useState<any[]>([]);
  const [loadingPhysicalRooms, setLoadingPhysicalRooms] = useState(false);
  const [draggingFixedRoom, setDraggingFixedRoom] = useState<any | null>(null);

  // create modal
  const [openCreate, setOpenCreate] = useState(false);
  const [createForm] = Form.useForm();
  const [availableRooms, setAvailableRooms] = useState<any[]>([]);
  const [loadingAvailableRooms, setLoadingAvailableRooms] = useState(false);
  const [availableFixedRoomsForCreate, setAvailableFixedRoomsForCreate] = useState<any[]>([]);
  const [loadingFixedRoomsForCreate, setLoadingFixedRoomsForCreate] = useState(false);


  // assign modal
  const [selectedRoom, setSelectedRoom] = useState<any | null>(null);
  const [selectedInvigilators, setSelectedInvigilators] = useState<string[]>([]);


  // view students modal
  const [viewStudentsModalOpen, setViewStudentsModalOpen] = useState(false);
  const [viewStudentsRoom, setViewStudentsRoom] = useState<any | null>(null);
  const [roomStudents, setRoomStudents] = useState<any[]>([]);
  const [loadingRoomStudents, setLoadingRoomStudents] = useState(false);

  // ✅ pendingMappings chỉ dùng cho việc di chuyển ExamRoom (kéo từ phòng vật lý này sang phòng vật lý khác)
  // ✅ Không cần cho FixedExamRoom nữa vì đã lưu trực tiếp khi kéo thả
  const [pendingMappings, setPendingMappings] = useState<Array<{ fixedRoomId: string; roomId: string; scheduleId: string }>>([]);

  // 🏫 Phân phòng nhóm vào phòng thi modal
  const [openAssignFixedToExamRooms, setOpenAssignFixedToExamRooms] = useState(false);
  const [selectedScheduleForAssign, setSelectedScheduleForAssign] = useState<string>(""); // "" = Tất cả, hoặc scheduleId cụ thể
  const [fixedRooms, setFixedRooms] = useState<any[]>([]);
  const [loadingFixedRooms, setLoadingFixedRooms] = useState(false);
  const [roomMappings, setRoomMappings] = useState<Array<{ fixedRoomId: string; roomId: string; scheduleId?: string }>>([]); // ✅ Thêm scheduleId cho mode "Tất cả"
  const [assigningFixedToExam, setAssigningFixedToExam] = useState(false);
  const [allRooms, setAllRooms] = useState<any[]>([]);
  const [loadingAllRooms, setLoadingAllRooms] = useState(false);
  const [scheduleRoomMappings, setScheduleRoomMappings] = useState<Record<string, Array<{ fixedRoomId: string; roomId: string }>>>({}); // ✅ Lưu mappings cho từng schedule khi chọn "Tất cả"


  /** 🧾 Lấy danh sách phòng thi */
  const fetchRooms = async () => {
    try {
      setLoading(true);
      const res = await examRoomApi.getByExam(examId);
      // ✅ Đảm bảo res là array
      const roomsData = Array.isArray(res) ? res : (res?.data || []);
      setRooms(roomsData);
    } catch (err) {
      console.error(err);
      message.error("❌ Không thể tải danh sách phòng thi");
      setRooms([]); // Set empty array nếu lỗi
    } finally {
      setLoading(false);
    }
  };

  // ✅ Không cần fetchTeachers nữa vì đã dùng hooks

  /** 🗓️ Lấy schedules của kỳ thi */
  const fetchSchedules = async () => {
    try {
      const res = await examScheduleApi.getByExam(examId);
      setSchedules(res);
    } catch (err) {
      console.warn("Không lấy được schedules:", err);
    }
  };

  /** 📊 Lấy thống kê phòng thi */
  const fetchStats = async () => {
    try {
      const res = await examRoomApi.getStats(examId);
      setStats(res);
    } catch (err) {
      console.error("Lỗi lấy thống kê:", err);
    }
  };

  /** 📋 Lấy danh sách phòng học khả dụng (chưa được dùng trong kỳ thi) */
  const fetchAvailableRooms = async () => {
    try {
      setLoadingAvailableRooms(true);
      const res = await examRoomApi.getAvailableRooms(examId);
      const roomsData = Array.isArray(res?.data) ? res.data : (res?.data || []);
      setAvailableRooms(roomsData);
    } catch (err) {
      console.error("Lỗi lấy danh sách phòng học khả dụng:", err);
      message.error("❌ Không thể tải danh sách phòng học khả dụng");
      setAvailableRooms([]);
    } finally {
      setLoadingAvailableRooms(false);
    }
  };

  /** 🏢 Lấy tất cả phòng vật lý (Room) */
  const fetchAllPhysicalRooms = async () => {
    try {
      setLoadingPhysicalRooms(true);
      const res = await roomApi.getAll({ status: "available" });
      setAllPhysicalRooms(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error("Lỗi lấy danh sách phòng vật lý:", err);
      message.error("❌ Không thể tải danh sách phòng vật lý");
      setAllPhysicalRooms([]);
    } finally {
      setLoadingPhysicalRooms(false);
    }
  };

  /** 🏫 Lấy danh sách phòng nhóm (FixedExamRoom) */
  const fetchFixedRooms = async () => {
    try {
      setLoadingFixedRooms(true);
      const res = await examRoomApi.getFixedRooms({ examId });
      const fixedRoomsData = Array.isArray(res?.data) ? res.data : (res?.data || []);
      setFixedRooms(fixedRoomsData);
    } catch (err) {
      console.error("Lỗi lấy danh sách phòng nhóm:", err);
      message.error("❌ Không thể tải danh sách phòng nhóm");
      setFixedRooms([]);
    } finally {
      setLoadingFixedRooms(false);
    }
  };

  /** 📅 Lấy exam rooms theo ngày */
  const getExamRoomsByDate = (date: string) => {
    if (!date) return [];
    // date đã là format YYYY-MM-DD từ input date
    const dateStr = date;
    return rooms.filter((r) => {
      const scheduleDate = r.schedule?.date;
      if (!scheduleDate) return false;
      // Chuyển đổi date về format YYYY-MM-DD để so sánh (tránh timezone issues)
      const scheduleDateObj = new Date(scheduleDate);
      const year = scheduleDateObj.getFullYear();
      const month = String(scheduleDateObj.getMonth() + 1).padStart(2, '0');
      const day = String(scheduleDateObj.getDate()).padStart(2, '0');
      const scheduleDateStr = `${year}-${month}-${day}`;
      return scheduleDateStr === dateStr;
    });
  };

  /** 🏫 Hàm lưu trực tiếp khi kéo FixedExamRoom vào phòng vật lý */
  const handleAssignFixedRoomToPhysicalRoom = async (fixedRoomId: string, roomId: string, scheduleId: string) => {
    try {
      // ✅ Tìm ExamRoom hiện tại (nếu có)
      const existingExamRoom = rooms.find(
        (r) => r.fixedExamRoom?._id === fixedRoomId && r.schedule?._id === scheduleId
      );
      
      if (existingExamRoom) {
        // ✅ Cập nhật ExamRoom hiện tại (di chuyển sang phòng vật lý khác)
        await examRoomApi.moveFixedRoom({
          examRoomId: existingExamRoom._id,
          newRoomId: roomId,
        });
        message.success("✅ Đã di chuyển phòng nhóm sang phòng vật lý khác");
      } else {
        // ✅ Tạo ExamRoom mới
        await examRoomApi.assignFixedRoomsToExamRooms({
          examId,
          scheduleId: scheduleId,
          roomMappings: [{ fixedRoomId, roomId }],
        });
        message.success("✅ Đã phân phòng nhóm vào phòng vật lý");
      }
      
      // ✅ Refresh tất cả data tự động
      await Promise.all([
        fetchRooms(),
        fetchAllPhysicalRooms(),
        fetchFixedRooms(),
        fetchSchedules(),
        fetchStats(),
      ]);
    } catch (err: any) {
      console.error(err);
      Modal.error({
        title: "Lỗi",
        content: err?.response?.data?.error || "❌ Không thể phân phòng nhóm",
      });
      throw err; // Re-throw để VisualRoomView có thể xử lý
    }
  };

  /** 🔄 Di chuyển FixedExamRoom từ phòng này sang phòng khác */
  const handleMoveFixedRoom = async (examRoomId: string, newRoomId: string, scheduleId: string): Promise<void> => {
    try {
      // Kiểm tra phòng đích có trống không (trong cùng schedule)
      const targetExamRoom = rooms.find(
        (r) => r.room?._id === newRoomId && r.schedule?._id === scheduleId && r._id !== examRoomId
      );
      if (targetExamRoom) {
        Modal.warning({
          title: "Phòng đã được sử dụng",
          content: "Phòng đích đã có lịch thi trong ca này",
        });
        return;
      }

      // Gọi API để di chuyển
      await examRoomApi.moveFixedRoom({
        examRoomId,
        newRoomId,
      });

      message.success("✅ Đã di chuyển phòng thành công");
      // ✅ Refresh tất cả data tự động
      await Promise.all([
        fetchRooms(),
        fetchSchedules(),
        fetchStats(),
        fetchAllPhysicalRooms(),
      ]);
    } catch (err: any) {
      console.error(err);
      Modal.error({
        title: "Lỗi",
        content: err?.response?.data?.error || "❌ Không thể di chuyển phòng",
      });
    }
  };


  useEffect(() => {
    if (examId) {
      fetchRooms();
      // ✅ Không cần fetchTeachers nữa vì đã dùng hooks
      fetchSchedules();
      fetchStats();
      if (viewMode === "visual") {
        fetchAllPhysicalRooms();
        fetchFixedRooms(); // ✅ Load FixedExamRooms khi chuyển sang visual mode
      }
    }
  }, [examId, viewMode]);


  // ✅ Đảm bảo selectedDate luôn nằm trong phạm vi kỳ thi
  useEffect(() => {
    if (viewMode === "visual" && exam?.startDate && exam?.endDate && selectedDate) {
      // ✅ Format date theo local time (tránh timezone issues)
      const formatLocalDate = (date: Date | string) => {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };
      
      const examStartDate = formatLocalDate(exam.startDate);
      const examEndDate = formatLocalDate(exam.endDate);
      
      if (selectedDate < examStartDate || selectedDate > examEndDate) {
        // Tự động chọn ngày đầu tiên có lịch thi trong phạm vi kỳ thi
        const validSchedule = schedules.find((s) => {
          if (!s?.date) return false;
          const scheduleDate = formatLocalDate(s.date);
          return scheduleDate >= examStartDate && scheduleDate <= examEndDate;
        });
        if (validSchedule?.date) {
          setSelectedDate(formatLocalDate(validSchedule.date));
        } else {
          setSelectedDate(examStartDate);
        }
      }
    }
  }, [exam?.startDate, exam?.endDate, viewMode, schedules, selectedDate]);

  /** ➕ Tạo phòng thủ công */
  const handleCreate = async (values: any) => {
    try {
      // ✅ Lấy thông tin phòng học đã chọn
      const selectedRoom = availableRooms.find((r) => r._id === values.room);
      if (!selectedRoom) {
        return Modal.warning({
          title: "Thiếu thông tin",
          content: "Vui lòng chọn phòng học",
        });
      }

      // ✅ Kiểm tra nếu có grade thì phải có fixedExamRoom
      if (values.grade && !values.fixedExamRoom) {
        return Modal.warning({
          title: "Thiếu thông tin",
          content: "Vui lòng chọn phòng nhóm khi đã chọn khối",
        });
      }

      const payload: any = {
        exam: examId,
        room: selectedRoom._id, // ✅ Gửi room ID
        fixedExamRoom: values.fixedExamRoom || undefined, // ✅ Gửi fixedExamRoom nếu có
        roomCode: selectedRoom.roomCode, // ✅ Tự động lấy từ phòng đã chọn
        capacity: values.capacity || 24,
        type: selectedRoom.type || "normal", // ✅ Tự động lấy từ phòng đã chọn
        grade: values.grade || (exam?.grades?.[0] ?? undefined),
        schedule: values.schedule || undefined,
        note: values.note || undefined,
      };
      await examRoomApi.create(payload);
      Modal.success({
        title: "Thành công",
        content: "✅ Đã thêm phòng thi thành công",
      });
      setOpenCreate(false);
      createForm.resetFields();
      setAvailableRooms([]);
      setAvailableFixedRoomsForCreate([]);
      fetchRooms();
      fetchAvailableRooms(); // ✅ Refresh danh sách phòng khả dụng
    } catch (err: any) {
      console.error(err);
      const errorMessage = err?.response?.data?.error || err?.message || "❌ Lỗi tạo phòng";
      Modal.error({
        title: "Lỗi",
        content: errorMessage,
        width: 500,
      });
    }
  };

  /** ⚙️ Gán giám thị cho phòng (thủ công) */
  const handleAssignInvigilators = async () => {
    if (!selectedRoom || !selectedInvigilators.length)
      return message.warning("Vui lòng chọn ít nhất 1 giám thị.");

    const invigilatorsPayload = selectedInvigilators.map((tId, idx) => ({
      teacherId: tId,
      role: idx === 0 ? "main" : "assistant",
    }));

    try {
      setAssigning(true);
      await examRoomApi.assignInvigilators(selectedRoom._id, invigilatorsPayload);
      message.success("✅ Gán giám thị thành công!");
      setSelectedRoom(null);
      setSelectedInvigilators([]);
      fetchRooms();
    } catch (err) {
      console.error(err);
      message.error("❌ Gán giám thị thất bại.");
    } finally {
      setAssigning(false);
    }
  };

  /** 👁️ Mở modal xem danh sách học sinh trong phòng (lấy từ RoomAssignment, sắp xếp theo seatNumber) */
  const handleViewStudents = async (room: any) => {
    setViewStudentsRoom(room);
    setViewStudentsModalOpen(true);
    setLoadingRoomStudents(true);
    try {
      // ✅ Lấy học sinh từ RoomAssignment theo ExamRoom và Schedule (sắp xếp theo seatNumber)
      const examRoomId = room._id;
      const scheduleId = room.schedule?._id || room.schedule;
      
      if (!examRoomId || !scheduleId) {
        message.warning("Phòng này chưa được gán với lịch thi");
        setRoomStudents([]);
        return;
      }
      
      // ✅ Gọi API với examRoomId và scheduleId để lấy từ RoomAssignment
      const res = await examStudentApi.getByRoom(examRoomId, { examRoomId, scheduleId });
      const studentsData = Array.isArray(res?.data) ? res.data : (res?.data || []);
      setRoomStudents(studentsData);
    } catch (err: any) {
      console.error("Lỗi lấy danh sách học sinh:", err);
      message.error(err?.response?.data?.error || "❌ Không thể tải danh sách học sinh");
      setRoomStudents([]);
    } finally {
      setLoadingRoomStudents(false);
    }
  };


  /** ⚡ Phân phòng nhóm vào tất cả phòng thi (tự động) */
  const handleAssignFixedRoomsToAllSchedules = async () => {
    Modal.confirm({
      title: "Phân phòng nhóm vào tất cả phòng thi",
      content: (
        <div>
          <p>Hệ thống sẽ tự động:</p>
          <ul>
            <li>Phân tất cả phòng nhóm (FixedExamRoom) vào phòng vật lý (Room) cho tất cả lịch thi</li>
            <li>Tránh trùng phòng, trùng giờ</li>
            <li>Bỏ qua các lịch thi đã có phòng thi</li>
            <li>Tự động tạo RoomAssignment cho học sinh</li>
          </ul>
          <p style={{ marginTop: 16, color: "#ff4d4f" }}>
            <strong>⚠️ Lưu ý:</strong> Thao tác này sẽ tự động phân phòng cho tất cả lịch thi chưa có phòng thi.
          </p>
        </div>
      ),
      okText: "Xác nhận",
      cancelText: "Hủy",
      width: 500,
      onOk: async () => {
        try {
          message.loading({ content: "Đang phân phòng...", key: "assign-all", duration: 0 });
          
          const res = await examRoomApi.assignFixedRoomsToAllSchedules({ examId });
          
          message.destroy("assign-all");
          
          const successCount = res.results?.filter((r: any) => r.status === "success").length || 0;
          const totalSchedules = res.results?.length || 0;
          
          if (res.errors && res.errors.length > 0) {
            Modal.warning({
              title: "Có lỗi xảy ra",
              width: 600,
              content: (
                <div>
                  <p>{res.message}</p>
                  <p><strong>Chi tiết:</strong></p>
                  <ul style={{ maxHeight: 300, overflow: "auto" }}>
                    {res.results?.map((r: any, idx: number) => (
                      <li key={idx}>
                        <strong>{r.scheduleName}:</strong>{" "}
                        {r.status === "success" 
                          ? `✅ ${r.examRooms} phòng thi, ${r.assignments} phân phòng`
                          : r.status === "skipped"
                          ? `⏭️ ${r.message}`
                          : `❌ ${r.error || "Lỗi"}`}
                      </li>
                    ))}
                  </ul>
                  {res.errors.length > 0 && (
                    <div style={{ marginTop: 16 }}>
                      <Text strong type="danger">Các lỗi:</Text>
                      <ul>
                        {res.errors.map((err: any, idx: number) => (
                          <li key={idx}>
                            {err.schedule}: {err.error}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ),
            });
          } else {
            Modal.success({
              title: "Thành công",
              width: 600,
              content: (
                <div>
                  <p>{res.message}</p>
                  <p><strong>Chi tiết:</strong></p>
                  <ul style={{ maxHeight: 300, overflow: "auto" }}>
                    {res.results?.map((r: any, idx: number) => (
                      <li key={idx}>
                        <strong>{r.scheduleName}:</strong>{" "}
                        {r.status === "success" 
                          ? `✅ ${r.examRooms} phòng thi, ${r.assignments} phân phòng`
                          : r.status === "skipped"
                          ? `⏭️ ${r.message}`
                          : `❌ ${r.error || "Lỗi"}`}
                      </li>
                    ))}
                  </ul>
                </div>
              ),
            });
          }
          
          // ✅ Refresh data
          await Promise.all([
            fetchRooms(),
            fetchSchedules(),
            fetchStats(),
            fetchAllPhysicalRooms(),
            fetchFixedRooms(),
          ]);
        } catch (err: any) {
          message.destroy("assign-all");
          console.error(err);
          Modal.error({
            title: "Lỗi",
            content: err?.response?.data?.error || err?.response?.data?.details || err?.message || "❌ Lỗi khi phân phòng nhóm vào tất cả phòng thi",
            width: 500,
          });
        }
      },
    });
  };

  /** 🤖 Tự động gán giám thị cho 1 schedule */
  const handleAutoAssignInvigilators = async () => {
          const scheduleId = rooms[0]?.schedule?._id || schedules[0]?._id;
    if (!scheduleId) return message.warning("Không có lịch thi để gán giám thị.");
    Modal.confirm({
      title: "Tự động gán giám thị?",
      content: "Hệ thống sẽ tự động chọn giám thị phù hợp cho từng phòng thi trong lịch thi này.",
      okText: "Xác nhận",
      cancelText: "Hủy",
      onOk: async () => {
        try {
          setLoading(true);
          const res = await examRoomApi.autoAssignInvigilators({ examId, scheduleId });
          message.success(res.message || "✅ Đã gán giám thị tự động thành công!");
          fetchRooms();
        } catch (err: any) {
          console.error(err);
          message.error(err?.response?.data?.error || "❌ Lỗi khi gán giám thị tự động");
        } finally {
          setLoading(false);
        }
      },
    });
  };

  /** 🤖 Tự động gán giám thị cho toàn bộ kỳ thi */
  const handleAutoAssignInvigilatorsForExam = async () => {
    Modal.confirm({
      title: "Tự động gán giám thị cho toàn bộ kỳ thi?",
      content: (
        <div>
          <p>Hệ thống sẽ tự động gán giám thị cho <strong>tất cả phòng thi</strong> trong toàn bộ kỳ thi này.</p>
          <p style={{ marginTop: 8, color: "#ff4d4f" }}>
            <strong>⚠️ Lưu ý:</strong> Thao tác này sẽ gán giám thị cho tất cả ExamRoom trong kỳ thi, đảm bảo không trùng và đổi liên tục xuyên suốt kỳ thi.
          </p>
        </div>
      ),
      okText: "Xác nhận",
      cancelText: "Hủy",
      width: 500,
      onOk: async () => {
        try {
          setLoading(true);
          const res = await examRoomApi.autoAssignInvigilatorsForExam({ examId });
          message.success(res.message || `✅ Đã gán giám thị tự động cho ${res.assigned || 0}/${res.total || 0} phòng thi!`);
          fetchRooms();
        } catch (err: any) {
          console.error(err);
          message.error(err?.response?.data?.error || "❌ Lỗi khi gán giám thị tự động");
        } finally {
          setLoading(false);
        }
      },
    });
  };

  /** 🗑️ Xóa toàn bộ giám thị đã gán */
  const handleRemoveAllInvigilators = async () => {
    Modal.confirm({
      title: "Xóa toàn bộ giám thị?",
      content: (
        <div>
          <p>Bạn có chắc chắn muốn xóa <strong>tất cả giám thị</strong> đã gán cho tất cả phòng thi trong kỳ thi này?</p>
          <p style={{ marginTop: 8, color: "#ff4d4f" }}>
            <strong>⚠️ Cảnh báo:</strong> Thao tác này không thể hoàn tác. Tất cả giám thị sẽ bị xóa khỏi tất cả phòng thi.
          </p>
        </div>
      ),
      okText: "Xác nhận xóa",
      cancelText: "Hủy",
      okButtonProps: { danger: true },
      width: 500,
      onOk: async () => {
        try {
          setLoading(true);
          const res = await examRoomApi.removeAllInvigilators({ examId });
          message.success(res.message || `✅ Đã xóa giám thị khỏi ${res.modifiedCount || 0} phòng thi!`);
          fetchRooms();
        } catch (err: any) {
          console.error(err);
          message.error(err?.response?.data?.error || "❌ Lỗi khi xóa giám thị");
        } finally {
          setLoading(false);
        }
      },
    });
  };


  /** 🔍 Lọc danh sách phòng thi */
  const filteredRooms = useMemo(() => {
    // ✅ Đảm bảo rooms là array
    if (!Array.isArray(rooms)) return [];
    let result = [...rooms];

    // Lọc theo lịch thi
    if (filters.schedule !== "Tất cả") {
      result = result.filter(
        (r) => r.schedule?._id === filters.schedule || r.schedule === filters.schedule
      );
    }

    // Lọc theo khối
    if (filters.grade !== "Tất cả") {
      const gradeStr = String(filters.grade);
      result = result.filter(
        (r) => String(r.grade) === gradeStr || String(r.schedule?.grade) === gradeStr
      );
    }

    // Tìm kiếm theo keyword
    if (filters.keyword.trim()) {
      const keyword = filters.keyword.toLowerCase();
      result = result.filter(
        (r) =>
          r.roomCode?.toLowerCase().includes(keyword) ||
          r.note?.toLowerCase().includes(keyword)
      );
    }

    return result;
  }, [rooms, filters]);

  /** 🧱 Cấu hình bảng hiển thị */
  const columns = [
    {
      title: "Mã phòng vật lý",
      dataIndex: "roomCode",
      align: "center" as const,
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: "Phòng nhóm",
      align: "center" as const,
      render: (r: any) => {
        const fixedRoom = r.fixedExamRoom;
        if (!fixedRoom) return <Text type="secondary">-</Text>;
        return (
          <Tag color="purple">{fixedRoom.code || fixedRoom._id}</Tag>
        );
      },
    },
    {
      title: "Lịch thi",
      align: "center" as const,
      render: (r: any) => {
        const schedule = r.schedule;
        if (!schedule) return <Text type="secondary">-</Text>;
        return (
          <Space direction="vertical" size={0}>
            <Text strong>
              {schedule.subject?.name || 
               (typeof schedule.subject === 'object' && schedule.subject?.name) || 
               (typeof schedule.subject === 'string' ? schedule.subject : "-")}
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {new Date(schedule.date).toLocaleDateString()} {schedule.startTime ? `• ${schedule.startTime}` : ""}
            </Text>
            <Tag color="cyan" style={{ marginTop: 4 }}>Khối {schedule.grade || r.grade || "-"}</Tag>
          </Space>
        );
      },
    },
    {
      title: "Loại phòng",
      dataIndex: "type",
      align: "center" as const,
      render: (v: string) =>
        v === "lab" ? (
          <Tag color="orange">Phòng Lab</Tag>
        ) : v === "computer" ? (
          <Tag color="cyan">Phòng Máy</Tag>
        ) : (
          <Tag color="green">Thường</Tag>
        ),
    },
    { 
      title: "Số học sinh", 
      align: "center" as const, 
      render: (r: any) => {
        const count = r.fixedExamRoom?.capacity || r.fixedExamRoom?.students?.length || 0;
        return <Tag color={count > 0 ? "green" : "default"}>{count}</Tag>;
      }
    },
    { title: "Giám thị", align: "center" as const, render: (r: any) => r.invigilators?.length || 0 },
    {
      title: "Thao tác",
      align: "center" as const,
      render: (_: any, record: any) => (
        <Space>
          <Button
            icon={<EyeOutlined />}
            onClick={() => handleViewStudents(record)}
            title="Xem danh sách học sinh"
          >
            Xem học sinh
          </Button>
          {hasPermission(PERMISSIONS.EXAM_ROOM_MANAGE) && (
            <Button
              icon={<TeamOutlined />}
              onClick={() => {
                setSelectedRoom(record);
                setSelectedInvigilators(
                  (record.invigilators || []).map((i: any) => i.teacher?._id || i.teacherId)
                );
              }}
            >
              Gán giám thị
            </Button>
          )}
          <Button icon={<FilePdfOutlined />} onClick={() => examRoomApi.exportPdf(record._id)}>
            PDF
          </Button>
          {hasPermission(PERMISSIONS.EXAM_ROOM_MANAGE) && (
            <Popconfirm
              title="Xóa phòng thi này?"
              onConfirm={async () => {
                try {
                  await examRoomApi.remove(record._id);
                  message.success("🗑️ Đã xóa phòng thi");
                  fetchRooms();
                } catch (err: any) {
                  console.error(err);
                  message.error(err?.response?.data?.error || "❌ Lỗi xóa phòng");
                }
              }}
            >
              <Button danger>Xóa</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];


  return (
    <div
      style={{
        borderRadius: 16,
        boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
        padding: 20,
        background: "#fff",
      }}
    >
      {/* Header - Label lên trên */}
      <Space direction="vertical" style={{ width: "100%", marginBottom: 16 }} size="large">
          <div>
            <Title level={3} style={{ margin: 0 }}>
              Danh sách phòng thi
            </Title>
            <Text type="secondary">
              {exam?.name} • Năm học {exam?.year} • HK{exam?.semester}
            </Text>
          </div>

        {/* Buttons xuống dưới */}
        <Space wrap style={{ width: "100%" }}>
          <Button.Group>
              <Button
                type={viewMode === "table" ? "primary" : "default"}
                icon={<UnorderedListOutlined />}
                onClick={() => setViewMode("table")}
              >
                Danh sách
            </Button>
              <Button
                type={viewMode === "visual" ? "primary" : "default"}
                icon={<AppstoreOutlined />}
                onClick={() => {
                  setViewMode("visual");
                  // Tự động chọn ngày hợp lệ
                  if (exam?.startDate) {
                    // ✅ Format date theo local time (tránh timezone issues)
                    const formatLocalDate = (date: Date | string) => {
                      const d = new Date(date);
                      const year = d.getFullYear();
                      const month = String(d.getMonth() + 1).padStart(2, '0');
                      const day = String(d.getDate()).padStart(2, '0');
                      return `${year}-${month}-${day}`;
                    };
                    
                    const examStartDate = formatLocalDate(exam.startDate);
                    const examEndDate = exam?.endDate ? formatLocalDate(exam.endDate) : null;
                    
                    // Nếu chưa có selectedDate hoặc selectedDate nằm ngoài phạm vi kỳ thi
                    if (!selectedDate || 
                        (examStartDate && selectedDate < examStartDate) ||
                        (examEndDate && selectedDate > examEndDate)) {
                      // Ưu tiên chọn ngày đầu tiên có lịch thi trong phạm vi kỳ thi
                      const validSchedule = schedules.find((s) => {
                        if (!s?.date) return false;
                        const scheduleDate = formatLocalDate(s.date);
                        return (!examStartDate || scheduleDate >= examStartDate) && (!examEndDate || scheduleDate <= examEndDate);
                      });
                      if (validSchedule?.date) {
                        setSelectedDate(formatLocalDate(validSchedule.date));
                      } else if (exam?.startDate) {
                        // Nếu không có lịch thi hợp lệ, chọn ngày bắt đầu kỳ thi
                        setSelectedDate(examStartDate);
                      }
                    }
                  } else if (!selectedDate && schedules.length > 0) {
                    // Fallback: chọn ngày đầu tiên có lịch thi
                    const firstSchedule = schedules[0];
                    if (firstSchedule?.date) {
                      const formatLocalDate = (date: Date | string) => {
                        const d = new Date(date);
                        const year = d.getFullYear();
                        const month = String(d.getMonth() + 1).padStart(2, '0');
                        const day = String(d.getDate()).padStart(2, '0');
                        return `${year}-${month}-${day}`;
                      };
                      setSelectedDate(formatLocalDate(firstSchedule.date));
                    }
                  }
                }}
              >
                Trực quan
              </Button>
            </Button.Group>
            {hasPermission(PERMISSIONS.EXAM_ROOM_AUTO) && (
              <>
                <Button 
                  icon={<ThunderboltOutlined />} 
                  onClick={() => setOpenAssignFixedToExamRooms(true)}
                >
                  Phân phòng nhóm vào phòng thi
                </Button>
                <Button 
                  type="primary"
                  icon={<ThunderboltOutlined />} 
                  onClick={handleAssignFixedRoomsToAllSchedules}
                >
                  ⚡ Phân phòng nhóm vào tất cả phòng thi
                </Button>
              </>
            )}
            {hasPermission(PERMISSIONS.EXAM_ROOM_MANAGE) && (
              <>
                <Button icon={<TeamOutlined />} onClick={handleAutoAssignInvigilators}>
                  Gán giám thị (1 lịch)
                </Button>
                <Button 
                  type="primary"
                  icon={<TeamOutlined />} 
                  onClick={handleAutoAssignInvigilatorsForExam}
                >
                  🤖 Gán giám thị (toàn bộ kỳ thi)
                </Button>
                <Button 
                  danger
                  icon={<DeleteOutlined />} 
                  onClick={handleRemoveAllInvigilators}
                >
                  🗑️ Xóa toàn bộ giám thị
                </Button>
              </>
            )}
            <Button icon={<BarChartOutlined />} onClick={fetchStats}>
              Thống kê
            </Button>
            <Button icon={<ReloadOutlined />} onClick={fetchRooms}>
              Làm mới
            </Button>
            {hasPermission(PERMISSIONS.EXAM_ROOM_MANAGE) && (
              <Button type="primary" onClick={() => setOpenCreate(true)}>
                ➕ Tạo phòng thủ công
              </Button>
            )}
        </Space>
      </Space>

      {/* 🔍 Bộ lọc và tìm kiếm */}
      <Card style={{ marginBottom: 16, background: "#fafafa" }}>
        <Row gutter={[16, 16]} align="middle">
          {viewMode === "visual" && (
            <Col xs={24} sm={8} md={6}>
              <Input
                type="date"
                prefix={<CalendarOutlined />}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{ width: "100%" }}
                placeholder="Chọn ngày"
                min={exam?.startDate ? (() => {
                  const date = new Date(exam.startDate);
                  const year = date.getFullYear();
                  const month = String(date.getMonth() + 1).padStart(2, '0');
                  const day = String(date.getDate()).padStart(2, '0');
                  return `${year}-${month}-${day}`;
                })() : undefined}
                max={exam?.endDate ? (() => {
                  const date = new Date(exam.endDate);
                  const year = date.getFullYear();
                  const month = String(date.getMonth() + 1).padStart(2, '0');
                  const day = String(date.getDate()).padStart(2, '0');
                  return `${year}-${month}-${day}`;
                })() : undefined}
                disabled={!exam?.startDate || !exam?.endDate}
              />
            </Col>
          )}
          <Col xs={24} sm={8} md={6}>
            <Select
              value={filters.schedule}
              onChange={(v) => setFilters((f) => ({ ...f, schedule: v }))}
              style={{ width: "100%" }}
              placeholder="Lọc theo lịch thi"
            >
              <Option value="Tất cả">Tất cả lịch thi</Option>
              {schedules.map((s) => (
                <Option key={s._id} value={s._id}>
                  {s.subject?.name || s.subject} - Khối {s.grade}
                </Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={8} md={6}>
            <Select
              value={filters.grade}
              onChange={(v) => setFilters((f) => ({ ...f, grade: v }))}
              style={{ width: "100%" }}
              placeholder="Lọc theo khối"
            >
              <Option value="Tất cả">Tất cả khối</Option>
              {exam?.grades?.map((g: string | number) => (
                <Option key={String(g)} value={String(g)}>
                  Khối {g}
                </Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={8} md={12}>
            <Input
              placeholder="Tìm theo mã phòng..."
              prefix={<SearchOutlined />}
              value={filters.keyword}
              onChange={(e) => setFilters((f) => ({ ...f, keyword: e.target.value }))}
              allowClear
            />
          </Col>
        </Row>
      </Card>

      {/* 📊 Chế độ xem: Bảng hoặc Trực quan */}
      {viewMode === "table" ? (
      <Spin spinning={loading}>
          <Table
            dataSource={filteredRooms}
            columns={columns}
            rowKey={(r) => r._id}
            pagination={{ 
              pageSize: pageSize, 
              showSizeChanger: true, 
              pageSizeOptions: ["10", "20", "50", "100"],
              showTotal: (total) => `Tổng ${total} phòng thi`,
              onShowSizeChange: (current, size) => {
                setPageSize(size);
              }
            }}
            bordered
          />
      </Spin>
      ) : (
        <VisualRoomView
          examId={examId}
          selectedDate={selectedDate}
          schedules={schedules}
          rooms={rooms}
          allPhysicalRooms={allPhysicalRooms}
          loading={loading || loadingPhysicalRooms}
          onMoveFixedRoom={handleMoveFixedRoom}
          onAssignFixedRoomToPhysicalRoom={handleAssignFixedRoomToPhysicalRoom}
          draggingFixedRoom={draggingFixedRoom}
          setDraggingFixedRoom={setDraggingFixedRoom}
          pendingMappings={pendingMappings}
          setPendingMappings={setPendingMappings}
          fixedRooms={fixedRooms}
          loadingFixedRooms={loadingFixedRooms}
        />
      )}


      {/* Modal gán giám thị */}
      <Modal
        open={!!selectedRoom}
        title={`Gán giám thị - ${selectedRoom?.roomCode || ""}`}
        onCancel={() => {
          setSelectedRoom(null);
          setSelectedInvigilators([]);
        }}
        onOk={handleAssignInvigilators}
        confirmLoading={assigning}
      >
        <p>Chọn giám thị (người đầu tiên là Giám thị chính):</p>
        <Select
          mode="multiple"
          placeholder="Chọn giám thị..."
          value={selectedInvigilators}
          onChange={(vals) => setSelectedInvigilators(vals)}
          style={{ width: "100%" }}
        >
          {teachers.map((t) => (
            <Option key={t._id} value={t._id}>
              {t.name}
            </Option>
          ))}
        </Select>
      </Modal>


      {/* Modal tạo phòng thủ công */}
      <Modal
        open={openCreate}
        title="Tạo phòng thi"
        onCancel={() => {
          setOpenCreate(false);
          createForm.resetFields();
          setAvailableRooms([]);
          setAvailableFixedRoomsForCreate([]);
        }}
        onOk={() => createForm.submit()}
        afterOpenChange={(open) => {
          if (open) {
            fetchAvailableRooms(); // ✅ Load danh sách phòng học khả dụng khi mở modal
          }
        }}
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreate}>
          <Form.Item 
            name="room" 
            label="Chọn phòng học" 
            rules={[{ required: true, message: "Vui lòng chọn phòng học" }]}
            tooltip="Chọn từ danh sách phòng học khả dụng (chưa được dùng trong kỳ thi này). Có thể chọn phòng thường, phòng máy hoặc phòng thí nghiệm."
          >
            <Select
              placeholder="Chọn phòng học..."
              loading={loadingAvailableRooms}
              showSearch
              optionFilterProp="children"
              filterOption={(input, option) => {
                const label = String(option?.label ?? "");
                return label.toLowerCase().includes(input.toLowerCase());
              }}
              notFoundContent={loadingAvailableRooms ? <Spin size="small" /> : "Không có phòng học khả dụng"}
              onChange={(roomId) => {
                const selectedRoom = availableRooms.find((r) => r._id === roomId);
                if (selectedRoom) {
                  // ✅ Tự động điền roomCode và type
                  createForm.setFieldsValue({
                    roomCode: selectedRoom.roomCode,
                    type: selectedRoom.type || "normal",
                  });
                }
              }}
            >
              {availableRooms.map((room) => (
                <Option 
                  key={room._id} 
                  value={room._id} 
                  label={`${room.roomCode} - ${room.name || ""} (${room.type === "normal" ? "Thường" : room.type === "lab" ? "Thí nghiệm" : "Máy tính"})`}
                >
                  <Space>
                    <Tag color={room.type === "normal" ? "blue" : room.type === "lab" ? "orange" : "purple"}>
                      {room.roomCode}
                    </Tag>
                    <Text>{room.name || "Phòng học"}</Text>
                    <Text type="secondary">
                      ({room.type === "normal" ? "Thường" : room.type === "lab" ? "Thí nghiệm" : "Máy tính"})
                    </Text>
                  </Space>
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item 
            name="roomCode" 
            label="Mã phòng (tự động)" 
            tooltip="Mã phòng sẽ được tự động lấy từ phòng học đã chọn"
          >
            <Input disabled />
          </Form.Item>
          <Form.Item name="capacity" label="Sức chứa" initialValue={24}>
            <InputNumber min={1} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item 
            name="type" 
            label="Loại phòng (tự động)" 
            tooltip="Loại phòng sẽ được tự động lấy từ phòng học đã chọn"
          >
            <Select disabled>
              <Option value="normal">Thường</Option>
              <Option value="lab">Thí nghiệm</Option>
              <Option value="computer">Phòng máy</Option>
            </Select>
          </Form.Item>
          <Form.Item 
            name="grade" 
            label="Khối"
            rules={[{ required: true, message: "Vui lòng chọn khối" }]}
            tooltip="Chọn khối để lấy danh sách phòng nhóm"
          >
            <Select
              placeholder="Chọn khối"
              onChange={async (value) => {
                // ✅ Load danh sách phòng nhóm theo khối
                if (value) {
                  try {
                    setLoadingFixedRoomsForCreate(true);
                    const fixedRes = await examRoomApi.getFixedRooms({ examId, grade: String(value) });
                    setAvailableFixedRoomsForCreate(fixedRes.data || []);
                    // ✅ Reset fixedExamRoom khi đổi khối
                    createForm.setFieldsValue({ fixedExamRoom: undefined });
                  } catch (err) {
                    console.error(err);
                    Modal.error({
                      title: "Lỗi",
                      content: "Không thể tải danh sách phòng nhóm",
                    });
                  } finally {
                    setLoadingFixedRoomsForCreate(false);
                  }
                } else {
                  setAvailableFixedRoomsForCreate([]);
                  createForm.setFieldsValue({ fixedExamRoom: undefined });
                }
              }}
            >
              {exam?.grades?.map((g: string | number) => (
                <Option key={String(g)} value={String(g)}>
                  Khối {g}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item 
            name="fixedExamRoom" 
            label="Phòng nhóm"
            rules={[{ required: true, message: "Vui lòng chọn phòng nhóm" }]}
            tooltip="Chọn phòng nhóm để lấy danh sách học sinh"
            dependencies={["grade"]}
          >
            <Select
              placeholder="Chọn phòng nhóm"
              loading={loadingFixedRoomsForCreate}
              disabled={!createForm.getFieldValue("grade") || availableFixedRoomsForCreate.length === 0}
              showSearch
              filterOption={(input, option: any) =>
                String(option?.label ?? "").toLowerCase().includes(input.toLowerCase())
              }
            >
              {availableFixedRoomsForCreate.map((fr: any) => (
                <Option key={fr._id} value={fr._id} label={fr.code}>
                  {fr.code} ({fr.studentsCount || fr.students?.length || 0} học sinh)
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="schedule" label="Gắn vào lịch thi">
            <Select allowClear placeholder="Chọn lịch thi (bắt buộc)">
              {schedules.map((s) => (
                <Option key={s._id} value={s._id}>
                  {s.subject?.name || s.subject} — Khối {s.grade} — {new Date(s.date).toLocaleDateString()}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="note" label="Ghi chú">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal xem danh sách học sinh trong phòng */}
      <Modal
        open={viewStudentsModalOpen}
        title={
          <Space>
            <EyeOutlined />
            <span>Danh sách học sinh - Phòng {viewStudentsRoom?.fixedExamRoom?.code || viewStudentsRoom?.roomCode || ""}</span>
          </Space>
        }
        onCancel={() => {
          setViewStudentsModalOpen(false);
          setViewStudentsRoom(null);
          setRoomStudents([]);
        }}
        footer={[
          <Button key="close" onClick={() => {
            setViewStudentsModalOpen(false);
            setViewStudentsRoom(null);
            setRoomStudents([]);
          }}>
            Đóng
          </Button>,
        ]}
        width={900}
      >
        <Spin spinning={loadingRoomStudents}>
          {roomStudents.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40 }}>
              <Text type="secondary">Phòng này chưa có học sinh nào</Text>
            </div>
          ) : (
            <Table
              dataSource={roomStudents}
              rowKey={(r) => r._id}
              pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `Tổng ${total} học sinh` }}
              size="small"
              columns={[
                {
                  title: "Số thứ tự",
                  align: "center" as const,
                  width: 100,
                  render: (r: any) => r.seatNumber ? <Tag color="blue">{r.seatNumber}</Tag> : <Text type="secondary">-</Text>,
                  sorter: (a: any, b: any) => (a.seatNumber || 0) - (b.seatNumber || 0),
                  defaultSortOrder: "ascend" as const,
                },
                {
                  title: "Mã HS",
                  align: "center" as const,
                  render: (r: any) => r.student?.studentCode || "-",
                },
                {
                  title: "Họ tên",
                  render: (r: any) => r.student?.name || "-",
                },
                {
                  title: "Lớp",
                  align: "center" as const,
                  render: (r: any) => r.class?.className || r.class?.name || "-",
                },
                {
                  title: "Khối",
                  dataIndex: "grade",
                  align: "center" as const,
                },
                {
                  title: "SBD",
                  dataIndex: "sbd",
                  align: "center" as const,
                  render: (v: string) => v ? <Tag color="cyan">{v}</Tag> : <Text type="secondary">-</Text>,
                },
                {
                  title: "Trạng thái",
                  dataIndex: "status",
                  align: "center" as const,
                  render: (v: string) => {
                    const statusMap: Record<string, { label: string; color: string }> = {
                      active: { label: "Đăng ký", color: "blue" },
                      present: { label: "Có mặt", color: "green" },
                      absent: { label: "Vắng", color: "red" },
                      excluded: { label: "Đình chỉ", color: "orange" },
                    };
                    const info = statusMap[v || "active"] || statusMap.active;
                    return <Tag color={info.color}>{info.label}</Tag>;
                  },
                },
              ]}
            />
          )}
        </Spin>
      </Modal>

      {/* Thống kê */}
      {stats && (
        <Card style={{ marginTop: 24, background: "#fafafa" }} title="📊 Thống kê phòng thi">
          {stats.data && stats.data.length > 0 ? (
            <Space direction="vertical" style={{ width: "100%" }} size="middle">
              {stats.data.map((s: any, i: number) => (
                <Card
                  key={i}
                  size="small"
                  style={{ background: "#fff", border: "1px solid #d9d9d9" }}
                >
                  <Space direction="vertical" style={{ width: "100%" }} size={4}>
                    <Text strong style={{ fontSize: 16 }}>
                      {s.scheduleName || "Chưa gắn lịch thi"}
                    </Text>
                    <Space split={<Divider type="vertical" />}>
                      <Text>
                        <b>Số phòng:</b> {s.totalRooms}
                      </Text>
                      <Text>
                        <b>Học sinh tham gia:</b>{" "}
                        <Tag color={s.studentCount >= s.totalSeats ? "red" : s.studentCount > 0 ? "green" : "default"}>
                          {s.studentCount}/{s.totalSeats}
                        </Tag>
                      </Text>
                      {s.fullRooms > 0 && (
                        <Text type="warning">
                          <b>Phòng đầy:</b> {s.fullRooms}
                        </Text>
                      )}
                    </Space>
                  </Space>
                </Card>
              ))}
            </Space>
          ) : (
            <Text type="secondary">Chưa có thống kê phòng thi</Text>
          )}
        </Card>
      )}


      {/* 🏫 Modal: Phân phòng nhóm vào phòng thi */}
      <Modal
        title="Phân phòng nhóm vào phòng thi"
        open={openAssignFixedToExamRooms}
        onCancel={() => {
          setOpenAssignFixedToExamRooms(false);
          setSelectedScheduleForAssign("");
          setRoomMappings([]);
          setFixedRooms([]);
          setScheduleRoomMappings({});
        }}
        afterOpenChange={async (open) => {
          if (open) {
            // ✅ Load tất cả phòng từ bảng Room
            try {
              setLoadingAllRooms(true);
              const rooms = await roomApi.getAll({ status: "available" }); // ✅ Lấy phòng có status available
              setAllRooms(Array.isArray(rooms) ? rooms : []);
            } catch (err) {
              console.error(err);
              message.error("Lỗi khi tải danh sách phòng");
            } finally {
              setLoadingAllRooms(false);
            }
          }
        }}
        onOk={async () => {
          if (!selectedScheduleForAssign) {
            message.warning("Vui lòng chọn lịch thi");
            return;
          }
          
          try {
            setAssigningFixedToExam(true);
            
            if (selectedScheduleForAssign === "all") {
              // ✅ Chế độ "Tất cả lịch thi"
              const conflicts: Array<{ schedule: string; roomCode: string; reason: string }> = [];
              const missingRooms: Array<{ schedule: string; fixedRoomCode: string }> = [];
              const results: any[] = [];
              
              // ✅ Kiểm tra trùng phòng, trùng giờ
              const roomScheduleMap: Record<string, Array<{ scheduleId: string; scheduleName: string; date: string; startTime: string }>> = {};
              
              for (const schedule of schedules) {
                const scheduleMappings = scheduleRoomMappings[schedule._id] || [];
                const scheduleFixedRooms = fixedRooms.filter((fr) => String(fr.grade) === String(schedule.grade));
                
                // ✅ Kiểm tra thiếu phòng
                for (const fixedRoom of scheduleFixedRooms) {
                  const mapping = scheduleMappings.find((m) => m.fixedRoomId === fixedRoom._id);
                  if (!mapping || !mapping.roomId) {
                    missingRooms.push({
                      schedule: `${schedule.subject?.name || schedule.subject} - ${schedule.date ? new Date(schedule.date).toLocaleDateString("vi-VN") : ""} ${schedule.startTime}`,
                      fixedRoomCode: fixedRoom.code,
                    });
                  } else {
                    // ✅ Kiểm tra trùng phòng, trùng giờ
                    const room = allRooms.find((r) => r._id === mapping.roomId);
                    if (room) {
                      const roomCode = room.roomCode;
                      if (!roomScheduleMap[roomCode]) {
                        roomScheduleMap[roomCode] = [];
                      }
                      roomScheduleMap[roomCode].push({
                        scheduleId: schedule._id,
                        scheduleName: `${schedule.subject?.name || schedule.subject} - Khối ${schedule.grade}`,
                        date: schedule.date ? new Date(schedule.date).toISOString().split('T')[0] : "",
                        startTime: schedule.startTime || "",
                      });
                    }
                  }
                }
              }
              
              // ✅ Kiểm tra trùng phòng, trùng giờ
              for (const [roomCode, scheduleList] of Object.entries(roomScheduleMap)) {
                // ✅ Nhóm theo ngày và giờ
                const timeSlotMap: Record<string, string[]> = {};
                for (const s of scheduleList) {
                  const timeSlot = `${s.date}_${s.startTime}`;
                  if (!timeSlotMap[timeSlot]) {
                    timeSlotMap[timeSlot] = [];
                  }
                  timeSlotMap[timeSlot].push(s.scheduleName);
                }
                
                // ✅ Kiểm tra trùng giờ
                for (const [timeSlot, scheduleNames] of Object.entries(timeSlotMap)) {
                  if (scheduleNames.length > 1) {
                    conflicts.push({
                      schedule: scheduleNames.join(", "),
                      roomCode,
                      reason: `Trùng phòng ${roomCode} cùng giờ (${timeSlot.split('_')[0]} ${timeSlot.split('_')[1]})`,
                    });
                  }
                }
              }
              
              // ✅ Hiển thị cảnh báo nếu có lỗi
              if (conflicts.length > 0 || missingRooms.length > 0) {
                const conflictMessages = conflicts.map((c) => `• ${c.schedule}: ${c.reason}`).join("\n");
                const missingMessages = missingRooms.map((m) => `• ${m.schedule} - Phòng nhóm ${m.fixedRoomCode} chưa chọn phòng thực tế`).join("\n");
                
                Modal.warning({
                  title: "⚠️ Có lỗi cần xử lý",
                  width: 600,
                  content: (
                    <div>
                      {conflicts.length > 0 && (
                        <div style={{ marginBottom: 16 }}>
                          <Text strong type="danger">Trùng phòng, trùng giờ:</Text>
                          <pre style={{ background: "#fff3cd", padding: 8, borderRadius: 4, marginTop: 8, whiteSpace: "pre-wrap" }}>
                            {conflictMessages}
                          </pre>
    </div>
                      )}
                      {missingRooms.length > 0 && (
                        <div>
                          <Text strong type="warning">Thiếu phòng:</Text>
                          <pre style={{ background: "#fff3cd", padding: 8, borderRadius: 4, marginTop: 8, whiteSpace: "pre-wrap" }}>
                            {missingMessages}
                          </pre>
                        </div>
                      )}
                      <Text type="secondary" style={{ marginTop: 16, display: "block" }}>
                        Vui lòng xếp lại lịch thi hoặc chọn phòng khác để tránh trùng.
                      </Text>
                    </div>
                  ),
                });
                return;
              }
              
              // ✅ Phân phòng cho tất cả các lịch thi (chỉ xử lý các lịch thi chưa phân phòng)
              const unassignedSchedules = schedules.filter((s) => {
                // ✅ Chỉ xử lý lịch thi chưa có ExamRoom
                return !rooms.some((r) => r.schedule?._id === s._id || r.schedule === s._id);
              });
              
              for (const schedule of unassignedSchedules) {
                const scheduleMappings = scheduleRoomMappings[schedule._id] || [];
                if (scheduleMappings.length === 0) continue;
                
                try {
                  const res = await examRoomApi.assignFixedRoomsToExamRooms({
                    examId,
                    scheduleId: schedule._id,
                    roomMappings: scheduleMappings,
                  });
                  results.push({
                    schedule: `${schedule.subject?.name || schedule.subject} - Khối ${schedule.grade}`,
                    ...res,
                  });
                } catch (err: any) {
                  console.error(`Lỗi khi phân phòng cho ${schedule.subject?.name}:`, err);
                  results.push({
                    schedule: `${schedule.subject?.name || schedule.subject} - Khối ${schedule.grade}`,
                    error: err?.response?.data?.error || err.message,
                  });
                }
              }
              
              const successCount = results.filter((r) => !r.error).length;
              const totalRooms = results.reduce((sum, r) => sum + (r.total || 0), 0);
              
              if (successCount === results.length) {
                Modal.success({
                  title: "Thành công",
                  content: `✅ Đã phân phòng cho ${successCount} lịch thi, tổng ${totalRooms} phòng thi.`,
                });
              } else {
                Modal.warning({
                  title: "Có lỗi xảy ra",
                  width: 600,
                  content: (
                    <div>
                      <p>✅ Đã phân phòng cho {successCount}/{results.length} lịch thi</p>
                      <p><strong>Các lỗi:</strong></p>
                      <ul>
                        {results.filter((r) => r.error).map((r, idx) => (
                          <li key={idx}>{r.schedule}: {r.error}</li>
                        ))}
                      </ul>
                    </div>
                  ),
                });
              }
            } else {
              // ✅ Chế độ chọn 1 lịch thi
              if (roomMappings.length === 0) {
                message.warning("Vui lòng chọn ít nhất một phòng");
                return;
              }
              
              const res = await examRoomApi.assignFixedRoomsToExamRooms({
                examId,
                scheduleId: selectedScheduleForAssign,
                roomMappings,
              });
              
              if (res.errors && res.errors.length > 0) {
                Modal.warning({
                  title: "Có lỗi xảy ra",
                  content: (
                    <div>
                      <p>{res.message || `✅ Đã tạo/cập nhật ${res.total} phòng thi`}</p>
                      <p><strong>Các lỗi:</strong></p>
                      <ul>
                        {res.errors.map((err: string, idx: number) => (
                          <li key={idx}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  ),
                  width: 500,
                });
              } else {
                Modal.success({
                  title: "Thành công",
                  content: res.message || `✅ Đã tạo/cập nhật ${res.total} phòng thi và ${res.assignmentsCreated || 0} phân phòng.`,
                });
              }
            }
            
            setOpenAssignFixedToExamRooms(false);
            setSelectedScheduleForAssign("");
            setRoomMappings([]);
            setFixedRooms([]);
            setScheduleRoomMappings({});
            // ✅ Đợi một chút để đảm bảo data đã được lưu xong
            await new Promise(resolve => setTimeout(resolve, 500));
            // ✅ Refresh tất cả data tự động
            await Promise.all([
              fetchRooms(),
              fetchSchedules(),
              fetchStats(),
              fetchAllPhysicalRooms(),
              fetchFixedRooms(), // ✅ Refresh FixedExamRooms để cập nhật capacity
            ]);
          } catch (err: any) {
            console.error(err);
            const errorMessage = err?.response?.data?.error || err?.response?.data?.details || err?.message || "❌ Lỗi phân phòng cố định vào phòng thi";
            Modal.error({
              title: "Lỗi",
              content: errorMessage,
              width: 500,
            });
          } finally {
            setAssigningFixedToExam(false);
          }
        }}
        confirmLoading={assigningFixedToExam}
        width={800}
      >
        <Space direction="vertical" style={{ width: "100%" }} size="middle">
          <div>
            <Text strong>Chọn lịch thi:</Text>
            <Select
              value={selectedScheduleForAssign}
              onChange={async (value) => {
                setSelectedScheduleForAssign(value);
                if (value === "all") {
                  // ✅ Chế độ "Tất cả lịch thi"
                  try {
                    setLoadingFixedRooms(true);
                    // ✅ Lấy tất cả FixedExamRooms cho tất cả các khối
                    const allGrades = exam?.grades || [];
                    const allFixedRooms: any[] = [];
                    for (const grade of allGrades) {
                      try {
                        const fixedRes = await examRoomApi.getFixedRooms({
                          examId,
                          grade: String(grade),
                        });
                        if (fixedRes.data) {
                          allFixedRooms.push(...fixedRes.data);
                        }
                      } catch (err) {
                        console.error(`Lỗi khi tải FixedRooms cho khối ${grade}:`, err);
                      }
                    }
                    setFixedRooms(allFixedRooms);
                    // ✅ Khởi tạo scheduleRoomMappings rỗng
                    setScheduleRoomMappings({});
                  } catch (err) {
                    console.error(err);
                    message.error("Lỗi khi tải danh sách phòng nhóm");
                  } finally {
                    setLoadingFixedRooms(false);
                  }
                } else {
                  // ✅ Chế độ chọn 1 lịch thi
                  const schedule = schedules.find((s) => s._id === value);
                  if (schedule) {
                    try {
                      setLoadingFixedRooms(true);
                      const fixedRes = await examRoomApi.getFixedRooms({
                        examId,
                        grade: String(schedule.grade),
                      });
                      setFixedRooms(fixedRes.data || []);
                      
                      // ✅ Tự động map fixedRoom với phòng thường (type: "normal") - chỉ lấy phòng thường
                      const normalRooms = allRooms.filter((r) => r.type === "normal" || !r.type); // ✅ Chỉ lấy phòng thường
                      const mappings: Array<{ fixedRoomId: string; roomId: string }> = [];
                      fixedRes.data?.forEach((fixedRoom: any, index: number) => {
                        if (normalRooms[index]) {
                          mappings.push({
                            fixedRoomId: fixedRoom._id,
                            roomId: normalRooms[index]._id,
                          });
                        }
                      });
                      setRoomMappings(mappings);
                    } catch (err) {
                      console.error(err);
                      message.error("Lỗi khi tải danh sách phòng nhóm");
                    } finally {
                      setLoadingFixedRooms(false);
                    }
                  }
                }
              }}
              style={{ width: "100%", marginTop: 8 }}
              placeholder="Chọn lịch thi"
            >
              <Option value="all">📋 Tất cả lịch thi (chưa phân phòng)</Option>
              {schedules
                .filter((s) => {
                  // ✅ Chỉ hiển thị lịch thi chưa có ExamRoom
                  return !rooms.some((r) => r.schedule?._id === s._id || r.schedule === s._id);
                })
                .map((s) => (
                  <Option key={s._id} value={s._id}>
                    {s.subject?.name || s.subject} - Khối {s.grade} - {s.date ? new Date(s.date).toLocaleDateString("vi-VN") : ""} {s.startTime}
                  </Option>
                ))}
            </Select>
          </div>

          {loadingFixedRooms ? (
            <Spin />
          ) : selectedScheduleForAssign === "all" ? (
            // ✅ Chế độ "Tất cả lịch thi" - hiển thị theo từng schedule (chỉ hiển thị chưa phân phòng)
            <div>
              <Text strong>Chọn phòng thực tế cho từng lịch thi:</Text>
              <Space direction="vertical" style={{ width: "100%", marginTop: 12 }} size="large">
                {schedules
                  .filter((s) => {
                    // ✅ Chỉ hiển thị lịch thi chưa có ExamRoom
                    return !rooms.some((r) => r.schedule?._id === s._id || r.schedule === s._id);
                  })
                  .map((schedule) => {
                  // ✅ Lấy FixedRooms cho khối của schedule này
                  const scheduleFixedRooms = fixedRooms.filter((fr) => String(fr.grade) === String(schedule.grade));
                  const scheduleMappings = scheduleRoomMappings[schedule._id] || [];
                  
                  if (scheduleFixedRooms.length === 0) return null;
                  
                  return (
                    <Card key={schedule._id} size="small" title={
                      <Space>
                        <Text strong>{schedule.subject?.name || schedule.subject}</Text>
                        <Tag color="blue">Khối {schedule.grade}</Tag>
                        <Tag color="cyan">
                          {schedule.date ? new Date(schedule.date).toLocaleDateString("vi-VN") : ""} {schedule.startTime}
                        </Tag>
                      </Space>
                    }>
                      <Table
                        dataSource={scheduleFixedRooms}
                        rowKey="_id"
                        pagination={false}
                        size="small"
                        columns={[
                          {
                            title: "Mã phòng nhóm",
                            dataIndex: "code",
                            key: "code",
                            width: 120,
                          },
                          {
                            title: "Số học sinh",
                            key: "studentsCount",
                            width: 100,
                            align: "center" as const,
                            render: (_, record: any) => record.capacity || record.students?.length || 0,
                          },
                          {
                            title: "Phòng thực tế",
                            key: "room",
                            render: (_, record: any) => {
                              const mapping = scheduleMappings.find((m) => m.fixedRoomId === record._id);
                              const getRoomTypeColor = (type: string) => {
                                switch (type) {
                                  case "lab":
                                    return "orange";
                                  case "computer":
                                    return "cyan";
                                  default:
                                    return "green";
                                }
                              };
                              const getRoomTypeLabel = (type: string) => {
                                switch (type) {
                                  case "lab":
                                    return "Phòng Lab";
                                  case "computer":
                                    return "Phòng Máy";
                                  default:
                                    return "Phòng Thường";
                                }
                              };
                              return (
                                <Select
                                  value={mapping?.roomId}
                                  onChange={(roomId) => {
                                    setScheduleRoomMappings((prev) => {
                                      const currentMappings = prev[schedule._id] || [];
                                      const filtered = currentMappings.filter((m) => m.fixedRoomId !== record._id);
                                      return {
                                        ...prev,
                                        [schedule._id]: [...filtered, { fixedRoomId: record._id, roomId }],
                                      };
                                    });
                                  }}
                                  style={{ width: "100%" }}
                                  placeholder="Chọn phòng thực tế"
                                  showSearch
                                  filterOption={(input, option: any) =>
                                    String(option?.label ?? "").toLowerCase().includes(input.toLowerCase())
                                  }
                                  loading={loadingAllRooms}
                                >
                                  {allRooms.map((room: any) => {
                                    const roomType = room.type || "normal";
                                    return (
                                      <Option key={room._id} value={room._id} label={room.roomCode}>
                                        <Space>
                                          <Tag color={getRoomTypeColor(roomType)}>
                                            {getRoomTypeLabel(roomType)}
                                          </Tag>
                                          <Text strong>{room.roomCode}</Text>
                                        </Space>
                                      </Option>
                                    );
                                  })}
                                </Select>
                              );
                            },
                          },
                        ]}
                      />
                    </Card>
                  );
                })}
              </Space>
            </div>
          ) : fixedRooms.length > 0 ? (
            // ✅ Chế độ chọn 1 lịch thi
            <div>
              <Text strong>Chọn phòng thực tế cho từng phòng nhóm:</Text>
              <Table
                dataSource={fixedRooms}
                rowKey="_id"
                pagination={false}
                style={{ marginTop: 12 }}
                columns={[
                  {
                    title: "Mã phòng nhóm",
                    dataIndex: "code",
                    key: "code",
                  },
                  {
                    title: "Số học sinh",
                    key: "studentsCount",
                    render: (_, record: any) => record.capacity || record.students?.length || 0,
                  },
                  {
                    title: "Phòng thực tế",
                    key: "room",
                    render: (_, record: any) => {
                      const mapping = roomMappings.find((m) => m.fixedRoomId === record._id);
                      const getRoomTypeColor = (type: string) => {
                        switch (type) {
                          case "lab":
                            return "orange";
                          case "computer":
                            return "cyan";
                          default:
                            return "green";
                        }
                      };
                      const getRoomTypeLabel = (type: string) => {
                        switch (type) {
                          case "lab":
                            return "Phòng Lab";
                          case "computer":
                            return "Phòng Máy";
                          default:
                            return "Phòng Thường";
                        }
                      };
                      return (
                        <Select
                          value={mapping?.roomId}
                          onChange={(roomId) => {
                            setRoomMappings((prev) => {
                              const filtered = prev.filter((m) => m.fixedRoomId !== record._id);
                              return [...filtered, { fixedRoomId: record._id, roomId }];
                            });
                          }}
                          style={{ width: "100%" }}
                          placeholder="Chọn phòng thực tế"
                          showSearch
                          filterOption={(input, option: any) =>
                            String(option?.label ?? "").toLowerCase().includes(input.toLowerCase())
                          }
                          loading={loadingAllRooms}
                        >
                          {allRooms.map((room: any) => {
                            const roomType = room.type || "normal";
                            return (
                              <Option key={room._id} value={room._id} label={room.roomCode}>
                                <Space>
                                  <Tag color={getRoomTypeColor(roomType)}>
                                    {getRoomTypeLabel(roomType)}
                                  </Tag>
                                  <Text strong>{room.roomCode}</Text>
                                </Space>
                              </Option>
                            );
                          })}
                        </Select>
                      );
                    },
                  },
                ]}
              />
            </div>
          ) : selectedScheduleForAssign ? (
            <Text type="secondary">Chưa có phòng nhóm cho khối này. Vui lòng phân học sinh vào phòng nhóm trước.</Text>
          ) : null}
        </Space>
      </Modal>

    </div>
  );
}
