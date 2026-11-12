import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
    Shield,
    CheckCircle2,
    Calendar,
    Fuel,
    Gauge,
    Users,
    Key,
    Layers,
    FileCheck,
    AlertCircle,
    Award,
    Sparkles,
    Wind,
    Radio,
    ShieldCheck,
    Compass,
    DoorClosed,
    Briefcase,
    Zap,
    ChevronRight,
    IdCard,
    AlertTriangle
} from 'lucide-react';
import axiosInstance from '../../api/axiosInstance';
import BookingForm from '../../components/booking/BookingForm';
import WishlistButton from '../../components/vehicle/WishlistButton';
import CompareButton from '../../components/vehicle/CompareButton';
import { getVehicleImageUrl, handleVehicleImageError } from '../../utils/vehicleImages';
import Loader from '../../components/common/Loader';
import './VehicleDetails.css';

function VehicleDetails() {
    const { id } = useParams();

    const [vehicle, setVehicle] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeSection, setActiveSection] = useState('overview');

    useEffect(() => {
        const fetchVehicle = async () => {
            setLoading(true);
            setError('');

            try {
                const response = await axiosInstance.get(`/vehicles/${id}`);
                setVehicle(response.data);
            } catch (err) {
                console.error('Error fetching vehicle:', err);
                setError(
                    err.response?.status === 404
                        ? 'Vehicle not found in the RentIQ catalog.'
                        : 'Unable to load vehicle details. Please check your network and retry.'
                );
            } finally {
                setLoading(false);
            }
        };

        fetchVehicle();
    }, [id]);

    if (loading) {
        return (
            <main className="vehicle-details-page loading-center">
                <Loader message="Loading vehicle specifications and compliance status..." />
            </main>
        );
    }

    if (error || !vehicle) {
        return (
            <main className="vehicle-details-page error-center">
                <div className="vehicle-error-card">
                    <AlertCircle size={40} className="error-icon" />
                    <h2>Vehicle Not Available</h2>
                    <p>{error || 'The requested vehicle could not be loaded.'}</p>
                    <Link to="/vehicles" className="back-to-fleet-btn">
                        ← Explore Available Fleet
                    </Link>
                </div>
            </main>
        );
    }

    const imageUrl = getVehicleImageUrl(vehicle);
    const isAvailable = Boolean(vehicle.is_available);
    const compliance = vehicle.compliance || {
        rc_verified: true,
        insurance_active: true,
        puc_certified: true,
        commercial_fitness: true
    };

    return (
        <main className="vehicle-details-page">
            {/* Breadcrumb Navigation */}
            <nav className="details-breadcrumb" aria-label="Breadcrumb">
                <Link to="/">Home</Link>
                <ChevronRight size={14} />
                <Link to="/vehicles">Fleet</Link>
                <ChevronRight size={14} />
                <span className="current">{vehicle.brand} {vehicle.name}</span>
            </nav>

            <div className="vehicle-details-layout">
                {/* Left Column: Vehicle Showcase & Detailed Sections */}
                <div className="vehicle-showcase-column">
                    {/* Hero Card */}
                    <div className="vehicle-hero-card">
                        <div className="vehicle-hero-image-container">
                            <img
                                src={imageUrl}
                                alt={`${vehicle.brand || ''} ${vehicle.name}`}
                                className="vehicle-hero-image"
                                onError={handleVehicleImageError}
                            />
                            <div className="vehicle-hero-floating-badges">
                                <span className={`vehicle-avail-pill ${
                                    isAvailable
                                        ? 'pill-available'
                                        : vehicle.availability_status === 'compliance_required'
                                            ? 'pill-compliance'
                                            : vehicle.availability_status === 'under_maintenance'
                                                ? 'pill-maintenance'
                                                : 'pill-unavailable'
                                }`}>
                                    {vehicle.availability_badge?.text || (isAvailable ? 'Available for Rent' : vehicle.availability_status === 'compliance_required' ? 'Compliance Required' : vehicle.availability_status === 'under_maintenance' ? 'Under Maintenance' : 'Currently Unavailable')}
                                </span>
                                <span className="vehicle-cat-pill">{vehicle.category}</span>
                            </div>
                        </div>

                        {/* Vehicle Title & Key Highlights Bar */}
                        <div className="vehicle-hero-info">
                            <div className="vehicle-title-header">
                                <div>
                                    <span className="vehicle-brand-eyebrow">
                                        {vehicle.brand || 'RentIQ Fleet'}
                                    </span>
                                    <h1>
                                        {vehicle.name} {vehicle.model ? <small className="vehicle-model-text">({vehicle.model})</small> : ''}
                                    </h1>
                                </div>
                                <div className="vehicle-hero-actions">
                                    <WishlistButton vehicle={vehicle} />
                                    <CompareButton vehicle={vehicle} />
                                </div>
                            </div>

                            {/* Quick Highlights Bar */}
                            <div className="vehicle-quick-spec-bar">
                                <div className="spec-pill">
                                    <Users size={16} />
                                    <span>{vehicle.seating_capacity} Seats</span>
                                </div>
                                <div className="spec-pill">
                                    <Key size={16} />
                                    <span style={{ textTransform: 'capitalize' }}>{vehicle.transmission}</span>
                                </div>
                                <div className="spec-pill">
                                    <Fuel size={16} />
                                    <span style={{ textTransform: 'capitalize' }}>{vehicle.fuel_type || 'Petrol'}</span>
                                </div>
                                {vehicle.mileage && (
                                    <div className="spec-pill">
                                        <Gauge size={16} />
                                        <span>{vehicle.mileage}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Section Navigation Tabs */}
                    <div className="vehicle-sections-nav" role="tablist">
                        <button
                            type="button"
                            className={`section-nav-btn ${activeSection === 'overview' ? 'active' : ''}`}
                            onClick={() => setActiveSection('overview')}
                        >
                            Overview
                        </button>
                        <button
                            type="button"
                            className={`section-nav-btn ${activeSection === 'specs' ? 'active' : ''}`}
                            onClick={() => setActiveSection('specs')}
                        >
                            Technical Specs
                        </button>
                        <button
                            type="button"
                            className={`section-nav-btn ${activeSection === 'registration' ? 'active' : ''}`}
                            onClick={() => setActiveSection('registration')}
                        >
                            Registration & RTO
                        </button>
                        <button
                            type="button"
                            className={`section-nav-btn ${activeSection === 'features' ? 'active' : ''}`}
                            onClick={() => setActiveSection('features')}
                        >
                            Features & Facilities
                        </button>
                        <button
                            type="button"
                            className={`section-nav-btn ${activeSection === 'rental' ? 'active' : ''}`}
                            onClick={() => setActiveSection('rental')}
                        >
                            Rental Terms
                        </button>
                        <button
                            type="button"
                            className={`section-nav-btn ${activeSection === 'compliance' ? 'active' : ''}`}
                            onClick={() => setActiveSection('compliance')}
                        >
                            Compliance Status
                        </button>
                    </div>

                    {/* Content Sections */}
                    <div className="vehicle-sections-container">
                        {/* 1. OVERVIEW */}
                        {activeSection === 'overview' && (
                            <section className="vehicle-content-section">
                                <h2>Vehicle Overview</h2>
                                <p className="vehicle-description-text">
                                    {vehicle.description ||
                                        `The ${vehicle.brand} ${vehicle.name} ${vehicle.model || ''} is a premier ${vehicle.category} tailored for effortless commuting, long-distance touring, and exceptional passenger comfort. Engineered with superior dynamics, cutting-edge infotainment, and dependable safety architecture.`}
                                </p>

                                <div className="overview-cards-grid">
                                    <div className="overview-info-card">
                                        <Calendar size={18} className="overview-icon" />
                                        <div>
                                            <span>Manufacturing Year</span>
                                            <strong>{vehicle.manufacturing_year || '2023 - 2024'}</strong>
                                        </div>
                                    </div>
                                    <div className="overview-info-card">
                                        <Sparkles size={18} className="overview-icon" />
                                        <div>
                                            <span>Vehicle Colour</span>
                                            <strong>{vehicle.vehicle_color || 'Premium Metallic'}</strong>
                                        </div>
                                    </div>
                                    <div className="overview-info-card">
                                        <ShieldCheck size={18} className="overview-icon" />
                                        <div>
                                            <span>RTO Registration</span>
                                            <strong>{vehicle.registration_number || 'Cleared For Hire'}</strong>
                                        </div>
                                    </div>
                                    <div className="overview-info-card">
                                        <Briefcase size={18} className="overview-icon" />
                                        <div>
                                            <span>Boot / Luggage Space</span>
                                            <strong>{vehicle.boot_space || 'Spacious Trunk'}</strong>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        )}

                        {/* 2. TECHNICAL SPECIFICATIONS */}
                        {activeSection === 'specs' && (
                            <section className="vehicle-content-section">
                                <h2>Technical Specifications</h2>
                                <div className="specs-table-grid">
                                    <div className="spec-row">
                                        <span className="spec-label">Engine / Powertrain</span>
                                        <strong className="spec-value">{vehicle.engine_capacity || 'BS6 Phase 2 Engine'}</strong>
                                    </div>
                                    <div className="spec-row">
                                        <span className="spec-label">Transmission</span>
                                        <strong className="spec-value" style={{ textTransform: 'capitalize' }}>
                                            {vehicle.transmission} Transmission
                                        </strong>
                                    </div>
                                    <div className="spec-row">
                                        <span className="spec-label">Fuel Type</span>
                                        <strong className="spec-value" style={{ textTransform: 'capitalize' }}>
                                            {vehicle.fuel_type || 'Petrol'}
                                        </strong>
                                    </div>
                                    <div className="spec-row">
                                        <span className="spec-label">Fuel Economy / Mileage</span>
                                        <strong className="spec-value">{vehicle.mileage || '18 - 22 km/l certified'}</strong>
                                    </div>
                                    <div className="spec-row">
                                        <span className="spec-label">Number of Doors</span>
                                        <strong className="spec-value">{vehicle.doors || 4} Doors</strong>
                                    </div>
                                    <div className="spec-row">
                                        <span className="spec-label">Seating Capacity</span>
                                        <strong className="spec-value">{vehicle.seating_capacity} Adults</strong>
                                    </div>
                                    <div className="spec-row">
                                        <span className="spec-label">Maximum Passenger Capacity</span>
                                        <strong className="spec-value">{vehicle.max_passengers || vehicle.seating_capacity} Passengers</strong>
                                    </div>
                                    <div className="spec-row">
                                        <span className="spec-label">Luggage / Boot Capacity</span>
                                        <strong className="spec-value">{vehicle.boot_space || 'Standard Luggage Bay'}</strong>
                                    </div>
                                </div>
                            </section>
                        )}

                        {/* 3. REGISTRATION INFORMATION */}
                        {activeSection === 'registration' && (
                            <section className="vehicle-content-section">
                                <h2>Official Registration Information</h2>
                                <div className="reg-showcase-box">
                                    <div className="reg-license-plate">
                                        <div className="plate-ind">IND</div>
                                        <div className="plate-number">
                                            {vehicle.registration_number || 'DL01AB1234'}
                                        </div>
                                    </div>
                                    <div className="reg-details-list">
                                        <div className="reg-detail-item">
                                            <span>Registration State & RTO:</span>
                                            <strong>{vehicle.registration_state || 'National Capital Territory'}</strong>
                                        </div>
                                        {vehicle.registration_validity && (
                                            <div className="reg-detail-item">
                                                <span>Fitness & Registration Validity:</span>
                                                <strong>{vehicle.registration_validity.split('T')[0]}</strong>
                                            </div>
                                        )}
                                        <div className="reg-detail-item">
                                            <span>Commercial Permit:</span>
                                            <strong className="text-success">All India Tourist / Self-Drive Authorized</strong>
                                        </div>
                                    </div>
                                </div>

                                <div className="reg-security-note">
                                    <Shield size={16} />
                                    <span>
                                        <strong>Customer Data Protection Notice:</strong> In strict accordance with privacy and security mandates, technical engine/chassis identifiers and sensitive internal records remain protected and are only accessible by authorized fleet inspectors.
                                    </span>
                                </div>
                            </section>
                        )}

                        {/* 4. FEATURES & FACILITIES */}
                        {activeSection === 'features' && (
                            <section className="vehicle-content-section">
                                <h2>Features & Facilities</h2>
                                <div className="features-badge-grid">
                                    <div className="feature-item">
                                        <Wind size={18} />
                                        <span>Air Conditioning & Climate Control</span>
                                    </div>
                                    <div className="feature-item">
                                        <Radio size={18} />
                                        <span>Touchscreen Infotainment & Bluetooth</span>
                                    </div>
                                    <div className="feature-item">
                                        <ShieldCheck size={18} />
                                        <span>Anti-lock Braking System (ABS) & EBD</span>
                                    </div>
                                    <div className="feature-item">
                                        <Shield size={18} />
                                        <span>Dual Front Airbags</span>
                                    </div>
                                    <div className="feature-item">
                                        <Key size={18} />
                                        <span>Remote Central Locking</span>
                                    </div>
                                    <div className="feature-item">
                                        <Zap size={18} />
                                        <span>USB Fast Smartphone Charging</span>
                                    </div>
                                    <div className="feature-item">
                                        <Compass size={18} />
                                        <span>Rear Parking Proximity Sensors</span>
                                    </div>
                                    <div className="feature-item">
                                        <DoorClosed size={18} />
                                        <span>Power Windows (Front & Rear)</span>
                                    </div>
                                </div>
                            </section>
                        )}

                        {/* 5. RENTAL INFORMATION */}
                        {activeSection === 'rental' && (
                            <section className="vehicle-content-section">
                                <h2>Rental Information & Policies</h2>
                                <div className="rental-policy-grid">
                                    <div className="policy-card">
                                        <h4>Tariff & Pricing</h4>
                                        <p>Authoritative daily rate of ₹{Number(vehicle.price_per_day).toLocaleString('en-IN')}/day. Hourly rentals are calculated proportionally (₹{(Number(vehicle.price_per_day)/24).toFixed(0)}/hr).</p>
                                    </div>
                                    <div className="policy-card">
                                        <h4>Security Deposit</h4>
                                        <p>Zero security deposit for verified customers with a valid driving licence on record.</p>
                                    </div>
                                    <div className="policy-card">
                                        <h4>Fair Fuel Policy</h4>
                                        <p>Same-to-same fuel policy. Pick up with fuel in tank and return at the equivalent level without penalty.</p>
                                    </div>
                                    <div className="policy-card">
                                        <h4>Cancellation Terms</h4>
                                        <p>Free cancellation up to 24 hours prior to scheduled pickup date and time.</p>
                                    </div>
                                </div>
                            </section>
                        )}

                        {/* 6. DOCUMENTS & COMPLIANCE STATUS */}
                        {activeSection === 'compliance' && (
                            <section className="vehicle-content-section">
                                <h2>Documents & Legal Compliance Status</h2>
                                <p className="compliance-intro">
                                    RentIQ enforces rigorous compliance audits. All mandatory statutory documentation is verified before vehicles are made available for rental.
                                </p>

                                {vehicle.availability_status === 'compliance_required' && (
                                    <div className="compliance-notice-banner" role="alert">
                                        <AlertTriangle size={20} className="compliance-notice-icon" />
                                        <div className="compliance-notice-text">
                                            <strong>Compliance Verification in Progress</strong>
                                            <p>{vehicle.customer_message || 'This vehicle is temporarily unavailable because mandatory compliance documents require attention.'}</p>
                                        </div>
                                    </div>
                                )}

                                <div className="compliance-status-cards">
                                    <div className={`compliance-card ${compliance.rc_verified ? 'verified' : 'attention'}`}>
                                        <div className={`comp-icon ${compliance.rc_verified ? '' : 'attention'}`}><FileCheck size={20} /></div>
                                        <div className="comp-info">
                                            <strong>Registration Certificate (RC)</strong>
                                            <span>{compliance.rc_verified ? 'Verified & RTO Cleared' : 'Mandatory Verification Required'}</span>
                                        </div>
                                        <span className={`comp-status-badge ${compliance.rc_verified ? 'valid' : 'attention'}`}>
                                            {compliance.rc_verified ? 'Compliant' : 'Attention Required'}
                                        </span>
                                    </div>

                                    <div className={`compliance-card ${compliance.insurance_active ? 'verified' : 'attention'}`}>
                                        <div className={`comp-icon ${compliance.insurance_active ? '' : 'attention'}`}><ShieldCheck size={20} /></div>
                                        <div className="comp-info">
                                            <strong>Comprehensive Motor Insurance</strong>
                                            <span>{compliance.insurance_active ? 'Active Commercial Coverage' : 'Mandatory Policy Required'}</span>
                                        </div>
                                        <span className={`comp-status-badge ${compliance.insurance_active ? 'valid' : 'attention'}`}>
                                            {compliance.insurance_active ? 'Active' : 'Attention Required'}
                                        </span>
                                    </div>

                                    <div className={`compliance-card ${compliance.puc_certified ? 'verified' : 'attention'}`}>
                                        <div className={`comp-icon ${compliance.puc_certified ? '' : 'attention'}`}><CheckCircle2 size={20} /></div>
                                        <div className="comp-info">
                                            <strong>Pollution Under Control (PUC)</strong>
                                            <span>{compliance.puc_certified ? 'BS6 Certified Emission Standard' : 'Mandatory Certification Required'}</span>
                                        </div>
                                        <span className={`comp-status-badge ${compliance.puc_certified ? 'valid' : 'attention'}`}>
                                            {compliance.puc_certified ? 'Certified' : 'Attention Required'}
                                        </span>
                                    </div>

                                    <div className="compliance-card verified">
                                        <div className="comp-icon"><Award size={20} /></div>
                                        <div className="comp-info">
                                            <strong>Roadworthiness & Fitness Inspection</strong>
                                            <span>Annual Commercial Fitness Cleared</span>
                                        </div>
                                        <span className="comp-status-badge valid">Approved</span>
                                    </div>
                                </div>
                            </section>
                        )}
                    </div>
                </div>

                {/* Right Column: Sticky Booking Widget */}
                <aside className="vehicle-booking-sidebar">
                    <div className="booking-card-wrapper">
                        <div className="sidebar-price-banner">
                            <span className="price-tag-label">Rental Price</span>
                            <div className="sidebar-price-value">
                                <strong>₹{Number(vehicle.price_per_day).toLocaleString('en-IN')}</strong>
                                <small>/ day</small>
                            </div>
                            <span className="hourly-equivalent">
                                Approx. ₹{(Number(vehicle.price_per_day) / 24).toFixed(0)} / hour
                            </span>
                        </div>

                        {/* Booking Form Integration */}
                        <BookingForm
                            vehicleId={vehicle.vehicle_id}
                            vehicleName={vehicle.brand ? `${vehicle.brand} ${vehicle.name}` : vehicle.name}
                            pricePerDay={vehicle.price_per_day}
                            isAvailable={isAvailable}
                        />
                    </div>
                </aside>
            </div>
        </main>
    );
}

export default VehicleDetails;
