import { Navigate, Route, Routes } from 'react-router-dom'
import { ManagementDashboard, OperationDashboard, ProductDashboard } from '../pages/dashboard'
import SupplierPage from '../pages/m1_supplier'
import ResourcePage from '../pages/m2_resource'
import { ProductDetailPage, ProductEditorPage, ProductListPage } from '../pages/m3_product'
import SkuPage from '../pages/m4_sku'
import ChannelPage from '../pages/m4_sku/channels'
import PriceCenterPage from '../pages/m5_price'
import InventoryPage from '../pages/m6_inventory'
import OrdersPage from '../pages/m7_order'
import { ApprovalsPage, AuditLogPage } from '../pages/m8_approval'
import ReportCenterPage from '../pages/m9_report'

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard/management" replace />} />

      <Route path="/dashboard/management" element={<ManagementDashboard />} />
      <Route path="/dashboard/operation" element={<OperationDashboard />} />
      <Route path="/dashboard/product" element={<ProductDashboard />} />

      <Route path="/resources/poi" element={<ResourcePage />} />
      <Route path="/resources/new" element={<ResourcePage />} />

      <Route path="/suppliers" element={<SupplierPage />} />

      <Route path="/products" element={<ProductListPage />} />
      <Route path="/products/new" element={<ProductEditorPage />} />
      <Route path="/products/:id" element={<ProductDetailPage />} />
      <Route path="/products/:id/edit" element={<ProductEditorPage />} />

      <Route path="/skus" element={<SkuPage />} />
      <Route path="/skus/:id" element={<SkuPage />} />
      <Route path="/channels" element={<ChannelPage />} />

      <Route path="/pricing" element={<PriceCenterPage />} />
      <Route path="/inventory" element={<InventoryPage />} />
      <Route path="/orders" element={<OrdersPage />} />
      <Route path="/orders/new" element={<OrdersPage />} />
      <Route path="/orders/import" element={<OrdersPage />} />
      <Route path="/orders/:id" element={<OrdersPage />} />

      <Route path="/approvals" element={<ApprovalsPage />} />
      <Route path="/approvals/:id" element={<ApprovalsPage />} />
      <Route path="/audit-log" element={<AuditLogPage />} />

      <Route path="/reports" element={<ReportCenterPage />} />
      <Route path="*" element={<Navigate to="/dashboard/management" replace />} />
    </Routes>
  )
}
