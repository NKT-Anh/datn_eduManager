/**
 * API Service - Base configuration
 */

import {
  API_BASE_URL_DEV,
  API_BASE_URL_PROD,
} from '@env';

const API_BASE_URL = __DEV__
  ? API_BASE_URL_DEV || 'http://localhost:3000/api'
  : API_BASE_URL_PROD || 'https://your-production-api.com/api';

export const apiConfig = {
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
};

export default apiConfig;

