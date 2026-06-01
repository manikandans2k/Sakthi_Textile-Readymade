import React, { useState, useEffect } from 'react';
import axios from '../api/axios';
import Swal from 'sweetalert2';
import { useAuth } from '../context/AuthContext';
import { 
  ClipboardList, 
  ArrowDownLeft, 
  ArrowUpRight, 
  RefreshCcw, 
  AlertTriangle, 
  Package, 
  Search, 
  Filter, 
  Calendar, 
  Warehouse,
  CheckCircle,
  AlertCircle,
  Coins,
  TrendingUp,
  Scale,
  ShieldAlert,
  ListChecks,
  Plus
} from 'lucide-react';

const Inventory = () => {
  const { user, shop } = useAuth();
  const isGstEnabled = shop?.gst_enabled !== 0 && shop?.gst_enabled !== false;
  const [activeTab, setActiveTab] = useState('ledger');
  
  // Master lists for selections
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  
  // Stock ledger state
  const [ledger, setLedger] = useState([]);
  const [ledgerLoading, setLedgerLoading] = useState(true);
  const [filterWarehouse, setFilterWarehouse] = useState('');
  const [filterProduct, setFilterProduct] = useState('');
  const [filterType, setFilterType] = useState('');

  // Low stock alerts state
  const [lowStockList, setLowStockList] = useState([]);
  const [lowStockLoading, setLowStockLoading] = useState(false);

  // Form states for inventory adjustments & relocation
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [sourceWarehouseId, setSourceWarehouseId] = useState('');
  const [targetWarehouseId, setTargetWarehouseId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reference, setReference] = useState('');
  const [actionType, setActionType] = useState('stock-in'); // stock-in, stock-out, transfer, damage, adjust
  const [adjustmentType, setAdjustmentType] = useState('add'); // add, subtract, set (specifically for actionType === 'adjust')
  const [submitting, setSubmitting] = useState(false);
  const [actionMessage, setActionMessage] = useState(null); // { type: 'success'|'danger', text: '' }

  // Stock Reconciliation Worksheet state
  const [reconcileWarehouseId, setReconcileWarehouseId] = useState('');
  const [reconcileItems, setReconcileItems] = useState([]);
  const [reconcileLoading, setReconcileLoading] = useState(false);
  const [reconcileSubmitting, setReconcileSubmitting] = useState(false);
  const [reconcileSearch, setReconcileSearch] = useState('');
  const [reconcileMemo, setReconcileMemo] = useState('');
  const [reconcileMessage, setReconcileMessage] = useState(null); // { type: 'success'|'danger', text: '' }

  // Inventory Valuation state
  const [valuationData, setValuationData] = useState(null);
  const [valuationLoading, setValuationLoading] = useState(false);
  const [valuationSearch, setValuationSearch] = useState('');

  // Product Catalog & Price editing states
  const [catalogSearch, setCatalogSearch] = useState('');
  const [editingProduct, setEditingProduct] = useState(null); // The product variant currently being edited
  const [editForm, setEditForm] = useState({
    product_name: '',
    category: '',
    brand: '',
    gender: 'Unisex',
    description: '',
    sku: '',
    barcode: '',
    size: '',
    color: '',
    purchase_price: '',
    selling_price: '',
    mrp: '',
    stock_qty: '0',
    gst_percentage: '12.00'
  });
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editMessage, setEditMessage] = useState(null); // { type: 'success'|'danger', text: '' }

  // Add New Product states
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    product_name: '',
    brand: 'General',
    category: 'Shirts',
    gender: 'Unisex',
    description: '',
    allow_manual_qty: false,
    barcode: '',
    sku: '',
    color: 'Standard',
    size: 'Free Size',
    purchase_price: '',
    selling_price: '',
    mrp: '',
    stock_qty: '0',
    gst_percentage: '12.00'
  });
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addMessage, setAddMessage] = useState(null); // { type: 'success'|'danger', text: '' }

  useEffect(() => {
    fetchAuxiliaryData();
    fetchLedger();
  }, []);

  const handleCreateProduct = async (e) => {
    e.preventDefault();
    setAddMessage(null);
    setAddSubmitting(true);
    try {
      const payload = {
        ...addForm,
        purchase_price: parseFloat(addForm.purchase_price) || 0.00,
        selling_price: parseFloat(addForm.selling_price),
        mrp: parseFloat(addForm.mrp) || parseFloat(addForm.selling_price),
        stock_qty: parseInt(addForm.stock_qty, 10) || 0,
        gst_percentage: parseFloat(addForm.gst_percentage) || 12.00
      };

      const response = await axios.post('/products', payload);
      setAddMessage({ type: 'success', text: response.data.message || 'New product variant created successfully!' });
      
      // Reset form
      setAddForm({
        product_name: '',
        brand: 'General',
        category: 'Shirts',
        gender: 'Unisex',
        description: '',
        allow_manual_qty: false,
        barcode: '',
        sku: '',
        color: 'Standard',
        size: 'Free Size',
        purchase_price: '',
        selling_price: '',
        mrp: '',
        stock_qty: '0',
        gst_percentage: '12.00'
      });
      
      // Refresh lists
      fetchAuxiliaryData();
      
      // Close modal after a brief delay
      setTimeout(() => {
        setShowAddModal(false);
        setAddMessage(null);
      }, 1500);
    } catch (err) {
      console.error('Create product variant error:', err);
      const errMsg = err.response?.data?.message || 'Failed to create product variant. Please verify barcode/SKU uniqueness.';
      setAddMessage({
        type: 'danger',
        text: errMsg
      });
      
      if (errMsg.includes('this barcode is already there') || errMsg.includes('already exists') || errMsg.includes('duplicate')) {
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'error',
          title: 'this barcode is already there pls add unique and SKU Code',
          showConfirmButton: false,
          timer: 5000,
          timerProgressBar: true,
          background: '#ffffff',
          color: '#0f172a',
          customClass: {
            popup: 'shadow'
          }
        });
      }
    } finally {
      setAddSubmitting(false);
    }
  };

  const handleStartEdit = (prod) => {
    setEditingProduct(prod);
    setEditMessage(null);
    setEditForm({
      product_name: prod.product_name || prod.name || '',
      category: prod.category || 'General',
      brand: prod.brand || 'General',
      gender: prod.gender || 'Unisex',
      description: prod.description || '',
      allow_manual_qty: prod.allow_manual_qty === 1 || prod.allow_manual_qty === true,
      sku: prod.sku || '',
      barcode: prod.barcode || '',
      size: prod.size || 'Free Size',
      color: prod.color || 'Standard',
      purchase_price: prod.purchase_price !== undefined ? prod.purchase_price : (prod.cost_price || 0.00),
      selling_price: prod.selling_price !== undefined ? prod.selling_price : (prod.price || 0.00),
      mrp: prod.mrp !== undefined ? prod.mrp : (prod.selling_price || prod.price || 0.00),
      stock_qty: prod.stock !== undefined ? prod.stock : (prod.stock_qty || 0),
      gst_percentage: prod.gst_percentage !== undefined ? prod.gst_percentage : '12.00'
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setEditMessage(null);
    setEditSubmitting(true);
    try {
      const payload = {
        ...editForm,
        purchase_price: parseFloat(editForm.purchase_price),
        selling_price: parseFloat(editForm.selling_price),
        mrp: parseFloat(editForm.mrp),
        stock_qty: parseInt(editForm.stock_qty, 10),
        gst_percentage: parseFloat(editForm.gst_percentage)
      };

      const response = await axios.put(`/products/${editingProduct.id}`, payload);
      setEditMessage({ type: 'success', text: response.data.message || 'Product variant and prices updated successfully!' });
      
      // Refresh local lists
      fetchAuxiliaryData();
      
      // Close modal after a brief delay
      setTimeout(() => {
        setEditingProduct(null);
      }, 1500);
    } catch (err) {
      console.error('Update product error:', err);
      const errMsg = err.response?.data?.message || 'Failed to update product variant.';
      setEditMessage({
        type: 'danger',
        text: errMsg
      });

      if (errMsg.includes('this barcode is already there') || errMsg.includes('already exists') || errMsg.includes('duplicate')) {
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'error',
          title: 'this barcode is already there pls add unique and SKU Code',
          showConfirmButton: false,
          timer: 5000,
          timerProgressBar: true,
          background: '#ffffff',
          color: '#0f172a',
          customClass: {
            popup: 'shadow'
          }
        });
      }
    } finally {
      setEditSubmitting(false);
    }
  };

  const fetchAuxiliaryData = async () => {
    try {
      const [prodRes, whRes] = await Promise.all([
        axios.get('/products'),
        axios.get('/warehouses')
      ]);
      setProducts(prodRes.data);
      setWarehouses(whRes.data);
    } catch (err) {
      console.error('Error fetching auxiliary data:', err);
    }
  };

  const fetchLedger = async () => {
    setLedgerLoading(true);
    try {
      const params = {};
      if (filterWarehouse) params.warehouse_id = filterWarehouse;
      if (filterProduct) params.product_id = filterProduct;
      if (filterType) params.type = filterType;

      const response = await axios.get('/inventory/ledger', { params });
      setLedger(response.data);
    } catch (err) {
      console.error('Fetch ledger error:', err);
    } finally {
      setLedgerLoading(false);
    }
  };

  const fetchLowStockAlerts = async () => {
    setLowStockLoading(true);
    try {
      const response = await axios.get('/inventory/low-stock');
      setLowStockList(response.data);
    } catch (err) {
      console.error('Fetch low stock error:', err);
    } finally {
      setLowStockLoading(false);
    }
  };

  // Reconciliation Worksheet: Fetch specific warehouse stock for physical auditing
  const fetchReconciliationStock = async (whId) => {
    if (!whId) {
      setReconcileItems([]);
      return;
    }
    setReconcileLoading(true);
    setReconcileMessage(null);
    try {
      const response = await axios.get(`/warehouses/${whId}/stock`);
      // Map response to include physical count field (default blank)
      const mapped = response.data.map(item => ({
        ...item,
        physical_qty: '' 
      }));
      setReconcileItems(mapped);
    } catch (err) {
      console.error('Fetch reconciliation stock error:', err);
      setReconcileMessage({ type: 'danger', text: 'Failed to load warehouse stock level mappings.' });
    } finally {
      setReconcileLoading(false);
    }
  };

  // Reconciliation Worksheet: Auto-copy system stock as starting point
  const handleCopySystemStock = () => {
    setReconcileItems(prev => prev.map(item => ({
      ...item,
      physical_qty: item.localized_stock.toString()
    })));
  };

  // Reconciliation Worksheet: Update physical count input on worksheet
  const handlePhysicalCountChange = (productId, val) => {
    setReconcileItems(prev => prev.map(item => {
      if (item.product_id === productId) {
        return { ...item, physical_qty: val };
      }
      return item;
    }));
  };

  // Reconciliation Worksheet: Bulk commit transactions to backend
  const handleCommitReconciliation = async (e) => {
    e.preventDefault();
    setReconcileMessage(null);

    // Validate that at least one item has a entered physical quantity
    const itemsToSubmit = reconcileItems
      .filter(item => item.physical_qty !== '')
      .map(item => ({
        product_id: item.product_id,
        physical_qty: parseInt(item.physical_qty, 10)
      }));

    if (itemsToSubmit.length === 0) {
      setReconcileMessage({ type: 'danger', text: 'Please enter a physical count for at least one dress product.' });
      return;
    }

    // Verify no negative values were typed
    if (itemsToSubmit.some(item => isNaN(item.physical_qty) || item.physical_qty < 0)) {
      setReconcileMessage({ type: 'danger', text: 'Physical quantity counts must be non-negative integers.' });
      return;
    }

    setReconcileSubmitting(true);
    try {
      const response = await axios.post('/inventory/reconcile', {
        warehouse_id: parseInt(reconcileWarehouseId),
        items: itemsToSubmit,
        reference: reconcileMemo
      });

      setReconcileMessage({ type: 'success', text: response.data.message || 'Audit reconciled and inventory corrected successfully!' });
      setReconcileMemo('');
      
      // Reload current warehouse stocks to reflect corrected physical levels
      fetchReconciliationStock(reconcileWarehouseId);
      fetchAuxiliaryData();
    } catch (err) {
      console.error('Commit reconciliation error:', err);
      setReconcileMessage({ 
        type: 'danger', 
        text: err.response?.data?.message || 'Failed to sync reconciliation audit trail.' 
      });
    } finally {
      setReconcileSubmitting(false);
    }
  };

  // Valuation Dashboard: Fetch financial assets analytics
  const fetchValuationData = async () => {
    // Only fetch if role is authorized
    if (user && !['Shop Owner', 'Admin', 'Manager'].includes(user.role)) {
      return;
    }
    setValuationLoading(true);
    try {
      const response = await axios.get('/inventory/valuation');
      setValuationData(response.data);
    } catch (err) {
      console.error('Fetch valuation error:', err);
    } finally {
      setValuationLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'ledger') {
      fetchLedger();
    } else if (activeTab === 'low-stock') {
      fetchLowStockAlerts();
    } else if (activeTab === 'valuation') {
      fetchValuationData();
    } else if (activeTab === 'reconcile') {
      setReconcileWarehouseId('');
      setReconcileItems([]);
      setReconcileMessage(null);
    }
  }, [activeTab, filterWarehouse, filterProduct, filterType]);

  const handleInventoryAction = async (e) => {
    e.preventDefault();
    setActionMessage(null);
    const qty = parseInt(quantity, 10);

    if (isNaN(qty) || qty <= 0) {
      setActionMessage({ type: 'danger', text: 'Please enter a valid positive integer quantity.' });
      return;
    }

    setSubmitting(true);
    try {
      let endpoint = '';
      let payload = {
        product_id: parseInt(selectedProductId),
        quantity: qty,
        reference
      };

      if (actionType === 'stock-in') {
        endpoint = '/inventory/stock-in';
        payload.warehouse_id = parseInt(selectedWarehouseId);
      } else if (actionType === 'stock-out') {
        endpoint = '/inventory/stock-out';
        payload.warehouse_id = parseInt(selectedWarehouseId);
      } else if (actionType === 'damage') {
        endpoint = '/inventory/damage';
        payload.warehouse_id = parseInt(selectedWarehouseId);
      } else if (actionType === 'transfer') {
        endpoint = '/inventory/transfer';
        payload.source_warehouse_id = parseInt(sourceWarehouseId);
        payload.target_warehouse_id = parseInt(targetWarehouseId);
      } else if (actionType === 'adjust') {
        endpoint = '/inventory/adjust';
        payload.warehouse_id = parseInt(selectedWarehouseId);
        payload.adjustment_type = adjustmentType;
      }

      const response = await axios.post(endpoint, payload);
      setActionMessage({ type: 'success', text: response.data.message || 'Inventory transaction committed successfully!' });
      
      // Reset input fields
      setSelectedProductId('');
      setSelectedWarehouseId('');
      setSourceWarehouseId('');
      setTargetWarehouseId('');
      setQuantity('');
      setReference('');
      
      // Refresh options
      fetchAuxiliaryData();
    } catch (err) {
      console.error('Inventory action failed:', err);
      setActionMessage({ 
        type: 'danger', 
        text: err.response?.data?.message || 'Transaction failed. Please verify stocks and parameters.' 
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Filter reconciliation items worksheet by product name or SKU
  const filteredReconcileItems = reconcileItems.filter(item => 
    item.product_name.toLowerCase().includes(reconcileSearch.toLowerCase()) ||
    item.sku.toLowerCase().includes(reconcileSearch.toLowerCase())
  );

  // Filter products valuation table
  const filteredValuations = valuationData?.productValuations.filter(item => 
    item.name.toLowerCase().includes(valuationSearch.toLowerCase()) ||
    item.sku.toLowerCase().includes(valuationSearch.toLowerCase())
  ) || [];

  return (
    <div className="container-fluid py-4" style={{ fontFamily: 'Inter, sans-serif' }}>
      
      {/* Page Header */}
      <div className="mb-4">
        <h1 className="h3 font-heading fw-bold m-0" style={{ color: '#0F172A' }}>
          Inventory Workspace
        </h1>
        <p className="text-muted m-0" style={{ fontSize: '0.9rem' }}>
          Manage scannable pieces, perform physical audit counts, adjust warehouse levels, and inspect overall valuation metrics.
        </p>
      </div>

      {/* Tabs Menu */}
      <ul className="nav nav-pills mb-4 gap-2 bg-light p-1.5 rounded-3 d-inline-flex" style={{ border: '1px solid #E2E8F0' }}>
        <li className="nav-item">
          <button 
            className="nav-link px-3.5 py-2 fw-semibold transition-all border-0"
            style={{ 
              backgroundColor: activeTab === 'ledger' ? '#2563EB' : 'transparent',
              color: activeTab === 'ledger' ? '#FFFFFF' : '#64748B',
              borderRadius: '6px',
              fontSize: '0.85rem'
            }}
            onClick={() => setActiveTab('ledger')}
          >
            Stock Ledger History
          </button>
        </li>
        <li className="nav-item">
          <button 
            className="nav-link px-3.5 py-2 fw-semibold transition-all border-0"
            style={{ 
              backgroundColor: activeTab === 'actions' ? '#2563EB' : 'transparent',
              color: activeTab === 'actions' ? '#FFFFFF' : '#64748B',
              borderRadius: '6px',
              fontSize: '0.85rem'
            }}
            onClick={() => setActiveTab('actions')}
          >
            Inventory Adjustments
          </button>
        </li>
        <li className="nav-item">
          <button 
            className="nav-link px-3.5 py-2 fw-semibold transition-all border-0"
            style={{ 
              backgroundColor: activeTab === 'reconcile' ? '#2563EB' : 'transparent',
              color: activeTab === 'reconcile' ? '#FFFFFF' : '#64748B',
              borderRadius: '6px',
              fontSize: '0.85rem'
            }}
            onClick={() => setActiveTab('reconcile')}
          >
            Stock Reconciliation
          </button>
        </li>
        <li className="nav-item">
          <button 
            className="nav-link px-3.5 py-2 fw-semibold transition-all border-0"
            style={{ 
              backgroundColor: activeTab === 'low-stock' ? '#2563EB' : 'transparent',
              color: activeTab === 'low-stock' ? '#FFFFFF' : '#64748B',
              borderRadius: '6px',
              fontSize: '0.85rem'
            }}
            onClick={() => setActiveTab('low-stock')}
          >
            Low Stock Alerts
          </button>
        </li>
        <li className="nav-item">
          <button 
            className="nav-link px-3.5 py-2 fw-semibold transition-all border-0"
            style={{ 
              backgroundColor: activeTab === 'valuation' ? '#2563EB' : 'transparent',
              color: activeTab === 'valuation' ? '#FFFFFF' : '#64748B',
              borderRadius: '6px',
              fontSize: '0.85rem'
            }}
            onClick={() => setActiveTab('valuation')}
          >
            Inventory Valuation
          </button>
        </li>
        <li className="nav-item">
          <button 
            className="nav-link px-3.5 py-2 fw-semibold transition-all border-0"
            style={{ 
              backgroundColor: activeTab === 'catalog' ? '#2563EB' : 'transparent',
              color: activeTab === 'catalog' ? '#FFFFFF' : '#64748B',
              borderRadius: '6px',
              fontSize: '0.85rem'
            }}
            onClick={() => setActiveTab('catalog')}
          >
            Product Catalog & Prices
          </button>
        </li>
      </ul>

      {/* ======================================================== */}
      {/* TAB 1: STOCK LEDGER HISTORY */}
      {/* ======================================================== */}
      {activeTab === 'ledger' && (
        <div className="card border-0 shadow-sm rounded-3 p-4 bg-white animate-fade-in">
          
          {/* Audit Filters Bar */}
          <div className="row g-3 mb-4 align-items-end">
            <div className="col-md-3">
              <label htmlFor="filter-wh" className="form-label text-muted fw-semibold" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>Filter Warehouse</label>
              <select 
                id="filter-wh"
                className="form-select border-light-subtle py-2"
                style={{ borderRadius: '8px', fontSize: '0.85rem' }}
                value={filterWarehouse}
                onChange={(e) => setFilterWarehouse(e.target.value)}
              >
                <option value="">All Warehouses</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            
            <div className="col-md-3">
              <label htmlFor="filter-prod" className="form-label text-muted fw-semibold" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>Filter Product</label>
              <select 
                id="filter-prod"
                className="form-select border-light-subtle py-2"
                style={{ borderRadius: '8px', fontSize: '0.85rem' }}
                value={filterProduct}
                onChange={(e) => setFilterProduct(e.target.value)}
              >
                <option value="">All Dress Products</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
              </select>
            </div>

            <div className="col-md-3">
              <label htmlFor="filter-type" className="form-label text-muted fw-semibold" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>Movement Type</label>
              <select 
                id="filter-type"
                className="form-select border-light-subtle py-2"
                style={{ borderRadius: '8px', fontSize: '0.85rem' }}
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="">All Operations</option>
                <option value="Stock In">Stock In (+)</option>
                <option value="Stock Out">Stock Out (-)</option>
                <option value="Stock Transfer">Warehouse Relocation</option>
                <option value="Stock Adjustment">Force Adjustment</option>
                <option value="Stock Reconciliation">Audit Reconciliation</option>
                <option value="Damage">Damage (-)</option>
              </select>
            </div>

            <div className="col-md-3">
              <button 
                className="btn btn-light w-100 py-2 border-0 fw-semibold d-flex align-items-center justify-content-center gap-1.5"
                style={{ backgroundColor: '#F1F5F9', color: '#64748B', borderRadius: '8px', fontSize: '0.85rem' }}
                onClick={() => {
                  setFilterWarehouse('');
                  setFilterProduct('');
                  setFilterType('');
                }}
              >
                Reset Filters
              </button>
            </div>
          </div>

          {ledgerLoading ? (
            <div className="d-flex justify-content-center py-5">
              <div className="spinner-border text-primary" role="status" />
            </div>
          ) : ledger.length === 0 ? (
            <div className="text-center py-5 bg-light rounded-3">
              <ClipboardList size={36} className="text-muted mb-2 opacity-50" />
              <p className="text-muted m-0" style={{ fontSize: '0.9rem' }}>No transaction history found with current filters.</p>
            </div>
          ) : (
            <div className="table-responsive rounded-3 border" style={{ borderColor: '#F1F5F9' }}>
              <table className="table table-hover align-middle mb-0" style={{ fontSize: '0.9rem' }}>
                <thead style={{ backgroundColor: '#F8FAFC' }}>
                  <tr>
                    <th className="py-3 px-3 border-0 text-muted fw-semibold" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>Date & Time</th>
                    <th className="py-3 px-3 border-0 text-muted fw-semibold" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>Dress Product</th>
                    <th className="py-3 px-3 border-0 text-muted fw-semibold" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>Location</th>
                    <th className="py-3 px-3 border-0 text-muted fw-semibold" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>Operation</th>
                    <th className="py-3 px-3 border-0 text-end text-muted fw-semibold" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>Quantity</th>
                    <th className="py-3 px-3 border-0 text-muted fw-semibold" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>Reference Log / Memo</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((item) => {
                    const isAddition = ['Stock In'].includes(item.type) || (item.type === 'Stock Adjustment' && parseInt(item.quantity, 10) > 0) || (item.type === 'Stock Reconciliation' && parseInt(item.quantity, 10) > 0);
                    const isReduction = ['Stock Out', 'Damage'].includes(item.type) || (item.type === 'Stock Adjustment' && parseInt(item.quantity, 10) < 0) || (item.type === 'Stock Reconciliation' && parseInt(item.quantity, 10) < 0);
                    const isNeutral = item.type === 'Stock Transfer' || parseInt(item.quantity, 10) === 0;

                    let badgeColor = 'rgba(100, 116, 139, 0.1)';
                    let badgeText = '#475569';
                    if (isAddition) {
                      badgeColor = 'rgba(16, 185, 129, 0.1)';
                      badgeText = '#10B981';
                    } else if (isReduction) {
                      badgeColor = 'rgba(239, 68, 68, 0.1)';
                      badgeText = '#EF4444';
                    } else if (item.type === 'Stock Adjustment') {
                      badgeColor = 'rgba(245, 158, 11, 0.1)';
                      badgeText = '#F59E0B';
                    }

                    return (
                      <tr key={item.id}>
                        <td className="py-3.5 px-3">
                          <span className="text-muted d-flex align-items-center gap-1.5" style={{ fontSize: '0.8rem' }}>
                            <Calendar size={12} />
                            {new Date(item.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                          </span>
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="fw-semibold text-dark">{item.product_name}</div>
                          <span className="text-muted" style={{ fontSize: '0.75rem' }}>SKU: {item.sku}</span>
                        </td>
                        <td className="py-3.5 px-3">
                          <span className="d-flex align-items-center gap-1 text-dark" style={{ fontSize: '0.85rem' }}>
                            <Warehouse size={13} className="text-muted" />
                            {item.warehouse_name}
                          </span>
                        </td>
                        <td className="py-3.5 px-3">
                          <span 
                            className="badge rounded-pill fw-semibold d-inline-flex align-items-center gap-1 px-2.5 py-1"
                            style={{ 
                              fontSize: '0.75rem',
                              backgroundColor: badgeColor,
                              color: badgeText
                            }}
                          >
                            {isAddition && <ArrowDownLeft size={12} />}
                            {isReduction && <ArrowUpRight size={12} />}
                            {isNeutral && <RefreshCcw size={12} />}
                            <span>{item.type}</span>
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-end fw-bold">
                          <span style={{ color: isAddition ? '#10B981' : isReduction ? '#EF4444' : '#0F172A' }}>
                            {isAddition ? '+' : ''}{parseInt(item.quantity, 10)}
                          </span>
                          <span className="text-muted fw-normal font-sans ms-1" style={{ fontSize: '0.8rem' }}>{item.unit}</span>
                        </td>
                        <td className="py-3.5 px-3 text-muted" style={{ fontSize: '0.85rem', maxWidth: '320px', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                          <span>{item.reference || '-'}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: INVENTORY ADJUSTMENTS */}
      {/* ======================================================== */}
      {activeTab === 'actions' && (
        <div className="row g-4 animate-fade-in">
          
          {/* Action selection side list */}
          <div className="col-lg-4">
            <div className="card border-0 shadow-sm rounded-3 p-3 bg-white">
              <h6 className="fw-bold font-heading text-muted mb-3 p-1" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Relocation & Operations
              </h6>
              
              <div className="d-flex flex-column gap-2">
                <button 
                  onClick={() => { setActionType('stock-in'); setActionMessage(null); }}
                  className="btn w-100 py-3 px-3 border-0 rounded-3 text-start d-flex align-items-center justify-content-between"
                  style={{ 
                    backgroundColor: actionType === 'stock-in' ? '#2563EB' : '#F8FAFC',
                    color: actionType === 'stock-in' ? '#FFFFFF' : '#0F172A',
                    transition: 'all 0.2s'
                  }}
                >
                  <div className="d-flex align-items-center gap-2">
                    <ArrowDownLeft size={18} />
                    <span className="fw-semibold">1. Stock In</span>
                  </div>
                  <span className="text-muted-color" style={{ fontSize: '0.75rem', opacity: 0.7 }}>Replenish depot</span>
                </button>

                <button 
                  onClick={() => { setActionType('stock-out'); setActionMessage(null); }}
                  className="btn w-100 py-3 px-3 border-0 rounded-3 text-start d-flex align-items-center justify-content-between"
                  style={{ 
                    backgroundColor: actionType === 'stock-out' ? '#2563EB' : '#F8FAFC',
                    color: actionType === 'stock-out' ? '#FFFFFF' : '#0F172A',
                    transition: 'all 0.2s'
                  }}
                >
                  <div className="d-flex align-items-center gap-2">
                    <ArrowUpRight size={18} />
                    <span className="fw-semibold">2. Stock Out</span>
                  </div>
                  <span className="text-muted-color" style={{ fontSize: '0.75rem', opacity: 0.7 }}>Dispatch goods</span>
                </button>

                <button 
                  onClick={() => { setActionType('transfer'); setActionMessage(null); }}
                  className="btn w-100 py-3 px-3 border-0 rounded-3 text-start d-flex align-items-center justify-content-between"
                  style={{ 
                    backgroundColor: actionType === 'transfer' ? '#2563EB' : '#F8FAFC',
                    color: actionType === 'transfer' ? '#FFFFFF' : '#0F172A',
                    transition: 'all 0.2s'
                  }}
                >
                  <div className="d-flex align-items-center gap-2">
                    <RefreshCcw size={18} />
                    <span className="fw-semibold">3. Stock Transfer</span>
                  </div>
                  <span className="text-muted-color" style={{ fontSize: '0.75rem', opacity: 0.7 }}>Warehouse transit</span>
                </button>

                <button 
                  onClick={() => { setActionType('damage'); setActionMessage(null); }}
                  className="btn w-100 py-3 px-3 border-0 rounded-3 text-start d-flex align-items-center justify-content-between"
                  style={{ 
                    backgroundColor: actionType === 'damage' ? '#2563EB' : '#F8FAFC',
                    color: actionType === 'damage' ? '#FFFFFF' : '#0F172A',
                    transition: 'all 0.2s'
                  }}
                >
                  <div className="d-flex align-items-center gap-2">
                    <AlertTriangle size={18} />
                    <span className="fw-semibold">4. Damage Adjustment</span>
                  </div>
                  <span className="text-muted-color" style={{ fontSize: '0.75rem', opacity: 0.7 }}>Write-off stock</span>
                </button>

                <button 
                  onClick={() => { setActionType('adjust'); setActionMessage(null); }}
                  className="btn w-100 py-3 px-3 border-0 rounded-3 text-start d-flex align-items-center justify-content-between"
                  style={{ 
                    backgroundColor: actionType === 'adjust' ? '#2563EB' : '#F8FAFC',
                    color: actionType === 'adjust' ? '#FFFFFF' : '#0F172A',
                    transition: 'all 0.2s'
                  }}
                >
                  <div className="d-flex align-items-center gap-2">
                    <Scale size={18} />
                    <span className="fw-semibold">5. Force stock adjust</span>
                  </div>
                  <span className="text-muted-color" style={{ fontSize: '0.75rem', opacity: 0.7 }}>Manual Overrides</span>
                </button>
              </div>

            </div>
          </div>

          {/* Action Adjustment Form Panel */}
          <div className="col-lg-8">
            <div className="card border-0 shadow-sm rounded-3 p-4 bg-white h-100">
              <h5 className="fw-bold font-heading text-dark mb-4">
                {actionType === 'stock-in' && 'Process Stock In (Receipt Entry)'}
                {actionType === 'stock-out' && 'Process Stock Out (Dispatch Entry)'}
                {actionType === 'transfer' && 'Warehouse Relocation (Atomic Stock Transfer)'}
                {actionType === 'damage' && 'Damage Goods Register (Loss Adjustment)'}
                {actionType === 'adjust' && 'Manual Force Adjustment (Stock Override)'}
              </h5>

              {actionMessage && (
                <div className={`alert alert-${actionMessage.type} d-flex align-items-center gap-2`} role="alert" style={{ borderRadius: '8px' }}>
                  {actionMessage.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                  <div>{actionMessage.text}</div>
                </div>
              )}

              <form onSubmit={handleInventoryAction}>
                <div className="row">
                  
                  {/* Select Product */}
                  <div className="col-12 mb-3">
                    <label htmlFor="act-prod" className="form-label text-muted fw-semibold" style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}>Select Dress Product</label>
                    <select 
                      id="act-prod"
                      className="form-select py-2.5"
                      style={{ borderRadius: '8px', fontSize: '0.9rem' }}
                      required
                      value={selectedProductId}
                      onChange={(e) => setSelectedProductId(e.target.value)}
                    >
                      <option value="">-- Choose Dress Variant --</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.sku}) — Cumulative: {parseInt(p.stock, 10)} {p.unit}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Force adjustment operation toggles */}
                  {actionType === 'adjust' && (
                    <div className="col-12 mb-3">
                      <label className="form-label text-muted fw-semibold d-block" style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}>Adjustment Strategy</label>
                      <div className="btn-group w-100" role="group">
                        <button 
                          type="button" 
                          className={`btn py-2.5 ${adjustmentType === 'add' ? 'btn-primary' : 'btn-outline-secondary'}`}
                          style={{ borderTopLeftRadius: '8px', borderBottomLeftRadius: '8px', fontSize: '0.9rem' }}
                          onClick={() => setAdjustmentType('add')}
                        >
                          Increment Stock (+)
                        </button>
                        <button 
                          type="button" 
                          className={`btn py-2.5 ${adjustmentType === 'subtract' ? 'btn-primary' : 'btn-outline-secondary'}`}
                          style={{ fontSize: '0.9rem' }}
                          onClick={() => setAdjustmentType('subtract')}
                        >
                          Decrement Stock (-)
                        </button>
                        <button 
                          type="button" 
                          className={`btn py-2.5 ${adjustmentType === 'set' ? 'btn-primary' : 'btn-outline-secondary'}`}
                          style={{ borderTopRightRadius: '8px', borderBottomRightRadius: '8px', fontSize: '0.9rem' }}
                          onClick={() => setAdjustmentType('set')}
                        >
                          Set Raw Balance (=)
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Standard Warehouse Selector (for In, Out, Damage, Adjust) */}
                  {actionType !== 'transfer' && (
                    <div className="col-12 mb-3">
                      <label htmlFor="act-wh" className="form-label text-muted fw-semibold" style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}>Depot Location</label>
                      <select 
                        id="act-wh"
                        className="form-select py-2.5"
                        style={{ borderRadius: '8px', fontSize: '0.9rem' }}
                        required
                        value={selectedWarehouseId}
                        onChange={(e) => setSelectedWarehouseId(e.target.value)}
                      >
                        <option value="">-- Choose Storage Warehouse --</option>
                        {warehouses.map(w => <option key={w.id} value={w.id}>{w.name} ({w.location})</option>)}
                      </select>
                    </div>
                  )}

                  {/* Relocation Selectors (Source vs Target for Transfer) */}
                  {actionType === 'transfer' && (
                    <>
                      <div className="col-md-6 mb-3">
                        <label htmlFor="act-src" className="form-label text-muted fw-semibold" style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}>Source (Origin Depot)</label>
                        <select 
                          id="act-src"
                          className="form-select py-2.5"
                          style={{ borderRadius: '8px', fontSize: '0.9rem' }}
                          required
                          value={sourceWarehouseId}
                          onChange={(e) => setSourceWarehouseId(e.target.value)}
                        >
                          <option value="">-- Origin Warehouse --</option>
                          {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                      </div>

                      <div className="col-md-6 mb-3">
                        <label htmlFor="act-tgt" className="form-label text-muted fw-semibold" style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}>Destination (Target Depot)</label>
                        <select 
                          id="act-tgt"
                          className="form-select py-2.5"
                          style={{ borderRadius: '8px', fontSize: '0.9rem' }}
                          required
                          value={targetWarehouseId}
                          onChange={(e) => setTargetWarehouseId(e.target.value)}
                        >
                          <option value="">-- Target Warehouse --</option>
                          {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                      </div>
                    </>
                  )}

                  {/* Quantity to Move */}
                  <div className="col-md-6 mb-3">
                    <label htmlFor="act-qty" className="form-label text-muted fw-semibold" style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}>Adjustment Quantity</label>
                    <input
                      id="act-qty"
                      type="number"
                      step="1"
                      className="form-control py-2.5"
                      placeholder="e.g. 10"
                      required
                      min="1"
                      style={{ borderRadius: '8px', fontSize: '0.9rem' }}
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                    />
                  </div>

                  {/* Reference Note */}
                  <div className="col-md-6 mb-4">
                    <label htmlFor="act-ref" className="form-label text-muted fw-semibold" style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}>Reference Log Note</label>
                    <input
                      id="act-ref"
                      type="text"
                      className="form-control py-2.5"
                      placeholder="e.g. Damaged edge piece or Stock Audit Correction"
                      style={{ borderRadius: '8px', fontSize: '0.9rem' }}
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                    />
                  </div>

                </div>

                <div className="d-flex justify-content-end border-top pt-4">
                  <button 
                    type="submit" 
                    disabled={submitting}
                    className="btn text-white px-5 py-2.5 border-0 fw-semibold"
                    style={{ backgroundColor: '#2563EB', borderRadius: '8px' }}
                  >
                    {submitting ? 'Processing Transaction...' : 'Commit Movement'}
                  </button>
                </div>
              </form>
            </div>
          </div>

        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: STOCK RECONCILIATION */}
      {/* ======================================================== */}
      {activeTab === 'reconcile' && (
        <div className="card border-0 shadow-sm rounded-3 p-4 bg-white animate-fade-in">
          
          <div className="mb-4 d-flex justify-content-between align-items-center flex-wrap gap-3">
            <div>
              <h5 className="fw-bold font-heading text-dark m-0">Physical Stock Reconciliation</h5>
              <span className="text-muted" style={{ fontSize: '0.85rem' }}>Select warehouse, record physical measurements on the audit worksheet, calculate discrepancies and resolve atomic errors.</span>
            </div>
            
            {reconcileItems.length > 0 && (
              <button
                onClick={handleCopySystemStock}
                className="btn btn-outline-primary d-flex align-items-center gap-1.5 fw-semibold"
                style={{ borderRadius: '8px', fontSize: '0.85rem' }}
              >
                <ListChecks size={16} />
                Copy System Stock
              </button>
            )}
          </div>

          {reconcileMessage && (
            <div className={`alert alert-${reconcileMessage.type} d-flex align-items-center gap-2 mb-4`} role="alert" style={{ borderRadius: '8px' }}>
              {reconcileMessage.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
              <div>{reconcileMessage.text}</div>
            </div>
          )}

          {/* Warehouse selector panel */}
          <div className="row g-3 mb-4">
            <div className="col-md-5">
              <label htmlFor="rec-wh" className="form-label text-muted fw-semibold" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>Select Audit Location</label>
              <select
                id="rec-wh"
                className="form-select border-light-subtle py-2.5"
                style={{ borderRadius: '8px', fontSize: '0.9rem' }}
                value={reconcileWarehouseId}
                onChange={(e) => {
                  const val = e.target.value;
                  setReconcileWarehouseId(val);
                  fetchReconciliationStock(val);
                }}
              >
                <option value="">-- Choose Storage Warehouse to Audit --</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name} ({w.location})</option>)}
              </select>
            </div>

            {reconcileWarehouseId && (
              <div className="col-md-7 d-flex align-items-end">
                <div className="input-group">
                  <span className="input-group-text bg-light border-light-subtle"><Search size={16} className="text-muted" /></span>
                  <input
                    type="text"
                    className="form-control border-light-subtle py-2"
                    placeholder="Quick search products in this warehouse..."
                    style={{ borderTopRightRadius: '8px', borderBottomRightRadius: '8px', fontSize: '0.9rem' }}
                    value={reconcileSearch}
                    onChange={(e) => setReconcileSearch(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          {reconcileLoading ? (
            <div className="d-flex justify-content-center py-5">
              <div className="spinner-border text-primary" role="status" />
            </div>
          ) : !reconcileWarehouseId ? (
            <div className="text-center py-5 bg-light rounded-3">
              <Warehouse size={40} className="text-muted mb-2 opacity-50" />
              <p className="text-muted m-0" style={{ fontSize: '0.9rem' }}>Please select a depot location above to start the physical count audit trail worksheet.</p>
            </div>
          ) : filteredReconcileItems.length === 0 ? (
            <div className="text-center py-5 bg-light rounded-3">
              <Package size={40} className="text-muted mb-2 opacity-50" />
              <p className="text-muted m-0" style={{ fontSize: '0.9rem' }}>No products allocated inside this warehouse or matches search criteria.</p>
            </div>
          ) : (
            <form onSubmit={handleCommitReconciliation}>
              <div className="table-responsive rounded-3 border mb-4" style={{ borderColor: '#F1F5F9' }}>
                <table className="table table-hover align-middle mb-0" style={{ fontSize: '0.9rem' }}>
                  <thead style={{ backgroundColor: '#F8FAFC' }}>
                    <tr>
                      <th className="py-3 px-3 border-0 text-muted fw-semibold" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>Dress Product</th>
                      <th className="py-3 px-3 border-0 text-muted fw-semibold" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>SKU Code</th>
                      <th className="py-3 px-3 border-0 text-end text-muted fw-semibold" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>System Stock</th>
                      <th className="py-3 px-3 border-0 text-muted fw-semibold text-center" style={{ fontSize: '0.75rem', textTransform: 'uppercase', width: '220px' }}>Physical count input</th>
                      <th className="py-3 px-3 border-0 text-end text-muted fw-semibold" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>Discrepancy (Pcs)</th>
                      <th className="py-3 px-3 border-0 text-center text-muted fw-semibold" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>Audit Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReconcileItems.map((item) => {
                      const system_stock = parseInt(item.localized_stock, 10);
                      const physical_val = parseInt(item.physical_qty, 10);
                      const hasInput = item.physical_qty !== '';
                      const discrepancy = hasInput ? (physical_val - system_stock) : 0;
                      
                      let statusBadge = <span className="badge text-secondary bg-secondary bg-opacity-10 py-1 px-2.5">PENDING</span>;
                      if (hasInput) {
                        if (discrepancy === 0) {
                          statusBadge = <span className="badge text-success bg-success bg-opacity-10 py-1 px-2.5">VERIFIED</span>;
                        } else if (discrepancy > 0) {
                          statusBadge = <span className="badge text-primary bg-primary bg-opacity-10 py-1 px-2.5">SURPLUS (+)</span>;
                        } else {
                          statusBadge = <span className="badge text-danger bg-danger bg-opacity-10 py-1 px-2.5">DEFICIT (-)</span>;
                        }
                      }

                      return (
                        <tr key={item.product_id}>
                          <td className="py-3 px-3 fw-semibold text-dark">{item.product_name}</td>
                          <td className="py-3 px-3 text-muted">{item.sku}</td>
                          <td className="py-3 px-3 text-end fw-bold text-dark">
                            {system_stock} <span className="text-muted fw-normal" style={{ fontSize: '0.75rem' }}>{item.unit}</span>
                          </td>
                          <td className="py-3 px-3">
                            <div className="input-group input-group-sm mx-auto" style={{ maxWidth: '160px' }}>
                              <input
                                type="number"
                                step="1"
                                min="0"
                                className="form-control text-center font-monospace py-1.5 fw-bold"
                                style={{ borderRadius: '6px' }}
                                placeholder="--"
                                value={item.physical_qty}
                                onChange={(e) => handlePhysicalCountChange(item.product_id, e.target.value)}
                              />
                            </div>
                          </td>
                          <td className="py-3 px-3 text-end fw-bold">
                            {hasInput ? (
                              <span style={{ color: discrepancy > 0 ? '#2563EB' : discrepancy < 0 ? '#EF4444' : '#10B981' }}>
                                {discrepancy > 0 ? '+' : ''}{discrepancy}
                              </span>
                            ) : (
                              <span className="text-muted">-</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center">{statusBadge}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Memo note & Submit */}
              <div className="row g-3 align-items-center">
                <div className="col-md-8">
                  <div className="input-group">
                    <span className="input-group-text bg-light border-light-subtle text-muted" style={{ fontSize: '0.85rem' }}>Routine Audit Memo:</span>
                    <input
                      type="text"
                      className="form-control border-light-subtle py-2"
                      placeholder="e.g. Q2 Inventory Audit or Roll discrepancy check"
                      style={{ fontSize: '0.9rem' }}
                      value={reconcileMemo}
                      onChange={(e) => setReconcileMemo(e.target.value)}
                    />
                  </div>
                </div>
                <div className="col-md-4 text-end">
                  <button
                    type="submit"
                    disabled={reconcileSubmitting}
                    className="btn btn-primary w-100 py-2 fw-semibold d-flex align-items-center justify-content-center gap-1.5"
                    style={{ borderRadius: '8px' }}
                  >
                    {reconcileSubmitting ? (
                      <>
                        <div className="spinner-border spinner-border-sm text-white" role="status" />
                        Committing Audit...
                      </>
                    ) : (
                      <>
                        <CheckCircle size={16} />
                        Commit Reconciliation Audit
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          )}

        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 4: LOW STOCK ALERTS */}
      {/* ======================================================== */}
      {activeTab === 'low-stock' && (
        <div className="card border-0 shadow-sm rounded-3 p-4 bg-white animate-fade-in">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <div>
              <h5 className="fw-bold font-heading text-dark m-0">Critical Alarm Panel</h5>
              <span className="text-muted" style={{ fontSize: '0.8rem' }}>Lists dress products whose cumulative stock levels fall below 10 units.</span>
            </div>
            
            <span className="badge px-3 py-1.5 fw-bold" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#F59E0B', borderRadius: '6px' }}>
              Threshold Limit: 10 Pieces
            </span>
          </div>

          {lowStockLoading ? (
            <div className="d-flex justify-content-center py-5">
              <div className="spinner-border text-primary" role="status" />
            </div>
          ) : lowStockList.length === 0 ? (
            <div className="text-center py-5 bg-opacity-10 rounded-3" style={{ backgroundColor: '#F8FAFC' }}>
              <CheckCircle size={36} className="text-success mb-2" />
              <p className="text-dark fw-semibold m-0" style={{ fontSize: '0.95rem' }}>Healthy Levels!</p>
              <span className="text-muted" style={{ fontSize: '0.8rem' }}>All dress products are sufficiently stocked.</span>
            </div>
          ) : (
            <div className="table-responsive rounded-3 border" style={{ borderColor: '#F1F5F9' }}>
              <table className="table table-hover align-middle mb-0" style={{ fontSize: '0.9rem' }}>
                <thead style={{ backgroundColor: '#F8FAFC' }}>
                  <tr>
                    <th className="py-3 px-3 border-0 text-muted fw-semibold" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>Dress Product</th>
                    <th className="py-3 px-3 border-0 text-muted fw-semibold" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>SKU</th>
                    <th className="py-3 px-3 border-0 text-muted fw-semibold" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>Category</th>
                    <th className="py-3 px-3 border-0 text-muted fw-semibold" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>Barcode ID</th>
                    <th className="py-3 px-3 border-0 text-end text-muted fw-semibold" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>Price (Pc)</th>
                    <th className="py-3 px-3 border-0 text-end text-muted fw-semibold" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>Cumulative Stock</th>
                    <th className="py-3 px-3 border-0 text-center text-muted fw-semibold" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>Status Alarm</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStockList.map((item) => {
                    const isCritical = parseInt(item.stock, 10) <= 5;
                    return (
                      <tr key={item.id}>
                        <td className="py-3.5 px-3 fw-bold text-dark">{item.name}</td>
                        <td className="py-3.5 px-3 text-muted">{item.sku}</td>
                        <td className="py-3.5 px-3">
                          <span className="badge text-primary bg-primary bg-opacity-10" style={{ fontSize: '0.75rem' }}>
                            {item.category}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-muted font-heading">{item.barcode}</td>
                        <td className="py-3.5 px-3 text-end fw-semibold text-dark">₹{parseFloat(item.price).toFixed(2)}</td>
                        <td className="py-3.5 px-3 text-end fw-bold text-danger" style={{ fontSize: '1rem' }}>
                          {parseInt(item.stock, 10)} <span className="text-muted fw-normal" style={{ fontSize: '0.8rem' }}>{item.unit}</span>
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          <span 
                            className={`badge rounded-pill fw-semibold px-2.5 py-1`}
                            style={{ 
                              fontSize: '0.7rem',
                              backgroundColor: isCritical ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                              color: isCritical ? '#EF4444' : '#F59E0B'
                            }}
                          >
                            {isCritical ? 'CRITICAL LOW' : 'LOW STOCK'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 5: INVENTORY VALUATION */}
      {/* ======================================================== */}
      {activeTab === 'valuation' && (
        <div className="animate-fade-in">
          
          {/* Security Authorization Guard for Non-Admin/Manager Roles */}
          {user && !['Shop Owner', 'Admin', 'Manager'].includes(user.role) ? (
            <div className="card border-0 shadow-sm rounded-3 p-5 text-center bg-white">
              <div className="mx-auto bg-danger bg-opacity-10 text-danger rounded-circle d-flex align-items-center justify-content-center mb-4" style={{ width: '70px', height: '70px' }}>
                <ShieldAlert size={36} />
              </div>
              <h4 className="fw-bold text-dark font-heading mb-2">Authorized Personnel Only</h4>
              <p className="text-muted mx-auto" style={{ maxWidth: '480px', fontSize: '0.95rem' }}>
                Financial audits, asset ledger valuations, and product cost splits are restricted to **Admin** and **Manager** profiles. Please contact your coordinator.
              </p>
            </div>
          ) : valuationLoading ? (
            <div className="card border-0 shadow-sm rounded-3 p-5 text-center bg-white">
              <div className="spinner-border text-primary py-3" role="status" />
              <div className="text-muted mt-3" style={{ fontSize: '0.85rem' }}>Computing asset values and inventory volumes...</div>
            </div>
          ) : !valuationData ? (
            <div className="card border-0 shadow-sm rounded-3 p-4 bg-white text-center">
              <AlertCircle size={36} className="text-muted mb-2" />
              <p className="text-muted m-0">Failed to calculate valuation assets. Please refresh.</p>
            </div>
          ) : (
            <div>
              {/* Premium Analytics Metric KPI Cards */}
              <div className="row g-4 mb-4">
                
                {/* Total Value */}
                <div className="col-md-4">
                  <div className="card border-0 shadow-sm rounded-3 p-4 bg-white position-relative overflow-hidden h-100" style={{ borderLeft: '5px solid #2563EB' }}>
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <span className="text-muted fw-bold" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total In-Stock Asset Value</span>
                      <Coins className="text-primary opacity-75" size={20} />
                    </div>
                    <h3 className="fw-bold font-heading text-dark m-0" style={{ fontSize: '1.8rem' }}>
                      ₹{valuationData.summary.total_value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </h3>
                    <div className="mt-2 text-muted" style={{ fontSize: '0.8rem' }}>
                      Cumulative worth of all catalog dress products
                    </div>
                  </div>
                </div>

                {/* Total Pieces */}
                <div className="col-md-4">
                  <div className="card border-0 shadow-sm rounded-3 p-4 bg-white position-relative overflow-hidden h-100" style={{ borderLeft: '5px solid #10B981' }}>
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <span className="text-muted fw-bold" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Volume In-Hand</span>
                      <Package className="text-success opacity-75" size={20} />
                    </div>
                    <h3 className="fw-bold font-heading text-dark m-0" style={{ fontSize: '1.8rem' }}>
                      {parseInt(valuationData.summary.total_qty, 10)}
                    </h3>
                    <div className="mt-2 text-muted" style={{ fontSize: '0.8rem' }}>
                      Total pieces of garments stocked across depot
                    </div>
                  </div>
                </div>

                {/* Avg Price */}
                <div className="col-md-4">
                  <div className="card border-0 shadow-sm rounded-3 p-4 bg-white position-relative overflow-hidden h-100" style={{ borderLeft: '5px solid #F59E0B' }}>
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <span className="text-muted fw-bold" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Weighted Material Cost</span>
                      <TrendingUp className="text-warning opacity-75" size={20} />
                    </div>
                    <h3 className="fw-bold font-heading text-dark m-0" style={{ fontSize: '1.8rem' }}>
                      ₹{valuationData.summary.avg_cost_per_unit.toFixed(2)}
                    </h3>
                    <div className="mt-2 text-muted" style={{ fontSize: '0.8rem' }}>
                      Average asset cost value per piece
                    </div>
                  </div>
                </div>

              </div>

              {/* Warehouse Stock Splits */}
              <div className="mb-4">
                <h6 className="fw-bold text-dark font-heading mb-3">Warehouse Valuation Breakdown</h6>
                <div className="row g-3">
                  {valuationData.warehouseValuations.map(wh => (
                    <div className="col-lg-6" key={wh.id}>
                      <div className="card border-0 shadow-sm rounded-3 p-3 bg-white h-100 d-flex justify-content-between align-items-center flex-row">
                        <div className="d-flex align-items-center gap-3">
                          <div className="bg-light p-2.5 rounded-3 text-primary"><Warehouse size={20} /></div>
                          <div>
                            <div className="fw-bold text-dark" style={{ fontSize: '0.95rem' }}>{wh.name}</div>
                            <span className="text-muted" style={{ fontSize: '0.8rem' }}>{wh.location}</span>
                          </div>
                        </div>
                        <div className="text-end">
                          <div className="fw-bold text-dark" style={{ fontSize: '1.1rem' }}>₹{wh.total_value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                          <span className="text-muted" style={{ fontSize: '0.8rem' }}>{parseInt(wh.total_qty, 10)} Pieces Stocked</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* SKU level Valuation table */}
              <div className="card border-0 shadow-sm rounded-3 p-4 bg-white">
                <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
                  <h6 className="fw-bold text-dark font-heading m-0">Catalog SKU Net Worth List</h6>
                  <div className="input-group" style={{ maxWidth: '300px' }}>
                    <span className="input-group-text bg-light border-light-subtle"><Search size={14} className="text-muted" /></span>
                    <input
                      type="text"
                      className="form-control form-control-sm border-light-subtle py-1.5"
                      placeholder="Filter by name or SKU..."
                      style={{ fontSize: '0.85rem', borderTopRightRadius: '6px', borderBottomRightRadius: '6px' }}
                      value={valuationSearch}
                      onChange={(e) => setValuationSearch(e.target.value)}
                    />
                  </div>
                </div>

                <div className="table-responsive rounded-3 border" style={{ borderColor: '#F1F5F9' }}>
                  <table className="table table-hover align-middle mb-0" style={{ fontSize: '0.9rem' }}>
                    <thead style={{ backgroundColor: '#F8FAFC' }}>
                      <tr>
                        <th className="py-3 px-3 border-0 text-muted fw-semibold" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>Dress Variant</th>
                        <th className="py-3 px-3 border-0 text-muted fw-semibold" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>SKU</th>
                        <th className="py-3 px-3 border-0 text-muted fw-semibold" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>Category</th>
                        <th className="py-3 px-3 border-0 text-end text-muted fw-semibold" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>Unit Price</th>
                        <th className="py-3 px-3 border-0 text-end text-muted fw-semibold" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>Stock In Hand</th>
                        <th className="py-3 px-3 border-0 text-end text-muted fw-semibold" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>Asset Valuation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredValuations.map((item) => (
                        <tr key={item.id}>
                          <td className="py-3 px-3 fw-bold text-dark">{item.name}</td>
                          <td className="py-3 px-3 text-muted">{item.sku}</td>
                          <td className="py-3 px-3">
                            <span className="badge text-primary bg-primary bg-opacity-10" style={{ fontSize: '0.75rem' }}>
                              {item.category}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-end fw-semibold text-dark">₹{item.price.toFixed(2)}</td>
                          <td className="py-3 px-3 text-end fw-bold text-dark">
                            {parseInt(item.stock, 10)} <span className="text-muted fw-normal" style={{ fontSize: '0.75rem' }}>{item.unit}</span>
                          </td>
                          <td className="py-3 px-3 text-end fw-bold text-primary" style={{ fontSize: '0.95rem' }}>
                            ₹{item.total_value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 6: PRODUCT CATALOG & PRICES */}
      {/* ======================================================== */}
      {activeTab === 'catalog' && (
        <div className="card border-0 shadow-sm rounded-3 p-4 bg-white animate-fade-in">
          
          <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
            <div>
              <h5 className="fw-bold font-heading text-dark m-0">Product Catalog & Price Management</h5>
              <span className="text-muted" style={{ fontSize: '0.85rem' }}>View garments product inventory details, purchase cost, selling price, and taxes.</span>
            </div>
            
            <div className="d-flex align-items-center gap-3 flex-wrap">
              <div className="input-group" style={{ maxWidth: '300px' }}>
                <span className="input-group-text bg-light border-light-subtle"><Search size={14} className="text-muted" /></span>
                <input
                  type="text"
                  className="form-control form-control-sm border-light-subtle py-2"
                  placeholder="Search name, SKU, barcode..."
                  style={{ fontSize: '0.85rem', borderTopRightRadius: '8px', borderBottomRightRadius: '8px' }}
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                />
              </div>

              {['Shop Owner', 'Admin'].includes(user?.role) && (
                <button
                  onClick={() => {
                    setAddMessage(null);
                    setShowAddModal(true);
                  }}
                  className="btn btn-primary d-inline-flex align-items-center gap-1.5 fw-semibold py-2"
                  style={{ borderRadius: '8px', fontSize: '0.85rem' }}
                >
                  <Plus size={16} />
                  Add New Dress SKU
                </button>
              )}
            </div>
          </div>

          <div className="table-responsive rounded-3 border" style={{ borderColor: '#F1F5F9' }}>
            <table className="table table-hover align-middle mb-0" style={{ fontSize: '0.9rem' }}>
              <thead style={{ backgroundColor: '#F8FAFC' }}>
                <tr>
                  <th className="py-3 px-3 border-0 text-muted fw-semibold" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>Dress Variant</th>
                  <th className="py-3 px-3 border-0 text-muted fw-semibold" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>SKU / Barcode</th>
                  <th className="py-3 px-3 border-0 text-muted fw-semibold" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>Specs (Size/Color)</th>
                  <th className="py-3 px-3 border-0 text-muted fw-semibold" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>Category</th>
                  <th className="py-3 px-3 border-0 text-end text-muted fw-semibold" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>Cost Price</th>
                  <th className="py-3 px-3 border-0 text-end text-muted fw-semibold" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>Selling Price</th>
                  <th className="py-3 px-3 border-0 text-end text-muted fw-semibold" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>MRP</th>
                  <th className="py-3 px-3 border-0 text-end text-muted fw-semibold" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>Stock</th>
                  <th className="py-3 px-3 border-0 text-center text-muted fw-semibold" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products
                  .filter(p => 
                    (p.product_name || p.name || '').toLowerCase().includes(catalogSearch.toLowerCase()) ||
                    (p.sku || '').toLowerCase().includes(catalogSearch.toLowerCase()) ||
                    (p.barcode || '').includes(catalogSearch)
                  )
                  .map((item) => (
                    <tr key={item.id}>
                      <td className="py-3 px-3">
                        <div className="fw-bold text-dark">{item.product_name || item.name}</div>
                        <span className="text-muted" style={{ fontSize: '0.75rem' }}>{item.brand} • {item.gender}</span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-monospace fw-semibold text-secondary" style={{ fontSize: '0.8rem' }}>SKU: {item.sku}</div>
                        <div className="text-muted" style={{ fontSize: '0.75rem' }}>BC: {item.barcode}</div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="badge bg-light text-dark border me-1" style={{ fontSize: '0.75rem' }}>{item.size}</span>
                        <span className="badge bg-light text-dark border" style={{ fontSize: '0.75rem' }}>{item.color}</span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="badge text-primary bg-primary bg-opacity-10" style={{ fontSize: '0.75rem' }}>
                          {item.category}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-end fw-semibold text-muted">₹{parseFloat(item.purchase_price !== undefined ? item.purchase_price : (item.cost_price || 0)).toFixed(2)}</td>
                      <td className="py-3 px-3 text-end fw-bold text-dark">₹{parseFloat(item.selling_price !== undefined ? item.selling_price : (item.price || 0)).toFixed(2)}</td>
                      <td className="py-3 px-3 text-end fw-semibold text-danger">₹{parseFloat(item.mrp !== undefined ? item.mrp : (item.selling_price || item.price || 0)).toFixed(2)}</td>
                      <td className="py-3 px-3 text-end fw-semibold">
                        <span className={parseInt(item.stock, 10) <= 10 ? 'text-danger fw-bold' : 'text-dark'}>
                          {parseInt(item.stock, 10)} Pcs
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        {['Shop Owner', 'Admin'].includes(user?.role) ? (
                          <button
                            onClick={() => handleStartEdit(item)}
                            className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1 fw-semibold"
                            style={{ borderRadius: '6px', fontSize: '0.8rem' }}
                          >
                            Edit Price
                          </button>
                        ) : (
                          <span className="text-muted" style={{ fontSize: '0.8rem' }}>View Only</span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* EDIT PRODUCT & PRICES MODAL */}
      {editingProduct && (
        <div 
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
          style={{ 
            backgroundColor: 'rgba(15, 23, 42, 0.65)', 
            zIndex: 1050,
            backdropFilter: 'blur(4px)',
            transition: 'all 0.3s ease'
          }}
        >
          <div 
            className="card border-0 shadow-lg rounded-3 w-100 mx-3 animate-fade-in" 
            style={{ maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto' }}
          >
            <div className="card-header bg-white border-bottom py-3.5 px-4 d-flex justify-content-between align-items-center">
              <h5 className="fw-bold font-heading text-dark m-0">
                Edit Garment Variant & Prices
              </h5>
              <button 
                type="button" 
                className="btn-close" 
                onClick={() => setEditingProduct(null)}
                aria-label="Close"
              />
            </div>
            
            <form onSubmit={handleSaveEdit}>
              <div className="card-body p-4">
                {editMessage && (
                  <div className={`alert alert-${editMessage.type} d-flex align-items-center gap-2`} role="alert" style={{ borderRadius: '8px' }}>
                    {editMessage.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                    <div style={{ fontSize: '0.85rem' }}>{editMessage.text}</div>
                  </div>
                )}

                <div className="row g-3">
                  {/* Basic Info */}
                  <div className="col-md-6">
                    <label htmlFor="edit-name" className="form-label text-muted fw-semibold" style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}>Product Name</label>
                    <input
                      id="edit-name"
                      type="text"
                      className="form-control py-2"
                      style={{ borderRadius: '8px', fontSize: '0.9rem' }}
                      required
                      value={editForm.product_name}
                      onChange={(e) => setEditForm({ ...editForm, product_name: e.target.value })}
                    />
                  </div>

                  <div className="col-md-6">
                    <label htmlFor="edit-category" className="form-label text-muted fw-semibold" style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}>Category</label>
                    <select
                      id="edit-category"
                      className="form-select py-2"
                      style={{ borderRadius: '8px', fontSize: '0.9rem' }}
                      required
                      value={editForm.category}
                      onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                    >
                      <option value="Shirts">Shirts</option>
                      <option value="T-Shirts">T-Shirts</option>
                      <option value="Jeans">Jeans</option>
                      <option value="Pants">Pants</option>
                      <option value="Sarees">Sarees</option>
                      <option value="Chudithar">Chudithar</option>
                      <option value="Men Wear">Men Wear</option>
                      <option value="Women Wear">Women Wear</option>
                      <option value="Kids Wear">Kids Wear</option>
                      <option value="Fashion Products">Fashion Products</option>
                      <option value="General">General</option>
                    </select>
                  </div>

                  <div className="col-md-4">
                    <label htmlFor="edit-brand" className="form-label text-muted fw-semibold" style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}>Brand</label>
                    <input
                      id="edit-brand"
                      type="text"
                      className="form-control py-2"
                      style={{ borderRadius: '8px', fontSize: '0.9rem' }}
                      value={editForm.brand}
                      onChange={(e) => setEditForm({ ...editForm, brand: e.target.value })}
                    />
                  </div>

                  <div className="col-md-4">
                    <label htmlFor="edit-gender" className="form-label text-muted fw-semibold" style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}>Gender</label>
                    <select
                      id="edit-gender"
                      className="form-select py-2"
                      style={{ borderRadius: '8px', fontSize: '0.9rem' }}
                      value={editForm.gender}
                      onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
                    >
                      <option value="Men">Men</option>
                      <option value="Women">Women</option>
                      <option value="Kids">Kids</option>
                      <option value="Unisex">Unisex</option>
                    </select>
                  </div>

                  {isGstEnabled && (
                    <div className="col-md-4">
                      <label htmlFor="edit-gst" className="form-label text-muted fw-semibold" style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}>GST %</label>
                      <input
                        id="edit-gst"
                        type="number"
                        step="0.01"
                        className="form-control py-2"
                        style={{ borderRadius: '8px', fontSize: '0.9rem' }}
                        value={editForm.gst_percentage}
                        onChange={(e) => setEditForm({ ...editForm, gst_percentage: e.target.value })}
                      />
                    </div>
                  )}

                  {/* Identification */}
                  <div className="col-md-6">
                    <label htmlFor="edit-sku" className="form-label text-muted fw-semibold" style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}>SKU Code</label>
                    <input
                      id="edit-sku"
                      type="text"
                      className="form-control py-2 font-monospace fw-semibold"
                      style={{ borderRadius: '8px', fontSize: '0.9rem' }}
                      required
                      value={editForm.sku}
                      onChange={(e) => setEditForm({ ...editForm, sku: e.target.value })}
                    />
                  </div>

                  <div className="col-md-6">
                    <label htmlFor="edit-barcode" className="form-label text-muted fw-semibold" style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}>Barcode ID</label>
                    <input
                      id="edit-barcode"
                      type="text"
                      className="form-control py-2 font-monospace"
                      style={{ borderRadius: '8px', fontSize: '0.9rem' }}
                      required
                      value={editForm.barcode}
                      onChange={(e) => setEditForm({ ...editForm, barcode: e.target.value })}
                    />
                  </div>

                  {/* Specs */}
                  <div className="col-md-4">
                    <label htmlFor="edit-size" className="form-label text-muted fw-semibold" style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}>Size</label>
                    <input
                      id="edit-size"
                      type="text"
                      className="form-control py-2"
                      style={{ borderRadius: '8px', fontSize: '0.9rem' }}
                      value={editForm.size}
                      onChange={(e) => setEditForm({ ...editForm, size: e.target.value })}
                    />
                  </div>

                  <div className="col-md-4">
                    <label htmlFor="edit-color" className="form-label text-muted fw-semibold" style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}>Color</label>
                    <input
                      id="edit-color"
                      type="text"
                      className="form-control py-2"
                      style={{ borderRadius: '8px', fontSize: '0.9rem' }}
                      value={editForm.color}
                      onChange={(e) => setEditForm({ ...editForm, color: e.target.value })}
                    />
                  </div>

                  <div className="col-md-4">
                    <label htmlFor="edit-stock" className="form-label text-muted fw-semibold" style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: '#10B981' }}>Current Stock Qty</label>
                    <input
                      id="edit-stock"
                      type="number"
                      step="1"
                      min="0"
                      className="form-control py-2 fw-semibold text-dark border-success"
                      style={{ borderRadius: '8px', fontSize: '0.9rem' }}
                      required
                      value={editForm.stock_qty}
                      onChange={(e) => setEditForm({ ...editForm, stock_qty: e.target.value })}
                    />
                  </div>

                  {/* Pricing Fields */}
                  <div className="col-md-4">
                    <label htmlFor="edit-cost" className="form-label text-muted fw-semibold" style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: '#4F46E5' }}>Cost Price (₹)</label>
                    <input
                      id="edit-cost"
                      type="number"
                      step="0.01"
                      className="form-control py-2 fw-bold text-dark border-primary"
                      style={{ borderRadius: '8px', fontSize: '0.9rem' }}
                      required
                      value={editForm.purchase_price}
                      onChange={(e) => setEditForm({ ...editForm, purchase_price: e.target.value })}
                    />
                  </div>

                  <div className="col-md-4">
                    <label htmlFor="edit-selling" className="form-label text-muted fw-semibold" style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: '#2563EB' }}>Selling Price (₹)</label>
                    <input
                      id="edit-selling"
                      type="number"
                      step="0.01"
                      className="form-control py-2 fw-bold text-primary border-primary"
                      style={{ borderRadius: '8px', fontSize: '0.9rem' }}
                      required
                      value={editForm.selling_price}
                      onChange={(e) => setEditForm({ ...editForm, selling_price: e.target.value })}
                    />
                  </div>

                  <div className="col-md-4">
                    <label htmlFor="edit-mrp" className="form-label text-muted fw-semibold" style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: '#DC2626' }}>MRP (₹)</label>
                    <input
                      id="edit-mrp"
                      type="number"
                      step="0.01"
                      className="form-control py-2 fw-bold text-danger border-primary"
                      style={{ borderRadius: '8px', fontSize: '0.9rem' }}
                      required
                      value={editForm.mrp}
                      onChange={(e) => setEditForm({ ...editForm, mrp: e.target.value })}
                    />
                  </div>

                  {/* Smart Billing Mode */}
                  <div className="col-12">
                    <div className="form-check form-switch p-3 border rounded-3 bg-light d-flex align-items-center justify-content-between">
                      <div>
                        <label className="form-check-label fw-bold text-dark font-heading m-0" htmlFor="edit-manual-qty" style={{ fontSize: '0.85rem' }}>
                          ⚡ Fast-Moving Small Item (Allow Manual Quantity)
                        </label>
                        <div className="text-muted" style={{ fontSize: '0.72rem', marginTop: '2px' }}>
                          Enable for socks, innerwear, kerchiefs to let cashiers input quantities directly on scan without a barcode on every single piece.
                        </div>
                      </div>
                      <input
                        className="form-check-input ms-0"
                        type="checkbox"
                        id="edit-manual-qty"
                        style={{ width: '42px', height: '22px', cursor: 'pointer' }}
                        checked={editForm.allow_manual_qty}
                        onChange={(e) => setEditForm({ ...editForm, allow_manual_qty: e.target.checked })}
                      />
                    </div>
                  </div>

                  {/* Description */}
                  <div className="col-12">
                    <label htmlFor="edit-desc" className="form-label text-muted fw-semibold" style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}>Description</label>
                    <textarea
                      id="edit-desc"
                      rows="2"
                      className="form-control py-2"
                      style={{ borderRadius: '8px', fontSize: '0.9rem' }}
                      value={editForm.description}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              
              <div className="card-footer bg-light border-top py-3 px-4 d-flex justify-content-end gap-2.5">
                <button 
                  type="button" 
                  className="btn btn-light py-2 px-4 border-0 fw-semibold"
                  style={{ borderRadius: '8px', fontSize: '0.9rem', backgroundColor: '#E2E8F0', color: '#475569' }}
                  onClick={() => setEditingProduct(null)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={editSubmitting}
                  className="btn text-white py-2 px-4 border-0 fw-semibold d-flex align-items-center justify-content-center gap-1.5"
                  style={{ borderRadius: '8px', fontSize: '0.9rem', backgroundColor: '#2563EB' }}
                >
                  {editSubmitting ? (
                    <>
                      <div className="spinner-border spinner-border-sm text-white" role="status" style={{ width: '12px', height: '12px' }} />
                      Saving Changes...
                    </>
                  ) : (
                    <>
                      Save Price & Details
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD NEW PRODUCT & PRICES MODAL */}
      {showAddModal && (
        <div 
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center animate-fade-in"
          style={{ 
            backgroundColor: 'rgba(15, 23, 42, 0.65)', 
            zIndex: 1050,
            backdropFilter: 'blur(4px)',
            transition: 'all 0.3s ease'
          }}
        >
          <div 
            className="card border-0 shadow-lg rounded-3 w-100 mx-3" 
            style={{ maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto' }}
          >
            <div className="card-header bg-white border-bottom py-3.5 px-4 d-flex justify-content-between align-items-center">
              <h5 className="fw-bold font-heading text-dark m-0">
                Add New Garment SKU Variant
              </h5>
              <button 
                type="button" 
                className="btn-close" 
                onClick={() => setShowAddModal(false)}
                aria-label="Close"
              />
            </div>
            
            <form onSubmit={handleCreateProduct}>
              <div className="card-body p-4">
                {addMessage && (
                  <div className={`alert alert-${addMessage.type} d-flex align-items-center gap-2`} role="alert" style={{ borderRadius: '8px' }}>
                    {addMessage.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                    <div style={{ fontSize: '0.85rem' }}>{addMessage.text}</div>
                  </div>
                )}

                <div className="row g-3">
                  {/* Basic Info */}
                  <div className="col-md-6">
                    <label htmlFor="add-name" className="form-label text-muted fw-semibold" style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}>Product Name</label>
                    <input
                      id="add-name"
                      type="text"
                      className="form-control py-2"
                      placeholder="e.g. US Polo T-Shirt"
                      style={{ borderRadius: '8px', fontSize: '0.9rem' }}
                      required
                      value={addForm.product_name}
                      onChange={(e) => setAddForm({ ...addForm, product_name: e.target.value })}
                    />
                  </div>

                  <div className="col-md-6">
                    <label htmlFor="add-category" className="form-label text-muted fw-semibold" style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}>Category</label>
                    <select
                      id="add-category"
                      className="form-select py-2"
                      style={{ borderRadius: '8px', fontSize: '0.9rem' }}
                      required
                      value={addForm.category}
                      onChange={(e) => setAddForm({ ...addForm, category: e.target.value })}
                    >
                      <option value="Shirts">Shirts</option>
                      <option value="T-Shirts">T-Shirts</option>
                      <option value="Jeans">Jeans</option>
                      <option value="Pants">Pants</option>
                      <option value="Sarees">Sarees</option>
                      <option value="Chudithar">Chudithar</option>
                      <option value="Men Wear">Men Wear</option>
                      <option value="Women Wear">Women Wear</option>
                      <option value="Kids Wear">Kids Wear</option>
                      <option value="Fashion Products">Fashion Products</option>
                      <option value="General">General</option>
                    </select>
                  </div>

                  <div className="col-md-4">
                    <label htmlFor="add-brand" className="form-label text-muted fw-semibold" style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}>Brand</label>
                    <input
                      id="add-brand"
                      type="text"
                      className="form-control py-2"
                      placeholder="e.g. USPA"
                      style={{ borderRadius: '8px', fontSize: '0.9rem' }}
                      value={addForm.brand}
                      onChange={(e) => setAddForm({ ...addForm, brand: e.target.value })}
                    />
                  </div>

                  <div className="col-md-4">
                    <label htmlFor="add-gender" className="form-label text-muted fw-semibold" style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}>Gender</label>
                    <select
                      id="add-gender"
                      className="form-select py-2"
                      style={{ borderRadius: '8px', fontSize: '0.9rem' }}
                      value={addForm.gender}
                      onChange={(e) => setAddForm({ ...addForm, gender: e.target.value })}
                    >
                      <option value="Men">Men</option>
                      <option value="Women">Women</option>
                      <option value="Kids">Kids</option>
                      <option value="Unisex">Unisex</option>
                    </select>
                  </div>

                  {isGstEnabled && (
                    <div className="col-md-4">
                      <label htmlFor="add-gst" className="form-label text-muted fw-semibold" style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}>GST %</label>
                      <input
                        id="add-gst"
                        type="number"
                        step="0.01"
                        className="form-control py-2"
                        style={{ borderRadius: '8px', fontSize: '0.9rem' }}
                        value={addForm.gst_percentage}
                        onChange={(e) => setAddForm({ ...addForm, gst_percentage: e.target.value })}
                      />
                    </div>
                  )}

                  {/* Identification */}
                  <div className="col-md-6">
                    <label htmlFor="add-sku" className="form-label text-muted fw-semibold" style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}>SKU Code</label>
                    <input
                      id="add-sku"
                      type="text"
                      className="form-control py-2 font-monospace fw-semibold"
                      placeholder="e.g. USPA-POLO-BLU-M"
                      style={{ borderRadius: '8px', fontSize: '0.9rem' }}
                      required
                      value={addForm.sku}
                      onChange={(e) => setAddForm({ ...addForm, sku: e.target.value })}
                    />
                  </div>

                  <div className="col-md-6">
                    <label htmlFor="add-barcode" className="form-label text-muted fw-semibold" style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}>Barcode ID</label>
                    <input
                      id="add-barcode"
                      type="text"
                      className="form-control py-2 font-monospace"
                      placeholder="e.g. 89010004"
                      style={{ borderRadius: '8px', fontSize: '0.9rem' }}
                      required
                      value={addForm.barcode}
                      onChange={(e) => setAddForm({ ...addForm, barcode: e.target.value })}
                    />
                  </div>

                  {/* Specs */}
                  <div className="col-md-4">
                    <label htmlFor="add-size" className="form-label text-muted fw-semibold" style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}>Size</label>
                    <input
                      id="add-size"
                      type="text"
                      className="form-control py-2"
                      placeholder="e.g. M"
                      style={{ borderRadius: '8px', fontSize: '0.9rem' }}
                      value={addForm.size}
                      onChange={(e) => setAddForm({ ...addForm, size: e.target.value })}
                    />
                  </div>

                  <div className="col-md-4">
                    <label htmlFor="add-color" className="form-label text-muted fw-semibold" style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}>Color</label>
                    <input
                      id="add-color"
                      type="text"
                      className="form-control py-2"
                      placeholder="e.g. Blue"
                      style={{ borderRadius: '8px', fontSize: '0.9rem' }}
                      value={addForm.color}
                      onChange={(e) => setAddForm({ ...addForm, color: e.target.value })}
                    />
                  </div>

                  <div className="col-md-4">
                    <label htmlFor="add-stock" className="form-label text-muted fw-semibold" style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: '#10B981' }}>Initial Stock Qty</label>
                    <input
                      id="add-stock"
                      type="number"
                      step="1"
                      min="0"
                      className="form-control py-2 fw-semibold text-dark border-success"
                      placeholder="e.g. 100"
                      style={{ borderRadius: '8px', fontSize: '0.9rem' }}
                      value={addForm.stock_qty}
                      onChange={(e) => setAddForm({ ...addForm, stock_qty: e.target.value })}
                    />
                  </div>

                  {/* Pricing Fields */}
                  <div className="col-md-4">
                    <label htmlFor="add-cost" className="form-label text-muted fw-semibold" style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: '#4F46E5' }}>Cost Price (₹)</label>
                    <input
                      id="add-cost"
                      type="number"
                      step="0.01"
                      className="form-control py-2 fw-bold text-dark border-primary"
                      placeholder="e.g. 300.00"
                      style={{ borderRadius: '8px', fontSize: '0.9rem' }}
                      value={addForm.purchase_price}
                      onChange={(e) => setAddForm({ ...addForm, purchase_price: e.target.value })}
                    />
                  </div>

                  <div className="col-md-4">
                    <label htmlFor="add-selling" className="form-label text-muted fw-semibold" style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: '#2563EB' }}>Selling Price (₹)</label>
                    <input
                      id="add-selling"
                      type="number"
                      step="0.01"
                      className="form-control py-2 fw-bold text-primary border-primary"
                      placeholder="e.g. 599.00"
                      style={{ borderRadius: '8px', fontSize: '0.9rem' }}
                      required
                      value={addForm.selling_price}
                      onChange={(e) => setAddForm({ ...addForm, selling_price: e.target.value })}
                    />
                  </div>

                  <div className="col-md-4">
                    <label htmlFor="add-mrp" className="form-label text-muted fw-semibold" style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: '#DC2626' }}>MRP (₹)</label>
                    <input
                      id="add-mrp"
                      type="number"
                      step="0.01"
                      className="form-control py-2 fw-bold text-danger border-primary"
                      placeholder="e.g. 599.00"
                      style={{ borderRadius: '8px', fontSize: '0.9rem' }}
                      value={addForm.mrp}
                      onChange={(e) => setAddForm({ ...addForm, mrp: e.target.value })}
                    />
                  </div>

                  {/* Smart Billing Mode */}
                  <div className="col-12">
                    <div className="form-check form-switch p-3 border rounded-3 bg-light d-flex align-items-center justify-content-between">
                      <div>
                        <label className="form-check-label fw-bold text-dark font-heading m-0" htmlFor="add-manual-qty" style={{ fontSize: '0.85rem' }}>
                          ⚡ Fast-Moving Small Item (Allow Manual Quantity)
                        </label>
                        <div className="text-muted" style={{ fontSize: '0.72rem', marginTop: '2px' }}>
                          Enable for socks, innerwear, kerchiefs to let cashiers input quantities directly on scan without a barcode on every single piece.
                        </div>
                      </div>
                      <input
                        className="form-check-input ms-0"
                        type="checkbox"
                        id="add-manual-qty"
                        style={{ width: '42px', height: '22px', cursor: 'pointer' }}
                        checked={addForm.allow_manual_qty}
                        onChange={(e) => setAddForm({ ...addForm, allow_manual_qty: e.target.checked })}
                      />
                    </div>
                  </div>

                  {/* Description */}
                  <div className="col-12">
                    <label htmlFor="add-desc" className="form-label text-muted fw-semibold" style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}>Description</label>
                    <textarea
                      id="add-desc"
                      rows="2"
                      className="form-control py-2"
                      placeholder="Optional garments details..."
                      style={{ borderRadius: '8px', fontSize: '0.9rem' }}
                      value={addForm.description}
                      onChange={(e) => setAddForm({ ...addForm, description: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              
              <div className="card-footer bg-light border-top py-3 px-4 d-flex justify-content-end gap-2.5">
                <button 
                  type="button" 
                  className="btn btn-light py-2 px-4 border-0 fw-semibold"
                  style={{ borderRadius: '8px', fontSize: '0.9rem', backgroundColor: '#E2E8F0', color: '#475569' }}
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={addSubmitting}
                  className="btn text-white py-2 px-4 border-0 fw-semibold d-flex align-items-center justify-content-center gap-1.5"
                  style={{ borderRadius: '8px', fontSize: '0.9rem', backgroundColor: '#2563EB' }}
                >
                  {addSubmitting ? (
                    <>
                      <div className="spinner-border spinner-border-sm text-white" role="status" style={{ width: '12px', height: '12px' }} />
                      Creating SKU...
                    </>
                  ) : (
                    <>
                      Create Product SKU
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Inventory;
