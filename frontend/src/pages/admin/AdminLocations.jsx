import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Navigation, Settings, Plus, Trash2, Save, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';
import axiosInstance from '../../api/axiosInstance';
import Loader from '../../components/common/Loader';
import './AdminLocations.css';

function AdminLocations() {
    const [activeTab, setActiveTab] = useState('map'); // 'map' | 'pricing' | 'hubs'

    // Pricing state
    const [pricing, setPricing] = useState({
        base_delivery_charge: 150,
        per_km_charge: 15,
        free_delivery_distance_km: 5,
        max_delivery_distance_km: 150
    });
    const [pricingLoading, setPricingLoading] = useState(false);
    const [pricingSaved, setPricingSaved] = useState(false);

    // Hubs state
    const [hubs, setHubs] = useState([]);
    const [hubsLoading, setHubsLoading] = useState(false);
    const [newHub, setNewHub] = useState({
        hub_name: '',
        address: '',
        latitude: '',
        longitude: '',
        city: ''
    });
    const [addingHub, setAddingHub] = useState(false);

    // Bookings Map state
    const [bookingLocations, setBookingLocations] = useState([]);
    const [mapLoading, setMapLoading] = useState(false);
    const mapRef = useRef(null);
    const mapInstance = useRef(null);

    // Fetch pricing
    const fetchPricing = async () => {
        setPricingLoading(true);
        try {
            const res = await axiosInstance.get('/admin/locations/pricing');
            if (res.data?.pricing) {
                setPricing(res.data.pricing);
            }
        } catch (err) {
            console.error('Error fetching pricing:', err);
        } finally {
            setPricingLoading(false);
        }
    };

    // Fetch hubs
    const fetchHubs = async () => {
        setHubsLoading(true);
        try {
            const res = await axiosInstance.get('/admin/locations/hubs');
            setHubs(res.data?.hubs || []);
        } catch (err) {
            console.error('Error fetching hubs:', err);
        } finally {
            setHubsLoading(false);
        }
    };

    // Fetch map locations
    const fetchMapLocations = async () => {
        setMapLoading(true);
        try {
            const res = await axiosInstance.get('/admin/locations/routes');
            setBookingLocations(res.data?.bookings || []);
        } catch (err) {
            console.error('Error fetching routes for map:', err);
        } finally {
            setMapLoading(false);
        }
    };

    useEffect(() => {
        fetchPricing();
        fetchHubs();
        fetchMapLocations();
    }, []);

    // Render Leaflet Map for Booking Routes
    useEffect(() => {
        if (activeTab !== 'map' || !mapRef.current) return;

        if (mapInstance.current) {
            mapInstance.current.remove();
            mapInstance.current = null;
        }

        const map = L.map(mapRef.current, {
            center: [30.7398, 76.7827],
            zoom: 11
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);

        mapInstance.current = map;

        const bounds = [];

        bookingLocations.forEach((b) => {
            if (b.pickup_latitude && b.pickup_longitude) {
                const p = [Number(b.pickup_latitude), Number(b.pickup_longitude)];
                bounds.push(p);

                const pickupIcon = L.divIcon({
                    className: 'map-pin-pickup',
                    html: '<div style="background:#10b981;width:14px;height:14px;border-radius:50%;border:2px solid #fff;box-shadow:0 2px 5px rgba(0,0,0,0.4)"></div>',
                    iconSize: [14, 14],
                    iconAnchor: [7, 7]
                });

                L.marker(p, { icon: pickupIcon })
                    .addTo(map)
                    .bindPopup(`<b>Booking #${b.booking_id} (Pickup)</b><br/>${b.customer_name} • ${b.vehicle_name}<br/>📍 ${b.pickup_address}`);
            }

            if (b.drop_latitude && b.drop_longitude) {
                const d = [Number(b.drop_latitude), Number(b.drop_longitude)];
                bounds.push(d);

                const dropIcon = L.divIcon({
                    className: 'map-pin-drop',
                    html: '<div style="background:#f43f5e;width:14px;height:14px;border-radius:50%;border:2px solid #fff;box-shadow:0 2px 5px rgba(0,0,0,0.4)"></div>',
                    iconSize: [14, 14],
                    iconAnchor: [7, 7]
                });

                L.marker(d, { icon: dropIcon })
                    .addTo(map)
                    .bindPopup(`<b>Booking #${b.booking_id} (Drop)</b><br/>${b.customer_name}<br/>🏁 ${b.drop_address}`);

                if (b.pickup_latitude && b.pickup_longitude) {
                    const p = [Number(b.pickup_latitude), Number(b.pickup_longitude)];
                    L.polyline([p, d], { color: '#0284c7', weight: 2.5, opacity: 0.65, dashArray: '4, 6' }).addTo(map);
                }
            }
        });

        if (bounds.length > 0) {
            map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
        }

        return () => {
            if (mapInstance.current) {
                mapInstance.current.remove();
                mapInstance.current = null;
            }
        };
    }, [activeTab, bookingLocations]);

    // Handle Save Pricing
    const handleSavePricing = async (e) => {
        e.preventDefault();
        setPricingLoading(true);
        setPricingSaved(false);
        try {
            await axiosInstance.put('/admin/locations/pricing', pricing);
            setPricingSaved(true);
            setTimeout(() => setPricingSaved(false), 3000);
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to update pricing rules');
        } finally {
            setPricingLoading(false);
        }
    };

    // Handle Create Hub
    const handleCreateHub = async (e) => {
        e.preventDefault();
        setAddingHub(true);
        try {
            await axiosInstance.post('/admin/locations/hubs', newHub);
            setNewHub({ hub_name: '', address: '', latitude: '', longitude: '', city: '' });
            fetchHubs();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to create service hub');
        } finally {
            setAddingHub(false);
        }
    };

    // Handle Delete Hub
    const handleDeleteHub = async (id) => {
        if (!window.confirm('Are you sure you want to delete this service hub?')) return;
        try {
            await axiosInstance.delete(`/admin/locations/hubs/${id}`);
            fetchHubs();
        } catch (err) {
            alert('Failed to delete service hub');
        }
    };

    return (
        <div className="admin-locations-page">
            <header className="page-header">
                <div>
                    <h2>Location & Delivery Pricing Management</h2>
                    <p>Configure automated transit pricing, inspect booking routes, and manage service hubs.</p>
                </div>
            </header>

            {/* Sub Tabs */}
            <div className="admin-nav-tabs">
                <button
                    type="button"
                    className={`tab-btn ${activeTab === 'map' ? 'active' : ''}`}
                    onClick={() => setActiveTab('map')}
                >
                    <MapPin size={16} />
                    <span>Booking Routes Map ({bookingLocations.length})</span>
                </button>
                <button
                    type="button"
                    className={`tab-btn ${activeTab === 'pricing' ? 'active' : ''}`}
                    onClick={() => setActiveTab('pricing')}
                >
                    <Settings size={16} />
                    <span>Delivery Pricing Rules</span>
                </button>
                <button
                    type="button"
                    className={`tab-btn ${activeTab === 'hubs' ? 'active' : ''}`}
                    onClick={() => setActiveTab('hubs')}
                >
                    <Navigation size={16} />
                    <span>Service Hubs & Depots ({hubs.length})</span>
                </button>
            </div>

            {/* TAB 1: BOOKING ROUTES MAP */}
            {activeTab === 'map' && (
                <div className="tab-pane map-pane">
                    <div className="map-meta-strip">
                        <div className="meta-indicator">
                            <span className="dot dot-pickup" />
                            <span>Pickup Points</span>
                        </div>
                        <div className="meta-indicator">
                            <span className="dot dot-drop" />
                            <span>Drop Points</span>
                        </div>
                        <div className="meta-indicator">
                            <span className="line-sample" />
                            <span>Transit Routes</span>
                        </div>
                        <button type="button" className="refresh-btn" onClick={fetchMapLocations} disabled={mapLoading}>
                            <RefreshCw size={14} className={mapLoading ? 'spin-icon' : ''} />
                            <span>Refresh Map</span>
                        </button>
                    </div>

                    <div className="admin-leaflet-canvas-wrap">
                        <div ref={mapRef} className="admin-leaflet-canvas" />
                    </div>
                </div>
            )}

            {/* TAB 2: PRICING RULES */}
            {activeTab === 'pricing' && (
                <div className="tab-pane pricing-pane">
                    <form onSubmit={handleSavePricing} className="pricing-config-card">
                        <div className="card-header-bar">
                            <h4>Configurable Delivery Pricing Rules</h4>
                            <p>Delivery charges are calculated automatically on the backend using road routing distance.</p>
                        </div>

                        {pricingSaved && (
                            <div className="success-callout">
                                <CheckCircle size={16} />
                                <span>Delivery pricing rules updated successfully!</span>
                            </div>
                        )}

                        <div className="pricing-grid">
                            <div className="pricing-field">
                                <label>Base Delivery Fee (₹)</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={pricing.base_delivery_charge}
                                    onChange={(e) => setPricing({ ...pricing, base_delivery_charge: e.target.value })}
                                    required
                                />
                                <small>Applied to deliveries exceeding free distance radius.</small>
                            </div>

                            <div className="pricing-field">
                                <label>Per-Kilometer Rate (₹/km)</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={pricing.per_km_charge}
                                    onChange={(e) => setPricing({ ...pricing, per_km_charge: e.target.value })}
                                    required
                                />
                                <small>Rate charged for each kilometer beyond free radius.</small>
                            </div>

                            <div className="pricing-field">
                                <label>Free Delivery Distance (km)</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={pricing.free_delivery_distance_km}
                                    onChange={(e) => setPricing({ ...pricing, free_delivery_distance_km: e.target.value })}
                                    required
                                />
                                <small>Deliveries within this distance have ₹0 delivery fee.</small>
                            </div>

                            <div className="pricing-field">
                                <label>Maximum Delivery Distance (km)</label>
                                <input
                                    type="number"
                                    min="10"
                                    value={pricing.max_delivery_distance_km}
                                    onChange={(e) => setPricing({ ...pricing, max_delivery_distance_km: e.target.value })}
                                    required
                                />
                                <small>Maximum billable distance cap for doorstep deliveries.</small>
                            </div>
                        </div>

                        <div className="pricing-actions">
                            <button type="submit" className="save-pricing-btn" disabled={pricingLoading}>
                                <Save size={16} />
                                <span>{pricingLoading ? 'Saving...' : 'Save Pricing Rules'}</span>
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* TAB 3: SERVICE HUBS */}
            {activeTab === 'hubs' && (
                <div className="tab-pane hubs-pane">
                    {/* Add Hub Form */}
                    <form onSubmit={handleCreateHub} className="add-hub-card">
                        <h4>Register New Service Hub / Depot</h4>
                        <div className="hub-form-grid">
                            <input
                                type="text"
                                placeholder="Hub Name (e.g. Patiala Central Station)"
                                value={newHub.hub_name}
                                onChange={(e) => setNewHub({ ...newHub, hub_name: e.target.value })}
                                required
                            />
                            <input
                                type="text"
                                placeholder="City"
                                value={newHub.city}
                                onChange={(e) => setNewHub({ ...newHub, city: e.target.value })}
                                required
                            />
                            <input
                                type="text"
                                placeholder="Full Street Address"
                                value={newHub.address}
                                onChange={(e) => setNewHub({ ...newHub, address: e.target.value })}
                                required
                            />
                            <input
                                type="number"
                                step="0.000001"
                                placeholder="Latitude (e.g. 30.7398)"
                                value={newHub.latitude}
                                onChange={(e) => setNewHub({ ...newHub, latitude: e.target.value })}
                                required
                            />
                            <input
                                type="number"
                                step="0.000001"
                                placeholder="Longitude (e.g. 76.7827)"
                                value={newHub.longitude}
                                onChange={(e) => setNewHub({ ...newHub, longitude: e.target.value })}
                                required
                            />
                            <button type="submit" className="add-hub-btn" disabled={addingHub}>
                                <Plus size={16} />
                                <span>{addingHub ? 'Adding...' : 'Add Service Hub'}</span>
                            </button>
                        </div>
                    </form>

                    {/* Hubs Table */}
                    <div className="hubs-table-card">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Hub Name</th>
                                    <th>City</th>
                                    <th>Street Address</th>
                                    <th>Coordinates</th>
                                    <th>Status</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {hubs.map((h) => (
                                    <tr key={h.id}>
                                        <td><strong>{h.hub_name}</strong></td>
                                        <td>{h.city}</td>
                                        <td>{h.address}</td>
                                        <td><code>{h.latitude}, {h.longitude}</code></td>
                                        <td><span className="badge-active">Active</span></td>
                                        <td>
                                            <button
                                                type="button"
                                                className="delete-hub-btn"
                                                onClick={() => handleDeleteHub(h.id)}
                                                title="Delete Hub"
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

export default AdminLocations;

