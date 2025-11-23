import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/utils/permissions";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import { AlertCircle, Plus } from "lucide-react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api";

interface Incident {
  _id: string;
  title: string;
  description: string;
  type: string;
  severity: string;
  status: string;
  resolution?: string;
  createdAt: string;
}

/**
 * ✅ Student Incidents Page - Gửi báo cáo sự cố
 */
export default function StudentIncidentsPage() {
  const { backendUser } = useAuth();
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    type: "other",
    severity: "medium",
  });

  if (!hasPermission(PERMISSIONS.INCIDENT_REPORT)) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground">Không có quyền truy cập</h2>
        </div>
      </div>
    );
  }

  useEffect(() => {
    fetchIncidents();
  }, []);

  const fetchIncidents = async () => {
    try {
      const token = backendUser?.idToken;
      const res = await axios.get(`${API_BASE_URL}/incidents`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setIncidents(res.data.data || []);
    } catch (error: any) {
      toast({
        title: "Lỗi",
        description: error.response?.data?.error || "Không thể tải danh sách sự cố",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = backendUser?.idToken;
      await axios.post(
        `${API_BASE_URL}/incidents`,
        formData,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      toast({
        title: "Thành công",
        description: "Đã gửi báo cáo sự cố",
      });
      setIsFormOpen(false);
      setFormData({ title: "", description: "", type: "other", severity: "medium" });
      fetchIncidents();
    } catch (error: any) {
      toast({
        title: "Lỗi",
        description: error.response?.data?.error || "Không thể gửi báo cáo",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      reported: { label: "Đã báo cáo", variant: "outline" },
      investigating: { label: "Đang điều tra", variant: "secondary" },
      resolved: { label: "Đã xử lý", variant: "default" },
      closed: { label: "Đã đóng", variant: "default" },
    };
    const statusInfo = statusMap[status] || statusMap.reported;
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Báo cáo sự cố</h1>
          <p className="text-muted-foreground">Gửi báo cáo về các sự cố trong trường học</p>
        </div>
        <Button onClick={() => setIsFormOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Gửi báo cáo
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8">Đang tải...</div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {incidents.map((incident) => (
            <Card key={incident._id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="flex items-center space-x-2">
                      <AlertCircle className="h-5 w-5 text-primary" />
                      <span>{incident.title}</span>
                    </CardTitle>
                    <div className="flex items-center space-x-2 mt-2">
                      {getStatusBadge(incident.status)}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Mô tả:</p>
                    <p className="mt-1">{incident.description}</p>
                  </div>
                  {incident.resolution && (
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm font-medium mb-1">Giải pháp:</p>
                      <p className="text-sm">{incident.resolution}</p>
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Ngày báo cáo: {new Date(incident.createdAt).toLocaleDateString("vi-VN")}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Form Dialog */}
      {isFormOpen && (
        <Card className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <CardContent className="bg-background p-6 rounded-lg max-w-2xl w-full m-4">
            <h3 className="text-xl font-bold mb-4">Gửi báo cáo sự cố</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium">Tiêu đề:</label>
                <input
                  type="text"
                  className="w-full mt-1 p-2 border rounded"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium">Mô tả:</label>
                <textarea
                  className="w-full mt-1 p-2 border rounded"
                  rows={4}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsFormOpen(false);
                    setFormData({ title: "", description: "", type: "other", severity: "medium" });
                  }}
                >
                  Hủy
                </Button>
                <Button type="submit">Gửi báo cáo</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

















