import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  Building2,
  Lock,
  Mail,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Eye,
  EyeOff
} from 'lucide-react';
import { Button, Card, Badge } from '../../../components';
import { useAuth } from '../../../context/AuthContext';

export const AdminLogin = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, isLoading, authError } = useAuth();

  const redirectUrl = searchParams.get('redirect');
  const isSessionExpired = searchParams.get('expired') === 'true';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [localError, setLocalError] = useState('');
  const [successToast, setSuccessToast] = useState('');

  const handleQuickDemoFill = () => {
    setEmail('admin@chennailabour.coop');
    setPassword('cooperative2026');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim() || !emailRegex.test(email)) {
      setLocalError('Please enter a valid official cooperative email address.');
      return;
    }

    if (!password.trim() || password.length < 4) {
      setLocalError('Please enter your administrator password.');
      return;
    }

    const res = await login({ identifier: email, password, role: 'admin' });
    if (res.success) {
      setSuccessToast(`Welcome back, ${res.user.name}! (7-day admin session active)`);
      setTimeout(() => {
        if (redirectUrl) {
          navigate(decodeURIComponent(redirectUrl));
        } else {
          navigate('/admin/dashboard');
        }
      }, 500);
    } else {
      setLocalError(res.error);
    }
  };

  return (
    <div className="wh-auth-page">
      {/* Top Navbar */}
      <nav className="wh-auth-top-nav" style={{ maxWidth: '520px' }} aria-label="Admin login navigation">
        <Link to="/" className="wh-auth-back-link">
          <ArrowLeft size={16} color="var(--color-accent)" />
          <span>Back to Homepage</span>
        </Link>
        <Badge variant="active" style={{ fontSize: '12px' }}>
          <ShieldCheck size={12} />
          <span>Ward 4 Administration</span>
        </Badge>
      </nav>

      <div style={{ width: '100%', maxWidth: '520px' }}>
        
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-lg)' }}>
          <div style={{
            width: 64,
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto var(--space-xs)'
          }}>
            <img src="/logo.png" alt="WorkHive Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: '4px 0 2px' }}>
            WorkHive Admin Portal
          </h1>
          <p className="text-secondary" style={{ fontSize: '13px', margin: 0 }}>
            Chennai Labour Cooperative Society • Ward Operations Console
          </p>
        </div>

        <Card padding="lg" style={{
          background: 'var(--color-white)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.05)'
        }}>
          
          {/* Quick Demo Fill Bar */}
          <div style={{
            background: '#F9FAFB',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: '10px 14px',
            marginBottom: 'var(--space-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sparkles size={16} color="var(--color-accent)" />
              <span style={{ fontSize: '12px', fontWeight: 600 }}>Official Officer Demo:</span>
            </div>
            <button
              type="button"
              onClick={handleQuickDemoFill}
              style={{
                background: 'var(--color-black)',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--radius-full)',
                padding: '4px 12px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Autofill Credentials
            </button>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>
                Officer Sign In
              </h2>
              <Badge variant="active" style={{ fontSize: '11px' }}>
                Ward 4 Node
              </Badge>
            </div>

            {isSessionExpired && (
              <div style={{
                background: '#FEF3C7',
                border: '1px solid #F59E0B',
                color: '#92400E',
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }} role="alert">
                <AlertCircle size={16} color="#D97706" style={{ flexShrink: 0 }} />
                <span>Your 7-day administrator session has expired. Please sign in again.</span>
              </div>
            )}

            {successToast && (
              <div style={{
                background: 'var(--color-success-bg)',
                border: '1px solid var(--color-success)',
                color: 'var(--color-success)',
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }} role="status">
                <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
                <span>{successToast}</span>
              </div>
            )}

            {(localError || authError) && (
              <div style={{
                background: 'var(--color-danger-bg)',
                border: '1px solid var(--color-danger)',
                color: 'var(--color-danger)',
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }} role="alert" aria-live="assertive">
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{localError || authError}</span>
              </div>
            )}

            {/* Email Field */}
            <div className="ss-form-group" style={{ marginBottom: 0 }}>
              <label className="ss-label" htmlFor="admin-email">
                Official Cooperative Email
                <span style={{ color: 'var(--color-danger)', marginLeft: 3 }}>*</span>
              </label>
              <div className="wh-input-wrapper">
                <span className="wh-input-icon">
                  <Mail size={18} />
                </span>
                <input
                  id="admin-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  className="wh-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@chennailabour.coop"
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="ss-form-group" style={{ marginBottom: 0 }}>
              <label className="ss-label" htmlFor="admin-password">
                Administrator Password
                <span style={{ color: 'var(--color-danger)', marginLeft: 3 }}>*</span>
              </label>
              <div className="wh-input-wrapper">
                <span className="wh-input-icon">
                  <Lock size={18} />
                </span>
                <input
                  id="admin-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="wh-input"
                  style={{ paddingRight: '44px' }}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
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

            {/* Remember Me Checkbox */}
            <div className="wh-checkbox-row">
              <label className="wh-checkbox-label">
                <input
                  type="checkbox"
                  className="wh-checkbox-input"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>Remember officer session on this device</span>
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
              style={{ minHeight: '48px' }}
            >
              {isLoading ? 'Authenticating with Ledger...' : 'Log In to Ward 4 Console'}
            </Button>

            {/* Register New Admin Node Link */}
            <div style={{
              textAlign: 'center',
              paddingTop: 'var(--space-sm)',
              borderTop: '1px solid var(--color-border)'
            }}>
              <span className="text-secondary" style={{ fontSize: '12px' }}>New Ward Coordinator? </span>
              <Link to="/register?role=admin" style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-accent)' }}>
                Register New Node Coordinator →
              </Link>
            </div>

          </form>
        </Card>

        {/* Multi-role Switcher Link */}
        <div style={{ textAlign: 'center', marginTop: 'var(--space-md)', display: 'flex', justifyContent: 'center', gap: 'var(--space-md)' }}>
          <Link to="/login?role=customer" style={{ fontSize: '12px', color: 'var(--color-text-secondary)', textDecoration: 'none' }}>
            👤 Customer Sign In
          </Link>
          <span style={{ color: 'var(--color-border)' }}>•</span>
          <Link to="/login?role=worker" style={{ fontSize: '12px', color: 'var(--color-text-secondary)', textDecoration: 'none' }}>
            👷 Worker Sign In
          </Link>
          <span style={{ color: 'var(--color-border)' }}>•</span>
          <Link to="/" style={{ fontSize: '12px', color: 'var(--color-text-secondary)', textDecoration: 'none' }}>
            WorkHive Hub
          </Link>
        </div>

      </div>
    </div>
  );
};

export default AdminLogin;
