import { HashRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AppShell } from '@shared/components/AppShell';
import { ToastProvider } from '@shared/components/Toast';
import { AuthProvider, useAuth } from './auth';
import { adminNav } from './nav';
import { ForgotPasswordPage, LoginPage } from './pages/LoginPage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { BrandsPage, ProductsPage } from './pages/CatalogPages';
import { CustomerDetailPage } from './pages/CustomerDetailPage';
import { CustomersPage } from './pages/CustomersPage';
import { DealersPage } from './pages/DealersPage';
import { GcpUsagePage } from './pages/GcpUsagePage';
import { GwsSubscriptionsPage } from './pages/GwsSubscriptionsPage';
import { HomePage } from './pages/HomePage';
import { NewCustomerPage } from './pages/NewCustomerPage';
import { PlaceholderPage } from './pages/PlaceholderPage';
import { RolesPage } from './pages/RolesPage';
import { SchedulesPage } from './pages/SchedulesPage';
import { UsersPage } from './pages/UsersPage';
import { WorkOrderDetailPage } from './pages/WorkOrderDetailPage';
import { WorkOrderFormPage } from './pages/WorkOrderFormPage';
import { WorkOrdersPage } from './pages/WorkOrdersPage';

// 用 HashRouter：部署成靜態網站（GitHub Pages 等）時，直接開任何網址都不會 404
export function App() {
  return (
    <HashRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginRoute />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="*" element={<Protected />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </HashRouter>
  );
}

/** 已登入時開登入頁，直接回首頁 */
function LoginRoute() {
  const { session } = useAuth();
  return session ? <Navigate to="/" replace /> : <LoginPage />;
}

/** 沒登入時導到登入頁，登入後回到原本要開的頁面 */
function Protected() {
  const { session, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  if (!session) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  return (
    <AppShell
      siteName="零壹雲管家"
      siteSubtitle="Zerone Cloud · 管理端"
      nav={adminNav}
      user={{ name: session.name, role: session.role, email: session.email }}
      onLogout={async () => {
        await logout();
        navigate('/login', { replace: true });
      }}
    >
      <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/customers/new" element={<NewCustomerPage key="new" />} />
            <Route path="/customers/transfer-in" element={<NewCustomerPage key="transfer" mode="transfer" />} />
            <Route path="/customers/:id" element={<CustomerDetailPage />} />
            <Route path="/dealers" element={<DealersPage />} />
            <Route path="/work-orders" element={<WorkOrdersPage />} />
            <Route path="/work-orders/new" element={<WorkOrderFormPage key="new" />} />
            <Route path="/work-orders/:id" element={<WorkOrderDetailPage />} />
            <Route path="/work-orders/:id/edit" element={<WorkOrderFormPage key="edit" />} />
            <Route path="/brands" element={<BrandsPage />} />
            <Route path="/catalog" element={<ProductsPage />} />
            <Route path="/products/gws" element={<GwsSubscriptionsPage />} />
            <Route path="/products/gcp" element={<GcpUsagePage />} />
            <Route path="/schedules/gws" element={<SchedulesPage />} />
            <Route path="/system/users" element={<UsersPage />} />
            <Route path="/system/roles" element={<RolesPage />} />
            <Route path="/system/logs" element={<AuditLogsPage />} />
            <Route path="*" element={<PlaceholderPage title="找不到頁面" />} />
      </Routes>
    </AppShell>
  );
}
