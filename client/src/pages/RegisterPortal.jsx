import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  User,
  HardHat,
  Lock,
  Phone,
  Mail,
  MapPin,
  Briefcase,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  FileCheck2,
  Eye,
  EyeOff,
  Scale,
  Check,
  Award,
  ArrowLeft,
  X,
  HeartHandshake
} from 'lucide-react';
import { Button, Card, Badge } from '../components';
import { useAuth } from '../context/AuthContext';

export const RegisterPortal = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { register, isLoading, authError } = useAuth();

  const initialRoleParam = searchParams.get('role');
  const initialRole = ['customer', 'worker'].includes(initialRoleParam) ? initialRoleParam : 'customer';
  const [selectedRole, setSelectedRole] = useState(initialRole);

  // Common Fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState(searchParams.get('phone') || '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [locality, setLocality] = useState('Ward 4, Adyar, Chennai');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreedToCharter, setAgreedToCharter] = useState(false);

  // Role-Specific Fields
  // Customer:
  const [userCategory, setUserCategory] = useState('household'); // 'household' | 'institution'

  // Worker:
  const [skill, setSkill] = useState('Electrician');
  const [experience, setExperience] = useState('3 years');

  const [localError, setLocalError] = useState('');
  const [successToast, setSuccessToast] = useState('');
  const [showCharterModal, setShowCharterModal] = useState(false);

  // Sync role from query params
  useEffect(() => {
    const roleParam = searchParams.get('role');
    if (roleParam && ['customer', 'worker'].includes(roleParam)) {
      setSelectedRole(roleParam);
    }
  }, [searchParams]);

  const handleRoleChange = (role) => {
    setSelectedRole(role);
    setLocalError('');
  };

  // Calculate real-time password strength
  const calculatePasswordStrength = (pwd) => {
    if (!pwd) return { score: 0, label: 'None', className: '' };
    let score = 0;
    if (pwd.length >= 6) score += 1;
    if (pwd.length >= 8) score += 1;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score += 1;
    if (/\d/.test(pwd) || /[^A-Za-z0-9]/.test(pwd)) score += 1;

    if (score <= 1) return { score: 1, label: 'Weak', className: 'weak' };
    if (score === 2) return { score: 2, label: 'Fair', className: 'fair' };
    if (score === 3) return { score: 3, label: 'Good', className: 'good' };
    return { score: 4, label: 'Strong', className: 'strong' };
  };

  const passwordStrength = calculatePasswordStrength(password);
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');

    if (!name.trim()) {
      setLocalError('Please enter your full name.');
      return;
    }
    if (!phone.trim() || phone.length < 8) {
      setLocalError('Please enter a valid 10-digit mobile number.');
      return;
    }
    if (!password.trim() || password.length < 6) {
      setLocalError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setLocalError('Passwords do not match. Please re-enter.');
      return;
    }
    if (!agreedToCharter) {
      setLocalError('Please accept the Cooperative Bylaws and Fair Labor Charter to continue.');
      return;
    }

    const payload = {
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim() ? email.trim() : `${phone.replace(/\D/g, '')}@workhive.local`,
      password,
      role: selectedRole,
      locality: locality.trim(),
      userCategory,
      skill: selectedRole === 'worker' ? skill : '',
      experience: selectedRole === 'worker' ? experience : ''
    };

    const res = await register(payload);
    if (res.success) {
      setSuccessToast(`Account created successfully as ${selectedRole.toUpperCase()}! Welcome to WorkHive.`);
      setTimeout(() => {
        if (selectedRole === 'worker') navigate('/worker/verification');
        else navigate('/customer/home');
      }, 600);
    } else {
      setLocalError(res.error);
    }
  };

  const roles = [
    { id: 'customer', label: 'Customer', icon: User, tagline: 'Book Verified Helpers', color: 'var(--color-accent)' },
    { id: 'worker', label: 'Worker Member', icon: HardHat, tagline: 'Direct UPI Earnings', color: 'var(--color-success)' }
  ];

  const rolePerks = {
    customer: [
      'Fair, transparent service rates standardized by the community',
      'Government-registered & trade-certified cooperative technicians',
      '12-minute Emergency SOS immediate response in Ward 4',
      'Zero platform commission markup on your invoice'
    ],
    worker: [
      '95% direct take-home pay transferred immediately to your UPI',
      '₹5,00,000 comprehensive family health & accidental insurance',
      'Access to Cooperative Welfare Emergency Grants (0% interest)',
      '1-Worker 1-Vote democratic participation in all policy resolutions'
    ]
  };

  return (
    <div className="wh-auth-page">
      {/* 1. TOP NAVBAR / BACK NAVIGATION */}
      <nav className="wh-auth-top-nav" aria-label="Registration navigation">
        <Link to="/" className="wh-auth-back-link">
          <ArrowLeft size={16} color="var(--color-accent)" />
          <span>Back to Homepage</span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Badge variant="active" style={{ fontSize: '12px' }}>
            <Award size={12} />
            <span>Cooperative Membership</span>
          </Badge>
        </div>
      </nav>

      {/* 2. MAIN RESPONSIVE TWO-COLUMN LAYOUT */}
      <main className="wh-auth-layout">
        
        {/* LEFT COLUMN: HERO SHOWCASE (Desktop >= 1024px) */}
        <aside className="wh-auth-hero" aria-label="Membership benefits">
          <div>
            <div className="wh-hero-brand">
              <div className="wh-hero-logo">
                <img src="/logo.png" alt="WorkHive Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </div>
              <div>
                <h1 className="wh-hero-title">WorkHive</h1>
                <div className="wh-hero-sub">Cooperative Labor & Services Society</div>
              </div>
            </div>

            <h2 style={{ fontSize: '22px', fontWeight: 'bold', margin: '0 0 10px', color: 'var(--color-black)', letterSpacing: '-0.01em' }}>
              Empowering Members, Eradicating Exploitation
            </h2>
            <p className="text-secondary" style={{ fontSize: '14px', lineHeight: 1.5, margin: '0 0 var(--space-lg)' }}>
              WorkHive is governed by its workers and service recipients. When you sign up, you become a registered participant in Chennai's audited cooperative ecosystem.
            </p>

            {/* Dynamic Role Perks Card */}
            <div className="wh-hero-perk-card">
              <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: 8, letterSpacing: '0.04em' }}>
                Included {selectedRole.toUpperCase()} Membership Rights:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {rolePerks[selectedRole].map((perk, pIdx) => (
                  <div key={pIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: '13px', color: 'var(--color-black)', fontWeight: 500 }}>
                    <Check size={16} color="var(--color-success)" style={{ flexShrink: 0, marginTop: 2 }} />
                    <span>{perk}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Trust Banner & Statistics */}
          <div>
            <div className="wh-hero-stats-grid">
              <div className="wh-hero-stat-box">
                <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-accent)' }}>100% Direct</div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Zero Commercial Intermediaries</div>
              </div>
              <div className="wh-hero-stat-box">
                <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-success)' }}>₹5L Cover</div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Welfare & Insurance Shield</div>
              </div>
            </div>

            <div style={{ marginTop: 'var(--space-md)', display: 'flex', alignItems: 'center', gap: 6, fontSize: '12px', color: 'var(--color-text-secondary)' }}>
              <ShieldCheck size={16} color="#16A34A" />
              <span>Registered under Tamil Nadu Cooperative Societies Act #TN-CHE-2024</span>
            </div>
          </div>
        </aside>

        {/* RIGHT COLUMN: REGISTRATION FORM CARD */}
        <section className="wh-auth-card" aria-label="Sign up form">
          
          {/* Mobile Brand Header */}
          <div className="wh-auth-mobile-header">
            <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
              <div style={{ width: 44, height: 44 }}>
                <img src="/logo.png" alt="WorkHive Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </div>
              <div style={{ textAlign: 'left' }}>
                <span style={{ fontSize: '22px', fontWeight: 'bold', color: 'var(--color-black)', display: 'block', lineHeight: 1.1 }}>
                  WorkHive
                </span>
                <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                  Cooperative Registration Portal
                </span>
              </div>
            </Link>
          </div>

          <div style={{ marginBottom: 'var(--space-md)' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 4px', letterSpacing: '-0.01em' }}>
              Create Account
            </h2>
            <p className="text-secondary" style={{ fontSize: '13px', margin: 0 }}>
              Select your membership category to initialize your profile
            </p>
          </div>

          {/* 3-ROLE SELECTOR TABS */}
          <div className="wh-role-selector" role="tablist" aria-label="Membership role selector">
            {roles.map((r) => {
              const Icon = r.icon;
              const isSelected = selectedRole === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  className={`wh-role-btn ${isSelected ? 'active' : ''}`}
                  onClick={() => handleRoleChange(r.id)}
                >
                  <div className="wh-role-btn-icon">
                    <Icon size={18} />
                  </div>
                  <span className="wh-role-btn-label">{r.label}</span>
                  <span className="wh-role-btn-tag">{r.tagline}</span>
                </button>
              );
            })}
          </div>

          {/* SUCCESS FEEDBACK */}
          {successToast && (
            <div style={{
              background: 'var(--color-success-bg)',
              border: '1px solid var(--color-success)',
              color: 'var(--color-success)',
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              fontSize: '13px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 'var(--space-md)'
            }} role="status">
              <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
              <span>{successToast}</span>
            </div>
          )}

          {/* ERROR ALERT */}
          {(localError || authError) && (
            <div style={{
              background: 'var(--color-danger-bg)',
              border: '1px solid var(--color-danger)',
              color: 'var(--color-danger)',
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              fontSize: '13px',
              marginBottom: 'var(--space-md)'
            }} role="alert" aria-live="assertive">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                <AlertCircle size={18} style={{ flexShrink: 0 }} />
                <span>{localError || authError}</span>
              </div>
              {((localError || authError || '').toLowerCase().includes('already exists') ||
                (localError || authError || '').toLowerCase().includes('sign in')) && (
                <div style={{ marginTop: 8 }}>
                  <Link
                    to={`/login?role=${selectedRole}&identifier=${encodeURIComponent(phone)}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      color: 'var(--color-danger)',
                      fontWeight: 700,
                      textDecoration: 'underline',
                      fontSize: '12px'
                    }}
                  >
                    Sign in with existing {selectedRole.toUpperCase()} account →
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* REGISTRATION FORM */}
          <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            
            {/* Full Name */}
            <div className="ss-form-group" style={{ marginBottom: 0 }}>
              <label className="ss-label" htmlFor="reg-name">
                Full Name
                <span style={{ color: 'var(--color-danger)', marginLeft: 3 }}>*</span>
              </label>
              <div className="wh-input-wrapper">
                <span className="wh-input-icon">
                  <User size={18} />
                </span>
                <input
                  id="reg-name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  className={`wh-input ${(localError && !name) ? 'invalid' : ''}`}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={selectedRole === 'worker' ? 'e.g. Ramesh Patil' : 'e.g. Anand Kulkarni'}
                  required
                />
              </div>
            </div>

            {/* Mobile Number & Email (2-Column Grid on Tablet/Desktop) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-sm)' }}>
              <div className="ss-form-group" style={{ marginBottom: 0 }}>
                <label className="ss-label" htmlFor="reg-phone">
                  Mobile Number
                  <span style={{ color: 'var(--color-danger)', marginLeft: 3 }}>*</span>
                </label>
                <div className="wh-input-wrapper">
                  <span className="wh-input-icon">
                    <Phone size={18} />
                  </span>
                  <input
                    id="reg-phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    className={`wh-input ${(localError && !phone) ? 'invalid' : ''}`}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98401 23456"
                    required
                  />
                </div>
              </div>

              <div className="ss-form-group" style={{ marginBottom: 0 }}>
                <label className="ss-label" htmlFor="reg-email">
                  Email Address
                  <span className="text-secondary" style={{ fontSize: '11px', fontWeight: 400, marginLeft: 4 }}>(Optional)</span>
                </label>
                <div className="wh-input-wrapper">
                  <span className="wh-input-icon">
                    <Mail size={18} />
                  </span>
                  <input
                    id="reg-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    className="wh-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@email.com"
                  />
                </div>
              </div>
            </div>

            {/* Role-Specific Custom Inputs */}
            {selectedRole === 'customer' && (
              <div className="ss-form-group" style={{ marginBottom: 0 }}>
                <label className="ss-label">Account Membership Type</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-xs)' }} role="radiogroup" aria-label="Customer account type">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={userCategory === 'household'}
                    onClick={() => setUserCategory('household')}
                    style={{
                      minHeight: '44px',
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-sm)',
                      border: `1.5px solid ${userCategory === 'household' ? 'var(--color-accent)' : 'var(--color-border)'}`,
                      background: userCategory === 'household' ? 'var(--color-accent-subtle)' : 'var(--color-white)',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6
                    }}
                  >
                    <span>🏡</span>
                    <span>Household Resident</span>
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={userCategory === 'institution'}
                    onClick={() => setUserCategory('institution')}
                    style={{
                      minHeight: '44px',
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-sm)',
                      border: `1.5px solid ${userCategory === 'institution' ? 'var(--color-accent)' : 'var(--color-border)'}`,
                      background: userCategory === 'institution' ? 'var(--color-accent-subtle)' : 'var(--color-white)',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6
                    }}
                  >
                    <span>🏢</span>
                    <span>Office / Society</span>
                  </button>
                </div>
              </div>
            )}

            {selectedRole === 'worker' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 'var(--space-sm)' }}>
                <div className="ss-form-group" style={{ marginBottom: 0 }}>
                  <label className="ss-label" htmlFor="reg-skill">
                    Primary Trade Skill
                    <span style={{ color: 'var(--color-danger)', marginLeft: 3 }}>*</span>
                  </label>
                  <div className="wh-input-wrapper">
                    <span className="wh-input-icon">
                      <Briefcase size={18} />
                    </span>
                    <select
                      id="reg-skill"
                      name="skill"
                      className="wh-input"
                      value={skill}
                      onChange={(e) => setSkill(e.target.value)}
                    >
                      <option value="Electrician">Electrician & Wiring</option>
                      <option value="Plumbing">Plumbing & Sanitary</option>
                      <option value="Carpentry">Carpentry & Woodwork</option>
                      <option value="Painting">Painting & Masonry</option>
                      <option value="Cleaning">Deep Home Cleaning</option>
                      <option value="Caregiving">Elderly & Patient Care</option>
                      <option value="Technician">Appliance Repair</option>
                      <option value="Driver">Professional Driver</option>
                    </select>
                  </div>
                </div>

                <div className="ss-form-group" style={{ marginBottom: 0 }}>
                  <label className="ss-label" htmlFor="reg-exp">Experience</label>
                  <input
                    id="reg-exp"
                    name="experience"
                    type="text"
                    className="wh-input"
                    value={experience}
                    onChange={(e) => setExperience(e.target.value)}
                    placeholder="e.g. 5 years"
                    style={{ paddingLeft: '14px' }}
                  />
                </div>
              </div>
            )}

            {/* Locality in Chennai */}
            <div className="ss-form-group" style={{ marginBottom: 0 }}>
              <label className="ss-label" htmlFor="reg-locality">
                Ward / Locality in Chennai
                <span style={{ color: 'var(--color-danger)', marginLeft: 3 }}>*</span>
              </label>
              <div className="wh-input-wrapper">
                <span className="wh-input-icon">
                  <MapPin size={18} />
                </span>
                <input
                  id="reg-locality"
                  name="locality"
                  type="text"
                  className="wh-input"
                  value={locality}
                  onChange={(e) => setLocality(e.target.value)}
                  placeholder="Ward 4, Adyar, Chennai"
                  required
                />
              </div>
            </div>

            {/* Password & Confirm Password (2-Column Grid) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-sm)' }}>
              
              {/* Password */}
              <div className="ss-form-group" style={{ marginBottom: 0 }}>
                <label className="ss-label" htmlFor="reg-password">
                  Create Password
                  <span style={{ color: 'var(--color-danger)', marginLeft: 3 }}>*</span>
                </label>
                <div className="wh-input-wrapper">
                  <span className="wh-input-icon">
                    <Lock size={18} />
                  </span>
                  <input
                    id="reg-password"
                    name="new-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    className="wh-input"
                    style={{ paddingRight: '44px' }}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 6 chars"
                    required
                  />
                  <button
                    type="button"
                    className="wh-password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="ss-form-group" style={{ marginBottom: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="ss-label" htmlFor="reg-confirm-password" style={{ margin: 0 }}>
                    Confirm Password
                    <span style={{ color: 'var(--color-danger)', marginLeft: 3 }}>*</span>
                  </label>
                  {passwordsMatch && (
                    <span style={{ fontSize: '11px', color: 'var(--color-success)', fontWeight: 700 }}>
                      ✓ Matches
                    </span>
                  )}
                  {passwordsMismatch && (
                    <span style={{ fontSize: '11px', color: 'var(--color-danger)', fontWeight: 700 }}>
                      Mismatch
                    </span>
                  )}
                </div>
                <div className="wh-input-wrapper">
                  <span className="wh-input-icon">
                    <Lock size={18} />
                  </span>
                  <input
                    id="reg-confirm-password"
                    name="confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    className={`wh-input ${passwordsMismatch ? 'invalid' : ''}`}
                    style={{ paddingRight: '44px' }}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    required
                  />
                  <button
                    type="button"
                    className="wh-password-toggle"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Password Strength Indicator */}
            {password && (
              <div className="wh-strength-container" aria-live="polite">
                <div className="wh-strength-header">
                  <span className="text-secondary">Password Strength:</span>
                  <strong style={{
                    color: passwordStrength.score === 4 ? 'var(--color-success)' :
                           passwordStrength.score === 3 ? '#0284C7' :
                           passwordStrength.score === 2 ? '#D97706' : 'var(--color-danger)'
                  }}>
                    {passwordStrength.label}
                  </strong>
                </div>
                <div className="wh-strength-bars">
                  <div className={`wh-strength-bar ${passwordStrength.score >= 1 ? passwordStrength.className : ''}`} />
                  <div className={`wh-strength-bar ${passwordStrength.score >= 2 ? passwordStrength.className : ''}`} />
                  <div className={`wh-strength-bar ${passwordStrength.score >= 3 ? passwordStrength.className : ''}`} />
                  <div className={`wh-strength-bar ${passwordStrength.score >= 4 ? passwordStrength.className : ''}`} />
                </div>
              </div>
            )}

            {/* Cooperative Bylaws & Fair Labor Charter Checkbox */}
            <div className="wh-checkbox-row" style={{ marginTop: 'var(--space-xs)' }}>
              <label className="wh-checkbox-label" style={{ alignItems: 'flex-start' }}>
                <input
                  type="checkbox"
                  className="wh-checkbox-input"
                  checked={agreedToCharter}
                  onChange={(e) => setAgreedToCharter(e.target.checked)}
                  style={{ marginTop: 2 }}
                />
                <span style={{ fontSize: '13px', lineHeight: 1.4 }}>
                  I agree to the{' '}
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); setShowCharterModal(true); }}
                    style={{
                      color: 'var(--color-accent)',
                      fontWeight: 700,
                      textDecoration: 'underline',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    Cooperative Bylaws & Fair Labor Charter
                  </button>
                  <span style={{ color: 'var(--color-danger)', marginLeft: 3 }}>*</span>
                </span>
              </label>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              variant="primary"
              size="large"
              icon={ArrowRight}
              iconPosition="right"
              fullWidth
              disabled={isLoading}
              style={{ minHeight: '50px', fontSize: '16px', marginTop: 'var(--space-xs)' }}
            >
              {isLoading
                ? 'Registering Account...'
                : `Complete ${selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)} Registration`}
            </Button>
          </form>

          {/* Switch to Sign In Footer Link */}
          <div style={{
            textAlign: 'center',
            marginTop: 'var(--space-md)',
            paddingTop: 'var(--space-sm)',
            borderTop: '1px solid var(--color-border)'
          }}>
            <p className="text-secondary" style={{ fontSize: '13px', margin: '0 0 6px' }}>
              Already registered with WorkHive?
            </p>
            <Link
              to={`/login?role=${selectedRole}`}
              style={{
                fontSize: '14px',
                fontWeight: 700,
                color: 'var(--color-black)',
                textDecoration: 'underline',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              <span>← Sign In to Existing Account</span>
            </Link>
          </div>

        </section>
      </main>

      {/* 3. COOPERATIVE CHARTER MODAL */}
      {showCharterModal && (
        <div className="wh-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="charter-modal-title">
          <div className="wh-modal-card">
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 'var(--space-md) var(--space-lg)',
              borderBottom: '1px solid var(--color-border)',
              background: '#FAFAFA'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShieldCheck size={20} color="var(--color-accent)" />
                <h3 id="charter-modal-title" style={{ fontSize: '16px', fontWeight: 'bold', margin: 0 }}>
                  WorkHive Cooperative Charter
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCharterModal(false)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-white)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                aria-label="Close dialog"
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: 'var(--space-lg)', maxHeight: '60vh', overflowY: 'auto' }}>
              <div style={{ fontSize: '13px', lineHeight: 1.6, color: 'var(--color-black)' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: 4 }}>1. Democratic Member Ownership</h4>
                <p className="text-secondary" style={{ marginBottom: 12 }}>
                  Every verified worker is an equal co-owner with 1 member = 1 vote rights on platform surplus distributions and committee appointments.
                </p>

                <h4 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: 4 }}>2. 95% Direct Take-Home Guarantee</h4>
                <p className="text-secondary" style={{ marginBottom: 12 }}>
                  No arbitrary commissions. 95% of customer fee goes directly into the worker's bank/UPI. Exactly 5% is allocated to the worker's collective emergency welfare pool.
                </p>

                <h4 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: 4 }}>3. Fair Service Rates for Customers</h4>
                <p className="text-secondary" style={{ marginBottom: 12 }}>
                  Customers enjoy standardized rates with zero surge pricing, verified identity certification, and 12-minute emergency dispatch.
                </p>

                <h4 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: 4 }}>4. Statutory Auditing</h4>
                <p className="text-secondary" style={{ margin: 0 }}>
                  All ledgers and transactions are legally audited under the Tamil Nadu Cooperative Societies Act #TN-CHE-2024-88402.
                </p>
              </div>

              <div style={{ marginTop: 'var(--space-lg)' }}>
                <Button
                  variant="primary"
                  fullWidth
                  onClick={() => {
                    setAgreedToCharter(true);
                    setShowCharterModal(false);
                  }}
                >
                  I Understand & Agree to Charter
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. FOOTER TRUST NOTE */}
      <footer style={{
        textAlign: 'center',
        padding: 'var(--space-md) 0',
        fontSize: '12px',
        color: 'var(--color-text-secondary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        flexWrap: 'wrap'
      }}>
        <span>Governed under Tamil Nadu Cooperative Societies Act</span>
        <span>•</span>
        <span>0% Middleman Margin</span>
        <span>•</span>
        <span>Chennai Labour Cooperative</span>
      </footer>
    </div>
  );
};

export default RegisterPortal;
