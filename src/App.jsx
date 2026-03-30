import { useState, useCallback, useEffect } from 'react';
import DropZone from './components/DropZone';
import FileList from './components/FileList';
import ProgressBar from './components/ProgressBar';
import DataTable from './components/DataTable';
import { processInvoiceFile } from './utils/pdfParser';
import { exportToExcel } from './utils/excelExporter';
import './App.css';

const LS_KEY = 'invoicexl_last_results';

export default function App() {
  const [files, setFiles]               = useState([]);          // File[] array
  const [fileStatuses, setFileStatuses] = useState({});          // { [filename]: { state, error? } }
  const [results, setResults]           = useState([]);          // Extraction results
  const [progress, setProgress]         = useState(null);        // { current, total, currentFile } | null
  const [isProcessing, setIsProcessing] = useState(false);

  // Load last results from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setResults(parsed);
        }
      }
    } catch { /* ignore */ }
  }, []);

  // Save results to localStorage whenever they change
  useEffect(() => {
    if (results.length > 0) {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(results));
      } catch { /* ignore */ }
    }
  }, [results]);

  // ── File management ─────────────────────────────────
  const handleFilesAdded = useCallback((newFiles) => {
    setFiles(prev => {
      const existing = new Set(prev.map(f => f.name + f.size));
      const unique = newFiles.filter(f => !existing.has(f.name + f.size));
      return [...prev, ...unique];
    });
    setFileStatuses(prev => {
      const next = { ...prev };
      newFiles.forEach(f => {
        if (!next[f.name]) next[f.name] = { state: 'idle' };
      });
      return next;
    });
  }, []);

  const handleRemoveFile = useCallback((idx) => {
    setFiles(prev => {
      const removed = prev[idx];
      const next = prev.filter((_, i) => i !== idx);
      if (removed) {
        setFileStatuses(s => {
          const ns = { ...s };
          delete ns[removed.name];
          return ns;
        });
      }
      return next;
    });
  }, []);

  // ── Processing ───────────────────────────────────────
  const handleExtract = async () => {
    if (files.length === 0 || isProcessing) return;

    setIsProcessing(true);
    setResults([]);
    setProgress({ current: 0, total: files.length, currentFile: '' });

    // Reset all to idle first
    setFileStatuses(prev => {
      const next = {};
      files.forEach(f => { next[f.name] = { state: 'idle' }; });
      return next;
    });

    const allResults = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Mark as processing
      setFileStatuses(prev => ({
        ...prev,
        [file.name]: { state: 'processing' },
      }));
      setProgress({ current: i, total: files.length, currentFile: file.name });

      // Process file
      const result = await processInvoiceFile(file);
      allResults.push(result);

      // Mark as done/error
      setFileStatuses(prev => ({
        ...prev,
        [file.name]: {
          state: result.success ? 'done' : 'error',
          error: result.error,
        },
      }));

      // Yield to UI
      await new Promise(r => setTimeout(r, 0));
    }

    setProgress({ current: files.length, total: files.length, currentFile: '' });
    setResults(allResults);

    // Small delay so 100% is visible
    await new Promise(r => setTimeout(r, 600));
    setProgress(null);
    setIsProcessing(false);
  };

  // ── Download ─────────────────────────────────────────
  const handleDownload = () => {
    if (results.length === 0) return;
    exportToExcel(results, 'invoices_extracted');
  };

  // ── Clear everything ─────────────────────────────────
  const handleReset = () => {
    setFiles([]);
    setFileStatuses({});
    setResults([]);
    setProgress(null);
    try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
  };

  const successCount = results.filter(r => r.success).length;
  const hasResults   = results.length > 0;
  const canExtract   = files.length > 0 && !isProcessing;

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <div className="header-left">
          <div className="logo">
            <span className="logo-icon">⬡</span>
            <span className="logo-text">Invoice<span className="logo-xl">XL</span></span>
          </div>
          <span className="header-tagline">PDF → Excel in seconds</span>
        </div>
        <div className="header-right">
          {hasResults && (
            <button className="btn btn-secondary" onClick={handleReset}>
              ↺ Reset
            </button>
          )}
        </div>
      </header>

      <main className="app-main">
        {/* Grid layout */}
        <div className="app-grid">

          {/* Left column: Upload + controls */}
          <div className="col-left">
            <section className="card">
              <div className="card-header">
                <span className="card-label">01 — Upload</span>
                <span className="card-hint">PDF invoices only</span>
              </div>
              <DropZone onFilesAdded={handleFilesAdded} disabled={isProcessing} />
            </section>

            {files.length > 0 && (
              <section className="card animate-in" style={{ animationDelay: '0.05s' }}>
                <div className="card-header">
                  <span className="card-label">02 — Queue</span>
                </div>
                <FileList
                  files={files}
                  fileStatuses={fileStatuses}
                  onRemoveFile={handleRemoveFile}
                  isProcessing={isProcessing}
                />
              </section>
            )}

            {/* Action buttons */}
            <div className="action-bar animate-in">
              <button
                className="btn btn-primary btn-large"
                onClick={handleExtract}
                disabled={!canExtract}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8 1v9M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2 13h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                {isProcessing
                  ? `Extracting… (${Object.values(fileStatuses).filter(s => s.state === 'done' || s.state === 'error').length}/${files.length})`
                  : `Extract ${files.length > 0 ? `${files.length} ` : ''}Invoice${files.length !== 1 ? 's' : ''}`
                }
              </button>

              {hasResults && (
                <button
                  className="btn btn-success btn-large"
                  onClick={handleDownload}
                  disabled={isProcessing || successCount === 0}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M5 8h2v3h2V8h2L8 5 5 8Z" fill="currentColor"/>
                  </svg>
                  Download Excel ({successCount} rows)
                </button>
              )}
            </div>
          </div>

          {/* Right column: Progress + Results */}
          <div className="col-right">
            {/* Progress */}
            {progress !== null && (
              <ProgressBar
                current={progress.current}
                total={progress.total}
                currentFile={progress.currentFile}
              />
            )}

            {/* Results table */}
            {hasResults && !isProcessing && (
              <section className="card animate-in">
                <div className="card-header">
                  <span className="card-label">03 — Preview</span>
                  <span className="card-hint">
                    {successCount}/{results.length} extracted
                  </span>
                </div>
                <DataTable results={results} />
              </section>
            )}

            {/* Empty state */}
            {!hasResults && !isProcessing && files.length === 0 && (
              <div className="empty-state">
                <div className="empty-state__grid">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="empty-state__cell" />
                  ))}
                </div>
                <div className="empty-state__text">
                  <p className="empty-state__title">No data yet</p>
                  <p className="empty-state__sub">Upload PDFs and click Extract to begin</p>
                </div>
              </div>
            )}

            {/* How it works */}
            {!hasResults && !isProcessing && (
              <div className="howto animate-in">
                <p className="howto__title">How it works</p>
                <div className="howto__steps">
                  {[
                    ['Upload',   'Drag & drop one or more CIGFIL/Flipkart Wholesale PDFs'],
                    ['Extract',  'Regex-based parsing pulls Date, Invoice No., Order ID, GSTN, Qty, Value'],
                    ['Preview',  'Review the extracted table before downloading'],
                    ['Download', 'One-click Excel with 3 sheets: Data, Summary, Errors'],
                  ].map(([step, desc], i) => (
                    <div key={step} className="howto__step">
                      <span className="howto__num">{String(i + 1).padStart(2, '0')}</span>
                      <div>
                        <span className="howto__step-title">{step}</span>
                        <span className="howto__step-desc">{desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>
      </main>

      <footer className="app-footer">
        <span>InvoiceXL · Browser-only · No data leaves your device</span>
        <span className="footer-dot">·</span>
        <span>pdfjs-dist + xlsx (SheetJS)</span>
      </footer>
    </div>
  );
}
