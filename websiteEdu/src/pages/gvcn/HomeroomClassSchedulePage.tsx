import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { scheduleApi } from '@/services/scheduleApi';
import { getScheduleConfig } from '@/services/scheduleConfigApi';
import { ViewSchedule } from '@/components/schedule/ViewSchedule';
import { Calendar, Loader2, AlertCircle, Users } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { ScheduleConfig } from '@/types/schedule';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useSchoolYears } from '@/hooks';
import { useCurrentAcademicYear } from '@/hooks/useCurrentAcademicYear';
import api from '@/services/axiosInstance';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';

/**
 * Trang xem thời khóa biểu lớp chủ nhiệm cho GVCN
 */
const HomeroomClassSchedulePage = () => {
  const { backendUser } = useAuth();
  const [schedule, setSchedule] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<ScheduleConfig | null>(null);
  const [schoolYear, setSchoolYear] = useState<string>('');
  const [semester, setSemester] = useState<string>('1');
  const [homeroomClass, setHomeroomClass] = useState<any>(null);
  const [loadingClass, setLoadingClass] = useState(true);

  // ✅ Lấy năm học hiện tại từ hooks
  const { schoolYears: allSchoolYears } = useSchoolYears();
  const { currentYearCode } = useCurrentAcademicYear();

  // ✅ Lấy lớp chủ nhiệm
  useEffect(() => {
    const fetchHomeroomClass = async () => {
      try {
        setLoadingClass(true);
        const response = await api.get('/user/teachers/me/homeroom-class');
        if (response.data && response.data.class) {
          setHomeroomClass(response.data.class);
        }
      } catch (error: any) {
        console.error('Error fetching homeroom class:', error);
        if (error.response?.status !== 404) {
          toast({
            title: 'Lỗi',
            description: 'Không thể tải thông tin lớp chủ nhiệm',
            variant: 'destructive',
          });
        }
      } finally {
        setLoadingClass(false);
      }
    };

    fetchHomeroomClass();
  }, []);

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

  // ✅ Set năm học hiện tại khi có dữ liệu
  useEffect(() => {
    if (currentYearCode) {
      setSchoolYear(currentYearCode);
    }
  }, [currentYearCode]);

  // ✅ Fetch schedule khi có lớp chủ nhiệm và năm học
  useEffect(() => {
    if (homeroomClass?._id && schoolYear) {
      fetchSchedule(homeroomClass._id, schoolYear, semester);
    }
  }, [homeroomClass, schoolYear, semester]);

  const fetchSchedule = async (classId: string, year: string, sem: string) => {
    try {
      setLoading(true);
      const data = await scheduleApi.getScheduleByClass(classId, year, sem);
      setSchedule(data);
    } catch (err: any) {
      console.error('Error fetching schedule:', err);
      if (err.response?.status === 404) {
        setSchedule(null);
      } else {
        toast({
          title: 'Lỗi',
          description: 'Không thể tải thời khóa biểu',
          variant: 'destructive',
        });
        setSchedule(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const morningPeriods = config?.days?.['Monday']?.morningPeriods || 5;
  const afternoonPeriods = config?.days?.['Monday']?.afternoonPeriods || 5;

  if (loadingClass) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!homeroomClass) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Bạn chưa được phân công làm giáo viên chủ nhiệm cho lớp nào trong năm học này.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              <CardTitle>Thời khóa biểu lớp {homeroomClass.className}</CardTitle>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="year-select">Năm học:</Label>
                <Select
                  value={schoolYear}
                  onValueChange={setSchoolYear}
                  disabled={loading}
                >
                  <SelectTrigger id="year-select" className="w-[180px]">
                    <SelectValue placeholder="Chọn năm học" />
                  </SelectTrigger>
                  <SelectContent>
                    {allSchoolYears.map((year) => (
                      <SelectItem key={year.code} value={year.code}>
                        {year.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="semester-select">Học kỳ:</Label>
                <Select
                  value={semester}
                  onValueChange={setSemester}
                  disabled={loading}
                >
                  <SelectTrigger id="semester-select" className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Học kỳ 1</SelectItem>
                    <SelectItem value="2">Học kỳ 2</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !schedule ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Thời khóa biểu của lớp {homeroomClass.className} chưa được tạo hoặc chưa được công bố.
              </AlertDescription>
            </Alert>
          ) : (
            <ViewSchedule
              schedule={schedule}
              config={config}
              morningPeriods={morningPeriods}
              afternoonPeriods={afternoonPeriods}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default HomeroomClassSchedulePage;

