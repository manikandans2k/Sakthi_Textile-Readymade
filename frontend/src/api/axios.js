import axios from 'axios';

// Detect environment to configure the API base URL
// Uses port 5000 in Dev mode, uses relative origin path in Production build
const getBaseURL = () => {
  const { origin } = window.location;
  if (origin.includes(':3000')) {
    return 'http://localhost:5000/api';
  }
  return '/api';
};

const axiosInstance = axios.create({
  baseURL: getBaseURL(),
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 second timeout limit
});

// Request Interceptor: Automatically inject JWT access tokens
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('textile_pos_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: Handle session invalidations automatically
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const { status } = error.response;
      
      // If unauthorized/expired JWT, clear state and reload to login screen
      if (status === 401 || (status === 403 && error.response.data?.message !== 'Forbidden. You do not have permissions to access this endpoint.')) {
        // Only trigger logout if it's not a login attempt itself
        if (!error.config.url.includes('/auth/login')) {
          localStorage.removeItem('textile_pos_token');
          localStorage.removeItem('textile_pos_user');
          
          // Send custom event to notify components (e.g. AuthContext)
          window.dispatchEvent(new Event('auth_session_expired'));
        }
      }
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
