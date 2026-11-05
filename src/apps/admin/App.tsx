import { HashRouter, Route, Routes } from 'react-router-dom';
import { AppShell } from '@shared/components/AppShell';
import { ToastProvider } from '@shared/components/Toast';
import { adminNav } from './nav';
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
import { WorkOrdersPage } from './pages/WorkOrdersPage';

// 用 HashRouter：部署成靜態網站（GitHub Pages 等）時，直接開任何網址都不會 404
export function App() {
  return (
    <HashRouter>
      <ToastProvider>
        <AppShell siteName="零壹 SaaS 平台" siteSubtitle="管理端" nav={adminNav} user={{ name: '林怡君', role: '後台管理員' }}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/customers/new" element={<NewCustomerPage key="new" />} />
            <Route path="/customers/transfer-in" element={<NewCustomerPage key="transfer" mode="transfer" />} />
            <Route path="/customers/:id" element={<CustomerDetailPage />} />
            <Route path="/dealers" element={<DealersPage />} />
            <Route path="/work-orders" element={<WorkOrdersPage />} />
            <Route path="/work-orders/:id" element={<WorkOrderDetailPage />} />
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
      </ToastProvider>
    </HashRouter>
  );
}
