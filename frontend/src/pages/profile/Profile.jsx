import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import axiosInstance from '../../api/axiosInstance'
import './Profile.css'
import vehicleImages from '../../utils/vehicleImages'

function Profile() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const response = await axiosInstance.get(
          '/bookings/my-bookings'
        )

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

  return (
    <div className="profile-page">

      {/* Header */}

      <div className="profile-header">
        <div>
          <h1>
            Hello, {user?.name}
          </h1>

          <p>
            Manage your profile, view your bookings,
            and keep track of your journeys.
          </p>
        </div>
      </div>


      {/* Dashboard cards */}

      <div className="profile-dashboard">

        {/* Personal Information */}

        <section className="profile-card personal-card">

          <div className="card-header">
            <h2>Personal Information</h2>

            <button className="edit-button">
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
                <strong>
                  {user?.role}
                </strong>
              </div>

            </div>

          </div>

        </section>


        {/* Booking Statistics */}

        <section className="profile-card stats-card">

          <div className="stat">

            <span>Total Bookings</span>

            <strong>
              {bookings.length}
            </strong>

          </div>

          <div className="stat">

            <span>Upcoming Trips</span>

            <strong>
              {
                bookings.filter(
                  booking =>
                    booking.status === 'pending'
                ).length
              }
            </strong>

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

            <p>
              Keep track of your vehicle rentals.
            </p>
          </div>

        </div>


        {loading && (
          <p>Loading bookings...</p>
        )}

        {error && (
          <p className="profile-error">
            {error}
          </p>
        )}

        {!loading &&
          !error &&
          bookings.length === 0 && (
            <p>No rental history yet.</p>
          )}


        {!loading &&
          !error &&
          bookings.length > 0 && (

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

                      <h3>
                        {booking.vehicle_name}
                      </h3>

                      <span
                        className={`booking-status ${booking.status}`}
                      >
                        {booking.status}
                      </span>

                    </div>


                    <p>
                      📅{' '}
                      {new Date(
                        booking.start_date
                      ).toLocaleDateString('en-IN')}
                      {' → '}
                      {new Date(
                        booking.end_date
                      ).toLocaleDateString('en-IN')}
                    </p>

                  </div>


                  <div className="booking-price">

                    <span>Total</span>

                    <strong>
                      ₹
                      {Number(
                        booking.total_price
                      ).toLocaleString('en-IN')}
                    </strong>

                  </div>


                  <div className="booking-id">

                    <span>Booking ID</span>

                    <strong>
                      #{booking.booking_id}
                    </strong>

                  </div>


                  <button className="details-button">
                    View Details
                  </button>

                </div>

              ))}

            </div>

          )}

      </section>


      {/* Logout */}

      <button
        className="logout-button"
        onClick={handleLogout}
      >
        Logout
      </button>

    </div>
  )
}

export default Profile