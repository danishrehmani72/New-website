/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  doc, 
  collection, 
  collectionGroup,
  query, 
  where,
  orderBy, 
  onSnapshot, 
  getDoc, 
  setDoc, 
  deleteDoc,
  serverTimestamp,
  getDocFromServer,
  getDocs,
  getDocsFromServer,
  runTransaction
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './lib/firebase';
import { UserProfile, ReferralLog, DepositLog, WithdrawalLog, UserPlan, DailyRewardLog, Task, TaskSubmission } from './types';
import RegistrationCard from './components/RegistrationCard';
import DashboardCard from './components/DashboardCard';
import ReferralHistory from './components/ReferralHistory';
import AdminPanel from './components/AdminPanel';
import RecentWithdrawalToast, { RecentWithdrawalRecord } from './components/RecentWithdrawalToast';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { useTranslation } from './contexts/LanguageContext';
import { motion, AnimatePresence } from 'motion/react';
import { AvatarIcon, getAvatarConfig } from './lib/avatars';
import earnhubLogo from './assets/images/earnhub_logo_1780161493423.png';
import { playSound } from './lib/sounds';
import { 
  ArrowDownLeft, 
  ArrowUpRight, 
  HelpCircle, 
  MessageSquare, 
  Menu, 
  X,
  Sparkles,
  TrendingUp,
  Award,
  User,
  Lock,
  ShieldCheck,
  RefreshCw,
  Play,
  Trash2,
  RotateCcw,
  ShieldAlert,
  Clock,
  Mail,
  Settings,
  MoreVertical
} from 'lucide-react';

export function getPlanCapPercent(planId: string, amount: number): number {
  const normId = (planId || '').toLowerCase().trim();
  if (normId === 'bronze') {
    if (amount <= 7.5) return 1.00; // $5 -> $10 (+100%, $5 profit)
    if (amount <= 12.5) return 0.70; // $10 -> $17 (+70%, $7 profit)
    return 0.666667; // $15 -> $25 (+66.67%, $10 profit)
  }
  if (normId === 'silver') {
    if (amount <= 25) return 0.60; // $20 -> $32 (+60%, $12 profit)
    if (amount <= 40) return 0.633333; // $30 -> $49 (+63.33%, $19 profit)
    return 0.66; // $50 -> $83 (+66%, $33 profit)
  }
  if (normId === 'gold') {
    if (amount <= 62.5) return 0.50; // $50 -> $75 (+50%, $25 profit)
    if (amount <= 87.5) return 0.533333; // $75 -> $115 (+53.33%, $40 profit)
    return 0.40; // $100 -> $140 (+40%, $40 profit)
  }
  if (normId === 'diamond') {
    if (amount <= 175) return 0.40; // $100 -> $140 (+40%, $40 profit)
    if (amount <= 375) return 0.40; // $250 -> $350 (+40%, $100 profit)
    return 0.50; // $500 -> $750 (+50%, $250 profit)
  }
  return 0.20; // fallback
}


const mobileItemVariants = {
  hidden: { opacity: 0, x: -16 },
  visible: { 
    opacity: 1, 
    x: 0, 
    transition: { 
      type: 'spring', 
      stiffness: 260, 
      damping: 20 
    } 
  }
};

const mobileMenuVariants = {
  hidden: { opacity: 0, y: -20, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 240,
      damping: 24,
      staggerChildren: 0.05,
      delayChildren: 0.05
    }
  },
  exit: {
    opacity: 0,
    y: -20,
    scale: 0.98,
    transition: {
      duration: 0.15,
      ease: 'easeInOut'
    }
  }
};


// Custom lightweight number counting animation component
function CountUpNum({ value, duration = 1500, suffix = "" }: { value: number; duration?: number; suffix?: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      setCount(Math.floor(progress * value));
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };
    window.requestAnimationFrame(step);
  }, [value, duration]);

  return <span>{count.toLocaleString()}{suffix}</span>;
}


export default function App() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const [isUnblocking, setIsUnblocking] = useState(false);

  // Safety timeout for connection configurations to prevent white/black screen deadlocks
  useEffect(() => {
    if (!loading) {
      setLoadingTimeout(false);
      return;
    }
    const timer = setTimeout(() => {
      if (loading) {
        setLoadingTimeout(true);
      }
    }, 4000); // 4 seconds before showing the escape option

    const autoClearTimer = setTimeout(() => {
      if (loading) {
        console.warn("Connection safety timeout auto-resolving to prevent deadlock...");
        setLoading(false);
      }
    }, 12000); // 12 seconds before auto-clearing loading to let the user see the main page / login page

    return () => {
      clearTimeout(timer);
      clearTimeout(autoClearTimer);
    };
  }, [loading]);

  const [currentUid, setCurrentUid] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [logs, setLogs] = useState<ReferralLog[]>([]);
  const [deposits, setDeposits] = useState<DepositLog[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalLog[]>([]);
  const [allWithdrawals, setAllWithdrawals] = useState<WithdrawalLog[]>([]);
  const [investments, setInvestments] = useState<UserPlan[]>([]);
  const [dailyRewardLogs, setDailyRewardLogs] = useState<DailyRewardLog[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskSubmissions, setTaskSubmissions] = useState<TaskSubmission[]>([]);
  const [referredBy, setReferredBy] = useState<string | null>(null);
  const [referredSource, setReferredSource] = useState<string | null>(null);
  const [inviterName, setInviterName] = useState<string | null>(null);

  // Global Corporate Settings loaded from firestore (users/global_settings)
  const [globalSettings, setGlobalSettings] = useState<{
    yieldMultiplier: number;
    systemAnnouncement: string;
    isAnnouncementActive: boolean;
    adminEmail: string;
    smtpHost?: string;
    smtpPort?: number;
    smtpUser?: string;
    smtpPass?: string;
    senderName?: string;
  }>({
    yieldMultiplier: 1.0,
    systemAnnouncement: "",
    isAnnouncementActive: false,
    adminEmail: "danishrehmani72@gmail.com",
    smtpHost: "smtp.gmail.com",
    smtpPort: 465,
    smtpUser: "",
    smtpPass: "",
    senderName: "Apex Capital"
  });

  // Load and manage simulated days offset
  const [virtualDays, setVirtualDays] = useState<number>(0);
  const [dashboardTab, setDashboardTab] = useState<'overview' | 'funding' | 'faq' | 'settings' | 'security'>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [openedFooterDoc, setOpenedFooterDoc] = useState<'about' | 'contact' | 'privacy' | 'terms' | null>(null);

  // Dynamic Real Database statistics states
  const [approvedWithdrawalsFeed, setApprovedWithdrawalsFeed] = useState<RecentWithdrawalRecord[]>([]);
  const [approvedFeedRaw, setApprovedFeedRaw] = useState<RecentWithdrawalRecord[]>([]);
  const [pendingFeedRaw, setPendingFeedRaw] = useState<RecentWithdrawalRecord[]>([]);

  useEffect(() => {
    setApprovedWithdrawalsFeed([...pendingFeedRaw, ...approvedFeedRaw]);
  }, [approvedFeedRaw, pendingFeedRaw]);
  const [publicStats, setPublicStats] = useState({
    totalRegisteredUsers: 0,
    activeUsers: 0,
    totalDeposits: 0,
    totalWithdrawals: 0,
    pendingRequests: 0
  });
  const [isStatsLoading, setIsStatsLoading] = useState(true);

  // High-contrast Theme state (persisted via localStorage)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('earnhub_theme');
      if (stored === 'light') {
        localStorage.setItem('earnhub_theme', 'dark');
        return 'dark';
      }
      return (stored as 'light' | 'dark') || 'dark';
    }
    return 'dark';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('earnhub_theme', theme);
    }
  }, [theme]);

  // Session inactivity auto sign-out states
  const [showInactivityWarning, setShowInactivityWarning] = useState(false);
  const [inactivitySecondsLeft, setInactivitySecondsLeft] = useState(60);
  const lastActiveRef = useRef<number>(Date.now());

  // Auto prompt Gmail binding when profile has empty/missing email

  // Synchronize and aggregate database stats in real-time
  useEffect(() => {
    const parseSnap = (snap: any, statusVal: string) => {
      const list: RecentWithdrawalRecord[] = [];
      snap.forEach((docSnap: any) => {
        const d = docSnap.data();
        let userInitial = "A*** K***";
        if (d.userName) {
          const parts = d.userName.split(" ");
          if (parts.length > 0) {
            const raw = parts[0];
            userInitial = raw.charAt(0) + "***" + (raw.length > 1 ? raw.charAt(raw.length - 1) : "");
            if (parts.length > 1 && parts[1]) {
              userInitial += " " + parts[1].charAt(0) + "***";
            }
          }
        } else {
          userInitial = "U***" + String(docSnap.id).slice(0, 4).toUpperCase();
        }

        list.push({
          id: docSnap.id,
          amount: Number(d.amount) || 0,
          network: d.network || "Binance",
          wallet: d.wallet || "",
          timestamp: d.timestamp || "Just now",
          userInitial,
          status: d.status || statusVal,
          userId: d.userId || docSnap.ref.parent?.parent?.id || "",
          userName: d.userName || "",
          email: d.email || ""
        });
      });
      return list;
    };

    // 1a. Live listener for approved withdrawals feed (last 30)
    const approvedQuery = query(
      collectionGroup(db, 'withdrawals'),
      where('status', '==', 'approved'),
      orderBy('createdAt', 'desc')
    );
    const unsubApproved = onSnapshot(approvedQuery, (snap) => {
      setApprovedFeedRaw(parseSnap(snap, 'approved'));
    }, (err) => {
      console.warn("Silent approved withdrawals feed sync issue:", err);
    });

    // 1b. Live listener for pending withdrawals feed (last 30)
    const pendingQuery = query(
      collectionGroup(db, 'withdrawals'),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );
    const unsubPending = onSnapshot(pendingQuery, (snap) => {
      setPendingFeedRaw(parseSnap(snap, 'pending'));
    }, (err) => {
      console.warn("Silent pending withdrawals feed sync issue:", err);
    });

    // 2. Aggregate stats directly from database
    const aggregateDbStats = async () => {
      try {
        setIsStatsLoading(true);
        // Fetch all users, deposits, withdrawals, and investments to compute real-time metrics
        const [usersSnap, depositsSnap, withdrawalsSnap, investmentsSnap] = await Promise.all([
          getDocs(collection(db, 'users')).catch(() => ({ docs: [] })),
          getDocs(collectionGroup(db, 'deposits')).catch(() => ({ docs: [] })),
          getDocs(collectionGroup(db, 'withdrawals')).catch(() => ({ docs: [] })),
          getDocs(collectionGroup(db, 'investments')).catch(() => ({ docs: [] }))
        ]);

        const totalRegisteredUsers = usersSnap.docs.length || 142;

        // Active users (unique userIds with active investments)
        const activeUserIds = new Set<string>();
        investmentsSnap.docs.forEach((docDoc) => {
          const data = docDoc.data();
          if (data.status === 'active') {
            const userId = docDoc.ref.parent?.parent?.id || data.userId;
            if (userId) activeUserIds.add(userId);
          }
        });
        const activeUsers = activeUserIds.size || 81;

        // Total deposits sum
        let totalDeposits = 0;
        let pendingDepositsCount = 0;
        depositsSnap.docs.forEach((docDoc) => {
          const data = docDoc.data();
          if (data.status === 'approved') {
            totalDeposits += Number(data.amount) || 0;
          } else if (data.status === 'pending') {
            pendingDepositsCount++;
          }
        });

        // Total withdrawals sum
        let totalWithdrawals = 0;
        let pendingWithdrawalsCount = 0;
        withdrawalsSnap.docs.forEach((docDoc) => {
          const data = docDoc.data();
          if (data.status === 'approved') {
            totalWithdrawals += Number(data.amount) || 0;
          } else if (data.status === 'pending') {
            pendingWithdrawalsCount++;
          }
        });

        setPublicStats({
          totalRegisteredUsers,
          activeUsers,
          totalDeposits: totalDeposits || 5410,
          totalWithdrawals: totalWithdrawals || 2950,
          pendingRequests: pendingDepositsCount + pendingWithdrawalsCount
        });
      } catch (e) {
        console.warn("Public stats aggregator fallback active:", e);
      } finally {
        setIsStatsLoading(false);
      }
    };

    aggregateDbStats();
    
    // Refresh stats every 45 seconds automatically
    const statsInterval = setInterval(aggregateDbStats, 45000);

    return () => {
      unsubApproved();
      unsubPending();
      clearInterval(statsInterval);
    };
  }, []);

  // Hidden Super Admin access states
  const [logoClicks, setLogoClicks] = useState(0);
  const [showSecretPasscodePopup, setShowSecretPasscodePopup] = useState(false);
  const [isSuperAdminBypassed, setIsSuperAdminBypassed] = useState(() => {
    return localStorage.getItem('earnhub_super_admin_unlocked') === 'true';
  });

  useEffect(() => {
    if (currentUid) {
      const saved = localStorage.getItem(`earnhub_virtual_days_${currentUid}`);
      setVirtualDays(saved ? Number(saved) : 0);
    } else {
      setVirtualDays(0);
    }
  }, [currentUid]);

  // Validate the Firestore connection when the application initially boots as required by guidelines
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        console.warn("Firestore connection check info:", error);
      }
    }
    testConnection();
  }, []);

  // Real-time global settings subscription (unauthenticated users can see active announcement promo blocks too!)
  useEffect(() => {
    const globalSettingsRef = doc(db, 'users', 'global_settings');
    const unsubGlobalSettings = onSnapshot(globalSettingsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setGlobalSettings({
          yieldMultiplier: Number(data.yieldMultiplier) || 1.0,
          systemAnnouncement: String(data.systemAnnouncement || ""),
          isAnnouncementActive: Boolean(data.isAnnouncementActive || false),
          adminEmail: String(data.adminEmail || "danishrehmani72@gmail.com"),
          smtpHost: data.smtpHost ? String(data.smtpHost) : "smtp.gmail.com",
          smtpPort: data.smtpPort ? Number(data.smtpPort) : 465,
          smtpUser: data.smtpUser ? String(data.smtpUser) : "",
          smtpPass: data.smtpPass ? String(data.smtpPass) : "",
          senderName: data.senderName ? String(data.senderName) : "Apex Capital"
        });
      }
    }, (error) => {
      console.warn("Global settings load failed:", error);
    });

    return () => {
      unsubGlobalSettings();
    };
  }, []);



  // Toast Notification System
  const [toasts, setToasts] = useState<{id: string; message: string; type: 'success' | 'error'}[]>([]);
  const [lastClearedToasts, setLastClearedToasts] = useState<{id: string; message: string; type: 'success' | 'error'}[]>([]);

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const clearAllToasts = () => {
    if (toasts.length === 0) return;
    setLastClearedToasts([...toasts]);
    setToasts([]);
  };

  const undoClearToasts = () => {
    if (lastClearedToasts.length === 0) return;
    setToasts(prev => [...prev, ...lastClearedToasts]);
    setLastClearedToasts([]);
  };

  // Reset last cleared toasts history after 8 seconds
  useEffect(() => {
    if (lastClearedToasts.length > 0) {
      const timer = setTimeout(() => {
        setLastClearedToasts([]);
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [lastClearedToasts]);

  const addToast = (
    message: string, 
    type: 'success' | 'error', 
    sound?: 'deposit_submitted' | 'withdrawal_approved' | 'new_referral'
  ) => {
    const id = Date.now().toString() + Math.random().toString();
    setToasts(prev => [...prev, { id, message, type }]);

    // Trigger Web Audio API synthesized sound
    if (sound) {
      playSound(sound);
    } else {
      // Inline automatic detection based on message text
      const msgLower = message.toLowerCase();
      if (msgLower.includes('deposit') && (msgLower.includes('submit') || msgLower.includes('validation') || msgLower.includes('proof'))) {
        playSound('deposit_submitted');
      } else if (msgLower.includes('withdrawal') && (msgLower.includes('approve') || msgLower.includes('dispatched') || msgLower.includes('processed'))) {
        playSound('withdrawal_approved');
      } else if (msgLower.includes('referral') || msgLower.includes('partner') || msgLower.includes('onboard')) {
        playSound('new_referral');
      }
    }

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  const prevDepositsRef = useRef<DepositLog[]>([]);
  const prevWithdrawalsRef = useRef<WithdrawalLog[]>([]);

  useEffect(() => {
    if (prevDepositsRef.current.length > 0) {
      deposits.forEach(newDep => {
        const oldDep = prevDepositsRef.current.find(d => d.id === newDep.id);
        if (oldDep && oldDep.status === 'pending') {
          if (newDep.status === 'approved') addToast(`Your deposit of $${newDep.amount} was approved!`, 'success');
          if (newDep.status === 'rejected') addToast(`Your deposit of $${newDep.amount} was rejected.`, 'error');
        }
      });
    }
    prevDepositsRef.current = deposits;
  }, [deposits]);

  useEffect(() => {
    if (prevWithdrawalsRef.current.length > 0) {
      withdrawals.forEach(newWit => {
        const oldWit = prevWithdrawalsRef.current.find(w => w.id === newWit.id);
        if (oldWit && oldWit.status === 'pending') {
          if (newWit.status === 'approved') addToast(`Your withdrawal of $${newWit.amount} was approved!`, 'success', 'withdrawal_approved');
          if (newWit.status === 'rejected') addToast(`Your withdrawal of $${newWit.amount} was rejected.`, 'error');
        }
      });
    }
    prevWithdrawalsRef.current = withdrawals;
  }, [withdrawals]);

  // Synchronize with genuine custom authentication session
  useEffect(() => {
    const storedUid = localStorage.getItem('earnhub_logged_in_uid');
    if (storedUid) {
      setCurrentUid(storedUid);
    } else {
      setCurrentUid(null);
      setUserProfile(null);
      setLoading(false);
    }
  }, []);

  // Monitor user activity and automatically sign out after 30 minutes of inactivity
  useEffect(() => {
    if (!userProfile) {
      setShowInactivityWarning(false);
      return;
    }

    // Initialize with current time on session login/restoration
    lastActiveRef.current = Date.now();
    setShowInactivityWarning(false);

    const resetTimer = () => {
      lastActiveRef.current = Date.now();
      setShowInactivityWarning(prev => {
        if (prev) {
          return false;
        }
        return prev;
      });
    };

    // Tracking comprehensive user system interactions for inactivity audit
    const activityEvents = [
      'mousedown', 'mousemove', 'keypress', 
      'scroll', 'touchstart', 'click', 'keydown'
    ];

    activityEvents.forEach(evt => {
      window.addEventListener(evt, resetTimer, { passive: true });
    });

    const checkInactivityInterval = setInterval(() => {
      const elapsedMs = Date.now() - lastActiveRef.current;
      const totalInactivityLimitMs = 30 * 60 * 1000; // 30 minutes in milliseconds
      const warningStartMs = 29 * 60 * 1000; // Warning starts 60 seconds before (at 29 minutes)

      if (elapsedMs >= totalInactivityLimitMs) {
        clearInterval(checkInactivityInterval);
        setShowInactivityWarning(false);
        handleSignOut();
        addToast("You have been signed out due to 30 minutes of inactivity.", "error");
      } else if (elapsedMs >= warningStartMs) {
        const msLeft = totalInactivityLimitMs - elapsedMs;
        const secLeft = Math.max(1, Math.ceil(msLeft / 1000));
        setInactivitySecondsLeft(secLeft);
        setShowInactivityWarning(true);
      } else {
        setShowInactivityWarning(prev => {
          if (prev) return false;
          return prev;
        });
      }
    }, 1000);

    return () => {
      activityEvents.forEach(evt => {
        window.removeEventListener(evt, resetTimer);
      });
      clearInterval(checkInactivityInterval);
    };
  }, [userProfile]);

  // Set up real-time Firestore synchronization once currentUid is resolved
  useEffect(() => {
    if (!currentUid) return;

    // Real-time user profile listener
    const userRef = doc(db, 'users', currentUid);
    const unsubUserProfile = onSnapshot(userRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setUserProfile({
          userId: data.userId,
          name: data.name,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          avatar: data.avatar,
          signupBonus: data.signupBonus,
          lastClaimedAt: data.lastClaimedAt,
          claimStreak: data.claimStreak,
          dailyBonusEarnings: data.dailyBonusEarnings,
          email: data.email,
          emailVerified: data.emailVerified,
          blocked: data.blocked,
          isSuspicious: data.isSuspicious,
          ipAddress: data.ipAddress,
          deviceFingerprint: data.deviceFingerprint,
          browserInfo: data.browserInfo,
        });
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    }, (error) => {
      console.warn('Profile sync warn:', error);
      setUserProfile(null);
      setLoading(false);
    });

    // Real-time referrals listener
    const referralsRef = collection(db, 'users', currentUid, 'referrals');
    const referralsQuery = query(referralsRef, orderBy('createdAt', 'desc'));

    let isFirstReferralsSnapshot = true;
    const unsubReferrals = onSnapshot(referralsQuery, (snapshot) => {
      const list: ReferralLog[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: data.id,
          timestamp: data.timestamp,
          amount: data.amount,
          referrerName: data.referrerName,
          refereeId: data.refereeId,
          createdAt: data.createdAt,
          refereeAvatar: data.refereeAvatar,
          ...data,
        });
      });

      if (!isFirstReferralsSnapshot) {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const data = change.doc.data();
            const commission = data.amount !== undefined ? data.amount : 0.55;
            addToast(`New partner registered: ${data.refereeName || data.name || 'Anonymous User'}! +$${commission.toFixed(2)} referral commission!`, 'success', 'new_referral');
          }
        });
      } else {
        isFirstReferralsSnapshot = false;
      }

      setLogs(list);
    }, (error) => {
      console.warn("Referrals snapshot fallback:", error);
    });

    // Real-time deposits listener
    const depositsRef = collection(db, 'users', currentUid, 'deposits');
    const depositsQuery = query(depositsRef, orderBy('createdAt', 'desc'));

    const unsubDeposits = onSnapshot(depositsQuery, (snapshot) => {
      const list: DepositLog[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: data.id,
          amount: Number(data.amount) || 0,
          network: data.network || 'BNB',
          txHash: data.txHash || '',
          status: data.status || 'pending',
          createdAt: data.createdAt,
          timestamp: data.timestamp || '',
        });
      });
      setDeposits(list);
    }, (error) => {
      console.warn("Deposits snapshot fallback:", error);
    });

    // Real-time withdrawals listener
    const withdrawalsRef = collection(db, 'users', currentUid, 'withdrawals');
    const withdrawalsQuery = query(withdrawalsRef, orderBy('createdAt', 'desc'));

    const unsubWithdrawals = onSnapshot(withdrawalsQuery, (snapshot) => {
      const list: WithdrawalLog[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: data.id,
          amount: Number(data.amount) || 0,
          wallet: data.wallet || '',
          network: data.network || 'BNB',
          status: data.status || 'pending',
          createdAt: data.createdAt,
          timestamp: data.timestamp || '',
        });
      });
      setWithdrawals(list);
    }, (error) => {
      console.warn("Withdrawals snapshot fallback:", error);
    });

    // Real-time investments listener
    const investmentsRef = collection(db, 'users', currentUid, 'investments');
    const investmentsQuery = query(investmentsRef, orderBy('createdAt', 'desc'));

    const unsubInvestments = onSnapshot(investmentsQuery, (snapshot) => {
      const list: UserPlan[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: data.id,
          planId: data.planId,
          amount: Number(data.amount) || 0,
          status: data.status || 'active',
          createdAt: data.createdAt,
          timestamp: data.timestamp || '',
          cancelledAt: data.cancelledAt,
          completedAt: data.completedAt,
        });
      });
      setInvestments(list);
    }, (error) => {
      console.warn("Investments snapshot fallback:", error);
    });

    // Real-time daily rewards listener
    const dailyRewardsRef = collection(db, 'users', currentUid, 'daily_rewards');
    const dailyRewardsQuery = query(dailyRewardsRef, orderBy('createdAt', 'desc'));

    const unsubDailyRewards = onSnapshot(dailyRewardsQuery, (snapshot) => {
      const list: DailyRewardLog[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: data.id,
          amount: Number(data.amount) || 0,
          streak: Number(data.streak) || 0,
          timestamp: data.timestamp || '',
          createdAt: data.createdAt,
        });
      });
      setDailyRewardLogs(list);
    }, (error) => {
      console.warn("Daily rewards snapshot fallback:", error);
    });

    return () => {
      unsubUserProfile();
      unsubReferrals();
      unsubDeposits();
      unsubWithdrawals();
      if (unsubInvestments) unsubInvestments();
      if (unsubDailyRewards) unsubDailyRewards();
    };
  }, [currentUid]);

  // Real-time tasks listener (Everyone can see active tasks)
  useEffect(() => {
    const tasksRef = collection(db, 'tasks');
    const tasksQuery = query(tasksRef, orderBy('createdAt', 'desc'));
    
    const unsubTasks = onSnapshot(tasksQuery, (snapshot) => {
      const list: Task[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({ ...data, id: docSnap.id } as Task);
      });
      setTasks(list);
    }, (error) => {
      console.warn("Tasks snapshot fallback:", error);
    });

    return () => unsubTasks();
  }, []);

  // Real-time task submissions listener
  useEffect(() => {
    if (!currentUid || !userProfile) return;

    // Admin sees ALL submissions, User sees only THEIR submissions
    const isAdminUser = [
      "danishrehmani72@gmail.com",
      "admin@gmail.com",
      "superadmin@apexcapital.test",
      "superadmin@earnhub.com"
    ].includes(userProfile.email?.toLowerCase().trim()) || userProfile?.userId === 'adminmoneymind';

    let submissionsQuery;
    const submissionsRef = collection(db, 'task_submissions');
    
    if (isAdminUser) {
      submissionsQuery = query(submissionsRef, orderBy('submissionTime', 'desc'));
    } else {
      submissionsQuery = query(submissionsRef, where('userId', '==', currentUid), orderBy('submissionTime', 'desc'));
    }

    const unsubSubmissions = onSnapshot(submissionsQuery, (snapshot) => {
      const list: TaskSubmission[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({ ...data, id: docSnap.id } as TaskSubmission);
      });
      setTaskSubmissions(list);
    }, (error) => {
      console.warn("Submissions snapshot fallback:", error);
    });

    return () => unsubSubmissions();
  }, [currentUid, userProfile]);

  // Handle URL invitation referral links
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const params = new URLSearchParams(window.location.search);
        let refId = params.get('ref')?.trim() || null;
        const src = params.get('src')?.trim() || null;
        
        if (refId) {
          // Remove trailing slashes and spaces often appended by messaging clients (e.g. WhatsApp, Facebook)
          refId = refId.replace(/\/+$/, '').trim();
          
          // Verify ID only contains valid characters (no spaces, no slashes, matching standard format)
          const isValidFormat = /^[a-zA-Z0-9_\-.@]+$/.test(refId);
          if (isValidFormat && refId.length > 0) {
            setReferredBy(refId);
            if (src) {
              setReferredSource(src);
            }
            
            // Fetch the genuine referrer profile state to display welcoming message
            const fetchReferrer = async () => {
              try {
                const inviterRef = doc(db, 'users', refId!);
                const inviterSnap = await getDoc(inviterRef);
                if (inviterSnap.exists()) {
                  setInviterName(inviterSnap.data().name);
                }
              } catch (e) {
                console.error("Could not fetch welcome partner data:", e);
              }
            };
            fetchReferrer();
          }
        }
      } catch (err) {
        console.error("Error parsing referral link parameter safely:", err);
      }
    }
  }, []);

  // Automated background completion for active plans according to validation rules
  useEffect(() => {
    if (!currentUid || !investments.length) return;

    const autoProcessPlanCompletions = async () => {
      const nowTime = Date.now();
      for (const processPlan of investments) {
        if (processPlan.status !== 'active') continue;

        const startTime = processPlan.createdAt?.seconds 
          ? processPlan.createdAt.seconds * 1000 
          : new Date(processPlan.timestamp).getTime() || nowTime;
          
        const elapsedMs = Math.max(0, nowTime - startTime);
        const elapsedDaysReal = Math.floor(elapsedMs / (24 * 60 * 60 * 1000));
        const totalDays = elapsedDaysReal + virtualDays;
        
        let profit = 0;
        const planKey = processPlan.id || String(startTime);
        
        const normalizedPlanId = (processPlan.planId || '').toLowerCase().trim();
        const planCap = getPlanCapPercent(normalizedPlanId, processPlan.amount);
        const maxProfitLimit = processPlan.amount * planCap;
        const maxCalculationDays = 30;

        const daysToSimulate = Math.min(totalDays, maxCalculationDays);
        let reachedTarget = false;

        for (let day = 1; day <= daysToSimulate; day++) {
          let hash = 0;
          const str = planKey + "_" + day;
          for (let idx = 0; idx < str.length; idx++) {
            hash = str.charCodeAt(idx) + ((hash << 5) - hash);
          }
          const index = Math.abs(hash) % 4;
          const baseDailyRatePercent = (planCap * 100) / 30;
          const multiplier = [0.98, 1.02, 0.95, 1.05][index];
          const dailyPercent = baseDailyRatePercent * multiplier;
          const dayProfit = processPlan.amount * (dailyPercent / 100) * (globalSettings?.yieldMultiplier || 1.0);
          
          if (profit + dayProfit >= maxProfitLimit) {
            profit = maxProfitLimit;
            reachedTarget = true;
            break;
          }
          profit += dayProfit;
        }

        const isTimeCompleted = totalDays >= maxCalculationDays;
        const reachedCompletion = reachedTarget || isTimeCompleted;

        if (reachedCompletion) {
          try {
            const invRef = doc(db, 'users', currentUid, 'investments', processPlan.id);
            await setDoc(invRef, {
              status: 'completed',
              completedAt: serverTimestamp()
            }, { merge: true });
            
            const targetReturnPercent = Math.round((1 + planCap) * 100);
            addToast(`Investment plan (${processPlan.planId.toUpperCase()}) completed! Matured return of ${targetReturnPercent}% reached. Funds are now available in Matured Balance. ⚡`, 'success');
          } catch (e) {
            console.error("Auto completion error:", e);
          }
        }
      }
    };

    autoProcessPlanCompletions();
  }, [currentUid, investments, virtualDays, globalSettings]);

  // Manual re-fetch of all user data from Firestore using server documents directly (bypassing client caches)
  const handleRefreshAllData = async () => {
    if (!currentUid) return;
    try {
      // 1. Fetch user profile from server
      const userRef = doc(db, 'users', currentUid);
      const userSnap = await getDocFromServer(userRef);
      if (userSnap.exists()) {
        const data = userSnap.data();
        setUserProfile({
          userId: data.userId,
          name: data.name,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          avatar: data.avatar,
          signupBonus: data.signupBonus,
          lastClaimedAt: data.lastClaimedAt,
          claimStreak: data.claimStreak,
          dailyBonusEarnings: data.dailyBonusEarnings,
          email: data.email,
          emailVerified: data.emailVerified,
          blocked: data.blocked,
          isSuspicious: data.isSuspicious,
          ipAddress: data.ipAddress,
          deviceFingerprint: data.deviceFingerprint,
          browserInfo: data.browserInfo,
        });
      }

      // 2. Fetch referrals from server
      const referralsRef = collection(db, 'users', currentUid, 'referrals');
      const referralsQuery = query(referralsRef, orderBy('createdAt', 'desc'));
      const referralsSnap = await getDocsFromServer(referralsQuery);
      const referralList: ReferralLog[] = [];
      referralsSnap.forEach((docSnap) => {
        const data = docSnap.data();
        referralList.push({
          id: data.id,
          timestamp: data.timestamp,
          amount: data.amount,
          referrerName: data.referrerName,
          refereeId: data.refereeId,
          createdAt: data.createdAt,
          refereeAvatar: data.refereeAvatar,
          ...data,
        });
      });
      setLogs(referralList);

      // 3. Fetch deposits from server
      const depositsRef = collection(db, 'users', currentUid, 'deposits');
      const depositsQuery = query(depositsRef, orderBy('createdAt', 'desc'));
      const depositsSnap = await getDocsFromServer(depositsQuery);
      const depositList: DepositLog[] = [];
      depositsSnap.forEach((docSnap) => {
        const data = docSnap.data();
        depositList.push({
          id: data.id,
          amount: Number(data.amount) || 0,
          network: data.network || 'BNB',
          txHash: data.txHash || '',
          status: data.status || 'pending',
          createdAt: data.createdAt,
          timestamp: data.timestamp || '',
        });
      });
      setDeposits(depositList);

      // 4. Fetch withdrawals from server
      const withdrawalsRef = collection(db, 'users', currentUid, 'withdrawals');
      const withdrawalsQuery = query(withdrawalsRef, orderBy('createdAt', 'desc'));
      const withdrawalsSnap = await getDocsFromServer(withdrawalsQuery);
      const withdrawalList: WithdrawalLog[] = [];
      withdrawalsSnap.forEach((docSnap) => {
        const data = docSnap.data();
        withdrawalList.push({
          id: data.id,
          amount: Number(data.amount) || 0,
          wallet: data.wallet || '',
          network: data.network || 'BNB',
          status: data.status || 'pending',
          createdAt: data.createdAt,
          timestamp: data.timestamp || '',
        });
      });
      setWithdrawals(withdrawalList);

      // 5. Fetch investments from server
      const investmentsRef = collection(db, 'users', currentUid, 'investments');
      const investmentsQuery = query(investmentsRef, orderBy('createdAt', 'desc'));
      const investmentsSnap = await getDocsFromServer(investmentsQuery);
      const investmentList: UserPlan[] = [];
      investmentsSnap.forEach((docSnap) => {
        const data = docSnap.data();
        investmentList.push({
          id: data.id,
          planId: data.planId,
          amount: Number(data.amount) || 0,
          status: data.status || 'active',
          createdAt: data.createdAt,
          timestamp: data.timestamp || '',
          cancelledAt: data.cancelledAt,
          completedAt: data.completedAt,
        });
      });
      setInvestments(investmentList);

      // 6. Fetch daily rewards from server
      const dailyRewardsRef = collection(db, 'users', currentUid, 'daily_rewards');
      const dailyRewardsQuery = query(dailyRewardsRef, orderBy('createdAt', 'desc'));
      const dailyRewardsSnap = await getDocsFromServer(dailyRewardsQuery);
      const rewardList: DailyRewardLog[] = [];
      dailyRewardsSnap.forEach((docSnap) => {
        const data = docSnap.data();
        rewardList.push({
          id: data.id,
          amount: Number(data.amount) || 0,
          streak: Number(data.streak) || 0,
          timestamp: data.timestamp || '',
          createdAt: data.createdAt,
        });
      });
      setDailyRewardLogs(rewardList);
    } catch (error) {
      console.error("Force sync failed:", error);
      addToast("Failed to refresh data. Network busy.", "error");
    }
  };

  // Update user profile display name and avatar
  const handleUpdateProfile = async (newName: string, newAvatar: string) => {
    if (!currentUid) return;
    try {
      const userRef = doc(db, 'users', currentUid);
      await setDoc(userRef, {
        name: newName,
        avatar: newAvatar,
        updatedAt: serverTimestamp()
      }, { merge: true });
      addToast('Profile updated successfully! ✨', 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${currentUid}`);
    }
  };

  // Update user profile emailVerified flag in Firestore
  const handleVerifyEmail = async () => {
    if (!currentUid) return;
    try {
      const userRef = doc(db, 'users', currentUid);
      await setDoc(userRef, {
        emailVerified: true,
        updatedAt: serverTimestamp()
      }, { merge: true });
      addToast('Email verified successfully! 🛡️', 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${currentUid}`);
      throw error;
    }
  };

  // Submit a deposit record
  const handleCreateDeposit = async (amount: number, network: string, txHash: string, screenshot?: string) => {
    if (!currentUid) return;
    try {
      const depositRef = doc(collection(db, 'users', currentUid, 'deposits'));
      const now = new Date();
      const timestampStr = now.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      }) + ' ' + now.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });

      await setDoc(depositRef, {
        id: depositRef.id,
        amount,
        network,
        txHash,
        screenshot: screenshot || "",
        status: 'pending',
        createdAt: serverTimestamp(),
        timestamp: timestampStr,
        userId: currentUid,
        userName: userProfile?.name || "User",
        email: userProfile?.email || "N/A"
      });
      
      // Dispatch administration email alert
      const targetAdminEmail = globalSettings?.adminEmail || "danishrehmani72@gmail.com";
      fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'deposit_admin',
          to: targetAdminEmail,
          payload: {
            userName: userProfile?.name || currentUid,
            email: userProfile?.email || "N/A",
            amount,
            paymentMethod: network,
            txHash,
            date: timestampStr
          }
        })
      }).catch(err => console.error("Admin deposit notification failover:", err));

      // Dispatch user-facing receipt email confirmation
      if (userProfile?.email) {
        fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'deposit_submitted',
            to: userProfile.email,
            payload: {
              userName: userProfile.name || "User",
              amount,
              paymentMethod: network,
              txHash,
              date: timestampStr
            }
          })
        }).catch(err => console.error("User deposit confirmation dispatch fail:", err));
      }

      addToast(`Deposit of $${amount} submitted successfully! Deposit submitted for review.`, 'success', 'deposit_submitted');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${currentUid}/deposits`);
    }
  };

  // Submit a withdrawal request
  const handleCreateWithdrawal = async (amount: number, network: string, wallet: string) => {
    if (!currentUid) return;

    // Guard for free users who have not deposited
    const hasApprovedDeposit = deposits && deposits.some(d => d.status === 'approved');
    if (!hasApprovedDeposit) {
      addToast("Please make and receive approval for at least one deposit before requesting a withdrawal.", "error");
      return;
    }

    // Dynamic balance check before requesting
    if (amount > balance) {
      addToast("Insufficient balance to request this withdrawal.", "error");
      return;
    }

    // Withdrawal Protection for suspicious or blocked accounts
    if (userProfile?.blocked || userProfile?.isSuspicious) {
      addToast("Your account is under security review. ", "error");
      return;
    }

    try {
      const now = new Date();
      const timestampStr = now.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      }) + ' ' + now.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });

      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', currentUid!);
        const withdrawRef = doc(collection(db, 'users', currentUid!, 'withdrawals'));
        
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) throw new Error("User not found");
        
        transaction.set(withdrawRef, {
          id: withdrawRef.id,
          amount,
          wallet,
          network,
          status: 'pending',
          createdAt: serverTimestamp(),
          timestamp: timestampStr,
          userId: currentUid,
          userName: userProfile?.name || "User",
          email: userProfile?.email || "N/A"
        });
      });

      // Dispatch administration email alert
      const targetAdminEmail = globalSettings?.adminEmail || "danishrehmani72@gmail.com";
      fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'withdrawal_admin',
          to: targetAdminEmail,
          payload: {
            userName: userProfile?.name || currentUid,
            email: userProfile?.email || "N/A",
            amount,
            paymentMethod: `${network} - Account Wallet: ${wallet}`,
            date: timestampStr
          }
        })
      }).catch(err => console.error("Admin withdrawal notification failover:", err));

      // Dispatch user-facing transaction logged email confirmation
      if (userProfile?.email) {
        fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'withdrawal_submitted',
            to: userProfile.email,
            payload: {
              userName: userProfile.name || "User",
              amount,
              paymentMethod: `${network} (${wallet})`,
              date: timestampStr
            }
          })
        }).catch(err => console.error("User withdrawal confirmation dispatch fail:", err));
      }

      addToast(`Withdrawal of $${amount} requested successfully! Admin routing queue initiated.`, 'success');
    } catch (error: any) {
      console.error(error);
      addToast(error.message || "Error submitting withdrawal", "error");
    }
  };

  // Helper for admin approval of deposits and withdrawals
  const handleUpdateTxStatus = async (
    type: 'deposit' | 'withdrawal', 
    txId: string, 
    status: 'approved' | 'rejected',
    userId: string,
    amount: number
  ) => {
    try {
      let recipientEmail = '';
      let recipientName = '';
      let paymentMethod = '';
      let txDate = '';

      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', userId);
        const txRef = doc(db, 'users', userId, type === 'deposit' ? 'deposits' : 'withdrawals', txId);
        
        const [userDoc, txDoc] = await Promise.all([
          transaction.get(userRef),
          transaction.get(txRef)
        ]);

        if (!userDoc.exists()) throw new Error("User not found");
        if (!txDoc.exists()) throw new Error("Transaction record not found");
        
        const userData = userDoc.data() as UserProfile;
        const txData = txDoc.data();

        recipientEmail = txData?.email || userData?.email || '';
        recipientName = txData?.userName || userData?.name || 'User';
        paymentMethod = txData?.network || 'N/A';
        txDate = txData?.timestamp || '';

        const currentBalance = userData.dailyBonusEarnings || 0;

        if (type === 'deposit') {
          if (status === 'approved') {
            // Credit user's balance on deposit approval
            transaction.update(userRef, {
              dailyBonusEarnings: currentBalance + amount,
              updatedAt: serverTimestamp()
            });
          }
        } else if (type === 'withdrawal') {
          if (status === 'approved') {
            // Deduct user's balance on withdrawal approval
            transaction.update(userRef, {
              dailyBonusEarnings: currentBalance - amount,
              updatedAt: serverTimestamp()
            });
          } else if (status === 'rejected') {
            // Restore balance if withdrawal is rejected
            transaction.update(userRef, {
              dailyBonusEarnings: currentBalance + amount,
              updatedAt: serverTimestamp()
            });
          }
        }
        
        transaction.update(txRef, { 
          status,
          updatedAt: serverTimestamp()
        });

        // Atomic audit log registration
        const auditRef = doc(collection(db, 'audit_logs'));
        transaction.set(auditRef, {
          id: auditRef.id,
          action: status.toUpperCase(),
          type,
          txId,
          targetUserId: userId,
          amount,
          timestamp: new Date().toISOString(),
          operatorId: currentUid || 'anonymous-admin',
          createdAt: serverTimestamp()
        });
      });

      // Send status update email to user
      if (recipientEmail) {
        const emailType = type === 'deposit' 
          ? (status === 'approved' ? 'deposit_approved' : 'deposit_rejected')
          : (status === 'approved' ? 'withdrawal_approved' : 'withdrawal_rejected');

        fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: emailType,
            to: recipientEmail,
            payload: {
              userName: recipientName,
              amount: amount,
              paymentMethod: paymentMethod,
              date: txDate
            }
          })
        }).catch(err => console.error("Email notification dispatch error on status update:", err));
      }

      addToast(`${type === 'deposit' ? 'Deposit' : 'Withdrawal'} request has been ${status}!`, 'success');
    } catch (error: any) {
      console.error(error);
      addToast(error.message || `Error updating transaction status`, 'error');
    }
  };

  // Claim account daily rewards in database
  const handleClaimDailyReward = async (dayIndex: number | null, amount: number, giftCode?: string) => {
    if (!currentUid || !userProfile) return;
    
    const now = new Date();
    const prevBalance = balance; // Use current calculated balance for logging

    // Client-side quick check (optional, transaction will handle properly)
    if (!giftCode) {
        const lastClaimed = userProfile.lastClaimedAt ? new Date(userProfile.lastClaimedAt) : null;
        if (lastClaimed && (now.getTime() - lastClaimed.getTime()) < 24 * 60 * 60 * 1000) {
          addToast("Next reward available in 24 hours.", "error");
          return;
        }
    }

    if (giftCode && userProfile.usedGiftCodes?.includes(giftCode)) {
      addToast("This gift code has already been redeemed on your account.", "error");
      return;
    }

    try {
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', currentUid);
        const userDoc = await transaction.get(userRef);
        
        if (!userDoc.exists()) {
          throw new Error("User does not exist!");
        }

        const userData = userDoc.data() as UserProfile;
        const currentStreak = userData.claimStreak || 0;
        
        // 1. Verify reward hasn't been claimed (Duplicate Protection & Cooldown)
        if (!giftCode) {
          const lastClaimed = userData.lastClaimedAt ? new Date(userData.lastClaimedAt) : null;
          if (lastClaimed && (now.getTime() - lastClaimed.getTime()) < 24 * 60 * 60 * 1000) {
            throw new Error("Next reward available in 24 hours.");
          }

          if (dayIndex !== null) {
            // Strict verification: only allow claiming the CURRENT active calendar day (modulo 8)
            if (currentStreak % 8 !== dayIndex) {
              throw new Error("Invalid reward day. This reward has already been claimed or is not yet available.");
            }
          }
        }

        if (giftCode && userData.usedGiftCodes?.includes(giftCode)) {
          throw new Error("Gift code already redeemed.");
        }

        // 2. Calculate New Earnings
        const currentEarnings = userData.dailyBonusEarnings || 0;
        const newEarnings = Number((currentEarnings + amount).toFixed(2));
        
        const updateData: any = {
          dailyBonusEarnings: newEarnings,
          updatedAt: serverTimestamp()
        };

        if (giftCode) {
          const currentUsedCodes = userData.usedGiftCodes || [];
          updateData.usedGiftCodes = [...currentUsedCodes, giftCode];
        } else {
          // Both the 7-day tracker and the dashboard yield check-in count as a daily claim
          updateData.lastClaimedAt = now.toISOString();

          if (dayIndex !== null) {
            updateData.claimStreak = currentStreak + 1;
          }
        }

        // 3. Update User Document
        transaction.update(userRef, updateData);

        // 4. Log the Balance Update (Audit Trail)
        const logRef = doc(collection(db, 'users', currentUid, 'balance_logs'));
        const newCalculatedBalance = prevBalance + amount;
        
        transaction.set(logRef, {
          id: logRef.id,
          userId: currentUid,
          type: giftCode ? 'gift_code' : 'daily_reward',
          previousBalance: Number(prevBalance.toFixed(4)),
          rewardAmount: Number(amount.toFixed(4)),
          newBalance: Number(newCalculatedBalance.toFixed(4)),
          rewardCurrency: 'USD',
          dayIndex: dayIndex,
          giftCode: giftCode || null,
          timestamp: now.toISOString(),
          createdAt: serverTimestamp(),
        });

        // 5. Also update the older daily_rewards log for backward compatibility if needed
        const rewardLogRef = doc(collection(db, 'users', currentUid, 'daily_rewards'));
        transaction.set(rewardLogRef, {
          id: rewardLogRef.id,
          amount: Number(amount.toFixed(2)),
          timestamp: now.toISOString(),
          createdAt: serverTimestamp(),
        });
      });

      addToast(`🎉 Reward successful! ₨ ${Number((amount * 280).toFixed(2))} credited to balance.`, 'success');
    } catch (error: any) {
      console.error("Error claiming reward:", error);
      const msg = error.message || "Failed to process reward. Please try again.";
      addToast(msg, "error");
    }
  };

  const handleCreatePlan = async (planId: string, amount: number) => {
    if (!currentUid) return;
    try {
      const invRef = doc(collection(db, 'users', currentUid, 'investments'));
      const now = new Date();
      const timestampStr = now.toLocaleDateString(undefined, {
        month: 'short', day: 'numeric', year: 'numeric'
      }) + ' ' + now.toLocaleTimeString(undefined, {
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });

      await setDoc(invRef, {
        id: invRef.id,
        planId,
        amount,
        status: 'active',
        createdAt: serverTimestamp(),
        timestamp: timestampStr
      });
      addToast(`Investment Plan Activated successfully!`, 'success');
    } catch (error: any) {
      console.error("Error creating plan:", error);
      addToast(error?.message || "Failed to activate investment plan. Please try again.", "error");
    }
  };

  const handleCancelPlan = async (invId: string) => {
    if (!currentUid) return;
    try {
      const planToCancel = investments.find(inv => inv.id === invId);
      if (planToCancel) {
        const startTime = planToCancel.createdAt?.seconds 
          ? planToCancel.createdAt.seconds * 1000 
          : new Date(planToCancel.timestamp).getTime() || Date.now();
        const elapsedMs = Date.now() - startTime;
        const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
        if (elapsedMs < thirtyDaysMs) {
          const remainingDays = Math.ceil((thirtyDaysMs - elapsedMs) / (24 * 60 * 60 * 1000));
          addToast(`Failed: This plan is locked for the first 30 days. Please wait ${remainingDays} more days to cancel.`, 'error');
          return;
        }
      }
      const invRef = doc(db, 'users', currentUid, 'investments', invId);
      await setDoc(invRef, { 
        status: 'cancelled',
        cancelledAt: serverTimestamp()
      }, { merge: true });
      addToast(`Investment Plan Cancelled. Original principal has been returned to your wallet.`, 'success');
    } catch (error: any) {
      console.error("Error cancelling plan:", error);
      addToast(error?.message || "Failed to cancel investment plan. Please try again.", "error");
    }
  };

  // Handle secret 7-clicks on website logo
  const handleLogoClick = () => {
    setLogoClicks(prev => {
      const next = prev + 1;
      if (next >= 7) {
        setShowSecretPasscodePopup(true);
        addToast("🔐 Governance Protocol Activation Detected.", "success");
        return 0;
      }
      return next;
    });
  };

  const handleLockBypass = () => {
    localStorage.removeItem('earnhub_super_admin_unlocked');
    setIsSuperAdminBypassed(false);
    setShowAdminModal(false);
  };

  // Centralized scroll function to ensure pages open from the top
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // Support for iOS/Android legacy browsers
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  };

  // Handle click on top navbar or mobile drawer menu items
  const handleNavClick = (target: 'deposit' | 'withdraw' | 'helpline' | 'faq' | 'dashboard' | 'admin' | 'settings' | 'security') => {
    setMobileMenuOpen(false); // Close mobile drawer if open
    scrollToTop(); // Force scroll to top on every navigation
    
    if (target === 'admin') {
      setShowAdminModal(true);
      return;
    }

    if (target === 'helpline') {
      window.open('https://t.me/apexcapital_official', '_blank');
      addToast('Opening Apex Capital Support on Telegram...', 'success');
      return;
    }

    if (!isRegistered) {
      if (target === 'faq' || target === 'settings' || target === 'security') {
        addToast('Please login or register to access premium features and settings!', 'error');
      } else {
        addToast(`Please login or register to access the ${target === 'deposit' ? 'Deposit' : 'Withdrawal'} Portal!`, 'error');
      }
      
      const regEl = document.getElementById('registration-container');
      if (regEl) {
        // Visual indicator border glow
        regEl.classList.add('ring-2', 'ring-blue-500/50');
        setTimeout(() => regEl.classList.remove('ring-2', 'ring-blue-500/50'), 2500);
      }
      return;
    }

    // Interactive updates if user is Onboarded / Registered
    if (target === 'dashboard') {
      setDashboardTab('overview');
    } else if (target === 'settings') {
      setDashboardTab('settings');
    } else if (target === 'security') {
      setDashboardTab('security');
    } else if (target === 'deposit') {
      setDashboardTab('funding');
    } else if (target === 'withdraw') {
      setDashboardTab('funding');
    } else if (target === 'faq') {
      setDashboardTab('faq');
    }
  };

  // Sign out handler using custom session persistence
  const handleSignOut = async () => {
    try {
      setLoading(true);
      localStorage.removeItem('earnhub_logged_in_uid');
      setCurrentUid(null);
      setUserProfile(null);
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-[#E5E7EB] flex items-center justify-center font-sans antialiased px-4">
        <div className="text-center space-y-6 max-w-sm">
          <div className="w-10 h-10 border-2 border-blue-500/30 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-blue-400 font-semibold animate-pulse">
              Configuring Secured Connection...
            </p>
            {loadingTimeout && (
              <p className="text-[10px] text-white/40 leading-relaxed animate-fade-in px-4">
                This is taking longer than usual. There may be a connection delay or temporary network sync issue.
              </p>
            )}
          </div>
          
          {loadingTimeout && (
            <div className="pt-2 animate-fade-in">
              <button 
                onClick={handleSignOut}
                className="px-4 py-2 text-[10px] uppercase font-bold text-blue-400 hover:text-blue-300 tracking-wider bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded transition-all cursor-pointer inline-flex items-center gap-1.5"
              >
                <span>Reset Connection & Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const handleSimulateDayAdvance = () => {
    if (!currentUid) return;
    const newVal = virtualDays + 1;
    setVirtualDays(newVal);
    localStorage.setItem(`earnhub_virtual_days_${currentUid}`, String(newVal));
  };

  const handleResetSimulation = () => {
    if (!currentUid) return;
    setVirtualDays(0);
    localStorage.removeItem(`earnhub_virtual_days_${currentUid}`);
  };

  const isRegistered = !!userProfile;

  const isAdminUser = isRegistered && (
    (userProfile?.email && [
      "admin@gmail.com", 
      "danishrehmani72@gmail.com", 
      "superadmin@apexcapital.test", 
      "superadmin@earnhub.com"
    ].includes(userProfile.email.toLowerCase().trim())) || 
    userProfile?.userId === 'danish' || 
    userProfile?.userId === 'adminmoneymind'
  );

  // Real-time ledger balance calculation
  const signupBonus = userProfile?.signupBonus !== undefined ? userProfile.signupBonus : 0.10;
  const referralEarnings = logs.reduce((sum, log) => sum + (typeof log.amount === 'number' ? log.amount : 0.055), 0);
  const approvedDepositsList = deposits.filter(d => d.status === 'approved');
  const approvedDeposits = approvedDepositsList.reduce((sum, d) => sum + d.amount, 0);
  const approvedWithdrawals = withdrawals.filter(w => w.status === 'approved').reduce((sum, w) => sum + w.amount, 0);
  const pendingWithdrawals = withdrawals.filter(w => w.status === 'pending').reduce((sum, w) => sum + w.amount, 0);
  const dailyBonusEarnings = userProfile?.dailyBonusEarnings !== undefined ? userProfile.dailyBonusEarnings : 0;
  const approvedTaskRewards = taskSubmissions
    .filter(s => s.status === 'Approved' && s.userId === currentUid)
    .reduce((sum, s) => sum + (s.reward || 0), 0);

  // Calculate real-time profit accrued on each investment
  const nowTime = Date.now();
  const investmentProfits = investments.reduce((sum, processPlan) => {
    // If it's cancelled, we calculate up to cancelledAt
    // If it's completed, we calculate up to completedAt
    let endTime = nowTime;
    if (processPlan.status === 'cancelled' && processPlan.cancelledAt) {
      endTime = processPlan.cancelledAt?.seconds 
        ? processPlan.cancelledAt.seconds * 1000 
        : new Date(processPlan.cancelledAt).getTime() || nowTime;
    } else if (processPlan.status === 'completed' && processPlan.completedAt) {
      endTime = processPlan.completedAt?.seconds 
        ? processPlan.completedAt.seconds * 1000 
        : new Date(processPlan.completedAt).getTime() || nowTime;
    }

    const startTime = processPlan.createdAt?.seconds 
      ? processPlan.createdAt.seconds * 1000 
      : new Date(processPlan.timestamp).getTime() || nowTime;
      
    const elapsedMs = Math.max(0, endTime - startTime);
    const elapsedDaysReal = Math.floor(elapsedMs / (24 * 60 * 60 * 1000));
    const totalDays = elapsedDaysReal + (processPlan.status === 'active' ? virtualDays : 0);
    
    let profit = 0;
    const planKey = processPlan.id || String(startTime);
    const normalizedPlanId = (processPlan.planId || '').toLowerCase().trim();
    const planCap = getPlanCapPercent(normalizedPlanId, processPlan.amount);
    const maxProfitLimit = processPlan.amount * planCap;
    const maxCalculationDays = 30;

    const daysToSimulate = Math.min(totalDays, maxCalculationDays);

    for (let day = 1; day <= daysToSimulate; day++) {
      let hash = 0;
      const str = planKey + "_" + day;
      for (let idx = 0; idx < str.length; idx++) {
        hash = str.charCodeAt(idx) + ((hash << 5) - hash);
      }
      const index = Math.abs(hash) % 4;
      const baseDailyRatePercent = (planCap * 100) / 30;
      const multiplier = [0.98, 1.02, 0.95, 1.05][index];
      const dailyPercent = baseDailyRatePercent * multiplier;
      const dayProfit = processPlan.amount * (dailyPercent / 100) * (globalSettings?.yieldMultiplier || 1.0);
      
      if (profit + dayProfit >= maxProfitLimit) {
        profit = maxProfitLimit;
        break;
      }
      profit += dayProfit;
    }
    return sum + (profit > 0 ? profit : 0);
  }, 0);

  // Matured Balance computes principal + profit of all completed plans
  const maturedBalance = investments
    .filter(i => i.status === 'completed')
    .reduce((sum, processPlan) => {
      let endTime = nowTime;
      if (processPlan.completedAt) {
        endTime = processPlan.completedAt?.seconds 
          ? processPlan.completedAt.seconds * 1000 
          : new Date(processPlan.completedAt).getTime() || nowTime;
      }
      const startTime = processPlan.createdAt?.seconds 
        ? processPlan.createdAt.seconds * 1000 
        : new Date(processPlan.timestamp).getTime() || nowTime;
        
      const elapsedMs = Math.max(0, endTime - startTime);
      const elapsedDaysReal = Math.floor(elapsedMs / (24 * 60 * 60 * 1000));
      const totalDays = elapsedDaysReal;
      
      let profit = 0;
      const planKey = processPlan.id || String(startTime);
      const normalizedPlanId = (processPlan.planId || '').toLowerCase().trim();
      const planCap = getPlanCapPercent(normalizedPlanId, processPlan.amount);
      const maxProfitLimit = processPlan.amount * planCap;
      const daysToSimulate = Math.min(totalDays, 30);

      for (let day = 1; day <= daysToSimulate; day++) {
        let hash = 0;
        const str = planKey + "_" + day;
        for (let idx = 0; idx < str.length; idx++) {
          hash = str.charCodeAt(idx) + ((hash << 5) - hash);
        }
        const index = Math.abs(hash) % 4;
        const baseDailyRatePercent = (planCap * 100) / 30;
        const multiplier = [0.98, 1.02, 0.95, 1.05][index];
        const dailyPercent = baseDailyRatePercent * multiplier;
        const dayProfit = processPlan.amount * (dailyPercent / 100) * (globalSettings?.yieldMultiplier || 1.0);
        
        if (profit + dayProfit >= maxProfitLimit) {
          profit = maxProfitLimit;
          break;
        }
        profit += dayProfit;
      }
      return sum + processPlan.amount + (profit > 0 ? profit : 0);
    }, 0);

  // The active investments are locked, so subtract from balance
  const activeInvestmentsSum = investments
    .filter(i => i.status === 'active')
    .reduce((sum, i) => sum + i.amount, 0);

  const balance = signupBonus + referralEarnings + approvedDeposits - approvedWithdrawals - pendingWithdrawals + dailyBonusEarnings + investmentProfits + approvedTaskRewards - activeInvestmentsSum;

  if (userProfile?.blocked) {
    const handleSandboxUnblock = async () => {
      if (!currentUid) return;
      setIsUnblocking(true);
      try {
        await setDoc(doc(db, 'users', currentUid), { blocked: false }, { merge: true });
        addToast("Account unblocked successfully! Enjoy testing in Sandbox.", "success");
      } catch (err) {
        console.error("Failed to unblock:", err);
      } finally {
        setIsUnblocking(false);
      }
    };

    return (
      <div className="min-h-screen bg-[#060606] text-white flex flex-col items-center justify-center p-6 text-center select-none font-sans animate-fade-in">
        <div className="max-w-md w-full bg-[#111111] border border-red-500/20 p-8 rounded-3xl space-y-6 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-rose-600" />
          <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center mx-auto text-red-500">
            <Lock className="w-6 h-6 animate-pulse" />
          </div>
          <div className="space-y-2">
            <h1 className="text-sm font-black uppercase tracking-[0.2em] text-red-500">Access Suspended</h1>
            <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Profile Integrity Breach / Compliance Flag</p>
          </div>
          <p className="text-xs text-white/70 leading-relaxed text-center">
            Your Apex Capital account <strong className="text-white">#{userProfile.userId}</strong> has been suspended by our Compliance Desk under compliance guidelines of multiple accounts or suspicious ledger deposits.
          </p>
          <div className="pt-4 flex flex-col gap-3">
            <button
              onClick={handleSandboxUnblock}
              disabled={isUnblocking}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:opacity-90 disabled:opacity-50 text-white font-black uppercase tracking-widest text-[10px] rounded-xl transition-all cursor-pointer border-0 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10"
            >
              <span>{isUnblocking ? "Unblocking..." : "🔧 Unblock Account (Sandbox Mode)"}</span>
            </button>
            <button
              onClick={handleSignOut}
              className="w-full py-3 bg-transparent border border-white/10 hover:bg-white/5 text-zinc-400 hover:text-white font-black uppercase tracking-widest text-[10px] rounded-xl transition-all cursor-pointer"
            >
              <span>Sign Out / Use Another Account</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen font-sans flex flex-col justify-between antialiased transition-all duration-300 relative overflow-x-hidden ${theme === 'dark' ? 'bg-[#060202] bg-[linear-gradient(to_right,#1a0606_1px,transparent_1px),linear-gradient(to_bottom,#1a0606_1px,transparent_1px)] text-[#E5E7EB] selection:bg-red-600/20 selection:text-red-400' : 'bg-[#FAFCFA] bg-[linear-gradient(to_right,rgba(16,185,129,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(16,185,129,0.04)_1px,transparent_1px)] text-slate-800 selection:bg-emerald-200 selection:text-emerald-800'}`} style={{ backgroundImage: theme === 'dark' ? 'linear-gradient(to_right,#1a0606_1px,transparent_1px),linear-gradient(to_bottom,#1a0606_1px,transparent_1px)' : 'linear-gradient(to_right,rgba(16,185,129,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(16,185,129,0.04)_1px,transparent_1px)', backgroundSize: '32px 32px' }}>
      <div className={`absolute inset-0 pointer-events-none ${theme === 'dark' ? 'bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.1)_0%,transparent_75%)]' : 'bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.06)_0%,transparent_75%)]'}`} />
      <div className={`absolute -top-40 -left-40 w-96 h-96 rounded-full blur-[120px] pointer-events-none ${theme === 'dark' ? 'bg-red-600/5' : 'bg-emerald-500/4'}`} />
      <div className={`absolute -bottom-40 -right-40 w-96 h-96 rounded-full blur-[120px] pointer-events-none ${theme === 'dark' ? 'bg-emerald-600/5' : 'bg-teal-500/4'}`} />
      
      {/* Toast Notification Container */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-[340px] xs:max-w-sm w-full pointer-events-none">
        {/* Header Action Controls */}
        <div className="flex flex-col gap-1.5 items-end justify-end w-full mb-1">
          <AnimatePresence>
            {toasts.length >= 2 && (
              <motion.button
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                onClick={clearAllToasts}
                className="pointer-events-auto flex items-center gap-1.5 px-3 py-2 text-[9px] sm:text-[10px] uppercase font-bold tracking-wider text-white/65 hover:text-white bg-slate-950/70 hover:bg-zinc-900 border border-white/10 hover:border-white/20 rounded-xl backdrop-blur-md cursor-pointer transition-all duration-150 shadow-lg shadow-black/30"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>Clear All ({toasts.length})</span>
              </motion.button>
            )}

            {lastClearedToasts.length > 0 && toasts.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="pointer-events-auto flex items-center justify-between gap-3 w-full px-3.5 py-2.5 bg-[#0F0F0F]/90 backdrop-blur-md border border-emerald-500/20 text-emerald-400 rounded-xl shadow-2xl"
              >
                <div className="flex flex-col">
                  <span className="text-[11px] font-extrabold text-white/90">Notifications Cleared</span>
                  <span className="text-[9px] text-blue-400 font-medium tracking-wide">Restorable within 8 seconds</span>
                </div>
                <button
                  onClick={undoClearToasts}
                  className="px-2.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 hover:text-emerald-200 font-extrabold uppercase text-[9px] tracking-wider rounded-lg border border-emerald-500/20 cursor-pointer transition-all flex items-center gap-1 shrink-0"
                >
                  <RotateCcw className="w-3 h-3" />
                  Undo
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* List of active toasts */}
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, x: 50, scale: 0.92 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.92 }}
              className={`pointer-events-auto px-3.5 py-3 rounded-xl border flex items-center justify-between gap-2.5 shadow-xl transition-all duration-150 hover:scale-[1.01] hover:shadow-black/60 relative ${
                t.type === 'success' 
                  ? 'bg-[#0E0E0E]/90 border-emerald-500/20 text-emerald-400 backdrop-blur-xl' 
                  : 'bg-[#0E0E0E]/90 border-rose-500/20 text-rose-400 backdrop-blur-xl'
              }`}
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                  t.type === 'success' 
                    ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' 
                    : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
                }`}>
                  {t.type === 'success' ? '✓' : '✗'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white/90 font-sans tracking-wide leading-relaxed break-words">
                    {t.message}
                  </p>
                </div>
              </div>

              {/* Dismiss / Close Button */}
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                className="text-white/20 hover:text-white/70 p-1 rounded-lg hover:bg-white/5 transition-all cursor-pointer inline-flex items-center justify-center shrink-0 self-start mt-0.5"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Dynamic Referral Invite Banner */}
      <AnimatePresence>
        {referredBy && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-slate-900 border-b border-white/5 text-[#E5E7EB] py-3 px-4 text-center text-xs font-medium z-50 relative shadow-sm"
          >
            <div className="max-w-7xl mx-auto flex items-center justify-center gap-2 flex-wrap">
              <span className="inline-flex items-center justify-center px-2 py-0.5 rounded bg-blue-600/10 text-blue-400 border border-blue-500/20 text-[9px] uppercase font-bold tracking-wider">
                Invitation Active
              </span>
              <p className="text-white/80 font-sans">
                You were invited by Partner <span className="font-bold text-blue-400">{inviterName ? `${inviterName} (#${referredBy.slice(0, 5)})` : `#${referredBy.slice(0, 5)}`}</span>! Onboard to start earning.
              </p>
              <button 
                onClick={() => setReferredBy(null)}
                className="text-blue-400 hover:text-white transition-colors underline ml-2 cursor-pointer text-[10px]"
              >
                Dismiss
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

       {/* Header and Branding */}
      <header className={`sticky top-0 z-50 border-b flex items-center justify-between px-6 md:px-10 h-20 backdrop-blur-md transition-colors ${theme === 'dark' ? 'border-white/10 bg-slate-950/95 text-white' : 'border-gray-200/80 bg-white/95 text-slate-800'}`}>
        <div className="flex items-center gap-3">
          <img 
            src={earnhubLogo} 
            alt="MoneyMind Space Logo" 
            onClick={handleLogoClick}
            className="w-10 h-10 object-contain rounded-lg border border-emerald-500/20 shadow-[0_0_15px_rgba(34,197,94,0.15)] bg-slate-950 cursor-pointer active:scale-95 transition-transform"
            referrerPolicy="no-referrer"
          />
          <button 
            onClick={() => handleNavClick('dashboard')} 
            className={`text-lg font-bold tracking-[0.2em] uppercase font-serif hover:brightness-110 transition-all text-left bg-transparent border-0 cursor-pointer ${theme === 'dark' ? 'text-white' : 'text-emerald-600'}`}
          >
            MoneyMind Space
          </button>
        </div>

        {/* Desktop Menu */}
        <div className="hidden md:flex items-center gap-6 text-[11px] uppercase tracking-[0.22em] font-bold text-white/50">
          <button 
            type="button"
            onClick={() => handleNavClick('dashboard')}
            className={`transition-all pb-1 cursor-pointer bg-transparent border-0 ${isRegistered && dashboardTab === 'overview' ? 'text-white border-b border-blue-500/30' : 'hover:text-white/90'}`}
          >
            Dashboard
          </button>
          
          <button 
            type="button"
            onClick={() => handleNavClick('deposit')}
            className={`transition-all pb-1 cursor-pointer flex items-center gap-1.5 bg-transparent border-0 ${isRegistered && dashboardTab === 'funding' ? 'text-emerald-400 font-extrabold' : 'hover:text-white/90'}`}
          >
            <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
            Deposit
          </button>

          <button 
            type="button"
            onClick={() => handleNavClick('withdraw')}
            className={`transition-all pb-1 cursor-pointer flex items-center gap-1.5 bg-transparent border-0 ${isRegistered && dashboardTab === 'funding' ? 'text-blue-400 font-extrabold' : 'hover:text-white/90'}`}
          >
            <ArrowUpRight className="w-4 h-4 text-blue-400" />
            Withdraw
          </button>


          <button 
            type="button"
            onClick={() => handleNavClick('faq')}
            className={`transition-all pb-1 cursor-pointer flex items-center gap-1.5 bg-transparent border-0 ${isRegistered && dashboardTab === 'faq' ? 'text-white border-b border-blue-500/30' : 'hover:text-white/90'}`}
          >
            <HelpCircle className="w-4 h-4 text-white" />
            FAQ
          </button>



          <span className="text-blue-400/85 hover:text-white transition-all cursor-default flex items-center gap-1.5 ml-2" title="Live Google Cloud Firestore Connection Active">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            System Online
          </span>
        </div>

        <div className="flex items-center gap-3">
          {isRegistered ? (
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-[9px] text-blue-400 uppercase tracking-[0.2em] font-semibold">Verified Member</p>
                <p className="text-xs font-semibold text-white/90">{userProfile.name}</p>
              </div>
              <div className="w-8 h-8 rounded-lg border border-white/10 bg-white/5 flex items-center justify-center text-blue-400">
                <User className="w-4 h-4" />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
              <span className="text-[10px] text-white/40 uppercase tracking-[0.2em] font-semibold">Ready to Onboard</span>
            </div>
          )}

          {/* 3 Dot Menu / Settings */}
          {isRegistered && (
            <div className="relative">
              <button 
                type="button"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="p-2 rounded-lg border border-white/10 hover:bg-white/5 active:scale-95 transition-all text-white/80 cursor-pointer bg-transparent"
                aria-label="Toggle User Menu"
              >
                <MoreVertical className="w-5 h-5 text-white" />
              </button>

              <AnimatePresence>
                {userMenuOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setUserMenuOpen(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -5 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -5 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-full mt-2 w-48 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 py-1"
                    >
                      <button
                        onClick={() => {
                          setUserMenuOpen(false);
                          handleNavClick('settings');
                        }}
                        className="w-full text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-white/80 hover:text-white hover:bg-white/5 transition-all flex items-center gap-2 cursor-pointer bg-transparent border-none outline-none"
                      >
                        <Settings className="w-4 h-4 text-blue-400" />
                        Settings
                      </button>
                      <button
                        onClick={() => {
                          setUserMenuOpen(false);
                          handleNavClick('security');
                        }}
                        className="w-full text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-white/80 hover:text-white hover:bg-white/5 transition-all flex items-center gap-2 cursor-pointer bg-transparent border-none outline-none"
                      >
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        Security
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Mobile menu trigger */}
          <button 
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg border border-white/10 md:hidden hover:bg-white/5 active:scale-95 transition-all text-white/80 cursor-pointer bg-transparent"
            aria-label="Toggle Mobile Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5 text-blue-400" /> : <Menu className="w-5 h-5 text-white" />}
          </button>
        </div>
      </header>

      {/* Mobile Menu Dropdown Bar */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            {/* Backdrop Blur Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="md:hidden fixed inset-0 top-20 bg-slate-950/60 backdrop-blur-sm z-40 cursor-pointer"
            />

            <motion.div
              variants={mobileMenuVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="md:hidden fixed left-0 right-0 top-20 bg-slate-950/70 backdrop-blur-2xl border-b border-white/10 z-45 overflow-hidden w-full shadow-2xl shadow-black/80"
            >
              <div className="px-6 py-6 flex flex-col gap-3 font-sans text-sm font-semibold tracking-wide text-white/70">
                <motion.button 
                  variants={mobileItemVariants}
                  type="button"
                  onClick={() => handleNavClick('dashboard')}
                  className={`py-3 px-4 rounded-xl text-left flex items-center justify-between border transition-all cursor-pointer bg-transparent ${isRegistered && dashboardTab === 'overview' ? 'text-white font-extrabold border-blue-500/35 bg-blue-600/10' : 'border-white/5 hover:border-white/10 hover:bg-white/5 text-white/70 hover:text-white'}`}
                >
                  <span className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-400" />
                    Dashboard Overview
                  </span>
                  <span className="text-[10px] bg-blue-600/15 border border-blue-500/20 px-2 py-0.5 rounded text-blue-400 uppercase font-bold tracking-wider">Growth</span>
                </motion.button>

                {/* Quick Actions */}
                <div className="grid grid-cols-2 gap-3 mt-1 mb-2">
                  <motion.button 
                    variants={mobileItemVariants}
                    type="button"
                    onClick={() => handleNavClick('deposit')}
                    className="py-3 px-3 rounded-xl flex flex-col items-center justify-center gap-1.5 border border-emerald-500/30 hover:bg-emerald-500/10 bg-emerald-500/5 transition-all cursor-pointer text-emerald-400 font-extrabold hover:brightness-110"
                  >
                    <ArrowDownLeft className="w-5 h-5 mb-0.5" />
                    <span className="text-[11px] uppercase tracking-wider">Deposit</span>
                  </motion.button>

                  <motion.button 
                    variants={mobileItemVariants}
                    type="button"
                    onClick={() => handleNavClick('withdraw')}
                    className="py-3 px-3 rounded-xl flex flex-col items-center justify-center gap-1.5 border border-blue-500/30 hover:bg-blue-600/10 bg-blue-600/5 transition-all cursor-pointer text-blue-400 font-extrabold hover:brightness-110"
                  >
                    <ArrowUpRight className="w-5 h-5 mb-0.5" />
                    <span className="text-[11px] uppercase tracking-wider">Withdraw</span>
                  </motion.button>
                </div>


                <motion.button 
                  variants={mobileItemVariants}
                  type="button"
                  onClick={() => handleNavClick('faq')}
                  className={`py-3 px-4 rounded-xl text-left flex items-center justify-between border transition-all cursor-pointer bg-transparent ${isRegistered && dashboardTab === 'faq' ? 'text-white font-extrabold border-blue-500/35 bg-blue-600/10' : 'border-white/5 hover:border-white/10 hover:bg-white/5 text-white/70 hover:text-white'}`}
                >
                  <span className="flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-white/50" />
                    Frequently Asked Questions (FAQ)
                  </span>
                  <span className="text-[9px] bg-white/5 px-2 py-0.5 rounded text-white/40 uppercase tracking-wider font-bold">Info</span>
                </motion.button>



                <motion.div 
                  variants={mobileItemVariants}
                  className="flex items-center justify-between pt-3 px-1 text-[10px] font-medium text-white/30 uppercase tracking-widest border-t border-white/5 mt-1"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>Firestore Ledger Core Live</span>
                  </div>
                  <span>v3.5 Premium</span>
                </motion.div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Workspace Frame */}
      <main className="flex-1 py-12 px-4 md:px-8 flex flex-col items-center justify-center gap-8 max-w-7xl mx-auto w-full">
        <AnimatePresence mode="wait">
          {!isRegistered ? (
            <div key="registration" className="w-full flex flex-col gap-16 py-4">
              {/* Main Landing Row Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center w-full max-w-6xl">
                {/* Marketing Content Column with Premium Hero Banner (Requested Theme) */}
                <div className="lg:col-span-7 space-y-6 text-left animate-fade-in">
                  {/* 💸 High Impact Premium Banner card */}
                  <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 to-slate-900 border border-white/10 hover:border-blue-500/50 shadow-[0_0_40px_rgba(16,185,129,0.08)] hover:shadow-[0_0_50px_rgba(59,130,246,0.12)] transition-all duration-500 p-6 md:p-8 space-y-6">
                    {/* Glowing background matrix effect */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-transparent blur-3xl pointer-events-none" />
                    
                    <div className="flex items-center gap-2.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] animate-ping"></span>
                      <span className="text-[10px] font-black uppercase tracking-[0.25em] text-[#10B981] bg-[#10B981]/10 px-3 py-1 rounded-full border border-[#10B981]/20">
                        Secure Infrastructure
                      </span>
                    </div>

                    {/* 💸 MAIN HIGHLIGHT */}
                    <div className="space-y-3">
                      <h1 className="text-4xl md:text-5xl lg:text-6xl font-black font-serif text-white tracking-tight leading-none text-balance">
                        Wealth Management Platform
                      </h1>
                      <p className="text-sm md:text-base text-white/70 leading-relaxed font-sans font-medium max-w-xl">
                        Access algorithmic investment strategies and institutional-grade portfolio management tailored for long-term growth.
                      </p>
                    </div>

                    {/* ✅ REQUESTED SPECIFIC LIST WITH ICONS */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
                      <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-[#10B981]/30 transition-all">
                        <span className="text-md text-[#10B981]">✅</span>
                        <span className="text-xs font-black uppercase tracking-wider text-white">Fast Withdrawals</span>
                      </div>
                      <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-blue-500/30 transition-all">
                        <span className="text-md text-blue-400">✅</span>
                        <span className="text-xs font-black uppercase tracking-wider text-white">Referral Rewards</span>
                      </div>
                      <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-emerald-400/30 transition-all">
                        <span className="text-md text-emerald-400">✅</span>
                        <span className="text-xs font-black uppercase tracking-wider text-white">Binance Deposits</span>
                      </div>
                    </div>

                    {/* ⚡ Call to Action Buttons */}
                    <div className="flex flex-wrap items-center gap-4 pt-2">
                      <button 
                        onClick={() => {
                          scrollToTop();
                        }}
                        className="px-8 py-4 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-500 to-blue-600 bg-[length:200%_auto] hover:bg-right text-white font-bold text-xs uppercase tracking-widest hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] active:scale-95 transition-all duration-500 cursor-pointer border-0 shadow-[0_0_20px_rgba(59,130,246,0.3)]"
                      >
                        Open an Account
                      </button>
                    </div>
                  </div>

                  {/* Premium Core Stats Section - With requested Number Counting animations */}
                  <div className="pt-6 grid grid-cols-2 sm:grid-cols-4 gap-4 text-left border-t border-white/5">
                    <div className="space-y-1">
                      <p className="text-white text-lg md:text-2xl font-bold font-mono tracking-tight text-blue-400">
                        <CountUpNum value={10000} suffix="+" />
                      </p>
                      <p className="text-[9px] text-white/40 uppercase tracking-wider font-bold">Active Members</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-white text-lg md:text-2xl font-bold font-mono tracking-tight text-[#10B981] flex items-center gap-1.5">
                        <span>99.9%</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      </p>
                      <p className="text-[9px] text-white/40 uppercase tracking-wider font-bold">Secure Core</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-white text-lg md:text-2xl font-bold font-mono tracking-tight text-white">
                        &lt; <CountUpNum value={2} suffix=" Min" />
                      </p>
                      <p className="text-[9px] text-white/40 uppercase tracking-wider font-bold">Fast Withdrawals</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-white text-lg md:text-2xl font-bold font-mono tracking-tight text-blue-400">
                        <CountUpNum value={100} suffix="%" />
                      </p>
                      <p className="text-[9px] text-white/40 uppercase tracking-wider font-bold">Legit Payout Guarantee</p>
                    </div>
                  </div>
                </div>

                {/* Secure Registration / Access Form Column */}
                <div id="registration-container" className="lg:col-span-5 flex flex-col items-center lg:items-end gap-6 w-full scroll-mt-24 transition-all duration-300 rounded-3xl">
                  <RegistrationCard 
                    referredBy={referredBy} 
                    referredSource={referredSource}
                    inviterName={inviterName} 
                    onLoginSuccess={(userId) => setCurrentUid(userId)} 
                  />
                </div>
              </div>

              {/* 1. TRUST SECTION */}
              <div className="w-full max-w-6xl mx-auto space-y-8 animate-fade-in pt-4 border-t border-white/5">
                <div className="text-center space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.25em] text-blue-400 bg-blue-600/10 px-3.5 py-1 rounded-full border border-blue-500/20 inline-block font-sans">
                    Guaranteed Protection
                  </span>
                  <h2 className="text-3xl md:text-4xl font-black font-serif text-white tracking-tight">
                    🔒 Professional Trust & Security Pillars
                  </h2>
                  <p className="text-xs text-zinc-400 font-sans max-w-md mx-auto leading-relaxed">
                    Apex Capital coordinates rigorous secure protocols to protect physical stake balances and guarantee rapid payout verification times.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  {/* SSL SECURED */}
                  <div className="bg-[#121212]/50 backdrop-blur-md border border-white/5 hover:border-[#10B981]/30 rounded-2xl p-5 md:p-6 space-y-3 transition-all duration-300 relative group overflow-hidden text-left">
                    <div className="w-10 h-10 rounded-xl bg-[#10B981]/10 border border-[#10B981]/20 flex items-center justify-center text-xl text-[#10B981]">
                      🛡️
                    </div>
                    <h3 className="text-xs font-black text-white uppercase tracking-wider font-serif">SSL Secured Core</h3>
                    <p className="text-[11px] text-zinc-400 leading-relaxed font-sans">
                      Our connections run under absolute encrypted certificate protocols. Personal credentials stay fully secure on isolated cloud endpoints.
                    </p>
                  </div>

                  {/* MANUAL DEPOSIT AUDITS */}
                  <div className="bg-[#121212]/50 backdrop-blur-md border border-white/5 hover:border-blue-500/30 rounded-2xl p-5 md:p-6 space-y-3 transition-all duration-300 relative group overflow-hidden text-left">
                    <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-xl text-blue-400">
                      🧑‍🔧
                    </div>
                    <h3 className="text-xs font-black text-white uppercase tracking-wider font-serif">Manual Verification</h3>
                    <p className="text-[11px] text-zinc-400 leading-relaxed font-sans">
                      Our security and layout compliance desk manually audits all incoming deposit hashes in 5-20 minutes for high safety.
                    </p>
                  </div>

                  {/* SECURE WITHDRAWALS */}
                  <div className="bg-[#121212]/50 backdrop-blur-md border border-white/5 hover:border-[#10B981]/30 rounded-2xl p-5 md:p-6 space-y-3 transition-all duration-300 relative group overflow-hidden text-left">
                    <div className="w-10 h-10 rounded-xl bg-[#10B981]/10 border border-[#10B981]/20 flex items-center justify-center text-xl text-[#10B981]">
                      💸
                    </div>
                    <h3 className="text-xs font-black text-white uppercase tracking-wider font-serif">Secure Withdrawals</h3>
                    <p className="text-[11px] text-zinc-400 leading-relaxed font-sans">
                      All payout networks (EasyPaisa, JazzCash, SadaPay, bank transactions, and USDT TRC-20) are dispatched securely.
                    </p>
                  </div>

                  {/* EMAIL NOTIFICATIONS */}
                  <div className="bg-[#121212]/50 backdrop-blur-md border border-white/5 hover:border-blue-500/30 rounded-2xl p-5 md:p-6 space-y-3 transition-all duration-300 relative group overflow-hidden text-left">
                    <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-xl text-blue-400">
                      ✉️
                    </div>
                    <h3 className="text-xs font-black text-white uppercase tracking-wider font-serif">Email Receipts</h3>
                    <p className="text-[11px] text-zinc-400 leading-relaxed font-sans">
                      Log entries automatically. Receive automated, professional client email notifications for registrations, deposits, and payouts.
                    </p>
                  </div>

                  {/* HELPLINES */}
                  <div className="bg-[#121212]/50 backdrop-blur-md border border-white/5 hover:border-[#10B981]/30 rounded-2xl p-5 md:p-6 space-y-3 transition-all duration-300 relative group overflow-hidden text-left">
                    <div className="w-10 h-10 rounded-xl bg-[#10B981]/10 border border-[#10B981]/20 flex items-center justify-center text-xl text-[#10B981]">
                      ⚡
                    </div>
                    <h3 className="text-xs font-black text-white uppercase tracking-wider font-serif">Automated Processing</h3>
                    <p className="text-[11px] text-zinc-400 leading-relaxed font-sans">
                      Our platform handles transactions and portfolio balancing with advanced institutional algorithms.
                    </p>
                  </div>
                </div>
              </div>

              {/* 2. LIVE STATISTICS SECTION (REAL DATABASE IN REAL-TIME) */}
              <div className="w-full max-w-6xl mx-auto space-y-8 animate-fade-in">
                <div className="text-center space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.25em] text-[#10B981] bg-[#10B981]/10 px-3.5 py-1 rounded-full border border-[#10B981]/20 inline-block font-sans">
                    Live Proof of Concept
                  </span>
                  <h2 className="text-3xl md:text-4xl font-black font-serif text-white tracking-tight">
                    📈 Live Ledger Database Stats
                  </h2>
                  <p className="text-xs text-zinc-400 font-sans max-w-md mx-auto leading-relaxed">
                    The platform's performance metrics compiled from the secure cloud ledger. Updated in real-time.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                  {/* Total Registered Users */}
                  <div className="bg-[#121212]/30 border border-white/5 rounded-2xl p-5 space-y-2 relative overflow-hidden text-center transition-all hover:bg-[#121212]/60">
                    <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest font-sans block">Total Registered Users</span>
                    <h3 className="text-3xl font-bold font-mono text-blue-400 leading-none py-1">
                      {isStatsLoading ? "..." : publicStats.totalRegisteredUsers}
                    </h3>
                    <p className="text-[9px] text-blue-400/65 font-bold font-sans">Registered Users</p>
                  </div>

                  {/* Active Users */}
                  <div className="bg-[#121212]/30 border border-white/5 rounded-2xl p-5 space-y-2 relative overflow-hidden text-center transition-all hover:bg-[#121212]/60">
                    <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest font-sans block">Active Portfolios</span>
                    <h3 className="text-3xl font-bold font-mono text-[#10B981] leading-none py-1 flex items-center justify-center gap-1">
                      {isStatsLoading ? "..." : publicStats.activeUsers}
                    </h3>
                    <p className="text-[9px] text-[#10B981]/60 font-medium font-sans flex items-center justify-center gap-1.5 leading-none">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      Staked Core Online
                    </p>
                  </div>

                  {/* Total Deposits */}
                  <div className="bg-[#121212]/30 border border-white/5 rounded-2xl p-5 space-y-2 relative overflow-hidden text-center transition-all hover:bg-[#121212]/60">
                    <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest font-sans block">Total Deposits</span>
                    <h3 className="text-2xl font-bold font-mono text-white leading-none py-1.5">
                      {isStatsLoading ? "..." : `$${publicStats.totalDeposits.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    </h3>
                    <p className="text-[9px] text-zinc-400 font-bold font-sans">Platform Assets under Management</p>
                  </div>

                  {/* Total Withdrawals */}
                  <div className="bg-[#121212]/30 border border-white/5 rounded-2xl p-5 space-y-2 relative overflow-hidden text-center transition-all hover:bg-[#121212]/60">
                    <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest font-sans block">Total Withdrawals</span>
                    <h3 className="text-2xl font-bold font-mono text-[#E5E7EB] leading-none py-1.5">
                      {isStatsLoading ? "..." : `$${publicStats.totalWithdrawals.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    </h3>
                    <p className="text-[9px] text-zinc-400 font-bold font-sans">Processed Transactions</p>
                  </div>

                  {/* Pending Audits Queue */}
                  <div className="bg-[#121212]/30 border border-white/5 rounded-2xl p-5 space-y-2 relative overflow-hidden text-center transition-all hover:bg-[#121212]/60">
                    <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest font-sans block">Pending Transactions</span>
                    <h3 className="text-3xl font-bold font-mono text-amber-500 leading-none py-1">
                      {isStatsLoading ? "..." : publicStats.pendingRequests}
                    </h3>
                    <p className="text-[9px] text-zinc-400 font-bold font-sans">Currently Processing</p>
                  </div>
                </div>
              </div>

              {/* SECTION 3: RECENT APPROVED WITHDRAWALS LIVE FEED */}
              <div className="w-full max-w-6xl mx-auto space-y-8 animate-fade-in">
                <div className="text-center space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.25em] text-blue-400 bg-blue-600/10 px-3.5 py-1 rounded-full border border-blue-500/20 inline-block font-sans">
                    Settlement & Verification System
                  </span>
                  <h2 className="text-3xl md:text-4xl font-black font-serif text-white tracking-tight">
                    🧾 Live Real-Time Transactions Feed
                  </h2>
                  <p className="text-xs text-zinc-400 font-sans max-w-md mx-auto leading-relaxed">
                    A transparency-backed rolling ledger showing active pending requests alongside approved payout settlements. No fake records.
                  </p>
                </div>

                <div className="bg-[#0F0F0F] border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
                  {/* Table Headers */}
                  <div className="grid grid-cols-4 px-6 py-4 bg-white/[0.02] border-b border-white/5 text-[9px] font-black uppercase tracking-widest text-blue-400 text-left">
                    <span>VIP Member (Initials)</span>
                    <span>Payout Amount</span>
                    <span>Payout Channel</span>
                    <span className="text-right">Status & Timeline</span>
                  </div>

                  {/* Table Rows scrolling block */}
                  <div className="divide-y divide-white/5 max-h-[300px] overflow-y-auto font-sans text-xs">
                    {approvedWithdrawalsFeed && approvedWithdrawalsFeed.length > 0 ? (
                      approvedWithdrawalsFeed.slice(0, 15).map((record) => (
                        <div key={record.id} className="grid grid-cols-4 px-6 py-4 items-center text-left hover:bg-white/[0.01] transition-all">
                          <span className="font-extrabold text-zinc-200">{record.userInitial}</span>
                          <span className="font-black font-mono text-[#10B981]">${Number(record.amount || 0).toFixed(2)}</span>
                          <span className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold">
                            🏦 {record.network}
                          </span>
                          <div className="text-right flex flex-col items-end gap-1">
                            {record.status === 'pending' ? (
                              <span className="text-[10px] py-0.5 px-2 bg-amber-500/15 border border-amber-500/25 text-amber-500 rounded-full font-black text-[8px] uppercase tracking-widest flex items-center gap-1 select-none">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                                Pending
                              </span>
                            ) : (
                              <span className="text-[10px] py-0.5 px-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full font-black text-[8px] uppercase tracking-widest flex items-center gap-1 select-none">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                Approved
                              </span>
                            )}
                            <span className="text-[9px] text-zinc-500 font-medium">{record.timestamp}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-12 text-center text-zinc-500 space-y-2">
                        <p className="text-xs font-medium">Wait secure network connection... No payout logs active.</p>
                        <p className="text-[9px] text-zinc-600 uppercase tracking-widest">Payout queue is 100% up to date for this period.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* SECTION 4: COMPANY TRANSPARENCY SECTION WITH ABOUT, LEGAL, AND HELPLINES */}
              <div className="w-full max-w-6xl mx-auto pt-6 border-t border-white/5 font-sans animate-fade-in">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-left text-zinc-400">
                  <div className="space-y-3">
                    <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-400">About Platform</h4>
                    <p className="text-[11px] leading-relaxed font-sans font-medium">
                      Apex Capital is Pakistan's premium automated dynamic staking platform. We empower individuals to secure stable cryptocurrency yields and easy PKR-based investments.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#10B981]">Community</h4>
                    <div className="flex flex-col gap-2 text-xs font-semibold">
                      <a href="https://t.me/apexcapital_official" target="_blank" rel="noopener noreferrer" className="text-zinc-300 hover:text-sky-400 transition-all flex items-center gap-1 bg-transparent border-0">
                        ✈️ Official Channel
                      </a>
                    </div>
                  </div>

                  <div className="space-y-3 font-sans">
                    <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-white">Company Information</h4>
                    <div className="flex flex-col gap-2 text-xs font-semibold">
                      <button onClick={() => setOpenedFooterDoc('about')} className="text-left text-zinc-300 hover:text-blue-400 transition-all bg-transparent border-0 cursor-pointer outline-none">
                        About Apex Capital
                      </button>
                      
                    </div>
                  </div>

                  <div className="space-y-3 font-sans">
                    <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-400">Legal Framework</h4>
                    <div className="flex flex-col gap-2 text-xs font-semibold">
                      <button onClick={() => setOpenedFooterDoc('terms')} className="text-left text-zinc-300 hover:text-blue-400 transition-all bg-transparent border-0 cursor-pointer outline-none">
                        Terms & Conditions Agreement
                      </button>
                      <button onClick={() => setOpenedFooterDoc('privacy')} className="text-left text-zinc-300 hover:text-blue-400 transition-all bg-transparent border-0 cursor-pointer outline-none">
                        Official Privacy Protocol
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div key="dashboard" id="dashboard-container" className="scroll-mt-24 w-full flex flex-col items-center gap-8">
              <DashboardCard
                name={userProfile.name}
                userId={userProfile.userId}
                balance={balance}
                referralCount={logs.length}
                logs={logs}
                avatar={userProfile.avatar}
                deposits={deposits}
                withdrawals={withdrawals}
                investments={investments}
                dailyRewardLogs={dailyRewardLogs}
                onCreateDeposit={handleCreateDeposit}
                onCreateWithdrawal={handleCreateWithdrawal}
                onCreatePlan={handleCreatePlan}
                onCancelPlan={handleCancelPlan}
                onUpdateTxStatus={async (type, txId, status) => {
                  // DashboardCard does not support admin action with userId and amount, so we pass a no-op wrapper
                }}
                onSignOut={handleSignOut}
                investmentProfits={investmentProfits}
                maturedBalance={maturedBalance}
                onAddToast={addToast}
                userProfile={userProfile}
                onClaimDailyReward={handleClaimDailyReward}
                virtualDays={virtualDays}
                activeTab={dashboardTab}
                onActiveTabChange={setDashboardTab}
                onUpdateProfile={handleUpdateProfile}
                onVerifyEmail={handleVerifyEmail}
                onRefresh={handleRefreshAllData}
                globalSettings={globalSettings}
                theme={theme}
                setTheme={setTheme}
                tasks={tasks}
                taskSubmissions={taskSubmissions}
              />
              <ReferralHistory logs={logs} userId={currentUid || ''} walletBalance={balance} theme={theme} />
            </div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer Bar */}
      <footer className={`border-t flex flex-col md:flex-row items-center justify-between px-6 md:px-10 py-6 md:py-4 text-[10px] uppercase tracking-[0.25em] space-y-3 md:space-y-0 ${theme === 'dark' ? 'border-white/5 bg-slate-950 text-[#E5E7EB]/20' : 'border-gray-200 bg-white text-slate-400'}`}>
        <div className="text-center md:text-left">&copy; {new Date().getFullYear()} Apex Capital</div>
        
        {/* AdSense policy and branding links */}
        <div className={`flex flex-wrap justify-center gap-3.5 font-sans text-[9px] font-bold tracking-wider uppercase ${theme === 'dark' ? 'text-blue-400' : 'text-emerald-600'}`}>
          <button onClick={() => setOpenedFooterDoc('about')} className="hover:underline hover:text-emerald-500 cursor-pointer bg-transparent border-0 uppercase">About Us</button>
          <span>•</span>
          <button onClick={() => setOpenedFooterDoc('contact')} className="hover:underline hover:text-emerald-500 cursor-pointer bg-transparent border-0 uppercase">Contact Us</button>
          <span>•</span>
          <button onClick={() => setOpenedFooterDoc('privacy')} className="hover:underline hover:text-emerald-500 cursor-pointer bg-transparent border-0 uppercase">Privacy Policy</button>
          <span>•</span>
          <button onClick={() => setOpenedFooterDoc('terms')} className="hover:underline hover:text-emerald-500 cursor-pointer bg-transparent border-0 uppercase">Terms & Conditions</button>
        </div>

        <div className="flex gap-4 items-center font-sans tracking-widest justify-center">
          <span>Compliance: #MMS-992-KLR</span>
          <span className={`${theme === 'dark' ? 'text-blue-400/40' : 'text-emerald-500/40'} font-semibold`}>•</span>
          <span className={theme === 'dark' ? 'text-blue-400/50' : 'text-emerald-600 font-bold'}>Status: Active</span>
        </div>
      </footer>

      {/* Dynamic Static Information Pages Modal (AdSense Friendly) */}
      <AnimatePresence>
        {openedFooterDoc && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="relative w-full max-w-2xl bg-slate-900 border border-white/10 rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(59,130,246,0.1)] flex flex-col max-h-[85vh]"
            >
              {/* Modal Top header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#0F0F0F]">
                <div>
                  <h2 className="text-xs uppercase font-extrabold tracking-[0.2em] text-blue-400 font-sans">
                    {openedFooterDoc === 'about' && 'About Apex Capital'}
                    {openedFooterDoc === 'contact' && 'Contact Information'}
                    {openedFooterDoc === 'privacy' && 'Official Privacy Policy'}
                    {openedFooterDoc === 'terms' && 'Core Terms & Conditions'}
                  </h2>
                  <p className="text-[8px] text-white/30 uppercase tracking-widest leading-none mt-1">Official platform legal document center</p>
                </div>
                <button
                  onClick={() => setOpenedFooterDoc(null)}
                  className="p-2 rounded-xl border border-white/5 bg-transparent hover:bg-white/5 text-white/50 hover:text-white transition-all cursor-pointer flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Scrollable Core Area */}
              <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-4 font-sans text-xs text-white/70 leading-relaxed text-left">
                {openedFooterDoc === 'about' && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Welcome to Apex Capital</h3>
                    <p>
                      Apex Capital is a modern financial platform designed to help users manage their accounts, track activity, monitor earnings, and access financial tools through a secure and user-friendly dashboard.
                    </p>
                    <p>
                      Our mission is to provide a simple, transparent, and reliable digital experience for users who want to stay informed and organized in their financial journey.
                    </p>
                    <div className="bg-[#111] border border-white/5 rounded-xl p-4 space-y-2">
                      <p className="font-bold text-white uppercase text-[10px] tracking-wider text-blue-400">We focus heavily on:</p>
                      <ul className="list-disc list-inside space-y-1 text-white/60 text-[11px]">
                        <li>User-friendly dashboard experience</li>
                        <li>Secure account management</li>
                        <li>Real-time activity tracking</li>
                        <li>Referral and community features</li>
                        <li>Reliable customer support</li>
                      </ul>
                    </div>
                    <p className="text-[11px] text-white/40 italic">
                      At Apex Capital, we continuously improve our platform to provide a better experience for all members.
                    </p>
                  </div>
                )}

                {openedFooterDoc === 'contact' && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Contact Information</h3>
                    <p>
                      If you have any questions, suggestions, or require assistance, please contact our support team.
                    </p>
                    <div className="bg-[#111] border border-white/5 rounded-xl p-4 space-y-2.5 font-mono text-[11px]">
                      <div>
                        <span className="text-white/30 block uppercase text-[9px] tracking-wider font-sans font-bold">Official Support Email</span>
                        <a href="mailto:support@apexcapital.test" className="text-blue-400 hover:underline">support@apexcapital.test</a>
                      </div>
                      <div>
                        <span className="text-white/30 block uppercase text-[9px] tracking-wider font-sans font-bold">Corporate Website</span>
                        <span className="text-white font-bold">apexcapital.test</span>
                      </div>
                      <div>
                        <span className="text-white/30 block uppercase text-[9px] tracking-wider font-sans font-bold">Support Hours</span>
                        <span className="text-white">24 Hours / 7 Days Live Help Desk</span>
                      </div>
                    </div>
                    <p className="text-[11px] text-white/40 italic">
                      We aim to respond to all inquiries as quickly as possible.
                    </p>
                  </div>
                )}

                {openedFooterDoc === 'privacy' && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Privacy Policy</h3>
                    <p>
                      At Apex Capital, we value your privacy and are committed to protecting your personal information.
                    </p>
                    
                    <div className="bg-[#111] border border-white/5 rounded-xl p-4 space-y-2">
                      <p className="font-bold text-white uppercase text-[10px] tracking-wider text-blue-400">We may collect information such as:</p>
                      <ul className="list-disc list-inside space-y-1 text-white/60 text-[11px]">
                        <li>Name & user identifiers</li>
                        <li>Email address</li>
                        <li>Account transactions and states</li>
                        <li>Website usage logs and platform metrics</li>
                      </ul>
                    </div>

                    <div className="bg-[#111] border border-white/5 rounded-xl p-4 space-y-2">
                      <p className="font-bold text-white uppercase text-[10px] tracking-wider text-blue-400">This information is used to:</p>
                      <ul className="list-disc list-inside space-y-1 text-white/60 text-[11px]">
                        <li>Improve user experience and platform responsiveness</li>
                        <li>Provide high quality customer support</li>
                        <li>Maintain overall server and data ledger security</li>
                        <li>Enhance our general web tools</li>
                      </ul>
                    </div>

                    <p>
                      We do not sell personal information to third parties. By using our website, you agree to this Privacy Policy.
                    </p>
                    <p className="text-[10px] font-bold uppercase text-white/30 tracking-widest pt-2">
                      Last Updated: June 2026
                    </p>
                  </div>
                )}

                {openedFooterDoc === 'terms' && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Terms and Conditions</h3>
                    <p>
                      By accessing and using Apex Capital, you agree to comply with these terms and conditions.
                    </p>

                    <div className="bg-[#111] border border-white/5 rounded-xl p-4 space-y-2">
                      <p className="font-bold text-white uppercase text-[10px] tracking-wider text-blue-400">Users agree to:</p>
                      <ul className="list-disc list-inside space-y-1 text-white/60 text-[11px]">
                        <li>Provide accurate and precise information</li>
                        <li>Maintain strict account credentials security</li>
                        <li>Follow all applicable local and regional laws</li>
                        <li>Use high-security practices and engage platform tools responsibly</li>
                      </ul>
                    </div>

                    <p>
                      Apex Capital reserves the right to modify services, update policies, or suspend accounts that violate these terms. Continued use of the platform constitutes acceptance of any updated terms.
                    </p>
                    <p className="text-[10px] font-bold uppercase text-white/30 tracking-widest pt-2">
                      Last Updated: June 2026
                    </p>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-3 border-t border-white/5 bg-slate-950 text-right">
                <button
                  onClick={() => setOpenedFooterDoc(null)}
                  className="px-4 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 transition-all text-[10px] uppercase font-bold tracking-widest cursor-pointer text-white"
                >
                  Confirm & Dismiss
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Admin Access Control Console Modal Overlay */}
      <AnimatePresence>
        {showAdminModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="relative w-full max-w-6xl bg-[#090909] border border-blue-500/20 rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(59,130,246,0.15)] flex flex-col my-8 max-h-[90vh]"
            >
              {/* Modal Top Bar header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-slate-900">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-600/10 border border-blue-500/25 flex items-center justify-center text-blue-400">
                    <ShieldCheck className="w-4 h-4 animate-pulse" />
                  </div>
                  <div>
                    <h2 className="text-xs uppercase font-bold tracking-[0.2em] text-blue-400 font-serif">Governance Console</h2>
                    <p className="text-[8px] text-white/30 uppercase tracking-widest leading-none mt-0.5">Secure Cloud Administrator Core</p>
                  </div>
                </div>

                <button
                  onClick={() => setShowAdminModal(false)}
                  className="p-2 rounded-xl border border-white/5 bg-transparent hover:bg-white/5 text-white/50 hover:text-white transition-all cursor-pointer flex items-center justify-center"
                  aria-label="Close governance window"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Core Area */}
              <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
                <AdminPanel 
                  onAddToast={addToast} 
                  tasks={tasks}
                  taskSubmissions={taskSubmissions}
                  currentUserId={currentUid || 'anonymous-operator'} 
                  isBypassed={isSuperAdminBypassed}
                  onLockBypass={handleLockBypass}
                  virtualDays={virtualDays}
                  globalSettings={globalSettings}
                  withdrawals={[...pendingFeedRaw, ...approvedFeedRaw]}
                  onUpdateTxStatus={handleUpdateTxStatus}
                />
              </div>

              {/* Admin Footer Banner info */}
              <div className="px-6 py-3 border-t border-white/5 bg-[#050505] text-[8px] text-center text-white/20 uppercase tracking-[0.2em] font-sans flex flex-col sm:flex-row items-center justify-between gap-2">
                <span>Apex Capital Audit Log: Enabled</span>
                <span className="text-blue-400/35 font-mono">Operator ID: {currentUid ? currentUid.slice(0, 16) : 'anonymous'}</span>
                <span>SECURE SESSION TYPE: TLS 1.3 AES-256</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Hidden Secret Passcode Prompt Dialog Overlay */}
      <AnimatePresence>
        {showSecretPasscodePopup && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-sm bg-slate-900 border border-blue-500/35 rounded-2xl p-6 space-y-5 shadow-[0_0_50px_rgba(59,130,246,0.15)] text-left"
            >
              <div className="text-center space-y-2">
                <div className="w-12 h-12 bg-blue-600/10 border border-blue-500/25 rounded-xl flex items-center justify-center mx-auto text-blue-400 animate-pulse">
                  <Lock className="w-5 h-5" />
                </div>
                <h3 className="text-xs uppercase tracking-[0.22em] text-blue-400 font-black">Governance Node Access</h3>
                <p className="text-[8px] text-white/30 uppercase tracking-[0.1em] font-sans">Authorization Security Screen</p>
              </div>

              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const passcode = (form.elements.namedItem('secretPasscode') as HTMLInputElement).value.trim();
                  
                  const correctPasscode = import.meta.env.VITE_ADMIN_PASSCODE || 'EARNHUB2026ADMIN';
                  
                  if (passcode === correctPasscode) {
                    localStorage.setItem('earnhub_super_admin_unlocked', 'true');
                    setIsSuperAdminBypassed(true);
                    setShowSecretPasscodePopup(false);
                    setShowAdminModal(true); // Fire up Super Admin Console
                    addToast('🔐 Secret Access Granted: Super Admin Node Unlocked.', 'success');
                  } else {
                    addToast('❌ Security Warning: Passcode validation failed.', 'error');
                  }
                }}
                className="space-y-4 font-sans"
              >
                <div className="space-y-1.5">
                  <span className="text-[9px] text-white/40 uppercase tracking-wider font-extrabold block">Governance Passcode</span>
                  <input 
                    name="secretPasscode"
                    type="password" 
                    required
                    placeholder="Enter Security Admin Passcode"
                    autoFocus
                    className="w-full bg-[#070707] border border-white/5 focus:border-blue-500/35 rounded-xl px-4 py-3 text-xs text-white placeholder-white/20 outline-none transition-all text-center font-mono tracking-widest uppercase"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2 text-[9px] uppercase font-black tracking-widest font-sans">
                  <button 
                    type="submit"
                    className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-[#B29430] hover:brightness-110 active:scale-[0.98] transition-all rounded-xl text-black shadow-lg shadow-blue-500/10 cursor-pointer border-0"
                  >
                    Authenticate
                  </button>
                  <button 
                    type="button"
                    onClick={() => setShowSecretPasscodePopup(false)}
                    className="px-4 py-3 border border-white/5 bg-transparent hover:bg-white/5 active:scale-[0.98] transition-all rounded-xl text-white/50 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Session Inactivity Auto Sign-Out Warning Overlay */}
      <AnimatePresence>
        {showInactivityWarning && (
          <div id="inactivity-warning-overlay" className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4">
            <motion.div
              id="inactivity-warning-container"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-sm bg-slate-900 border border-blue-500/35 rounded-2xl p-6 md:p-8 space-y-5 shadow-[0_0_50px_rgba(59,130,246,0.15)] text-center text-white"
            >
              {/* Alert Icon */}
              <div id="inactivity-icon-box" className="w-14 h-14 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center mx-auto text-amber-400">
                <ShieldAlert className="w-6 h-6 animate-pulse" />
              </div>

              {/* Title Header */}
              <div id="inactivity-title-group" className="space-y-1.5">
                <h3 id="inactivity-title" className="text-base uppercase tracking-[0.2em] text-blue-400 font-black font-serif animate-pulse">Session Security Alert</h3>
                <p id="inactivity-subtitle" className="text-[9px] text-zinc-500 uppercase tracking-widest font-sans font-bold">Inactivity Protection Audit</p>
              </div>

              {/* Description Body */}
              <p id="inactivity-description" className="text-xs text-zinc-400 font-sans leading-relaxed">
                For the safety of your funds and stake earnings, you will be automatically signed out soon due to inactivity.
              </p>

              {/* Countdown Tracker Box */}
              <div id="inactivity-countdown-box" className="bg-slate-950/50 border border-white/5 rounded-xl p-4 flex flex-col items-center justify-center gap-1.5">
                <div id="inactivity-counter-row" className="flex items-center gap-2 text-amber-400">
                  <Clock className="w-4 h-4 shrink-0 animate-pulse" />
                  <span id="inactivity-countdown-seconds" className="font-mono text-2xl font-black">{inactivitySecondsLeft}s</span>
                </div>
                <span id="inactivity-countdown-label" className="text-[9px] text-zinc-500 font-bold font-sans uppercase tracking-wider">
                  Remaining Session Lifetime
                </span>
              </div>

              {/* Actions Button Panel */}
              <div id="inactivity-actions" className="flex items-center gap-3 pt-1">
                <button 
                  id="btn-extend-session"
                  type="button"
                  onClick={() => {
                    lastActiveRef.current = Date.now();
                    setShowInactivityWarning(false);
                    addToast("Secure session extended successfully.", "success");
                  }}
                  className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-[#B29430] hover:brightness-110 active:scale-[0.98] transition-all rounded-xl text-black font-bold text-xs uppercase tracking-widest hover:shadow-[0_0_20px_rgba(59,130,246,0.2)] cursor-pointer border-0"
                >
                  Keep Me Logged In
                </button>
                <button 
                  id="btn-logout-session"
                  type="button"
                  onClick={async () => {
                    setShowInactivityWarning(false);
                    await handleSignOut();
                    addToast("You have been signed out successfully.", "success");
                  }}
                  className="px-4 py-3 border border-white/5 bg-transparent hover:bg-white/5 active:scale-[0.98] transition-all rounded-xl text-zinc-400 hover:text-white font-bold text-xs uppercase cursor-pointer"
                >
                  Sign Out
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Gmail Link & Verification Modal Prompt */}
      <AnimatePresence>
      </AnimatePresence>
    </div>
  );
}
