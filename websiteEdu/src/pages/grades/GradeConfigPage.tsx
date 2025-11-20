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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import gradeConfigApi from '@/services/gradeConfigApi';
import schoolConfigApi from '@/services/schoolConfigApi';
// ✅ Sử dụng hooks thay vì API trực tiếp
import { useSchoolYears, useSubjects } from '@/hooks';
import { BarChart3, Save, RotateCcw, Info, Calculator, Plus, X, Eye, EyeOff } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface GradeWeights {
  oral: number;
  quiz15: number;
  quiz45: number;
  midterm: number;
  final: number;
  [key: string]: number;
}

interface ClassificationConfig {
  excellent: {
    minAverage: number;
    minSubjectScore: number;
  };
  good: {
    minAverage: number;
    minSubjectScore: number;
  };
  average: {
    minAverage: number;
    minSubjectScore: number; // Điểm TB từng môn tối thiểu (ví dụ: > 3.5)
  };
  weak: {
    maxAverage: number;
    maxSubjectScore?: number; // Điểm TB từng môn tối đa (ví dụ: < 3.5)
  };
}

interface RequiredSubject {
  subjectId: string;
  minScore: number;
  groupId?: string; // Nhóm các môn (ví dụ: "group1" cho Toán và Văn)
  requireAll?: boolean; // true: tất cả môn trong nhóm phải đạt, false: chỉ cần 1 trong nhóm
}

interface GradeConfig {
  weights: GradeWeights;
  rounding: 'half-up' | 'none';
  classification?: ClassificationConfig;
  requiredSubjects?: RequiredSubject[]; // Môn bắt buộc phải đạt điểm tối thiểu
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

const DEFAULT_CLASSIFICATION: ClassificationConfig = {
  excellent: {
    minAverage: 8.0,
    minSubjectScore: 6.5,
  },
  good: {
    minAverage: 6.5,
    minSubjectScore: 5.0,
  },
  average: {
    minAverage: 5.0,
    minSubjectScore: 3.5, // Điểm TB từng môn > 3.5
  },
  weak: {
    maxAverage: 5.0,
    maxSubjectScore: 3.5, // Điểm TB từng môn < 3.5
  },
};

// ✅ Điểm tối thiểu mặc định cho môn bắt buộc
const DEFAULT_REQUIRED_MIN_SCORE = 8.0;

// ✅ Cấu hình mặc định cho môn bắt buộc
// Lưu ý: subjectId sẽ được set động dựa trên tên môn (Toán, Văn) khi reset
const DEFAULT_REQUIRED_SUBJECTS: Omit<RequiredSubject, 'subjectId'>[] = [
  {
    minScore: DEFAULT_REQUIRED_MIN_SCORE,
    groupId: 'group_math_lit',
    requireAll: false, // 1 trong 2 môn Toán hoặc Văn
  },
  {
    minScore: DEFAULT_REQUIRED_MIN_SCORE,
    groupId: 'group_math_lit',
    requireAll: false,
  },
];

export default function GradeConfigPage() {
  const { toast } = useToast();
  const [config, setConfig] = useState<GradeConfig>({
    weights: { ...DEFAULT_WEIGHTS },
    rounding: 'half-up',
    classification: { ...DEFAULT_CLASSIFICATION },
    requiredSubjects: [],
  });
  const [loading, setLoading] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [schoolYear, setSchoolYear] = useState<string>('');
  const [semester, setSemester] = useState<string>('1');
  const [schoolYears, setSchoolYears] = useState<Array<{ code: string; name: string }>>([]);
  const [defaultMinScore, setDefaultMinScore] = useState<number>(DEFAULT_REQUIRED_MIN_SCORE);

  // ✅ Lấy danh sách năm học và môn học từ hooks
  const { schoolYears: allSchoolYears } = useSchoolYears();
  const { subjects } = useSubjects();
  useEffect(() => {
    const years = allSchoolYears.map(y => ({ code: y.code, name: y.name }));
    if (years.length > 0) {
      setSchoolYears(years);
      setSchoolYear(years[years.length - 1].code);
    } else {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const currentYear = month >= 8 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
      setSchoolYear(currentYear);
    }
  }, [allSchoolYears]);

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
          classification: res.classification || { ...DEFAULT_CLASSIFICATION },
          requiredSubjects: res.requiredSubjects || [],
          schoolYear: res.schoolYear || schoolYear,
          semester: res.semester || semester,
        });
      } else if (res.data) {
        setConfig({
          weights: res.data.weights || { ...DEFAULT_WEIGHTS },
          rounding: res.data.rounding || 'half-up',
          classification: res.data.classification || { ...DEFAULT_CLASSIFICATION },
          requiredSubjects: res.data.requiredSubjects || [],
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
        classification: { ...DEFAULT_CLASSIFICATION },
        requiredSubjects: [],
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

  // Tính tổng trọng số (chỉ tính các loại điểm có trọng số > 0)
  const totalWeight = Object.entries(config.weights)
    .filter(([_, weight]) => weight > 0)
    .reduce((sum, [_, weight]) => sum + weight, 0);
  
  // Lấy danh sách các loại điểm đang được sử dụng (weight > 0)
  const activeWeights = Object.entries(config.weights).filter(([_, weight]) => weight > 0);
  
  // Toggle enable/disable một loại điểm
  const toggleWeightType = (key: string) => {
    const currentWeight = config.weights[key] || 0;
    const newWeight = currentWeight > 0 ? 0 : (DEFAULT_WEIGHTS[key] || 1);
    setConfig({
      ...config,
      weights: {
        ...config.weights,
        [key]: newWeight,
      },
    });
  };

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

    // Kiểm tra có ít nhất một loại điểm được bật
    const hasActiveWeight = Object.values(config.weights).some((v) => v > 0);
    if (!hasActiveWeight) {
      toast({
        title: 'Lỗi',
        description: 'Vui lòng bật ít nhất một loại điểm',
        variant: 'destructive',
      });
      return;
    }

    // Kiểm tra các loại điểm đang bật phải có trọng số > 0
    const invalidWeights = Object.entries(config.weights).filter(
      ([_, weight]) => weight < 0
    );
    if (invalidWeights.length > 0) {
      toast({
        title: 'Lỗi',
        description: 'Trọng số không được nhỏ hơn 0',
        variant: 'destructive',
      });
      return;
    }

    // Kiểm tra môn bắt buộc
    const invalidRequiredSubjects = (config.requiredSubjects || []).filter(
      (item) => !item.subjectId || item.minScore < 0 || item.minScore > 10
    );
    if (invalidRequiredSubjects.length > 0) {
      toast({
        title: 'Lỗi',
        description: 'Vui lòng chọn đầy đủ môn học và điểm tối thiểu hợp lệ (0-10) cho các môn bắt buộc',
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
        description: 'Đã lưu tất cả cấu hình điểm số thành công.',
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

  // Tìm môn học theo tên (không phân biệt hoa thường)
  const findSubjectByName = (keywords: string[]): string => {
    const subject = subjects.find((s) => {
      const nameLower = s.name.toLowerCase();
      const codeLower = s.code?.toLowerCase() || '';
      return keywords.some(
        (keyword) =>
          nameLower.includes(keyword.toLowerCase()) ||
          codeLower.includes(keyword.toLowerCase())
      );
    });
    return subject?._id || '';
  };

  // Tạo requiredSubjects mặc định với subjectId thực tế
  const getDefaultRequiredSubjects = (): RequiredSubject[] => {
    // Tìm môn Toán với nhiều từ khóa
    const mathId = findSubjectByName(['toán', 'math', 'mathematics']);
    // Tìm môn Văn với nhiều từ khóa
    const litId = findSubjectByName(['văn', 'ngữ văn', 'literature', 'lit', 'van']);
    
    // Nếu không tìm thấy môn, trả về mảng rỗng
    if (!mathId && !litId) {
      return [];
    }

    const result: RequiredSubject[] = [];
    
    // Thêm Toán nếu tìm thấy
    if (mathId) {
      result.push({
        subjectId: mathId,
        minScore: defaultMinScore,
        groupId: DEFAULT_REQUIRED_SUBJECTS[0].groupId,
        requireAll: DEFAULT_REQUIRED_SUBJECTS[0].requireAll,
      });
    }
    
    // Thêm Văn nếu tìm thấy
    if (litId) {
      result.push({
        subjectId: litId,
        minScore: defaultMinScore,
        groupId: DEFAULT_REQUIRED_SUBJECTS[1].groupId, // Cùng nhóm với Toán
        requireAll: DEFAULT_REQUIRED_SUBJECTS[1].requireAll,
      });
    }
    
    return result;
  };

  const resetToDefault = () => {
    const defaultRequiredSubjects = getDefaultRequiredSubjects();
    setConfig({
      weights: { ...DEFAULT_WEIGHTS },
      rounding: 'half-up',
      classification: { ...DEFAULT_CLASSIFICATION },
      requiredSubjects: defaultRequiredSubjects,
      schoolYear,
      semester,
    });
    toast({
      title: 'Đã đặt về mặc định',
      description: defaultRequiredSubjects.length > 0
        ? `Cấu hình đã được đặt về giá trị mặc định (Toán hoặc Văn ≥ ${defaultMinScore}). Nhấn "Lưu cấu hình" để áp dụng.`
        : 'Cấu hình đã được đặt về giá trị mặc định. Nhấn "Lưu cấu hình" để áp dụng.',
    });
  };

  // Thêm môn bắt buộc mới
  const addRequiredSubject = (groupId?: string) => {
    const newSubject: RequiredSubject = {
      subjectId: '',
      minScore: defaultMinScore,
      groupId: groupId || `group_${Date.now()}`,
      requireAll: false,
    };
    setConfig({
      ...config,
      requiredSubjects: [
        ...(config.requiredSubjects || []),
        newSubject,
      ],
    });
  };

  // Thêm môn vào nhóm hiện có
  const addSubjectToGroup = (groupId: string) => {
    addRequiredSubject(groupId);
  };

  // Xóa môn bắt buộc
  const removeRequiredSubject = (index: number) => {
    const newRequired = [...(config.requiredSubjects || [])];
    newRequired.splice(index, 1);
    setConfig({
      ...config,
      requiredSubjects: newRequired,
    });
  };

  // Cập nhật môn bắt buộc
  const updateRequiredSubject = (index: number, field: keyof RequiredSubject, value: any) => {
    const newRequired = [...(config.requiredSubjects || [])];
    newRequired[index] = {
      ...newRequired[index],
      [field]: value,
    };
    setConfig({
      ...config,
      requiredSubjects: newRequired,
    });
  };

  // Nhóm các môn bắt buộc theo groupId
  const groupedRequiredSubjects = (config.requiredSubjects || []).reduce((acc, item, index) => {
    const groupId = item.groupId || `single_${index}`;
    if (!acc[groupId]) {
      acc[groupId] = [];
    }
    acc[groupId].push({ ...item, originalIndex: index });
    return acc;
  }, {} as Record<string, Array<RequiredSubject & { originalIndex: number }>>);

  // Reset tất cả điểm về mặc định
  const resetAllScoresToDefault = () => {
    const newRequired = (config.requiredSubjects || []).map((item) => ({
      ...item,
      minScore: defaultMinScore,
    }));
    setConfig({
      ...config,
      requiredSubjects: newRequired,
    });
    toast({
      title: 'Đã reset điểm',
      description: `Tất cả điểm tối thiểu đã được đặt về ${defaultMinScore}.`,
    });
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Cấu hình điểm số</h1>
          <p className="text-muted-foreground">
            Cấu hình trọng số, xếp loại học tập và môn bắt buộc cho năm học {schoolYear || '...'} - Học kỳ {semester}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={resetToDefault}
            disabled={loading || loadingConfig}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Đặt về mặc định
          </Button>
          <Button onClick={handleSave} disabled={loading || loadingConfig}>
            <Save className="h-4 w-4 mr-2" />
            {loading ? 'Đang lưu...' : 'Lưu tất cả cấu hình'}
          </Button>
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
          Điểm trung bình = (
          {activeWeights.map(([key, weight], index) => (
            <span key={key}>
              {index > 0 && ' + '}
              {LABEL_MAP[key]} × {weight}
            </span>
          ))}
          ) / {totalWeight}
          {config.rounding === 'half-up' && ' (làm tròn 0.5 lên)'}
          {activeWeights.length === 0 && (
            <span className="text-destructive font-medium"> - Vui lòng bật ít nhất một loại điểm</span>
          )}
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
                {Object.entries(config.weights).map(([key, value]) => {
                  const isEnabled = value > 0;
                  return (
                    <div key={key} className={`space-y-2 p-3 rounded-lg border transition-all ${
                      isEnabled ? 'border-border bg-background' : 'border-muted bg-muted/30 opacity-60'
                    }`}>
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium flex items-center gap-2">
                          {LABEL_MAP[key] || key}
                          {isEnabled && (
                            <span className="text-xs text-muted-foreground">({value})</span>
                          )}
                        </Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => toggleWeightType(key)}
                          disabled={loading}
                          title={isEnabled ? 'Ẩn loại điểm này' : 'Hiện loại điểm này'}
                        >
                          {isEnabled ? (
                            <Eye className="h-4 w-4" />
                          ) : (
                            <EyeOff className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      {isEnabled ? (
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
                      ) : (
                        <div className="text-center text-sm text-muted-foreground py-2">
                          Đã tắt
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="pt-4 border-t">
                <Label className="text-base font-semibold mb-4 block">Kiểu làm tròn điểm</Label>
                <RadioGroup
                  value={config.rounding}
                  onValueChange={(v) => setConfig({ ...config, rounding: v as 'half-up' | 'none' })}
                  disabled={loading}
                  className="space-y-3"
                >
                  <div
                    onClick={() => !loading && setConfig({ ...config, rounding: 'half-up' })}
                    className={`flex items-start space-x-3 space-y-0 rounded-lg border p-4 transition-all cursor-pointer ${
                      config.rounding === 'half-up'
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'hover:bg-accent hover:border-accent-foreground/20'
                    } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <RadioGroupItem value="half-up" id="half-up" className="mt-0.5" />
                    <div className="flex-1 space-y-1">
                      <Label htmlFor="half-up" className="font-medium cursor-pointer flex items-center gap-2">
                        Làm tròn 0.5 lên
                        {config.rounding === 'half-up' && (
                          <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                            Đang dùng
                          </span>
                        )}
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Điểm có phần thập phân ≥ 0.5 sẽ được làm tròn lên. Ví dụ: <strong>7.5 → 8</strong>, 8.3 → 8, <strong>8.6 → 9</strong>
                      </p>
                    </div>
                    <Calculator className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                  </div>
                  <div
                    onClick={() => !loading && setConfig({ ...config, rounding: 'none' })}
                    className={`flex items-start space-x-3 space-y-0 rounded-lg border p-4 transition-all cursor-pointer ${
                      config.rounding === 'none'
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'hover:bg-accent hover:border-accent-foreground/20'
                    } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <RadioGroupItem value="none" id="none" className="mt-0.5" />
                    <div className="flex-1 space-y-1">
                      <Label htmlFor="none" className="font-medium cursor-pointer flex items-center gap-2">
                        Không làm tròn
                        {config.rounding === 'none' && (
                          <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                            Đang dùng
                          </span>
                        )}
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Giữ nguyên số thập phân. Ví dụ: <strong>7.5 → 7.5</strong>, 8.3 → 8.3, <strong>8.6 → 8.6</strong>
                      </p>
                    </div>
                    <Calculator className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                  </div>
                </RadioGroup>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Classification Config */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Cấu hình xếp loại học tập
          </CardTitle>
          <CardDescription>
            Thiết lập ngưỡng điểm để xếp loại học lực: Giỏi, Khá, Trung bình, Yếu
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Giỏi */}
                <div className="space-y-4 p-4 border rounded-lg bg-green-50 dark:bg-green-950">
                  <div className="font-semibold text-green-700 dark:text-green-300">Loại Giỏi</div>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-sm">Điểm TB năm tối thiểu</Label>
                      <Input
                        type="number"
                        min={0}
                        max={10}
                        step={0.1}
                        value={config.classification?.excellent.minAverage || DEFAULT_CLASSIFICATION.excellent.minAverage}
                        disabled={loading}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            classification: {
                              ...(config.classification || DEFAULT_CLASSIFICATION),
                              excellent: {
                                ...(config.classification?.excellent || DEFAULT_CLASSIFICATION.excellent),
                                minAverage: Number(e.target.value) || 0,
                              },
                            },
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-sm">Điểm TB từng môn tối thiểu</Label>
                      <Input
                        type="number"
                        min={0}
                        max={10}
                        step={0.1}
                        value={config.classification?.excellent.minSubjectScore || DEFAULT_CLASSIFICATION.excellent.minSubjectScore}
                        disabled={loading}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            classification: {
                              ...(config.classification || DEFAULT_CLASSIFICATION),
                              excellent: {
                                ...(config.classification?.excellent || DEFAULT_CLASSIFICATION.excellent),
                                minSubjectScore: Number(e.target.value) || 0,
                              },
                            },
                          })
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* Khá */}
                <div className="space-y-4 p-4 border rounded-lg bg-blue-50 dark:bg-blue-950">
                  <div className="font-semibold text-blue-700 dark:text-blue-300">Loại Khá</div>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-sm">Điểm TB năm tối thiểu</Label>
                      <Input
                        type="number"
                        min={0}
                        max={10}
                        step={0.1}
                        value={config.classification?.good.minAverage || DEFAULT_CLASSIFICATION.good.minAverage}
                        disabled={loading}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            classification: {
                              ...(config.classification || DEFAULT_CLASSIFICATION),
                              good: {
                                ...(config.classification?.good || DEFAULT_CLASSIFICATION.good),
                                minAverage: Number(e.target.value) || 0,
                              },
                            },
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-sm">Điểm TB từng môn tối thiểu</Label>
                      <Input
                        type="number"
                        min={0}
                        max={10}
                        step={0.1}
                        value={config.classification?.good.minSubjectScore || DEFAULT_CLASSIFICATION.good.minSubjectScore}
                        disabled={loading}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            classification: {
                              ...(config.classification || DEFAULT_CLASSIFICATION),
                              good: {
                                ...(config.classification?.good || DEFAULT_CLASSIFICATION.good),
                                minSubjectScore: Number(e.target.value) || 0,
                              },
                            },
                          })
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* Trung bình */}
                <div className="space-y-4 p-4 border rounded-lg bg-yellow-50 dark:bg-yellow-950">
                  <div className="font-semibold text-yellow-700 dark:text-yellow-300">Loại Trung bình</div>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-sm">Điểm TB năm tối thiểu</Label>
                      <Input
                        type="number"
                        min={0}
                        max={10}
                        step={0.1}
                        value={config.classification?.average.minAverage || DEFAULT_CLASSIFICATION.average.minAverage}
                        disabled={loading}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            classification: {
                              ...(config.classification || DEFAULT_CLASSIFICATION),
                              average: {
                                ...(config.classification?.average || DEFAULT_CLASSIFICATION.average),
                                minAverage: Number(e.target.value) || 0,
                              },
                            },
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-sm">Điểm TB từng môn tối thiểu</Label>
                      <Input
                        type="number"
                        min={0}
                        max={10}
                        step={0.1}
                        value={config.classification?.average.minSubjectScore || DEFAULT_CLASSIFICATION.average.minSubjectScore}
                        disabled={loading}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            classification: {
                              ...(config.classification || DEFAULT_CLASSIFICATION),
                              average: {
                                ...(config.classification?.average || DEFAULT_CLASSIFICATION.average),
                                minSubjectScore: Number(e.target.value) || 0,
                              },
                            },
                          })
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* Yếu */}
                <div className="space-y-4 p-4 border rounded-lg bg-red-50 dark:bg-red-950">
                  <div className="font-semibold text-red-700 dark:text-red-300">Loại Yếu</div>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-sm">Điểm TB năm tối đa (dưới ngưỡng này)</Label>
                      <Input
                        type="number"
                        min={0}
                        max={10}
                        step={0.1}
                        value={config.classification?.weak.maxAverage || DEFAULT_CLASSIFICATION.weak.maxAverage}
                        disabled={loading}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            classification: {
                              ...(config.classification || DEFAULT_CLASSIFICATION),
                              weak: {
                                ...(config.classification?.weak || DEFAULT_CLASSIFICATION.weak),
                                maxAverage: Number(e.target.value) || 0,
                              },
                            },
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-sm">Điểm TB từng môn tối đa (dưới ngưỡng này)</Label>
                      <Input
                        type="number"
                        min={0}
                        max={10}
                        step={0.1}
                        value={config.classification?.weak.maxSubjectScore || DEFAULT_CLASSIFICATION.weak.maxSubjectScore || 3.5}
                        disabled={loading}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            classification: {
                              ...(config.classification || DEFAULT_CLASSIFICATION),
                              weak: {
                                ...(config.classification?.weak || DEFAULT_CLASSIFICATION.weak),
                                maxSubjectScore: Number(e.target.value) || 0,
                              },
                            },
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Quy tắc xếp loại</AlertTitle>
                <AlertDescription className="space-y-1">
                  <p>• <strong>Giỏi:</strong> Điểm TB năm ≥ {config.classification?.excellent.minAverage || DEFAULT_CLASSIFICATION.excellent.minAverage} và tất cả môn ≥ {config.classification?.excellent.minSubjectScore || DEFAULT_CLASSIFICATION.excellent.minSubjectScore}</p>
                  <p>• <strong>Khá:</strong> Điểm TB năm ≥ {config.classification?.good.minAverage || DEFAULT_CLASSIFICATION.good.minAverage} và tất cả môn ≥ {config.classification?.good.minSubjectScore || DEFAULT_CLASSIFICATION.good.minSubjectScore}</p>
                  <p>• <strong>Trung bình:</strong> Điểm TB năm ≥ {config.classification?.average.minAverage || DEFAULT_CLASSIFICATION.average.minAverage} và tất cả môn &gt; {config.classification?.average.minSubjectScore || DEFAULT_CLASSIFICATION.average.minSubjectScore}</p>
                  <p>• <strong>Yếu:</strong> Điểm TB năm &lt; {config.classification?.weak.maxAverage || DEFAULT_CLASSIFICATION.weak.maxAverage} hoặc có môn &lt; {config.classification?.weak.maxSubjectScore || DEFAULT_CLASSIFICATION.weak.maxSubjectScore || 3.5}</p>
                </AlertDescription>
              </Alert>
            </>
          )}
        </CardContent>
      </Card>

      {/* Required Subjects Config */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Môn bắt buộc phải đạt điểm tối thiểu
              </CardTitle>
              <CardDescription>
                Cấu hình các môn học bắt buộc phải đạt điểm tối thiểu để xếp loại (ví dụ: 1 trong 2 môn Toán hoặc Văn phải ≥ 8.0)
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={() => addRequiredSubject()} variant="outline" size="sm" disabled={loading}>
                <Plus className="h-4 w-4 mr-2" />
                Thêm môn
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Cấu hình điểm mặc định */}
          <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 flex-1">
              <Label className="text-sm font-medium whitespace-nowrap">Điểm tối thiểu mặc định:</Label>
              <Input
                type="number"
                min={0}
                max={10}
                step={0.1}
                value={defaultMinScore}
                onChange={(e) => setDefaultMinScore(Number(e.target.value) || 0)}
                disabled={loading}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">(Dùng cho môn mới thêm)</span>
            </div>
            {(config.requiredSubjects || []).length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={resetAllScoresToDefault}
                disabled={loading}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset tất cả điểm về {defaultMinScore}
              </Button>
            )}
          </div>
          {loadingConfig ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Đang tải cấu hình...</p>
              </div>
            </div>
          ) : (
            <>
              {Object.keys(groupedRequiredSubjects).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Chưa có môn bắt buộc nào. Nhấn nút "Thêm môn" để thêm.</p>
                </div>
              ) : (
                Object.entries(groupedRequiredSubjects).map(([groupId, items]) => (
                  <div key={groupId} className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-sm font-semibold">
                        Nhóm {items.length > 1 ? `(${items.length} môn)` : ''}
                      </Label>
                      {items.length > 1 && (
                        <div className="flex items-center gap-2">
                          <Label className="text-xs text-muted-foreground">Yêu cầu:</Label>
                          <Select
                            value={items[0].requireAll ? 'all' : 'one'}
                            onValueChange={(v) => {
                              items.forEach((item) => {
                                updateRequiredSubject(item.originalIndex, 'requireAll', v === 'all');
                              });
                            }}
                            disabled={loading}
                          >
                            <SelectTrigger className="w-32 h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="one">1 trong {items.length}</SelectItem>
                              <SelectItem value="all">Tất cả</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      {items.map((item, itemIndex) => {
                        const originalIndex = item.originalIndex;
                        return (
                          <div key={originalIndex} className="flex items-center gap-2">
                            <Select
                              value={item.subjectId}
                              onValueChange={(v) => updateRequiredSubject(originalIndex, 'subjectId', v)}
                              disabled={loading}
                            >
                              <SelectTrigger className="flex-1">
                                <SelectValue placeholder="Chọn môn học" />
                              </SelectTrigger>
                              <SelectContent>
                                {subjects.map((s) => (
                                  <SelectItem key={s._id} value={s._id}>
                                    {s.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <div className="flex items-center gap-2">
                              <Label className="text-sm whitespace-nowrap">≥</Label>
                              <Input
                                type="number"
                                min={0}
                                max={10}
                                step={0.1}
                                value={item.minScore}
                                onChange={(e) =>
                                  updateRequiredSubject(originalIndex, 'minScore', Number(e.target.value) || 0)
                                }
                                disabled={loading}
                                className="w-24"
                              />
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeRequiredSubject(originalIndex)}
                              disabled={loading}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        );
                      })}
                      {/* Nút thêm môn vào nhóm này */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => addSubjectToGroup(groupId)}
                        disabled={loading}
                        className="w-full"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Thêm môn vào nhóm này
                      </Button>
                    </div>
                    {items.length > 1 && (
                      <div className="text-xs text-muted-foreground mt-2">
                        {items[0].requireAll
                          ? `Tất cả ${items.length} môn phải đạt điểm tối thiểu`
                          : `Ít nhất 1 trong ${items.length} môn phải đạt điểm tối thiểu`}
                      </div>
                    )}
                  </div>
                ))
              )}

              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Lưu ý về môn bắt buộc</AlertTitle>
                <AlertDescription>
                  <p className="mb-2">
                    • Môn bắt buộc được sử dụng để kiểm tra điều kiện xếp loại học lực.
                  </p>
                  <p className="mb-2">
                    • Nếu chọn "1 trong N môn": Học sinh chỉ cần đạt điểm tối thiểu ở 1 trong các môn trong nhóm.
                  </p>
                  <p>
                    • Nếu chọn "Tất cả": Học sinh phải đạt điểm tối thiểu ở tất cả các môn trong nhóm.
                  </p>
                  <p className="mt-2">
                    <strong>Ví dụ:</strong> Nhóm Toán và Văn, yêu cầu "1 trong 2", điểm tối thiểu 8.0 → Học sinh chỉ cần Toán ≥ 8.0 HOẶC Văn ≥ 8.0.
                  </p>
                </AlertDescription>
              </Alert>
            </>
          )}
        </CardContent>
      </Card>

      {/* Sticky Save Button */}
      <div className="fixed bottom-0 left-0 md:left-[var(--sidebar-width)] right-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t p-4 z-50 shadow-lg transition-[left] duration-200 ease-linear group-data-[collapsible=icon]/sidebar-wrapper:md:left-[var(--sidebar-width-icon)]">
        <div className="container mx-auto max-w-7xl flex items-center justify-between">
          <div className="text-sm text-muted-foreground hidden md:block">
            Nhấn "Lưu tất cả cấu hình" để lưu tất cả thay đổi
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            <Button
              variant="outline"
              onClick={resetToDefault}
              disabled={loading || loadingConfig}
              className="hidden sm:flex"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Đặt về mặc định
            </Button>
            <Button onClick={handleSave} disabled={loading || loadingConfig} size="lg" className="flex-1 sm:flex-initial">
              <Save className="h-4 w-4 mr-2" />
              {loading ? 'Đang lưu...' : 'Lưu tất cả cấu hình'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
