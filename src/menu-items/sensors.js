// assets
import { DashboardOutlined } from '@ant-design/icons';

// icons
const icons = {
  DashboardOutlined
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
      icon: icons.DashboardOutlined,
      breadcrumbs: false
    },
    {
      id: 'fall-alerts',
      title: 'Alertas de Caída',
      type: 'item',
      url: '/sensors/fall-alerts',
      icon: icons.DashboardOutlined,
      breadcrumbs: false
    }
  ]
};

export default sensors;