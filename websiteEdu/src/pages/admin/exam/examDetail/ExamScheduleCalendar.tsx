import React, { useMemo, useRef, useState } from "react";
import { Card, Space, Tag, Typography, message, Modal, TimePicker, Button, Divider, Select, Row, Col } from "antd";
import { Clock, CalendarDays } from "lucide-react";
import dayjs from "dayjs";
import minMax from "dayjs/plugin/minMax";
dayjs.extend(minMax);

const { Text } = Typography;
const { Option } = Select;

// ✅ Các mốc thời gian để hiển thị
const TIME_MARKERS = ["07:00", "08:00", "09:00", "10:00", "11:00", "12:00", "12:30", "13:00", "14:00", "15:00", "16:00", "17:00"];

// ✅ Component đồng hồ analog (hình tròn)
interface AnalogClockProps {
  hour: number;
  minute: number;
  onChange: (hour: number, minute: number) => void;
  size?: number;
}

const AnalogClock: React.FC<AnalogClockProps> = ({ hour, minute, onChange, size = 280 }) => {
  const clockRef = React.useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState<"hour" | "minute" | null>(null);

  const centerX = size / 2;
  const centerY = size / 2;
  const radius = size / 2 - 20;

  // Tính góc cho kim giờ (12 giờ = 0 độ, theo chiều kim đồng hồ)
  const hourAngle = ((hour % 12) * 30 + minute * 0.5 - 90) * (Math.PI / 180);
  const minuteAngle = (minute * 6 - 90) * (Math.PI / 180);

  // Tính vị trí từ góc và khoảng cách
  const getPosition = (angle: number, distance: number) => {
    return {
      x: centerX + Math.cos(angle) * distance,
      y: centerY + Math.sin(angle) * distance,
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!clockRef.current) return;
    setIsDragging(true);
    
    const rect = clockRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - centerX;
    const y = e.clientY - rect.top - centerY;
    const distance = Math.sqrt(x * x + y * y);
    
    // Nếu click gần tâm (< 60px) thì chỉnh giờ, ngược lại chỉnh phút
    if (distance < radius * 0.4) {
      setDragMode("hour");
    } else {
      setDragMode("minute");
    }
    
    updateTime(x, y, distance);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !clockRef.current) return;
    
    const rect = clockRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - centerX;
    const y = e.clientY - rect.top - centerY;
    const distance = Math.sqrt(x * x + y * y);
    
    updateTime(x, y, distance);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragMode(null);
  };

  const updateTime = (x: number, y: number, distance: number) => {
    let angle = Math.atan2(y, x) * (180 / Math.PI);
    angle = (angle + 90 + 360) % 360; // Chuyển từ -180-180 sang 0-360, với 12h = 0 độ

    if (dragMode === "hour" || distance < radius * 0.4) {
      // Chỉnh giờ - click vào vùng trong (gần tâm)
      // Tính giờ từ góc (mỗi giờ = 30 độ, 12h = 0 độ)
      let hour12 = Math.round(angle / 30);
      if (hour12 === 0 || hour12 === 12) hour12 = 12;
      
      // Chuyển sang format 24h đơn giản
      // Giữ nguyên AM/PM dựa trên giờ hiện tại
      let newHour: number;
      if (hour12 === 12) {
        // 12 giờ có thể là 0 (nửa đêm) hoặc 12 (trưa)
        newHour = hour < 12 ? 0 : 12;
      } else {
        // Các giờ khác: nếu đang PM thì +12, nếu AM thì giữ nguyên
        newHour = hour >= 12 ? hour12 + 12 : hour12;
      }
      
      onChange(newHour % 24, minute);
    } else {
      // Chỉnh phút - click vào vùng ngoài
      let newMinute = Math.round(angle / 6);
      newMinute = (newMinute + 60) % 60;
      // Làm tròn về 0, 15, 30, 45
      newMinute = Math.round(newMinute / 15) * 15;
      onChange(hour, newMinute);
    }
  };

  const hourPos = getPosition(hourAngle, radius * 0.5);
  const minutePos = getPosition(minuteAngle, radius * 0.75);

  return (
    <div
      ref={clockRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{
        width: size,
        height: size,
        position: "relative",
        margin: "0 auto",
        cursor: isDragging ? "grabbing" : "grab",
        userSelect: "none",
      }}
    >
      {/* Vòng tròn ngoài */}
      <svg width={size} height={size} style={{ position: "absolute", top: 0, left: 0 }}>
        <circle
          cx={centerX}
          cy={centerY}
          r={radius}
          fill="white"
          stroke="#d9d9d9"
          strokeWidth="2"
        />
        
        {/* Vẽ các số giờ */}
        {[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((num, i) => {
          const angle = (i * 30 - 90) * (Math.PI / 180);
          const pos = getPosition(angle, radius - 25);
          return (
            <text
              key={num}
              x={pos.x}
              y={pos.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="16"
              fontWeight="bold"
              fill="#333"
            >
              {num}
            </text>
          );
        })}
        
        {/* Vẽ các vạch phút */}
        {Array.from({ length: 60 }, (_, i) => {
          const angle = (i * 6 - 90) * (Math.PI / 180);
          const isHourMark = i % 5 === 0;
          const innerRadius = radius - (isHourMark ? 15 : 20);
          const outerRadius = radius - 5;
          const innerPos = getPosition(angle, innerRadius);
          const outerPos = getPosition(angle, outerRadius);
          
          return (
            <line
              key={i}
              x1={innerPos.x}
              y1={innerPos.y}
              x2={outerPos.x}
              y2={outerPos.y}
              stroke={isHourMark ? "#333" : "#999"}
              strokeWidth={isHourMark ? 2 : 1}
            />
          );
        })}
        
        {/* Kim giờ */}
        <line
          x1={centerX}
          y1={centerY}
          x2={hourPos.x}
          y2={hourPos.y}
          stroke="#1890ff"
          strokeWidth="4"
          strokeLinecap="round"
        />
        
        {/* Kim phút */}
        <line
          x1={centerX}
          y1={centerY}
          x2={minutePos.x}
          y2={minutePos.y}
          stroke="#52c41a"
          strokeWidth="3"
          strokeLinecap="round"
        />
        
        {/* Tâm đồng hồ */}
        <circle cx={centerX} cy={centerY} r="8" fill="#1890ff" />
        <circle cx={centerX} cy={centerY} r="4" fill="white" />
      </svg>
    </div>
  );
};

interface Props {
  schedules: any[];
  exam?: any;
  onMoveBatch: (updates: { id: string; date: string; startTime: string }[]) => Promise<void>;
  startHour?: number;
  endHour?: number;
  snapMinutes?: number;
}

export default function ExamScheduleCalendar({
  schedules,
  exam,
  onMoveBatch,
  startHour = 7,
  endHour = 17,
  snapMinutes = 30,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoverInfo, setHoverInfo] = useState<string | null>(null);

  const [pendingChanges, setPendingChanges] = useState<Record<string, { date: string; startTime: string }>>({});
  const [timeModal, setTimeModal] = useState<{ id: string; visible: boolean }>({ id: "", visible: false });
  const [tempTime, setTempTime] = useState(dayjs("07:00", "HH:mm"));
  const [tempHour, setTempHour] = useState<number>(7);
  const [tempMinute, setTempMinute] = useState<number>(0);

  // Ngày hiển thị
  // 🗓️ Sinh danh sách ngày dựa theo exam.startDate / endDate
const days = useMemo(() => {
  if (exam?.startDate && exam?.endDate) {
    const start = dayjs(exam.startDate).startOf("day");
    const end = dayjs(exam.endDate).startOf("day");
    const arr: dayjs.Dayjs[] = [];
    let cur = start.clone();

    while (cur.isBefore(end) || cur.isSame(end, "day")) {
      arr.push(cur.clone());
      cur = cur.add(1, "day");
    }

    return arr;
  }

  // fallback: nếu chưa có kỳ thi hoặc ngày rỗng, dùng mặc định 3 ngày
  return [dayjs(), dayjs().add(1, "day"), dayjs().add(2, "day")];
}, [exam]);


  // Tính vị trí theo giờ
  const slotHeight = 32;
  const totalMinutes = (endHour - startHour) * 60;
  const dayColumnHeight = Math.ceil(totalMinutes / snapMinutes) * slotHeight;

  const timeToTop = (time: string) => {
    const [h, m] = (time || "07:00").split(":").map(Number);
    const minsFromStart = (h - startHour) * 60 + m;
    return Math.max(0, (minsFromStart / snapMinutes) * slotHeight);
  };
  const minutesToHeight = (dur: number) => Math.max(24, (dur / snapMinutes) * slotHeight);

  // Kéo thả đổi ngày
  const onDragStart = (e: React.DragEvent, id: string) => {
    setDraggingId(id);
    e.dataTransfer.setData("text/plain", id);
  };
  const onDragOver = (e: React.DragEvent) => e.preventDefault();
const onDrop = (e: React.DragEvent, day: dayjs.Dayjs) => {
  e.preventDefault();
  const id = e.dataTransfer.getData("text/plain");
  const target = mergedSchedules.find((s) => s._id === id);
  if (!target || !containerRef.current) return;

  setDraggingId(null);
  setHoverInfo(null);

  // ✅ Xác định phần tử cột ngày được thả vào
  const columnRect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
  const offsetY = e.clientY - columnRect.top;

  // ✅ Quy đổi offset thành phút từ startHour
  const minutesFromStart = Math.floor((offsetY / slotHeight) * snapMinutes);
  const totalMinutes = Math.max(0, Math.min((endHour - startHour) * 60, minutesFromStart));

  // ✅ Snap vào các mốc thời gian chính (7h, 8h, 9h, 10h, 11h, 12h, 12h30, 13h, 14h, 15h, 16h, 17h)
  // Tạo danh sách các mốc thời gian chính (giờ chẵn và 12:30)
  const mainTimeSlots = TIME_MARKERS.map((time) => {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m; // Tổng số phút từ 00:00
  });

  // Tính số phút từ startHour
  const currentMinutes = startHour * 60 + totalMinutes;
  
  // Tìm mốc thời gian gần nhất (trong phạm vi 15 phút)
  let snappedMinutes = totalMinutes;
  let minDistance = Infinity;
  const snapThreshold = 15; // 15 phút

  for (const slotMinutes of mainTimeSlots) {
    const slotMinutesFromStart = slotMinutes - (startHour * 60);
    if (slotMinutesFromStart < 0 || slotMinutesFromStart > (endHour - startHour) * 60) continue;
    
    const distance = Math.abs(totalMinutes - slotMinutesFromStart);
    if (distance < snapThreshold && distance < minDistance) {
      minDistance = distance;
      snappedMinutes = slotMinutesFromStart;
    }
  }

  // Nếu không có mốc nào gần, làm tròn theo snapMinutes (30 phút)
  if (minDistance === Infinity) {
    snappedMinutes = Math.round(totalMinutes / snapMinutes) * snapMinutes;
  }

  const newHour = startHour + Math.floor(snappedMinutes / 60);
  const newMinute = snappedMinutes % 60;

  const newStartTime = `${String(newHour).padStart(2, "0")}:${String(newMinute).padStart(2, "0")}`;
  const newDateIso = day.startOf("day").toISOString();

  setPendingChanges((prev) => ({
    ...prev,
    [id]: { date: newDateIso, startTime: newStartTime },
  }));

  message.info(
    `📅 Đã dời "${target.subject?.name}" sang ${day.format("DD/MM")} lúc ${newStartTime}`
  );
};


  // Modal chỉnh giờ
  const handleOpenTimeModal = (ev: any) => {
    setTimeModal({ id: ev._id, visible: true });
    const currentTime = pendingChanges[ev._id]?.startTime || ev.startTime || "07:00";
    const [h, m] = currentTime.split(":").map(Number);
    setTempHour(h);
    setTempMinute(m);
    setTempTime(dayjs(currentTime, "HH:mm"));
  };

  const handleSaveTime = () => {
    const ev = schedules.find((s) => s._id === timeModal.id);
    if (!ev) return;
    const newTime = `${String(tempHour).padStart(2, "0")}:${String(tempMinute).padStart(2, "0")}`;
    setPendingChanges((prev) => ({
      ...prev,
      [ev._id]: { date: ev.date, startTime: newTime },
    }));
    message.info(`🕒 Đã thay đổi giờ "${ev.subject?.name}" thành ${newTime}`);
    setTimeModal({ id: "", visible: false });
  };

  // ✅ Tạo danh sách giờ và phút
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = [0, 15, 30, 45]; // Chỉ cho phép chọn 0, 15, 30, 45 phút để dễ dùng hơn

// 🧠 Gộp pendingChanges vào schedules để hiển thị tạm thời
const mergedSchedules = useMemo(() => {
  return schedules.map((s) => {
    const pending = pendingChanges[s._id];
    return pending
      ? { ...s, date: pending.date, startTime: pending.startTime }
      : s;
  });
}, [schedules, pendingChanges]);

// Gom sự kiện theo ngày (tính từ mergedSchedules)
const eventsByDay = useMemo(() => {
  const map = new Map<string, any[]>();
  for (const d of days) map.set(d.format("YYYY-MM-DD"), []);
  for (const s of mergedSchedules) {
    const key = dayjs(s.date).format("YYYY-MM-DD");
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(s);
  }
  return map;
}, [mergedSchedules, days]);


  // Gửi hàng loạt thay đổi
  const handleConfirmChanges = async () => {
    const updates = Object.entries(pendingChanges).map(([id, v]) => ({
      id,
      date: v.date,
      startTime: v.startTime,
    }));
    console.log("🧩 handleConfirmChanges chạy:", updates);
    if (!updates.length) return message.info("Không có thay đổi nào để lưu.");
    try {
      await onMoveBatch(updates);
      setPendingChanges({});
      message.success("✅ Đã lưu tất cả thay đổi!");
    } catch (err)  {
      console.error("❌ Lỗi khi lưu thay đổi:", err);
      message.error("❌ Lỗi khi lưu thay đổi.");
    }
  };

  // ✅ Kiểm tra xem có schedule nào bắt đầu tại mốc thời gian này không
  const hasScheduleAtTime = (time: string) => {
    const [th, tm] = time.split(":").map(Number);
    return mergedSchedules.some((s) => {
      const startTime = pendingChanges[s._id]?.startTime || s.startTime;
      const [sh, sm] = (startTime || "00:00").split(":").map(Number);
      return sh === th && sm === tm;
    });
  };

  return (
    <Card style={{ padding: 12 }}>
      <Space style={{ marginBottom: 12, justifyContent: "space-between", width: "100%" }}>
        <Space>
          <CalendarDays size={16} />
          <Text strong>Chế độ Lịch (nháp)</Text>
          <Text type="secondary">Kéo thả & chỉnh giờ, sau đó nhấn "Lưu thay đổi".</Text>
        </Space>
        <Button
          type="primary"
          onClick={handleConfirmChanges}
          disabled={!Object.keys(pendingChanges).length}
        >
          💾 Lưu thay đổi ({Object.keys(pendingChanges).length})
        </Button>
      </Space>

      {/* ✅ Timeline với các mốc thời gian */}
      <Card size="small" style={{ marginBottom: 16, backgroundColor: "#f5f5f5" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Text strong style={{ marginRight: 8 }}>Mốc thời gian:</Text>
          {TIME_MARKERS.map((time) => {
            const hasSchedule = hasScheduleAtTime(time);
            const is7h = time === "07:00";
            return (
              <Tag
                key={time}
                color={is7h ? "red" : hasSchedule ? "blue" : "default"}
                style={{
                  cursor: "default",
                  fontWeight: is7h || hasSchedule ? "bold" : "normal",
                  fontSize: is7h ? 14 : 12,
                  padding: is7h ? "4px 12px" : undefined,
                  border: is7h ? "2px solid #ff4d4f" : undefined,
                }}
              >
                {is7h && "🕐 "}{time}
              </Tag>
            );
          })}
        </div>
      </Card>

      <div
        ref={containerRef}
        style={{
          display: "grid",
          gridTemplateColumns: `60px repeat(${days.length}, 1fr)`, // ✅ Thêm cột cho mốc thời gian
          gap: 10,
        }}
      >
        {/* ✅ Cột hiển thị mốc thời gian */}
        <div style={{ position: "relative", height: dayColumnHeight + 40 }}>
          <div style={{ height: 40 }} /> {/* Spacer cho header ngày */}
          <div
            style={{
              position: "relative",
              height: dayColumnHeight,
              background: "#fafafa",
              borderRadius: 6,
              padding: "4px 0",
            }}
          >
            {TIME_MARKERS.map((time) => {
              const top = timeToTop(time);
              const [h, m] = time.split(":").map(Number);
              const isHalfHour = m === 30;
              const is7h = time === "07:00";
              
              return (
                <div
                  key={time}
                  style={{
                    position: "absolute",
                    top: top - 1,
                    left: 0,
                    right: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    paddingRight: 8,
                    borderTop: is7h 
                      ? "2px solid #ff4d4f" 
                      : isHalfHour 
                      ? "1px dashed #d9d9d9" 
                      : "1px solid #bfbfbf",
                    height: is7h ? 3 : isHalfHour ? 1 : 2,
                    backgroundColor: is7h ? "rgba(255, 77, 79, 0.1)" : "transparent",
                  }}
                >
                  {!isHalfHour && (
                    <Text
                      style={{
                        fontSize: is7h ? 12 : 11,
                        color: is7h ? "#ff4d4f" : "#666",
                        fontWeight: is7h ? "bold" : "bold",
                        backgroundColor: "#fafafa",
                        padding: "0 4px",
                      }}
                    >
                      {is7h && "🕐 "}{time}
                    </Text>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ✅ Các cột ngày */}
        {days.map((d) => {
          const items = eventsByDay.get(d.format("YYYY-MM-DD")) || [];
          return (
           <div
  key={d.format("YYYY-MM-DD")}
  onDragOver={onDragOver}
  onDrop={(e) => onDrop(e, d)}
  style={{
    border: "1px dashed #ccc",
    borderRadius: 8,
    padding: 8,
    minHeight: dayColumnHeight + 40,
    background:
      d.isSame(dayjs(), "day") ? "#e6f7ff" : "#fff", // 💡 highlight hôm nay
    position: "relative",
  }}
>

              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <Text strong>{d.format("DD/MM/YYYY")}</Text>
                <Text type="secondary">{d.format("ddd")}</Text>
              </div>

              <div
                style={{
                  position: "relative",
                  height: dayColumnHeight,
                  background: "#fafafa",
                  borderRadius: 6,
                }}
              >
                {/* ✅ Vẽ các mốc thời gian trong cột ngày */}
                {TIME_MARKERS.map((time) => {
                  const top = timeToTop(time);
                  const [h, m] = time.split(":").map(Number);
                  const isHalfHour = m === 30;
                  const is7h = time === "07:00";
                  
                  return (
                    <div
                      key={time}
                      style={{
                        position: "absolute",
                        top: top - 1,
                        left: 0,
                        right: 0,
                        borderTop: is7h 
                          ? "2px solid #ff4d4f" 
                          : isHalfHour 
                          ? "1px dashed #e8e8e8" 
                          : "1px solid #d9d9d9",
                        height: is7h ? 3 : isHalfHour ? 1 : 2,
                        backgroundColor: is7h ? "rgba(255, 77, 79, 0.1)" : "transparent",
                        pointerEvents: "none",
                      }}
                    />
                  );
                })}

                {items.map((ev) => {
                  const top = timeToTop(
                    pendingChanges[ev._id]?.startTime || ev.startTime
                  );
                  const height = minutesToHeight(ev.duration || 90);
                  const color = pendingChanges[ev._id]
                    ? "#bae7ff" // màu khác nếu có thay đổi
                    : ev.grade === 10
                    ? "#d6f5e0"
                    : ev.grade === 11
                    ? "#fff0d6"
                    : "#e9d7ff";

                  return (
                    <div
                      key={ev._id}
                      draggable
                      onClick={() => handleOpenTimeModal(ev)}
                      onDragStart={(e) => onDragStart(e, ev._id)}
                      style={{
                        position: "absolute",
                        left: 6,
                        right: 6,
                        top,
                        height,
                        borderRadius: 8,
                        background: color,
                        boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
                        padding: "6px 8px",
                        cursor: "grab",
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                        border:
                          draggingId === ev._id
                            ? "1px solid #1890ff"
                            : "1px solid rgba(0,0,0,0.06)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <div style={{ fontWeight: 600, fontSize: 13 }}>
                          {ev.subject?.name || "Môn"}
                        </div>
                        <Tag style={{ fontSize: 12 }}>{`Khối ${ev.grade}`}</Tag>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: 12,
                          color: "#555",
                        }}
                      >
                        <div>
                          <Clock size={12} />{" "}
                          <span style={{ marginLeft: 6 }}>
                            {pendingChanges[ev._id]?.startTime || ev.startTime}
                          </span>
                        </div>
                        <div>{ev.duration} phút</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal chỉnh giờ - Đồng hồ analog hình tròn */}
      <Modal
        title={
          <Space>
            <Clock size={18} />
            <Text strong>Chỉnh giờ bắt đầu</Text>
          </Space>
        }
        open={timeModal.visible}
        onCancel={() => setTimeModal({ id: "", visible: false })}
        onOk={handleSaveTime}
        okText="Lưu"
        destroyOnHidden
        width={500}
      >
        <div style={{ padding: "20px 0" }}>
          <Space direction="vertical" size="large" style={{ width: "100%" }} align="center">
            {/* ✅ Đồng hồ analog hình tròn */}
            <div style={{ padding: "20px", backgroundColor: "#fafafa", borderRadius: "12px" }}>
              <AnalogClock
                hour={tempHour}
                minute={tempMinute}
                onChange={(h, m) => {
                  setTempHour(h);
                  setTempMinute(m);
                }}
                size={300}
              />
            </div>

            {/* ✅ Hiển thị preview thời gian đã chọn */}
            <Card
              size="small"
              style={{
                backgroundColor: "#f0f5ff",
                border: "1px solid #91caff",
                textAlign: "center",
                width: "100%",
              }}
            >
              <Space direction="vertical" size={4}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Thời gian đã chọn:
                </Text>
                <Text
                  strong
                  style={{
                    fontSize: 32,
                    color: "#1890ff",
                    fontFamily: "monospace",
                    letterSpacing: "2px",
                  }}
                >
                  {String(tempHour).padStart(2, "0")}:
                  {String(tempMinute).padStart(2, "0")}
                </Text>
              </Space>
            </Card>

            {/* ✅ Chọn bằng Select (backup) */}
            <div style={{ width: "100%" }}>
              <Text strong style={{ marginBottom: 8, display: "block" }}>
                Hoặc chọn trực tiếp:
              </Text>
              <Row gutter={16}>
                <Col span={12}>
                  <Select
                    value={tempHour}
                    onChange={(v) => setTempHour(v)}
                    style={{ width: "100%" }}
                    size="large"
                    showSearch
                    filterOption={(input, option) =>
                      String(option?.value).includes(input)
                    }
                  >
                    {hours.map((h) => (
                      <Option key={h} value={h}>
                        <Space>
                          <Clock size={14} />
                          <Text strong>{String(h).padStart(2, "0")} giờ</Text>
                        </Space>
                      </Option>
                    ))}
                  </Select>
                </Col>
                <Col span={12}>
                  <Select
                    value={tempMinute}
                    onChange={(v) => setTempMinute(v)}
                    style={{ width: "100%" }}
                    size="large"
                    showSearch
                    filterOption={(input, option) =>
                      String(option?.value).includes(input)
                    }
                  >
                    {minutes.map((m) => (
                      <Option key={m} value={m}>
                        <Text strong>{String(m).padStart(2, "0")} phút</Text>
                      </Option>
                    ))}
                  </Select>
                </Col>
              </Row>
            </div>

            {/* ✅ Quick select buttons */}
            <div style={{ width: "100%" }}>
              <Text type="secondary" style={{ fontSize: 12, marginBottom: 8, display: "block" }}>
                Chọn nhanh:
              </Text>
              <Space wrap>
                {TIME_MARKERS.map((time) => {
                  const [h, m] = time.split(":").map(Number);
                  return (
                    <Button
                      key={time}
                      size="small"
                      type={tempHour === h && tempMinute === m ? "primary" : "default"}
                      onClick={() => {
                        setTempHour(h);
                        setTempMinute(m);
                      }}
                    >
                      {time}
                    </Button>
                  );
                })}
              </Space>
            </div>
          </Space>
        </div>
      </Modal>
    </Card>
  );
}
