import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Image as ImageIcon, Video, AlertCircle, RefreshCw } from 'lucide-react-native';
import { apiService } from '../../services/api';
import { InspectionEvidence } from '../../services/types';

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
  const [lastSelectedAsset, setLastSelectedAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);

  const requestPermissions = async (camera: boolean) => {
    if (Platform.OS === 'web') return true;
    if (camera) {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permiso Denegado',
          'Se requiere permiso de cámara para capturar evidencia técnica de gases medicinales.'
        );
        return false;
      }
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permiso Denegado',
          'Se requiere permiso de galería para adjuntar evidencia multimedia.'
        );
        return false;
      }
    }
    return true;
  };

  const uploadAsset = async (asset: ImagePicker.ImagePickerAsset) => {
    try {
      setUploadState('uploading');
      setErrorMessage(null);
      setLastSelectedAsset(asset);

      const fileName =
        asset.fileName ||
        `evidence_${Date.now()}.${asset.type === 'video' ? 'mp4' : 'jpg'}`;
      const mimeType =
        asset.mimeType ||
        (asset.type === 'video' ? 'video/mp4' : 'image/jpeg');

      const uploaded = await apiService.uploadEvidence(
        inspectionId,
        {
          uri: asset.uri,
          name: fileName,
          type: mimeType,
        },
        itemId,
        inspectorName
      );

      setUploadState('success');
      setLastSelectedAsset(null);
      onEvidenceUploaded(uploaded);

      // Limpiar estado de éxito después de 2 segundos
      setTimeout(() => {
        setUploadState('idle');
      }, 2000);
    } catch (err: any) {
      console.error('Error subiendo evidencia:', err);
      setUploadState('error');
      const detail =
        err?.response?.data?.detail ||
        'Error al cargar el archivo de evidencia. Verifique el tamaño o su conexión.';
      setErrorMessage(detail);
    }
  };

  const pickFromCamera = async () => {
    if (disabled || uploadState === 'uploading') return;
    const hasPermission = await requestPermissions(true);
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images', 'videos'],
        allowsEditing: false,
        quality: 0.7, // Compresión optimizada para redes hospitalarias
        videoMaxDuration: 60, // Límite de 60s
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        await uploadAsset(result.assets[0]);
      }
    } catch (err) {
      console.error('Error abriendo cámara:', err);
      Alert.alert('Error', 'No se pudo iniciar la cámara en este dispositivo.');
    }
  };

  const pickFromLibrary = async () => {
    if (disabled || uploadState === 'uploading') return;
    const hasPermission = await requestPermissions(false);
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsEditing: false,
        quality: 0.7, // Compresión optimizada
        videoMaxDuration: 60,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        await uploadAsset(result.assets[0]);
      }
    } catch (err) {
      console.error('Error abriendo galería:', err);
      Alert.alert('Error', 'No se pudo acceder a la galería multimedia.');
    }
  };

  const handleRetry = () => {
    if (lastSelectedAsset) {
      uploadAsset(lastSelectedAsset);
    }
  };

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        {uploadState === 'uploading' ? (
          <View style={styles.compactLoading}>
            <ActivityIndicator size="small" color="#2563eb" />
            <Text style={styles.compactLoadingText}>Subiendo...</Text>
          </View>
        ) : uploadState === 'error' ? (
          <View style={styles.compactErrorRow}>
            <Text style={styles.compactErrorText} numberOfLines={1}>
              {errorMessage || 'Error al subir'}
            </Text>
            {lastSelectedAsset && (
              <TouchableOpacity
                onPress={handleRetry}
                style={styles.retryBadge}
              >
                <RefreshCw size={12} color="#dc2626" />
                <Text style={styles.retryBadgeText}>Reintentar</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.compactBtnGroup}>
            <TouchableOpacity
              onPress={pickFromCamera}
              disabled={disabled}
              style={[styles.compactBtn, disabled && styles.btnDisabled]}
            >
              <Camera size={13} color={disabled ? '#94a3b8' : '#2563eb'} />
              <Text style={[styles.compactBtnText, disabled && styles.btnTextDisabled]}>
                Cámara
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={pickFromLibrary}
              disabled={disabled}
              style={[styles.compactBtn, disabled && styles.btnDisabled]}
            >
              <ImageIcon size={13} color={disabled ? '#94a3b8' : '#475569'} />
              <Text style={[styles.compactBtnText, disabled && styles.btnTextDisabled]}>
                Galería
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Botones de acción */}
      <View style={styles.buttonGroup}>
        <TouchableOpacity
          onPress={pickFromCamera}
          disabled={disabled || uploadState === 'uploading'}
          style={[
            styles.actionButton,
            styles.cameraButton,
            (disabled || uploadState === 'uploading') && styles.btnDisabled,
          ]}
        >
          <Camera size={16} color={disabled ? '#94a3b8' : '#ffffff'} />
          <Text
            style={[
              styles.actionButtonText,
              styles.cameraButtonText,
              disabled && styles.btnTextDisabled,
            ]}
          >
            Tomar Foto / Video
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={pickFromLibrary}
          disabled={disabled || uploadState === 'uploading'}
          style={[
            styles.actionButton,
            styles.libraryButton,
            (disabled || uploadState === 'uploading') && styles.btnDisabled,
          ]}
        >
          <ImageIcon size={16} color={disabled ? '#94a3b8' : '#334155'} />
          <Text
            style={[
              styles.actionButtonText,
              styles.libraryButtonText,
              disabled && styles.btnTextDisabled,
            ]}
          >
            Adjuntar Archivo
          </Text>
        </TouchableOpacity>
      </View>

      {/* Estado: subiendo */}
      {uploadState === 'uploading' && (
        <View style={styles.statusBox}>
          <ActivityIndicator size="small" color="#2563eb" />
          <Text style={styles.statusUploadingText}>
            Comprimiendo y subiendo evidencia multimedia...
          </Text>
        </View>
      )}

      {/* Estado: error con opción de reintento */}
      {uploadState === 'error' && (
        <View style={styles.errorBox}>
          <View style={styles.errorRow}>
            <AlertCircle size={16} color="#ef4444" />
            <Text style={styles.errorText}>
              {errorMessage || 'Fallo en la subida de evidencia multimedia.'}
            </Text>
          </View>
          {lastSelectedAsset && (
            <TouchableOpacity
              onPress={handleRetry}
              style={styles.retryButton}
            >
              <RefreshCw size={14} color="#ffffff" />
              <Text style={styles.retryButtonText}>Reintentar Subida</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Estado: éxito temporal */}
      {uploadState === 'success' && (
        <View style={styles.successBox}>
          <Text style={styles.successText}>✓ Evidencia adjuntada exitosamente</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 6,
    gap: 8,
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    flex: 1,
    minWidth: 150,
    justifyContent: 'center',
  },
  cameraButton: {
    backgroundColor: '#2563eb',
  },
  libraryButton: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  cameraButtonText: {
    color: '#ffffff',
  },
  libraryButtonText: {
    color: '#334155',
  },
  btnDisabled: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
    opacity: 0.6,
  },
  btnTextDisabled: {
    color: '#94a3b8',
  },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#eff6ff',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  statusUploadingText: {
    fontSize: 12,
    color: '#1e40af',
    fontWeight: '500',
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fca5a5',
    gap: 8,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    fontSize: 12,
    color: '#b91c1c',
    flex: 1,
    fontWeight: '500',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#dc2626',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  retryButtonText: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '600',
  },
  successBox: {
    backgroundColor: '#ecfdf5',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    alignItems: 'center',
  },
  successText: {
    fontSize: 12,
    color: '#047857',
    fontWeight: '600',
  },
  // Estilos Compactos para ChecklistCard
  compactContainer: {
    marginVertical: 4,
  },
  compactBtnGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  compactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 8,
    backgroundColor: '#f8fafc',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  compactBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  compactLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  compactLoadingText: {
    fontSize: 11,
    color: '#2563eb',
    fontWeight: '500',
  },
  compactErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  compactErrorText: {
    fontSize: 11,
    color: '#dc2626',
    flex: 1,
  },
  retryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fee2e2',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  retryBadgeText: {
    fontSize: 10,
    color: '#dc2626',
    fontWeight: '700',
  },
});
