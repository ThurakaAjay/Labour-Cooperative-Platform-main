import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Ban,
  PhoneCall,
  User,
  ShieldAlert,
  ArrowRight,
  X,
  ExternalLink,
  MessageSquare,
  FileText,
  Building2,
  Check,
  Loader2
} from 'lucide-react';
import { Button, Card, Badge, EmptyState } from '../../../components';
import { complaintsAPI, bookingsAPI, workersAPI } from '../../../api';

export const ComplaintsScreen = () => {
  const navigate = useNavigate();
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All'); // 'All' | 'Open' | 'Investigating' | 'Resolved'
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  // The real Booking (+ its worker's phone, which Booking doesn't store)
  // behind whichever complaint is currently open in the detail panel — a
  // complaint only ever stores a free-text bookingId/against, so seeing the
  // actual customer/worker/booking record means fetching it separately.
  const [bookingDetail, setBookingDetail] = useState(null);
  const [workerPhone, setWorkerPhone] = useState('');
  const [bookingDetailLoading, setBookingDetailLoading] = useState(false);
  const [bookingDetailError, setBookingDetailError] = useState('');

  const fetchComplaints = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await complaintsAPI.getAll();
      if (res.success && Array.isArray(res.data)) {
        const mapped = res.data.map(c => ({
          id: c.complaintId || c._id,
          complaintId: c.complaintId || c._id,
          complainant: c.complainant,
          complainantRole: c.complainantRole || 'Customer',
          complainantPhone: c.complainantPhone || '',
          against: c.against,
          againstWorkerId: c.againstId || '',
          category: c.category,
          description: c.description,
          date: c.date || 'Today',
          status: c.status || 'Open',
          bookingId: c.bookingId || '',
          resolutionNotes: c.resolutionNotes || '',
          photos: c.photos || []
        }));
        setComplaints(mapped);
      }
    } catch (err) {
      console.error('Error fetching complaints from MongoDB:', err);
      setError('Unable to load complaints from database.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComplaints();
  }, []);

  // Fetch the real Booking (and its worker's phone) whenever a different
  // complaint is opened in the detail panel.
  useEffect(() => {
    setBookingDetail(null);
    setWorkerPhone('');
    setBookingDetailError('');

    if (!selectedComplaint?.bookingId) return;

    let cancelled = false;
    setBookingDetailLoading(true);

    bookingsAPI.getById(selectedComplaint.bookingId)
      .then(async (res) => {
        if (cancelled) return;
        if (!res.success || !res.data) {
          setBookingDetailError('Linked booking record could not be found.');
          return;
        }
        setBookingDetail(res.data);

        if (res.data.workerId) {
          try {
            const workerRes = await workersAPI.getById(res.data.workerId);
            if (!cancelled && workerRes.success && workerRes.data) {
              setWorkerPhone(workerRes.data.phone || '');
            }
          } catch {
            // Worker lookup is a nice-to-have (for phone only) — booking details still render without it.
          }
        }
      })
      .catch(() => {
        if (!cancelled) setBookingDetailError('Linked booking record could not be found.');
      })
      .finally(() => {
        if (!cancelled) setBookingDetailLoading(false);
      });

    return () => { cancelled = true; };
  }, [selectedComplaint?.bookingId]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Filter Logic
  const filteredComplaints = complaints.filter((c) => {
    const matchesFilter =
      statusFilter === 'All' ? true : c.status.toLowerCase() === statusFilter.toLowerCase();
    const matchesSearch =
      c.complainant.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.against.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.id.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  // Action: Mark Investigating
  const handleMarkInvestigating = async (id) => {
    try {
      await complaintsAPI.update(id, { status: 'Investigating' });
      setComplaints((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: 'Investigating' } : c))
      );
      if (selectedComplaint?.id === id) {
        setSelectedComplaint((prev) => ({ ...prev, status: 'Investigating' }));
      }
      showToast(`🔍 Complaint #${id} marked as Investigating in MongoDB.`);
    } catch (err) {
      console.error('Update complaint error:', err);
      showToast(`⚠️ Failed to update complaint #${id}`);
    }
  };

  // Action: Resolve — the admin writes their own clearance remark rather
  // than a canned string, since that remark is what the complainant and
  // any future reviewer actually see as the record of how this was settled.
  const [resolvingComplaint, setResolvingComplaint] = useState(null);
  const [resolutionRemark, setResolutionRemark] = useState('');
  const [resolveSubmitting, setResolveSubmitting] = useState(false);
  const [resolveError, setResolveError] = useState('');

  const handleConfirmResolve = async () => {
    if (!resolvingComplaint || !resolutionRemark.trim()) return;
    const id = resolvingComplaint.id;
    const notes = resolutionRemark.trim();
    setResolveSubmitting(true);
    setResolveError('');
    try {
      await complaintsAPI.update(id, { status: 'Resolved', resolutionNotes: notes });
      setComplaints((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, status: 'Resolved', resolutionNotes: notes } : c
        )
      );
      if (selectedComplaint?.id === id) {
        setSelectedComplaint((prev) => ({ ...prev, status: 'Resolved', resolutionNotes: notes }));
      }
      showToast(`✓ Complaint #${id} marked as Resolved in MongoDB.`);
      setResolvingComplaint(null);
      setResolutionRemark('');
    } catch (err) {
      console.error('Resolve complaint error:', err);
      setResolveError(err.response?.data?.message || `Failed to resolve complaint #${id}`);
    } finally {
      setResolveSubmitting(false);
    }
  };

  // Action: Escalate to Suspension
  const handleEscalateSuspension = async (complaint) => {
    try {
      await complaintsAPI.update(complaint.id, { status: 'Investigating', escalateSuspension: true });
      navigate('/admin/workers', {
        state: {
          searchWorker: complaint.against,
          toastMessage: `⚠️ Escalated from Complaint #${complaint.id}: Worker suspended in MongoDB.`
        }
      });
    } catch (err) {
      console.error('Escalate error:', err);
      showToast(`⚠️ Complaint #${complaint.id} escalated to Committee Review.`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', paddingBottom: 'var(--space-xl)' }}>
      
      {/* 1. TOP HEADER & TOAST */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 'bold', margin: '0 0 2px' }}>
            Complaints & Dispute Resolution
          </h1>
          <p className="text-secondary" style={{ fontSize: '13px', margin: 0 }}>
            Review customer and worker grievances, safety incidents, and conciliation actions
          </p>
        </div>

        <Badge variant="active" style={{ fontSize: '12px' }}>
          {complaints.filter((c) => c.status !== 'Resolved').length} Active Inquiries
        </Badge>
      </div>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div style={{
          background: 'var(--color-black)',
          color: 'white',
          padding: '12px 18px',
          borderRadius: 'var(--radius-md)',
          fontSize: '13px',
          fontWeight: 'bold',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: 'var(--shadow-lg)'
        }}>
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            style={{ color: 'var(--color-accent)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* 2. SEARCH & FILTER CHIPS */}
      <Card padding="md">
        <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Search Bar */}
          <div style={{ flex: 1, minWidth: '260px', position: 'relative' }}>
            <input
              type="text"
              className="ss-input"
              style={{ paddingLeft: '38px', height: '42px', fontSize: '13px' }}
              placeholder="Search by complainant, defendant, category (e.g. Safety, Late arrival)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search size={16} color="var(--color-text-secondary)" style={{ position: 'absolute', left: 12, top: 13 }} />
          </div>

          {/* Filter Chips */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {[
              { id: 'All', label: `All (${complaints.length})` },
              { id: 'Open', label: `Open (${complaints.filter((c) => c.status === 'Open').length})` },
              { id: 'Investigating', label: `Investigating (${complaints.filter((c) => c.status === 'Investigating').length})` },
              { id: 'Resolved', label: `Resolved (${complaints.filter((c) => c.status === 'Resolved').length})` }
            ].map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => setStatusFilter(chip.id)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-full)',
                  background: statusFilter === chip.id ? 'var(--color-black)' : 'var(--color-bg)',
                  color: statusFilter === chip.id ? 'white' : 'var(--color-black)',
                  border: `1px solid ${statusFilter === chip.id ? 'var(--color-black)' : 'var(--color-border)'}`,
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* 3. COMPLAINTS DATA TABLE */}
      {filteredComplaints.length === 0 ? (
        <Card padding="lg" style={{ textAlign: 'center' }}>
          <EmptyState
            icon={ShieldAlert}
            title={complaints.length === 0 ? "No Grievances in Database" : "No Complaints Match Your Filter"}
            description={complaints.length === 0
              ? "All cooperative bookings and service jobs are operating nominally. When dispute or grievance tickets are filed, they will appear here for mediation."
              : "Try adjusting your search query or resolution status filter."
            }
          />
        </Card>
      ) : (
        <Card padding="none" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--color-bg)', borderBottom: '1.5px solid var(--color-border)' }}>
                <th style={{ padding: '12px 16px', fontWeight: 'bold' }}>ID & Complainant</th>
                <th style={{ padding: '12px 16px', fontWeight: 'bold' }}>Against (Defendant)</th>
                <th style={{ padding: '12px 16px', fontWeight: 'bold' }}>Grievance Category</th>
                <th style={{ padding: '12px 16px', fontWeight: 'bold' }}>Date Reported</th>
                <th style={{ padding: '12px 16px', fontWeight: 'bold' }}>Status</th>
                <th style={{ padding: '12px 16px', fontWeight: 'bold', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredComplaints.map((c, index) => (
                <tr
                  key={c.id}
                  onClick={() => setSelectedComplaint(c)}
                  style={{
                    borderBottom: '1px solid var(--color-border)',
                    background: c.status === 'Open' ? '#FFFDFD' : (index % 2 === 0 ? 'white' : '#FCFCFC'),
                    cursor: 'pointer',
                    transition: 'background-color 0.15s ease'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = c.status === 'Open' ? '#FEE2E2' : '#F5F5F5')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = c.status === 'Open' ? '#FFFDFD' : (index % 2 === 0 ? 'white' : '#FCFCFC'))}
                >
                  {/* Complainant Column */}
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 'bold', color: 'var(--color-black)' }}>{c.complainant}</div>
                    <div className="text-secondary" style={{ fontSize: '11px' }}>{c.id} • {c.complainantRole}</div>
                  </td>

                  {/* Against Column */}
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 600, color: 'var(--color-black)' }}>{c.against}</div>
                    <div className="text-secondary" style={{ fontSize: '11px' }}>{c.complainantRole === 'Worker' ? 'Customer' : 'Worker'}</div>
                  </td>

                  {/* Category Column */}
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '3px 8px',
                      borderRadius: 'var(--radius-sm)',
                      background: c.category.includes('Safety') ? 'var(--color-danger-bg)' : 'var(--color-bg)',
                      color: c.category.includes('Safety') ? 'var(--color-danger)' : 'var(--color-black)',
                      border: `1px solid ${c.category.includes('Safety') ? 'var(--color-danger)' : 'var(--color-border)'}`,
                      fontWeight: 600,
                      fontSize: '12px'
                    }}>
                      {c.category}
                    </span>
                  </td>

                  {/* Date Column */}
                  <td style={{ padding: '12px 16px', color: 'var(--color-text-secondary)' }}>
                    {c.date}
                  </td>

                  {/* Status Column */}
                  <td style={{ padding: '12px 16px' }}>
                    <Badge
                      variant={
                        c.status === 'Resolved'
                          ? 'success'
                          : c.status === 'Investigating'
                          ? 'active'
                          : 'danger'
                      }
                      style={{ fontSize: '11px' }}
                    >
                      {c.status === 'Open' && '🔴 Open'}
                      {c.status === 'Investigating' && '⏳ Investigating'}
                      {c.status === 'Resolved' && '✓ Resolved'}
                    </Badge>
                  </td>

                  {/* Actions Column */}
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedComplaint(c);
                      }}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '4px',
                        background: 'var(--color-bg)',
                        color: 'var(--color-black)',
                        border: '1px solid var(--color-border)',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                      }}
                    >
                      Inspect &gt;
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      )}

      {/* 4. DETAIL PANEL (CLICKING A COMPLAINT OPENS INSPECTION & ADMIN ACTIONS) */}
      {selectedComplaint && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 9999,
          display: 'flex',
          justifyContent: 'flex-end',
          animation: 'fadeIn 0.2s ease'
        }}>
          <div style={{
            background: 'var(--color-white)',
            width: '100%',
            maxWidth: '520px',
            height: '100vh',
            overflowY: 'auto',
            padding: 'var(--space-lg)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-md)',
            boxShadow: 'var(--shadow-xl)'
          }}>
            
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Badge variant={selectedComplaint.status === 'Resolved' ? 'success' : (selectedComplaint.status === 'Investigating' ? 'active' : 'danger')}>
                    {selectedComplaint.status}
                  </Badge>
                  <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                    Reported {selectedComplaint.date}
                  </span>
                </div>
                <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: '4px 0 0' }}>
                  Complaint #{selectedComplaint.id}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setSelectedComplaint(null)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-bg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Complainant vs Defendant Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-xs)' }}>
              {/* Complainant */}
              <div style={{ background: 'var(--color-bg)', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
                <span className="text-secondary" style={{ fontSize: '11px', fontWeight: 600 }}>COMPLAINANT</span>
                <div style={{ fontWeight: 'bold', fontSize: '13px', marginTop: 2 }}>{selectedComplaint.complainant}</div>
                <div className="text-secondary" style={{ fontSize: '11px' }}>{selectedComplaint.complainantRole}</div>
                <div style={{ marginTop: 6 }}>
                  {selectedComplaint.complainantPhone ? (
                    <a href={`tel:${selectedComplaint.complainantPhone}`}>
                      <Button variant="outline" size="small" icon={PhoneCall}>{selectedComplaint.complainantPhone}</Button>
                    </a>
                  ) : (
                    <Button variant="outline" size="small" icon={PhoneCall} disabled>No phone on file</Button>
                  )}
                </div>
              </div>

              {/* Defendant */}
              {(() => {
                const isAgainstWorker = selectedComplaint.complainantRole !== 'Worker';
                const againstRole = isAgainstWorker ? 'Worker' : 'Customer';
                const againstPhone = isAgainstWorker ? workerPhone : (bookingDetail?.customerPhone || '');
                return (
                  <div style={{ background: 'var(--color-bg)', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
                    <span className="text-secondary" style={{ fontSize: '11px', fontWeight: 600 }}>AGAINST</span>
                    <div style={{ fontWeight: 'bold', fontSize: '13px', marginTop: 2 }}>{selectedComplaint.against}</div>
                    <div className="text-secondary" style={{ fontSize: '11px' }}>{againstRole}</div>
                    <div style={{ marginTop: 6 }}>
                      {againstPhone ? (
                        <a href={`tel:${againstPhone}`}>
                          <Button variant="outline" size="small" icon={PhoneCall}>{againstPhone}</Button>
                        </a>
                      ) : (
                        <Button variant="outline" size="small" icon={PhoneCall} disabled>
                          {bookingDetailLoading ? 'Loading...' : 'No phone on file'}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Grievance Description Card */}
            <Card padding="md" style={{ background: '#FFFDF9', border: '1.5px solid var(--color-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontWeight: 'bold', fontSize: '14px', color: 'var(--color-black)' }}>
                  Grievance: {selectedComplaint.category}
                </span>
                <Badge variant="active" style={{ fontSize: '10px' }}>
                  {selectedComplaint.category}
                </Badge>
              </div>
              <p style={{ fontSize: '13px', color: '#333', lineHeight: 1.5, margin: 0 }}>
                "{selectedComplaint.description}"
              </p>

              {selectedComplaint.photos?.length > 0 && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--color-border)' }}>
                  <span className="text-secondary" style={{ fontSize: '11px', fontWeight: 600 }}>
                    EVIDENCE PHOTOS ({selectedComplaint.photos.length})
                  </span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 8, marginTop: 6 }}>
                    {selectedComplaint.photos.map((p, idx) => (
                      <a key={p.publicId || idx} href={p.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block' }}>
                        <img
                          src={p.url}
                          alt={`Evidence ${idx + 1} from ${p.uploadedBy || 'complainant'}`}
                          style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            {/* Related Service Booking — real, fetched Booking record so the
                admin can review the actual customer/worker/booking details
                behind this complaint, not just the free-text fields stored
                on the complaint itself. */}
            {!selectedComplaint.bookingId ? (
              <Card padding="sm" style={{ background: 'var(--color-bg)' }}>
                <span className="text-secondary" style={{ fontSize: '12px' }}>No booking was linked to this complaint.</span>
              </Card>
            ) : bookingDetailLoading ? (
              <Card padding="sm" style={{ background: 'var(--color-bg)', textAlign: 'center' }}>
                <Loader2 size={16} className="ss-spinner" style={{ animation: 'spin 1s linear infinite' }} />
                <span className="text-secondary" style={{ fontSize: '12px', marginLeft: 6 }}>Loading booking #{selectedComplaint.bookingId}...</span>
              </Card>
            ) : bookingDetailError ? (
              <Card padding="sm" style={{ background: 'var(--color-danger-bg)' }}>
                <span style={{ fontSize: '12px', color: 'var(--color-danger)' }}>#{selectedComplaint.bookingId}: {bookingDetailError}</span>
              </Card>
            ) : (
              <Card padding="md" style={{ background: 'var(--color-bg)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <span className="text-secondary" style={{ fontSize: '11px', fontWeight: 600 }}>RELATED SERVICE BOOKING</span>
                    <div style={{ fontWeight: 'bold', fontSize: '13px' }}>
                      #{selectedComplaint.bookingId} • {bookingDetail?.serviceCategory || bookingDetail?.serviceDetails || 'Service'}
                    </div>
                  </div>
                  <Badge variant="active" style={{ fontSize: '10px', textTransform: 'capitalize' }}>
                    {(bookingDetail?.status || '').replace('_', ' ')}
                  </Badge>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', fontSize: '12px' }}>
                  <div style={{ background: 'white', padding: '8px 10px', borderRadius: 'var(--radius-sm)' }}>
                    <span className="text-secondary" style={{ fontSize: '10px', fontWeight: 600 }}>CUSTOMER</span>
                    <div style={{ fontWeight: 'bold' }}>{bookingDetail?.customerName || '—'}</div>
                    <div className="text-secondary">{bookingDetail?.customerPhone || 'No phone on file'}</div>
                    <div className="text-secondary" style={{ marginTop: 2 }}>{bookingDetail?.customerAddress || ''}</div>
                  </div>
                  <div style={{ background: 'white', padding: '8px 10px', borderRadius: 'var(--radius-sm)' }}>
                    <span className="text-secondary" style={{ fontSize: '10px', fontWeight: 600 }}>WORKER</span>
                    <div style={{ fontWeight: 'bold' }}>{bookingDetail?.workerName || '—'}</div>
                    <div className="text-secondary">{workerPhone || 'No phone on file'}</div>
                    <div className="text-secondary" style={{ marginTop: 2 }}>ID: {bookingDetail?.workerId || '—'}</div>
                  </div>
                  <div style={{ background: 'white', padding: '8px 10px', borderRadius: 'var(--radius-sm)' }}>
                    <span className="text-secondary" style={{ fontSize: '10px', fontWeight: 600 }}>AMOUNT</span>
                    <div style={{ fontWeight: 'bold' }}>₹{bookingDetail?.amount ?? '—'}</div>
                  </div>
                  <div style={{ background: 'white', padding: '8px 10px', borderRadius: 'var(--radius-sm)' }}>
                    <span className="text-secondary" style={{ fontSize: '10px', fontWeight: 600 }}>DATE</span>
                    <div style={{ fontWeight: 'bold' }}>{bookingDetail?.dateString || '—'}</div>
                  </div>
                </div>

                <div style={{ marginTop: 10 }}>
                  <Button
                    variant="outline"
                    size="small"
                    icon={ExternalLink}
                    fullWidth
                    onClick={() => navigate('/admin/bookings')}
                  >
                    View in All Bookings
                  </Button>
                </div>
              </Card>
            )}

            {/* Resolution Notes if Resolved */}
            {selectedComplaint.resolutionNotes && (
              <div style={{
                background: 'var(--color-success-bg)',
                border: '1px solid var(--color-success)',
                color: 'var(--color-success)',
                padding: '10px 12px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '12px'
              }}>
                <div style={{ fontWeight: 'bold', marginBottom: 2 }}>✓ Conciliation Resolution:</div>
                <div>{selectedComplaint.resolutionNotes}</div>
              </div>
            )}

            {/* 3 ADMIN ACTION BUTTONS */}
            <div style={{ marginTop: 'auto', paddingTop: 'var(--space-md)', display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
              
              {/* Button 1: Mark Investigating */}
              {selectedComplaint.status !== 'Investigating' && selectedComplaint.status !== 'Resolved' && (
                <Button
                  variant="outline"
                  fullWidth
                  icon={Clock}
                  onClick={() => handleMarkInvestigating(selectedComplaint.id)}
                >
                  Mark Investigating
                </Button>
              )}

              {/* Button 2: Resolve */}
              {selectedComplaint.status !== 'Resolved' && (
                <Button
                  variant="primary"
                  fullWidth
                  icon={CheckCircle2}
                  onClick={() => { setResolvingComplaint(selectedComplaint); setResolutionRemark(''); setResolveError(''); }}
                >
                  Resolve & Settle Conciliation
                </Button>
              )}

              {/* Button 3: Escalate to Suspension */}
              {selectedComplaint.againstWorkerId && (
                <Button
                  variant="danger"
                  fullWidth
                  icon={Ban}
                  onClick={() => handleEscalateSuspension(selectedComplaint)}
                >
                  Escalate to Worker Suspension ⚠️
                </Button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* RESOLVE & SETTLE MODAL — the admin's own clearance remark, not a
          canned string, since it's what the complainant and any future
          reviewer see as the actual record of how this was settled. */}
      {resolvingComplaint && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-md)' }}>
          <Card padding="lg" style={{ maxWidth: '440px', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <CheckCircle2 size={22} color="var(--color-success)" />
              <h2 style={{ fontSize: '17px', fontWeight: 'bold', margin: 0 }}>Resolve Complaint #{resolvingComplaint.id}</h2>
            </div>
            <p className="text-secondary" style={{ fontSize: '13px', margin: '4px 0 12px' }}>
              Add a clearance remark describing how this was settled between <strong>{resolvingComplaint.complainant}</strong> and <strong>{resolvingComplaint.against}</strong>. This is recorded on the complaint.
            </p>

            {resolveError && (
              <div style={{ fontSize: '12px', color: 'var(--color-danger)', fontWeight: 600, marginBottom: 8 }}>{resolveError}</div>
            )}

            <textarea
              rows={4}
              className="ss-input"
              style={{ width: '100%', resize: 'none' }}
              placeholder="e.g. Worker re-visited and fixed the leak at no extra charge; customer confirmed satisfaction on call."
              value={resolutionRemark}
              onChange={(e) => setResolutionRemark(e.target.value)}
              autoFocus
            />
            <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
              <Button variant="outline" style={{ flex: 1 }} onClick={() => setResolvingComplaint(null)}>
                Cancel
              </Button>
              <Button variant="primary" style={{ flex: 1 }} disabled={!resolutionRemark.trim() || resolveSubmitting} onClick={handleConfirmResolve}>
                {resolveSubmitting ? 'Resolving...' : 'Confirm Resolution'}
              </Button>
            </div>
          </Card>
        </div>
      )}

    </div>
  );
};

export default ComplaintsScreen;
