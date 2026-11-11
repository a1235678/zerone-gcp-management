import { HashRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import type { ResourceKey } from '@data/types';
import { AppShell } from '@shared/components/AppShell';
import { ToastProvider } from '@shared/components/Toast';
import { AuthProvider, useAuth, usePermission } from './auth';
import { resourceOf, visibleNav } from './nav';
import { NoPermissionPage } from './pages/PlaceholderPage';
import { ForgotPasswordPage, LoginPage } from './pages/LoginPage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { BrandsPage, PlansPage, ProductsPage } from './pages/CatalogPages';
import { CustomerDetailPage } from './pages/CustomerDetailPage';
import { CustomersPage } from './pages/CustomersPage';
import { DealersPage } from './pages/DealersPage';
import { ExpiryNoticePage } from './pages/ExpiryNoticePage';
import { GcpBillDetailPage } from './pages/GcpBillDetailPage';
import { GcpBillingPage } from './pages/GcpBillingPage';
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
  const { can } = usePermission();
  const location = useLocation();
  const navigate = useNavigate();
  if (!session) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  return (
    <AppShell
      siteName="零壹雲管家"
      siteSubtitle="Zerone Cloud · 管理端"
      nav={visibleNav(can)}
      user={{ name: session.name, role: session.role, email: session.email }}
      onLogout={async () => {
        await logout();
        navigate('/login', { replace: true });
      }}
    >
      {pageAllowed(location.pathname, can) ? (
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
            <Route path="/plans" element={<PlansPage />} />
            <Route path="/products/gws" element={<GwsSubscriptionsPage />} />
            <Route path="/products/gcp" element={<GcpIndex />} />
            <Route path="/products/gcp/usage" element={<GcpUsagePage />} />
            <Route path="/products/gcp/billing" element={<GcpBillingPage />} />
            <Route path="/products/gcp/billing/:id" element={<GcpBillDetailPage />} />
            <Route path="/schedules/gws" element={<SchedulesPage />} />
            <Route path="/schedules/notifications" element={<ExpiryNoticePage />} />
            <Route path="/system/users" element={<UsersPage />} />
            <Route path="/system/roles" element={<RolesPage />} />
            <Route path="/system/logs" element={<AuditLogsPage />} />
            <Route path="*" element={<PlaceholderPage title="找不到頁面" />} />
        </Routes>
      ) : (
        <NoPermissionPage />
      )}
    </AppShell>
  );
}

/** 依網址前綴找出這一頁需要的資源 */
function pageAllowed(pathname: string, can: (r: ResourceKey) => boolean) {
  const r = resourceOf(pathname);
  return !r || can(r);
}

/** /products/gcp 本身沒有頁面：有用量權限去用量，否則去帳單 */
function GcpIndex() {
  const { can } = usePermission();
  return <Navigate to={can('gcpUsage') || !can('billing') ? '/products/gcp/usage' : '/products/gcp/billing'} replace />;
}
