import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { scheduleApi } from '@/services/scheduleApi';
import { getScheduleConfig } from '@/services/scheduleConfigApi';
import { ViewSchedule } from '@/components/schedule/ViewSchedule';
import { Calendar, Lock, Unlock } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { ScheduleConfig } from '@/types/schedule';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useStudents } from '@/hooks/auth/useStudents';

const StudentSchedulePage = () => {
  const { backendUser } = useAuth();
  const [schedule, setSchedule] = useState<any>(null);
  const [isScheduleLoading, setIsScheduleLoading] = useState(false);
  const [config, setConfig] = useState<ScheduleConfig | null>(null);
  const [studentInfo, setStudentInfo] = useState<any>(null);
  const [schoolYear, setSchoolYear] = useState<string>('');
  const [semester, setSemester] = useState<string>('1');
  const [publicationNotice, setPublicationNotice] = useState<null | { state: 'locked' | 'pending'; message: string }>(null);
  const { students, isLoading: isLoadingStudents } = useStudents();

  useEffect(() => {
    if (!backendUser || isLoadingStudents) return;

    const student = students.find((s: any) =>
      s.accountId?._id === backendUser._id ||
      s.accountId?._id?.toString() === backendUser._id?.toString() ||
      s.accountId === backendUser._id
    );

    if (!student) {
      setStudentInfo(null);
      setSchedule(null);
      setPublicationNotice(null);
      setIsScheduleLoading(false);
      return;
    }

    setStudentInfo(student);

    const classId =
      typeof student.classId === 'object' ? student.classId?._id : student.classId;

    if (classId && !schoolYear) {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const currentYear = month >= 8 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
      setSchoolYear(currentYear);
    }
  }, [backendUser, students, isLoadingStudents, schoolYear]);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const configData = await getScheduleConfig();
        setConfig(configData);
      } catch (err) {
        console.error('Error fetching config:', err);
      }
    };
    fetchConfig();
  }, []);

  useEffect(() => {
    if (!studentInfo || !schoolYear || isLoadingStudents) return;
    const classId =
      typeof studentInfo.classId === 'object'
        ? studentInfo.classId?._id
        : studentInfo.classId;
    if (!classId) return;
    fetchSchedule(classId, schoolYear, semester);
  }, [schoolYear, semester, studentInfo, isLoadingStudents]);

  const fetchSchedule = async (classId: string, year: string, sem: string) => {
    try {
      setIsScheduleLoading(true);
      const data = await scheduleApi.getScheduleByClass(classId, year, sem);
      setSchedule(data);
      if (data?.isLocked) {
        setPublicationNotice({
          state: 'locked',
          message: 'Thời khóa biểu đã được khóa và công bố cho học sinh.',
        });
      } else {
        setPublicationNotice({
          state: 'pending',
          message: 'Thời khóa biểu này vẫn đang được chỉnh sửa. Hãy chờ khi BGH khóa lịch để xem.',
        });
      }
    } catch (err: any) {
      if (err.response?.status === 404) {
        setSchedule(null);
        setPublicationNotice({
          state: 'pending',
          message: err.response?.data?.message || 'Thời khóa biểu chưa được công bố.',
        });
      } else {
        console.error('Error fetching schedule:', err);
        toast({
          title: 'Lỗi',
          description: 'Không thể tải thời khóa biểu',
          variant: 'destructive',
        });
        setPublicationNotice({
          state: 'pending',
          message: 'Không thể tải thời khóa biểu. Vui lòng thử lại sau hoặc liên hệ giáo viên chủ nhiệm.',
        });
      }
    } finally {
      setIsScheduleLoading(false);
    }
  };

  const morningPeriods = config?.days?.['Monday']?.morningPeriods || 5;
  const afternoonPeriods = config?.days?.['Monday']?.afternoonPeriods || 5;

  const overallLoading = isLoadingStudents || isScheduleLoading;

  if (!studentInfo && !overallLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Chưa được phân lớp</h3>
          <p className="text-muted-foreground">Bạn chưa được phân vào lớp học nào.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Thời khóa biểu</h1>
          <p className="text-muted-foreground mt-1">
            {studentInfo?.classId && typeof studentInfo.classId === 'object' 
              ? `${studentInfo.classId.className} - Khối ${studentInfo.classId.grade}`
              : 'Lớp của bạn'}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={schoolYear} onValueChange={setSchoolYear}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Năm học" />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 3 }, (_, i) => {
                const year = new Date().getFullYear();
                const offset = i - 1;
                const y = year + offset;
                return (
                  <SelectItem key={`${y}-${y + 1}`} value={`${y}-${y + 1}`}>
                    {y}-{y + 1}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <Select value={semester} onValueChange={setSemester}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Học kỳ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Học kỳ 1</SelectItem>
              <SelectItem value="2">Học kỳ 2</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {publicationNotice && (
        <Alert
          className={
            publicationNotice.state === 'locked'
              ? 'border-green-200 bg-green-50 text-green-800'
              : 'border-amber-200 bg-amber-50 text-amber-800'
          }
        >
          {publicationNotice.state === 'locked' ? (
            <Lock className="h-4 w-4" />
          ) : (
            <Unlock className="h-4 w-4" />
          )}
          <AlertTitle>
            {publicationNotice.state === 'locked' ? 'Đã công bố lịch học' : 'Lịch học chưa sẵn sàng'}
          </AlertTitle>
          <AlertDescription>{publicationNotice.message}</AlertDescription>
        </Alert>
      )}

      <ViewSchedule
        schedule={schedule}
        loading={overallLoading}
        title="Thời khóa biểu của tôi"
        showClass={true}
        morningPeriods={morningPeriods}
        afternoonPeriods={afternoonPeriods}
      />
    </div>
  );
};

export default StudentSchedulePage;

