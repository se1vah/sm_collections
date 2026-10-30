'use client';

import { useState } from 'react';
import {
  Printer,
  Bluetooth,
  BluetoothConnected,
  BluetoothOff,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  FileText,
  Sliders,
  HelpCircle,
  Zap,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useBluetoothPrinter } from '@/context/BluetoothPrinterContext';

export default function SettingsPage() {
  const {
    isSupported,
    isConnected,
    isConnecting,
    isPrinting,
    deviceName,
    deviceId,
    lastConnectedTime,
    error,
    connectPrinter,
    disconnectPrinter,
    printTestReceipt,
  } = useBluetoothPrinter();

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Settings & Printer Configuration
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Manage your KPC307-UEWB-2EFE Bluetooth thermal printer connection and invoice printing preferences.
          </p>
        </div>
      </div>

      {/* Web Bluetooth Support Warning (if unsupported browser) */}
      {!isSupported && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 sm:p-5 flex items-start gap-3.5 shadow-2xs">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-amber-900">
              Web Bluetooth Not Supported in Current Browser
            </h4>
            <p className="text-xs text-amber-800 leading-relaxed">
              Your browser does not have the Web Bluetooth API enabled. To connect and print directly to your{' '}
              <strong>KPC307-UEWB-2EFE</strong> thermal printer via Bluetooth, please open this application in{' '}
              <strong>Google Chrome</strong>, <strong>Microsoft Edge</strong>, or <strong>Opera</strong> on
              Desktop, Android, or ChromeOS.
            </p>
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Bluetooth Thermal Printer Manager (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Printer Connection Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
            {/* Card Header */}
            <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-2xs ${
                    isConnected
                      ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                      : 'bg-blue-50 text-blue-600 border border-blue-100'
                  }`}
                >
                  <Printer className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">
                      KPC307-UEWB-2EFE Thermal Printer
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    80mm High-Speed Wireless POS Receipt Printer
                  </p>
                </div>
              </div>

              {/* Status Badge */}
              <div>
                {isConnecting ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Connecting...
                  </span>
                ) : isConnected ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Connected via Bluetooth
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                    <span className="w-2 h-2 rounded-full bg-slate-400" />
                    Disconnected
                  </span>
                )}
              </div>
            </div>

            {/* Card Body */}
            <div className="p-5 sm:p-6 space-y-6">
              {/* Connected Device Details */}
              {isConnected ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-emerald-50/40 p-4 rounded-xl border border-emerald-100/80">
                  <div>
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                      Connected Device Name
                    </span>
                    <span className="text-sm font-bold text-slate-900 mt-0.5 block flex items-center gap-1.5">
                      <BluetoothConnected className="w-4 h-4 text-emerald-600" />
                      {deviceName || 'KPC307-UEWB-2EFE'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                      Connection Protocol
                    </span>
                    <span className="text-sm font-semibold text-slate-800 mt-0.5 block">
                      Bluetooth Low Energy (GATT ESC/POS)
                    </span>
                  </div>

                  <div>
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                      Paper Width / Columns
                    </span>
                    <span className="text-sm font-semibold text-slate-800 mt-0.5 block">
                      80mm (48 characters/line)
                    </span>
                  </div>

                  <div>
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                      Connected Since
                    </span>
                    <span className="text-sm font-semibold text-slate-800 mt-0.5 block">
                      {lastConnectedTime || 'Just now'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-200/80 text-slate-600 flex items-center justify-center shrink-0">
                      <BluetoothOff className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        No printer currently connected
                      </p>
                      <p className="text-xs text-slate-500">
                        {deviceName
                          ? `Previously paired: ${deviceName}`
                          : 'Turn on your KPC307 printer and click Connect below.'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Error Notice */}
              {error && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-xs text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{error}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                {!isConnected ? (
                  <Button
                    onClick={connectPrinter}
                    loading={isConnecting}
                    disabled={!isSupported}
                    size="md"
                    className="gap-2 bg-blue-600 hover:bg-blue-700 shadow-sm"
                  >
                    <Bluetooth className="w-4 h-4" />
                    Connect Thermal Printer via Bluetooth
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={printTestReceipt}
                      loading={isPrinting}
                      size="md"
                      className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                    >
                      <Printer className="w-4 h-4" />
                      Print Test Receipt
                    </Button>

                    <Button
                      variant="outline"
                      onClick={disconnectPrinter}
                      size="md"
                      className="gap-2 text-slate-700 hover:text-red-600 hover:bg-red-50 hover:border-red-200"
                    >
                      <BluetoothOff className="w-4 h-4" />
                      Disconnect Printer
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* How It Works & Setup Guide */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-5 sm:p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-blue-600" />
              KPC307-UEWB-2EFE Bluetooth Pairing Instructions
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5">
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs">
                  1
                </span>
                <p className="font-bold text-slate-800">Power On Printer</p>
                <p className="text-slate-500 leading-relaxed">
                  Turn on your KPC307 printer. Verify that the Bluetooth indicator LED is active and paper roll is loaded.
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5">
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs">
                  2
                </span>
                <p className="font-bold text-slate-800">Pair via Browser</p>
                <p className="text-slate-500 leading-relaxed">
                  Click the <strong>Connect</strong> button above. Select your printer (e.g. <em>KPC307</em> or <em>POS-80</em>) from the browser prompt.
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5">
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs">
                  3
                </span>
                <p className="font-bold text-slate-800">Direct Wireless Print</p>
                <p className="text-slate-500 leading-relaxed">
                  Once connected, invoices can be printed instantly from the Invoices table or Create/Edit form with 1 click.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Thermal Receipt Preview / Specs (1 col) */}
        <div className="space-y-6">
          {/* Printer Specs Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-5 space-y-3.5">
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              Printer Specifications
            </h4>

            <div className="divide-y divide-slate-100 text-xs">
              <div className="py-2 flex justify-between">
                <span className="text-slate-500">Target Model</span>
                <span className="font-semibold text-slate-800">KPC307-UEWB-2EFE</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-slate-500">Printing Method</span>
                <span className="font-semibold text-slate-800">Direct Thermal</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-slate-500">Roll Width</span>
                <span className="font-semibold text-slate-800">80mm (3 Inch)</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-slate-500">Command Set</span>
                <span className="font-semibold text-slate-800">ESC/POS Standard</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-slate-500">Auto Paper Cutter</span>
                <span className="font-semibold text-emerald-600">Supported (Partial/Full)</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-slate-500">Web Bluetooth</span>
                <span className="font-semibold text-blue-600">GATT Characteristic</span>
              </div>
            </div>
          </div>

          {/* Thermal Receipt Layout Mockup */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-5 space-y-3">
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" />
              Receipt Format Preview
            </h4>
            <p className="text-xs text-slate-500">
              Formatted according to your thermal receipt sample.
            </p>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 font-mono text-[10px] leading-tight text-slate-700 select-none">
              <div className="text-center font-bold text-slate-900">SM COLLECTION&apos;S</div>
              <div className="text-center text-[9px] text-slate-500">Smart Shopping, Better Living</div>
              <div className="text-center text-[9px] text-slate-500">Lakshmana Theertham, Rameswaram</div>
              <div className="text-center text-[9px] text-slate-500">Ph: 9629967006</div>
              <div className="border-b border-dashed border-slate-300 my-1.5" />
              <div className="font-bold">TAX INVOICE</div>
              <div>Bill No : #1001</div>
              <div>Date    : 24-10-2026</div>
              <div>Payment method : CASH</div>
              <div className="border-b border-dashed border-slate-300 my-1.5" />
              <div className="flex justify-between font-bold text-slate-800">
                <span>ITEM</span>
                <span>QTY  RATE      AMT</span>
              </div>
              <div className="border-b border-dashed border-slate-300 my-1.5" />
              <div className="flex justify-between">
                <span>Saree</span>
                <span>1   999    999.00</span>
              </div>
              <div className="border-b border-dashed border-slate-300 my-1.5" />
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>999.00</span>
              </div>
              <div className="flex justify-between">
                <span>Discount</span>
                <span>0.00</span>
              </div>
              <div className="border-b border-dashed border-slate-300 my-1.5" />
              <div className="flex justify-between font-bold text-slate-900 text-[11px]">
                <span>TOTAL AMOUNT</span>
                <span>999.00</span>
              </div>
              <div className="border-b border-dashed border-slate-300 my-1.5" />
              <div className="text-center text-[9px] pt-1">Thank You! Visit Again</div>
              <div className="text-center text-[8px] text-slate-400">NO RETURNS | NO EXCHANGES</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

