# Dry Delight — Inventory & POS Management System

A fast, reliable, production-ready **Inventory & Point of Sale (POS) Management System** built with **React, Vite, Tailwind CSS, and Firebase (Authentication + Cloud Firestore)**.

Designed for daily retail operations with USB barcode scanner support, atomic inventory transactions, sales editing/deletion with full audit trails, partial & full sales returns, Next Day / Previous Day summary navigation, PDF/CSV reporting, and 58mm (2-inch) thermal invoice printing.

---

## Core Modules

1. **Authentication & Role Protection**: Email/password login via Firebase Auth with Firestore `users/{uid}` authorization checks (no public signup, persistent sessions, protected routes).
2. **Dashboard**: Real-time Firestore summary cards (Today's Sales, Transactions, Monthly Sales, Products, Categories, Low Stock, Returns), Daily & Monthly charts, Recent Sales, Top-Selling Products, and Low-Stock Alerts.
3. **Category Management**: Full CRUD with search, product counts, and safe deletion requiring product reassignment when a category contains products.
4. **Product Management**: Complete catalog with SKU, duplicate-protected manual/scanned/auto-generated EAN-13 barcodes, category & stock filters, sorting, pagination, and barcode preview.
5. **Inventory Management**: Overview KPIs, category-wise stock breakdown, atomic stock adjustments (restock/deduction), and append-only Stock Movement Ledger.
6. **Sales / POS Module**: Auto-focused USB barcode scanner input, manual catalog search, shopping cart, discount & paid/remaining balance handling, atomic Firestore transaction checkout with idempotency protection, and immediate 58mm thermal printing.
7. **Sales History & Editing/Deletion**: Search & filter sales, view linked returns & audit trail, reprint receipts, atomic sale editing (restores original quantities + applies updated quantities), and atomic sale deletion (restores net `sold - returned` quantities).
8. **Sales Summary (with Next Day Navigation)**: Dedicated Daily & Monthly summary view with prominent **Previous Day**, **Today**, **Date Picker**, and **Next Day** controls (read-only view switching).
9. **Sales Returns**: Lookup original invoice, validate return quantities (`<= sold - previously returned`), calculate proportionally discount-adjusted refund, restock inventory atomically, preserve original sale record, and print 58mm Return Receipts.
10. **Reports**: Daily, Monthly, and Custom Date Range reports with Product-Wise, Best-Selling, Customer-Wise, and Invoice tables, interactive charts, Print, Export PDF, and Export CSV.
11. **Thermal Invoice Printing (58mm / 2-inch)**: Dual engine supporting Browser Direct Print (`@media print` 58mm, zero preview/new window) and **QZ Tray** native raw ESC/POS silent printing on Windows.
12. **Settings**: Configurable Business Name, Address, Contact, Invoice Header/Footer, Currency (default `PKR`), Default Minimum Stock Level, and Thermal Printer settings with live Test Print.

---

## Project Structure

```text
├── firebase.json                 # Firestore rules/indexes & Hosting SPA config
├── firestore.rules               # Strict authenticated & role-based security rules
├── firestore.indexes.json        # Composite indexes for date/month/status queries
├── .env.example                  # Firebase client environment template
├── src/
│   ├── firebase/config.js        # Firebase App, Auth persistence & Firestore init
│   ├── contexts/                 # AuthContext, SettingsContext, PrintContext
│   ├── hooks/                    # useBarcodeScanner (USB keyboard-wedge hook)
│   ├── services/                 # Firestore CRUD, atomic transactions, QZ Tray & browser print
│   ├── utils/                    # Pure business logic, EAN-13 barcode, ESC/POS, CSV/PDF export
│   ├── components/
│   │   ├── common/               # Modal, ConfirmDialog, StatCard, Pagination, BarcodeDisplay
│   │   ├── layout/               # Sidebar (11 items), TopBar, AppLayout
│   │   └── printing/             # ThermalReceipt (58mm / 80mm receipt layout)
│   └── pages/                    # Lazy-loaded module pages
└── tests/businessLogic.test.js   # Vitest unit tests for financial, stock & return integrity
```

---

## Firestore Database Schema

| Collection | Key Fields |
|---|---|
| `users/{uid}` | `name`, `email`, `role` (`admin` \| `manager` \| `cashier`), `isActive`, `createdAt` |
| `categories/{id}` | `name`, `description`, `createdBy`, `createdAt`, `updatedAt` |
| `products/{id}` | `name`, `sku`, `barcode`, `categoryId`, `categoryName`, `purchasePrice`, `sellingPrice`, `availableQuantity`, `minStockLevel`, `description`, `createdAt`, `updatedAt` |
| `sales/{id}` | `invoiceNumber`, `customerName`, `saleDate` (`YYYY-MM-DD`), `saleMonth` (`YYYY-MM`), `items[]` (with historical `unitPrice`, `purchasePrice`, `returnedQuantity`), `subtotal`, `discount`, `grandTotal`, `paidAmount`, `remainingAmount`, `paymentStatus`, `returnStatus`, `totalReturnedAmount`, `createdAt` |
| `salesReturns/{id}` | `returnInvoiceNumber`, `originalSaleId`, `originalInvoiceNumber`, `customerName`, `returnDate`, `returnMonth`, `items[]`, `totalReturnedQty`, `totalReturnAmount`, `reason`, `createdAt` |
| `stockMovements/{id}` | `productId`, `productName`, `sku`, `transactionType`, `quantityChanged`, `previousStock`, `newStock`, `referenceInvoice`, `notes`, `performedBy`, `createdAt` |
| `auditLogs/{id}` | `action` (`SALE_EDITED` \| `SALE_DELETED`), `entityType`, `entityId`, `referenceInvoice`, `reason`, `performedBy`, `createdAt` |
| `counters/{id}` | `current` (atomic sequential counter per day for invoices & returns) |
| `settings/storeConfig` | Business profile, currency (`PKR`), invoice header/footer, thermal printer config |

---

## Installation & Firebase Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Firebase Environment Variables
1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com).
2. Enable **Authentication → Email/Password** (keep public signup disabled in the app).
3. Create a **Cloud Firestore** database in production mode.
4. Register a **Web App** in Firebase Project Settings and copy the config values.
5. Copy `.env.example` to `.env` and fill in your Firebase keys:
   ```bash
   cp .env.example .env
   ```

### 3. Deploy Firestore Security Rules & Composite Indexes
Install the Firebase CLI (`npm install -g firebase-tools`), sign in, and deploy rules & indexes:
```bash
firebase login
firebase use --add
firebase deploy --only firestore:rules,firestore:indexes
```

### 4. Create the Initial Administrator Account
Because public registration is intentionally disabled:
1. In Firebase Console → **Authentication → Users**, click **Add User** and create your admin email & password. Copy the generated **User UID**.
2. In Firebase Console → **Firestore Database**, create a collection named `users` and add a document whose **Document ID** is that exact **User UID** with fields:
   ```json
   {
     "name": "Dry Delight Administrator",
     "email": "admin@drydelight.com",
     "role": "admin",
     "isActive": true
   }
   ```
3. You can now sign in at `/login` and configure your store details under **Settings**.

---

## 58mm Thermal Printer Setup (Windows)

### Option A: True Silent ESC/POS Printing with QZ Tray (Recommended)
1. Download and install **QZ Tray** from [qz.io](https://qz.io/) on the Windows POS PC.
2. Ensure your 58mm thermal printer (e.g., Xprinter XP-58, POS-58) is installed in Windows Printers.
3. Open **Settings → Thermal Printer Configuration**, choose **QZ Tray Silent ESC/POS Print**, click **Detect QZ Tray & Printers**, select your thermal printer, and click **Test Print Receipt**.

### Option B: Browser Direct Print (Zero Dialog via Chrome Kiosk Printing)
1. Set your 58mm thermal printer as the default printer in Windows with 58mm paper width and `0` margins.
2. Launch Google Chrome or Microsoft Edge with the `--kiosk-printing` flag on the POS workstation shortcut:
   ```text
   "C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk-printing http://localhost:5173
   ```
3. In **Settings**, keep **Browser Direct Print (@media print 58mm)** selected.

---

## Development, Testing & Deployment

```bash
# Start local development server
npm run dev

# Run automated unit tests (calculations, stock deltas, returns, Next Day, EAN-13, ESC/POS)
npm test

# Build optimized production bundle
npm run build

# Deploy to Firebase Hosting
firebase deploy --only hosting
```

---

## Manual Verification Checklist

- [ ] Login with unauthorized email (rejected) and authorized admin account (succeeds).
- [ ] Add, edit, search, and delete categories (verify reassignment prompt when category contains products).
- [ ] Add product with generated EAN-13 barcode; verify duplicate barcode rejection.
- [ ] Scan barcode in POS with USB scanner; verify auto-add, repeat-scan increment, and unknown barcode error.
- [ ] Complete sale; verify stock deduction, `stockMovements` entry, and 58mm thermal invoice printing.
- [ ] Edit existing sale in Sales History; verify atomic stock reconciliation and `auditLogs` entry.
- [ ] Delete a sale; verify net stock restoration and `auditLogs` entry.
- [ ] Process partial return and complete return; verify validation against over-returning, stock restoration, and preserved original sale.
- [ ] Verify Daily/Monthly Summary totals and Previous Day / Today / Next Day navigation.
- [ ] Export Reports to PDF and CSV and verify Net Sales = Gross Sales - Returns.
