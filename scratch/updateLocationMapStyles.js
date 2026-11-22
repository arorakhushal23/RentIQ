const fs = require('fs');
const path = require('path');

const cssPath = path.resolve('frontend/src/components/map/LocationPickerMap.css');
let content = fs.readFileSync(cssPath, 'utf8');

// Replace map-search-submit-btn section
const oldSubmitBtn = `.map-search-submit-btn {
    padding: 9px 16px;
    background: var(--primary-color, #0284c7);
    color: #ffffff;
    border: none;
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;
}

.map-search-submit-btn:hover:not(:disabled) {
    background: var(--primary-hover, #0369a1);
}`;

const newSubmitBtn = `.clear-search-btn {
    background: transparent;
    border: none;
    color: var(--text-muted, #94a3b8);
    cursor: pointer;
    padding: 6px 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.15s ease;
    border-radius: 4px;
}

.clear-search-btn:hover {
    color: var(--text-primary, #0f172a);
}

.map-search-submit-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 9px 18px;
    background: var(--primary-color, #0284c7);
    color: #ffffff;
    border: none;
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.15s ease;
    flex-shrink: 0;
}

.map-search-submit-btn:hover:not(:disabled) {
    background: var(--primary-hover, #0369a1);
}

.map-search-submit-btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
}

.map-search-error-msg {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.78rem;
    font-weight: 500;
    color: #b91c1c;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 6px;
    padding: 7px 12px;
    margin-top: 6px;
    animation: fadeIn 0.2s ease-in;
}

.search-err-icon {
    flex-shrink: 0;
    color: #ef4444;
}

@keyframes fadeIn {
    from { opacity: 0; transform: translateY(-3px); }
    to { opacity: 1; transform: translateY(0); }
}`;

const normalize = s => s.replace(/\r\n/g, '\n');
const toCRLF = s => s.replace(/\r?\n/g, '\r\n');

content = normalize(content);

if (!content.includes(normalize(oldSubmitBtn))) {
    console.error('Could not find oldSubmitBtn!');
    process.exit(1);
}

content = content.replace(normalize(oldSubmitBtn), normalize(newSubmitBtn));

// Append Dark Mode & Mobile Responsive styles
const extraStyles = `
/* Mobile Responsive Search Bar */
@media (max-width: 520px) {
    .map-search-input-wrap {
        position: relative;
    }

    .map-search-input {
        padding: 8px 10px;
        font-size: 0.8rem;
    }

    .map-search-submit-btn {
        padding: 8px 12px;
        font-size: 0.78rem;
    }
}

/* Dark Mode Overrides for Location Picker Map */
[data-theme="dark"] .map-search-dropdown {
    background: var(--bg-card, #141f36);
    border-color: var(--border, #1e2e4a);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
}

[data-theme="dark"] .search-result-item {
    color: var(--text-primary, #f8fafc);
    border-bottom-color: var(--border, #1e2e4a);
}

[data-theme="dark"] .search-result-item:hover {
    background: var(--bg-secondary, #192744);
    color: var(--blue-bright, #60a5fa);
}

[data-theme="dark"] .map-search-error-msg {
    background: rgba(239, 68, 68, 0.15);
    border-color: rgba(239, 68, 68, 0.35);
    color: #fca5a5;
}

[data-theme="dark"] .clear-search-btn:hover {
    color: #ffffff;
}
`;

content += extraStyles;

fs.writeFileSync(cssPath, toCRLF(content), 'utf8');
console.log('Successfully updated LocationPickerMap.css');

