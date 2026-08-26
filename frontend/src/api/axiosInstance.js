import axios from 'axios';

const axiosInstance = axios.create({
    baseURL: import.meta?.env?.VITE_API_URL || 'http://localhost:5000/api',
    headers: {
        'Content-Type': 'application/json'
    }
});

// Request interceptor: automatically attach Bearer token if present in localStorage
axiosInstance.interceptors.request.use(
    (config) => {
        if (typeof window !== 'undefined' && window.localStorage) {
            const token = localStorage.getItem('token');
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

export default axiosInstance;
