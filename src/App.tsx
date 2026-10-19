/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { NotificationProvider } from './context/NotificationContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { CommandPalette } from './components/layout/CommandPalette';

// Pages
import { DashboardPage } from './pages/DashboardPage';
import { InventoryListPage } from './pages/InventoryListPage';
import { GoodsReceiptPage } from './pages/GoodsReceiptPage';
import { StockOutPage } from './pages/StockOutPage';
import { StockTransferPage } from './pages/StockTransferPage';
import { AssetsPage } from './pages/AssetsPage';
import { WarehousesPage } from './pages/WarehousesPage';
import { StockOpnamePage } from './pages/StockOpnamePage';
import { RequestsPage } from './pages/RequestsPage';
import { ReportsPage } from './pages/ReportsPage';
import { UsersRolesPage } from './pages/UsersRolesPage';
import { AuditPage } from './pages/AuditPage';
import { SettingsPage } from './pages/SettingsPage';
import { LoginDemoPage } from './pages/LoginDemoPage';
import { ItemFormModal } from './pages/ItemFormModal';
import { Item, Category, Unit, Supplier } from './types';
import { api } from './services/api';

const AppContent: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const [currentPage, setCurrentPage] = useState<string>('dashboard');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [preselectedItem, setPreselectedItem] = useState<Item | null>(null);

  // Quick item modal trigger from anywhere
  const [isQuickAddModalOpen, setIsQuickAddModalOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const handleOpenAddItem = async () => {
    try {
      const [catRes, unitRes, supRes] = await Promise.all([
        api.getCategories(),
        api.getUnits(),
        api.getSuppliers(),
      ]);
      setCategories(catRes.categories);
      setUnits(unitRes.units);
      setSuppliers(supRes.suppliers);
      setIsQuickAddModalOpen(true);
    } catch (err) {
      console.error(err);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600 animate-pulse flex items-center justify-center font-bold">
            NI
          </div>
          <span className="text-xs font-mono text-slate-400">Memuat NGA INVENTRA Enterprise...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginDemoPage onSuccess={() => setCurrentPage('dashboard')} />;
  }

  const navigateToReceiptWithItem = (item?: Item) => {
    setPreselectedItem(item || null);
    setCurrentPage('goods-receipt');
  };

  const navigateToStockOutWithItem = (item?: Item) => {
    setPreselectedItem(item || null);
    setCurrentPage('stock-out');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex transition-colors text-slate-900 dark:text-slate-100">
      {/* Sidebar */}
      <Sidebar
        currentPage={currentPage}
        onNavigate={(p) => setCurrentPage(p)}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        lowStockCount={2}
      />

      {/* Main Layout Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
          lowStockCount={2}
          onNavigate={(p) => setCurrentPage(p)}
        />

        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {currentPage === 'dashboard' && (
            <DashboardPage
              onNavigate={(p) => setCurrentPage(p)}
              onOpenAddItem={handleOpenAddItem}
            />
          )}

          {currentPage === 'inventory' && (
            <InventoryListPage
              onNavigateToReceipt={navigateToReceiptWithItem}
              onNavigateToStockOut={navigateToStockOutWithItem}
            />
          )}

          {currentPage === 'warehouses' && <WarehousesPage />}

          {currentPage === 'goods-receipt' && (
            <GoodsReceiptPage preselectedItem={preselectedItem} />
          )}

          {currentPage === 'stock-out' && (
            <StockOutPage preselectedItem={preselectedItem} />
          )}

          {currentPage === 'transfer' && <StockTransferPage />}

          {currentPage === 'assets' && <AssetsPage />}

          {currentPage === 'stock-opname' && <StockOpnamePage />}

          {currentPage === 'requests' && <RequestsPage />}

          {currentPage === 'reports' && <ReportsPage />}

          {currentPage === 'users-roles' && <UsersRolesPage />}

          {currentPage === 'audit' && <AuditPage />}

          {currentPage === 'settings' && <SettingsPage />}
        </main>
      </div>

      {/* Global Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigate={(p) => setCurrentPage(p)}
      />

      {/* Quick Add Master Item Modal */}
      <ItemFormModal
        isOpen={isQuickAddModalOpen}
        onClose={() => setIsQuickAddModalOpen(false)}
        onSaved={() => {
          if (currentPage === 'inventory') {
            // refresh
          }
        }}
        categories={categories}
        units={units}
        suppliers={suppliers}
      />
    </div>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <NotificationProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </NotificationProvider>
    </ThemeProvider>
  );
}
