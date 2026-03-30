import { useState } from 'react';
import './DataTable.css';

const COLUMNS = [
  { key: 'filename',      label: '#  File',         mono: true },
  { key: 'date',          label: 'Date' },
  { key: 'invoiceNumber', label: 'Invoice No.' },
  { key: 'orderId',       label: 'Order ID',        mono: true },
  { key: 'gstn',          label: 'GSTN',            mono: true },
  { key: 'quantity',      label: 'Qty',             align: 'right' },
  { key: 'value',         label: 'Value (₹)',       align: 'right', highlight: true },
];

export default function DataTable({ results }) {
  const [debugFile, setDebugFile] = useState(null);

  if (!results || results.length === 0) return null;

  const successful  = results.filter(r => r.success);
  const failed      = results.filter(r => !r.success);
  const totalValue  = successful
    .reduce((sum, r) => sum + parseFloat(r.data?.value?.replace(/,/g, '') || 0), 0)
    .toFixed(2);

  const debugResult = results.find(r => r.filename === debugFile);

  return (
    <div className="datatable-wrap animate-in">
      {/* Stats bar */}
      <div className="datatable-stats">
        <div className="stat">
          <span className="stat-value">{results.length}</span>
          <span className="stat-label">Total</span>
        </div>
        <div className="stat stat--success">
          <span className="stat-value">{successful.length}</span>
          <span className="stat-label">Extracted</span>
        </div>
        {failed.length > 0 && (
          <div className="stat stat--error">
            <span className="stat-value">{failed.length}</span>
            <span className="stat-label">Failed</span>
          </div>
        )}
        <div className="stat stat--amber">
          <span className="stat-value">₹{Number(totalValue).toLocaleString('en-IN')}</span>
          <span className="stat-label">Total Value</span>
        </div>
      </div>

      {/* Table */}
      <div className="datatable-container">
        <table className="datatable">
          <thead>
            <tr>
              {COLUMNS.map(col => (
                <th key={col.key} style={{ textAlign: col.align || 'left' }}>
                  {col.label}
                </th>
              ))}
              <th style={{ textAlign: 'center' }}>Debug</th>
            </tr>
          </thead>
          <tbody>
            {results.map((result, idx) => (
              <tr
                key={`${result.filename}-${idx}`}
                className={result.success ? 'row-success' : 'row-error'}
              >
                {COLUMNS.map(col => {
                  if (col.key === 'filename') {
                    return (
                      <td key="filename" className="cell-file">
                        <span className="row-idx">{String(idx + 1).padStart(2, '0')}</span>
                        <span className="cell-filename" title={result.filename}>
                          {result.filename}
                        </span>
                        {!result.success && (
                          <span className="tag tag-error" style={{ marginLeft: 8, fontSize: 10 }}>
                            FAIL
                          </span>
                        )}
                      </td>
                    );
                  }
                  if (!result.success) {
                    return (
                      <td key={col.key} className="cell-error-msg">
                        {col.key === 'date' ? result.error : '—'}
                      </td>
                    );
                  }
                  const val = result.data?.[col.key] ?? '—';
                  const empty = !val || val === '—';
                  return (
                    <td
                      key={col.key}
                      className={[
                        col.mono ? 'cell-mono' : '',
                        col.highlight ? 'cell-highlight' : '',
                        empty ? 'cell-empty' : '',
                      ].join(' ')}
                      style={{ textAlign: col.align || 'left' }}
                    >
                      {col.highlight && !empty
                        ? `₹${Number(val).toLocaleString('en-IN')}`
                        : val}
                    </td>
                  );
                })}
                <td style={{ textAlign: 'center' }}>
                  <button
                    className="debug-btn"
                    title="View raw extracted text"
                    onClick={() =>
                      setDebugFile(prev => prev === result.filename ? null : result.filename)
                    }
                  >
                    {debugFile === result.filename ? '▲' : '▼'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Debug Panel */}
      {debugFile && debugResult && (
        <div className="debug-panel">
          <div className="debug-panel__header">
            <span>📄 Raw extracted text — <em>{debugFile}</em></span>
            <button className="debug-close" onClick={() => setDebugFile(null)}>✕ Close</button>
          </div>
          {debugResult.success && debugResult.data && (
            <div className="debug-panel__parsed">
              {Object.entries(debugResult.data)
                .filter(([k]) => !k.startsWith('_'))
                .map(([k, v]) => (
                  <span key={k} className={`debug-field ${v ? 'ok' : 'miss'}`}>
                    <b>{k}:</b> {v || '(empty)'}
                  </span>
                ))}
            </div>
          )}
          <pre className="debug-panel__text">
            {debugResult.data?._rawText || debugResult.rawText || 'No raw text available'}
          </pre>
        </div>
      )}

      {/* Errors detail */}
      {failed.length > 0 && (
        <div className="datatable-errors">
          <p className="datatable-errors__title">⚠ Extraction errors</p>
          {failed.map((r, i) => (
            <div key={i} className="datatable-errors__item">
              <span className="datatable-errors__file">{r.filename}</span>
              <span className="datatable-errors__msg">{r.error}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
