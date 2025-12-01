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
import { Textarea } from "@/components/ui/textarea";
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
  conductNote?: string;
  conductStatus?: 'draft' | 'pending' | 'approved' | 'locked';
  gpa?: number;
  rank?: number; // rank lưu trong DB (nếu có)
  computedRank?: number; // rank tính động từ gpa trên frontend
  note?: string;
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
  const [editConductNote, setEditConductNote] = useState<string>("");
  const [editGpa, setEditGpa] = useState<number | undefined>(undefined);
  const [editRank, setEditRank] = useState<number | undefined>(undefined);
  const [editNote, setEditNote] = useState<string>("");
  const [editConductStatus, setEditConductStatus] = useState<string>("");
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
      const records: Conduct[] = res.data || [];

      // ✅ Tự động tính xếp hạng theo GPA trong từng lớp / năm / học kỳ
      const groups = new Map<string, Conduct[]>();
      records.forEach((r) => {
        const className = r.classId?.className || '';
        const key = `${className}|${r.year}|${r.semester}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(r);
      });

      const rankById = new Map<string, number>();
      groups.forEach((group) => {
        const sortable = group
          .filter((r) => typeof r.gpa === 'number' && r.gpa !== null)
          .slice()
          .sort((a, b) => (b.gpa || 0) - (a.gpa || 0));

        sortable.forEach((r, index) => {
          // Xếp hạng 1,2,3... theo GPA (không xử lý đồng hạng để đơn giản)
          rankById.set(r._id, index + 1);
        });
      });

      const withRanks = records.map((r) => ({
        ...r,
        computedRank: rankById.get(r._id) ?? r.rank ?? undefined,
      }));

      setConducts(withRanks);
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

  const handleUpdateConduct = async (mode: 'save' | 'submit' = 'save') => {
    if (!editingConduct || !editConduct) return;
    try {
      const payload: any = { conduct: editConduct };
      const isAdminBGH = isAdminOrBGH(backendUser);

      // ✅ Admin/BGH có thể sửa đầy đủ và đặt trạng thái trực tiếp
      if (isAdminBGH) {
        if (editConductNote !== undefined) payload.conductNote = editConductNote;
        if (editGpa !== undefined) payload.gpa = editGpa;
        if (editRank !== undefined) payload.rank = editRank;
        if (editNote !== undefined) payload.note = editNote;
        if (editConductStatus) payload.conductStatus = editConductStatus;
      } else {
        // ✅ GVCN chỉ có thể sửa conduct và conductNote
        if (editConductNote !== undefined) payload.conductNote = editConductNote;
        // Gửi thêm action để backend biết là lưu nháp hay gửi phê duyệt
        payload.action = mode; // 'save' | 'submit'
      }
      
      await conductApi.updateConduct(editingConduct._id, payload);
      toast({
        title: "Thành công",
        description: "Đã cập nhật hạnh kiểm",
      });
      setEditDialogOpen(false);
      setEditingConduct(null);
      setEditConduct("");
      setEditConductNote("");
      setEditGpa(undefined);
      setEditRank(undefined);
      setEditNote("");
      setEditConductStatus("");
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
                      <div className="text-sm text-muted-foreground mt-1 flex flex-wrap items-center gap-2">
                        <span>
                          {conduct.year} - {conduct.semester} 
                          {conduct.gpa !== undefined && conduct.gpa !== null && ` | Điểm TB: ${conduct.gpa}`}
                          {conduct.computedRank !== undefined && conduct.computedRank !== null && ` | Xếp hạng: ${conduct.computedRank}`}
                        </span>
                        {conduct.conductStatus && (
                          <Badge variant="outline" className="ml-2">
                            {conduct.conductStatus === 'draft' ? 'Bản nháp' : 
                             conduct.conductStatus === 'pending' ? 'Chờ phê duyệt' :
                             conduct.conductStatus === 'approved' ? 'Đã phê duyệt' :
                             conduct.conductStatus === 'locked' ? 'Đã khóa' : conduct.conductStatus}
                          </Badge>
                        )}
                      </div>
                      {conduct.conductNote && (
                        <p className="text-xs text-muted-foreground mt-1 italic">
                          Ghi chú: {conduct.conductNote}
                        </p>
                      )}
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
                            setEditConduct(conduct.conduct || "");
                            setEditConductNote(conduct.conductNote || "");
                            setEditGpa(conduct.gpa);
                            setEditRank(conduct.rank);
                            setEditNote(conduct.note || "");
                            setEditConductStatus(conduct.conductStatus || "draft");
                          }}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Sửa
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Sửa hạnh kiểm</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label>Học sinh: {conduct.studentId?.name} ({conduct.studentId?.studentCode})</Label>
                            {conduct.classId && (
                              <p className="text-sm text-muted-foreground">Lớp: {conduct.classId.className}</p>
                            )}
                          </div>
                          <div>
                            <Label>Hạnh kiểm *</Label>
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
                          <div>
                            <Label>Ghi chú hạnh kiểm</Label>
                            <Textarea 
                              value={editConductNote} 
                              onChange={(e) => setEditConductNote(e.target.value)}
                              placeholder="Nhập ghi chú hạnh kiểm..."
                              rows={3}
                            />
                          </div>
                          {isAdminOrBGH(backendUser) && (
                            <>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label>Điểm TB (GPA)</Label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    max="10"
                                    value={editGpa ?? ""}
                                    onChange={(e) => setEditGpa(e.target.value ? parseFloat(e.target.value) : undefined)}
                                    className="w-full px-3 py-2 border rounded-md"
                                    placeholder="Nhập điểm TB"
                                  />
                                </div>
                                <div>
                                  <Label>Xếp hạng</Label>
                                  <input
                                    type="number"
                                    min="1"
                                    value={editRank ?? ""}
                                    onChange={(e) => setEditRank(e.target.value ? parseInt(e.target.value) : undefined)}
                                    className="w-full px-3 py-2 border rounded-md"
                                    placeholder="Nhập xếp hạng"
                                  />
                                </div>
                              </div>
                              <div>
                                <Label>Nhận xét</Label>
                                <Textarea 
                                  value={editNote} 
                                  onChange={(e) => setEditNote(e.target.value)}
                                  placeholder="Nhập nhận xét..."
                                  rows={3}
                                />
                              </div>
                              <div>
                                <Label>Trạng thái</Label>
                                <Select value={editConductStatus} onValueChange={setEditConductStatus}>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Chọn trạng thái" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="draft">Bản nháp</SelectItem>
                                    <SelectItem value="pending">Chờ phê duyệt</SelectItem>
                                    <SelectItem value="approved">Đã phê duyệt</SelectItem>
                                    <SelectItem value="locked">Đã khóa</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </>
                          )}
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              onClick={() => {
                                setEditDialogOpen(false);
                                setEditingConduct(null);
                                setEditConduct("");
                                setEditConductNote("");
                                setEditGpa(undefined);
                                setEditRank(undefined);
                                setEditNote("");
                                setEditConductStatus("");
                              }}
                            >
                              Hủy
                            </Button>
                            {isAdminOrBGH(backendUser) ? (
                              <Button onClick={() => handleUpdateConduct('save')}>
                                Lưu
                              </Button>
                            ) : (
                              <>
                                <Button
                                  variant="secondary"
                                  onClick={() => handleUpdateConduct('save')}
                                >
                                  Lưu nháp
                                </Button>
                                <Button onClick={() => handleUpdateConduct('submit')}>
                                  Gửi phê duyệt
                                </Button>
                              </>
                            )}
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







