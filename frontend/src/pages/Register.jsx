import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axiosInstance from '../api/axiosInstance'
import './Register.css'

function Register() {
    const navigate = useNavigate()

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
    })

    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const handleChange = (event) => {
        const { name, value } = event.target

        setFormData({
            ...formData,
            [name]: value,
        })

        setError('')
    }

    const handleSubmit = async (event) => {
        event.preventDefault()

        const {
            name,
            email,
            password,
            confirmPassword,
        } = formData

        if (!name.trim()) {
            setError('Please enter your name.')
            return
        }

        if (!email.trim()) {
            setError('Please enter your email.')
            return
        }

        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

        if (!emailPattern.test(email)) {
            setError('Invalid email address.')
            return
        }

        if (!password) {
            setError('Please enter a password.')
            return
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters.')
            return
        }

        if (!confirmPassword) {
            setError('Please confirm your password.')
            return
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match.')
            return
        }

        setError('')
        setLoading(true)

        try {
            const response = await axiosInstance.post(
                '/auth/register',
                {
                    name: name.trim(),
                    email: email.trim(),
                    password,
                }
            )

            console.log(
                'Registration successful:',
                response.data
            )

            localStorage.setItem(
                'token',
                response.data.token
            )

            localStorage.setItem(
                'user',
                JSON.stringify(response.data.user)
            )

            navigate('/')
        } catch (error) {
            console.error(
                'Registration failed:',
                error
            )

            setError(
                error.response?.data?.message ||
                'Unable to register. Please try again.'
            )
        } finally {
            setLoading(false)
        }
    }

    return (
        <main className="register-page">
            <div className="register-card">

                <div className="register-header">
                    <div className="register-logo">
                        Rent<span>IQ</span>
                    </div>

                    <h1>Create Your Account</h1>

                    <p>
                        Join RentIQ and start renting with ease.
                    </p>
                </div>

                <form onSubmit={handleSubmit}>

                    <div className="form-group">
                        <label htmlFor="name">
                            Full Name
                        </label>

                        <input
                            id="name"
                            name="name"
                            type="text"
                            placeholder="Enter your full name"
                            value={formData.name}
                            onChange={handleChange}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="email">
                            Email
                        </label>

                        <input
                            id="email"
                            name="email"
                            type="text"
                            placeholder="Enter your email"
                            value={formData.email}
                            onChange={handleChange}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">
                            Password
                        </label>

                        <input
                            id="password"
                            name="password"
                            type="password"
                            placeholder="Enter your password"
                            value={formData.password}
                            onChange={handleChange}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="confirmPassword">
                            Confirm Password
                        </label>

                        <input
                            id="confirmPassword"
                            name="confirmPassword"
                            type="password"
                            placeholder="Confirm your password"
                            value={formData.confirmPassword}
                            onChange={handleChange}
                        />
                    </div>

                    {error && (
                        <p className="register-error">
                            {error}
                        </p>
                    )}

                    <button
                        type="submit"
                        className="register-button"
                        disabled={loading}
                    >
                        {loading
                            ? 'Creating Account...'
                            : 'Create Account'}

                        {!loading && (
                            <span>→</span>
                        )}
                    </button>
                </form>

                <div className="register-divider">
                    <span></span>
                    <p>OR</p>
                    <span></span>
                </div>

                <p className="login-link">
                    Already have an account?{' '}
                    <Link to="/login">
                        Login
                    </Link>
                </p>

                <div className="register-features">

                    <div className="register-feature">
                        <div className="feature-icon">
                            🛡
                        </div>

                        <div>
                            <strong>
                                Safe & Secure
                            </strong>

                            <span>
                                Your data is protected
                            </span>
                        </div>
                    </div>

                    <div className="register-feature">
                        <div className="feature-icon">
                            🚗
                        </div>

                        <div>
                            <strong>
                                Wide Selection
                            </strong>

                            <span>
                                Cars, bikes, SUVs & more
                            </span>
                        </div>
                    </div>

                    <div className="register-feature">
                        <div className="feature-icon">
                            ◉
                        </div>

                        <div>
                            <strong>
                                24/7 Support
                            </strong>

                            <span>
                                We're here to help
                            </span>
                        </div>
                    </div>

                </div>

            </div>
        </main>
    )
}

export default Register