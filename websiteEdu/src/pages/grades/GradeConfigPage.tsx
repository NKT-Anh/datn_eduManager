import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import gradeConfigApi from '@/services/gradeConfigApi';
import schoolConfigApi from '@/services/schoolConfigApi';
import { BarChart3, Save, RotateCcw, Info, Calculator } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface GradeWeights {
  oral: number;
  quiz15: number;
  quiz45: number;
  midterm: number;
  final: number;
  [key: string]: number;
}

interface GradeConfig {
  weights: GradeWeights;
  rounding: 'half-up' | 'none';
  schoolYear?: string;
  semester?: string;
}

const LABEL_MAP: Record<string, string> = {
  oral: 'Miệng',
  quiz15: '15 phút',
  quiz45: '45 phút',
  midterm: 'Giữa kỳ',
  final: 'Cuối kỳ',
};

const DEFAULT_WEIGHTS: GradeWeights = {
  oral: 1,
  quiz15: 1,
  quiz45: 2,
  midterm: 2,
  final: 3,
};

export default function GradeConfigPage() {
  const { toast } = useToast();
  const [config, setConfig] = useState<GradeConfig>({
    weights: { ...DEFAULT_WEIGHTS },
    rounding: 'half-up',
  });
  const [loading, setLoading] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [schoolYear, setSchoolYear] = useState<string>('');
  const [semester, setSemester] = useState<string>('1');
  const [schoolYears, setSchoolYears] = useState<Array<{ code: string; name: string }>>([]);

  // Lấy danh sách năm học
  useEffect(() => {
    const fetchSchoolYears = async () => {
      try {
        const res = await schoolConfigApi.getSchoolYears();
        if (res.data && res.data.length > 0) {
          setSchoolYears(res.data);
          setSchoolYear(res.data[res.data.length - 1].code);
        } else {
          const now = new Date();
          const year = now.getFullYear();
          const month = now.getMonth() + 1;
          const currentYear = month >= 8 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
          setSchoolYear(currentYear);
        }
      } catch (err) {
        console.error('Error fetching school years:', err);
      }
    };
    fetchSchoolYears();
  }, []);

  // Lấy cấu hình hiện tại
  const fetchConfig = async () => {
    if (!schoolYear || !semester) return;
    try {
      setLoadingConfig(true);
      const res = await gradeConfigApi.getConfig({ schoolYear, semester });
      // Nếu API trả về data theo schoolYear và semester
      if (res.weights && res.rounding) {
        setConfig({
          weights: res.weights,
          rounding: res.rounding,
          schoolYear: res.schoolYear || schoolYear,
          semester: res.semester || semester,
        });
      } else if (res.data) {
        setConfig({
          weights: res.data.weights || { ...DEFAULT_WEIGHTS },
          rounding: res.data.rounding || 'half-up',
          schoolYear: res.data.schoolYear || schoolYear,
          semester: res.data.semester || semester,
        });
      }
    } catch (err: any) {
      console.error('Error fetching config:', err);
      // Nếu chưa có config (404), dùng mặc định
      if (err.response?.status !== 404) {
        toast({
          title: 'Lỗi',
          description: 'Không thể tải cấu hình điểm số',
          variant: 'destructive',
        });
      }
      setConfig({
        weights: { ...DEFAULT_WEIGHTS },
        rounding: 'half-up',
        schoolYear,
        semester,
      });
    } finally {
      setLoadingConfig(false);
    }
  };

  useEffect(() => {
    if (schoolYear && semester) {
      fetchConfig();
    }
  }, [schoolYear, semester]);

  // Tính tổng trọng số
  const totalWeight = Object.values(config.weights).reduce((sum, w) => sum + w, 0);

  // Cập nhật cấu hình
  const handleSave = async () => {
    if (!schoolYear || !semester) {
      toast({
        title: 'Lỗi',
        description: 'Vui lòng chọn năm học và học kỳ',
        variant: 'destructive',
      });
      return;
    }

    if (Object.values(config.weights).some((v) => v <= 0)) {
      toast({
        title: 'Lỗi',
        description: 'Trọng số phải lớn hơn 0',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);
      // Có thể cần gửi kèm schoolYear và semester nếu backend yêu cầu
      await gradeConfigApi.updateConfig({
        ...config,
        schoolYear,
        semester,
      });
      toast({
        title: 'Thành công',
        description: 'Đã lưu cấu hình điểm số thành công.',
      });
      fetchConfig();
    } catch (err: any) {
      console.error('Error saving config:', err);
      toast({
        title: 'Lỗi',
        description: err.response?.data?.message || 'Không thể lưu cấu hình',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Reset về mặc định
  const handleReset = async () => {
    try {
      setLoading(true);
      await gradeConfigApi.resetConfig();
      toast({
        title: 'Thành công',
        description: 'Đã khôi phục cấu hình mặc định',
      });
      fetchConfig();
    } catch (err: any) {
      console.error('Error resetting config:', err);
      toast({
        title: 'Lỗi',
        description: 'Không thể khôi phục mặc định',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const resetToDefault = () => {
    setConfig({
      weights: { ...DEFAULT_WEIGHTS },
      rounding: 'half-up',
      schoolYear,
      semester,
    });
    toast({
      title: 'Đã đặt về mặc định',
      description: 'Cấu hình đã được đặt về giá trị mặc định. Nhấn "Lưu cấu hình" để áp dụng.',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Cấu hình điểm số</h1>
          <p className="text-muted-foreground">
            Cấu hình trọng số và cách tính điểm trung bình cho các loại điểm
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Cấu hình cho năm học</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Năm học</Label>
              <Select value={schoolYear} onValueChange={setSchoolYear} disabled={loading || loadingConfig}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn năm học" />
                </SelectTrigger>
                <SelectContent>
                  {schoolYears.map((year) => (
                    <SelectItem key={year.code} value={year.code}>
                      {year.name}
                    </SelectItem>
                  ))}
                  {schoolYears.length === 0 && schoolYear && (
                    <SelectItem value={schoolYear}>{schoolYear}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Học kỳ</Label>
              <Select value={semester} onValueChange={setSemester} disabled={loading || loadingConfig}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Học kỳ 1</SelectItem>
                  <SelectItem value="2">Học kỳ 2</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Cách tính điểm trung bình</AlertTitle>
        <AlertDescription>
          Điểm trung bình = (Miệng × {config.weights.oral} + 15 phút × {config.weights.quiz15} + 45 phút ×{' '}
          {config.weights.quiz45} + Giữa kỳ × {config.weights.midterm} + Cuối kỳ × {config.weights.final}) /{' '}
          {totalWeight}
          {config.rounding === 'half-up' && ' (làm tròn 0.5 lên)'}
        </AlertDescription>
      </Alert>

      {/* Config Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Trọng số các loại điểm
          </CardTitle>
          <CardDescription>
            Điều chỉnh trọng số để tính điểm trung bình. Tổng trọng số hiện tại: <strong>{totalWeight}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {loadingConfig ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Đang tải cấu hình...</p>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {Object.entries(config.weights).map(([key, value]) => (
                  <div key={key} className="space-y-2">
                    <Label className="text-sm font-medium">
                      {LABEL_MAP[key] || key}
                      <span className="text-xs text-muted-foreground ml-1">({value})</span>
                    </Label>
                    <Input
                      type="number"
                      min={0.1}
                      step={0.1}
                      value={value}
                      disabled={loading}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          weights: {
                            ...config.weights,
                            [key]: Number(e.target.value) || 0,
                          },
                        })
                      }
                      className="text-center font-semibold"
                    />
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t">
                <Label className="text-base font-semibold mb-3 block">Kiểu làm tròn điểm</Label>
                <Select
                  disabled={loading}
                  value={config.rounding}
                  onValueChange={(v) => setConfig({ ...config, rounding: v as 'half-up' | 'none' })}
                >
                  <SelectTrigger className="w-full md:w-64">
                    <SelectValue placeholder="Chọn kiểu làm tròn" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="half-up">
                      <div className="flex items-center gap-2">
                        <Calculator className="h-4 w-4" />
                        Làm tròn 0.5 lên (Ví dụ: 7.5 → 8)
                      </div>
                    </SelectItem>
                    <SelectItem value="none">
                      <div className="flex items-center gap-2">
                        <Calculator className="h-4 w-4" />
                        Không làm tròn (Giữ nguyên số thập phân)
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <Button onClick={handleSave} disabled={loading || loadingConfig} className="flex-1">
                  <Save className="h-4 w-4 mr-2" />
                  {loading ? 'Đang lưu...' : 'Lưu cấu hình'}
                </Button>
                <Button
                  variant="outline"
                  onClick={resetToDefault}
                  disabled={loading || loadingConfig}
                  className="flex-1"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Đặt về mặc định
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Example Card */}
      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle className="text-lg">Ví dụ tính điểm</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p>
              Giả sử học sinh có điểm:
              <br />
              • Miệng: 8.0 (trọng số {config.weights.oral})
              <br />
              • 15 phút: 7.5 (trọng số {config.weights.quiz15})
              <br />
              • 45 phút: 8.5 (trọng số {config.weights.quiz45})
              <br />
              • Giữa kỳ: 9.0 (trọng số {config.weights.midterm})
              <br />
              • Cuối kỳ: 8.0 (trọng số {config.weights.final})
            </p>
            <p className="pt-2 border-t">
              <strong>Điểm trung bình = </strong>
              (8.0 × {config.weights.oral} + 7.5 × {config.weights.quiz15} + 8.5 × {config.weights.quiz45} + 9.0
              × {config.weights.midterm} + 8.0 × {config.weights.final}) / {totalWeight} ={' '}
              {(
                (8.0 * config.weights.oral +
                  7.5 * config.weights.quiz15 +
                  8.5 * config.weights.quiz45 +
                  9.0 * config.weights.midterm +
                  8.0 * config.weights.final) /
                totalWeight
              ).toFixed(2)}
              {config.rounding === 'half-up' && ' → 8.06 (làm tròn)'}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
