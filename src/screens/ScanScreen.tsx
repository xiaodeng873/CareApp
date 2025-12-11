import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { getBedByQrCodeId, getPatientByBedId } from '../lib/database';

const ScanScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraActive, setCameraActive] = useState(true);

  const handleQRCodeScan = async (data: string) => {
    setLoading(true);
    setCameraActive(false); // 暫停掃描以防止重複掃描
    try {
      // 嘗試解析 QR Code 資料
      let qrData: any;
      try {
        qrData = JSON.parse(data);
      } catch {
        // 如果不是 JSON，假設是直接的 QR Code ID
        qrData = { type: 'bed', qr_code_id: data };
      }
      
      if (!qrData.qr_code_id && !data.trim()) {
        Alert.alert('無效的 QR Code', '請掃描有效的床位 QR Code');
        setCameraActive(true);
        return;
      }

      const qrCodeId = qrData.qr_code_id || data.trim();
      
      // 查詢床位資訊
      const bed = await getBedByQrCodeId(qrCodeId);
      if (!bed) {
        Alert.alert('找不到床位', `QR Code ID: ${qrCodeId}\n\n無法找到對應的床位資訊`);
        setCameraActive(true);
        return;
      }

      // 查詢該床位上的院友
      const patient = await getPatientByBedId(bed.id);
      if (!patient) {
        Alert.alert('床位空置', `床位 ${bed.bed_number} 目前沒有在住院友`);
        setCameraActive(true);
        return;
      }

      // 成功找到院友，導航到 Home tab 下的 CareRecords（nested）
      navigation.navigate('Home', { screen: 'CareRecords', params: { patient } });
    } catch (error) {
      console.error('QR Code 掃描失敗:', error);
      Alert.alert('掃描失敗', error instanceof Error ? error.message : 'QR Code 格式無效或資料庫查詢失敗');
      setCameraActive(true);
    } finally {
      setLoading(false);
    }
  };

  // 要求相機權限
  useEffect(() => {
    if (Platform.OS !== 'web' && !permission) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  // 當螢幕重新獲得焦點時重新啟用相機
  useFocusEffect(
    React.useCallback(() => {
      setCameraActive(true);
      return () => setCameraActive(false);
    }, [])
  );

  // Web 版本介面
  if (Platform.OS === 'web') {
    return (
      <View style={styles.webContainer}>
        <View style={styles.webContent}>
          <View style={styles.iconCircle}>
            <Ionicons name="qr-code" size={48} color="#2563eb" />
          </View>
          <Text style={styles.webTitle}>QR Code 掃描</Text>
          <Text style={styles.webSubtitle}>在手機 App 上使用相機掃描床位 QR Code</Text>
          
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>或</Text>
            <View style={styles.dividerLine} />
          </View>

          <Text style={styles.manualTitle}>從院友列表選擇</Text>
          <Pressable
            style={styles.listButton}
            onPress={() => navigation.navigate('Home')}
          >
            <Ionicons name="list" size={24} color="#2563eb" />
            <Text style={styles.listButtonText}>前往院友列表</Text>
          </Pressable>

          <View style={styles.tipBox}>
            <Ionicons name="information-circle" size={20} color="#2563eb" />
            <Text style={styles.tipText}>
              提示：在真實手機上使用此 App 可以直接掃描 QR Code
            </Text>
          </View>
        </View>
      </View>
    );
  }

  // 原生平台介面 - 相機掃描
  if (!permission) {
    return (
      <View style={styles.container}>
        <View style={styles.nativeContent}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.webSubtitle}>正在請求相機權限...</Text>
        </View>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <View style={styles.nativeContent}>
          <View style={styles.iconCircle}>
            <Ionicons name="camera-off" size={48} color="#dc2626" />
          </View>
          <Text style={styles.webTitle}>需要相機權限</Text>
          <Text style={styles.webSubtitle}>此應用程式需要存取您的相機以掃描 QR Code</Text>
          <Pressable
            style={styles.scanButton}
            onPress={requestPermission}
          >
            <Ionicons name="camera" size={24} color="#ffffff" />
            <Text style={styles.scanButtonText}>授予相機權限</Text>
          </Pressable>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>或</Text>
            <View style={styles.dividerLine} />
          </View>

          <Text style={styles.manualTitle}>從院友列表選擇</Text>
          <Pressable
            style={styles.listButton}
            onPress={() => navigation.navigate('Home')}
          >
            <Ionicons name="list" size={24} color="#2563eb" />
            <Text style={styles.listButtonText}>前往院友列表</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {cameraActive && (
        <CameraView
          style={styles.camera}
          onBarcodeScanned={({ data }) => {
            if (cameraActive) {
              handleQRCodeScan(data);
            }
          }}
          barcodeScannerSettings={{
            barcodeTypes: ['qr'],
          }}
        >
          <View style={styles.overlay}>
            <View style={styles.scanFrame}>
              <Ionicons name="qr-code" size={120} color="#ffffff" />
              <Text style={styles.scanText}>將二維碼置於框內</Text>
            </View>
          </View>
        </CameraView>
      )}

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#ffffff" />
          <Text style={styles.loadingText}>正在識別床位...</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  webContainer: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  webContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 32,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  nativeContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#dbeafe',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  webTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  webSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  dividerText: {
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#9ca3af',
  },
  manualTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  inputContainer: {
    flexDirection: 'row',
    width: '100%',
    marginBottom: 16,
  },
  input: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1f2937',
    marginRight: 12,
  },
  searchButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchButtonDisabled: {
    backgroundColor: '#93c5fd',
  },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    padding: 12,
    width: '100%',
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    color: '#1e40af',
    marginLeft: 8,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563eb',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  scanButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  listButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dbeafe',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    width: '100%',
  },
  listButtonText: {
    color: '#2563eb',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: 280,
    height: 280,
    borderWidth: 2,
    borderColor: '#4ade80',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  scanText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingText: {
    color: '#ffffff',
    fontSize: 16,
    marginTop: 16,
    fontWeight: '500',
  },
  bottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderTopColor: '#e5e7eb',
    borderTopWidth: 1,
    paddingBottom: 8,
    paddingTop: 8,
  },
  bottomButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
  },
  bottomButtonText: {
    fontSize: 12,
    color: '#2563eb',
    marginTop: 4,
    fontWeight: '500',
  },
});

export default ScanScreen;
