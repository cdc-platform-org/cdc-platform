import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { removeCookie } from '../utils/cookies';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Set on a request's config (see authService.getMe's `silent401` option) to
// opt that call out of the hard-redirect-on-401 behavior below — used by
// useAuth's mount-time session check, which already handles a failed/expired
// token silently on its own (it just leaves the user logged out) and
// shouldn't have every page load yanked into a jarring full-page reload to
// /auth/login just because a stale token from a past session failed to
// revalidate.
declare module 'axios' {
  export interface AxiosRequestConfig {
    silent401?: boolean;
  }
}

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('cdc_access_token');
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    // The instance-level default Content-Type: application/json (set above)
    // otherwise survives even when the body is a FormData upload, since
    // axios only auto-clears a Content-Type it set itself — not one baked
    // into the instance defaults. Left in place, this sends multipart
    // uploads with the wrong Content-Type (no boundary), so the backend's
    // multer/busboy parser never sees a file at all. Deleting it here lets
    // the browser generate the correct `multipart/form-data; boundary=...`
    // header for every FormData request (avatar, verification doc,
    // knowledge-base uploads, etc.) without each call site overriding it.
    if (typeof FormData !== 'undefined' && config.data instanceof FormData && config.headers) {
      delete config.headers['Content-Type'];
    }
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('cdc_access_token');
        localStorage.removeItem('cdc_user');
        removeCookie('token');
        if (!error.config?.silent401 && !window.location.pathname.startsWith('/auth')) {
          window.location.href = '/auth/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
