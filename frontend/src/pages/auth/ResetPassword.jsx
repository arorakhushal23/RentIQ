import { useState, useId } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import axiosInstance from '../../api/axiosInstance';
import { useToast } from '../../context/ToastContext';
import PasswordStrengthMeter from '../../components/common/PasswordStrengthMeter';
import './ResetPassword.css';

function ResetPassword() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { showToast } = useToast();

    const token = searchParams.get('token') || '';

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [isSuccess, setIsSuccess] = useState(false);

    const newPasswordId = useId();
    const confirmPasswordId = useId();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!token.trim()) {
            setError('Missing password reset token. Please request a new link.');
            return;
        }

        if (!newPassword) {
            setError('Please enter a new password.');
            return;
        }

        if (newPassword.length < 8) {
            setError('New password must be at least 8 characters long.');
            return;
        }

        if (!confirmPassword) {
            setError('Please confirm your new password.');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('Passwords do not match. Please verify and try again.');
            return;
        }

        setLoading(true);

        try {
            const response = await axiosInstance.post('/auth/reset-password', {
                token: token.trim(),
                newPassword,
                confirmPassword
            });

            setIsSuccess(true);
            const msg = response.data?.message || 'Password reset successfully! You can now log in.';
            showToast(msg, 'success');
        } catch (err) {
            console.error('Password reset failed:', err);
            const errMsg = err.response?.data?.message || 'Unable to reset password. The link may have expired or is invalid.';
            setError(errMsg);
            showToast(errMsg, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="login-page reset-password-page">
            <div className="login-card reset-password-card">
                <div className="login-header">
                    <Link to="/" className="login-logo-link">
                        <div className="login-logo">
                            Rent<span>IQ</span>
                        </div>
                    </Link>

                    <h1>Reset Your Password</h1>
                    <p>Create a strong, secure new password for your account.</p>
                </div>

                {!token.trim() && !isSuccess ? (
                    <div className="reset-token-missing-box" role="alert">
                        <div className="reset-token-icon">⚠️</div>
                        <h3>Invalid Reset Link</h3>
                        <p>No password reset token was found in the link. It may be broken or incomplete.</p>
                        <div className="reset-missing-actions">
                            <Link to="/forgot-password" className="login-button">
                                Request a New Reset Link →
                            </Link>
                            <Link to="/login" className="back-login-link">
                                ← Return to Login
                            </Link>
                        </div>
                    </div>
                ) : isSuccess ? (
                    <div className="reset-success-box" role="status">
                        <div className="reset-success-icon" aria-hidden="true">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="40" height="40">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                <polyline points="22 4 12 14.01 9 11.01" />
                            </svg>
                        </div>
                        <h3>Password Changed Successfully!</h3>
                        <p className="reset-success-text">
                            Your password has been updated and all active reset links have been invalidated.
                            You may now proceed to log in with your new credentials.
                        </p>
                        <div className="reset-success-actions">
                            <button
                                type="button"
                                className="login-button"
                                onClick={() => navigate('/login')}
                            >
                                Continue to Login →
                            </button>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} noValidate>
                        <div className="form-group">
                            <label htmlFor={newPasswordId}>New Password</label>
                            <div className="password-input-wrapper">
                                <input
                                    id={newPasswordId}
                                    name="newPassword"
                                    type={showNewPassword ? 'text' : 'password'}
                                    placeholder="Minimum 8 characters"
                                    value={newPassword}
                                    onChange={(e) => {
                                        setNewPassword(e.target.value);
                                        setError('');
                                    }}
                                    autoComplete="new-password"
                                    autoFocus
                                />
                                <button
                                    type="button"
                                    className="pwd-toggle-btn"
                                    onClick={() => setShowNewPassword(!showNewPassword)}
                                    aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                                    tabIndex={-1}
                                >
                                    {showNewPassword ? (
                                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                                            <line x1="1" y1="1" x2="23" y2="23" />
                                        </svg>
                                    ) : (
                                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                            <circle cx="12" cy="12" r="3" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                            <PasswordStrengthMeter password={newPassword} />
                        </div>

                        <div className="form-group">
                            <label htmlFor={confirmPasswordId}>Confirm New Password</label>
                            <div className="password-input-wrapper">
                                <input
                                    id={confirmPasswordId}
                                    name="confirmPassword"
                                    type={showConfirmPassword ? 'text' : 'password'}
                                    placeholder="Re-enter your new password"
                                    value={confirmPassword}
                                    onChange={(e) => {
                                        setConfirmPassword(e.target.value);
                                        setError('');
                                    }}
                                    autoComplete="new-password"
                                />
                                <button
                                    type="button"
                                    className="pwd-toggle-btn"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                                    tabIndex={-1}
                                >
                                    {showConfirmPassword ? (
                                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                                            <line x1="1" y1="1" x2="23" y2="23" />
                                        </svg>
                                    ) : (
                                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                            <circle cx="12" cy="12" r="3" />
                                        </svg>
                                    )}
                                </button>
                            </div>
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
                            {loading ? 'Updating Password...' : 'Reset Password'}
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

export default ResetPassword;

