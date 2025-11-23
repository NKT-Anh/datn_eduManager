import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { scheduleApi } from '@/services/scheduleApi';
import { getScheduleConfig } from '@/services/scheduleConfigApi';
import { getStudent } from '@/services/studentApi';
import { ViewSchedule } from '@/components/schedule/ViewSchedule';
import { Calendar, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { ScheduleConfig } from '@/types/schedule';

const StudentSchedulePage = () => {
  const { backendUser } = useAuth();
  const [schedule, setSchedule] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<ScheduleConfig | null>(null);
  const [studentInfo, setStudentInfo] = useState<any>(null);
  const [schoolYear, setSchoolYear] = useState<string>('');
  const [semester, setSemester] = useState<string>('1');

  useEffect(() => {
    const fetchStudentInfo = async () => {
      if (!backendUser) return;
      try {
        // Lấy tất cả học sinh và tìm học sinh theo accountId
        const { getStudents } = await import('@/services/studentApi');
        const students = await getStudents();
        const student = students.find((s: any) => 
          s.accountId?._id === backendUser._id || 
          s.accountId?._id?.toString() === backendUser._id?.toString() ||
          s.accountId === backendUser._id
        );
        
        if (student) {
          setStudentInfo(student);
          const classId = typeof student.classId === 'object' ? student.classId?._id : student.classId;
          if (classId) {
            // Tính năm học hiện tại
            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth() + 1;
            const currentYear = month >= 8 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
            setSchoolYear(currentYear);
            await fetchSchedule(classId, currentYear, semester);
          }
        } else {
          setLoading(false);
        }
      } catch (err: any) {
        console.error('Error fetching student:', err);
        if (err.response?.status !== 404) {
          toast({
            title: 'Lỗi',
            description: 'Không thể tải thông tin học sinh',
            variant: 'destructive',
          });
        }
        setLoading(false);
      }
    };

    if (backendUser) {
      fetchStudentInfo();
    }
  }, [backendUser]);

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
    if (studentInfo && schoolYear) {
      const classId = typeof studentInfo.classId === 'object' ? studentInfo.classId?._id : studentInfo.classId;
      if (classId) {
        fetchSchedule(classId, schoolYear, semester);
      }
    }
  }, [schoolYear, semester, studentInfo]);

  const fetchSchedule = async (classId: string, year: string, sem: string) => {
    try {
      setLoading(true);
      const data = await scheduleApi.getScheduleByClass(classId, year, sem);
      setSchedule(data);
    } catch (err: any) {
      if (err.response?.status === 404) {
        setSchedule(null);
      } else {
        console.error('Error fetching schedule:', err);
        toast({
          title: 'Lỗi',
          description: 'Không thể tải thời khóa biểu',
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const morningPeriods = config?.days?.['Monday']?.morningPeriods || 5;
  const afternoonPeriods = config?.days?.['Monday']?.afternoonPeriods || 5;

  if (!studentInfo && !loading) {
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

      <ViewSchedule
        schedule={schedule}
        loading={loading}
        title="Thời khóa biểu của tôi"
        showClass={false}
        morningPeriods={morningPeriods}
        afternoonPeriods={afternoonPeriods}
      />
    </div>
  );
};

export default StudentSchedulePage;

