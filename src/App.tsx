import { createHashRouter, RouterProvider } from 'react-router'
import { Layout } from './ui/layout'
import { Overview } from './pages/Overview'
import { Agenda } from './pages/Agenda'
import { Employees } from './pages/Employees'
import { EmployeeDetail } from './pages/EmployeeDetail'
import { Sessions } from './pages/Sessions'
import { DataQuality } from './pages/DataQuality'

const router = createHashRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Agenda /> },
      { path: '/overview', element: <Overview /> },
      { path: '/employees', element: <Employees /> },
      { path: '/employees/:id', element: <EmployeeDetail /> },
      { path: '/sessions', element: <Sessions /> },
      { path: '/data-quality', element: <DataQuality /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
