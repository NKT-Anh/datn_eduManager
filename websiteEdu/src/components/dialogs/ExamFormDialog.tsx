import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useState, useEffect } from 'react';
import schoolConfigApi from '@/services/schoolConfigApi';
import {teacherApi} from '@/services/teacherApi';
import subjectApi from '@/services/subjectApi';

export interface ExamFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: any) => Promise<void>;
  defaultValues?: any;
}

export const ExamFormDialog = ({
  open,
  onOpenChange,
  onSubmit,
  defaultValues,
}: ExamFormDialogProps) => {
  const [name, setName] = useState(defaultValues?.name || '');
  const [year, setYear] = useState(defaultValues?.year || '');
  const [semester, setSemester] = useState<'1' | '2'>(
    (defaultValues?.semester?.toLowerCase() as '1' | '2') || '1'
  );
  const [grades, setGrades] = useState<string[]>(defaultValues?.grades || []);
  const [subjects, setSubjects] = useState<string[]>(defaultValues?.subjects || []);
  const [examType, setExamType] = useState(defaultValues?.examType || 'Học kỳ');
  const [examMethod, setExamMethod] = useState(defaultValues?.examMethod || 'Tự luận');
  const [roomType, setRoomType] = useState(defaultValues?.roomType || 'Phòng học');
  const [startDate, setStartDate] = useState(defaultValues?.startDate || '');
  const [endDate, setEndDate] = useState(defaultValues?.endDate || '');
  const [sessionCount, setSessionCount] = useState(defaultValues?.sessionCount || 1);
  const [supervisors, setSupervisors] = useState<string[]>(defaultValues?.supervisors || []);
  const [note, setNote] = useState(defaultValues?.note || '');

  const [yearOptions, setYearOptions] = useState<{ code: string; name: string }[]>([]);
  const [subjectOptions, setSubjectOptions] = useState<{ _id: string; name: string }[]>([]);
  const [teacherOptions, setTeacherOptions] = useState<{ _id: string; name: string }[]>([]);

  // 🧩 Fetch dữ liệu cấu hình
  useEffect(() => {
    schoolConfigApi.getSchoolYears().then((res) => {
      setYearOptions(res.data || []);
    });
    subjectApi.getSubjects().then((res) => {
      setSubjectOptions(
        (res || []).map((s) => ({ _id: s._id || '', name: s.name }))
      );
    });
    
    teacherApi.getAll().then((res) => {
      setTeacherOptions(res || []);
    });
  }, []);

  // 🧾 Gửi dữ liệu
  const handleSubmit = async () => {
    await onSubmit({
      name,
      year,
      semester: semester.toUpperCase(),
      grades: grades.length ? grades : ['10', '11', '12'],
      subjects,
      examType,
      examMethod,
      roomType,
      startDate,
      endDate,
      sessionCount: Number(sessionCount),
      supervisors,
      note,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{defaultValues ? 'Chỉnh sửa kỳ thi' : 'Tạo kỳ thi mới'}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-3">
          {/* --- Tên kỳ thi --- */}
          <div className="col-span-2 space-y-1">
            <Label>Tên kỳ thi</Label>
            <Input
              placeholder="VD: Kỳ thi học kỳ 1 năm 2025"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* --- Năm học --- */}
          <div className="space-y-1">
            <Label>Năm học</Label>
            <select
              className="w-full border rounded px-2 py-2"
              value={year}
              onChange={(e) => setYear(e.target.value)}
            >
              {yearOptions.map((y) => (
                <option key={y.code} value={y.code}>
                  {y.name || y.code}
                </option>
              ))}
            </select>
          </div>

          {/* --- Học kỳ --- */}
          <div className="space-y-1">
            <Label>Học kỳ</Label>
            <div className="flex gap-4">
              {(['1', '2'] as const).map((sem) => (
                <label key={sem} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value={sem}
                    checked={semester === sem}
                    onChange={(e) => setSemester(e.target.value as '1' | '2')}
                  />
                  <span>Học kỳ {sem === '1' ? '1' : '2'}</span>
                </label>
              ))}
            </div>
          </div>

          {/* --- Khối áp dụng --- */}
          <div className="col-span-2 space-y-1">
            <Label>Khối học</Label>
            <div className="flex gap-4">
              {['10', '11', '12'].map((g) => (
                <label key={g} className="flex items-center space-x-2">
                  <Checkbox
                    checked={grades.includes(g)}
                    onCheckedChange={(checked) => {
                      if (checked) setGrades([...grades, g]);
                      else setGrades(grades.filter((x) => x !== g));
                    }}
                  />
                  <span>Khối {g}</span>
                </label>
              ))}
            </div>
          </div>

          {/* --- Môn thi --- */}
          <div className="col-span-2 space-y-1">
            <Label>Môn thi</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {subjectOptions.map((s) => (
                <label key={s._id} className="flex items-center gap-2">
                  <Checkbox
                    checked={subjects.includes(s._id)}
                    onCheckedChange={(checked) => {
                      if (checked) setSubjects([...subjects, s._id]);
                      else setSubjects(subjects.filter((x) => x !== s._id));
                    }}
                  />
                  <span>{s.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* --- Loại kỳ thi & hình thức thi --- */}
          <div className="space-y-1">
            <Label>Loại kỳ thi</Label>
            <select
              className="w-full border rounded px-2 py-2"
              value={examType}
              onChange={(e) => setExamType(e.target.value)}
            >
              <option>Giữa kỳ</option>
              <option>Cuối kỳ</option>
              <option>Học kỳ</option>
              <option>Kiểm tra tập trung</option>
            </select>
          </div>

          <div className="space-y-1">
            <Label>Hình thức thi</Label>
            <select
              className="w-full border rounded px-2 py-2"
              value={examMethod}
              onChange={(e) => setExamMethod(e.target.value)}
            >
              <option>Tự luận</option>
              <option>Trắc nghiệm</option>
              <option>Kết hợp</option>
            </select>
          </div>

          {/* --- Loại phòng thi --- */}
          <div className="space-y-1">
            <Label>Loại phòng thi</Label>
            <select
              className="w-full border rounded px-2 py-2"
              value={roomType}
              onChange={(e) => setRoomType(e.target.value)}
            >
              <option>Phòng học</option>
              <option>Phòng máy</option>
              <option>Hội trường</option>
            </select>
          </div>

          {/* --- Số ca thi --- */}
          <div className="space-y-1">
            <Label>Số ca thi</Label>
            <Input
              type="number"
              min="1"
              value={sessionCount}
              onChange={(e) => setSessionCount(e.target.value)}
            />
          </div>

          {/* --- Thời gian thi --- */}
          <div className="space-y-1">
            <Label>Ngày bắt đầu</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label>Ngày kết thúc</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          {/* --- Giáo viên canh thi --- */}
          <div className="col-span-2 space-y-1">
            <Label>Giáo viên canh thi</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {teacherOptions.map((t) => (
                <label key={t._id} className="flex items-center gap-2">
                  <Checkbox
                    checked={supervisors.includes(t._id)}
                    onCheckedChange={(checked) => {
                      if (checked) setSupervisors([...supervisors, t._id]);
                      else setSupervisors(supervisors.filter((x) => x !== t._id));
                    }}
                  />
                  <span>{t.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* --- Ghi chú --- */}
          <div className="col-span-2 space-y-1">
            <Label>Ghi chú</Label>
            <Textarea
              placeholder="Ghi chú thêm về kỳ thi..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        {/* --- Nút hành động --- */}
        <div className="flex justify-end gap-2 mt-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button onClick={handleSubmit}>Lưu</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
