import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Camera,
  ShieldCheck,
  ShieldAlert,
  Clock,
  CheckCircle2,
  AlertCircle,
  Eye,
  Save,
  ArrowRight,
  Loader2,
  Wallet,
  Landmark
} from 'lucide-react';
import { Button, Card, Badge } from '../../../components';
import { useWorker } from '../context/WorkerContext';
import { useAuth } from '../../../context/AuthContext';

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

const AVAILABLE_SKILLS = [
  'Home Electrical Wiring',
  'Fan & Light Fitting',
  'MCB Tripping & Fuse Fix',
  'Inverter Line Setup',
  'Appliance Safety Check',
  'Switchboard Replacement',
  'Plumbing & Pipe Fitting',
  'Carpentry & Wood Repair',
  'Deep House Cleaning',
  'Driver Assistance'
];

const LANGUAGE_OPTIONS = ['Tamil', 'English', 'Hindi', 'Telugu', 'Malayalam', 'Kannada', 'Marathi'];

const RADIUS_OPTIONS = [
  { value: 2, label: '2 km (Local Ward)' },
  { value: 5, label: '5 km (Standard)' },
  { value: 10, label: '10 km (Extended)' },
  { value: 15, label: '15 km (Whole City)' }
];

const emptyGrid = () => {
  const grid = {};
  DAYS.forEach((d) => { grid[d.key] = { morning: false, afternoon: false, evening: false }; });
  return grid;
};

// Merges whatever the backend sent (a Mongoose Map serializes to a plain
// object keyed by day) onto a fully-populated empty grid, so a day the
// worker has never touched renders as "- Off" instead of being missing
// from the table entirely.
const gridFromWorker = (weeklyAvailability) => {
  const grid = emptyGrid();
  if (!weeklyAvailability) return grid;
  DAYS.forEach((d) => {
    const day = weeklyAvailability[d.key];
    if (day) grid[d.key] = { morning: Boolean(day.morning), afternoon: Boolean(day.afternoon), evening: Boolean(day.evening) };
  });
  return grid;
};

const hasAnyOpenSlot = (grid) => Object.values(grid).some((d) => d.morning || d.afternoon || d.evening);

const VERIFICATION_META = {
  verified: { label: 'Verified Cooperative Worker', color: 'var(--color-success)', bg: '#F9FFF9', border: '#22C55E', Icon: ShieldCheck },
  pending: { label: 'Documents Under Review', color: 'var(--color-accent)', bg: '#FFFDF9', border: 'var(--color-accent)', Icon: Clock },
  rejected: { label: 'Verification Rejected', color: 'var(--color-danger)', bg: '#FFF0ED', border: 'var(--color-danger)', Icon: ShieldAlert },
  unsubmitted: { label: 'Not Submitted Yet', color: 'var(--color-text-secondary)', bg: 'var(--color-bg)', border: 'var(--color-border)', Icon: AlertCircle }
};

export const SkillProfile = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { worker, updateWorker } = useWorker();
  const { currentUser } = useAuth();

  // Set when WorkerShell's profile-completion gate redirected here — see
  // WorkerShell.jsx's PROFILE_GATE_ALLOWLIST effect.
  const [gateToast, setGateToast] = useState(location.state?.toastMessage || null);

  const [name, setName] = useState(worker.name || currentUser?.name || '');
  const [phone, setPhone] = useState(worker.phone || currentUser?.phone || '');
  const [avatar, setAvatar] = useState(worker.avatar || currentUser?.avatar || 'W');

  const [selectedSkills, setSelectedSkills] = useState(worker.skills || []);
  const [experience, setExperience] = useState(worker.experience ? String(worker.experience).replace(/[^0-9]/g, '') : '');
  const [selectedLanguages, setSelectedLanguages] = useState(worker.languages || []);
  const [selectedRadius, setSelectedRadius] = useState(worker.serviceRadius ?? null);
  const [availabilityGrid, setAvailabilityGrid] = useState(gridFromWorker(worker.weeklyAvailability));

  const [payoutType, setPayoutType] = useState(worker.paymentDetails?.payoutType || 'upi');
  const [upiId, setUpiId] = useState(worker.paymentDetails?.upiId || '');
  const [accountNumber, setAccountNumber] = useState(worker.paymentDetails?.bankAccount?.accountNumber || '');
  const [ifsc, setIfsc] = useState(worker.paymentDetails?.bankAccount?.ifsc || '');
  const [bankName, setBankName] = useState(worker.paymentDetails?.bankAccount?.bankName || '');

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Hydrate local editable state from the real worker record once it loads
  // (or changes after a save) — this is the only place these fields come
  // from; nothing here is a hardcoded fallback anymore.
  useEffect(() => {
    const activeName = currentUser?.name || worker?.name || 'Worker Member';
    setName(activeName);
    setPhone(currentUser?.phone || worker?.phone || '');
    setAvatar(currentUser?.avatar || worker?.avatar || activeName.split(' ').map((n) => n[0]).join('').toUpperCase() || 'W');
    setSelectedSkills(worker?.skills || []);
    setExperience(worker?.experience ? String(worker.experience).replace(/[^0-9]/g, '') : '');
    setSelectedLanguages(worker?.languages || []);
    setSelectedRadius(worker?.serviceRadius ?? null);
    setAvailabilityGrid(gridFromWorker(worker?.weeklyAvailability));
    setPayoutType(worker?.paymentDetails?.payoutType || 'upi');
    setUpiId(worker?.paymentDetails?.upiId || '');
    setAccountNumber(worker?.paymentDetails?.bankAccount?.accountNumber || '');
    setIfsc(worker?.paymentDetails?.bankAccount?.ifsc || '');
    setBankName(worker?.paymentDetails?.bankAccount?.bankName || '');
  }, [currentUser, worker]);

  const toggleSkill = (skill) => {
    setSelectedSkills((prev) => (prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]));
  };

  const toggleLanguage = (lang) => {
    setSelectedLanguages((prev) => (prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]));
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

  const hasPayment = payoutType === 'bank' ? Boolean(accountNumber && ifsc) : Boolean(upiId);

  // Same rule the backend uses (WorkerService.isProfileDataComplete) —
  // purely a UX hint here; the server recomputes and enforces it itself.
  const missingFields = [
    selectedSkills.length === 0 && 'at least one skill',
    !experience && 'years of experience',
    selectedLanguages.length === 0 && 'at least one language',
    selectedRadius === null && 'a service radius',
    !hasAnyOpenSlot(availabilityGrid) && 'an open availability slot',
    !hasPayment && 'a payment method'
  ].filter(Boolean);

  const handleSaveChanges = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    setSaveError('');
    setSavedSuccess(false);
    const result = await updateWorker({
      name,
      phone,
      skills: selectedSkills,
      experience: experience ? `${experience} years` : '',
      languages: selectedLanguages,
      serviceRadius: selectedRadius,
      weeklyAvailability: availabilityGrid,
      paymentDetails: {
        payoutType,
        upiId,
        bankAccount: { accountNumber, ifsc, bankName }
      }
    });
    if (result?.success) {
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } else {
      setSaveError(result?.error?.response?.data?.message || 'Could not save profile changes. Please try again.');
    }
    setSaving(false);
  };

  const verificationStatus = worker.verificationStatus || 'unsubmitted';
  const vMeta = VERIFICATION_META[verificationStatus] || VERIFICATION_META.unsubmitted;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', paddingBottom: 'var(--space-xl)' }}>

      {gateToast && (
        <div style={{
          background: 'var(--color-black)',
          color: 'white',
          padding: '10px 14px',
          borderRadius: 'var(--radius-sm)',
          fontSize: '13px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>{gateToast}</span>
          <button
            type="button"
            onClick={() => setGateToast(null)}
            style={{ color: 'var(--color-accent)', background: 'none', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* 1. TOP HEADER & "PREVIEW AS CUSTOMER SEES IT" CTA */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-xs)' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 'bold', margin: '0 0 2px' }}>
            My Skill Profile
          </h1>
          <p className="text-secondary" style={{ fontSize: '13px', margin: 0 }}>
            Edit your trade skills, certifications, and availability schedule
          </p>
        </div>

        <Button
          variant="primary"
          size="small"
          icon={Eye}
          onClick={() => navigate('/worker/profile/preview')}
        >
          Preview as customer sees it
        </Button>
      </div>

      {missingFields.length > 0 && (
        <div style={{
          background: '#FFF7ED',
          border: '1px solid #FDBA74',
          color: '#9A3412',
          padding: '10px 14px',
          borderRadius: 'var(--radius-sm)',
          fontSize: '12px',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 6
        }}>
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span>Profile incomplete — add {missingFields.join(', ')} before you can go online and receive jobs.</span>
        </div>
      )}

      {savedSuccess && (
        <div style={{
          background: 'var(--color-success-bg)',
          border: '1px solid var(--color-success)',
          color: 'var(--color-success)',
          padding: '10px 14px',
          borderRadius: 'var(--radius-sm)',
          fontSize: '13px',
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          gap: 6
        }}>
          <CheckCircle2 size={18} />
          <span>Profile changes saved and updated in cooperative directory!</span>
        </div>
      )}

      {saveError && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-danger)', fontSize: '13px', fontWeight: 600 }}>
          <AlertCircle size={16} />
          <span>{saveError}</span>
        </div>
      )}

      {/* 2. NAME + PHOTO */}
      <Card padding="md">
        <h2 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: 'var(--space-sm)' }}>
          1. Worker Identification
        </h2>

        <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
          <div style={{ position: 'relative' }}>
            <div style={{
              width: 70,
              height: 70,
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-black)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '26px',
              fontWeight: 'bold'
            }}>
              {avatar}
            </div>
            <button
              type="button"
              onClick={() => alert('Photo change dialog: Select an updated portrait')}
              style={{
                position: 'absolute',
                bottom: -4,
                right: -4,
                width: 26,
                height: 26,
                borderRadius: '50%',
                background: 'var(--color-accent)',
                color: 'white',
                border: '2px solid white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
              title="Change Profile Photo"
            >
              <Camera size={13} />
            </button>
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: vMeta.color, fontSize: '12px', fontWeight: 600 }}>
              <vMeta.Icon size={14} />
              <span>{vMeta.label}</span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: 2 }}>
              {worker.societyReg || 'Chennai Labour Cooperative'} — {worker.locality || 'Ward 4, Chennai'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
          <div className="ss-form-group" style={{ marginBottom: 0 }}>
            <label className="ss-label" htmlFor="skill-name">Full Name (Shown to Customers)</label>
            <input
              id="skill-name"
              type="text"
              className="ss-input"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                const initials = e.target.value.split(' ').map((n) => n[0]).join('').toUpperCase();
                if (initials) setAvatar(initials.slice(0, 2));
              }}
            />
          </div>

          <div className="ss-form-group" style={{ marginBottom: 0 }}>
            <label className="ss-label" htmlFor="skill-phone">Contact Number</label>
            <input
              id="skill-phone"
              type="text"
              className="ss-input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
        </div>
      </Card>

      {/* 3. SKILLS */}
      <Card padding="md">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 'var(--space-xs)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 'bold' }}>2. Trade Skills & Specialties</h2>
          <span className="text-secondary" style={{ fontSize: '12px' }}>{selectedSkills.length} selected</span>
        </div>
        <p className="text-secondary" style={{ fontSize: '12px', margin: '0 0 var(--space-sm)' }}>
          Tap chips to add or remove trade specialties displayed on your public profile.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {AVAILABLE_SKILLS.map((sk) => {
            const isSelected = selectedSkills.includes(sk);
            return (
              <button
                key={sk}
                type="button"
                onClick={() => toggleSkill(sk)}
                style={{
                  padding: '7px 12px',
                  borderRadius: 'var(--radius-full)',
                  background: isSelected ? 'var(--color-accent-subtle)' : 'var(--color-bg)',
                  color: isSelected ? 'var(--color-accent)' : 'var(--color-black)',
                  border: `1.5px solid ${isSelected ? 'var(--color-accent)' : 'var(--color-border)'}`,
                  fontSize: '13px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {isSelected ? `✓ ${sk}` : `+ ${sk}`}
              </button>
            );
          })}
        </div>
      </Card>

      {/* 4. EXPERIENCE */}
      <Card padding="md">
        <h2 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: 'var(--space-xs)' }}>3. Professional Experience</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
          <input
            type="number"
            className="ss-input"
            value={experience}
            onChange={(e) => setExperience(e.target.value)}
            min={0}
            max={45}
            placeholder="—"
            style={{ width: '90px', fontSize: '18px', fontWeight: 'bold' }}
          />
          <div>
            <span style={{ fontSize: '14px', fontWeight: 'bold' }}>Years of Experience</span>
            <div className="text-secondary" style={{ fontSize: '12px' }}>
              Feeds directly into the Smart Match ranking algorithm
            </div>
          </div>
        </div>
      </Card>

      {/* 5. VERIFICATION SUMMARY — links to the real upload/review pipeline */}
      <Card padding="md" style={{ border: `1.5px solid ${vMeta.border}`, background: vMeta.bg }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-sm)' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: 'var(--color-white)', color: vMeta.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}>
              <vMeta.Icon size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '14px' }}>4. Verification Documents</div>
              <div className="text-secondary" style={{ fontSize: '12px' }}>
                {vMeta.label} • {worker.documents?.length || 0} document{(worker.documents?.length || 0) === 1 ? '' : 's'} submitted
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            size="small"
            icon={ArrowRight}
            iconPosition="right"
            onClick={() => navigate('/worker/verification')}
          >
            Manage
          </Button>
        </div>
      </Card>

      {/* 6. LANGUAGES */}
      <Card padding="md">
        <h2 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: 'var(--space-xs)' }}>5. Languages Spoken</h2>
        <p className="text-secondary" style={{ fontSize: '12px', margin: '0 0 var(--space-sm)' }}>
          Select languages you comfortably communicate in with customers.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {LANGUAGE_OPTIONS.map((lang) => {
            const isSelected = selectedLanguages.includes(lang);
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
      </Card>

      {/* 7. SERVICE RADIUS */}
      <Card padding="md">
        <h2 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: 'var(--space-xs)' }}>6. Service Working Radius</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-xs)' }}>
          {RADIUS_OPTIONS.map((rad) => (
            <button
              key={rad.value}
              type="button"
              onClick={() => setSelectedRadius(rad.value)}
              style={{
                padding: '10px 8px',
                borderRadius: 'var(--radius-sm)',
                background: selectedRadius === rad.value ? 'var(--color-accent-subtle)' : 'var(--color-bg)',
                border: `1.5px solid ${selectedRadius === rad.value ? 'var(--color-accent)' : 'var(--color-border)'}`,
                fontSize: '12px',
                fontWeight: 'bold',
                color: selectedRadius === rad.value ? 'var(--color-accent)' : 'var(--color-black)',
                cursor: 'pointer'
              }}
            >
              {rad.label}
            </button>
          ))}
        </div>
      </Card>

      {/* 8. WEEKLY AVAILABILITY GRID */}
      <Card padding="md">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-xs)' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0 }}>7. Weekly Availability Schedule</h2>
            <p className="text-secondary" style={{ fontSize: '12px', margin: '2px 0 0' }}>
              Tap any block to mark available (✓) or unavailable (-)
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-xs)', margin: 'var(--space-sm) 0' }}>
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
      </Card>

      {/* 8. PAYMENT METHODS */}
      <Card padding="md">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 'var(--space-xs)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0 }}>8. Payment Methods</h2>
          {worker.paymentDetails?.verificationStatus === 'verified' ? (
            <Badge variant="success" style={{ fontSize: '10px' }}>✓ Verified for Instant Auto-Credit</Badge>
          ) : (
            <Badge variant="active" style={{ fontSize: '10px' }}>Pending Admin Verification</Badge>
          )}
        </div>
        <p className="text-secondary" style={{ fontSize: '12px', margin: '0 0 var(--space-sm)' }}>
          Where your 95% direct job earnings and cooperative welfare withdrawals are paid out.
        </p>

        <div style={{ display: 'flex', gap: 'var(--space-xs)', marginBottom: 'var(--space-md)' }}>
          <button
            type="button"
            onClick={() => setPayoutType('upi')}
            style={{
              flex: 1,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '10px',
              borderRadius: 'var(--radius-sm)',
              background: payoutType === 'upi' ? 'var(--color-black)' : 'var(--color-bg)',
              color: payoutType === 'upi' ? 'white' : 'var(--color-black)',
              fontWeight: 'bold',
              border: '1px solid var(--color-border)',
              cursor: 'pointer'
            }}
          >
            <Wallet size={14} />
            <span>UPI ID</span>
          </button>
          <button
            type="button"
            onClick={() => setPayoutType('bank')}
            style={{
              flex: 1,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '10px',
              borderRadius: 'var(--radius-sm)',
              background: payoutType === 'bank' ? 'var(--color-black)' : 'var(--color-bg)',
              color: payoutType === 'bank' ? 'white' : 'var(--color-black)',
              fontWeight: 'bold',
              border: '1px solid var(--color-border)',
              cursor: 'pointer'
            }}
          >
            <Landmark size={14} />
            <span>Bank Account</span>
          </button>
        </div>

        {payoutType === 'upi' ? (
          <div className="ss-form-group" style={{ marginBottom: 0 }}>
            <label className="ss-label" htmlFor="skill-upi">UPI ID (VPA)</label>
            <input
              id="skill-upi"
              type="text"
              className="ss-input"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              placeholder="e.g. mobile@upi or name@okhdfcbank"
            />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            <div className="ss-form-group" style={{ marginBottom: 0 }}>
              <label className="ss-label" htmlFor="skill-bank-acc">Bank Account Number</label>
              <input
                id="skill-bank-acc"
                type="text"
                className="ss-input"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="e.g. 918273645521"
              />
            </div>
            <div className="ss-form-group" style={{ marginBottom: 0 }}>
              <label className="ss-label" htmlFor="skill-bank-ifsc">IFSC Code</label>
              <input
                id="skill-bank-ifsc"
                type="text"
                className="ss-input"
                value={ifsc}
                onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                placeholder="e.g. HDFC0001824"
              />
            </div>
            <div className="ss-form-group" style={{ marginBottom: 0 }}>
              <label className="ss-label" htmlFor="skill-bank-name">Bank & Branch Name</label>
              <input
                id="skill-bank-name"
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

      {/* 9. SAVE */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
        <Button
          variant="primary"
          size="large"
          icon={saving ? Loader2 : Save}
          fullWidth
          disabled={saving}
          onClick={handleSaveChanges}
        >
          {saving ? 'Saving...' : 'Save Profile Changes'}
        </Button>

        <Button
          variant="outline"
          fullWidth
          icon={Eye}
          onClick={() => navigate('/worker/profile/preview')}
        >
          Preview as customer sees it
        </Button>
      </div>

    </div>
  );
};

export default SkillProfile;
