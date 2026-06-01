import React, { useState, useEffect } from 'react';
import axiosInstance from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Swal from 'sweetalert2';
import { 
  Users, UserCheck, ShieldAlert, KeyRound, Plus, 
  Trash2, ToggleLeft, ToggleRight, Lock, Eye, EyeOff, CheckSquare, Square,
  Check, X, FileText, ShoppingBag, Package, Barcode
} from 'lucide-react';

const Employees = () => {
  const { user } = useAuth();
  
  // State management
  const [employees, setEmployees] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState(null);
  
  // Add Employee form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState('');
  const [permissions, setPermissions] = useState({
    billing: false,
    products: false,
    inventory: false,
    reports: false
  });
  
  // Reset Password form state
  const [newPassword, setNewPassword] = useState('');
  
  // Edit Employee state
  const [editRoleId, setEditRoleId] = useState('');
  const [editPermissions, setEditPermissions] = useState({
    billing: false,
    products: false,
    inventory: false,
    reports: false
  });
  
  const [submitting, setSubmitting] = useState(false);
  const [showPass, setShowPass] = useState(false);

  // Fetch all staff and assignable roles
  const fetchEmployeesData = async () => {
    try {
      setLoading(true);
      setError('');
      const [empRes, rolesRes] = await Promise.all([
        axiosInstance.get('/employees'),
        axiosInstance.get('/employees/roles')
      ]);
      setEmployees(empRes.data);
      setRoles(rolesRes.data);
    } catch (err) {
      console.error('Fetch staff error:', err);
      setError(err.response?.data?.message || 'Failed to pull employee records from the server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployeesData();
  }, []);

  // Set default permissions when a role is selected (Add modal)
  const handleRoleChange = (selectedRoleId) => {
    setRoleId(selectedRoleId);
    const roleObj = roles.find(r => r.id === parseInt(selectedRoleId, 10));
    if (roleObj) {
      if (roleObj.role_name === 'Manager') {
        setPermissions({ billing: true, products: true, inventory: true, reports: true });
      } else if (roleObj.role_name === 'Cashier') {
        setPermissions({ billing: true, products: false, inventory: false, reports: false });
      } else if (roleObj.role_name === 'Stock Manager') {
        setPermissions({ billing: false, products: true, inventory: true, reports: false });
      }
    }
  };

  // Set default permissions when a role is selected (Edit modal)
  const handleEditRoleChange = (selectedRoleId) => {
    setEditRoleId(selectedRoleId);
    const roleObj = roles.find(r => r.id === parseInt(selectedRoleId, 10));
    if (roleObj) {
      if (roleObj.role_name === 'Manager') {
        setEditPermissions({ billing: true, products: true, inventory: true, reports: true });
      } else if (roleObj.role_name === 'Cashier') {
        setEditPermissions({ billing: true, products: false, inventory: false, reports: false });
      } else if (roleObj.role_name === 'Stock Manager') {
        setEditPermissions({ billing: false, products: true, inventory: true, reports: false });
      }
    }
  };

  // Create employee handler
  const handleCreateEmployee = async (e) => {
    e.preventDefault();
    if (!username || !password || !roleId) {
      setError('Please supply employee username, password, and designated role.');
      return;
    }
    
    setSubmitting(true);
    setError('');
    setSuccess('');
    
    // Compile active permission tags
    const activePerms = Object.keys(permissions).filter(k => permissions[k]).join(',');

    try {
      await axiosInstance.post('/employees', {
        username,
        password,
        role_id: parseInt(roleId, 10),
        permissions: activePerms
      });
      
      setSuccess(`Employee "${username}" registered successfully!`);
      setShowAddModal(false);
      
      // Reset form
      setUsername('');
      setPassword('');
      setRoleId('');
      setPermissions({ billing: false, products: false, inventory: false, reports: false });
      
      fetchEmployeesData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create user. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle user active status
  const handleToggleStatus = async (employee) => {
    setError('');
    setSuccess('');
    const newStatus = employee.status === 'Active' ? 'Inactive' : 'Active';
    
    const result = await Swal.fire({
      title: `${newStatus === 'Active' ? 'Activate' : 'Deactivate'} Staff Profile?`,
      text: `Are you sure you want to change the status of "${employee.username}" to ${newStatus}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: newStatus === 'Active' ? '#16a34a' : '#dc2626',
      cancelButtonColor: '#475569',
      confirmButtonText: `Yes, ${newStatus}`,
      cancelButtonText: 'Cancel',
      background: '#ffffff',
      color: '#0f172a'
    });
    
    if (result.isConfirmed) {
      try {
        await axiosInstance.put(`/employees/${employee.id}`, { status: newStatus });
        setSuccess(`Successfully ${newStatus === 'Active' ? 'activated' : 'deactivated'} employee "${employee.username}".`);
        fetchEmployeesData();
        Swal.fire({
          title: 'Status Updated',
          text: `Employee "${employee.username}" is now ${newStatus}.`,
          icon: 'success',
          timer: 1500,
          showConfirmButton: false,
          background: '#ffffff',
          color: '#0f172a'
        });
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to update user status.');
        Swal.fire({
          title: 'Operation Failed',
          text: err.response?.data?.message || 'Failed to update user status.',
          icon: 'error',
          confirmButtonColor: '#2563EB',
          background: '#ffffff',
          color: '#0f172a'
        });
      }
    }
  };

  // Trigger Edit modal
  const triggerEditModal = (employee) => {
    setSelectedEmp(employee);
    setEditRoleId(employee.role_id);
    
    // Parse comma-separated permissions
    const pList = (employee.permissions || '').split(',');
    setEditPermissions({
      billing: pList.includes('billing'),
      products: pList.includes('products'),
      inventory: pList.includes('inventory'),
      reports: pList.includes('reports')
    });
    
    setShowEditModal(true);
  };

  // Save Employee updates
  const handleSaveEdits = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');
    
    const activePerms = Object.keys(editPermissions).filter(k => editPermissions[k]).join(',');
    
    try {
      await axiosInstance.put(`/employees/${selectedEmp.id}`, {
        role_id: parseInt(editRoleId, 10),
        permissions: activePerms
      });
      
      setSuccess(`Staff details for "${selectedEmp.username}" updated successfully!`);
      setShowEditModal(false);
      fetchEmployeesData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save staff updates.');
    } finally {
      setSubmitting(false);
    }
  };

  // Reset employee password handler
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setError('Password must contain at least 6 characters.');
      return;
    }
    
    setSubmitting(true);
    setError('');
    setSuccess('');
    
    try {
      const response = await axiosInstance.post(`/employees/${selectedEmp.id}/reset-password`, {
        password: newPassword
      });
      
      setSuccess(response.data.message || `Password for "${selectedEmp.username}" reset successfully!`);
      setShowResetModal(false);
      setNewPassword('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset employee password.');
    } finally {
      setSubmitting(false);
    }
  };

  // Render permission indicators
  const renderPermissionBadge = (permName, isAvailable) => {
    const icon = permName === 'billing' ? <ShoppingBag size={12} /> :
                 permName === 'products' ? <Package size={12} /> :
                 permName === 'inventory' ? <Barcode size={12} /> : <FileText size={12} />;
    
    return (
      <span 
        className={`badge rounded-pill d-inline-flex align-items-center gap-1 py-1.5 px-2.5 font-heading text-uppercase`}
        style={{
          fontSize: '0.65rem',
          backgroundColor: isAvailable ? 'rgba(37, 99, 235, 0.1)' : 'rgba(15, 23, 42, 0.05)',
          color: isAvailable ? '#2563EB' : '#94A3B8',
          border: isAvailable ? '1px solid rgba(37, 99, 235, 0.15)' : '1px solid transparent'
        }}
      >
        {icon}
        <span>{permName}</span>
      </span>
    );
  };

  if (loading && employees.length === 0) {
    return (
      <div className="d-flex flex-column align-items-center justify-content-center py-5" style={{ minHeight: '300px' }}>
        <div className="spinner-border text-primary mb-3" role="status" style={{ width: '3rem', height: '3rem' }}>
          <span className="visually-hidden">Loading Staff Records...</span>
        </div>
        <p className="text-muted font-heading">Retrieving storefront employees directory...</p>
      </div>
    );
  }

  // Calculate metrics
  const activeCount = employees.filter(e => e.status === 'Active').length;
  const managersCount = employees.filter(e => e.role === 'Manager').length;
  const cashiersCount = employees.filter(e => e.role === 'Cashier').length;
  const stockCount = employees.filter(e => e.role === 'Stock Manager').length;

  return (
    <div className="fade-in">
      {/* Title Header */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div>
          <h2 className="fw-bold font-heading text-dark m-0">Employee Hub</h2>
          <p className="text-muted m-0" style={{ fontSize: '0.9rem' }}>
            Hire cashiers, managers, and stock workers, configure granular panel permissions, and manage staff active statuses.
          </p>
        </div>
        
        <button 
          onClick={() => {
            setError('');
            setSuccess('');
            setShowAddModal(true);
          }}
          className="btn btn-primary d-inline-flex align-items-center gap-2 fw-semibold px-4 py-2.5 shadow-sm"
          style={{ borderRadius: '8px', backgroundColor: '#2563EB', borderColor: '#2563EB' }}
        >
          <Plus size={18} />
          <span>Hire New Worker</span>
        </button>
      </div>

      {/* Alert Notices */}
      {error && (
        <div className="alert alert-danger d-flex align-items-center gap-2 mb-4 animate-fade-in" role="alert" style={{ borderRadius: '8px' }}>
          <ShieldAlert size={18} />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="alert alert-success d-flex align-items-center gap-2 mb-4 animate-fade-in" role="alert" style={{ borderRadius: '8px' }}>
          <Check size={18} />
          <span>{success}</span>
        </div>
      )}

      {/* Metrics Row */}
      <div className="row g-4 mb-4">
        {/* Card 1: Total Employees */}
        <div className="col-12 col-sm-6 col-md-3">
          <div className="premium-card p-4 d-flex align-items-center justify-content-between bg-white shadow-sm rounded-3">
            <div>
              <span className="text-muted d-block font-heading text-uppercase tracking-wider mb-1" style={{ fontSize: '0.7rem', fontWeight: 600 }}>Total Employees</span>
              <h3 className="m-0 fw-bold font-heading text-dark">{employees.length}</h3>
            </div>
            <div className="rounded-3 p-3 bg-primary bg-opacity-10 text-primary d-flex align-items-center justify-content-center" style={{ border: '1px solid rgba(37, 99, 235, 0.2)' }}>
              <Users size={22} style={{ color: '#2563EB' }} />
            </div>
          </div>
        </div>

        {/* Card 2: Active Operators */}
        <div className="col-12 col-sm-6 col-md-3">
          <div className="premium-card p-4 d-flex align-items-center justify-content-between bg-white shadow-sm rounded-3">
            <div>
              <span className="text-muted d-block font-heading text-uppercase tracking-wider mb-1" style={{ fontSize: '0.7rem', fontWeight: 600 }}>Active Workers</span>
              <h3 className="m-0 fw-bold font-heading text-success">{activeCount}</h3>
            </div>
            <div className="rounded-3 p-3 bg-success bg-opacity-10 text-success d-flex align-items-center justify-content-center" style={{ border: '1px solid rgba(25, 135, 84, 0.2)' }}>
              <UserCheck size={22} style={{ color: '#198754' }} />
            </div>
          </div>
        </div>

        {/* Card 3: Manager Accounts */}
        <div className="col-12 col-sm-6 col-md-3">
          <div className="premium-card p-4 d-flex align-items-center justify-content-between bg-white shadow-sm rounded-3">
            <div>
              <span className="text-muted d-block font-heading text-uppercase tracking-wider mb-1" style={{ fontSize: '0.7rem', fontWeight: 600 }}>Store Managers</span>
              <h3 className="m-0 fw-bold font-heading text-dark">{managersCount}</h3>
            </div>
            <div className="rounded-3 p-3 bg-opacity-10 text-dark d-flex align-items-center justify-content-center" style={{ backgroundColor: 'rgba(15, 23, 42, 0.05)', border: '1px solid rgba(15, 23, 42, 0.1)' }}>
              <Users size={22} style={{ color: '#0F172A' }} />
            </div>
          </div>
        </div>

        {/* Card 4: Cashiers & Stock Managers */}
        <div className="col-12 col-sm-6 col-md-3">
          <div className="premium-card p-4 d-flex align-items-center justify-content-between bg-white shadow-sm rounded-3">
            <div>
              <span className="text-muted d-block font-heading text-uppercase tracking-wider mb-1" style={{ fontSize: '0.7rem', fontWeight: 600 }}>Cashiers / Stock</span>
              <h3 className="m-0 fw-bold font-heading text-dark">{cashiersCount} / {stockCount}</h3>
            </div>
            <div className="rounded-3 p-3 bg-opacity-10 text-dark d-flex align-items-center justify-content-center" style={{ backgroundColor: 'rgba(15, 23, 42, 0.05)', border: '1px solid rgba(15, 23, 42, 0.1)' }}>
              <Users size={22} style={{ color: '#0F172A' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Main Staff Table */}
      <div className="card border-0 shadow-sm rounded-3 p-4 bg-white">
        <h5 className="fw-bold font-heading mb-4">Employees Directory</h5>
        
        <div className="table-responsive rounded-3 border" style={{ borderColor: '#F1F5F9' }}>
          <table className="table table-hover align-middle mb-0" style={{ fontSize: '0.9rem' }}>
            <thead style={{ backgroundColor: '#F8FAFC' }}>
              <tr>
                <th className="py-3 px-3 border-0 text-muted fw-semibold" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>Employee Profile</th>
                <th className="py-3 px-3 border-0 text-muted fw-semibold" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>User Role</th>
                <th className="py-3 px-3 border-0 text-muted fw-semibold" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>Hired Date</th>
                <th className="py-3 px-3 border-0 text-muted fw-semibold" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>Active Permissions</th>
                <th className="py-3 px-3 border-0 text-center text-muted fw-semibold" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>Status</th>
                <th className="py-3 px-3 border-0 text-center text-muted fw-semibold" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-5 text-muted font-heading">
                    No staff members registered yet. Click "Hire New Worker" to expand your team!
                  </td>
                </tr>
              ) : (
                employees.map((emp) => {
                  const pList = (emp.permissions || '').split(',');
                  const createdDate = new Date(emp.created_at).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                  });

                  return (
                    <tr key={emp.id} className={emp.status === 'Inactive' ? 'opacity-60 bg-light' : ''}>
                      {/* Name */}
                      <td className="py-3 px-3">
                        <div className="fw-bold text-dark">{emp.username}</div>
                        <span className="text-muted" style={{ fontSize: '0.75rem' }}>Staff ID: #{emp.id}</span>
                      </td>
                      
                      {/* Role */}
                      <td className="py-3 px-3">
                        <span 
                          className="badge rounded-pill font-heading text-uppercase px-3 py-1.5"
                          style={{
                            fontSize: '0.7rem',
                            backgroundColor: emp.role === 'Manager' ? '#F59E0B' : emp.role === 'Cashier' ? '#64748B' : '#10B981',
                            color: '#FFFFFF'
                          }}
                        >
                          {emp.role}
                        </span>
                      </td>

                      {/* Created At */}
                      <td className="py-3 px-3 text-secondary font-monospace" style={{ fontSize: '0.85rem' }}>
                        {createdDate}
                      </td>

                      {/* Permissions */}
                      <td className="py-3 px-3">
                        <div className="d-flex flex-wrap gap-1.5">
                          {renderPermissionBadge('billing', pList.includes('billing'))}
                          {renderPermissionBadge('products', pList.includes('products'))}
                          {renderPermissionBadge('inventory', pList.includes('inventory'))}
                          {renderPermissionBadge('reports', pList.includes('reports'))}
                        </div>
                      </td>

                      {/* Status Toggle */}
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => handleToggleStatus(emp)}
                          className="btn btn-link p-0 text-decoration-none border-0"
                          title={emp.status === 'Active' ? 'Deactivate Worker' : 'Activate Worker'}
                        >
                          {emp.status === 'Active' ? (
                            <ToggleRight size={30} className="text-success" />
                          ) : (
                            <ToggleLeft size={30} className="text-muted" />
                          )}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-center">
                        <div className="d-flex justify-content-center gap-2">
                          <button
                            onClick={() => triggerEditModal(emp)}
                            className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1.5 fw-semibold px-2.5 py-1.5"
                            style={{ borderRadius: '6px', fontSize: '0.8rem' }}
                          >
                            <span>Permissions</span>
                          </button>
                          
                          <button
                            onClick={() => {
                              setSelectedEmp(emp);
                              setError('');
                              setSuccess('');
                              setNewPassword('');
                              setShowResetModal(true);
                            }}
                            className="btn btn-sm btn-outline-warning d-inline-flex align-items-center gap-1.5 fw-semibold px-2.5 py-1.5"
                            style={{ borderRadius: '6px', fontSize: '0.8rem' }}
                            title="Reset Password"
                          >
                            <KeyRound size={14} />
                            <span>Reset</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 1. HIRE NEW WORKER MODAL (Slide-in Backdrop modal) */}
      {/* ======================================================== */}
      {showAddModal && (
        <div className="modal-backdrop-custom d-flex align-items-center justify-content-center">
          <div className="card modal-card p-4 border-0 shadow-lg fade-in" style={{ width: '100%', maxWidth: '520px', borderRadius: '16px' }}>
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h5 className="fw-bold font-heading m-0 text-dark">Hire Store Worker</h5>
              <button onClick={() => setShowAddModal(false)} className="btn btn-sm btn-link text-muted border-0 p-0"><X size={20} /></button>
            </div>

            <form onSubmit={handleCreateEmployee}>
              {/* Username */}
              <div className="mb-3">
                <label className="form-label text-muted font-heading" style={{ fontSize: '0.8rem', fontWeight: 600 }}>EMPLOYEE LOGIN USERNAME</label>
                <input 
                  type="text"
                  required
                  className="form-control"
                  style={{ borderRadius: '8px' }}
                  placeholder="e.g. sakthicashier"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>

              {/* Password */}
              <div className="mb-3">
                <label className="form-label text-muted font-heading" style={{ fontSize: '0.8rem', fontWeight: 600 }}>SECRET PASSWORD</label>
                <div className="input-group">
                  <input 
                    type={showPass ? 'text' : 'password'}
                    required
                    className="form-control"
                    style={{ borderTopLeftRadius: '8px', borderBottomLeftRadius: '8px' }}
                    placeholder="Min 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="btn btn-outline-secondary border-start-0"
                    style={{ borderTopRightRadius: '8px', borderBottomRightRadius: '8px' }}
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Role Select */}
              <div className="mb-4">
                <label className="form-label text-muted font-heading" style={{ fontSize: '0.8rem', fontWeight: 600 }}>DESIGNATED ROLE</label>
                <select
                  required
                  className="form-select"
                  style={{ borderRadius: '8px' }}
                  value={roleId}
                  onChange={(e) => handleRoleChange(e.target.value)}
                >
                  <option value="">Select Employee Role...</option>
                  {roles.map(r => (
                    <option key={r.id} value={r.id}>{r.role_name}</option>
                  ))}
                </select>
              </div>

              {/* Permissions Checkbox Grid */}
              {roleId && (
                <div className="mb-4 border rounded-3 p-3 bg-light">
                  <label className="form-label text-muted font-heading d-block mb-3" style={{ fontSize: '0.75rem', fontWeight: 700 }}>ASSIGN GRANULAR ACCESS PERMISSIONS</label>
                  <div className="d-flex flex-column gap-2">
                    <div className="form-check d-flex align-items-center gap-2">
                      <input 
                        type="checkbox" 
                        className="form-check-input" 
                        id="permBilling"
                        checked={permissions.billing}
                        onChange={(e) => setPermissions({...permissions, billing: e.target.checked})}
                      />
                      <label className="form-check-label text-dark font-heading mb-0" style={{ fontSize: '0.85rem' }} htmlFor="permBilling">Billing (POS Terminal Access)</label>
                    </div>
                    
                    <div className="form-check d-flex align-items-center gap-2">
                      <input 
                        type="checkbox" 
                        className="form-check-input" 
                        id="permProducts"
                        checked={permissions.products}
                        onChange={(e) => setPermissions({...permissions, products: e.target.checked})}
                      />
                      <label className="form-check-label text-dark font-heading mb-0" style={{ fontSize: '0.85rem' }} htmlFor="permProducts">Products Catalog (Create/Edit garments catalog)</label>
                    </div>
                    
                    <div className="form-check d-flex align-items-center gap-2">
                      <input 
                        type="checkbox" 
                        className="form-check-input" 
                        id="permInventory"
                        checked={permissions.inventory}
                        onChange={(e) => setPermissions({...permissions, inventory: e.target.checked})}
                      />
                      <label className="form-check-label text-dark font-heading mb-0" style={{ fontSize: '0.85rem' }} htmlFor="permInventory">Inventory (Stock operations, warehouses, ledger)</label>
                    </div>
                    
                    <div className="form-check d-flex align-items-center gap-2">
                      <input 
                        type="checkbox" 
                        className="form-check-input" 
                        id="permReports"
                        checked={permissions.reports}
                        onChange={(e) => setPermissions({...permissions, reports: e.target.checked})}
                      />
                      <label className="form-check-label text-dark font-heading mb-0" style={{ fontSize: '0.85rem' }} htmlFor="permReports">Reports (Analytics, Profit ledger, and GST audits)</label>
                    </div>
                  </div>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="d-flex justify-content-end gap-2 border-top pt-4">
                <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-outline-secondary px-4 py-2" style={{ borderRadius: '8px' }} disabled={submitting}>Cancel</button>
                <button type="submit" className="btn btn-primary px-4 py-2 fw-semibold" style={{ borderRadius: '8px', backgroundColor: '#2563EB', borderColor: '#2563EB' }} disabled={submitting}>
                  {submitting ? 'Registering...' : 'Complete Hire'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. EDIT PERMISSIONS / ROLE MODAL */}
      {/* ======================================================== */}
      {showEditModal && (
        <div className="modal-backdrop-custom d-flex align-items-center justify-content-center">
          <div className="card modal-card p-4 border-0 shadow-lg fade-in" style={{ width: '100%', maxWidth: '520px', borderRadius: '16px' }}>
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h5 className="fw-bold font-heading m-0 text-dark">Modify Staff Access</h5>
              <button onClick={() => setShowEditModal(false)} className="btn btn-sm btn-link text-muted border-0 p-0"><X size={20} /></button>
            </div>

            <p className="text-muted" style={{ fontSize: '0.85rem' }}>
              Adjust user role or customize granular panel access permissions for <strong className="text-dark">{selectedEmp?.username}</strong>.
            </p>

            <form onSubmit={handleSaveEdits}>
              {/* Role Select */}
              <div className="mb-4">
                <label className="form-label text-muted font-heading" style={{ fontSize: '0.8rem', fontWeight: 600 }}>DESIGNATED ROLE</label>
                <select
                  required
                  className="form-select"
                  style={{ borderRadius: '8px' }}
                  value={editRoleId}
                  onChange={(e) => handleEditRoleChange(e.target.value)}
                >
                  {roles.map(r => (
                    <option key={r.id} value={r.id}>{r.role_name}</option>
                  ))}
                </select>
              </div>

              {/* Permissions Checkbox Grid */}
              <div className="mb-4 border rounded-3 p-3 bg-light">
                <label className="form-label text-muted font-heading d-block mb-3" style={{ fontSize: '0.75rem', fontWeight: 700 }}>UPDATE ACCESS PERMISSIONS</label>
                <div className="d-flex flex-column gap-2">
                  <div className="form-check d-flex align-items-center gap-2">
                    <input 
                      type="checkbox" 
                      className="form-check-input" 
                      id="editPermBilling"
                      checked={editPermissions.billing}
                      onChange={(e) => setEditPermissions({...editPermissions, billing: e.target.checked})}
                    />
                    <label className="form-check-label text-dark font-heading mb-0" style={{ fontSize: '0.85rem' }} htmlFor="editPermBilling">Billing (POS Terminal Access)</label>
                  </div>
                  
                  <div className="form-check d-flex align-items-center gap-2">
                    <input 
                      type="checkbox" 
                      className="form-check-input" 
                      id="editPermProducts"
                      checked={editPermissions.products}
                      onChange={(e) => setEditPermissions({...editPermissions, products: e.target.checked})}
                    />
                    <label className="form-check-label text-dark font-heading mb-0" style={{ fontSize: '0.85rem' }} htmlFor="editPermProducts">Products Catalog (Create/Edit garments catalog)</label>
                  </div>
                  
                  <div className="form-check d-flex align-items-center gap-2">
                    <input 
                      type="checkbox" 
                      className="form-check-input" 
                      id="editPermInventory"
                      checked={editPermissions.inventory}
                      onChange={(e) => setEditPermissions({...editPermissions, inventory: e.target.checked})}
                    />
                    <label className="form-check-label text-dark font-heading mb-0" style={{ fontSize: '0.85rem' }} htmlFor="editPermInventory">Inventory (Stock operations, warehouses, ledger)</label>
                  </div>
                  
                  <div className="form-check d-flex align-items-center gap-2">
                    <input 
                      type="checkbox" 
                      className="form-check-input" 
                      id="editPermReports"
                      checked={editPermissions.reports}
                      onChange={(e) => setEditPermissions({...editPermissions, reports: e.target.checked})}
                    />
                    <label className="form-check-label text-dark font-heading mb-0" style={{ fontSize: '0.85rem' }} htmlFor="editPermReports">Reports (Analytics, Profit ledger, and GST audits)</label>
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="d-flex justify-content-end gap-2 border-top pt-4">
                <button type="button" onClick={() => setShowEditModal(false)} className="btn btn-outline-secondary px-4 py-2" style={{ borderRadius: '8px' }} disabled={submitting}>Cancel</button>
                <button type="submit" className="btn btn-primary px-4 py-2 fw-semibold" style={{ borderRadius: '8px', backgroundColor: '#2563EB', borderColor: '#2563EB' }} disabled={submitting}>
                  {submitting ? 'Saving Edits...' : 'Save Operations Access'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. RESET PASSWORD MODAL */}
      {/* ======================================================== */}
      {showResetModal && (
        <div className="modal-backdrop-custom d-flex align-items-center justify-content-center">
          <div className="card modal-card p-4 border-0 shadow-lg fade-in" style={{ width: '100%', maxWidth: '440px', borderRadius: '16px' }}>
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h5 className="fw-bold font-heading m-0 text-dark d-flex align-items-center gap-2">
                <Lock size={18} className="text-warning" />
                <span>Reset Staff Password</span>
              </h5>
              <button onClick={() => setShowResetModal(false)} className="btn btn-sm btn-link text-muted border-0 p-0"><X size={20} /></button>
            </div>

            <p className="text-muted" style={{ fontSize: '0.85rem' }}>
              Assign a new login password for employee <strong className="text-dark">{selectedEmp?.username}</strong>.
            </p>

            <form onSubmit={handleResetPassword}>
              {/* New Password */}
              <div className="mb-4">
                <label className="form-label text-muted font-heading" style={{ fontSize: '0.8rem', fontWeight: 600 }}>NEW LOGIN PASSWORD</label>
                <input 
                  type="text"
                  required
                  className="form-control"
                  style={{ borderRadius: '8px' }}
                  placeholder="Min 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>

              {/* Submit Buttons */}
              <div className="d-flex justify-content-end gap-2 border-top pt-4">
                <button type="button" onClick={() => setShowResetModal(false)} className="btn btn-outline-secondary px-4 py-2" style={{ borderRadius: '8px' }} disabled={submitting}>Cancel</button>
                <button type="submit" className="btn btn-warning text-white px-4 py-2 fw-semibold" style={{ borderRadius: '8px', backgroundColor: '#F59E0B', borderColor: '#F59E0B' }} disabled={submitting}>
                  {submitting ? 'Resetting Password...' : 'Reset Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Employees;
