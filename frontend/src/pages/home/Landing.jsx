import { Link } from 'react-router-dom'
import './Landing.css'

function Landing() {
    return (
        <main className="landing-page">

            {/* Hero Section */}
            <section className="landing-hero">

                <div className="hero-content">

                    <p className="hero-label">
                        RENTIQ VEHICLE RENTALS
                    </p>

                    <h1>
                        Find Your Perfect Ride.
                    </h1>

                    <p className="hero-description">
                        Choose from a wide range of cars, bikes, scooters,
                        and EVs. Find the right vehicle for your journey
                        and get moving.
                    </p>

                    <div className="hero-actions">
                        <Link to="/vehicles" className="primary-button">
                            Explore Vehicles
                        </Link>

                        <Link to="/register" className="secondary-button">
                            Create Account
                        </Link>
                    </div>

                </div>

            </section>


            {/* Why RentIQ Section */}
            <section className="why-section">

                <div className="section-heading">

                    <p className="section-label">
                        WHY RENTIQ
                    </p>

                    <h2>
                        Everything you need to get moving.
                    </h2>

                    <p>
                        A simple rental experience designed around
                        finding, comparing, and booking your vehicle.
                    </p>

                </div>


                <div className="feature-grid">

                    <article className="feature-card">

                        <div className="feature-icon">
                            🚗
                        </div>

                        <h3>
                            Wide Selection
                        </h3>

                        <p>
                            Choose from cars, bikes, scooters and
                            electric vehicles.
                        </p>

                    </article>


                    <article className="feature-card">

                        <div className="feature-icon">
                            🔍
                        </div>

                        <h3>
                            Find What Fits
                        </h3>

                        <p>
                            Search and filter vehicles based on your
                            requirements and budget.
                        </p>

                    </article>


                    <article className="feature-card">

                        <div className="feature-icon">
                            ⚡
                        </div>

                        <h3>
                            Simple Experience
                        </h3>

                        <p>
                            Find your vehicle and move from browsing
                            to booking with ease.
                        </p>

                    </article>

                </div>

            </section>


            {/* Call To Action */}
            <section className="landing-cta">

                <div>

                    <p className="section-label">
                        READY TO GO?
                    </p>

                    <h2>
                        Your next journey starts here.
                    </h2>

                    <p>
                        Explore our vehicles and find the one that's
                        right for you.
                    </p>

                    <Link to="/vehicles" className="primary-button">
                        Browse Vehicles
                    </Link>

                </div>

            </section>

        </main>
    )
}

export default Landing