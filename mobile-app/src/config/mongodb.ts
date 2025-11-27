/**
 * MongoDB Configuration
 * 
 * Note: MongoDB connection is typically handled by backend
 * This file is for reference only if needed for direct connection
 */

import {MONGODB_URI} from '@env';

export const mongodbConfig = {
  uri: MONGODB_URI || 'mongodb://localhost:27017/eduManager',
};

export default mongodbConfig;

