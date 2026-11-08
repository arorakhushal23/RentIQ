import { useState } from 'react';
import { Link } from 'react-router-dom';
import axiosInstance from '../../api/axiosInstance';
import { useToast } from '../../context/ToastContext';
import './ForgotPassword.css';

function ForgotPassword() {
    const { showToast } = useToast();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [submittedEmail, setSubmittedEmail] = useState('');

    const validateEmail = (val) => {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(val);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        const trimmedEmail = email.trim().toLowerCase();

        if (!trimmedEmail) {
            setError('Please enter your email address.');
            return;
        }

        if (!validateEmail(trimmedEmail)) {
            setError('Please enter a valid email address.');
            return;
        }

        setLoading(true);

        try {
            const response = await axiosInstance.post('/auth/forgot-password', {
                email: trimmedEmail
            });

            const msg = response.data?.message || 'If an account exists with that email address, a password reset link has been sent.';
            setSuccessMessage(msg);
            setSubmittedEmail(trimmedEmail);
            showToast(msg, 'success');
        } catch (err) {
            console.error('Forgot password error:', err);
            const errMsg = err.response?.data?.message || 'Unable to process your request. Please try again.';
            setError(errMsg);
            showToast(errMsg, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="login-page forgot-password-page">
            <div className="login-card forgot-password-card">
                <div className="login-header">
                    <Link to="/" className="login-logo-link">
                        <div className="login-logo">
                            Rent<span>IQ</span>
                        </div>
                    </Link>

                    <h1>Forgot Your Password?</h1>
                    <p>Enter your registered email address and we'll send you a secure link to reset your password.</p>
                </div>

                {successMessage ? (
                    <div className="forgot-success-box" role="status">
                        <div className="forgot-success-icon" aria-hidden="true">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="36" height="36">
                                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                                <polyline points="22,6 12,13 2,6" />
                            </svg>
                        </div>
                        <h3>Check Your Email</h3>
                        <p className="forgot-success-text">
                            We have dispatched password reset instructions to:
                            <br />
                            <strong>{submittedEmail}</strong>
                        </p>
                        <p className="forgot-expiry-hint">
                            The link is valid for <strong>15 minutes</strong>. If you don't see the email, check your spam or junk folder.
                        </p>

                        <div className="forgot-success-actions">
                            <button
                                type="button"
                                className="forgot-resend-btn"
                                onClick={() => {
                                    setSuccessMessage('');
                                    setEmail(submittedEmail);
                                }}
                            >
                                Send another link
                            </button>
                            <Link to="/login" className="login-button back-to-login-btn">
                                Return to Login →
                            </Link>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} noValidate>
                        <div className="form-group">
                            <label htmlFor="email">Registered Email Address</label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                placeholder="name@example.com"
                                value={email}
                                onChange={(e) => {
                                    setEmail(e.target.value);
                                    setError('');
                                }}
                                autoComplete="email"
                                autoFocus
                            />
                        </div>

                        {error && (
                            <p className="login-error" role="alert">
                                {error}
                            </p>
                        )}

                        <button
                            type="submit"
                            className="login-button"
                            disabled={loading}
                        >
                            {loading ? 'Sending Reset Link...' : 'Send Reset Link'}
                            {!loading && <span>→</span>}
                        </button>

                        <div className="back-login-row">
                            <Link to="/login" className="back-login-link">
                                ← Back to Login
                            </Link>
                        </div>
                    </form>
                )}
            </div>
        </main>
    );
}

export default ForgotPassword;

