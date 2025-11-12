// src/pages/admin/exams/RoomAssignments.tsx
import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Table, Button, message, Space, Spin, Tag } from "antd";
import * as api from "@/services/examApi";

export type RoomAssignment = {
  _id: string;
  examScheduleId: string;
  roomId: string;
  studentId: { name: string } | string;
  sbd: string;
  seatNumber: number;
};

export default function RoomAssignments() {
  const { id: examId } = useParams<{ id: string }>(); // lấy examId từ URL
  const [assignments, setAssignments] = useState<RoomAssignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyRows, setBusyRows] = useState<Record<string, boolean>>({});
  const [schedulesMap, setSchedulesMap] = useState<Record<string, string>>({});
  const [roomsMap, setRoomsMap] = useState<Record<string, string>>({});

  const fetchAssignments = async () => {
    if (!examId) return;
    setLoading(true);
    try {
      const res = await api.getRoomAssignments(examId);
      setAssignments(res.data);

      const lookupsRes = await api.getLookups(examId);
      const schedMap: Record<string, string> = {};
      lookupsRes.subjects.forEach((s: any) => { schedMap[s._id] = s.name; });
      const roomMap: Record<string, string> = {};
      lookupsRes.rooms.forEach((r: any) => { roomMap[r._id] = r.name; });

      setSchedulesMap(schedMap);
      setRoomsMap(roomMap);
    } catch (err: any) {
      message.error(err?.message || "Lỗi khi tải phân phòng");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, [examId]);

  const onAutoAssign = async () => {
    if (!examId) return;
    setLoading(true);
    try {
      const res = await api.getExamSchedules(examId);
      const scheduleIds = res.data.map((s: any) => s._id);
      await api.autoAssignRoomsAdvanced(scheduleIds);
      message.success("Auto assign xong!");
      fetchAssignments();
    } catch (err: any) {
      message.error(err?.message || "Lỗi khi auto assign");
    } finally {
      setLoading(false);
    }
  };

  const onAutoAssignSingle = async () => {
    const newBusy: Record<string, boolean> = {};
    assignments.forEach(a => (newBusy[a._id] = true));
    setBusyRows(newBusy);

    try {
      await Promise.all(
        assignments.map(async (a) => {
          try {
            await api.autoAssignRoomSingle(a._id);
          } catch (e: any) {
            message.error(`Học sinh ${typeof a.studentId === "string" ? a.studentId : a.studentId?.name}: ${e?.message || "Error"}`);
          } finally {
            setBusyRows(prev => ({ ...prev, [a._id]: false }));
          }
        })
      );
      message.success("Auto assign từng học sinh xong");
      fetchAssignments();
    } catch (err: any) {
      message.error(err?.message || "Error");
    }
  };

  const columns = [
    {
      title: "Môn",
      dataIndex: "examScheduleId",
      render: (d: any) => schedulesMap[d] || "-",
    },
    {
      title: "Phòng",
      dataIndex: "roomId",
      render: (d: any) => roomsMap[d] || "-",
    },
    {
      title: "Học sinh",
      dataIndex: "studentId",
      render: (d: any) => (typeof d === "string" ? d : d?.name || "-"),
    },
    { title: "SBD", dataIndex: "sbd" },
    { title: "Seat", dataIndex: "seatNumber" },
    {
      title: "Trạng thái",
      render: (_: any, r: RoomAssignment) => {
        if (busyRows[r._id]) return <Spin size="small" />;
        if (!r.roomId) return <Tag color="red">Chưa assign</Tag>;
        return <Tag color="green">OK</Tag>;
      },
      width: 100,
    },
  ];

  if (!examId) return <div>Không có examId</div>;

  return (
    <div>
      <Space style={{ marginBottom: 12 }}>
        <Button type="primary" onClick={onAutoAssign} loading={loading}>
          Auto assign toàn bộ
        </Button>
        <Button onClick={onAutoAssignSingle} disabled={loading}>
          Auto assign từng học sinh
        </Button>
        <Button onClick={fetchAssignments} disabled={loading}>
          Refresh
        </Button>
      </Space>

      {loading && assignments.length === 0 ? (
        <div style={{ textAlign: "center", padding: 24 }}>
          <Spin size="large" />
        </div>
      ) : (
        <Table
          rowKey="_id"
          dataSource={assignments}
          columns={columns}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 800 }}
        />
      )}
    </div>
  );
}
