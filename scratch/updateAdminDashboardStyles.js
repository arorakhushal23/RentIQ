const fs = require('fs');
const path = require('path');

const cssPath = path.resolve('frontend/src/pages/admin/AdminDashboard.css');
let content = fs.readFileSync(cssPath, 'utf8');

// Replace highlight-success and highlight-revenue section
const oldHighlightSection = `.admin-kpi-card.highlight-success {
    border-left: 4px solid var(--success);
}

.admin-kpi-card.highlight-revenue {
    border-left: 4px solid var(--blue-primary);
    background: var(--blue-soft);
    border-color: var(--blue-border);
}

.admin-kpi-card.highlight-revenue .kpi-value {
    color: var(--blue-primary);
}`;

const newHighlightSection = `.admin-kpi-card.highlight-success {
    border-left: 4px solid var(--success);
}

.admin-kpi-card.highlight-success .kpi-icon {
    color: var(--success);
}

.admin-kpi-card.highlight-warning {
    border-left: 4px solid #f59e0b;
}

.admin-kpi-card.highlight-warning .kpi-icon {
    color: #f59e0b;
}

.admin-kpi-card.highlight-danger,
.admin-kpi-card.highlight-expired {
    border-left: 4px solid #ef4444;
}

.admin-kpi-card.highlight-danger .kpi-icon,
.admin-kpi-card.highlight-expired .kpi-icon {
    color: #ef4444;
}

.admin-kpi-card.highlight-expiring {
    border-left: 4px solid #eab308;
}

.admin-kpi-card.highlight-expiring .kpi-icon {
    color: #eab308;
}

.admin-kpi-card.highlight-revenue {
    border-left: 4px solid var(--blue-primary);
    background: var(--blue-soft);
    border-color: var(--blue-border);
}

.admin-kpi-card.highlight-revenue .kpi-value {
    color: var(--blue-primary);
}`;

// Normalize line endings for replacement
const normalize = (str) => str.replace(/\r\n/g, '\n');
const toCRLF = (str) => str.replace(/\r?\n/g, '\r\n');

content = normalize(content);

if (!content.includes(normalize(oldHighlightSection))) {
    console.error('Could not find oldHighlightSection!');
    process.exit(1);
}

content = content.replace(normalize(oldHighlightSection), normalize(newHighlightSection));

// Find the section from /* Alerts Banner Section */ to end of file
const alertsMarker = '/* Alerts Banner Section */';
const alertsIdx = content.indexOf(alertsMarker);

if (alertsIdx === -1) {
    console.error('Could not find alertsMarker!');
    process.exit(1);
}

// Keep everything before alertsMarker, but remove duplicate .highlight-warning / .highlight-danger / .highlight-expiring above it if present
const complianceMarker = '.compliance-grid {';
const compIdx = content.indexOf(complianceMarker);

const newAlertsAndFeaturesSection = `/* Alerts Banner Section */
.alerts-banner-section {
    background: var(--bg-card);
    border: 1px solid #fed7aa;
    border-radius: 14px;
    padding: 22px 24px;
    margin-bottom: 32px;
    box-shadow: 0 4px 16px rgba(234, 88, 12, 0.05);
    transition: background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}

.alerts-banner-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--border);
}

.alerts-banner-title {
    display: flex;
    align-items: center;
    gap: 10px;
}

.alerts-header-icon {
    color: #ea580c;
}

.alerts-banner-title h3 {
    margin: 0;
    font-size: 17px;
    font-weight: 800;
    color: var(--text-primary);
}

.alerts-count-badge {
    padding: 3px 10px;
    border-radius: 20px;
    background: #ffedd5;
    color: #c2410c;
    border: 1px solid #fed7aa;
    font-size: 12px;
    font-weight: 800;
}

.alerts-items-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.alert-item-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 14px;
    padding: 12px 16px;
    border-radius: 10px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    transition: all 0.2s;
}

.alert-item-row:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

/* Light mode alert cards styling with high contrast readable text */
.row-expired {
    background: #fef2f2;
    border-color: #fecaca;
}

.row-expired .alert-item-vehicle strong {
    color: #7f1d1d;
}

.row-expired .alert-reg-no {
    color: #991b1b;
}

.row-expired .alert-item-doc-info {
    color: #991b1b;
}

.row-expired .alert-doc-type {
    color: #7f1d1d;
}

.row-expired .alert-doc-no {
    color: #991b1b;
}

.row-expired .alert-doc-expiry {
    color: #b91c1c;
    font-weight: 600;
}

.row-expired .alert-action-btn {
    background: #ffffff;
    border: 1px solid #fca5a5;
    color: #991b1b;
}

.row-expired .alert-action-btn:hover {
    background: #fee2e2;
    border-color: #ef4444;
    color: #7f1d1d;
}

.row-expiring {
    background: #fffbeb;
    border-color: #fde68a;
}

.row-expiring .alert-item-vehicle strong {
    color: #78350f;
}

.row-expiring .alert-reg-no {
    color: #92400e;
}

.row-expiring .alert-item-doc-info {
    color: #92400e;
}

.row-expiring .alert-doc-type {
    color: #78350f;
}

.row-expiring .alert-doc-no {
    color: #92400e;
}

.row-expiring .alert-doc-expiry {
    color: #b45309;
    font-weight: 600;
}

.row-expiring .alert-action-btn {
    background: #ffffff;
    border: 1px solid #fde68a;
    color: #92400e;
}

.row-expiring .alert-action-btn:hover {
    background: #fef3c7;
    border-color: #f59e0b;
    color: #78350f;
}

.alert-item-left {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 220px;
}

.alert-tier-tag {
    font-size: 11px;
    font-weight: 800;
    padding: 3px 8px;
    border-radius: 5px;
    letter-spacing: 0.5px;
}

.tier-expired {
    background: #fee2e2;
    color: #991b1b;
    border: 1px solid #fca5a5;
}

.tier-warning {
    background: #fef3c7;
    color: #92400e;
    border: 1px solid #fde68a;
}

.alert-item-vehicle strong {
    display: block;
    font-size: 14px;
    font-weight: 700;
}

.alert-reg-no {
    font-size: 12px;
    font-family: monospace;
}

.alert-item-doc-info {
    display: flex;
    align-items: center;
    gap: 16px;
    font-size: 13px;
}

.alert-doc-type {
    font-weight: 700;
}

.alert-action-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 7px;
    font-size: 12px;
    font-weight: 700;
    text-decoration: none;
    transition: all 0.2s;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

/* Feature Cards & Operations Grid */
.operations-modules-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 16px;
    margin-top: 20px;
}

@media (max-width: 900px) {
    .operations-modules-grid {
        grid-template-columns: 1fr;
    }
}

.operation-nav-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 18px 20px;
    text-decoration: none;
    color: var(--text-primary);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    transition: all 0.2s ease;
    box-shadow: var(--shadow-sm);
}

.operation-nav-card:hover {
    background: var(--bg-card-hover);
    border-color: var(--blue-primary);
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
}

.op-card-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;
}

.op-card-header h4 {
    margin: 0;
    font-size: 1rem;
    font-weight: 700;
    color: var(--text-primary);
}

.op-icon-pill {
    width: 38px;
    height: 38px;
    border-radius: 9px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.15rem;
    flex-shrink: 0;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    transition: all 0.2s ease;
}

.op-icon-pill.map-pill {
    background: rgba(59, 130, 246, 0.12);
    border-color: rgba(59, 130, 246, 0.3);
    color: #3b82f6;
}

.op-icon-pill.insp-pill {
    background: rgba(168, 85, 247, 0.12);
    border-color: rgba(168, 85, 247, 0.3);
    color: #a855f7;
}

.op-icon-pill.agr-pill {
    background: rgba(16, 185, 129, 0.12);
    border-color: rgba(16, 185, 129, 0.3);
    color: #10b981;
}

.op-icon-pill.maint-pill {
    background: rgba(249, 115, 22, 0.12);
    border-color: rgba(249, 115, 22, 0.3);
    color: #ea580c;
}

.op-icon-pill.pricing-pill {
    background: rgba(59, 130, 246, 0.12);
    border-color: rgba(59, 130, 246, 0.3);
    color: #2563eb;
}

.operation-nav-card p {
    margin: 0 0 14px 0;
    font-size: 0.84rem;
    color: var(--text-secondary);
    line-height: 1.45;
}

.op-link-text {
    font-size: 0.84rem;
    font-weight: 700;
    color: var(--blue-primary);
    display: inline-flex;
    align-items: center;
    gap: 4px;
    transition: transform 0.2s ease, color 0.2s ease;
}

.operation-nav-card:hover .op-link-text {
    color: var(--blue-bright);
    transform: translateX(4px);
}

/* ========================================================
   DARK THEME DEDICATED STYLING FOR ADMIN DASHBOARD
   ======================================================== */
[data-theme="dark"] .alerts-banner-section {
    background: var(--bg-card);
    border-color: rgba(234, 88, 12, 0.38);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.35);
}

[data-theme="dark"] .alerts-banner-title h3 {
    color: #f8fafc;
}

[data-theme="dark"] .alerts-header-icon {
    color: #fb923c;
}

[data-theme="dark"] .alerts-count-badge {
    background: rgba(234, 88, 12, 0.2);
    color: #fdba74;
    border-color: rgba(234, 88, 12, 0.45);
}

[data-theme="dark"] .row-expired {
    background: rgba(239, 68, 68, 0.12);
    border-color: rgba(239, 68, 68, 0.38);
}

[data-theme="dark"] .row-expired:hover {
    border-color: rgba(239, 68, 68, 0.6);
}

[data-theme="dark"] .row-expired .alert-item-vehicle strong {
    color: #ffffff;
}

[data-theme="dark"] .row-expired .alert-reg-no {
    color: #fca5a5;
}

[data-theme="dark"] .row-expired .alert-item-doc-info {
    color: #fca5a5;
}

[data-theme="dark"] .row-expired .alert-doc-type {
    color: #ffffff;
}

[data-theme="dark"] .row-expired .alert-doc-no {
    color: #fca5a5;
}

[data-theme="dark"] .row-expired .alert-doc-expiry {
    color: #f87171;
    font-weight: 600;
}

[data-theme="dark"] .row-expired .tier-expired {
    background: rgba(239, 68, 68, 0.25);
    color: #fca5a5;
    border-color: rgba(239, 68, 68, 0.55);
}

[data-theme="dark"] .row-expired .alert-action-btn {
    background: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.45);
    color: #ffffff;
}

[data-theme="dark"] .row-expired .alert-action-btn:hover {
    background: rgba(239, 68, 68, 0.35);
    border-color: #ef4444;
    color: #ffffff;
}

[data-theme="dark"] .row-expiring {
    background: rgba(245, 158, 11, 0.12);
    border-color: rgba(245, 158, 11, 0.38);
}

[data-theme="dark"] .row-expiring:hover {
    border-color: rgba(245, 158, 11, 0.6);
}

[data-theme="dark"] .row-expiring .alert-item-vehicle strong {
    color: #ffffff;
}

[data-theme="dark"] .row-expiring .alert-reg-no {
    color: #fde68a;
}

[data-theme="dark"] .row-expiring .alert-item-doc-info {
    color: #fde68a;
}

[data-theme="dark"] .row-expiring .alert-doc-type {
    color: #ffffff;
}

[data-theme="dark"] .row-expiring .alert-doc-no {
    color: #fde68a;
}

[data-theme="dark"] .row-expiring .alert-doc-expiry {
    color: #fbbf24;
    font-weight: 600;
}

[data-theme="dark"] .row-expiring .tier-warning {
    background: rgba(245, 158, 11, 0.25);
    color: #fde68a;
    border-color: rgba(245, 158, 11, 0.55);
}

[data-theme="dark"] .row-expiring .alert-action-btn {
    background: rgba(245, 158, 11, 0.2);
    border-color: rgba(245, 158, 11, 0.45);
    color: #ffffff;
}

[data-theme="dark"] .row-expiring .alert-action-btn:hover {
    background: rgba(245, 158, 11, 0.35);
    border-color: #f59e0b;
    color: #ffffff;
}

/* Dark mode KPI Highlights */
[data-theme="dark"] .admin-kpi-card.highlight-warning {
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, var(--bg-card) 60%);
    border-left: 4px solid #fbbf24;
}

[data-theme="dark"] .admin-kpi-card.highlight-warning .kpi-icon {
    color: #fbbf24;
}

[data-theme="dark"] .admin-kpi-card.highlight-danger,
[data-theme="dark"] .admin-kpi-card.highlight-expired {
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, var(--bg-card) 60%);
    border-left: 4px solid #f87171;
}

[data-theme="dark"] .admin-kpi-card.highlight-danger .kpi-icon,
[data-theme="dark"] .admin-kpi-card.highlight-expired .kpi-icon {
    color: #f87171;
}

[data-theme="dark"] .admin-kpi-card.highlight-expiring {
    background: linear-gradient(135deg, rgba(234, 179, 8, 0.08) 0%, var(--bg-card) 60%);
    border-left: 4px solid #fde047;
}

[data-theme="dark"] .admin-kpi-card.highlight-expiring .kpi-icon {
    color: #fde047;
}

[data-theme="dark"] .admin-kpi-card.highlight-success {
    background: linear-gradient(135deg, rgba(74, 222, 128, 0.08) 0%, var(--bg-card) 60%);
    border-left: 4px solid var(--success);
}

[data-theme="dark"] .admin-kpi-card.highlight-success .kpi-icon {
    color: var(--success);
}

[data-theme="dark"] .admin-kpi-card.highlight-revenue {
    background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, var(--bg-card) 60%);
    border-color: var(--blue-border);
    border-left: 4px solid var(--blue-primary);
}

[data-theme="dark"] .admin-kpi-card.highlight-revenue .kpi-value {
    color: var(--blue-bright);
}

/* Dark mode pills */
[data-theme="dark"] .op-icon-pill.maint-pill {
    color: #fb923c;
}

[data-theme="dark"] .op-icon-pill.pricing-pill {
    color: #60a5fa;
}
`;

// Replace from alertsIdx to the end
content = content.substring(0, alertsIdx) + newAlertsAndFeaturesSection;

fs.writeFileSync(cssPath, toCRLF(content), 'utf8');
console.log('Successfully updated AdminDashboard.css');

