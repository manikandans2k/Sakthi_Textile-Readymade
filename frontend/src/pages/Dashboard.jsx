import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { DollarSign, ShoppingCart, Package, AlertTriangle, RefreshCw, PlusCircle, ShoppingBag, Warehouse, Users } from 'lucide-react';

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [restockSubmitting, setRestockSubmitting] = useState(null);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await axiosInstance.get('/dashboard/stats');
      setStats(response.data);
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
      setError(err.response?.data?.message || 'Failed to fetch analytical dashboard statistics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && (user.role === 'Shop Owner' || user.role === 'Admin' || user.role === 'Manager')) {
      fetchDashboardStats();
    } else {
      setLoading(false);
    }
  }, [user]);

  // Quick Restock Handler: Adds +50 units of stock instantly to help demo/testing
  const handleQuickRestock = async (productId, currentStock) => {
    try {
      setRestockSubmitting(productId);
      const newStock = currentStock + 50;
      await axiosInstance.put(`/products/${productId}`, { stock: newStock });
      
      // Update local state without doing full reload
      setStats(prev => {
        const updatedLowStock = prev.lowStock.filter(p => p.id !== productId);
        return {
          ...prev,
          totalStockUnits: prev.totalStockUnits + 50,
          lowStock: updatedLowStock
        };
      });
    } catch (err) {
      alert('Failed to restock product. Please try again.');
    } finally {
      setRestockSubmitting(null);
    }
  };

  if (loading) {
    return (
      <div className="d-flex flex-column align-items-center justify-content-center py-5" style={{ minHeight: '300px' }}>
        <div className="spinner-border text-primary mb-3" role="status" style={{ width: '3rem', height: '3rem' }}>
          <span className="visually-hidden">Loading ERP Stats...</span>
        </div>
        <p className="text-muted font-heading">Analyzing transactions and stock metrics...</p>
      </div>
    );
  }

  const isAdminOrManager = user && (user.role === 'Shop Owner' || user.role === 'Admin' || user.role === 'Manager');

  if (!isAdminOrManager) {
    return (
      <div className="d-flex align-items-center justify-content-center py-5 fade-in" style={{ minHeight: '80vh' }}>
        <div className="premium-card p-5 text-center shadow-lg" style={{ maxWidth: '600px', backgroundColor: '#1E293B', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
          <div className="d-flex justify-content-center mb-4">
            <span className="fs-1">🧵</span>
          </div>
          <h3 className="font-heading fw-bold text-white mb-2" style={{ letterSpacing: '0.5px' }}>
            TextTail ERP Workspace Portal
          </h3>
          <p className="text-muted mb-4" style={{ fontSize: '0.95rem' }}>
            Welcome back, <strong className="text-white">{user?.username}</strong>! Your account is configured with the <span className="badge rounded-pill bg-secondary bg-opacity-20 text-white px-3 py-1 font-heading" style={{ fontSize: '0.8rem' }}>{user?.role}</span> role.
          </p>
          
          <div className="border-top border-secondary border-opacity-30 pt-4 mt-2">
            <p className="text-light text-opacity-70 mb-4" style={{ fontSize: '0.9rem' }}>
              Analytical dashboard metrics and financial reporting are restricted to administrative accounts. Please select your primary workspace path below:
            </p>
            
            <div className="d-flex flex-column gap-3">
              {(user?.role === 'Cashier') && (
                <button 
                  onClick={() => navigate('/pos')}
                  className="btn btn-primary d-flex align-items-center justify-content-center gap-2 py-3 fw-semibold font-heading"
                  style={{ backgroundColor: '#2563EB', borderColor: '#2563EB' }}
                >
                  <ShoppingBag size={20} />
                  <span>Launch POS Checkout Terminal</span>
                </button>
              )}
              
              {(user?.role === 'Stock Manager') && (
                <>
                  <button 
                    onClick={() => navigate('/inventory')}
                    className="btn btn-primary d-flex align-items-center justify-content-center gap-2 py-3 fw-semibold font-heading"
                    style={{ backgroundColor: '#2563EB', borderColor: '#2563EB' }}
                  >
                    <Package size={20} />
                    <span>Open Inventory Control Centre</span>
                  </button>
                  
                  <button 
                    onClick={() => navigate('/warehouses')}
                    className="btn btn-outline-light d-flex align-items-center justify-content-center gap-2 py-3 fw-semibold font-heading"
                    style={{ border: '1px solid rgba(255, 255, 255, 0.15)', color: '#FFFFFF' }}
                  >
                    <Warehouse size={20} />
                    <span>Manage Warehouse Depots</span>
                  </button>
                </>
              )}
              
              <button 
                onClick={() => navigate('/customers')}
                className="btn btn-outline-secondary d-flex align-items-center justify-content-center gap-2 py-2 fw-semibold text-white border-secondary"
                style={{ fontSize: '0.9rem' }}
              >
                <Users size={16} />
                <span>View Customer Registry</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="custom-alert-warning p-4 rounded-3 d-flex flex-column gap-3 max-width-600 m-auto mt-4">
        <div className="d-flex align-items-center gap-2">
          <AlertTriangle size={24} style={{ color: '#F59E0B' }} />
          <h5 className="m-0 font-heading fw-bold" style={{ color: '#F59E0B' }}>Analytics Access Warning</h5>
        </div>
        <p className="m-0" style={{ fontSize: '0.95rem' }}>{error}</p>
        <button className="btn btn-warning w-25 mt-2 text-white" onClick={fetchDashboardStats}>
          Retry Query
        </button>
      </div>
    );
  }

  if (!stats) return null;

  // Find max sales day to scale CSS sales trend bars appropriately
  const maxDaySales = Math.max(...stats.salesTrend.map(d => Number(d.totalSales)), 1);

  return (
    <div className="fade-in">
      {/* Upper Metrics Grid */}
      <div className="row g-4 mb-4">
        {/* Card 1: Today's Revenue */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="premium-card p-4 d-flex align-items-center justify-content-between">
            <div>
              <span className="text-muted d-block font-heading text-uppercase tracking-wider mb-1" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                Today's Revenue
              </span>
              <h3 className="m-0 fw-bold font-heading text-dark" style={{ letterSpacing: '-0.5px' }}>
                ${stats.todayRevenue.toFixed(2)}
              </h3>
            </div>
            <div className="rounded-3 p-3 bg-primary bg-opacity-10 text-primary d-flex align-items-center justify-content-center" style={{ border: '1px solid rgba(37, 99, 235, 0.2)' }}>
              <DollarSign size={24} style={{ color: '#2563EB' }} />
            </div>
          </div>
        </div>

        {/* Card 2: Today's Transactions */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="premium-card p-4 d-flex align-items-center justify-content-between">
            <div>
              <span className="text-muted d-block font-heading text-uppercase tracking-wider mb-1" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                Daily Transactions
              </span>
              <h3 className="m-0 fw-bold font-heading text-dark" style={{ letterSpacing: '-0.5px' }}>
                {stats.todaySalesCount}
              </h3>
            </div>
            <div className="rounded-3 p-3 bg-opacity-10 d-flex align-items-center justify-content-center" style={{ backgroundColor: 'rgba(15, 23, 42, 0.05)', border: '1px solid rgba(15, 23, 42, 0.1)' }}>
              <ShoppingCart size={24} style={{ color: '#0F172A' }} />
            </div>
          </div>
        </div>

        {/* Card 3: Unique Catalogued Products */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="premium-card p-4 d-flex align-items-center justify-content-between">
            <div>
              <span className="text-muted d-block font-heading text-uppercase tracking-wider mb-1" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                Unique Categories
              </span>
              <h3 className="m-0 fw-bold font-heading text-dark" style={{ letterSpacing: '-0.5px' }}>
                {stats.totalProductsCount} Products
              </h3>
            </div>
            <div className="rounded-3 p-3 bg-opacity-10 d-flex align-items-center justify-content-center" style={{ backgroundColor: 'rgba(15, 23, 42, 0.05)', border: '1px solid rgba(15, 23, 42, 0.1)' }}>
              <Package size={24} style={{ color: '#0F172A' }} />
            </div>
          </div>
        </div>

        {/* Card 4: Total Stock In Hand */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="premium-card p-4 d-flex align-items-center justify-content-between">
            <div>
              <span className="text-muted d-block font-heading text-uppercase tracking-wider mb-1" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                Total Stock Units
              </span>
              <h3 className="m-0 fw-bold font-heading text-dark" style={{ letterSpacing: '-0.5px' }}>
                {stats.totalStockUnits} Pcs
              </h3>
            </div>
            <div className="rounded-3 p-3 bg-accent-gradient bg-opacity-10 d-flex align-items-center justify-content-center" style={{ border: '1px solid rgba(245, 158, 11, 0.2)' }}>
              <ShoppingBag size={24} style={{ color: '#F59E0B' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Main Charts & Alert sections */}
      <div className="row g-4 mb-4">
        {/* Weekly Revenue Trend Bar Chart (Custom High-End SVG/CSS Styling) */}
        <div className="col-12 col-xl-7">
          <div className="premium-card p-4 h-100">
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h5 className="m-0 font-heading fw-bold">7-Day Revenue Trend</h5>
              <button className="btn btn-sm btn-outline-secondary p-1 border-0" onClick={fetchDashboardStats}>
                <RefreshCw size={16} />
              </button>
            </div>

            {/* Custom Responsive Pure CSS Chart */}
            <div className="d-flex justify-content-between align-items-end pt-3 pb-2 px-2" style={{ height: '240px', borderBottom: '2px solid #E2E8F0' }}>
              {stats.salesTrend.map((day, idx) => {
                const dayHeight = Math.max(10, (day.totalSales / maxDaySales) * 100);
                const isToday = idx === stats.salesTrend.length - 1;
                const dateObj = new Date(day.date);
                const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });

                return (
                  <div key={day.date} className="d-flex flex-column align-items-center flex-grow-1" style={{ maxWidth: '60px' }}>
                    {/* Tooltip on hover */}
                    <span 
                      className="badge mb-2 font-heading" 
                      style={{ 
                        fontSize: '0.7rem', 
                        backgroundColor: isToday ? '#2563EB' : '#0F172A',
                        color: 'white' 
                      }}
                    >
                      ${Number(day.totalSales).toFixed(0)}
                    </span>
                    {/* Visual Bar with sleek animation */}
                    <div 
                      className="w-50 rounded-top"
                      style={{ 
                        height: `${dayHeight}px`, 
                        backgroundColor: isToday ? '#2563EB' : 'rgba(15, 23, 42, 0.85)',
                        transition: 'height 0.8s ease-out',
                        boxShadow: isToday ? '0 4px 10px rgba(37, 99, 235, 0.3)' : 'none'
                      }}
                    ></div>
                    <span className="text-muted mt-2" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                      {dayName}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="d-flex justify-content-center gap-4 mt-3 text-muted" style={{ fontSize: '0.8rem' }}>
              <div className="d-flex align-items-center gap-2">
                <div style={{ width: '12px', height: '12px', backgroundColor: 'rgba(15, 23, 42, 0.85)', borderRadius: '3px' }}></div>
                <span>Historical Days</span>
              </div>
              <div className="d-flex align-items-center gap-2">
                <div style={{ width: '12px', height: '12px', backgroundColor: '#2563EB', borderRadius: '3px' }}></div>
                <span>Today's Total</span>
              </div>
            </div>
          </div>
        </div>

        {/* Low Stock Alerts Centre */}
        <div className="col-12 col-xl-5">
          <div className="premium-card p-4 h-100">
            <h5 className="m-0 font-heading fw-bold mb-3 d-flex align-items-center gap-2">
              <AlertTriangle size={20} className="text-warning" style={{ color: '#F59E0B' }} />
              <span>Low Stock Alerts</span>
            </h5>
            <p className="text-muted mb-4" style={{ fontSize: '0.85rem' }}>
              The following garment stock items are running low (under 10 pieces). Restock immediately to maintain seamless POS operations.
            </p>

            <div className="overflow-auto" style={{ maxHeight: '230px' }}>
              {stats.lowStock.length === 0 ? (
                <div className="text-center py-4 text-success font-heading" style={{ fontSize: '0.9rem' }}>
                  🎉 All garment categories are fully stocked!
                </div>
              ) : (
                <div className="d-flex flex-column gap-2">
                  {stats.lowStock.map(product => (
                    <div key={product.id} className="p-3 border rounded-3 d-flex justify-content-between align-items-center bg-light">
                      <div>
                        <h6 className="m-0 font-heading text-dark" style={{ fontSize: '0.9rem' }}>
                          {product.name}
                        </h6>
                        <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                          SKU: {product.sku} | Cat: {product.category}
                        </span>
                      </div>
                      <div className="d-flex align-items-center gap-3">
                        <span className="badge badge-low-stock px-2 py-1">
                          {product.stock} {product.unit} left
                        </span>
                        
                        <button 
                          className="btn btn-sm btn-primary p-2 d-flex align-items-center justify-content-center"
                          style={{ width: '32px', height: '32px', borderRadius: '8px' }}
                          title="Restock +50 Units"
                          onClick={() => handleQuickRestock(product.id, product.stock)}
                          disabled={restockSubmitting === product.id}
                        >
                          {restockSubmitting === product.id ? (
                            <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" style={{ width: '12px', height: '12px' }}></span>
                          ) : (
                            <PlusCircle size={16} />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Product Category Breakdown + Recent Transactions logs */}
      <div className="row g-4">
        {/* Left Side: Recent Sales Log */}
        <div className="col-12 col-lg-7">
          <div className="premium-card p-4 h-100">
            <h5 className="font-heading fw-bold mb-4">Recent Transactions</h5>
            <div className="table-responsive">
              <table className="table table-hover align-middle">
                <thead className="table-light">
                  <tr style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    <th scope="col">Invoice</th>
                    <th scope="col">Time</th>
                    <th scope="col">Cashier</th>
                    <th scope="col">Method</th>
                    <th scope="col" className="text-end">Paid Amount</th>
                  </tr>
                </thead>
                <tbody style={{ fontSize: '0.9rem' }}>
                  {stats.recentOrders.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="text-center py-4 text-muted font-heading">
                        No transactions checked out today yet.
                      </td>
                    </tr>
                  ) : (
                    stats.recentOrders.map(order => {
                      const orderTime = new Date(order.created_at).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit'
                      });
                      return (
                        <tr key={order.id}>
                          <td scope="row" className="fw-semibold text-primary" style={{ color: '#2563EB' }}>{order.invoice_number}</td>
                          <td>{orderTime}</td>
                          <td>{order.cashier_name}</td>
                          <td>
                            <span className="badge bg-secondary bg-opacity-10 text-dark border px-2 py-1">
                              {order.payment_method}
                            </span>
                          </td>
                          <td className="text-end fw-bold text-dark">${parseFloat(order.net_amount).toFixed(2)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Side: Product Category Sales representation */}
        <div className="col-12 col-lg-5">
          <div className="premium-card p-4 h-100">
            <h5 className="font-heading fw-bold mb-4">Stock Breakdown by Category</h5>
            <div className="d-flex flex-column gap-3">
              {stats.categorySales.map((cat, index) => {
                // Find percentage share
                const totalSalesAllCat = stats.categorySales.reduce((acc, c) => acc + parseFloat(c.totalCategorySales), 0) || 1;
                const percentage = ((parseFloat(cat.totalCategorySales) / totalSalesAllCat) * 100);

                // Assign different color weights representing category
                const barColor = index === 0 ? '#2563EB' : index === 1 ? '#0F172A' : '#F59E0B';

                return (
                  <div key={cat.category} className="category-metric-row">
                    <div className="d-flex justify-content-between mb-1" style={{ fontSize: '0.85rem' }}>
                      <span className="fw-semibold text-dark">{cat.category}</span>
                      <span className="text-muted fw-bold">${parseFloat(cat.totalCategorySales).toFixed(2)} ({percentage.toFixed(0)}%)</span>
                    </div>
                    {/* Visual Progress Bar */}
                    <div className="progress" style={{ height: '8px', borderRadius: '4px', backgroundColor: '#E2E8F0' }}>
                      <div 
                        className="progress-bar" 
                        role="progressbar" 
                        style={{ 
                          width: `${percentage}%`, 
                          backgroundColor: barColor, 
                          borderRadius: '4px',
                          transition: 'width 1s ease'
                        }} 
                        aria-valuenow={percentage} 
                        aria-valuemin="0" 
                        aria-valuemax="100"
                      ></div>
                    </div>
                    <div className="d-flex justify-content-between mt-1 text-muted" style={{ fontSize: '0.7rem' }}>
                      <span>Category sales</span>
                      <span>Total sold: {cat.totalQuantitySold} pieces</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
