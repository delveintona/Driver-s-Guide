import { Route, Routes } from 'react-router-dom'
import Home from './pages/Home'
import VehicleHub from './pages/VehicleHub'
import Cab from './pages/Cab'
import View from './pages/View'
import Compare from './pages/Compare'
import Spec from './pages/Spec'
import Tips from './pages/Tips'
import Sources from './pages/Sources'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/v/:id" element={<VehicleHub />} />
      <Route path="/v/:id/cab" element={<Cab />} />
      <Route path="/v/:id/exam" element={<Cab exam />} />
      <Route path="/v/:id/road" element={<Cab road />} />
      <Route path="/v/:id/view/:mode" element={<View />} />
      <Route path="/v/:id/compare" element={<Compare />} />
      <Route path="/v/:id/spec" element={<Spec />} />
      <Route path="/v/:id/tips" element={<Tips />} />
      <Route path="/sources" element={<Sources />} />
      <Route path="*" element={<Home />} />
    </Routes>
  )
}
