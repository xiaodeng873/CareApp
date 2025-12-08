import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getBedByQrCodeId, getPatientByBedId } from '../lib/database';

// Conditionally import camera for native platforms
let CameraView: any = null;
let useCameraPermissions: any = null;
if (Platform.OS !== 'web') {
  const cameraModule = require('expo-camera');
  CameraView = cameraModule.CameraView;
  useCameraPermissions = cameraModule.useCameraPermissions;
}

const ScanScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
    if (scanned || loading) return;
    
    setScanned(true);
    setLoading(true);

    try {
      // 解析 QR Code 數據
      const qrData = JSON.parse(data);
      
      if (qrData.type !== 'bed' || !qrData.qr_code_id) {
        Alert.alert('無效的 QR Code', '請掃描有效的床位 QR Code', [
          { text: '確定', onPress: () => setScanned(false) }
        ]);
        setLoading(false);
        return;
      }

      // 查找床位
      const bed = await getBedByQrCodeId(qrData.qr_code_id);
      
      if (!bed) {
        Alert.alert('找不到床位', '無法找到對應的床位資訊', [
          { text: '確定', onPress: () => setScanned(false) }
        ]);
        setLoading(false);
        return;
      }

      // 查找床位上的院友
      const patient = await getPatientByBedId(bed.id);
      
      if (!patient) {
        Alert.alert(
          '床位空置',
          `床位 ${bed.bed_number} 目前沒有在住院友`,
          [{ text: '確定', onPress: () => setScanned(false) }]
        );
        setLoading(false);
        return;
      }

      // 導航到護理記錄頁面
      navigation.navigate('CareRecords', { patient });
      
    } catch (error) {
      console.error('QR Code 解析失敗:', error);
      Alert.alert('掃描失敗', 'QR Code 格式無效，請重試', [
        { text: '確定', onPress: () => setScanned(false) }
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Ionicons name="camera-outline" size={64} color="#9ca3af" />
        <Text style={styles.permissionTitle}>需要相機權限</Text>
        <Text style={styles.permissionText}>
          請允許存取相機以掃描床位 QR Code
        </Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>允許存取相機</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
      >
        <View style={styles.overlay}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>掃描床位 QR Code</Text>
            <Text style={styles.headerSubtitle}>將 QR Code 置於框內</Text>
          </View>

          <View style={styles.scanArea}>
            <View style={styles.cornerTL} />
            <View style={styles.cornerTR} />
            <View style={styles.cornerBL} />
            <View style={styles.cornerBR} />
            {loading && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color="#ffffff" />
                <Text style={styles.loadingText}>處理中...</Text>
              </View>
            )}
          </View>

          {scanned && !loading && (
            <TouchableOpacity
              style={styles.rescanButton}
              onPress={() => setScanned(false)}
            >
              <Ionicons name="refresh" size={20} color="#ffffff" />
              <Text style={styles.rescanButtonText}>重新掃描</Text>
            </TouchableOpacity>
          )}
        </View>
      </CameraView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 60,
  },
  header: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#d1d5db',
  },
  scanArea: {
    width: 280,
    height: 280,
    position: 'relative',
  },
  cornerTL: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 40,
    height: 40,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#2563eb',
    borderTopLeftRadius: 8,
  },
  cornerTR: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 40,
    height: 40,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderColor: '#2563eb',
    borderTopRightRadius: 8,
  },
  cornerBL: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 40,
    height: 40,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#2563eb',
    borderBottomLeftRadius: 8,
  },
  cornerBR: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 40,
    height: 40,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderColor: '#2563eb',
    borderBottomRightRadius: 8,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  loadingText: {
    color: '#ffffff',
    marginTop: 12,
    fontSize: 16,
  },
  rescanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563eb',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  rescanButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    padding: 24,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: 16,
    marginBottom: 8,
  },
  permissionText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  permissionButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  permissionButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ScanScreen;
