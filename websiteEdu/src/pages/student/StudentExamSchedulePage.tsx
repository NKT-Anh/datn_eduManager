import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { examApi, Exam } from '@/services/examApi';

export default function StudentExamSchedulePage() {
  const { backendUser } = useAuth();
  const [exams, setExams] = useState<Exam[]>([]);
  const [examId, setExamId] = useState<string>('');
  const [schedules, setSchedules] = useState<any[]>([]);
  const studentId = backendUser?.studentId || backendUser?.userId || backendUser?.id;

  useEffect(() => {
    examApi.getAllExams().then(list => {
      setExams(list);
      if (list.length) setExamId(list[0].examId);
    });
  }, []);

  useEffect(() => {
    if (!studentId || !examId) return;
    examApi.getStudentSchedules(String(studentId), examId)
      .then(res => setSchedules(res.schedules || []))
      .catch(() => setSchedules([]));
  }, [studentId, examId]);

  const examOptions = useMemo(() => exams.map(e => ({ value: e.examId, label: `${e.name} • ${e.examId}` })), [exams]);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Lịch thi của tôi</h1>
        <select
          className="border rounded px-3 py-2"
          value={examId}
          onChange={e => setExamId(e.target.value)}
        >
          {examOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm border">
          <thead>
            <tr className="bg-gray-50">
              <th className="border px-3 py-2 text-left">Ngày</th>
              <th className="border px-3 py-2 text-left">Ca</th>
              <th className="border px-3 py-2 text-left">Thời lượng</th>
              <th className="border px-3 py-2 text-left">Môn</th>
              <th className="border px-3 py-2 text-left">Phòng</th>
              <th className="border px-3 py-2 text-left">SBD</th>
            </tr>
          </thead>
          <tbody>
            {schedules.map((s, idx) => (
              <tr key={idx}>
                <td className="border px-3 py-2">{new Date(s.date).toLocaleDateString()}</td>
                <td className="border px-3 py-2">{s.startTime}</td>
                <td className="border px-3 py-2">{s.duration} phút</td>
                <td className="border px-3 py-2">{s.subject}</td>
                <td className="border px-3 py-2">{s.roomId}</td>
                <td className="border px-3 py-2">{s.sbd}</td>
              </tr>
            ))}
            {schedules.length === 0 && (
              <tr>
                <td className="border px-3 py-6 text-center text-gray-500" colSpan={6}>Chưa có lịch</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}




