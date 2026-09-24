import { useState } from 'react'
import axiosInstance from '../../api/axiosInstance'
import './Contact.css'

function Contact() {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        subject: '',
        message: '',
    })

    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [loading, setLoading] = useState(false)

    const handleChange = (event) => {
        const { name, value } = event.target

        setFormData({
            ...formData,
            [name]: value,
        })

        setError('')
        setSuccess('')
    }

    const handleSubmit = async (event) => {
        event.preventDefault()

        const {
            name,
            email,
            subject,
            message,
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
            setError('Please enter a valid email address.')
            return
        }

        if (!subject.trim()) {
            setError('Please enter a subject.')
            return
        }

        if (!message.trim()) {
            setError('Please enter your message.')
            return
        }

        setError('')
        setSuccess('')
        setLoading(true)

        try {
            const response = await axiosInstance.post(
                '/contact',
                {
                    name: name.trim(),
                    email: email.trim(),
                    subject: subject.trim(),
                    message: message.trim(),
                }
            )

            setSuccess(
                response.data.message ||
                'Message sent successfully.'
            )

            setFormData({
                name: '',
                email: '',
                subject: '',
                message: '',
            })
        } catch (error) {
            console.error(
                'Contact form error:',
                error
            )

            setError(
                error.response?.data?.message ||
                'Unable to send message. Please try again.'
            )
        } finally {
            setLoading(false)
        }
    }

    return (
        <main className="contact-page">

            <section className="contact-header">
                <p className="section-label">
                    CONTACT RENTIQ
                </p>

                <h1>
                    We’re here to help.
                </h1>

                <p>
                    Have a question about a vehicle, booking, or your
                    rental experience? Get in touch with us.
                </p>
            </section>

            <section className="contact-content">

                <div className="contact-info">
                    <h2>
                        Get in touch
                    </h2>

                    <p>
                        Our team is available to help you with your
                        rental journey.
                    </p>

                    <div className="contact-item">
                        <span>📧</span>
                        <div>
                            <h3>Email</h3>
                            <p>support@rentiq.com</p>
                        </div>
                    </div>

                    <div className="contact-item">
                        <span>📞</span>
                        <div>
                            <h3>Phone</h3>
                            <p>+91 98765 43210</p>
                        </div>
                    </div>

                    <div className="contact-item">
                        <span>📍</span>
                        <div>
                            <h3>Location</h3>
                            <p>Chandigarh, India</p>
                        </div>
                    </div>
                </div>

                <div className="contact-form-container">

                    <h2>
                        Send us a message
                    </h2>

                    {error && (
                        <p className="contact-error">
                            {error}
                        </p>
                    )}

                    {success && (
                        <p className="contact-success">
                            {success}
                        </p>
                    )}

                    <form
                        className="contact-form"
                        onSubmit={handleSubmit}
                    >

                        <div className="form-row">

                            <div className="form-group">
                                <label htmlFor="name">
                                    Name
                                </label>

                                <input
                                    type="text"
                                    id="name"
                                    name="name"
                                    placeholder="Enter your name"
                                    value={formData.name}
                                    onChange={handleChange}
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="email">
                                    Email
                                </label>

                                <input
                                    type="email"
                                    id="email"
                                    name="email"
                                    placeholder="Enter your email"
                                    value={formData.email}
                                    onChange={handleChange}
                                />
                            </div>

                        </div>

                        <div className="form-group">
                            <label htmlFor="subject">
                                Subject
                            </label>

                            <input
                                type="text"
                                id="subject"
                                name="subject"
                                placeholder="What is your message about?"
                                value={formData.subject}
                                onChange={handleChange}
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="message">
                                Message
                            </label>

                            <textarea
                                id="message"
                                name="message"
                                rows="6"
                                placeholder="Write your message..."
                                value={formData.message}
                                onChange={handleChange}
                            />
                        </div>

                        <button
                            type="submit"
                            className="contact-submit"
                            disabled={loading}
                        >
                            {loading
                                ? 'Sending...'
                                : 'Send Message'}
                        </button>

                    </form>

                </div>

            </section>

        </main>
    )
}

export default Contact