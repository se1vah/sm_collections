# SM Collections - Invoice & Inventory Management System

A full-stack, enterprise-grade **Invoice and Inventory Management Web Application** built with **Next.js (App Router)** and **MySQL**, designed for precision billing, dynamic stock synchronization, and professional PDF generation.

---

## 🌟 Key Features

### 1. Modern Navigation & ERP Interface
- Clean, responsive dashboard with a unified sidebar (`/invoice` and `/inventory`).
- Automatic redirection from `/` to `/invoice`.
- Professional blue & white ERP color palette, compact tables, rounded controls, and Sonner toast notifications.

### 2. Inventory Management (`/inventory`)
- **Full CRUD for Items**: Add, view, edit, and delete inventory items.
- **Unit Support**: Supports both **Qty** (pieces) and **Meter** (fabrics with decimal precision).
- **Stock Tracking**: Real-time status indicators (In Stock, Low Stock, Out of Stock).
- **Search & Pagination**: Live search by Item ID, Item Name, or Category with pagination.
- **Data Protection**: Prevents deletion of items referenced by existing invoices to preserve financial and audit integrity.

### 3. Invoice Management (`/invoice`)
- **Item ID Quick Entry**: Enter an Item ID and press `Enter` to search and immediately add or increment items.
- **Dynamic Quantity Controls**: Plus (`+`) and minus (`-`) buttons, manual input, and stock upper-limit validation.
- **Live Calculations**: Immediate recalculation of row totals, total items, total quantity, and grand total.
- **Price Editing**: Defaults to `SellingPrice` with option to adjust historical prices on the invoice.
- **Search & Filter**: Combined filtering by **Invoice ID** and **Date Picker** with newest-first sorting.

### 4. Transactional Stock Synchronization
- **Create Invoice**: Row-locking transaction (`SELECT ... FOR UPDATE`) validates quantities, creates invoice items, and deducts inventory stock.
- **Edit Invoice**: Intelligent differential calculation:
  - Increased quantity: verifies and deducts difference.
  - Decreased quantity: restores difference back to stock.
  - Added new item: deducts required quantity.
  - Removed item: restores quantity to stock.
- **Delete Invoice**: Confirmation dialog, restores all invoiced quantities, deletes invoice items, and removes the invoice.

### 5. Professional A4 PDF Invoices (`/api/invoices/[id]/pdf`)
- Generated server-side using **PDFKit** on the Next.js Node.js runtime.
- Formatted with Indian Rupee symbol (`₹`), two-decimal currency precision, company headers, detailed item table, summary cards, and page numbers.
- Automatic filename: `Invoice_<InvoiceID>.pdf`.

---

## 🛠️ Technology Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: JavaScript (JSX)
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Notifications**: Sonner
- **Database Driver**: `mysql2/promise` with connection pooling
- **Validation**: Zod
- **PDF Engine**: PDFKit (Node.js runtime)

---

## 🗄️ Database Architecture

Connects to existing MySQL tables in `sm_collections`:

### `Items` Table
```sql
CREATE TABLE Items (
    ItemID INT PRIMARY KEY,
    ItemName VARCHAR(150) NOT NULL,
    Category VARCHAR(100),
    Unit ENUM('Qty', 'Meter') NOT NULL,
    ActualPrice DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    SellingPrice DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    StockQuantity DECIMAL(10, 2) NOT NULL DEFAULT 0.00
);
```

### `Invoices` Table
```sql
CREATE TABLE Invoices (
    InvoiceID INT PRIMARY KEY AUTO_INCREMENT,
    InvoiceDate DATETIME NOT NULL
);
```

### `Invoice_Items` Table
```sql
CREATE TABLE Invoice_Items (
    InvoiceItemID INT PRIMARY KEY AUTO_INCREMENT,
    InvoiceID INT NOT NULL,
    ItemID INT NOT NULL,
    ItemName VARCHAR(150) NOT NULL,
    Quantity DECIMAL(10, 2) NOT NULL,
    Price DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (InvoiceID) REFERENCES Invoices(InvoiceID),
    FOREIGN KEY (ItemID) REFERENCES Items(ItemID)
);
```

---

## 🚀 Installation & Setup

### 1. Prerequisites
- **Node.js**: v18.x or v20+ (Node v24 supported)
- **MySQL Server**: Running on `localhost:3306` with database `sm_collections`

### 2. Configure Environment Variables
Copy `.env.local.example` to `.env.local`:
```bash
cp .env.local.example .env.local
```

Verify your credentials in `.env.local`:
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=sm_collections
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Run Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. The app will automatically redirect to `/invoice`.

### 5. Production Build
```bash
npm run build
npm start
```

---

## 📡 REST API Reference

### Items APIs
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/items` | List items with search, category, and pagination |
| `POST` | `/api/items` | Create new item |
| `GET` | `/api/items/[id]` | Get item by ID |
| `PUT` | `/api/items/[id]` | Update item details |
| `DELETE` | `/api/items/[id]` | Delete item (checks invoice reference) |

### Invoices APIs
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/invoices` | List invoices (search ID, date filter, sorted newest first) |
| `POST` | `/api/invoices` | Create invoice with transaction and stock deduction |
| `GET` | `/api/invoices/[id]` | Get invoice details and items |
| `PUT` | `/api/invoices/[id]` | Update invoice and balance stock differences |
| `DELETE` | `/api/invoices/[id]` | Delete invoice and restore stock to inventory |
| `GET` | `/api/invoices/[id]/items` | Get all items for an invoice |
| `GET` | `/api/invoices/[id]/pdf` | Generate and download A4 PDF invoice |

### Invoice Items APIs
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/invoice-items` | List all invoice items |
| `POST` | `/api/invoice-items` | Add individual item to invoice |
| `GET` | `/api/invoice-items/[id]` | Get invoice item by ID |
| `PUT` | `/api/invoice-items/[id]` | Update invoice item quantity/price |
| `DELETE` | `/api/invoice-items/[id]` | Delete invoice item and restore stock |

