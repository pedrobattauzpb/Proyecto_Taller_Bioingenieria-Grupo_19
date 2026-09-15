import React, { useState } from 'react';
import { Trash2, Eye, FileVideo, X, Clock, User, HardDrive, Loader2 } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import type { InspectionEvidence } from '../../services/types';
import { resolveMediaUrl } from '../../services/api';

interface EvidenceThumbnailProps {
  evidence: InspectionEvidence;
  onDelete?: (id: number) => Promise<void> | void;
  disabled?: boolean;
}

export const EvidenceThumbnail: React.FC<EvidenceThumbnailProps> = ({
  evidence,
  onDelete,
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [imageError, setImageError] = useState(false);

  const mediaUrl = resolveMediaUrl(evidence.presigned_url || evidence.storage_url);
  const isVideo = evidence.file_type === 'VIDEO';

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes) return null;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const executeDelete = async () => {
    if (!onDelete) return;
    try {
      setIsDeleting(true);
      await onDelete(evidence.id);
      setOpen(false);
    } catch (err: any) {
      const detail = err?.response?.data?.detail || 'No se pudo eliminar la evidencia.';
      window.alert(`Error: ${detail}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDelete = () => {
    if (disabled || !onDelete) return;
    const confirmed = window.confirm(
      '¿Está seguro de que desea eliminar este registro multimedia? Esta acción no se puede deshacer.'
    );
    if (confirmed) {
      executeDelete();
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border-1.5 border-slate-200 bg-slate-100 cursor-pointer group hover:border-blue-400 hover:shadow-xs transition-all">
          {isVideo ? (
            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-800 text-white">
              <FileVideo className="w-6 h-6 text-blue-400 mb-1" />
              <span className="text-[9px] font-black tracking-wider uppercase text-blue-300">VIDEO</span>
            </div>
          ) : imageError || !mediaUrl ? (
            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 text-slate-400 text-xs">
              <Eye className="w-5 h-5 mb-0.5" />
              <span className="text-[9px]">Foto</span>
            </div>
          ) : (
            <img
              src={mediaUrl}
              alt="Evidencia técnica"
              onError={() => setImageError(true)}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            />
          )}

          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
            <Eye className="w-4 h-4" />
          </div>
        </div>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 animate-in fade-in" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 z-50 flex flex-col gap-4">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100">
            <Dialog.Title className="text-base font-bold text-slate-900">
              Visualización de Evidencia Técnica
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </Dialog.Close>
          </div>

          <div className="w-full bg-slate-950 rounded-xl overflow-hidden flex items-center justify-center min-h-[260px] max-h-[500px]">
            {isVideo && mediaUrl ? (
              <video
                src={mediaUrl}
                controls
                className="max-h-[480px] w-auto max-w-full"
              />
            ) : mediaUrl ? (
              <img
                src={mediaUrl}
                alt="Detalle de evidencia"
                className="max-h-[480px] w-auto max-w-full object-contain"
              />
            ) : (
              <p className="text-slate-400 text-sm">URL no disponible</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 py-2 px-3 bg-slate-50 rounded-xl text-xs text-slate-600 border border-slate-200">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>{new Date(evidence.uploaded_at).toLocaleString()}</span>
            </div>
            {evidence.uploaded_by && (
              <div className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate">{evidence.uploaded_by}</span>
              </div>
            )}
            {evidence.file_size_bytes && (
              <div className="flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{formatFileSize(evidence.file_size_bytes)}</span>
              </div>
            )}
          </div>

          {!disabled && onDelete && (
            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="inline-flex items-center gap-2 px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl border border-rose-200 transition-colors cursor-pointer"
              >
                {isDeleting ? (
                  <Loader2 className="w-4 h-4 animate-spin text-rose-600" />
                ) : (
                  <Trash2 className="w-4 h-4 text-rose-600" />
                )}
                <span>Eliminar Evidencia</span>
              </button>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
