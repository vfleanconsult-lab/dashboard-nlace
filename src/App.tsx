import { Routes, Route, Navigate } from 'react-router-dom'
import { FilterProvider } from './lib/FilterContext'
import Layout from './components/Layout'
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
import ActualizarDatos from './pages/ActualizarDatos'

export default function App() {
  return (
    <FilterProvider>
      <Routes>
        <Route element={<Layout />}>
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </FilterProvider>
  )
}
