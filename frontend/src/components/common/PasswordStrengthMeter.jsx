import React from 'react';
import './PasswordStrengthMeter.css';

export function calculatePasswordStrength(password) {
    if (!password) {
        return { score: 0, label: '', color: '', percent: 0 };
    }

    let score = 0;
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
    if (/\d/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    // Map 0-5 to 4 tier levels
    if (password.length < 8) {
        return {
            score: 1,
            label: 'Too short (min 8 chars)',
            color: 'var(--pwd-weak, #ef4444)',
            percent: 20,
            level: 'weak'
        };
    }

    if (score <= 2) {
        return {
            score: 2,
            label: 'Weak',
            color: 'var(--pwd-weak, #ef4444)',
            percent: 40,
            level: 'weak'
        };
    }
    if (score === 3) {
        return {
            score: 3,
            label: 'Fair',
            color: 'var(--pwd-fair, #f59e0b)',
            percent: 65,
            level: 'fair'
        };
    }
    if (score === 4) {
        return {
            score: 4,
            label: 'Good',
            color: 'var(--pwd-good, #3b82f6)',
            percent: 85,
            level: 'good'
        };
    }
    return {
        score: 5,
        label: 'Strong',
        color: 'var(--pwd-strong, #10b981)',
        percent: 100,
        level: 'strong'
    };
}

export default function PasswordStrengthMeter({ password }) {
    if (!password) return null;

    const { label, color, percent, level } = calculatePasswordStrength(password);

    return (
        <div className="pwd-strength-container" aria-live="polite">
            <div className="pwd-strength-header">
                <span className="pwd-strength-title">Password Strength:</span>
                <span className={`pwd-strength-label level-${level}`} style={{ color }}>
                    {label}
                </span>
            </div>
            <div className="pwd-strength-bar-track">
                <div
                    className={`pwd-strength-bar-fill level-${level}`}
                    style={{ width: `${percent}%`, backgroundColor: color }}
                />
            </div>
        </div>
    );
}

