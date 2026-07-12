import { NavLink, useLocation } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import './Sidebar.css';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: '📊' }
];

export default function Sidebar() {
  const { state, dispatch } = useAppContext();
  const location = useLocation();

  return (
    <aside className={`sidebar ${state.sidebarCollapsed ? 'sidebar--collapsed' : ''} ${state.mobileSidebarOpen ? 'sidebar--mobile-open' : ''}`}>
      <div className="sidebar__header">
        <div className="sidebar__logo">
          <span className="sidebar__logo-icon">🔍</span>
          <span className="sidebar__logo-text">IncidentIQ</span>
        </div>
        <button
          className="sidebar__toggle"
          onClick={() => {
            if (state.mobileSidebarOpen) {
              dispatch({ type: 'TOGGLE_MOBILE_SIDEBAR' });
            } else {
              dispatch({ type: 'TOGGLE_SIDEBAR' });
            }
          }}
          title={state.sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {state.sidebarCollapsed ? '☰' : '←'}
        </button>
      </div>

      <nav className="sidebar__nav">
        {navItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`
            }
            title={item.label}
            onClick={() => state.mobileSidebarOpen && dispatch({ type: 'TOGGLE_MOBILE_SIDEBAR' })}
          >
            <span className="sidebar__link-icon">{item.icon}</span>
            <span className="sidebar__link-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar__footer">
        <div className="sidebar__incidents-header">Recent Incidents</div>
        {state.incidents.slice(0, 4).map(inc => (
          <NavLink
            key={inc.id}
            to={`/incidents/${inc.incidentId}`}
            className="sidebar__incident-link"
          >
            <span className={`sidebar__severity sidebar__severity--${inc.severity.toLowerCase()}`}>
              {inc.severity}
            </span>
            <span className="sidebar__incident-title">{inc.title}</span>
          </NavLink>
        ))}
      </div>
    </aside>
  );
}
