import React, { createContext, useContext, useState, useEffect } from 'react';
import axiosInstance from '../api/axios';

const AuthContext = globalThis.__AuthContext || createContext(null);
globalThis.__AuthContext = AuthContext;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [shop, setShop] = useState(null);
  const [loading, setLoading] = useState(true);

  // Sync session state from localStorage on application load
  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = localStorage.getItem('textile_pos_token');
      const storedUser = localStorage.getItem('textile_pos_user');
      const storedShop = localStorage.getItem('textile_pos_shop');

      if (storedToken && storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          setUser(parsedUser);

          // If we have shop cached, use it. Otherwise attempt to fetch shop details
          if (storedShop) {
            try { setShop(JSON.parse(storedShop)); } catch (e) { /* ignore parse error */ }
          }

          // Verify profile authenticity with backend and fetch shop if available
          await axiosInstance.get('/auth/me');

          // If user belongs to a shop, fetch its details to show the shop name in UI
          if (parsedUser?.shop_id) {
            try {
              const shopRes = await axiosInstance.get(`/shops/${parsedUser.shop_id}`);
              if (shopRes.data && shopRes.data.shop) {
                setShop(shopRes.data.shop);
                localStorage.setItem('textile_pos_shop', JSON.stringify(shopRes.data.shop));
              }
            } catch (err) {
              // Non-fatal: we might be a Super Admin or shop endpoint could be protected; ignore
              console.warn('Unable to fetch shop details', err?.response?.data || err.message);
            }
          }
        } catch (error) {
          console.error('Session validation failed. User must log in.', error);
          handleSessionExpired();
        }
      }
      setLoading(false);
    };

    initializeAuth();

    // Listen for axios session expirations
    const handleSessionExpired = () => {
      setUser(null);
      localStorage.removeItem('textile_pos_token');
      localStorage.removeItem('textile_pos_refresh_token');
      localStorage.removeItem('textile_pos_user');
    };

    window.addEventListener('auth_session_expired', handleSessionExpired);
    return () => {
      window.removeEventListener('auth_session_expired', handleSessionExpired);
    };
  }, []);

  const login = async (username, password) => {
    try {
      const response = await axiosInstance.post('/auth/login', { username, password });
      const { accessToken, refreshToken, user: loggedUser } = response.data;

      localStorage.setItem('textile_pos_token', accessToken);
      localStorage.setItem('textile_pos_refresh_token', refreshToken);
      localStorage.setItem('textile_pos_user', JSON.stringify(loggedUser));
      setUser(loggedUser);
      return loggedUser;
    } catch (error) {
      throw error.response?.data?.message || 'Login failed. Please verify credentials.';
    }
  };

  const logout = () => {
    setUser(null);
    setShop(null);
    localStorage.removeItem('textile_pos_token');
    localStorage.removeItem('textile_pos_refresh_token');
    localStorage.removeItem('textile_pos_user');
    localStorage.removeItem('textile_pos_shop');
  };

  const value = {
    user,
    shop,
    isAuthenticated: !!user,
    loading,
    login,
    logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be consumed inside an AuthProvider');
  }
  return context;
};
