import { useCallback, useEffect, useMemo, useState } from 'react';
import axiosInstance from '../../api/axiosInstance';
import Loader from '../../components/common/Loader';
import './AdminVehicles.css';

const EMPTY_FORM = {
    name: '',
    category_id: '',
    brand: '',
    seating_capacity: '5',
    transmission: 'manual',
    price_per_day: '',
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
        maximumFractionDigits: 2,
    });
};

function AdminVehicles() {
    const [vehicles, setVehicles] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [availabilityFilter, setAvailabilityFilter] = useState('all');

    const [showForm, setShowForm] = useState(false);
    const [editingVehicle, setEditingVehicle] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [formError, setFormError] = useState('');
    const [saving, setSaving] = useState(false);
    const [changingStatusId, setChangingStatusId] = useState(null);

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
                        : 'Unable to load vehicles. Please check the backend and try again.'
            );
        } finally {
            setLoading(false);
        }

    }, []);

    const fetchCategories = useCallback(async () => {
        try {
            const response = await axiosInstance.get('/admin/categories');

            if (!Array.isArray(response.data)) {
                throw new Error('Unexpected category data received from the server.');
            }

            setCategories(response.data);
        } catch (err) {
            console.error('Failed to fetch vehicle categories:', err);
            setFormError('Unable to load vehicle categories. Please retry.');
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
                String(vehicle.name || '').toLowerCase().includes(query) ||
                String(vehicle.brand || '').toLowerCase().includes(query);

            const available =
                vehicle.is_available === true ||
                vehicle.is_available === 1 ||
                vehicle.is_available === '1';

            const matchesAvailability =
                availabilityFilter === 'all' ||
                (availabilityFilter === 'available' && available) ||
                (availabilityFilter === 'unavailable' && !available);

            return matchesSearch && matchesAvailability;
        });

    }, [vehicles, search, availabilityFilter]);

    const openAddForm = () => {
        setEditingVehicle(null);
        setForm({ ...EMPTY_FORM });
        setFormError('');
        setShowForm(true);
    };

    const openEditForm = (vehicle) => {
        setEditingVehicle(vehicle);
        setForm({
            name: vehicle.name || '',
            category_id: String(vehicle.category_id ?? ''),
            brand: vehicle.brand || '',
            seating_capacity: String(vehicle.seating_capacity ?? 5),
            transmission: vehicle.transmission || 'manual',
            price_per_day: String(vehicle.price_per_day ?? ''),
            image_url: vehicle.image_url || '',
            is_available:
                vehicle.is_available === true ||
                vehicle.is_available === 1 ||
                vehicle.is_available === '1',
        });
        setFormError('');
        setShowForm(true);
    };

    const closeForm = () => {
        if (saving) return;

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
        setFormError('');

        if (
            !form.name.trim() ||
            !form.category_id ||
            !form.seating_capacity ||
            !form.price_per_day
        ) {
            setFormError('Please complete all required fields.');
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
            seating_capacity: seatingCapacity,
            transmission: form.transmission,
            price_per_day: pricePerDay,
            image_url: form.image_url.trim() || null,
            is_available: form.is_available,
        };

        setSaving(true);

        try {
            if (editingVehicle) {
                await axiosInstance.put(
                    `/admin/vehicles/${editingVehicle.vehicle_id}`,
                    payload
                );
            } else {
                await axiosInstance.post('/admin/vehicles', payload);
            }

            setShowForm(false);
            setEditingVehicle(null);
            setForm({ ...EMPTY_FORM });
            await fetchVehicles();
        } catch (err) {
            console.error('Failed to save vehicle:', err);

            setFormError(
                err.response?.data?.message ||
                'Unable to save the vehicle. Please verify the details and try again.'
            );
        } finally {
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
            await axiosInstance.patch(
                `/admin/vehicles/${vehicle.vehicle_id}/status`,
                { is_available: nextStatus }
            );

            setVehicles((current) =>
                current.map((item) =>
                    item.vehicle_id === vehicle.vehicle_id
                        ? { ...item, is_available: nextStatus }
                        : item
                )
            );
        } catch (err) {
            console.error('Failed to update vehicle status:', err);

            setError(
                err.response?.data?.message ||
                'Unable to update vehicle availability. Please try again.'
            );
        } finally {
            setChangingStatusId(null);
        }

    };

    if (loading && vehicles.length === 0) {
        return (
            <main className="admin-vehicles-page">
                <Loader />
            </main>
        );
    }

    return (
        <main className="admin-vehicles-page">
            <header className="admin-vehicles-header">
                <div>
                    <span className="admin-vehicles-eyebrow">ADMINISTRATION</span>
                    <h1>Vehicle Management</h1>
                    <p>Manage your rental fleet, vehicle details, and availability.</p>
                </div>

                <button
                    type="button"
                    className="admin-vehicles-primary-btn"
                    onClick={openAddForm}
                >
                    + Add Vehicle
                </button>
            </header>

            {error && (
                <div className="admin-vehicles-alert" role="alert">
                    <span>{error}</span>
                    <button type="button" onClick={fetchVehicles}>
                        Retry
                    </button>
                </div>
            )}

            <section className="admin-vehicles-toolbar">
                <div className="admin-vehicles-search">
                    <label htmlFor="vehicle-search">Search vehicles</label>
                    <input
                        id="vehicle-search"
                        type="search"
                        placeholder="Search by name or brand..."
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                    />
                </div>

                <div className="admin-vehicles-filter">
                    <label htmlFor="availability-filter">Availability</label>
                    <select
                        id="availability-filter"
                        value={availabilityFilter}
                        onChange={(event) => setAvailabilityFilter(event.target.value)}
                    >
                        <option value="all">All vehicles</option>
                        <option value="available">Available</option>
                        <option value="unavailable">Unavailable</option>
                    </select>
                </div>

                <button
                    type="button"
                    className="admin-vehicles-secondary-btn"
                    onClick={fetchVehicles}
                    disabled={loading}
                >
                    {loading ? 'Refreshing...' : '↻ Refresh'}
                </button>
            </section>

            <div className="admin-vehicles-summary">
                <span>
                    <strong>{vehicles.length}</strong> total vehicles
                </span>
                <span>
                    <strong>{filteredVehicles.length}</strong> shown
                </span>
            </div>

            <section className="admin-vehicles-table-card">
                <div className="admin-vehicles-table-wrapper">
                    <table className="admin-vehicles-table">
                        <thead>
                            <tr>
                                <th>Vehicle</th>
                                <th>Category</th>
                                <th>Seats</th>
                                <th>Transmission</th>
                                <th>Price / Day</th>
                                <th>Bookings</th>
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

                                return (
                                    <tr key={vehicle.vehicle_id}>
                                        <td>
                                            <div className="admin-vehicle-name">
                                                <strong>{vehicle.name}</strong>
                                                <span>{vehicle.brand || 'Brand not specified'}</span>
                                                <small>ID: {vehicle.vehicle_id}</small>
                                            </div>
                                        </td>

                                        <td>{vehicle.category || '—'}</td>
                                        <td>{vehicle.seating_capacity ?? '—'}</td>
                                        <td className="admin-vehicle-transmission">
                                            {vehicle.transmission || '—'}
                                        </td>
                                        <td className="admin-vehicle-price">
                                            {formatPrice(vehicle.price_per_day)}
                                        </td>
                                        <td>{Number(vehicle.total_bookings) || 0}</td>
                                        <td>
                                            <span
                                                className={`admin-vehicle-status ${available ? 'is-available' : 'is-unavailable'
                                                    }`}
                                            >
                                                {available ? 'Available' : 'Unavailable'}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="admin-vehicle-actions">
                                                <button
                                                    type="button"
                                                    className="admin-vehicle-edit-btn"
                                                    onClick={() => openEditForm(vehicle)}
                                                >
                                                    Edit
                                                </button>

                                                <button
                                                    type="button"
                                                    className="admin-vehicle-status-btn"
                                                    disabled={changingStatusId === vehicle.vehicle_id}
                                                    onClick={() => handleAvailabilityChange(vehicle)}
                                                >
                                                    {changingStatusId === vehicle.vehicle_id
                                                        ? 'Updating...'
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
                                            ? 'No vehicles found. Add your first vehicle to get started.'
                                            : 'No vehicles match your search or availability filter.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            {showForm && (
                <div
                    className="admin-vehicle-modal-backdrop"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) closeForm();
                    }}
                >
                    <section
                        className="admin-vehicle-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="admin-vehicle-modal-title"
                    >
                        <header className="admin-vehicle-modal-header">
                            <div>
                                <span>FLEET MANAGEMENT</span>
                                <h2 id="admin-vehicle-modal-title">
                                    {editingVehicle ? 'Edit Vehicle' : 'Add Vehicle'}
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

                        <form onSubmit={handleSubmit}>
                            {formError && (
                                <div className="admin-vehicles-alert" role="alert">
                                    {formError}
                                </div>
                            )}

                            <div className="admin-vehicle-form-grid">
                                <div className="admin-vehicle-form-field">
                                    <label htmlFor="vehicle-name">Vehicle Name *</label>
                                    <input
                                        id="vehicle-name"
                                        name="name"
                                        value={form.name}
                                        onChange={handleFormChange}
                                        maxLength="100"
                                        required
                                    />
                                </div>

                                <div className="admin-vehicle-form-field">
                                    <label htmlFor="vehicle-brand">Brand</label>
                                    <input
                                        id="vehicle-brand"
                                        name="brand"
                                        value={form.brand}
                                        onChange={handleFormChange}
                                        maxLength="50"
                                    />
                                </div>

                                <div className="admin-vehicle-form-field">
                                    <label htmlFor="vehicle-category">Category *</label>
                                    <select
                                        id="vehicle-category"
                                        name="category_id"
                                        value={form.category_id}
                                        onChange={handleFormChange}
                                        required
                                    >
                                        <option value="">Select category</option>
                                        {categories.map((category) => (
                                            <option
                                                key={category.category_id}
                                                value={category.category_id}
                                            >
                                                {category.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="admin-vehicle-form-field">
                                    <label htmlFor="vehicle-seats">Seating Capacity *</label>
                                    <input
                                        id="vehicle-seats"
                                        name="seating_capacity"
                                        type="number"
                                        min="1"
                                        step="1"
                                        value={form.seating_capacity}
                                        onChange={handleFormChange}
                                        required
                                    />
                                </div>

                                <div className="admin-vehicle-form-field">
                                    <label htmlFor="vehicle-transmission">Transmission *</label>
                                    <select
                                        id="vehicle-transmission"
                                        name="transmission"
                                        value={form.transmission}
                                        onChange={handleFormChange}
                                        required
                                    >
                                        <option value="manual">Manual</option>
                                        <option value="automatic">Automatic</option>
                                    </select>
                                </div>

                                <div className="admin-vehicle-form-field">
                                    <label htmlFor="vehicle-price">Price per Day (₹) *</label>
                                    <input
                                        id="vehicle-price"
                                        name="price_per_day"
                                        type="number"
                                        min="0.01"
                                        step="0.01"
                                        value={form.price_per_day}
                                        onChange={handleFormChange}
                                        required
                                    />
                                </div>

                                <div className="admin-vehicle-form-field admin-vehicle-form-full">
                                    <label htmlFor="vehicle-image">Image URL or Path</label>
                                    <input
                                        id="vehicle-image"
                                        name="image_url"
                                        type="text"
                                        value={form.image_url}
                                        onChange={handleFormChange}
                                        maxLength="255"
                                        placeholder="/vehicles/swift.jpg"
                                    />
                                    <small>
                                        Enter a relative image path or an HTTP/HTTPS URL.
                                    </small>
                                </div>

                                <div className="admin-vehicle-form-field admin-vehicle-form-full">
                                    <label className="admin-vehicle-checkbox-label">
                                        <input
                                            type="checkbox"
                                            name="is_available"
                                            checked={form.is_available}
                                            onChange={handleFormChange}
                                        />
                                        Vehicle is available for rent
                                    </label>
                                </div>
                            </div>

                            <footer className="admin-vehicle-form-footer">
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
                                    disabled={saving || categories.length === 0}
                                >
                                    {saving
                                        ? 'Saving...'
                                        : editingVehicle
                                            ? 'Save Changes'
                                            : 'Create Vehicle'}
                                </button>
                            </footer>
                        </form>
                    </section>
                </div>
            )}
        </main>

    );
}

export default AdminVehicles;