import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "./pages/home/Landing";
import Navbar from "./components/common/Navbar";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import Vehicles from "./pages/vehicles/Vehicles";
import VehicleDetails from "./pages/vehicles/VehicleDetails";
import Profile from "./pages/profile/Profile";
import Contact from './pages/contact/Contact';
import Footer from './components/common/Footer';
import AdminRoute from './components/common/AdminRoute';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminVehicles from './pages/admin/AdminVehicles';
import "./App.css";
import AdminBookings from './pages/admin/AdminBookings';
function App() {
  return (
    <BrowserRouter>
      <Navbar />

      <Routes>
        <Route path="/" element={<Landing />} />

        <Route path="/vehicles" element={<Vehicles />} />

        <Route path="/vehicles/:id" element={<VehicleDetails />} />

        <Route path="/login" element={<Login />} />

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
      </Routes>

      <Footer />
    </BrowserRouter>
  );
}

export default App;
