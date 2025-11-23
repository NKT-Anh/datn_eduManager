import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDepartmentManagement } from "@/hooks/departments/useDepartmentManagement";
import { useAuth } from "@/contexts/AuthContext";
import { useSchoolYears } from "@/hooks/schoolYear/useSchoolYears";
import { useSubjects } from "@/hooks/subjects/useSubjects";
import { useClasses } from "@/hooks/classes/useClasses";
import { useAssignments } from "@/hooks";
import { departmentManagementApi } from "@/services/departmentManagementApi";
import { teacherApi } from "@/services/teacherApi";
import { 
  Plus, 
  X,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Send,
  BookOpen,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

export default function ProposalsPage() {
  const { backendUser } = useAuth();
  const { toast } = useToast();
  const { proposals, teachers: deptTeachers, loading, fetchProposals, fetchTeachers, createProposal, cancelProposal, cancelAllProposals } = useDepartmentManagement();
  const { schoolYears, currentYear } = useSchoolYears();
  const { subjects } = useSubjects();
  const { classes } = useClasses();
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [selectedSemester, setSelectedSemester] = useState<"1" | "2">("1");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isBatchCreateDialogOpen, setIsBatchCreateDialogOpen] = useState(false);
  const [selectedClasses, setSelectedClasses] = useState<Record<string, string[]>>({}); // { "teacherId_subjectId": [classIds] }
  const [classPeriodsMap, setClassPeriodsMap] = useState<Record<string, number>>({}); // { "subjectId_classId": periods }
  const [teacherLoadMap, setTeacherLoadMap] = useState<Record<string, { current: number; effective: number; remaining: number }>>({});
  const [loadingPeriods, setLoadingPeriods] = useState(false);
  const [showProposalTable, setShowProposalTable] = useState(false); // Hiển thị bảng đề xuất trên page
  const [batchFormData, setBatchFormData] = useState({
    notes: "",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // ✅ Lấy assignments để kiểm tra giáo viên đã được phân công
  const { assignments } = useAssignments(selectedYear ? { year: selectedYear } : undefined);

  // Lấy năm học hiện tại từ SchoolYear có isActive: true
  useEffect(() => {
    if (currentYear && !selectedYear) {
      setSelectedYear(currentYear);
    }
  }, [currentYear, selectedYear]);

  useEffect(() => {
    if (selectedYear) {
      fetchProposals({ 
        year: selectedYear, 
        semester: selectedSemester,
        status: statusFilter !== "all" ? statusFilter : undefined
      });
      fetchTeachers({ year: selectedYear, semester: selectedSemester });
      // Reset về trang 1 khi filter thay đổi
      setCurrentPage(1);
    }
  }, [selectedYear, selectedSemester, statusFilter, fetchProposals, fetchTeachers]);

  // Load teacher load status
  useEffect(() => {
    const loadTeacherStatus = async () => {
      if (!selectedYear) {
        setTeacherLoadMap({});
        return;
      }
      try {
        const response = await teacherApi.checkStatus({
          year: selectedYear,
          semester: selectedSemester,
        });
        const map: Record<string, { current: number; effective: number; remaining: number }> = {};
        response.teacherAnalysis?.forEach((item: any) => {
          const id = item.teacherId?._id?.toString?.() || item.teacherId?.toString?.() || item.teacherId;
          if (!id) return;
          const current = item.currentWeeklyLessons || 0;
          const effective = item.effectiveWeeklyLessons || item.weeklyLessons || 17;
          const remaining = item.remainingWeeklyLessons ?? Math.max(0, effective - current);
          map[id] = { current, effective, remaining };
        });
        setTeacherLoadMap(map);
      } catch (error) {
        console.error("Lỗi khi lấy tình trạng giáo viên:", error);
      }
    };
    loadTeacherStatus();
  }, [selectedYear, selectedSemester]);

  // Load class periods when subject or classes change
  const loadClassPeriods = async (subjectId: string, classIds: string[]) => {
    if (!selectedYear || !subjectId || classIds.length === 0) {
      return;
    }
    try {
      setLoadingPeriods(true);
      const response = await departmentManagementApi.getClassPeriods({
        year: selectedYear,
        semester: selectedSemester,
        subjectId,
        classIds,
      });
      // Lưu với key là "subjectId_classId"
      const newPeriods: Record<string, number> = {};
      Object.entries(response.periods || {}).forEach(([classId, periods]) => {
        newPeriods[`${subjectId}_${classId}`] = periods as number;
      });
      setClassPeriodsMap(prev => ({ ...prev, ...newPeriods }));
    } catch (error) {
      console.error("Lỗi khi lấy số tiết:", error);
    } finally {
      setLoadingPeriods(false);
    }
  };

  // Lấy giáo viên và môn học trong tổ
  const departmentTeachers = deptTeachers?.teachers || [];
  
  // Lấy môn học từ giáo viên trong tổ (thay vì lọc theo departmentId)
  const departmentSubjects = useMemo(() => {
    const subjectIds = new Set<string>();
    departmentTeachers.forEach(teacher => {
      teacher.subjects?.forEach(sub => {
        const subjectId = typeof sub.subjectId === "object" && sub.subjectId !== null
          ? sub.subjectId._id
          : sub.subjectId;
        if (subjectId) subjectIds.add(String(subjectId));
      });
    });
    
    // Lấy thông tin đầy đủ của các môn học từ subjects
    const result = subjects.filter(sub => {
      const subId = String(sub._id);
      return subjectIds.has(subId);
    });
    
    // Debug log
    console.log("📚 Department Subjects:", {
      totalSubjects: subjects.length,
      subjectIdsFromTeachers: Array.from(subjectIds),
      departmentSubjectsCount: result.length,
      departmentSubjects: result.map(s => ({ id: s._id, name: s.name }))
    });
    
    return result;
  }, [departmentTeachers, subjects]);

  // Load periods for all classes when dialog opens
  useEffect(() => {
    if (isBatchCreateDialogOpen && selectedYear && departmentTeachers.length > 0) {
      const allClassIds = classes
        .filter(cls => cls.year === selectedYear)
        .map(cls => cls._id);
      
      if (allClassIds.length > 0) {
        // Load periods for each subject
        const subjectIds = new Set<string>();
        departmentTeachers.forEach(teacher => {
          teacher.subjects?.forEach(sub => {
            const subjectId = typeof sub.subjectId === "object" && sub.subjectId !== null
              ? sub.subjectId._id
              : sub.subjectId;
            if (subjectId) subjectIds.add(String(subjectId));
          });
        });

        subjectIds.forEach(subjectId => {
          loadClassPeriods(subjectId, allClassIds);
        });
      }
    }
  }, [isBatchCreateDialogOpen, selectedYear, selectedSemester, departmentTeachers.length, classes.length]);


  const handleCancelProposal = async (id: string) => {
    if (!confirm("Bạn có chắc chắn muốn hủy đề xuất này?")) {
      return;
    }

    try {
      await cancelProposal(id);
    } catch (error) {
      // Error handled in hook
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700"><Clock className="h-3 w-3 mr-1" />Chờ duyệt</Badge>;
      case "approved":
        return <Badge variant="outline" className="bg-blue-50 text-blue-700"><CheckCircle className="h-3 w-3 mr-1" />Đã duyệt</Badge>;
      case "rejected":
        return <Badge variant="outline" className="bg-red-50 text-red-700"><XCircle className="h-3 w-3 mr-1" />Bị từ chối</Badge>;
      case "applied":
        return <Badge variant="outline" className="bg-green-50 text-green-700"><CheckCircle className="h-3 w-3 mr-1" />Đã áp dụng</Badge>;
      case "cancelled":
        return <Badge variant="outline" className="bg-gray-50 text-gray-700"><X className="h-3 w-3 mr-1" />Đã hủy</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (!backendUser?.teacherFlags?.isDepartmentHead) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Bạn không có quyền truy cập trang này</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Đề xuất Phân công</h1>
          <p className="text-muted-foreground">
            Tạo và quản lý đề xuất phân công giảng dạy cho tổ bộ môn
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Chọn năm học" />
            </SelectTrigger>
            <SelectContent>
              {schoolYears
                .filter((year) => year.code && year.code.trim() !== "")
                .map((year) => (
                  <SelectItem key={year._id} value={year.code || ""}>
                    {year.name} {year.isActive && "(Hiện tại)"}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Select value={selectedSemester} onValueChange={(v) => setSelectedSemester(v as "1" | "2")}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Học kỳ 1</SelectItem>
              <SelectItem value="2">Học kỳ 2</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả</SelectItem>
              <SelectItem value="pending">Chờ duyệt</SelectItem>
              <SelectItem value="approved">Đã duyệt</SelectItem>
              <SelectItem value="rejected">Bị từ chối</SelectItem>
              <SelectItem value="applied">Đã áp dụng</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => setIsBatchCreateDialogOpen(true)} variant="default">
            <Plus className="h-4 w-4 mr-2" />
            Tạo bảng đề xuất
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Danh sách đề xuất ({proposals?.proposals.length || 0})</CardTitle>
                <CardDescription>
                  Các đề xuất phân công giảng dạy của tổ bộ môn
                </CardDescription>
              </div>
              {proposals?.proposals && proposals.proposals.length > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={async () => {
                    if (!proposals?.proposals || proposals.proposals.length === 0) return;
                    if (!confirm(`Bạn có chắc chắn muốn hủy toàn bộ ${proposals.proposals.length} đề xuất đang chờ duyệt và đã duyệt?`)) {
                      return;
                    }
                    try {
                      await cancelAllProposals({
                        year: selectedYear,
                        semester: selectedSemester,
                      });
                    } catch (error) {
                      // Error handled in hook
                    }
                  }}
                >
                  <X className="h-4 w-4 mr-2" />
                  Hủy toàn bộ đề xuất
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!proposals?.proposals || proposals.proposals.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Chưa có đề xuất nào
              </div>
            ) : (
              <>
                {/* Pagination Controls */}
                <div className="flex items-center justify-between mb-4 pb-4 border-b">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm text-muted-foreground">Hiển thị:</Label>
                    <Select 
                      value={pageSize.toString()} 
                      onValueChange={(v) => {
                        setPageSize(Number(v));
                        setCurrentPage(1); // Reset về trang 1 khi đổi pageSize
                      }}
                    >
                      <SelectTrigger className="w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="20">20</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-sm text-muted-foreground">
                      / {proposals?.proposals?.length || 0} đề xuất
                    </span>
                  </div>
                  
                  {(() => {
                    if (!proposals?.proposals || proposals.proposals.length === 0) {
                      return null;
                    }
                    const totalPages = Math.ceil(proposals.proposals.length / pageSize);
                    const startIndex = (currentPage - 1) * pageSize;
                    const endIndex = Math.min(startIndex + pageSize, proposals.proposals.length);
                    
                    return (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          {startIndex + 1}-{endIndex} / {proposals.proposals.length}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          Trang {currentPage} / {totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })()}
                </div>

                {/* Table */}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Giáo viên</TableHead>
                      <TableHead>Môn học</TableHead>
                      <TableHead>Lớp</TableHead>
                      <TableHead>Năm học</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead>Ghi chú</TableHead>
                      <TableHead className="text-right">Thao tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(() => {
                      if (!proposals?.proposals || proposals.proposals.length === 0) {
                        return null;
                      }
                      const startIndex = (currentPage - 1) * pageSize;
                      const endIndex = startIndex + pageSize;
                      const paginatedProposals = proposals.proposals.slice(startIndex, endIndex);
                      
                      return paginatedProposals.map((proposal) => (
                        <TableRow key={proposal._id}>
                          <TableCell className="font-medium">
                            {proposal.teacherId.name}
                            {proposal.teacherId.teacherCode && ` (${proposal.teacherId.teacherCode})`}
                          </TableCell>
                          <TableCell>{proposal.subjectId.name}</TableCell>
                          <TableCell>
                            {proposal.classId.className}
                            <Badge variant="outline" className="ml-2">
                              {proposal.classId.grade}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {proposal.year} - HK{proposal.semester}
                          </TableCell>
                          <TableCell>{getStatusBadge(proposal.status)}</TableCell>
                          <TableCell className="max-w-xs truncate">
                            {proposal.notes || "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            {["pending", "approved"].includes(proposal.status) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleCancelProposal(proposal._id)}
                              >
                                <X className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ));
                    })()}
                  </TableBody>
                </Table>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Bảng đề xuất phân công (hiển thị trên page) */}
      {showProposalTable && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Bảng đề xuất phân công</CardTitle>
                <CardDescription>
                  Năm học: {selectedYear} | Học kỳ: {selectedSemester === "1" ? "Học kỳ 1" : "Học kỳ 2"}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowProposalTable(false);
                    setSelectedClasses({});
                    setClassPeriodsMap({});
                  }}
                >
                  <X className="h-4 w-4 mr-2" />
                  Hủy bảng
                </Button>
                <Button
                  onClick={async () => {
                    if (!selectedYear) {
                      toast({
                        title: "Lỗi",
                        description: "Vui lòng chọn năm học",
                        variant: "destructive",
                      });
                      return;
                    }

                    const proposalsToCreate: Array<{ teacherId: string; subjectId: string; classIds: string[] }> = [];
                    
                    Object.entries(selectedClasses).forEach(([key, classIds]) => {
                      if (classIds.length > 0) {
                        const [teacherId, subjectId] = key.split('_');
                        proposalsToCreate.push({ teacherId, subjectId, classIds });
                      }
                    });

                    if (proposalsToCreate.length === 0) {
                      toast({
                        title: "Lỗi",
                        description: "Vui lòng chọn ít nhất một lớp",
                        variant: "destructive",
                      });
                      return;
                    }

                    try {
                      console.log("📤 Gửi đề xuất:", {
                        proposals: proposalsToCreate,
                        year: selectedYear,
                        semester: selectedSemester,
                        count: proposalsToCreate.length
                      });

                      const result = await departmentManagementApi.createBatchProposals({
                        proposals: proposalsToCreate,
                        year: selectedYear,
                        semester: selectedSemester,
                        notes: batchFormData.notes,
                      });

                      console.log("✅ Kết quả:", result);

                      // Kiểm tra nếu có lỗi
                      if (result.results && result.results.failed && result.results.failed.length > 0) {
                        const failedCount = result.results.failed.length;
                        const successCount = result.results.created || 0;
                        toast({
                          title: "Có lỗi xảy ra",
                          description: `Đã tạo ${successCount} đề xuất, ${failedCount} đề xuất thất bại. Vui lòng kiểm tra lại.`,
                          variant: "destructive",
                        });
                      } else {
                        toast({
                          title: "Thành công",
                          description: result.message || `Đã tạo ${result.results?.created || 0} đề xuất`,
                        });
                      }

                      setShowProposalTable(false);
                      setSelectedClasses({});
                      setClassPeriodsMap({});
                      setBatchFormData({ notes: "" });
                      
                      // Refresh proposals
                      await fetchProposals({ 
                        year: selectedYear, 
                        semester: selectedSemester,
                        status: statusFilter !== "all" ? statusFilter : undefined
                      });
                    } catch (error: any) {
                      console.error("❌ Lỗi khi gửi đề xuất:", error);
                      toast({
                        title: "Lỗi",
                        description: error.response?.data?.message || error.message || "Không thể tạo đề xuất",
                        variant: "destructive",
                      });
                    }
                  }}
                  disabled={Object.values(selectedClasses).flat().length === 0 || !selectedYear}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Gửi đề xuất ({Object.values(selectedClasses).flat().length} lớp)
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* 3 Bảng theo khối */}
            <div className="space-y-8">
              {(["10", "11", "12"] as const).map((grade) => {
                // Lọc classes theo khối và năm học (không dùng useMemo trong map)
                const gradeClasses = selectedYear
                  ? classes
                      .filter(c => c.grade === grade && c.year === selectedYear)
                      .sort((a, b) => a.className.localeCompare(b.className))
                  : [];

                // Lọc subjects theo khối và chỉ môn học trong tổ bộ môn
                const gradeSubjects = departmentSubjects
                  .filter(s => s.grades.includes(grade as any))
                  .sort((a, b) => a.name.localeCompare(b.name));

                if (gradeClasses.length === 0) return null;

                return (
                  <div key={grade} className="space-y-3">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-bold text-primary">Khối {grade}</h3>
                      <Badge variant="secondary" className="text-xs">
                        {gradeClasses.length} lớp
                      </Badge>
                    </div>
                    <div className="rounded-lg border shadow-sm overflow-hidden bg-card">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="border-0">
                              <TableHead className="bg-gradient-to-b from-primary/20 to-primary/30 dark:from-primary/30 dark:to-primary/40 min-w-[70px] text-center font-bold text-primary shadow-sm">
                                <div className="py-1">STT</div>
                              </TableHead>
                              <TableHead className="bg-gradient-to-b from-primary/20 to-primary/30 dark:from-primary/30 dark:to-primary/40 min-w-[180px] font-bold text-primary shadow-sm">
                                <div className="py-1">Môn học</div>
                              </TableHead>
                              <TableHead className="bg-gradient-to-b from-primary/20 to-primary/30 dark:from-primary/30 dark:to-primary/40 min-w-[200px] font-bold text-primary shadow-sm">
                                <div className="py-1">Giáo viên (Số tiết còn lại)</div>
                              </TableHead>
                              {gradeClasses.map(cls => (
                                <TableHead 
                                  key={cls._id} 
                                  className="min-w-[160px] font-bold text-center bg-gradient-to-b from-primary/20 to-primary/30 dark:from-primary/30 dark:to-primary/40 text-primary dark:text-primary shadow-sm"
                                >
                                  <div className="py-1">
                                    {cls.className}
                                  </div>
                                </TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {gradeSubjects.length > 0 ? (
                              gradeSubjects.map((subject, index) => {
                                // Tìm giáo viên có thể dạy môn này và khối này
                                // Lọc giáo viên: giáo viên chỉ dạy khối 10, 11 thì không hiển thị trong khối 12
                                const availableTeachersForSubject = departmentTeachers.filter(teacher => {
                                  return teacher.subjects?.some(sub => {
                                    const subId = typeof sub.subjectId === "object" && sub.subjectId !== null
                                      ? sub.subjectId._id
                                      : sub.subjectId;
                                    if (subId !== subject._id) return false;
                                    
                                    // Kiểm tra giáo viên có dạy khối này không
                                    const teachesThisGrade = sub.grades?.includes(grade as any);
                                    if (!teachesThisGrade) return false;
                                    
                                    // Nếu đang ở khối 12, kiểm tra giáo viên có dạy khối 12 không
                                    // Nếu giáo viên chỉ dạy khối 10, 11 thì không hiển thị trong khối 12
                                    if (grade === "12") {
                                      const allGrades = sub.grades || [];
                                      // Nếu giáo viên chỉ có khối 10 và 11, không hiển thị
                                      if (allGrades.includes("10") && allGrades.includes("11") && !allGrades.includes("12")) {
                                        return false;
                                      }
                                    }
                                    
                                    return true;
                                  });
                                });

                                // Tính số tiết còn lại cho từng giáo viên
                                // Bao gồm cả số tiết từ assignments, proposals đã có (pending, approved) và từ selectedClasses
                                const teachersWithRemainingForSubject = availableTeachersForSubject.map(teacher => {
                                  const teacherLoad = teacherLoadMap[teacher._id] || { current: 0, effective: 17, remaining: 17 };
                                  
                                  // Tính tổng số tiết từ selectedClasses (bao gồm cả existing proposals đã load vào bảng)
                                  const totalSelectedPeriods = Object.entries(selectedClasses)
                                    .filter(([key]) => key.startsWith(`${teacher._id}_`))
                                    .reduce((sum, [key, classIds]) => {
                                      const subId = key.split('_')[1];
                                      return sum + classIds.reduce((classSum, classId) => {
                                        const pKey = `${subId}_${classId}`;
                                        return classSum + (classPeriodsMap[pKey] || 0);
                                      }, 0);
                                    }, 0);
                                  
                                  // ✅ Tính số tiết từ assignments đã có cho môn này (tất cả các lớp trong khối này)
                                  let totalAssignmentPeriods = 0;
                                  assignments
                                    .filter((a: any) => {
                                      const aSubjectId = typeof a.subjectId === "object" && a.subjectId !== null
                                        ? a.subjectId._id
                                        : a.subjectId;
                                      const aTeacherId = typeof a.teacherId === "object" && a.teacherId !== null
                                        ? a.teacherId._id
                                        : a.teacherId;
                                      const aClassId = typeof a.classId === "object" && a.classId !== null
                                        ? a.classId._id
                                        : a.classId;
                                      // Chỉ tính assignments trong khối này
                                      const assignmentClass = classes.find(c => String(c._id) === String(aClassId));
                                      return (
                                        String(aSubjectId) === String(subject._id) &&
                                        String(aTeacherId) === String(teacher._id) &&
                                        assignmentClass?.grade === grade &&
                                        a.year === selectedYear &&
                                        a.semester === selectedSemester
                                      );
                                    })
                                    .forEach((assignment: any) => {
                                      const aSubjectId = typeof assignment.subjectId === "object" && assignment.subjectId !== null
                                        ? assignment.subjectId._id
                                        : assignment.subjectId;
                                      const aClassId = typeof assignment.classId === "object" && assignment.classId !== null
                                        ? assignment.classId._id
                                        : assignment.classId;
                                      const aKey = `${aSubjectId}_${aClassId}`;
                                      const assignmentPeriods = classPeriodsMap[aKey] || 0;
                                      totalAssignmentPeriods += assignmentPeriods;
                                    });
                                  
                                  // Tính số tiết từ các proposals đã có (pending, approved) nhưng chưa có trong selectedClasses
                                  // (trường hợp proposals đã có nhưng chưa được load vào bảng)
                                  let totalExistingProposalPeriods = 0;
                                  if (proposals?.proposals) {
                                    proposals.proposals
                                      .filter((p: any) => {
                                        const pTeacherId = typeof p.teacherId === "object" && p.teacherId !== null
                                          ? p.teacherId._id
                                          : p.teacherId;
                                        const pSubjectId = typeof p.subjectId === "object" && p.subjectId !== null
                                          ? p.subjectId._id
                                          : p.subjectId;
                                        const pClassId = typeof p.classId === "object" && p.classId !== null
                                          ? p.classId._id
                                          : p.classId;
                                        
                                        // Kiểm tra proposal này đã có trong selectedClasses chưa
                                        const key = `${pTeacherId}_${pSubjectId}`;
                                        const isInSelectedClasses = selectedClasses[key]?.includes(pClassId);
                                        
                                        // Kiểm tra xem đã có assignment cho lớp này chưa (nếu có thì không tính proposal)
                                        const proposalClass = classes.find(c => String(c._id) === String(pClassId));
                                        const hasAssignment = assignments.some((a: any) => {
                                          const aSubjectId = typeof a.subjectId === "object" && a.subjectId !== null
                                            ? a.subjectId._id
                                            : a.subjectId;
                                          const aClassId = typeof a.classId === "object" && a.classId !== null
                                            ? a.classId._id
                                            : a.classId;
                                          return (
                                            String(aSubjectId) === String(pSubjectId) &&
                                            String(aClassId) === String(pClassId) &&
                                            a.year === selectedYear &&
                                            a.semester === selectedSemester
                                          );
                                        });
                                        
                                        return String(pTeacherId) === String(teacher._id) &&
                                               (p.status === "pending" || p.status === "approved") &&
                                               p.year === selectedYear &&
                                               p.semester === selectedSemester &&
                                               proposalClass?.grade === grade && // Chỉ tính proposals trong khối này
                                               !isInSelectedClasses && // Chỉ tính các proposal chưa có trong selectedClasses
                                               !hasAssignment; // Không tính proposal nếu đã có assignment
                                      })
                                      .forEach((proposal: any) => {
                                        const pSubjectId = typeof proposal.subjectId === "object" && proposal.subjectId !== null
                                          ? proposal.subjectId._id
                                          : proposal.subjectId;
                                        const pClassId = typeof proposal.classId === "object" && proposal.classId !== null
                                          ? proposal.classId._id
                                          : proposal.classId;
                                        const pKey = `${pSubjectId}_${pClassId}`;
                                        const periods = classPeriodsMap[pKey] || 0;
                                        totalExistingProposalPeriods += periods;
                                      });
                                  }
                                  
                                  // Số tiết còn lại = remaining ban đầu - (số tiết đã chọn trong bảng + số tiết từ assignments + số tiết từ proposals đã có nhưng chưa load vào bảng)
                                  const remaining = teacherLoad.remaining - totalSelectedPeriods - totalAssignmentPeriods - totalExistingProposalPeriods;
                                  
                                  return {
                                    ...teacher,
                                    remaining: Math.max(0, remaining),
                                  };
                                });

                                return (
                                  <TableRow 
                                    key={subject._id}
                                    className="hover:bg-muted/30 transition-colors border-0"
                                  >
                                    <TableCell className="bg-primary/10 dark:bg-primary/20 text-center font-semibold text-primary">
                                      <span className="text-base">{index + 1}</span>
                                    </TableCell>
                                    <TableCell className="bg-primary/10 dark:bg-primary/20">
                                      <span className="font-semibold text-sm">{subject.name}</span>
                                    </TableCell>
                                    <TableCell className="bg-primary/10 dark:bg-primary/20">
                                      <div className="flex flex-col gap-1">
                                        {teachersWithRemainingForSubject.map(teacher => (
                                          <div key={teacher._id} className="text-xs">
                                            <span className="font-medium">{teacher.name}</span>
                                            <span className="text-muted-foreground ml-1">
                                              ({teacher.remaining} tiết)
                                            </span>
                                          </div>
                                        ))}
                                        {teachersWithRemainingForSubject.length === 0 && (
                                          <span className="text-xs text-muted-foreground">Không có giáo viên</span>
                                        )}
                                      </div>
                                    </TableCell>
                                    {gradeClasses.map(cls => {
                                      // Sử dụng danh sách giáo viên đã được tính toán ở trên
                                      const availableTeachers = availableTeachersForSubject;
                                      
                                      // Tìm giáo viên đã được chọn cho môn này và lớp này (từ selectedClasses)
                                      const selectedTeacherKey = Object.keys(selectedClasses).find(key => {
                                        const [teacherId, subjectId] = key.split('_');
                                        return subjectId === subject._id && selectedClasses[key].includes(cls._id);
                                      });
                                      const selectedTeacherId = selectedTeacherKey ? selectedTeacherKey.split('_')[0] : "";

                                      // ✅ Kiểm tra xem lớp này đã có giáo viên được phân công chưa (từ assignments)
                                      const existingAssignment = assignments.find((a: any) => {
                                        const aSubjectId = typeof a.subjectId === "object" && a.subjectId !== null
                                          ? a.subjectId._id
                                          : a.subjectId;
                                        const aClassId = typeof a.classId === "object" && a.classId !== null
                                          ? a.classId._id
                                          : a.classId;
                                        return (
                                          String(aSubjectId) === String(subject._id) &&
                                          String(aClassId) === String(cls._id) &&
                                          a.year === selectedYear &&
                                          a.semester === selectedSemester
                                        );
                                      });

                                      const periodKey = `${subject._id}_${cls._id}`;
                                      const periods = classPeriodsMap[periodKey] || 0;

                                      // Tính số tiết còn lại của từng giáo viên
                                      // Bao gồm cả số tiết từ assignments, proposals đã có (pending, approved) và từ selectedClasses
                                      const teachersWithRemaining = availableTeachers.map(teacher => {
                                        const teacherLoad = teacherLoadMap[teacher._id] || { current: 0, effective: 17, remaining: 17 };
                                        
                                        // Tính tổng số tiết từ selectedClasses (bao gồm cả existing proposals đã load)
                                        const totalSelectedPeriods = Object.entries(selectedClasses)
                                          .filter(([key]) => key.startsWith(`${teacher._id}_`))
                                          .reduce((sum, [key, classIds]) => {
                                            const subId = key.split('_')[1];
                                            return sum + classIds.reduce((classSum, classId) => {
                                              const pKey = `${subId}_${classId}`;
                                              return classSum + (classPeriodsMap[pKey] || 0);
                                            }, 0);
                                          }, 0);
                                        
                                        // ✅ Tính số tiết từ assignment đã có cho lớp này (nếu giáo viên này đã được phân công)
                                        let assignmentPeriods = 0;
                                        if (existingAssignment) {
                                          const assignmentTeacherId = typeof existingAssignment.teacherId === "object" && existingAssignment.teacherId !== null
                                            ? existingAssignment.teacherId._id
                                            : existingAssignment.teacherId;
                                          if (String(assignmentTeacherId) === String(teacher._id)) {
                                            // Giáo viên này đã được phân công cho lớp này, trừ số tiết
                                            assignmentPeriods = periods;
                                          }
                                        }
                                        
                                        // Tính số tiết từ các proposals đã có (pending, approved) nhưng chưa có trong selectedClasses
                                        let totalExistingProposalPeriods = 0;
                                        if (proposals?.proposals) {
                                          proposals.proposals
                                            .filter((p: any) => {
                                              const pTeacherId = typeof p.teacherId === "object" && p.teacherId !== null
                                                ? p.teacherId._id
                                                : p.teacherId;
                                              const pSubjectId = typeof p.subjectId === "object" && p.subjectId !== null
                                                ? p.subjectId._id
                                                : p.subjectId;
                                              const pClassId = typeof p.classId === "object" && p.classId !== null
                                                ? p.classId._id
                                                : p.classId;
                                              
                                              // Kiểm tra proposal này đã có trong selectedClasses chưa
                                              const key = `${pTeacherId}_${pSubjectId}`;
                                              const isInSelectedClasses = selectedClasses[key]?.includes(pClassId);
                                              
                                              // Không tính proposal cho lớp này nếu đã có assignment
                                              const isThisClass = String(pClassId) === String(cls._id) && String(pSubjectId) === String(subject._id);
                                              
                                              return String(pTeacherId) === String(teacher._id) &&
                                                     (p.status === "pending" || p.status === "approved") &&
                                                     p.year === selectedYear &&
                                                     p.semester === selectedSemester &&
                                                     !isInSelectedClasses && // Chỉ tính các proposal chưa có trong selectedClasses
                                                     !isThisClass; // Không tính proposal cho lớp này (đã tính qua assignmentPeriods)
                                            })
                                            .forEach((proposal: any) => {
                                              const pSubjectId = typeof proposal.subjectId === "object" && proposal.subjectId !== null
                                                ? proposal.subjectId._id
                                                : proposal.subjectId;
                                              const pClassId = typeof proposal.classId === "object" && proposal.classId !== null
                                                ? proposal.classId._id
                                                : proposal.classId;
                                              const pKey = `${pSubjectId}_${pClassId}`;
                                              const proposalPeriods = classPeriodsMap[pKey] || 0;
                                              totalExistingProposalPeriods += proposalPeriods;
                                            });
                                        }
                                        
                                        // Số tiết còn lại = remaining ban đầu - (số tiết đã chọn + số tiết từ assignments + số tiết từ proposals đã có nhưng chưa load vào bảng)
                                        const remaining = teacherLoad.remaining - totalSelectedPeriods - assignmentPeriods - totalExistingProposalPeriods;
                                        
                                        return {
                                          ...teacher,
                                          remaining: Math.max(0, remaining),
                                          canAssign: remaining >= periods
                                        };
                                      });

                                      return (
                                        <TableCell 
                                          key={cls._id}
                                          className="bg-primary/5 transition-colors"
                                        >
                                          <div className="flex flex-col items-center gap-2">
                                            {availableTeachers.length > 0 ? (
                                              <Select
                                                value={selectedTeacherId || "none"}
                                                onValueChange={(teacherId) => {
                                                  const newSelected = { ...selectedClasses };
                                                  
                                                  // Xóa lựa chọn cũ cho lớp này (nếu có)
                                                  Object.keys(newSelected).forEach(k => {
                                                    if (k.split('_')[1] === subject._id) {
                                                      newSelected[k] = newSelected[k].filter(id => id !== cls._id);
                                                      if (newSelected[k].length === 0) {
                                                        delete newSelected[k];
                                                      }
                                                    }
                                                  });
                                                  
                                                  // Nếu chọn "Bỏ trống" (teacherId === "none"), chỉ xóa lựa chọn cũ
                                                  if (teacherId && teacherId !== "none") {
                                                    const key = `${teacherId}_${subject._id}`;
                                                    
                                                    // Thêm lựa chọn mới
                                                    if (newSelected[key]) {
                                                      if (!newSelected[key].includes(cls._id)) {
                                                        newSelected[key] = [...newSelected[key], cls._id];
                                                      }
                                                    } else {
                                                      newSelected[key] = [cls._id];
                                                    }
                                                    
                                                    // Load periods if not loaded
                                                    if (!classPeriodsMap[periodKey] && subject._id) {
                                                      loadClassPeriods(subject._id, [cls._id]);
                                                    }
                                                  }
                                                  
                                                  setSelectedClasses(newSelected);
                                                }}
                                              >
                                                <SelectTrigger className="w-full h-9">
                                                  <SelectValue placeholder="Chọn giáo viên">
                                                    {selectedTeacherId ? (
                                                      departmentTeachers.find(t => t._id === selectedTeacherId)?.name || "N/A"
                                                    ) : (
                                                      <span className="text-muted-foreground">Chọn giáo viên</span>
                                                    )}
                                                  </SelectValue>
                                                </SelectTrigger>
                                                <SelectContent>
                                                  <SelectItem value="none">
                                                    <span className="text-muted-foreground italic">Bỏ trống</span>
                                                  </SelectItem>
                                                  {teachersWithRemaining.map(teacher => (
                                                    <SelectItem 
                                                      key={teacher._id} 
                                                      value={teacher._id}
                                                      disabled={!teacher.canAssign}
                                                    >
                                                      <div className="flex items-center justify-between w-full">
                                                        <span>
                                                          {teacher.name} {teacher.teacherCode && `(${teacher.teacherCode})`}
                                                        </span>
                                                        <span className={`text-xs ml-2 ${teacher.remaining < periods ? "text-red-600" : "text-muted-foreground"}`}>
                                                          {teacher.remaining} tiết
                                                        </span>
                                                      </div>
                                                    </SelectItem>
                                                  ))}
                                                </SelectContent>
                                              </Select>
                                            ) : (
                                              <span className="text-muted-foreground text-sm">Không có giáo viên</span>
                                            )}
                                            {periods > 0 && (
                                              <Badge variant="secondary" className="text-xs">
                                                {periods} tiết
                                              </Badge>
                                            )}
                                            {selectedTeacherId && (
                                              <div className="text-xs text-muted-foreground">
                                                {(() => {
                                                  const teacher = teachersWithRemaining.find(t => t._id === selectedTeacherId);
                                                  return teacher ? `Còn: ${teacher.remaining} tiết` : "";
                                                })()}
                                              </div>
                                            )}
                                          </div>
                                        </TableCell>
                                      );
                                    })}
                                  </TableRow>
                                );
                              })
                            ) : (
                              <TableRow>
                                <TableCell colSpan={gradeClasses.length + 2} className="text-center text-muted-foreground py-8">
                                  Không có môn học nào trong tổ bộ môn cho khối {grade}
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Batch Create Proposal Dialog - Chỉ chọn năm học và học kỳ */}
      <Dialog open={isBatchCreateDialogOpen} onOpenChange={setIsBatchCreateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Tạo đề xuất phân công</DialogTitle>
            <DialogDescription>
              Chọn năm học và học kỳ. Hệ thống sẽ tự động lấy tất cả giáo viên, môn học và lớp để tạo bảng đề xuất.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Select năm học và học kỳ */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Năm học *</Label>
                <Select 
                  value={selectedYear} 
                  onValueChange={(v) => {
                    setSelectedYear(v);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn năm học" />
                  </SelectTrigger>
                  <SelectContent>
                    {schoolYears
                      .filter((year) => year.code && year.code.trim() !== "")
                      .map((year) => (
                        <SelectItem key={year._id} value={year.code || ""}>
                          {year.name} {year.isActive && "(Hiện tại)"}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Học kỳ *</Label>
                <Select 
                  value={selectedSemester} 
                  onValueChange={(v) => {
                    setSelectedSemester(v as "1" | "2");
                  }}
                >
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

          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBatchCreateDialogOpen(false)}>
              Hủy
            </Button>
            <Button 
              onClick={async () => {
                if (!selectedYear) {
                  toast({
                    title: "Lỗi",
                    description: "Vui lòng chọn năm học",
                    variant: "destructive",
                  });
                  return;
                }

                // Đóng dialog
                setIsBatchCreateDialogOpen(false);

                // Load các đề xuất đã có (pending, approved) cho năm học và học kỳ này
                try {
                  // Fetch proposals và lấy giá trị trả về
                  const existingProposals = await fetchProposals({ 
                    year: selectedYear, 
                    semester: selectedSemester,
                    status: undefined // Lấy tất cả trạng thái
                  });

                  // Chuyển đổi các đề xuất đã có thành format selectedClasses
                  const existingSelectedClasses: Record<string, string[]> = {};
                  if (existingProposals?.proposals) {
                    existingProposals.proposals
                      .filter((p: any) => p.status === "pending" || p.status === "approved")
                      .forEach((proposal: any) => {
                        const teacherId = typeof proposal.teacherId === "object" && proposal.teacherId !== null
                          ? proposal.teacherId._id
                          : proposal.teacherId;
                        const subjectId = typeof proposal.subjectId === "object" && proposal.subjectId !== null
                          ? proposal.subjectId._id
                          : proposal.subjectId;
                        const classId = typeof proposal.classId === "object" && proposal.classId !== null
                          ? proposal.classId._id
                          : proposal.classId;
                        
                        if (teacherId && subjectId && classId) {
                          const key = `${teacherId}_${subjectId}`;
                          if (!existingSelectedClasses[key]) {
                            existingSelectedClasses[key] = [];
                          }
                          if (!existingSelectedClasses[key].includes(classId)) {
                            existingSelectedClasses[key].push(classId);
                          }
                        }
                      });
                  }

                  // Merge với selectedClasses hiện tại (giữ lại các lựa chọn mới)
                  setSelectedClasses(prev => {
                    const merged = { ...existingSelectedClasses };
                    // Thêm các lựa chọn mới vào merged
                    Object.entries(prev).forEach(([key, classIds]) => {
                      if (merged[key]) {
                        // Merge classIds, loại bỏ trùng lặp
                        merged[key] = [...new Set([...merged[key], ...classIds])];
                      } else {
                        merged[key] = classIds;
                      }
                    });
                    return merged;
                  });

                  // Tự động load class periods cho tất cả môn học và lớp
                  const allClassIds = classes
                    .filter(cls => cls.year === selectedYear)
                    .map(cls => cls._id);

                  // Lấy tất cả môn học từ giáo viên trong tổ
                  const subjectIds = new Set<string>();
                  departmentTeachers.forEach(teacher => {
                    teacher.subjects?.forEach(sub => {
                      const subjectId = typeof sub.subjectId === "object" && sub.subjectId !== null
                        ? sub.subjectId._id
                        : sub.subjectId;
                      if (subjectId) subjectIds.add(String(subjectId));
                    });
                  });

                  // Load periods cho tất cả môn học và lớp
                  setLoadingPeriods(true);
                  try {
                    const loadPromises = Array.from(subjectIds).map(subjectId => 
                      loadClassPeriods(subjectId, allClassIds)
                    );
                    await Promise.all(loadPromises);
                  } catch (error) {
                    console.error("Lỗi khi load class periods:", error);
                  } finally {
                    setLoadingPeriods(false);
                  }

                  // Hiển thị bảng đề xuất
                  setShowProposalTable(true);
                } catch (error) {
                  console.error("Lỗi khi load đề xuất đã có:", error);
                  toast({
                    title: "Cảnh báo",
                    description: "Không thể load đề xuất đã có, sẽ tạo bảng trống",
                    variant: "default",
                  });
                  
                  // Vẫn hiển thị bảng nhưng không có đề xuất cũ
                  setShowProposalTable(true);
                }
              }}
              disabled={!selectedYear}
            >
              <Plus className="h-4 w-4 mr-2" />
              Tạo bảng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

