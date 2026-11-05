import { HashRouter, Route, Routes } from 'react-router-dom';
import { AppShell } from '@shared/components/AppShell';
import { ToastProvider } from '@shared/components/Toast';
import { adminNav } from './nav';
import { CustomersPage } from './pages/CustomersPage';
import { CustomerDetailPage } from './pages/CustomerDetailPage';
import { NewCustomerPage } from './pages/NewCustomerPage';
import { PlaceholderPage } from './pages/PlaceholderPage';
import { WorkOrderDetailPage } from './pages/WorkOrderDetailPage';
import { WorkOrdersPage } from './pages/WorkOrdersPage';

// 用 HashRouter：部署成靜態網站（GitHub Pages 等）時，直接開任何網址都不會 404
export function App() {
  return (
    <HashRouter>
      <ToastProvider>
        <AppShell siteName="零壹 SaaS 平台" siteSubtitle="管理端" nav={adminNav} user={{ name: '林怡君', role: '後台管理員' }}>
          <Routes>
            <Route path="/" element={<PlaceholderPage title="首頁" />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/customers/new" element={<NewCustomerPage />} />
            <Route path="/customers/:id" element={<CustomerDetailPage />} />
            <Route path="/dealers" element={<PlaceholderPage title="經銷商管理" />} />
            <Route path="/work-orders" element={<WorkOrdersPage />} />
            <Route path="/work-orders/:id" element={<WorkOrderDetailPage />} />
            <Route path="/products/gws" element={<PlaceholderPage title="GWS 訂閱管理" />} />
            <Route path="/products/gcp" element={<PlaceholderPage title="GCP 流量與用量" />} />
            <Route path="/brands" element={<PlaceholderPage title="品牌管理" />} />
            <Route path="/catalog" element={<PlaceholderPage title="產品管理" />} />
            <Route path="/schedules/gws" element={<PlaceholderPage title="GWS 排程中心" />} />
            <Route path="/system/users" element={<PlaceholderPage title="使用者" />} />
            <Route path="/system/roles" element={<PlaceholderPage title="角色管理" />} />
            <Route path="/system/logs" element={<PlaceholderPage title="系統日誌" />} />
            <Route path="*" element={<PlaceholderPage title="找不到頁面" />} />
          </Routes>
        </AppShell>
      </ToastProvider>
    </HashRouter>
  );
}
