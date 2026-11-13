import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Phone,
  KeyRound,
  User,
  MapPin,
  Globe,
  Wrench,
  FileCheck2,
  Upload,
  CreditCard,
  QrCode,
  Banknote,
  HeartHandshake,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Check,
  Trash2,
  Sparkles,
  Zap,
  Building2,
  HardHat,
  Eye,
  EyeOff
} from 'lucide-react';
import { Button, Card, Badge } from '../../../../components';
import { useWorker } from '../../context/WorkerContext';
import { useAuth } from '../../../../context/AuthContext';
import { workersAPI } from '../../../../api';

const DAYS = [
  { key: 'mon', label: 'Mon' },
  { key: 'tue', label: 'Tue' },
  { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' },
  { key: 'fri', label: 'Fri' },
  { key: 'sat', label: 'Sat' },
  { key: 'sun', label: 'Sun' }
];

const SLOTS = [
  { id: 'morning', label: 'Morning', hours: '9-1 PM' },
  { id: 'afternoon', label: 'Afternoon', hours: '1-5 PM' },
  { id: 'evening', label: 'Evening', hours: '5-9 PM' }
];

const emptyAvailabilityGrid = () => {
  const grid = {};
  DAYS.forEach((d) => { grid[d.key] = { morning: false, afternoon: false, evening: false }; });
  return grid;
};

const hasAnyOpenSlot = (grid) => Object.values(grid).some((d) => d.morning || d.afternoon || d.evening);

export const WorkerRegistrationFlow = () => {
  const navigate = useNavigate();
  const { worker, updateWorker, completeRegistration } = useWorker();
  const { register } = useAuth();

  // Step 1 to 8 (7 collects details, 8 is the post-submit status screen)
  const [step, setStep] = useState(1);

  // STEP 1: LOGIN STATE
  const [phone, setPhone] = useState(worker.phone || '');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '']);
  const otpInputsRef = useRef([]);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // STEP 2: PERSONAL DETAILS
  const [name, setName] = useState(worker.name || '');
  const [address, setAddress] = useState(worker.address || '');
  const [serviceRadius, setServiceRadius] = useState(worker.serviceRadius || 5);
  const [languages, setLanguages] = useState(worker.languages?.length ? worker.languages : ['Tamil', 'English']);

  // STEP 3: SKILLS & EXPERIENCE
  const [skills, setSkills] = useState(worker.skills?.length ? worker.skills : []);
  const [experience, setExperience] = useState(worker.experience || '');

  // STEP 4: DOCUMENTS
  const [idUploaded, setIdUploaded] = useState(false);
  const [certUploaded, setCertUploaded] = useState(false);

  // STEP 5: PAYOUT DETAILS
  const [payoutType, setPayoutType] = useState(worker.paymentDetails?.payoutType || 'upi');
  const [upiId, setUpiId] = useState(worker.paymentDetails?.upiId || '');
  const [accountNumber, setAccountNumber] = useState(worker.paymentDetails?.bankAccount?.accountNumber || '');
  const [ifsc, setIfsc] = useState(worker.paymentDetails?.bankAccount?.ifsc || '');
  const [bankName, setBankName] = useState(worker.paymentDetails?.bankAccount?.bankName || '');

  // STEP 6: NOMINEE DETAILS
  const [nomineeName, setNomineeName] = useState(worker.accidentCoverage?.nominee?.name || '');
  const [nomineeRelation, setNomineeRelation] = useState(worker.accidentCoverage?.nominee?.relation || '');
  const [nomineePayout, setNomineePayout] = useState(worker.accidentCoverage?.nominee?.payout || '');

  // STEP 7: WEEKLY AVAILABILITY (required for isProfileComplete — see
  // WorkerService.isProfileDataComplete — so a fresh registration doesn't
  // land the worker straight back in the profile-completion gate)
  const [availabilityGrid, setAvailabilityGrid] = useState(emptyAvailabilityGrid());

  // STEP 7->8 SUBMISSION STATE
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState('');

  // Available Data Arrays
  const languageOptions = ['Tamil', 'English', 'Hindi', 'Telugu', 'Malayalam', 'Kannada', 'Marathi'];
  const radiusOptions = [
    { id: 2, label: '2 km (Local Ward)' },
    { id: 5, label: '5 km (Recommended)' },
    { id: 10, label: '10 km (Extended)' },
    { id: 15, label: '15 km (Whole City)' }
  ];

  const skillOptions = [
    { id: 'Electrical', label: '⚡ Electrical' },
    { id: 'Plumbing', label: '🔧 Plumbing' },
    { id: 'Carpentry', label: '🪚 Carpentry' },
    { id: 'Painting', label: '🎨 Painting' },
    { id: 'Cleaning', label: '🧹 Cleaning' },
    { id: 'Caregiving', label: '👩‍⚕️ Caregiving' },
    { id: 'Driving', label: '🚗 Driving' },
    { id: 'Gardening', label: '🌱 Gardening' },
    { id: 'Domestic Help', label: '🏠 Domestic Help' },
    { id: 'Technician', label: '🔧 Technician' }
  ];

  const relationshipOptions = ['Spouse', 'Parent', 'Child', 'Sibling'];

  // OTP Box handling. This step's OTP is simulated (any 4 digits pass) — it
  // doesn't hit the real send-otp/verify-otp endpoints — so it no longer
  // auto-advances to step 2 on its own; the account also needs a password
  // set below before "Continue" unlocks, since account creation requires one.
  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    // Auto-forward
    if (value && index < 3) {
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    }
  };

  const toggleLanguage = (lang) => {
    setLanguages((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]
    );
  };

  const toggleSkill = (skill) => {
    setSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  };

  const toggleGridCell = (dayKey, slotId) => {
    setAvailabilityGrid((prev) => ({
      ...prev,
      [dayKey]: { ...prev[dayKey], [slotId]: !prev[dayKey][slotId] }
    }));
  };

  const setAllAvailable = () => {
    const full = {};
    DAYS.forEach((d) => { full[d.key] = { morning: true, afternoon: true, evening: true }; });
    setAvailabilityGrid(full);
  };

  const setWeekendOff = () => {
    setAvailabilityGrid((prev) => ({
      ...prev,
      sat: { morning: true, afternoon: false, evening: false },
      sun: { morning: false, afternoon: false, evening: false }
    }));
  };

  // Creates the account (and its linked Worker record — one workerId,
  // generated server-side, shared by both) then fills in everything the
  // wizard collected that the bare registration endpoint doesn't accept.
  // Splitting it this way — rather than the old approach of independently
  // POSTing a whole second Worker document with a client-generated id —
  // means there's exactly one Worker record, actually linked to the
  // session that gets created, instead of the wizard's data landing in an
  // orphaned document nothing ever looks up again.
  const submitRegistration = async () => {
    setRegisterError('');
    setRegistering(true);

    const registerRes = await register({
      name,
      phone,
      password,
      role: 'worker',
      locality: address || 'Ward 4, Chennai',
      skill: skills[0] || 'General Services',
      experience: experience ? `${experience} years` : ''
    });

    if (!registerRes.success) {
      setRegisterError(registerRes.error || 'Registration failed. Please try again.');
      setRegistering(false);
      return false;
    }

    const newWorkerId = registerRes.user.userId;
    const detailPayload = {
      skills,
      languages,
      serviceRadius: Number(serviceRadius),
      weeklyAvailability: availabilityGrid,
      paymentDetails: {
        payoutType,
        upiId,
        bankAccount: { accountNumber, ifsc, bankName }
      },
      accidentCoverage: {
        nominee: { name: nomineeName, relation: nomineeRelation, payout: nomineePayout }
      }
    };

    // Best-effort: the account itself is already created at this point, so a
    // failure here shouldn't strand the worker mid-registration — it just
    // means they'll see the profile-completion gate afterward and can
    // re-save these details from the Skill Profile page instead.
    try {
      await workersAPI.patch(newWorkerId, detailPayload);
    } catch (err) {
      console.warn('Could not save full profile details after registration:', err.message);
    }

    completeRegistration({
      workerId: newWorkerId,
      phone,
      name,
      address,
      locality: address || 'Ward 4, Chennai',
      skill: skills[0] || 'General Services',
      skills,
      experience: experience ? `${experience} years` : '',
      idDocument: 'aadhaar_card_front_back.pdf',
      certDocument: 'iti_electrical_trade_cert.pdf',
      ...detailPayload,
      status: 'Pending',
      badge: 'Pending Verification',
      isOnline: false
    });

    setRegistering(false);
    return true;
  };

  const handleNext = async () => {
    if (step < 8) {
      if (step === 7) {
        const ok = await submitRegistration();
        if (!ok) return;
      }
      setStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((prev) => prev - 1);
    } else {
      navigate('/styleguide');
    }
  };

  return (
    <div className="wh-auth-page" style={{ padding: 'var(--space-md) var(--space-sm)' }}>
      {/* Top Navbar */}
      <nav className="wh-auth-top-nav" style={{ maxWidth: '880px' }} aria-label="Worker registration navigation">
        <button
          type="button"
          onClick={handleBack}
          className="wh-auth-back-link"
          style={{ cursor: 'pointer' }}
        >
          <ArrowLeft size={16} color="var(--color-accent)" />
          <span>{step > 1 ? `Back to Step ${step - 1}` : 'Back to Portal'}</span>
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Badge variant="active" style={{ fontSize: '12px' }}>
            <HardHat size={12} />
            <span>Coop Member Enrollment</span>
          </Badge>
        </div>
      </nav>

      <div className="wh-wizard-container" style={{ maxWidth: '880px', width: '100%', minHeight: 'auto', flex: 1, padding: 0 }}>
        
        {/* 1. RESPONSIVE STEPPER (HORIZONTAL ON DESKTOP/TABLET) */}
        <div className="wh-wizard-stepper" aria-label="Registration steps">
          {[
            { num: 1, label: 'Login & OTP' },
            { num: 2, label: 'Personal' },
            { num: 3, label: 'Skills' },
            { num: 4, label: 'Documents' },
            { num: 5, label: 'Payout' },
            { num: 6, label: 'Nominee' },
            { num: 7, label: 'Availability' },
            { num: 8, label: 'Status' }
          ].map((s) => {
            const isDone = step > s.num;
            const isCurr = step === s.num;
            return (
              <div
                key={s.num}
                className={`wh-wizard-step-node ${isCurr ? 'active' : isDone ? 'completed' : ''}`}
              >
                <div className="wh-step-circle">
                  {isDone ? '✓' : s.num}
                </div>
                <span className="wh-step-label">{s.label}</span>
              </div>
            );
          })}
        </div>

        {/* Mobile Linear Progress Indicator */}
        <div style={{
          width: '100%',
          height: 4,
          background: 'var(--color-border)',
          borderRadius: 'var(--radius-full)',
          overflow: 'hidden',
          marginBottom: 'var(--space-md)'
        }}>
          <div style={{
            height: '100%',
            background: 'var(--color-accent)',
            width: `${(step / 8) * 100}%`,
            transition: 'width 0.3s ease'
          }} />
        </div>

        {/* 2. ELEVATED WHITE CARD FOR STEP CONTENT */}
        <Card padding="lg" style={{
          background: 'var(--color-white)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.05)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: '480px'
        }}>
          <main style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        
        <div>
          {/* STEP 1: WORKER LOGIN (PHONE + OTP) */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              <div>
                <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>Worker Partner Login</h1>
                <p className="text-secondary" style={{ fontSize: '14px' }}>
                  Enter your mobile number to sign in or register with your local cooperative.
                </p>
              </div>

              <Card padding="md">
                <div className="ss-form-group">
                  <label className="ss-label" htmlFor="worker-phone">Mobile Number</label>
                  <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                    <div style={{
                      padding: '12px var(--space-md)',
                      background: 'var(--color-bg)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-sm)',
                      fontWeight: 'bold',
                      fontSize: '15px'
                    }}>
                      +91
                    </div>
                    <input
                      id="worker-phone"
                      type="tel"
                      className="ss-input"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="10 digit mobile number"
                      maxLength={10}
                    />
                  </div>
                </div>

                {!otpSent ? (
                  <Button
                    variant="primary"
                    fullWidth
                    icon={Phone}
                    onClick={() => {
                      setOtpSent(true);
                      setTimeout(() => otpInputsRef.current[0]?.focus(), 100);
                    }}
                  >
                    Send OTP SMS
                  </Button>
                ) : (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <label className="ss-label" style={{ margin: 0 }}>Enter 4-Digit OTP</label>
                      <span style={{ fontSize: '11px', color: 'var(--color-success)', fontWeight: 600 }}>
                        ✓ OTP Sent to +91 {phone}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'center', margin: 'var(--space-sm) 0' }}>
                      {otp.map((digit, idx) => (
                        <input
                          key={idx}
                          ref={(el) => (otpInputsRef.current[idx] = el)}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleOtpChange(idx, e.target.value)}
                          onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                          style={{
                            width: 52,
                            height: 56,
                            textAlign: 'center',
                            fontSize: '22px',
                            fontWeight: 'bold',
                            borderRadius: 'var(--radius-sm)',
                            border: `2px solid ${digit ? 'var(--color-accent)' : 'var(--color-border)'}`,
                            background: 'var(--color-white)',
                            outline: 'none'
                          }}
                        />
                      ))}
                    </div>

                    <p className="text-secondary" style={{ fontSize: '12px', textAlign: 'center', marginBottom: 'var(--space-sm)' }}>
                      Simulated OTP: Enter any 4 numbers (e.g. 1 2 3 4).
                    </p>

                    <div className="ss-form-group">
                      <label className="ss-label" htmlFor="worker-password">Create Password</label>
                      <div style={{ position: 'relative' }}>
                        <input
                          id="worker-password"
                          type={showPassword ? 'text' : 'password'}
                          className="ss-input"
                          style={{ paddingRight: '40px' }}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Min 6 characters"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                          style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>

                    <div className="ss-form-group" style={{ marginBottom: 0 }}>
                      <label className="ss-label" htmlFor="worker-confirm-password">Confirm Password</label>
                      <input
                        id="worker-confirm-password"
                        type={showPassword ? 'text' : 'password'}
                        className="ss-input"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter password"
                      />
                      {confirmPassword.length > 0 && confirmPassword !== password && (
                        <div style={{ fontSize: '11px', color: 'var(--color-danger)', marginTop: 4, fontWeight: 600 }}>
                          Passwords do not match.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* STEP 2: PERSONAL DETAILS */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              <div>
                <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>Personal Details</h1>
                <p className="text-secondary" style={{ fontSize: '14px' }}>
                  Tell us your name, neighborhood, and spoken languages.
                </p>
              </div>

              <Card padding="md">
                <div className="ss-form-group">
                  <label className="ss-label" htmlFor="worker-name">Full Name</label>
                  <input
                    id="worker-name"
                    type="text"
                    className="ss-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Ramesh Patil"
                  />
                </div>

                <div className="ss-form-group">
                  <label className="ss-label" htmlFor="worker-addr">Residential Address</label>
                  <textarea
                    id="worker-addr"
                    className="ss-input"
                    style={{ minHeight: '75px', padding: '10px', resize: 'vertical' }}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Flat/House no, street, ward, city"
                  />
                </div>

                <div className="ss-form-group">
                  <label className="ss-label">Service Working Radius</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-xs)' }}>
                    {radiusOptions.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setServiceRadius(r.id)}
                        style={{
                          padding: '10px 8px',
                          borderRadius: 'var(--radius-sm)',
                          background: serviceRadius === r.id ? 'var(--color-accent-subtle)' : 'var(--color-bg)',
                          border: `1.5px solid ${serviceRadius === r.id ? 'var(--color-accent)' : 'var(--color-border)'}`,
                          fontSize: '12px',
                          fontWeight: 'bold',
                          color: serviceRadius === r.id ? 'var(--color-accent)' : 'var(--color-black)',
                          cursor: 'pointer'
                        }}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: 0 }}>
                  <label className="ss-label" style={{ display: 'block', marginBottom: '6px' }}>
                    Languages Spoken (Multi-select)
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {languageOptions.map((lang) => {
                      const isSelected = languages.includes(lang);
                      return (
                        <button
                          key={lang}
                          type="button"
                          onClick={() => toggleLanguage(lang)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: 'var(--radius-full)',
                            background: isSelected ? 'var(--color-black)' : 'var(--color-bg)',
                            color: isSelected ? 'white' : 'var(--color-black)',
                            border: '1px solid var(--color-border)',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          {isSelected ? `✓ ${lang}` : `+ ${lang}`}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* STEP 3: SKILLS & EXPERIENCE */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              <div>
                <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>Skills & Experience</h1>
                <p className="text-secondary" style={{ fontSize: '14px' }}>
                  Select the trade categories you are qualified to work in.
                </p>
              </div>

              <Card padding="md">
                <label className="ss-label" style={{ display: 'block', marginBottom: '8px' }}>
                  Select Primary & Secondary Skills
                </label>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: 'var(--space-xs)',
                  marginBottom: 'var(--space-md)'
                }}>
                  {skillOptions.map((sk) => {
                    const isSelected = skills.includes(sk.id);
                    return (
                      <button
                        key={sk.id}
                        type="button"
                        onClick={() => toggleSkill(sk.id)}
                        style={{
                          padding: '12px 10px',
                          borderRadius: 'var(--radius-md)',
                          background: isSelected ? 'var(--color-accent-subtle)' : 'var(--color-bg)',
                          border: `1.5px solid ${isSelected ? 'var(--color-accent)' : 'var(--color-border)'}`,
                          fontSize: '13px',
                          fontWeight: 'bold',
                          color: isSelected ? 'var(--color-accent)' : 'var(--color-black)',
                          cursor: 'pointer',
                          textAlign: 'left'
                        }}
                      >
                        {sk.label}
                      </button>
                    );
                  })}
                </div>

                <div className="ss-form-group" style={{ marginBottom: 0 }}>
                  <label className="ss-label" htmlFor="worker-exp">Years of Experience in this Trade</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                    <input
                      id="worker-exp"
                      type="number"
                      className="ss-input"
                      value={experience}
                      onChange={(e) => setExperience(e.target.value)}
                      min={1}
                      max={40}
                      style={{ width: '100px', fontSize: '18px', fontWeight: 'bold' }}
                    />
                    <span style={{ fontSize: '14px', fontWeight: 600 }}>Years of Professional Work</span>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* STEP 4: DOCUMENTS (ID & CERTIFICATIONS) */}
          {step === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              <div>
                <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>Verification Documents</h1>
                <p className="text-secondary" style={{ fontSize: '14px' }}>
                  Upload government ID and trade certification for cooperative background verification.
                </p>
              </div>

              {/* ID Proof Card */}
              <Card padding="md">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-xs)' }}>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0 }}>1. Government ID Proof</h3>
                    <p className="text-secondary" style={{ fontSize: '12px' }}>Aadhaar Card, Voter ID, or Driving License</p>
                  </div>
                  {idUploaded && <Badge variant="success">Attached</Badge>}
                </div>

                <div style={{
                  border: '1.5px dashed var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-md)',
                  textAlign: 'center',
                  background: idUploaded ? 'var(--color-success-bg)' : 'var(--color-bg)'
                }}>
                  {idUploaded ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-success)', fontWeight: 600, fontSize: '13px' }}>
                        <FileCheck2 size={18} />
                        <span>aadhaar_card_front_back.pdf</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIdUploaded(false)}
                        style={{ color: 'var(--color-danger)', cursor: 'pointer', background: 'none', border: 'none' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="small"
                      icon={Upload}
                      onClick={() => setIdUploaded(true)}
                    >
                      + Upload Aadhaar / Voter ID
                    </Button>
                  )}
                </div>
              </Card>

              {/* Trade Certificate Card */}
              <Card padding="md">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-xs)' }}>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0 }}>2. Trade Certification / ITI</h3>
                    <p className="text-secondary" style={{ fontSize: '12px' }}>Govt. ITI Certificate, Trade Diploma, or Society Safety Clearance</p>
                  </div>
                  {certUploaded && <Badge variant="success">Attached</Badge>}
                </div>

                <div style={{
                  border: '1.5px dashed var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-md)',
                  textAlign: 'center',
                  background: certUploaded ? 'var(--color-success-bg)' : 'var(--color-bg)'
                }}>
                  {certUploaded ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-success)', fontWeight: 600, fontSize: '13px' }}>
                        <FileCheck2 size={18} />
                        <span>iti_electrical_trade_cert.pdf</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCertUploaded(false)}
                        style={{ color: 'var(--color-danger)', cursor: 'pointer', background: 'none', border: 'none' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="small"
                      icon={Upload}
                      onClick={() => setCertUploaded(true)}
                    >
                      + Upload Skill Certificate
                    </Button>
                  )}
                </div>
              </Card>
            </div>
          )}

          {/* STEP 5: PAYOUT DETAILS */}
          {step === 5 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              <div>
                <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>Payout Information</h1>
                <p className="text-secondary" style={{ fontSize: '14px' }}>
                  Where should your daily 100% earnings and cooperative incentives be disbursed?
                </p>
              </div>

              <Card padding="md">
                {/* Payout Toggle */}
                <div style={{ display: 'flex', gap: 'var(--space-xs)', marginBottom: 'var(--space-md)' }}>
                  <button
                    type="button"
                    onClick={() => setPayoutType('upi')}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: 'var(--radius-sm)',
                      background: payoutType === 'upi' ? 'var(--color-black)' : 'var(--color-bg)',
                      color: payoutType === 'upi' ? 'white' : 'var(--color-black)',
                      fontWeight: 'bold',
                      border: '1px solid var(--color-border)',
                      cursor: 'pointer'
                    }}
                  >
                    UPI ID (Instant)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayoutType('bank')}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: 'var(--radius-sm)',
                      background: payoutType === 'bank' ? 'var(--color-black)' : 'var(--color-bg)',
                      color: payoutType === 'bank' ? 'white' : 'var(--color-black)',
                      fontWeight: 'bold',
                      border: '1px solid var(--color-border)',
                      cursor: 'pointer'
                    }}
                  >
                    Bank Account
                  </button>
                </div>

                {payoutType === 'upi' ? (
                  <div className="ss-form-group" style={{ marginBottom: 0 }}>
                    <label className="ss-label" htmlFor="worker-upi">Enter Personal UPI ID (VPA)</label>
                    <input
                      id="worker-upi"
                      type="text"
                      className="ss-input"
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                      placeholder="e.g. mobile@upi or name@okhdfcbank"
                    />
                    <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: 4 }}>
                      ✓ Payouts are transferred immediately after job completion.
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                    <div className="ss-form-group" style={{ marginBottom: 0 }}>
                      <label className="ss-label" htmlFor="bank-acc">Bank Account Number</label>
                      <input
                        id="bank-acc"
                        type="text"
                        className="ss-input"
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value)}
                        placeholder="e.g. 918273645521"
                      />
                    </div>
                    <div className="ss-form-group" style={{ marginBottom: 0 }}>
                      <label className="ss-label" htmlFor="bank-ifsc">IFSC Code</label>
                      <input
                        id="bank-ifsc"
                        type="text"
                        className="ss-input"
                        value={ifsc}
                        onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                        placeholder="e.g. HDFC0001824"
                      />
                    </div>
                    <div className="ss-form-group" style={{ marginBottom: 0 }}>
                      <label className="ss-label" htmlFor="bank-name">Bank & Branch Name</label>
                      <input
                        id="bank-name"
                        type="text"
                        className="ss-input"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        placeholder="e.g. HDFC Bank Adyar Branch"
                      />
                    </div>
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* STEP 6: INSURANCE NOMINEE DETAILS */}
          {step === 6 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              <div>
                <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>Insurance Nominee</h1>
                <p className="text-secondary" style={{ fontSize: '14px' }}>
                  Cooperative member accident & healthcare insurance scheme details.
                </p>
              </div>

              {/* Plain Language Reassurance Card */}
              <div style={{
                background: '#F0FDF4',
                border: '1.5px solid #22C55E',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-md)',
                display: 'flex',
                gap: 'var(--space-sm)',
                alignItems: 'flex-start'
              }}>
                <ShieldCheck size={22} color="#16A34A" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#15803D' }}>
                    ₹5,00,000 Cooperative On-Duty Insurance
                  </div>
                  <p style={{ fontSize: '13px', color: '#333333', margin: '2px 0 0' }}>
                    This person receives your insurance and medical welfare benefit if something happens to you on duty.
                  </p>
                </div>
              </div>

              <Card padding="md">
                <div className="ss-form-group">
                  <label className="ss-label" htmlFor="nominee-name">Nominee Full Name</label>
                  <input
                    id="nominee-name"
                    type="text"
                    className="ss-input"
                    value={nomineeName}
                    onChange={(e) => setNomineeName(e.target.value)}
                    placeholder="e.g. Sunita Patil"
                  />
                </div>

                <div className="ss-form-group">
                  <label className="ss-label">Relationship with You</label>
                  <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                    {relationshipOptions.map((rel) => (
                      <button
                        key={rel}
                        type="button"
                        onClick={() => setNomineeRelation(rel)}
                        style={{
                          flex: 1,
                          padding: '8px 4px',
                          borderRadius: 'var(--radius-sm)',
                          background: nomineeRelation === rel ? 'var(--color-black)' : 'var(--color-bg)',
                          color: nomineeRelation === rel ? 'white' : 'var(--color-black)',
                          border: '1px solid var(--color-border)',
                          fontWeight: 'bold',
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        {rel}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="ss-form-group" style={{ marginBottom: 0 }}>
                  <label className="ss-label" htmlFor="nominee-payout">Nominee Bank Account / UPI ID</label>
                  <input
                    id="nominee-payout"
                    type="text"
                    className="ss-input"
                    value={nomineePayout}
                    onChange={(e) => setNomineePayout(e.target.value)}
                    placeholder="e.g. sunita.patil@okaxis"
                  />
                </div>
              </Card>
            </div>
          )}

          {/* STEP 7: WEEKLY AVAILABILITY */}
          {step === 7 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              <div>
                <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>Weekly Availability</h1>
                <p className="text-secondary" style={{ fontSize: '14px' }}>
                  Mark at least one open time slot so customers can find and book you.
                </p>
              </div>

              <Card padding="md">
                <div style={{ display: 'flex', gap: 'var(--space-xs)', marginBottom: 'var(--space-sm)' }}>
                  <button type="button" onClick={setAllAvailable} style={{ padding: '4px 8px', borderRadius: '4px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
                    Mark All Available
                  </button>
                  <button type="button" onClick={setWeekendOff} style={{ padding: '4px 8px', borderRadius: '4px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
                    Set Weekends Off
                  </button>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'center' }}>
                    <thead>
                      <tr style={{ background: 'var(--color-bg)', borderBottom: '1.5px solid var(--color-border)' }}>
                        <th style={{ padding: '8px 4px', textAlign: 'left', fontWeight: 'bold' }}>Day</th>
                        {SLOTS.map((slot) => (
                          <th key={slot.id} style={{ padding: '8px 4px', fontWeight: 'bold' }}>
                            {slot.label}<br /><span style={{ fontSize: '10px', color: '#757575' }}>{slot.hours}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {DAYS.map((day) => {
                        const isWeekend = day.key === 'sat' || day.key === 'sun';
                        return (
                          <tr key={day.key} style={{ borderBottom: '1px solid var(--color-border)', background: isWeekend ? '#FAF8F5' : 'white' }}>
                            <td style={{ padding: '8px 4px', textAlign: 'left', fontWeight: 'bold' }}>{day.label}</td>
                            {SLOTS.map((slot) => {
                              const isOpen = availabilityGrid[day.key]?.[slot.id];
                              return (
                                <td key={slot.id} style={{ padding: '4px' }}>
                                  <button
                                    type="button"
                                    onClick={() => toggleGridCell(day.key, slot.id)}
                                    style={{
                                      width: '100%',
                                      padding: '6px 0',
                                      borderRadius: '4px',
                                      border: 'none',
                                      background: isOpen ? 'var(--color-success-bg)' : 'var(--color-bg)',
                                      color: isOpen ? 'var(--color-success)' : '#9E9E9E',
                                      fontWeight: 'bold',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    {isOpen ? '✓ Open' : '- Off'}
                                  </button>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {!hasAnyOpenSlot(availabilityGrid) && (
                  <div style={{ marginTop: 'var(--space-sm)', fontSize: '12px', color: '#9A3412', background: '#FFF7ED', border: '1px solid #FDBA74', borderRadius: 'var(--radius-sm)', padding: '8px 10px' }}>
                    Mark at least one slot open to continue.
                  </div>
                )}
              </Card>

              {registerError && (
                <div style={{ fontSize: '13px', color: 'var(--color-danger)', fontWeight: 600 }}>
                  {registerError}
                </div>
              )}
            </div>
          )}

          {/* STEP 8: SUBMITTED SCREEN */}
          {step === 8 && (
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', padding: '20px 0' }}>
              
              {/* Illustration Badge */}
              <div style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: 'var(--color-accent-subtle)',
                color: 'var(--color-accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto'
              }}>
                <ShieldCheck size={48} strokeWidth={2.2} />
              </div>

              <div>
                <Badge variant="active" style={{ marginBottom: '8px' }}>
                  Application Under Review
                </Badge>
                <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: '4px 0 8px' }}>
                  Your application has been submitted for verification!
                </h1>
                <p className="text-secondary" style={{ fontSize: '14px', lineHeight: 1.5 }}>
                  The <strong>Chennai Labour Cooperative Society (Ward 4)</strong> is reviewing your ID documents and trade credentials.
                </p>
              </div>

              <Card padding="md" style={{ textAlign: 'left', background: 'var(--color-white)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="text-secondary">Applicant Name:</span>
                    <span className="text-bold">{name}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="text-secondary">Registered Trade:</span>
                    <span className="text-bold">{skills.join(', ')}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="text-secondary">Status:</span>
                    <span style={{ color: 'var(--color-accent)', fontWeight: 'bold' }}>⏳ Pending Verification</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="text-secondary">Estimated Approval:</span>
                    <span className="text-bold">Within 12–24 Hours</span>
                  </div>
                </div>
              </Card>

              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                💡 You can explore the worker dashboard while verification is in progress.
              </div>

            </div>
          )}
        </div>

        {/* 3. BOTTOM CTA BUTTON */}
        <div style={{ marginTop: 'var(--space-lg)' }}>
          {step < 8 ? (
            <Button
              variant="primary"
              size="large"
              icon={registering ? undefined : ArrowRight}
              iconPosition="right"
              fullWidth
              onClick={handleNext}
              disabled={
                registering ||
                (step === 1 && (!otpSent || otp.some((d) => !d) || password.length < 6 || password !== confirmPassword)) ||
                (step === 7 && !hasAnyOpenSlot(availabilityGrid))
              }
            >
              {step === 1 && 'Continue to Personal Details'}
              {step === 2 && 'Continue to Skills & Trade'}
              {step === 3 && 'Continue to Documents'}
              {step === 4 && 'Continue to Payout Info'}
              {step === 5 && 'Continue to Insurance Nominee'}
              {step === 6 && 'Continue to Availability'}
              {step === 7 && (registering ? 'Creating Account...' : 'Submit Application for Review')}
            </Button>
          ) : (
            <Button
              variant="primary"
              size="large"
              icon={Building2}
              fullWidth
              onClick={() => navigate('/worker')}
            >
              Go to Dashboard
            </Button>
          )}
        </div>

      </main>
    </Card>
  </div>
</div>
  );
};

export default WorkerRegistrationFlow;
