'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { buildInvoiceReceiptCommands, buildTestPrintCommands } from '@/lib/escpos';

const BluetoothPrinterContext = createContext(null);

// Common GATT Services used by Thermal POS Printers (BLE SPP / Transparent Serial)
const PRINTER_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb', // Standard Printer Service
  '0000ffe0-0000-1000-8000-00805f9b34fb', // HM-10 / Common POS-80 serial
  '0000ff00-0000-1000-8000-00805f9b34fb', // Vendor ESC/POS service
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC transparent serial
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // BLE SPP service
  '0000fff0-0000-1000-8000-00805f9b34fb',
  '0000fee7-0000-1000-8000-00805f9b34fb',
  '00001101-0000-1000-8000-00805f9b34fb', // Standard Serial Port Profile
  '0000ae00-0000-1000-8000-00805f9b34fb',
  '0000ae30-0000-1000-8000-00805f9b34fb',
];

export function BluetoothPrinterProvider({ children }) {
  const [isSupported, setIsSupported] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [device, setDevice] = useState(null);
  const [deviceName, setDeviceName] = useState(null);
  const [deviceId, setDeviceId] = useState(null);
  const [lastConnectedTime, setLastConnectedTime] = useState(null);
  const [error, setError] = useState(null);

  const deviceRef = useRef(null);
  const characteristicRef = useRef(null);

  // Check Web Bluetooth support on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
      const supported = Boolean(navigator.bluetooth && typeof navigator.bluetooth.requestDevice === 'function');
      setIsSupported(supported);

      // Check saved printer name from previous session
      const savedName = localStorage.getItem('sm_printer_name');
      if (savedName) {
        setDeviceName(savedName);
      }
    }
  }, []);

  // Handle device disconnection
  const handleDisconnected = useCallback(() => {
    setIsConnected(false);
    characteristicRef.current = null;
    toast.info('Thermal printer disconnected');
  }, []);

  // Disconnect active printer
  const disconnectPrinter = useCallback(async () => {
    try {
      if (deviceRef.current && deviceRef.current.gatt && deviceRef.current.gatt.connected) {
        deviceRef.current.gatt.disconnect();
      }
    } catch (e) {
      console.warn('Error during disconnect:', e);
    } finally {
      setIsConnected(false);
      setDevice(null);
      characteristicRef.current = null;
      toast.success('Printer disconnected');
    }
  }, []);

  // Connect to Bluetooth printer
  const connectPrinter = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.bluetooth) {
      const errMsg = 'Web Bluetooth is not supported in this browser. Please use Google Chrome or Microsoft Edge.';
      setError(errMsg);
      toast.error(errMsg);
      return false;
    }

    setIsConnecting(true);
    setError(null);

    try {
      // 1. Request Bluetooth Device with wide service discovery
      const selectedDevice = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: PRINTER_SERVICES,
      });

      if (!selectedDevice) {
        throw new Error('No device selected');
      }

      deviceRef.current = selectedDevice;
      setDevice(selectedDevice);
      const name = selectedDevice.name || 'KPC307-UEWB-2EFE Thermal Printer';
      setDeviceName(name);
      setDeviceId(selectedDevice.id || 'N/A');
      localStorage.setItem('sm_printer_name', name);

      // Listen for disconnection
      selectedDevice.removeEventListener('gattserverdisconnected', handleDisconnected);
      selectedDevice.addEventListener('gattserverdisconnected', handleDisconnected);

      // 2. Connect to GATT Server
      const server = await selectedDevice.gatt.connect();

      // 3. Find Writable Characteristic across optional services
      let writeChar = null;

      for (const serviceUuid of PRINTER_SERVICES) {
        try {
          const service = await server.getPrimaryService(serviceUuid);
          const chars = await service.getCharacteristics();
          for (const c of chars) {
            if (c.properties.write || c.properties.writeWithoutResponse) {
              writeChar = c;
              break;
            }
          }
          if (writeChar) break;
        } catch (e) {
          // Check next service in list
        }
      }

      // If not found in known list, discover all primary services
      if (!writeChar) {
        try {
          const allServices = await server.getPrimaryServices();
          for (const service of allServices) {
            const chars = await service.getCharacteristics();
            for (const c of chars) {
              if (c.properties.write || c.properties.writeWithoutResponse) {
                writeChar = c;
                break;
              }
            }
            if (writeChar) break;
          }
        } catch (e) {
          console.warn('Could not enumerate all services:', e);
        }
      }

      if (!writeChar) {
        throw new Error(
          'Could not find a writable ESC/POS characteristic on this printer. Please ensure the printer is turned on and in Bluetooth pairing mode.'
        );
      }

      characteristicRef.current = writeChar;
      setIsConnected(true);
      setLastConnectedTime(new Date().toLocaleTimeString('en-IN'));
      toast.success(`Connected to ${name} successfully!`);
      return true;
    } catch (err) {
      console.error('Bluetooth connection error:', err);
      // Don't show toast error if user just cancelled the device picker
      if (err.name !== 'NotFoundError') {
        const msg = err.message || 'Failed to connect to Bluetooth printer';
        setError(msg);
        toast.error(msg);
      }
      setIsConnected(false);
      return false;
    } finally {
      setIsConnecting(false);
    }
  }, [handleDisconnected]);

  // Send raw bytes in chunks to handle BLE MTU limits safely
  const sendBytesToPrinter = useCallback(async (dataBytes) => {
    const char = characteristicRef.current;
    if (!char) {
      throw new Error('Printer is not connected. Please connect via Settings.');
    }

    // Typical BLE characteristic MTU is 20-100 bytes; 64 bytes is reliable
    const CHUNK_SIZE = 64;
    for (let offset = 0; offset < dataBytes.length; offset += CHUNK_SIZE) {
      const chunk = dataBytes.slice(offset, offset + CHUNK_SIZE);
      if (char.properties.writeWithoutResponse) {
        await char.writeValueWithoutResponse(chunk);
      } else {
        await char.writeValue(chunk);
      }
      // Small pause between chunks to allow printer buffer to consume data
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }, []);

  // Print test receipt
  const printTestReceipt = useCallback(async () => {
    if (!isConnected || !characteristicRef.current) {
      const connected = await connectPrinter();
      if (!connected) return false;
    }

    setIsPrinting(true);
    try {
      const commands = buildTestPrintCommands(deviceName || 'KPC307-UEWB-2EFE');
      await sendBytesToPrinter(commands);
      toast.success('Test receipt sent to thermal printer!');
      return true;
    } catch (err) {
      console.error('Print test error:', err);
      toast.error('Failed to print test receipt: ' + err.message);
      return false;
    } finally {
      setIsPrinting(false);
    }
  }, [isConnected, deviceName, connectPrinter, sendBytesToPrinter]);

  // Print invoice receipt
  const printInvoice = useCallback(
    async (invoice) => {
      if (!invoice) {
        toast.error('No invoice data provided to print');
        return false;
      }

      if (!isConnected || !characteristicRef.current) {
        toast.info('Printer not connected. Opening Bluetooth connection dialog...');
        const connected = await connectPrinter();
        if (!connected) return false;
      }

      setIsPrinting(true);
      try {
        const commands = buildInvoiceReceiptCommands(invoice);
        await sendBytesToPrinter(commands);
        toast.success(`Invoice #${invoice.InvoiceID} sent to thermal printer!`);
        return true;
      } catch (err) {
        console.error('Print invoice error:', err);
        toast.error('Failed to print invoice: ' + err.message);
        return false;
      } finally {
        setIsPrinting(false);
      }
    },
    [isConnected, connectPrinter, sendBytesToPrinter]
  );

  return (
    <BluetoothPrinterContext.Provider
      value={{
        isSupported,
        isConnected,
        isConnecting,
        isPrinting,
        device,
        deviceName,
        deviceId,
        lastConnectedTime,
        error,
        connectPrinter,
        disconnectPrinter,
        printTestReceipt,
        printInvoice,
      }}
    >
      {children}
    </BluetoothPrinterContext.Provider>
  );
}

export function useBluetoothPrinter() {
  const context = useContext(BluetoothPrinterContext);
  if (!context) {
    throw new Error('useBluetoothPrinter must be used within a BluetoothPrinterProvider');
  }
  return context;
}

