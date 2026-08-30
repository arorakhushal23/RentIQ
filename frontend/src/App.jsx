import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing'
import Navbar from './components/Navbar'
import Login from './pages/Login'
import Register from './pages/Register'
import Vehicles from './pages/Vehicles'
import VehicleDetails from './pages/VehicleDetails'

import './App.css'

function App() {
  return (
    <BrowserRouter>

      <Navbar />

      <Routes>

        <Route path="/" element={<Landing />} />

        <Route
          path="/vehicles"
          element={<Vehicles />}
        />

        <Route
          path="/vehicles/:id"
          element={<VehicleDetails />}
        />

        <Route
          path="/login"
          element={<Login />}
        />

        <Route
          path="/register"
          element={<Register />}
        />

      </Routes>

    </BrowserRouter>
  )
}

export default App