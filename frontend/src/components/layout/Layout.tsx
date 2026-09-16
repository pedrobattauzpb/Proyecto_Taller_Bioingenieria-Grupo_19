import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { X } from 'lucide-react';

export const Layout: React.FC = () => {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[var(--bg)] text-[var(--ink)] transition-colors">
      <Header onToggleSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)} />

      <div className="flex flex-1 min-h-0 overflow-hidden relative">
        {/* Desktop Sidebar */}
        <div className="hidden md:flex shrink-0">
          <Sidebar />
        </div>

        {/* Mobile Drawer Sidebar */}
        {mobileSidebarOpen && (
          <div className="fixed inset-0 z-40 md:hidden flex">
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-xs"
              onClick={() => setMobileSidebarOpen(false)}
            />
            <div className="relative z-50 w-72 max-w-[80vw] h-full bg-[var(--surface)] shadow-xl flex flex-col border-r border-[var(--border)]">
              <div className="p-4 border-b border-[var(--border)] flex justify-between items-center">
                <span className="font-bold text-sm text-[var(--ink)]">Menú Clínico</span>
                <button
                  type="button"
                  onClick={() => setMobileSidebarOpen(false)}
                  className="p-1 rounded-lg text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <Sidebar onItemClick={() => setMobileSidebarOpen(false)} className="w-full border-r-0" />
              </div>
            </div>
          </div>
        )}

        {/* Contenido Principal */}
        <main className="flex-1 min-w-0 overflow-y-auto bg-[var(--bg)] p-4 sm:p-6 md:p-8 transition-colors">
          <div className="max-w-[1280px] mx-auto w-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
