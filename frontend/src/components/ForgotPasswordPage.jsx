import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await axios.post(`${API_BASE_URL}/auth/request-password-reset`, {
        email: email.trim(),
      });

      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to send reset email. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
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
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          padding: '2rem',
          maxWidth: '28rem',
          width: '100%',
          animation: 'fadeIn 0.5s ease-out',
        }}>
          {/* Success Icon */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
            <div style={{
              width: '80px',
              height: '80px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: 'scaleIn 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
            }}>
              <svg style={{ width: '48px', height: '48px', color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76" />
              </svg>
            </div>
          </div>

          {/* Success Message */}
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: 'bold',
            textAlign: 'center',
            color: '#111',
            marginBottom: '1rem',
          }}>
            Check Your Email!
          </h2>
          <p style={{
            color: '#666',
            textAlign: 'center',
            marginBottom: '1.5rem',
            lineHeight: '1.6',
          }}>
            If an account exists with <span style={{ fontWeight: '600', color: '#111' }}>{email}</span>, 
            you'll receive a password reset link shortly.
          </p>

          {/* Info Box */}
          <div style={{
            backgroundColor: '#eff6ff',
            borderLeft: '4px solid #3b82f6',
            padding: '1rem',
            marginBottom: '1.5rem',
            borderRadius: '4px',
          }}>
            <p style={{ fontSize: '0.875rem', color: '#1e40af', margin: 0 }}>
              <strong>Didn't receive it?</strong> Check your spam folder or try again in a few minutes.
            </p>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button
              onClick={() => navigate('/login')}
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
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
              }}
            >
              Back to Login
            </button>
            <button
              onClick={() => {
                setSubmitted(false);
                setEmail('');
              }}
              style={{
                width: '100%',
                color: '#666',
                padding: '0.5rem',
                fontWeight: '500',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                transition: 'color 0.2s',
              }}
              onMouseEnter={(e) => e.target.style.color = '#111'}
              onMouseLeave={(e) => e.target.style.color = '#666'}
            >
              Try a different email
            </button>
          </div>
        </div>

        <style>{`
          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes scaleIn {
            from {
              transform: scale(0);
            }
            to {
              transform: scale(1);
            }
          }
        `}</style>
      </div>
    );
  }

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
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
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
          <h1 style={{
            fontSize: '1.875rem',
            fontWeight: 'bold',
            color: '#111',
            marginBottom: '0.5rem',
          }}>
            Forgot Password?
          </h1>
          <p style={{ color: '#666', fontSize: '1rem' }}>
            No worries! Enter your email and we'll send you a reset link.
          </p>
        </div>

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
          <div>
            <label htmlFor="email" style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '0.5rem',
            }}>
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoFocus
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '1rem',
                outline: 'none',
                transition: 'border-color 0.2s, box-shadow 0.2s',
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
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              width: '100%',
              background: isSubmitting ? '#9ca3af' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              padding: '0.75rem',
              borderRadius: '8px',
              fontWeight: '600',
              border: 'none',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              fontSize: '1rem',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              transition: 'transform 0.2s, box-shadow 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseEnter={(e) => {
              if (!isSubmitting) {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)';
              }
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
            }}
          >
            {isSubmitting ? (
              <>
                <svg style={{ animation: 'spin 1s linear infinite', marginRight: '0.75rem', height: '20px', width: '20px' }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Sending...
              </>
            ) : (
              'Send Reset Link'
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
              transition: 'color 0.2s',
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
