// src/pages/ExamCalendar.tsx
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { format, addMinutes } from 'date-fns';
import * as api from "@/services/examApi";

import { useParams } from 'react-router-dom';

interface Schedule {
  _id: string;
  subjectId: { name: string };
  examClassId: { classId: { className: string } };
  roomId: { code: string };
  date: string;
  startTime: string;
  duration: number;
}

export default function ExamCalendar() {
  const { examId } = useParams();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [dragging, setDragging] = useState<any>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [currentSchedule, setCurrentSchedule] = useState<Schedule | null>(null);
  const [suggested, setSuggested] = useState<{ teacherId: string; fullName: string; subjectId?: any }[]>([]);
  const [selectedTeachers, setSelectedTeachers] = useState<string[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [createDate, setCreateDate] = useState<string>('');
  const [createStart, setCreateStart] = useState<string>('08:00');
  const [createEnd, setCreateEnd] = useState<string>('09:30');
  const [createExamClassId, setCreateExamClassId] = useState<string>('');
  const [createSubjectId, setCreateSubjectId] = useState<string>('');
  const [createRoomId, setCreateRoomId] = useState<string>('');
  const [examClasses, setExamClasses] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [editDate, setEditDate] = useState<string>('');
  const [editStart, setEditStart] = useState<string>('');
  const [editEnd, setEditEnd] = useState<string>('');
  const [editRoomId, setEditRoomId] = useState<string>('');
  const [editStatus, setEditStatus] = useState<string>('draft');

  useEffect(() => {
    if (!examId) return;
    examApi.getExamSchedules({ examId }).then((res) => {
      setSchedules(res.schedules as any);
    }).catch(() => {
      // ignore
    });
    examApi.getLookups(String(examId)).then((res) => {
      setExamClasses(res.examClasses || []);
      setRooms(res.rooms || []);
      setSubjects(res.subjects || []);
    }).catch(() => {
      setExamClasses([]); setRooms([]); setSubjects([]);
    });
  }, [examId]);

  const timeSlots = Array.from({ length: 24 }, (_, i) => {
    const hour = String(i).padStart(2, '0');
    return `${hour}:00`;
  });

  const handleDrop = async (e: any, date: string, time: string) => {
    e.preventDefault();
    if (!dragging) return;

    const data = {
      examId,
      examClassId: dragging.examClassId,
      subjectId: dragging.subjectId,
      roomId: dragging.roomId,
      date,
      startTime: time,
      duration: 90,
    };

    try {
      const res = await examApi.createSchedule(data);
      // API trả { success, schedules }
      setSchedules([...(schedules || []), ...((res as any).schedules || [])]);
    } catch (err) {
      alert('Lỗi xếp lịch');
    }
    setDragging(null);
  };

  const openAssign = async (slot: Schedule) => {
    setCurrentSchedule(slot);
    setAssignOpen(true);
    setSelectedTeachers([]);
    try {
      const res = await examApi.suggestInvigilators(examId!, slot.date, slot.startTime);
      setSuggested(res.availableTeachers || []);
    } catch (e) {
      setSuggested([]);
    }
  };

  const openEdit = (slot: Schedule) => {
    setCurrentSchedule(slot);
    setEditOpen(true);
    setEditDate(slot.date);
    setEditStart(slot.startTime);
    const end = slot.duration ? format(addMinutes(new Date(`${slot.date}T${slot.startTime}`), slot.duration), 'HH:mm') : '';
    setEditEnd(end);
    setEditRoomId((slot as any).roomId || '');
    setEditStatus((slot as any).status || 'draft');
  };

  const submitAssign = async () => {
    if (!currentSchedule) return;
    for (const t of selectedTeachers) {
      await examApi.assignInvigilator({ scheduleId: (currentSchedule as any)._id, teacherId: t });
    }
    setAssignOpen(false);
  };

  const openCreate = (presetDate?: string, presetTime?: string) => {
    if (presetDate) setCreateDate(presetDate);
    if (presetTime) setCreateStart(presetTime);
    setCreateOpen(true);
  };

  const submitCreate = async () => {
    if (!examId || !createDate || !createStart || !createEnd || !createExamClassId || !createSubjectId || !createRoomId) {
      alert('Vui lòng nhập đầy đủ thông tin');
      return;
    }
    const [sh, sm] = createStart.split(':').map(Number);
    const [eh, em] = createEnd.split(':').map(Number);
    const duration = (eh * 60 + em) - (sh * 60 + sm);
    if (duration <= 0) {
      alert('Giờ kết thúc phải sau giờ bắt đầu');
      return;
    }
    try {
      const res = await examApi.createSchedule({
        examId: String(examId),
        examClassId: createExamClassId,
        subjectId: createSubjectId,
        roomId: createRoomId,
        date: createDate,
        startTime: createStart,
        duration,
      } as any);
      setSchedules([...(schedules || []), ...((res as any).schedules || [])]);
      setCreateOpen(false);
    } catch (e) {
      alert('Tạo ca thi thất bại');
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Lịch thi - {examId}</h1>
        <Button onClick={() => openCreate()}>+ Tạo ca thi</Button>
      </div>

      <div className="grid grid-cols-8 gap-1 text-xs">
        <div></div>
        {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(day => (
          <div key={day} className="font-bold text-center p-2 bg-gray-100">{day}</div>
        ))}

        {timeSlots.map(time => (
          <div key={time} className="col-span-8 grid grid-cols-8 gap-1">
            <div className="text-right pr-2 text-gray-600">{time}</div>
            {Array(7).fill(0).map((_, i) => {
              const date = new Date();
              date.setDate(date.getDate() + i);
              const dateStr = format(date, 'yyyy-MM-dd');
              const slot = schedules.find(s => s.date === dateStr && s.startTime === time);

              return (
                <div
                  key={i}
                  className="border min-h-12 p-1 bg-white hover:bg-gray-50"
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => handleDrop(e, dateStr, time)}
                  onDoubleClick={() => openCreate(dateStr, time)}
                >
                  {slot && (
                    <div className="text-xs bg-blue-100 p-1 rounded cursor-pointer" onClick={() => openEdit(slot)}>
                      <div>{slot.subjectId.name}</div>
                      <div>{slot.examClassId.classId.className}</div>
                      <div>P.{(slot as any).roomId}</div>
                      <div>
                        {slot.startTime}
                        {slot.duration ? ` - ${format(addMinutes(new Date(`${slot.date}T${slot.startTime}`), slot.duration), 'HH:mm')}` : ''}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Danh sách lớp để kéo */}
      <div className="mt-8">
        <h3 className="font-bold mb-2">Kéo lớp vào lịch</h3>
        <div className="flex gap-2 flex-wrap">
          {['12A1', '12A2', '11A1'].map(cls => (
            <div
              key={cls}
              draggable
              onDragStart={e => setDragging({ examClassId: cls, subjectId: 'toan', roomId: 'r1' })}
              className="bg-green-100 px-3 py-1 rounded cursor-move"
            >
              {cls} - Toán
            </div>
          ))}
        </div>
      </div>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Phân công giám thị</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-gray-600">
              {currentSchedule && (
                <div>
                  <div>Môn: {currentSchedule.subjectId?.name}</div>
                  <div>Lớp: {currentSchedule.examClassId?.classId?.className}</div>
                  <div>Ngày: {new Date(currentSchedule.date).toLocaleDateString()} • Ca: {currentSchedule.startTime}</div>
                </div>
              )}
            </div>
            <div className="max-h-64 overflow-auto border rounded">
              {suggested.length === 0 && (
                <div className="p-3 text-sm text-gray-500">Không có gợi ý</div>
              )}
              {suggested.map((t) => (
                <label key={t.teacherId} className="flex items-center gap-2 px-3 py-2 border-b last:border-b-0">
                  <input
                    type="checkbox"
                    checked={selectedTeachers.includes(t.teacherId)}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedTeachers([...selectedTeachers, t.teacherId]);
                      else setSelectedTeachers(selectedTeachers.filter(x => x !== t.teacherId));
                    }}
                  />
                  <span className="text-sm">{t.fullName}</span>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAssignOpen(false)}>Hủy</Button>
              <Button onClick={submitAssign} disabled={selectedTeachers.length === 0}>Gán</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tạo ca thi</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm">Ngày</label>
              <input className="border rounded px-2 py-2" type="date" value={createDate} onChange={e => setCreateDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-sm">Giờ bắt đầu</label>
              <input className="border rounded px-2 py-2" type="time" value={createStart} onChange={e => setCreateStart(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-sm">Giờ kết thúc</label>
              <input className="border rounded px-2 py-2" type="time" value={createEnd} onChange={e => setCreateEnd(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-sm">Lớp (ExamClass)</label>
              <select className="border rounded px-2 py-2" value={createExamClassId} onChange={e => setCreateExamClassId(e.target.value)}>
                <option value="">-- Chọn lớp --</option>
                {examClasses.map((ec) => (
                  <option key={ec._id} value={ec._id}>{ec.classId?.className} ({ec.blockCode})</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm">Môn</label>
              <select className="border rounded px-2 py-2" value={createSubjectId} onChange={e => setCreateSubjectId(e.target.value)}>
                <option value="">-- Chọn môn --</option>
                {subjects.map((s) => (
                  <option key={s._id} value={s._id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm">Phòng</label>
              <select className="border rounded px-2 py-2" value={createRoomId} onChange={e => setCreateRoomId(e.target.value)}>
                <option value="">-- Chọn phòng --</option>
                {rooms.map((r) => (
                  <option key={r.roomId} value={r.roomId}>{r.code}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Hủy</Button>
            <Button onClick={submitCreate}>Tạo</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chỉnh sửa ca thi</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm">Ngày</label>
              <input className="border rounded px-2 py-2" type="date" value={editDate} onChange={e => setEditDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-sm">Giờ bắt đầu</label>
              <input className="border rounded px-2 py-2" type="time" value={editStart} onChange={e => setEditStart(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-sm">Giờ kết thúc</label>
              <input className="border rounded px-2 py-2" type="time" value={editEnd} onChange={e => setEditEnd(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-sm">Phòng</label>
              <select className="border rounded px-2 py-2" value={editRoomId} onChange={e => setEditRoomId(e.target.value)}>
                <option value="">-- Chọn phòng --</option>
                {rooms.map((r) => (
                  <option key={r.roomId} value={r.roomId}>{r.code}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm">Trạng thái</label>
              <select className="border rounded px-2 py-2" value={editStatus} onChange={e => setEditStatus(e.target.value)}>
                <option value="draft">Nháp</option>
                <option value="confirmed">Xác nhận</option>
                <option value="cancelled">Hủy</option>
              </select>
            </div>
          </div>
          <div className="flex justify-between gap-2 mt-2">
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => currentSchedule && openAssign(currentSchedule)}>Gán giám thị</Button>
              <Button variant="destructive" onClick={async () => {
                if (!currentSchedule) return;
                await examApi.deleteSchedule((currentSchedule as any)._id);
                setSchedules((schedules || []).filter((s: any) => s._id !== (currentSchedule as any)._id));
                setEditOpen(false);
              }}>Xóa</Button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditOpen(false)}>Hủy</Button>
              <Button onClick={async () => {
                if (!currentSchedule) return;
                const [sh, sm] = editStart.split(':').map(Number);
                const [eh, em] = editEnd.split(':').map(Number);
                const duration = (eh * 60 + em) - (sh * 60 + sm);
                if (duration <= 0) { alert('Giờ kết thúc phải sau giờ bắt đầu'); return; }
                const updated = await examApi.updateSchedule((currentSchedule as any)._id, {
                  roomId: editRoomId,
                  date: editDate,
                  startTime: editStart,
                  duration,
                  status: editStatus,
                });
                setSchedules((prev: any[]) => (prev || []).map((s: any) => s._id === updated.schedule._id ? updated.schedule : s));
                setEditOpen(false);
              }}>Lưu</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}