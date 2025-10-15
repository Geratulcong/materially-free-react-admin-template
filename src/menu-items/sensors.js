// assets
import { Dashboard, NotificationImportant } from '@mui/icons-material';

// icons
const icons = {
  Dashboard,
  NotificationImportant
};

// ==============================|| MENU ITEMS - SENSORS ||============================== //

const sensors = {
  id: 'sensors',
  title: 'Sensores',
  type: 'group',
  children: [
    {
      id: 'sensor-dashboard',
      title: 'Monitor BLE Sense 33',
      type: 'item',
      url: '/sensors/dashboard',
      icon: icons.Dashboard,
      breadcrumbs: false
    },
    {
      id: 'fall-alerts',
      title: 'Alertas de Caída',
      type: 'item',
      url: '/sensors/fall-alerts',
      icon: icons.NotificationImportant,
      breadcrumbs: false
    }
  ]
};

export default sensors;