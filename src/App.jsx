import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { ProfitLockProvider } from './contexts/ProfitLockContext';
import { DataProvider } from './contexts/DataContext';
import { PrintProvider } from './contexts/PrintContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';
import LoadingSpinner from './components/common/LoadingSpinner';
import LoginPage from './pages/LoginPage';

const loadDashboard = () => import('./pages/DashboardPage');
const loadCategories = () => import('./pages/CategoriesPage');
const loadProducts = () => import('./pages/ProductsPage');
const loadInventory = () => import('./pages/InventoryPage');
const loadPos = () => import('./pages/PosPage');
const loadSalesHistory = () => import('./pages/SalesHistoryPage');
const loadSalesSummary = () => import('./pages/SalesSummaryPage');
const loadSalesReturns = () => import('./pages/SalesReturnsPage');
const loadReports = () => import('./pages/ReportsPage');
const loadSettings = () => import('./pages/SettingsPage');

const DashboardPage = lazy(loadDashboard);
const CategoriesPage = lazy(loadCategories);
const ProductsPage = lazy(loadProducts);
const InventoryPage = lazy(loadInventory);
const PosPage = lazy(loadPos);
const SalesHistoryPage = lazy(loadSalesHistory);
const SalesSummaryPage = lazy(loadSalesSummary);
const SalesReturnsPage = lazy(loadSalesReturns);
const ReportsPage = lazy(loadReports);
const SettingsPage = lazy(loadSettings);

/**
 * Silently prefetches core page chunks during browser idle time after login
 * so sidebar navigation feels instantaneous while keeping initial bundle small.
 */
function RoutePrefetcher() {
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    const prefetch = () => {
      loadPos();
      loadProducts();
      loadCategories();
      loadSalesHistory();
      loadSalesSummary();
      loadInventory();
      loadSalesReturns();
      loadReports();
      loadSettings();
    };
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(prefetch, { timeout: 1500 });
      return () => window.cancelIdleCallback(id);
    }
    const timer = setTimeout(prefetch, 300);
    return () => clearTimeout(timer);
  }, [isAuthenticated]);

  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SettingsProvider>
          <ProfitLockProvider>
            <DataProvider>
              <PrintProvider>
                <RoutePrefetcher />
                <Toaster
                  position="top-right"
                  toastOptions={{
                    duration: 2400,
                    style: {
                      fontSize: '13px',
                      borderRadius: '10px',
                      border: '1px solid #e2e8f0',
                    },
                    success: {
                      icon: <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />,
                    },
                    error: {
                      icon: <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />,
                    },
                  }}
                />

                <Suspense
                  fallback={
                    <div className="min-h-screen flex items-center justify-center bg-slate-50">
                      <LoadingSpinner label="Loading..." compact />
                    </div>
                  }
                >
                  <Routes>
                    <Route path="/login" element={<LoginPage />} />

                    <Route
                      element={
                        <ProtectedRoute>
                          <AppLayout />
                        </ProtectedRoute>
                      }
                    >
                      <Route index element={<DashboardPage />} />
                      <Route path="/categories" element={<CategoriesPage />} />
                      <Route path="/products" element={<ProductsPage />} />
                      <Route path="/inventory" element={<InventoryPage />} />
                      <Route path="/pos" element={<PosPage />} />
                      <Route path="/sales" element={<SalesHistoryPage />} />
                      <Route path="/sales-summary" element={<SalesSummaryPage />} />
                      <Route path="/returns" element={<SalesReturnsPage />} />
                      <Route path="/reports" element={<ReportsPage />} />
                      <Route path="/settings" element={<SettingsPage />} />
                    </Route>

                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Suspense>
              </PrintProvider>
            </DataProvider>
          </ProfitLockProvider>
        </SettingsProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
