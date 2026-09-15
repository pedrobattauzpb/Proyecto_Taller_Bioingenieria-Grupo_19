import React, { useState, useRef } from 'react';
import { Camera, Image as ImageIcon, AlertCircle, Loader2 } from 'lucide-react';
import { apiService } from '../../services/api';
import type { InspectionEvidence } from '../../services/types';
import { Button } from '../ui/Button';

interface MediaUploaderProps {
  inspectionId: number;
  itemId?: number;
  inspectorName?: string;
  disabled?: boolean;
  onEvidenceUploaded: (evidence: InspectionEvidence) => void;
  compact?: boolean;
}

type UploadState = 'idle' | 'uploading' | 'error' | 'success';

export const MediaUploader: React.FC<MediaUploaderProps> = ({
  inspectionId,
  itemId,
  inspectorName,
  disabled = false,
  onEvidenceUploaded,
  compact = false,
}) => {
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileSelected = async (file: File) => {
    try {
      setUploadState('uploading');
      setErrorMessage(null);

      // Validación previa de tamaño (25MB máx)
      if (file.size > 25 * 1024 * 1024) {
        throw new Error('El archivo excede el tamaño máximo permitido de 25 MB.');
      }

      const uploaded = await apiService.uploadEvidence(
        inspectionId,
        file,
        file.name,
        itemId,
        inspectorName
      );

      setUploadState('success');
      onEvidenceUploaded(uploaded);

      setTimeout(() => {
        setUploadState('idle');
      }, 2500);
    } catch (err: any) {
      console.error('Error subiendo evidencia:', err);
      setUploadState('error');
      const detail =
        err?.response?.data?.detail ||
        err?.message ||
        'Error al cargar el archivo de evidencia. Verifique el tamaño o su conexión.';
      setErrorMessage(detail);
    }
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      handleFileSelected(file);
      e.target.value = '';
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*,video/*"
          capture="environment"
          onChange={onInputChange}
          className="hidden"
          disabled={disabled || uploadState === 'uploading'}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          onChange={onInputChange}
          className="hidden"
          disabled={disabled || uploadState === 'uploading'}
        />

        <Button
          size="sm"
          variant="outline"
          disabled={disabled || uploadState === 'uploading'}
          icon={uploadState === 'uploading' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
          title={uploadState === 'uploading' ? 'Subiendo...' : 'Capturar'}
          onClick={() => cameraInputRef.current?.click()}
        />

        <Button
          size="sm"
          variant="ghost"
          disabled={disabled || uploadState === 'uploading'}
          icon={<ImageIcon className="w-3.5 h-3.5" />}
          title="Galería"
          onClick={() => fileInputRef.current?.click()}
        />

        {uploadState === 'error' && (
          <span className="text-xs text-rose-600 font-medium">{errorMessage}</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*,video/*"
        capture="environment"
        onChange={onInputChange}
        className="hidden"
        disabled={disabled || uploadState === 'uploading'}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        onChange={onInputChange}
        className="hidden"
        disabled={disabled || uploadState === 'uploading'}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="primary"
          disabled={disabled || uploadState === 'uploading'}
          icon={uploadState === 'uploading' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
          title={uploadState === 'uploading' ? 'Subiendo...' : 'Cámara / Foto Directa'}
          onClick={() => cameraInputRef.current?.click()}
        />

        <Button
          size="sm"
          variant="secondary"
          disabled={disabled || uploadState === 'uploading'}
          icon={<ImageIcon className="w-3.5 h-3.5" />}
          title="Examinar Archivos / Galería"
          onClick={() => fileInputRef.current?.click()}
        />
      </div>

      {uploadState === 'uploading' && (
        <div className="flex items-center gap-2 text-xs text-blue-700 font-medium mt-1">
          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
          <span>Subiendo archivo al almacenamiento seguro...</span>
        </div>
      )}

      {uploadState === 'success' && (
        <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold mt-1">
          <span>✅ Evidencia multimedia adjuntada exitosamente.</span>
        </div>
      )}

      {uploadState === 'error' && (
        <div className="flex items-start gap-1.5 text-xs text-rose-700 font-medium mt-1">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
          <div className="flex-1">
            <span>{errorMessage}</span>
          </div>
        </div>
      )}
    </div>
  );
};
