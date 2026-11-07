import React, { useState, useEffect } from 'react';
import {
    X, Camera, CheckCircle, AlertTriangle, Gauge, Fuel, Shield,
    Car, ArrowRight, Eye, Upload, FileCheck
} from 'lucide-react';
import axiosInstance from '../../api/axiosInstance';
import Loader from '../common/Loader';
import './InspectionModal.css';

const PHOTO_CATEGORIES = [
    { value: 'front', label: 'Front View' },
    { value: 'rear', label: 'Rear View' },
    { value: 'left', label: 'Left Side' },
    { value: 'right', label: 'Right Side' },
    { value: 'interior', label: 'Interior Cabin' },
    { value: 'dashboard', label: 'Dashboard & Cluster' },
    { value: 'tyres', label: 'Tyres & Wheels' },
    { value: 'damage', label: 'Existing Scratches / Dents' }
];

function InspectionModal({ bookingId, isAdmin = false, onClose, onInspectionUpdated }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [actionLoading, setActionLoading] = useState(false);

    // Active Tab in Modal: 'view_report' | 'record_pickup' | 'record_return'
    const [activeTab, setActiveTab] = useState('view_report');

    // Inspection Form State
    const [formType, setFormType] = useState('pickup');
    const [odometer, setOdometer] = useState('');
    const [fuelLevel, setFuelLevel] = useState(100);
    const [batteryPercentage, setBatteryPercentage] = useState('');
    const [exteriorCondition, setExteriorCondition] = useState('good');
    const [interiorCondition, setInteriorCondition] = useState('good');
    const [tyreCondition, setTyreCondition] = useState('good');
    const [headlightsCondition, setHeadlightsCondition] = useState('working');
    const [taillightsCondition, setTaillightsCondition] = useState('working');
    const [mirrorsCondition, setMirrorsCondition] = useState('intact');
    const [windowsCondition, setWindowsCondition] = useState('intact');
    const [brakesCondition, setBrakesCondition] = useState('optimal');
    const [existingScratches, setExistingScratches] = useState('');
    const [existingDents, setExistingDents] = useState('');
    const [damageDescription, setDamageDescription] = useState('');
    const [inspectionNotes, setInspectionNotes] = useState('');
    const [selectedPhotos, setSelectedPhotos] = useState([]);
    const [photoCategoryMap, setPhotoCategoryMap] = useState({});

    // Lightbox / Photo preview
    const [previewPhotoUrl, setPreviewPhotoUrl] = useState(null);

    const fetchInspections = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await axiosInstance.get(`/inspections/booking/${bookingId}`);
            setData(res.data);
            if (!res.data.pickupInspection && isAdmin) {
                setActiveTab('record_pickup');
                setFormType('pickup');
            } else {
                setActiveTab('view_report');
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load vehicle inspections.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (bookingId) {
            fetchInspections();
        }
    }, [bookingId]);

    // Handle Photo File Select
    const handleFileChange = (e) => {
        const files = Array.from(e.target.files);
        setSelectedPhotos(files);
        const map = {};
        files.forEach((f, idx) => {
            map[idx] = PHOTO_CATEGORIES[idx % PHOTO_CATEGORIES.length].value;
        });
        setPhotoCategoryMap(map);
    };

    // Submit Inspection (Admin)
    const handleSubmitInspection = async (e) => {
        e.preventDefault();
        if (!odometer) {
            alert('Please enter a valid odometer reading.');
            return;
        }

        setActionLoading(true);
        setError('');
        try {
            const formData = new FormData();
            formData.append('booking_id', bookingId);
            formData.append('inspection_type', formType);
            formData.append('odometer_reading', odometer);
            formData.append('fuel_level', fuelLevel);
            if (batteryPercentage) formData.append('battery_percentage', batteryPercentage);
            formData.append('exterior_condition', exteriorCondition);
            formData.append('interior_condition', interiorCondition);
            formData.append('tyre_condition', tyreCondition);
            formData.append('headlights_condition', headlightsCondition);
            formData.append('taillights_condition', taillightsCondition);
            formData.append('mirrors_condition', mirrorsCondition);
            formData.append('windows_condition', windowsCondition);
            formData.append('brakes_condition', brakesCondition);
            formData.append('existing_scratches', existingScratches);
            formData.append('existing_dents', existingDents);
            formData.append('damage_description', damageDescription);
            formData.append('inspection_notes', inspectionNotes);

            selectedPhotos.forEach((file, idx) => {
                formData.append('photos', file);
                formData.append('photo_categories', photoCategoryMap[idx] || 'other');
            });

            await axiosInstance.post('/admin/inspections', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            alert(`${formType === 'pickup' ? 'Pickup' : 'Return'} inspection recorded successfully!`);
            setSelectedPhotos([]);
            await fetchInspections();
            if (onInspectionUpdated) onInspectionUpdated();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to submit inspection.');
        } finally {
            setActionLoading(false);
        }
    };

    // Customer accepts vehicle condition
    const handleCustomerAccept = async (inspId) => {
        setActionLoading(true);
        try {
            await axiosInstance.post(`/inspections/${inspId}/accept`);
            alert('Vehicle condition accepted successfully!');
            await fetchInspections();
            if (onInspectionUpdated) onInspectionUpdated();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to accept vehicle condition.');
        } finally {
            setActionLoading(false);
        }
    };

    // Admin Handover
    const handleCompleteHandover = async () => {
        setActionLoading(true);
        try {
            await axiosInstance.post(`/admin/inspections/booking/${bookingId}/handover`);
            alert('Vehicle handover complete! Booking is now Active.');
            await fetchInspections();
            if (onInspectionUpdated) onInspectionUpdated();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to complete handover.');
        } finally {
            setActionLoading(false);
        }
    };

    // Admin Complete Rental
    const handleCompleteRental = async () => {
        setActionLoading(true);
        try {
            await axiosInstance.post(`/admin/inspections/booking/${bookingId}/complete-rental`);
            alert('Rental successfully completed and closed.');
            await fetchInspections();
            if (onInspectionUpdated) onInspectionUpdated();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to complete rental.');
        } finally {
            setActionLoading(false);
        }
    };

    const booking = data?.booking || {};
    const pickup = data?.pickupInspection || null;
    const ret = data?.returnInspection || null;
    const diff = data?.differenceReport || null;

    return (
        <div className="modal-backdrop-inspection" onClick={onClose}>
            <div className="inspection-modal-window" onClick={(e) => e.stopPropagation()}>
                <header className="inspection-modal-header">
                    <div className="header-title-block">
                        <Car size={22} className="header-icon" />
                        <div>
                            <h3>Digital Vehicle Inspection System</h3>
                            <span className="booking-ref-sub">
                                Booking #{bookingId} • {booking.vehicle_name || 'Vehicle'} ({booking.registration_number || 'Fleet'})
                            </span>
                        </div>
                    </div>
                    <button type="button" className="close-btn" onClick={onClose} aria-label="Close modal">
                        <X size={20} />
                    </button>
                </header>

                {/* Sub-nav / Stage tabs */}
                <div className="inspection-tabs-bar">
                    <button
                        type="button"
                        className={`sub-tab-btn ${activeTab === 'view_report' ? 'active' : ''}`}
                        onClick={() => setActiveTab('view_report')}
                    >
                        <FileCheck size={16} />
                        <span>Inspection Report & Differences</span>
                    </button>

                    {isAdmin && !pickup && (
                        <button
                            type="button"
                            className={`sub-tab-btn ${activeTab === 'record_pickup' ? 'active' : ''}`}
                            onClick={() => {
                                setFormType('pickup');
                                setActiveTab('record_pickup');
                            }}
                        >
                            <Camera size={16} />
                            <span>Record Pickup Inspection</span>
                        </button>
                    )}

                    {isAdmin && pickup && !ret && (
                        <button
                            type="button"
                            className={`sub-tab-btn ${activeTab === 'record_return' ? 'active' : ''}`}
                            onClick={() => {
                                setFormType('return');
                                setOdometer(pickup.odometer_reading ? String(pickup.odometer_reading) : '');
                                setActiveTab('record_return');
                            }}
                        >
                            <Camera size={16} />
                            <span>Record Return Inspection</span>
                        </button>
                    )}
                </div>

                <div className="inspection-modal-body">
                    {loading ? (
                        <div className="inspection-loading-wrap">
                            <Loader message="Loading vehicle inspection dossier..." />
                        </div>
                    ) : error ? (
                        <div className="inspection-error-banner" role="alert">
                            <AlertTriangle size={18} />
                            <span>{error}</span>
                        </div>
                    ) : (
                        <>
                            {/* TAB: VIEW REPORT */}
                            {activeTab === 'view_report' && (
                                <div className="inspection-report-view">
                                    {/* Action Bar for Handover / Return Status */}
                                    <div className="inspection-status-workflow-bar">
                                        <div className="workflow-step-pill">
                                            <span className={`step-circle ${pickup ? 'completed' : 'pending'}`}>
                                                {pickup ? '✓' : '1'}
                                            </span>
                                            <div>
                                                <strong>Before Rental Inspection</strong>
                                                <small>{pickup ? 'Completed by Admin' : 'Pending Admin'}</small>
                                            </div>
                                        </div>

                                        <ArrowRight size={18} className="step-arrow" />

                                        <div className="workflow-step-pill">
                                            <span className={`step-circle ${pickup?.customer_accepted ? 'completed' : 'pending'}`}>
                                                {pickup?.customer_accepted ? '✓' : '2'}
                                            </span>
                                            <div>
                                                <strong>Customer Review & Acceptance</strong>
                                                <small>{pickup?.customer_accepted ? 'Accepted by Renter' : 'Awaiting Customer'}</small>
                                            </div>
                                        </div>

                                        <ArrowRight size={18} className="step-arrow" />

                                        <div className="workflow-step-pill">
                                            <span className={`step-circle ${ret ? 'completed' : 'pending'}`}>
                                                {ret ? '✓' : '3'}
                                            </span>
                                            <div>
                                                <strong>After Rental Inspection</strong>
                                                <small>{ret ? 'Completed by Admin' : 'Pending Return'}</small>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Customer Acceptance Callout */}
                                    {pickup && !pickup.customer_accepted && !isAdmin && (
                                        <div className="customer-action-card">
                                            <div className="action-text">
                                                <h4>Review Vehicle Condition Before Handover</h4>
                                                <p>
                                                    Please review the recorded odometer reading, fuel level, and vehicle photographs below. By clicking accept, you acknowledge the current vehicle condition.
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                className="accept-condition-btn"
                                                onClick={() => handleCustomerAccept(pickup.id)}
                                                disabled={actionLoading}
                                            >
                                                <CheckCircle size={18} />
                                                <span>{actionLoading ? 'Confirming...' : 'I Accept Vehicle Condition'}</span>
                                            </button>
                                        </div>
                                    )}

                                    {/* Admin Handover Trigger */}
                                    {isAdmin && pickup && pickup.customer_accepted && booking.status === 'confirmed' && (
                                        <div className="admin-handover-card">
                                            <div>
                                                <h4>Ready for Vehicle Handover</h4>
                                                <p>Customer has verified and accepted the vehicle condition. You can now handover the keys.</p>
                                            </div>
                                            <button
                                                type="button"
                                                className="handover-btn"
                                                onClick={handleCompleteHandover}
                                                disabled={actionLoading}
                                            >
                                                <Shield size={18} />
                                                <span>Complete Handover (Set Active)</span>
                                            </button>
                                        </div>
                                    )}

                                    {/* Admin Complete Rental Trigger */}
                                    {isAdmin && ret && booking.status === 'active' && (
                                        <div className="admin-complete-card">
                                            <div>
                                                <h4>Return Inspection Complete</h4>
                                                <p>Differences calculated. Proceed to settle and complete rental reservation.</p>
                                            </div>
                                            <button
                                                type="button"
                                                className="complete-rental-btn"
                                                onClick={handleCompleteRental}
                                                disabled={actionLoading}
                                            >
                                                <CheckCircle size={18} />
                                                <span>Complete & Close Rental</span>
                                            </button>
                                        </div>
                                    )}

                                    {/* Differences Analysis Card (When Both Completed) */}
                                    {diff && (
                                        <div className="difference-analysis-card">
                                            <h4 className="card-title">Automatic Rental Difference Analysis</h4>
                                            <div className="diff-kpi-grid">
                                                <div className="diff-kpi-item">
                                                    <span className="diff-kpi-label">Distance Travelled</span>
                                                    <strong className="diff-kpi-val">{diff.distanceTravelledKm} km</strong>
                                                    <small>Starting: {diff.startingOdometer} km → Final: {diff.finalOdometer} km</small>
                                                </div>

                                                <div className="diff-kpi-item">
                                                    <span className="diff-kpi-label">Fuel Level Comparison</span>
                                                    <strong className={`diff-kpi-val ${diff.isFuelDeficit ? 'deficit' : 'balanced'}`}>
                                                        {diff.fuelDifferencePercentage > 0 ? `+${diff.fuelDifferencePercentage}%` : `${diff.fuelDifferencePercentage}%`}
                                                    </strong>
                                                    <small>Starting: {diff.startingFuelLevel}% → Final: {diff.finalFuelLevel}%</small>
                                                </div>

                                                <div className="diff-kpi-item">
                                                    <span className="diff-kpi-label">Damage Assessment</span>
                                                    <strong className={`diff-kpi-val ${diff.newDamageReported ? 'damage-alert' : 'clean'}`}>
                                                        {diff.newDamageReported ? 'New Remarks' : 'Clean Return'}
                                                    </strong>
                                                    <small>{diff.damageRemarks}</small>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Inspections Side-by-Side Grid */}
                                    <div className="inspections-side-by-side">
                                        {/* Pickup Inspection Box */}
                                        <div className="inspection-stage-card">
                                            <div className="card-stage-header pickup-head">
                                                <h4>Before Rental (Pickup)</h4>
                                                {pickup ? (
                                                    <span className="status-pill verified">Completed</span>
                                                ) : (
                                                    <span className="status-pill pending">Pending</span>
                                                )}
                                            </div>

                                            {pickup ? (
                                                <div className="stage-content">
                                                    <div className="metrics-row">
                                                        <div className="metric-box">
                                                            <Gauge size={16} />
                                                            <span>Odometer</span>
                                                            <strong>{pickup.odometer_reading} km</strong>
                                                        </div>
                                                        <div className="metric-box">
                                                            <Fuel size={16} />
                                                            <span>Fuel</span>
                                                            <strong>{pickup.fuel_level}%</strong>
                                                        </div>
                                                        <div className="metric-box">
                                                            <Car size={16} />
                                                            <span>Exterior</span>
                                                            <strong>{pickup.exterior_condition}</strong>
                                                        </div>
                                                    </div>

                                                    <div className="checklist-summary">
                                                        <div className="check-item"><span>Interior:</span> <b>{pickup.interior_condition}</b></div>
                                                        <div className="check-item"><span>Tyres:</span> <b>{pickup.tyre_condition}</b></div>
                                                        <div className="check-item"><span>Headlights:</span> <b>{pickup.headlights_condition}</b></div>
                                                        <div className="check-item"><span>Taillights:</span> <b>{pickup.taillights_condition}</b></div>
                                                        <div className="check-item"><span>Brakes:</span> <b>{pickup.brakes_condition}</b></div>
                                                    </div>

                                                    {pickup.existing_scratches && (
                                                        <div className="notes-block">
                                                            <small>Existing Scratches / Dents:</small>
                                                            <p>{pickup.existing_scratches}</p>
                                                        </div>
                                                    )}

                                                    {pickup.photos && pickup.photos.length > 0 && (
                                                        <div className="photos-gallery">
                                                            <h5>Photographs ({pickup.photos.length})</h5>
                                                            <div className="photos-grid">
                                                                {pickup.photos.map(p => (
                                                                    <div
                                                                        key={p.id}
                                                                        className="photo-thumb-card"
                                                                        onClick={() => setPreviewPhotoUrl(`/api/inspections/photo/${p.id}`)}
                                                                    >
                                                                        <img src={`/api/inspections/photo/${p.id}`} alt={p.photo_category} />
                                                                        <span className="cat-tag">{p.photo_category}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <p className="no-stage-text">Before rental inspection has not been recorded yet.</p>
                                            )}
                                        </div>

                                        {/* Return Inspection Box */}
                                        <div className="inspection-stage-card">
                                            <div className="card-stage-header return-head">
                                                <h4>After Rental (Return)</h4>
                                                {ret ? (
                                                    <span className="status-pill verified">Completed</span>
                                                ) : (
                                                    <span className="status-pill pending">Pending</span>
                                                )}
                                            </div>

                                            {ret ? (
                                                <div className="stage-content">
                                                    <div className="metrics-row">
                                                        <div className="metric-box">
                                                            <Gauge size={16} />
                                                            <span>Final Odometer</span>
                                                            <strong>{ret.odometer_reading} km</strong>
                                                        </div>
                                                        <div className="metric-box">
                                                            <Fuel size={16} />
                                                            <span>Final Fuel</span>
                                                            <strong>{ret.fuel_level}%</strong>
                                                        </div>
                                                        <div className="metric-box">
                                                            <Car size={16} />
                                                            <span>Exterior</span>
                                                            <strong>{ret.exterior_condition}</strong>
                                                        </div>
                                                    </div>

                                                    <div className="checklist-summary">
                                                        <div className="check-item"><span>Interior:</span> <b>{ret.interior_condition}</b></div>
                                                        <div className="check-item"><span>Tyres:</span> <b>{ret.tyre_condition}</b></div>
                                                        <div className="check-item"><span>Headlights:</span> <b>{ret.headlights_condition}</b></div>
                                                        <div className="check-item"><span>Taillights:</span> <b>{ret.taillights_condition}</b></div>
                                                        <div className="check-item"><span>Brakes:</span> <b>{ret.brakes_condition}</b></div>
                                                    </div>

                                                    {ret.damage_description && (
                                                        <div className="notes-block damage-highlight">
                                                            <small>New Damage / Remarks:</small>
                                                            <p>{ret.damage_description}</p>
                                                        </div>
                                                    )}

                                                    {ret.photos && ret.photos.length > 0 && (
                                                        <div className="photos-gallery">
                                                            <h5>Return Photographs ({ret.photos.length})</h5>
                                                            <div className="photos-grid">
                                                                {ret.photos.map(p => (
                                                                    <div
                                                                        key={p.id}
                                                                        className="photo-thumb-card"
                                                                        onClick={() => setPreviewPhotoUrl(`/api/inspections/photo/${p.id}`)}
                                                                    >
                                                                        <img src={`/api/inspections/photo/${p.id}`} alt={p.photo_category} />
                                                                        <span className="cat-tag">{p.photo_category}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <p className="no-stage-text">After rental return inspection will be completed when customer returns vehicle.</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TAB: RECORD INSPECTION FORM (ADMIN ONLY) */}
                            {(activeTab === 'record_pickup' || activeTab === 'record_return') && (
                                <form onSubmit={handleSubmitInspection} className="inspection-record-form">
                                    <h4 className="form-legend">
                                        Record {formType === 'pickup' ? 'Before Rental (Pickup)' : 'After Rental (Return)'} Inspection
                                    </h4>

                                    <div className="form-grid-3col">
                                        <div className="form-group">
                                            <label>Odometer Reading (km) *</label>
                                            <input
                                                type="number"
                                                min="0"
                                                placeholder="e.g. 25000"
                                                value={odometer}
                                                onChange={(e) => setOdometer(e.target.value)}
                                                required
                                            />
                                        </div>

                                        <div className="form-group">
                                            <label>Fuel Level (0-100%) *</label>
                                            <div className="range-wrap">
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="100"
                                                    value={fuelLevel}
                                                    onChange={(e) => setFuelLevel(Number(e.target.value))}
                                                />
                                                <span className="range-val">{fuelLevel}%</span>
                                            </div>
                                        </div>

                                        <div className="form-group">
                                            <label>Battery % (if EV)</label>
                                            <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                placeholder="Optional for EV"
                                                value={batteryPercentage}
                                                onChange={(e) => setBatteryPercentage(e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    {/* Checklist */}
                                    <h5 className="sub-legend">Condition Checklist</h5>
                                    <div className="form-grid-4col">
                                        <div className="form-group">
                                            <label>Exterior Condition</label>
                                            <select value={exteriorCondition} onChange={(e) => setExteriorCondition(e.target.value)}>
                                                <option value="excellent">Excellent</option>
                                                <option value="good">Good</option>
                                                <option value="fair">Fair</option>
                                                <option value="poor">Poor</option>
                                                <option value="damaged">Damaged</option>
                                            </select>
                                        </div>

                                        <div className="form-group">
                                            <label>Interior Cabin</label>
                                            <select value={interiorCondition} onChange={(e) => setInteriorCondition(e.target.value)}>
                                                <option value="excellent">Excellent (Clean)</option>
                                                <option value="good">Good</option>
                                                <option value="fair">Fair</option>
                                                <option value="poor">Poor (Dirty)</option>
                                            </select>
                                        </div>

                                        <div className="form-group">
                                            <label>Tyres & Wheels</label>
                                            <select value={tyreCondition} onChange={(e) => setTyreCondition(e.target.value)}>
                                                <option value="excellent">Excellent</option>
                                                <option value="good">Good</option>
                                                <option value="fair">Fair</option>
                                                <option value="worn">Worn</option>
                                            </select>
                                        </div>

                                        <div className="form-group">
                                            <label>Braking System</label>
                                            <select value={brakesCondition} onChange={(e) => setBrakesCondition(e.target.value)}>
                                                <option value="optimal">Optimal</option>
                                                <option value="satisfactory">Satisfactory</option>
                                                <option value="needs_attention">Needs Attention</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Damage Notes */}
                                    <div className="form-grid-2col">
                                        <div className="form-group">
                                            <label>Existing Scratches / Dents</label>
                                            <textarea
                                                rows="2"
                                                placeholder="Describe any scratch locations or minor paint imperfections..."
                                                value={existingScratches}
                                                onChange={(e) => setExistingScratches(e.target.value)}
                                            />
                                        </div>

                                        <div className="form-group">
                                            <label>Additional Damage Notes</label>
                                            <textarea
                                                rows="2"
                                                placeholder="Document any accessories or remarks..."
                                                value={damageDescription}
                                                onChange={(e) => setDamageDescription(e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    {/* Photo Upload Section */}
                                    <h5 className="sub-legend">Upload Inspection Photographs</h5>
                                    <div className="file-upload-dropzone">
                                        <Camera size={26} className="upload-icon" />
                                        <p>Select multiple photographs (Front, Rear, Left, Right, Dashboard, Tyres, Damage)</p>
                                        <input
                                            type="file"
                                            multiple
                                            accept="image/*"
                                            onChange={handleFileChange}
                                        />
                                    </div>

                                    {selectedPhotos.length > 0 && (
                                        <div className="selected-photos-assignment">
                                            <h6>Assign Photo Categories ({selectedPhotos.length} selected):</h6>
                                            <div className="photo-assign-grid">
                                                {selectedPhotos.map((f, idx) => (
                                                    <div key={idx} className="assign-row">
                                                        <span className="file-name">{f.name}</span>
                                                        <select
                                                            value={photoCategoryMap[idx] || 'other'}
                                                            onChange={(e) => setPhotoCategoryMap({ ...photoCategoryMap, [idx]: e.target.value })}
                                                        >
                                                            {PHOTO_CATEGORIES.map(c => (
                                                                <option key={c.value} value={c.value}>{c.label}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="form-actions-right">
                                        <button
                                            type="button"
                                            className="cancel-form-btn"
                                            onClick={() => setActiveTab('view_report')}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="submit-insp-btn"
                                            disabled={actionLoading}
                                        >
                                            <Upload size={16} />
                                            <span>{actionLoading ? 'Saving Inspection...' : `Save ${formType} Inspection`}</span>
                                        </button>
                                    </div>
                                </form>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Lightbox Modal */}
            {previewPhotoUrl && (
                <div className="photo-lightbox-backdrop" onClick={() => setPreviewPhotoUrl(null)}>
                    <div className="lightbox-inner" onClick={(e) => e.stopPropagation()}>
                        <button type="button" className="close-lightbox" onClick={() => setPreviewPhotoUrl(null)}>
                            <X size={24} />
                        </button>
                        <img src={previewPhotoUrl} alt="Inspection Full View" />
                    </div>
                </div>
            )}
        </div>
    );
}

export default InspectionModal;

