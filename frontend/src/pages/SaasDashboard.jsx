import React, { useState, useEffect } from 'react';
import axios from '../api/axios';
import Swal from 'sweetalert2';
import { 
  Building2, 
  Plus, 
  Lock, 
  Calendar, 
  CheckCircle2, 
  AlertTriangle, 
  TrendingUp, 
  ShoppingBag, 
  Users, 
  ShieldAlert, 
  Search,
  KeyRound,
  FilePenLine,
  UserCheck
} from 'lucide-react';

const SaasDashboard = () => {
  // Page state
  const [metrics, setMetrics] = useState({
    totalShops: 0,
    activeShops: 0,
    suspendedShops: 0,
    totalRevenue: 0,
    totalOrders: 0,
    totalUsers: 0
  });
  const [shops, setShops] = useState([]);
  const [planDistribution, setPlanDistribution] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Search query
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditSubscriptionModal, setShowEditSubscriptionModal] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [showEditDetailsModal, setShowEditDetailsModal] = useState(false);

  // Selected shop for updates
  const [selectedShop, setSelectedShop] = useState(null);

  // Forms state
  const [createForm, setCreateForm] = useState({
    shop_name: '',
    owner_name: '',
    mobile: '',
    email: '',
    gst_number: '',
    address: '',
    subscription_plan: 'Starter',
    subscription_expiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    username: '',
    password: '',
    gst_enabled: true
  });

  const [editSubscriptionForm, setEditSubscriptionForm] = useState({
    subscription_plan: 'Starter',
    subscription_expiry: ''
  });

  const [resetPasswordForm, setResetPasswordForm] = useState({
    password: '',
    userId: null,
    username: ''
  });

  const [editDetailsForm, setEditDetailsForm] = useState({
    shop_name: '',
    owner_name: '',
    mobile: '',
    email: '',
    gst_number: '',
    address: '',
    subscription_plan: 'Starter',
    subscription_expiry: '',
    gst_enabled: true,
    username: '',
    password: ''
  });

  const [formLoading, setFormLoading] = useState(false);
  const [formSuccess, setFormSuccess] = useState(null);
  const [formError, setFormError] = useState(null);

  // Fetch all dashboard data
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const dashboardRes = await axios.get('/saas/dashboard');
      if (dashboardRes.data) {
        setMetrics(dashboardRes.data.metrics);
        setPlanDistribution(dashboardRes.data.planDistribution);
      }

      const shopsRes = await axios.get('/saas/shops');
      if (shopsRes.data) {
        setShops(shopsRes.data);
      }
    } catch (err) {
      console.error('Error fetching SaaS dashboard:', err);
      setError('Failed to fetch SaaS administrative data. Please verify database connectivity.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handle status toggle (Suspend/Activate)
  const handleToggleStatus = async (shopId, currentStatus) => {
    const nextStatus = currentStatus === 'Active' ? 'Suspended' : 'Active';
    
    const result = await Swal.fire({
      title: `${nextStatus === 'Suspended' ? 'Suspend' : 'Activate'} Storefront?`,
      text: `Are you sure you want to change the status of this shop to ${nextStatus.toUpperCase()}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: nextStatus === 'Suspended' ? '#dc2626' : '#16a34a',
      cancelButtonColor: '#475569',
      confirmButtonText: `Yes, ${nextStatus}`,
      cancelButtonText: 'Cancel',
      background: '#ffffff',
      color: '#0f172a'
    });
    
    if (result.isConfirmed) {
      try {
        await axios.put(`/saas/shops/${shopId}/status`, { status: nextStatus });
        fetchData();
        Swal.fire({
          title: 'Status Updated',
          text: `The store status is now ${nextStatus}.`,
          icon: 'success',
          timer: 1500,
          showConfirmButton: false,
          background: '#ffffff',
          color: '#0f172a'
        });
      } catch (err) {
        Swal.fire({
          title: 'Operation Failed',
          text: err.response?.data?.message || 'Error updating shop status.',
          icon: 'error',
          confirmButtonColor: '#2563EB',
          background: '#ffffff',
          color: '#0f172a'
        });
      }
    }
  };

  // Handle GST billing toggle
  const handleToggleGst = async (shopId, currentGstEnabled, shopName) => {
    const nextGst = !currentGstEnabled;
    
    const result = await Swal.fire({
      title: `${nextGst ? 'Enable' : 'Disable'} GST Billing?`,
      text: `Are you sure you want to ${nextGst ? 'activate' : 'exempt/deactivate'} GST billing for store "${shopName}"? Historical sales will retain audit consistency, while new sales will reflect this setting immediately.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: nextGst ? '#16a34a' : '#dc2626',
      cancelButtonColor: '#475569',
      confirmButtonText: nextGst ? 'Yes, Enable' : 'Yes, Disable',
      cancelButtonText: 'Cancel',
      background: '#ffffff',
      color: '#0f172a'
    });
    
    if (result.isConfirmed) {
      try {
        await axios.put(`/shops/${shopId}/gst`, { gst_enabled: nextGst });
        fetchData();
        Swal.fire({
          title: 'GST Settings Saved',
          text: `GST billing for "${shopName}" is now ${nextGst ? 'ENABLED' : 'DISABLED'}.`,
          icon: 'success',
          timer: 1500,
          showConfirmButton: false,
          background: '#ffffff',
          color: '#0f172a'
        });
      } catch (err) {
        Swal.fire({
          title: 'Operation Failed',
          text: err.response?.data?.message || 'Error updating shop GST status.',
          icon: 'error',
          confirmButtonColor: '#2563EB',
          background: '#ffffff',
          color: '#0f172a'
        });
      }
    }
  };

  // Create Shop submission handler
  const handleCreateShopSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);
    setFormSuccess(null);

    try {
      await axios.post('/saas/shops', createForm);
      setFormSuccess('Shop and Owner account registered successfully!');
      setTimeout(() => {
        setShowCreateModal(false);
        setCreateForm({
          shop_name: '',
          owner_name: '',
          mobile: '',
          email: '',
          gst_number: '',
          address: '',
          subscription_plan: 'Starter',
          subscription_expiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          username: '',
          password: '',
          gst_enabled: true
        });
        setFormSuccess(null);
        fetchData();
      }, 1500);
    } catch (err) {
      setFormError(err.response?.data?.message || 'Error creating shop. Ensure unique email/username.');
    } finally {
      setFormLoading(false);
    }
  };

  // Edit Subscription handler
  const handleEditSubscriptionClick = (shop) => {
    setSelectedShop(shop);
    const expiryDate = shop.subscription_expiry 
      ? new Date(shop.subscription_expiry).toISOString().split('T')[0]
      : '';
      
    setEditSubscriptionForm({
      subscription_plan: shop.subscription_plan || 'Starter',
      subscription_expiry: expiryDate
    });
    setFormError(null);
    setFormSuccess(null);
    setShowEditSubscriptionModal(true);
  };

  const handleEditSubscriptionSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);
    setFormSuccess(null);

    try {
      await axios.put(`/saas/shops/${selectedShop.id}/subscription`, editSubscriptionForm);
      setFormSuccess('Subscription tier updated successfully!');
      setTimeout(() => {
        setShowEditSubscriptionModal(false);
        setFormSuccess(null);
        fetchData();
      }, 1500);
    } catch (err) {
      setFormError(err.response?.data?.message || 'Error updating subscription.');
    } finally {
      setFormLoading(false);
    }
  };

  // Edit Details handler
  const handleEditDetailsClick = (shop) => {
    setSelectedShop(shop);
    const expiryDate = shop.subscription_expiry 
      ? new Date(shop.subscription_expiry).toISOString().split('T')[0]
      : '';
      
    setEditDetailsForm({
      shop_name: shop.shop_name || '',
      owner_name: shop.owner_name || '',
      mobile: shop.mobile || '',
      email: shop.email || '',
      gst_number: shop.gst_number || '',
      address: shop.address || '',
      subscription_plan: shop.subscription_plan || 'Starter',
      subscription_expiry: expiryDate,
      gst_enabled: shop.gst_enabled !== 0 && shop.gst_enabled !== false,
      username: shop.owner_username || '',
      password: '' // empty by default
    });
    setFormError(null);
    setFormSuccess(null);
    setShowEditDetailsModal(true);
  };

  const handleEditDetailsSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);
    setFormSuccess(null);

    try {
      await axios.put(`/saas/shops/${selectedShop.id}/details`, editDetailsForm);
      setFormSuccess('Shop details and owner credentials updated successfully!');
      setTimeout(() => {
        setShowEditDetailsModal(false);
        setFormSuccess(null);
        fetchData();
      }, 1500);
    } catch (err) {
      setFormError(err.response?.data?.message || 'Error updating shop details.');
    } finally {
      setFormLoading(false);
    }
  };

  // Reset Password handler
  const handleResetPasswordClick = (shop) => {
    setSelectedShop(shop);
    setResetPasswordForm({
      password: '',
      userId: shop.id, // We will reset based on shop owner connection
      username: shop.owner_username
    });
    setFormError(null);
    setFormSuccess(null);
    setShowResetPasswordModal(true);
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);
    setFormSuccess(null);

    try {
      // Find the user ID for this Shop Owner
      // We look up the shops where role is owner, but saas.controller handles reset based on user id.
      // Wait, let's verify selectedShop's owner user ID.
      // We need user ID of the owner. In getShops query we left join users u ON s.id = u.shop_id AND u.role = 'Shop Owner'.
      // Wait, does getShops return the owner's user ID?
      // Let's check saas.controller.js getShops: s.*, u.username as owner_username, total_products, total_orders. It does not return u.id!
      // But we can reset using the user ID, or saasController can support resetting password by shop owner role.
      // Wait, let's see. In saas.controller.js resetShopOwnerPassword, we query "SELECT role, username FROM users WHERE id = ?". It expects user ID.
      // Wait! How do we know the user ID? If the frontend does not have it, let's check if we can query it or if saas.controller resetShopOwnerPassword has user ID.
      // Oh! In saas.controller.js resetShopOwnerPassword expects user ID.
      // Can we update saas.controller.js getShops to return `u.id as owner_user_id`?
      // Yes! Let's check `saas.controller.js` `getShops` query:
      // `SELECT s.*, COALESCE(u.username, 'N/A') as owner_username, ...`
      // If we change it to include `u.id as owner_user_id`, we will have the exact user ID of the owner!
      // This is a crucial detail to guarantee the password reset works perfectly.
      // Let's update saas.controller.js in a separate step or right now.
      // Actually, we can update it in a moment or we can do it via a quick code replacement.
      // Let's check if we can do that right now. Yes, we can! Let's write the code for resetPassword expecting owner_user_id, which we'll add to saas.controller.js.
      
      const ownerUserId = selectedShop.owner_user_id;
      if (!ownerUserId || ownerUserId === 'N/A' || ownerUserId === null) {
        throw new Error('No active Shop Owner registered for this store.');
      }

      await axios.post(`/saas/users/${ownerUserId}/reset-password`, { password: resetPasswordForm.password });
      setFormSuccess('Owner credentials reset successfully!');
      setTimeout(() => {
        setShowResetPasswordModal(false);
        setFormSuccess(null);
      }, 1500);
    } catch (err) {
      setFormError(err.message || err.response?.data?.message || 'Error resetting password.');
    } finally {
      setFormLoading(false);
    }
  };

  // Filtered Shops List
  const filteredShops = shops.filter(shop => {
    const query = searchQuery.toLowerCase();
    return (
      shop.shop_name.toLowerCase().includes(query) ||
      shop.owner_name.toLowerCase().includes(query) ||
      shop.email.toLowerCase().includes(query) ||
      shop.mobile.includes(query)
    );
  });

  if (loading) {
    return (
      <div className="d-flex align-items-center justify-content-center min-vh-100 bg-light">
        <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
          <span className="visually-hidden">Loading SaaS Controller Workspace...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4" style={{ backgroundColor: '#F8FAFC', minHeight: '100vh', fontFamily: "'Inter', sans-serif" }}>
      
      {/* 1. Upper Glass Header */}
      <div 
        className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4 p-4 rounded-4" 
        style={{ 
          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.8) 0%, rgba(248, 250, 252, 0.85) 100%)', 
          backdropFilter: 'blur(20px)', 
          border: '1px solid rgba(226, 232, 240, 0.8)',
          boxShadow: '0 10px 30px rgba(15, 23, 42, 0.03)'
        }}
      >
        <div>
          <div className="d-flex align-items-center gap-3">
            <div 
              className="rounded-3 d-flex align-items-center justify-content-center shadow-sm"
              style={{ 
                width: '52px', 
                height: '52px', 
                background: 'linear-gradient(135deg, #2563EB 0%, #3B82F6 100%)',
                color: '#FFFFFF',
                fontSize: '1.4rem'
              }}
            >
              🌐
            </div>
            <div>
              <h2 className="m-0 font-heading fw-extrabold text-dark" style={{ letterSpacing: '-0.5px', fontSize: '1.5rem' }}>SaaS Operations Panel</h2>
              <p className="m-0 text-secondary mt-0.5" style={{ fontSize: '0.82rem', fontWeight: '500' }}>Enterprise Tenant Administration & Multi-Store Monitors</p>
            </div>
          </div>
        </div>
        
        <button 
          onClick={() => setShowCreateModal(true)} 
          className="btn btn-primary d-flex align-items-center gap-2 border-0"
          style={{ 
            borderRadius: '12px', 
            padding: '12px 24px', 
            fontWeight: '600', 
            fontSize: '0.85rem',
            background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
            boxShadow: '0 4px 18px rgba(37, 99, 235, 0.22)',
            transition: 'all 0.25s ease'
          }}
          onMouseOver={(e) => e.currentTarget.style.boxShadow = '0 6px 24px rgba(37, 99, 235, 0.35)'}
          onMouseOut={(e) => e.currentTarget.style.boxShadow = '0 4px 18px rgba(37, 99, 235, 0.22)'}
        >
          <Plus size={18} />
          <span>Provision New Store</span>
        </button>
      </div>

      {error && (
        <div className="alert alert-danger rounded-3 p-3 mb-4 d-flex align-items-center gap-2 font-heading fw-bold">
          <ShieldAlert size={20} />
          <span>{error}</span>
        </div>
      )}

      {/* 2. Modern KPI Cards Grid */}
      <div className="row g-4 mb-4">
        {/* Card 1: Total Tenants */}
        <div className="col-12 col-sm-6 col-lg-3">
          <div 
            className="p-4 rounded-4 text-white position-relative overflow-hidden" 
            style={{ 
              background: 'linear-gradient(135deg, #312E81 0%, #4F46E5 100%)',
              boxShadow: '0 10px 25px rgba(79, 70, 229, 0.15)',
              transition: 'all 0.3s ease',
              border: '1px solid rgba(255, 255, 255, 0.08)'
            }}
            onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 15px 30px rgba(79, 70, 229, 0.25)'; }}
            onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 10px 25px rgba(79, 70, 229, 0.15)'; }}
          >
            <div style={{ position: 'absolute', right: '-12px', bottom: '-15px', opacity: 0.12, transform: 'scale(1.1)' }}>
              <Building2 size={120} />
            </div>
            <div className="d-flex align-items-center justify-content-between mb-3.5">
              <span className="font-heading fw-bold" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.8px', color: '#E0E7FF' }}>Total Store Tenants</span>
              <Building2 size={18} className="text-indigo-200" />
            </div>
            <h2 className="m-0 fw-extrabold fs-1 font-heading" style={{ letterSpacing: '-0.5px' }}>{metrics.totalShops}</h2>
            <div className="mt-2.5 d-flex align-items-center gap-1" style={{ fontSize: '0.72rem', color: '#C7D2FE', fontWeight: '500' }}>
              <span>Registered storefront systems</span>
            </div>
          </div>
        </div>

        {/* Card 2: Active Subscriptions */}
        <div className="col-12 col-sm-6 col-lg-3">
          <div 
            className="p-4 rounded-4 text-white position-relative overflow-hidden" 
            style={{ 
              background: 'linear-gradient(135deg, #064E3B 0%, #10B981 100%)',
              boxShadow: '0 10px 25px rgba(16, 185, 129, 0.15)',
              transition: 'all 0.3s ease',
              border: '1px solid rgba(255, 255, 255, 0.08)'
            }}
            onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 15px 30px rgba(16, 185, 129, 0.25)'; }}
            onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 10px 25px rgba(16, 185, 129, 0.15)'; }}
          >
            <div style={{ position: 'absolute', right: '-12px', bottom: '-15px', opacity: 0.12, transform: 'scale(1.1)' }}>
              <CheckCircle2 size={120} />
            </div>
            <div className="d-flex align-items-center justify-content-between mb-3.5">
              <span className="font-heading fw-bold" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.8px', color: '#D1FAE5' }}>Active Subscriptions</span>
              <CheckCircle2 size={18} className="text-emerald-200" />
            </div>
            <h2 className="m-0 fw-extrabold fs-1 font-heading" style={{ letterSpacing: '-0.5px' }}>{metrics.activeShops}</h2>
            <div className="mt-2.5 d-flex align-items-center gap-1" style={{ fontSize: '0.72rem', color: '#A7F3D0', fontWeight: '500' }}>
              <span>Store owners active online</span>
            </div>
          </div>
        </div>

        {/* Card 3: Gross SaaS Revenue */}
        <div className="col-12 col-sm-6 col-lg-3">
          <div 
            className="p-4 rounded-4 text-white position-relative overflow-hidden" 
            style={{ 
              background: 'linear-gradient(135deg, #4C1D95 0%, #8B5CF6 100%)',
              boxShadow: '0 10px 25px rgba(139, 92, 246, 0.15)',
              transition: 'all 0.3s ease',
              border: '1px solid rgba(255, 255, 255, 0.08)'
            }}
            onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 15px 30px rgba(139, 92, 246, 0.25)'; }}
            onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 10px 25px rgba(139, 92, 246, 0.15)'; }}
          >
            <div style={{ position: 'absolute', right: '-12px', bottom: '-15px', opacity: 0.12, transform: 'scale(1.1)' }}>
              <TrendingUp size={120} />
            </div>
            <div className="d-flex align-items-center justify-content-between mb-3.5">
              <span className="font-heading fw-bold" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.8px', color: '#EDE9FE' }}>Gross Retail Sales</span>
              <TrendingUp size={18} className="text-violet-200" />
            </div>
            <h2 className="m-0 fw-extrabold fs-1 font-heading" style={{ letterSpacing: '-0.5px' }}>₹{(metrics.totalRevenue || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</h2>
            <div className="mt-2.5 d-flex align-items-center gap-1" style={{ fontSize: '0.72rem', color: '#DDD6FE', fontWeight: '500' }}>
              <span>Combined tenant checkout value</span>
            </div>
          </div>
        </div>

        {/* Card 4: Total Transactions */}
        <div className="col-12 col-sm-6 col-lg-3">
          <div 
            className="p-4 rounded-4 text-white position-relative overflow-hidden" 
            style={{ 
              background: 'linear-gradient(135deg, #78350F 0%, #F59E0B 100%)',
              boxShadow: '0 10px 25px rgba(245, 158, 11, 0.15)',
              transition: 'all 0.3s ease',
              border: '1px solid rgba(255, 255, 255, 0.08)'
            }}
            onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 15px 30px rgba(245, 158, 11, 0.25)'; }}
            onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 10px 25px rgba(245, 158, 11, 0.15)'; }}
          >
            <div style={{ position: 'absolute', right: '-12px', bottom: '-15px', opacity: 0.12, transform: 'scale(1.1)' }}>
              <ShoppingBag size={120} />
            </div>
            <div className="d-flex align-items-center justify-content-between mb-3.5">
              <span className="font-heading fw-bold" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.8px', color: '#FEF3C7' }}>Total Invoices</span>
              <ShoppingBag size={18} className="text-amber-200" />
            </div>
            <h2 className="m-0 fw-extrabold fs-1 font-heading" style={{ letterSpacing: '-0.5px' }}>{metrics.totalOrders}</h2>
            <div className="mt-2.5 d-flex align-items-center gap-1" style={{ fontSize: '0.72rem', color: '#FDE68A', fontWeight: '500' }}>
              <span>Total invoices logged across SaaS</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Shops Table & Search Container */}
      <div 
        className="p-4 rounded-4 bg-white shadow-sm" 
        style={{ 
          border: '1px solid rgba(226, 232, 240, 0.8)', 
          boxShadow: '0 20px 40px -15px rgba(15, 23, 42, 0.05)'
        }}
      >
        
        {/* Table Search & Title Header */}
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
          <h4 className="m-0 fw-extrabold font-heading text-dark" style={{ letterSpacing: '-0.5px' }}>Registered Tenant Storefronts</h4>
          
          <div className="position-relative" style={{ width: '340px' }}>
            <span className="position-absolute top-50 translate-middle-y start-0 ps-3.5 text-secondary" style={{ zIndex: 5 }}>
              <Search size={18} />
            </span>
            <input 
              type="text" 
              className="form-control ps-5" 
              placeholder="Search store name, owner, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ 
                borderRadius: '12px', 
                height: '44px',
                border: '1px solid #E2E8F0',
                fontSize: '0.85rem',
                backgroundColor: '#F8FAFC',
                transition: 'all 0.2s'
              }}
              onFocus={(e) => { e.currentTarget.style.backgroundColor = '#FFFFFF'; e.currentTarget.style.borderColor = '#2563EB'; e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(37, 99, 235, 0.08), 0 0 0 3px rgba(37, 99, 235, 0.12)'; }}
              onBlur={(e) => { e.currentTarget.style.backgroundColor = '#F8FAFC'; e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.boxShadow = 'none'; }}
            />
          </div>
        </div>

        {/* Responsive Table */}
        <div className="table-responsive">
          <table className="table align-middle table-hover m-0" style={{ borderCollapse: 'separate', borderSpacing: '0 4px' }}>
            <thead>
              <tr style={{ color: '#64748B', fontWeight: '700', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.8px', borderBottom: '1px solid #E2E8F0' }}>
                <th className="py-3.5 ps-4">Store Details</th>
                <th className="py-3.5">Owner Contacts</th>
                <th className="py-3.5">Subscription Tier</th>
                <th className="py-3.5">Status</th>
                <th className="py-3.5">SaaS Metrics</th>
                <th className="py-3.5 pe-4 text-end" style={{ width: '380px' }}>Controls</th>
              </tr>
            </thead>
            <tbody>
              {filteredShops.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-5 text-secondary">
                    <Building2 size={40} className="mb-2 text-muted opacity-50" />
                    <p className="m-0 fw-semibold">No tenant storefronts match your query.</p>
                  </td>
                </tr>
              ) : (
                filteredShops.map((shop) => {
                  const isExpired = shop.subscription_expiry && new Date(shop.subscription_expiry) < new Date();
                  
                  return (
                    <tr 
                      key={shop.id} 
                      className="align-middle border-bottom border-light-subtle premium-table-row"
                      style={{ cursor: 'default' }}
                    >
                      <td className="py-3.5 ps-3">
                        <div className="d-flex align-items-center gap-3">
                          <div 
                            className="rounded-4 d-flex align-items-center justify-content-center shadow-sm"
                            style={{ 
                              width: '46px', 
                              height: '46px', 
                              backgroundColor: '#EFF6FF',
                              border: '1px solid #BFDBFE',
                              fontSize: '1.25rem'
                            }}
                          >
                            🏪
                          </div>
                          <div>
                            <h6 className="m-0 fw-bold text-dark font-heading" style={{ fontSize: '0.92rem' }}>{shop.shop_name}</h6>
                            <span className="text-secondary font-monospace" style={{ fontSize: '0.72rem', letterSpacing: '-0.3px' }}>
                              ID: Store#{shop.id} • Ref: {shop.email.split('@')[0]}
                            </span>
                          </div>
                        </div>
                      </td>
                      
                      <td className="py-3.5">
                        <div className="d-flex flex-column">
                          <span className="fw-semibold text-dark" style={{ fontSize: '0.88rem' }}>{shop.owner_name}</span>
                          <span className="text-secondary" style={{ fontSize: '0.78rem' }}>{shop.email} • {shop.mobile}</span>
                        </div>
                      </td>
                      
                      <td className="py-3.5">
                        <div className="d-flex flex-column align-items-start gap-1">
                          <span 
                            className="px-2.5 py-1 rounded-pill fw-bold" 
                            style={{ 
                              fontSize: '0.7rem', 
                              backgroundColor: shop.subscription_plan === 'Enterprise' ? 'rgba(139, 92, 246, 0.1)' : shop.subscription_plan === 'Professional' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(100, 116, 139, 0.1)',
                              color: shop.subscription_plan === 'Enterprise' ? '#8B5CF6' : shop.subscription_plan === 'Professional' ? '#3B82F6' : '#64748B',
                              border: `1px solid ${shop.subscription_plan === 'Enterprise' ? 'rgba(139, 92, 246, 0.2)' : shop.subscription_plan === 'Professional' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(100, 116, 139, 0.2)'}`
                            }}
                          >
                            {shop.subscription_plan}
                          </span>
                          <span className="text-secondary d-flex align-items-center gap-1" style={{ fontSize: '0.74rem' }}>
                            <Calendar size={11} className="text-muted" />
                            {shop.subscription_expiry ? (
                              <span className={isExpired ? 'text-danger fw-extrabold' : 'fw-medium'}>
                                {isExpired ? 'EXPIRED' : `Expiry: ${new Date(shop.subscription_expiry).toLocaleDateString('en-IN')}`}
                              </span>
                            ) : (
                              'Unlimited Lifetime'
                            )}
                          </span>
                        </div>
                      </td>
                      
                      <td className="py-3.5">
                        <div className="d-flex flex-column align-items-start gap-1.5">
                          {/* Store status pill */}
                          {shop.status === 'Active' && !isExpired ? (
                            <span 
                              className="px-2.5 py-1 rounded-pill fw-bold d-inline-flex align-items-center gap-1" 
                              style={{ 
                                fontSize: '0.7rem', 
                                backgroundColor: 'rgba(16, 185, 129, 0.1)', 
                                color: '#10B981', 
                                border: '1px solid rgba(16, 185, 129, 0.2)' 
                              }}
                            >
                              <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#10B981', display: 'inline-block' }} />
                              Active
                            </span>
                          ) : shop.status === 'Suspended' ? (
                            <span 
                              className="px-2.5 py-1 rounded-pill fw-bold d-inline-flex align-items-center gap-1" 
                              style={{ 
                                fontSize: '0.7rem', 
                                backgroundColor: 'rgba(239, 68, 68, 0.1)', 
                                color: '#EF4444', 
                                border: '1px solid rgba(239, 68, 68, 0.2)' 
                              }}
                            >
                              <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#EF4444', display: 'inline-block' }} />
                              Suspended
                            </span>
                          ) : (
                            <span 
                              className="px-2.5 py-1 rounded-pill fw-bold d-inline-flex align-items-center gap-1" 
                              style={{ 
                                fontSize: '0.7rem', 
                                backgroundColor: 'rgba(245, 158, 11, 0.1)', 
                                color: '#F59E0B', 
                                border: '1px solid rgba(245, 158, 11, 0.2)' 
                              }}
                            >
                              <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#F59E0B', display: 'inline-block' }} />
                              Expired
                            </span>
                          )}
                          
                          {/* GST status pill */}
                          {shop.gst_enabled !== 0 && shop.gst_enabled !== false ? (
                            <span 
                              className="px-2.5 py-1 rounded-pill fw-bold d-inline-flex align-items-center gap-1" 
                              style={{ 
                                fontSize: '0.68rem', 
                                backgroundColor: 'rgba(37, 99, 235, 0.1)', 
                                color: '#2563EB', 
                                border: '1px solid rgba(37, 99, 235, 0.2)' 
                              }}
                            >
                              ⚡ GST Active
                            </span>
                          ) : (
                            <span 
                              className="px-2.5 py-1 rounded-pill fw-bold d-inline-flex align-items-center gap-1" 
                              style={{ 
                                fontSize: '0.68rem', 
                                backgroundColor: 'rgba(100, 116, 139, 0.1)', 
                                color: '#64748B', 
                                border: '1px solid rgba(100, 116, 139, 0.2)' 
                              }}
                            >
                              🔌 GST Exempt
                            </span>
                          )}
                        </div>
                      </td>
                      
                      <td className="py-3.5">
                        <div className="d-flex flex-column text-secondary" style={{ fontSize: '0.8rem' }}>
                          <span>Products: <strong className="text-dark fw-bold">{shop.total_products}</strong></span>
                          <span>Invoices: <strong className="text-dark fw-bold">{shop.total_orders}</strong></span>
                        </div>
                      </td>
                      
                      <td className="py-3.5 pe-3 text-end">
                        <div className="d-flex justify-content-end align-items-center gap-2">
                          
                          {/* Edit Shop Details button */}
                          <button 
                            onClick={() => handleEditDetailsClick(shop)}
                            className="btn btn-sm d-flex align-items-center gap-1.5 shadow-sm" 
                            title="Edit Shop Details & Owner Credentials"
                            style={{ 
                              padding: '7px 14px', 
                              borderRadius: '10px', 
                              backgroundColor: 'rgba(37, 99, 235, 0.06)', 
                              color: '#2563EB',
                              border: '1px solid rgba(37, 99, 235, 0.12)',
                              fontWeight: '600',
                              transition: 'all 0.2s ease',
                              boxShadow: '0 2px 4px rgba(37, 99, 235, 0.03)'
                            }}
                            onMouseOver={(e) => { 
                              e.currentTarget.style.backgroundColor = '#2563EB'; 
                              e.currentTarget.style.color = '#FFFFFF';
                              e.currentTarget.style.transform = 'translateY(-1px)';
                              e.currentTarget.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.18)';
                            }}
                            onMouseOut={(e) => { 
                              e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 0.06)'; 
                              e.currentTarget.style.color = '#2563EB';
                              e.currentTarget.style.transform = 'translateY(0)';
                              e.currentTarget.style.boxShadow = '0 2px 4px rgba(37, 99, 235, 0.03)';
                            }}
                          >
                            <FilePenLine size={13.5} />
                            <span style={{ fontSize: '0.75rem', letterSpacing: '0.2px' }}>Edit</span>
                          </button>

                          {/* Reset credentials button */}
                          <button 
                            onClick={() => handleResetPasswordClick(shop)}
                            className="btn btn-sm d-flex align-items-center gap-1.5 shadow-sm" 
                            title="Reset Owner Password"
                            disabled={!shop.owner_username || shop.owner_username === 'N/A'}
                            style={{ 
                              padding: '7px 14px', 
                              borderRadius: '10px', 
                              backgroundColor: 'rgba(99, 102, 241, 0.06)', 
                              color: '#4F46E5',
                              border: '1px solid rgba(99, 102, 241, 0.12)',
                              fontWeight: '600',
                              transition: 'all 0.2s ease',
                              boxShadow: '0 2px 4px rgba(99, 102, 241, 0.03)'
                            }}
                            onMouseOver={(e) => { 
                              e.currentTarget.style.backgroundColor = '#4F46E5'; 
                              e.currentTarget.style.color = '#FFFFFF';
                              e.currentTarget.style.transform = 'translateY(-1px)';
                              e.currentTarget.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.18)';
                            }}
                            onMouseOut={(e) => { 
                              e.currentTarget.style.backgroundColor = 'rgba(99, 102, 241, 0.06)'; 
                              e.currentTarget.style.color = '#4F46E5';
                              e.currentTarget.style.transform = 'translateY(0)';
                              e.currentTarget.style.boxShadow = '0 2px 4px rgba(99, 102, 241, 0.03)';
                            }}
                          >
                            <KeyRound size={13.5} />
                            <span style={{ fontSize: '0.75rem', letterSpacing: '0.2px' }}>Reset</span>
                          </button>

                          {/* Suspend / Activate toggle button */}
                          <button 
                            onClick={() => handleToggleStatus(shop.id, shop.status)}
                            className="btn btn-sm d-flex align-items-center gap-1.5 shadow-sm"
                            title={shop.status === 'Active' ? 'Suspend Storefront' : 'Activate Storefront'}
                            style={{ 
                              padding: '7px 14px', 
                              borderRadius: '10px', 
                              backgroundColor: shop.status === 'Active' ? 'rgba(239, 68, 68, 0.06)' : 'rgba(16, 185, 129, 0.06)', 
                              color: shop.status === 'Active' ? '#EF4444' : '#10B981',
                              border: `1px solid ${shop.status === 'Active' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)'}`,
                              fontWeight: '600',
                              transition: 'all 0.2s ease',
                              boxShadow: shop.status === 'Active' ? '0 2px 4px rgba(239, 68, 68, 0.03)' : '0 2px 4px rgba(16, 185, 129, 0.03)'
                            }}
                            onMouseOver={(e) => { 
                              e.currentTarget.style.backgroundColor = shop.status === 'Active' ? '#EF4444' : '#10B981'; 
                              e.currentTarget.style.color = '#FFFFFF'; 
                              e.currentTarget.style.transform = 'translateY(-1px)';
                              e.currentTarget.style.boxShadow = shop.status === 'Active' ? '0 4px 12px rgba(239, 68, 68, 0.18)' : '0 4px 12px rgba(16, 185, 129, 0.18)'; 
                            }}
                            onMouseOut={(e) => { 
                              e.currentTarget.style.backgroundColor = shop.status === 'Active' ? 'rgba(239, 68, 68, 0.06)' : 'rgba(16, 185, 129, 0.06)'; 
                              e.currentTarget.style.color = shop.status === 'Active' ? '#EF4444' : '#10B981'; 
                              e.currentTarget.style.transform = 'translateY(0)';
                              e.currentTarget.style.boxShadow = shop.status === 'Active' ? '0 2px 4px rgba(239, 68, 68, 0.03)' : '0 2px 4px rgba(16, 185, 129, 0.03)';
                            }}
                          >
                            <Lock size={13.5} />
                            <span style={{ fontSize: '0.75rem', letterSpacing: '0.2px' }}>
                              {shop.status === 'Active' ? 'Suspend' : 'Activate'}
                            </span>
                          </button>

                          {/* Toggle GST button */}
                          <button 
                            onClick={() => handleToggleGst(shop.id, shop.gst_enabled !== 0 && shop.gst_enabled !== false, shop.shop_name)}
                            className="btn btn-sm d-flex align-items-center gap-1.5 shadow-sm"
                            title="Toggle GST Billing Status"
                            style={{ 
                              padding: '7px 14px', 
                              borderRadius: '10px', 
                              backgroundColor: shop.gst_enabled !== 0 && shop.gst_enabled !== false ? 'rgba(245, 158, 11, 0.06)' : 'rgba(71, 85, 105, 0.06)', 
                              color: shop.gst_enabled !== 0 && shop.gst_enabled !== false ? '#D97706' : '#475569',
                              border: `1px solid ${shop.gst_enabled !== 0 && shop.gst_enabled !== false ? 'rgba(245, 158, 11, 0.12)' : 'rgba(71, 85, 105, 0.12)'}`,
                              fontWeight: '600',
                              transition: 'all 0.2s ease',
                              boxShadow: shop.gst_enabled !== 0 && shop.gst_enabled !== false ? '0 2px 4px rgba(245, 158, 11, 0.03)' : '0 2px 4px rgba(71, 85, 105, 0.03)'
                            }}
                            onMouseOver={(e) => { 
                              e.currentTarget.style.backgroundColor = shop.gst_enabled !== 0 && shop.gst_enabled !== false ? '#D97706' : '#475569'; 
                              e.currentTarget.style.color = '#FFFFFF'; 
                              e.currentTarget.style.transform = 'translateY(-1px)';
                              e.currentTarget.style.boxShadow = shop.gst_enabled !== 0 && shop.gst_enabled !== false ? '0 4px 12px rgba(245, 158, 11, 0.18)' : '0 4px 12px rgba(71, 85, 105, 0.18)';
                            }}
                            onMouseOut={(e) => { 
                              e.currentTarget.style.backgroundColor = shop.gst_enabled !== 0 && shop.gst_enabled !== false ? 'rgba(245, 158, 11, 0.06)' : 'rgba(71, 85, 105, 0.06)'; 
                              e.currentTarget.style.color = shop.gst_enabled !== 0 && shop.gst_enabled !== false ? '#D97706' : '#475569'; 
                              e.currentTarget.style.transform = 'translateY(0)';
                              e.currentTarget.style.boxShadow = shop.gst_enabled !== 0 && shop.gst_enabled !== false ? '0 2px 4px rgba(245, 158, 11, 0.03)' : '0 2px 4px rgba(71, 85, 105, 0.03)';
                            }}
                          >
                            <span style={{ fontSize: '0.85rem' }}>{shop.gst_enabled !== 0 && shop.gst_enabled !== false ? '⚡' : '🔌'}</span>
                            <span style={{ fontSize: '0.75rem', letterSpacing: '0.2px' }}>GST</span>
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

      {/* MODAL 1: Create Shop */}
      {showCreateModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(15, 23, 42, 0.55)', backdropFilter: 'blur(4px)' }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content border-0 rounded-4" style={{ boxShadow: '0 20px 50px rgba(0, 0, 0, 0.15)' }}>
              
              <div className="modal-header border-bottom p-4">
                <div className="d-flex align-items-center gap-2">
                  <span className="fs-3">🏪</span>
                  <div>
                    <h5 className="modal-title fw-bold font-heading m-0">Provision New Tenant Store</h5>
                    <p className="m-0 text-muted" style={{ fontSize: '0.8rem' }}>Generates store mapping, seeding, and administrator owner atomically</p>
                  </div>
                </div>
                <button type="button" className="btn-close" onClick={() => setShowCreateModal(false)} aria-label="Close"></button>
              </div>
              
              <form onSubmit={handleCreateShopSubmit}>
                <div className="modal-body p-4" style={{ maxHeight: 'calc(100vh - 250px)', overflowY: 'auto' }}>
                  
                  {formSuccess && (
                    <div className="alert alert-success rounded-3 p-3 mb-3 d-flex align-items-center gap-2">
                      <CheckCircle2 size={20} />
                      <span>{formSuccess}</span>
                    </div>
                  )}

                  {formError && (
                    <div className="alert alert-danger rounded-3 p-3 mb-3 d-flex align-items-center gap-2">
                      <AlertTriangle size={20} />
                      <span>{formError}</span>
                    </div>
                  )}

                  <h6 className="text-primary font-heading fw-bold mb-3 border-bottom pb-2" style={{ letterSpacing: '0.5px' }}>1. Retail Shop Parameters</h6>
                  <div className="row g-3 mb-4">
                    <div className="col-12 col-md-6">
                      <label className="form-label text-muted fw-bold small">Shop / Store Name *</label>
                      <input 
                        type="text" 
                        required
                        className="form-control" 
                        placeholder="e.g. Trendz Garments Outlet"
                        value={createForm.shop_name}
                        onChange={(e) => setCreateForm({ ...createForm, shop_name: e.target.value })}
                      />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label text-muted fw-bold small">Shop GSTIN Number (Optional)</label>
                      <input 
                        type="text" 
                        maxLength={15}
                        className="form-control text-uppercase" 
                        placeholder="e.g. 27ABCDE1234A1Z1"
                        value={createForm.gst_number}
                        onChange={(e) => setCreateForm({ ...createForm, gst_number: e.target.value })}
                      />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label text-muted fw-bold small">Contact Email *</label>
                      <input 
                        type="email" 
                        required
                        className="form-control" 
                        placeholder="e.g. billing@trendz.com"
                        value={createForm.email}
                        onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                      />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label text-muted fw-bold small">Mobile Phone *</label>
                      <input 
                        type="tel" 
                        required
                        className="form-control" 
                        placeholder="e.g. 9876543210"
                        value={createForm.mobile}
                        onChange={(e) => setCreateForm({ ...createForm, mobile: e.target.value })}
                      />
                    </div>
                    <div className="col-12">
                      <label className="form-label text-muted fw-bold small">Physical Address</label>
                      <textarea 
                        className="form-control" 
                        rows="2"
                        placeholder="Complete location address details..."
                        value={createForm.address}
                        onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })}
                      />
                    </div>
                  </div>

                  <h6 className="text-primary font-heading fw-bold mb-3 border-bottom pb-2" style={{ letterSpacing: '0.5px' }}>2. Subscription Plan Billing</h6>
                  <div className="row g-3 mb-4">
                    <div className="col-12 col-md-4">
                      <label className="form-label text-muted fw-bold small">Subscription Plan *</label>
                      <select 
                        className="form-select"
                        value={createForm.subscription_plan}
                        onChange={(e) => setCreateForm({ ...createForm, subscription_plan: e.target.value })}
                      >
                        <option value="Starter">Starter Plan</option>
                        <option value="Professional">Professional Tier</option>
                        <option value="Enterprise">Enterprise Elite</option>
                      </select>
                    </div>
                    <div className="col-12 col-md-4">
                      <label className="form-label text-muted fw-bold small">Plan Expiry Date *</label>
                      <input 
                        type="date" 
                        required
                        className="form-control"
                        value={createForm.subscription_expiry}
                        onChange={(e) => setCreateForm({ ...createForm, subscription_expiry: e.target.value })}
                      />
                    </div>
                    <div className="col-12 col-md-4 d-flex align-items-end">
                      <div className="form-check form-switch mb-2">
                        <input 
                          className="form-check-input" 
                          type="checkbox" 
                          id="gst-billing-switch"
                          checked={createForm.gst_enabled}
                          onChange={(e) => setCreateForm({ ...createForm, gst_enabled: e.target.checked })}
                          style={{ cursor: 'pointer' }}
                        />
                        <label className="form-check-label fw-bold text-dark small" htmlFor="gst-billing-switch" style={{ cursor: 'pointer' }}>
                          🔌 Enable GST Billing
                        </label>
                      </div>
                    </div>
                  </div>

                  <h6 className="text-primary font-heading fw-bold mb-3 border-bottom pb-2" style={{ letterSpacing: '0.5px' }}>3. Store Owner Portal Credentials</h6>
                  <div className="row g-3">
                    <div className="col-12 col-md-6">
                      <label className="form-label text-muted fw-bold small">Store Owner Name *</label>
                      <input 
                        type="text" 
                        required
                        className="form-control" 
                        placeholder="Owner full name"
                        value={createForm.owner_name}
                        onChange={(e) => setCreateForm({ ...createForm, owner_name: e.target.value })}
                      />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label text-muted fw-bold small">Login Username *</label>
                      <input 
                        type="text" 
                        required
                        className="form-control" 
                        placeholder="e.g. trendz_owner"
                        value={createForm.username}
                        onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                      />
                    </div>
                    <div className="col-12">
                      <label className="form-label text-muted fw-bold small">Portal Access Password *</label>
                      <input 
                        type="password" 
                        required
                        minLength={6}
                        className="form-control" 
                        placeholder="Minimum 6 characters securely hashed"
                        value={createForm.password}
                        onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                      />
                    </div>
                  </div>

                </div>
                <div className="modal-footer border-top p-4 d-flex justify-content-end gap-2">
                  <button type="button" className="btn btn-outline-secondary" style={{ borderRadius: '10px' }} onClick={() => setShowCreateModal(false)}>
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    style={{ borderRadius: '10px' }}
                    disabled={formLoading}
                  >
                    {formLoading ? 'Provisioning Shop...' : 'Register & Deploy Store'}
                  </button>
                </div>
              </form>

            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Reset Password */}
      {showResetPasswordModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(15, 23, 42, 0.55)', backdropFilter: 'blur(4px)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 rounded-4" style={{ boxShadow: '0 20px 50px rgba(0, 0, 0, 0.15)' }}>
              
              <div className="modal-header border-bottom p-4">
                <div className="d-flex align-items-center gap-2">
                  <span className="fs-3">🔑</span>
                  <div>
                    <h5 className="modal-title fw-bold font-heading m-0">Modify Owner Password</h5>
                    <p className="m-0 text-muted" style={{ fontSize: '0.8rem' }}>Store: {selectedShop?.shop_name} • User: {selectedShop?.owner_username}</p>
                  </div>
                </div>
                <button type="button" className="btn-close" onClick={() => setShowResetPasswordModal(false)} aria-label="Close"></button>
              </div>
              
              <form onSubmit={handleResetPasswordSubmit}>
                <div className="modal-body p-4">
                  
                  {formSuccess && (
                    <div className="alert alert-success rounded-3 p-3 mb-3 d-flex align-items-center gap-2">
                      <CheckCircle2 size={20} />
                      <span>{formSuccess}</span>
                    </div>
                  )}

                  {formError && (
                    <div className="alert alert-danger rounded-3 p-3 mb-3 d-flex align-items-center gap-2">
                      <AlertTriangle size={20} />
                      <span>{formError}</span>
                    </div>
                  )}

                  <div className="mb-3">
                    <label className="form-label text-muted fw-bold small">New Password *</label>
                    <input 
                      type="password" 
                      required
                      minLength={6}
                      className="form-control"
                      placeholder="Minimum 6 characters"
                      value={resetPasswordForm.password}
                      onChange={(e) => setResetPasswordForm({ ...resetPasswordForm, password: e.target.value })}
                    />
                    <small className="text-muted d-block mt-2">
                      Warning: Resetting owner credentials will immediately terminate all active sessions for this owner username.
                    </small>
                  </div>

                </div>
                <div className="modal-footer border-top p-4 d-flex justify-content-end gap-2">
                  <button type="button" className="btn btn-outline-secondary" style={{ borderRadius: '10px' }} onClick={() => setShowResetPasswordModal(false)}>
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-danger"
                    style={{ borderRadius: '10px' }}
                    disabled={formLoading}
                  >
                    {formLoading ? 'Resetting...' : 'Reset Credentials'}
                  </button>
                </div>
              </form>

            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Edit Shop Details & Owner Credentials */}
      {showEditDetailsModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(15, 23, 42, 0.55)', backdropFilter: 'blur(4px)' }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content border-0 rounded-4" style={{ boxShadow: '0 20px 50px rgba(0, 0, 0, 0.15)' }}>
              
              <div className="modal-header border-bottom p-4">
                <div className="d-flex align-items-center gap-2">
                  <span className="fs-3">🛠️</span>
                  <div>
                    <h5 className="modal-title fw-bold font-heading m-0">Edit Store & Owner Account</h5>
                    <p className="m-0 text-muted" style={{ fontSize: '0.8rem' }}>Modify store parameters, subscription tiers, and owner credentials</p>
                  </div>
                </div>
                <button type="button" className="btn-close" onClick={() => setShowEditDetailsModal(false)} aria-label="Close"></button>
              </div>
              
              <form onSubmit={handleEditDetailsSubmit}>
                <div className="modal-body p-4" style={{ maxHeight: 'calc(100vh - 250px)', overflowY: 'auto' }}>
                  
                  {formSuccess && (
                    <div className="alert alert-success rounded-3 p-3 mb-3 d-flex align-items-center gap-2">
                      <CheckCircle2 size={20} />
                      <span>{formSuccess}</span>
                    </div>
                  )}

                  {formError && (
                    <div className="alert alert-danger rounded-3 p-3 mb-3 d-flex align-items-center gap-2">
                      <AlertTriangle size={20} />
                      <span>{formError}</span>
                    </div>
                  )}

                  <h6 className="text-primary font-heading fw-bold mb-3 border-bottom pb-2" style={{ letterSpacing: '0.5px' }}>1. Retail Shop Parameters</h6>
                  <div className="row g-3 mb-4">
                    <div className="col-12 col-md-6">
                      <label className="form-label text-muted fw-bold small">Shop / Store Name *</label>
                      <input 
                        type="text" 
                        required
                        className="form-control" 
                        placeholder="e.g. Trendz Garments Outlet"
                        value={editDetailsForm.shop_name}
                        onChange={(e) => setEditDetailsForm({ ...editDetailsForm, shop_name: e.target.value })}
                      />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label text-muted fw-bold small">Shop GSTIN Number (Optional)</label>
                      <input 
                        type="text" 
                        maxLength={15}
                        className="form-control text-uppercase" 
                        placeholder="e.g. 27ABCDE1234A1Z1"
                        value={editDetailsForm.gst_number || ''}
                        onChange={(e) => setEditDetailsForm({ ...editDetailsForm, gst_number: e.target.value })}
                      />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label text-muted fw-bold small">Contact Email *</label>
                      <input 
                        type="email" 
                        required
                        className="form-control" 
                        placeholder="e.g. billing@trendz.com"
                        value={editDetailsForm.email}
                        onChange={(e) => setEditDetailsForm({ ...editDetailsForm, email: e.target.value })}
                      />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label text-muted fw-bold small">Mobile Phone *</label>
                      <input 
                        type="tel" 
                        required
                        className="form-control" 
                        placeholder="e.g. 9876543210"
                        value={editDetailsForm.mobile}
                        onChange={(e) => setEditDetailsForm({ ...editDetailsForm, mobile: e.target.value })}
                      />
                    </div>
                    <div className="col-12">
                      <label className="form-label text-muted fw-bold small">Physical Address</label>
                      <textarea 
                        className="form-control" 
                        rows="2"
                        placeholder="Complete location address details..."
                        value={editDetailsForm.address || ''}
                        onChange={(e) => setEditDetailsForm({ ...editDetailsForm, address: e.target.value })}
                      />
                    </div>
                  </div>

                  <h6 className="text-primary font-heading fw-bold mb-3 border-bottom pb-2" style={{ letterSpacing: '0.5px' }}>2. Subscription Plan Billing</h6>
                  <div className="row g-3 mb-4">
                    <div className="col-12 col-md-4">
                      <label className="form-label text-muted fw-bold small">Subscription Plan *</label>
                      <select 
                        className="form-select"
                        value={editDetailsForm.subscription_plan}
                        onChange={(e) => setEditDetailsForm({ ...editDetailsForm, subscription_plan: e.target.value })}
                      >
                        <option value="Starter">Starter Plan</option>
                        <option value="Professional">Professional Tier</option>
                        <option value="Enterprise">Enterprise Elite</option>
                      </select>
                    </div>
                    <div className="col-12 col-md-4">
                      <label className="form-label text-muted fw-bold small">Plan Expiry Date *</label>
                      <input 
                        type="date" 
                        required
                        className="form-control"
                        value={editDetailsForm.subscription_expiry}
                        onChange={(e) => setEditDetailsForm({ ...editDetailsForm, subscription_expiry: e.target.value })}
                      />
                    </div>
                    <div className="col-12 col-md-4 d-flex align-items-end">
                      <div className="form-check form-switch mb-2">
                        <input 
                          className="form-check-input" 
                          type="checkbox" 
                          id="edit-gst-billing-switch"
                          checked={editDetailsForm.gst_enabled}
                          onChange={(e) => setEditDetailsForm({ ...editDetailsForm, gst_enabled: e.target.checked })}
                          style={{ cursor: 'pointer' }}
                        />
                        <label className="form-check-label fw-bold text-dark small" htmlFor="edit-gst-billing-switch" style={{ cursor: 'pointer' }}>
                          🔌 Enable GST Billing
                        </label>
                      </div>
                    </div>
                  </div>

                  <h6 className="text-primary font-heading fw-bold mb-3 border-bottom pb-2" style={{ letterSpacing: '0.5px' }}>3. Store Owner Portal Credentials</h6>
                  <div className="row g-3">
                    <div className="col-12 col-md-6">
                      <label className="form-label text-muted fw-bold small">Store Owner Name *</label>
                      <input 
                        type="text" 
                        required
                        className="form-control" 
                        placeholder="Owner full name"
                        value={editDetailsForm.owner_name}
                        onChange={(e) => setEditDetailsForm({ ...editDetailsForm, owner_name: e.target.value })}
                      />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label text-muted fw-bold small">Login Username *</label>
                      <input 
                        type="text" 
                        required
                        className="form-control" 
                        placeholder="e.g. trendz_owner"
                        value={editDetailsForm.username}
                        onChange={(e) => setEditDetailsForm({ ...editDetailsForm, username: e.target.value })}
                      />
                    </div>
                    <div className="col-12">
                      <label className="form-label text-muted fw-bold small">Portal Access Password (Optional)</label>
                      <input 
                        type="password" 
                        minLength={6}
                        className="form-control" 
                        placeholder="Leave blank to keep existing password, or enter new (Min 6 chars)"
                        value={editDetailsForm.password}
                        onChange={(e) => setEditDetailsForm({ ...editDetailsForm, password: e.target.value })}
                      />
                    </div>
                  </div>

                </div>
                <div className="modal-footer border-top p-4 d-flex justify-content-end gap-2">
                  <button type="button" className="btn btn-outline-secondary" style={{ borderRadius: '10px' }} onClick={() => setShowEditDetailsModal(false)}>
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    style={{ borderRadius: '10px' }}
                    disabled={formLoading}
                  >
                    {formLoading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>

            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default SaasDashboard;
