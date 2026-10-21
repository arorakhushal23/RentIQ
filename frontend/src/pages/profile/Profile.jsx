import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import axiosInstance from '../../api/axiosInstance'
import './Profile.css'
import vehicleImages from '../../utils/vehicleImages'
import Loader from '../../components/common/Loader'

function Profile() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedBooking, setSelectedBooking] = useState(null)

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const response = await axiosInstance.get('/bookings/my-bookings')
        setBookings(response.data.bookings)
      } catch (error) {
        setError('Failed to load rental history')
      } finally {
        setLoading(false)
      }
    }

    fetchBookings()
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const formatDate = (date) => {
    if (!date) return 'Not available'

    return new Date(date).toLocaleDateString('en-IN')
  }

  const upcomingTrips = bookings.filter((booking) => {
    const status = booking.status?.toLowerCase()

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const endDate = new Date(booking.end_date)
    endDate.setHours(0, 0, 0, 0)

    return (
      (status === 'pending' || status === 'confirmed') &&
      endDate >= today
    )
  }).length

  return (
    <div className="profile-page">

      {/* Profile Header */}
      <div className="profile-header">
        <div>
          <h1>Hello, {user?.name}</h1>

          <p>
            Manage your profile, view your bookings,
            and keep track of your journeys.
          </p>
        </div>
      </div>

      {/* Dashboard */}
      <div className="profile-dashboard">

        <section className="profile-card personal-card">
          <div className="card-header">
            <h2>Personal Information</h2>

            <button type="button" className="edit-button">
              Edit
            </button>
          </div>

          <div className="profile-details">
            <div className="profile-avatar">
              {user?.name?.charAt(0).toUpperCase()}
            </div>

            <div className="profile-data">
              <div>
                <span>Name</span>
                <strong>{user?.name}</strong>
              </div>

              <div>
                <span>Email</span>
                <strong>{user?.email}</strong>
              </div>

              <div>
                <span>Role</span>
                <strong>{user?.role}</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="profile-card stats-card">
          <div className="stat">
            <span>Total Bookings</span>
            <strong>{bookings.length}</strong>
          </div>

          <div className="stat">
            <span>Upcoming Trips</span>
            <strong>{upcomingTrips}</strong>
          </div>

          <p className="stats-message">
            Good journeys make great stories.
          </p>
        </section>

      </div>

      {/* Rental History */}
      <section className="rental-section">
        <div className="rental-header">
          <div>
            <h2>Rental History</h2>
            <p>Keep track of your vehicle rentals.</p>
          </div>
        </div>

        {loading && (
          <Loader message="Loading your rental history..." />
        )}

        {error && (
          <p className="profile-error">{error}</p>
        )}

        {!loading && !error && bookings.length === 0 && (
          <p>No rental history yet.</p>
        )}

        {!loading && !error && bookings.length > 0 && (
          <div className="booking-list">
            {bookings.map((booking) => (
              <div
                className="booking-card"
                key={booking.booking_id}
              >

                <div className="booking-vehicle">
                  {vehicleImages[booking.vehicle_name] ? (
                    <img
                      src={vehicleImages[booking.vehicle_name]}
                      alt={booking.vehicle_name}
                    />
                  ) : (
                    <span>🚗</span>
                  )}
                </div>

                <div className="booking-info">
                  <div className="booking-title">
                    <h3>{booking.vehicle_name}</h3>

                    <span
                      className={`booking-status ${booking.status?.toLowerCase()}`}
                    >
                      {booking.status}
                    </span>
                  </div>

                  <p>
                    📅 {formatDate(booking.start_date)}
                    {' → '}
                    {formatDate(booking.end_date)}
                  </p>
                </div>

                <div className="booking-price">
                  <span>Total</span>
                  <strong>
                    ₹{Number(booking.total_price).toLocaleString('en-IN')}
                  </strong>
                </div>

                <div className="booking-id">
                  <span>Booking ID</span>
                  <strong>#{booking.booking_id}</strong>
                </div>

                <button
                  type="button"
                  className="details-button"
                  onClick={() => {
                    console.log('Selected booking:', booking)
                    setSelectedBooking(booking)
                  }}
                >
                  View Details
                </button>

              </div>
            ))}
          </div>
        )}
      </section>

           {/* Booking Details Modal */}
      {selectedBooking && (
        <div
          className="booking-modal-overlay"
          onClick={() => setSelectedBooking(null)}
        >
          <div
            className="booking-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="booking-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            {/* Header */}
            <div className="booking-modal-header">
              <div>
                <span className="booking-modal-eyebrow">
                  RENTIQ · RENTAL SUMMARY
                </span>

                <h2 id="booking-modal-title">
                  Booking Details
                </h2>

                <span className="booking-modal-reference">
                  Booking #{selectedBooking.booking_id}
                </span>
              </div>

              <button
                type="button"
                className="booking-modal-close"
                onClick={() => setSelectedBooking(null)}
                aria-label="Close booking details"
              >
                &times;
              </button>
            </div>

            {/* Vehicle Image */}
            <div className="booking-modal-vehicle">
              {vehicleImages[selectedBooking.vehicle_name] ? (
                <img
                  src={vehicleImages[selectedBooking.vehicle_name]}
                  alt={selectedBooking.vehicle_name}
                />
              ) : (
                <div className="booking-modal-vehicle-placeholder">
                  🚗
                </div>
              )}

              <div className="booking-modal-vehicle-info">
                <span>YOUR RENTAL VEHICLE</span>

                <h3>{selectedBooking.vehicle_name}</h3>

                <span
                  className={`booking-status ${selectedBooking.status?.toLowerCase()}`}
                >
                  {selectedBooking.status}
                </span>
              </div>
            </div>

            {/* Rental Dates */}
            <div className="booking-modal-section">
              <h3 className="booking-modal-section-title">
                Rental Period
              </h3>

              <div className="booking-modal-dates">
                <div className="booking-modal-date">
                  <span className="booking-modal-date-icon">
                    ↗
                  </span>

                  <div>
                    <span>Pickup Date</span>

                    <strong>
                      {formatDate(selectedBooking.start_date)}
                    </strong>
                  </div>
                </div>

                <div className="booking-modal-date">
                  <span className="booking-modal-date-icon">
                    ↙
                  </span>

                  <div>
                    <span>Return Date</span>

                    <strong>
                      {formatDate(selectedBooking.end_date)}
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Booking Information */}
            <div className="booking-modal-section">
              <h3 className="booking-modal-section-title">
                Booking Information
              </h3>

              <div className="booking-modal-info">
                <div>
                  <span>Booking ID</span>
                  <strong>#{selectedBooking.booking_id}</strong>
                </div>

                <div>
                  <span>Booked On</span>

                  <strong>
                    {formatDate(selectedBooking.created_at)}
                  </strong>
                </div>
              </div>
            </div>

            {/* Price Summary */}
            <div className="booking-modal-total">
              <div>
                <span>Total Rental Price</span>
                <small>For your selected rental period</small>
              </div>

              <strong>
                ₹
                {Number(
                  selectedBooking.total_price
                ).toLocaleString('en-IN')}
              </strong>
            </div>

            {/* Footer */}
            <button
              type="button"
              className="booking-modal-done"
              onClick={() => setSelectedBooking(null)}
            >
              Close Details
            </button>
          </div>
        </div>
      )}
      <button
        type="button"
        className="logout-button"
        onClick={handleLogout}
      >
        Logout
      </button>

    </div>
  )
}

export default Profile