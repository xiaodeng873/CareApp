import React, { useState, useEffect, useMemo, createContext, useContext, ReactNode } from 'react';
import { supabase } from './lib/supabase';
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
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowLeft,
  Loader2
} from 'lucide-react';
import './App.css';

// Types
interface Patient {
  院友id: number;
  床號: string;
  中文姓名: string;
  性別: '男' | '女';
  出生日期?: string;
  院友相片?: string;
  感染控制?: string[];
  護理等級?: string;
  在住狀態?: string;
}

interface PatrolRound {
  id: string;
  patient_id: number;
  patrol_date: string;
  scheduled_time: string;
  recorder: string;
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
  scheduled_time: string;
  observation_status: 'N' | 'P' | 'S';
  recorder: string;
}

type TabType = 'home' | 'scan' | 'settings';
type CareTabType = 'patrol' | 'diaper' | 'intake_output' | 'restraint' | 'position' | 'toilet_training';

const TIME_SLOTS = ['07:00', '09:00', '11:00', '13:00', '15:00', '17:00', '19:00', '21:00', '23:00', '01:00', '03:00', '05:00'];
const DIAPER_SLOTS = ['7AM-10AM', '11AM-2PM', '3PM-6PM', '7PM-10PM', '11PM-2AM', '3AM-6AM'];

// Auth Context
interface AuthContextType {
  user: any;
  displayName: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setDisplayName(session?.user?.user_metadata?.display_name || session?.user?.email || null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setDisplayName(session?.user?.user_metadata?.display_name || session?.user?.email || null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setDisplayName(null);
  };

  return (
    <AuthContext.Provider value={{ user, displayName, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

// Login Screen
const LoginScreen: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { signIn } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('請輸入電子郵件和密碼');
      return;
    }
    setLoading(true);
    setError('');
    const { error } = await signIn(email, password);
    if (error) setError(error.message || '登入失敗');
    setLoading(false);
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-icon">
            <Clipboard size={40} color="#2563eb" />
          </div>
          <h1 className="login-title">護理記錄</h1>
          <p className="login-subtitle">請登入以繼續使用系統</p>
        </div>

        <form onSubmit={handleLogin} className="login-form">
          {error && <div className="error-message">{error}</div>}

          <div className="input-group">
            <Mail size={20} color="#9ca3af" className="input-icon" />
            <input
              type="email"
              placeholder="電子郵件"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
            />
          </div>

          <div className="input-group">
            <Lock size={20} color="#9ca3af" className="input-icon" />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="密碼"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="eye-btn">
              {showPassword ? <EyeOff size={20} color="#9ca3af" /> : <Eye size={20} color="#9ca3af" />}
            </button>
          </div>

          <button type="submit" disabled={loading} className="login-btn">
            {loading ? <Loader2 size={20} className="spin" /> : '登入'}
          </button>
        </form>

        <p className="footer-text">Station C 護理記錄系統</p>
      </div>
    </div>
  );
};

// Main App Component
const MobileApp: React.FC = () => {
  const { user, displayName, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [activeCareTab, setActiveCareTab] = useState<CareTabType>('patrol');
  
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [manualBedInput, setManualBedInput] = useState('');
  
  const [patrolRounds, setPatrolRounds] = useState<PatrolRound[]>([]);
  const [diaperRecords, setDiaperRecords] = useState<DiaperChangeRecord[]>([]);
  const [positionRecords, setPositionRecords] = useState<PositionChangeRecord[]>([]);
  const [restraintRecords, setRestraintRecords] = useState<RestraintObservationRecord[]>([]);
  
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

  // Home Tab
  const renderHomeTab = () => (
    <div className="tab-content">
      <div className="page-header">
        <h1>院友列表</h1>
        <p>共 {filteredPatients.length} 位在住院友</p>
      </div>
      
      <div className="search-container">
        <div className="search-box">
          <Search size={20} color="#9ca3af" />
          <input
            type="text"
            placeholder="搜尋院友姓名、床號..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="clear-btn">
              <X size={16} />
            </button>
          )}
        </div>
      </div>
      
      <div className="patient-list">
        {loading ? (
          <div className="loading-state">
            <Loader2 size={32} className="spin" color="#2563eb" />
          </div>
        ) : filteredPatients.length === 0 ? (
          <div className="empty-state">
            <User size={64} color="#d1d5db" />
            <p>{searchQuery ? '找不到符合的院友' : '暫無在住院友'}</p>
          </div>
        ) : (
          filteredPatients.map((patient) => (
            <button
              key={patient.院友id}
              onClick={() => setSelectedPatient(patient)}
              className="patient-card"
            >
              <div className="patient-avatar">
                {patient.院友相片 ? (
                  <img src={patient.院友相片} alt="" />
                ) : (
                  <User size={24} color="#9ca3af" />
                )}
              </div>
              <div className="patient-info">
                <div className="patient-name-row">
                  <span className="patient-name">{patient.中文姓名}</span>
                  <span className={`gender-badge ${patient.性別 === '男' ? 'male' : 'female'}`}>
                    {patient.性別}
                  </span>
                </div>
                <p className="bed-number">床號: {patient.床號}</p>
                <div className="patient-meta">
                  {calculateAge(patient.出生日期) && <span>{calculateAge(patient.出生日期)}歲</span>}
                  {patient.護理等級 && <span className="care-level">{patient.護理等級}</span>}
                </div>
              </div>
              <ChevronRight size={20} color="#9ca3af" />
            </button>
          ))
        )}
      </div>
    </div>
  );

  // Scan Tab
  const renderScanTab = () => (
    <div className="scan-container">
      <div className="scan-card">
        <div className="scan-icon">
          <QrCode size={48} color="#2563eb" />
        </div>
        <h2>QR Code 掃描</h2>
        <p>在手機 App 上使用相機掃描床位 QR Code</p>
        
        <div className="divider"><span>或</span></div>
        
        <p className="manual-label">手動輸入床號/院友姓名</p>
        <div className="manual-input-group">
          <input
            type="text"
            placeholder="例如: A01 或 陳大明"
            value={manualBedInput}
            onChange={(e) => setManualBedInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button onClick={handleSearch} className="search-btn">
            <Search size={20} />
          </button>
        </div>
        
        <div className="tip-box">
          <Info size={20} color="#2563eb" />
          <p>提示：在真實手機上使用此 App 可以直接掃描 QR Code</p>
        </div>
      </div>
    </div>
  );

  // Settings Tab
  const renderSettingsTab = () => (
    <div className="settings-container">
      <div className="settings-header">
        <div className="settings-avatar">
          <User size={40} color="#2563eb" />
        </div>
        <h2>{displayName || '未設定姓名'}</h2>
        <p>{user?.email}</p>
      </div>
      
      <div className="settings-section">
        <p className="section-title">帳戶資訊</p>
        <div className="settings-card">
          <div className="settings-row">
            <span>電子郵件</span>
            <span className="value">{user?.email}</span>
          </div>
          <div className="settings-row">
            <span>顯示名稱</span>
            <span className="value">{displayName || '未設定'}</span>
          </div>
        </div>
      </div>
      
      <div className="settings-section">
        <p className="section-title">關於</p>
        <div className="settings-card">
          <div className="settings-row">
            <span>版本</span>
            <span className="value">1.0.0</span>
          </div>
          <div className="settings-row">
            <span>系統</span>
            <span className="value">Station C 護理記錄</span>
          </div>
        </div>
      </div>
      
      <button onClick={signOut} className="logout-btn">
        <LogOut size={20} />
        登出
      </button>
    </div>
  );

  // Care Records Screen
  const renderCareRecords = () => {
    if (!selectedPatient) return null;
    
    const careTabConfig = [
      { id: 'patrol' as CareTabType, label: '巡房', Icon: Clipboard },
      { id: 'diaper' as CareTabType, label: '換片', Icon: Droplets },
      { id: 'intake_output' as CareTabType, label: '出入量', Icon: Activity },
      { id: 'restraint' as CareTabType, label: '約束', Icon: Shield },
      { id: 'position' as CareTabType, label: '轉身', Icon: RotateCcw },
      { id: 'toilet_training' as CareTabType, label: '如廁', Icon: GraduationCap },
    ];
    
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];

    const renderTable = () => {
      const slots = activeCareTab === 'diaper' ? DIAPER_SLOTS : TIME_SLOTS;
      
      if (activeCareTab === 'intake_output' || activeCareTab === 'toilet_training') {
        return (
          <div className="developing-state">
            <Activity size={64} color="#d1d5db" />
            <p>{activeCareTab === 'intake_output' ? '出入量記錄' : '如廁訓練記錄'}功能開發中</p>
            <span>敬請期待</span>
          </div>
        );
      }
      
      return (
        <div className="table-wrapper">
          <table className="care-table">
            <thead>
              <tr>
                <th className="time-header">時段</th>
                {weekDates.map((date, idx) => (
                  <th key={idx}>
                    <div>{date.getMonth()+1}/{date.getDate()}</div>
                    <div className="weekday">({weekdays[date.getDay()]})</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slots.map((slot, slotIdx) => (
                <tr key={slot}>
                  <td className="time-cell">{slot}</td>
                  {weekDates.map((date, dateIdx) => {
                    const dateStr = formatDate(date);
                    let record: any = null;
                    let content = null;
                    let cellClass = '';
                    
                    if (activeCareTab === 'patrol') {
                      record = patrolRounds.find(r => r.patrol_date === dateStr && r.scheduled_time === slot);
                      if (record) {
                        cellClass = 'cell-green';
                        content = (
                          <>
                            <Check size={16} color="#16a34a" />
                            <span className="recorder">{record.recorder}</span>
                          </>
                        );
                      } else {
                        content = <span className="pending">待巡</span>;
                      }
                    } else if (activeCareTab === 'diaper') {
                      record = diaperRecords.find(r => r.change_date === dateStr && r.time_slot === slot);
                      if (record) {
                        cellClass = 'cell-blue';
                        content = (
                          <>
                            <span className="diaper-text">
                              {record.has_urine && '小'}{record.has_urine && record.has_stool && '/'}{record.has_stool && '大'}{record.has_none && '無'}
                            </span>
                            <span className="recorder">{record.recorder}</span>
                          </>
                        );
                      } else {
                        content = <span className="pending">待記錄</span>;
                      }
                    } else if (activeCareTab === 'position') {
                      record = positionRecords.find(r => r.change_date === dateStr && r.scheduled_time === slot);
                      const positions = ['左', '平', '右'];
                      const expected = positions[slotIdx % 3];
                      if (record) {
                        cellClass = 'cell-purple';
                        content = (
                          <>
                            <span className="position-text">{record.position}</span>
                            <span className="recorder">{record.recorder}</span>
                          </>
                        );
                      } else {
                        content = <span className="pending">[{expected}]</span>;
                      }
                    } else if (activeCareTab === 'restraint') {
                      record = restraintRecords.find(r => r.observation_date === dateStr && r.scheduled_time === slot);
                      if (record) {
                        const statusClasses: Record<string, string> = { N: 'cell-green', P: 'cell-red', S: 'cell-yellow' };
                        const statusText: Record<string, string> = { N: '🟢N', P: '🔴P', S: '🟠S' };
                        cellClass = statusClasses[record.observation_status] || '';
                        content = (
                          <>
                            <span className="status-text">{statusText[record.observation_status]}</span>
                            <span className="recorder">{record.recorder}</span>
                          </>
                        );
                      } else {
                        content = <span className="pending">待觀察</span>;
                      }
                    }
                    
                    return <td key={dateIdx} className={`data-cell ${cellClass}`}>{content}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    };
    
    return (
      <div className="care-records">
        <div className="care-header">
          <button onClick={() => setSelectedPatient(null)} className="back-btn">
            <ArrowLeft size={24} />
          </button>
          <div className="patient-avatar small">
            {selectedPatient.院友相片 ? (
              <img src={selectedPatient.院友相片} alt="" />
            ) : (
              <User size={20} color="#9ca3af" />
            )}
          </div>
          <div className="patient-header-info">
            <h2>{selectedPatient.中文姓名}</h2>
            <p>床號: {selectedPatient.床號} | {selectedPatient.性別}</p>
          </div>
        </div>
        
        <div className="care-tabs">
          {careTabConfig.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveCareTab(tab.id)}
              className={`care-tab ${activeCareTab === tab.id ? 'active' : ''}`}
            >
              <tab.Icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>
        
        <div className="week-nav">
          <button onClick={() => {
            const prev = new Date(weekStartDate);
            prev.setDate(prev.getDate() - 7);
            setWeekStartDate(prev);
          }}>
            <ChevronLeft size={16} />上週
          </button>
          <button className="current" onClick={() => {
            const now = new Date();
            const day = now.getDay();
            const diff = now.getDate() - day + (day === 0 ? -6 : 1);
            setWeekStartDate(new Date(now.setDate(diff)));
          }}>本週</button>
          <button onClick={() => {
            const next = new Date(weekStartDate);
            next.setDate(next.getDate() + 7);
            setWeekStartDate(next);
          }}>下週<ChevronRight size={16} /></button>
        </div>
        
        <div className="date-range">
          📅 {formatDate(weekDates[0])} - {formatDate(weekDates[6])}
        </div>
        
        <div className="table-container">
          {renderTable()}
        </div>
      </div>
    );
  };

  return (
    <div className="mobile-app">
      <div className="app-content">
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
      
      {!selectedPatient && (
        <div className="bottom-tabs">
          <button onClick={() => setActiveTab('home')} className={activeTab === 'home' ? 'active' : ''}>
            <Home size={24} />
            <span>院友列表</span>
          </button>
          <button onClick={() => setActiveTab('scan')} className={activeTab === 'scan' ? 'active' : ''}>
            <QrCode size={24} />
            <span>掃描</span>
          </button>
          <button onClick={() => setActiveTab('settings')} className={activeTab === 'settings' ? 'active' : ''}>
            <Settings size={24} />
            <span>設定</span>
          </button>
        </div>
      )}
    </div>
  );
};

// Main App
function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        <Loader2 size={32} className="spin" color="#2563eb" />
      </div>
    );
  }

  return user ? <MobileApp /> : <LoginScreen />;
};

export default App;
