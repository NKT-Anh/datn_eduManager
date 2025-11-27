/**
 * Cloudinary Service
 * Upload images and files to Cloudinary
 */

import {
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_UPLOAD_PRESET,
} from '@env';

export interface CloudinaryUploadResult {
  url: string;
  publicId: string;
  size: number;
  format?: string;
  width?: number;
  height?: number;
}

export const cloudinaryService = {
  /**
   * Upload image to Cloudinary
   */
  async uploadImage(
    imageUri: string,
    options?: {
      folder?: string;
      transformation?: string;
    },
  ): Promise<CloudinaryUploadResult> {
    try {
      if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
        throw new Error('⚠️ Thiếu cấu hình Cloudinary trong .env');
      }

      const formData = new FormData();
      formData.append('file', {
        uri: imageUri,
        type: 'image/jpeg',
        name: 'image.jpg',
      } as any);
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      
      if (options?.folder) {
        formData.append('folder', options.folder);
      }
      
      if (options?.transformation) {
        formData.append('transformation', options.transformation);
      }

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
        {
          method: 'POST',
          body: formData,
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Upload ảnh thất bại!');
      }

      const data = await response.json();
      return {
        url: data.secure_url,
        publicId: data.public_id,
        size: data.bytes,
        format: data.format,
        width: data.width,
        height: data.height,
      };
    } catch (error: any) {
      console.error('Cloudinary upload error:', error);
      throw new Error(error.message || 'Upload ảnh thất bại!');
    }
  },

  /**
   * Upload file to Cloudinary (PDF, DOCX, etc.)
   */
  async uploadFile(
    fileUri: string,
    fileName: string,
    fileType: string,
    options?: {
      folder?: string;
    },
  ): Promise<CloudinaryUploadResult> {
    try {
      if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
        throw new Error('⚠️ Thiếu cấu hình Cloudinary trong .env');
      }

      // Determine resource type
      let resourceType = 'raw';
      if (fileType.startsWith('image/')) {
        resourceType = 'image';
      } else if (fileType.startsWith('video/')) {
        resourceType = 'video';
      }

      const formData = new FormData();
      formData.append('file', {
        uri: fileUri,
        type: fileType,
        name: fileName,
      } as any);
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      formData.append('resource_type', resourceType);
      
      if (options?.folder) {
        formData.append('folder', options.folder);
      }

      const endpoint =
        resourceType === 'raw'
          ? `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/raw/upload`
          : `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`;

      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Upload file thất bại!');
      }

      const data = await response.json();
      return {
        url: data.secure_url,
        publicId: data.public_id,
        size: data.bytes,
      };
    } catch (error: any) {
      console.error('Cloudinary file upload error:', error);
      throw new Error(error.message || 'Upload file thất bại!');
    }
  },

  /**
   * Delete file from Cloudinary
   */
  async deleteFile(publicId: string): Promise<void> {
    try {
      // Note: This requires Cloudinary API key and secret
      // For security, this should be done on backend
      throw new Error(
        'Delete file should be done on backend for security reasons',
      );
    } catch (error: any) {
      console.error('Cloudinary delete error:', error);
      throw error;
    }
  },
};

