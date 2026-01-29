import type { ReactNode } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from '@/components/layout/AppLayout'
import LoginPage from '@/pages/login'
import DashboardPage from '@/pages/dashboard'
import ResourcePOIPage from '@/pages/resources/poi'
import SupplierListPage from '@/pages/suppliers/list'
import ProductListPage from '@/pages/products/list'
import ProductCategoryPage from '@/pages/products/categories'
import ProductEditorPage from '@/pages/products/editor'
import SPUListPage from '@/pages/spus/list'
import SKUListPage from '@/pages/skus/list'
import ChannelsPage from '@/pages/skus/channels'
import PricingCenterPage from '@/pages/pricing/center'
import InventoryCalendarPage from '@/pages/inventory/calendar'
import OrdersListPage from '@/pages/orders/list'
import OrdersImportPage from '@/pages/orders/import'
import ApprovalsPendingPage from '@/pages/approvals/pending'
import OperationLogPage from '@/pages/logs/operations'
import SalesReportPage from '@/pages/reports/sales'
import ProfitReportPage from '@/pages/reports/profit'
import UserAdminPage from '@/pages/admin/users'
import FilesPage from '@/pages/files'
import { useAuth } from '@/contexts/AuthContext'
import { DataProvider } from '@/contexts/DataContext'

// Guard component to protect routes
function PrivateRoute({ children }: { children: ReactNode }) {
    const { user, loading } = useAuth()

    if (loading) return <div>Loading...</div>

    if (!user) {
        return <Navigate to="/login" replace />
    }

    return children
}

export default function AppRoutes() {
    return (
        <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route
                path="/*"
                element={
                    <PrivateRoute>
                        <DataProvider>
                            <AppLayout />
                        </DataProvider>
                    </PrivateRoute>
                }
            >
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<DashboardPage />} />

                {/* 资源中心 */}
                <Route path="resources/poi" element={<ResourcePOIPage />} />
                <Route path="resources/list" element={<Navigate to="/resources/poi" replace />} />
                <Route path="suppliers/list" element={<SupplierListPage />} />

                {/* Products M3 */}
                <Route path="products/list" element={<ProductListPage />} />
                <Route path="products/categories" element={<ProductCategoryPage />} />
                <Route path="products/editor" element={<ProductEditorPage />} />

                {/* SKUs & Channels M4 */}
                <Route path="spus/list" element={<SPUListPage />} />
                <Route path="skus/list" element={<SKUListPage />} />
                <Route path="skus/channels" element={<ChannelsPage />} />

                {/* Pricing M5 */}
                <Route path="pricing/center" element={<PricingCenterPage />} />


                {/* Inventory M6 */}
                <Route path="inventory/calendar" element={<InventoryCalendarPage />} />


                {/* Orders M7 */}
                <Route path="orders/list" element={<OrdersListPage />} />
                <Route path="orders/import" element={<OrdersImportPage />} />

                {/* Approvals & Audit M8 */}
                <Route path="approvals/pending" element={<ApprovalsPendingPage />} />
                <Route path="logs/operations" element={<OperationLogPage />} />

                {/* Reports M9 */}
                <Route path="reports/sales" element={<SalesReportPage />} />
                <Route path="reports/profit" element={<ProfitReportPage />} />

                {/* Admin - User Management */}
                <Route path="admin/users" element={<UserAdminPage />} />

                {/* 文件管理 */}
                <Route path="files" element={<FilesPage />} />

                <Route path="*" element={<div style={{ padding: 40, textAlign: 'center' }}>页面建设中</div>} />
            </Route>
        </Routes>
    )
}
