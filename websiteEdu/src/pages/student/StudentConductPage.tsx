import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useCurrentAcademicYear } from '@/hooks/useCurrentAcademicYear';
import conductApi from '@/services/conductApi';
import attendanceApi from '@/services/attendanceApi';
import incidentApi from '@/services/incidentApi';
import { 
  Star,
  CheckCircle2,
  Trophy,
  AlertTriangle,
  Loader2,
} from 'lucide-react';

interface ConductRecord {
  _id: string;
  year: string;
  semester: string;
  conduct: string;
  gpa?: number;
  totalAbsent?: number;
  totalLate?: number;
  academicLevel?: string;
}

interface AttendanceStats {
  absent: number;
  late: number;
  excused?: number;
}

interface Achievement {
  id: string;
  title: string;
  date: string;
  level: 'Xuất sắc' | 'Tốt' | 'Trung bình';
}

interface Violation {
  id: string;
  title: string;
  date: string;
  type: 'warning' | 'reminder';
}

const StudentConductPage = () => {
  const { backendUser } = useAuth();
  const { toast } = useToast();
  const { currentYearCode } = useCurrentAcademicYear();
  
  const [conductRecord, setConductRecord] = useState<ConductRecord | null>(null);
  const [attendanceStats, setAttendanceStats] = useState<AttendanceStats | null>(null);
  const [trainingScore, setTrainingScore] = useState<number>(85);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [behaviorStats, setBehaviorStats] = useState({
    excellent: 0,
    good: 0,
    average: 0,
  });
  const [loading, setLoading] = useState(true);
  const [selectedSemester, setSelectedSemester] = useState<string>('1');

  // Tính năm học hiện tại
  const currentYear = currentYearCode || (() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    return month >= 8 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
  })();

  // Lấy hạnh kiểm
  useEffect(() => {
    const fetchConduct = async () => {
      try {
        setLoading(true);
        const res = await conductApi.getConducts({
          year: currentYear,
          semester: selectedSemester === '1' ? 'HK1' : selectedSemester === '2' ? 'HK2' : 'CN',
        });
        
        if (res.success && res.data && res.data.length > 0) {
          const record = res.data[0];
          setConductRecord(record);
          
          // Tính điểm rèn luyện từ hạnh kiểm và điểm danh
          // Công thức: 100 - (số buổi vắng * 2) - (số buổi muộn * 1) + bonus từ hạnh kiểm
          let score = 100;
          if (record.totalAbsent) score -= record.totalAbsent * 2;
          if (record.totalLate) score -= record.totalLate * 1;
          
          // Bonus từ hạnh kiểm
          if (record.conduct === 'Tốt') score += 5;
          else if (record.conduct === 'Khá') score += 3;
          else if (record.conduct === 'Trung bình') score += 1;
          
          score = Math.max(0, Math.min(100, score));
          setTrainingScore(Math.round(score));
        }
      } catch (error: any) {
        console.error('Error fetching conduct:', error);
        toast({
          title: 'Lỗi',
          description: 'Không thể tải thông tin hạnh kiểm',
          variant: 'destructive',
        });
      }
    };

    if (currentYear) {
      fetchConduct();
    }
  }, [currentYear, selectedSemester, toast]);

  // Lấy thống kê điểm danh
  useEffect(() => {
    const fetchAttendance = async () => {
      try {
        const res = await attendanceApi.getAttendanceStats({
          studentId: backendUser?.studentId || backendUser?._id,
          schoolYear: currentYear,
          semester: selectedSemester,
        });
        
        if (res.success && res.data) {
          setAttendanceStats({
            absent: res.data.absent || 0,
            late: res.data.late || 0,
            excused: res.data.excused || 0,
          });
        }
      } catch (error: any) {
        console.error('Error fetching attendance:', error);
      } finally {
        setLoading(false);
      }
    };

    if (currentYear && backendUser) {
      fetchAttendance();
    }
  }, [currentYear, selectedSemester, backendUser]);

  // Lấy vi phạm từ API và tính đánh giá hành vi
  useEffect(() => {
    const fetchViolationsAndBehavior = async () => {
      try {
        const res = await incidentApi.getIncidents({
          type: 'discipline', // Chỉ lấy vi phạm kỷ luật
        });
        
        if (res.success && res.data) {
          const violationsData = res.data
            .filter((inc: any) => {
              // Lọc theo năm học hiện tại nếu có
              const incidentDate = new Date(inc.createdAt);
              const yearStart = parseInt(currentYear.split('-')[0]);
              const yearEnd = parseInt(currentYear.split('-')[1]);
              return incidentDate.getFullYear() >= yearStart && incidentDate.getFullYear() <= yearEnd;
            })
            .map((inc: any) => ({
              id: inc._id,
              title: inc.title,
              date: new Date(inc.createdAt).toLocaleDateString('vi-VN'),
              type: inc.severity === 'critical' || inc.severity === 'high' ? 'warning' : 'reminder',
            }));
          
          setViolations(violationsData);

          // Tính đánh giá hành vi dựa trên conduct record và violations
          // Đếm số lượng vi phạm theo mức độ
          let excellent = 0;
          let good = 0;
          let average = 0;

          // Nếu có conduct record và GPA tốt, tăng excellent
          if (conductRecord && conductRecord.gpa && conductRecord.gpa >= 8.0) {
            excellent += 1;
          }

          // Đếm vi phạm
          violationsData.forEach((v: any) => {
            if (v.type === 'warning') {
              average += 1;
            } else {
              good += 1;
            }
          });

          // Nếu không có vi phạm và GPA tốt, tăng excellent
          if (violationsData.length === 0 && conductRecord && conductRecord.gpa && conductRecord.gpa >= 8.0) {
            excellent += 1;
          }

          setBehaviorStats({
            excellent: Math.max(0, excellent),
            good: Math.max(0, good),
            average: Math.max(0, average),
          });
        }
      } catch (error: any) {
        console.error('Error fetching violations:', error);
      }
    };

    if (currentYear) {
      fetchViolationsAndBehavior();
    }
  }, [currentYear, conductRecord]);

  // Lấy thành tích từ API (tạm thời để trống vì chưa có API)
  useEffect(() => {
    // TODO: Tạo API cho student achievements/awards
    // Hiện tại chưa có API, để trống
    setAchievements([]);
  }, []);

  const semesterLabel = selectedSemester === '1' ? 'Học kỳ I' : selectedSemester === '2' ? 'Học kỳ II' : 'Cả năm';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <Star className="h-6 w-6 text-yellow-500" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">Hạnh kiểm và rèn luyện</h1>
              <p className="text-sm text-muted-foreground">
                {semesterLabel} - Năm học {currentYear}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Conduct Summary Card */}
      <Card className="bg-gradient-to-r from-orange-400 to-yellow-400 border-0">
        <CardContent className="p-6 text-white">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium mb-2">Xếp loại hạnh kiểm</p>
              <h2 className="text-4xl font-bold mb-4">
                {conductRecord?.conduct || 'Chưa có'}
              </h2>
              <p className="text-lg mb-4">Điểm rèn luyện: {trainingScore}/100</p>
              <div className="w-full h-2 bg-white/30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-all"
                  style={{ width: `${trainingScore}%` }}
                />
              </div>
            </div>
            <div className="flex items-center justify-center w-16 h-16 bg-white/20 rounded-full">
              <Star className="h-8 w-8 text-white" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Attendance and Behavior Assessment */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Điểm danh */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Điểm danh
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
              <div className="flex flex-col">
                <span className="font-medium">Vắng</span>
                <span className="text-xs text-muted-foreground mt-1">
                  {(attendanceStats?.absent || 0) > 0 && (
                    <span>Không phép: {attendanceStats.absent}</span>
                  )}
                  {(attendanceStats?.absent || 0) > 0 && (attendanceStats?.excused || 0) > 0 && ' • '}
                  {(attendanceStats?.excused || 0) > 0 && (
                    <span>Có phép: {attendanceStats.excused}</span>
                  )}
                </span>
              </div>
              <Badge className="bg-red-100 text-red-700">
                {(attendanceStats?.absent || 0) + (attendanceStats?.excused || 0)}
              </Badge>
            </div>
            <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
              <span className="font-medium">Đi muộn</span>
              <Badge className="bg-yellow-100 text-yellow-700">
                {attendanceStats?.late || 0}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Đánh giá hành vi */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-blue-600" />
              Đánh giá hành vi
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <span className="font-medium">Xuất sắc</span>
              <Badge className="bg-green-100 text-green-700">{behaviorStats.excellent}</Badge>
            </div>
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <span className="font-medium">Tốt</span>
              <Badge className="bg-blue-100 text-blue-700">{behaviorStats.good}</Badge>
            </div>
            <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
              <span className="font-medium">Trung bình</span>
              <Badge className="bg-yellow-100 text-yellow-700">{behaviorStats.average}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Achievements and Violations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Thành tích và khen thưởng */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-green-600" />
              Thành tích và khen thưởng
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {achievements.length > 0 ? (
                achievements.map((achievement) => (
                  <div
                    key={achievement.id}
                    className="flex items-center gap-3 p-3 bg-green-50 rounded-lg"
                  >
                    <Trophy className="h-5 w-5 text-green-600 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium">{achievement.title}</p>
                      <p className="text-sm text-muted-foreground">{achievement.date}</p>
                    </div>
                    <Badge
                      className={
                        achievement.level === 'Xuất sắc'
                          ? 'bg-green-600 text-white'
                          : achievement.level === 'Tốt'
                          ? 'bg-blue-600 text-white'
                          : 'bg-yellow-600 text-white'
                      }
                    >
                      {achievement.level}
                    </Badge>
                  </div>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  Chưa có thành tích nào
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Vi phạm và nhắc nhở */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Vi phạm và nhắc nhở
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {violations.length > 0 ? (
                violations.map((violation) => (
                  <div
                    key={violation.id}
                    className="flex items-center gap-3 p-3 bg-red-50 rounded-lg"
                  >
                    <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium">{violation.title}</p>
                      <p className="text-sm text-muted-foreground">{violation.date}</p>
                    </div>
                    <Badge variant="destructive">
                      {violation.type === 'warning' ? 'Cảnh báo' : 'Nhắc nhở'}
                    </Badge>
                  </div>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  Không có vi phạm nào
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StudentConductPage;

