import React, { useState, useEffect } from 'react';
import axios from '../api/axios';
import { Truck, User, Phone, Mail, Award, DollarSign, Plus, Eye, CreditCard, ChevronRight, X, Calendar, ClipboardList } from 'lucide-react';

const Suppliers = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Selected supplier details & ledger history
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [ledgerHistory, setLedgerHistory] = useState([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  // Modal / Form triggers
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  // New Supplier form states
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [gstin, setGstin] = useState('');
  const [openingBalance, setOpeningBalance] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');

  // Payment form states
  const [payAmount, setPayAmount] = useState('');
  const [payDescription, setPayDescription] = useState('');
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError] = useState('');

  // Consignment Invoice form states
  const [invoiceNum, setInvoiceNum] = useState('');
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [invoiceDesc, setInvoiceDesc] = useState('');
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceError, setInvoiceError] = useState('');

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get('/suppliers');
      setSuppliers(response.data);
    } catch (err) {
      console.error('Fetch suppliers error:', err);
      setError('Failed to load supplier records.');
    } finally {
      setLoading(false);
    }
  };

  const handleViewLedger = async (supplier) => {
    setSelectedSupplier(supplier);
    setLedgerLoading(true);
    setLedgerHistory([]);
    try {
      const response = await axios.get(`/suppliers/${supplier.id}/ledger`);
      setLedgerHistory(response.data.ledger);
    } catch (err) {
      console.error('Fetch supplier ledger error:', err);
    } finally {
      setLedgerLoading(false);
    }
  };

  const handleAddSupplier = async (e) => {
    e.preventDefault();
    if (!name.trim() || !contactPerson.trim() || !phone.trim()) {
      setAddError('Please enter Name, Contact Person, and Phone.');
      return;
    }

    setAddLoading(true);
    setAddError('');
    try {
      await axios.post('/suppliers', {
        name,
        contact_person: contactPerson,
        phone,
        email: email || null,
        gstin: gstin || null,
        credit_balance: parseFloat(openingBalance) || 0.00
      });

      // Clear & Close
      setName('');
      setContactPerson('');
      setPhone('');
      setEmail('');
      setGstin('');
      setOpeningBalance('');
      setShowAddModal(false);
      fetchSuppliers();
    } catch (err) {
      console.error('Create supplier error:', err);
      setAddError(err.response?.data?.message || 'Failed to add supplier.');
    } finally {
      setAddLoading(false);
    }
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    const amount = parseFloat(payAmount);
    if (isNaN(amount) || amount <= 0) {
      setPayError('Please enter a valid positive payment amount.');
      return;
    }

    setPayLoading(true);
    setPayError('');
    try {
      const response = await axios.post(`/suppliers/${selectedSupplier.id}/pay`, {
        amount,
        description: payDescription || 'Outstanding balance partial settlement.'
      });

      // Reload lists
      setPayAmount('');
      setPayDescription('');
      setShowPayModal(false);
      
      // Update local detailed view if opened
      const updatedSupplier = {
        ...selectedSupplier,
        credit_balance: response.data.newBalance
      };
      setSelectedSupplier(updatedSupplier);
      handleViewLedger(updatedSupplier);
      
      fetchSuppliers();
    } catch (err) {
      console.error('Post payment error:', err);
      setPayError(err.response?.data?.message || 'Payment recording failed.');
    } finally {
      setPayLoading(false);
    }
  };

  const handleRecordInvoice = async (e) => {
    e.preventDefault();
    const amount = parseFloat(invoiceAmount);
    if (!invoiceNum.trim()) {
      setInvoiceError('Please enter a valid invoice number.');
      return;
    }
    if (isNaN(amount) || amount <= 0) {
      setInvoiceError('Please enter a valid positive consignment amount.');
      return;
    }

    setInvoiceLoading(true);
    setInvoiceError('');
    try {
      const response = await axios.post(`/suppliers/${selectedSupplier.id}/invoice`, {
        invoice_number: invoiceNum,
        amount,
        description: invoiceDesc || `Consignment Invoice #${invoiceNum}`
      });

      // Reload lists
      setInvoiceNum('');
      setInvoiceAmount('');
      setInvoiceDesc('');
      setShowInvoiceModal(false);
      
      // Update local detailed view if opened
      const updatedSupplier = {
        ...selectedSupplier,
        credit_balance: response.data.newBalance
      };
      setSelectedSupplier(updatedSupplier);
      handleViewLedger(updatedSupplier);
      
      fetchSuppliers();
    } catch (err) {
      console.error('Post consignment invoice error:', err);
      setInvoiceError(err.response?.data?.message || 'Invoice logging failed.');
    } finally {
      setInvoiceLoading(false);
    }
  };

  return (
    <div className="container-fluid py-4" style={{ fontFamily: 'Inter, sans-serif' }}>
      
      {/* Header Panel */}
      <div className="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-3 mb-4">
        <div>
          <h1 className="h3 font-heading fw-bold m-0" style={{ color: '#0F172A' }}>
            Supplier Portal
          </h1>
          <p className="text-muted m-0" style={{ fontSize: '0.9rem' }}>
            Track pending manufacturer credits, raw consignment ledgers, and cash disbursements.
          </p>
        </div>
        
        <button 
          className="btn text-white d-flex align-items-center gap-2 px-3 py-2 border-0 shadow-sm"
          style={{ backgroundColor: '#2563EB', borderRadius: '8px' }}
          onClick={() => setShowAddModal(true)}
        >
          <Plus size={18} />
          <span className="fw-semibold">Add Supplier</span>
        </button>
      </div>

      {loading ? (
        <div className="d-flex justify-content-center py-5">
          <div className="spinner-border" style={{ color: '#2563EB' }} role="status">
            <span className="visually-hidden">Loading suppliers...</span>
          </div>
        </div>
      ) : error ? (
        <div className="alert alert-danger" role="alert" style={{ borderRadius: '8px' }}>
          {error}
        </div>
      ) : (
        <div className="row g-4">
          
          {/* Supplier Directory List */}
          <div className={selectedSupplier ? "col-lg-7" : "col-12"}>
            <div className="card border-0 shadow-sm rounded-3 overflow-hidden" style={{ backgroundColor: '#FFFFFF' }}>
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0" style={{ fontSize: '0.9rem' }}>
                  <thead style={{ backgroundColor: '#F8FAFC' }}>
                    <tr>
                      <th className="py-3.5 px-4 border-0 text-muted fw-semibold" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>Supplier Details</th>
                      <th className="py-3.5 px-3 border-0 text-muted fw-semibold" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>Contact Person</th>
                      <th className="py-3.5 px-3 border-0 text-muted fw-semibold" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>GSTIN</th>
                      <th className="py-3.5 px-3 border-0 text-muted fw-semibold text-end" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>Outstanding Payable</th>
                      <th className="py-3.5 px-4 border-0 text-center text-muted fw-semibold" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {suppliers.map((supplier) => {
                      const hasBalance = parseFloat(supplier.credit_balance) > 0;
                      const isSelected = selectedSupplier?.id === supplier.id;

                      return (
                        <tr key={supplier.id} className={isSelected ? 'table-primary-highlight' : ''} style={{ transition: 'all 0.15s' }}>
                          <td className="py-3.5 px-4">
                            <div className="d-flex align-items-center gap-3">
                              <div className="p-2 rounded-circle bg-opacity-10" style={{ backgroundColor: '#2563EB', color: '#2563EB' }}>
                                <Truck size={18} />
                              </div>
                              <div>
                                <div className="fw-bold text-dark">{supplier.name}</div>
                                <div className="text-muted d-flex align-items-center gap-1" style={{ fontSize: '0.8rem' }}>
                                  <Phone size={12} /> {supplier.phone}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-3">
                            <div className="text-dark">{supplier.contact_person}</div>
                            {supplier.email && (
                              <span className="text-muted d-block" style={{ fontSize: '0.75rem' }}>{supplier.email}</span>
                            )}
                          </td>
                          <td className="py-3.5 px-3">
                            <span className="font-heading fw-semibold text-muted" style={{ fontSize: '0.85rem' }}>
                              {supplier.gstin || 'N/A'}
                            </span>
                          </td>
                          <td className="py-3.5 px-3 text-end">
                            <span 
                              className="fw-bold font-heading" 
                              style={{ 
                                color: hasBalance ? '#F59E0B' : '#0F172A',
                                fontSize: '1rem'
                              }}
                            >
                              ₹{parseFloat(supplier.credit_balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <button 
                              className="btn btn-light btn-sm rounded-2 border-0 px-2.5 py-1.5 d-inline-flex align-items-center gap-1" 
                              onClick={() => handleViewLedger(supplier)}
                              style={{ fontSize: '0.8rem', backgroundColor: '#F1F5F9', color: '#0F172A' }}
                            >
                              <Eye size={14} />
                              <span>Audit Ledger</span>
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

          {/* Supplier Detailed Ledger Side panel */}
          {selectedSupplier && (
            <div className="col-lg-5">
              <div className="card border-0 shadow-sm rounded-3 position-sticky" style={{ top: '24px', backgroundColor: '#FFFFFF' }}>
                <div className="card-header bg-white border-0 pt-4 px-4 pb-2 d-flex justify-content-between align-items-start">
                  <div>
                    <h5 className="fw-bold font-heading m-0 text-dark">
                      {selectedSupplier.name}
                    </h5>
                    <span className="text-muted d-block mt-0.5" style={{ fontSize: '0.8rem' }}>
                      Contact: {selectedSupplier.contact_person} ({selectedSupplier.phone})
                    </span>
                  </div>
                  <button 
                    className="btn btn-light rounded-circle p-2 border-0" 
                    onClick={() => setSelectedSupplier(null)}
                    style={{ backgroundColor: '#F1F5F9' }}
                    aria-label="Close panel"
                  >
                    <X size={18} style={{ color: '#64748B' }} />
                  </button>
                </div>

                <div className="card-body px-4 pb-4 pt-1">
                  
                  {/* Credit status highlights */}
                  <div className="p-3.5 rounded-3 border-0 d-flex justify-content-between align-items-center mb-4" style={{ backgroundColor: '#FAF5FF', border: '1px solid #F3E8FF' }}>
                    <div>
                      <span className="text-muted d-block" style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Outstanding Balance</span>
                      <span className="h3 fw-bold font-heading m-0" style={{ color: parseFloat(selectedSupplier.credit_balance) > 0 ? '#F59E0B' : '#0F172A' }}>
                        ₹{parseFloat(selectedSupplier.credit_balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="d-flex gap-2">
                      <button 
                        className="btn text-dark d-flex align-items-center gap-1.5 px-3 py-2 border-0 shadow-sm"
                        style={{ backgroundColor: '#F1F5F9', borderRadius: '8px', fontSize: '0.85rem' }}
                        onClick={() => setShowInvoiceModal(true)}
                      >
                        <ClipboardList size={15} />
                        <span className="fw-semibold">Log Invoice</span>
                      </button>

                      {parseFloat(selectedSupplier.credit_balance) > 0 && (
                        <button 
                          className="btn text-white d-flex align-items-center gap-1.5 px-3 py-2 border-0 shadow-sm"
                          style={{ backgroundColor: '#2563EB', borderRadius: '8px', fontSize: '0.85rem' }}
                          onClick={() => setShowPayModal(true)}
                        >
                          <CreditCard size={15} />
                          <span className="fw-semibold">Record Payment</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <h6 className="fw-bold font-heading text-muted mb-3 d-flex align-items-center gap-1.5" style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}>
                    <ClipboardList size={14} />
                    <span>Transaction History Log</span>
                  </h6>

                  {ledgerLoading ? (
                    <div className="d-flex flex-column align-items-center py-5">
                      <div className="spinner-border text-primary spinner-border-sm mb-2" role="status" />
                      <span className="text-muted" style={{ fontSize: '0.8rem' }}>Loading statements...</span>
                    </div>
                  ) : ledgerHistory.length === 0 ? (
                    <div className="text-center py-5 bg-light rounded-3">
                      <p className="text-muted m-0" style={{ fontSize: '0.85rem' }}>No statements recorded for this supplier.</p>
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
                                  backgroundColor: isInvoice ? '#F59E0B' : '#2563EB',
                                  border: '2px solid #FFFFFF'
                                }} 
                              />
                              
                              <div className="d-flex justify-content-between align-items-start">
                                <div>
                                  <span 
                                    className={`badge rounded-pill px-2.5 py-0.5 fw-semibold mb-1`}
                                    style={{ 
                                      fontSize: '0.7rem', 
                                      backgroundColor: isInvoice ? 'rgba(245, 158, 11, 0.1)' : 'rgba(37, 99, 235, 0.1)',
                                      color: isInvoice ? '#F59E0B' : '#2563EB'
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
                  )}

                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* Add Supplier Modal */}
      {showAddModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg rounded-3">
              <div className="modal-header border-bottom border-light p-4">
                <h5 className="modal-title fw-bold font-heading text-dark">Register Supplier Profile</h5>
                <button type="button" className="btn-close" onClick={() => setShowAddModal(false)} />
              </div>
              <form onSubmit={handleAddSupplier}>
                <div className="modal-body p-4" style={{ maxHeight: '420px', overflowY: 'auto' }}>
                  {addError && (
                    <div className="alert alert-danger py-2" role="alert" style={{ fontSize: '0.85rem' }}>
                      {addError}
                    </div>
                  )}

                  <div className="mb-3">
                    <label htmlFor="sup-name" className="form-label text-muted fw-semibold" style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}>Manufacturer / Supplier Name</label>
                    <input
                      id="sup-name"
                      type="text"
                      className="form-control py-2"
                      placeholder="e.g. Mulberry Weaves Co."
                      required
                      style={{ borderRadius: '8px', fontSize: '0.9rem' }}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>

                  <div className="mb-3">
                    <label htmlFor="sup-contact" className="form-label text-muted fw-semibold" style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}>Contact Person</label>
                    <input
                      id="sup-contact"
                      type="text"
                      className="form-control py-2"
                      placeholder="e.g. Rajesh Kumar"
                      required
                      style={{ borderRadius: '8px', fontSize: '0.9rem' }}
                      value={contactPerson}
                      onChange={(e) => setContactPerson(e.target.value)}
                    />
                  </div>

                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <label htmlFor="sup-phone" className="form-label text-muted fw-semibold" style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}>Phone Line</label>
                      <input
                        id="sup-phone"
                        type="text"
                        className="form-control py-2"
                        placeholder="e.g. 9988776655"
                        required
                        style={{ borderRadius: '8px', fontSize: '0.9rem' }}
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                    </div>
                    <div className="col-md-6 mb-3">
                      <label htmlFor="sup-email" className="form-label text-muted fw-semibold" style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}>Email Address</label>
                      <input
                        id="sup-email"
                        type="email"
                        className="form-control py-2"
                        placeholder="e.g. sales@weaves.com"
                        style={{ borderRadius: '8px', fontSize: '0.9rem' }}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <label htmlFor="sup-gst" className="form-label text-muted fw-semibold" style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}>GSTIN Number</label>
                      <input
                        id="sup-gst"
                        type="text"
                        className="form-control py-2"
                        placeholder="15-digit GSTIN"
                        maxLength="15"
                        style={{ borderRadius: '8px', fontSize: '0.9rem' }}
                        value={gstin}
                        onChange={(e) => setGstin(e.target.value)}
                      />
                    </div>
                    <div className="col-md-6 mb-3">
                      <label htmlFor="sup-balance" className="form-label text-muted fw-semibold" style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}>Opening Outstanding (₹)</label>
                      <input
                        id="sup-balance"
                        type="number"
                        className="form-control py-2"
                        placeholder="e.g. 15000"
                        style={{ borderRadius: '8px', fontSize: '0.9rem' }}
                        value={openingBalance}
                        onChange={(e) => setOpeningBalance(e.target.value)}
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
                    {addLoading ? 'Registering...' : 'Enroll Supplier'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {/* Record Payout / Payment Modal */}
      {showPayModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)' }}>
          <div className="modal-dialog modal-dialog-centered modal-sm">
            <div className="modal-content border-0 shadow-lg rounded-3">
              <div className="modal-header border-bottom border-light p-4">
                <h5 className="modal-title fw-bold font-heading text-dark">Disburse Payment</h5>
                <button type="button" className="btn-close" onClick={() => setShowPayModal(false)} />
              </div>
              <form onSubmit={handleRecordPayment}>
                <div className="modal-body p-4">
                  {payError && (
                    <div className="alert alert-danger py-2" role="alert" style={{ fontSize: '0.85rem' }}>
                      {payError}
                    </div>
                  )}

                  <div className="mb-3">
                    <label htmlFor="pay-amt" className="form-label text-muted fw-semibold" style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}>Amount to Pay (₹)</label>
                    <input
                      id="pay-amt"
                      type="number"
                      step="0.01"
                      className="form-control py-2.5 fw-bold font-heading fs-5"
                      placeholder="0.00"
                      required
                      max={selectedSupplier?.credit_balance}
                      style={{ borderRadius: '8px' }}
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                    />
                    <small className="text-muted d-block mt-1">
                      Max allowed: ₹{parseFloat(selectedSupplier?.credit_balance).toLocaleString('en-IN')}
                    </small>
                  </div>

                  <div className="mb-3">
                    <label htmlFor="pay-desc" className="form-label text-muted fw-semibold" style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}>Payment Reference / Memo</label>
                    <textarea
                      id="pay-desc"
                      className="form-control py-2"
                      placeholder="e.g. Bank Transfer Ref TXN-998822"
                      style={{ borderRadius: '8px', fontSize: '0.85rem' }}
                      rows="2"
                      value={payDescription}
                      onChange={(e) => setPayDescription(e.target.value)}
                    />
                  </div>
                </div>

                <div className="modal-footer border-top border-light p-4">
                  <button 
                    type="button" 
                    className="btn btn-light px-3 py-2 border-0 fw-semibold" 
                    onClick={() => setShowPayModal(false)}
                    style={{ borderRadius: '8px', backgroundColor: '#F1F5F9', color: '#64748B', fontSize: '0.85rem' }}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="btn text-white px-3 py-2 border-0 fw-semibold"
                    disabled={payLoading}
                    style={{ backgroundColor: '#2563EB', borderRadius: '8px', fontSize: '0.85rem' }}
                  >
                    {payLoading ? 'Posting...' : 'Disburse Payout'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Log Consignment Invoice Modal */}
      {showInvoiceModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)' }}>
          <div className="modal-dialog modal-dialog-centered modal-sm">
            <div className="modal-content border-0 shadow-lg rounded-3">
              <div className="modal-header border-bottom border-light p-4">
                <h5 className="modal-title fw-bold font-heading text-dark">Log Consignment Bill</h5>
                <button type="button" className="btn-close" onClick={() => setShowInvoiceModal(false)} />
              </div>
              <form onSubmit={handleRecordInvoice}>
                <div className="modal-body p-4">
                  {invoiceError && (
                    <div className="alert alert-danger py-2" role="alert" style={{ fontSize: '0.85rem' }}>
                      {invoiceError}
                    </div>
                  )}

                  <div className="mb-3">
                    <label htmlFor="inv-num" className="form-label text-muted fw-semibold" style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}>Invoice / Bill Number</label>
                    <input
                      id="inv-num"
                      type="text"
                      className="form-control py-2"
                      placeholder="e.g. MS-1025"
                      required
                      style={{ borderRadius: '8px', fontSize: '0.85rem' }}
                      value={invoiceNum}
                      onChange={(e) => setInvoiceNum(e.target.value)}
                    />
                  </div>

                  <div className="mb-3">
                    <label htmlFor="inv-amt" className="form-label text-muted fw-semibold" style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}>Total Amount (₹)</label>
                    <input
                      id="inv-amt"
                      type="number"
                      step="0.01"
                      className="form-control py-2.5 fw-bold font-heading fs-5"
                      placeholder="0.00"
                      required
                      style={{ borderRadius: '8px' }}
                      value={invoiceAmount}
                      onChange={(e) => setInvoiceAmount(e.target.value)}
                    />
                  </div>

                  <div className="mb-3">
                    <label htmlFor="inv-desc" className="form-label text-muted fw-semibold" style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}>Consignment Memo</label>
                    <textarea
                      id="inv-desc"
                      className="form-control py-2"
                      placeholder="e.g. Shirts consignment of 150 pieces"
                      style={{ borderRadius: '8px', fontSize: '0.85rem' }}
                      rows="2"
                      value={invoiceDesc}
                      onChange={(e) => setInvoiceDesc(e.target.value)}
                    />
                  </div>
                </div>

                <div className="modal-footer border-top border-light p-4">
                  <button 
                    type="button" 
                    className="btn btn-light px-3 py-2 border-0 fw-semibold" 
                    onClick={() => setShowInvoiceModal(false)}
                    style={{ borderRadius: '8px', backgroundColor: '#F1F5F9', color: '#64748B', fontSize: '0.85rem' }}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="btn text-white px-3 py-2 border-0 fw-semibold"
                    disabled={invoiceLoading}
                    style={{ backgroundColor: '#2563EB', borderRadius: '8px', fontSize: '#0.85rem' }}
                  >
                    {invoiceLoading ? 'Logging...' : 'Log Consignment'}
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

export default Suppliers;
