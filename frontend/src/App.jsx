import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Landing from "./pages/home/Landing";
import Navbar from "./components/common/Navbar";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";
import Vehicles from "./pages/vehicles/Vehicles";
import VehicleDetails from "./pages/vehicles/VehicleDetails";
import Profile from "./pages/profile/Profile";
import Wishlist from "./pages/wishlist/Wishlist";
import Compare from "./pages/compare/Compare";
import Contact from './pages/contact/Contact';
import Footer from './components/common/Footer';
import FloatingCompareBar from './components/vehicle/FloatingCompareBar';
import AdminRoute from './components/common/AdminRoute';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminVehicles from './pages/admin/AdminVehicles';
import AdminBookings from './pages/admin/AdminBookings';
import AdminLicenses from './pages/admin/AdminLicenses';
import AdminLocations from './pages/admin/AdminLocations';
import AdminInspections from './pages/admin/AdminInspections';
import AdminAgreements from './pages/admin/AdminAgreements';
import AdminMaintenance from './pages/admin/AdminMaintenance';
import AdminPricing from './pages/admin/AdminPricing';
import ScrollToTop from './components/common/ScrollToTop';
import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Navbar />

      <Routes>
        <Route path="/" element={<Landing />} />

        <Route path="/vehicles" element={<Vehicles />} />

        <Route path="/vehicles/:id" element={<VehicleDetails />} />

        <Route path="/wishlist" element={<Wishlist />} />

        <Route path="/compare" element={<Compare />} />

        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route
          path="/admin/login"
          element={<Navigate to="/login" state={{ from: { pathname: '/admin' } }} replace />}
        />

        <Route path="/register" element={<Register />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/contact" element={<Contact />} />

        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminDashboard />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/vehicles"
          element={
            <AdminRoute>
              <AdminVehicles />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/bookings"
          element={
            <AdminRoute>
              <AdminBookings />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/licenses"
          element={
            <AdminRoute>
              <AdminLicenses />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/locations"
          element={
            <AdminRoute>
              <AdminLocations />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/inspections"
          element={
            <AdminRoute>
              <AdminInspections />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/agreements"
          element={
            <AdminRoute>
              <AdminAgreements />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/maintenance"
          element={
            <AdminRoute>
              <AdminMaintenance />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/pricing"
          element={
            <AdminRoute>
              <AdminPricing />
            </AdminRoute>
          }
        />
      </Routes>

      <FloatingCompareBar />
      <Footer />
    </BrowserRouter>
  );
}

export default App;
