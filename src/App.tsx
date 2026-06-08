import { Routes, Route, Navigate } from 'react-router-dom'
import { FilterProvider } from './lib/FilterContext'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import Resumen from './pages/Resumen'
import Ingresos from './pages/Ingresos'
import Costos from './pages/Costos'
import Gastos from './pages/Gastos'
import Cobranzas from './pages/Cobranzas'
import EstadoResultado from './pages/EstadoResultado'
import Cashflow from './pages/Cashflow'
import Forecast from './pages/Forecast'
import ActualizarCostos from './pages/ActualizarCostos'
import ActualizarGastos from './pages/ActualizarGastos'
import ActualizarVentas from './pages/ActualizarVentas'
import ActualizarEstadoFacturas from './pages/ActualizarEstadoFacturas'
import ActualizarDatos from './pages/ActualizarDatos'
import IngresoManualPartidas from './pages/IngresoManualPartidas'

export default function App() {
  return (
    <Routes>
      <Route path="/login/*" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <FilterProvider>
              <Layout />
            </FilterProvider>
          </ProtectedRoute>
        }
      >
        <Route index element={<Resumen />} />
        <Route path="ingresos" element={<Ingresos />} />
        <Route path="costos" element={<Costos />} />
        <Route path="gastos" element={<Gastos />} />
        <Route path="cobranzas" element={<Cobranzas />} />
        <Route path="estado-resultado" element={<EstadoResultado />} />
        <Route path="cashflow" element={<Cashflow />} />
        <Route path="forecast" element={<Forecast />} />
        <Route path="actualizar" element={<ActualizarDatos />} />
        <Route path="actualizar-costos" element={<ActualizarCostos />} />
        <Route path="actualizar-gastos" element={<ActualizarGastos />} />
        <Route path="actualizar-ventas" element={<ActualizarVentas />} />
        <Route path="actualizar-estado-facturas" element={<ActualizarEstadoFacturas />} />
        <Route path="ingreso-manual" element={<IngresoManualPartidas />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
