/**
 * Upload file lên Cloudinary (hỗ trợ mọi loại file: PDF, DOCX, XLSX, images, etc.)
 */
export const uploadFileToCloudinary = async (file: File): Promise<{ url: string; publicId: string; size: number }> => {
  const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error("⚠️ Thiếu cấu hình Cloudinary trong .env");
  }

  // Xác định resource_type dựa trên loại file
  const fileType = file.type.toLowerCase();
  const fileName = file.name.toLowerCase();
  let resourceType = "auto";
  
  // Nếu là ảnh, dùng image
  if (fileType.startsWith("image/") || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(fileName)) {
    resourceType = "image";
  } 
  // Nếu là video, dùng video
  else if (fileType.startsWith("video/") || /\.(mp4|avi|mov|wmv|flv|webm)$/i.test(fileName)) {
    resourceType = "video";
  }
  // Các file khác (PDF, DOCX, XLSX, etc.) dùng raw
  else if (/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|zip|rar)$/i.test(fileName)) {
    resourceType = "raw";
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);
  formData.append("resource_type", resourceType);

  // Sử dụng endpoint phù hợp
  const endpoint = resourceType === "raw" 
    ? `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/raw/upload`
    : `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`;

  const res = await fetch(endpoint, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const errorText = await res.text();
    let errorMessage = "Upload file thất bại!";
    try {
      const error = JSON.parse(errorText);
      errorMessage = error.error?.message || errorMessage;
    } catch {
      errorMessage = errorText || errorMessage;
    }
    throw new Error(errorMessage);
  }

  const data = await res.json();
  return {
    url: data.secure_url as string,
    publicId: data.public_id as string,
    size: data.bytes as number,
  };
};

/**
 * Format file size
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
};

/**
 * Get file icon based on file type
 */
export const getFileIcon = (fileName: string): string => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return 'picture_as_pdf';
  if (['doc', 'docx'].includes(ext || '')) return 'description';
  if (['xls', 'xlsx'].includes(ext || '')) return 'drive_spreadsheet';
  if (['jpg', 'jpeg', 'png', 'gif'].includes(ext || '')) return 'image';
  return 'insert_drive_file';
};

/**
 * Get file icon color
 */
export const getFileIconColor = (fileName: string): string => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return 'text-red-500';
  if (['doc', 'docx'].includes(ext || '')) return 'text-blue-500';
  if (['xls', 'xlsx'].includes(ext || '')) return 'text-green-500';
  return 'text-gray-500';
};

