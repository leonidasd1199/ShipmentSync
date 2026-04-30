import React from "react";
import { AlertCircle, X } from "lucide-react";
import type { Template } from "../../../utils/types/template.type";

interface DeleteTemplateModalProps {
  open: boolean;
  template: Template | null;
  onClose: () => void;
  onDelete: (id: string) => Promise<void>;
}

const DeleteTemplateModal: React.FC<DeleteTemplateModalProps> = ({
  open,
  template,
  onClose,
  onDelete,
}) => {
  const [isDeleting, setIsDeleting] = React.useState(false);

  if (!open || !template) return null;

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const id = (template as any).id ?? (template as any)._id;
      await onDelete(id);
    } catch (error) {
      console.error("Error deleting template:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-md rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 sm:px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
              <AlertCircle className="h-5 w-5 text-red-600" />
            </div>
            <h2 className="text-lg font-semibold text-neutral-900">Delete Template</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 transition-colors disabled:opacity-50"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 sm:px-6 py-4">
          <p className="text-sm text-neutral-600">
            Are you sure you want to delete the template{" "}
            <span className="font-semibold text-neutral-900">"{template.name}"</span>?
          </p>
          <p className="mt-2 text-sm text-neutral-500">
            This will set the template as inactive (soft delete). You can reactivate it later if needed.
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-neutral-200 px-4 sm:px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="inline-flex items-center justify-center rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDeleting ? "Deleting..." : "Delete Template"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteTemplateModal;