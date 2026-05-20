'use client';

export function Modal({
  open,
  onClose,
  title,
  size = 'lg',
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  size?: 'md' | 'lg' | 'xl';
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <>
      <div className="modal fade show d-block" tabIndex={-1} role="dialog">
        <div className={`modal-dialog modal-${size}`}>
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">{title}</h5>
              <button type="button" className="btn-close" onClick={onClose} aria-label="Tutup" />
            </div>
            {children}
            {footer}
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>
  );
}
