import React, { useState, useEffect } from 'react';
import axios from '../api/axios';
import { Users, Phone, Mail, Award, CreditCard, Plus, Eye, Check, X, Calendar, Search } from 'lucide-react';

const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Selected customer details, purchase logs & running ledger
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [purchaseHistory, setPurchaseHistory] = useState([]);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [ledgerHistory, setLedgerHistory] = useState([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('purchases'); // 'purchases' or 'ledger'

  // Modal / Form triggers
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSettleModal, setShowSettleModal] = useState(false);

  // Form states for enrolling customer
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [creditBalance, setCreditBalance] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');

  // Form states for credit settlement
  const [settleAmount, setSettleAmount] = useState('');
  const [settleLoading, setSettleLoading] = useState(false);
  const [settleError, setSettleError] = useState('');

  // General search query
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get('/customers');
      setCustomers(response.data);
    } catch (err) {
      console.error('Fetch customers error:', err);
      setError('Failed to retrieve customer profiles.');
    } finally {
      setLoading(false);
    }
  };

  const handleViewPurchases = async (customer) => {
    setSelectedCustomer(customer);
    setPurchaseLoading(true);
    setPurchaseHistory([]);
    setLedgerLoading(true);
    setLedgerHistory([]);
    try {
      const [purchasesRes, ledgerRes] = await Promise.all([
        axios.get(`/customers/${customer.id}/purchases`),
        axios.get(`/customers/${customer.id}/ledger`)
      ]);
      setPurchaseHistory(purchasesRes.data.purchases);
      setLedgerHistory(ledgerRes.data.ledger);
    } catch (err) {
      console.error('Fetch customer details error:', err);
    } finally {
      setPurchaseLoading(false);
      setLedgerLoading(false);
    }
  };

  const handleAddCustomer = async (e) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      setAddError('Customer Name and Phone number are required.');
      return;
    }

    setAddLoading(true);
    setAddError('');
    try {
      await axios.post('/customers', {
        name,
        phone,
        email: email || null,
        gst_number: gstNumber || null,
        credit_balance: parseFloat(creditBalance) || 0.00
      });

      // Clear & Close
      setName('');
      setPhone('');
      setEmail('');
      setGstNumber('');
      setCreditBalance('');
      setShowAddModal(false);
      fetchCustomers();
    } catch (err) {
      console.error('Enrolling customer error:', err);
      setAddError(err.response?.data?.message || 'Failed to enroll customer profile.');
    } finally {
      setAddLoading(false);
    }
  };

  const handleCreditSettlement = async (e) => {
    e.preventDefault();
    const amount = parseFloat(settleAmount);
    if (isNaN(amount) || amount <= 0) {
      setSettleError('Please enter a valid positive payment amount.');
      return;
    }

    setSettleLoading(true);
    setSettleError('');
    try {
      const response = await axios.post(`/customers/${selectedCustomer.id}/settle`, { amount });

      // Reload lists
      setSettleAmount('');
      setShowSettleModal(false);
      
      // Update local view details
      const updatedCustomer = {
        ...selectedCustomer,
        credit_balance: response.data.newBalance,
        loyalty_points: response.data.newPoints
      };
      setSelectedCustomer(updatedCustomer);
      handleViewPurchases(updatedCustomer);
      
      fetchCustomers();
    } catch (err) {
      console.error('Credit settlement error:', err);
      setSettleError(err.response?.data?.message || 'Credit settlement failed.');
    } finally {
      setSettleLoading(false);
    }
  };

  // Filter customers by search input
  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone.includes(searchQuery) ||
    (c.gst_number && c.gst_number.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="container-fluid py-4" style={{ fontFamily: 'Inter, sans-serif' }}>
      
      {/* Header section */}
      <div className="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-3 mb-4">
        <div>
          <h1 className="h3 font-heading fw-bold m-0" style={{ color: '#0F172A' }}>
            Customer Loyalty & Credits
          </h1>
          <p className="text-muted m-0" style={{ fontSize: '0.9rem' }}>
            Enroll shoppers, record GSTIN numbers, audit invoices, and process credit settlements.
          </p>
        </div>
        
        <button 
          className="btn text-white d-flex align-items-center gap-2 px-3 py-2 border-0 shadow-sm"
          style={{ backgroundColor: '#2563EB', borderRadius: '8px' }}
          onClick={() => setShowAddModal(true)}
        >
          <Plus size={18} />
          <span className="fw-semibold">Enroll Customer</span>
        </button>
      </div>

      {/* Directory Filter Bar */}
      <div className="mb-4 position-relative">
        <span className="position-absolute translate-middle-y" style={{ left: '16px', top: '50%' }}>
          <Search size={18} className="text-muted" />
        </span>
        <input
          type="text"
          className="form-control ps-5 py-2.5 border-0 shadow-sm"
          placeholder="Lookup customer by name, contact phone, or GST number..."
          style={{ borderRadius: '10px', fontSize: '0.95rem' }}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="d-flex justify-content-center py-5">
          <div className="spinner-border" style={{ color: '#2563EB' }} role="status">
            <span className="visually-hidden">Loading profiles...</span>
          </div>
        </div>
      ) : error ? (
        <div className="alert alert-danger" role="alert" style={{ borderRadius: '8px' }}>
          {error}
        </div>
      ) : (
        <div className="row g-4">
          
          {/* Customers Directory */}
          <div className={selectedCustomer ? "col-lg-7" : "col-12"}>
            <div className="card border-0 shadow-sm rounded-3 overflow-hidden" style={{ backgroundColor: '#FFFFFF' }}>
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0" style={{ fontSize: '0.9rem' }}>
                  <thead style={{ backgroundColor: '#F8FAFC' }}>
                    <tr>
                      <th className="py-3.5 px-4 border-0 text-muted fw-semibold" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>Customer</th>
                      <th className="py-3.5 px-3 border-0 text-muted fw-semibold" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>GST Number</th>
                      <th className="py-3.5 px-3 border-0 text-muted fw-semibold text-center" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>Loyalty</th>
                      <th className="py-3.5 px-3 border-0 text-end text-muted fw-semibold" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>Credit Outstanding</th>
                      <th className="py-3.5 px-4 border-0 text-center text-muted fw-semibold" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCustomers.map((c) => {
                      const hasCredit = parseFloat(c.credit_balance) > 0;
                      const isSelected = selectedCustomer?.id === c.id;

                      return (
                        <tr key={c.id} className={isSelected ? 'table-primary-highlight' : ''}>
                          <td className="py-3.5 px-4">
                            <div className="d-flex align-items-center gap-3">
                              <div className="p-2 rounded-circle bg-opacity-10" style={{ backgroundColor: '#2563EB', color: '#2563EB' }}>
                                <Users size={18} />
                              </div>
                              <div>
                                <div className="fw-bold text-dark">{c.name}</div>
                                <div className="text-muted d-flex align-items-center gap-1" style={{ fontSize: '0.8rem' }}>
                                  <Phone size={12} /> {c.phone}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-3">
                            {c.gst_number ? (
                              <span className="font-heading fw-semibold text-dark" style={{ fontSize: '0.85rem' }}>{c.gst_number}</span>
                            ) : (
                              <span className="text-muted" style={{ fontSize: '0.8rem' }}>N/A</span>
                            )}
                          </td>
                          <td className="py-3.5 px-3 text-center">
                            <span 
                              className="badge rounded-pill fw-semibold d-inline-flex align-items-center gap-1 px-2.5 py-1"
                              style={{ 
                                backgroundColor: 'rgba(37, 99, 235, 0.1)', 
                                color: '#2563EB',
                                fontSize: '0.75rem'
                              }}
                            >
                              <Award size={12} />
                              <span>{c.loyalty_points || 0} pts</span>
                            </span>
                          </td>
                          <td className="py-3.5 px-3 text-end">
                            <span 
                              className="fw-bold font-heading" 
                              style={{ 
                                color: hasCredit ? '#F59E0B' : '#0F172A',
                                fontSize: '0.95rem'
                              }}
                            >
                              ₹{parseFloat(c.credit_balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <button 
                              className="btn btn-light btn-sm rounded-2 border-0 px-2.5 py-1.5 d-inline-flex align-items-center gap-1" 
                              onClick={() => handleViewPurchases(c)}
                              style={{ fontSize: '0.8rem', backgroundColor: '#F1F5F9', color: '#0F172A' }}
                            >
                              <Eye size={14} />
                              <span>Purchases</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Customer Purchases Side Panel */}
          {selectedCustomer && (
            <div className="col-lg-5">
              <div className="card border-0 shadow-sm rounded-3 position-sticky" style={{ top: '24px', backgroundColor: '#FFFFFF' }}>
                <div className="card-header bg-white border-0 pt-4 px-4 pb-2 d-flex justify-content-between align-items-start">
                  <div>
                    <h5 className="fw-bold font-heading m-0 text-dark">
                      {selectedCustomer.name}
                    </h5>
                    <span className="text-muted d-block mt-0.5" style={{ fontSize: '0.8rem' }}>
                      Loyalty Points: <strong>{selectedCustomer.loyalty_points}</strong> | Phone: {selectedCustomer.phone}
                    </span>
                  </div>
                  <button 
                    className="btn btn-light rounded-circle p-2 border-0" 
                    onClick={() => setSelectedCustomer(null)}
                    style={{ backgroundColor: '#F1F5F9' }}
                    aria-label="Close purchases panel"
                  >
                    <X size={18} style={{ color: '#64748B' }} />
                  </button>
                </div>

                <div className="card-body px-4 pb-4 pt-1">
                  
                  {/* Credit Settlement highlights */}
                  <div className="p-3.5 rounded-3 border-0 d-flex justify-content-between align-items-center mb-4" style={{ backgroundColor: '#FFFBEB', border: '1px solid #FEF3C7' }}>
                    <div>
                      <span className="text-muted d-block" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Outstanding Balance</span>
                      <span className="h4 fw-bold font-heading m-0" style={{ color: parseFloat(selectedCustomer.credit_balance) > 0 ? '#F59E0B' : '#0F172A' }}>
                        ₹{parseFloat(selectedCustomer.credit_balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    {parseFloat(selectedCustomer.credit_balance) > 0 && (
                      <button 
                        className="btn text-white d-flex align-items-center gap-1.5 px-3 py-2 border-0 shadow-sm"
                        style={{ backgroundColor: '#2563EB', borderRadius: '8px', fontSize: '0.8rem' }}
                        onClick={() => setShowSettleModal(true)}
                      >
                        <CreditCard size={14} />
                        <span className="fw-semibold">Settle Credit</span>
                      </button>
                    )}
                  </div>

                  {/* Tab Navigation */}
                  <div className="d-flex border-bottom border-light mb-4">
                    <button 
                      type="button"
                      className={`btn btn-sm border-0 pb-2 px-3 fw-bold font-heading rounded-0 ${activeTab === 'purchases' ? 'text-primary border-bottom border-primary border-2' : 'text-muted'}`}
                      style={{ 
                        fontSize: '0.8rem', 
                        textTransform: 'uppercase', 
                        letterSpacing: '0.5px',
                        boxShadow: 'none',
                        borderBottom: activeTab === 'purchases' ? '2px solid #2563EB !important' : 'none'
                      }}
                      onClick={() => setActiveTab('purchases')}
                    >
                      Purchase History
                    </button>
                    <button 
                      type="button"
                      className={`btn btn-sm border-0 pb-2 px-3 fw-bold font-heading rounded-0 ${activeTab === 'ledger' ? 'text-primary border-bottom border-primary border-2' : 'text-muted'}`}
                      style={{ 
                        fontSize: '0.8rem', 
                        textTransform: 'uppercase', 
                        letterSpacing: '0.5px',
                        boxShadow: 'none',
                        borderBottom: activeTab === 'ledger' ? '2px solid #2563EB !important' : 'none'
                      }}
                      onClick={() => setActiveTab('ledger')}
                    >
                      Credit Ledger
                    </button>
                  </div>

                  {activeTab === 'purchases' ? (
                    purchaseLoading ? (
                      <div className="d-flex flex-column align-items-center py-5">
                        <div className="spinner-border text-primary spinner-border-sm mb-2" role="status" />
                        <span className="text-muted" style={{ fontSize: '0.8rem' }}>Retrieving invoices...</span>
                      </div>
                    ) : purchaseHistory.length === 0 ? (
                      <div className="text-center py-5 bg-light rounded-3">
                        <p className="text-muted m-0" style={{ fontSize: '0.85rem' }}>No purchase transactions found for this customer.</p>
                      </div>
                    ) : (
                      <div style={{ maxHeight: '350px', overflowY: 'auto', border: '1px solid #F1F5F9', borderRadius: '8px' }}>
                        <div className="list-group list-group-flush">
                          {purchaseHistory.map((item) => (
                            <div key={item.id} className="list-group-item border-light p-3">
                              <div className="d-flex justify-content-between align-items-start mb-1">
                                <div>
                                  <span className="fw-bold text-dark font-heading" style={{ fontSize: '0.85rem' }}>{item.invoice_number}</span>
                                  <span className="text-muted d-block" style={{ fontSize: '0.75rem' }}>
                                    Method: <strong>{item.payment_method}</strong>
                                  </span>
                                </div>
                                <span className="fw-bold text-dark" style={{ fontSize: '0.9rem' }}>
                                  ₹{parseFloat(item.net_amount).toLocaleString('en-IN')}
                                </span>
                              </div>
                              <div className="d-flex justify-content-between align-items-center" style={{ fontSize: '0.75rem' }}>
                                <span className="text-muted d-flex align-items-center gap-1">
                                  <Calendar size={10} />
                                  {new Date(item.created_at).toLocaleString('en-IN', { dateStyle: 'medium' })}
                                </span>
                                {parseFloat(item.discount) > 0 && (
                                  <span className="text-success fw-semibold">Saved ₹{parseFloat(item.discount).toLocaleString('en-IN')}</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  ) : (
                    ledgerLoading ? (
                      <div className="d-flex flex-column align-items-center py-5">
                        <div className="spinner-border text-primary spinner-border-sm mb-2" role="status" />
                        <span className="text-muted" style={{ fontSize: '0.8rem' }}>Loading statements...</span>
                      </div>
                    ) : ledgerHistory.length === 0 ? (
                      <div className="text-center py-5 bg-light rounded-3">
                        <p className="text-muted m-0" style={{ fontSize: '0.85rem' }}>No statements recorded for this customer.</p>
                      </div>
                    ) : (
                      <div className="position-relative" style={{ maxHeight: '350px', overflowY: 'auto', paddingRight: '4px' }}>
                        <div className="timeline-container ps-3 position-relative">
                          {/* Timeline vertical bar */}
                          <div className="position-absolute bg-light h-100" style={{ left: '4px', top: 0, width: '2px', zIndex: 0 }} />

                          {ledgerHistory.map((item) => {
                            const isInvoice = item.type === 'Invoice';
                            
                            return (
                              <div key={item.id} className="mb-4 position-relative" style={{ zIndex: 1 }}>
                                {/* Timeline dot */}
                                <div 
                                  className="position-absolute rounded-circle" 
                                  style={{ 
                                    left: '-16px', 
                                    top: '4px', 
                                    width: '10px', 
                                    height: '10px', 
                                    backgroundColor: isInvoice ? '#F59E0B' : '#10B981',
                                    border: '2px solid #FFFFFF'
                                  }} 
                                />
                                
                                <div className="d-flex justify-content-between align-items-start">
                                  <div>
                                    <span 
                                      className={`badge rounded-pill px-2.5 py-0.5 fw-semibold mb-1`}
                                      style={{ 
                                        fontSize: '0.7rem', 
                                        backgroundColor: isInvoice ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                                        color: isInvoice ? '#F59E0B' : '#10B981'
                                      }}
                                    >
                                      {item.type}
                                    </span>
                                    <p className="m-0 fw-semibold text-dark" style={{ fontSize: '0.85rem' }}>
                                      {item.description}
                                    </p>
                                    <span className="text-muted d-flex align-items-center gap-1" style={{ fontSize: '0.75rem' }}>
                                      <Calendar size={10} />
                                      {new Date(item.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                                    </span>
                                  </div>

                                  <div className="text-end">
                                    <span className="fw-bold d-block text-dark" style={{ fontSize: '0.9rem' }}>
                                      {isInvoice ? '+' : '-'} ₹{parseFloat(item.amount).toLocaleString('en-IN')}
                                    </span>
                                    <span className="text-muted d-block" style={{ fontSize: '0.75rem' }}>
                                      Bal: ₹{parseFloat(item.balance_after).toLocaleString('en-IN')}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )
                  )}

                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* Enroll Customer Modal */}
      {showAddModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg rounded-3">
              <div className="modal-header border-bottom border-light p-4">
                <h5 className="modal-title fw-bold font-heading text-dark">Enroll Customer Profile</h5>
                <button type="button" className="btn-close" onClick={() => setShowAddModal(false)} />
              </div>
              <form onSubmit={handleAddCustomer}>
                <div className="modal-body p-4">
                  {addError && (
                    <div className="alert alert-danger py-2" role="alert" style={{ fontSize: '0.85rem' }}>
                      {addError}
                    </div>
                  )}

                  <div className="mb-3">
                    <label htmlFor="cust-name" className="form-label text-muted fw-semibold" style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}>Full Name</label>
                    <input
                      id="cust-name"
                      type="text"
                      className="form-control py-2"
                      placeholder="e.g. Rahul Sharma"
                      required
                      style={{ borderRadius: '8px', fontSize: '0.9rem' }}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>

                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <label htmlFor="cust-phone" className="form-label text-muted fw-semibold" style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}>Phone Number</label>
                      <input
                        id="cust-phone"
                        type="text"
                        className="form-control py-2"
                        placeholder="e.g. 9876543210"
                        required
                        style={{ borderRadius: '8px', fontSize: '0.9rem' }}
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                    </div>
                    <div className="col-md-6 mb-3">
                      <label htmlFor="cust-email" className="form-label text-muted fw-semibold" style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}>Email Address</label>
                      <input
                        id="cust-email"
                        type="email"
                        className="form-control py-2"
                        placeholder="e.g. rahul@gmail.com"
                        style={{ borderRadius: '8px', fontSize: '0.9rem' }}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <label htmlFor="cust-gst" className="form-label text-muted fw-semibold" style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}>GST Number</label>
                      <input
                        id="cust-gst"
                        type="text"
                        className="form-control py-2"
                        placeholder="e.g. 27ABCDE1234A1Z1"
                        maxLength="15"
                        style={{ borderRadius: '8px', fontSize: '0.9rem' }}
                        value={gstNumber}
                        onChange={(e) => setGstNumber(e.target.value)}
                      />
                    </div>
                    <div className="col-md-6 mb-3">
                      <label htmlFor="cust-credit" className="form-label text-muted fw-semibold" style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}>Opening Outstanding (₹)</label>
                      <input
                        id="cust-credit"
                        type="number"
                        className="form-control py-2"
                        placeholder="e.g. 2500"
                        style={{ borderRadius: '8px', fontSize: '0.9rem' }}
                        value={creditBalance}
                        onChange={(e) => setCreditBalance(e.target.value)}
                      />
                    </div>
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
                    disabled={addLoading}
                    style={{ backgroundColor: '#2563EB', borderRadius: '8px' }}
                  >
                    {addLoading ? 'Enrolling...' : 'Enroll Shopper'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Settle Credit Modal */}
      {showSettleModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)' }}>
          <div className="modal-dialog modal-dialog-centered modal-sm">
            <div className="modal-content border-0 shadow-lg rounded-3">
              <div className="modal-header border-bottom border-light p-4">
                <h5 className="modal-title fw-bold font-heading text-dark">Settle Credit Outstanding</h5>
                <button type="button" className="btn-close" onClick={() => setShowSettleModal(false)} />
              </div>
              <form onSubmit={handleCreditSettlement}>
                <div className="modal-body p-4">
                  {settleError && (
                    <div className="alert alert-danger py-2" role="alert" style={{ fontSize: '0.85rem' }}>
                      {settleError}
                    </div>
                  )}

                  <div className="mb-3">
                    <label htmlFor="settle-amt" className="form-label text-muted fw-semibold" style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}>Payment Amount (₹)</label>
                    <input
                      id="settle-amt"
                      type="number"
                      step="0.01"
                      className="form-control py-2.5 fw-bold font-heading fs-5"
                      placeholder="0.00"
                      required
                      max={selectedCustomer?.credit_balance}
                      style={{ borderRadius: '8px' }}
                      value={settleAmount}
                      onChange={(e) => setSettleAmount(e.target.value)}
                    />
                    <small className="text-muted d-block mt-1">
                      Max outstanding: ₹{parseFloat(selectedCustomer?.credit_balance).toLocaleString('en-IN')}
                    </small>
                  </div>
                  
                  <div className="text-center p-3 bg-light rounded-3" style={{ fontSize: '0.8rem' }}>
                    <span className="text-muted">Reward Earned:</span>
                    <strong className="text-success d-block font-heading">
                      +{Math.floor(parseFloat(settleAmount) / 100) || 0} Loyalty Points
                    </strong>
                    <span className="text-muted d-block mt-0.5" style={{ fontSize: '0.7rem' }}>
                      (1 point per ₹100 settled)
                    </span>
                  </div>
                </div>

                <div className="modal-footer border-top border-light p-4">
                  <button 
                    type="button" 
                    className="btn btn-light px-3 py-2 border-0 fw-semibold" 
                    onClick={() => setShowSettleModal(false)}
                    style={{ borderRadius: '8px', backgroundColor: '#F1F5F9', color: '#64748B', fontSize: '0.85rem' }}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="btn text-white px-3 py-2 border-0 fw-semibold"
                    disabled={settleLoading}
                    style={{ backgroundColor: '#2563EB', borderRadius: '8px', fontSize: '0.85rem' }}
                  >
                    {settleLoading ? 'Settling...' : 'Confirm Receipt'}
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

export default Customers;
