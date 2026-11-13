import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Phone,
  MessageSquare,
  MapPin,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Navigation,
  Check,
  X,
  Send,
  CreditCard,
  Sparkles,
  Zap,
  PhoneCall,
  Loader2
} from 'lucide-react';
import { Button, Card, Badge } from '../../../components';
import { workersAPI, bookingsAPI } from '../../../api';
import TrackingMap from '../components/TrackingMap';
import CancelBookingModal from '../components/CancelBookingModal';

export const BookingTracking = () => {
  const { bookingId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [liveBooking, setLiveBooking] = useState(null);
  const [rescheduleActionLoading, setRescheduleActionLoading] = useState(false);
  const [selectedSlotStart, setSelectedSlotStart] = useState('');
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [cancelError, setCancelError] = useState('');

  // Fetch live booking document from MongoDB
  useEffect(() => {
    if (!bookingId) return;

    let isMounted = true;
    let pollInterval = null;

    const fetchBooking = async () => {
      try {
        const res = await bookingsAPI.getById(bookingId);
        if (res.success && res.data && isMounted) {
          setLiveBooking(res.data);
          // If terminal status reached, stop aggressive polling
          if (['completed', 'rated', 'cancelled'].includes(res.data.status)) {
            if (pollInterval) {
              clearInterval(pollInterval);
              pollInterval = null;
            }
          }
        }
      } catch (err) {
        console.warn('Booking tracking fetch error:', err.message);
      }
    };

    fetchBooking();
    pollInterval = setInterval(fetchBooking, 3000);
    return () => {
      isMounted = false;
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [bookingId]);

  const targetWorkerId = liveBooking?.workerId || searchParams.get('workerId');
  const isEmergency = searchParams.get('emergency') === 'true' || liveBooking?.isEmergency;

  const [worker, setWorker] = useState({
    id: targetWorkerId || '',
    name: liveBooking?.workerName || 'Cooperative Worker',
    phone: liveBooking?.workerPhone || 'Direct Line via Desk',
    skill: liveBooking?.serviceCategory || 'Cooperative Service',
    badge: 'Verified Cooperative Worker',
    rating: 5.0,
    reviewsCount: 0,
    avatar: 'CW'
  });

  useEffect(() => {
    if (targetWorkerId) {
      workersAPI.getById(targetWorkerId).then(res => {
        if (res.success && res.data) {
          setWorker({
            id: res.data.workerId || res.data._id,
            name: res.data.name,
            phone: res.data.phone || 'Direct Line via Desk',
            skill: res.data.skill,
            badge: res.data.badge || 'Verified Cooperative Worker',
            rating: res.data.rating || 5.0,
            reviewsCount: res.data.reviewsCount || 0,
            avatar: res.data.avatar || 'CW'
          });
        }
      }).catch(() => {});
    }
  }, [targetWorkerId]);

  // Dynamic Customer Location and Arrival PIN — sourced only from the live,
  // polled MongoDB record. Before the first fetch resolves these show a
  // loading placeholder rather than a fabricated address/PIN.
  const customerAddress = liveBooking?.customerAddress || 'Loading address…';
  const arrivalPin = liveBooking?.arrivalPin || '----';

  // Derive statusIndex from the live MongoDB document only
  const rawStatus = liveBooking?.status || 'pending';
  const isPending = rawStatus === 'pending';

  const getDerivedStatusIndex = () => {
    if (rawStatus === 'pending') return 0;
    if (rawStatus === 'accepted') return 1;
    if (rawStatus === 'on_the_way') return 2;
    if (rawStatus === 'arrived') return 3;
    if (rawStatus === 'working' || rawStatus === 'in_progress') return 4;
    if (rawStatus === 'completed' || rawStatus === 'paid' || rawStatus === 'rated') return 5;
    return 0; // Fresh booking starts at step 0 (Pending Acceptance)
  };

  // Status is driven entirely by the live, polled MongoDB record — no local
  // "simulate next step" override. A previous version of this screen let the
  // customer manually fast-forward the timeline independent of the real
  // booking status, which desynced the UI from reality (e.g. showing
  // "Completed" while the backend still had the booking at "pending").
  const statusIndex = getDerivedStatusIndex();
  const isSharingLocation = liveBooking ? (liveBooking.isLocationSharing ?? true) : true;
  const reschedule = liveBooking?.reschedule;
  const hasPendingReschedule = reschedule?.status === 'pending';
  // Terminal, non-active booking: the live tracking UI (map, PIN, stepper,
  // payment CTA) would be misleading here, so it's replaced by the
  // rejected/cancelled notification card rendered above instead.
  const isDeadBooking = rawStatus === 'rejected' || rawStatus === 'cancelled';

  // Selectable 2-hour slots inside the worker's proposed window, at 30-min
  // increments, so the customer picks an exact start time instead of just
  // accepting the whole (potentially multi-hour) window verbatim.
  const RESCHEDULE_SLOT_MS = 2 * 3600000;
  const rescheduleSlotOptions = (() => {
    if (!reschedule?.windowStart || !reschedule?.windowEnd) return [];
    const windowStart = new Date(reschedule.windowStart).getTime();
    const windowEnd = new Date(reschedule.windowEnd).getTime();
    const options = [];
    for (let start = windowStart; start + RESCHEDULE_SLOT_MS <= windowEnd; start += 30 * 60000) {
      options.push(start);
    }
    return options;
  })();


  // Mock Chat Modal State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    {
      id: 1,
      sender: 'worker',
      text: isEmergency
        ? 'Namaste! Received your priority emergency request. On my vehicle right now, arriving in 10-12 mins.'
        : 'Namaste! I have picked up the spare switches and fuse from the Adyar depot.',
      time: '4:18 PM'
    },
    {
      id: 2,
      sender: 'worker',
      text: isEmergency
        ? 'Please turn off the main switch breaker if there is severe sparking.'
        : 'I am on my two-wheeler now, reaching your apartment in about 15-18 mins.',
      time: '4:20 PM'
    }
  ]);

  const [newMsg, setNewMsg] = useState('');

  const statusSteps = [
    {
      id: 'pending',
      title: 'Pending Worker Acceptance',
      desc: 'Dispatched to nearby cooperative workers • Awaiting acceptance',
      etaText: 'Awaiting Acceptance'
    },
    {
      id: 'accepted',
      title: 'Booking Accepted',
      desc: 'Worker confirmed and is preparing tools & parts',
      etaText: 'Accepted ✓'
    },
    {
      id: 'on_the_way',
      title: 'On the way',
      desc: 'Worker is traveling to your location with GPS route',
      etaText: 'ETA: 12 min'
    },
    {
      id: 'arrived',
      title: 'Arrived at Gate',
      desc: 'Worker reached your gate / entrance',
      etaText: 'Verify PIN'
    },
    {
      id: 'work_started',
      title: 'Work Started',
      desc: 'Active service execution in progress',
      etaText: 'In Progress'
    },
    {
      id: 'completed',
      title: 'Completed',
      desc: 'Work finished & verified by you',
      etaText: 'Ready for payment'
    }
  ];

  // When status reaches completed, auto-route option or proceed button
  useEffect(() => {
    if (statusIndex === 5) {
      const timer = setTimeout(() => {
        // Optional subtle prompt or keep user in control
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [statusIndex, navigate, bookingId, worker.id]);

  // Default the slot picker to the earliest available slot once a reschedule
  // proposal (with its window) arrives.
  useEffect(() => {
    if (rescheduleSlotOptions.length > 0 && !selectedSlotStart) {
      setSelectedSlotStart(String(rescheduleSlotOptions[0]));
    }
  }, [rescheduleSlotOptions, selectedSlotStart]);

  const handleRescheduleResponse = async (action) => {
    if (!bookingId) return;
    if (action === 'accept' && !selectedSlotStart) return;
    setRescheduleActionLoading(true);
    try {
      const res = await bookingsAPI.respondToReschedule(
        bookingId,
        action,
        action === 'accept' ? new Date(Number(selectedSlotStart)).toISOString() : undefined
      );
      if (res.success && res.data) setLiveBooking(res.data);
    } catch (err) {
      console.warn('Reschedule response error:', err.message);
    } finally {
      setRescheduleActionLoading(false);
    }
  };

  const handleAttachPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !bookingId) return;
    setPhotoError('');
    setPhotoUploading(true);
    try {
      const res = await bookingsAPI.uploadPhoto(bookingId, file);
      if (res.success && res.data) setLiveBooking(res.data);
    } catch (err) {
      setPhotoError(err.response?.data?.message || 'Could not upload photo. Please try again.');
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleSendChat = (e) => {
    if (e) e.preventDefault();
    if (!newMsg.trim()) return;

    const userMessage = {
      id: Date.now(),
      sender: 'user',
      text: newMsg.trim(),
      time: 'Just now'
    };

    setChatMessages((prev) => [...prev, userMessage]);
    setNewMsg('');

    // Simulate worker quick reply
    setTimeout(() => {
      setChatMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'worker',
          text: 'Got it! See you shortly.',
          time: 'Just now'
        }
      ]);
    }, 1200);
  };

  const handleProceedToPayment = () => {
    navigate(`/customer/payment-checkout/${bookingId}?workerId=${worker.id}`);
  };

  const handleConfirmCancel = async (reason) => {
    if (!bookingId) return;
    setCancelSubmitting(true);
    setCancelError('');
    try {
      const res = await bookingsAPI.cancel(bookingId, reason);
      if (res.success && res.data) {
        setLiveBooking(res.data);
        setIsCancelModalOpen(false);
      }
    } catch (err) {
      setCancelError(err.response?.data?.message || 'Could not cancel this booking. Please try again.');
    } finally {
      setCancelSubmitting(false);
    }
  };

  // Same cancellable window the backend enforces (BookingService.CANCELLABLE_STATUSES).
  const isCancellable = ['pending', 'accepted', 'on_the_way', 'arrived', 'working', 'in_progress'].includes(rawStatus);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', paddingBottom: 'var(--space-xl)' }}>
      
      {/* 1. TOP HEADER & PROTOTYPE STEP SIMULATOR CONTROLS */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
          <button
            type="button"
            onClick={() => navigate('/customer/home')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 38,
              height: 38,
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)',
              background: 'var(--color-white)',
              cursor: 'pointer'
            }}
            aria-label="Back to Home"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 'bold' }}>Job Live Status</h1>
            <p className="text-secondary" style={{ fontSize: '12px' }}>
              Booking ID: #{bookingId}
            </p>
          </div>
        </div>

        {isCancellable && (
          <Button
            variant="outline"
            size="small"
            icon={X}
            onClick={() => setIsCancelModalOpen(true)}
            style={{ color: '#DC2626', borderColor: '#DC2626' }}
          >
            Cancel Booking
          </Button>
        )}
      </div>

      {/* WORKER-PROPOSED RESCHEDULE: Accept New Time or Cancel Booking */}
      {hasPendingReschedule && (
        <Card padding="md" style={{ border: '1.5px solid #F59E0B', background: '#FFFBEB' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <Clock size={20} color="#D97706" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#92400E' }}>
                Worker Proposed a New Time
              </div>
              <div style={{ fontSize: '13px', color: '#78350F', marginTop: 2 }}>
                {worker.name} is free{' '}
                <strong>
                  {reschedule.windowStart && reschedule.windowEnd
                    ? `${new Date(reschedule.windowStart).toLocaleDateString('en-IN', { dateStyle: 'medium' })}, ${new Date(reschedule.windowStart).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}–${new Date(reschedule.windowEnd).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}`
                    : 'at a new time'}
                </strong>
                {reschedule.reason ? ` — "${reschedule.reason}"` : ''}
              </div>
              {rescheduleSlotOptions.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <label className="ss-label" style={{ display: 'block', marginBottom: 4, color: '#78350F' }}>
                    Pick a 2-hour slot within that window
                  </label>
                  <select
                    className="ss-input"
                    value={selectedSlotStart}
                    onChange={(e) => setSelectedSlotStart(e.target.value)}
                    style={{ width: '100%' }}
                  >
                    {rescheduleSlotOptions.map((start) => (
                      <option key={start} value={start}>
                        {new Date(start).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })} – {new Date(start + RESCHEDULE_SLOT_MS).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <Button
                  variant="primary"
                  size="small"
                  disabled={rescheduleActionLoading || !selectedSlotStart}
                  onClick={() => handleRescheduleResponse('accept')}
                >
                  Accept New Time
                </Button>
                <Button
                  variant="outline"
                  size="small"
                  disabled={rescheduleActionLoading}
                  onClick={() => handleRescheduleResponse('cancel')}
                >
                  Cancel Booking
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* WORKER REJECTED / BOOKING CANCELLED: notify customer, offer re-book */}
      {(rawStatus === 'rejected' || rawStatus === 'cancelled') && (
        <Card padding="md" style={{ border: '1.5px solid #DC2626', background: '#FEF2F2' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <X size={20} color="#DC2626" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#991B1B' }}>
                {rawStatus === 'rejected' ? 'Rejected by Worker' : 'Booking Cancelled'}
              </div>
              <div style={{ fontSize: '13px', color: '#7F1D1D', marginTop: 2 }}>
                {rawStatus === 'rejected'
                  ? `${worker.name} declined this request${liveBooking?.rejectionReason ? ` — "${liveBooking.rejectionReason}"` : ''}. You can rebook with another worker.`
                  : 'This booking was cancelled.'}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <Button
                  variant="primary"
                  size="small"
                  onClick={() => navigate(`/customer/search${liveBooking?.serviceCategory ? `?category=${encodeURIComponent(liveBooking.serviceCategory)}` : ''}`)}
                >
                  Find Another Worker
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {!isDeadBooking && <>
      {/* 2. TOP WORKER / PENDING STATUS CARD */}
      <Card padding="md" style={{
        border: isPending ? '1.5px solid #F59E0B' : '1px solid var(--color-border)',
        background: isPending ? '#FFFBEB' : 'var(--color-white)'
      }}>
        {isPending ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'center' }}>
                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: 'var(--radius-md)',
                  background: '#FEF3C7',
                  color: '#D97706',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '22px',
                  fontWeight: 'bold',
                  flexShrink: 0
                }}>
                  ⏳
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0, color: '#92400E' }}>
                      Dispatching to Verified Workers
                    </h3>
                  </div>
                  <div style={{ fontSize: '12px', color: '#B45309', marginTop: 2 }}>
                    Awaiting worker acceptance • Live route starts upon acceptance
                  </div>
                </div>
              </div>

              <span style={{
                background: '#FEF3C7',
                border: '1px solid #F59E0B',
                color: '#92400E',
                fontSize: '11px',
                fontWeight: 800,
                padding: '4px 10px',
                borderRadius: 'var(--radius-full)'
              }}>
                ⏳ Pending Acceptance
              </span>
            </div>

            <div style={{ fontSize: '12px', color: '#78350F', borderTop: '1px solid #FDE68A', paddingTop: 8 }}>
              Your service request for <strong>{liveBooking?.serviceCategory || worker.skill || 'Services'}</strong> has been sent to cooperative helpers in your area. Once accepted, worker details will update automatically.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'center' }}>
              <div style={{
                width: 52,
                height: 52,
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-black)',
                color: 'var(--color-white)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                fontWeight: 'bold',
                flexShrink: 0
              }}>
                {worker.avatar}
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <h3 style={{ fontSize: '17px', fontWeight: 'bold', margin: 0 }}>
                    {worker.name}
                  </h3>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--color-success)', fontSize: '12px', fontWeight: 600, marginTop: 2 }}>
                  <CheckCircle2 size={13} />
                  <span>✓ Verified Helper (Accepted)</span>
                </div>
                <div className="text-secondary" style={{ fontSize: '12px' }}>
                  {worker.skill} • ⭐ {worker.rating}
                </div>
              </div>
            </div>

            {/* Call and Chat Icon Buttons */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <a
                href={`tel:${worker.phone || '+919840111223'}`}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--color-bg)',
                  border: '1px solid var(--color-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-black)',
                  cursor: 'pointer'
                }}
                title="Call Helper"
                aria-label="Call Helper"
              >
                <PhoneCall size={20} />
              </a>

              <button
                type="button"
                onClick={() => setIsChatOpen(true)}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--color-accent-subtle)',
                  border: '1px solid rgba(255, 106, 0, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-accent)',
                  cursor: 'pointer'
                }}
                title="Open Chat"
                aria-label="Chat with Worker"
              >
                <MessageSquare size={20} />
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* 3. CUSTOMER PIN LOCATION & ARRIVAL VERIFICATION CARD */}
      <Card padding="md" style={{ border: '1.5px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-sm)' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: 'rgba(217, 48, 37, 0.12)',
              color: '#D93025',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <MapPin size={22} />
            </div>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                📍 Customer Pinned Service Location
              </div>
              <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--color-black)', marginTop: 2 }}>
                {customerAddress}
              </div>
              <div className="text-secondary" style={{ fontSize: '11px', marginTop: 2 }}>
                Worker navigation route is mapped to this exact address
              </div>
            </div>
          </div>

          {/* 4-Digit Arrival Security PIN */}
          <div style={{
            background: '#FFF7ED',
            border: '1.5px solid #FDBA74',
            borderRadius: 'var(--radius-md)',
            padding: '8px 14px',
            textAlign: 'center',
            flexShrink: 0
          }}>
            <span style={{ fontSize: '10px', fontWeight: 800, color: '#9A3412', display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Arrival PIN
            </span>
            <span style={{ fontSize: '18px', fontWeight: 900, color: '#EA580C', letterSpacing: '2px' }}>
              {arrivalPin}
            </span>
          </div>
        </div>
      </Card>

      {/* 3B. ISSUE PHOTOS: ATTACH & VIEW, SYNCED VIA CLOUDINARY TO WORKER VIEW TOO */}
      <Card padding="md">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-sm)' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 'bold', margin: 0 }}>Issue Photos</h3>
          <label style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: '12px',
            fontWeight: 700,
            color: 'var(--color-accent)',
            cursor: photoUploading ? 'not-allowed' : 'pointer'
          }}>
            {photoUploading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : '+ Add Photo'}
            <input type="file" accept="image/*" hidden disabled={photoUploading} onChange={handleAttachPhoto} />
          </label>
        </div>

        {photoError && (
          <div style={{ fontSize: '12px', color: 'var(--color-danger)', marginBottom: 8 }}>{photoError}</div>
        )}

        {(liveBooking?.photos?.length || 0) === 0 ? (
          <p className="text-secondary" style={{ fontSize: '12px', margin: 0 }}>
            No photos attached yet. Add a photo of the issue so {worker.name} can prepare the right tools.
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 8 }}>
            {liveBooking.photos.map((p, idx) => (
              <a key={p.publicId || idx} href={p.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block' }}>
                <img
                  src={p.url}
                  alt={`Issue evidence ${idx + 1}`}
                  style={{ width: '100%', height: '90px', objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}
                />
              </a>
            ))}
          </div>
        )}
      </Card>

      {/* 4. REAL TRACKING MAP COMPONENT (ANIMATED LIVE GPS & TRANSPARENT PRIVACY NOTICE) */}
      <TrackingMap
        workerName={worker.name}
        workerCategory={worker.skill || 'Plumbing'}
        statusIndex={statusIndex}
        isSharingLocation={isSharingLocation}
        customerZone={customerAddress}
        destination={liveBooking?.location?.lat ? liveBooking.location : null}
        isPending={isPending}
      />


      {/* 4. VERTICAL STATUS TRACKER (5 STEPS) */}
      <Card padding="md">
        <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: 'var(--space-md)' }}>
          Service Timeline
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
          
          {statusSteps.map((stepItem, index) => {
            const isCompleted = index < statusIndex;
            const isCurrent = index === statusIndex;
            const isPending = index > statusIndex;

            return (
              <div
                key={stepItem.id}
                style={{
                  display: 'flex',
                  gap: 'var(--space-md)',
                  alignItems: 'flex-start',
                  position: 'relative',
                  paddingBottom: index < statusSteps.length - 1 ? 'var(--space-lg)' : '4px'
                }}
              >
                {/* Connecting Line */}
                {index < statusSteps.length - 1 && (
                  <div style={{
                    position: 'absolute',
                    left: '13px',
                    top: '28px',
                    bottom: 0,
                    width: 2,
                    background: isCompleted ? 'var(--color-success)' : '#E0E0E0'
                  }} />
                )}

                {/* Status Dot / Icon */}
                <div style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  zIndex: 2,
                  background: isCompleted
                    ? 'var(--color-success)'
                    : isCurrent
                      ? 'var(--color-accent)'
                      : 'var(--color-bg)',
                  color: isCompleted || isCurrent ? 'var(--color-white)' : 'var(--color-text-secondary)',
                  border: isPending ? '1.5px solid var(--color-border)' : 'none',
                  boxShadow: isCurrent ? '0 0 0 4px var(--color-accent-subtle)' : 'none',
                  transition: 'all 0.25s ease'
                }}>
                  {isCompleted ? (
                    <Check size={16} strokeWidth={2.5} />
                  ) : isCurrent ? (
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'white' }} />
                  ) : (
                    <span style={{ fontSize: '11px', fontWeight: 'bold' }}>{index + 1}</span>
                  )}
                </div>

                {/* Text Details & ETA Highlight */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{
                      fontWeight: isCurrent ? 'bold' : isCompleted ? 600 : 500,
                      fontSize: '15px',
                      color: isCurrent ? 'var(--color-black)' : isCompleted ? 'var(--color-black)' : 'var(--color-text-secondary)'
                    }}>
                      {stepItem.title}
                    </span>

                    {/* ETA or Status Highlight */}
                    {isCurrent && (
                      <span style={{
                        background: 'var(--color-accent-subtle)',
                        color: 'var(--color-accent)',
                        fontWeight: 'bold',
                        fontSize: '12px',
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-full)'
                      }}>
                        {stepItem.etaText}
                      </span>
                    )}

                    {isCompleted && (
                      <span style={{ color: 'var(--color-success)', fontSize: '12px', fontWeight: 600 }}>
                        ✓ Done
                      </span>
                    )}
                  </div>

                  <p className="text-secondary" style={{ fontSize: '12px', marginTop: 2 }}>
                    {stepItem.desc}
                  </p>
                </div>
              </div>
            );
          })}

        </div>
      </Card>

      {/* 5. ARRIVAL PIN & VERIFICATION HELPER (WHEN ARRIVED OR ON THE WAY) */}
      {statusIndex <= 3 && (
        <div style={{
          background: 'var(--color-bg)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-md)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
              SECURITY ARRIVAL PIN
            </div>
            <div style={{ fontSize: '13px', color: 'var(--color-black)', marginTop: 2 }}>
              Share this 4-digit code when worker arrives
            </div>
          </div>
          <div style={{
            fontSize: '22px',
            fontWeight: 'bold',
            color: 'var(--color-accent)',
            letterSpacing: '2px',
            background: 'var(--color-white)',
            padding: '4px 12px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-border)'
          }}>
            {arrivalPin}
          </div>
        </div>
      )}

      {/* 6. COMPLETED STATE -> PROCEED TO PAYMENT BUTTON */}
      {statusIndex === 5 && (
        <Card padding="lg" style={{ background: '#F9FFF9', border: '1.5px solid var(--color-success)', textAlign: 'center' }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'var(--color-success-bg)',
            color: 'var(--color-success)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto var(--space-sm)'
          }}>
            <CheckCircle2 size={36} />
          </div>

          <h2 style={{ fontSize: '20px', fontWeight: 'bold', margin: '0 0 4px' }}>
            Job Finished & Verified!
          </h2>
          <p className="text-secondary" style={{ fontSize: '13px', marginBottom: 'var(--space-md)' }}>
            {worker.name} has completed the repair work. Please proceed to settle the standard fee directly.
          </p>

          <Button
            variant="primary"
            size="large"
            icon={CreditCard}
            fullWidth
            onClick={handleProceedToPayment}
          >
            Proceed to Payment (₹450)
          </Button>
        </Card>
      )}
      </>}

      {/* MOCK CHAT SCREEN MODAL */}
      {isChatOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 999,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center'
        }}>
          <div style={{
            background: 'var(--color-white)',
            width: '100%',
            maxWidth: '440px',
            height: '80vh',
            borderRadius: '16px 16px 0 0',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Chat Top Header */}
            <div style={{
              padding: 'var(--space-md)',
              borderBottom: '1px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                <div style={{
                  width: 38,
                  height: 38,
                  borderRadius: '50%',
                  background: 'var(--color-black)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold'
                }}>
                  {worker.avatar}
                </div>
                <div>
                  <h3 style={{ fontSize: '16px', margin: 0 }}>Chat with {worker.name}</h3>
                  <div style={{ fontSize: '11px', color: 'var(--color-success)', fontWeight: 600 }}>
                    Online • En Route
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsChatOpen(false)}
                style={{ padding: 4, cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Chat Messages Body */}
            <div style={{ flex: 1, padding: 'var(--space-md)', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
              {chatMessages.map((msg) => {
                const isUser = msg.sender === 'user';
                return (
                  <div
                    key={msg.id}
                    style={{
                      alignSelf: isUser ? 'flex-end' : 'flex-start',
                      maxWidth: '80%'
                    }}
                  >
                    <div style={{
                      background: isUser ? 'var(--color-black)' : 'var(--color-bg)',
                      color: isUser ? 'var(--color-white)' : 'var(--color-black)',
                      padding: '10px 14px',
                      borderRadius: isUser ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                      fontSize: '13px',
                      lineHeight: 1.4
                    }}>
                      {msg.text}
                    </div>
                    <div style={{
                      fontSize: '10px',
                      color: 'var(--color-text-secondary)',
                      marginTop: 2,
                      textAlign: isUser ? 'right' : 'left'
                    }}>
                      {msg.time}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Chat Input Bar */}
            <form onSubmit={handleSendChat} style={{ padding: 'var(--space-md)', borderTop: '1px solid var(--color-border)', display: 'flex', gap: 'var(--space-xs)' }}>
              <input
                type="text"
                className="ss-input"
                placeholder="Type a message..."
                value={newMsg}
                onChange={(e) => setNewMsg(e.target.value)}
                autoFocus
              />
              <Button type="submit" variant="primary" icon={Send}>
                Send
              </Button>
            </form>
          </div>
        </div>
      )}

      <CancelBookingModal
        isOpen={isCancelModalOpen}
        onClose={() => { setIsCancelModalOpen(false); setCancelError(''); }}
        onConfirm={handleConfirmCancel}
        isSubmitting={cancelSubmitting}
        error={cancelError}
      />

    </div>
  );
};

export default BookingTracking;
