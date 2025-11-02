import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import gradeConfigApi from '@/services/gradeConfigApi';

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
}

export default function GradeConfigPage() {
  const [config, setConfig] = useState<GradeConfig>({
    weights: { oral: 1, quiz15: 1, quiz45: 2, midterm: 2, final: 3 },
    rounding: 'half-up',
  });
  const [loading, setLoading] = useState(false);

  // 🧠 Lấy cấu hình hiện tại
  const fetchConfig = async () => {
    try {
      const res = await gradeConfigApi.getConfig();
      setConfig(res.data || res);
    } catch (err) {
      console.error(err);
      toast({ title: 'Lỗi', description: 'Không thể tải cấu hình điểm', variant: 'destructive' });
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  // 💾 Cập nhật cấu hình
  const handleSave = async () => {
    if (Object.values(config.weights).some((v) => v <= 0)) {
      toast({ title: 'Lỗi', description: 'Trọng số phải lớn hơn 0', variant: 'destructive' });
      return;
    }

    try {
      setLoading(true);
      await gradeConfigApi.updateConfig(config);
      toast({ title: 'Thành công', description: 'Đã lưu cấu hình điểm.' });
    } catch {
      toast({ title: 'Lỗi', description: 'Không thể lưu cấu hình', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // 🔁 Reset về mặc định
  const handleReset = async () => {
    try {
      await gradeConfigApi.resetConfig();
      toast({ title: 'Đã khôi phục mặc định' });
      fetchConfig();
    } catch {
      toast({ title: 'Lỗi', description: 'Không thể khôi phục mặc định', variant: 'destructive' });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Cấu hình tính điểm</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-5 gap-4">
            {Object.entries(config.weights).map(([key, value]) => (
              <div key={key}>
                <Label>{key.toUpperCase()}</Label>
                <Input
                  type="number"
                  min={0.1}
                  step={0.1}
                  value={value}
                  disabled={loading}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      weights: { ...config.weights, [key]: Number(e.target.value) },
                    })
                  }
                />
              </div>
            ))}
          </div>

          <div className="mt-4">
            <Label>Kiểu làm tròn</Label>
            <Select
              disabled={loading}
              value={config.rounding}
              onValueChange={(v) => setConfig({ ...config, rounding: v as 'half-up' | 'none' })}
            >
              <SelectTrigger className="w-48 mt-2">
                <SelectValue placeholder="Chọn kiểu làm tròn" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="half-up">Làm tròn 0.5 lên</SelectItem>
                <SelectItem value="none">Không làm tròn</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-4 mt-6">
            <Button onClick={handleSave} disabled={loading}>
              {loading ? 'Đang lưu...' : 'Lưu cấu hình'}
            </Button>
            <Button variant="secondary" onClick={handleReset} disabled={loading}>
              Khôi phục mặc định
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
