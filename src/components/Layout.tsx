import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

export default function Layout() {
  return (
    <div className="flex min-h-screen bg-nl-bg">
      <Sidebar />
      <div className="flex-1 flex flex-col ml-56">
        <Outlet />
      </div>
    </div>
  )
}
