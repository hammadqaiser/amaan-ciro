import axios from 'axios'

// ── Amaan CIRO Production API Client ──
// Backend is deployed on Google Cloud Run.
// The localStorage override ('ciro_server_url') allows dynamic swapping
// from the mobile Settings tab without rebuilding the APK.

const PRODUCTION_URL = 'https://amaan-ciro.onrender.com/';

const getBaseURL = () => {
  // 1. User-configured override (from Settings tab on mobile)
  if (typeof window !== 'undefined') {
    const savedUrl = localStorage.getItem('ciro_server_url');
    if (savedUrl && savedUrl.trim() !== '') {
      return savedUrl;
    }
  }
  // 2. Build-time env variable (for local dev or staging)
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  // 3. Default: Live Cloud Run production server
  return PRODUCTION_URL;
};

export const apiClient = axios.create({
  baseURL: getBaseURL(),
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 120000, // 2 minute timeout for long-running agent pipelines
})

// Dynamic interceptor: re-evaluates URL on every request +
// fixes Axios leading-slash path-concatenation bug
apiClient.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const savedUrl = localStorage.getItem('ciro_server_url');
      if (savedUrl && savedUrl.trim() !== '') {
        config.baseURL = savedUrl;
      }
    }
    // Strip leading slash so Axios joins relative to baseURL subpath (/api)
    if (config.url && config.url.startsWith('/')) {
      config.url = config.url.substring(1);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Global error logging
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error)
    return Promise.reject(error)
  }
)

