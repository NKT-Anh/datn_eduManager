import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ActivityDetailDialog } from "@/components/dialogs/ActivityDetailDialog";
import { ActivityForm } from "@/components/forms/ActivityForm";
import { DeleteConfirmDialog } from "@/components/dialogs/DeleteConfirmDialog";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { activityApi } from "@/services/activityApi";
import { Activity } from "@/types/class";
import { Search, Plus, Edit, Trash2, Eye, ClipboardList } from "lucide-react";

const ActivitiesPage = () => {
  const { backendUser } = useAuth();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState("");
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);

  const [selectedActivityId, setSelectedActivityId] = useState<string | undefined>();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailActivityId, setDetailActivityId] = useState<string | undefined>();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingActivity, setDeletingActivity] = useState<Activity | undefined>();

  // 🔹 Fetch all activities
  const fetchActivities = async () => {
    setLoading(true);
    try {
      const data = await activityApi.getAll();
      setActivities(data);
    } catch (error) {
      toast({
        title: "Lỗi tải hoạt động",
        description: "Không thể tải danh sách hoạt động",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, []);

  // 🔹 Filter by name or code
  const filteredActivities = activities.filter(
    (a) =>
      a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 🔹 CRUD Handlers
  const handleCreateActivity = async (data: any) => {
    try {
      const newActivity = await activityApi.create(data);
      setActivities([...activities, newActivity]);
      toast({ title: "Thành công", description: "Đã thêm hoạt động mới" });
    } catch {
      toast({
        title: "Lỗi",
        description: "Không thể tạo hoạt động",
        variant: "destructive",
      });
    }
  };

  const handleEditActivity = async (data: any) => {
    if (!selectedActivityId) return;
    try {
      const updated = await activityApi.update(selectedActivityId, data);
      setActivities(
        activities.map((a) =>
          a._id === selectedActivityId ? updated : a
        )
      );
      setSelectedActivityId(undefined);
      toast({ title: "Cập nhật thành công" });
    } catch {
      toast({
        title: "Lỗi",
        description: "Không thể cập nhật hoạt động",
        variant: "destructive",
      });
    }
  };

  const handleDeleteActivity = async () => {
    if (!deletingActivity) return;
    try {
      await activityApi.delete(deletingActivity._id);
      setActivities(activities.filter((a) => a._id !== deletingActivity._id));
      toast({
        title: "Đã xóa",
        description: `Hoạt động ${deletingActivity.name} đã bị xóa.`,
      });
    } catch {
      toast({
        title: "Lỗi",
        description: "Không thể xóa hoạt động",
        variant: "destructive",
      });
    } finally {
      setDeletingActivity(undefined);
      setIsDeleteDialogOpen(false);
    }
  };

  // 🔹 Dialog handlers
  const openEditForm = (activity: Activity) => {
    setSelectedActivityId(activity._id);
    setIsFormOpen(true);
  };

  const openDeleteDialog = (activity: Activity) => {
    setDeletingActivity(activity);
    setIsDeleteDialogOpen(true);
  };

  // 🔹 Role restriction
  if (backendUser?.role !== "admin") {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground">
            Không có quyền truy cập
          </h2>
          <p className="text-muted-foreground mt-2">
            Bạn không có quyền truy cập trang này.
          </p>
        </div>
      </div>
    );
  }

  // 🔹 Render
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Quản lý hoạt động</h1>
          <p className="text-muted-foreground">
            Quản lý danh sách các hoạt động trong trường
          </p>
        </div>
        <Button
          className="bg-gradient-primary hover:bg-primary-hover"
          onClick={() => {
            setSelectedActivityId(undefined);
            setIsFormOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Thêm hoạt động
        </Button>
      </div>

      {/* Search */}
      <Card className="shadow-card border-border">
        <CardContent className="p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm kiếm hoạt động theo tên hoặc mã..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Activity Grid */}
      {loading ? (
        <p>Đang tải...</p>
      ) : filteredActivities.length === 0 ? (
        <Card className="shadow-card border-border">
          <CardContent className="p-12 text-center">
            <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              Không tìm thấy hoạt động
            </h3>
            <p className="text-muted-foreground">
              Hãy thử thay đổi từ khóa tìm kiếm.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredActivities.map((activity) => (
            <Card
              key={activity._id}
              className="shadow-card border-border hover:shadow-soft transition-shadow"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-3 bg-gradient-primary rounded-lg">
                      <ClipboardList className="h-6 w-6 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-lg leading-tight">
                        {activity.name}
                      </CardTitle>
                      <div className="flex items-center space-x-1 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {activity.code}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex space-x-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setDetailActivityId(activity._id);
                        setIsDetailOpen(true);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditForm(activity)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => openDeleteDialog(activity)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {activity.description || "Không có mô tả."}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    setDetailActivityId(activity._id);
                    setIsDetailOpen(true);
                  }}
                >
                  Chi tiết
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Summary */}
      <Card className="shadow-card border-border">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">{activities.length}</p>
              <p className="text-sm text-muted-foreground">Tổng hoạt động</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-success">5</p>
              <p className="text-sm text-muted-foreground">Đang diễn ra</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-warning">2</p>
              <p className="text-sm text-muted-foreground">Sắp diễn ra</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">3</p>
              <p className="text-sm text-muted-foreground">Đã kết thúc</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Form & Dialogs */}
      <ActivityForm
        open={isFormOpen}
        onOpenChange={(open) => {
          setIsFormOpen(open);
          if (!open) setSelectedActivityId(undefined);
        }}
        activityId={selectedActivityId}
        onSubmit={selectedActivityId ? handleEditActivity : handleCreateActivity}
      />

      <ActivityDetailDialog
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        activityId={detailActivityId}
      />

      <DeleteConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        title="Xác nhận xóa hoạt động"
        description={`Bạn có chắc chắn muốn xóa hoạt động ${deletingActivity?.name}? Hành động này không thể hoàn tác.`}
        onConfirm={handleDeleteActivity}
      />
    </div>
  );
};

export default ActivitiesPage;
