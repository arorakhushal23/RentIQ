import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    FileCheck,
    Search,
    Filter,
    Plus,
    RefreshCw,
    Edit3,
    Power,
    CheckCircle2,
    AlertTriangle,
    Shield,
    Fuel,
    Tag,
    Info,
    Calendar,
    Settings,
    Layers
} from 'lucide-react';
import axiosInstance from '../../api/axiosInstance';
import Loader from '../../components/common/Loader';
import VehicleDocumentsModal from '../../components/admin/VehicleDocumentsModal';
import './AdminVehicles.css';

const EMPTY_FORM = {
    name: '',
    category_id: '',
    brand: '',
    model: '',
    manufacturing_year: new Date().getFullYear().toString(),
    vehicle_color: '',
    registration_number: '',
    registration_state: '',
    registration_date: '',
    registration_validity: '',
    fuel_type: 'petrol',
    transmission: 'manual',
    seating_capacity: '5',
    mileage: '',
    engine_capacity: '',
    doors: '4',
    boot_space: '',
    max_passengers: '5',
    engine_number: '',
    chassis_number: '',
    vehicle_identification_number: '',
    price_per_day: '',
    description: '',
    image_url: '',
    is_available: true,
};

const formatPrice = (value) => {
    const number = Number(value);
    if (!Number.isFinite(number)) {
        return '₹0';
    }
    return number.toLocaleString('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
    });
};

function AdminVehicles() {
    const [vehicles, setVehicles] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Filters
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [fuelFilter, setFuelFilter] = useState('all');
    const [availabilityFilter, setAvailabilityFilter] = useState('all');

    // Add / Edit Modal state
    const [showForm, setShowForm] = useState(false);
    const [editingVehicle, setEditingVehicle] = useState(null);
    const [formTab, setFormTab] = useState('basic'); // 'basic', 'technical', 'registration'
    const [form, setForm] = useState(EMPTY_FORM);
    const [formError, setFormError] = useState('');
    const [saving, setSaving] = useState(false);
    const [successNotice, setSuccessNotice] = useState('');
    const [changingStatusId, setChangingStatusId] = useState(null);
    const isSubmittingRef = useRef(false);

    // Document Management Modal state
    const [documentModalVehicle, setDocumentModalVehicle] = useState(null);

    const fetchVehicles = useCallback(async () => {
        setLoading(true);
        setError('');

        try {
            const response = await axiosInstance.get('/admin/vehicles');
            if (!Array.isArray(response.data)) {
                throw new Error('Unexpected vehicle data received from the server.');
            }
            setVehicles(response.data);
        } catch (err) {
            console.error('Failed to fetch admin vehicles:', err);
            setError(
                err.response?.status === 401
                    ? 'Your session has expired. Please log in again.'
                    : err.response?.status === 403
                        ? 'You do not have permission to manage vehicles.'
                        : 'Unable to load vehicles. Please check backend connection and retry.'
            );
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchCategories = useCallback(async () => {
        try {
            const response = await axiosInstance.get('/admin/categories');
            if (Array.isArray(response.data)) {
                setCategories(response.data);
            }
        } catch (err) {
            console.error('Failed to fetch vehicle categories:', err);
        }
    }, []);

    useEffect(() => {
        fetchVehicles();
        fetchCategories();
    }, [fetchVehicles, fetchCategories]);

    const filteredVehicles = useMemo(() => {
        const query = search.trim().toLowerCase();

        return vehicles.filter((vehicle) => {
            const matchesSearch =
                !query ||
                String(vehicle.name || '').toLowerCase().includes(query) ||
                String(vehicle.brand || '').toLowerCase().includes(query) ||
                String(vehicle.model || '').toLowerCase().includes(query) ||
                String(vehicle.category || '').toLowerCase().includes(query) ||
                String(vehicle.registration_number || '').toLowerCase().includes(query);

            const matchesCategory =
                categoryFilter === 'all' ||
                String(vehicle.category_id) === String(categoryFilter) ||
                String(vehicle.category || '').toLowerCase() === categoryFilter.toLowerCase();

            const matchesFuel =
                fuelFilter === 'all' ||
                String(vehicle.fuel_type || '').toLowerCase() === fuelFilter.toLowerCase();

            const available =
                vehicle.is_available === true ||
                vehicle.is_available === 1 ||
                vehicle.is_available === '1';

            const matchesAvailability =
                availabilityFilter === 'all' ||
                vehicle.availability_status === availabilityFilter ||
                (availabilityFilter === 'available' && (vehicle.booking_eligible || vehicle.availability_status === 'available')) ||
                (availabilityFilter === 'compliance_required' && vehicle.availability_status === 'compliance_required') ||
                (availabilityFilter === 'under_maintenance' && vehicle.availability_status === 'under_maintenance') ||
                (availabilityFilter === 'unavailable' && (vehicle.availability_status === 'unavailable' || (!available && !vehicle.operational_is_available)));

            return matchesSearch && matchesCategory && matchesFuel && matchesAvailability;
        });
    }, [vehicles, search, categoryFilter, fuelFilter, availabilityFilter]);

    const openAddForm = () => {
        setEditingVehicle(null);
        setForm({ ...EMPTY_FORM });
        setFormTab('basic');
        setFormError('');
        setSuccessNotice('');
        setShowForm(true);
    };

    const openEditForm = (vehicle) => {
        setEditingVehicle(vehicle);
        setForm({
            name: vehicle.name || '',
            category_id: String(vehicle.category_id ?? ''),
            brand: vehicle.brand || '',
            model: vehicle.model || '',
            manufacturing_year: String(vehicle.manufacturing_year || new Date().getFullYear()),
            vehicle_color: vehicle.vehicle_color || '',
            registration_number: vehicle.registration_number || '',
            registration_state: vehicle.registration_state || '',
            registration_date: vehicle.registration_date ? vehicle.registration_date.split('T')[0] : '',
            registration_validity: vehicle.registration_validity ? vehicle.registration_validity.split('T')[0] : '',
            fuel_type: vehicle.fuel_type || 'petrol',
            transmission: vehicle.transmission || 'manual',
            seating_capacity: String(vehicle.seating_capacity ?? 5),
            mileage: vehicle.mileage || '',
            engine_capacity: vehicle.engine_capacity || '',
            doors: String(vehicle.doors ?? 4),
            boot_space: vehicle.boot_space || '',
            max_passengers: String(vehicle.max_passengers ?? vehicle.seating_capacity ?? 5),
            engine_number: vehicle.engine_number || '',
            chassis_number: vehicle.chassis_number || '',
            vehicle_identification_number: vehicle.vehicle_identification_number || '',
            price_per_day: String(vehicle.price_per_day ?? ''),
            description: vehicle.description || '',
            image_url: vehicle.image_url || '',
            is_available:
                vehicle.is_available === true ||
                vehicle.is_available === 1 ||
                vehicle.is_available === '1',
        });
        setFormTab('basic');
        setFormError('');
        setSuccessNotice('');
        setShowForm(true);
    };

    const closeForm = () => {
        if (saving || isSubmittingRef.current) return;
        setShowForm(false);
        setEditingVehicle(null);
        setForm({ ...EMPTY_FORM });
        setFormError('');
    };

    const handleFormChange = (event) => {
        const { name, value, type, checked } = event.target;
        setForm((current) => ({
            ...current,
            [name]: type === 'checkbox' ? checked : value,
        }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (isSubmittingRef.current) return;

        setFormError('');

        if (
            !form.name.trim() ||
            !form.category_id ||
            !form.seating_capacity ||
            !form.price_per_day
        ) {
            setFormError('Please complete all required fields (Name, Category, Seats, Price).');
            return;
        }

        const seatingCapacity = Number(form.seating_capacity);
        const pricePerDay = Number(form.price_per_day);

        if (!Number.isInteger(seatingCapacity) || seatingCapacity <= 0) {
            setFormError('Seating capacity must be a positive whole number.');
            return;
        }

        if (!Number.isFinite(pricePerDay) || pricePerDay <= 0) {
            setFormError('Price per day must be greater than zero.');
            return;
        }

        const payload = {
            name: form.name.trim(),
            category_id: Number(form.category_id),
            brand: form.brand.trim() || null,
            model: form.model.trim() || null,
            manufacturing_year: form.manufacturing_year ? Number(form.manufacturing_year) : null,
            vehicle_color: form.vehicle_color.trim() || null,
            registration_number: form.registration_number.trim() || null,
            registration_state: form.registration_state.trim() || null,
            registration_date: form.registration_date || null,
            registration_validity: form.registration_validity || null,
            fuel_type: form.fuel_type || 'petrol',
            transmission: form.transmission,
            seating_capacity: seatingCapacity,
            mileage: form.mileage.trim() || null,
            engine_capacity: form.engine_capacity.trim() || null,
            doors: form.doors ? Number(form.doors) : 4,
            boot_space: form.boot_space.trim() || null,
            max_passengers: form.max_passengers ? Number(form.max_passengers) : seatingCapacity,
            engine_number: form.engine_number.trim() || null,
            chassis_number: form.chassis_number.trim() || null,
            vehicle_identification_number: form.vehicle_identification_number.trim() || null,
            price_per_day: pricePerDay,
            description: form.description.trim() || null,
            image_url: form.image_url.trim() || null,
            is_available: form.is_available,
        };

        isSubmittingRef.current = true;
        setSaving(true);

        try {
            if (editingVehicle) {
                await axiosInstance.put(`/admin/vehicles/${editingVehicle.vehicle_id}`, payload);
                setSuccessNotice('Vehicle updated successfully!');
            } else {
                await axiosInstance.post('/admin/vehicles', payload);
                setSuccessNotice('Vehicle added successfully!');
            }

            // Close the form modal and reset
            setShowForm(false);
            setEditingVehicle(null);
            setForm({ ...EMPTY_FORM });
            setFormError('');

            // Automatically refresh vehicle list so new/updated vehicle appears immediately
            await fetchVehicles();
        } catch (err) {
            console.error('Failed to save vehicle:', err);
            // On failure: keep form open, preserve entered data in form state, and display meaningful error
            setFormError(
                err.response?.data?.message ||
                'Unable to save vehicle. Please verify the registration details and retry.'
            );
        } finally {
            isSubmittingRef.current = false;
            setSaving(false);
        }
    };

    const handleAvailabilityChange = async (vehicle) => {
        const currentlyAvailable =
            vehicle.is_available === true ||
            vehicle.is_available === 1 ||
            vehicle.is_available === '1';

        const nextStatus = !currentlyAvailable;
        const action = nextStatus ? 'activate' : 'deactivate';

        const confirmed = window.confirm(
            `Are you sure you want to ${action} "${vehicle.name}"?`
        );
        if (!confirmed) return;

        setChangingStatusId(vehicle.vehicle_id);
        setError('');

        try {
            await axiosInstance.patch(`/admin/vehicles/${vehicle.vehicle_id}/status`, {
                is_available: nextStatus
            });

            setVehicles((current) =>
                current.map((item) =>
                    item.vehicle_id === vehicle.vehicle_id
                        ? { ...item, is_available: nextStatus }
                        : item
                )
            );
        } catch (err) {
            console.error('Failed to update vehicle status:', err);
            setError(err.response?.data?.message || 'Unable to update vehicle availability.');
        } finally {
            setChangingStatusId(null);
        }
    };

    return (
        <main className="admin-vehicles-page">
            <header className="admin-vehicles-header">
                <div>
                    <span className="admin-vehicles-eyebrow">
                        <Shield size={14} /> FLEET ADMINISTRATION
                    </span>
                    <h1>Vehicle Management & Fleet Registration</h1>
                    <p>Manage fleet specifications, registration compliance, technical identifiers, and documents.</p>
                </div>

                <div className="admin-header-actions-group">
                    <button
                        type="button"
                        className="admin-vehicles-primary-btn"
                        onClick={openAddForm}
                    >
                        <Plus size={16} />
                        Add New Vehicle
                    </button>
                </div>
            </header>

            {successNotice && (
                <div className="admin-vehicles-success-alert" role="status">
                    <div className="admin-vehicles-success-content">
                        <CheckCircle2 size={18} />
                        <span>{successNotice}</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setSuccessNotice('')}
                        aria-label="Dismiss success message"
                    >
                        ×
                    </button>
                </div>
            )}

            {error && (
                <div className="admin-vehicles-alert" role="alert">
                    <AlertTriangle size={18} />
                    <span>{error}</span>
                    <button type="button" onClick={fetchVehicles}>
                        Retry
                    </button>
                </div>
            )}

            {/* Filter Toolbar */}
            <section className="admin-vehicles-toolbar">
                <div className="admin-vehicles-search">
                    <label htmlFor="vehicle-search">Search Fleet</label>
                    <div className="search-input-wrapper">
                        <Search size={16} className="search-icon" />
                        <input
                            id="vehicle-search"
                            type="search"
                            placeholder="Search by name, brand, model, registration no..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                <div className="admin-vehicles-filter">
                    <label htmlFor="category-filter">Category</label>
                    <select
                        id="category-filter"
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                    >
                        <option value="all">All Categories</option>
                        {categories.map((c) => (
                            <option key={c.category_id} value={c.name}>{c.name}</option>
                        ))}
                    </select>
                </div>

                <div className="admin-vehicles-filter">
                    <label htmlFor="fuel-filter">Fuel Type</label>
                    <select
                        id="fuel-filter"
                        value={fuelFilter}
                        onChange={(e) => setFuelFilter(e.target.value)}
                    >
                        <option value="all">All Fuel Types</option>
                        <option value="petrol">Petrol</option>
                        <option value="diesel">Diesel</option>
                        <option value="electric">Electric</option>
                        <option value="hybrid">Hybrid</option>
                        <option value="cng">CNG</option>
                    </select>
                </div>

                <div className="admin-vehicles-filter">
                    <label htmlFor="availability-filter">Status</label>
                    <select
                        id="availability-filter"
                        value={availabilityFilter}
                        onChange={(e) => setAvailabilityFilter(e.target.value)}
                    >
                        <option value="all">All Statuses</option>
                        <option value="available">Available</option>
                        <option value="compliance_required">Compliance Required</option>
                        <option value="under_maintenance">Under Maintenance</option>
                        <option value="unavailable">Unavailable</option>
                    </select>
                </div>

                <button
                    type="button"
                    className="admin-vehicles-secondary-btn refresh-btn"
                    onClick={fetchVehicles}
                    disabled={loading}
                    title="Reload fleet from database"
                >
                    <RefreshCw size={15} className={loading ? 'spinning' : ''} />
                    {loading ? 'Refreshing...' : 'Refresh'}
                </button>
            </section>

            <div className="admin-vehicles-summary">
                <span>
                    Fleet: <strong>{vehicles.length}</strong> vehicles | Showing: <strong>{filteredVehicles.length}</strong>
                </span>
            </div>

            {/* Table */}
            <section className="admin-vehicles-table-card">
                <div className="admin-vehicles-table-wrapper">
                    <table className="admin-vehicles-table">
                        <thead>
                            <tr>
                                <th>Vehicle & Model</th>
                                <th>Category & Fuel</th>
                                <th>Registration</th>
                                <th>Specs</th>
                                <th>Rental Price</th>
                                <th>Documents</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>

                        <tbody>
                            {filteredVehicles.map((vehicle) => {
                                const available =
                                    vehicle.is_available === true ||
                                    vehicle.is_available === 1 ||
                                    vehicle.is_available === '1';

                                const hasExpiredDocs = Number(vehicle.expired_documents) > 0;
                                const docCount = Number(vehicle.total_documents) || 0;

                                return (
                                    <tr key={vehicle.vehicle_id}>
                                        <td>
                                            <div className="admin-vehicle-info-cell">
                                                {vehicle.image_url && (
                                                    <img
                                                        src={vehicle.image_url}
                                                        alt={vehicle.name}
                                                        className="vehicle-row-thumb"
                                                        onError={(e) => { e.target.style.display = 'none'; }}
                                                    />
                                                )}
                                                <div>
                                                    <strong className="vehicle-name-title">{vehicle.name}</strong>
                                                    <span className="vehicle-brand-model">
                                                        {vehicle.brand || 'Brand'} {vehicle.model ? `• ${vehicle.model}` : ''}
                                                    </span>
                                                    <small className="vehicle-id-tag">ID: #{vehicle.vehicle_id}</small>
                                                </div>
                                            </div>
                                        </td>

                                        <td>
                                            <div className="cat-fuel-group">
                                                <span className="vehicle-cat-tag">{vehicle.category || '—'}</span>
                                                <span className={`fuel-type-pill fuel-${vehicle.fuel_type || 'petrol'}`}>
                                                    <Fuel size={11} />
                                                    {vehicle.fuel_type || 'petrol'}
                                                </span>
                                            </div>
                                        </td>

                                        <td>
                                            <div className="reg-info-cell">
                                                <strong className="reg-num-badge">
                                                    {vehicle.registration_number || 'UNREGISTERED'}
                                                </strong>
                                                <span className="reg-subtext">
                                                    {vehicle.registration_state || 'State N/A'}
                                                    {vehicle.manufacturing_year ? ` • ${vehicle.manufacturing_year}` : ''}
                                                </span>
                                            </div>
                                        </td>

                                        <td>
                                            <div className="specs-cell">
                                                <span>{vehicle.seating_capacity} Seats • {vehicle.transmission}</span>
                                                {vehicle.mileage && <small>{vehicle.mileage}</small>}
                                            </div>
                                        </td>

                                        <td className="admin-vehicle-price">
                                            <strong>{formatPrice(vehicle.price_per_day)}</strong>
                                            <small>/day</small>
                                        </td>

                                        <td>
                                            <div className="doc-compliance-cell">
                                                <button
                                                    type="button"
                                                    className={`doc-pill-btn ${hasExpiredDocs ? 'has-expired' : docCount > 0 ? 'is-valid' : 'is-empty'}`}
                                                    onClick={() => setDocumentModalVehicle(vehicle)}
                                                    title="Manage vehicle documents & certificates"
                                                >
                                                    <FileCheck size={13} />
                                                    <span>{docCount} Docs</span>
                                                    {hasExpiredDocs && <span className="doc-warn-dot" title="Has Expired Documents" />}
                                                </button>
                                            </div>
                                        </td>

                                        <td>
                                            <div className="admin-status-cell">
                                                <span
                                                    className={`admin-vehicle-status status-${vehicle.availability_status || (available ? 'available' : 'unavailable')} is-${vehicle.availability_status === 'compliance_required' ? 'compliance' : vehicle.availability_status === 'under_maintenance' ? 'maintenance' : vehicle.availability_status === 'available' ? 'available' : available ? 'available' : 'unavailable'}`}
                                                >
                                                    {vehicle.availability_badge?.text || (vehicle.availability_status === 'compliance_required' ? 'Compliance Required' : vehicle.availability_status === 'under_maintenance' ? 'Under Maintenance' : vehicle.availability_status === 'available' ? 'Available' : available ? 'Available' : 'Unavailable')}
                                                </span>
                                                {vehicle.availability_reason && (
                                                    <span className="admin-status-reason" title={vehicle.availability_reason}>
                                                        {vehicle.availability_reason}
                                                    </span>
                                                )}
                                            </div>
                                        </td>

                                        <td>
                                            <div className="admin-vehicle-actions">
                                                <button
                                                    type="button"
                                                    className="admin-vehicle-doc-btn"
                                                    onClick={() => setDocumentModalVehicle(vehicle)}
                                                    title="View & Upload Documents"
                                                >
                                                    <FileCheck size={14} />
                                                    Docs
                                                </button>

                                                <button
                                                    type="button"
                                                    className="admin-vehicle-edit-btn"
                                                    onClick={() => openEditForm(vehicle)}
                                                    title="Edit Vehicle Details"
                                                >
                                                    <Edit3 size={14} />
                                                    Edit
                                                </button>

                                                <button
                                                    type="button"
                                                    className="admin-vehicle-status-btn"
                                                    disabled={changingStatusId === vehicle.vehicle_id}
                                                    onClick={() => handleAvailabilityChange(vehicle)}
                                                    title={available ? 'Deactivate Vehicle' : 'Activate Vehicle'}
                                                >
                                                    <Power size={13} />
                                                    {changingStatusId === vehicle.vehicle_id
                                                        ? '...'
                                                        : available
                                                            ? 'Deactivate'
                                                            : 'Activate'}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}

                            {!loading && filteredVehicles.length === 0 && (
                                <tr>
                                    <td colSpan="8" className="admin-vehicles-empty">
                                        {vehicles.length === 0
                                            ? 'No vehicles found in fleet catalog. Click "+ Add New Vehicle" to begin.'
                                            : 'No vehicles match your active search and filter combination.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Document Management Modal */}
            {documentModalVehicle && (
                <VehicleDocumentsModal
                    vehicle={documentModalVehicle}
                    onClose={() => setDocumentModalVehicle(null)}
                    onDocumentsUpdated={fetchVehicles}
                />
            )}

            {/* Comprehensive Add / Edit Vehicle Modal */}
            {showForm && (
                <div
                    className="admin-vehicle-modal-backdrop"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) closeForm();
                    }}
                >
                    <section
                        className="admin-vehicle-modal modern-large-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="admin-vehicle-modal-title"
                    >
                        <header className="admin-vehicle-modal-header">
                            <div>
                                <span className="modal-eyebrow">
                                    <Settings size={13} /> FLEET INVENTORY MANAGEMENT
                                </span>
                                <h2 id="admin-vehicle-modal-title">
                                    {editingVehicle ? `Edit ${editingVehicle.name}` : 'Add New Fleet Vehicle'}
                                </h2>
                            </div>

                            <button
                                type="button"
                                className="admin-vehicle-modal-close"
                                onClick={closeForm}
                                disabled={saving}
                                aria-label="Close form"
                            >
                                ×
                            </button>
                        </header>

                        {/* Modal Tabs for Structured Information */}
                        <div className="modal-tabs-header">
                            <button
                                type="button"
                                className={`modal-tab-pill ${formTab === 'basic' ? 'active' : ''}`}
                                onClick={() => setFormTab('basic')}
                            >
                                <Info size={15} />
                                1. Basic Information
                            </button>
                            <button
                                type="button"
                                className={`modal-tab-pill ${formTab === 'technical' ? 'active' : ''}`}
                                onClick={() => setFormTab('technical')}
                            >
                                <Settings size={15} />
                                2. Technical Specs (Admin)
                            </button>
                            <button
                                type="button"
                                className={`modal-tab-pill ${formTab === 'registration' ? 'active' : ''}`}
                                onClick={() => setFormTab('registration')}
                            >
                                <FileCheck size={15} />
                                3. Registration Details
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="admin-vehicle-extended-form">
                            {formError && (
                                <div className="admin-vehicles-alert" role="alert">
                                    <AlertTriangle size={16} />
                                    <span>{formError}</span>
                                </div>
                            )}

                            <div className="modal-tab-body">
                                {/* TAB 1: BASIC INFORMATION */}
                                {formTab === 'basic' && (
                                    <div className="tab-section-content">
                                        <div className="admin-vehicle-form-grid">
                                            <div className="admin-vehicle-form-field">
                                                <label htmlFor="vehicle-name">Vehicle Name *</label>
                                                <input
                                                    id="vehicle-name"
                                                    name="name"
                                                    type="text"
                                                    required
                                                    value={form.name}
                                                    onChange={handleFormChange}
                                                    placeholder="e.g. Swift, City, Creta"
                                                />
                                            </div>

                                            <div className="admin-vehicle-form-field">
                                                <label htmlFor="vehicle-brand">Brand / Manufacturer</label>
                                                <input
                                                    id="vehicle-brand"
                                                    name="brand"
                                                    type="text"
                                                    value={form.brand}
                                                    onChange={handleFormChange}
                                                    placeholder="e.g. Maruti Suzuki, Honda, Hyundai"
                                                />
                                            </div>

                                            <div className="admin-vehicle-form-field">
                                                <label htmlFor="vehicle-model">Model / Variant</label>
                                                <input
                                                    id="vehicle-model"
                                                    name="model"
                                                    type="text"
                                                    value={form.model}
                                                    onChange={handleFormChange}
                                                    placeholder="e.g. VXi, ZX CVT, SX Tech"
                                                />
                                            </div>

                                            <div className="admin-vehicle-form-field">
                                                <label htmlFor="vehicle-category">Vehicle Category *</label>
                                                <select
                                                    id="vehicle-category"
                                                    name="category_id"
                                                    required
                                                    value={form.category_id}
                                                    onChange={handleFormChange}
                                                >
                                                    <option value="">Select Category</option>
                                                    {categories.map((c) => (
                                                        <option key={c.category_id} value={c.category_id}>
                                                            {c.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div className="admin-vehicle-form-field">
                                                <label htmlFor="vehicle-fuel">Fuel Type</label>
                                                <select
                                                    id="vehicle-fuel"
                                                    name="fuel_type"
                                                    value={form.fuel_type}
                                                    onChange={handleFormChange}
                                                >
                                                    <option value="petrol">Petrol</option>
                                                    <option value="diesel">Diesel</option>
                                                    <option value="electric">Electric</option>
                                                    <option value="hybrid">Hybrid</option>
                                                    <option value="cng">CNG</option>
                                                </select>
                                            </div>

                                            <div className="admin-vehicle-form-field">
                                                <label htmlFor="vehicle-transmission">Transmission *</label>
                                                <select
                                                    id="vehicle-transmission"
                                                    name="transmission"
                                                    required
                                                    value={form.transmission}
                                                    onChange={handleFormChange}
                                                >
                                                    <option value="manual">Manual</option>
                                                    <option value="automatic">Automatic</option>
                                                </select>
                                            </div>

                                            <div className="admin-vehicle-form-field">
                                                <label htmlFor="vehicle-seats">Seating Capacity *</label>
                                                <input
                                                    id="vehicle-seats"
                                                    name="seating_capacity"
                                                    type="number"
                                                    min="1"
                                                    max="20"
                                                    required
                                                    value={form.seating_capacity}
                                                    onChange={handleFormChange}
                                                />
                                            </div>

                                            <div className="admin-vehicle-form-field">
                                                <label htmlFor="vehicle-price">Rental Price Per Day (₹) *</label>
                                                <input
                                                    id="vehicle-price"
                                                    name="price_per_day"
                                                    type="number"
                                                    min="1"
                                                    step="0.01"
                                                    required
                                                    value={form.price_per_day}
                                                    onChange={handleFormChange}
                                                    placeholder="e.g. 1800"
                                                />
                                            </div>

                                            <div className="admin-vehicle-form-field">
                                                <label htmlFor="vehicle-year">Manufacturing Year</label>
                                                <input
                                                    id="vehicle-year"
                                                    name="manufacturing_year"
                                                    type="number"
                                                    min="1990"
                                                    max="2035"
                                                    value={form.manufacturing_year}
                                                    onChange={handleFormChange}
                                                    placeholder="e.g. 2024"
                                                />
                                            </div>

                                            <div className="admin-vehicle-form-field">
                                                <label htmlFor="vehicle-color">Vehicle Colour</label>
                                                <input
                                                    id="vehicle-color"
                                                    name="vehicle_color"
                                                    type="text"
                                                    value={form.vehicle_color}
                                                    onChange={handleFormChange}
                                                    placeholder="e.g. Pearl Arctic White"
                                                />
                                            </div>

                                            <div className="admin-vehicle-form-field">
                                                <label htmlFor="vehicle-mileage">Fuel Economy / Mileage</label>
                                                <input
                                                    id="vehicle-mileage"
                                                    name="mileage"
                                                    type="text"
                                                    value={form.mileage}
                                                    onChange={handleFormChange}
                                                    placeholder="e.g. 22.3 km/l or 450 km/charge"
                                                />
                                            </div>

                                            <div className="admin-vehicle-form-field">
                                                <label htmlFor="vehicle-engine">Engine Capacity / Motor</label>
                                                <input
                                                    id="vehicle-engine"
                                                    name="engine_capacity"
                                                    type="text"
                                                    value={form.engine_capacity}
                                                    onChange={handleFormChange}
                                                    placeholder="e.g. 1197 cc or 40.5 kWh"
                                                />
                                            </div>

                                            <div className="admin-vehicle-form-field full-width">
                                                <label htmlFor="vehicle-image">Vehicle Image URL</label>
                                                <input
                                                    id="vehicle-image"
                                                    name="image_url"
                                                    type="url"
                                                    value={form.image_url}
                                                    onChange={handleFormChange}
                                                    placeholder="https://... or relative /vehicles/swift.jpg"
                                                />
                                            </div>

                                            <div className="admin-vehicle-form-field full-width">
                                                <label htmlFor="vehicle-description">Vehicle Description</label>
                                                <textarea
                                                    id="vehicle-description"
                                                    name="description"
                                                    rows={3}
                                                    value={form.description}
                                                    onChange={handleFormChange}
                                                    placeholder="Overview of comfort, features, luggage room, safety ratings..."
                                                />
                                            </div>

                                            <div className="admin-vehicle-form-field checkbox-field full-width">
                                                <label className="checkbox-container">
                                                    <input
                                                        type="checkbox"
                                                        name="is_available"
                                                        checked={form.is_available}
                                                        onChange={handleFormChange}
                                                    />
                                                    <span>Active for customer reservations</span>
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* TAB 2: TECHNICAL SPECIFICATIONS (ADMIN ONLY) */}
                                {formTab === 'technical' && (
                                    <div className="tab-section-content">
                                        <div className="admin-form-notice">
                                            <Shield size={16} />
                                            <span>
                                                <strong>Confidential Internal Data:</strong> Engine numbers, chassis numbers, and VINs are strictly kept confidential for administrative fleet maintenance and will never be disclosed to customers.
                                            </span>
                                        </div>

                                        <div className="admin-vehicle-form-grid">
                                            <div className="admin-vehicle-form-field">
                                                <label htmlFor="tech-engine-no">Engine Number (Admin Only)</label>
                                                <input
                                                    id="tech-engine-no"
                                                    name="engine_number"
                                                    type="text"
                                                    value={form.engine_number}
                                                    onChange={handleFormChange}
                                                    placeholder="e.g. K12M1892831"
                                                />
                                            </div>

                                            <div className="admin-vehicle-form-field">
                                                <label htmlFor="tech-chassis-no">Chassis Number (Admin Only)</label>
                                                <input
                                                    id="tech-chassis-no"
                                                    name="chassis_number"
                                                    type="text"
                                                    value={form.chassis_number}
                                                    onChange={handleFormChange}
                                                    placeholder="e.g. MA3FCA12S30018291"
                                                />
                                            </div>

                                            <div className="admin-vehicle-form-field">
                                                <label htmlFor="tech-vin">Vehicle Identification Number (VIN)</label>
                                                <input
                                                    id="tech-vin"
                                                    name="vehicle_identification_number"
                                                    type="text"
                                                    value={form.vehicle_identification_number}
                                                    onChange={handleFormChange}
                                                    placeholder="17-character VIN identifier"
                                                />
                                            </div>

                                            <div className="admin-vehicle-form-field">
                                                <label htmlFor="tech-doors">Number of Doors</label>
                                                <input
                                                    id="tech-doors"
                                                    name="doors"
                                                    type="number"
                                                    min="0"
                                                    max="8"
                                                    value={form.doors}
                                                    onChange={handleFormChange}
                                                />
                                            </div>

                                            <div className="admin-vehicle-form-field">
                                                <label htmlFor="tech-boot">Boot Space</label>
                                                <input
                                                    id="tech-boot"
                                                    name="boot_space"
                                                    type="text"
                                                    value={form.boot_space}
                                                    onChange={handleFormChange}
                                                    placeholder="e.g. 378 Litres"
                                                />
                                            </div>

                                            <div className="admin-vehicle-form-field">
                                                <label htmlFor="tech-max-passengers">Maximum Passenger Capacity</label>
                                                <input
                                                    id="tech-max-passengers"
                                                    name="max_passengers"
                                                    type="number"
                                                    min="1"
                                                    max="20"
                                                    value={form.max_passengers}
                                                    onChange={handleFormChange}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* TAB 3: REGISTRATION INFORMATION */}
                                {formTab === 'registration' && (
                                    <div className="tab-section-content">
                                        <div className="admin-vehicle-form-grid">
                                            <div className="admin-vehicle-form-field">
                                                <label htmlFor="reg-number">Official Registration Number</label>
                                                <input
                                                    id="reg-number"
                                                    name="registration_number"
                                                    type="text"
                                                    value={form.registration_number}
                                                    onChange={handleFormChange}
                                                    placeholder="e.g. DL01AB1234 or HR26BC2003"
                                                />
                                            </div>

                                            <div className="admin-vehicle-form-field">
                                                <label htmlFor="reg-state">Registration State / RTO</label>
                                                <input
                                                    id="reg-state"
                                                    name="registration_state"
                                                    type="text"
                                                    value={form.registration_state}
                                                    onChange={handleFormChange}
                                                    placeholder="e.g. Delhi, Haryana, Karnataka"
                                                />
                                            </div>

                                            <div className="admin-vehicle-form-field">
                                                <label htmlFor="reg-date">Registration Issue Date</label>
                                                <input
                                                    id="reg-date"
                                                    name="registration_date"
                                                    type="date"
                                                    value={form.registration_date}
                                                    onChange={handleFormChange}
                                                />
                                            </div>

                                            <div className="admin-vehicle-form-field">
                                                <label htmlFor="reg-validity">Registration Validity Date</label>
                                                <input
                                                    id="reg-validity"
                                                    name="registration_validity"
                                                    type="date"
                                                    value={form.registration_validity}
                                                    onChange={handleFormChange}
                                                />
                                            </div>
                                        </div>

                                        <div className="admin-form-notice" style={{ marginTop: '20px' }}>
                                            <FileCheck size={16} />
                                            <span>
                                                After saving vehicle registration details, you can attach official certificates (RC, Insurance, PUC, Fitness) by clicking the <strong>&quot;Docs&quot;</strong> button in the fleet table.
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <footer className="admin-vehicle-modal-footer">
                                <div className="modal-tab-nav-buttons">
                                    {formTab === 'technical' && (
                                        <button
                                            type="button"
                                            className="admin-vehicles-secondary-btn"
                                            onClick={() => setFormTab('basic')}
                                        >
                                            ← Back to Basic
                                        </button>
                                    )}
                                    {formTab === 'registration' && (
                                        <button
                                            type="button"
                                            className="admin-vehicles-secondary-btn"
                                            onClick={() => setFormTab('technical')}
                                        >
                                            ← Back to Technical
                                        </button>
                                    )}
                                    {formTab === 'basic' && (
                                        <button
                                            type="button"
                                            className="admin-vehicles-secondary-btn"
                                            onClick={() => setFormTab('technical')}
                                        >
                                            Next: Technical Specs →
                                        </button>
                                    )}
                                    {formTab === 'technical' && (
                                        <button
                                            type="button"
                                            className="admin-vehicles-secondary-btn"
                                            onClick={() => setFormTab('registration')}
                                        >
                                            Next: Registration Details →
                                        </button>
                                    )}
                                </div>

                                <div className="modal-submission-buttons">
                                    <button
                                        type="button"
                                        className="admin-vehicles-secondary-btn"
                                        onClick={closeForm}
                                        disabled={saving}
                                    >
                                        Cancel
                                    </button>

                                    <button
                                        type="submit"
                                        className="admin-vehicles-primary-btn"
                                        disabled={saving}
                                    >
                                        {saving ? 'Saving Fleet Data...' : editingVehicle ? 'Update Vehicle' : 'Add Vehicle'}
                                    </button>
                                </div>
                            </footer>
                        </form>
                    </section>
                </div>
            )}
        </main>
    );
}

export default AdminVehicles;
