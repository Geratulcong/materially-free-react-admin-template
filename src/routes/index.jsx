import { createBrowserRouter } from 'react-router-dom';

// routes
import MainRoutes from './MainRoutes';
import PagesRoutes from './PagesRoutes';
import SensorRoutes from './SensorRoutes';

// ==============================|| ROUTING RENDER ||============================== //

const router = createBrowserRouter([MainRoutes, PagesRoutes, SensorRoutes], {
  basename: import.meta.env.VITE_APP_BASE_URL
});

export default router;
