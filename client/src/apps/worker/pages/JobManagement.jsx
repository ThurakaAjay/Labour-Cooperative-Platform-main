import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  MapPin,
  Clock,
  PhoneCall,
  MessageSquare,
  Navigation,
  CheckCircle2,
  ShieldCheck,
  Zap,
  KeyRound,
  Check,
  CreditCard,
  Building2,
  FileCheck2,
  ChevronRight,
  Send,
  X,
  Sparkles,
  TrendingUp,
  Star,
  Award,
  Radio,
  Wrench,
  Loader2,
  ExternalLink,
  Copy,
  Compass,
  CornerDownRight,
  Route
} from 'lucide-react';
import { Button, Card, Badge } from '../../../components';
import { useWorker } from '../context/WorkerContext';
import { bookingsAPI } from '../../../api';

export const JobManagement = () => {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { updateWorker } = useWorker();

  const [liveBooking, setLiveBooking] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState('');

  // Poll the live MongoDB record so this screen reflects reality even if the
  // customer or another device changed something (e.g. cancelled the
  // booking) — previously this fetched once on mount and then drove the
  // entire stepper off local state that could silently drift from the DB.
  useEffect(() => {
    if (!jobId) return;
    let isMounted = true;
    let pollInterval = null;

    const fetchJob = async () => {
      try {
        const res = await bookingsAPI.getById(jobId);
        if (res.success && res.data && isMounted) {
          setLiveBooking(res.data);
          if (['completed', 'paid', 'rated', 'cancelled', 'rejected'].includes(res.data.status) && pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
          }
        }
      } catch (err) {
        console.warn('Job management fetch error:', err.message);
      }
    };

    fetchJob();
    pollInterval = setInterval(fetchJob, 3000);
    return () => {
      isMounted = false;
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [jobId]);

  // 5 Status Steps: 0: Accepted, 1: On the way, 2: Arrived, 3: Working, 4: Completed
  // Derived from the live booking status on every render — never a locally
  // advanced counter — so this always matches what the customer sees.
  const currentStepIndex = (() => {
    const status = liveBooking?.status;
    if (status === 'on_the_way') return 1;
    if (status === 'arrived') return 2;
    if (status === 'working' || status === 'in_progress') return 3;
    if (['completed', 'paid', 'rated'].includes(status)) return 4;
    return 0; // accepted (or still loading)
  })();

  const isPinVerified = Boolean(liveBooking?.pinVerifiedAt);

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    { sender: 'customer', text: 'Hi! Please call when you reach the gate, security requires approval.', time: '4:15 PM' },
    { sender: 'worker', text: 'Sure madam, I am on the way. ETA is around 12 minutes.', time: '4:16 PM' }
  ]);
  const [newChatText, setNewChatText] = useState('');
  const [mapViewMode, setMapViewMode] = useState('map'); // 'map' | 'steps'
  const [copied, setCopied] = useState(false);

  const steps = [
    { id: 'accepted', label: 'Accepted', icon: CheckCircle2 },
    { id: 'on_the_way', label: 'On the way', icon: Navigation },
    { id: 'arrived', label: 'Arrived', icon: MapPin },
    { id: 'working', label: 'Working', icon: Wrench },
    { id: 'completed', label: 'Completed', icon: Sparkles }
  ];

  // Dynamic job data from the live, polled MongoDB record only. Before the
  // first fetch resolves, fields show a loading placeholder rather than a
  // fabricated customer/address/amount.
  const job = {
    id: liveBooking?.bookingId || jobId,
    customer: liveBooking?.customerName || 'Loading…',
    phone: liveBooking?.customerPhone || '',
    category: liveBooking?.serviceCategory || 'Loading…',
    problem: liveBooking?.serviceDetails || 'Loading…',
    address: liveBooking?.customerAddress || 'Loading address…',
    distance: '2.1 km (12 mins)',
    rate: liveBooking?.amount ? `₹${liveBooking.amount}` : '—'
  };

  const handleCopyAddress = () => {
    if (job.address) {
      navigator.clipboard?.writeText(job.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Dedicated Live Location Sharing State (Separate from general status stepper)
  const [isSharingLocation, setIsSharingLocation] = useState(true);

  const toggleLocationSharing = async () => {
    const nextState = !isSharingLocation;
    setIsSharingLocation(nextState);
    if (job.id) {
      try {
        const res = await bookingsAPI.updateStatus(job.id, { isLocationSharing: nextState });
        if (res.success && res.data) setLiveBooking(res.data);
      } catch (err) {
        console.warn('Location sharing sync warning:', err.message);
      }
    }
  };

  const handleNextAction = async () => {
    if (currentStepIndex >= 4 || !job.id) return;

    // Starting work requires the customer's arrival PIN to be verified first
    // — both here and enforced again server-side — so a worker physically
    // has to be on-site (reading the code the customer gives them) rather
    // than just tapping through the stepper.
    if (currentStepIndex === 2 && !isPinVerified) {
      setIsPinModalOpen(true);
      return;
    }

    const nextIndex = currentStepIndex + 1;
    const statusMap = ['accepted', 'on_the_way', 'arrived', 'working', 'completed'];
    const nextStatus = statusMap[nextIndex];
    const updatePayload = { status: nextStatus };

    if (nextIndex === 1) {
      setIsSharingLocation(true);
      updatePayload.isLocationSharing = true;
    } else if (nextIndex === 2) {
      setIsSharingLocation(false);
      updatePayload.isLocationSharing = false;
    }

    setActionLoading(true);
    try {
      const res = await bookingsAPI.updateStatus(job.id, updatePayload);
      if (res.success && res.data) setLiveBooking(res.data);
    } catch (err) {
      console.warn('Live status update warning:', err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerifyPin = async (e) => {
    e.preventDefault();
    if (!job.id) return;
    setPinError('');
    setActionLoading(true);
    try {
      const res = await bookingsAPI.verifyPin(job.id, pinInput);
      if (res.success && res.data) {
        setLiveBooking(res.data);
        setIsPinModalOpen(false);
        setPinInput('');
        // Immediately proceed to the "working" status now that the PIN is verified.
        const statusRes = await bookingsAPI.updateStatus(job.id, { status: 'working' });
        if (statusRes.success && statusRes.data) setLiveBooking(statusRes.data);
      }
    } catch (err) {
      setPinError(err.response?.data?.message || 'Incorrect PIN. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAttachCompletionPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !job.id) return;
    setPhotoError('');
    setPhotoUploading(true);
    try {
      const res = await bookingsAPI.uploadPhoto(job.id, file);
      if (res.success && res.data) setLiveBooking(res.data);
    } catch (err) {
      setPhotoError(err.response?.data?.message || 'Could not upload photo.');
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleSendMessage = (e) => {
    if (e) e.preventDefault();
    if (!newChatText.trim()) return;
    const msg = {
      sender: 'worker',
      text: newChatText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setChatMessages((prev) => [...prev, msg]);
    setNewChatText('');
  };

  const handleGoBackOnline = () => {
    updateWorker({ isOnline: true });
    navigate('/worker/dashboard', {
      state: { toastMessage: '🟢 Job completed & settled! You are back online ready for new dispatches.' }
    });
  };


  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', paddingBottom: 'var(--space-xl)' }}>
      
      {/* 1. TOP BAR */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
          <button
            type="button"
            onClick={() => navigate('/worker')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 36,
              height: 36,
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)',
              background: 'var(--color-white)',
              cursor: 'pointer'
            }}
            aria-label="Back"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>
              Job Management
            </h1>
            <p className="text-secondary" style={{ fontSize: '12px', margin: 0 }}>
              Job ID: #{job.id}
            </p>
          </div>
        </div>

        <Badge variant={currentStepIndex === 4 ? 'success' : 'active'}>
          {steps[currentStepIndex].label}
        </Badge>
      </div>

      {/* 2. CUSTOMER MINI-CARD WITH CALL & CHAT BUTTONS */}
      <Card padding="md">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <h2 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0 }}>{job.customer}</h2>
            </div>
            <p className="text-secondary" style={{ fontSize: '12px', margin: '2px 0 0' }}>
              {job.category}
            </p>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
            <a href={`tel:${job.phone}`}>
              <Button variant="outline" size="small" icon={PhoneCall}>
                Call
              </Button>
            </a>
            <Button
              variant="outline"
              size="small"
              icon={MessageSquare}
              onClick={() => setIsChatOpen(true)}
            >
              Chat
            </Button>
          </div>
        </div>
      </Card>

      {/* If Step < 4: Show Live Status Stepper, Destination, and Next Action */}
      {currentStepIndex < 4 ? (
        <>
          {/* 3. STATUS STEPPER MATCHING CUSTOMER TRACKING SCREEN */}
          <Card padding="md">
            <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: 'var(--space-md)' }}>
              Service Status Tracking
            </h3>

            {/* Stepper Progress Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', marginBottom: 'var(--space-md)' }}>
              
              {/* Line behind circles */}
              <div style={{
                position: 'absolute',
                top: 15,
                left: 20,
                right: 20,
                height: 3,
                background: 'var(--color-border)',
                zIndex: 1
              }}>
                <div style={{
                  height: '100%',
                  background: 'var(--color-accent)',
                  width: `${(currentStepIndex / 4) * 100}%`,
                  transition: 'width 0.3s ease'
                }} />
              </div>

              {steps.map((st, idx) => {
                const isPassed = idx <= currentStepIndex;
                const isCurrent = idx === currentStepIndex;

                return (
                  <div
                    key={st.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      zIndex: 2,
                      width: '60px',
                      textAlign: 'center'
                    }}
                  >
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: isPassed ? (isCurrent ? 'var(--color-accent)' : 'var(--color-success)') : 'var(--color-white)',
                      border: `2px solid ${isPassed ? (isCurrent ? 'var(--color-accent)' : 'var(--color-success)') : 'var(--color-border)'}`,
                      color: isPassed ? 'white' : 'var(--color-text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      transition: 'all 0.2s ease',
                      boxShadow: isCurrent ? '0 0 0 4px rgba(255, 106, 0, 0.2)' : 'none'
                    }}>
                      {idx < currentStepIndex ? <Check size={16} strokeWidth={3} /> : idx + 1}
                    </div>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: isCurrent ? 'bold' : 500,
                      color: isCurrent ? 'var(--color-black)' : 'var(--color-text-secondary)',
                      marginTop: 6,
                      lineHeight: 1.2
                    }}>
                      {st.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Current Step Status Card */}
            <div style={{
              background: 'var(--color-bg)',
              borderRadius: 'var(--radius-sm)',
              padding: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-sm)'
            }}>
              <div style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                background: 'var(--color-accent-subtle)',
                color: 'var(--color-accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Zap size={20} />
              </div>
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
                  Current Status: {steps[currentStepIndex].label}
                </div>
                <div className="text-secondary" style={{ fontSize: '12px' }}>
                  {currentStepIndex === 0 && 'Job accepted. Tap button below when ready to travel.'}
                  {currentStepIndex === 1 && `En route to ${job.address.split(',')[0]} (ETA: 12 min).`}
                  {currentStepIndex === 2 && (isPinVerified ? 'PIN verified — ready to start work.' : 'Ask the customer for their 4-digit arrival PIN to begin work.')}
                  {currentStepIndex === 3 && `${job.category} work in progress.`}
                </div>
              </div>
            </div>
          </Card>

          {/* 4. LIVE GOOGLE MAPS ROUTE NAVIGATION CARD */}
          <Card padding="none" style={{ overflow: 'hidden', border: '1.5px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
            
            {/* Header with Route Summary */}
            <div style={{
              background: 'linear-gradient(135deg, #111 0%, #222 100%)',
              color: 'white',
              padding: '12px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: 'var(--color-accent)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Navigation size={18} />
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
                    Live GPS Route to Customer
                  </div>
                  <div style={{ fontSize: '11px', color: '#BBB' }}>
                    Turn-by-turn route mapped via Google Maps
                  </div>
                </div>
              </div>

              {/* View Switcher: Live Google Map vs Turn Directions */}
              <div style={{ display: 'flex', background: 'rgba(255,255,255,0.12)', borderRadius: 'var(--radius-sm)', padding: 2 }}>
                <button
                  type="button"
                  onClick={() => setMapViewMode('map')}
                  style={{
                    background: mapViewMode === 'map' ? 'var(--color-accent)' : 'transparent',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '4px 10px',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  🗺️ Map View
                </button>
                <button
                  type="button"
                  onClick={() => setMapViewMode('steps')}
                  style={{
                    background: mapViewMode === 'steps' ? 'var(--color-accent)' : 'transparent',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '4px 10px',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  🧭 Steps
                </button>
              </div>
            </div>

            {/* Route Stats Bar */}
            <div style={{
              background: '#F8FAFC',
              borderBottom: '1px solid var(--color-border)',
              padding: '10px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '13px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div>
                  <span className="text-secondary" style={{ fontSize: '10px', display: 'block', fontWeight: 700, textTransform: 'uppercase' }}>ESTIMATED TIME</span>
                  <strong style={{ color: 'var(--color-accent)', fontSize: '15px' }}>⚡ 12 mins</strong>
                </div>
                <div style={{ borderLeft: '1px solid var(--color-border)', paddingLeft: 16 }}>
                  <span className="text-secondary" style={{ fontSize: '10px', display: 'block', fontWeight: 700, textTransform: 'uppercase' }}>DISTANCE</span>
                  <strong style={{ fontSize: '15px' }}>📍 {job.distance || '2.1 km'}</strong>
                </div>
                <div style={{ borderLeft: '1px solid var(--color-border)', paddingLeft: 16 }}>
                  <span className="text-secondary" style={{ fontSize: '10px', display: 'block', fontWeight: 700, textTransform: 'uppercase' }}>TRANSIT VIA</span>
                  <span style={{ fontSize: '12px', fontWeight: 600 }}>Sardar Patel & LB Rd</span>
                </div>
              </div>
            </div>

            {/* Interactive Map View */}
            {mapViewMode === 'map' ? (
              <div style={{ position: 'relative', width: '100%', height: '240px', background: '#E5E7EB' }}>
                <iframe
                  title="Google Maps Route Destination"
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  loading="lazy"
                  allowFullScreen
                  referrerPolicy="no-referrer-when-downgrade"
                  src={`https://maps.google.com/maps?q=${encodeURIComponent(job.address + ', Chennai')}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                />
                
                {/* Floating Destination Badge on Map */}
                <div style={{
                  position: 'absolute',
                  top: 10,
                  left: 10,
                  background: 'rgba(255, 255, 255, 0.95)',
                  backdropFilter: 'blur(4px)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '6px 10px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  fontSize: '11px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  maxWidth: '85%'
                }}>
                  <MapPin size={14} color="#D93025" style={{ flexShrink: 0 }} />
                  <span style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {job.address}
                  </span>
                </div>
              </div>
            ) : (
              /* Turn-by-Turn Directions Steps */
              <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10, background: 'white' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: '13px' }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#E0E7FF', color: '#4338CA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '11px', flexShrink: 0 }}>
                    1
                  </div>
                  <div>
                    <strong>Head north from Ward 4 Depot towards Sardar Patel Rd</strong>
                    <div className="text-secondary" style={{ fontSize: '11px' }}>Continue for 600m • Light traffic</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: '13px' }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#E0E7FF', color: '#4338CA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '11px', flexShrink: 0 }}>
                    2
                  </div>
                  <div>
                    <strong>Turn right onto Kasturba Nagar 2nd Main Rd</strong>
                    <div className="text-secondary" style={{ fontSize: '11px' }}>Drive 1.2 km towards Adyar Signal</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: '13px' }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#DCFCE7', color: '#15803D', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '11px', flexShrink: 0 }}>
                    3
                  </div>
                  <div>
                    <strong>Arrive at destination: {job.address}</strong>
                    <div className="text-secondary" style={{ fontSize: '11px' }}>Destination is on the left • Ask the customer for their arrival PIN to start work</div>
                  </div>
                </div>
              </div>
            )}

            {/* Task Note Bar */}
            <div style={{ padding: '10px 16px', background: '#F8FAFC', borderTop: '1px solid var(--color-border)', fontSize: '12px' }}>
              <span className="text-secondary" style={{ fontWeight: 600 }}>TASK NOTE: </span>
              <span>{job.problem}</span>
            </div>

            {/* Direct Google Maps Action Buttons */}
            <div style={{
              padding: '12px 16px',
              background: 'white',
              borderTop: '1px solid var(--color-border)',
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(job.address + ', Chennai')}&travelmode=driving`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  flex: 1,
                  minWidth: '220px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  background: '#1A73E8',
                  color: 'white',
                  padding: '10px 16px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '13px',
                  fontWeight: 700,
                  textDecoration: 'none',
                  boxShadow: '0 2px 8px rgba(26, 115, 232, 0.3)'
                }}
              >
                <Navigation size={16} />
                <span>Open Route in Google Maps (Turn-by-Turn GPS)</span>
                <ExternalLink size={14} />
              </a>

              <button
                type="button"
                onClick={handleCopyAddress}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'var(--color-bg)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '10px 14px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {copied ? <Check size={14} color="#16A34A" /> : <Copy size={14} />}
                <span>{copied ? 'Address Copied!' : 'Copy Address'}</span>
              </button>
            </div>
          </Card>

          {/* DEDICATED SEPARATE BUTTON: "START SHARING LOCATION" (VISIBLE IN ACCEPTED / ON THE WAY) */}
          {currentStepIndex <= 1 && (
            <Card
              padding="md"
              style={{
                border: isSharingLocation ? '1.5px solid #22C55E' : '1.5px solid var(--color-border)',
                background: isSharingLocation ? '#F0FDF4' : 'var(--color-white)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 'var(--space-xs)', alignItems: 'center' }}>
                  <div style={{
                    width: 34,
                    height: 34,
                    borderRadius: '50%',
                    background: isSharingLocation ? '#DCFCE7' : 'var(--color-bg)',
                    color: isSharingLocation ? '#16A34A' : 'var(--color-text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Navigation size={18} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '13px', color: isSharingLocation ? '#15803D' : 'var(--color-black)' }}>
                      {isSharingLocation ? '🟢 Live Location Sharing is Active' : 'Live Location Sharing'}
                    </div>
                    <div className="text-secondary" style={{ fontSize: '11px' }}>
                      {isSharingLocation
                        ? 'Customer sees your moving vehicle on map • Stops at arrival'
                        : 'Share your route with customer once ready to travel'}
                    </div>
                  </div>
                </div>

                <Button
                  variant={isSharingLocation ? 'outline' : 'primary'}
                  size="small"
                  onClick={toggleLocationSharing}
                >
                  {isSharingLocation ? 'Stop Sharing' : 'Start Sharing Location 📍'}
                </Button>
              </div>
            </Card>
          )}

          {/* PROOF-OF-COMPLETION / ISSUE PHOTOS */}
          <Card padding="md">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h3 style={{ fontSize: '14px', fontWeight: 'bold', margin: 0 }}>Job Photos</h3>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '12px', fontWeight: 700, color: 'var(--color-accent)', cursor: photoUploading ? 'not-allowed' : 'pointer' }}>
                {photoUploading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : '+ Add Photo'}
                <input type="file" accept="image/*" hidden disabled={photoUploading} onChange={handleAttachCompletionPhoto} />
              </label>
            </div>
            {photoError && <div style={{ fontSize: '12px', color: 'var(--color-danger)', marginBottom: 8 }}>{photoError}</div>}
            {(liveBooking?.photos?.length || 0) === 0 ? (
              <p className="text-secondary" style={{ fontSize: '12px', margin: 0 }}>No photos yet. Customer-attached issue photos and your proof-of-completion shots will appear here.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 8 }}>
                {liveBooking.photos.map((p, idx) => (
                  <a key={p.publicId || idx} href={p.url} target="_blank" rel="noopener noreferrer">
                    <img src={p.url} alt={`Job photo ${idx + 1}`} style={{ width: '100%', height: '80px', objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }} />
                  </a>
                ))}
              </div>
            )}
          </Card>

          {/* 5. BIG BUTTON AT BOTTOM ALWAYS SHOWING NEXT ACTION */}

          <div style={{ marginTop: 'var(--space-sm)' }}>
            <Button
              variant="primary"
              size="large"
              fullWidth
              disabled={actionLoading}
              style={{ height: '56px', fontSize: '16px', fontWeight: 'bold' }}
              onClick={handleNextAction}
            >
              {actionLoading ? 'Updating...' : (
                <>
                  {currentStepIndex === 0 && 'Start Heading to Job 🛵'}
                  {currentStepIndex === 1 && 'Mark Arrived at Location 📍'}
                  {currentStepIndex === 2 && (isPinVerified ? 'Start Work 🔧' : 'Verify Arrival PIN to Start Work 🔐')}
                  {currentStepIndex === 3 && 'Mark Job Completed & Settle Payment ✅'}
                </>
              )}
            </Button>
          </div>
        </>
      ) : (
        /* 6. COMPLETED SCREEN: SHORT JOB SUMMARY & "GO BACK ONLINE" BUTTON */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          
          {/* Celebratory Checkmark Card */}
          <Card padding="lg" style={{ textAlign: 'center', background: '#F9FFF9', border: '1.5px solid #22C55E' }}>
            <div style={{
              width: 68,
              height: 68,
              borderRadius: '50%',
              background: 'var(--color-success-bg)',
              color: 'var(--color-success)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto var(--space-xs)'
            }}>
              <CheckCircle2 size={40} />
            </div>

            <Badge variant="success" style={{ marginBottom: '6px' }}>
              Job Successfully Settled
            </Badge>

            <h2 style={{ fontSize: '24px', fontWeight: 'bold', margin: '4px 0 2px' }}>
              Job Completed!
            </h2>
            <p className="text-secondary" style={{ fontSize: '13px', margin: 0 }}>
              Payment of {job.rate} deposited directly to your registered UPI ID.
            </p>
          </Card>

          {/* Job Summary Card (Service, Duration, Amount Earned) */}
          <Card padding="md">
            <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: 'var(--space-sm)' }}>
              Job Summary Receipt
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="text-secondary">Service Rendered:</span>
                <span className="text-bold">{job.category}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="text-secondary">Customer:</span>
                <span className="text-bold">{job.customer} (Ward 4)</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="text-secondary">Duration of Work:</span>
                <span className="text-bold">42 Minutes</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="text-secondary">Customer Rating:</span>
                <span style={{ color: 'var(--color-accent)', fontWeight: 'bold' }}>⭐ 5.0 ("Super quick & polite!")</span>
              </div>

              <div style={{ height: 1, background: 'var(--color-border)', margin: '4px 0' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontWeight: 'bold', fontSize: '15px' }}>Amount Earned:</span>
                <span style={{ fontWeight: 'bold', fontSize: '22px', color: 'var(--color-success)' }}>
                  {job.rate}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#166534' }}>
                <span>Cooperative Welfare Contribution:</span>
                <span>+₹20 added to your Tool Pool</span>
              </div>
            </div>
          </Card>

          {/* Big "Go Back Online" Button */}
          <Button
            variant="primary"
            size="large"
            icon={Radio}
            fullWidth
            style={{ height: '56px', fontSize: '16px', fontWeight: 'bold' }}
            onClick={handleGoBackOnline}
          >
            Go Back Online 🟢
          </Button>

        </div>
      )}

      {/* ARRIVAL PIN VERIFICATION MODAL */}
      {isPinModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-md)'
        }}>
          <div style={{ background: 'var(--color-white)', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '360px', padding: 'var(--space-lg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <KeyRound size={22} color="var(--color-accent)" />
              <h3 style={{ fontSize: '17px', fontWeight: 'bold', margin: 0 }}>Verify Arrival PIN</h3>
            </div>
            <p className="text-secondary" style={{ fontSize: '13px', margin: '0 0 14px' }}>
              Ask {job.customer} for the 4-digit code shown in their app, then enter it below to start work.
            </p>
            <form onSubmit={handleVerifyPin}>
              <input
                type="text"
                inputMode="numeric"
                maxLength={4}
                autoFocus
                className="ss-input"
                placeholder="••••"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                style={{ textAlign: 'center', fontSize: '24px', letterSpacing: '8px', fontWeight: 'bold', padding: '12px' }}
              />
              {pinError && <div style={{ color: 'var(--color-danger)', fontSize: '12px', marginTop: 8 }}>{pinError}</div>}
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <Button type="button" variant="outline" style={{ flex: 1 }} onClick={() => { setIsPinModalOpen(false); setPinInput(''); setPinError(''); }}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" style={{ flex: 1 }} disabled={pinInput.length !== 4 || actionLoading}>
                  {actionLoading ? 'Verifying...' : 'Verify PIN'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. REUSABLE MOCK CHAT THREAD MODAL */}
      {isChatOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--space-md)'
        }}>
          <div style={{
            background: 'var(--color-white)',
            borderRadius: 'var(--radius-lg)',
            width: '100%',
            maxWidth: '420px',
            height: '520px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-lg)'
          }}>
            {/* Chat Header */}
            <div style={{
              background: 'var(--color-black)',
              color: 'white',
              padding: '12px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '15px' }}>{job.customer}</div>
                <div style={{ fontSize: '11px', color: '#BBB' }}>Customer • {job.phone}</div>
              </div>
              <button
                type="button"
                onClick={() => setIsChatOpen(false)}
                style={{ color: 'white', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Chat Message List */}
            <div style={{ flex: 1, padding: 'var(--space-md)', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)', background: 'var(--color-bg)' }}>
              {chatMessages.map((msg, i) => (
                <div
                  key={i}
                  style={{
                    alignSelf: msg.sender === 'worker' ? 'flex-end' : 'flex-start',
                    maxWidth: '80%',
                    background: msg.sender === 'worker' ? 'var(--color-accent)' : 'var(--color-white)',
                    color: msg.sender === 'worker' ? 'white' : 'var(--color-black)',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    borderBottomRightRadius: msg.sender === 'worker' ? 2 : 'var(--radius-md)',
                    borderBottomLeftRadius: msg.sender === 'customer' ? 2 : 'var(--radius-md)',
                    fontSize: '13px',
                    boxShadow: 'var(--shadow-sm)'
                  }}
                >
                  <div>{msg.text}</div>
                  <div style={{
                    fontSize: '10px',
                    color: msg.sender === 'worker' ? 'rgba(255,255,255,0.8)' : 'var(--color-text-secondary)',
                    textAlign: 'right',
                    marginTop: 2
                  }}>
                    {msg.time}
                  </div>
                </div>
              ))}
            </div>

            {/* Quick-Reply Chips */}
            <div style={{ padding: '6px 10px', background: 'var(--color-white)', borderTop: '1px solid var(--color-border)', display: 'flex', gap: 6, overflowX: 'auto' }}>
              {[
                'I have arrived at the gate',
                'Please share floor number',
                'Need to buy 1/2" coupler',
                'Work completed!'
              ].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => {
                    setNewChatText(chip);
                  }}
                  style={{
                    whiteSpace: 'nowrap',
                    padding: '4px 8px',
                    borderRadius: 'var(--radius-full)',
                    background: 'var(--color-bg)',
                    border: '1px solid var(--color-border)',
                    fontSize: '11px',
                    cursor: 'pointer'
                  }}
                >
                  {chip}
                </button>
              ))}
            </div>

            {/* Chat Input Bar */}
            <form onSubmit={handleSendMessage} style={{ padding: '8px 12px', borderTop: '1px solid var(--color-border)', display: 'flex', gap: 'var(--space-xs)', background: 'var(--color-white)' }}>
              <input
                type="text"
                className="ss-input"
                style={{ flex: 1, padding: '8px 12px', fontSize: '13px' }}
                placeholder="Type a message..."
                value={newChatText}
                onChange={(e) => setNewChatText(e.target.value)}
              />
              <Button type="submit" variant="primary" size="small" icon={Send} />
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default JobManagement;
