import { useParams,useNavigate } from "react-router-dom";
import { useEffect,useRef,useState } from "react";

import { Card,CardContent,CardHeader,CardTitle,CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Edit,
  Phone,
  Mail,
  Calendar,
  MapPin,
  User,
  BookOpen,
  TrendingUp,
  Users,
  CheckCircle,
} from "lucide-react";
import { getStudent } from "@/services/studentApi"; // <-- import API
import { Student  } from "@/types/student";




const StudentDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const fetchStudent = async () => {
      try {
        const data = await getStudent(id);
        setStudent(data);
      } catch (err) {
        console.error("Error fetching student:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStudent();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Đang tải thông tin học sinh...</p>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground">
            Không tìm thấy học sinh
          </h2>
          <p className="text-muted-foreground mt-2">
            Học sinh này không tồn tại trong hệ thống.
          </p>
          <Button className="mt-4" onClick={() => navigate("/admin/students")}>
            Quay lại danh sách
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={() => navigate("/admin/students")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Quay lại
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {student.name}
            </h1>
            <p className="text-muted-foreground">Chi tiết thông tin học sinh</p>
          </div>
        </div>
        <Button>
          <Edit className="h-4 w-4 mr-2" />
          Chỉnh sửa
        </Button>
      </div>

      {/* Student Info */}
      <Card className="shadow-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center">
            <User className="h-5 w-5 mr-2" />
            Thông tin cá nhân
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Họ và tên
              </label>
              <p className="text-foreground">{student.name}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Mã học sinh
              </label>
              <p className="text-foreground">
                {student.studentCode || "Chưa có"}
              </p>
            </div>
            {student.accountId?.email && (
              <div className="flex items-center space-x-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <p>{student.accountId.email}</p>
              </div>
            )}
            {student.phone && (
              <div className="flex items-center space-x-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <p>{student.phone}</p>
              </div>
            )}
            {student.dob && (
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <p>
                  {new Date(student.dob).toLocaleDateString("vi-VN", {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                  })}
                </p>
              </div>
            )}
            {student.address && (
              <div className="flex items-center space-x-2 md:col-span-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <p>{student.address}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Parents Info */}
      {student.parents && student.parents.length > 0 && (
        <Card className="shadow-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="h-5 w-5 mr-2" />
              Thông tin phụ huynh
            </CardTitle>
          </CardHeader>
          <CardContent>
            {student.parents.map((p) => (
              <div key={p._id} className="mb-3">
                <p className="font-medium">{p.name}</p>
                <p className="text-sm text-muted-foreground">
                  {p.relation || "Phụ huynh"} - {p.phone || "Chưa có SĐT"}
                </p>
                {p.occupation && (
                  <p className="text-sm text-muted-foreground">
                    Nghề nghiệp: {p.occupation}
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default StudentDetail;
