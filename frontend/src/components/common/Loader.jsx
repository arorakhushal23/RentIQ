import './Loader.css'

function Loader({ message = 'Loading...' }) {
    return (
        <div className="loader-container">
            <div className="loader-spinner"></div>
            <p>{message}</p>
        </div>
    )
}

export default Loader