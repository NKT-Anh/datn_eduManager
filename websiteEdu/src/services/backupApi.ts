import axiosClient from './axiosInstance';

export interface Backup {
  _id: string;
  filename: string;
  filePath: string;
  fileSize: number;
  storageType: 'local' | 'drive' | 'both';
  status: 'creating' | 'uploading' | 'completed' | 'failed';
  createdAt: string;
  createdBy?: string;
  isAutoBackup: boolean;
  backupType: 'manual' | 'scheduled';
  description?: string;
  googleDriveFileId?: string;
  googleDriveUrl?: string;
  error?: string;
}

export interface BackupStats {
  totalBackups: number;
  totalSize: number;
  localBackups: number;
  driveBackups: number;
  lastBackupDate?: string;
}

const backupApi = {
  // ✅ Tạo backup mới (manual)
  createBackup: async (options?: {
    uploadToDrive?: boolean;
    description?: string;
  }): Promise<Backup> => {
    const res = await axiosClient.post('/backups', {
      storageType: options?.uploadToDrive ? 'both' : 'local',
      uploadToDrive: options?.uploadToDrive || false,
      description: options?.description || '',
    });
    // Backend trả về { message: '...', backup: {...} }
    return res.data.backup || res.data;
  },

  // ✅ Lấy danh sách backup
  getBackups: async (): Promise<Backup[]> => {
    const res = await axiosClient.get('/backups');
    // Backend trả về { backups: [...], pagination: {...} }
    return res.data.backups || res.data || [];
  },

  // ✅ Lấy thống kê backup
  getBackupStats: async (): Promise<BackupStats> => {
    const res = await axiosClient.get('/backups/stats');
    return res.data;
  },

  // ✅ Download backup
  downloadBackup: async (id: string): Promise<Blob> => {
    const res = await axiosClient.get(`/backups/${id}/download`, {
      responseType: 'blob',
    });
    return res.data;
  },

  // ✅ Restore backup
  restoreBackup: async (id: string): Promise<{ message: string }> => {
    const res = await axiosClient.post(`/backups/${id}/restore`);
    return res.data;
  },

  // ✅ Xóa backup
  deleteBackup: async (id: string): Promise<{ message: string }> => {
    const res = await axiosClient.delete(`/backups/${id}`);
    return res.data;
  },

  // ✅ Upload backup file từ web
  uploadBackupFile: async (file: File, description?: string): Promise<Backup> => {
    const formData = new FormData();
    formData.append('backupFile', file);
    if (description) {
      formData.append('description', description);
    }

    const res = await axiosClient.post('/backups/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data.backup;
  },

  // ✅ Restore từ file đã upload
  restoreUploadedBackup: async (id: string, confirm: boolean = true): Promise<{ message: string }> => {
    const res = await axiosClient.post(`/backups/upload/${id}/restore`, { confirm });
    return res.data;
  },
};

export default backupApi;

