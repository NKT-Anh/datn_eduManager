import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import gradesApi from '@/services/gradesApi';
import { useSchoolYears, useClasses, useGrades } from '@/hooks';
import { Database, Loader2, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

interface InitResult {
  createdCount: number;
  skippedCount: number;
  totalCount: number;
  message?: string;
}

export default function InitGradeTablePage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { schoolYears } = useSchoolYears();
  const { classes } = useClasses();
  const { grades } = useGrades();

  const [schoolYear, setSchoolYear] = useState<string>('');
  const [semester, setSemester] = useState<string>('');
  const [gradeLevel, setGradeLevel] = useState<string>('');
  const [classId, setClassId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<InitResult | null>(null);
  const [showResultDialog, setShowResultDialog] = useState(false);

  // Lọc lớp theo khối nếu đã chọn (bỏ qua giá trị "all")
  const filteredClasses = gradeLevel && gradeLevel !== "all"
    ? classes.filter((c) => c.grade === gradeLevel)
    : classes;

  const handleInit = async () => {
    if (!schoolYear || !semester) {
      toast({
        title: 'Thiếu thông tin',
        description: 'Vui lòng chọn năm học và học kỳ',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      // If gradeLevel is selected but no specific class, iterate only classes in that grade
      if (gradeLevel && !classId) {
        let totalCreated = 0;
        let totalSkipped = 0;
        for (const cls of filteredClasses) {
          const payload: any = { schoolYear, semester, classId: cls._id };
          const res = await gradesApi.initGradeTable(payload);
          const created = res.createdCount || res.data?.created || 0;
          const skipped = res.skippedCount || res.data?.skipped || 0;
          totalCreated += created;
          totalSkipped += skipped;
        }

        const initResult: InitResult = {
          createdCount: totalCreated,
          skippedCount: totalSkipped,
          totalCount: totalCreated + totalSkipped,
        };

        setResult(initResult);
        setShowResultDialog(true);
        toast({
          title: 'Thành công',
          description: `Đã khởi tạo ${initResult.createdCount} bản ghi bảng điểm${
            initResult.skippedCount > 0 ? `, bỏ qua ${initResult.skippedCount} bản ghi đã tồn tại` : ''
          }`,
        });
      } else {
        const payload: any = { schoolYear, semester };
        if (classId) payload.classId = classId;

        const res = await gradesApi.initGradeTable(payload);

        const initResult: InitResult = {
          createdCount: res.createdCount || res.data?.created || 0,
          skippedCount: res.skippedCount || res.data?.skipped || 0,
          totalCount: res.totalCount || res.data?.total || 0,
          message: res.message,
        };

        setResult(initResult);
        setShowResultDialog(true);

        toast({
          title: 'Thành công',
          description: `Đã khởi tạo ${initResult.createdCount} bản ghi bảng điểm${
            initResult.skippedCount > 0 ? `, bỏ qua ${initResult.skippedCount} bản ghi đã tồn tại` : ''
          }`,
        });
      }
    } catch (error: any) {
      console.error('Lỗi khởi tạo bảng điểm:', error);
      toast({
        title: 'Lỗi',
        description: error?.response?.data?.message || 'Không thể khởi tạo bảng điểm',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSchoolYear('');
    setSemester('');
    setGradeLevel('');
    setClassId('');
    setResult(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Khởi tạo bảng điểm</h1>
          <p className="text-muted-foreground">
            Tạo bảng điểm trống cho học sinh theo năm học và học kỳ
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate('/admin/grades')}>
          Xem bảng điểm
        </Button>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Lưu ý</AlertTitle>
        <AlertDescription>
          Chức năng này sẽ tạo bảng điểm trống (GradeSummary) cho tất cả học sinh và môn học phù hợp.
          Nếu bảng điểm đã tồn tại, hệ thống sẽ bỏ qua và không tạo trùng lặp.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Thông tin khởi tạo</CardTitle>
          <CardDescription>
            Chọn năm học, học kỳ và phạm vi (khối/lớp) để khởi tạo bảng điểm
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Năm học */}
            <div className="space-y-2">
              <Label htmlFor="schoolYear">Năm học *</Label>
              <Select value={schoolYear} onValueChange={setSchoolYear}>
                <SelectTrigger id="schoolYear">
                  <SelectValue placeholder="Chọn năm học" />
                </SelectTrigger>
                <SelectContent>
                  {schoolYears.map((year) => (
                    <SelectItem key={year._id} value={year.code || year._id}>
                      {year.name || year.code || year.year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Học kỳ */}
            <div className="space-y-2">
              <Label htmlFor="semester">Học kỳ *</Label>
              <Select value={semester} onValueChange={setSemester}>
                <SelectTrigger id="semester">
                  <SelectValue placeholder="Chọn học kỳ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Học kỳ 1</SelectItem>
                  <SelectItem value="2">Học kỳ 2</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Khối (tùy chọn) */}
            <div className="space-y-2">
              <Label htmlFor="gradeLevel">Khối (tùy chọn)</Label>
              <Select value={gradeLevel || undefined} onValueChange={(v) => setGradeLevel(v === "all" ? "" : v)}>
                <SelectTrigger id="gradeLevel">
                  <SelectValue placeholder="Chọn khối (để lọc lớp)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả khối</SelectItem>
                  {grades.map((grade) => (
                    <SelectItem key={grade._id} value={grade.code || grade.name}>
                      {grade.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Chọn khối để lọc danh sách lớp bên dưới
              </p>
            </div>

            {/* Lớp (tùy chọn) */}
            <div className="space-y-2">
              <Label htmlFor="classId">Lớp (tùy chọn)</Label>
              <Select
                value={classId || undefined}
                onValueChange={(v) => setClassId(v === "all" ? "" : v)}
                disabled={!schoolYear}
              >
                <SelectTrigger id="classId">
                  <SelectValue placeholder="Chọn lớp cụ thể" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả lớp</SelectItem>
                  {filteredClasses.map((cls) => (
                    <SelectItem key={cls._id} value={cls._id}>
                      {cls.className || cls.classCode}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Để trống để khởi tạo cho tất cả lớp. Chọn lớp cụ thể để chỉ khởi tạo cho lớp đó.
              </p>
            </div>
          </div>

          {/* Thông tin */}
          <div className="bg-muted p-4 rounded-lg">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div className="text-sm space-y-1">
                <p className="font-medium">Phạm vi khởi tạo:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  {classId && classId !== "all" ? (
                    <li>
                      Chỉ khởi tạo cho lớp đã chọn: {filteredClasses.find((c) => c._id === classId)?.className || classId}
                    </li>
                  ) : (
                    <li>Khởi tạo cho tất cả lớp học trong hệ thống</li>
                  )}
                  <li>
                    Tạo bảng điểm cho tất cả học sinh đang học (status: active) trong lớp
                  </li>
                  <li>
                    Tạo bảng điểm cho tất cả môn học phù hợp với khối của lớp
                  </li>
                  <li>
                    Bỏ qua các bản ghi đã tồn tại (không tạo trùng lặp)
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleInit}
              disabled={loading || !schoolYear || !semester}
              className="flex-1"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang khởi tạo...
                </>
              ) : (
                <>
                  <Database className="mr-2 h-4 w-4" />
                  Khởi tạo bảng điểm
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={loading}
            >
              Đặt lại
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Result Dialog */}
      <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kết quả khởi tạo</DialogTitle>
            <DialogDescription>
              Thống kê số lượng bản ghi đã được tạo
            </DialogDescription>
          </DialogHeader>
          {result && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {result.createdCount}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Đã tạo mới
                  </div>
                </div>
                <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                    {result.skippedCount}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Đã tồn tại
                  </div>
                </div>
                <div className="text-center p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {result.totalCount}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Tổng cộng
                  </div>
                </div>
              </div>

              {result.createdCount === 0 && result.skippedCount > 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Thông báo</AlertTitle>
                  <AlertDescription>
                    Tất cả bảng điểm đã được khởi tạo trước đó. Không có bản ghi mới nào được tạo.
                  </AlertDescription>
                </Alert>
              )}

              {result.createdCount > 0 && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>Thành công</AlertTitle>
                  <AlertDescription>
                    Đã khởi tạo thành công {result.createdCount} bản ghi bảng điểm mới.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResultDialog(false)}>
              Đóng
            </Button>
            <Button onClick={() => {
              setShowResultDialog(false);
              navigate('/admin/grades');
            }}>
              Xem bảng điểm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

