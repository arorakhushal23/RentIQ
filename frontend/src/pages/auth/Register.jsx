
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ShieldCheck, Car, Headphones } from 'lucide-react'
import axiosInstance from '../../api/axiosInstance'
import { useAuth } from '../../context/AuthContext'
import { InputField, FormError } from '../../components/common/form'
import './Register.css'

function Register() {
    const navigate = useNavigate()
    const { login } = useAuth()

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

            const { token, user } = response.data

            if (!token || !user) {
                throw new Error(
                    'Registration succeeded, but authentication data was not returned.'
                )
            }

            // Update localStorage and shared React authentication state.
            // This allows the Navbar to update immediately.
            login(user, token)

            navigate('/')
        } catch (error) {
            console.error(
                'Registration failed:',
                error
            )

            setError(
                error.response?.data?.message ||
                error.message ||
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

                <form onSubmit={handleSubmit} noValidate>

                    <InputField
                        label="Full Name"
                        id="name"
                        name="name"
                        type="text"
                        placeholder="Enter your full name"
                        value={formData.name}
                        onChange={handleChange}
                        required
                        autoComplete="name"
                    />

                    <InputField
                        label="Email Address"
                        id="email"
                        name="email"
                        type="email"
                        placeholder="Enter your email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                        autoComplete="email"
                    />

                    <InputField
                        label="Password"
                        id="password"
                        name="password"
                        type="password"
                        placeholder="Enter your password (min. 6 characters)"
                        value={formData.password}
                        onChange={handleChange}
                        required
                        autoComplete="new-password"
                    />

                    <InputField
                        label="Confirm Password"
                        id="confirmPassword"
                        name="confirmPassword"
                        type="password"
                        placeholder="Confirm your password"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        required
                        autoComplete="new-password"
                    />

                    {error && (
                        <div style={{ marginBottom: '16px' }}>
                            <FormError message={error} />
                        </div>
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
                        <div className="feature-icon" aria-hidden="true">
                            <ShieldCheck size={20} strokeWidth={2} />
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
                        <div className="feature-icon" aria-hidden="true">
                            <Car size={20} strokeWidth={2} />
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
                        <div className="feature-icon" aria-hidden="true">
                            <Headphones size={20} strokeWidth={2} />
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

