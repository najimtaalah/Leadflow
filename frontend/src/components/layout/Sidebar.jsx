import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import useAuthStore from '../../store/authStore';

// ── Composants navigation ─────────────────────────────────────────────────────

function NavGroup({ icon, label, children, matchPrefix = '' }) {
  const location = useLocation();
  const isActive = matchPrefix && location.pathname.startsWith(matchPrefix);
  const [open, setOpen] = useState(isActive);

  useEffect(() => {
    if (isActive) setOpen(true);
  }, [isActive]);

  return (
    <div className="nav-group">
      <div
        className={`nav-group-header${open ? ' open' : ''}`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="nav-icon">{icon}</span>
        {label}
        <span className="nav-group-arrow">▶</span>
      </div>
      <div className="nav-group-body" style={{ maxHeight: open ? '600px' : '0' }}>
        {children}
      </div>
    </div>
  );
}

function NavItem({ to, children }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
    >
      {children}
    </NavLink>
  );
}

function NavDirect({ to, icon, children }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `nav-direct${isActive ? ' active' : ''}`}
    >
      <span className="nav-icon">{icon}</span>
      {children}
    </NavLink>
  );
}

// ── Rôles ─────────────────────────────────────────────────────────────────────

const ROLE_LABELS = {
  super_admin:        'Super Admin',
  role_admin:         'Administrateur',
  role_administratif: 'Gestionnaire',
  commercial:         'Commercial',
  manager:            'Manager',
  agent_accueil:      "Agent d'accueil",
};

// ── Sidebar ───────────────────────────────────────────────────────────────────

export default function Sidebar() {
  const { user, logout } = useAuthStore();
  const navigate         = useNavigate();

  const role = user?.role || user?.role_nom || '';

  const isAdmin         = ['super_admin', 'role_admin'].includes(role);
  const isCommercial    = role === 'commercial';
  const isManager       = role === 'manager';
  const isAdministratif = role === 'role_administratif';
  const isAgentAccueil  = role === 'agent_accueil';

  const initials = user
    ? `${(user.prenom || '')[0] || ''}${(user.nom || '')[0] || ''}`.toUpperCase()
    : '?';
  const fullName = user ? `${user.prenom || ''} ${user.nom || ''}`.trim() : '—';
  const roleName = ROLE_LABELS[role] || role || '—';

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <aside className="sidebar">

      {/* ── Logo ── */}
      <div className="sidebar-logo">
        <div className="logo-icon">L</div>
        <span className="logo-name">LeadFlow</span>
        <span className="logo-version">v1.0</span>
      </div>

      {/* ── Navigation scrollable ── */}
      <div className="sidebar-nav">

        {/* ═══════════════════════════════
            AGENT D'ACCUEIL
        ═══════════════════════════════ */}
        {isAgentAccueil && (
          <>
            <span className="nav-section">Accueil</span>
            <NavDirect to="/accueil" icon="📋">Leads</NavDirect>
          </>
        )}

        {/* ═══════════════════════════════
            COMMERCIAL / MANAGER
        ═══════════════════════════════ */}
        {(isCommercial || isManager) && (
          <>
            <span className="nav-section">Mon espace</span>
            <NavDirect to="/mes-leads"   icon="👥">Mes Leads</NavDirect>
            <NavDirect to="/commissions" icon="🏆">Commissions</NavDirect>
            <NavDirect to="/agenda"      icon="📅">Agenda</NavDirect>
          </>
        )}

        {/* ═══════════════════════════════
            ADMINISTRATIF — tout sauf Finance
        ═══════════════════════════════ */}
        {isAdministratif && (
          <>
            <span className="nav-section">Principal</span>
            <NavDirect to="/dashboard" icon="📊">Tableau de bord</NavDirect>

            <span className="nav-section">Commercial</span>
            <NavDirect to="/leads"     icon="👥">Leads</NavDirect>

            <span className="nav-section">Administratif</span>
            <NavDirect to="/dossiers"  icon="📁">Dossiers</NavDirect>

            <span className="nav-section">Gestion</span>
            <NavDirect to="/taches"    icon="✅">Tâches CMA</NavDirect>
            <NavDirect to="/agenda"    icon="📅">Agenda</NavDirect>
            <NavDirect to="/reporting" icon="📈">Reporting</NavDirect>
            <NavDirect to="/agent"     icon="🤖">Agent IA</NavDirect>
          </>
        )}

        {/* ═══════════════════════════════
            ADMIN / SUPER_ADMIN — accès total
        ═══════════════════════════════ */}
        {isAdmin && (
          <>
            <span className="nav-section">Principal</span>
            <NavDirect to="/dashboard"   icon="📊">Tableau de bord</NavDirect>

            <span className="nav-section">Commercial</span>
            <NavDirect to="/leads"       icon="👥">Leads</NavDirect>

            <span className="nav-section">Administratif</span>
            <NavDirect to="/dossiers"    icon="📁">Dossiers</NavDirect>

            <span className="nav-section">Gestion</span>
            <NavDirect to="/taches"       icon="✅">Tâches CMA</NavDirect>
            <NavDirect to="/finance"      icon="💰">Finance</NavDirect>
            <NavDirect to="/facturation"  icon="🧾">Facturation</NavDirect>
            <NavDirect to="/agenda"       icon="📅">Agenda</NavDirect>
            <NavDirect to="/reporting"   icon="📈">Reporting</NavDirect>
            <NavDirect to="/commissions" icon="🏆">Commissions</NavDirect>
            <NavDirect to="/agent"       icon="🤖">Agent IA</NavDirect>

            <span className="nav-section">Configuration</span>
            <NavGroup icon="⚙️" label="Paramétrage" matchPrefix="/parametrage">
              <NavItem to="/parametrage/utilisateurs">👤 Utilisateurs</NavItem>
              <NavItem to="/parametrage/agences">🏢 Agences</NavItem>
              <NavItem to="/parametrage/formations">📚 Formations</NavItem>
              <NavItem to="/parametrage/sessions">📅 Sessions</NavItem>
              <NavItem to="/parametrage/imports">📥 Imports</NavItem>
            </NavGroup>
          </>
        )}

      </div>

      {/* ── Footer fixe en bas ── */}
      <div className="sidebar-footer">
        <div className="nav-user" onClick={() => navigate('/profil')} title="Mon profil">
          <div className="avatar" id="sidebar-avatar">{initials}</div>
          <div>
            <div className="user-name" id="sidebar-user-name">{fullName}</div>
            <div className="user-role">{roleName}</div>
          </div>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--nav-txt)' }}>✏️</span>
        </div>
        <div
          className="nav-direct"
          style={{ color: 'var(--red)', margin: '0 8px 8px', cursor: 'pointer' }}
          onClick={handleLogout}
        >
          <span className="nav-icon">🚪</span>
          Déconnexion
        </div>
      </div>

    </aside>
  );
}
