import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [isValidating, setIsValidating] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [email, setEmail] = useState('');
  const [expiresInMinutes, setExpiresInMinutes] = useState(null);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Validate token on mount
  useEffect(() => {
    if (!token) {
      setIsValidating(false);
      setIsValid(false);
      return;
    }

    const validateToken = async () => {
      try {
        const response = await axios.post(`${API_BASE_URL}/auth/validate-reset-token`, { token });
        setIsValid(response.data.valid);
        setEmail(response.data.email || '');
        setExpiresInMinutes(response.data.expires_in_minutes);
      } catch (err) {
        setIsValid(false);
      } finally {
        setIsValidating(false);
      }
    };

    validateToken();
  }, [token]);

  // Countdown timer
  useEffect(() => {
    if (!isValid || expiresInMinutes === null) return;

    const interval = setInterval(() => {
      setExpiresInMinutes((prev) => {
        if (prev <= 0) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 60000);

    return () => clearInterval(interval);
  }, [isValid, expiresInMinutes]);

  // Password strength
  const calculatePasswordStrength = (pass) => {
    let strength = 0;
    if (pass.length >= 8) strength++;
    if (/[A-Z]/.test(pass)) strength++;
    if (/[a-z]/.test(pass)) strength++;
    if (/[0-9]/.test(pass)) strength++;
    if (/[^A-Za-z0-9]/.test(pass)) strength++;
    return strength;
  };

  const getPasswordStrengthInfo = () => {
    const strength = calculatePasswordStrength(password);
    if (!password) return { label: '', color: '', width: '0%' };
    if (strength <= 2) return { label: 'Weak', color: '#ef4444', width: '33%' };
    if (strength <= 3) return { label: 'Medium', color: '#eab308', width: '66%' };
    return { label: 'Strong', color: '#10b981', width: '100%' };
  };

  const passwordsMatch = password && confirmPassword && password === confirmPassword;
  const strengthInfo = getPasswordStrengthInfo();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      await axios.post(`${API_BASE_URL}/auth/reset-password-with-token`, {
        token,
        new_password: password,
      });

      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to reset password. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading state
  if (isValidating) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}>
        <div style={{ textAlign: 'center', color: 'white' }}>
          <div style={{
            width: '64px',
            height: '64px',
            border: '4px solid rgba(255,255,255,0.3)',
            borderTop: '4px solid white',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 20px',
          }} />
          <p style={{ fontSize: '18px', fontWeight: '500' }}>Validating reset link...</p>
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Invalid/expired token
  if (!isValid) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
          padding: '2rem',
          maxWidth: '28rem',
          width: '100%',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '64px',
              height: '64px',
              backgroundColor: '#fee2e2',
              borderRadius: '50%',
              marginBottom: '1rem',
            }}>
              <svg style={{ width: '32px', height: '32px', color: '#ef4444' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#111', marginBottom: '1rem' }}>
              Invalid or Expired Link
            </h2>
            <p style={{ color: '#666', marginBottom: '1.5rem', lineHeight: '1.6' }}>
              This password reset link is invalid or has expired. Please request a new one.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button
                onClick={() => navigate('/forgot-password')}
                style={{
                  width: '100%',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  fontWeight: '600',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1rem',
                }}
              >
                Request New Link
              </button>
              <button
                onClick={() => navigate('/login')}
                style={{
                  width: '100%',
                  color: '#666',
                  padding: '0.5rem',
                  fontWeight: '500',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                }}
              >
                Back to Login
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
          padding: '2rem',
          maxWidth: '28rem',
          width: '100%',
          animation: 'fadeIn 0.5s ease-out',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '80px',
              height: '80px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.5rem',
              animation: 'scaleIn 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
            }}>
              <svg style={{ width: '48px', height: '48px', color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 style={{ fontSize: '1.875rem', fontWeight: 'bold', color: '#111', marginBottom: '1rem' }}>
              Password Reset!
            </h2>
            <p style={{ color: '#666', marginBottom: '0.5rem', lineHeight: '1.6' }}>
              Your password has been successfully changed.
            </p>
            <p style={{ fontSize: '0.875rem', color: '#999' }}>
              Redirecting to login page...
            </p>
          </div>
        </div>
        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes scaleIn {
            from { transform: scale(0); }
            to { transform: scale(1); }
          }
        `}</style>
      </div>
    );
  }

  // Reset password form
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        padding: '2rem',
        maxWidth: '28rem',
        width: '100%',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '64px',
            height: '64px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: '50%',
            marginBottom: '1rem',
          }}>
            <svg style={{ width: '32px', height: '32px', color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', color: '#111', marginBottom: '0.5rem' }}>
            Reset Your Password
          </h1>
          <p style={{ color: '#666', fontSize: '0.875rem' }}>
            for <span style={{ fontWeight: '600' }}>{email}</span>
          </p>
        </div>

        {/* Timer */}
        {expiresInMinutes !== null && (
          <div style={{
            marginBottom: '1.5rem',
            padding: '1rem',
            backgroundColor: expiresInMinutes <= 5 ? '#fef2f2' : '#eff6ff',
            borderLeft: `4px solid ${expiresInMinutes <= 5 ? '#ef4444' : '#3b82f6'}`,
            borderRadius: '4px',
          }}>
            <p style={{
              fontSize: '0.875rem',
              color: expiresInMinutes <= 5 ? '#991b1b' : '#1e40af',
              margin: 0,
            }}>
              ⏰ {expiresInMinutes <= 0 ? 'Link expired' : `Link expires in ${expiresInMinutes} minute${expiresInMinutes !== 1 ? 's' : ''}`}
            </p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div style={{
            marginBottom: '1.5rem',
            padding: '1rem',
            backgroundColor: '#fef2f2',
            borderLeft: '4px solid #ef4444',
            borderRadius: '4px',
            animation: 'shake 0.5s ease-in-out',
          }}>
            <p style={{ fontSize: '0.875rem', color: '#991b1b', margin: 0 }}>{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* New Password */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '0.5rem',
            }}>
              New Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your new password"
                required
                autoFocus
                style={{
                  width: '100%',
                  padding: '0.75rem 3rem 0.75rem 1rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#667eea';
                  e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#d1d5db';
                  e.target.style.boxShadow = 'none';
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#9ca3af',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>

            {/* Password Strength Meter */}
            {password && (
              <div style={{ marginTop: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: '500', color: '#666' }}>
                    Password Strength
                  </span>
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    color: strengthInfo.color,
                  }}>
                    {strengthInfo.label}
                  </span>
                </div>
                <div style={{
                  width: '100%',
                  backgroundColor: '#e5e7eb',
                  borderRadius: '9999px',
                  height: '8px',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%',
                    backgroundColor: strengthInfo.color,
                    width: strengthInfo.width,
                    transition: 'width 0.3s, background-color 0.3s',
                  }} />
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '0.5rem',
            }}>
              Confirm Password
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your new password"
              required
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '1rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#667eea';
                e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#d1d5db';
                e.target.style.boxShadow = 'none';
              }}
            />

            {/* Password Match Indicator */}
            {confirmPassword && (
              <div style={{
                marginTop: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                fontSize: '0.875rem',
                color: passwordsMatch ? '#10b981' : '#ef4444',
              }}>
                {passwordsMatch ? '✓' : '✗'} {passwordsMatch ? 'Passwords match!' : 'Passwords do not match'}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !passwordsMatch || expiresInMinutes <= 0}
            style={{
              width: '100%',
              background: isSubmitting || !passwordsMatch ? '#9ca3af' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              padding: '0.75rem',
              borderRadius: '8px',
              fontWeight: '600',
              border: 'none',
              cursor: isSubmitting || !passwordsMatch ? 'not-allowed' : 'pointer',
              fontSize: '1rem',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              transition: 'transform 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseEnter={(e) => {
              if (!isSubmitting && passwordsMatch) {
                e.target.style.transform = 'translateY(-2px)';
              }
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'translateY(0)';
            }}
          >
            {isSubmitting ? (
              <>
                <svg style={{ animation: 'spin 1s linear infinite', marginRight: '0.75rem', height: '20px', width: '20px' }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Resetting...
              </>
            ) : (
              'Reset Password'
            )}
          </button>
        </form>

        {/* Back to Login */}
        <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
          <button
            onClick={() => navigate('/login')}
            style={{
              color: '#667eea',
              fontWeight: '500',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: '0.9rem',
              display: 'inline-flex',
              alignItems: 'center',
            }}
            onMouseEnter={(e) => e.target.style.color = '#764ba2'}
            onMouseLeave={(e) => e.target.style.color = '#667eea'}
          >
            <svg style={{ width: '16px', height: '16px', marginRight: '0.5rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Login
          </button>
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-10px); }
          75% { transform: translateX(10px); }
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
