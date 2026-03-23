import React from 'react';
import { TopNav } from './TopNav';
import { Sidebar } from './Sidebar';
import { LicenseStatus } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  currentPage: string;
  onNavigate: (page: string) => void;
  licenseStatus: LicenseStatus | null;
}

export const Layout: React.FC<LayoutProps> = ({ children, currentPage, onNavigate, licenseStatus }) => {
  return (
    <div className="h-screen flex flex-col bg-cyber-bg">
      <TopNav onNavigate={onNavigate} currentPage={currentPage} licenseStatus={licenseStatus} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar currentPage={currentPage} onNavigate={onNavigate} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 min-w-0">
          <div className="max-w-full mx-auto container px-2 sm:px-4">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
