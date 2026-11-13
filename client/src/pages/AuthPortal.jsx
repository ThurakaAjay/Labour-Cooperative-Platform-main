import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  User,
  HardHat,
  Building2,
  Lock,
  Phone,
  Mail,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  KeyRound,
  Eye,
  EyeOff,
  Scale,
  Zap,
  Check,
  ArrowLeft,
  X,
  HelpCircle,
  Clock,
  HeartHandshake
} from 'lucide-react';
import { Button, Card, Badge } from '../components';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../api';

const REMEMBERED_USER_KEY = 'workhive_remembered_identifier';

export const AuthPortal = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, verifyOtp, isLoading, authError } = useAuth();

  // Selected role tab: 'customer' | 'worker' | 'admin'
  const initialRole = searchParams.get('role') || 'customer';
  const [selectedRole, setSelectedRole] = useState(initialRole);

  // Auth Mode: 'password' | 'otp'
  const [authMode, setAuthMode] = useState('password');

  // Form Fields
  const [identifier, setIdentifier] = useState(() => {
    return localStorage.getItem(REMEMBERED_USER_KEY) || searchParams.get('identifier') || '';
  });
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => !!localStorage.getItem(REMEMBERED_USER_KEY));
  const [localError, setLocalError] = useState('');
  const [successToast, setSuccessToast] = useState('');

  // Forgot password modal
  const [showForgotModal, setShowForgotModal] = useState(false);

  // Sync role from searchParams if updated
  useEffect(() => {
    const roleParam = searchParams.get('role');
    if (roleParam && ['customer', 'worker', 'admin'].includes(roleParam)) {
      setSelectedRole(roleParam);
    }
  }, [searchParams]);

  // Handle role switch
  const handleRoleChange = (role) => {
    setSelectedRole(role);
    setLocalError('');
    setOtpSent(false);
    setOtp('');
    if (role === 'admin') {
      setAuthMode('password');
    }
  };

  const redirectUrl = searchParams.get('redirect');
  const isSessionExpired = searchParams.get('expired') === 'true';

  const navigateAfterAuth = (targetRole) => {
    if (redirectUrl) {
      navigate(decodeURIComponent(redirectUrl));
    } else {
      if (targetRole === 'admin') navigate('/admin/dashboard');
      else if (targetRole === 'worker') navigate('/worker/dashboard');
      else navigate('/customer/home');
    }
  };

  const performLogin = async (payload, targetRole) => {
    setLocalError('');
    if (rememberMe && payload.identifier) {
      localStorage.setItem(REMEMBERED_USER_KEY, payload.identifier);
    } else {
      localStorage.removeItem(REMEMBERED_USER_KEY);
    }

    const result = await login(payload);
    if (result.success) {
      setSuccessToast(`Signed in as ${result.user.name} (${targetRole.toUpperCase()}) • Session active`);
      setTimeout(() => {
        navigateAfterAuth(targetRole);
      }, 500);
    } else {
      setLocalError(result.error);
    }
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');

    if (!identifier.trim()) {
      setLocalError(selectedRole === 'admin' ? 'Please enter your cooperative admin email.' : 'Please enter your registered mobile number or email.');
      return;
    }

    if (authMode === 'password') {
      if (!password.trim()) {
        setLocalError('Please enter your account password.');
        return;
      }
      await performLogin({ identifier, password, role: selectedRole }, selectedRole);
    } else {
      // OTP mode
      if (!otpSent) {
        try {
          const sendRes = await authAPI.sendOtp(identifier);
          setOtpSent(true);
          setSuccessToast(sendRes.message || `6-digit verification code sent to ${identifier}.`);
        } catch (err) {
          setLocalError(err.response?.data?.message || 'Failed to send OTP code. Please verify your mobile number.');
        }
      } else {
        if (!otp.trim()) {
          setLocalError('Please enter the 6-digit verification code.');
          return;
        }
        const res = await verifyOtp({ phone: identifier, otp, role: selectedRole });
        if (res.success) {
          setSuccessToast(`Verified! Welcome ${res.user.name} • Session active`);
          if (rememberMe) {
            localStorage.setItem(REMEMBERED_USER_KEY, identifier);
          }
          setTimeout(() => {
            navigateAfterAuth(selectedRole);
          }, 500);
        } else {
          setLocalError(res.error);
        }
      }
    }
  };

  const roles = [
    { id: 'customer', label: 'Customer', icon: User, tagline: 'Book Verified Helpers', color: 'var(--color-accent)' },
    { id: 'worker', label: 'Worker Member', icon: HardHat, tagline: 'Direct UPI Earnings', color: 'var(--color-success)' },
    { id: 'admin', label: 'Officer', icon: Building2, tagline: 'Ward Operations', color: '#0284C7' }
  ];

  const heroDetails = {
    customer: {
      title: 'Reliable Local Services, Zero Middleman Fees',
      desc: 'Connect directly with certified plumbers, electricians, carpenters, and helpers from the Chennai Labour Cooperative Society.',
      perks: [
        'Standardized fair rates fixed by cooperative committee',
        'Verified trade-certified workers with police verification',
        '12-minute emergency SOS assistance',
        'Direct cashless UPI invoicing — 0% commission markups'
      ],
      statNum: '14,200+',
      statLabel: 'Verified Bookings Completed'
    },
    worker: {
      title: 'Take Home 95% Direct Pay with Full Social Security',
      desc: 'Join Tamil Nadu’s first worker-owned cooperative platform with democratic member voting rights and welfare insurance.',
      perks: [
        '95% direct take-home pay disbursed instantly to UPI',
        '₹5,00,000 health insurance & accident cover',
        'Cooperative Welfare Fund with zero-interest emergency loans',
        '1-Worker 1-Vote democratic governance rights'
      ],
      statNum: '₹18,40,000+',
      statLabel: 'Directly Distributed to Workers'
    },
    admin: {
      title: 'Ward Operations & Society Statutory Governance',
      desc: 'Real-time telemetry, geolocation dispatching, member roster validation, and transparent audited financial pools.',
      perks: [
        'Ward 4 live dispatch & GPS fleet monitoring',
        'Transparent automated 5% welfare pool ledger',
        'Grievance arbitration & dispute resolution desk',
        'Statutory audited accounts under TN Societies Act'
      ],
      statNum: '320+',
      statLabel: 'Active Cooperative Tradespeople'
    }
  };

  const currentHero = heroDetails[selectedRole] || heroDetails.customer;

  return (
    <div className="wh-auth-page">
      {/* 1. TOP NAVBAR / BACK NAVIGATION */}
      <nav className="wh-auth-top-nav" aria-label="Authentication navigation">
        <Link to="/" className="wh-auth-back-link">
          <ArrowLeft size={16} color="var(--color-accent)" />
          <span>Back to Homepage</span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Badge variant="active" style={{ fontSize: '12px' }}>
            <ShieldCheck size={12} />
            <span>Govt Reg #TN-CHE</span>
          </Badge>
        </div>
      </nav>

      {/* 2. MAIN RESPONSIVE TWO-COLUMN LAYOUT */}
      <main className="wh-auth-layout">
        
        {/* LEFT COLUMN: HERO SHOWCASE (Desktop >= 1024px) */}
        <aside className="wh-auth-hero" aria-label="Platform overview">
          <div>
            <div className="wh-hero-brand">
              <div className="wh-hero-logo">
                <img src="/logo.png" alt="WorkHive Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </div>
              <div>
                <h1 className="wh-hero-title">WorkHive</h1>
                <div className="wh-hero-sub">Chennai Labour Cooperative Society</div>
              </div>
            </div>

            <h2 style={{ fontSize: '22px', fontWeight: 'bold', margin: '0 0 10px', color: 'var(--color-black)', letterSpacing: '-0.01em' }}>
              {currentHero.title}
            </h2>
            <p className="text-secondary" style={{ fontSize: '14px', lineHeight: 1.5, margin: '0 0 var(--space-lg)' }}>
              {currentHero.desc}
            </p>

            {/* Dynamic Role Perks List */}
            <div className="wh-hero-perk-card">
              <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: 8, letterSpacing: '0.04em' }}>
                {selectedRole.toUpperCase()} MEMBERSHIP GUARANTEES
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {currentHero.perks.map((perk, pIdx) => (
                  <div key={pIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: '13px', color: 'var(--color-black)', fontWeight: 500 }}>
                    <Check size={16} color="var(--color-success)" style={{ flexShrink: 0, marginTop: 2 }} />
                    <span>{perk}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom Live Metrics & Trust Banner */}
          <div>
            <div className="wh-hero-stats-grid">
              <div className="wh-hero-stat-box">
                <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-accent)' }}>{currentHero.statNum}</div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>{currentHero.statLabel}</div>
              </div>
              <div className="wh-hero-stat-box">
                <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-success)' }}>0% Cut</div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Zero Exploitative Margins</div>
              </div>
            </div>

            <div style={{ marginTop: 'var(--space-md)', display: 'flex', alignItems: 'center', gap: 6, fontSize: '12px', color: 'var(--color-text-secondary)' }}>
              <Scale size={14} color="var(--color-accent)" />
              <span>Governed democratically under the Tamil Nadu Cooperative Societies Act.</span>
            </div>
          </div>
        </aside>

        {/* RIGHT COLUMN: AUTHENTICATION FORM CARD */}
        <section className="wh-auth-card" aria-label="Sign in form">
          
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
                  Chennai Labour Cooperative
                </span>
              </div>
            </Link>
          </div>

          <div style={{ marginBottom: 'var(--space-md)' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 4px', letterSpacing: '-0.01em' }}>
              Account Sign In
            </h2>
            <p className="text-secondary" style={{ fontSize: '13px', margin: 0 }}>
              Select your role to access your cooperative workspace
            </p>
          </div>

          {/* 3-ROLE SELECTOR TABS */}
          <div className="wh-role-selector" role="tablist" aria-label="Account role selector">
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

          {/* SESSION EXPIRED ALERT */}
          {isSessionExpired && (
            <div style={{
              background: '#FEF3C7',
              border: '1px solid #F59E0B',
              color: '#92400E',
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              fontSize: '13px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 'var(--space-md)'
            }} role="alert">
              <AlertCircle size={18} color="#D97706" style={{ flexShrink: 0 }} />
              <span>Your session has expired. Please sign in again to renew your access.</span>
            </div>
          )}

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
              {selectedRole !== 'admin' && ((localError || authError || '').toLowerCase().includes('register') ||
                (localError || authError || '').toLowerCase().includes('not exist') ||
                (localError || authError || '').toLowerCase().includes('does not exist')) && (
                <div style={{ marginTop: 8 }}>
                  <Link
                    to={`/register?role=${selectedRole}&phone=${encodeURIComponent(identifier)}`}
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
                    Register new {selectedRole.toUpperCase()} account now →
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* AUTH MODE SEGMENTED TOGGLE (Password vs Mobile SMS OTP) */}
          {selectedRole !== 'admin' && (
            <div className="wh-auth-mode-toggle" role="group" aria-label="Sign in method">
              <button
                type="button"
                className={`wh-auth-mode-btn ${authMode === 'password' ? 'active' : ''}`}
                onClick={() => { setAuthMode('password'); setOtpSent(false); }}
              >
                <Lock size={14} />
                <span>Password Login</span>
              </button>
              <button
                type="button"
                className={`wh-auth-mode-btn ${authMode === 'otp' ? 'active' : ''}`}
                onClick={() => { setAuthMode('otp'); setOtpSent(false); }}
              >
                <Zap size={14} />
                <span>Passwordless SMS OTP</span>
              </button>
            </div>
          )}

          {/* SIGN IN FORM */}
          <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            
            {/* Identifier Input */}
            <div className="ss-form-group" style={{ marginBottom: 0 }}>
              <label className="ss-label" htmlFor="auth-identifier">
                {selectedRole === 'admin' ? 'Cooperative Officer Email' : 'Mobile Number / Registered Email'}
                <span style={{ color: 'var(--color-danger)', marginLeft: 3 }}>*</span>
              </label>
              <div className="wh-input-wrapper">
                <span className="wh-input-icon">
                  {selectedRole === 'admin' ? <Mail size={18} /> : <Phone size={18} />}
                </span>
                <input
                  id="auth-identifier"
                  name="identifier"
                  type={selectedRole === 'admin' ? 'email' : 'text'}
                  autoComplete={selectedRole === 'admin' ? 'email' : 'username tel'}
                  className={`wh-input ${(localError && !identifier) ? 'invalid' : ''}`}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder={selectedRole === 'admin' ? 'admin@chennailabour.coop' : '+91 98401 23456 or phone'}
                  required
                />
              </div>
            </div>

            {/* Password or OTP Input */}
            {authMode === 'password' ? (
              <div className="ss-form-group" style={{ marginBottom: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <label className="ss-label" htmlFor="auth-password" style={{ margin: 0 }}>
                    Account Password
                    <span style={{ color: 'var(--color-danger)', marginLeft: 3 }}>*</span>
                  </label>
                  <button
                    type="button"
                    className="wh-forgot-link"
                    onClick={() => setShowForgotModal(true)}
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="wh-input-wrapper">
                  <span className="wh-input-icon">
                    <Lock size={18} />
                  </span>
                  <input
                    id="auth-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    className={`wh-input ${(localError && !password) ? 'invalid' : ''}`}
                    style={{ paddingRight: '46px' }}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
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
            ) : (
              otpSent && (
                <div className="ss-form-group" style={{ marginBottom: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <label className="ss-label" htmlFor="auth-otp" style={{ margin: 0 }}>
                      6-Digit Verification Code (OTP)
                      <span style={{ color: 'var(--color-danger)', marginLeft: 3 }}>*</span>
                    </label>
                    <button
                      type="button"
                      className="wh-forgot-link"
                      onClick={() => { setOtpSent(false); setOtp(''); }}
                    >
                      Resend Code
                    </button>
                  </div>
                  <div className="wh-input-wrapper">
                    <span className="wh-input-icon">
                      <KeyRound size={18} />
                    </span>
                    <input
                      id="auth-otp"
                      name="otp"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      className="wh-input"
                      style={{ letterSpacing: '4px', fontWeight: 'bold', fontSize: '18px' }}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      placeholder="••••••"
                      required
                      autoFocus
                    />
                  </div>
                </div>
              )
            )}

            {/* Remember Me Checkbox */}
            <div className="wh-checkbox-row">
              <label className="wh-checkbox-label">
                <input
                  type="checkbox"
                  className="wh-checkbox-input"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>Remember me on this device</span>
              </label>

              {selectedRole !== 'admin' && authMode === 'password' && (
                <span className="text-secondary" style={{ fontSize: '12px' }}>
                  Secure 7-day session
                </span>
              )}
            </div>

            {/* Primary Submit Button */}
            <Button
              type="submit"
              variant="primary"
              size="large"
              icon={ArrowRight}
              iconPosition="right"
              fullWidth
              disabled={isLoading}
              style={{ minHeight: '50px', fontSize: '16px' }}
            >
              {isLoading
                ? 'Authenticating...'
                : authMode === 'otp' && !otpSent
                ? 'Send Verification OTP'
                : `Sign In as ${selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)}`}
            </Button>
          </form>


          {/* Sign Up Navigation Footer (admin accounts are provisioned separately, not self-registered) */}
          {selectedRole !== 'admin' && (
          <div style={{
            textAlign: 'center',
            marginTop: 'var(--space-lg)',
            paddingTop: 'var(--space-md)',
            borderTop: '1px solid var(--color-border)'
          }}>
            <p className="text-secondary" style={{ fontSize: '13px', margin: '0 0 6px' }}>
              New to Chennai Labour Cooperative Society?
            </p>
            <Link
              to={`/register?role=${selectedRole}`}
              style={{
                fontSize: '14px',
                fontWeight: 700,
                color: 'var(--color-accent)',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              <span>Create New {selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)} Account</span>
              <ArrowRight size={14} />
            </Link>
          </div>
          )}

        </section>
      </main>

      {/* 3. FORGOT PASSWORD / PASSWORDLESS LOGIN ASSISTANCE MODAL */}
      {showForgotModal && (
        <div className="wh-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="forgot-modal-title">
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
                <KeyRound size={18} color="var(--color-accent)" />
                <h3 id="forgot-modal-title" style={{ fontSize: '16px', fontWeight: 'bold', margin: 0 }}>
                  Account Access Recovery
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
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

            <div style={{ padding: 'var(--space-lg)' }}>
              <p style={{ fontSize: '14px', lineHeight: 1.5, color: 'var(--color-black)', marginBottom: 'var(--space-md)' }}>
                WorkHive accounts support instantaneous <strong>Passwordless SMS Verification</strong>. You don't need to remember your password!
              </p>

              <div style={{
                background: 'var(--color-accent-subtle)',
                border: '1px solid rgba(255, 106, 0, 0.25)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-md)',
                marginBottom: 'var(--space-lg)'
              }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-accent)', marginBottom: 4 }}>
                  Fastest Option:
                </div>
                <div style={{ fontSize: '13px', color: 'var(--color-black)' }}>
                  Switch to Mobile SMS OTP mode. We will send a secure 6-digit verification code directly to your registered mobile phone.
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Button
                  variant="primary"
                  fullWidth
                  onClick={() => {
                    setShowForgotModal(false);
                    setAuthMode('otp');
                    setOtpSent(false);
                  }}
                >
                  Switch to Passwordless SMS OTP
                </Button>

                <Button
                  variant="outline"
                  fullWidth
                  onClick={() => setShowForgotModal(false)}
                >
                  Close & Continue
                </Button>
              </div>

              <div style={{ marginTop: 'var(--space-md)', textAlign: 'center', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                Need officer help? Call Cooperative Support: <strong>+91 44 2441 9800</strong>
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
        <span>© 2026 Chennai Labour Cooperative Society</span>
        <span>•</span>
        <span>Reg #TN-CHE-2024-88402</span>
        <span>•</span>
        <span>100% Direct Take-Home Earnings</span>
      </footer>
    </div>
  );
};

export default AuthPortal;
