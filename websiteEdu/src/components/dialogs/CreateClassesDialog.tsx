import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, School } from 'lucide-react';
import { autoScheduleApi } from '@/services/autoScheduleApi';
import { schoolYearApi } from '@/services/schoolYearApi';
import { gradeApi } from '@/services/gradeApi';
import { useToast } from '@/hooks/use-toast';

interface CreateClassesDialogProps {
  onClassesCreated: () => void;
}

const CreateClassesDialog: React.FC<CreateClassesDialogProps> = ({ onClassesCreated }) => {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [schoolYears, setSchoolYears] = useState<Array<{ code: string; name: string }>>([]);
  const [grades, setGrades] = useState<Array<{ _id: string; name: string }>>([]);
  const [formData, setFormData] = useState({
    year: '',
    classesPerGrade: 8,
    capacity: 45,
    selectedGrades: {} as Record<string, boolean>
  });

  // Lấy danh sách năm học và khối
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [yearsData, gradesData] = await Promise.all([
          schoolYearApi.getAll(),
          gradeApi.getAll(),
        ]);
        const years = yearsData.map(y => ({ code: y.code, name: y.name }));
        setSchoolYears(years);
        setGrades(gradesData);
        
        // Set năm học mặc định là năm học active hoặc năm học mới nhất
        const activeYear = yearsData.find(y => y.isActive);
        if (activeYear) {
          setFormData(prev => ({ ...prev, year: activeYear.code }));
        } else if (years.length > 0) {
          setFormData(prev => ({ ...prev, year: years[years.length - 1].code }));
        }
        
        // Set khối mặc định: chọn tất cả
        const defaultGrades: Record<string, boolean> = {};
        gradesData.forEach(grade => {
          defaultGrades[grade.name] = true;
        });
        setFormData(prev => ({ ...prev, selectedGrades: defaultGrades }));
      } catch (err) {
        console.error('Error fetching data:', err);
        toast({
          title: 'Lỗi',
          description: 'Không thể tải dữ liệu',
          variant: 'destructive',
        });
      }
    };
    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const selectedGrades = Object.entries(formData.selectedGrades)
        .filter(([_, selected]) => selected)
        .map(([gradeName, _]) => {
          // Tìm grade object để lấy name
          const grade = grades.find(g => g.name === gradeName);
          return grade?.name || gradeName;
        });

      if (selectedGrades.length === 0) {
        toast({
          title: 'Lỗi',
          description: 'Vui lòng chọn ít nhất một khối',
          variant: 'destructive',
        });
        return;
      }

      if (!formData.year) {
        toast({
          title: 'Lỗi',
          description: 'Vui lòng chọn năm học',
          variant: 'destructive',
        });
        return;
      }

      const result = await autoScheduleApi.createClasses(
        selectedGrades,
        formData.year,
        formData.classesPerGrade,
        formData.capacity
      );

      toast({
        title: 'Thành công',
        description: `Đã tạo ${result.classes?.length || 0} lớp thành công!`,
      });
      setIsOpen(false);
      onClassesCreated();
    } catch (error: any) {
      console.error('Lỗi tạo lớp:', error);
      toast({
        title: 'Lỗi',
        description: error.response?.data?.message || 'Không thể tạo lớp',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGradeChange = (gradeName: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      selectedGrades: {
        ...prev.selectedGrades,
        [gradeName]: checked
      }
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <School className="h-4 w-4 mr-2" />
          Tạo lớp tự động
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tạo lớp tự động</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="year">Năm học *</Label>
            <Select
              value={formData.year}
              onValueChange={(value) => setFormData(prev => ({ ...prev, year: value }))}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Chọn năm học" />
              </SelectTrigger>
              <SelectContent>
                {schoolYears.map((year) => (
                  <SelectItem key={year.code} value={year.code}>
                    {year.name} ({year.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Chọn khối</Label>
            <div className="space-y-2 mt-2">
              {grades.length === 0 ? (
                <p className="text-sm text-muted-foreground">Đang tải danh sách khối...</p>
              ) : (
                grades.map((grade) => (
                  <div key={grade._id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`grade-${grade._id}`}
                      checked={formData.selectedGrades[grade.name] || false}
                      onCheckedChange={(checked) => handleGradeChange(grade.name, checked as boolean)}
                    />
                    <Label htmlFor={`grade-${grade._id}`}>Khối {grade.name}</Label>
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="classesPerGrade">Số lớp mỗi khối</Label>
            <Input
              id="classesPerGrade"
              type="number"
              min="1"
              max="20"
              value={formData.classesPerGrade}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                classesPerGrade: parseInt(e.target.value) || 8 
              }))}
            />
          </div>

          <div>
            <Label htmlFor="capacity">Sĩ số tối đa mỗi lớp</Label>
            <Input
              id="capacity"
              type="number"
              min="20"
              max="60"
              value={formData.capacity}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                capacity: parseInt(e.target.value) || 45 
              }))}
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isLoading}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Đang tạo...' : 'Tạo lớp'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateClassesDialog;

