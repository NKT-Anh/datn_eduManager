import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Loader2, CheckCircle, XCircle, Clock, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { proposalApi, TeachingAssignmentProposal } from "@/services/proposalApi";
import { useSchoolYears } from "@/hooks/schoolYear/useSchoolYears";

export default function ProposalHistoryPage() {
  const { toast } = useToast();
  const { schoolYears, currentYear } = useSchoolYears();
  const [proposals, setProposals] = useState<TeachingAssignmentProposal[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterYear, setFilterYear] = useState<string>("");
  const [filterSemester, setFilterSemester] = useState<"1" | "2" | "all">("all");
  const [filterStatus, setFilterStatus] = useState<string>("applied");

  useEffect(() => {
    if (currentYear && !filterYear) {
      setFilterYear(currentYear);
    }
  }, [currentYear, filterYear]);

  useEffect(() => {
    const loadProposals = async () => {
      if (!filterYear) return;
      
      setLoading(true);
      try {
        const allProposals = await proposalApi.getAll({
          year: filterYear,
          semester: filterSemester !== "all" ? filterSemester : undefined,
        });
        
        // Chỉ lấy các đề xuất đã áp dụng hoặc theo filterStatus
        let filtered = allProposals;
        if (filterStatus === "applied") {
          filtered = allProposals.filter(p => p.status === "applied");
        } else if (filterStatus !== "all") {
          filtered = allProposals.filter(p => p.status === filterStatus);
        }
        
        setProposals(filtered);
      } catch (error: any) {
        console.error("Lỗi khi tải lịch sử đề xuất:", error);
        toast({
          title: "Lỗi",
          description: error.response?.data?.message || "Không thể tải lịch sử đề xuất",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadProposals();
  }, [filterYear, filterSemester, filterStatus, toast]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Lịch sử đề xuất phân công</h1>
        <p className="text-muted-foreground">
          Xem lịch sử tất cả các đề xuất phân công đã được xử lý
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Danh sách đề xuất</CardTitle>
              <CardDescription>
                Tổng số: {proposals.length} đề xuất
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Select value={filterYear} onValueChange={setFilterYear}>
                <SelectTrigger className="w-[200px]">
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
              <Select value={filterSemester} onValueChange={(v) => setFilterSemester(v as "1" | "2" | "all")}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả học kỳ</SelectItem>
                  <SelectItem value="1">Học kỳ 1</SelectItem>
                  <SelectItem value="2">Học kỳ 2</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="applied">Đã áp dụng</SelectItem>
                  <SelectItem value="all">Tất cả</SelectItem>
                  <SelectItem value="pending">Chờ duyệt</SelectItem>
                  <SelectItem value="approved">Đã duyệt</SelectItem>
                  <SelectItem value="rejected">Bị từ chối</SelectItem>
                  <SelectItem value="cancelled">Đã hủy</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : proposals.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Không có đề xuất nào
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Giáo viên</TableHead>
                  <TableHead>Môn học</TableHead>
                  <TableHead>Lớp</TableHead>
                  <TableHead>Năm học</TableHead>
                  <TableHead>Học kỳ</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Người đề xuất</TableHead>
                  <TableHead>Tổ bộ môn</TableHead>
                  <TableHead>Ngày tạo</TableHead>
                  <TableHead>Ngày áp dụng</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {proposals.map((proposal) => (
                  <TableRow key={proposal._id}>
                    <TableCell>
                      {proposal.teacherId?.name}
                      {proposal.teacherId?.teacherCode && (
                        <span className="text-xs text-muted-foreground block">
                          {proposal.teacherId.teacherCode}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{proposal.subjectId?.name}</TableCell>
                    <TableCell>
                      {proposal.classId?.className}
                      {proposal.classId?.grade && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          Khối {proposal.classId.grade}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{proposal.year}</TableCell>
                    <TableCell>Học kỳ {proposal.semester}</TableCell>
                    <TableCell>
                      {proposal.status === "pending" && (
                        <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
                          <Clock className="h-3 w-3 mr-1" />Chờ duyệt
                        </Badge>
                      )}
                      {proposal.status === "approved" && (
                        <Badge variant="outline" className="bg-green-50 text-green-700">
                          <CheckCircle className="h-3 w-3 mr-1" />Đã duyệt
                        </Badge>
                      )}
                      {proposal.status === "rejected" && (
                        <Badge variant="outline" className="bg-red-50 text-red-700">
                          <XCircle className="h-3 w-3 mr-1" />Bị từ chối
                        </Badge>
                      )}
                      {proposal.status === "applied" && (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700">
                          <CheckCircle className="h-3 w-3 mr-1" />Đã áp dụng
                        </Badge>
                      )}
                      {proposal.status === "cancelled" && (
                        <Badge variant="outline" className="bg-gray-50 text-gray-700">
                          <XCircle className="h-3 w-3 mr-1" />Đã hủy
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {proposal.proposedBy?.name}
                      {proposal.proposedBy?.teacherCode && (
                        <span className="text-xs text-muted-foreground block">
                          {proposal.proposedBy.teacherCode}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{proposal.departmentId?.name}</TableCell>
                    <TableCell>
                      {proposal.createdAt
                        ? new Date(proposal.createdAt).toLocaleDateString("vi-VN")
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {proposal.appliedAt
                        ? new Date(proposal.appliedAt).toLocaleDateString("vi-VN")
                        : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

