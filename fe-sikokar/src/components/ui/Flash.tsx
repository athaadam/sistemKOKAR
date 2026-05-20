'use client';

export function Flash({ message, type = 'success', onClose }: { message: string; type?: string; onClose?: () => void }) {
  if (!message) return null;
  const cls =
    type === 'danger' || type === 'error'
      ? 'alert-danger'
      : type === 'warning'
        ? 'alert-warning'
        : 'alert-success';
  return (
    <div className={`alert ${cls} alert-dismissible fade show mb-2 py-2 px-3`} style={{ fontSize: 13, borderRadius: 8 }} role="alert">
      {message}
      {onClose && <button type="button" className="btn-close btn-sm" onClick={onClose} aria-label="Close" />}
    </div>
  );
}
