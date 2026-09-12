import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  Trash2,
  Eye,
  FileVideo,
  X,
  Clock,
  User,
  HardDrive,
} from 'lucide-react-native';
import { InspectionEvidence } from '../../services/types';
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
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [imageError, setImageError] = useState<boolean>(false);

  const mediaUrl = resolveMediaUrl(evidence.presigned_url || evidence.storage_url);
  const isVideo = evidence.file_type === 'VIDEO';

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes) return null;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleDelete = () => {
    if (disabled || !onDelete) return;

    Alert.alert(
      'Eliminar Evidencia',
      '¿Está seguro de que desea eliminar este registro multimedia? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsDeleting(true);
              await onDelete(evidence.id);
              setModalVisible(false);
            } catch (err: any) {
              Alert.alert('Error', err?.response?.data?.detail || 'No se pudo eliminar la evidencia.');
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <>
      <View style={styles.thumbnailWrapper}>
        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.thumbnailContainer}
          onPress={() => setModalVisible(true)}
        >
          {isVideo ? (
            <View style={styles.videoPlaceholder}>
              <FileVideo size={24} color="#2563eb" />
              <Text style={styles.videoLabel}>Video</Text>
            </View>
          ) : mediaUrl && !imageError ? (
            <Image
              source={{ uri: mediaUrl }}
              style={styles.thumbnailImage}
              resizeMode="cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <View style={styles.placeholderContainer}>
              <Eye size={20} color="#64748b" />
            </View>
          )}

          {/* Badge de tipo de archivo */}
          <View style={styles.badgeOverlay}>
            <Text style={styles.badgeText}>{isVideo ? 'MP4' : 'FOTO'}</Text>
          </View>
        </TouchableOpacity>

        {/* Botón rápido de borrado (solo si la inspección no está cerrada) */}
        {!disabled && onDelete && (
          <TouchableOpacity
            style={styles.deleteQuickBtn}
            onPress={handleDelete}
            disabled={isDeleting}
            accessibilityLabel="Eliminar evidencia"
          >
            {isDeleting ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Trash2 size={12} color="#ffffff" />
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Modal de Previsualización */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {/* Header del Modal */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {isVideo ? 'Evidencia de Video' : 'Evidencia Fotográfica'}
                </Text>
                <Text style={styles.modalSubtitle}>ID #{evidence.id}</Text>
              </View>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.closeBtn}
              >
                <X size={20} color="#475569" />
              </TouchableOpacity>
            </View>

            {/* Contenido Visual */}
            <View style={styles.modalBody}>
              {isVideo ? (
                <View style={styles.modalVideoBox}>
                  <FileVideo size={48} color="#2563eb" />
                  <Text style={styles.modalVideoText}>Video registrado</Text>
                  <Text style={styles.modalVideoSubtext}>
                    {evidence.storage_url}
                  </Text>
                </View>
              ) : mediaUrl && !imageError ? (
                <Image
                  source={{ uri: mediaUrl }}
                  style={styles.modalImage}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.modalEmptyBox}>
                  <Text style={styles.modalEmptyText}>No se pudo cargar la previsualización</Text>
                </View>
              )}
            </View>

            {/* Metadatos Clínicos */}
            <View style={styles.metadataContainer}>
              <View style={styles.metaRow}>
                <Clock size={14} color="#64748b" />
                <Text style={styles.metaText}>
                  Fecha: {new Date(evidence.uploaded_at).toLocaleString()}
                </Text>
              </View>

              {evidence.uploaded_by && (
                <View style={styles.metaRow}>
                  <User size={14} color="#64748b" />
                  <Text style={styles.metaText}>
                    Auditor: {evidence.uploaded_by}
                  </Text>
                </View>
              )}

              {evidence.file_size_bytes && (
                <View style={styles.metaRow}>
                  <HardDrive size={14} color="#64748b" />
                  <Text style={styles.metaText}>
                    Tamaño: {formatFileSize(evidence.file_size_bytes)}
                  </Text>
                </View>
              )}
            </View>

            {/* Acciones */}
            <View style={styles.modalActions}>
              {!disabled && onDelete && (
                <TouchableOpacity
                  style={styles.deleteModalBtn}
                  onPress={handleDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <ActivityIndicator size="small" color="#ef4444" />
                  ) : (
                    <>
                      <Trash2 size={16} color="#ef4444" />
                      <Text style={styles.deleteModalBtnText}>Eliminar Evidencia</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.modalCloseDoneBtn}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.modalCloseDoneText}>Cerrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  thumbnailWrapper: {
    position: 'relative',
    marginRight: 8,
    marginBottom: 8,
  },
  thumbnailContainer: {
    width: 68,
    height: 68,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  videoPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  videoLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#2563eb',
    marginTop: 2,
  },
  placeholderContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeOverlay: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#ffffff',
  },
  deleteQuickBtn: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#ef4444',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
    elevation: 3,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748b',
  },
  closeBtn: {
    padding: 4,
  },
  modalBody: {
    height: 260,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImage: {
    width: '100%',
    height: '100%',
  },
  modalVideoBox: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalVideoText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 15,
    marginTop: 8,
  },
  modalVideoSubtext: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
  },
  modalEmptyBox: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalEmptyText: {
    color: '#94a3b8',
    fontSize: 13,
  },
  metadataContainer: {
    padding: 14,
    backgroundColor: '#f8fafc',
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaText: {
    fontSize: 12,
    color: '#475569',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  deleteModalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fca5a5',
    backgroundColor: '#fef2f2',
  },
  deleteModalBtnText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '600',
  },
  modalCloseDoneBtn: {
    marginLeft: 'auto',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#2563eb',
  },
  modalCloseDoneText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
});
