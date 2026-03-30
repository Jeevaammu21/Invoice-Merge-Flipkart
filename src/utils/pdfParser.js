/**
 * pdfParser.js — v6
 *
 * Enhanced to extract:
 *   - invoiceTotalQty (sum of all product quantities)
 *   - invoiceGrandTotal (total amount including tax)
 *   - billedFromName (seller's name)
 *
 * Worker version detection included.
 */

import * as pdfjsLib from 'pdfjs-dist';

// Worker version detection
const _major = parseInt(pdfjsLib.version.split('.')[0], 10);
const _ext   = _major >= 4 ? 'mjs' : 'js';
pdfjsLib.GlobalWorkerOptions.workerSrc =
  `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.${_ext}`;

const GSTIN_RE = /GSTIN\s*:\s*[\s\n]*([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z])/gm;

// -----------------------------------------------------------------------------
// 1. Text extraction from PDF
// -----------------------------------------------------------------------------
export async function extractTextFromPDF(arrayBuffer) {
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page    = await pdf.getPage(pageNum);
    const content = await page.getTextContent();

    const lineMap = new Map();
    for (const item of content.items) {
      if (!item.str) continue;
      const y = Math.round(item.transform[5] / 2) * 2;
      if (!lineMap.has(y)) lineMap.set(y, []);
      lineMap.get(y).push({ x: item.transform[4], str: item.str });
    }

    const sortedYs = [...lineMap.keys()].sort((a, b) => b - a);
    const lines = sortedYs.map(y =>
      lineMap.get(y)
        .sort((a, b) => a.x - b.x)
        .map(i => i.str)
        .join(' ')
    );

    fullText += lines.join('\n') + '\n';
  }

  return fullText;
}

// -----------------------------------------------------------------------------
// 2. Extract "Billed From" (seller) name
// -----------------------------------------------------------------------------
function extractBilledFromName(text) {
  const sectionMatch = text.match(/(?:Billed|Shipped)\s*From\s*([\s\S]*?)(?:Billed\s*To|Shipped\s*To|GSTIN|$)/i);
  if (sectionMatch) {
    const firstLine = sectionMatch[1].trim().split('\n')[0].trim();
    if (firstLine) return firstLine;
  }
  const fallback = text.match(/M\/?s\.?\s+([A-Z][A-Za-z\s]+?)(?:\n|GSTIN)/i);
  if (fallback) return fallback[1].trim();
  return '';
}

// -----------------------------------------------------------------------------
// 3. Extract invoice header details (date, number, orderId)
// -----------------------------------------------------------------------------
function extractInvoiceDetails(text) {
  const result = { date: '', invoiceNumber: '', orderId: '' };

  // Positional (two‑column) approach
  const blockMatch = text.match(/Invoice\s*Details([\s\S]*?)(?:TAX\s*INVOICE|IRN\s*[\n\s]*:)/i);
  if (blockMatch) {
    const block = blockMatch[1];
    const colonValues = [];
    const colonRe = /^\s*:\s*(.+?)\s*$/gm;
    let m;
    while ((m = colonRe.exec(block)) !== null) {
      const val = m[1].trim();
      if (val) colonValues.push(val);
    }
    if (colonValues[1]) result.invoiceNumber = colonValues[1];
    if (colonValues[2]) result.date          = colonValues[2];
    if (colonValues[3]) result.orderId       = colonValues[3];
    if (result.invoiceNumber && result.date && result.orderId) return result;
  }

  // Inline label‑value patterns
  const INLINE = {
    date: [
      /Invoice\s*Date\s*[:\-]\s*([\d]{4}-[\d]{2}-[\d]{2})/i,
      /Invoice\s*Date\s*[:\-]\s*([\d]{2}[\/\-][\d]{2}[\/\-][\d]{4})/i,
    ],
    invoiceNumber: [
      /Invoice\s*Number\s*[:\-]\s*([A-Z][A-Z0-9]{6,})/i,
      /Invoice\s*No\.?\s*[:\-]\s*([A-Z][A-Z0-9]{6,})/i,
    ],
    orderId: [
      /(?:Invoice\s*)?Order[-\s]*Id\s*[:\-]\s*([A-Za-z0-9_\-]+)/i,
      /Order\s*(?:No|Number)\.?\s*[:\-]\s*([A-Za-z0-9_\-]+)/i,
    ],
  };
  for (const [field, patterns] of Object.entries(INLINE)) {
    if (result[field]) continue;
    for (const p of patterns) {
      const m = text.match(p);
      if (m?.[1]) { result[field] = m[1].trim(); break; }
    }
  }

  // Fallback heuristics
  if (!result.date) {
    const m = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
    if (m) result.date = m[1];
  }
  if (!result.invoiceNumber) {
    const m = text.match(/\b(VIC[A-Z0-9]{8,})\b/);
    if (m) result.invoiceNumber = m[1];
  }
  if (!result.orderId) {
    const m = text.match(/\b(VRP_\d+_[A-Za-z0-9]+)\b/);
    if (m) result.orderId = m[1];
  }
  return result;
}

// -----------------------------------------------------------------------------
// 4. Extract seller GSTIN (looks inside "Billed/Shipped From" section)
// -----------------------------------------------------------------------------
function extractGSTIN(text) {
  const re  = new RegExp(GSTIN_RE.source, GSTIN_RE.flags);
  const all = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    if (!all.includes(m[1])) all.push(m[1]);
  }
  if (all.length === 0) return '';

  const sellerSection = text.match(/(?:Billed|Shipped)\s*From([\s\S]*?)(?:Billed\s*To|Shipped\s*To|Product|Qty|$)/i);
  if (sellerSection) {
    const re2 = new RegExp(GSTIN_RE.source, GSTIN_RE.flags);
    const sm  = re2.exec(sellerSection[1]);
    if (sm?.[1]) return sm[1];
  }
  return all[0];
}

// -----------------------------------------------------------------------------
// 5. Extract total quantity and grand total from invoice
// -----------------------------------------------------------------------------

/**
 * Compute total quantity by:
 *   - First trying to find an explicit "Total <number>" line (e.g., "Total 11")
 *   - Otherwise, sum the quantities from the product table (if present)
 */
function extractTotalQuantity(text) {
  // Strategy 1: Look for a "Total" line that includes a number before the first currency amount
  // Example: "Total 11 ₹2237.11 ₹402.68 IGST ₹2639.79"
  const totalLineMatch = text.match(/Total\s+(\d+(?:\.\d+)?)\s+[₹]/i);
  if (totalLineMatch && totalLineMatch[1]) {
    return totalLineMatch[1];
  }

  // Strategy 2: If a product table exists, sum all quantities from rows that look like product lines.
  // Find the table area between "Product" header and "Total" line.
  const tableStart = text.search(/\bProduct\s+(?:Title\s+)?Qty\s+Unit\s+Price/i);
  if (tableStart !== -1) {
    const tableEnd = text.search(/\n\s*Total\s+\d+\s+[₹]/i);
    if (tableEnd !== -1 && tableEnd > tableStart) {
      const tableText = text.slice(tableStart, tableEnd);
      // Each product line typically ends with a total amount. Extract all numbers that appear before a currency symbol.
      // We can capture numbers that are likely quantities (often small integers or decimals)
      const lines = tableText.split('\n');
      let totalQty = 0;
      for (const line of lines) {
        // Look for a pattern: some text, then a number (maybe decimal), then a ₹ amount later
        const qtyMatch = line.match(/(\d+(?:\.\d+)?)\s+[₹]/);
        if (qtyMatch) {
          const qty = parseFloat(qtyMatch[1]);
          if (!isNaN(qty)) totalQty += qty;
        }
      }
      if (totalQty > 0) return totalQty.toString();
    }
  }

  // Strategy 3: Fallback to old method (first Qty found)
  const m1 = text.match(/\bQty\b[\s\n]+([\d]+(?:\.[\d]+)?)/i);
  if (m1) return m1[1];
  const m2 = text.match(/\n\s*([\d]+\.[\d]+)\s+[\d,]+\.[\d]{2}/);
  if (m2) return m2[1];
  return '1';
}

/**
 * Extract grand total (including tax) by:
 *   - Looking for "Total" line and picking the last amount
 *   - Using explicit patterns like "Grand Total"
 *   - Falling back to the last amount before "Amount in words"
 */
function extractGrandTotal(text) {
  const clean = (s) => s.replace(/,/g, '');

  // Strategy 1: Find the line containing "Total" and extract the last ₹ amount
  // Example: "Total 11 ₹2237.11 ₹402.68 IGST ₹2639.79" → last amount = 2639.79
  const totalLineMatch = text.match(/Total.*?₹\s*([\d,]+(?:\.\d{2})?)(?:\s|$)/gi);
  if (totalLineMatch && totalLineMatch.length) {
    // Get the last match in the line (the grand total)
    const lastMatch = totalLineMatch[totalLineMatch.length - 1];
    const amtMatch = lastMatch.match(/₹\s*([\d,]+(?:\.\d{2})?)/);
    if (amtMatch) return clean(amtMatch[1]);
  }

  // Strategy 2: Explicit total labels
  const totalPatterns = [
    /Grand\s*Total\s*[:\-]?\s*([\d,]+(?:\.\d{2})?)/i,
    /Total\s*Invoice\s*Value\s*[:\-]?\s*([\d,]+(?:\.\d{2})?)/i,
    /Invoice\s*Total\s*[:\-]?\s*([\d,]+(?:\.\d{2})?)/i,
    /Total\s*Amount\s*[:\-]?\s*([\d,]+(?:\.\d{2})?)/i,
    /(?:₹|Rs\.?)\s*([\d,]+(?:\.\d{2})?)\s*(?:Only)?/i,
  ];
  for (const pattern of totalPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return clean(match[1]);
    }
  }

  // Strategy 3: Last amount before "Amount in words"
  const beforeWords = text.split(/Amount\s*in\s*words/i)[0];
  if (beforeWords) {
    const amountMatches = [...beforeWords.matchAll(/(?:₹|Rs\.?)\s*([\d,]+(?:\.\d{2})?)/gi)];
    if (amountMatches.length > 0) {
      return clean(amountMatches[amountMatches.length - 1][1]);
    }
    const numMatches = [...beforeWords.matchAll(/\b([\d,]+(?:\.\d{2})?)\b/g)];
    if (numMatches.length > 0) {
      return clean(numMatches[numMatches.length - 1][1]);
    }
  }

  // Strategy 4: Last amount anywhere
  const allAmounts = [...text.matchAll(/(?:₹|Rs\.?)\s*([\d,]+(?:\.\d{2})?)/gi)];
  if (allAmounts.length > 0) {
    return clean(allAmounts[allAmounts.length - 1][1]);
  }

  return '';
}

// -----------------------------------------------------------------------------
// 6. Public API
// -----------------------------------------------------------------------------
export function parseInvoiceText(rawText) {
  const text = rawText.replace(/[^\S\n]+/g, ' ').replace(/\n{3,}/g, '\n\n');

  const details = extractInvoiceDetails(text);
  return {
    date:            details.date,
    invoiceNumber:   details.invoiceNumber,
    orderId:         details.orderId,
    gstn:            extractGSTIN(text),
    billedFromName:  extractBilledFromName(text),
    quantity:        extractTotalQuantity(text),   // now total quantity
    value:           extractGrandTotal(text),      // now grand total (including tax)
    _rawText:        rawText,
  };
}

export async function processInvoiceFile(file) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const rawText     = await extractTextFromPDF(arrayBuffer);
    const data        = parseInvoiceText(rawText);
    if (!data.invoiceNumber && !data.orderId && !data.date) {
      return {
        success: false,
        filename: file.name,
        error:    'Could not extract invoice data — unsupported PDF format',
        rawText,
      };
    }
    return { success: true, filename: file.name, data };
  } catch (err) {
    return {
      success: false,
      filename: file.name,
      error:    err.message || 'Failed to read PDF',
    };
  }
}