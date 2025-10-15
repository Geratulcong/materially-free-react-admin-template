import { lazy } from 'react';

// project import
import Loadable from '../components/Loadable';
import MainLayout from '../layouts/MainLayout';

// render - sensor dashboard
const SensorDashboard = Loadable(lazy(() => import('../views/sensors/SensorDashboard')));
const FallAlertDashboard = Loadable(lazy(() => import('../views/sensors/FallAlertDashboard')));

// ==============================|| SENSOR ROUTES ||============================== //

const SensorRoutes = {
  path: '/',
  element: <MainLayout />,
  children: [
    {
      path: 'sensors',
      children: [
        {
          path: 'dashboard',
          element: <SensorDashboard />
        },
        {
          path: 'fall-alerts',
          element: <FallAlertDashboard />
        }
      ]
    }
  ]
};

export default SensorRoutes;