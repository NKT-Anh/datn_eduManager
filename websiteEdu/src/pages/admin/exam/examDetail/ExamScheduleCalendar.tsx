import React, { useMemo, useRef, useState } from "react";
import { Card, Space, Tag, Typography, message, Modal, TimePicker, Button } from "antd";
import { Clock, CalendarDays } from "lucide-react";
import dayjs from "dayjs";
import minMax from "dayjs/plugin/minMax";
dayjs.extend(minMax);

const { Text } = Typography;

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

  // ✅ Làm tròn theo snapMinutes
  const snappedMinutes = Math.round(totalMinutes / snapMinutes) * snapMinutes;
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
    setTempTime(dayjs(ev.startTime, "HH:mm"));
  };

  const handleSaveTime = () => {
    const ev = schedules.find((s) => s._id === timeModal.id);
    if (!ev) return;
    setPendingChanges((prev) => ({
      ...prev,
      [ev._id]: { date: ev.date, startTime: dayjs(tempTime).format("HH:mm") },
    }));
    message.info(`🕒 Đã thay đổi giờ "${ev.subject?.name}"`);
    setTimeModal({ id: "", visible: false });
  };

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

  return (
    <Card style={{ padding: 12 }}>
      <Space style={{ marginBottom: 12, justifyContent: "space-between", width: "100%" }}>
        <Space>
          <CalendarDays size={16} />
          <Text strong>Chế độ Lịch (nháp)</Text>
          <Text type="secondary">Kéo thả & chỉnh giờ, sau đó nhấn “Lưu thay đổi”.</Text>
        </Space>
        <Button
          type="primary"
          onClick={handleConfirmChanges}
          disabled={!Object.keys(pendingChanges).length}
        >
          💾 Lưu thay đổi ({Object.keys(pendingChanges).length})
        </Button>
      </Space>

      <div
        ref={containerRef}
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${days.length}, 1fr)`,
          gap: 10,
        }}
      >
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

      {/* Modal chỉnh giờ */}
      <Modal
        title="Chỉnh giờ bắt đầu"
        open={timeModal.visible}
        onCancel={() => setTimeModal({ id: "", visible: false })}
        onOk={handleSaveTime}
        okText="Lưu"
        destroyOnHidden
      >
        <TimePicker
          value={tempTime}
          format="HH:mm"
          onChange={(v) => v && setTempTime(v)}
          style={{ width: "100%" }}
        />
      </Modal>
    </Card>
  );
}
