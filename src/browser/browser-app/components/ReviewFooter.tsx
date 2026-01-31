import React from 'react';
import type { GraphMeta } from '../types';

interface ReviewFooterProps {
  meta: GraphMeta;
  onApprove: () => void;
  onReject: () => void;
}

export const ReviewFooter: React.FC<ReviewFooterProps> = ({ meta, onApprove, onReject }) => {
  const [isApproving, setIsApproving] = React.useState(false);
  const [isRejecting, setIsRejecting] = React.useState(false);
  const [status, setStatus] = React.useState<'idle' | 'approved' | 'rejected'>('idle');

  if (!meta.hasChanges) {
    return null;
  }

  if (status === 'approved') {
    return (
      <div className="review-footer">
        <div className="changes-summary" style={{ color: 'var(--vanna-teal)' }}>
          ✓ Changes approved! Lockfile updated. You can close this window.
        </div>
      </div>
    );
  }

  if (status === 'rejected') {
    return (
      <div className="review-footer">
        <div className="changes-summary" style={{ color: 'var(--change-removed)' }}>
          ✕ Changes rejected. You can close this window.
        </div>
      </div>
    );
  }

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      await onApprove();
      setStatus('approved');
    } catch (error) {
      alert('Failed to approve changes: ' + (error as Error).message);
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    setIsRejecting(true);
    try {
      await onReject();
      setStatus('rejected');
    } catch (error) {
      alert('Failed to reject changes: ' + (error as Error).message);
      setIsRejecting(false);
    }
  };

  return (
    <div className="review-footer">
      <div className="changes-summary">
        <span>Pending changes:</span>
        {meta.addedCount > 0 && (
          <span className="change-count added">+{meta.addedCount} added</span>
        )}
        {meta.removedCount > 0 && (
          <span className="change-count removed">−{meta.removedCount} removed</span>
        )}
        {meta.modifiedCount > 0 && (
          <span className="change-count modified">~{meta.modifiedCount} modified</span>
        )}
      </div>
      <div className="review-actions">
        <button
          className="review-btn reject"
          onClick={handleReject}
          disabled={isApproving || isRejecting}
        >
          Reject Changes
        </button>
        <button
          className="review-btn approve"
          onClick={handleApprove}
          disabled={isApproving || isRejecting}
        >
          Approve & Update Lockfile
        </button>
      </div>
    </div>
  );
};
