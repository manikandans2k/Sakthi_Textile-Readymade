import React, { useState, useEffect } from 'react';
import axios from '../api/axios';
import { Warehouse, MapPin, Database, Plus, Search, Layers, X } from 'lucide-react';

const Warehouses = () => {
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Selected warehouse for localized stock drilldown
  const [selectedWarehouse, setSelectedWarehouse] = useState(null);
  const [selectedStock, setSelectedStock] = useState([]);
  const [stockLoading, setStockLoading] = useState(false);
  const [stockSearch, setStockSearch] = useState('');

  // Form states for creating warehouse
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newCapacity, setNewCapacity] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    fetchWarehouses();
  }, []);

  const fetchWarehouses = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get('/warehouses');
      setWarehouses(response.data);
    } catch (err) {
      console.error('Fetch warehouses error:', err);
      setError('Failed to retrieve warehouse list.');
    } finally {
      setLoading(false);
    }
  };

  const handleWarehouseClick = async (wh) => {
    setSelectedWarehouse(wh);
    setStockLoading(true);
    setSelectedStock([]);
    try {
      const response = await axios.get(`/warehouses/${wh.id}/stock`);
      setSelectedStock(response.data);
    } catch (err) {
      console.error('Fetch warehouse stock error:', err);
    } finally {
      setStockLoading(false);
    }
  };

  const handleCreateWarehouse = async (e) => {
    e.preventDefault();
    if (!newName.trim() || !newLocation.trim()) {
      setFormError('Please enter name and location.');
      return;
    }
    setFormSubmitting(true);
    setFormError('');
    try {
      await axios.post('/warehouses', {
        name: newName,
        location: newLocation,
        capacity: parseInt(newCapacity) || 10000
      });
      
      // Reset form & reload
      setNewName('');
      setNewLocation('');
      setNewCapacity('');
      setShowAddModal(false);
      fetchWarehouses();
    } catch (err) {
      console.error('Create warehouse error:', err);
      setFormError(err.response?.data?.message || 'Failed to create warehouse.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Filter local stock breakdown
  const filteredStock = selectedStock.filter(item => 
    item.product_name.toLowerCase().includes(stockSearch.toLowerCase()) ||
    item.sku.toLowerCase().includes(stockSearch.toLowerCase())
  );

  return (
    <div className="container-fluid py-4" style={{ fontFamily: 'Inter, sans-serif' }}>
      
      {/* Header section */}
      <div className="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-3 mb-4">
        <div>
          <h1 className="h3 font-heading fw-bold m-0" style={{ color: '#0F172A' }}>
            Warehouse Hub
          </h1>
          <p className="text-muted m-0" style={{ fontSize: '0.9rem' }}>
            Manage garments inventories across storage networks and analyze localized stocks.
          </p>
        </div>
        
        <button 
          className="btn text-white d-flex align-items-center gap-2 px-3 py-2 border-0 shadow-sm"
          style={{ backgroundColor: '#2563EB', borderRadius: '8px', transition: 'all 0.2s' }}
          onClick={() => setShowAddModal(true)}
        >
          <Plus size={18} />
          <span className="fw-semibold">Add Warehouse</span>
        </button>
      </div>

      {loading ? (
        <div className="d-flex justify-content-center py-5">
          <div className="spinner-border" style={{ color: '#2563EB' }} role="status">
            <span className="visually-hidden">Loading depots...</span>
          </div>
        </div>
      ) : error ? (
        <div className="alert alert-danger" role="alert" style={{ borderRadius: '8px' }}>
          {error}
        </div>
      ) : (
        <div className="row g-4">
          
          {/* Warehouse Grid */}
          <div className={selectedWarehouse ? "col-lg-6" : "col-12"}>
            <div className="row g-3">
              {warehouses.map((wh) => {
                const stockPercent = Math.min(100, Math.round((wh.current_stock_units / wh.capacity) * 100));
                const isOverLimit = stockPercent > 85;
                const isSelected = selectedWarehouse?.id === wh.id;

                return (
                  <div key={wh.id} className="col-md-6 col-lg-12 col-xl-6">
                    <div 
                      onClick={() => handleWarehouseClick(wh)}
                      className={`card border-0 shadow-sm rounded-3 cursor-pointer position-relative overflow-hidden`}
                      style={{ 
                        cursor: 'pointer',
                        transition: 'transform 0.2s, box-shadow 0.2s',
                        border: isSelected ? '2px solid #2563EB' : '2px solid transparent',
                        backgroundColor: '#FFFFFF',
                        transform: isSelected ? 'scale(1.01)' : 'none'
                      }}
                    >
                      <div className="card-body p-4">
                        <div className="d-flex justify-content-between align-items-start mb-3">
                          <div className="p-3 bg-opacity-10 rounded-3" style={{ backgroundColor: isSelected ? 'rgba(37, 99, 235, 0.1)' : 'rgba(15, 23, 42, 0.05)' }}>
                            <Warehouse size={24} style={{ color: isSelected ? '#2563EB' : '#0F172A' }} />
                          </div>
                          <span 
                            className="badge text-white px-2.5 py-1"
                            style={{ 
                              backgroundColor: isOverLimit ? '#F59E0B' : '#2563EB',
                              borderRadius: '6px',
                              fontSize: '0.75rem'
                            }}
                          >
                            {wh.total_allocated_products} SKUs
                          </span>
                        </div>

                        <h5 className="card-title fw-bold font-heading m-0 mb-1" style={{ color: '#0F172A' }}>
                          {wh.name}
                        </h5>
                        
                        <div className="d-flex align-items-center gap-1.5 text-muted mb-4" style={{ fontSize: '0.85rem' }}>
                          <MapPin size={14} className="flex-shrink-0" />
                          <span className="text-truncate">{wh.location}</span>
                        </div>

                        {/* Capacity density bar */}
                        <div>
                          <div className="d-flex justify-content-between mb-1.5" style={{ fontSize: '0.8rem' }}>
                            <span className="text-muted">Stock Level: <strong style={{ color: '#0F172A' }}>{wh.current_stock_units.toLocaleString()}</strong> pcs</span>
                            <span className="fw-semibold" style={{ color: isOverLimit ? '#F59E0B' : '#0F172A' }}>{stockPercent}%</span>
                          </div>
                          
                          <div className="progress" style={{ height: '8px', backgroundColor: '#F1F5F9', borderRadius: '4px' }}>
                            <div 
                              className="progress-bar" 
                              role="progressbar" 
                              style={{ 
                                width: `${stockPercent}%`, 
                                backgroundColor: isOverLimit ? '#F59E0B' : '#2563EB',
                                borderRadius: '4px'
                              }}
                              aria-valuenow={stockPercent} 
                              aria-valuemin="0" 
                              aria-valuemax="100"
                            />
                          </div>
                          
                          <div className="text-end text-muted mt-1" style={{ fontSize: '0.75rem' }}>
                            Capacity: {wh.capacity.toLocaleString()} Pieces
                          </div>
                        </div>

                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Localized Stock Breakdown Panel */}
          {selectedWarehouse && (
            <div className="col-lg-6">
              <div className="card border-0 shadow-sm rounded-3 h-100" style={{ backgroundColor: '#FFFFFF' }}>
                <div className="card-header bg-white border-0 pt-4 px-4 pb-2 d-flex justify-content-between align-items-center">
                  <div>
                    <h5 className="fw-bold font-heading m-0" style={{ color: '#0F172A' }}>
                      {selectedWarehouse.name} Inventory
                    </h5>
                    <span className="text-muted" style={{ fontSize: '0.8rem' }}>
                      {selectedWarehouse.location}
                    </span>
                  </div>
                  <button 
                    className="btn btn-light rounded-circle p-2 border-0" 
                    onClick={() => setSelectedWarehouse(null)}
                    style={{ backgroundColor: '#F1F5F9' }}
                    aria-label="Close details"
                  >
                    <X size={18} style={{ color: '#64748B' }} />
                  </button>
                </div>

                <div className="card-body px-4 pb-4">
                  {/* Localized Search bar */}
                  <div className="mb-4 position-relative">
                    <span className="position-absolute translate-middle-y" style={{ left: '16px', top: '50%' }}>
                      <Search size={16} className="text-muted" />
                    </span>
                    <input
                      type="text"
                      className="form-control ps-5 py-2"
                      placeholder="Filter by product name or SKU..."
                      style={{ 
                        borderRadius: '8px', 
                        borderColor: '#E2E8F0',
                        fontSize: '0.9rem'
                      }}
                      value={stockSearch}
                      onChange={(e) => setStockSearch(e.target.value)}
                    />
                  </div>

                  {stockLoading ? (
                    <div className="d-flex flex-column align-items-center py-5">
                      <div className="spinner-border text-primary spinner-border-sm mb-2" role="status" />
                      <span className="text-muted" style={{ fontSize: '0.85rem' }}>Retrieving live inventory stock...</span>
                    </div>
                  ) : filteredStock.length === 0 ? (
                    <div className="text-center py-5 bg-light rounded-3">
                      <Layers size={36} className="text-muted mb-2 opacity-50" />
                      <p className="text-muted m-0" style={{ fontSize: '0.9rem' }}>
                        {stockSearch ? 'No products matching search filters.' : 'This warehouse currently holds zero stock.'}
                      </p>
                    </div>
                  ) : (
                    <div className="table-responsive rounded-3" style={{ maxHeight: '420px', border: '1px solid #F1F5F9' }}>
                      <table className="table table-hover align-middle mb-0" style={{ fontSize: '0.9rem' }}>
                        <thead style={{ backgroundColor: '#F8FAFC', position: 'sticky', top: 0, zIndex: 1 }}>
                          <tr>
                            <th className="py-3 px-3 border-0 text-muted fw-semibold" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>Product details</th>
                            <th className="py-3 px-3 border-0 text-muted fw-semibold" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>SKU</th>
                            <th className="py-3 px-3 border-0 text-muted fw-semibold text-end" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>Available</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredStock.map((item) => (
                            <tr key={item.product_id}>
                              <td className="py-3 px-3">
                                <div>
                                  <div className="fw-semibold text-dark">{item.product_name}</div>
                                  <span className="badge text-primary bg-primary bg-opacity-10 font-heading" style={{ fontSize: '0.7rem' }}>
                                    {item.category}
                                  </span>
                                </div>
                              </td>
                              <td className="py-3 px-3 text-muted">{item.sku}</td>
                              <td className="py-3 px-3 text-end fw-bold text-dark">
                                {item.localized_stock} <span className="text-muted font-normal fw-normal" style={{ fontSize: '0.85rem' }}>{item.unit}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* Register Warehouse Dialog Modal */}
      {showAddModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg rounded-3">
              <div className="modal-header border-bottom border-light p-4">
                <h5 className="modal-title fw-bold font-heading" style={{ color: '#0F172A' }}>Register Storage Depot</h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={() => setShowAddModal(false)}
                  aria-label="Close"
                />
              </div>
              <form onSubmit={handleCreateWarehouse}>
                <div className="modal-body p-4">
                  {formError && (
                    <div className="alert alert-danger py-2" role="alert" style={{ fontSize: '0.85rem' }}>
                      {formError}
                    </div>
                  )}

                  <div className="mb-3">
                    <label htmlFor="wh-name" className="form-label text-muted fw-semibold" style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}>Depot Name</label>
                    <input
                      id="wh-name"
                      type="text"
                      className="form-control py-2.5"
                      placeholder="e.g. Garments Storage Complex A"
                      required
                      style={{ borderRadius: '8px', fontSize: '0.9rem' }}
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                    />
                  </div>

                  <div className="mb-3">
                    <label htmlFor="wh-location" className="form-label text-muted fw-semibold" style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}>Physical Location</label>
                    <input
                      id="wh-location"
                      type="text"
                      className="form-control py-2.5"
                      placeholder="e.g. Unit 4B, Central Logistics Ring"
                      required
                      style={{ borderRadius: '8px', fontSize: '0.9rem' }}
                      value={newLocation}
                      onChange={(e) => setNewLocation(e.target.value)}
                    />
                  </div>

                  <div className="mb-3">
                    <label htmlFor="wh-capacity" className="form-label text-muted fw-semibold" style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}>Volume Capacity (Pieces)</label>
                    <input
                      id="wh-capacity"
                      type="number"
                      className="form-control py-2.5"
                      placeholder="e.g. 50000"
                      style={{ borderRadius: '8px', fontSize: '0.9rem' }}
                      value={newCapacity}
                      onChange={(e) => setNewCapacity(e.target.value)}
                    />
                  </div>
                </div>

                <div className="modal-footer border-top border-light p-4">
                  <button 
                    type="button" 
                    className="btn btn-light px-4 py-2 border-0 fw-semibold" 
                    onClick={() => setShowAddModal(false)}
                    style={{ borderRadius: '8px', backgroundColor: '#F1F5F9', color: '#64748B' }}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="btn text-white px-4 py-2 border-0 fw-semibold"
                    disabled={formSubmitting}
                    style={{ backgroundColor: '#2563EB', borderRadius: '8px' }}
                  >
                    {formSubmitting ? 'Registering...' : 'Add Depot'}
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

export default Warehouses;
