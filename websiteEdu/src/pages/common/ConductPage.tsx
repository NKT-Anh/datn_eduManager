import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { isAdminOrBGH } from "@/utils/permissions";
import axios from "axios";
import { ClipboardList, Edit } from "lucide-react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api";

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
 */
export default function ConductPage() {
  const { backendUser } = useAuth();
  const { toast } = useToast();
  const [conducts, setConducts] = useState<Conduct[]>([]);
  const [loading, setLoading] = useState(true);

  // ✅ Admin và BGH có quyền xem và nhập
  const canView = isAdminOrBGH(backendUser);
  const canEnter = isAdminOrBGH(backendUser);

  useEffect(() => {
    fetchConducts();
  }, []);

  const fetchConducts = async () => {
    try {
      const token = backendUser?.idToken;
      const res = await axios.get(`${API_BASE_URL}/conducts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setConducts(res.data.data || []);
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
                    <Button variant="outline" size="sm">
                      <Edit className="h-4 w-4 mr-2" />
                      Sửa
                    </Button>
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







