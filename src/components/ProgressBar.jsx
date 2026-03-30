import './ProgressBar.css';

export default function ProgressBar({ current, total, currentFile }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className="progress-wrap animate-in">
      <div className="progress-top">
        <span className="progress-label">
          Extracting invoices
          {currentFile && (
            <span className="progress-file"> — {currentFile}</span>
          )}
        </span>
        <span className="progress-pct">{pct}%</span>
      </div>

      <div className="progress-track">
        <div
          className="progress-bar"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="progress-bottom">
        <span>{current} of {total} files processed</span>
      </div>
    </div>
  );
}
