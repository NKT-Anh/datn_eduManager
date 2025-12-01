import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Trophy, Plus, Search, Award, Star } from 'lucide-react';
import surveyApi from '@/services/surveyApi';
import { useTeachers } from '@/hooks';
import { useSchoolYears } from '@/hooks';
import { useCurrentAcademicYear } from '@/hooks/useCurrentAcademicYear';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

interface TeacherWithAwards {
  _id: string;
  name: string;
  teacherCode: string;
  currentRating?: {
    level: 'excellent' | 'good' | 'average' | 'needs_improvement' | null;
    averageScore?: number;
    year?: string;
    semester?: string;
  };
  awards: Array<{
    _id: string;
    title: string;
    year?: string;
    semester?: string;
    reason?: string;
    awardedAt: string;
    awardedBy?: {
      _id: string;
      email: string;
    };
    surveyAverageScore?: number;
  }>;
  totalAwards: number;
}

export default function AwardManagementPage() {
  const { toast } = useToast();
  const { teachers } = useTeachers();
  const { schoolYears } = useSchoolYears();
  const { currentYearCode } = useCurrentAcademicYear();

  const [loading, setLoading] = useState(false);
  const [teachersWithAwards, setTeachersWithAwards] = useState<TeacherWithAwards[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedYear, setSelectedYear] = useState<string>('');
  
  // ✅ Set năm học hiện tại khi có dữ liệu
  useEffect(() => {
    if (currentYearCode && !selectedYear) {
      setSelectedYear(currentYearCode);
    }
  }, [currentYearCode, selectedYear]);
  const [isAwardDialogOpen, setIsAwardDialogOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<any>(null);

  // Form state
  const [formData, setFormData] = useState({
    teacherId: '',
    title: '',
    year: currentYearCode || '',
    semester: 'all',
    reason: '',
    surveyAverageScore: '',
  });

  useEffect(() => {
    if (selectedYear) {
      loadTeachersWithAwards();
    }
  }, [selectedYear]);

  const loadTeachersWithAwards = async () => {
    setLoading(true);
    try {
      const data = await surveyApi.getTeachersWithAwards({
        year: selectedYear || undefined,
      });
      setTeachersWithAwards(data.teachers || []);
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.response?.data?.message || 'Không thể tải danh sách giáo viên',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAward = (teacher?: TeacherWithAwards) => {
    if (teacher) {
      setSelectedTeacher(teacher);
      setFormData({
        teacherId: teacher._id,
        title: '',
        year: selectedYear || activeYear?.code || '',
        semester: 'all',
        reason: '',
        surveyAverageScore: teacher.currentRating?.averageScore?.toString() || '',
      });
    } else {
      setSelectedTeacher(null);
      setFormData({
        teacherId: '',
        title: '',
        year: selectedYear || activeYear?.code || '',
        semester: 'all',
        reason: '',
        surveyAverageScore: '',
      });
    }
    setIsAwardDialogOpen(true);
  };

  const handleSubmitAward = async () => {
    if (!formData.teacherId || !formData.title) {
      toast({
        title: 'Lỗi',
        description: 'Vui lòng điền đầy đủ thông tin bắt buộc',
        variant: 'destructive',
      });
      return;
    }

    try {
      await surveyApi.awardTeacher({
        teacherId: formData.teacherId,
        title: formData.title,
        year: formData.year || undefined,
        semester: formData.semester !== 'all' ? formData.semester : undefined,
        reason: formData.reason || undefined,
        surveyAverageScore: formData.surveyAverageScore
          ? parseFloat(formData.surveyAverageScore)
          : undefined,
      });

      toast({
        title: 'Thành công',
        description: 'Đã trao danh hiệu/khen thưởng thành công',
      });

      setIsAwardDialogOpen(false);
      setFormData({
        teacherId: '',
        title: '',
        year: selectedYear || activeYear?.code || '',
        semester: 'all',
        reason: '',
        surveyAverageScore: '',
      });
      loadTeachersWithAwards();
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.response?.data?.message || 'Có lỗi xảy ra',
        variant: 'destructive',
      });
    }
  };

  const getRatingBadge = (level: string | null | undefined) => {
    const ratingMap: Record<string, { label: string; color: string }> = {
      excellent: { label: 'Xuất sắc', color: 'bg-yellow-500' },
      good: { label: 'Khá', color: 'bg-green-500' },
      average: { label: 'Trung bình', color: 'bg-blue-500' },
      needs_improvement: { label: 'Cần cải thiện', color: 'bg-orange-500' },
    };
    const ratingInfo = ratingMap[level || ''] || { label: 'Chưa đánh giá', color: 'bg-gray-500' };
    return (
      <Badge className={`${ratingInfo.color} text-white`}>{ratingInfo.label}</Badge>
    );
  };

  const filteredTeachers = teachersWithAwards.filter(
    (teacher) =>
      teacher.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      teacher.teacherCode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Quản lý danh hiệu / Khen thưởng</h1>
          <p className="text-muted-foreground">
            Trao danh hiệu và khen thưởng cho giáo viên dựa trên kết quả khảo sát
          </p>
        </div>
        <Button onClick={() => handleAward()}>
          <Plus className="h-4 w-4 mr-2" />
          Trao danh hiệu
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Input
                placeholder="Tìm kiếm giáo viên..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label>Năm học:</Label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Chọn năm học" />
                </SelectTrigger>
                <SelectContent>
                  {schoolYears.map((year) => (
                    <SelectItem key={year._id} value={year.code}>
                      {year.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Teachers List */}
      <Card>
        <CardHeader>
          <CardTitle>Danh sách giáo viên có danh hiệu</CardTitle>
          <CardDescription>
            {selectedYear ? `Năm học ${selectedYear}` : 'Tất cả các năm học'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Giáo viên</TableHead>
                <TableHead>Mã GV</TableHead>
                <TableHead>Xếp loại</TableHead>
                <TableHead>Điểm TB</TableHead>
                <TableHead>Số danh hiệu</TableHead>
                <TableHead>Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center">Đang tải...</TableCell>
                </TableRow>
              ) : filteredTeachers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center">
                    Không có giáo viên nào có danh hiệu
                  </TableCell>
                </TableRow>
              ) : (
                filteredTeachers.map((teacher) => (
                  <TableRow key={teacher._id}>
                    <TableCell className="font-medium">{teacher.name}</TableCell>
                    <TableCell>{teacher.teacherCode}</TableCell>
                    <TableCell>
                      {teacher.currentRating?.level
                        ? getRatingBadge(teacher.currentRating.level)
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {teacher.currentRating?.averageScore ? (
                        <Badge variant="outline">
                          {teacher.currentRating.averageScore.toFixed(2)}
                        </Badge>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{teacher.totalAwards}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAward(teacher)}
                      >
                        <Trophy className="h-4 w-4 mr-1" />
                        Trao danh hiệu
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Award Dialog */}
      <Dialog open={isAwardDialogOpen} onOpenChange={setIsAwardDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Trao danh hiệu / Khen thưởng</DialogTitle>
            <DialogDescription>
              {selectedTeacher
                ? `Trao danh hiệu cho ${selectedTeacher.name}`
                : 'Trao danh hiệu cho giáo viên'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Giáo viên *</Label>
              <Select
                value={formData.teacherId}
                onValueChange={(value) => setFormData({ ...formData, teacherId: value })}
                disabled={!!selectedTeacher}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn giáo viên" />
                </SelectTrigger>
                <SelectContent>
                  {teachers.map((teacher) => (
                    <SelectItem key={teacher._id} value={teacher._id}>
                      {teacher.name} ({teacher.teacherCode})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Danh hiệu / Khen thưởng *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="VD: Giáo viên xuất sắc, Khen thưởng cuối năm..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Năm học</Label>
                <Input
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                  placeholder="2024-2025"
                />
              </div>
              <div>
                <Label>Học kỳ</Label>
                <Select
                  value={formData.semester}
                  onValueChange={(value) => setFormData({ ...formData, semester: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả</SelectItem>
                    <SelectItem value="1">Học kỳ 1</SelectItem>
                    <SelectItem value="2">Học kỳ 2</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Lý do khen thưởng</Label>
              <Textarea
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                placeholder="Nhập lý do khen thưởng..."
                rows={3}
              />
            </div>
            <div>
              <Label>Điểm khảo sát trung bình (nếu có)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max="5"
                value={formData.surveyAverageScore}
                onChange={(e) => setFormData({ ...formData, surveyAverageScore: e.target.value })}
                placeholder="4.5"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAwardDialogOpen(false)}>
              Hủy
            </Button>
            <Button onClick={handleSubmitAward}>
              <Trophy className="h-4 w-4 mr-2" />
              Trao danh hiệu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

