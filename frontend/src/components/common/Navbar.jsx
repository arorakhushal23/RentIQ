import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import './Navbar.css'
import rentiqLogo from '../../assets/logo/rentiq-logo.png'

function Navbar() {
    const { isLoggedIn } = useAuth()

    return (
        <nav className="navbar">
            <div className="navbar-container">

                {/* Logo */}
                <Link to="/" className="navbar-logo">
                    <img
                        src={rentiqLogo}
                        alt="RentIQ"
                    />
                </Link>

                {/* Navigation */}
                <div className="navbar-links">

                    <Link to="/">
                        Home
                    </Link>

                    <Link to="/vehicles">
                        Vehicles
                    </Link>

                    {!isLoggedIn ? (
                        <>
                            <Link to="/login">
                                Login
                            </Link>

                            <Link
                                to="/register"
                                className="navbar-register"
                            >
                                Register
                            </Link>
                        </>
                    ) : (
                        <Link
                            to="/profile"
                            className="navbar-profile"
                            aria-label="Profile"
                        >
                            <span>👤</span>
                        </Link>
                    )}

                </div>

            </div>
        </nav>
    )
}

export default Navbar