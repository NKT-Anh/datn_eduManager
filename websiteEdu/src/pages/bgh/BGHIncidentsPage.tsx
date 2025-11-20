import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api";

interface Incident {
  _id: string;
  title: string;
  description: string;
  type: string;
  severity: string;
  status: string;
  reportedBy: {
    name: string;
    studentCode: string;
  };
  classId?: {
    className: string;
    grade: string;
  };
  resolution?: string;
  createdAt: string;
}

/**
 * ✅ BGH Incidents Page - Xem và xử lý sự cố
 */
export default function BGHIncidentsPage() {
  const { backendUser } = useAuth();
  const { toast } = useToast();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [resolution, setResolution] = useState("");

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

  const handleResolve = async (incidentId: string) => {
    try {
      const token = backendUser?.idToken;
      await axios.put(
        `${API_BASE_URL}/incidents/${incidentId}`,
        {
          status: "resolved",
          resolution: resolution || "Đã xử lý",
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      toast({
        title: "Thành công",
        description: "Đã xử lý sự cố",
      });
      setSelectedIncident(null);
      setResolution("");
      fetchIncidents();
    } catch (error: any) {
      toast({
        title: "Lỗi",
        description: error.response?.data?.error || "Không thể xử lý sự cố",
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

  const getSeverityBadge = (severity: string) => {
    const severityMap: Record<string, { label: string; color: string }> = {
      low: { label: "Thấp", color: "bg-blue-100 text-blue-800" },
      medium: { label: "Trung bình", color: "bg-yellow-100 text-yellow-800" },
      high: { label: "Cao", color: "bg-orange-100 text-orange-800" },
      critical: { label: "Nghiêm trọng", color: "bg-red-100 text-red-800" },
    };
    const severityInfo = severityMap[severity] || severityMap.medium;
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${severityInfo.color}`}>
        {severityInfo.label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Quản lý sự cố</h1>
        <p className="text-muted-foreground">Xem và xử lý các sự cố được báo cáo</p>
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
                      {getSeverityBadge(incident.severity)}
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
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Báo cáo bởi: </span>
                      <span className="font-medium">
                        {incident.reportedBy?.name} ({incident.reportedBy?.studentCode})
                      </span>
                    </div>
                    {incident.classId && (
                      <div>
                        <span className="text-muted-foreground">Lớp: </span>
                        <span className="font-medium">{incident.classId.className}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-muted-foreground">Ngày báo cáo: </span>
                      <span className="font-medium">
                        {new Date(incident.createdAt).toLocaleDateString("vi-VN")}
                      </span>
                    </div>
                  </div>
                  {incident.resolution && (
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm font-medium mb-1">Giải pháp:</p>
                      <p className="text-sm">{incident.resolution}</p>
                    </div>
                  )}
                  {incident.status !== "resolved" && incident.status !== "closed" && (
                    <Button
                      onClick={() => {
                        setSelectedIncident(incident);
                        setResolution(incident.resolution || "");
                      }}
                    >
                      Xử lý sự cố
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Resolve Dialog */}
      {selectedIncident && (
        <Card className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <CardContent className="bg-background p-6 rounded-lg max-w-2xl w-full m-4">
            <h3 className="text-xl font-bold mb-4">Xử lý sự cố</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Giải pháp:</label>
                <textarea
                  className="w-full mt-1 p-2 border rounded"
                  rows={4}
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  placeholder="Nhập giải pháp xử lý..."
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedIncident(null);
                    setResolution("");
                  }}
                >
                  Hủy
                </Button>
                <Button onClick={() => handleResolve(selectedIncident._id)}>
                  Xác nhận xử lý
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}







