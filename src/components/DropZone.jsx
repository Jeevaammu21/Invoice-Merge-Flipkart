import { useRef, useState, useCallback } from 'react';
import './DropZone.css';

export default function DropZone({ onFilesAdded, disabled }) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef(null);

  const handleFiles = useCallback((files) => {
    const pdfs = Array.from(files).filter(
      f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    );
    if (pdfs.length > 0) onFilesAdded(pdfs);
  }, [onFilesAdded]);

  const onDragOver  = (e) => { e.preventDefault(); if (!disabled) setIsDragging(true); };
  const onDragLeave = () => setIsDragging(false);
  const onDrop      = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (!disabled) handleFiles(e.dataTransfer.files);
  };
  const onInputChange = (e) => handleFiles(e.target.files);
  const openDialog    = () => { if (!disabled) inputRef.current?.click(); };

  return (
    <div
      className={`dropzone ${isDragging ? 'dropzone--active' : ''} ${disabled ? 'dropzone--disabled' : ''}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={openDialog}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && openDialog()}
      aria-label="Upload PDF invoices"
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        multiple
        onChange={onInputChange}
        style={{ display: 'none' }}
        disabled={disabled}
      />

      <div className="dropzone__icon">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <rect x="8" y="4" width="28" height="36" rx="2" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 2"/>
          <path d="M28 4v8h8" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M24 20v12M18 26l6-6 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      <div className="dropzone__text">
        <p className="dropzone__headline">
          {isDragging ? 'Drop PDF files here' : 'Drag & drop invoice PDFs'}
        </p>
        <p className="dropzone__sub">
          or <span className="dropzone__link">browse files</span> · Multiple files supported · 50+ PDFs OK
        </p>
      </div>

      <div className="dropzone__badge">PDF</div>
    </div>
  );
}
