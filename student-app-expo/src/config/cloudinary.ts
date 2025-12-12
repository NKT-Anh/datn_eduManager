/**
 * Cloudinary Configuration
 */

import Constants from 'expo-constants';

// ✅ Lấy Cloudinary config từ app config hoặc environment variable
const getCloudinaryConfig = () => {
  const cloudName = Constants.expoConfig?.extra?.cloudinaryCloudName || process.env.CLOUDINARY_CLOUD_NAME || '';
  const uploadPreset = Constants.expoConfig?.extra?.cloudinaryUploadPreset || process.env.CLOUDINARY_UPLOAD_PRESET || '';

  return {
    cloudName,
    uploadPreset,
    uploadUrl: cloudName ? `https://api.cloudinary.com/v1_1/${cloudName}/image/upload` : '',
  };
};

export const cloudinaryConfig = getCloudinaryConfig();

export default cloudinaryConfig;

