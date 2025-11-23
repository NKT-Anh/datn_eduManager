import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { isAdminOrBGH, isGVCN } from "@/utils/permissions";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/utils/permissions";
import conductApi from "@/services/conductApi";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ClipboardList, Edit } from "lucide-react";
import { useSchoolYears } from "@/hooks";
import schoolConfigApi from "@/services/schoolConfigApi";

interface Conduct {
  _id: string;
  studentId: {
    name: string;
    studentCode: string;
  };
  classId: {
    className: string;
    grade: string;
  };
  year: string;
  semester: string;
  conduct: string;
  gpa: number;
  rank: number;
}

/**
 * ✅ Conduct Page - Xem và nhập hạnh kiểm
 * - Admin/BGH: Xem và nhập tất cả
 * - GVCN: Xem và nhập hạnh kiểm lớp chủ nhiệm
 */
export default function ConductPage() {
  const { backendUser } = useAuth();
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  const { currentYearData, currentYear, schoolYears: allSchoolYears } = useSchoolYears();
  const [conducts, setConducts] = useState<Conduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [selectedSemester, setSelectedSemester] = useState<string>("");
  const [semesters, setSemesters] = useState<{ code: string; name: string }[]>([]);
  const [editingConduct, setEditingConduct] = useState<Conduct | null>(null);
  const [editConduct, setEditConduct] = useState<string>("");
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  // ✅ Kiểm tra quyền
  const canView = isAdminOrBGH(backendUser) || isGVCN(backendUser);
  const canEnter = isAdminOrBGH(backendUser) || 
    (isGVCN(backendUser) && hasPermission(PERMISSIONS.CONDUCT_ENTER));

  // ✅ Set năm học mặc địnhd
  useEffect(() => {
    const defaultYear = currentYearData?.code || currentYear || (allSchoolYears.length > 0 ? allSchoolYears[allSchoolYears.length - 1].code : '');
    if (defaultYear && !selectedYear) {
      setSelectedYear(defaultYear);
    }
  }, [currentYearData, currentYear, allSchoolYears, selectedYear]);

  // ✅ Lấy danh sách học kỳ
  useEffect(() => {
    const fetchSemesters = async () => {
      try {
        const semestersRes = await schoolConfigApi.getSemesters();
        setSemesters(semestersRes.data);
        if (semestersRes.data.length > 0 && !selectedSemester) {
          setSelectedSemester(semestersRes.data[0].code);
        }
      } catch (err) {
        console.error("Load semesters failed", err);
      }
    };
    fetchSemesters();
  }, [selectedSemester]);

  useEffect(() => {
    if (selectedYear) {
      fetchConducts();
    }
  }, [selectedYear, selectedSemester]);

  const fetchConducts = async () => {
    if (!selectedYear) return;
    try {
      setLoading(true);
      const params: any = { year: selectedYear };
      if (selectedSemester) {
        params.semester = selectedSemester === '1' ? 'HK1' : selectedSemester === '2' ? 'HK2' : selectedSemester;
      }
      const res = await conductApi.getConducts(params);
      setConducts(res.data || []);
    } catch (error: any) {
      toast({
        title: "Lỗi",
        description: error.response?.data?.error || "Không thể tải danh sách hạnh kiểm",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateConduct = async () => {
    if (!editingConduct || !editConduct) return;
    try {
      await conductApi.updateConduct(editingConduct._id, { conduct: editConduct });
      toast({
        title: "Thành công",
        description: "Đã cập nhật hạnh kiểm",
      });
      setEditDialogOpen(false);
      setEditingConduct(null);
      setEditConduct("");
      fetchConducts();
    } catch (error: any) {
      toast({
        title: "Lỗi",
        description: error.response?.data?.error || "Không thể cập nhật hạnh kiểm",
        variant: "destructive",
      });
    }
  };

  const getConductBadge = (conduct: string) => {
    const conductMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      "Tốt": { label: "Tốt", variant: "default" },
      "Khá": { label: "Khá", variant: "secondary" },
      "Trung bình": { label: "Trung bình", variant: "outline" },
      "Yếu": { label: "Yếu", variant: "destructive" },
    };
    const conductInfo = conductMap[conduct] || conductMap["Tốt"];
    return <Badge variant={conductInfo.variant}>{conductInfo.label}</Badge>;
  };

  if (!canView) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">Bạn không có quyền truy cập trang này.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Quản lý hạnh kiểm</h1>
          <p className="text-muted-foreground">
            {canEnter ? "Xem và nhập hạnh kiểm học sinh" : "Xem hạnh kiểm học sinh"}
          </p>
        </div>
      </div>

      {/* ✅ Bộ lọc năm học và học kỳ */}
      <Card>
        <CardContent className="p-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Năm học</Label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn năm học" />
                </SelectTrigger>
                <SelectContent>
                  {allSchoolYears.map(y => (
                    <SelectItem key={y.code} value={y.code}>
                      {y.name} {currentYearData?.code === y.code && "(Hiện tại)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Học kỳ</Label>
              <Select value={selectedSemester} onValueChange={setSelectedSemester}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn học kỳ" />
                </SelectTrigger>
                <SelectContent>
                  {semesters.map(s => (
                    <SelectItem key={s.code} value={s.code}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="text-center py-8">Đang tải...</div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Tổng số: {conducts.length} bản ghi</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {conducts.map((conduct) => (
                <div
                  key={conduct._id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center space-x-4 flex-1">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <ClipboardList className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h3 className="font-semibold">{conduct.studentId?.name}</h3>
                        <Badge variant="outline">{conduct.studentId?.studentCode}</Badge>
                        {conduct.classId && (
                          <Badge variant="secondary">{conduct.classId.className}</Badge>
                        )}
                        {getConductBadge(conduct.conduct)}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {conduct.year} - {conduct.semester} | Điểm TB: {conduct.gpa} | Xếp hạng: {conduct.rank}
                      </p>
                    </div>
                  </div>
                  {canEnter && (
                    <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                      <DialogTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setEditingConduct(conduct);
                            setEditConduct(conduct.conduct);
                          }}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Sửa
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Sửa hạnh kiểm</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label>Học sinh: {conduct.studentId?.name}</Label>
                          </div>
                          <div>
                            <Label>Hạnh kiểm</Label>
                            <Select value={editConduct} onValueChange={setEditConduct}>
                              <SelectTrigger>
                                <SelectValue placeholder="Chọn hạnh kiểm" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Tốt">Tốt</SelectItem>
                                <SelectItem value="Khá">Khá</SelectItem>
                                <SelectItem value="Trung bình">Trung bình</SelectItem>
                                <SelectItem value="Yếu">Yếu</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                              Hủy
                            </Button>
                            <Button onClick={handleUpdateConduct}>
                              Lưu
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}







