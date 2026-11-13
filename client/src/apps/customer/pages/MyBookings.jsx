import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, CheckCircle2, AlertCircle, PhoneCall, ChevronRight, Navigation, Star, FileText, Loader2, Sparkles, X, Hourglass, Search, ShieldAlert } from 'lucide-react';
import { Button, Card, Badge, EmptyState } from '../../../components';
import { bookingsAPI, complaintsAPI } from '../../../api';
import { useCustomer } from '../context/CustomerContext';
import { useAuth } from '../../../context/AuthContext';
import CancelBookingModal from '../components/CancelBookingModal';

const COMPLAINT_CATEGORIES = [
  'Service Quality',
  'Worker Behavior',
  'Safety Concern',
  'Billing / Overcharge',
  'Late Arrival',
  'No Show',
  'Other'
];

// A worker is assigned and moving toward the job — tracking is meaningful.
const TRACKABLE_STATUSES = ['accepted', 'on_the_way', 'arrived', 'working', 'in_progress'];
// "In Progress" tab: still live, not yet resolved one way or the other.
// (A pending reschedule proposal is carried on booking.reschedule.status,
// not the top-level status, so it's already covered by whatever status the
// booking was in when the worker proposed it — usually 'pending'/'accepted'.)
// Anything not in this list (completed/paid/rated/cancelled/rejected) is
// resolved and falls into the "Past" tab.
const ACTIVE_STATUSES = ['pending', ...TRACKABLE_STATUSES];

export const MyBookings = () => {
  const navigate = useNavigate();
  const { user } = useCustomer();
  const { currentUser } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all' | 'active' | 'completed'
  const [cancelTarget, setCancelTarget] = useState(null); // bookingId currently in the cancel modal
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [cancelError, setCancelError] = useState('');

  // Booking ids this customer has already filed a complaint for, keyed to
  // the actual complaint (status, resolution notes, photos) — lets the
  // booking card both block a duplicate filing AND show the real status the
  // admin has set, instead of a static "filed" label.
  const [complaintsByBooking, setComplaintsByBooking] = useState({});
  const [complaintTarget, setComplaintTarget] = useState(null); // the booking object currently in the complaint modal
  const [complaintCategory, setComplaintCategory] = useState(COMPLAINT_CATEGORIES[0]);
  const [complaintDescription, setComplaintDescription] = useState('');
  const [complaintPhotos, setComplaintPhotos] = useState([]); // [{ file, previewUrl }]
  const [complaintSubmitting, setComplaintSubmitting] = useState(false);
  const [complaintError, setComplaintError] = useState('');
  const [complaintSuccess, setComplaintSuccess] = useState(false);
  const [viewingComplaint, setViewingComplaint] = useState(null); // complaint object shown read-only

  const MAX_COMPLAINT_PHOTOS = 3;

  const fetchMyComplaints = async () => {
    try {
      // Role-scoped server-side (see complaint.service.js#getComplaints) to
      // only the calling customer's own complaints — safe to fetch without
      // any extra filtering here.
      const res = await complaintsAPI.getAll();
      if (res.success && Array.isArray(res.data)) {
        const byBooking = {};
        res.data.forEach((c) => { if (c.bookingId) byBooking[c.bookingId] = c; });
        setComplaintsByBooking(byBooking);
      }
    } catch (err) {
      console.warn('Could not load existing complaints:', err.message);
    }
  };

  const fetchUserBookings = async () => {
    try {
      setLoading(true);
      const activePhone = currentUser?.phone || user?.contact || user?.phone;
      const activeId = currentUser?.userId || user?.userId;
      const activeName = currentUser?.name || user?.name;

      if (!activePhone && !activeId && !activeName) {
        setBookings([]);
        return;
      }

      const queryParams = {};
      if (activePhone) queryParams.customerPhone = activePhone;
      if (activeId) queryParams.customerId = activeId;
      if (activeName && !['Member', 'Customer'].includes(activeName)) queryParams.customerName = activeName;

      const res = await bookingsAPI.getAll(queryParams);
      if (res.success && Array.isArray(res.data)) {
        const mapped = res.data.map(b => ({
          id: b.bookingId || b._id,
          bookingId: b.bookingId || b._id,
          service: b.serviceCategory || b.serviceDetails || 'Cooperative Service',
          worker: b.workerName || 'Assigned Worker',
          workerId: b.workerId || '',
          rating: b.rating || 0,
          fee: `₹${b.amount || 450}`,
          date: b.dateString || 'Today',
          rejectionReason: b.rejectionReason || '',
          stage: ACTIVE_STATUSES.includes(b.status) ? 'active' : 'past',
          statusLabel: (b.status || 'pending').toUpperCase().replace('_', ' '),
          rawStatus: b.status
        }));
        setBookings(mapped);
      } else {
        setBookings([]);
      }
    } catch (err) {
      console.error('Error fetching customer bookings from MongoDB:', err);
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserBookings();
    fetchMyComplaints();
  }, [user?.contact, user?.phone, currentUser?.phone, currentUser?.userId]);

  const openComplaintModal = (booking) => {
    setComplaintTarget(booking);
    setComplaintCategory(COMPLAINT_CATEGORIES[0]);
    setComplaintDescription('');
    setComplaintPhotos([]);
    setComplaintError('');
    setComplaintSuccess(false);
  };

  const handleSelectComplaintPhotos = (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    setComplaintPhotos((prev) => {
      const room = MAX_COMPLAINT_PHOTOS - prev.length;
      return [...prev, ...files.slice(0, room).map((file) => ({ file, previewUrl: URL.createObjectURL(file) }))];
    });
  };

  const removeComplaintPhoto = (index) => {
    setComplaintPhotos((prev) => {
      URL.revokeObjectURL(prev[index].previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSubmitComplaint = async (e) => {
    e.preventDefault();
    if (!complaintTarget || !complaintDescription.trim()) return;
    setComplaintSubmitting(true);
    setComplaintError('');
    try {
      const res = await complaintsAPI.create({
        against: complaintTarget.worker,
        againstId: complaintTarget.workerId,
        category: complaintCategory,
        description: complaintDescription.trim(),
        bookingId: complaintTarget.bookingId
      });

      // The complaint exists at this point regardless of what happens next
      // — photo attachment is best-effort so a Cloudinary hiccup doesn't
      // make it look like the whole complaint failed to file.
      let finalComplaint = res.data;
      for (const { file } of complaintPhotos) {
        try {
          const uploadRes = await complaintsAPI.uploadPhoto(finalComplaint.complaintId, file);
          if (uploadRes.success && uploadRes.data) finalComplaint = uploadRes.data;
        } catch (uploadErr) {
          console.warn('Could not attach a complaint photo:', uploadErr.message);
        }
      }

      complaintPhotos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
      setComplaintsByBooking((prev) => ({ ...prev, [complaintTarget.bookingId]: finalComplaint }));
      setComplaintSuccess(true);
      setTimeout(() => setComplaintTarget(null), 1800);
    } catch (err) {
      setComplaintError(err.response?.data?.message || 'Could not file your complaint. Please try again.');
    } finally {
      setComplaintSubmitting(false);
    }
  };

  const handleConfirmCancel = async (reason) => {
    if (!cancelTarget) return;
    setCancelSubmitting(true);
    setCancelError('');
    try {
      const res = await bookingsAPI.cancel(cancelTarget, reason);
      if (res.success) {
        setCancelTarget(null);
        fetchUserBookings();
      }
    } catch (err) {
      setCancelError(err.response?.data?.message || 'Could not cancel this booking. Please try again.');
    } finally {
      setCancelSubmitting(false);
    }
  };

  const filteredBookings = bookings.filter((b) => {
    if (filter === 'active') return b.stage === 'active';
    if (filter === 'completed') return b.stage === 'past';
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', paddingBottom: 'var(--space-lg)' }}>
      <div>
        <h1 style={{ fontSize: '22px', fontWeight: 'bold' }}>My Bookings</h1>
        <p className="text-secondary" style={{ fontSize: '13px' }}>
          Customer: <strong>{user?.name || currentUser?.name || 'Customer'}</strong> • Live MongoDB Records
        </p>
      </div>

      {/* Filter Chips */}
      <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
        {[
          { id: 'all', label: `All Requests (${bookings.length})` },
          { id: 'active', label: `In Progress (${bookings.filter(b => b.stage === 'active').length})` },
          { id: 'completed', label: `Past Completed (${bookings.filter(b => b.stage === 'past').length})` }
        ].map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-full)',
              background: filter === f.id ? 'var(--color-black)' : 'var(--color-white)',
              color: filter === f.id ? 'var(--color-white)' : 'var(--color-black)',
              border: `1px solid ${filter === f.id ? 'var(--color-black)' : 'var(--color-border)'}`,
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 'var(--space-xl)', textAlign: 'center' }}>
          <Loader2 size={24} className="ss-spinner" style={{ animation: 'spin 1s linear infinite' }} />
          <p className="text-secondary" style={{ fontSize: '13px', marginTop: 8 }}>Loading your bookings from MongoDB...</p>
        </div>
      ) : filteredBookings.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No Bookings Found"
          description={
            filter === 'all'
              ? "You haven't made any service bookings yet. Browse our verified cooperative workers and book in seconds!"
              : `You have no ${filter === 'active' ? 'in-progress' : 'completed'} bookings.`
          }
          actionLabel="Find a Service"
          onAction={() => navigate('/customer/search')}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
          {filteredBookings.map((b) => {
            const isRejected = b.rawStatus === 'rejected';
            const isCancelled = b.rawStatus === 'cancelled';
            const isMuted = isRejected || isCancelled;
            const isTrackable = TRACKABLE_STATUSES.includes(b.rawStatus);
            const isPending = b.rawStatus === 'pending';
            const isRated = ['completed', 'paid', 'rated'].includes(b.rawStatus);

            return (
              <Card
                key={b.id}
                padding="md"
                className={isMuted ? 'wh-terminal-card' : ''}
                style={{
                  border: isRejected
                    ? '1px solid rgba(217, 48, 37, 0.18)'
                    : isCancelled
                      ? '1px solid var(--color-border)'
                      : isTrackable || isPending
                        ? '1.5px solid var(--color-accent)'
                        : undefined
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <Badge variant={isRated ? 'success' : isRejected ? 'danger' : isCancelled ? 'neutral' : 'active'} style={{ marginBottom: 6 }}>
                      {b.statusLabel}
                    </Badge>
                    <h3 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--color-black)', margin: '2px 0' }}>{b.service}</h3>
                    <div style={{ color: 'var(--color-text-secondary)', fontSize: '13px', fontWeight: 500 }}>
                      Worker: <strong>{b.worker}</strong>
                    </div>
                    {isRejected && b.rejectionReason && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '13px', color: 'var(--color-danger)', fontWeight: 600, marginTop: 4 }}>
                        <AlertCircle size={13} />
                        Declined: {b.rejectionReason}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '19px', fontWeight: 800, color: 'var(--color-black)' }}>{b.fee}</div>
                    <div style={{ color: '#A3A3A3', fontSize: '12px', marginTop: 2 }}>{b.date}</div>
                  </div>
                </div>

                <div style={{ marginTop: 'var(--space-sm)', display: 'flex', gap: 'var(--space-xs)' }}>
                  {isTrackable && (
                    <>
                      <Button
                        variant="primary"
                        size="small"
                        icon={Navigation}
                        fullWidth
                        onClick={() => navigate(`/customer/tracking/${b.bookingId || b.id}?workerId=${b.workerId}`)}
                      >
                        Track Live Arrival
                      </Button>
                      <Button
                        variant="outline"
                        size="small"
                        icon={X}
                        onClick={() => { setCancelTarget(b.bookingId || b.id); setCancelError(''); }}
                        style={{ color: '#DC2626', borderColor: '#DC2626' }}
                      >
                        Cancel
                      </Button>
                    </>
                  )}

                  {isPending && (
                    <>
                      <Button variant="outline" size="small" icon={Hourglass} fullWidth disabled>
                        Waiting for Worker
                      </Button>
                      <Button
                        variant="outline"
                        size="small"
                        icon={X}
                        onClick={() => { setCancelTarget(b.bookingId || b.id); setCancelError(''); }}
                        style={{ color: '#DC2626', borderColor: '#DC2626' }}
                      >
                        Cancel Request
                      </Button>
                    </>
                  )}

                  {isRejected && (
                    <Button
                      variant="soft"
                      size="small"
                      icon={Search}
                      fullWidth
                      onClick={() => navigate(`/customer/search${b.service ? `?category=${encodeURIComponent(b.service)}` : ''}`)}
                    >
                      Find Another Worker
                    </Button>
                  )}

                  {isCancelled && (
                    <Button
                      variant="soft"
                      size="small"
                      icon={Calendar}
                      fullWidth
                      onClick={() => navigate(`/customer/search${b.service ? `?category=${encodeURIComponent(b.service)}` : ''}`)}
                    >
                      Book Again
                    </Button>
                  )}

                  {isRated && (() => {
                    const existingComplaint = complaintsByBooking[b.bookingId || b.id];
                    const COMPLAINT_STATUS_META = {
                      Open: { label: 'Complaint: Open', color: 'var(--color-danger)' },
                      Investigating: { label: 'Complaint: Investigating', color: '#D97706' },
                      Resolved: { label: 'Complaint: Resolved', color: 'var(--color-success)' }
                    };
                    const statusMeta = existingComplaint ? COMPLAINT_STATUS_META[existingComplaint.status] : null;
                    return (
                      <>
                        <Button
                          variant="outline"
                          size="small"
                          icon={Star}
                          fullWidth
                          onClick={() => navigate(`/customer/rating/${b.bookingId || b.id}`)}
                        >
                          {b.rating > 0 ? `Rated ${b.rating} ⭐` : 'Rate Service'}
                        </Button>
                        <Button
                          variant="outline"
                          size="small"
                          icon={ShieldAlert}
                          fullWidth
                          onClick={() => (existingComplaint ? setViewingComplaint(existingComplaint) : openComplaintModal(b))}
                          style={statusMeta ? { color: statusMeta.color, borderColor: statusMeta.color } : { color: '#DC2626', borderColor: '#DC2626' }}
                        >
                          {statusMeta ? statusMeta.label : 'Complain'}
                        </Button>
                      </>
                    );
                  })()}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <CancelBookingModal
        isOpen={Boolean(cancelTarget)}
        onClose={() => { setCancelTarget(null); setCancelError(''); }}
        onConfirm={handleConfirmCancel}
        isSubmitting={cancelSubmitting}
        error={cancelError}
      />

      {/* COMPLAINT MODAL — files a grievance tied to this booking so the
          admin can review it alongside the real customer/worker/booking
          details (see ComplaintsScreen.jsx on the admin side). */}
      {complaintTarget && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(3px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <Card padding="lg" style={{ maxWidth: '420px', width: '100%', background: 'white' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-sm)' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                <ShieldAlert size={18} color="#DC2626" />
                <span>File a Complaint</span>
              </h3>
              <button type="button" onClick={() => setComplaintTarget(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <p className="text-secondary" style={{ fontSize: '13px', margin: '0 0 var(--space-sm)' }}>
              About your <strong>{complaintTarget.service}</strong> booking with <strong>{complaintTarget.worker}</strong>. This is sent to the cooperative admin for review.
            </p>

            {complaintSuccess ? (
              <div style={{ background: '#F0FDF4', border: '1px solid #22C55E', borderRadius: 'var(--radius-sm)', padding: '12px', color: '#15803D', fontSize: '13px', fontWeight: 600 }}>
                ✓ Complaint filed. The admin team will review it shortly.
              </div>
            ) : (
              <form onSubmit={handleSubmitComplaint} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                {complaintError && (
                  <div style={{ fontSize: '12px', color: 'var(--color-danger)', fontWeight: 600 }}>{complaintError}</div>
                )}

                <div className="ss-form-group">
                  <label className="ss-label">Category:</label>
                  <select
                    className="ss-input"
                    value={complaintCategory}
                    onChange={(e) => setComplaintCategory(e.target.value)}
                  >
                    {COMPLAINT_CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>

                <div className="ss-form-group" style={{ marginBottom: 0 }}>
                  <label className="ss-label">What happened?</label>
                  <textarea
                    rows={4}
                    required
                    className="ss-input"
                    value={complaintDescription}
                    onChange={(e) => setComplaintDescription(e.target.value)}
                    placeholder="Describe the issue with this booking..."
                  />
                </div>

                <div className="ss-form-group" style={{ marginBottom: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <label className="ss-label" style={{ margin: 0 }}>Photos (optional):</label>
                    {complaintPhotos.length < MAX_COMPLAINT_PHOTOS && (
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '12px', fontWeight: 700, color: 'var(--color-accent)', cursor: 'pointer' }}>
                        + Add Photo
                        <input type="file" accept="image/*" multiple hidden onChange={handleSelectComplaintPhotos} />
                      </label>
                    )}
                  </div>

                  {complaintPhotos.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: 6 }}>
                      {complaintPhotos.map((p, idx) => (
                        <div key={idx} style={{ position: 'relative' }}>
                          <img src={p.previewUrl} alt={`Attachment ${idx + 1}`} style={{ width: '100%', height: 70, objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }} />
                          <button
                            type="button"
                            onClick={() => removeComplaintPhoto(idx)}
                            aria-label="Remove photo"
                            style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', background: 'var(--color-black)', color: 'white', border: '2px solid white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', lineHeight: 1 }}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-xs)', marginTop: 8 }}>
                  <Button type="button" variant="outline" fullWidth onClick={() => setComplaintTarget(null)}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" fullWidth disabled={complaintSubmitting || !complaintDescription.trim()}>
                    {complaintSubmitting ? 'Submitting...' : 'Submit Complaint'}
                  </Button>
                </div>
              </form>
            )}
          </Card>
        </div>
      )}

      {/* VIEW COMPLAINT STATUS MODAL — read-only view of a complaint the
          customer already filed, so they can check where it stands without
          leaving /customer/bookings. */}
      {viewingComplaint && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(3px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <Card padding="lg" style={{ maxWidth: '420px', width: '100%', background: 'white' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-sm)' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>Complaint #{viewingComplaint.complaintId}</h3>
              <button type="button" onClick={() => setViewingComplaint(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <Badge
              variant={viewingComplaint.status === 'Resolved' ? 'success' : viewingComplaint.status === 'Investigating' ? 'active' : 'danger'}
              style={{ marginBottom: 'var(--space-sm)' }}
            >
              {viewingComplaint.status}
            </Badge>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '13px' }}>
              <div>
                <span className="text-secondary" style={{ fontSize: '11px', fontWeight: 600 }}>CATEGORY</span>
                <div>{viewingComplaint.category}</div>
              </div>
              <div>
                <span className="text-secondary" style={{ fontSize: '11px', fontWeight: 600 }}>WHAT YOU REPORTED</span>
                <div>"{viewingComplaint.description}"</div>
              </div>

              {viewingComplaint.photos?.length > 0 && (
                <div>
                  <span className="text-secondary" style={{ fontSize: '11px', fontWeight: 600 }}>PHOTOS ATTACHED</span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: 6, marginTop: 4 }}>
                    {viewingComplaint.photos.map((p, idx) => (
                      <a key={p.publicId || idx} href={p.url} target="_blank" rel="noopener noreferrer">
                        <img src={p.url} alt={`Evidence ${idx + 1}`} style={{ width: '100%', height: 70, objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }} />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {viewingComplaint.status === 'Resolved' ? (
                <div style={{ background: '#F0FDF4', border: '1px solid #22C55E', borderRadius: 'var(--radius-sm)', padding: '10px 12px', color: '#15803D' }}>
                  <div style={{ fontWeight: 'bold', marginBottom: 2, fontSize: '12px' }}>✓ Admin's Resolution:</div>
                  <div style={{ fontSize: '12px' }}>{viewingComplaint.resolutionNotes || 'No remark was recorded.'}</div>
                </div>
              ) : (
                <div style={{ background: 'var(--color-bg)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                  Still under cooperative admin review — check back here for updates.
                </div>
              )}
            </div>

            <div style={{ marginTop: 'var(--space-md)' }}>
              <Button variant="outline" fullWidth onClick={() => setViewingComplaint(null)}>
                Close
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default MyBookings;
