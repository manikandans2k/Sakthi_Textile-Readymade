import React, { useState } from "react";
import Swal from "sweetalert2";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  ShoppingBag,
  LogOut,
  FileText,
  User,
  Package,
  Warehouse,
  Truck,
  Users,
  Barcode,
  ChevronLeft,
  ChevronRight,
  Menu,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import "./Sidebar.css";

const Sidebar = ({ isMobileOpen, toggleMobileSidebar, isCollapsed, setIsCollapsed }) => {
  const { user, shop, logout } = useAuth();

  const handleLogoutClick = async () => {
    const result = await Swal.fire({
      title: "Exit Session?",
      text: "Are you sure you want to log out of the active POS session?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#2563eb",
      cancelButtonColor: "#dc2626",
      confirmButtonText: "Yes, Exit Session",
      cancelButtonText: "Cancel",
      background: "#ffffff",
      color: "#0f172a"
    });
    if (result.isConfirmed) {
      logout();
    }
  };

  const isSuperAdmin = user && user.role === "Super Admin";
  const isAdminOrManager =
    user &&
    (user.role === "Shop Owner" ||
      user.role === "Admin" ||
      user.role === "Manager");

  // Role badge color
  const roleBadgeColor =
    user?.role === "Super Admin"
      ? "#EF4444"
      : user?.role === "Shop Owner" || user?.role === "Admin"
        ? "#2563EB"
        : user?.role === "Manager"
          ? "#F59E0B"
          : "#64748B";

  // Close mobile sidebar when a link is clicked
  const handleNavClick = () => {
    if (isMobileOpen) toggleMobileSidebar();
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div
          className="sidebar-mobile-backdrop active"
          onClick={toggleMobileSidebar}
        />
      )}

      <aside
        className={`sidebar-panel ${isMobileOpen ? "show-mobile" : ""} ${isCollapsed ? "collapsed" : ""}`}
      >
        {/* ── Brand Header ── */}
        <div className="sidebar-brand">
          <div className="sidebar-brand-info">
            <span className="sidebar-brand-icon">🧵</span>
            <div className="sidebar-brand-text">
              <h5 className="sidebar-brand-title font-heading">
                {shop?.shop_name || user?.username || "POS"}
              </h5>
              <span className="sidebar-brand-subtitle">
                {isSuperAdmin ? "SaaS Controller" : "POS & ERP"}
              </span>
            </div>
          </div>

          {/* Desktop collapse toggle */}
          <button
            className="sidebar-toggle-btn d-none d-lg-flex"
            onClick={() => setIsCollapsed((prev) => !prev)}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <ChevronRight size={16} />
            ) : (
              <ChevronLeft size={16} />
            )}
          </button>

          {/* Mobile close button */}
          <button
            className="sidebar-toggle-btn d-lg-none"
            onClick={toggleMobileSidebar}
            aria-label="Close Sidebar"
          >
            ✕
          </button>
        </div>

        {/* ── Navigation ── */}
        <nav className="sidebar-nav">
          {isSuperAdmin ? (
            <NavLink
              to="/saas"
              className={({ isActive }) =>
                `sidebar-item ${isActive ? "active" : ""}`
              }
              data-label="SaaS Dashboard"
              onClick={handleNavClick}
            >
              <LayoutDashboard size={20} />
              <span className="sidebar-item-label">SaaS Dashboard</span>
            </NavLink>
          ) : (
            <>
              {(isAdminOrManager || user?.role === "Stock Manager") && (
                <>
                  {isAdminOrManager && (
                    <NavLink
                      to="/dashboard"
                      className={({ isActive }) =>
                        `sidebar-item ${isActive ? "active" : ""}`
                      }
                      data-label="Dashboard"
                      onClick={handleNavClick}
                    >
                      <LayoutDashboard size={20} />
                      <span className="sidebar-item-label">Dashboard</span>
                    </NavLink>
                  )}

                  <NavLink
                    to="/inventory"
                    className={({ isActive }) =>
                      `sidebar-item ${isActive ? "active" : ""}`
                    }
                    data-label="Inventory"
                    onClick={handleNavClick}
                  >
                    <Package size={20} />
                    <span className="sidebar-item-label">Inventory</span>
                  </NavLink>

                  <NavLink
                    to="/warehouses"
                    className={({ isActive }) =>
                      `sidebar-item ${isActive ? "active" : ""}`
                    }
                    data-label="Warehouses"
                    onClick={handleNavClick}
                  >
                    <Warehouse size={20} />
                    <span className="sidebar-item-label">Warehouses</span>
                  </NavLink>

                  {isAdminOrManager && (
                    <>
                      <NavLink
                        to="/suppliers"
                        className={({ isActive }) =>
                          `sidebar-item ${isActive ? "active" : ""}`
                        }
                        data-label="Suppliers"
                        onClick={handleNavClick}
                      >
                        <Truck size={20} />
                        <span className="sidebar-item-label">Suppliers</span>
                      </NavLink>

                      <NavLink
                        to="/reports"
                        className={({ isActive }) =>
                          `sidebar-item ${isActive ? "active" : ""}`
                        }
                        data-label="Reports"
                        onClick={handleNavClick}
                      >
                        <FileText size={20} />
                        <span className="sidebar-item-label">Reports</span>
                      </NavLink>

                      <NavLink
                        to="/employees"
                        className={({ isActive }) =>
                          `sidebar-item ${isActive ? "active" : ""}`
                        }
                        data-label="Employee Hub"
                        onClick={handleNavClick}
                      >
                        <Users size={20} />
                        <span className="sidebar-item-label">Employee Hub</span>
                      </NavLink>
                    </>
                  )}
                </>
              )}

              <NavLink
                to="/pos"
                className={({ isActive }) =>
                  `sidebar-item ${isActive ? "active" : ""}`
                }
                data-label="POS Terminal"
                onClick={handleNavClick}
              >
                <ShoppingBag size={20} />
                <span className="sidebar-item-label">POS Terminal</span>
              </NavLink>

              <NavLink
                to="/customers"
                className={({ isActive }) =>
                  `sidebar-item ${isActive ? "active" : ""}`
                }
                data-label="Customers"
                onClick={handleNavClick}
              >
                <Users size={20} />
                <span className="sidebar-item-label">Customers</span>
              </NavLink>

              <NavLink
                to="/barcodes"
                className={({ isActive }) =>
                  `sidebar-item ${isActive ? "active" : ""}`
                }
                data-label="Barcode Tags"
                onClick={handleNavClick}
              >
                <Barcode size={20} />
                <span className="sidebar-item-label">Barcode Tags</span>
              </NavLink>
            </>
          )}
        </nav>

        {/* ── User Session Box ── */}
        <div className="sidebar-user-box">
          <div className="sidebar-user-info">
            <div className="sidebar-avatar">
              <User size={18} style={{ color: "#2563EB" }} />
            </div>
            <div className="sidebar-user-meta">
              <h6 className="sidebar-username font-heading">
                {user?.username}
              </h6>
              <span
                className="badge rounded-pill"
                style={{
                  fontSize: "0.68rem",
                  backgroundColor: roleBadgeColor,
                  color: "#fff",
                }}
              >
                {user?.role}
              </span>
            </div>
          </div>

          <button onClick={handleLogoutClick} className="sidebar-logout-btn">
            <LogOut size={16} />
            <span className="sidebar-logout-label">Exit Session</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
