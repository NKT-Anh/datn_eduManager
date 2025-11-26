import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import backupApi, { Backup } from "@/services/backupApi";
import {
  Upload,
  Download,
  Trash2,
  RefreshCw,
  Database,
  HardDrive,
  Cloud,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";

export default function BackupManagementPage() {
  const { toast } = useToast();
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Dialog states
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadDescription, setUploadDescription] = useState("");

  // Load backups
  const loadBackups = async () => {
    try {
      setLoading(true);
      const data = await backupApi.getBackups();
      setBackups(data);
    } catch (error: any) {
      console.error("Lỗi khi tải danh sách backup:", error);
      toast({
        title: "Lỗi",
        description: error.response?.data?.message || "Không thể tải danh sách backup",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBackups();
  }, []);

  // Upload backup file
  const handleUpload = async () => {
    if (!selectedFile) {
      toast({
        title: "Lỗi",
        description: "Vui lòng chọn file backup",
        variant: "destructive",
      });
      return;
    }

    try {
      setUploading(true);
      const backup = await backupApi.uploadBackupFile(selectedFile, uploadDescription);
      toast({
        title: "Thành công",
        description: `Đã upload backup: ${backup.filename}`,
      });
      setUploadDialogOpen(false);
      setSelectedFile(null);
      setUploadDescription("");
      loadBackups();
    } catch (error: any) {
      console.error("Lỗi khi upload backup:", error);
      toast({
        title: "Lỗi",
        description: error.response?.data?.message || "Không thể upload backup",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  // Download backup
  const handleDownload = async (backup: Backup) => {
    try {
      const blob = await backupApi.downloadBackup(backup._id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = backup.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Thành công",
        description: `Đã tải xuống: ${backup.filename}`,
      });
    } catch (error: any) {
      console.error("Lỗi khi download backup:", error);
      toast({
        title: "Lỗi",
        description: error.response?.data?.message || "Không thể tải xuống backup",
        variant: "destructive",
      });
    }
  };

  // Restore backup
  const handleRestore = async (backupId: string) => {
    try {
      setRestoring(backupId);
      await backupApi.restoreUploadedBackup(backupId, true);
      toast({
        title: "Thành công",
        description: "Đã restore backup thành công",
      });
      setRestoreDialogOpen(null);
      loadBackups();
    } catch (error: any) {
      console.error("Lỗi khi restore backup:", error);
      toast({
        title: "Lỗi",
        description: error.response?.data?.message || "Không thể restore backup",
        variant: "destructive",
      });
    } finally {
      setRestoring(null);
    }
  };

  // Delete backup
  const handleDelete = async (backupId: string) => {
    try {
      setDeleting(backupId);
      await backupApi.deleteBackup(backupId);
      toast({
        title: "Thành công",
        description: "Đã xóa backup",
      });
      setDeleteDialogOpen(null);
      loadBackups();
    } catch (error: any) {
      console.error("Lỗi khi xóa backup:", error);
      toast({
        title: "Lỗi",
        description: error.response?.data?.message || "Không thể xóa backup",
        variant: "destructive",
      });
    } finally {
      setDeleting(null);
    }
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case "failed":
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case "creating":
      case "uploading":
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  // Get storage icon
  const getStorageIcon = (storageType: string) => {
    switch (storageType) {
      case "both":
        return <Cloud className="h-4 w-4 text-blue-600" />;
      case "google_drive":
        return <Cloud className="h-4 w-4 text-green-600" />;
      default:
        return <HardDrive className="h-4 w-4 text-gray-600" />;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Database className="h-6 w-6" />
          Quản lý Backup
        </h1>
        <Button onClick={() => setUploadDialogOpen(true)}>
          <Upload className="h-4 w-4 mr-2" />
          Upload Backup
        </Button>
      </div>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Backup File</DialogTitle>
            <DialogDescription>
              Chọn file backup (.tar.gz, .gz, .tar) để upload lên hệ thống
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="backup-file">File Backup</Label>
              <Input
                id="backup-file"
                type="file"
                accept=".tar.gz,.gz,.tar"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setSelectedFile(file);
                  }
                }}
              />
              {selectedFile && (
                <p className="text-sm text-muted-foreground mt-2">
                  Đã chọn: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="description">Mô tả (tùy chọn)</Label>
              <Input
                id="description"
                value={uploadDescription}
                onChange={(e) => setUploadDescription(e.target.value)}
                placeholder="Nhập mô tả cho backup này..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
              Hủy
            </Button>
            <Button onClick={handleUpload} disabled={!selectedFile || uploading}>
              {uploading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Đang upload...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore Dialog */}
      <AlertDialog
        open={restoreDialogOpen !== null}
        onOpenChange={(open) => !open && setRestoreDialogOpen(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận Restore</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn restore backup này? Hành động này sẽ thay thế toàn bộ dữ liệu
              hiện tại trong database. Hãy đảm bảo đã backup dữ liệu hiện tại trước khi restore.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => restoreDialogOpen && handleRestore(restoreDialogOpen)}
              className="bg-red-600 hover:bg-red-700"
            >
              {restoring === restoreDialogOpen ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Đang restore...
                </>
              ) : (
                "Xác nhận Restore"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Dialog */}
      <AlertDialog
        open={deleteDialogOpen !== null}
        onOpenChange={(open) => !open && setDeleteDialogOpen(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận Xóa</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa backup này? Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteDialogOpen && handleDelete(deleteDialogOpen)}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting === deleteDialogOpen ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Đang xóa...
                </>
              ) : (
                "Xác nhận Xóa"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Backup List */}
      <Card>
        <CardHeader>
          <CardTitle>Danh sách Backup</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              <p className="mt-2 text-muted-foreground">Đang tải...</p>
            </div>
          ) : backups.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Chưa có backup nào</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tên file</TableHead>
                  <TableHead>Kích thước</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Lưu trữ</TableHead>
                  <TableHead>Ngày tạo</TableHead>
                  <TableHead>Mô tả</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {backups.map((backup) => (
                  <TableRow key={backup._id}>
                    <TableCell className="font-medium">{backup.filename}</TableCell>
                    <TableCell>{formatFileSize(backup.fileSize)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(backup.status)}
                        <span className="capitalize">{backup.status}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStorageIcon(backup.storageType)}
                        <span className="capitalize">
                          {backup.storageType === "both"
                            ? "Local + Drive"
                            : backup.storageType === "google_drive"
                            ? "Google Drive"
                            : "Local"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {format(new Date(backup.createdAt), "dd/MM/yyyy HH:mm", { locale: vi })}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {backup.description || "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {backup.status === "completed" && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownload(backup)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setRestoreDialogOpen(backup._id)}
                              className="text-orange-600 hover:text-orange-700"
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeleteDialogOpen(backup._id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
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

