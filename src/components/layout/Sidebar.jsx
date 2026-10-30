'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  FileText,
  Boxes,
  Menu,
  X,
  Layers,
  CircleCheck,
  Receipt,
  Store,
  Settings,
  Printer,
} from 'lucide-react';
import { useBluetoothPrinter } from '@/context/BluetoothPrinterContext';

export default function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const { isConnected, deviceName } = useBluetoothPrinter();

  const navigation = [
    {
      name: 'Invoice',
      href: '/invoice',
      icon: Receipt,
      description: 'Billing & Invoicing',
    },
    {
      name: 'Inventory',
      href: '/inventory',
      icon: Boxes,
      description: 'Stock & Items',
    },
    {
      name: 'Settings',
      href: '/settings',
      icon: Settings,
      description: 'Thermal Printer & Setup',
    },
  ];

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="lg:hidden flex items-center justify-between bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold shadow-sm">
            SM
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-800 leading-tight">SM Collections</h1>
            <p className="text-[10px] text-slate-500">Invoice & Inventory</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Mobile Printer Status Indicator */}
          <Link
            href="/settings"
            className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-semibold border ${
              isConnected
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-slate-100 border-slate-200 text-slate-600'
            }`}
          >
            <Printer className="w-3 h-3" />
            <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-slate-400'}`} />
          </Link>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-2 text-slate-600 hover:text-blue-600 rounded-lg hover:bg-slate-100 transition-colors"
            aria-label="Toggle Navigation"
          >
            {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Panel */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-slate-100 border-r border-slate-800 flex flex-col transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-700 to-blue-500 flex items-center justify-center text-white font-extrabold text-lg shadow-md shadow-blue-500/20">
              SM
            </div>
            <div>
              <h2 className="font-bold text-base tracking-tight text-white flex items-center gap-1.5">
                SM Collections
              </h2>
              <p className="text-xs text-blue-400 font-medium">ERP Suite</p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Items */}
        <div className="p-3 space-y-1.5 flex-1">
          <p className="px-3 pt-3 pb-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Management
          </p>

          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);

            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <div className="flex-1">
                  <div className="leading-snug">{item.name}</div>
                  <div className={`text-[11px] ${isActive ? 'text-blue-100' : 'text-slate-500'}`}>
                    {item.description}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Database & Printer Info Footer */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/40 space-y-2">
          {/* Database status */}
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              MySQL Active
            </span>
            <span className="text-[10px] text-slate-500 bg-slate-800 px-2 py-0.5 rounded">v1.0</span>
          </div>

          {/* Bluetooth Thermal Printer status */}
          <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-800/60">
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'
                }`}
              />
              <span className="text-slate-400 truncate text-[11px]">
                {isConnected ? `${deviceName || 'KPC307'}` : 'Printer Offline'}
              </span>
            </div>
            <Link
              href="/settings"
              className="text-[10px] text-blue-400 hover:text-blue-300 font-semibold shrink-0 ml-1.5"
            >
              {isConnected ? 'Manage' : 'Connect'}
            </Link>
          </div>
        </div>
      </aside>
    </>
  );
}
