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
  Loader2,
  Clock,
  FileText,
  Trash2,
  Calendar,
  CheckCircle,
  AlertCircle
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
  urine_amount?: string;
  stool_color?: string;
  stool_texture?: string;
  stool_amount?: string;
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
  notes?: string;
}

type TabType = 'scan' | 'home' | 'settings';
type CareTabType = 'patrol' | 'diaper' | 'intake_output' | 'restraint' | 'position' | 'toilet_training';
type ModalType = 'patrol' | 'diaper' | 'restraint' | 'position' | null;

const TIME_SLOTS = ['07:00', '09:00', '11:00', '13:00', '15:00', '17:00', '19:00', '21:00', '23:00', '01:00', '03:00', '05:00'];
const DIAPER_SLOTS = ['7AM-10AM', '11AM-2PM', '3PM-6PM', '7PM-10PM', '11PM-2AM', '3AM-6AM'];

// 香港時區工具函數
const getHongKongTime = () => {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Hong_Kong' }));
};

const getHongKongDateString = () => {
  const hkTime = getHongKongTime();
  return hkTime.toISOString().split('T')[0];
};

const getHongKongTimeString = () => {
  const hkTime = getHongKongTime();
  return `${String(hkTime.getHours()).padStart(2, '0')}:${String(hkTime.getMinutes()).padStart(2, '0')}`;
};

// 檢查時段是否逾期
const isTimeSlotOverdue = (date: string, timeSlot: string): boolean => {
  const hkNow = getHongKongTime();
  const today = getHongKongDateString();
  
  if (date < today) return true;
  if (date > today) return false;
  
  // 今天的情況，比較時間
  const currentMinutes = hkNow.getHours() * 60 + hkNow.getMinutes();
  
  // 解析時段
  let slotEndMinutes = 0;
  if (timeSlot.includes('AM') || timeSlot.includes('PM')) {
    // DIAPER_SLOTS 格式
    const match = timeSlot.match(/(\d+)(AM|PM)-(\d+)(AM|PM)/);
    if (match) {
      let endHour = parseInt(match[3]);
      if (match[4] === 'PM' && endHour !== 12) endHour += 12;
      if (match[4] === 'AM' && endHour === 12) endHour = 0;
      slotEndMinutes = endHour * 60;
    }
  } else {
    // TIME_SLOTS 格式 (HH:MM)
    const [hours, minutes] = timeSlot.split(':').map(Number);
    // 給予 2 小時的緩衝時間
    slotEndMinutes = hours * 60 + minutes + 120;
  }
  
  return currentMinutes > slotEndMinutes;
};

const addRandomOffset = (baseTime: string): string => {
  const [hours, minutes] = baseTime.split(':').map(Number);
  const randomOffset = Math.floor(Math.random() * 5) - 2;
  const totalMinutes = hours * 60 + minutes + randomOffset;
  const newHours = Math.floor(totalMinutes / 60) % 24;
  const newMinutes = totalMinutes % 60;
  return `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`;
};

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

// Modal Components
interface ModalProps {
  patient: Patient;
  date: string;
  timeSlot: string;
  staffName: string;
  onClose: () => void;
}

const PatrolModal: React.FC<ModalProps & { existingRecord?: PatrolRound | null; onSubmit: (data: any) => void; onDelete?: (id: string) => void }> = ({
  patient, date, timeSlot, staffName, existingRecord, onClose, onSubmit, onDelete
}) => {
  const [patrolTime, setPatrolTime] = useState(existingRecord?.patrol_time || addRandomOffset(timeSlot));
  const [recorder, setRecorder] = useState(existingRecord?.recorder || staffName);
  const [notes, setNotes] = useState(existingRecord?.notes || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      patient_id: patient.院友id,
      patrol_date: date,
      scheduled_time: timeSlot,
      patrol_time: patrolTime,
      recorder,
      notes: notes.trim() || undefined
    });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>{existingRecord ? '查看/編輯巡房記錄' : '新增巡房記錄'}</h2>
          <button onClick={onClose} className="modal-close"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-row">
            <label>院友姓名</label>
            <input type="text" value={patient.中文姓名} disabled />
          </div>
          <div className="form-row">
            <label>巡房日期</label>
            <input type="text" value={date} disabled />
          </div>
          <div className="form-row">
            <label>預定時段</label>
            <input type="text" value={timeSlot} disabled />
          </div>
          <div className="form-row">
            <label><Clock size={16} /> 實際巡房時間 *</label>
            <input type="time" value={patrolTime} onChange={(e) => setPatrolTime(e.target.value)} required />
          </div>
          <div className="form-row">
            <label><User size={16} /> 記錄者 *</label>
            <input type="text" value={recorder} onChange={(e) => setRecorder(e.target.value)} required />
          </div>
          <div className="form-row">
            <label><FileText size={16} /> 備註</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="選填，如有特殊情況請記錄" />
          </div>
          <div className="modal-actions">
            {existingRecord && onDelete && (
              <button type="button" onClick={() => onDelete(existingRecord.id)} className="btn-delete">
                <Trash2 size={16} /> 刪除
              </button>
            )}
            <div className="modal-actions-right">
              <button type="button" onClick={onClose} className="btn-cancel">取消</button>
              <button type="submit" className="btn-submit">{existingRecord ? '更新記錄' : '確認巡房'}</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

const DiaperModal: React.FC<ModalProps & { existingRecord?: DiaperChangeRecord | null; onSubmit: (data: any) => void; onDelete?: (id: string) => void }> = ({
  patient, date, timeSlot, staffName, existingRecord, onClose, onSubmit, onDelete
}) => {
  const [hasUrine, setHasUrine] = useState(existingRecord?.has_urine || false);
  const [hasStool, setHasStool] = useState(existingRecord?.has_stool || false);
  const [hasNone, setHasNone] = useState(existingRecord?.has_none || false);
  const [urineAmount, setUrineAmount] = useState(existingRecord?.urine_amount || '');
  const [stoolColor, setStoolColor] = useState(existingRecord?.stool_color || '');
  const [stoolTexture, setStoolTexture] = useState(existingRecord?.stool_texture || '');
  const [stoolAmount, setStoolAmount] = useState(existingRecord?.stool_amount || '');
  const [recorder, setRecorder] = useState(existingRecord?.recorder || staffName);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasUrine && !hasStool && !hasNone) {
      alert('請選擇排泄情況');
      return;
    }
    onSubmit({
      patient_id: patient.院友id,
      change_date: date,
      time_slot: timeSlot,
      has_urine: hasUrine,
      has_stool: hasStool,
      has_none: hasNone,
      urine_amount: urineAmount || undefined,
      stool_color: stoolColor || undefined,
      stool_texture: stoolTexture || undefined,
      stool_amount: stoolAmount || undefined,
      recorder
    });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>{existingRecord ? '查看/編輯換片記錄' : '新增換片記錄'}</h2>
          <button onClick={onClose} className="modal-close"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-row">
            <label>院友姓名</label>
            <input type="text" value={patient.中文姓名} disabled />
          </div>
          <div className="form-row">
            <label>日期 / 時段</label>
            <input type="text" value={`${date} / ${timeSlot}`} disabled />
          </div>
          <div className="form-row">
            <label>排泄情況 *</label>
            <div className="checkbox-group">
              <label className={`checkbox-item ${hasUrine ? 'active' : ''}`}>
                <input type="checkbox" checked={hasUrine} onChange={(e) => { setHasUrine(e.target.checked); if (e.target.checked) setHasNone(false); }} />
                小便
              </label>
              <label className={`checkbox-item ${hasStool ? 'active' : ''}`}>
                <input type="checkbox" checked={hasStool} onChange={(e) => { setHasStool(e.target.checked); if (e.target.checked) setHasNone(false); }} />
                大便
              </label>
              <label className={`checkbox-item ${hasNone ? 'active' : ''}`}>
                <input type="checkbox" checked={hasNone} onChange={(e) => { setHasNone(e.target.checked); if (e.target.checked) { setHasUrine(false); setHasStool(false); } }} />
                無
              </label>
            </div>
          </div>
          {hasUrine && (
            <div className="form-row">
              <label>小便量</label>
              <div className="option-group">
                {['少', '中', '多'].map(opt => (
                  <button key={opt} type="button" className={`option-btn ${urineAmount === opt ? 'active' : ''}`} onClick={() => setUrineAmount(opt)}>{opt}</button>
                ))}
              </div>
            </div>
          )}
          {hasStool && (
            <>
              <div className="form-row">
                <label>大便顏色</label>
                <div className="option-group">
                  {['黃', '唡', '綠', '黑', '紅'].map(opt => (
                    <button key={opt} type="button" className={`option-btn ${stoolColor === opt ? 'active' : ''}`} onClick={() => setStoolColor(opt)}>{opt}</button>
                  ))}
                </div>
              </div>
              <div className="form-row">
                <label>大便質地</label>
                <div className="option-group">
                  {['硬', '軟', '稀', '水狀'].map(opt => (
                    <button key={opt} type="button" className={`option-btn ${stoolTexture === opt ? 'active' : ''}`} onClick={() => setStoolTexture(opt)}>{opt}</button>
                  ))}
                </div>
              </div>
              <div className="form-row">
                <label>大便量</label>
                <div className="option-group">
                  {['少', '中', '多'].map(opt => (
                    <button key={opt} type="button" className={`option-btn ${stoolAmount === opt ? 'active' : ''}`} onClick={() => setStoolAmount(opt)}>{opt}</button>
                  ))}
                </div>
              </div>
            </>
          )}
          <div className="form-row">
            <label><User size={16} /> 記錄者 *</label>
            <input type="text" value={recorder} onChange={(e) => setRecorder(e.target.value)} required />
          </div>
          <div className="modal-actions">
            {existingRecord && onDelete && (
              <button type="button" onClick={() => onDelete(existingRecord.id)} className="btn-delete">
                <Trash2 size={16} /> 刪除
              </button>
            )}
            <div className="modal-actions-right">
              <button type="button" onClick={onClose} className="btn-cancel">取消</button>
              <button type="submit" className="btn-submit">{existingRecord ? '更新記錄' : '確認記錄'}</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

const RestraintModal: React.FC<ModalProps & { existingRecord?: RestraintObservationRecord | null; onSubmit: (data: any) => void; onDelete?: (id: string) => void }> = ({
  patient, date, timeSlot, staffName, existingRecord, onClose, onSubmit, onDelete
}) => {
  const [observationTime, setObservationTime] = useState(existingRecord?.observation_time || addRandomOffset(timeSlot));
  const [observationStatus, setObservationStatus] = useState<'N' | 'P' | 'S'>(existingRecord?.observation_status || 'N');
  const [recorder, setRecorder] = useState(existingRecord?.recorder || staffName);
  const [notes, setNotes] = useState(existingRecord?.notes || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      patient_id: patient.院友id,
      observation_date: date,
      observation_time: observationTime,
      scheduled_time: timeSlot,
      observation_status: observationStatus,
      recorder,
      notes: notes.trim() || undefined
    });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>{existingRecord ? '查看/編輯約束觀察' : '新增約束觀察'}</h2>
          <button onClick={onClose} className="modal-close"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-row">
            <label>院友姓名</label>
            <input type="text" value={patient.中文姓名} disabled />
          </div>
          <div className="form-row">
            <label>日期 / 預定時段</label>
            <input type="text" value={`${date} / ${timeSlot}`} disabled />
          </div>
          <div className="form-row">
            <label><Clock size={16} /> 實際觀察時間 *</label>
            <input type="time" value={observationTime} onChange={(e) => setObservationTime(e.target.value)} required />
          </div>
          <div className="form-row">
            <label>觀察狀態 *</label>
            <div className="status-group">
              <button type="button" className={`status-btn normal ${observationStatus === 'N' ? 'active' : ''}`} onClick={() => setObservationStatus('N')}>
                🟢 正常 (N)
              </button>
              <button type="button" className={`status-btn problem ${observationStatus === 'P' ? 'active' : ''}`} onClick={() => setObservationStatus('P')}>
                🔴 異常 (P)
              </button>
              <button type="button" className={`status-btn paused ${observationStatus === 'S' ? 'active' : ''}`} onClick={() => setObservationStatus('S')}>
                🟠 暫停 (S)
              </button>
            </div>
          </div>
          <div className="form-row">
            <label><User size={16} /> 記錄者 *</label>
            <input type="text" value={recorder} onChange={(e) => setRecorder(e.target.value)} required />
          </div>
          <div className="form-row">
            <label><FileText size={16} /> 備註</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="選填" />
          </div>
          <div className="modal-actions">
            {existingRecord && onDelete && (
              <button type="button" onClick={() => onDelete(existingRecord.id)} className="btn-delete">
                <Trash2 size={16} /> 刪除
              </button>
            )}
            <div className="modal-actions-right">
              <button type="button" onClick={onClose} className="btn-cancel">取消</button>
              <button type="submit" className="btn-submit">{existingRecord ? '更新記錄' : '確認記錄'}</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

const PositionModal: React.FC<ModalProps & { existingRecord?: PositionChangeRecord | null; onSubmit: (data: any) => void; onDelete?: (id: string) => void; suggestedPosition: '左' | '平' | '右' }> = ({
  patient, date, timeSlot, staffName, existingRecord, onClose, onSubmit, onDelete, suggestedPosition
}) => {
  const [position, setPosition] = useState<'左' | '平' | '右'>(existingRecord?.position || suggestedPosition);
  const [recorder, setRecorder] = useState(existingRecord?.recorder || staffName);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      patient_id: patient.院友id,
      change_date: date,
      scheduled_time: timeSlot,
      position,
      recorder
    });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>{existingRecord ? '查看/編輯轉身記錄' : '新增轉身記錄'}</h2>
          <button onClick={onClose} className="modal-close"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-row">
            <label>院友姓名</label>
            <input type="text" value={patient.中文姓名} disabled />
          </div>
          <div className="form-row">
            <label>日期 / 預定時段</label>
            <input type="text" value={`${date} / ${timeSlot}`} disabled />
          </div>
          <div className="info-box">
            <RotateCcw size={20} color="#2563eb" />
            <div>
              <strong>轉身順序提示</strong>
              <p>左 → 平 → 右 → 左（循環）</p>
            </div>
          </div>
          <div className="form-row">
            <label>轉身位置 *</label>
            <div className="position-group">
              {(['左', '平', '右'] as const).map(pos => (
                <button key={pos} type="button" className={`position-btn ${position === pos ? 'active' : ''}`} onClick={() => setPosition(pos)}>
                  {pos}
                </button>
              ))}
            </div>
          </div>
          <div className="form-row">
            <label><User size={16} /> 記錄者 *</label>
            <input type="text" value={recorder} onChange={(e) => setRecorder(e.target.value)} required />
          </div>
          <div className="modal-actions">
            {existingRecord && onDelete && (
              <button type="button" onClick={() => onDelete(existingRecord.id)} className="btn-delete">
                <Trash2 size={16} /> 刪除
              </button>
            )}
            <div className="modal-actions-right">
              <button type="button" onClick={onClose} className="btn-cancel">取消</button>
              <button type="submit" className="btn-submit">{existingRecord ? '更新記錄' : '確認記錄'}</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

// Main App Component
const MobileApp: React.FC = () => {
  const { user, displayName, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('scan');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [activeCareTab, setActiveCareTab] = useState<CareTabType>('patrol');
  
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Records
  const [patrolRounds, setPatrolRounds] = useState<PatrolRound[]>([]);
  const [diaperRecords, setDiaperRecords] = useState<DiaperChangeRecord[]>([]);
  const [positionRecords, setPositionRecords] = useState<PositionChangeRecord[]>([]);
  const [restraintRecords, setRestraintRecords] = useState<RestraintObservationRecord[]>([]);
  
  // Modal state
  const [modalType, setModalType] = useState<ModalType>(null);
  const [modalTimeSlot, setModalTimeSlot] = useState('');
  const [modalExistingRecord, setModalExistingRecord] = useState<any>(null);
  
  // Date navigation: yesterday, today, tomorrow
  const [selectedDate, setSelectedDate] = useState(getHongKongDateString());
  
  const today = getHongKongDateString();
  const yesterday = (() => {
    const d = new Date(today);
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  })();
  const tomorrow = (() => {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  })();

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

  // Load records when patient selected
  useEffect(() => {
    if (!selectedPatient) return;
    
    const loadRecords = async () => {
      const [patrol, diaper, position, restraint] = await Promise.all([
        supabase.from('patrol_rounds').select('*').eq('patient_id', selectedPatient.院友id).eq('patrol_date', selectedDate),
        supabase.from('diaper_change_records').select('*').eq('patient_id', selectedPatient.院友id).eq('change_date', selectedDate),
        supabase.from('position_change_records').select('*').eq('patient_id', selectedPatient.院友id).eq('change_date', selectedDate),
        supabase.from('restraint_observation_records').select('*').eq('patient_id', selectedPatient.院友id).eq('observation_date', selectedDate),
      ]);
      
      if (patrol.data) setPatrolRounds(patrol.data);
      if (diaper.data) setDiaperRecords(diaper.data);
      if (position.data) setPositionRecords(position.data);
      if (restraint.data) setRestraintRecords(restraint.data);
    };
    
    loadRecords();
  }, [selectedPatient, selectedDate]);

  // Calculate overdue status for patients
  const patientOverdueStatus = useMemo(() => {
    const status: Record<number, boolean> = {};
    // This would require loading all records for all patients - simplified for now
    return status;
  }, [patients]);

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

  // CRUD operations
  const handlePatrolSubmit = async (data: any) => {
    try {
      if (modalExistingRecord) {
        await supabase.from('patrol_rounds').update(data).eq('id', modalExistingRecord.id);
      } else {
        await supabase.from('patrol_rounds').insert([data]);
      }
      // Reload
      const { data: newData } = await supabase.from('patrol_rounds').select('*').eq('patient_id', selectedPatient!.院友id).eq('patrol_date', selectedDate);
      if (newData) setPatrolRounds(newData);
      setModalType(null);
    } catch (e) {
      console.error('Error saving patrol:', e);
    }
  };

  const handlePatrolDelete = async (id: string) => {
    if (confirm('確定刪除此記錄？')) {
      await supabase.from('patrol_rounds').delete().eq('id', id);
      setPatrolRounds(prev => prev.filter(r => r.id !== id));
      setModalType(null);
    }
  };

  const handleDiaperSubmit = async (data: any) => {
    try {
      if (modalExistingRecord) {
        await supabase.from('diaper_change_records').update(data).eq('id', modalExistingRecord.id);
      } else {
        await supabase.from('diaper_change_records').insert([data]);
      }
      const { data: newData } = await supabase.from('diaper_change_records').select('*').eq('patient_id', selectedPatient!.院友id).eq('change_date', selectedDate);
      if (newData) setDiaperRecords(newData);
      setModalType(null);
    } catch (e) {
      console.error('Error saving diaper:', e);
    }
  };

  const handleDiaperDelete = async (id: string) => {
    if (confirm('確定刪除此記錄？')) {
      await supabase.from('diaper_change_records').delete().eq('id', id);
      setDiaperRecords(prev => prev.filter(r => r.id !== id));
      setModalType(null);
    }
  };

  const handleRestraintSubmit = async (data: any) => {
    try {
      if (modalExistingRecord) {
        await supabase.from('restraint_observation_records').update(data).eq('id', modalExistingRecord.id);
      } else {
        await supabase.from('restraint_observation_records').insert([data]);
      }
      const { data: newData } = await supabase.from('restraint_observation_records').select('*').eq('patient_id', selectedPatient!.院友id).eq('observation_date', selectedDate);
      if (newData) setRestraintRecords(newData);
      setModalType(null);
    } catch (e) {
      console.error('Error saving restraint:', e);
    }
  };

  const handleRestraintDelete = async (id: string) => {
    if (confirm('確定刪除此記錄？')) {
      await supabase.from('restraint_observation_records').delete().eq('id', id);
      setRestraintRecords(prev => prev.filter(r => r.id !== id));
      setModalType(null);
    }
  };

  const handlePositionSubmit = async (data: any) => {
    try {
      if (modalExistingRecord) {
        await supabase.from('position_change_records').update(data).eq('id', modalExistingRecord.id);
      } else {
        await supabase.from('position_change_records').insert([data]);
      }
      const { data: newData } = await supabase.from('position_change_records').select('*').eq('patient_id', selectedPatient!.院友id).eq('change_date', selectedDate);
      if (newData) setPositionRecords(newData);
      setModalType(null);
    } catch (e) {
      console.error('Error saving position:', e);
    }
  };

  const handlePositionDelete = async (id: string) => {
    if (confirm('確定刪除此記錄？')) {
      await supabase.from('position_change_records').delete().eq('id', id);
      setPositionRecords(prev => prev.filter(r => r.id !== id));
      setModalType(null);
    }
  };

  const openModal = (type: ModalType, timeSlot: string, existingRecord?: any) => {
    setModalType(type);
    setModalTimeSlot(timeSlot);
    setModalExistingRecord(existingRecord || null);
  };

  // Scan Tab
  const renderScanTab = () => (
    <div className="scan-container">
      <div className="scan-card">
        <div className="scan-icon">
          <QrCode size={48} color="#2563eb" />
        </div>
        <h2>QR Code 掃描</h2>
        <p>請使用手機相機掃描床位 QR Code</p>
        
        <div className="tip-box">
          <Info size={20} color="#2563eb" />
          <p>掃描床位 QR Code 後將自動跳轉至對應院友的護理記錄頁面</p>
        </div>
      </div>
    </div>
  );

  // Home Tab - Patient List
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

    const renderWorkflowTable = () => {
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
        <div className="workflow-table">
          {slots.map((slot, slotIdx) => {
            let record: any = null;
            let isOverdue = false;
            let cellContent = null;
            let cellClass = 'workflow-cell';
            
            if (activeCareTab === 'patrol') {
              record = patrolRounds.find(r => r.scheduled_time === slot);
              isOverdue = !record && isTimeSlotOverdue(selectedDate, slot);
              
              if (record) {
                cellClass += ' completed';
                cellContent = (
                  <>
                    <CheckCircle size={20} color="#16a34a" />
                    <span className="cell-staff">{record.recorder}</span>
                    <span className="cell-time">{record.patrol_time}</span>
                  </>
                );
              } else {
                cellClass += ' pending';
                cellContent = <span className="cell-pending">待巡</span>;
              }
            } else if (activeCareTab === 'diaper') {
              record = diaperRecords.find(r => r.time_slot === slot);
              isOverdue = !record && isTimeSlotOverdue(selectedDate, slot);
              
              if (record) {
                cellClass += ' completed-blue';
                cellContent = (
                  <>
                    <span className="diaper-result">
                      {record.has_urine && '小'}{record.has_urine && record.has_stool && '/'}{record.has_stool && '大'}{record.has_none && '無'}
                    </span>
                    <span className="cell-staff">{record.recorder}</span>
                  </>
                );
              } else {
                cellClass += ' pending';
                cellContent = <span className="cell-pending">待記錄</span>;
              }
            } else if (activeCareTab === 'restraint') {
              record = restraintRecords.find(r => r.scheduled_time === slot);
              isOverdue = !record && isTimeSlotOverdue(selectedDate, slot);
              
              if (record) {
                const statusClass = record.observation_status === 'N' ? 'completed' : record.observation_status === 'P' ? 'completed-red' : 'completed-yellow';
                cellClass += ` ${statusClass}`;
                const statusIcon = record.observation_status === 'N' ? '🟢' : record.observation_status === 'P' ? '🔴' : '🟠';
                cellContent = (
                  <>
                    <span className="status-icon">{statusIcon} {record.observation_status}</span>
                    <span className="cell-staff">{record.recorder}</span>
                  </>
                );
              } else {
                cellClass += ' pending';
                cellContent = <span className="cell-pending">待觀察</span>;
              }
            } else if (activeCareTab === 'position') {
              record = positionRecords.find(r => r.scheduled_time === slot);
              isOverdue = !record && isTimeSlotOverdue(selectedDate, slot);
              const positions = ['左', '平', '右'];
              const expected = positions[slotIdx % 3];
              
              if (record) {
                cellClass += ' completed-purple';
                cellContent = (
                  <>
                    <span className="position-result">{record.position}</span>
                    <span className="cell-staff">{record.recorder}</span>
                  </>
                );
              } else {
                cellClass += ' pending';
                cellContent = <span className="cell-pending">[{expected}]</span>;
              }
            }

            return (
              <button
                key={slot}
                className={cellClass}
                onClick={() => {
                  if (activeCareTab === 'patrol') openModal('patrol', slot, record);
                  else if (activeCareTab === 'diaper') openModal('diaper', slot, record);
                  else if (activeCareTab === 'restraint') openModal('restraint', slot, record);
                  else if (activeCareTab === 'position') openModal('position', slot, record);
                }}
              >
                {isOverdue && <span className="overdue-dot"></span>}
                <div className="cell-time-slot">{slot}</div>
                <div className="cell-content">
                  {cellContent}
                </div>
              </button>
            );
          })}
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
        
        <div className="date-nav">
          <button 
            className={`date-btn ${selectedDate === yesterday ? 'active' : ''}`}
            onClick={() => setSelectedDate(yesterday)}
          >
            <ChevronLeft size={16} />
            昨天
          </button>
          <button 
            className={`date-btn current ${selectedDate === today ? 'active' : ''}`}
            onClick={() => setSelectedDate(today)}
          >
            今天
          </button>
          <button 
            className={`date-btn ${selectedDate === tomorrow ? 'active' : ''}`}
            onClick={() => setSelectedDate(tomorrow)}
          >
            明天
            <ChevronRight size={16} />
          </button>
        </div>
        
        <div className="date-display">
          <Calendar size={16} />
          {selectedDate}
        </div>
        
        <div className="table-container">
          {renderWorkflowTable()}
        </div>

        {/* Modals */}
        {modalType === 'patrol' && selectedPatient && (
          <PatrolModal
            patient={selectedPatient}
            date={selectedDate}
            timeSlot={modalTimeSlot}
            staffName={displayName || ''}
            existingRecord={modalExistingRecord}
            onClose={() => setModalType(null)}
            onSubmit={handlePatrolSubmit}
            onDelete={handlePatrolDelete}
          />
        )}
        {modalType === 'diaper' && selectedPatient && (
          <DiaperModal
            patient={selectedPatient}
            date={selectedDate}
            timeSlot={modalTimeSlot}
            staffName={displayName || ''}
            existingRecord={modalExistingRecord}
            onClose={() => setModalType(null)}
            onSubmit={handleDiaperSubmit}
            onDelete={handleDiaperDelete}
          />
        )}
        {modalType === 'restraint' && selectedPatient && (
          <RestraintModal
            patient={selectedPatient}
            date={selectedDate}
            timeSlot={modalTimeSlot}
            staffName={displayName || ''}
            existingRecord={modalExistingRecord}
            onClose={() => setModalType(null)}
            onSubmit={handleRestraintSubmit}
            onDelete={handleRestraintDelete}
          />
        )}
        {modalType === 'position' && selectedPatient && (
          <PositionModal
            patient={selectedPatient}
            date={selectedDate}
            timeSlot={modalTimeSlot}
            staffName={displayName || ''}
            existingRecord={modalExistingRecord}
            onClose={() => setModalType(null)}
            onSubmit={handlePositionSubmit}
            onDelete={handlePositionDelete}
            suggestedPosition={(['左', '平', '右'] as const)[TIME_SLOTS.indexOf(modalTimeSlot) % 3]}
          />
        )}
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
            {activeTab === 'scan' && renderScanTab()}
            {activeTab === 'home' && renderHomeTab()}
            {activeTab === 'settings' && renderSettingsTab()}
          </>
        )}
      </div>
      
      {!selectedPatient && (
        <div className="bottom-tabs">
          <button onClick={() => setActiveTab('scan')} className={activeTab === 'scan' ? 'active' : ''}>
            <QrCode size={24} />
            <span>掃描</span>
          </button>
          <button onClick={() => setActiveTab('home')} className={activeTab === 'home' ? 'active' : ''}>
            <Home size={24} />
            <span>院友列表</span>
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
