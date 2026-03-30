/**
 * excelExporter.js — Simplified for Invoice‑Level Data Only
 *
 * Exports: S.No, File Name, Date, Order ID, GSTN (Seller),
 * Invoice Number, Billed From, Qty (Total), Invoice Grand Total (₹),
 * Status, Error.
 *
 * Always forces .xlsx extension.
 */

import * as XLSX from 'xlsx';

function ensureXlsx(name) {
  const base = (name || 'InvoiceData').replace(/\.[^/.]+$/, '');
  return `${base}.xlsx`;
}

function toInvoiceRow(result, sno) {
  const d = result?.data ?? result ?? {};

  return {
    'S.No':                    sno,
    'File Name':               result?.filename ?? result?.fileName ?? '',
    'Date':                    d.date           ?? '',
    'Order ID':                d.orderId        ?? '',
    'GSTN (Seller)':           d.gstn           ?? '',
    'Invoice Number':          d.invoiceNumber  ?? '',
    'Billed From':             d.billedFromName ?? d.billedFrom ?? '',
    'Qty (Total)':             d.quantity       ?? '',
    'Invoice Grand Total (₹)': d.value          ?? '',
    'Status':                  result?.success === false ? 'Failed' : 'Success',
    'Error':                   result?.error    ?? '',
  };
}

export async function exportToExcel(results, filename = 'InvoiceData') {
  if (!Array.isArray(results)) {
    console.warn('[excelExporter] results is not an array:', results);
    results = [];
  }

  const valid = results.filter(r => r != null);
  if (!valid.length) {
    alert('No invoice data to export. Please extract at least one invoice first.');
    return;
  }

  const rows = valid.map((result, idx) => toInvoiceRow(result, idx + 1));

  const HEADERS = [
    'S.No', 'File Name', 'Date', 'Order ID', 'GSTN (Seller)',
    'Invoice Number', 'Billed From', 'Qty (Total)', 'Invoice Grand Total (₹)',
    'Status', 'Error'
  ];

  const ws = XLSX.utils.json_to_sheet(rows, { header: HEADERS });
  ws['!cols'] = [
    { wch: 6 },   // S.No
    { wch: 28 },  // File Name
    { wch: 14 },  // Date
    { wch: 30 },  // Order ID
    { wch: 22 },  // GSTN (Seller)
    { wch: 24 },  // Invoice Number
    { wch: 36 },  // Billed From
    { wch: 10 },  // Qty (Total)
    { wch: 22 },  // Invoice Grand Total (₹)
    { wch: 10 },  // Status
    { wch: 40 }   // Error
  ];

  // Summary sheet
  const invoiceCount = valid.length;
  const totalQty = rows.reduce((s, r) => s + (Number(r['Qty (Total)']) || 0), 0);
  const grandTotal = rows.reduce((s, r) => s + (Number(r['Invoice Grand Total (₹)']) || 0), 0);

  const ws2 = XLSX.utils.json_to_sheet([
    { Field: 'Total Invoices',      Value: invoiceCount },
    { Field: 'Total Quantity',      Value: totalQty },
    { Field: 'Grand Total (₹)',     Value: grandTotal.toFixed(2) },
    { Field: 'Export Date',         Value: new Date().toISOString().slice(0, 10) }
  ]);
  ws2['!cols'] = [{ wch: 28 }, { wch: 20 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Invoice Data');
  XLSX.utils.book_append_sheet(wb, ws2, 'Summary');

  XLSX.writeFile(wb, ensureXlsx(filename));

  return { invoiceCount, totalQty, grandTotal };
}