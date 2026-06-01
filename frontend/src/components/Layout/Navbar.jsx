import React from 'react';
import { useLocation } from 'react-router-dom';
import { Menu, Calendar, Clock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const Navbar = ({ toggleMobileSidebar }) => {
  const location = useLocation();
  const { user } = useAuth();

  // Generate clean heading title based on active path
  const getHeaderTitle = () => {
    switch (location.pathname) {
      case '/dashboard':
        return 'Interactive ERP Dashboard';
      case '/pos':
        return 'High-Speed Touch POS Workspace';
      default:
        return 'TexTil POS ERP';
    }
  };

  // Live formatted current date
  const getFormattedDate = () => {
    const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
    return new Date().toLocaleDateString('en-US', options);
  };

  return (
    <header className="navbar navbar-expand-lg bg-white border-bottom px-4 py-3 sticky-top" style={{ height: '70px', zIndex: 990 }}>
      <div className="container-fluid p-0 d-flex justify-content-between align-items-center">
        {/* Left Hand: Mobile Toggle + Title */}
        <div className="d-flex align-items-center gap-3">
          <button 
            className="btn btn-outline-secondary d-lg-none border-0 p-1"
            onClick={toggleMobileSidebar}
            aria-label="Toggle Navigation Sidebar"
          >
            <Menu size={24} />
          </button>
          
          <div>
            <h4 className="m-0 font-heading fw-bold text-dark" style={{ fontSize: '1.25rem' }}>
              {getHeaderTitle()}
            </h4>
          </div>
        </div>

        {/* Right Hand: Date/Time + Session Metadata */}
        <div className="d-none d-md-flex align-items-center gap-4">
          {/* Calendar tag */}
          <div className="d-flex align-items-center gap-2 text-muted" style={{ fontSize: '0.85rem' }}>
            <Calendar size={16} className="text-primary-color" style={{ color: '#2563EB' }} />
            <span>{getFormattedDate()}</span>
          </div>

          {/* User metadata */}
          <div className="border-start ps-4 d-flex align-items-center gap-2">
            <span 
              className="rounded-circle bg-success" 
              style={{ width: '8px', height: '8px', display: 'inline-block' }}
            ></span>
            <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#334155' }}>
              Terminal Active: {user?.username} ({user?.role})
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
