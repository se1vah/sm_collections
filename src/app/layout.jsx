import './globals.css';
import Sidebar from '@/components/layout/Sidebar';
import { Toaster } from 'sonner';

export const metadata = {
  title: 'SM Collections | Invoice & Inventory Management',
  description: 'Full-stack Invoice and Inventory Management System with MySQL',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-slate-50 text-slate-900 flex flex-col lg:flex-row antialiased">
        <Sidebar />
        <main className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto">
          {children}
        </main>
        <Toaster richColors position="top-right" closeButton />
      </body>
    </html>
  );
}

