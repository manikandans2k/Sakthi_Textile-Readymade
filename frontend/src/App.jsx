import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

// Layout wraps
import DashboardLayout from './components/Layout/DashboardLayout';

// View Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import POS from './pages/POS';
import Inventory from './pages/Inventory';
import Suppliers from './pages/Suppliers';
import Customers from './pages/Customers';
import Warehouses from './pages/Warehouses';
import BarcodeGenerator from './pages/BarcodeGenerator';
import Reports from './pages/Reports';
import SaasDashboard from './pages/SaasDashboard';
import Employees from './pages/Employees';

// Authentication Guard: Redirects to /login if token is missing
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="d-flex align-items-center justify-content-center min-vh-100 bg-light">
        <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
          <span className="visually-hidden">Validating session...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

const RoleBasedRoute = ({ children, allowedRoles }) => {
  const { user } = useAuth();

  if (!user || !allowedRoles.includes(user.role)) {
    if (user) {
      if (user.role === 'Super Admin') return <Navigate to="/saas" replace />;
      if (user.role === 'Shop Owner' || user.role === 'Admin' || user.role === 'Manager') return <Navigate to="/dashboard" replace />;
      if (user.role === 'Cashier') return <Navigate to="/pos" replace />;
      if (user.role === 'Stock Manager') return <Navigate to="/inventory" replace />;
    }
    return <Navigate to="/login" replace />;
  }

  return children;
};

// Index redirects based on role
const IndexRedirect = () => {
  const { user } = useAuth();
  if (user) {
    if (user.role === 'Super Admin') return <Navigate to="/saas" replace />;
    if (user.role === 'Shop Owner' || user.role === 'Admin' || user.role === 'Manager') return <Navigate to="/dashboard" replace />;
    if (user.role === 'Cashier') return <Navigate to="/pos" replace />;
    if (user.role === 'Stock Manager') return <Navigate to="/inventory" replace />;
  }
  return <Navigate to="/login" replace />;
};

const App = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Authentication Gate */}
          <Route path="/login" element={<Login />} />

          {/* Secure ERP Application Outlets */}
          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            {/* Dynamic Index Redirect */}
            <Route index element={<IndexRedirect />} />
            
            {/* SaaS Dashboard: Restricted to Super Admin */}
            <Route 
              path="saas" 
              element={
                <RoleBasedRoute allowedRoles={['Super Admin']}>
                  <SaasDashboard />
                </RoleBasedRoute>
              } 
            />

            {/* Dashboard: Restricted to Shop Owner, Admin, Manager */}
            <Route 
              path="dashboard" 
              element={
                <RoleBasedRoute allowedRoles={['Shop Owner', 'Admin', 'Manager']}>
                  <Dashboard />
                </RoleBasedRoute>
              } 
            />

            {/* Reports & Liabilities: Restricted to Shop Owner, Admin, Manager */}
            <Route 
              path="reports" 
              element={
                <RoleBasedRoute allowedRoles={['Shop Owner', 'Admin', 'Manager']}>
                  <Reports />
                </RoleBasedRoute>
              } 
            />

            {/* Core Inventory, Warehouses, Suppliers: Restricted to Shop Owner, Admin, Manager, Stock Manager */}
            <Route 
              path="inventory" 
              element={
                <RoleBasedRoute allowedRoles={['Shop Owner', 'Admin', 'Manager', 'Stock Manager']}>
                  <Inventory />
                </RoleBasedRoute>
              } 
            />

            <Route 
              path="warehouses" 
              element={
                <RoleBasedRoute allowedRoles={['Shop Owner', 'Admin', 'Manager', 'Stock Manager']}>
                  <Warehouses />
                </RoleBasedRoute>
              } 
            />

            <Route 
              path="suppliers" 
              element={
                <RoleBasedRoute allowedRoles={['Shop Owner', 'Admin', 'Manager']}>
                  <Suppliers />
                </RoleBasedRoute>
              } 
            />

            {/* Customers & Barcodes: Restricted to regular shop roles */}
            <Route 
              path="customers" 
              element={
                <RoleBasedRoute allowedRoles={['Shop Owner', 'Admin', 'Manager', 'Cashier']}>
                  <Customers />
                </RoleBasedRoute>
              } 
            />
            
            <Route 
              path="barcodes" 
              element={
                <RoleBasedRoute allowedRoles={['Shop Owner', 'Admin', 'Manager', 'Cashier', 'Stock Manager']}>
                  <BarcodeGenerator />
                </RoleBasedRoute>
              } 
            />

            {/* POS Terminal: Available to Shop Owner, Admin, Manager, and Cashier */}
            <Route 
              path="pos" 
              element={
                <RoleBasedRoute allowedRoles={['Shop Owner', 'Admin', 'Manager', 'Cashier']}>
                  <POS />
                </RoleBasedRoute>
              } 
            />

            {/* Employee Management: Restricted to Shop Owner and Admin */}
            <Route 
              path="employees" 
              element={
                <RoleBasedRoute allowedRoles={['Shop Owner', 'Admin']}>
                  <Employees />
                </RoleBasedRoute>
              } 
            />
          </Route>

          {/* Catch-all fallback Route */}
          <Route path="*" element={<IndexRedirect />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
