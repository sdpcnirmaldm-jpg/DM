import React, { useEffect, useState } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface DoubleConfirmDeleteModalProps {
  open: boolean;
  title: string;
  itemName: string;
  itemMeta?: string;
  description: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}

export const DoubleConfirmDeleteModal: React.FC<DoubleConfirmDeleteModalProps> = ({
  open,
  title,
  itemName,
  itemMeta,
  description,
  confirmLabel = 'Yes, Permanently Delete',
  onCancel,
  onConfirm,
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setStep(1);
      setBusy(false);
    }
  }, [open, itemName, itemMeta]);

  if (!open) return null;

  const handleFinalConfirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] flex items-center justify-center p-4 no-print"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="modal-pop-in bg-white border border-[#DDE8E2] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="text-[11px] font-mono font-semibold uppercase tracking-wider text-red-700">
              {step === 1 ? 'Confirmation 1 of 2' : 'Final Confirmation 2 of 2'}
            </div>
            <h3 className="font-display text-lg font-bold text-[#14201B]">
              {step === 1 ? title : `Permanently Delete ${itemName}?`}
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close delete confirmation"
            className="p-1.5 rounded-lg hover:bg-[#F6F9F7] text-[#4B6157]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {step === 1 ? (
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-[#FAFDFB] border border-[#DDE8E2] text-sm">
              <div className="font-semibold text-[#14201B]">{itemName}</div>
              {itemMeta && (
                <div className="text-xs font-mono text-[#4B6157] mt-0.5">{itemMeta}</div>
              )}
            </div>
            <p className="text-sm text-[#4B6157] leading-relaxed">{description}</p>
          </div>
        ) : (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-900 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div className="space-y-1 leading-relaxed">
              <div className="font-semibold">Second confirmation required</div>
              <div>
                You are about to permanently remove{' '}
                <span className="font-semibold">{itemName}</span>
                {itemMeta ? ` (${itemMeta})` : ''}. This cannot be recovered once deleted.
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-[#EEF3F0]">
          {step === 2 && (
            <button
              type="button"
              disabled={busy}
              onClick={() => setStep(1)}
              className="px-3.5 py-2 rounded-xl border border-[#DDE8E2] text-xs font-medium text-[#4B6157] hover:bg-[#F6F9F7] mr-auto"
            >
              Back
            </button>
          )}

          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="px-4 py-2 rounded-xl border border-[#DDE8E2] text-xs font-medium text-[#14201B] hover:bg-[#F6F9F7]"
          >
            Cancel
          </button>

          {step === 1 ? (
            <button
              type="button"
              onClick={() => setStep(2)}
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Continue to Final Confirm</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={handleFinalConfirm}
              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{busy ? 'Deleting...' : confirmLabel}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
