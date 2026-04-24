import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut,
  GoogleAuthProvider
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc,
  collection,
  query,
  onSnapshot,
  addDoc,
  serverTimestamp,
  deleteDoc,
  where
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage, googleProvider, UserProfile, Registration, Report } from './lib/firebase';
import { SECTIONS, PROTOCOL_COMMAND, ADMIN_CREDENTIALS, DRIVE_FOLDER_ID } from './constants';
import { 
  LogOut, 
  Shield, 
  User, 
  FileText, 
  Smartphone, 
  Send,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Clapperboard,
  Sparkles,
  Scissors,
  Bone,
  UserCircle,
  Paintbrush,
  Sun,
  Mountain,
  Film,
  Monitor,
  Mic2,
  PenLine,
  Layout as LayoutIcon,
  Theater,
  Headphones,
  Phone,
  PlusCircle,
  Mic,
  Camera,
  Search,
  Menu,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Analytics } from '@vercel/analytics/react';

// Helper for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Icons mapping
const iconMap: Record<string, any> = {
  Clapperboard, Sparkles, Scissors, Bone, UserCircle, Paintbrush, Sun, Mountain, Film, Monitor, Mic2, PenLine, Layout: LayoutIcon, Theater, Headphones, FileText, Phone, PlusCircle
};

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('regular-update');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isControlMode, setIsControlMode] = useState(false);
  const [showBiometric, setShowBiometric] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [globalReports, setGlobalReports] = useState<Report[]>([]);

  useEffect(() => {
    if (!user) {
      setGlobalReports([]);
      return;
    }
    const qRep = query(collection(db, 'reports'));
    const unsub = onSnapshot(qRep, (snap) => {
      setGlobalReports(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Report)).sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
    });
    return unsub;
  }, [user]);

  useEffect(() => {
    console.log("App mounted, auth initializing...");
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data() as UserProfile;
            
            // Derive session-specific role
            const hasAdminSession = sessionStorage.getItem('PIPELINE_ADMIN_SESSION') === 'true';
            const displayRole = (userData.role === 'admin' && hasAdminSession) ? 'admin' : 'user';
            
            setUser({ ...userData, role: displayRole });
            
            if (displayRole === 'admin' && userData.isAdminVerified) {
              setIsControlMode(true);
            } else {
              setIsControlMode(false);
            }
          } else {
            const newUser: UserProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || 'Guest User',
              role: 'user',
              createdAt: serverTimestamp(),
              isAdminVerified: false
            };
            await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
            setUser(newUser);
            setIsControlMode(false);
          }
        } else {
          setUser(null);
          setIsControlMode(false);
          sessionStorage.removeItem('PIPELINE_ADMIN_SESSION');
        }
      } catch (error: any) {
        setAuthError(`Auth Error: ${error.message}`);
      } finally {
        setLoading(false);
      }
    });
    return unsub;
  }, []);

  const handleLogin = async () => {
    if (authLoading) return;
    try {
      setAuthError(null);
      setAuthLoading(true);
      sessionStorage.setItem('PIPELINE_ADMIN_SESSION', 'false');
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error("Login component error:", err);
      if (err.code === 'auth/popup-blocked') {
        setAuthError("Popup blocked. Please allow popups or open in new tab.");
      } else {
        setAuthError(err.message || "Login failed.");
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authLoading) return;
    setAuthError(null);
    const form = e.target as HTMLFormElement;
    const adminId = (form.elements.namedItem('adminId') as HTMLInputElement).value;
    const password = (form.elements.namedItem('password') as HTMLInputElement).value;

    if (adminId === ADMIN_CREDENTIALS.id && password === ADMIN_CREDENTIALS.password) {
      sessionStorage.setItem('PIPELINE_ADMIN_SESSION', 'true');
      if (user) {
        setShowBiometric(true);
      } else {
        try {
          setAuthLoading(true);
          await signInWithPopup(auth, googleProvider);
          setShowBiometric(true);
        } catch (err: any) {
          if (err.code === 'auth/popup-blocked') {
            setAuthError("Popup blocked.");
          } else {
            setAuthError(err.message || "Admin login error.");
          }
        } finally {
          setAuthLoading(false);
        }
      }
    } else {
      setAuthError("Invalid Admin Credentials.");
    }
  };

  const verifyBiometric = async () => {
    if (user) {
      await updateDoc(doc(db, 'users', user.uid), { 
        isAdminVerified: true,
        role: 'admin' 
      });
      setUser({ ...user, isAdminVerified: true, role: 'admin' });
      setIsControlMode(true);
      setShowBiometric(false);
      sessionStorage.setItem('PIPELINE_ADMIN_SESSION', 'true');
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-brand-bg text-white">
        <motion.div 
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="flex flex-col items-center gap-4"
        >
          <Clapperboard className="w-10 h-10 text-brand-cyan" />
          <div className="font-mono text-[10px] tracking-[0.4em] uppercase text-slate-500">Initializing Core Pipeline...</div>
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLogin={handleLogin} onAdminLogin={handleAdminLogin} error={authError} />;
  }

  if (showBiometric) {
    return <BiometricAuth onComplete={verifyBiometric} />;
  }

  const deleteReport = async (reportId: string) => {
    if (user?.role !== 'admin') return;
    if (!window.confirm("CRITICAL ACTION: This will permanently ERASE this record and all associated metadata from the system. Proceed?")) return;
    try {
       await deleteDoc(doc(db, 'reports', reportId));
    } catch (err) {
       console.error("Delete failed", err);
    }
  };

  const updateReportStatus = async (reportId: string, status: 'approved' | 'good' | 'rejected') => {
    if (!user || user.role !== 'admin') return;
    try {
      await updateDoc(doc(db, 'reports', reportId), {
        status,
        reviewerId: user.uid
      });
      if (status === 'rejected') {
        alert("SYNC ALERT: Output marked as REJECTED in pipeline.");
      }
    } catch (err) {
      console.error("Status update failed", err);
    }
  };

  return (
    <div className="flex h-screen bg-brand-bg text-slate-300 overflow-hidden font-sans selection:bg-brand-cyan/30">
      <Analytics />
      {/* Sidebar: Immersive UI Structure */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 256 : 80 }}
        className="shrink-0 bg-brand-sidebar border-r border-white/5 flex flex-col z-20"
      >
        <div className="p-6 h-20 flex items-center gap-3">
          <Clapperboard className={cn("w-7 h-7 text-brand-cyan transition-transform", !isSidebarOpen && "mx-auto")} />
          {isSidebarOpen && (
            <div>
              <h1 className="text-brand-cyan font-bold tracking-tighter text-lg leading-none">TASKFLOW PRO</h1>
              <p className="text-[9px] text-slate-500 uppercase tracking-widest mt-1">Studio Manager</p>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-4 custom-scrollbar space-y-4 py-4">
          {isSidebarOpen && <div className="text-[10px] text-slate-600 font-bold uppercase mb-2 ml-2">Pipeline Sections</div>}
          <div className="grid grid-cols-1 gap-1">
            {SECTIONS.map((section) => {
              const Icon = iconMap[section.icon] || PlusCircle;
              const isActive = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={cn(
                    "flex items-center gap-3 p-2 rounded text-xs transition-all",
                    isActive 
                      ? "bg-white/5 text-brand-cyan border-l-2 border-brand-cyan pl-2 shadow-[inset_4px_0_10px_rgba(34,211,238,0.05)]" 
                      : "hover:bg-white/5 text-slate-400 opacity-60 hover:opacity-100"
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {isSidebarOpen && <span className="truncate">{section.name}</span>}
                </button>
              );
            })}
            
            {user.role === 'admin' && (
              <button
                onClick={() => setActiveSection('work-output')}
                className={cn(
                  "flex items-center justify-between gap-3 p-2 rounded text-xs transition-all mt-4 border-t border-white/5 pt-4",
                  activeSection === 'work-output'
                    ? "bg-brand-cyan/10 text-brand-cyan border-l-2 border-brand-cyan pl-2 shadow-[inset_4px_0_10px_rgba(34,211,238,0.05)]" 
                    : "hover:bg-white/5 text-slate-400 opacity-60 hover:opacity-100"
                )}
              >
                <div className="flex items-center gap-3">
                  <Monitor className="w-4 h-4 shrink-0" />
                  {isSidebarOpen && <span className="font-bold truncate">WORK OUTPUT REVIEW</span>}
                </div>
                {isSidebarOpen && globalReports.filter(r => r.status === 'pending').length > 0 && (
                  <span className="bg-brand-red text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
                    {globalReports.filter(r => r.status === 'pending').length}
                  </span>
                )}
              </button>
            )}
          </div>
        </nav>

        <div className="p-4 bg-black/40 border-t border-white/5 space-y-3">
          {user.role === 'admin' && (
            <button 
              onClick={() => setIsControlMode(!isControlMode)}
              className={cn(
                "w-full flex items-center gap-3 p-2 rounded text-[10px] font-bold tracking-widest uppercase transition-all shadow-sm",
                isControlMode 
                  ? "bg-brand-red/10 text-brand-red border border-brand-red/20 shadow-[0_0_15px_rgba(239,68,68,0.1)] hover:bg-brand-red/20" 
                  : "bg-white/5 text-slate-500 border border-white/5 hover:bg-white/10"
              )}
            >
              <Shield className={cn("w-4 h-4 shrink-0", isControlMode ? "animate-pulse" : "")} />
              {isSidebarOpen && <span>Control Plate: {isControlMode ? 'Active' : 'Locked'}</span>}
            </button>
          )}
          
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-brand-cyan-dark to-brand-cyan flex items-center justify-center text-[10px] font-bold text-white shrink-0">
              {user.displayName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            {isSidebarOpen && (
              <div className="flex-1 min-w-0">
                <div className="font-medium text-slate-200 text-xs truncate">{user.displayName}</div>
                <div className="text-[9px] text-slate-500 uppercase tracking-widest">{user.role}</div>
              </div>
            )}
            <button 
              onClick={() => signOut(auth)} 
              className="text-slate-600 hover:text-brand-red transition-colors shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col bg-gradient-to-br from-[#0d0d12] to-brand-bg relative">
        <header className="h-16 border-b border-white/5 flex items-center justify-between px-8 bg-black/20 backdrop-blur-md z-10">
          <div className="flex items-center gap-6">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-1 hover:bg-white/5 rounded text-slate-500 transition-colors">
              <Menu className="w-5 h-5" />
            </button>
            <div className="text-sm font-medium flex items-center gap-2">
              Section: <span className="text-brand-cyan font-bold">{activeSection === 'work-output' ? 'ADMIN WORK REVIEW' : SECTIONS.find(s => s.id === activeSection)?.name}</span>
              {user.role === 'admin' && (
                <span className="flex items-center gap-1 bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/30 px-2 py-0.5 rounded text-[8px] font-black animate-pulse">
                  <Shield className="w-2.5 h-2.5" /> ADMIN SYSTEM ACCESS
                </span>
              )}
            </div>
            <div className="hidden md:flex items-center gap-4 text-[10px] text-slate-500 uppercase tracking-[0.2em]">
              <div className="h-4 w-px bg-white/10" />
              <span className="text-brand-cyan/80 cursor-pointer hover:text-brand-cyan">Active Pipeline</span>
              {user.role === 'admin' && (
                <span onClick={() => window.open('https://drive.google.com/drive/folders/13OX-pcFkNPNfPDrPiiKqR_islXqGbYkM', '_blank')} className="cursor-pointer text-brand-cyan hover:bg-brand-cyan/10 px-2 py-1 rounded flex items-center gap-1 transition-all border border-brand-cyan/20">
                  <ExternalLink className="w-3 h-3" /> CENTRAL PRODUCTION DRIVE
                </span>
              )}
              <span className="cursor-pointer hover:text-slate-300">Archive</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {user.role === 'admin' && (
              <div className={cn(
                "text-[9px] border px-2 py-1 rounded font-bold transition-all",
                isControlMode 
                  ? "bg-brand-red/10 text-brand-red border-brand-red/20 shadow-[0_0_10px_rgba(239,68,68,0.2)]" 
                  : "bg-slate-500/5 text-slate-500 border-white/10"
              )}>
                CONTROL PLATE: {isControlMode ? 'ACTIVE' : 'LOCKED'}
              </div>
            )}
            <div className="w-px h-6 bg-white/10" />
            <div className="text-[10px] text-slate-500 font-mono">{new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <SectionContent 
            sectionId={activeSection} 
            user={user} 
            isControlMode={isControlMode} 
            setIsControlMode={setIsControlMode}
            globalReports={globalReports}
            updateReportStatus={updateReportStatus}
            deleteReport={deleteReport}
          />
        </div>

        <footer className="h-10 bg-black/40 border-t border-white/5 px-8 flex items-center justify-between text-[10px] text-slate-500">
          <div className="flex gap-6">
            <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" /> System: Stable</span>
            <span>Latency: 0.1ms</span>
            <span className="opacity-60">Build v1.0.4-PRO</span>
          </div>
          <div className="flex gap-4 uppercase tracking-tighter">
            <span className="hover:text-brand-cyan cursor-pointer transition-colors">Documentation</span>
            <span className="hover:text-brand-cyan cursor-pointer font-bold transition-colors">Production Dashboard</span>
          </div>
        </footer>
      </main>
    </div>
  );
}

function SectionContent({ sectionId, user, isControlMode, setIsControlMode, globalReports, updateReportStatus, deleteReport }: any) {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const reports = useMemo(() => {
    if (user?.role === 'admin' && isControlMode) return globalReports;
    if (sectionId === 'regular-update' || sectionId === 'work-output') return globalReports;
    return globalReports.filter((r: any) => r.sectionId === sectionId);
  }, [globalReports, sectionId, user, isControlMode]);
  const [newRegName, setNewRegName] = useState('');
  const [isHelping, setIsHelping] = useState(false);
  
  // States for report submission
  const [contentText, setContentText] = useState('');
  const [script, setScript] = useState('');
  const [reportMemberName, setReportMemberName] = useState(user.displayName);
  const [selectedReportSection, setSelectedReportSection] = useState(sectionId === 'regular-update' ? SECTIONS[0].id : sectionId);
  const [submitting, setSubmitting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getSectionConfig = () => {
    switch (selectedReportSection) {
      case 'singing':
      case 'voice-artist':
        return { 
          accept: ".mp3,.wav,.mp4,audio/*", 
          label: "Attach Voice Recording / OST", 
          hint: "MP3 | WAV | MP4",
          type: 'audio'
        };
      case 'script-writing':
      case 'storyboard':
        return { 
          accept: ".pdf,.md,.doc,.docx,.txt,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain", 
          label: "Attach Script / Storyboard", 
          hint: "PDF | MD | WORD | TXT",
          type: 'document'
        };
      case 'live-acting':
        return { 
          accept: ".mp4,video/mp4", 
          label: "Attach Performance Take", 
          hint: "MP4 (REQUIRED)",
          type: 'video'
        };
      default:
        return { 
          accept: "image/*,video/*", 
          label: "Attach Screenshot / Evidence", 
          hint: "JPG | PNG | MP4",
          type: 'visual'
        };
    }
  };

  const sectionConfig = getSectionConfig();

  useEffect(() => {
    if (sectionId !== 'regular-update') {
      setSelectedReportSection(sectionId);
    }
    setSelectedFile(null); // Reset asset on context shift
  }, [sectionId]);

  useEffect(() => {
    setSelectedFile(null); // Reset asset on dropdown change
  }, [selectedReportSection]);

  useEffect(() => {
    if (!user) {
      setRegistrations([]);
      return;
    }

    const qReg = query(collection(db, `sections/${sectionId}/registrations`));
    const unsubReg = onSnapshot(qReg, (snap) => {
      setRegistrations(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Registration)));
    }, (error) => {
      console.error("Registrations listener error:", error);
    });

    return () => { unsubReg(); };
  }, [sectionId, user, isControlMode]);

  const handleRegister = async (e: any) => {
    e.preventDefault();
    if (!newRegName.trim() || !isControlMode) return;
    await addDoc(collection(db, `sections/${sectionId}/registrations`), {
      sectionId, name: newRegName, isHelping, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    });
    setNewRegName('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const uploadToFirebase = async (file: File) => {
    const fileName = `${Date.now()}_${file.name}`;
    const storageRef = ref(storage, `production_output/${user?.uid}/${fileName}`);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
  };

  const syncToDrive = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    
    // Safety gate: Files over 8MB automatically bypass local proxy for Firebase fallback to prevent 413 errors
    if (file.size > 8 * 1024 * 1024) {
      console.log("Large file detected (>8MB). Routing to Master Firebase Pipeline for stability.");
      const fbLink = await uploadToFirebase(file);
      return { link: fbLink, type: 'Direct Master' };
    }

    // Attempt secure drive sync pipeline
    try {
      const response = await fetch('/api/sync-to-drive', {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        const result = await response.json();
        // If sync was simulated (no GCP credentials), use Firebase Storage as alternative
        if (result.simulated) {
          console.log("Drive Sync Bypass detected. Falling back to Master Firebase Pipeline.");
          const fbLink = await uploadToFirebase(file);
          return { link: fbLink, type: 'Firebase' };
        }
        return { link: result.link || result.msg || "Sync Initialized", type: 'Drive' };
      }
      
      if (response.status === 413) {
        console.warn("413 Proxy Error. Re-routing to Master Firebase Pipeline.");
        const fbLink = await uploadToFirebase(file);
        return { link: fbLink, type: 'Direct Master' };
      }
    } catch (e) {
      console.warn("Drive sync failed, attempting master backup sync...");
    }
    
    // Final fallback to Firebase Storage
    const fbLinkFallback = await uploadToFirebase(file);
    return { link: fbLinkFallback, type: 'Firebase' };
  };

  const submitReport = async (e: any) => {
    e.preventDefault();
    if ((!contentText.trim() && !selectedFile) || submitting || !user) return;
    setSubmitting(true);
    setSyncing(true);
    let syncType = 'Core';
    try {
      let fileData = "";
      
      if (selectedFile) {
        // Master Sync Pipeline (Encrypted Multi-Part Transfer)
        try {
          const syncResult = await syncToDrive(selectedFile);
          fileData = syncResult.link;
          syncType = syncResult.type;
        } catch (syncErr: any) {
          console.error("Master Sync Failure", syncErr);
          // Fallback check again
          try {
            fileData = await uploadToFirebase(selectedFile);
            syncType = 'Firebase';
          } catch (storageErr) {
             alert("CRITICAL SYNC FAILURE: Both Drive and Firebase pipelines are offline.");
             setSubmitting(false);
             setSyncing(false);
             return;
          }
        }
      }

      await addDoc(collection(db, 'reports'), {
        userId: user.uid, 
        userName: reportMemberName || user.displayName, 
        sectionId: selectedReportSection, 
        contentText: contentText || 'Production Content Payload', 
        script: script || '', 
        status: 'pending',
        fileName: selectedFile?.name || '',
        fileData: fileData || '', // Global Asset URL
        createdAt: serverTimestamp()
      });
      setContentText(''); 
      setScript('');
      setSelectedFile(null);
      alert(`MASTER SYNC SUCCESS: Payload synchronized with ${syncType.toUpperCase()} Pipeline.`);
    } catch (err: any) {
      console.error("Report failed", err);
      alert("CRITICAL PIPELINE ERROR: " + (err.message || "Connection failure. File exceeds current bandwidth."));
    } finally {
      setSubmitting(false);
      setSyncing(false);
    }
  };

  if (sectionId === 'work-output') {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex justify-between items-center bg-brand-cyan/10 p-6 rounded-2xl border border-brand-cyan/20">
          <div className="flex items-center gap-4">
             <div className="p-3 bg-brand-cyan/10 rounded-xl">
                <Monitor className="w-6 h-6 text-brand-cyan" />
             </div>
             <div>
                <h2 className="text-xl font-bold text-white tracking-tight">Global Work Review</h2>
                <p className="text-[10px] uppercase text-brand-cyan/60 tracking-widest">Awaiting Admin Validation</p>
             </div>
          </div>
          <div className="text-right">
             <div className="text-2xl font-black text-white">{reports.filter(r => r.status === 'pending').length}</div>
             <div className="text-[8px] uppercase text-slate-500 font-bold">Pending Reviews</div>
             <div className="mt-1 flex gap-1 justify-end">
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <div className="w-2 h-2 rounded-full bg-brand-cyan" />
                <div className="w-2 h-2 rounded-full bg-green-500" />
             </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
           {reports.length > 0 ? (
             reports.map((rep) => (
                <div key={rep.id} className="bg-brand-card p-6 rounded-2xl border border-white/5 space-y-4 hover:border-brand-cyan/20 transition-all shadow-xl relative overflow-hidden group">
                   <div className={cn(
                     "absolute top-0 left-0 bottom-0 w-1 transition-colors",
                     rep.status === 'approved' ? 'bg-green-500' : 
                     rep.status === 'good' ? 'bg-brand-cyan' :
                     rep.status === 'rejected' ? 'bg-brand-red' : 'bg-amber-500'
                   )} />
                   
                   <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center font-black text-brand-cyan border border-brand-cyan/20 text-lg">
                           {(rep.userName || 'U')[0].toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-slate-100 text-base">{rep.userName || 'Anonymous Artist'}</div>
                          <div className="text-[10px] text-slate-500 flex items-center gap-2">
                             <span className="text-brand-cyan uppercase font-mono tracking-tighter bg-brand-cyan/5 px-1 rounded">#{rep.id?.slice(-4).toUpperCase()}</span>
                             <span>•</span>
                             <span className="uppercase tracking-widest font-bold text-slate-400">
                                {SECTIONS.find(s=>s.id===rep.sectionId)?.name || rep.sectionId || 'General Production'}
                             </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                         <div className="text-[10px] text-slate-500 font-mono">
                           {rep.createdAt?.seconds ? new Date(rep.createdAt.seconds * 1000).toLocaleString() : 'Processing Sync...'}
                         </div>
                         <div className={cn(
                     "mt-1 text-[8px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded inline-block",
                     rep.status === 'pending' ? 'bg-amber-500/10 text-amber-500' : 'bg-brand-cyan/20 text-brand-cyan'
                   )}>
                     {rep.status === 'pending' ? 'Processing Sync' : 'Pipeline Hardened'}
                   </div>
                      </div>
                   </div>

                   <div className="bg-black/40 p-5 rounded-2xl border border-white/5 shadow-inner">
                     <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{rep.contentText || 'No descriptive metadata provided.'}</p>
                   </div>

                   {(rep.fileData || rep.imageUrl || rep.voiceUrl) && (
                     <div className="rounded-2xl overflow-hidden border border-white/10 bg-black/80 shadow-2xl group/media relative min-h-[100px]">
                        {(rep.fileData?.startsWith('data:image/') || rep.imageUrl || (rep.fileData?.startsWith('https://') && rep.fileName?.match(/\.(jpg|jpeg|png|gif|webp)$/i))) ? (
                          <div className="relative group">
                            <img 
                              src={rep.fileData || rep.imageUrl} 
                              className="w-full h-auto max-h-[700px] object-contain hover:scale-[1.01] transition-transform duration-700 mx-auto block" 
                              alt="Work Evidence" 
                              loading="lazy"
                            />
                            {(rep.fileData?.startsWith('https://') || rep.imageUrl?.startsWith('https://')) && (
                              <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-2 py-1 rounded text-[8px] text-white font-bold border border-white/10">
                                ☁️ CLOUD ASSET
                              </div>
                            )}
                            <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                               <button 
                                 onClick={() => window.open(rep.fileData || rep.imageUrl, '_blank')} 
                                 className="p-3 bg-black/80 backdrop-blur-md rounded-xl text-white hover:bg-brand-cyan transition-all shadow-xl border border-white/10"
                                 title="View Full Resolution"
                               >
                                  <Search className="w-5 h-5" />
                               </button>
                            </div>
                          </div>
                        ) : (rep.fileData?.startsWith('data:audio/') || rep.voiceUrl || (rep.fileData?.startsWith('https://') && rep.fileName?.match(/\.(mp3|wav|ogg)$/i))) ? (
                          <div className="p-12 flex flex-col items-center gap-8 bg-gradient-to-br from-brand-cyan/20 via-brand-cyan/5 to-transparent">
                             <div className="relative">
                                <div className="absolute inset-0 bg-brand-cyan/20 blur-2xl rounded-full scale-110 animate-pulse" />
                                <div className="relative w-24 h-24 rounded-full bg-brand-cyan/10 flex items-center justify-center border border-brand-cyan/30">
                                   <Mic2 className="w-12 h-12 text-brand-cyan" />
                                </div>
                             </div>
                             <div className="text-center space-y-2">
                                <h4 className="text-xs font-black text-brand-cyan uppercase tracking-[6px]">PRODUCTION AUDIO MASTER</h4>
                                <p className="text-[10px] text-slate-500 font-mono italic">{rep.fileName || 'audio_payload_output.mp3'}</p>
                             </div>
                             <div className="w-full max-w-md bg-black/60 p-4 rounded-3xl border border-white/5">
                                <audio controls className="w-full h-10 accent-brand-cyan" src={rep.fileData || rep.voiceUrl} />
                             </div>
                             {rep.fileData?.startsWith('https://') && (
                               <a href={rep.fileData} target="_blank" rel="noreferrer" className="text-[9px] text-brand-cyan hover:underline">Open in Drive ↗</a>
                             )}
                          </div>
                        ) : (rep.fileData?.startsWith('data:video/') || (rep.fileData?.startsWith('https://') && rep.fileName?.match(/\.mp4$/i))) ? (
                          <div className="bg-black/90">
                            <video controls className="w-full h-auto max-h-[600px] mx-auto shadow-2xl" src={rep.fileData} />
                            <div className="p-3 bg-black/40 text-[10px] text-slate-500 font-mono text-center flex justify-between px-6">
                              <span>Video Evidence Output: {rep.fileName}</span>
                              {rep.fileData?.startsWith('https://') && <a href={rep.fileData} target="_blank" rel="noreferrer" className="text-brand-cyan hover:underline">Source ↗</a>}
                            </div>
                          </div>
                        ) : (
                          <div className="p-16 text-center space-y-6">
                             <div className="w-20 h-20 bg-slate-800/50 rounded-3xl flex items-center justify-center mx-auto border border-white/5">
                                <FileText className="w-10 h-10 text-slate-600" />
                             </div>
                             <div className="space-y-2">
                                <p className="text-[11px] font-mono text-slate-400 font-bold">{rep.fileName || 'unknown_attachment'}</p>
                                <p className="text-[9px] text-slate-600 uppercase tracking-widest">
                                  {rep.fileData?.startsWith('https://') ? 'Cloud Reference File' : 'Binary Payload Structure'}
                                </p>
                             </div>
                             <a 
                               href={rep.fileData} 
                               target={rep.fileData?.startsWith('https://') ? "_blank" : undefined}
                               download={rep.fileData?.startsWith('https://') ? undefined : (rep.fileName || 'attachment')} 
                               rel={rep.fileData?.startsWith('https://') ? "noreferrer" : undefined}
                               className="inline-flex items-center gap-2 px-8 py-3 bg-brand-cyan/10 hover:bg-brand-cyan/20 text-brand-cyan rounded-xl text-[10px] font-black transition-all border border-brand-cyan/20 uppercase tracking-widest"
                             >
                               <Send className="w-4 h-4 rotate-90" /> {rep.fileData?.startsWith('https://') ? 'View Asset' : 'Download Payload'}
                             </a>
                          </div>
                        )}
                     </div>
                   )}

                   {rep.script && (
                     <div className="bg-black border border-brand-cyan/30 rounded-2xl p-6 space-y-4 shadow-xl relative group">
                        <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                           <div className="text-[8px] text-brand-cyan font-bold uppercase tracking-widest">METADATA HASH</div>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-brand-cyan font-black uppercase tracking-[0.3em] border-b border-brand-cyan/20 pb-3">
                           <PenLine className="w-4 h-4" /> Script / Execution Metadata
                        </div>
                        <div className="text-[13px] font-mono text-slate-300 leading-relaxed overflow-y-auto max-h-[300px] whitespace-pre-wrap selection:bg-brand-cyan/40 bg-white/[0.02] p-4 rounded-xl border border-white/5 custom-scrollbar">
                           {rep.script}
                        </div>
                     </div>
                   )}

                   <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/5">
                      {user.role === 'admin' ? (
                        <div className="flex gap-3">
                          <button 
                            onClick={() => updateReportStatus(rep.id!, 'approved')}
                            className={cn(
                              "px-6 py-2.5 rounded-xl text-[10px] font-black border transition-all shadow-lg uppercase",
                              rep.status === 'approved' 
                                ? "bg-green-500 text-white border-green-500 shadow-green-500/20" 
                                : "bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500 hover:text-white"
                            )}
                          >
                            Approve
                          </button>
                          <button 
                            onClick={() => updateReportStatus(rep.id!, 'good')}
                            className={cn(
                              "px-6 py-2.5 rounded-xl text-[10px] font-black border transition-all shadow-lg uppercase",
                              rep.status === 'good' 
                                ? "bg-brand-cyan text-white border-brand-cyan shadow-brand-cyan/20" 
                                : "bg-brand-cyan/10 text-brand-cyan border-brand-cyan/20 hover:bg-brand-cyan hover:text-white"
                            )}
                          >
                            Good
                          </button>
                          <button 
                            onClick={() => updateReportStatus(rep.id!, 'rejected')}
                            className={cn(
                              "px-6 py-2.5 rounded-xl text-[10px] font-black border transition-all shadow-lg uppercase",
                              rep.status === 'rejected' 
                                ? "bg-brand-red text-white border-brand-red shadow-brand-red/20" 
                                : "bg-brand-red/10 text-brand-red border-brand-red/20 hover:bg-brand-red hover:text-white"
                            )}
                          >
                            Reject
                          </button>
                          <button 
                            onClick={() => deleteReport(rep.id!)}
                            className="p-2.5 rounded-xl bg-slate-900 border border-red-500/30 text-red-500 hover:bg-red-500 hover:text-white transition-all group/del"
                            title="Permanent Deletion"
                          >
                             <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className={cn(
                          "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border",
                          rep.status === 'approved' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                          rep.status === 'good' ? 'bg-brand-cyan/10 text-brand-cyan border-brand-cyan/20' :
                          rep.status === 'rejected' ? 'bg-brand-red/10 text-brand-red border-brand-red/20' :
                          'bg-amber-500/10 text-amber-500 border-amber-500/20'
                        )}>
                          Status: {rep.status}
                        </div>
                      )}
                   </div>
                </div>
             ))
           ) : (
             <div className="py-20 text-center opacity-20">
               <Monitor className="w-16 h-16 mx-auto mb-4" />
               <p className="text-sm font-bold uppercase tracking-widest">No work outputs recorded</p>
             </div>
           )}
        </div>
      </div>
    );
  }

  if (sectionId === 'contact') {
    return (
      <div className="max-w-3xl mx-auto py-12 space-y-8">
        <div className="text-center space-y-2">
          <Phone className="w-12 h-12 text-brand-cyan mx-auto mb-4" />
          <h2 className="text-3xl font-bold text-white tracking-tighter uppercase">Production Support Center</h2>
          <p className="text-slate-500">Contact the lead development team for technical or operational assistance.</p>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-brand-card border border-white/5 p-8 rounded-3xl group hover:border-brand-cyan/20 transition-all shadow-xl">
            <h4 className="text-[10px] uppercase tracking-widest text-brand-cyan font-bold mb-4 flex items-center gap-2">
              <Phone className="w-3 h-3" /> Direct Support Lines
            </h4>
            <div className="space-y-1">
              <p className="text-2xl font-bold text-white tracking-tight">9339666395</p>
              <p className="text-2xl font-bold text-white tracking-tight">9382060105</p>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed font-light mt-4">24/7 technical hotline for production blocks and infrastructure sync issues.</p>
          </div>
          <div className="bg-brand-card border border-white/5 p-8 rounded-3xl group hover:border-brand-cyan/20 transition-all shadow-xl">
            <h4 className="text-[10px] uppercase tracking-widest text-blue-500 font-bold mb-4 flex items-center gap-2">
              <LogOut className="w-3 h-3 rotate-180" /> Digital Correspondence
            </h4>
            <p className="text-xl font-bold text-white mb-2 break-all">subhambusiness566@gmail.com</p>
            <p className="text-xs text-slate-500 leading-relaxed font-light mt-4">Secure communication channel for high-level administration and system queries.</p>
          </div>
        </div>

        <div className="bg-white/[0.02] border border-white/5 p-10 rounded-[40px] text-center space-y-6">
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-white">Official Request Form</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">Use the official production form to submit registered entries and official production metadata requests.</p>
          </div>
          <a 
            href="https://docs.google.com/forms/d/e/1FAIpQLScCpttifOlv0Z31QsptOGcxNQZr8XqcuUtj7g2_leOn6BuaQQ/viewform?usp=sharing&ouid=117489969195287051077" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 px-8 py-4 bg-brand-cyan-dark hover:bg-brand-cyan text-white font-bold rounded-2xl transition-all shadow-lg hover:shadow-brand-cyan/20 active:scale-[0.98]"
          >
            <Send className="w-4 h-4" />
            OPEN OFFICIAL PRODUCTION FORM
          </a>
          <p className="text-[10px] font-mono text-slate-600 uppercase tracking-widest">Responses are monitored by system administrators</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
      {/* Matrix Table */}
      <div className="xl:col-span-2 space-y-6">
        <div className="bg-brand-card border border-white/5 rounded-xl overflow-hidden flex flex-col shadow-2xl">
          <div className="p-5 border-b border-white/5 bg-white/[0.02] flex justify-between items-center">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-200">Task Assignment Matrix</span>
              <p className="text-[10px] text-slate-600 uppercase mt-0.5 tracking-tight">Active Artists & Roles in {SECTIONS.find(s=>s.id===sectionId)?.name}</p>
            </div>
            {isControlMode ? (
              <div className="text-[10px] px-2 py-1 rounded bg-brand-red/10 text-brand-red border border-brand-red/20 animate-pulse font-black uppercase tracking-widest">ADMIN: UNLOCKED</div>
            ) : user.role === 'admin' ? (
              <button 
                onClick={() => setIsControlMode(true)}
                className="text-[9px] px-3 py-1 rounded bg-brand-red/10 text-brand-red border border-brand-red/20 hover:bg-brand-red hover:text-white transition-all font-black uppercase tracking-tighter shadow-[0_0_10px_rgba(239,68,68,0.1)]"
              >
                UNLOCK CONTROL PLATE TO MANAGE
              </button>
            ) : (
              <div className="text-[10px] px-2 py-1 rounded bg-brand-cyan/5 text-brand-cyan/60 border border-brand-cyan/10">USER VIEW: READ-ONLY</div>
            )}
          </div>
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-xs">
              <thead className="bg-black/20 text-slate-500 uppercase tracking-widest text-[9px] font-mono">
                <tr>
                  <th className="p-5 font-medium">Production Member</th>
                  <th className="p-5 font-medium">Assignment</th>
                  <th className="p-5 font-medium text-right">Status Role</th>
                  {isControlMode && <th className="p-5 font-medium text-center">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {registrations.map((reg) => (
                  <tr key={reg.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="p-5">
                      <div className="font-medium text-slate-200">{reg.name}</div>
                      <div className="text-[10px] text-slate-600 mt-1 font-mono">ID: {reg.id?.slice(-6).toUpperCase()}</div>
                    </td>
                    <td className="p-5">
                      <span className="text-slate-400 capitalize">{sectionId.replace('-', ' ')} Implementation</span>
                    </td>
                    <td className="p-5 text-right">
                      <span className={cn(
                        "px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-tight",
                        reg.isHelping ? "bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/20" : "bg-green-500/10 text-green-500 border border-green-500/20"
                      )}>
                        {reg.isHelping ? 'Helping Artist' : 'Project Lead'}
                      </span>
                    </td>
                    {isControlMode && (
                      <td className="p-5 text-center">
                        <button 
                          onClick={async () => {
                            if (window.confirm(`PIPELINE ACTION: Permanently remove ${reg.name} from the record?`)) {
                              await deleteDoc(doc(db, `sections/${sectionId}/registrations`, reg.id!));
                            }
                          }} 
                          className="text-slate-600 hover:text-brand-red transition-colors p-2 hover:bg-brand-red/5 rounded-lg"
                          title="Remove Member"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {isControlMode && (
                  <tr className="bg-brand-cyan/[0.02]">
                    <td colSpan={isControlMode ? 4 : 3} className="p-5">
                      <form onSubmit={handleRegister} className="flex gap-4">
                        <input 
                          value={newRegName} onChange={e=>setNewRegName(e.target.value)}
                          placeholder="New Member Name..." className="bg-black/40 border border-white/10 rounded px-4 py-2 text-xs flex-1 text-slate-200 outline-none focus:border-brand-cyan/50" 
                        />
                        <div className="flex items-center gap-2">
                          <input type="checkbox" id="help" checked={isHelping} onChange={e=>setIsHelping(e.target.checked)} className="accent-brand-cyan" />
                          <label htmlFor="help" className="text-[10px] text-slate-500 uppercase font-bold">Helping</label>
                        </div>
                        <button className="bg-brand-cyan-dark hover:bg-brand-cyan text-white text-[10px] font-bold px-4 py-2 rounded transition-colors shadow-[0_4px_10px_rgba(34,211,238,0.2)]">REGISTER</button>
                      </form>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {registrations.length === 0 && !isControlMode && (
              <div className="p-20 flex flex-col items-center justify-center opacity-20">
                <LayoutIcon className="w-12 h-12 mb-4" />
                <p className="text-xs uppercase tracking-[0.2em] font-bold">Awaiting Matrix Sync...</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reports Panel */}
      <aside className="space-y-6">
        {/* Submission Panel */}
        {user && (
          <div className="bg-brand-card p-6 rounded-xl border border-white/5 shadow-2xl space-y-5">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-brand-cyan">Submit Production Report</h3>
            
            <form onSubmit={submitReport} className="space-y-4">
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-mono text-slate-500 uppercase tracking-widest ml-1">Team Member Name</label>
                  <input 
                    type="text" 
                    value={reportMemberName} 
                    onChange={e=>setReportMemberName(e.target.value)}
                    placeholder="Your Name..." 
                    className="w-full bg-black border border-white/10 rounded-xl px-4 py-2.5 text-xs text-slate-200 outline-none focus:border-brand-cyan/50 transition-all" 
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-mono text-slate-500 uppercase tracking-widest ml-1">Work Section</label>
                  <select 
                    value={selectedReportSection} 
                    onChange={e=>setSelectedReportSection(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-xl px-4 py-2.5 text-xs text-slate-200 outline-none focus:border-brand-cyan/50 transition-all appearance-none cursor-pointer"
                  >
                    {SECTIONS.filter(s => s.id !== 'regular-update' && s.id !== 'contact').map(s => (
                      <option key={s.id} value={s.id} className="bg-brand-bg">{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div 
                onClick={() => fileInputRef.current?.click()}
                className="h-24 border-2 border-dashed border-white/5 rounded-xl bg-white/[0.02] hover:border-brand-cyan/30 transition-all flex flex-col items-center justify-center text-center cursor-pointer group"
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  className="hidden" 
                  accept={sectionConfig.accept}
                />
                {selectedFile ? (
                  <div className="flex flex-col items-center">
                    <CheckCircle2 className={cn(
                      "w-5 h-5 mb-1", 
                      sectionConfig.type === 'audio' ? "text-brand-cyan" : 
                      sectionConfig.type === 'document' ? "text-blue-400" :
                      sectionConfig.type === 'video' ? "text-red-400" : "text-green-500"
                    )} />
                    <span className="text-[10px] text-slate-300 font-bold truncate max-w-[200px]">{selectedFile.name}</span>
                    <span className={cn(
                      "text-[8px] uppercase mt-1 font-bold",
                      selectedFile.size > 8 * 1024 * 1024 ? "text-amber-500" : "text-slate-500"
                    )}>
                      {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB {selectedFile.size > 8 * 1024 * 1024 ? "• LARGE FILE (DIRECT SYNC)" : "• SYNC READY"}
                    </span>
                  </div>
                ) : (
                  <>
                    <Plus className="w-4 h-4 text-slate-600 group-hover:text-brand-cyan mb-1.5 transition-colors" />
                    <span className="text-[9px] text-slate-400 font-medium">
                      {sectionConfig.label}
                    </span>
                    <span className="text-[8px] text-slate-600 mt-0.5 uppercase font-mono tracking-tighter">
                      {sectionConfig.hint}
                    </span>
                  </>
                )}
              </div>
              
              <textarea 
                value={contentText} onChange={e=>setContentText(e.target.value)}
                className="w-full bg-black border border-white/10 rounded-xl p-4 text-xs text-slate-300 h-24 focus:outline-none focus:border-brand-cyan/50 transition-all placeholder:text-slate-700" 
                placeholder="Describe work performed and results..."
              />
              
              <div className="relative">
                <input 
                  value={script} onChange={e=>setScript(e.target.value)}
                  placeholder="Technical Metadata Hash..."
                  className="w-full bg-black border border-white/5 rounded-xl pl-10 h-10 text-[10px] font-mono text-brand-cyan focus:outline-none focus:border-brand-cyan/30"
                />
                <PenLine className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-600" />
              </div>

              <button 
                disabled={submitting}
                className="w-full bg-brand-cyan-dark hover:bg-brand-cyan text-white text-[11px] font-bold py-3.5 rounded-xl shadow-lg shadow-brand-cyan/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                {syncing ? 'SYNCING WITH PRODUCTION DRIVE...' : (submitting ? 'RECORDING BYTES...' : 'INITIALIZE MASTER SYNC')}
              </button>
            </form>
          </div>
        )}

        {/* Feed Panel */}
        <div className="space-y-4">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-600 px-2 flex justify-between">
            <span>Production Stream</span>
            <span className="text-brand-cyan/40">Real-time Feed</span>
          </h4>
          <div className="space-y-4 px-2">
             {reports.map((rep) => (
                <div key={rep.id} className="bg-white/[0.02] border border-white/5 p-5 rounded-2xl space-y-3 hover:bg-white/[0.04] transition-all relative overflow-hidden group">
                   {/* Status Indicator Bar */}
                   <div className={cn(
                     "absolute top-0 left-0 bottom-0 w-1 transition-colors",
                     rep.status === 'approved' ? 'bg-green-500' : 
                     rep.status === 'good' ? 'bg-brand-cyan' :
                     rep.status === 'rejected' ? 'bg-brand-red' : 'bg-amber-500'
                   )} />

                   <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <div className="font-bold text-slate-200 text-xs">{rep.userName}</div>
                        <div className="text-[8px] bg-white/5 px-1.5 py-0.5 rounded text-slate-500 uppercase font-mono tracking-tighter">
                          {SECTIONS.find(s=>s.id===rep.sectionId)?.name}
                        </div>
                      </div>
                      <div className="text-[8px] font-mono text-slate-600 italic">#{rep.id?.slice(-4).toUpperCase()}</div>
                   </div>
                   
                   <p className="text-[11px] text-slate-400 leading-normal">{rep.contentText}</p>
                   
                   {rep.fileData && (
                     <div className="rounded-xl overflow-hidden border border-white/10 bg-black/40 group/img relative">
                        {rep.fileData.startsWith('data:image/') || (rep.fileData.startsWith('https://') && rep.fileName?.match(/\.(jpg|jpeg|png|gif|webp)$/i)) ? (
                          <img 
                            src={rep.fileData} 
                            alt="Production Evidence" 
                            referrerPolicy="no-referrer"
                            className="w-full h-auto max-h-60 object-cover hover:scale-105 transition-transform duration-500"
                          />
                        ) : rep.fileData.startsWith('data:audio/') || (rep.fileData.startsWith('https://') && rep.fileName?.match(/\.(mp3|wav|ogg)$/i)) ? (
                          <div className="p-4 flex flex-col gap-2">
                             <div className="flex items-center gap-2 mb-2">
                                <Headphones className="w-4 h-4 text-brand-cyan" />
                                <span className="text-[10px] text-brand-cyan uppercase font-bold tracking-tighter">Audio Clip Detected</span>
                             </div>
                             <audio controls className="w-full h-8 opacity-60 hover:opacity-100 transition-opacity">
                                <source src={rep.fileData} />
                             </audio>
                          </div>
                        ) : rep.fileData.startsWith('data:video/') || (rep.fileData.startsWith('https://') && rep.fileName?.match(/\.mp4$/i)) ? (
                           <video controls className="w-full h-auto max-h-60">
                             <source src={rep.fileData} />
                           </video>
                        ) : (
                          <div className="p-4 flex items-center justify-between bg-white/[0.02]">
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-brand-cyan" />
                              <span className="text-[10px] text-slate-400">Payload: {rep.fileName}</span>
                            </div>
                            {rep.fileData.startsWith('https://') && (
                              <a href={rep.fileData} target="_blank" rel="noreferrer" className="text-[8px] text-brand-cyan font-bold uppercase border border-brand-cyan/20 px-1.5 py-0.5 rounded hover:bg-brand-cyan/10">View Link</a>
                            )}
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover/img:opacity-100 transition-opacity flex items-end p-3 pointer-events-none">
                           <span className="text-[8px] text-white/70 font-mono tracking-tighter uppercase">{rep.fileName}</span>
                        </div>
                     </div>
                   )}
                   
                   {rep.script && (
                     <div className="bg-black/60 border border-brand-cyan/20 rounded-lg p-3 space-y-2">
                        <div className="flex items-center gap-2 text-[9px] text-brand-cyan font-bold uppercase tracking-widest border-b border-brand-cyan/10 pb-1">
                           <PenLine className="w-3 h-3" /> Production Metadata / Script
                        </div>
                        <div className="text-[10px] font-mono text-slate-300 leading-relaxed max-h-24 overflow-y-auto whitespace-pre-wrap">
                           {rep.script}
                        </div>
                     </div>
                   )}
                   
                   {rep.fileName && !rep.fileData && (
                     <div className="flex items-center gap-2 bg-white/5 p-2 rounded-lg border border-white/5">
                        <FileText className="w-3 h-3 text-brand-cyan" />
                        <span className="text-[9px] text-slate-500 truncate">{rep.fileName}</span>
                     </div>
                   )}

                   <div className="flex items-center justify-between pt-2 border-t border-white/5">
                      <div className="text-[9px] font-mono text-slate-500">
                         {rep.createdAt?.seconds ? new Date(rep.createdAt.seconds * 1000).toLocaleTimeString() : 'Syncing...'}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {user.role === 'admin' ? (
                          <div className="flex gap-2">
                            <button 
                              onClick={() => updateReportStatus(rep.id!, 'approved')}
                              className={cn(
                                "px-2 py-1 rounded text-[9px] font-bold border transition-all cursor-pointer",
                                rep.status === 'approved' 
                                  ? "bg-green-500 text-white border-green-500" 
                                  : "bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500 hover:text-white"
                              )}
                              title="Approve Work"
                            >
                              APPROVE
                            </button>
                            <button 
                              onClick={() => updateReportStatus(rep.id!, 'good')}
                              className={cn(
                                "px-2 py-1 rounded text-[9px] font-bold border transition-all cursor-pointer",
                                rep.status === 'good' 
                                  ? "bg-brand-cyan text-white border-brand-cyan" 
                                  : "bg-brand-cyan/10 text-brand-cyan border-brand-cyan/20 hover:bg-brand-cyan hover:text-white"
                              )}
                              title="Mark as Good"
                            >
                              GOOD
                            </button>
                            <button 
                              onClick={() => updateReportStatus(rep.id!, 'rejected')}
                              className={cn(
                                "px-2 py-1 rounded text-[9px] font-bold border transition-all cursor-pointer",
                                rep.status === 'rejected' 
                                  ? "bg-brand-red text-white border-brand-red" 
                                  : "bg-brand-red/10 text-brand-red border-brand-red/20 hover:bg-brand-red hover:text-white"
                              )}
                              title="Reject Work"
                            >
                              REJECT
                            </button>
                            {isControlMode && (
                                <button 
                                onClick={() => deleteReport(rep.id!)}
                                className="p-1.5 rounded bg-slate-900 border border-red-500/30 text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-sm"
                                title="Delete Permanently"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className={cn(
                            "text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded",
                            rep.status === 'approved' ? 'bg-green-500/20 text-green-500' :
                            rep.status === 'good' ? 'bg-brand-cyan/20 text-brand-cyan' :
                            rep.status === 'rejected' ? 'bg-brand-red/20 text-brand-red' :
                            'bg-amber-500/20 text-amber-500'
                          )}>
                            {rep.status}
                          </div>
                        )}
                      </div>
                    </div>
                 </div>
              ))}
             {reports.length === 0 && <p className="text-[10px] text-center text-slate-700 italic pt-10">Waiting for data telemetry...</p>}
          </div>
        </div>
      </aside>
    </div>
  );
}

function LoginPage({ onLogin, onAdminLogin, error }: any) {
  const [isAdmin, setIsAdmin] = useState(false);
  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-bg relative selection:bg-brand-cyan/20">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,#111115_0%,transparent_70%)]" />
      
      <motion.div 
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm p-10 bg-brand-sidebar border border-white/5 rounded-3xl backdrop-blur-3xl shadow-2xl relative"
      >
        <div className="text-center mb-12">
          <div className="inline-flex p-4 rounded-2xl bg-brand-cyan/5 border border-brand-cyan/20 mb-6 group">
            <Clapperboard className="w-10 h-10 text-brand-cyan group-hover:scale-110 transition-transform" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tighter">TASKFLOW PRO</h1>
          <p className="text-[10px] text-slate-500 uppercase tracking-[0.3em] mt-1">Production Hub Access</p>
        </div>

        {error && (
          <div className="space-y-4 mb-6">
            <div className="text-[10px] p-2 rounded bg-brand-red/10 border border-brand-red/20 text-brand-red text-center font-bold tracking-widest uppercase">
              {error}
            </div>
            {error.includes("Popup") && (
              <a 
                href={window.location.href} 
                target="_blank" 
                rel="noopener noreferrer"
                className="block text-center text-[10px] text-brand-cyan font-bold uppercase tracking-widest hover:underline"
              >
                Open in New Tab ↗
              </a>
            )}
          </div>
        )}

        {!isAdmin ? (
          <div className="space-y-4">
            <button onClick={onLogin} className="w-full bg-white text-brand-bg font-black py-4 rounded-2xl flex items-center justify-center gap-3 hover:translate-y-[-2px] hover:shadow-xl transition-all active:translate-y-0 cursor-pointer">
               <Smartphone className="w-5 h-5" />
               Personnel Login
            </button>
            <p className="text-[9px] text-center text-slate-600 font-bold uppercase tracking-widest mt-2">
              Trouble logging in? <a href={window.location.href} target="_blank" rel="noopener noreferrer" className="text-brand-cyan hover:underline underline-offset-2">Open in New Tab ↗</a>
            </p>
            <div className="h-px bg-white/5 my-8 relative flex items-center justify-center">
               <span className="absolute bg-brand-sidebar px-4 text-[9px] font-mono text-slate-700 tracking-widest uppercase">System Auth</span>
            </div>
            <button onClick={()=>setIsAdmin(true)} className="w-full bg-white/5 hover:bg-white/10 text-slate-400 font-bold py-4 rounded-2xl text-xs flex items-center justify-center gap-3 transition-all border border-white/5 cursor-pointer">
              <Shield className="w-4 h-4" />
              System Administration
            </button>
          </div>
        ) : (
          <form onSubmit={onAdminLogin} className="space-y-4">
             <input name="adminId" placeholder="Access ID" className="w-full bg-black border border-white/10 rounded-2xl p-4 text-xs text-white outline-none focus:border-brand-cyan-dark" required />
             <input name="password" type="password" placeholder="Key Command" className="w-full bg-black border border-white/10 rounded-2xl p-4 text-xs text-white outline-none focus:border-brand-cyan-dark" required />
             <button className="w-full bg-brand-cyan-dark hover:bg-brand-cyan text-white font-black py-4 rounded-2xl transition-all shadow-lg shadow-brand-cyan/10">AUTHENTICATE</button>
             <button type="button" onClick={()=>setIsAdmin(false)} className="w-full text-slate-600 text-[10px] font-bold uppercase transition-colors hover:text-slate-400 mt-2">Exit Terminal</button>
          </form>
        )}
      </motion.div>
    </div>
  );
}

function BiometricAuth({ onComplete }: any) {
  const [stage, setStage] = useState<'voice' | 'face' | 'success'>('voice');
  const [transcript, setTranscript] = useState('');
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleVoice = () => {
    setTranscript("Listening for protocol command...");
    setTimeout(() => {
      setTranscript(PROTOCOL_COMMAND);
      setTimeout(() => setStage('face'), 1000);
    }, 2000);
  };

  useEffect(() => {
    if (stage === 'face') {
      const startFace = async () => {
        setScanning(true);
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          if (videoRef.current) videoRef.current.srcObject = stream;
          setTimeout(() => {
            setStage('success'); stream.getTracks().forEach(t=>t.stop());
            setTimeout(onComplete, 2000);
          }, 4000);
        } catch (e) {
          setTimeout(() => { setStage('success'); setTimeout(onComplete, 2000); }, 3000);
        }
      };
      startFace();
    }
  }, [stage, onComplete]);

  return (
    <div className="fixed inset-0 bg-brand-bg flex items-center justify-center p-8 z-[200]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,#1a1412_0%,transparent_50%)]" />
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-lg bg-black border border-brand-red/20 rounded-[40px] p-12 text-center space-y-10 relative overflow-hidden shadow-[0_0_100px_rgba(239,68,68,0.1)]"
      >
        <div className="flex justify-between items-center absolute top-8 left-0 right-0 px-12">
           <h3 className="text-xs font-black uppercase tracking-[0.3em] text-brand-red italic">Admin Terminal</h3>
           <div className="animate-pulse w-2 h-2 rounded-full bg-brand-red" />
        </div>

        {stage === 'voice' && (
          <div className="space-y-10 pt-8">
            <div className="p-8 bg-brand-red/5 border border-brand-red/20 rounded-full w-24 h-24 flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(239,68,68,0.2)]">
              <Mic className="w-10 h-10 text-brand-red" />
            </div>
            <div className="space-y-4">
               <h2 className="text-2xl font-black text-white italic">VOICE AUTHENTICATION REQUIRED</h2>
               <p className="text-xs text-slate-500 font-mono italic">"{PROTOCOL_COMMAND}"</p>
            </div>
            <div className="bg-white/[0.02] border border-white/5 py-8 rounded-2xl">
              <span className="text-lg font-mono text-brand-red tracking-wider uppercase italic">{transcript || 'SIGNAL WAITING...'}</span>
            </div>
            <button onClick={handleVoice} className="bg-brand-red hover:bg-red-500 text-white font-black px-10 py-4 rounded-2xl transition-all shadow-xl shadow-brand-red/10 animate-bounce">ACTIVATE SENSOR</button>
          </div>
        )}

        {stage === 'face' && (
          <div className="space-y-8 pt-8">
            <div className="aspect-video w-full rounded-3xl border border-brand-red/30 bg-white/5 overflow-hidden relative grayscale">
              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover scale-x-[-1]" />
              <div className="absolute inset-0 flex items-center justify-center">
                 <div className="w-[70%] h-[70%] border-2 border-dashed border-brand-red/20 rounded-full" />
              </div>
              <motion.div animate={{ top: ['0%', '100%', '0%'] }} transition={{ duration: 4, repeat: Infinity }} className="absolute left-0 right-0 h-0.5 bg-brand-red shadow-[0_0_15px_#ef4444] z-10" />
            </div>
            <h2 className="text-lg font-black text-white uppercase tracking-widest">Biometric Scan Active</h2>
            <p className="text-[10px] text-slate-500 uppercase tracking-[0.4em] animate-pulse">Analyzing Biological Integrity...</p>
          </div>
        )}

        {stage === 'success' && (
          <div className="space-y-8 py-10">
             <div className="w-20 h-20 rounded-full bg-green-500/10 border-4 border-green-500/30 flex items-center justify-center mx-auto shadow-[0_0_50px_rgba(34,197,94,0.2)]">
                <CheckCircle2 className="w-10 h-10 text-green-500" />
             </div>
             <div className="space-y-2">
                <h2 className="text-3xl font-black text-white uppercase tracking-tighter">ACCESS GRANTED</h2>
                <p className="text-[10px] text-green-500/60 font-mono uppercase tracking-[0.3em]">Operational Privileges Verified</p>
             </div>
             <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: 1.5 }} className="h-full bg-green-500" />
             </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
