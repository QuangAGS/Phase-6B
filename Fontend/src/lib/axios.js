/**
 * PATH       : src/lib/axios.js
 * DATETIME   : 18-04-2026 21:55
 * VERSION    : 14.0.0
 * DESCRIPTION:
 * - Chuẩn hóa axios instance cho frontend auth.
 * - Ưu tiên VITE_API_URL, fallback localhost.
 * - Tự gắn Bearer token nếu có.
 */

import axios from 'axios';

const API_REQUEST_TIMEOUT = 30000;

const apiClient = axios.create({
  baseURL:
    import.meta.env.VITE_API_URL ||
    'http://localhost:10000/api',

  timeout: API_REQUEST_TIMEOUT,

  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error)
);

export default apiClient;