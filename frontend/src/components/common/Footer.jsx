import { Link } from 'react-router-dom'
import './Footer.css'

function Footer() {
    return (
        <footer className="footer">

            <div className="footer-container">

                <div className="footer-brand">
                    <Link to="/" className="footer-logo">
                        Rent<span>IQ</span>
                    </Link>

                    <p>
                        A smarter way to find, compare, and rent
                        vehicles for your journey.
                    </p>
                </div>

                <div className="footer-links">
                    <h3>Quick Links</h3>

                    <Link to="/">Home</Link>
                    <Link to="/vehicles">Vehicles</Link>
                    <Link to="/contact">Contact</Link>
                </div>

                <div className="footer-links">
                    <h3>Account</h3>

                    <Link to="/login">Login</Link>
                    <Link to="/register">Register</Link>
                </div>

                <div className="footer-contact">
                    <h3>Contact</h3>

                    <p>support@rentiq.com</p>
                    <p>+91 98765 43210</p>
                    <p>Chandigarh, India</p>
                </div>

            </div>

            <div className="footer-bottom">
                <p>
                    © {new Date().getFullYear()} RentIQ. All rights reserved.
                </p>
            </div>

        </footer>
    )
}

export default Footer