import './FileList.css';

const formatSize = (bytes) => {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
};

const STATUS_CONFIG = {
  idle:       { label: 'Queued',     cls: 'tag-idle',    icon: '○' },
  processing: { label: 'Processing', cls: 'tag-pending', icon: '◌' },
  done:       { label: 'Done',       cls: 'tag-success', icon: '●' },
  error:      { label: 'Error',      cls: 'tag-error',   icon: '✕' },
};

export default function FileList({ files, fileStatuses, onRemoveFile, isProcessing }) {
  if (files.length === 0) return null;

  return (
    <div className="filelist">
      <div className="filelist__header">
        <span className="filelist__title">
          <span className="filelist__count">{files.length}</span>
          {files.length === 1 ? ' file' : ' files'} queued
        </span>
        {!isProcessing && (
          <button
            className="filelist__clear btn btn-secondary"
            onClick={() => files.forEach((_, i) => onRemoveFile(i))}
          >
            Clear all
          </button>
        )}
      </div>

      <div className="filelist__items">
        {files.map((file, idx) => {
          const status = fileStatuses[file.name] || { state: 'idle' };
          const cfg    = STATUS_CONFIG[status.state] || STATUS_CONFIG.idle;

          return (
            <div key={`${file.name}-${idx}`} className={`filelist__item filelist__item--${status.state}`}>
              <div className="filelist__item-icon">
                <svg width="20" height="24" viewBox="0 0 20 24" fill="none">
                  <rect x="1" y="1" width="14" height="22" rx="2" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M11 1v5h4" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M4 10h8M4 13h6M4 16h4" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
                </svg>
              </div>

              <div className="filelist__item-info">
                <span className="filelist__item-name">{file.name}</span>
                <span className="filelist__item-meta">
                  {formatSize(file.size)}
                  {status.state === 'error' && status.error && (
                    <span className="filelist__item-error"> · {status.error}</span>
                  )}
                </span>
              </div>

              <div className="filelist__item-right">
                <span className={`tag ${cfg.cls}`}>
                  <span className={`status-icon ${status.state === 'processing' ? 'spinning' : ''}`}>
                    {cfg.icon}
                  </span>
                  {cfg.label}
                </span>
                {!isProcessing && status.state !== 'processing' && (
                  <button
                    className="filelist__remove"
                    onClick={() => onRemoveFile(idx)}
                    title="Remove file"
                    aria-label={`Remove ${file.name}`}
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
