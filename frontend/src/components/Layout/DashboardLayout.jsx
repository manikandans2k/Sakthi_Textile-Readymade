import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';

const DashboardLayout = () => {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const toggleMobileSidebar = () => {
    setIsMobileSidebarOpen(!isMobileSidebarOpen);
  };

  return (
    <div className="d-flex min-vh-100 bg-app" style={{ backgroundColor: '#F8FAFC' }}>
      {/* Sidebar Panel */}
      <Sidebar 
        isMobileOpen={isMobileSidebarOpen} 
        toggleMobileSidebar={toggleMobileSidebar}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
      />
      
      {/* Backdrop overlay for mobile drawer */}
      {isMobileSidebarOpen && (
        <div 
          className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-25 d-lg-none"
          style={{ zIndex: 999 }}
          onClick={toggleMobileSidebar}
        />
      )}

      {/* Main Panel Area */}
      <div className={`main-wrapper flex-grow-1 d-flex flex-column ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        {/* Navbar Header */}
        <Navbar toggleMobileSidebar={toggleMobileSidebar} />

        {/* Central Router Outlet Area */}
        <main className="flex-grow-1 p-3 p-md-4 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
