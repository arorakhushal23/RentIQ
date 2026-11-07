import React, { useState, useEffect } from 'react';
import {
    Percent,
    Calendar,
    Plus,
    RefreshCw,
    ToggleLeft,
    ToggleRight,
    Edit3,
    Trash2,
    DollarSign,
    Shield,
    Clock,
    Zap,
    Tag,
    Calculator,
    CheckCircle,
    Info,
    Car
} from 'lucide-react';
import axiosInstance from '../../api/axiosInstance';
import Loader from '../../components/common/Loader';
import './AdminPricing.css';

function AdminPricing() {
    const [activeTab, setActiveTab] = useState('rules'); // 'rules' | 'seasonal' | 'charges' | 'addons' | 'simulator'
    const [loading, setLoading] = useState(true);
    const [pricingRules, setPricingRules] = useState([]);
    const [seasonalPricing, setSeasonalPricing] = useState([]);
    const [additionalChargeRules, setAdditionalChargeRules] = useState([]);
    const [vehicles, setVehicles] = useState([]);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    // Modal state for Rules
    const [ruleModalOpen, setRuleModalOpen] = useState(false);
    const [isEditRule, setIsEditRule] = useState(false);
    const [selectedRuleId, setSelectedRuleId] = useState(null);
    const [ruleForm, setRuleForm] = useState({
        rule_name: '',
        rule_type: 'weekend',
        days_of_week: 'Friday,Saturday,Sunday',
        min_duration_days: '',
        max_duration_days: '',
        adjustment_type: 'percentage',
        adjustment_value: '',
        min_price_cap: '',
        max_price_cap: '',
        priority: 10,
        is_active: true
    });

    // Modal state for Seasonal
    const [seasonModalOpen, setSeasonModalOpen] = useState(false);
    const [isEditSeason, setIsEditSeason] = useState(false);
    const [selectedSeasonId, setSelectedSeasonId] = useState(null);
    const [seasonForm, setSeasonForm] = useState({
        season_name: '',
        start_date: '',
        end_date: '',
        adjustment_type: 'percentage',
        adjustment_value: '',
        is_active: true
    });

    // Modal state for Additional Charges & Addons
    const [chargeModalOpen, setChargeModalOpen] = useState(false);
    const [isEditCharge, setIsEditCharge] = useState(false);
    const [selectedChargeId, setSelectedChargeId] = useState(null);
    const [chargeForm, setChargeForm] = useState({
        charge_type: 'addon',
        charge_name: '',
        rate: '',
        unit: 'per_day',
        grace_period_mins: 0,
        included_units_per_day: 0,
        is_active: true
    });

    // Simulator State
    const [simVehicleId, setSimVehicleId] = useState('');
    const [simPickup, setSimPickup] = useState('2027-02-12T10:00');
    const [simReturn, setSimReturn] = useState('2027-02-14T10:00');
    const [simAddons, setSimAddons] = useState([]);
    const [simDistance, setSimDistance] = useState(0);
    const [simResult, setSimResult] = useState(null);
    const [simLoading, setSimLoading] = useState(false);
    const [simError, setSimError] = useState('');

    const fetchPricingData = async () => {
        setLoading(true);
        setError('');
        try {
            const [cfgRes, vehRes] = await Promise.all([
                axiosInstance.get('/pricing/config'),
                axiosInstance.get('/vehicles')
            ]);

            setPricingRules(cfgRes.data?.pricingRules || []);
            setSeasonalPricing(cfgRes.data?.seasonalPricing || []);
            setAdditionalChargeRules(cfgRes.data?.additionalChargeRules || []);

            const vehList = vehRes.data?.vehicles || vehRes.data || [];
            setVehicles(vehList);
            if (vehList.length > 0 && !simVehicleId) {
                setSimVehicleId(vehList[0].vehicle_id);
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load pricing data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPricingData();
    }, []);

    // Toggle Rule
    const handleToggleRule = async (id) => {
        try {
            await axiosInstance.patch(`/pricing/rules/${id}/toggle`);
            setSuccessMsg('Pricing rule status updated.');
            fetchPricingData();
            setTimeout(() => setSuccessMsg(''), 3000);
        } catch (err) {
            alert('Failed to toggle rule');
        }
    };

    // Toggle Season
    const handleToggleSeason = async (id) => {
        try {
            await axiosInstance.patch(`/pricing/seasonal/${id}/toggle`);
            setSuccessMsg('Seasonal pricing status updated.');
            fetchPricingData();
            setTimeout(() => setSuccessMsg(''), 3000);
        } catch (err) {
            alert('Failed to toggle seasonal window');
        }
    };

    // Delete Rule
    const handleDeleteRule = async (id) => {
        if (!window.confirm('Delete this pricing rule?')) return;
        try {
            await axiosInstance.delete(`/pricing/rules/${id}`);
            setSuccessMsg('Rule deleted.');
            fetchPricingData();
            setTimeout(() => setSuccessMsg(''), 3000);
        } catch (err) {
            alert('Failed to delete rule');
        }
    };

    // Delete Season
    const handleDeleteSeason = async (id) => {
        if (!window.confirm('Delete this seasonal window?')) return;
        try {
            await axiosInstance.delete(`/pricing/seasonal/${id}`);
            setSuccessMsg('Seasonal window deleted.');
            fetchPricingData();
            setTimeout(() => setSuccessMsg(''), 3000);
        } catch (err) {
            alert('Failed to delete seasonal window');
        }
    };

    // Delete Charge / Addon
    const handleDeleteCharge = async (id) => {
        if (!window.confirm('Delete this charge rule?')) return;
        try {
            await axiosInstance.delete(`/pricing/charges/${id}`);
            setSuccessMsg('Charge rule deleted.');
            fetchPricingData();
            setTimeout(() => setSuccessMsg(''), 3000);
        } catch (err) {
            alert('Failed to delete charge rule');
        }
    };

    // Submit Rule Form
    const handleRuleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (isEditRule) {
                await axiosInstance.put(`/pricing/rules/${selectedRuleId}`, ruleForm);
                setSuccessMsg('Pricing rule updated successfully.');
            } else {
                await axiosInstance.post('/pricing/rules', ruleForm);
                setSuccessMsg('Pricing rule created successfully.');
            }
            setRuleModalOpen(false);
            fetchPricingData();
            setTimeout(() => setSuccessMsg(''), 3000);
        } catch (err) {
            alert(err.response?.data?.message || 'Error saving rule');
        }
    };

    // Submit Season Form
    const handleSeasonSubmit = async (e) => {
        e.preventDefault();
        try {
            if (isEditSeason) {
                await axiosInstance.put(`/pricing/seasonal/${selectedSeasonId}`, seasonForm);
                setSuccessMsg('Seasonal window updated.');
            } else {
                await axiosInstance.post('/pricing/seasonal', seasonForm);
                setSuccessMsg('Seasonal window created.');
            }
            setSeasonModalOpen(false);
            fetchPricingData();
            setTimeout(() => setSuccessMsg(''), 3000);
        } catch (err) {
            alert(err.response?.data?.message || 'Error saving season');
        }
    };

    // Submit Charge Form
    const handleChargeSubmit = async (e) => {
        e.preventDefault();
        try {
            if (isEditCharge) {
                await axiosInstance.put(`/pricing/charges/${selectedChargeId}`, chargeForm);
                setSuccessMsg('Charge rule updated.');
            } else {
                await axiosInstance.post('/pricing/charges', chargeForm);
                setSuccessMsg('Charge rule created.');
            }
            setChargeModalOpen(false);
            fetchPricingData();
            setTimeout(() => setSuccessMsg(''), 3000);
        } catch (err) {
            alert(err.response?.data?.message || 'Error saving charge rule');
        }
    };

    // Simulator Calculation
    const runSimulation = async () => {
        if (!simVehicleId || !simPickup || !simReturn) return;
        setSimLoading(true);
        setSimError('');
        try {
            const res = await axiosInstance.post('/pricing/calculate', {
                vehicle_id: Number(simVehicleId),
                pickup_datetime: simPickup,
                return_datetime: simReturn,
                selected_addons: simAddons,
                delivery_distance_km: Number(simDistance) || 0
            });
            setSimResult(res.data);
        } catch (err) {
            setSimError(err.response?.data?.message || 'Simulation calculation failed');
            setSimResult(null);
        } finally {
            setSimLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'simulator' && simVehicleId) {
            runSimulation();
        }
    }, [activeTab, simVehicleId, simPickup, simReturn, simAddons, simDistance]);

    const toggleSimAddon = (addonId) => {
        if (simAddons.includes(addonId)) {
            setSimAddons(simAddons.filter(id => id !== addonId));
        } else {
            setSimAddons([...simAddons, addonId]);
        }
    };

    if (loading && pricingRules.length === 0) {
        return (
            <div className="pricing-page">
                <Loader message="Loading Smart Pricing Rules..." />
            </div>
        );
    }

    const availableAddons = additionalChargeRules.filter(r => r.charge_type === 'addon');
    const feeRules = additionalChargeRules.filter(r => r.charge_type !== 'addon');

    return (
        <div className="pricing-page">
            {/* Header */}
            <div className="pricing-header">
                <div>
                    <h1 className="pricing-title">Smart Pricing & Additional Charges</h1>
                    <p className="pricing-subtitle">
                        Configure dynamic price rules, weekend peak surcharges, holiday calendar rates, post-rental penalty rules, and add-on accessories.
                    </p>
                </div>
                <div className="header-actions">
                    <button className="btn-refresh" onClick={fetchPricingData} title="Refresh">
                        <RefreshCw size={16} />
                    </button>
                    {activeTab === 'rules' && (
                        <button className="btn-primary" onClick={() => {
                            setIsEditRule(false);
                            setRuleForm({
                                rule_name: '',
                                rule_type: 'weekend',
                                days_of_week: 'Friday,Saturday,Sunday',
                                min_duration_days: '',
                                max_duration_days: '',
                                adjustment_type: 'percentage',
                                adjustment_value: '',
                                min_price_cap: '',
                                max_price_cap: '',
                                priority: 10,
                                is_active: true
                            });
                            setRuleModalOpen(true);
                        }}>
                            <Plus size={18} /> New Pricing Rule
                        </button>
                    )}
                    {activeTab === 'seasonal' && (
                        <button className="btn-primary" onClick={() => {
                            setIsEditSeason(false);
                            setSeasonForm({
                                season_name: '',
                                start_date: '',
                                end_date: '',
                                adjustment_type: 'percentage',
                                adjustment_value: '',
                                is_active: true
                            });
                            setSeasonModalOpen(true);
                        }}>
                            <Plus size={18} /> Add Season Calendar
                        </button>
                    )}
                    {(activeTab === 'charges' || activeTab === 'addons') && (
                        <button className="btn-primary" onClick={() => {
                            setIsEditCharge(false);
                            setChargeForm({
                                charge_type: activeTab === 'addons' ? 'addon' : 'late_return',
                                charge_name: '',
                                rate: '',
                                unit: activeTab === 'addons' ? 'per_day' : 'per_hour',
                                grace_period_mins: 0,
                                included_units_per_day: 0,
                                is_active: true
                            });
                            setChargeModalOpen(true);
                        }}>
                            <Plus size={18} /> Add {activeTab === 'addons' ? 'Accessory' : 'Fee Rule'}
                        </button>
                    )}
                </div>
            </div>

            {/* Notifications */}
            {successMsg && <div className="alert-banner alert-success">{successMsg}</div>}
            {error && <div className="alert-banner alert-danger">{error}</div>}

            {/* Tabs */}
            <div className="tab-nav">
                <button
                    className={`tab-btn ${activeTab === 'rules' ? 'active' : ''}`}
                    onClick={() => setActiveTab('rules')}
                >
                    <Percent size={16} /> Dynamic Pricing Rules ({pricingRules.length})
                </button>
                <button
                    className={`tab-btn ${activeTab === 'seasonal' ? 'active' : ''}`}
                    onClick={() => setActiveTab('seasonal')}
                >
                    <Calendar size={16} /> Seasonal Calendars ({seasonalPricing.length})
                </button>
                <button
                    className={`tab-btn ${activeTab === 'charges' ? 'active' : ''}`}
                    onClick={() => setActiveTab('charges')}
                >
                    <Shield size={16} /> Penalty & Fee Rules ({feeRules.length})
                </button>
                <button
                    className={`tab-btn ${activeTab === 'addons' ? 'active' : ''}`}
                    onClick={() => setActiveTab('addons')}
                >
                    <Tag size={16} /> Add-on Accessories ({availableAddons.length})
                </button>
                <button
                    className={`tab-btn ${activeTab === 'simulator' ? 'active' : ''}`}
                    onClick={() => setActiveTab('simulator')}
                >
                    <Calculator size={16} /> Live Pricing Simulator
                </button>
            </div>

            {/* TAB 1: DYNAMIC PRICING RULES */}
            {activeTab === 'rules' && (
                <div className="tab-pane">
                    <div className="rules-grid">
                        {pricingRules.map(rule => {
                            const isDiscount = Number(rule.adjustment_value) < 0;
                            const isPercentage = rule.adjustment_type === 'percentage';
                            return (
                                <div key={rule.id} className={`rule-card ${rule.is_active ? 'rule-active' : 'rule-inactive'}`}>
                                    <div className="rule-card-header">
                                        <div className="rule-type-badge">
                                            {rule.rule_type.replace('_', ' ').toUpperCase()}
                                        </div>
                                        <button
                                            className="toggle-btn"
                                            onClick={() => handleToggleRule(rule.id)}
                                            title={rule.is_active ? 'Active (Click to deactivate)' : 'Inactive (Click to activate)'}
                                        >
                                            {rule.is_active ? (
                                                <ToggleRight size={28} className="text-green" />
                                            ) : (
                                                <ToggleLeft size={28} className="text-muted" />
                                            )}
                                        </button>
                                    </div>

                                    <h3 className="rule-name">{rule.rule_name}</h3>

                                    <div className="rule-adjustment">
                                        <span className={`adj-val ${isDiscount ? 'text-green' : 'text-orange'}`}>
                                            {isDiscount ? '' : '+'}
                                            {rule.adjustment_value}
                                            {isPercentage ? '%' : ' ₹'}
                                        </span>
                                        <span className="adj-sub">
                                            {isDiscount ? 'Discount applied' : 'Peak surcharge'}
                                        </span>
                                    </div>

                                    <div className="rule-details">
                                        {rule.days_of_week && (
                                            <div className="detail-row">
                                                <span className="detail-lbl">Active Days:</span>
                                                <span className="detail-val">{rule.days_of_week}</span>
                                            </div>
                                        )}
                                        {(rule.min_duration_days || rule.max_duration_days) && (
                                            <div className="detail-row">
                                                <span className="detail-lbl">Duration Bounds:</span>
                                                <span className="detail-val">
                                                    {rule.min_duration_days || 1} to {rule.max_duration_days || '∞'} days
                                                </span>
                                            </div>
                                        )}
                                        <div className="detail-row">
                                            <span className="detail-lbl">Execution Priority:</span>
                                            <span className="detail-val">{rule.priority}</span>
                                        </div>
                                    </div>

                                    <div className="rule-footer">
                                        <button
                                            className="btn-icon"
                                            onClick={() => {
                                                setIsEditRule(true);
                                                setSelectedRuleId(rule.id);
                                                setRuleForm({
                                                    rule_name: rule.rule_name,
                                                    rule_type: rule.rule_type,
                                                    days_of_week: rule.days_of_week || '',
                                                    min_duration_days: rule.min_duration_days || '',
                                                    max_duration_days: rule.max_duration_days || '',
                                                    adjustment_type: rule.adjustment_type,
                                                    adjustment_value: rule.adjustment_value,
                                                    min_price_cap: rule.min_price_cap || '',
                                                    max_price_cap: rule.max_price_cap || '',
                                                    priority: rule.priority,
                                                    is_active: Boolean(rule.is_active)
                                                });
                                                setRuleModalOpen(true);
                                            }}
                                            title="Edit Rule"
                                        >
                                            <Edit3 size={16} />
                                        </button>
                                        <button
                                            className="btn-icon btn-delete"
                                            onClick={() => handleDeleteRule(rule.id)}
                                            title="Delete Rule"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* TAB 2: SEASONAL CALENDARS */}
            {activeTab === 'seasonal' && (
                <div className="tab-pane">
                    <div className="table-container">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Season / Holiday Name</th>
                                    <th>Start Date</th>
                                    <th>End Date</th>
                                    <th>Rate Adjustment</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {seasonalPricing.map(s => (
                                    <tr key={s.id}>
                                        <td><strong>{s.season_name}</strong></td>
                                        <td>{s.start_date ? s.start_date.split('T')[0] : ''}</td>
                                        <td>{s.end_date ? s.end_date.split('T')[0] : ''}</td>
                                        <td>
                                            <span className="cat-chip">
                                                +{s.adjustment_value}{s.adjustment_type === 'percentage' ? '%' : ' ₹'}
                                            </span>
                                        </td>
                                        <td>
                                            <button
                                                className="toggle-btn"
                                                onClick={() => handleToggleSeason(s.id)}
                                            >
                                                {s.is_active ? (
                                                    <ToggleRight size={24} className="text-green" />
                                                ) : (
                                                    <ToggleLeft size={24} className="text-muted" />
                                                )}
                                            </button>
                                        </td>
                                        <td>
                                            <div className="action-buttons">
                                                <button
                                                    className="btn-icon"
                                                    onClick={() => {
                                                        setIsEditSeason(true);
                                                        setSelectedSeasonId(s.id);
                                                        setSeasonForm({
                                                            season_name: s.season_name,
                                                            start_date: s.start_date.split('T')[0],
                                                            end_date: s.end_date.split('T')[0],
                                                            adjustment_type: s.adjustment_type,
                                                            adjustment_value: s.adjustment_value,
                                                            is_active: Boolean(s.is_active)
                                                        });
                                                        setSeasonModalOpen(true);
                                                    }}
                                                >
                                                    <Edit3 size={16} />
                                                </button>
                                                <button
                                                    className="btn-icon btn-delete"
                                                    onClick={() => handleDeleteSeason(s.id)}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB 3: PENALTY & FEE RULES */}
            {activeTab === 'charges' && (
                <div className="tab-pane">
                    <div className="table-container">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Rule Name</th>
                                    <th>Charge Type</th>
                                    <th>Rate</th>
                                    <th>Billing Unit</th>
                                    <th>Grace Period</th>
                                    <th>Daily Included Units</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {feeRules.map(c => (
                                    <tr key={c.id}>
                                        <td><strong>{c.charge_name}</strong></td>
                                        <td>
                                            <span className="cat-chip">{c.charge_type.replace('_', ' ')}</span>
                                        </td>
                                        <td><strong>₹{Number(c.rate).toLocaleString('en-IN')}</strong></td>
                                        <td>{c.unit.replace('_', ' ')}</td>
                                        <td>{c.grace_period_mins ? `${c.grace_period_mins} mins` : '-'}</td>
                                        <td>{c.included_units_per_day ? `${c.included_units_per_day} km/day` : '-'}</td>
                                        <td>
                                            <div className="action-buttons">
                                                <button
                                                    className="btn-icon"
                                                    onClick={() => {
                                                        setIsEditCharge(true);
                                                        setSelectedChargeId(c.id);
                                                        setChargeForm({
                                                            charge_type: c.charge_type,
                                                            charge_name: c.charge_name,
                                                            rate: c.rate,
                                                            unit: c.unit,
                                                            grace_period_mins: c.grace_period_mins || 0,
                                                            included_units_per_day: c.included_units_per_day || 0,
                                                            is_active: Boolean(c.is_active)
                                                        });
                                                        setChargeModalOpen(true);
                                                    }}
                                                >
                                                    <Edit3 size={16} />
                                                </button>
                                                <button
                                                    className="btn-icon btn-delete"
                                                    onClick={() => handleDeleteCharge(c.id)}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB 4: ADD-ON ACCESSORIES */}
            {activeTab === 'addons' && (
                <div className="tab-pane">
                    <div className="addons-grid">
                        {availableAddons.map(addon => (
                            <div key={addon.id} className="addon-admin-card">
                                <div className="addon-card-header">
                                    <Tag size={20} className="text-blue" />
                                    <span className="addon-price">₹{addon.rate} / {addon.unit.replace('_', ' ')}</span>
                                </div>
                                <h4 className="addon-name">{addon.charge_name}</h4>
                                <div className="addon-card-footer">
                                    <button
                                        className="btn-icon"
                                        onClick={() => {
                                            setIsEditCharge(true);
                                            setSelectedChargeId(addon.id);
                                            setChargeForm({
                                                charge_type: 'addon',
                                                charge_name: addon.charge_name,
                                                rate: addon.rate,
                                                unit: addon.unit,
                                                grace_period_mins: 0,
                                                included_units_per_day: 0,
                                                is_active: Boolean(addon.is_active)
                                            });
                                            setChargeModalOpen(true);
                                        }}
                                    >
                                        <Edit3 size={16} />
                                    </button>
                                    <button
                                        className="btn-icon btn-delete"
                                        onClick={() => handleDeleteCharge(addon.id)}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* TAB 5: LIVE PRICING SIMULATOR */}
            {activeTab === 'simulator' && (
                <div className="tab-pane simulator-pane">
                    <div className="simulator-grid">
                        {/* Simulation Inputs */}
                        <div className="sim-panel sim-inputs">
                            <h3>Test Pricing Parameters</h3>
                            <div className="form-group">
                                <label>Target Vehicle</label>
                                <select
                                    value={simVehicleId}
                                    onChange={(e) => setSimVehicleId(e.target.value)}
                                >
                                    {vehicles.map(v => (
                                        <option key={v.vehicle_id} value={v.vehicle_id}>
                                            {v.brand} {v.name} (₹{v.price_per_day}/day)
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-row-2">
                                <div className="form-group">
                                    <label>Pickup Date & Time</label>
                                    <input
                                        type="datetime-local"
                                        value={simPickup}
                                        onChange={(e) => setSimPickup(e.target.value)}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Return Date & Time</label>
                                    <input
                                        type="datetime-local"
                                        value={simReturn}
                                        onChange={(e) => setSimReturn(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Delivery Distance (km)</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={simDistance}
                                    onChange={(e) => setSimDistance(Number(e.target.value))}
                                />
                            </div>

                            <div className="form-group">
                                <label>Select Add-on Accessories</label>
                                <div className="sim-addons-selector">
                                    {availableAddons.map(addon => (
                                        <label key={addon.id} className="checkbox-lbl">
                                            <input
                                                type="checkbox"
                                                checked={simAddons.includes(addon.id)}
                                                onChange={() => toggleSimAddon(addon.id)}
                                            />
                                            {addon.charge_name} (+₹{addon.rate})
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <button className="btn-primary" onClick={runSimulation} disabled={simLoading}>
                                <Calculator size={18} /> {simLoading ? 'Calculating...' : 'Recalculate Breakdown'}
                            </button>
                        </div>

                        {/* Simulation Output */}
                        <div className="sim-panel sim-output">
                            <h3>Authoritative Price Breakdown</h3>

                            {simError && <div className="alert-banner alert-danger">{simError}</div>}

                            {simResult && (
                                <div className="breakdown-sheet">
                                    <div className="sheet-row">
                                        <span>Vehicle Base Rental ({simResult.rentalDays} days @ ₹{simResult.dailyRate})</span>
                                        <strong>₹{simResult.baseRentalPrice.toFixed(2)}</strong>
                                    </div>

                                    {simResult.weekendAdjustment > 0 && (
                                        <div className="sheet-row text-orange">
                                            <span>Weekend Surcharge ({simResult.weekendDaysCount} weekend days)</span>
                                            <strong>+₹{simResult.weekendAdjustment.toFixed(2)}</strong>
                                        </div>
                                    )}

                                    {simResult.seasonalAdjustment > 0 && (
                                        <div className="sheet-row text-orange">
                                            <span>Seasonal Adjustment ({simResult.seasonName || 'Peak Season'})</span>
                                            <strong>+₹{simResult.seasonalAdjustment.toFixed(2)}</strong>
                                        </div>
                                    )}

                                    {simResult.durationDiscount > 0 && (
                                        <div className="sheet-row text-green">
                                            <span>Duration Discount ({simResult.discountRuleName})</span>
                                            <strong>-₹{simResult.durationDiscount.toFixed(2)}</strong>
                                        </div>
                                    )}

                                    {simResult.deliveryCharge > 0 && (
                                        <div className="sheet-row">
                                            <span>Doorstep Delivery ({simResult.deliveryDistanceKm} km)</span>
                                            <strong>+₹{simResult.deliveryCharge.toFixed(2)}</strong>
                                        </div>
                                    )}

                                    {simResult.appliedAddons?.length > 0 && (
                                        <div className="sheet-addons">
                                            <span className="sheet-subhead">Add-on Accessories:</span>
                                            {simResult.appliedAddons.map(a => (
                                                <div key={a.addonId} className="sheet-row addon-row">
                                                    <span>{a.name} ({a.units} {a.unit.replace('_', ' ')})</span>
                                                    <span>+₹{a.totalCost.toFixed(2)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="sheet-total-row">
                                        <span>Simulated Final Total:</span>
                                        <span className="final-price">₹{simResult.finalTotal.toFixed(2)}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* RULE MODAL */}
            {ruleModalOpen && (
                <div className="modal-backdrop">
                    <div className="modal-content modal-md">
                        <div className="modal-header">
                            <h3>{isEditRule ? 'Edit Pricing Rule' : 'New Pricing Rule'}</h3>
                            <button className="close-btn" onClick={() => setRuleModalOpen(false)}>×</button>
                        </div>
                        <form onSubmit={handleRuleSubmit} className="modal-form">
                            <div className="form-group">
                                <label>Rule Name <span className="req">*</span></label>
                                <input
                                    type="text"
                                    placeholder="e.g. Weekend Rush Surcharge"
                                    value={ruleForm.rule_name}
                                    onChange={(e) => setRuleForm({ ...ruleForm, rule_name: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="form-row-2">
                                <div className="form-group">
                                    <label>Rule Type <span className="req">*</span></label>
                                    <select
                                        value={ruleForm.rule_type}
                                        onChange={(e) => setRuleForm({ ...ruleForm, rule_type: e.target.value })}
                                    >
                                        <option value="weekend">Weekend Surcharge</option>
                                        <option value="duration_discount">Duration Discount</option>
                                        <option value="demand">Demand Surge</option>
                                        <option value="custom">Custom Adjustment</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>Execution Priority</label>
                                    <input
                                        type="number"
                                        value={ruleForm.priority}
                                        onChange={(e) => setRuleForm({ ...ruleForm, priority: Number(e.target.value) })}
                                    />
                                </div>
                            </div>

                            {ruleForm.rule_type === 'weekend' && (
                                <div className="form-group">
                                    <label>Active Days of Week (comma-separated)</label>
                                    <input
                                        type="text"
                                        placeholder="Friday,Saturday,Sunday"
                                        value={ruleForm.days_of_week}
                                        onChange={(e) => setRuleForm({ ...ruleForm, days_of_week: e.target.value })}
                                    />
                                </div>
                            )}

                            {ruleForm.rule_type === 'duration_discount' && (
                                <div className="form-row-2">
                                    <div className="form-group">
                                        <label>Min Duration (Days)</label>
                                        <input
                                            type="number"
                                            placeholder="e.g. 7"
                                            value={ruleForm.min_duration_days}
                                            onChange={(e) => setRuleForm({ ...ruleForm, min_duration_days: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Max Duration (Days)</label>
                                        <input
                                            type="number"
                                            placeholder="e.g. 29"
                                            value={ruleForm.max_duration_days}
                                            onChange={(e) => setRuleForm({ ...ruleForm, max_duration_days: e.target.value })}
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="form-row-2">
                                <div className="form-group">
                                    <label>Adjustment Type</label>
                                    <select
                                        value={ruleForm.adjustment_type}
                                        onChange={(e) => setRuleForm({ ...ruleForm, adjustment_type: e.target.value })}
                                    >
                                        <option value="percentage">Percentage (%)</option>
                                        <option value="fixed">Fixed Amount (₹)</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>Adjustment Value <span className="req">*</span></label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        placeholder="e.g. 15 for +15%, or -10 for -10% discount"
                                        value={ruleForm.adjustment_value}
                                        onChange={(e) => setRuleForm({ ...ruleForm, adjustment_value: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="modal-actions">
                                <button type="button" className="btn-secondary" onClick={() => setRuleModalOpen(false)}>Cancel</button>
                                <button type="submit" className="btn-primary">Save Rule</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* SEASONAL MODAL */}
            {seasonModalOpen && (
                <div className="modal-backdrop">
                    <div className="modal-content modal-md">
                        <div className="modal-header">
                            <h3>{isEditSeason ? 'Edit Season Calendar' : 'New Season Calendar'}</h3>
                            <button className="close-btn" onClick={() => setSeasonModalOpen(false)}>×</button>
                        </div>
                        <form onSubmit={handleSeasonSubmit} className="modal-form">
                            <div className="form-group">
                                <label>Season / Holiday Name <span className="req">*</span></label>
                                <input
                                    type="text"
                                    placeholder="e.g. Winter Holiday & Year-End Peak"
                                    value={seasonForm.season_name}
                                    onChange={(e) => setSeasonForm({ ...seasonForm, season_name: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="form-row-2">
                                <div className="form-group">
                                    <label>Start Date <span className="req">*</span></label>
                                    <input
                                        type="date"
                                        value={seasonForm.start_date}
                                        onChange={(e) => setSeasonForm({ ...seasonForm, start_date: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>End Date <span className="req">*</span></label>
                                    <input
                                        type="date"
                                        value={seasonForm.end_date}
                                        onChange={(e) => setSeasonForm({ ...seasonForm, end_date: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-row-2">
                                <div className="form-group">
                                    <label>Adjustment Type</label>
                                    <select
                                        value={seasonForm.adjustment_type}
                                        onChange={(e) => setSeasonForm({ ...seasonForm, adjustment_type: e.target.value })}
                                    >
                                        <option value="percentage">Percentage (%)</option>
                                        <option value="fixed">Fixed Amount (₹)</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Adjustment Value (%) <span className="req">*</span></label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        placeholder="e.g. 20 for +20%"
                                        value={seasonForm.adjustment_value}
                                        onChange={(e) => setSeasonForm({ ...seasonForm, adjustment_value: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="modal-actions">
                                <button type="button" className="btn-secondary" onClick={() => setSeasonModalOpen(false)}>Cancel</button>
                                <button type="submit" className="btn-primary">Save Season</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* CHARGE / ADDON MODAL */}
            {chargeModalOpen && (
                <div className="modal-backdrop">
                    <div className="modal-content modal-md">
                        <div className="modal-header">
                            <h3>{isEditCharge ? 'Edit Charge Rule' : 'New Charge Rule'}</h3>
                            <button className="close-btn" onClick={() => setChargeModalOpen(false)}>×</button>
                        </div>
                        <form onSubmit={handleChargeSubmit} className="modal-form">
                            <div className="form-group">
                                <label>Charge Name <span className="req">*</span></label>
                                <input
                                    type="text"
                                    placeholder="e.g. GPS Navigation Unit"
                                    value={chargeForm.charge_name}
                                    onChange={(e) => setChargeForm({ ...chargeForm, charge_name: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="form-row-2">
                                <div className="form-group">
                                    <label>Charge Type</label>
                                    <select
                                        value={chargeForm.charge_type}
                                        onChange={(e) => setChargeForm({ ...chargeForm, charge_type: e.target.value })}
                                    >
                                        <option value="addon">Add-on Accessory</option>
                                        <option value="late_return">Late Return Fee</option>
                                        <option value="excess_km">Excess Kilometre Fee</option>
                                        <option value="fuel_refill">Fuel Deficit Fee</option>
                                        <option value="cleaning">Cleaning Fee</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>Rate (₹) <span className="req">*</span></label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        placeholder="e.g. 150.00"
                                        value={chargeForm.rate}
                                        onChange={(e) => setChargeForm({ ...chargeForm, rate: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-row-2">
                                <div className="form-group">
                                    <label>Billing Unit</label>
                                    <select
                                        value={chargeForm.unit}
                                        onChange={(e) => setChargeForm({ ...chargeForm, unit: e.target.value })}
                                    >
                                        <option value="per_day">Per Day</option>
                                        <option value="per_hour">Per Hour</option>
                                        <option value="per_km">Per Kilometre</option>
                                        <option value="per_percent">Per Percentage (%)</option>
                                        <option value="fixed">Fixed Amount</option>
                                    </select>
                                </div>

                                {chargeForm.charge_type === 'late_return' && (
                                    <div className="form-group">
                                        <label>Grace Period (minutes)</label>
                                        <input
                                            type="number"
                                            placeholder="e.g. 45"
                                            value={chargeForm.grace_period_mins}
                                            onChange={(e) => setChargeForm({ ...chargeForm, grace_period_mins: e.target.value })}
                                        />
                                    </div>
                                )}

                                {chargeForm.charge_type === 'excess_km' && (
                                    <div className="form-group">
                                        <label>Included Units Per Day (km)</label>
                                        <input
                                            type="number"
                                            placeholder="e.g. 250"
                                            value={chargeForm.included_units_per_day}
                                            onChange={(e) => setChargeForm({ ...chargeForm, included_units_per_day: e.target.value })}
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="modal-actions">
                                <button type="button" className="btn-secondary" onClick={() => setChargeModalOpen(false)}>Cancel</button>
                                <button type="submit" className="btn-primary">Save Charge Rule</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default AdminPricing;

