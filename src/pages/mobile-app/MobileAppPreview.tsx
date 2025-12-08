import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import {
  Home,
  QrCode,
  Settings,
  Search,
  ChevronRight,
  ChevronLeft,
  User,
  LogOut,
  Info,
  Clipboard,
  Droplets,
  Shield,
  RotateCcw,
  Activity,
  GraduationCap,
  Check,
  X,
  RefreshCw,
  Camera,
  ArrowLeft
} from 'lucide-react';

// Types
interface Patient {
  院友id: number;
  床號: string;
  中文姓名: string;
  中文姓氏: string;
  中文名字: string;
  性別: '男' | '女';
  出生日期?: string;
  院友相片?: string;
  感染控制?: string[];
  護理等級?: string;
  在住狀態?: string;
  bed_id?: string;
}

interface PatrolRound {
  id: string;
  patient_id: number;
  patrol_date: string;
  patrol_time: string;
  scheduled_time: string;
  recorder: string;
  notes?: string;
}

interface DiaperChangeRecord {
  id: string;
  patient_id: number;
  change_date: string;
  time_slot: string;
  has_urine: boolean;
  has_stool: boolean;
  has_none: boolean;
  recorder: string;
}

interface PositionChangeRecord {
  id: string;
  patient_id: number;
  change_date: string;
  scheduled_time: string;
  position: '左' | '平' | '右';
  recorder: string;
}

interface RestraintObservationRecord {
  id: string;
  patient_id: number;
  observation_date: string;
  observation_time: string;
  scheduled_time: string;
  observation_status: 'N' | 'P' | 'S';
  recorder: string;
}

type TabType = 'home' | 'scan' | 'settings';
type CareTabType = 'patrol' | 'diaper' | 'intake_output' | 'restraint' | 'position' | 'toilet_training';

const TIME_SLOTS = ['07:00', '09:00', '11:00', '13:00', '15:00', '17:00', '19:00', '21:00', '23:00', '01:00', '03:00', '05:00'];
const DIAPER_SLOTS = ['7AM-10AM', '11AM-2PM', '3PM-6PM', '7PM-10PM', '11PM-2AM', '3AM-6AM'];

const MobileAppPreview: React.FC = () => {
  const { user, displayName, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [activeCareTab, setActiveCareTab] = useState<CareTabType>('patrol');
  
  // Data states
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [manualBedInput, setManualBedInput] = useState('');
  
  // Care records
  const [patrolRounds, setPatrolRounds] = useState<PatrolRound[]>([]);
  const [diaperRecords, setDiaperRecords] = useState<DiaperChangeRecord[]>([]);
  const [positionRecords, setPositionRecords] = useState<PositionChangeRecord[]>([]);
  const [restraintRecords, setRestraintRecords] = useState<RestraintObservationRecord[]>([]);
  
  // Week navigation
  const [weekStartDate, setWeekStartDate] = useState(() => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(now.setDate(diff));
  });

  const weekDates = useMemo(() => {
    const dates: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStartDate);
      date.setDate(weekStartDate.getDate() + i);
      dates.push(date);
    }
    return dates;
  }, [weekStartDate]);

  const formatDate = (date: Date) => date.toISOString().split('T')[0];

  // Load patients
  useEffect(() => {
    const loadPatients = async () => {
      try {
        const { data, error } = await supabase
          .from('院友主表')
          .select('*')
          .eq('在住狀態', '在住')
          .order('床號', { ascending: true });
        if (!error && data) setPatients(data);
      } catch (e) {
        console.error('Load patients error:', e);
      } finally {
        setLoading(false);
      }
    };
    loadPatients();
  }, []);

  // Load care records when patient selected
  useEffect(() => {
    if (!selectedPatient) return;
    
    const loadRecords = async () => {
      const startDate = formatDate(weekDates[0]);
      const endDate = formatDate(weekDates[6]);
      
      const [patrol, diaper, position, restraint] = await Promise.all([
        supabase.from('patrol_rounds').select('*').eq('patient_id', selectedPatient.院友id).gte('patrol_date', startDate).lte('patrol_date', endDate),
        supabase.from('diaper_change_records').select('*').eq('patient_id', selectedPatient.院友id).gte('change_date', startDate).lte('change_date', endDate),
        supabase.from('position_change_records').select('*').eq('patient_id', selectedPatient.院友id).gte('change_date', startDate).lte('change_date', endDate),
        supabase.from('restraint_observation_records').select('*').eq('patient_id', selectedPatient.院友id).gte('observation_date', startDate).lte('observation_date', endDate),
      ]);
      
      if (patrol.data) setPatrolRounds(patrol.data);
      if (diaper.data) setDiaperRecords(diaper.data);
      if (position.data) setPositionRecords(position.data);
      if (restraint.data) setRestraintRecords(restraint.data);
    };
    
    loadRecords();
  }, [selectedPatient, weekDates]);

  const filteredPatients = patients.filter(p => 
    searchQuery === '' ||
    p.中文姓名.includes(searchQuery) ||
    p.床號.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const calculateAge = (birthDate?: string) => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  };

  const handleSearch = () => {
    if (!manualBedInput.trim()) return;
    const found = patients.find(p => 
      p.床號.toLowerCase() === manualBedInput.toLowerCase() ||
      p.中文姓名.includes(manualBedInput)
    );
    if (found) {
      setSelectedPatient(found);
      setManualBedInput('');
    } else {
      alert('找不到符合的院友');
    }
  };

  // Render Home Tab - Patient List
  const renderHomeTab = () => (
    <div className="flex flex-col h-full bg-gray-100">
      <div className="bg-white px-4 py-3 border-b">
        <h1 className="text-xl font-bold text-gray-900">院友列表</h1>
        <p className="text-sm text-gray-500">共 {filteredPatients.length} 位在住院友</p>
      </div>
      
      <div className="px-4 py-3">
        <div className="flex items-center bg-white rounded-xl border px-3 py-2">
          <Search className="w-5 h-5 text-gray-400 mr-2" />
          <input
            type="text"
            placeholder="搜尋院友姓名、床號..."
            className="flex-1 outline-none text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')}>
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredPatients.length === 0 ? (
          <div className="text-center py-12">
            <User className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">{searchQuery ? '找不到符合的院友' : '暫無在住院友'}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredPatients.map((patient) => (
              <button
                key={patient.院友id}
                onClick={() => setSelectedPatient(patient)}
                className="w-full bg-white rounded-xl p-4 flex items-center shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mr-3 overflow-hidden">
                  {patient.院友相片 ? (
                    <img src={patient.院友相片} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-6 h-6 text-gray-400" />
                  )}
                </div>
                <div className="flex-1 text-left">
                  <div className="flex items-center">
                    <span className="font-semibold text-gray-900">{patient.中文姓名}</span>
                    <span className={`ml-2 px-2 py-0.5 rounded text-xs ${patient.性別 === '男' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'}`}>
                      {patient.性別}
                    </span>
                  </div>
                  <p className="text-sm text-blue-600 font-medium">床號: {patient.床號}</p>
                  <div className="flex items-center text-xs text-gray-500 mt-1">
                    {calculateAge(patient.出生日期) && <span>{calculateAge(patient.出生日期)}歲</span>}
                    {patient.護理等級 && (
                      <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 rounded">{patient.護理等級}</span>
                    )}
                  </div>
                  {patient.感染控制 && patient.感染控制.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {patient.感染控制.map((item, idx) => (
                        <span key={idx} className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded border border-red-200">
                          {item}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // Render Scan Tab
  const renderScanTab = () => (
    <div className="flex flex-col h-full bg-gray-100 items-center justify-center p-6">
      <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-lg">
        <div className="w-24 h-24 mx-auto bg-blue-100 rounded-full flex items-center justify-center mb-6">
          <QrCode className="w-12 h-12 text-blue-600" />
        </div>
        <h2 className="text-xl font-bold text-center text-gray-900 mb-2">QR Code 掃描</h2>
        <p className="text-sm text-gray-500 text-center mb-6">在手機 App 上使用相機掃描床位 QR Code</p>
        
        <div className="flex items-center my-6">
          <div className="flex-1 h-px bg-gray-200"></div>
          <span className="px-4 text-sm text-gray-400">或</span>
          <div className="flex-1 h-px bg-gray-200"></div>
        </div>
        
        <p className="text-sm font-medium text-gray-700 mb-2">手動輸入床號/院友姓名</p>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="例如: A01 或 陳大明"
            className="flex-1 border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            value={manualBedInput}
            onChange={(e) => setManualBedInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button
            onClick={handleSearch}
            className="bg-blue-600 text-white px-4 rounded-xl hover:bg-blue-700 transition-colors"
          >
            <Search className="w-5 h-5" />
          </button>
        </div>
        
        <div className="mt-6 bg-blue-50 rounded-lg p-3 flex items-start">
          <Info className="w-5 h-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700">提示：在真實手機上使用此 App 可以直接掃描 QR Code</p>
        </div>
      </div>
    </div>
  );

  // Render Settings Tab
  const renderSettingsTab = () => (
    <div className="flex flex-col h-full bg-gray-100">
      <div className="bg-white py-8 flex flex-col items-center border-b">
        <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-3">
          <User className="w-10 h-10 text-blue-600" />
        </div>
        <h2 className="text-lg font-bold text-gray-900">{displayName || '未設定姓名'}</h2>
        <p className="text-sm text-gray-500">{user?.email}</p>
      </div>
      
      <div className="p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase mb-2">帳戶資訊</p>
        <div className="bg-white rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <span className="text-sm text-gray-600">電子郵件</span>
            <span className="text-sm text-gray-400">{user?.email}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-gray-600">顯示名稱</span>
            <span className="text-sm text-gray-400">{displayName || '未設定'}</span>
          </div>
        </div>
      </div>
      
      <div className="p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase mb-2">關於</p>
        <div className="bg-white rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <span className="text-sm text-gray-600">版本</span>
            <span className="text-sm text-gray-400">1.0.0</span>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-gray-600">系統</span>
            <span className="text-sm text-gray-400">Station C 護理記錄</span>
          </div>
        </div>
      </div>
      
      <div className="p-4">
        <button
          onClick={signOut}
          className="w-full bg-red-50 border border-red-200 text-red-600 font-semibold py-3 rounded-xl flex items-center justify-center hover:bg-red-100 transition-colors"
        >
          <LogOut className="w-5 h-5 mr-2" />
          登出
        </button>
      </div>
      
      <div className="text-center mt-auto pb-6">
        <p className="text-sm text-gray-400">Station C 護理記錄系統</p>
        <p className="text-xs text-gray-300">© 2025 All Rights Reserved</p>
      </div>
    </div>
  );

  // Render Care Records Screen
  const renderCareRecords = () => {
    if (!selectedPatient) return null;
    
    const careTabConfig = [
      { id: 'patrol' as CareTabType, label: '巡房', icon: Clipboard },
      { id: 'diaper' as CareTabType, label: '換片', icon: Droplets },
      { id: 'intake_output' as CareTabType, label: '出入量', icon: Activity },
      { id: 'restraint' as CareTabType, label: '約束', icon: Shield },
      { id: 'position' as CareTabType, label: '轉身', icon: RotateCcw },
      { id: 'toilet_training' as CareTabType, label: '如廁', icon: GraduationCap },
    ];
    
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];

    const renderTable = () => {
      const slots = activeCareTab === 'diaper' ? DIAPER_SLOTS : TIME_SLOTS;
      
      if (activeCareTab === 'intake_output' || activeCareTab === 'toilet_training') {
        return (
          <div className="flex-1 flex flex-col items-center justify-center py-12">
            <Activity className="w-16 h-16 text-gray-300 mb-4" />
            <p className="text-gray-500 font-medium">{activeCareTab === 'intake_output' ? '出入量記錄' : '如廁訓練記錄'}功能開發中</p>
            <p className="text-gray-400 text-sm">敬請期待</p>
          </div>
        );
      }
      
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="border px-2 py-2 sticky left-0 bg-gray-50 z-10 w-16">時段</th>
                {weekDates.map((date, idx) => (
                  <th key={idx} className="border px-1 py-2 min-w-[50px]">
                    <div>{date.getMonth()+1}/{date.getDate()}</div>
                    <div className="text-gray-400">({weekdays[date.getDay()]})</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slots.map((slot, slotIdx) => (
                <tr key={slot}>
                  <td className="border px-2 py-2 font-medium bg-gray-50 sticky left-0 z-10">{slot}</td>
                  {weekDates.map((date, dateIdx) => {
                    const dateStr = formatDate(date);
                    let record: any = null;
                    let content = null;
                    let bgColor = '';
                    
                    if (activeCareTab === 'patrol') {
                      record = patrolRounds.find(r => r.patrol_date === dateStr && r.scheduled_time === slot);
                      if (record) {
                        bgColor = 'bg-green-50';
                        content = (
                          <div className="text-center">
                            <Check className="w-4 h-4 text-green-600 mx-auto" />
                            <div className="text-gray-500 mt-0.5">{record.recorder}</div>
                          </div>
                        );
                      } else {
                        content = <span className="text-gray-300">待巡</span>;
                      }
                    } else if (activeCareTab === 'diaper') {
                      record = diaperRecords.find(r => r.change_date === dateStr && r.time_slot === slot);
                      if (record) {
                        bgColor = 'bg-blue-50';
                        content = (
                          <div className="text-center">
                            <div className="font-medium">
                              {record.has_urine && '小'}{record.has_urine && record.has_stool && '/'}{record.has_stool && '大'}{record.has_none && '無'}
                            </div>
                            <div className="text-gray-500 mt-0.5">{record.recorder}</div>
                          </div>
                        );
                      } else {
                        content = <span className="text-gray-300">待記錄</span>;
                      }
                    } else if (activeCareTab === 'position') {
                      record = positionRecords.find(r => r.change_date === dateStr && r.scheduled_time === slot);
                      const positions = ['左', '平', '右'];
                      const expected = positions[slotIdx % 3];
                      if (record) {
                        bgColor = 'bg-purple-50';
                        content = (
                          <div className="text-center">
                            <div className="font-bold text-purple-600">{record.position}</div>
                            <div className="text-gray-500 mt-0.5">{record.recorder}</div>
                          </div>
                        );
                      } else {
                        content = <span className="text-gray-300">[{expected}]</span>;
                      }
                    } else if (activeCareTab === 'restraint') {
                      record = restraintRecords.find(r => r.observation_date === dateStr && r.scheduled_time === slot);
                      if (record) {
                        const statusColors: Record<string, string> = { N: 'bg-green-50', P: 'bg-red-50', S: 'bg-yellow-50' };
                        const statusText: Record<string, string> = { N: '🟢N', P: '🔴P', S: '🟠S' };
                        bgColor = statusColors[record.observation_status] || '';
                        content = (
                          <div className="text-center">
                            <div className="font-medium">{statusText[record.observation_status]}</div>
                            <div className="text-gray-500 mt-0.5">{record.recorder}</div>
                          </div>
                        );
                      } else {
                        content = <span className="text-gray-300">待觀察</span>;
                      }
                    }
                    
                    return (
                      <td key={dateIdx} className={`border px-1 py-2 text-center ${bgColor}`}>
                        {content}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    };
    
    return (
      <div className="flex flex-col h-full bg-gray-100">
        {/* Patient Header */}
        <div className="bg-white px-4 py-3 border-b flex items-center">
          <button onClick={() => setSelectedPatient(null)} className="mr-3">
            <ArrowLeft className="w-6 h-6 text-gray-600" />
          </button>
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mr-3 overflow-hidden">
            {selectedPatient.院友相片 ? (
              <img src={selectedPatient.院友相片} alt="" className="w-full h-full object-cover" />
            ) : (
              <User className="w-5 h-5 text-gray-400" />
            )}
          </div>
          <div>
            <h2 className="font-bold text-gray-900">{selectedPatient.中文姓名}</h2>
            <p className="text-sm text-gray-500">床號: {selectedPatient.床號} | {selectedPatient.性別}</p>
          </div>
        </div>
        
        {/* Care Tabs */}
        <div className="bg-white border-b overflow-x-auto">
          <div className="flex px-2 py-2 gap-1">
            {careTabConfig.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveCareTab(tab.id)}
                  className={`flex items-center px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-colors ${
                    activeCareTab === tab.id ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  <Icon className="w-4 h-4 mr-1" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
        
        {/* Week Navigation */}
        <div className="bg-white border-b px-4 py-2 flex items-center justify-center gap-2">
          <button
            onClick={() => {
              const prev = new Date(weekStartDate);
              prev.setDate(prev.getDate() - 7);
              setWeekStartDate(prev);
            }}
            className="flex items-center px-3 py-1.5 bg-gray-100 rounded-lg text-sm"
          >
            <ChevronLeft className="w-4 h-4" />
            上週
          </button>
          <button
            onClick={() => {
              const now = new Date();
              const day = now.getDay();
              const diff = now.getDate() - day + (day === 0 ? -6 : 1);
              setWeekStartDate(new Date(now.setDate(diff)));
            }}
            className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium"
          >
            本週
          </button>
          <button
            onClick={() => {
              const next = new Date(weekStartDate);
              next.setDate(next.getDate() + 7);
              setWeekStartDate(next);
            }}
            className="flex items-center px-3 py-1.5 bg-gray-100 rounded-lg text-sm"
          >
            下週
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        
        {/* Date Range */}
        <div className="bg-white text-center py-2 text-sm text-gray-500">
          📅 {formatDate(weekDates[0])} - {formatDate(weekDates[6])}
        </div>
        
        {/* Table */}
        <div className="flex-1 overflow-auto bg-white">
          {renderTable()}
        </div>
      </div>
    );
  };

  // Main render
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      {/* Phone Frame */}
      <div className="relative">
        <div className="absolute -inset-3 bg-gray-900 rounded-[3rem] shadow-2xl"></div>
        <div className="relative w-[375px] h-[812px] bg-white rounded-[2.5rem] overflow-hidden border-8 border-gray-900">
          {/* Status Bar */}
          <div className="h-11 bg-white flex items-center justify-between px-6 text-sm">
            <span className="font-semibold">9:41</span>
            <div className="flex items-center gap-1">
              <div className="w-4 h-2.5 border border-gray-800 rounded-sm relative">
                <div className="absolute inset-0.5 bg-gray-800 rounded-sm" style={{width: '80%'}}></div>
              </div>
            </div>
          </div>
          
          {/* App Content */}
          <div className="h-[calc(100%-44px-83px)] overflow-hidden">
            {selectedPatient ? (
              renderCareRecords()
            ) : (
              <>
                {activeTab === 'home' && renderHomeTab()}
                {activeTab === 'scan' && renderScanTab()}
                {activeTab === 'settings' && renderSettingsTab()}
              </>
            )}
          </div>
          
          {/* Bottom Tab Bar */}
          {!selectedPatient && (
            <div className="h-[83px] bg-white border-t flex items-start pt-2">
              <button
                onClick={() => setActiveTab('home')}
                className={`flex-1 flex flex-col items-center py-1 ${activeTab === 'home' ? 'text-blue-600' : 'text-gray-400'}`}
              >
                <Home className="w-6 h-6" />
                <span className="text-xs mt-1">院友列表</span>
              </button>
              <button
                onClick={() => setActiveTab('scan')}
                className={`flex-1 flex flex-col items-center py-1 ${activeTab === 'scan' ? 'text-blue-600' : 'text-gray-400'}`}
              >
                <QrCode className="w-6 h-6" />
                <span className="text-xs mt-1">掃描</span>
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`flex-1 flex flex-col items-center py-1 ${activeTab === 'settings' ? 'text-blue-600' : 'text-gray-400'}`}
              >
                <Settings className="w-6 h-6" />
                <span className="text-xs mt-1">設定</span>
              </button>
            </div>
          )}
          
          {/* Home Indicator */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 bg-gray-900 rounded-full"></div>
        </div>
      </div>
      
      {/* App Info */}
      <div className="ml-8 max-w-xs">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">護理記錄 App</h1>
        <p className="text-gray-600 mb-4">院舍巡邏護理記錄手機應用程式</p>
        <div className="space-y-2 text-sm text-gray-500">
          <p>✅ 支援 iOS 和 Android</p>
          <p>✅ 與 Web App 共享資料庫</p>
          <p>✅ QR Code 掃描床位</p>
          <p>✅ 巡房/換片/約束/轉身記錄</p>
        </div>
      </div>
    </div>
  );
};

export default MobileAppPreview;
