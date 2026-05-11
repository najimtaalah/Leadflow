import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore from './store/authStore';
import Layout from './components/layout/Layout';

// Pages communes
import Login      from './pages/Login';
import Dashboard  from './pages/Dashboard';
import Leads      from './pages/Leads';
import Dossiers   from './pages/Dossiers';
import Finance    from './pages/Finance';
import Agenda     from './pages/Agenda';
import Reporting  from './pages/Reporting';
import Commissions from './pages/Commissions';
import Agent      from './pages/Agent';
import Profil     from './pages/Profil';

// Pages par rôle
import MesLeads from './pages/MesLeads';   // commercial + manager
import Accueil  from './pages/Accueil';   // agent_accueil
import Taches   from './pages/Taches';    // workflow CMA
import Qualiopi from './pages/Qualiopi'; // module Qualiopi

// Paramétrage
import ParamUsers      from './pages/Parametrage/Users';
import ParamFormations from './pages/Parametrage/Formations';
import ParamSessions   from './pages/Parametrage/Sessions';
import ParamAgences    from './pages/Parametrage/Agences';
import ParamImports    from './pages/Parametrage/Imports';

// LMS T3P
import LmsLesson     from './pages/Lms/Lesson';
import LmsQuiz       from './pages/Lms/Quiz';
import LmsFlashcards from './pages/Lms/Flashcards';

// ── Redirect racine selon le rôle ─────────────────────────────────────────────

function HomeRedirect() {
  const { user } = useAuthStore();
  const role = user?.role || user?.role_nom || '';
  if (['commercial', 'manager'].includes(role)) return <Navigate to="/mes-leads" replace />;
  if (role === 'agent_accueil')                 return <Navigate to="/accueil"   replace />;
  return <Navigate to="/dashboard" replace />;
}

// ── Route protégée (authentification requise) ─────────────────────────────────

function PrivateRoute({ children }) {
  const token = useAuthStore((s) => s.token);
  return token ? children : <Navigate to="/login" replace />;
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          path="/"
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          {/* Redirect racine selon le rôle */}
          <Route index element={<HomeRedirect />} />

          {/* ── Pages admin / super_admin / role_admin ── */}
          <Route path="dashboard"  element={<Dashboard />} />
          <Route path="leads"      element={<Leads />} />
          <Route path="dossiers"   element={<Dossiers />} />
          <Route path="finance"    element={<Finance />} />
          <Route path="agenda"     element={<Agenda />} />
          <Route path="reporting"  element={<Reporting />} />
          <Route path="agent"      element={<Agent />} />
          <Route path="commissions" element={<Commissions />} />

          {/* ── Page commercial / manager ── */}
          <Route path="mes-leads" element={<MesLeads />} />

          {/* ── Page agent d'accueil ── */}
          <Route path="accueil" element={<Accueil />} />

          {/* ── Tâches CMA ── */}
          <Route path="taches" element={<Taches />} />

          {/* ── Module Qualiopi ── */}
          <Route path="qualiopi" element={<Qualiopi />} />

          {/* ── Paramétrage ── */}
          <Route path="parametrage/utilisateurs" element={<ParamUsers />} />
          <Route path="parametrage/formations"   element={<ParamFormations />} />
          <Route path="parametrage/sessions"     element={<ParamSessions />} />
          <Route path="parametrage/agences"      element={<ParamAgences />} />
          <Route path="parametrage/imports"      element={<ParamImports />} />

          {/* ── Profil (tous rôles) ── */}
          <Route path="profil" element={<Profil />} />
        </Route>

        {/* ── LMS T3P — écrans plein écran (hors Layout CRM) ── */}
        <Route
          path="/lms/lessons/:id"
          element={<PrivateRoute><LmsLesson /></PrivateRoute>}
        />
        <Route
          path="/lms/quiz/:id"
          element={<PrivateRoute><LmsQuiz /></PrivateRoute>}
        />
        <Route
          path="/lms/flashcards"
          element={<PrivateRoute><LmsFlashcards /></PrivateRoute>}
        />

        {/* Fallback — redirect vers HomeRedirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
