import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useSchoolYears, useClasses } from "@/hooks";
import { studentApi } from "@/services/studentApi";
import { GraduationCap, TrendingUp, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface PromotionStats {
  total: number;
  promoted: number;
  retained: number;
  graduated: number;
  noRecord: number;
  errors?: Array<{ studentId: string; studentName: string; error: string }>;
}

export default function StudentPromotionPage() {
  const { backendUser } = useAuth();
  const { toast } = useToast();
  const { schoolYears, currentYear, currentYearData } = useSchoolYears();
  const { classes } = useClasses();

  const [currentYearValue, setCurrentYearValue] = useState<string>("");
  const [newYearValue, setNewYearValue] = useState<string>("");
  const [selectedGrade, setSelectedGrade] = useState<string>("Tất cả");
  const [selectedClassId, setSelectedClassId] = useState<string>("Tất cả");
  const [minGPA, setMinGPA] = useState<number>(5.0);
  const [minAcademicLevel, setMinAcademicLevel] = useState<string>("Yếu");
  const [minConduct, setMinConduct] = useState<string>("Yếu");
  const [autoAssignClass, setAutoAssignClass] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [stats, setStats] = useState<PromotionStats | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [loadingPreview, setLoadingPreview] = useState<boolean>(false);

  // ✅ Lọc lớp theo khối đã chọn
  const filteredClasses = React.useMemo(() => {
    if (selectedGrade === "Tất cả") return classes;
    return classes.filter((c: any) => c.grade === selectedGrade && c.year === currentYearValue);
  }, [classes, selectedGrade, currentYearValue]);

  // ✅ Tự động set năm học hiện tại
  useEffect(() => {
    if (currentYear && !currentYearValue) {
      setCurrentYearValue(currentYear);
    }
    // Tự động tính năm học mới (tăng 1 năm)
    if (currentYearValue && !newYearValue) {
      const [start, end] = currentYearValue.split("-");
      const newStart = String(parseInt(start) + 1);
      const newEnd = String(parseInt(end) + 1);
      setNewYearValue(`${newStart}-${newEnd}`);
    }
  }, [currentYear, currentYearValue, newYearValue]);

  // ✅ Xem trước danh sách học sinh sẽ được xét
  const handlePreview = async () => {
    if (!currentYearValue) {
      toast({
        title: "Lỗi",
        description: "Vui lòng chọn năm học hiện tại",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoadingPreview(true);
      // TODO: Tạo API endpoint để xem trước danh sách học sinh sẽ được xét
      // Tạm thời chỉ hiển thị thông báo
      toast({
        title: "Thông tin",
        description: "Tính năng xem trước đang được phát triển",
      });
    } catch (error: any) {
      toast({
        title: "Lỗi",
        description: error?.response?.data?.message || "Không thể xem trước danh sách",
        variant: "destructive",
      });
    } finally {
      setLoadingPreview(false);
    }
  };

  // ✅ Thực hiện xét lên lớp
  const handlePromote = async () => {
    if (!currentYearValue || !newYearValue) {
      toast({
        title: "Lỗi",
        description: "Vui lòng chọn đầy đủ năm học hiện tại và năm học mới",
        variant: "destructive",
      });
      return;
    }

    if (minGPA < 0 || minGPA > 10) {
      toast({
        title: "Lỗi",
        description: "Điểm TB tối thiểu phải từ 0 đến 10",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      const response = await studentApi.promoteStudents({
        currentYear: currentYearValue,
        newYear: newYearValue,
        grade: selectedGrade !== "Tất cả" ? selectedGrade : null,
        classId: selectedClassId !== "Tất cả" ? selectedClassId : null,
        minGPA,
        minAcademicLevel,
        minConduct,
        autoAssignClass,
      });

      setStats(response.stats || response);
      toast({
        title: "Thành công",
        description: response.message || "Đã xét lên lớp thành công",
      });
    } catch (error: any) {
      console.error("Lỗi xét lên lớp:", error);
      toast({
        title: "Lỗi",
        description: error?.response?.data?.message || "Không thể thực hiện xét lên lớp",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const academicLevelOptions = [
    { value: "Yếu", label: "Yếu (không được Yếu)" },
    { value: "Trung bình", label: "Trung bình trở lên" },
    { value: "Khá", label: "Khá trở lên" },
    { value: "Giỏi", label: "Giỏi" },
  ];

  const conductOptions = [
    { value: "Yếu", label: "Yếu (không được Yếu)" },
    { value: "Trung bình", label: "Trung bình trở lên" },
    { value: "Khá", label: "Khá trở lên" },
    { value: "Tốt", label: "Tốt" },
  ];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Xét học sinh lên lớp</h1>
        <p className="text-muted-foreground mt-2">
          Xét tất cả học sinh lên lớp dựa trên học lực và hạnh kiểm
        </p>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Lưu ý:</strong> Thao tác này sẽ cập nhật năm học và khối lớp cho tất cả học sinh.
          Vui lòng kiểm tra kỹ các điều kiện trước khi thực hiện.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cấu hình xét lên lớp */}
        <Card>
          <CardHeader>
            <CardTitle>📋 Cấu hình xét lên lớp</CardTitle>
            <CardDescription>
              Thiết lập các điều kiện để xét học sinh lên lớp
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentYear">Năm học hiện tại</Label>
              <Select value={currentYearValue} onValueChange={setCurrentYearValue}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn năm học hiện tại" />
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

            <div className="space-y-2">
              <Label htmlFor="newYear">Năm học mới</Label>
              <Select value={newYearValue} onValueChange={setNewYearValue}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn năm học mới" />
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

            <div className="space-y-2">
              <Label htmlFor="grade">Khối cần xét</Label>
              <Select value={selectedGrade} onValueChange={(value) => {
                setSelectedGrade(value);
                setSelectedClassId("Tất cả"); // Reset lớp khi đổi khối
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Tất cả">Tất cả khối</SelectItem>
                  <SelectItem value="10">Khối 10</SelectItem>
                  <SelectItem value="11">Khối 11</SelectItem>
                  <SelectItem value="12">Khối 12</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Chọn khối cụ thể để xét, hoặc "Tất cả" để xét tất cả học sinh
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="class">Lớp cần xét</Label>
              <Select 
                value={selectedClassId} 
                onValueChange={setSelectedClassId}
                disabled={selectedGrade === "Tất cả"}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Tất cả">Tất cả lớp</SelectItem>
                  {filteredClasses.map((cls: any) => (
                    <SelectItem key={cls._id} value={cls._id}>
                      {cls.className} ({cls.classCode || ""})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Chọn lớp cụ thể để xét, hoặc "Tất cả" để xét tất cả lớp trong khối
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="minGPA">Điểm TB tối thiểu</Label>
              <Input
                id="minGPA"
                type="number"
                min="0"
                max="10"
                step="0.1"
                value={minGPA}
                onChange={(e) => setMinGPA(parseFloat(e.target.value) || 0)}
              />
              <p className="text-sm text-muted-foreground">
                Học sinh phải có điểm TB cả năm ≥ {minGPA} để lên lớp
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="minAcademicLevel">Học lực tối thiểu</Label>
              <Select value={minAcademicLevel} onValueChange={setMinAcademicLevel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {academicLevelOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Học sinh phải có học lực từ {minAcademicLevel} trở lên
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="minConduct">Hạnh kiểm tối thiểu</Label>
              <Select value={minConduct} onValueChange={setMinConduct}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {conductOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Học sinh phải có hạnh kiểm từ {minConduct} trở lên
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="autoAssignClass"
                checked={autoAssignClass}
                onChange={(e) => setAutoAssignClass(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="autoAssignClass" className="cursor-pointer">
                Tự động phân lớp cho học sinh lên lớp
              </Label>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                onClick={handlePreview}
                variant="outline"
                disabled={loadingPreview || !currentYearValue}
              >
                {loadingPreview ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <TrendingUp className="h-4 w-4 mr-2" />
                )}
                Xem trước
              </Button>
              <Button
                onClick={handlePromote}
                disabled={loading || !currentYearValue || !newYearValue}
                className="flex-1"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <GraduationCap className="h-4 w-4 mr-2" />
                )}
                Thực hiện xét lên lớp
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Kết quả */}
        <Card>
          <CardHeader>
            <CardTitle>📊 Kết quả xét lên lớp</CardTitle>
            <CardDescription>
              Thống kê kết quả sau khi thực hiện xét lên lớp
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stats ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <div className="text-sm text-muted-foreground">Tổng số học sinh</div>
                    <div className="text-2xl font-bold">{stats.total}</div>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg">
                    <div className="text-sm text-muted-foreground">Lên lớp</div>
                    <div className="text-2xl font-bold text-green-600">{stats.promoted}</div>
                  </div>
                  <div className="p-4 bg-yellow-50 rounded-lg">
                    <div className="text-sm text-muted-foreground">Ở lại lớp</div>
                    <div className="text-2xl font-bold text-yellow-600">{stats.retained}</div>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <div className="text-sm text-muted-foreground">Tốt nghiệp</div>
                    <div className="text-2xl font-bold text-purple-600">{stats.graduated}</div>
                  </div>
                </div>

                {stats.noRecord > 0 && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Có {stats.noRecord} học sinh không có bảng điểm cả năm
                    </AlertDescription>
                  </Alert>
                )}

                {stats.errors && stats.errors.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2">Lỗi xử lý:</h4>
                    <div className="space-y-1">
                      {stats.errors.map((error, index) => (
                        <div key={index} className="text-sm text-red-600">
                          {error.studentName}: {error.error}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Chưa có kết quả. Vui lòng thực hiện xét lên lớp để xem thống kê.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Điều kiện xét lên lớp */}
      <Card>
        <CardHeader>
          <CardTitle>📝 Điều kiện xét lên lớp</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="text-sm">
              <strong>Học sinh được lên lớp khi đáp ứng TẤT CẢ các điều kiện sau:</strong>
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
              <li>Điểm TB cả năm (GPA) ≥ {minGPA}</li>
              <li>Học lực từ "{minAcademicLevel}" trở lên</li>
              <li>Hạnh kiểm từ "{minConduct}" trở lên</li>
            </ul>
            <p className="text-sm mt-4">
              <strong>Lưu ý:</strong>
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
              <li>Học sinh lớp 12 đạt điều kiện sẽ được xét tốt nghiệp</li>
              <li>Học sinh không đạt điều kiện sẽ ở lại lớp hiện tại</li>
              <li>Học sinh lên lớp sẽ được tăng khối (10→11, 11→12)</li>
              {autoAssignClass && (
                <li>Học sinh lên lớp sẽ được tự động phân vào lớp mới</li>
              )}
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

