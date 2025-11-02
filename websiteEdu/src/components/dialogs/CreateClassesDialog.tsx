import React, { useState } from 'react';
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
import { Plus, School } from 'lucide-react';
import { autoScheduleApi } from '@/services/autoScheduleApi';

interface CreateClassesDialogProps {
  onClassesCreated: () => void;
}

const CreateClassesDialog: React.FC<CreateClassesDialogProps> = ({ onClassesCreated }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    year: new Date().getFullYear().toString(),
    classesPerGrade: 8,
    capacity: 45,
    grades: {
      '10': true,
      '11': true,
      '12': true
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const selectedGrades = Object.entries(formData.grades)
        .filter(([_, selected]) => selected)
        .map(([grade, _]) => grade);

      if (selectedGrades.length === 0) {
        alert('Vui lòng chọn ít nhất một khối');
        return;
      }

      const result = await autoScheduleApi.createClasses(
        selectedGrades,
        formData.year,
        formData.classesPerGrade,
        formData.capacity
      );

      alert(`✅ Đã tạo ${result.classes.length} lớp thành công!`);
      setIsOpen(false);
      onClassesCreated();
    } catch (error) {
      console.error('Lỗi tạo lớp:', error);
      alert('Lỗi khi tạo lớp!');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGradeChange = (grade: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      grades: {
        ...prev.grades,
        [grade]: checked
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
            <Label htmlFor="year">Năm học</Label>
            <Input
              id="year"
              type="text"
              value={formData.year}
              onChange={(e) => setFormData(prev => ({ ...prev, year: e.target.value }))}
              placeholder="2024-2025"
              required
            />
          </div>

          <div>
            <Label>Chọn khối</Label>
            <div className="space-y-2 mt-2">
              {Object.entries(formData.grades).map(([grade, selected]) => (
                <div key={grade} className="flex items-center space-x-2">
                  <Checkbox
                    id={`grade-${grade}`}
                    checked={selected}
                    onCheckedChange={(checked) => handleGradeChange(grade, checked as boolean)}
                  />
                  <Label htmlFor={`grade-${grade}`}>Khối {grade}</Label>
                </div>
              ))}
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

