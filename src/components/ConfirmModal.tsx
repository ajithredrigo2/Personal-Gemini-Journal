import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#D6D5CD]">
        <div className="flex items-center gap-3 text-rose-600 mb-3">
          <div className="p-2.5 bg-rose-50 rounded-xl border border-rose-100">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <h3 className="text-xl font-serif font-bold text-[#3A3A35]">{title}</h3>
        </div>

        <p className="text-sm text-[#73726B] leading-relaxed mb-6 font-sans">{message}</p>

        <div className="flex items-center justify-end gap-3">
          <button
            id="modal-cancel-btn"
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-[#3A3A35] bg-[#EFEEE7] hover:bg-[#E8E6DF] rounded-xl border border-[#D6D5CD] transition-colors cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            id="modal-confirm-btn"
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors shadow-xs cursor-pointer"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
