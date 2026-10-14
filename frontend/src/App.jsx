import { Route, Routes } from 'react-router-dom';
import { RequireAuth, RequireRole } from './components/guards/RouteGuards.jsx';
import WelcomePage from './pages/public/WelcomePage.jsx';
import HomePage from './pages/public/HomePage.jsx';
import CasesPage from './pages/public/CasesPage.jsx';
import CaseDetailPage from './pages/public/CaseDetailPage.jsx';
import SubmitReportPage from './pages/report/SubmitReportPage.jsx';
import ReportConfirmationPage from './pages/report/ReportConfirmationPage.jsx';
import TrackReportPage from './pages/public/TrackReportPage.jsx';
import SafetyPage from './pages/public/SafetyPage.jsx';
import LoginPage from './pages/public/LoginPage.jsx';
import RegisterPage from './pages/public/RegisterPage.jsx';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage.jsx';
import ResetPasswordPage from './pages/auth/ResetPasswordPage.jsx';
import VerifyEmailPage from './pages/auth/VerifyEmailPage.jsx';
import MyReportsPage from './pages/report/MyReportsPage.jsx';
import DashboardPage from './pages/staff/DashboardPage.jsx';
import ReportsPage from './pages/staff/ReportsPage.jsx';
import StaffReportDetailPage from './pages/staff/StaffReportDetailPage.jsx';
import StaffCasesPage from './pages/staff/CasesPage.jsx';
import StaffCaseDetailPage from './pages/staff/StaffCaseDetailPage.jsx';
import MatchesPage from './pages/staff/MatchesPage.jsx';
import MatchDetailPage from './pages/staff/MatchDetailPage.jsx';
import UsersPage from './pages/staff/admin/UsersPage.jsx';
import OfficersPage from './pages/staff/admin/OfficersPage.jsx';
import NotFoundPage from './pages/public/NotFoundPage.jsx';

function App() {
  return (
    <Routes>
      <Route path="/" element={<WelcomePage />} />
      <Route path="/home" element={<HomePage />} />
      <Route path="/cases" element={<CasesPage />} />
      <Route path="/cases/:caseId" element={<CaseDetailPage />} />
      <Route path="/report/new" element={<RequireAuth><SubmitReportPage /></RequireAuth>} />
      <Route path="/report/confirmation/:referenceNo" element={<ReportConfirmationPage />} />
      <Route path="/track" element={<TrackReportPage />} />
      <Route path="/safety" element={<SafetyPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/my-reports" element={<RequireAuth><MyReportsPage /></RequireAuth>} />

      <Route path="/staff" element={<RequireRole allowedRoles={['officer', 'admin']}><DashboardPage /></RequireRole>} />
      <Route path="/staff/reports" element={<RequireRole allowedRoles={['officer', 'admin']}><ReportsPage /></RequireRole>} />
      <Route path="/staff/reports/:reportId" element={<RequireRole allowedRoles={['officer', 'admin']}><StaffReportDetailPage /></RequireRole>} />
      <Route path="/staff/cases" element={<RequireRole allowedRoles={['officer', 'admin']}><StaffCasesPage /></RequireRole>} />
      <Route path="/staff/cases/:caseId" element={<RequireRole allowedRoles={['officer', 'admin']}><StaffCaseDetailPage /></RequireRole>} />
      <Route path="/staff/matches" element={<RequireRole allowedRoles={['officer', 'admin']}><MatchesPage /></RequireRole>} />
      <Route path="/staff/matches/:matchId" element={<RequireRole allowedRoles={['officer', 'admin']}><MatchDetailPage /></RequireRole>} />
      <Route path="/staff/admin/users" element={<RequireRole allowedRoles={['admin']}><UsersPage /></RequireRole>} />
      <Route path="/staff/admin/officers" element={<RequireRole allowedRoles={['admin']}><OfficersPage /></RequireRole>} />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;
