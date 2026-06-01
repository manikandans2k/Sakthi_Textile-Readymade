import React, { useState, useEffect } from 'react';
import axiosInstance from '../api/axios';
import Swal from 'sweetalert2';
import { useAuth } from '../context/AuthContext';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { 
  Calendar, TrendingUp, Coins, FileText, Percent, Download, Printer, 
  ArrowLeftRight, Filter, BarChart3, Layers, User, Award, ArrowUpRight,
  ShieldAlert, Package, Users, Activity, ShoppingBag, RefreshCw, DollarSign
} from 'lucide-react';

const Reports = () => {
  const { shop } = useAuth();
  const isGstEnabled = shop ? (shop.gst_enabled !== 0 && shop.gst_enabled !== false) : true;

  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'sales', 'profit', 'inventory', 'cashiers', 'customers'
  const [datePreset, setDatePreset] = useState('30days'); // 'today', 'yesterday', '7days', '30days', 'custom'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Tab-specific datasets
  const [salesData, setSalesData] = useState(null);
  const [gstData, setGstData] = useState(null);
  const [profitData, setProfitData] = useState(null);
  const [stockData, setStockData] = useState(null);
  const [movementData, setMovementData] = useState(null);
  const [cashierData, setCashierData] = useState(null);
  const [customerData, setCustomerData] = useState(null);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Role Gate check: Retrieve active staff credentials
  const sessionUser = JSON.parse(localStorage.getItem('textile_pos_user') || '{}');
  const userRole = sessionUser.role;

  // Handle preset date calculations
  useEffect(() => {
    if (datePreset !== 'custom') {
      const dates = calculateDates(datePreset);
      setStartDate(dates.start);
      setEndDate(dates.end);
    }
  }, [datePreset]);

  // Sync data on changes
  useEffect(() => {
    if (startDate && endDate) {
      fetchReportData();
    }
  }, [startDate, endDate, activeTab]);

  const calculateDates = (preset) => {
    const today = new Date();
    let start = '';
    let end = today.toISOString().split('T')[0];

    if (preset === 'today') {
      start = end;
    } else if (preset === 'yesterday') {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      start = yesterday.toISOString().split('T')[0];
      end = start;
    } else if (preset === '7days') {
      const prev7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      start = prev7.toISOString().split('T')[0];
    } else if (preset === '30days') {
      const prev30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      start = prev30.toISOString().split('T')[0];
    }
    return { start, end };
  };

  const fetchReportData = async () => {
    // Prevent unauthorized Cashier profile lookups on backend
    if (userRole === 'Cashier' || userRole === 'Stock Manager') return;

    try {
      setLoading(true);
      setErrorMsg('');
      const params = `?startDate=${startDate}&endDate=${endDate}`;

      if (activeTab === 'dashboard') {
        const [salesRes, stockRes, custRes] = await Promise.all([
          axiosInstance.get(`/reports/sales${params}`),
          axiosInstance.get('/reports/stock'),
          axiosInstance.get('/reports/customers')
        ]);
        setSalesData(salesRes.data);
        setStockData(stockRes.data);
        setCustomerData(custRes.data);
      } else if (activeTab === 'sales') {
        const [salesRes, gstRes] = await Promise.all([
          axiosInstance.get(`/reports/sales${params}`),
          axiosInstance.get(`/reports/gst${params}`)
        ]);
        setSalesData(salesRes.data);
        setGstData(gstRes.data);
      } else if (activeTab === 'profit') {
        const res = await axiosInstance.get(`/reports/profit${params}`);
        setProfitData(res.data);
      } else if (activeTab === 'inventory') {
        const [stockRes, movementRes] = await Promise.all([
          axiosInstance.get('/reports/stock'),
          axiosInstance.get(`/reports/movement${params}`)
        ]);
        setStockData(stockRes.data);
        setMovementData(movementRes.data);
      } else if (activeTab === 'cashiers') {
        const res = await axiosInstance.get(`/reports/cashiers${params}`);
        setCashierData(res.data);
      } else if (activeTab === 'customers') {
        const res = await axiosInstance.get('/reports/customers');
        setCustomerData(res.data);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(err.response?.data?.message || 'Failed to sync with analytical database ledgers.');
    } finally {
      setLoading(false);
    }
  };

  // CSV Dynamic Export Manager
  const triggerCsvExport = () => {
    let exported = false;
    if (activeTab === 'dashboard' || activeTab === 'sales') {
      if (!salesData || !salesData.transactions || salesData.transactions.length === 0) {
        Swal.fire({
          title: 'Export Failed',
          text: 'No transaction data available in the selected range to export.',
          icon: 'error',
          confirmButtonColor: '#2563EB'
        });
        return;
      }
      const headers = ['Invoice No', 'Date & Time', 'Customer', 'Cashier', 'Net Amount', 'Payment Mode', 'Type'];
      const rows = salesData.transactions.map(t => [
        t.invoice_number,
        new Date(t.created_at).toLocaleString('en-IN'),
        t.customer_name,
        t.cashier_name,
        parseFloat(t.net_amount).toFixed(2),
        t.payment_method,
        t.transaction_type
      ]);
      exportToCSV(headers, rows, `sales_ledger_${startDate}_to_${endDate}.csv`);
      exported = true;
    } else if (activeTab === 'profit') {
      if (!profitData || !profitData.productProfits || profitData.productProfits.length === 0) {
        Swal.fire({
          title: 'Export Failed',
          text: 'No profit analysis data available in the selected range to export.',
          icon: 'error',
          confirmButtonColor: '#2563EB'
        });
        return;
      }
      const headers = ['Product Style', 'SKU', 'Category', 'Quantity Sold', 'Gross Revenue', 'Cost Basis', 'Net Profit', 'Profit Margin %'];
      const rows = profitData.productProfits.map(p => [
        p.product_name,
        p.sku,
        p.category,
        p.quantity_sold,
        parseFloat(p.gross_revenue).toFixed(2),
        parseFloat(p.cost_basis).toFixed(2),
        parseFloat(p.net_profit).toFixed(2),
        parseFloat(p.margin_pct).toFixed(2)
      ]);
      exportToCSV(headers, rows, `profitability_analysis_${startDate}_to_${endDate}.csv`);
      exported = true;
    } else if (activeTab === 'inventory') {
      if (!stockData || !stockData.stockLevels || stockData.stockLevels.length === 0) {
        Swal.fire({
          title: 'Export Failed',
          text: 'No stock data available in the catalog to export.',
          icon: 'error',
          confirmButtonColor: '#2563EB'
        });
        return;
      }
      const headers = ['Product', 'SKU', 'Barcode', 'Category', 'Warehouse', 'Stock Level', 'Unit', 'Wholesale Price', 'Retail Price'];
      const rows = stockData.stockLevels.map(item => [
        item.product_name,
        item.sku,
        item.barcode,
        item.category,
        item.warehouse_name || 'N/A',
        parseFloat(item.warehouse_stock).toFixed(2),
        item.unit,
        parseFloat(item.cost_price).toFixed(2),
        parseFloat(item.retail_price).toFixed(2)
      ]);
      exportToCSV(headers, rows, `stock_ledger_levels_${new Date().toISOString().split('T')[0]}.csv`);
      exported = true;
    } else if (activeTab === 'cashiers') {
      if (!cashierData || cashierData.length === 0) {
        Swal.fire({
          title: 'Export Failed',
          text: 'No cashier velocity data available in the selected range to export.',
          icon: 'error',
          confirmButtonColor: '#2563EB'
        });
        return;
      }
      const headers = ['Cashier ID', 'Orders Count', 'Gross Sales', 'Returns Count', 'Returns Value', 'Net Amount', 'Avg Ticket Size'];
      const rows = cashierData.map(c => [
        c.cashier_name,
        c.sales_count,
        parseFloat(c.total_sales_amount).toFixed(2),
        c.returns_count,
        parseFloat(c.total_returns_amount).toFixed(2),
        parseFloat(c.net_amount).toFixed(2),
        parseFloat(c.average_ticket_size).toFixed(2)
      ]);
      exportToCSV(headers, rows, `cashier_velocities_${startDate}_to_${endDate}.csv`);
      exported = true;
    } else if (activeTab === 'customers') {
      if (!customerData || customerData.length === 0) {
        Swal.fire({
          title: 'Export Failed',
          text: 'No customer metric data available in the database to export.',
          icon: 'error',
          confirmButtonColor: '#2563EB'
        });
        return;
      }
      const headers = ['Customer Name', 'Phone', 'Email', 'GSTIN', 'Loyalty Points', 'Credit Balance', 'Orders Count', 'Lifetime Value'];
      const rows = customerData.map(c => [
        c.name,
        c.phone,
        c.email || 'N/A',
        c.gst_number || 'N/A',
        c.loyalty_points,
        parseFloat(c.credit_balance).toFixed(2),
        c.total_orders,
        parseFloat(c.clv_amount).toFixed(2)
      ]);
      exportToCSV(headers, rows, `customer_lifetime_rankings.csv`);
      exported = true;
    }

    if (exported) {
      Swal.fire({
        title: 'Export Successful!',
        text: 'The selected report has been compiled and downloaded as a CSV file.',
        icon: 'success',
        confirmButtonColor: '#2563EB',
        background: '#ffffff',
        color: '#0f172a'
      });
    }
  };

  const exportToCSV = (headers, rows, filename) => {
    const csvRows = [headers.join(",")];
    for (const row of rows) {
      const escaped = row.map(val => {
        const str = String(val);
        if (str.includes(",") || str.includes("\"") || str.includes("\n")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      });
      csvRows.push(escaped.join(","));
    }
    const blob = new Blob([csvRows.join("\n")], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const triggerPrintReport = () => {
    window.print();
  };

  // Guard Clause: Secure financial/performance matrices from low-privilege Cashier/Stock users
  if (userRole === 'Cashier' || userRole === 'Stock Manager') {
    return (
      <div className="container py-5">
        <div className="card border-0 shadow text-center p-5 mx-auto" style={{ maxWidth: '520px', borderRadius: '24px', backgroundColor: '#FFFFFF' }}>
          <div className="p-4 bg-danger bg-opacity-10 rounded-circle d-inline-block mx-auto mb-4" style={{ width: '96px', height: '96px' }}>
            <ShieldAlert size={48} className="text-danger" />
          </div>
          <h3 className="font-heading fw-bold text-dark mb-2" style={{ letterSpacing: '-0.5px' }}>Restricted Analytics</h3>
          <p className="text-secondary mb-4" style={{ fontSize: '0.9rem', lineHeight: '1.6' }}>
            Financial ledgers, cost-basis calculations, profit reports, and staff performance audits are restricted to the **Admin** and **Manager** authorization keys.
          </p>
          <button 
            onClick={() => window.history.back()} 
            className="btn btn-primary px-4 py-2.5 border-0 font-heading fw-bold rounded-3" 
            style={{ backgroundColor: '#2563EB', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)' }}
          >
            Return to POS Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Visual SVG chart coordinate engines
  const renderTrendSvg = () => {
    const trend = salesData?.dailyTrend || [];
    if (trend.length === 0) {
      return (
        <div className="text-center py-5 text-muted font-heading" style={{ fontSize: '0.8rem' }}>
          Insufficient sales metrics in selected range to compile trendlines.
        </div>
      );
    }

    const data = trend.map(t => ({
      date: t.date,
      revenue: parseFloat(t.revenue) || 0
    }));

    const CustomTooltip = ({ active, payload }) => {
      if (active && payload && payload.length) {
        return (
          <div className="bg-white border rounded shadow p-2" style={{ fontSize: '0.72rem', borderColor: '#E2E8F0' }}>
            <p className="m-0 fw-bold text-dark">{payload[0].payload.date}</p>
            <p className="m-0 text-primary fw-extrabold">Revenue: ₹{payload[0].value.toFixed(2)}</p>
          </div>
        );
      }
      return null;
    };

    return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
          <defs>
            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#2563EB" stopOpacity={0.35}/>
              <stop offset="95%" stopColor="#2563EB" stopOpacity={0.0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 9.5, fill: '#64748B', fontWeight: '600' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis 
            tick={{ fontSize: 9.5, fill: '#64748B', fontWeight: '600' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(value) => `₹${value}`}
          />
          <RechartsTooltip content={<CustomTooltip />} />
          <Area 
            type="monotone" 
            dataKey="revenue" 
            stroke="#2563EB" 
            strokeWidth={3.5}
            fillOpacity={1} 
            fill="url(#colorRevenue)" 
          />
        </AreaChart>
      </ResponsiveContainer>
    );
  };

  const renderPaymentPieChart = () => {
    const cash = parseFloat(salesData?.summary?.totalCashCollected) || 0;
    const card = parseFloat(salesData?.summary?.totalCardCollected) || 0;
    const upi = parseFloat(salesData?.summary?.totalUpiCollected) || 0;
    
    const data = [
      { name: 'Cash', value: cash, color: '#2563EB' },
      { name: 'Card', value: card, color: '#0F172A' },
      { name: 'UPI', value: upi, color: '#F59E0B' }
    ].filter(item => item.value > 0);

    if (data.length === 0) {
      return (
        <div className="text-center py-4 text-muted font-heading" style={{ fontSize: '0.75rem' }}>
          No payment metrics logged.
        </div>
      );
    }

    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={38}
            outerRadius={52}
            paddingAngle={4}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <RechartsTooltip 
            formatter={(value) => [`₹${parseFloat(value).toFixed(2)}`, 'Collected']}
            contentStyle={{ fontSize: '0.72rem', borderRadius: '6px' }}
          />
        </PieChart>
      </ResponsiveContainer>
    );
  };

  const getActiveStockAlertCount = () => {
    return stockData?.lowStockAlerts?.length || 0;
  };

  return (
    <div className="reports-dashboard-view px-3 py-4" style={{ backgroundColor: '#F8FAFC', minHeight: '100vh' }}>
      
      {/* Print-Only Header Spools */}
      <div className="d-none d-print-block text-center mb-5">
        <h2 className="fw-extrabold m-0" style={{ color: '#0F172A', fontSize: '2rem' }}>🧵 TextTail POS & ERP Services</h2>
        <p className="m-0 text-secondary font-heading" style={{ fontSize: '0.9rem' }}>Enterprise Financial & Operational Audit Registers</p>
        <p className="fw-bold mt-2" style={{ fontSize: '0.85rem' }}>
          Date range: {new Date(startDate).toLocaleDateString('en-IN')} to {new Date(endDate).toLocaleDateString('en-IN')} | Generated: {new Date().toLocaleString()}
        </p>
        <hr style={{ border: '2px solid #0F172A', opacity: '1' }} />
      </div>

      {/* 1. FILTER HEADER CARD */}
      <div className="premium-card border-0 shadow-sm bg-white p-4 mb-4 d-print-none" style={{ borderRadius: '18px' }}>
        <div className="row g-3 align-items-center">
          <div className="col-12 col-xl-4">
            <h4 className="font-heading fw-extrabold text-dark m-0 d-flex align-items-center gap-2" style={{ letterSpacing: '-0.5px' }}>
              <BarChart3 size={24} style={{ color: '#2563EB' }} />
              <span>Analytical Workspaces & Reports</span>
            </h4>
            <p className="text-muted m-0 mt-1" style={{ fontSize: '0.8rem' }}>
              Audit financial margins, track cashier velocities, check B2B GST liability logs, and review dead inventories.
            </p>
          </div>

          {/* Quick Date Presets */}
          <div className="col-12 col-md-6 col-xl-4">
            <label className="form-label text-secondary font-heading fw-bold mb-1.5" style={{ fontSize: '0.75rem' }}>
              Select Date Preset Boundaries
            </label>
            <div className="d-flex gap-1.5 overflow-auto pb-1" style={{ whiteSpace: 'nowrap' }}>
              {[
                { label: 'Today', value: 'today' },
                { label: 'Yesterday', value: 'yesterday' },
                { label: 'Last 7 Days', value: '7days' },
                { label: 'Last 30 Days', value: '30days' },
                { label: 'Custom Range', value: 'custom' }
              ].map(preset => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setDatePreset(preset.value)}
                  className="btn btn-sm border-0 font-heading fw-bold rounded-pill px-3 py-1.5"
                  style={{
                    backgroundColor: datePreset === preset.value ? '#2563EB' : '#F1F5F9',
                    color: datePreset === preset.value ? '#FFFFFF' : '#475569',
                    fontSize: '0.72rem',
                    transition: 'all 0.2s'
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Date Inputs */}
          <div className="col-12 col-md-6 col-xl-4">
            <div className="row g-2">
              <div className="col-6">
                <label className="form-label text-secondary font-heading fw-bold mb-1" style={{ fontSize: '0.75rem' }}>
                  Start Date
                </label>
                <div className="input-group input-group-sm">
                  <span className="input-group-text bg-white border-end-0 text-muted">
                    <Calendar size={13} />
                  </span>
                  <input 
                    type="date" 
                    className="form-control border-start-0 ps-0" 
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setDatePreset('custom');
                    }}
                  />
                </div>
              </div>

              <div className="col-6">
                <label className="form-label text-secondary font-heading fw-bold mb-1" style={{ fontSize: '0.75rem' }}>
                  End Date
                </label>
                <div className="input-group input-group-sm">
                  <span className="input-group-text bg-white border-end-0 text-muted">
                    <Calendar size={13} />
                  </span>
                  <input 
                    type="date" 
                    className="form-control border-start-0 ps-0" 
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      setDatePreset('custom');
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. TAB CONTROLS & DYNAMIC EXPORTERS */}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4 d-print-none">
        <div className="d-flex flex-wrap gap-2">
          {[
            { id: 'dashboard', label: '📊 Executive Dashboard' },
            { id: 'sales', label: '💸 Sales & GST Ledgers' },
            { id: 'profit', label: '💰 Profit Analysis' },
            { id: 'inventory', label: '📦 Stock & Valuation' },
            { id: 'cashiers', label: '👤 Cashier Velocity' },
            { id: 'customers', label: '👑 Customer Metrics' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="btn px-3.5 py-2.5 border-0 font-heading fw-extrabold rounded-3"
              style={{
                backgroundColor: activeTab === tab.id ? '#0F172A' : '#FFFFFF',
                color: activeTab === tab.id ? '#FFFFFF' : '#475569',
                boxShadow: '0 4px 10px rgba(15, 23, 42, 0.03)',
                fontSize: '0.8rem',
                transition: 'all 0.2s'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="d-flex gap-2">
          <button
            onClick={triggerCsvExport}
            disabled={loading}
            className="btn btn-outline-secondary d-flex align-items-center gap-2 font-heading fw-bold px-3.5 py-2.5 rounded-3 border-0 bg-white"
            style={{ boxShadow: '0 4px 10px rgba(15, 23, 42, 0.03)', fontSize: '0.8rem' }}
          >
            <Download size={15} />
            <span>Export CSV</span>
          </button>

          <button
            onClick={triggerPrintReport}
            disabled={loading}
            className="btn btn-primary d-flex align-items-center gap-2 font-heading fw-bold px-4 py-2.5 rounded-3 border-0"
            style={{ backgroundColor: '#2563EB', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.15)', fontSize: '0.8rem' }}
          >
            <Printer size={15} />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="alert alert-danger shadow-sm p-3 rounded-3 d-flex align-items-center gap-2 mb-4 font-heading fw-semibold">
          <span>⚠️ {errorMsg}</span>
        </div>
      )}

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" style={{ width: '3rem', height: '3rem' }} role="status">
            <span className="visually-hidden">Syncing Report Data...</span>
          </div>
          <p className="mt-3 text-muted font-heading fw-bold">Compiling metric indices from textile ledger databases...</p>
        </div>
      ) : (
        <div className="tab-contents-grid">
          
          {/* ========================================================
              TAB 1: EXECUTIVE DASHBOARD
              ======================================================== */}
          {activeTab === 'dashboard' && salesData && (
            <div className="fade-in">
              
              {/* Core Cards */}
              <div className="row g-4 mb-4">
                {[
                  { title: 'Gross Revenue', value: `₹${(parseFloat(salesData.summary.netRevenue) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: <Coins size={22} className="text-primary" />, desc: 'Net collections pre-refunds' },
                  { title: 'Gross Sales Profit', value: `₹${(parseFloat(salesData.summary.netRevenue * 0.4) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: <DollarSign size={22} className="text-success" />, desc: 'Standard 40% margin model' },
                  { title: 'Transactions Processes', value: salesData.summary.totalOrders, icon: <ArrowLeftRight size={22} className="text-warning" />, desc: 'Total checks generated' },
                  { title: 'Active Stock Warnings', value: getActiveStockAlertCount(), icon: <ShieldAlert size={22} className="text-danger" />, desc: 'Items under 20 pieces' }
                ].map((card, idx) => (
                  <div key={idx} className="col-12 col-sm-6 col-lg-3">
                    <div className="premium-card bg-white border-0 shadow-sm p-4 h-100 position-relative overflow-hidden" style={{ borderRadius: '16px' }}>
                      <div className="d-flex justify-content-between align-items-start mb-3">
                        <div>
                          <span className="text-secondary font-heading fw-bold" style={{ fontSize: '0.72rem' }}>{card.title}</span>
                          <h3 className="font-heading fw-extrabold text-dark mt-1.5 mb-1" style={{ fontSize: '1.4rem', letterSpacing: '-0.5px' }}>
                            {card.value}
                          </h3>
                        </div>
                        <div className="p-2.5 rounded-3" style={{ backgroundColor: '#F8FAFC' }}>
                          {card.icon}
                        </div>
                      </div>
                      <p className="text-muted m-0" style={{ fontSize: '0.7rem' }}>{card.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Trend Chart and Low Stock alerts splits */}
              <div className="row g-4 mb-4">
                <div className="col-12 col-xl-8">
                  <div className="premium-card bg-white border-0 shadow-sm p-4 h-100" style={{ borderRadius: '16px' }}>
                    <div className="mb-4">
                      <h5 className="font-heading fw-bold text-dark m-0">Daily Revenue Performance Trend</h5>
                      <span className="text-muted" style={{ fontSize: '0.75rem' }}>Sales velocity and billing totals</span>
                    </div>
                    <div style={{ height: '220px' }}>
                      {renderTrendSvg()}
                    </div>
                  </div>
                </div>

                <div className="col-12 col-xl-4">
                  <div className="premium-card bg-white border-0 shadow-sm p-4 h-100" style={{ borderRadius: '16px' }}>
                    <div className="mb-2">
                      <h5 className="font-heading fw-bold text-dark m-0">Payment Modes Breakout</h5>
                      <span className="text-muted" style={{ fontSize: '0.75rem' }}>Invoice settlement distribution</span>
                    </div>

                    <div style={{ height: '140px', marginBottom: '10px' }}>
                      {renderPaymentPieChart()}
                    </div>

                    <div className="d-flex flex-column gap-3.5 my-auto py-1">
                      {[
                        { label: '💵 Cash Counter', val: salesData.summary.totalCashCollected, pct: (salesData.summary.totalCashCollected / salesData.summary.netRevenue) * 100 || 0, color: '#2563EB' },
                        { label: '💳 POS Card Swipe', val: salesData.summary.totalCardCollected, pct: (salesData.summary.totalCardCollected / salesData.summary.netRevenue) * 100 || 0, color: '#0F172A' },
                        { label: '📱 Unified UPI QR', val: salesData.summary.totalUpiCollected, pct: (salesData.summary.totalUpiCollected / salesData.summary.netRevenue) * 100 || 0, color: '#F59E0B' }
                      ].map((item, idx) => (
                        <div key={idx}>
                          <div className="d-flex justify-content-between align-items-center mb-1.5" style={{ fontSize: '0.75rem' }}>
                            <span className="text-secondary fw-bold">{item.label}</span>
                            <span className="text-dark fw-bold">₹{parseFloat(item.val).toFixed(2)} ({item.pct.toFixed(1)}%)</span>
                          </div>
                          <div className="progress rounded-pill" style={{ height: '6px', backgroundColor: '#F1F5F9' }}>
                            <div 
                              className="progress-bar rounded-pill" 
                              style={{ 
                                width: `${item.pct}%`, 
                                backgroundColor: item.color 
                              }} 
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Active Low Stock Alerts and Top Spenders */}
              <div className="row g-4">
                <div className="col-12 col-md-6">
                  <div className="premium-card bg-white border-0 shadow-sm p-4" style={{ borderRadius: '16px' }}>
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <h5 className="font-heading fw-bold text-dark m-0">Critical Low Stock Alerts</h5>
                      <span className="badge bg-danger bg-opacity-10 text-danger fw-bold rounded-pill">Below 20m</span>
                    </div>
                    
                    <div className="list-group list-group-flush" style={{ fontSize: '0.8rem', maxHeight: '250px', overflowY: 'auto' }}>
                      {stockData?.lowStockAlerts && stockData.lowStockAlerts.length > 0 ? (
                        stockData.lowStockAlerts.map(alert => (
                          <div key={alert.product_id} className="list-group-item px-0 py-2.5 d-flex justify-content-between align-items-center border-0 border-bottom border-light">
                            <div>
                              <p className="m-0 fw-bold text-dark">{alert.product_name}</p>
                              <span className="text-muted fw-semibold" style={{ fontSize: '0.7rem' }}>SKU: {alert.sku}</span>
                            </div>
                            <span className="badge bg-danger rounded-pill px-2.5 py-1.5 fw-bold" style={{ fontSize: '0.72rem' }}>
                              {alert.stock} {alert.unit}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-4 text-muted">All products have healthy inventory levels!</div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="col-12 col-md-6">
                  <div className="premium-card bg-white border-0 shadow-sm p-4" style={{ borderRadius: '16px' }}>
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <h5 className="font-heading fw-bold text-dark m-0">Loyalty Spenders CLV</h5>
                      <span className="badge bg-primary bg-opacity-10 text-primary fw-bold rounded-pill">Ranked</span>
                    </div>

                    <div className="list-group list-group-flush" style={{ fontSize: '0.8rem', maxHeight: '250px', overflowY: 'auto' }}>
                      {customerData && customerData.length > 0 ? (
                        customerData.slice(0, 5).map((cust, idx) => (
                          <div key={cust.id} className="list-group-item px-0 py-2.5 d-flex justify-content-between align-items-center border-0 border-bottom border-light">
                            <div className="d-flex align-items-center gap-2.5">
                              <span className="fw-extrabold text-muted" style={{ minWidth: '15px' }}>#{idx+1}</span>
                              <div>
                                <p className="m-0 fw-bold text-dark">{cust.name}</p>
                                <span className="text-muted fw-semibold" style={{ fontSize: '0.7rem' }}>{cust.phone}</span>
                              </div>
                            </div>
                            <div className="text-end">
                              <p className="m-0 fw-extrabold text-primary">₹{parseFloat(cust.clv_amount).toFixed(2)}</p>
                              <span className="text-muted font-heading" style={{ fontSize: '0.68rem' }}>{cust.loyalty_points} Points</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-4 text-muted">No loyalty customer database seeded.</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* ========================================================
              TAB 2: SALES & GST LEDGERS
              ======================================================== */}
          {activeTab === 'sales' && salesData && gstData && (
            <div className="fade-in">
              
              {/* Mini metrics bar */}
              <div className="row g-4 mb-4">
                {(isGstEnabled ? [
                  { title: 'Taxable Invoiced Sales', value: `₹${parseFloat(gstData?.summary?.totalTaxableValue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, color: '#0F172A' },
                  { title: 'CGST Collected (2.5%)', value: `₹${parseFloat(gstData?.summary?.totalCgst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, color: '#2563EB' },
                  { title: 'SGST Collected (2.5%)', value: `₹${parseFloat(gstData?.summary?.totalSgst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, color: '#2563EB' },
                  { title: 'Net Invoiced Revenue', value: `₹${parseFloat(salesData?.summary?.netRevenue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, color: '#10B981' }
                ] : [
                  { title: 'Net Invoiced Revenue', value: `₹${parseFloat(salesData?.summary?.netRevenue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, color: '#10B981' },
                  { title: 'Cash Settlements', value: `₹${parseFloat(salesData?.summary?.totalCashCollected || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, color: '#2563EB' },
                  { title: 'UPI Settlements', value: `₹${parseFloat(salesData?.summary?.totalUpiCollected || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, color: '#F59E0B' },
                  { title: 'Card Settlements', value: `₹${parseFloat(salesData?.summary?.totalCardCollected || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, color: '#0F172A' }
                ]).map((metric, idx) => (
                  <div key={idx} className="col-6 col-lg-3">
                    <div className="premium-card bg-white border-0 shadow-sm p-3.5 text-center" style={{ borderRadius: '12px' }}>
                      <span className="text-secondary font-heading fw-bold" style={{ fontSize: '0.72rem' }}>{metric.title}</span>
                      <h4 className="font-heading fw-extrabold mt-1.5 mb-0" style={{ color: metric.color, letterSpacing: '-0.5px', fontSize: '1.25rem' }}>{metric.value}</h4>
                    </div>
                  </div>
                ))}
              </div>

              {/* Transactions list */}
              <div className="premium-card bg-white border-0 shadow-sm p-4 mb-4" style={{ borderRadius: '16px' }}>
                <h5 className="font-heading fw-extrabold text-dark mb-3">Invoice Ledger Journal</h5>
                <div className="table-responsive" style={{ maxHeight: '400px' }}>
                  <table className="table align-middle text-nowrap" style={{ fontSize: '0.8rem' }}>
                    <thead className="table-light text-secondary font-heading">
                      <tr>
                        <th>Invoice No</th>
                        <th>Created Date / Time</th>
                        <th>Cashier Name</th>
                        <th>Customer Profile</th>
                        <th>Payment Mode</th>
                        <th>Transaction Mode</th>
                        <th className="text-end">Invoice Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salesData.transactions && salesData.transactions.length > 0 ? (
                        salesData.transactions.map(t => (
                          <tr key={t.id}>
                            <td className="fw-extrabold text-dark">{t.invoice_number}</td>
                            <td>{new Date(t.created_at).toLocaleString('en-IN')}</td>
                            <td><span className="badge bg-light text-dark font-heading fw-bold">{t.cashier_name}</span></td>
                            <td className="fw-semibold text-dark">{t.customer_name}</td>
                            <td>
                              <span className="badge text-white font-heading fw-bold px-2 py-1" style={{ backgroundColor: t.payment_method === 'Cash' ? '#2563EB' : t.payment_method === 'Card' ? '#0F172A' : t.payment_method === 'UPI' ? '#F59E0B' : '#64748B' }}>
                                {t.payment_method}
                              </span>
                            </td>
                            <td>
                              <span className={`badge px-2 py-1 font-heading fw-bold ${t.transaction_type === 'Return' ? 'bg-danger bg-opacity-10 text-danger' : 'bg-success bg-opacity-10 text-success'}`}>
                                {t.transaction_type === 'Return' ? '🔄 Return/Refund' : '🛒 Billing Sale'}
                              </span>
                            </td>
                            <td className="text-end fw-extrabold text-dark font-heading">₹{parseFloat(t.net_amount).toFixed(2)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="7" className="text-center py-5 text-muted">No transactions found for the selected dates.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* GST schedule list */}
              {!isGstEnabled ? (
                <div className="premium-card bg-white border-0 shadow-sm p-5 text-center" style={{ borderRadius: '16px' }}>
                  <div className="p-4 bg-secondary bg-opacity-10 rounded-circle d-inline-block mx-auto mb-3" style={{ width: '80px', height: '80px', color: '#64748B' }}>
                    <ShieldAlert size={32} />
                  </div>
                  <h5 className="font-heading fw-bold text-dark mb-2">GST Audits Inactive</h5>
                  <p className="text-secondary mx-auto mb-0" style={{ fontSize: '0.85rem', maxWidth: '480px', lineHeight: '1.6' }}>
                    This retail outlet is configured under tax-exempt status. GST ledger reports and tax audit registrations are currently inactive.
                  </p>
                </div>
              ) : (
                <div className="premium-card bg-white border-0 shadow-sm p-4" style={{ borderRadius: '16px' }}>
                  <h5 className="font-heading fw-extrabold text-dark mb-3">GST audit ledger register</h5>
                  <div className="table-responsive" style={{ maxHeight: '400px' }}>
                    <table className="table align-middle text-nowrap" style={{ fontSize: '0.8rem' }}>
                      <thead className="table-light text-secondary font-heading">
                        <tr>
                          <th>Invoice No</th>
                          <th>Tax Period Date</th>
                          <th>Client Name</th>
                          <th>Client GSTIN</th>
                          <th className="text-end">Invoice Subtotal</th>
                          <th className="text-end">Discounts</th>
                          <th className="text-end">Taxable Value</th>
                          <th className="text-end">CGST (2.5%)</th>
                          <th className="text-end">SGST (2.5%)</th>
                          <th className="text-end">Total GST</th>
                          <th className="text-end">Grand Net Invoice</th>
                        </tr>
                      </thead>
                      <tbody>
                        {gstData.invoices && gstData.invoices.length > 0 ? (
                          gstData.invoices.map(inv => (
                            <tr key={inv.id}>
                              <td className="fw-extrabold text-dark">{inv.invoice_number}</td>
                              <td>{new Date(inv.created_at).toLocaleDateString('en-IN')}</td>
                              <td className="fw-semibold text-dark">{inv.customer_name}</td>
                              <td className="fw-bold font-mono text-dark">{inv.customer_gstin || 'Walk-in'}</td>
                              <td className="text-end">₹{parseFloat(inv.subtotal).toFixed(2)}</td>
                              <td className="text-end text-danger">-₹{parseFloat(inv.discount).toFixed(2)}</td>
                              <td className="text-end fw-bold text-dark">₹{parseFloat(inv.taxable_value).toFixed(2)}</td>
                              <td className="text-end">₹{parseFloat(inv.cgst).toFixed(2)}</td>
                              <td className="text-end">₹{parseFloat(inv.sgst).toFixed(2)}</td>
                              <td className="text-end fw-bold text-primary">₹{parseFloat(inv.total_gst).toFixed(2)}</td>
                              <td className="text-end fw-extrabold text-dark">₹{parseFloat(inv.grand_total).toFixed(2)}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="11" className="text-center py-5 text-muted">No tax registers found.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* ========================================================
              TAB 3: PROFIT ANALYSIS
              ======================================================== */}
          {activeTab === 'profit' && profitData && (
            <div className="fade-in">
              
              {/* Metric bar */}
              <div className="row g-4 mb-4">
                {[
                  { title: 'Net Garments Revenue', value: `₹${parseFloat(profitData.summary.totalRevenue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, icon: <Coins size={22} className="text-primary" /> },
                  { title: 'Wholesale Cost Basis', value: `₹${parseFloat(profitData.summary.totalCostBasis).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, icon: <Package size={22} className="text-secondary" /> },
                  { title: 'Net Operational Profit', value: `₹${parseFloat(profitData.summary.netProfit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, icon: <TrendingUp size={22} className="text-success" /> },
                  { title: 'Net Profit Margin %', value: `${parseFloat(profitData.summary.averageMarginPct).toFixed(2)}%`, icon: <Percent size={22} className="text-warning" /> }
                ].map((card, idx) => (
                  <div key={idx} className="col-12 col-sm-6 col-lg-3">
                    <div className="premium-card bg-white border-0 shadow-sm p-4" style={{ borderRadius: '16px' }}>
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <span className="text-secondary font-heading fw-bold" style={{ fontSize: '0.72rem' }}>{card.title}</span>
                        {card.icon}
                      </div>
                      <h3 className="font-heading fw-extrabold text-dark m-0" style={{ fontSize: '1.35rem', letterSpacing: '-0.5px' }}>{card.value}</h3>
                    </div>
                  </div>
                ))}
              </div>

              {/* Profit by product list */}
              <div className="premium-card bg-white border-0 shadow-sm p-4" style={{ borderRadius: '16px' }}>
                <h5 className="font-heading fw-extrabold text-dark mb-3">Product Margin Profitability analysis</h5>
                <div className="table-responsive">
                  <table className="table align-middle" style={{ fontSize: '0.8rem' }}>
                    <thead className="table-light text-secondary font-heading">
                      <tr>
                        <th>Product Style</th>
                        <th>SKU Code</th>
                        <th>Category</th>
                        <th className="text-center">Quantity Sold</th>
                        <th className="text-end">Gross Revenue</th>
                        <th className="text-end">Wholesale Cost</th>
                        <th className="text-end">Net Profit</th>
                        <th className="text-end">Profit Margin %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profitData.productProfits && profitData.productProfits.length > 0 ? (
                        profitData.productProfits.map(p => (
                          <tr key={p.sku}>
                            <td className="fw-bold text-dark">{p.product_name}</td>
                            <td className="fw-mono text-secondary">{p.sku}</td>
                            <td><span className="badge bg-light text-dark font-heading fw-bold">{p.category}</span></td>
                            <td className="text-center fw-bold">{p.quantity_sold}</td>
                            <td className="text-end">₹{parseFloat(p.gross_revenue).toFixed(2)}</td>
                            <td className="text-end text-muted">₹{parseFloat(p.cost_basis).toFixed(2)}</td>
                            <td className="text-end fw-extrabold text-success">₹{parseFloat(p.net_profit).toFixed(2)}</td>
                            <td className="text-end fw-bold text-primary">{parseFloat(p.margin_pct).toFixed(1)}%</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="8" className="text-center py-5 text-muted">No sales logged in range to calculate margins.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* ========================================================
              TAB 4: INVENTORY ANALYTICS & VALUATION
              ======================================================== */}
          {activeTab === 'inventory' && stockData && movementData && (
            <div className="fade-in">
              
              {/* Valuation summaries */}
              <div className="row g-4 mb-4">
                {[
                  { title: 'Total Quantity in Stock', value: `${parseFloat(stockData.summary.totalQuantity).toLocaleString()} Units`, desc: 'Aggregate physical yardages' },
                  { title: 'Wholesale Cost Valuation', value: `₹${parseFloat(stockData.summary.totalCostValue).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, desc: 'Capital tied up in supply rolls' },
                  { title: 'Retail Inventory Valuation', value: `₹${parseFloat(stockData.summary.totalRetailValue).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, desc: 'Potential shelf liquidation revenue' },
                  { title: 'Critical Stock Alerts', value: `${stockData.summary.alertCount} Items`, desc: 'Under minimum replenishment limits' }
                ].map((card, idx) => (
                  <div key={idx} className="col-12 col-sm-6 col-lg-3">
                    <div className="premium-card bg-white border-0 shadow-sm p-4" style={{ borderRadius: '16px' }}>
                      <span className="text-secondary font-heading fw-bold" style={{ fontSize: '0.72rem' }}>{card.title}</span>
                      <h3 className="font-heading fw-extrabold text-dark mt-1.5 mb-1" style={{ fontSize: '1.35rem', letterSpacing: '-0.5px' }}>{card.value}</h3>
                      <p className="text-muted m-0" style={{ fontSize: '0.68rem' }}>{card.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Fast Moving vs Dead Inventory */}
              <div className="row g-4 mb-4">
                <div className="col-12 col-lg-6">
                  <div className="premium-card bg-white border-0 shadow-sm p-4 h-100" style={{ borderRadius: '16px' }}>
                    <h5 className="font-heading fw-bold text-dark mb-3">🔥 Fast-Moving Products</h5>
                    <div className="list-group list-group-flush" style={{ fontSize: '0.8rem' }}>
                      {movementData.fastMoving && movementData.fastMoving.length > 0 ? (
                        movementData.fastMoving.map((p, idx) => (
                          <div key={p.sku} className="list-group-item px-0 py-2.5 border-0 border-bottom border-light d-flex justify-content-between align-items-center">
                            <div className="d-flex align-items-center gap-2">
                              <span className="fw-extrabold text-muted">#{idx+1}</span>
                              <div>
                                <p className="m-0 fw-bold text-dark">{p.product_name}</p>
                                <span className="text-muted" style={{ fontSize: '0.7rem' }}>SKU: {p.sku}</span>
                              </div>
                            </div>
                            <div className="text-end">
                              <span className="badge bg-success bg-opacity-10 text-success fw-bold px-2 py-1.5 rounded-pill">
                                {p.total_quantity} {p.unit} Sold
                              </span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-4 text-muted">No sales registers found to compile speeds.</div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="col-12 col-lg-6">
                  <div className="premium-card bg-white border-0 shadow-sm p-4 h-100" style={{ borderRadius: '16px' }}>
                    <h5 className="font-heading fw-bold text-dark mb-3">❄️ Dead Stock Report (90 Days Inactive)</h5>
                    <div className="list-group list-group-flush" style={{ fontSize: '0.8rem', maxHeight: '350px', overflowY: 'auto' }}>
                      {movementData.deadStock && movementData.deadStock.length > 0 ? (
                        movementData.deadStock.map(p => (
                          <div key={p.sku} className="list-group-item px-0 py-2.5 border-0 border-bottom border-light d-flex justify-content-between align-items-center">
                            <div>
                              <p className="m-0 fw-bold text-dark">{p.product_name}</p>
                              <span className="text-muted" style={{ fontSize: '0.7rem' }}>SKU: {p.sku} | Last Sold: {p.last_sold_date === 'Never' ? 'Never' : new Date(p.last_sold_date).toLocaleDateString('en-IN')}</span>
                            </div>
                            <div className="text-end">
                              <span className="badge bg-amber bg-opacity-10 text-amber fw-bold px-2 py-1.5 rounded-pill" style={{ color: '#D97706', backgroundColor: '#FEF3C7' }}>
                                {p.current_stock} {p.unit} Inactive
                              </span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-4 text-muted">All active stock items have sales activity within 90 days.</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Stock Ledger levels table */}
              <div className="premium-card bg-white border-0 shadow-sm p-4" style={{ borderRadius: '16px' }}>
                <h5 className="font-heading fw-extrabold text-dark mb-3">Warehouse localized inventory balance ledgers</h5>
                <div className="table-responsive" style={{ maxHeight: '350px' }}>
                  <table className="table align-middle text-nowrap" style={{ fontSize: '0.8rem' }}>
                    <thead className="table-light text-secondary font-heading">
                      <tr>
                        <th>Product</th>
                        <th>SKU</th>
                        <th>Barcode</th>
                        <th>Category</th>
                        <th>Warehouse</th>
                        <th className="text-center">Warehouse Stock</th>
                        <th>Unit</th>
                        <th className="text-end">Wholesale Value</th>
                        <th className="text-end">Retail Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stockData.stockLevels && stockData.stockLevels.length > 0 ? (
                        stockData.stockLevels.map((item, idx) => (
                          <tr key={idx}>
                            <td className="fw-bold text-dark">{item.product_name}</td>
                            <td className="fw-mono text-secondary">{item.sku}</td>
                            <td className="fw-semibold text-dark">{item.barcode}</td>
                            <td><span className="badge bg-light text-dark font-heading fw-bold">{item.category}</span></td>
                            <td className="fw-semibold text-secondary">{item.warehouse_name || 'Unassigned'}</td>
                            <td className="text-center fw-extrabold text-dark">{item.warehouse_stock}</td>
                            <td className="text-muted">{item.unit}</td>
                            <td className="text-end">₹{parseFloat(item.warehouse_stock * item.cost_price).toFixed(2)}</td>
                            <td className="text-end fw-extrabold text-primary">₹{parseFloat(item.warehouse_stock * item.retail_price).toFixed(2)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="9" className="text-center py-5 text-muted">No stock inventories configured.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* ========================================================
              TAB 5: CASHIER BILLING SPEED & VELOCITY
              ======================================================== */}
          {activeTab === 'cashiers' && cashierData && (
            <div className="fade-in">
              
              <div className="premium-card bg-white border-0 shadow-sm p-4" style={{ borderRadius: '16px' }}>
                <div className="mb-4">
                  <h5 className="font-heading fw-extrabold text-dark m-0">Cashier Billing Velocity & Performance Audit</h5>
                  <p className="text-muted m-0 mt-1" style={{ fontSize: '0.8rem' }}>Chronological performance leaderboard comparing staff sales volume, transaction velocities, and refund ratios.</p>
                </div>

                <div className="table-responsive">
                  <table className="table align-middle" style={{ fontSize: '0.8rem' }}>
                    <thead className="table-light text-secondary font-heading">
                      <tr>
                        <th>Cashier Name</th>
                        <th className="text-center">Total Bills finalizes</th>
                        <th className="text-end">Gross Sales Volume</th>
                        <th className="text-center">Returns Handled</th>
                        <th className="text-end">Refunds Payout Value</th>
                        <th className="text-end">Net Billing Contribution</th>
                        <th className="text-end">Average Ticket Size</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cashierData.length > 0 ? (
                        cashierData.map(c => (
                          <tr key={c.cashier_name}>
                            <td className="fw-bold text-dark d-flex align-items-center gap-2">
                              <div className="p-1.5 bg-primary bg-opacity-10 text-primary rounded-circle">
                                <User size={15} />
                              </div>
                              <span>{c.cashier_name}</span>
                            </td>
                            <td className="text-center fw-bold">{c.sales_count}</td>
                            <td className="text-end fw-bold text-dark">₹{parseFloat(c.total_sales_amount).toFixed(2)}</td>
                            <td className="text-center text-muted">{c.returns_count}</td>
                            <td className="text-end text-danger">-₹{parseFloat(c.total_returns_amount).toFixed(2)}</td>
                            <td className="text-end fw-extrabold text-primary" style={{ fontSize: '0.85rem' }}>₹{parseFloat(c.net_amount).toFixed(2)}</td>
                            <td className="text-end fw-bold text-dark">₹{parseFloat(c.average_ticket_size).toFixed(2)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="7" className="text-center py-5 text-muted">No staff performance logs recorded.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* ========================================================
              TAB 6: CUSTOMER METRICS & LIFETIME VALUES
              ======================================================== */}
          {activeTab === 'customers' && customerData && (
            <div className="fade-in">
              
              <div className="premium-card bg-white border-0 shadow-sm p-4" style={{ borderRadius: '16px' }}>
                <div className="mb-4">
                  <h5 className="font-heading fw-extrabold text-dark m-0">Customer Lifetime Value (CLV) Rankings</h5>
                  <p className="text-muted m-0 mt-1" style={{ fontSize: '0.8rem' }}>Leaderboard of active loyalty customer profiles, reward balance indices, and outstanding shop credit limits.</p>
                </div>

                <div className="table-responsive">
                  <table className="table align-middle text-nowrap" style={{ fontSize: '0.8rem' }}>
                    <thead className="table-light text-secondary font-heading">
                      <tr>
                        <th>Customer</th>
                        <th>Phone Number</th>
                        <th>Client GSTIN</th>
                        <th className="text-center">Loyalty Points</th>
                        <th className="text-end">Pending Credits Tab</th>
                        <th className="text-center">Total Invoices</th>
                        <th className="text-end">Lifetime Value (CLV)</th>
                        <th>Last Order Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customerData.length > 0 ? (
                        customerData.map((c, idx) => (
                          <tr key={c.id}>
                            <td className="fw-bold text-dark d-flex align-items-center gap-2">
                              <span className="fw-extrabold text-muted">#{idx+1}</span>
                              <span>{c.name}</span>
                            </td>
                            <td>{c.phone}</td>
                            <td className="fw-bold font-mono text-dark">{c.gst_number || 'N/A'}</td>
                            <td className="text-center">
                              <span className="badge bg-primary bg-opacity-10 text-primary fw-extrabold px-2.5 py-1.5 rounded-pill">
                                <Award size={12} className="me-1 inline" />
                                {c.loyalty_points}
                              </span>
                            </td>
                            <td className="text-end fw-semibold text-danger">
                              {parseFloat(c.credit_balance) > 0 ? `₹${parseFloat(c.credit_balance).toFixed(2)}` : '₹0.00'}
                            </td>
                            <td className="text-center fw-bold">{c.total_orders}</td>
                            <td className="text-end fw-extrabold text-primary" style={{ fontSize: '0.85rem' }}>₹{parseFloat(c.clv_amount).toFixed(2)}</td>
                            <td>{c.last_purchase_date === 'Never' ? 'Never' : new Date(c.last_purchase_date).toLocaleString('en-IN')}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="8" className="text-center py-5 text-muted">No customers links logged.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

        </div>
      )}

      {/* Embedded CSS rules for print layout overrides */}
      <style>{`
        .premium-card {
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .premium-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 20px rgba(15, 23, 42, 0.05) !important;
        }
        .chart-dot:hover {
          r: 6.5;
          fill: #2563EB;
        }
        @media print {
          body {
            background: #FFFFFF !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 1.5cm !important;
            font-family: 'Poppins', 'Inter', sans-serif !important;
          }
          .premium-card {
            box-shadow: none !important;
            border: 1px solid #CBD5E1 !important;
            padding: 15px !important;
            margin-bottom: 20px !important;
            background: transparent !important;
            transform: none !important;
          }
          table {
            border: 1px solid #94A3B8 !important;
            width: 100% !important;
          }
          th {
            background-color: #F8FAFC !important;
            color: #0F172A !important;
            border-bottom: 2px solid #94A3B8 !important;
            font-weight: bold !important;
          }
          td, th {
            padding: 8px !important;
            border-bottom: 1px solid #E2E8F0 !important;
          }
          .badge {
            border: 1px solid #CBD5E1 !important;
            color: #000000 !important;
            background: transparent !important;
          }
          h3, h4, h5, h2 {
            color: #000000 !important;
          }
          .d-print-none {
            display: none !important;
          }
          .sidebar-sticky, .navbar, .btn, .tabs-switcher {
            display: none !important;
          }
        }
      `}</style>

    </div>
  );
};

export default Reports;
