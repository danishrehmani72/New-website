/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Copy, 
  Check, 
  TrendingUp, 
  User, 
  Award, 
  DollarSign, 
  Users,
  ArrowDownLeft, 
  ArrowUpRight, 
  CheckCircle, 
  XCircle, 
  ShieldCheck, 
  Wallet, 
  Coins, 
  Layers,
  LogOut,
  HelpCircle,
  Sparkles,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Volume2,
  VolumeX,
  Zap,
  ExternalLink,
  Settings,
  Upload,
  Bell,
  ToggleRight,
  ToggleLeft,
  MessageCircle,
  Mail,
  Eye,
  EyeOff,
  Home,
  CheckSquare,
  Share2,
  Send,
  Youtube,
  Play,
  ArrowLeft,
  MoreVertical,
  Plus,
  Image as ImageIcon,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'motion/react';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, doc, setDoc } from 'firebase/firestore';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  BarChart,
  Bar,
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid,
  Legend
} from 'recharts';
import { FaqSection } from './FaqSection';
import EmailVerificationModal from './EmailVerificationModal';
import { ReferralLog, DepositLog, WithdrawalLog, UserPlan, DailyRewardLog, Task, TaskSubmission } from '../types';
import { AvatarIcon, getAvatarConfig, AVATAR_PRESETS } from '../lib/avatars';

import { PlanMatrix } from './PlanMatrix';
import { playSound } from '../lib/sounds';

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

interface DashboardCardProps {
  name: string;
  userId: string;
  balance: number;
  referralCount: number;
  logs: ReferralLog[];
  avatar?: string;
  deposits?: DepositLog[];
  withdrawals?: WithdrawalLog[];
  investments?: UserPlan[];
  onCreateDeposit?: (amount: number, network: string, txHash: string, screenshot?: string) => Promise<void>;
  onCreateWithdrawal?: (amount: number, network: string, wallet: string) => Promise<void>;
  onCreatePlan?: (planId: string, amount: number) => Promise<void>;
  onCancelPlan?: (invId: string) => Promise<void>;
  onUpdateTxStatus?: (type: 'deposit' | 'withdrawal', txId: string, status: 'approved' | 'rejected') => Promise<void>;
  onSignOut?: () => Promise<void> | void;
  investmentProfits?: number;
  maturedBalance?: number;
  onAddToast: (message: string, type: 'success' | 'error', sound?: any) => void;
  userProfile?: any;
  onClaimDailyReward?: (dayIndex: number | null, amount: number, giftCode?: string) => Promise<void>;
  virtualDays?: number;
  activeTab?: 'overview' | 'funding' | 'faq' | 'settings' | 'security';
  onActiveTabChange?: (tab: 'overview' | 'funding' | 'faq' | 'settings' | 'security') => void;
  onUpdateProfile?: (newName: string, newAvatar: string) => Promise<void>;
  onVerifyEmail?: () => Promise<void>;
  dailyRewardLogs?: DailyRewardLog[];
  tasks?: Task[];
  taskSubmissions?: TaskSubmission[];
  onRefresh?: () => Promise<void>;
  globalSettings?: {
    yieldMultiplier: number;
    systemAnnouncement: string;
    isAnnouncementActive: boolean;
  };
  theme?: 'light' | 'dark';
  setTheme?: (theme: 'light' | 'dark') => void;
}

export default function DashboardCard({
  name,
  userId,
  balance,
  referralCount,
  logs,
  avatar,
  deposits = [],
  withdrawals = [],
  investments = [],
  onCreateDeposit,
  onCreateWithdrawal,
  onCreatePlan,
  onCancelPlan,
  onUpdateTxStatus,
  onSignOut,
  investmentProfits = 0,
  maturedBalance = 0,
  onAddToast,
  userProfile,
  onClaimDailyReward,
  virtualDays = 0,
  activeTab: activeTabProp,
  onActiveTabChange,
  onUpdateProfile,
  onVerifyEmail,
  dailyRewardLogs = [],
  tasks = [],
  taskSubmissions = [],
  onRefresh,
  globalSettings,
  theme: themeProp,
  setTheme: setThemeProp,
}: DashboardCardProps) {
  const hasDeposited = deposits && deposits.length > 0;
  const [copied, setCopied] = useState(false);
  const [activeTabLocal, setActiveTabLocal] = useState<'overview' | 'funding' | 'faq' | 'settings' | 'security'>('overview');
  const [showDepositSheet, setShowDepositSheet] = useState(false);
  const [showWithdrawSheet, setShowWithdrawSheet] = useState(false);
  const [showFaqModal, setShowFaqModal] = useState(false);
  const [showQuickActionsDrawer, setShowQuickActionsDrawer] = useState(false);
  const [showEmailVerificationModal, setShowEmailVerificationModal] = useState(false);

  // 2FA Security states
  const [is2faEnabled, setIs2faEnabled] = useState(() => localStorage.getItem('apex_2fa_enabled') === 'true');
  const [showOTPModal, setShowOTPModal] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [otpError, setOtpError] = useState('');
  const pendingWithdrawalRef = useRef<(() => Promise<void>) | null>(null);

  // Redesigned premium features modal and popup states
  const [showSpinModal, setShowSpinModal] = useState(false);
  const [showTasksModal, setShowTasksModal] = useState(false);
  const [showDailyBonusModal, setShowDailyBonusModal] = useState(false);
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [showWithdrawalProgressModal, setShowWithdrawalProgressModal] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinRotation, setSpinRotation] = useState(0);
  const [lastSpinTime, setLastSpinTime] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      return parseInt(localStorage.getItem(`apex_last_spin_time_${userId || 'guest'}`) || '0', 10);
    }
    return 0;
  });
  const [giftCode, setGiftCode] = useState('');
  const [verifyingTaskId, setVerifyingTaskId] = useState<string | null>(null);
  const [taskProgress, setTaskProgress] = useState(0);
  const [notificationsRead, setNotificationsRead] = useState(false);

  const [completedTasks, setCompletedTasks] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const key = `earnhub_completed_tasks_${userId || 'guest'}`;
        return JSON.parse(localStorage.getItem(key) || '[]');
      } catch {
        return [];
      }
    }
    return [];
  });

  // TASK SYSTEM STATE
  const [isSubmittingTask, setIsSubmittingTask] = useState(false);
  const [selectedTaskForSubmission, setSelectedTaskForSubmission] = useState<Task | null>(null);
  const [screenshotFile, setScreenshotFile] = useState<File | null>(0 as any); // Initialize with null but use any to avoid type issues if needed
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleOpenTask = (task: Task) => {
    setSelectedTaskForSubmission(task);
    window.open(task.link, '_blank');
  };

  const handleScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        onAddToast("Screenshot must be less than 5MB.", "error");
        return;
      }
      setScreenshotFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setScreenshotPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitTask = async () => {
    if (!selectedTaskForSubmission || !screenshotFile || !userProfile) return;
    setIsSubmittingTask(true);
    setUploadProgress(10);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(screenshotFile as any);
      reader.onloadend = async () => {
        const base64data = reader.result as string;
        setUploadProgress(50);
        
        try {
          const submissionRef = doc(collection(db, 'task_submissions'));
          await setDoc(submissionRef, {
            id: submissionRef.id,
            userId,
            username: userProfile.name,
            taskId: selectedTaskForSubmission.id,
            taskTitle: selectedTaskForSubmission.title,
            reward: selectedTaskForSubmission.reward,
            screenshot: base64data,
            status: 'Pending',
            submissionTime: serverTimestamp()
          });
          
          setUploadProgress(100);
          onAddToast("Task submitted successfully! Awaiting review.", "success");
          setSelectedTaskForSubmission(null);
          setScreenshotFile(null);
          setScreenshotPreview(null);
        } catch (err) {
          console.error(err);
          onAddToast("Failed to submit task.", "error");
        } finally {
          setIsSubmittingTask(false);
          setUploadProgress(0);
        }
      };
    } catch (err) {
      console.error(err);
      onAddToast("Error processing screenshot.", "error");
      setIsSubmittingTask(false);
      setUploadProgress(0);
    }
  };

  const [isMuted, setIsMuted] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sound_muted') === 'true';
    }
    return false;
  });

  // Fix: Reset scroll position to top on navigation/tab change or modal open
  useEffect(() => {
    // Scroll window to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // For iOS/Android browser compatibility
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [
    activeTabLocal, 
    activeTabProp,
    showDepositSheet, 
    showWithdrawSheet, 
    showSpinModal, 
    showTasksModal, 
    showDailyBonusModal, 
    showGiftModal, 
    showLeaderboardModal,
    showNotificationModal,
    showFaqModal,
    showQuickActionsDrawer,
    showWithdrawalProgressModal
  ]);

  const toggleMuted = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (typeof window !== 'undefined') {
      localStorage.setItem('sound_muted', String(nextMuted));
    }
    if (!nextMuted) {
      setTimeout(() => {
        playSound('new_referral');
      }, 50);
      onAddToast?.("🔊 Audio feedback enabled!", "success");
    } else {
      onAddToast?.("🔇 Audio feedback muted", "error");
    }
  };

  // High fidelity successful withdraw animation states (TikTok/YouTube friendly)
  const [recentSuccessWithdraw, setRecentSuccessWithdraw] = useState<{amount: number, network: string, wallet: string} | null>(null);
  const [successStep, setSuccessStep] = useState<'loading' | 'completed'>('loading');
  const [successProgress, setSuccessProgress] = useState(0);

  const activeTab = activeTabProp !== undefined ? activeTabProp : activeTabLocal;
  const setActiveTab = onActiveTabChange !== undefined ? onActiveTabChange : setActiveTabLocal;
  const [adminModeType, setAdminModeType] = useState<'sandbox' | 'platform_global'>('platform_global');

  // Manual Refresh & Pull-to-Refresh States and Handlers
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [pullStatus, setPullStatus] = useState<'idle' | 'pulling' | 'ready' | 'refreshing'>('idle');
  const touchStartRef = useRef(0);
  const pullingRef = useRef(false);

  const handleManualRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      if (onRefresh) {
        await onRefresh();
      }
      onAddToast('Database stats and records updated successfully!', 'success');
    } catch (err) {
      console.error(err);
      onAddToast('Failed to force refresh from database.', 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  const [profileName, setProfileName] = useState(userProfile?.name || '');
  const [profileAvatar, setProfileAvatar] = useState(userProfile?.avatar || 'star');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [emailAlertsEnabled, setEmailAlertsEnabled] = useState(true);

  // Sync state when userProfile changes
  useEffect(() => {
    if (userProfile) {
      setProfileName(userProfile.name || '');
      setProfileAvatar(userProfile.avatar || 'star');
    }
  }, [userProfile]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0 && !isRefreshing && pullStatus === 'idle') {
      touchStartRef.current = e.touches[0].clientY;
      pullingRef.current = true;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!pullingRef.current) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - touchStartRef.current;
    
    if (diff > 0) {
      // Pulling down (dragging page down)
      const distance = Math.min(80, Math.pow(diff, 0.85));
      if (Math.abs(pullDistance - distance) > 1) {
        setPullDistance(distance);
      }
      const nextStatus = distance >= 50 ? 'ready' : 'pulling';
      if (pullStatus !== nextStatus) {
        setPullStatus(nextStatus);
      }
    } else {
      // Dragging up to scroll down: immediately abort pull-to-refresh to avoid re-render locks!
      pullingRef.current = false;
      if (pullDistance !== 0) setPullDistance(0);
      if (pullStatus !== 'idle') setPullStatus('idle');
    }
  };

  const handleTouchEnd = async () => {
    if (!pullingRef.current) {
      pullingRef.current = false;
      return;
    }
    pullingRef.current = false;
    if (pullStatus === 'ready') {
      setPullStatus('refreshing');
      setIsRefreshing(true);
      setPullDistance(55);
      try {
        if (onRefresh) {
          await onRefresh();
        }
        onAddToast('Pull-to-refresh: Data updated successfully!', 'success');
      } catch (err) {
        console.error(err);
        onAddToast('Failed to refresh data.', 'error');
      } finally {
        setPullStatus('idle');
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullStatus('idle');
      setPullDistance(0);
    }
  };

  // ⚡ CUSTOM INTERACTIVE HANDLERS FOR REDESIGNED POPUPS
  const handleTaskClick = async (taskId: string, link: string, rewardPKR: number) => {
    if (completedTasks.includes(taskId)) return;
    setVerifyingTaskId(taskId);
    setTaskProgress(0);
    window.open(link, '_blank');
    
    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;
      setTaskProgress(progress);
      if (progress >= 100) {
        clearInterval(interval);
        setVerifyingTaskId(null);
        
        const updated = [...completedTasks, taskId];
        setCompletedTasks(updated);
        const key = `earnhub_completed_tasks_${userId || 'guest'}`;
        localStorage.setItem(key, JSON.stringify(updated));
        
        // Payout to live database
        if (onClaimDailyReward) {
          const rewardUSD = rewardPKR / 280;
          onClaimDailyReward(null, rewardUSD);
        }
        playSound('new_referral');
        onAddToast(`Task Completed! ₨ ${rewardPKR} credited to your live ledger.`, 'success');
      }
    }, 300);
  };

  const handleSpinClick = () => {
    if (isSpinning) return;

    const now = Date.now();
    const hours48 = 48 * 60 * 60 * 1000;
    if (now - lastSpinTime < hours48) {
      const remainingTime = hours48 - (now - lastSpinTime);
      const remainingHours = Math.ceil(remainingTime / (1000 * 60 * 60));
      onAddToast(`Please wait ${remainingHours} hours before your next spin.`, 'error');
      return;
    }

    setIsSpinning(true);
    playSound('new_referral');
    
    // Choose a random segment
    const segmentIndex = Math.floor(Math.random() * 8);
    const selectedSegment = [
      { prize: 0.1, label: "Rs. 28" },
      { prize: 0.25, label: "Rs. 70" },
      { prize: 0.05, label: "Rs. 14" },
      { prize: 0.5, label: "Rs. 140" },
      { prize: 0, label: "Try Again" },
      { prize: 1.0, label: "Rs. 280" },
      { prize: 0.15, label: "Rs. 42" },
      { prize: 0.08, label: "Rs. 22" },
    ][segmentIndex];

    const targetRotation = 360 * 5 + (360 - (segmentIndex * 45) - 22.5);
    setSpinRotation(targetRotation);

    setTimeout(() => {
      setIsSpinning(false);
      
      // Update last spin time
      const spinTime = Date.now();
      setLastSpinTime(spinTime);
      if (typeof window !== 'undefined') {
        localStorage.setItem(`apex_last_spin_time_${userId || 'guest'}`, spinTime.toString());
      }

      if (selectedSegment.prize > 0) {
        if (onClaimDailyReward) {
          onClaimDailyReward(null, selectedSegment.prize);
        }
        playSound('new_referral');
        onAddToast(`🎉 Congratulations! You won ${selectedSegment.label} from the Lucky Spin!`, 'success');
      } else {
        onAddToast("Better luck next time! Try again tomorrow.", 'error');
      }
    }, 4100);
  };

  const handleRedeemGiftCode = () => {
    const code = giftCode.trim().toUpperCase();
    if (!code) {
      onAddToast("Please enter a gift code.", "error");
      return;
    }
    
    if (userProfile?.usedGiftCodes?.includes(code)) {
      onAddToast("You have already redeemed this gift code.", "error");
      return;
    }

    let prizePKR = 0;
    if (code === 'MINDS2026') {
      prizePKR = 140; // $0.5
    } else if (code === 'FREE100') {
      prizePKR = 280; // $1.0
    } else {
      onAddToast("Invalid or expired gift code.", "error");
      return;
    }
    
    setGiftCode('');
    setShowGiftModal(false);
    
    if (onClaimDailyReward) {
      onClaimDailyReward(null, prizePKR / 280, code);
    }
    playSound('new_referral');
    onAddToast(`🎉 Promo code applied! ₨ ${prizePKR} credited successfully.`, "success");
  };


  // Cooldown calculation for daily check-in claims
  const [claimCooldown, setClaimCooldown] = useState('');

  // Pagination states
  const [depositsPage, setDepositsPage] = useState(1);
  const depositsPerPage = 5;
  const totalDepositsPages = Math.ceil((deposits || []).length / depositsPerPage);
  const paginatedDeposits = useMemo(() => {
    return (deposits || []).slice((depositsPage - 1) * depositsPerPage, depositsPage * depositsPerPage);
  }, [deposits, depositsPage, depositsPerPage]);

  const [withdrawalsPage, setWithdrawalsPage] = useState(1);
  const withdrawalsPerPage = 4;
  const totalWithdrawalsPages = Math.ceil((withdrawals || []).length / withdrawalsPerPage);
  const reversedWithdrawals = useMemo(() => (withdrawals || []).slice().reverse(), [withdrawals]);
  const paginatedWithdrawals = useMemo(() => {
    return reversedWithdrawals.slice((withdrawalsPage - 1) * withdrawalsPerPage, withdrawalsPage * withdrawalsPerPage);
  }, [reversedWithdrawals, withdrawalsPage, withdrawalsPerPage]);

type CurrencyCode = 'USD' | 'PKR' | 'AFN' | 'INR' | 'EUR' | 'GBP' | 'IDR' | 'OMR' | 'MYR' | 'PHP';

const SUPPORTED_CURRENCIES: Record<CurrencyCode, { symbol: string; rate: number }> = {
  USD: { symbol: '$', rate: 1 },
  PKR: { symbol: '₨ ', rate: 280 },
  AFN: { symbol: '؋', rate: 70 },
  INR: { symbol: '₹', rate: 83.5 },
  EUR: { symbol: '€', rate: 0.92 },
  GBP: { symbol: '£', rate: 0.78 },
  IDR: { symbol: 'Rp ', rate: 16200 },
  OMR: { symbol: 'OMR ', rate: 0.38 },
  MYR: { symbol: 'RM ', rate: 4.70 },
  PHP: { symbol: '₱', rate: 58.5 },
};

  // Currency conversion configuration (persistent via localStorage) - Default to PKR for authentic screenshot style!
  const [currency, setCurrency] = useState<CurrencyCode>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('currency_preference') as CurrencyCode) || 'PKR';
    }
    return 'PKR';
  });

  const [themeInternal, setThemeInternal] = useState<'light' | 'dark'>(() => {
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

  const theme = themeProp !== undefined ? themeProp : themeInternal;
  const setTheme = setThemeProp !== undefined ? setThemeProp : setThemeInternal;

  useEffect(() => {
    if (typeof window !== 'undefined' && themeProp === undefined) {
      localStorage.setItem('earnhub_theme', themeInternal);
    }
  }, [themeInternal, themeProp]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const key = `earnhub_completed_tasks_${userId || 'guest'}`;
        localStorage.setItem(key, JSON.stringify(completedTasks));
      } catch (err) {
        console.error("Failed to save completed tasks", err);
      }
    }
  }, [completedTasks, userId]);

  const activeConf = SUPPORTED_CURRENCIES[currency] || SUPPORTED_CURRENCIES.USD;
  const conversionRate = activeConf.rate;
  const currencySymbol = activeConf.symbol;

  const currencyRef = useRef(currency);
  useEffect(() => {
    currencyRef.current = currency;
  }, [currency]);

  const changeCurrency = (curr: CurrencyCode) => {
    setCurrency(curr);
    if (typeof window !== 'undefined') {
      localStorage.setItem('currency_preference', curr);
    }
  };

  // Live balance counting animation using state and motion's animate
  const [animatedBalanceDisplay, setAnimatedBalanceDisplay] = useState(() => {
    const activeConf = SUPPORTED_CURRENCIES[currency] || SUPPORTED_CURRENCIES.USD;
    return (balance * activeConf.rate).toFixed(2);
  });
  const currentValRef = useRef(balance);

  // Balance change visual flash effects
  const [flashType, setFlashType] = useState<'up' | 'down' | null>(null);
  const prevBalanceRef = useRef(balance);

  useEffect(() => {
    const prev = prevBalanceRef.current;
    if (balance > prev) {
      setFlashType('up');
      const timer = setTimeout(() => setFlashType(null), 1200);
      prevBalanceRef.current = balance;
      return () => clearTimeout(timer);
    } else if (balance < prev) {
      setFlashType('down');
      const timer = setTimeout(() => setFlashType(null), 1200);
      prevBalanceRef.current = balance;
      return () => clearTimeout(timer);
    }
    prevBalanceRef.current = balance;
  }, [balance]);

  useEffect(() => {
    const startVal = currentValRef.current;
    const endVal = balance;

    const controls = animate(startVal, endVal, {
      duration: 1.2,
      ease: [0.16, 1, 0.3, 1], // easeOutExpo
      onUpdate: (latest) => {
        const activeConf = SUPPORTED_CURRENCIES[currencyRef.current] || SUPPORTED_CURRENCIES.USD;
        setAnimatedBalanceDisplay((latest * activeConf.rate).toFixed(2));
        currentValRef.current = latest;
      }
    });
    return () => controls.stop();
  }, [balance, currency]);

  useEffect(() => {
    if (!userProfile?.lastClaimedAt) {
      setClaimCooldown('');
      return;
    }
    const updateCountdown = () => {
      const lastTime = new Date(userProfile.lastClaimedAt).getTime();
      const elapsed = Date.now() - lastTime;
      const remaining = 24 * 60 * 60 * 1000 - elapsed;
      if (remaining <= 0) {
        setClaimCooldown('');
      } else {
        const h = Math.floor(remaining / (3600 * 1000));
        const m = Math.floor((remaining % (3600 * 1000)) / (60 * 1000));
        const s = Math.floor((remaining % (60 * 1000)) / 1000);
        setClaimCooldown(`${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`);
      }
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [userProfile?.lastClaimedAt]);

  // Crypto deposit address database configuration
  const depositAddresses: Record<string, string> = {
    BNB: '0xae24126409d6a1913951dd4d78fbc09e6fc9638f',
    TRX: 'TGKF1TB8vykfbwm3JR2Gc3ZaypnnhfmqJY',
    MATIC: '0xae24126409d6a1913951dd4d78fbc09e6fc9638f'
  };

  const [copiedAddr, setCopiedAddr] = useState<string | null>(null);

  // Form states
  const [depNetwork, setDepNetwork] = useState('BNB');
  const [depAmount, setDepAmount] = useState('');
  const [depTxHash, setDepTxHash] = useState(''); // text Transaction ID
  const [depScreenshot, setDepScreenshot] = useState(''); // screenshot Base64
  const [depError, setDepError] = useState('');
  const [depSuccess, setDepSuccess] = useState('');

  // Pakistan Deposit states
  const [depositMethodTab, setDepositMethodTab] = useState<'pakistan' | 'crypto'>('pakistan');
  const [pkDepMethod, setPkDepMethod] = useState<'EASYPAISA' | 'JAZZCASH' | 'SADAPAY' | 'NAYAPAY' | 'BANK'>('EASYPAISA');
  const [pkDepAmount, setPkDepAmount] = useState('');
  const [pkDepSenderNumber, setPkDepSenderNumber] = useState('');
  const [pkDepSenderName, setPkDepSenderName] = useState('');
  const [pkDepTxid, setPkDepTxid] = useState(''); // text Transaction ID
  const [pkDepScreenshot, setPkDepScreenshot] = useState(''); // screenshot Base64
  const [pkDepError, setPkDepError] = useState('');
  const [pkDepSuccess, setPkDepSuccess] = useState('');
  const [copiedPkDepNumber, setCopiedPkDepNumber] = useState(false);

  const [withdrawNetwork, setWithdrawNetwork] = useState('BNB');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawWallet, setWithdrawWallet] = useState('');
  const [withdrawError, setWithdrawError] = useState('');
  const [withdrawSuccess, setWithdrawSuccess] = useState('');

  // Pakistan Withdrawal states
  const [withdrawMethodTab, setWithdrawMethodTab] = useState<'pakistan' | 'crypto'>('pakistan');
  const [pkMethod, setPkMethod] = useState<'EASYPAISA' | 'JAZZCASH' | 'SADAPAY' | 'NAYAPAY' | 'BANK'>('EASYPAISA');
  const [pkWithdrawAmount, setPkWithdrawAmount] = useState('');
  const [pkWithdrawNumber, setPkWithdrawNumber] = useState('');
  const [pkWithdrawName, setPkWithdrawName] = useState('');
  const [pkWithdrawError, setPkWithdrawError] = useState('');
  const [pkWithdrawSuccess, setPkWithdrawSuccess] = useState('');
  const [copiedPkNumber, setCopiedPkNumber] = useState(false);

  const [submitting, setSubmitting] = useState(false);



  // Construct referral link using current origin or a beautiful fallback
  const referralLink = typeof window !== 'undefined' 
    ? `${window.location.origin}/?ref=${userId}` 
    : `https://apexcapital.test/?ref=${userId}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy link', err);
    }
  };

  const handleCopyAddr = async (network: string, address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedAddr(network);
      setTimeout(() => setCopiedAddr(null), 2500);
    } catch (err) {
      console.error('Failed to copy crypto address', err);
    }
  };

  const handleCopyPkNumber = async () => {
    try {
      await navigator.clipboard.writeText('03435319202');
      setCopiedPkNumber(true);
      setTimeout(() => setCopiedPkNumber(false), 2500);
    } catch (err) {
      console.error('Failed to copy Pakistan withdraw number', err);
    }
  };

  const handleCopyPkDepNumber = async () => {
    try {
      await navigator.clipboard.writeText('03435319202');
      setCopiedPkDepNumber(true);
      setTimeout(() => setCopiedPkDepNumber(false), 2500);
    } catch (err) {
      console.error('Failed to copy Pakistan deposit number', err);
    }
  };

  const handleScreenshotUpload = (e: React.ChangeEvent<HTMLInputElement>, setScreenshot: React.Dispatch<React.SetStateAction<string>>, setError: React.Dispatch<React.SetStateAction<string>>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setError('❌ Screenshot size must be less than 2MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setScreenshot(reader.result as string);
        setError('');
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePkDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPkDepError('');
    setPkDepSuccess('');

    const amtInput = parseFloat(pkDepAmount);
    const amtUSD = amtInput / conversionRate;
    if (!amtInput || amtUSD < 5) {
      setPkDepError(`❌ Minimum deposit amount is ${currencySymbol}${Math.ceil(5 * conversionRate)}.`);
      return;
    }

    if (!pkDepSenderNumber.trim() || !pkDepSenderName.trim()) {
      setPkDepError('❌ Please fill in your sender account number and title.');
      return;
    }

    if (!pkDepTxid.trim()) {
      setPkDepError('❌ Please enter your Transaction ID (TID) / Reference Number.');
      return;
    }

    if (!pkDepScreenshot.trim()) {
      setPkDepError('❌ Please upload a clear screenshot of the payment receipt.');
      return;
    }

    setSubmitting(true);
    try {
      if (onCreateDeposit) {
        const depositDetails = `${pkDepMethod === 'EASYPAISA' ? 'Easypaisa' : pkDepMethod === 'JAZZCASH' ? 'JazzCash' : pkDepMethod === 'SADAPAY' ? 'SadaPay' : pkDepMethod === 'NAYAPAY' ? 'NayaPay' : 'Bank Transfer'} - Number: ${pkDepSenderNumber.trim()} | Name: ${pkDepSenderName.trim()}`;
        await onCreateDeposit(amtUSD, pkDepMethod, `${pkDepTxid.trim()} (${depositDetails})`, pkDepScreenshot);
        
        setPkDepSuccess('✅ Your deposit request has been submitted successfully. It will be credited after verification within 2 minutes to 2 hours.');
        setPkDepAmount('');
        setPkDepSenderNumber('');
        setPkDepSenderName('');
        setPkDepTxid('');
        setPkDepScreenshot('');
      } else {
        setPkDepError('❌ Deposit system configuration issues. Please try again.');
      }
    } catch (err) {
      setPkDepError('❌ Could not save deposit request.');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit deposit details proof
  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDepError('');
    setDepSuccess('');

    const amtInput = parseFloat(depAmount);
    if (!amtInput || amtInput <= 0) {
      setDepError('Please enter a valid positive deposit amount.');
      return;
    }
    const amtUSD = amtInput / conversionRate;

    if (!depTxHash.trim()) {
      setDepError('Please enter the blockchain transaction hash / ID.');
      return;
    }

    if (!depScreenshot.trim()) {
      setDepError('Please upload a transaction receipt screenshot for verification.');
      return;
    }

    setSubmitting(true);
    try {
      if (onCreateDeposit) {
        await onCreateDeposit(amtUSD, depNetwork, depTxHash.trim(), depScreenshot);
        setDepSuccess('Transaction Proof Submitted! Admin approval pending.');
        setDepAmount('');
        setDepTxHash('');
        setDepScreenshot('');
      } else {
        setDepError('Deposit system configuration issue. Please try again.');
      }
    } catch (err) {
      setDepError('Could not save transaction. Real-time Firebase error.');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit withdrawal requests
  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setWithdrawError('');
    setWithdrawSuccess('');

    const amtInput = parseFloat(withdrawAmount);
    if (!amtInput || amtInput <= 0) {
      setWithdrawError('Please enter a valid positive withdrawal amount.');
      return;
    }
    const amtUSD = amtInput / conversionRate;
    if (amtUSD < 10) {
      setWithdrawError(`Payout request amount too low. Transaction threshold not met (min $10.00 / ${currencySymbol}${(10 * conversionRate).toFixed(0)}).`);
      return;
    }
    if (amtUSD > balance) {
      setWithdrawError(`Insufficient funds. Your live balance is ${currencySymbol}${(balance * conversionRate).toFixed(2)}.`);
      return;
    }
    const isEasyPaisaOrJazzCash = withdrawNetwork === 'EASYPAISA' || withdrawNetwork === 'JAZZCASH';
    const minWalletLength = isEasyPaisaOrJazzCash ? 5 : 10;
    if (!withdrawWallet.trim() || withdrawWallet.trim().length < minWalletLength) {
      if (isEasyPaisaOrJazzCash) {
        setWithdrawError(`Please enter a valid ${withdrawNetwork === 'EASYPAISA' ? 'EasyPaisa' : 'JazzCash'} account number and title (at least 5 characters).`);
      } else {
        setWithdrawError('Please enter a valid destination crypto wallet address (at least 10 characters).');
      }
      return;
    }

    const executeWithdrawal = async () => {
      setSubmitting(true);
      try {
        if (onCreateWithdrawal) {
          await onCreateWithdrawal(amtUSD, withdrawNetwork, withdrawWallet.trim());
          setWithdrawSuccess('Withdrawal Request Saved! Admin approval pending.');
          setWithdrawAmount('');
          setWithdrawWallet('');
        } else {
          setWithdrawError('Withdrawal system configuration issues. Please try again.');
        }
      } catch (err) {
        setWithdrawError('Could not save withdrawal request.');
      } finally {
        setSubmitting(false);
      }
    };

    if (is2faEnabled) {
      pendingWithdrawalRef.current = executeWithdrawal;
      setOtpInput('');
      setOtpError('');
      setShowOTPModal(true);
    } else {
      executeWithdrawal();
    }
  };

  const handlePkWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPkWithdrawError('');
    setPkWithdrawSuccess('');

    const amtInput = parseFloat(pkWithdrawAmount);
    const amtUSD = amtInput / conversionRate;
    if (!amtInput || amtUSD < 10) {
      setPkWithdrawError(`❌ Minimum withdrawal amount is ${currencySymbol}${Math.ceil(10 * conversionRate)}.`);
      return;
    }

    if (amtUSD > balance) {
      setPkWithdrawError(`❌ Insufficient funds. Your live balance is ${currencySymbol}${(balance * conversionRate).toFixed(2)}.`);
      return;
    }

    if (!pkWithdrawNumber.trim() || !pkWithdrawName.trim()) {
      setPkWithdrawError('❌ Please fill in all payment details correctly.');
      return;
    }

    const executePkWithdrawal = async () => {
      setSubmitting(true);
      try {
        if (onCreateWithdrawal) {
          const methodName = pkMethod === 'EASYPAISA' ? 'Easypaisa' :
                             pkMethod === 'JAZZCASH' ? 'JazzCash' :
                             pkMethod === 'SADAPAY' ? 'SadaPay' :
                             pkMethod === 'NAYAPAY' ? 'NayaPay' : 'Bank Transfer';
          const walletDetails = `${methodName} - Number/Account: ${pkWithdrawNumber.trim()} | Account Title: ${pkWithdrawName.trim()}`;
          await onCreateWithdrawal(amtUSD, pkMethod, walletDetails);
          setPkWithdrawSuccess('✅ Your withdrawal request has been submitted successfully. Processing may take 2 minutes to 2 hours after verification (24/7).');
          setPkWithdrawAmount('');
          setPkWithdrawNumber('');
          setPkWithdrawName('');
        } else {
          setPkWithdrawError('❌ Withdrawal system configuration issues. Please try again.');
        }
      } catch (err) {
        setPkWithdrawError('❌ Could not save withdrawal request.');
      } finally {
        setSubmitting(false);
      }
    };

    if (is2faEnabled) {
      pendingWithdrawalRef.current = executePkWithdrawal;
      setOtpInput('');
      setOtpError('');
      setShowOTPModal(true);
    } else {
      executePkWithdrawal();
    }
  };

  const execute2FAVerified = async () => {
    if (otpInput.trim().length !== 6) {
      setOtpError('Invalid OTP Code. Must be 6 digits.');
      return;
    }
    setOtpError('');
    setShowOTPModal(false);
    setOtpInput('');
    if (pendingWithdrawalRef.current) {
      await pendingWithdrawalRef.current();
      pendingWithdrawalRef.current = null;
    }
  };

  const handleApproveReject = async (type: 'deposit' | 'withdrawal', txId: string, status: 'approved' | 'rejected') => {
    try {
      if (onUpdateTxStatus) {
        await onUpdateTxStatus(type, txId, status);
      }
    } catch (e) {
      console.error('Could not modify transaction status', e);
    }
  };

  // --- Investment & Plan calculations ---
  const activeInvestments = useMemo(() => {
    return (investments || []).filter(inv => inv.status === 'active');
  }, [investments]);

  const totalActiveInvestedSum = useMemo(() => {
    return activeInvestments.reduce((sum, inv) => sum + inv.amount, 0);
  }, [activeInvestments]);

  const hasActivePlan = activeInvestments.length > 0;
  const activePlanStatus = hasActivePlan ? 'Active Plan' : 'Inactive Plan';

  // Calculate sum of daily performance percentages of all surviving active plan deposits
  const dailyProfitRate = useMemo(() => {
    return activeInvestments.reduce((sum, inv) => {
      const startTime = inv.createdAt?.seconds 
        ? inv.createdAt.seconds * 1000 
        : new Date(inv.timestamp).getTime() || Date.now();
      const elapsedMs = Math.max(0, Date.now() - startTime);
      const elapsedDaysReal = Math.floor(elapsedMs / (24 * 60 * 60 * 1000));
      const currentDay = Math.max(1, elapsedDaysReal + virtualDays);
      
      let hash = 0;
      const str = (inv.id || String(startTime)) + "_" + currentDay;
      for (let idx = 0; idx < str.length; idx++) {
        hash = str.charCodeAt(idx) + ((hash << 5) - hash);
      }
      const index = Math.abs(hash) % 4;
      const normalizedPlanId = (inv.planId || '').toLowerCase().trim();
      const planCap = getPlanCapPercent(normalizedPlanId, inv.amount);
      const baseDailyRatePercent = (planCap * 100) / 30;
      const multiplier = [0.98, 1.02, 0.95, 1.05][index];
      const dailyPercent = baseDailyRatePercent * multiplier;
      
      return sum + (inv.amount * (dailyPercent / 100));
    }, 0);
  }, [activeInvestments, virtualDays]);

  const earliestActiveInvestment = useMemo(() => {
    if (activeInvestments.length === 0) return null;
    return [...activeInvestments].sort((a, b) => {
      const aTime = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : new Date(a.timestamp).getTime() || 0;
      const bTime = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : new Date(b.timestamp).getTime() || 0;
      return aTime - bTime;
    })[0];
  }, [activeInvestments]);

  const [timeRemaining, setTimeRemaining] = useState('24h 00m 00s');

  useEffect(() => {
    if (!earliestActiveInvestment) {
      setTimeRemaining('--h --m --s');
      return;
    }

    const updateTimer = () => {
      const depTime = earliestActiveInvestment.createdAt?.seconds 
        ? earliestActiveInvestment.createdAt.seconds * 1000 
        : new Date(earliestActiveInvestment.timestamp).getTime() || Date.now();
      
      const elapsedMs = Date.now() - depTime;
      const msInDay = 24 * 60 * 60 * 1000;
      const msPassedInCurrentCycle = elapsedMs % msInDay;
      const msRemaining = msInDay - msPassedInCurrentCycle;

      if (msRemaining <= 0) {
        setTimeRemaining('24h 00m 00s');
      } else {
        const hours = Math.floor(msRemaining / (60 * 60 * 1000));
        const minutes = Math.floor((msRemaining % (60 * 60 * 1000)) / (60 * 1000));
        const seconds = Math.floor((msRemaining % (60 * 1000)) / 1000);
        
        const pad = (num: number) => String(num).padStart(2, '0');
        setTimeRemaining(`${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [earliestActiveInvestment]);

  const nextMilestone = Math.ceil((balance + 1) / 100) * 100;
  const progressPercent = Math.min((balance / nextMilestone) * 100, 100);

  // Compute chronological progression for the Line Chart incorporating all approved ledger items
  const chartData = useMemo(() => {
    const events: { timestamp: number; dateStr: string; amount: number; label: string }[] = [];

    // 1. Referral earnings
    if (logs && logs.length > 0) {
      logs.forEach((log) => {
        const ts = log.createdAt?.seconds 
          ? log.createdAt.seconds * 1000 
          : new Date(log.timestamp).getTime() || 0;
        events.push({
          timestamp: ts,
          dateStr: log.timestamp,
          amount: log.amount !== undefined ? log.amount : 0.05,
          label: 'Referral Sign-up'
        });
      });
    }

    // 2. Approved Deposits & Investment Profits
    if (deposits && deposits.length > 0) {
      deposits
        .filter((d) => d.status === 'approved')
        .forEach((dep) => {
          const depTime = dep.createdAt?.seconds 
            ? dep.createdAt.seconds * 1000 
            : new Date(dep.timestamp).getTime() || 0;
          
          events.push({
            timestamp: depTime,
            dateStr: dep.timestamp,
            amount: dep.amount,
            label: 'Approved Deposit'
          });

          // Generate Daily Profit event payouts for this approved deposit
          const elapsedMs = Date.now() - depTime;
          const elapsedDaysReal = Math.floor(elapsedMs / (24 * 60 * 60 * 1000));
          const totalDays = elapsedDaysReal + virtualDays;

          for (let i = 1; i <= totalDays; i++) {
            let hash = 0;
            const str = (dep.id || String(depTime)) + "_" + i;
            for (let idx = 0; idx < str.length; idx++) {
              hash = str.charCodeAt(idx) + ((hash << 5) - hash);
            }
            const index = Math.abs(hash) % 4;
            const rates = [1.0, 2.0, 0.1, 0.5];
            const dailyPercent = rates[index];
            const dynamicDailyRate = dep.amount * (dailyPercent / 100) * (globalSettings?.yieldMultiplier || 1.0);

            if (dynamicDailyRate > 0) {
              const payoutTime = depTime + i * 24 * 60 * 60 * 1000;
              const payoutDate = new Date(payoutTime);
              events.push({
                timestamp: payoutTime,
                dateStr: payoutDate.toLocaleDateString(),
                amount: dynamicDailyRate,
                label: `Daily Return (+${dynamicDailyRate.toFixed(2)})`
              });
            }
          }
        });
    }

    // 3. Approved Withdrawals
    if (withdrawals && withdrawals.length > 0) {
      withdrawals
        .filter((w) => w.status === 'approved')
        .forEach((wit) => {
          const ts = wit.createdAt?.seconds 
            ? wit.createdAt.seconds * 1000 
            : new Date(wit.timestamp).getTime() || 0;
          events.push({
            timestamp: ts,
            dateStr: wit.timestamp,
            amount: -wit.amount,
            label: 'Approved Withdrawal'
          });
        });
    }

    const signupVal = userProfile?.signupBonus !== undefined ? userProfile.signupBonus : 0.10;

    if (events.length === 0) {
      return [
        { label: 'Start', balance: signupVal },
        { label: 'Today', balance: signupVal }
      ];
    }

    // Sort chronologically
    events.sort((a, b) => a.timestamp - b.timestamp);

    let runningSum = signupVal;
    const points = [{ label: 'Start', balance: signupVal }];

    events.forEach((evt, idx) => {
      runningSum += evt.amount;
      const date = new Date(evt.timestamp);
      const label = isNaN(date.getTime()) 
        ? `${evt.label.slice(0, 5)} #${idx + 1}`
        : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      points.push({
        label,
        balance: runningSum
      });
    });

    return points;
  }, [logs, deposits, withdrawals, virtualDays]);

  // Compute chronological progression of Daily Bonus and Investment Profits over the last 10 days
  const bonusAndProfitChartData = useMemo(() => {
    const dataPoints: {
      date: string;
      bonus: number;
      profit: number;
      cumulativeBonus: number;
      cumulativeProfit: number;
    }[] = [];

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Generate last 10 days
    for (let i = 9; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      dataPoints.push({
        date: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        bonus: 0,
        profit: 0,
        cumulativeBonus: 0,
        cumulativeProfit: 0,
      });
    }

    // Populate Daily Rewards (Bonus check-ins)
    if (dailyRewardLogs && dailyRewardLogs.length > 0) {
      dailyRewardLogs.forEach((log) => {
        const amt = Number(log.amount) || 0;
        const ts = log.createdAt?.seconds 
          ? log.createdAt.seconds * 1000 
          : new Date(log.timestamp).getTime() || 0;
        
        if (!ts) return;
        const logDate = new Date(ts);
        const dayLabel = logDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        
        const pt = dataPoints.find(p => p.date === dayLabel);
        if (pt) {
          pt.bonus += amt;
        }
      });
    }

    // Populate Investment Profits (Staking returns)
    // We scan both active plans (investments) and approved deposits (which act as staking nodes)
    const activeAssets: { id?: string; amount: number; time: number; planId?: string }[] = [];

    // 1. From approved deposits
    if (deposits && deposits.length > 0) {
      deposits
        .filter((d) => d.status === 'approved')
        .forEach((dep) => {
          const depTime = dep.createdAt?.seconds 
            ? dep.createdAt.seconds * 1000 
            : new Date(dep.timestamp).getTime() || 0;
          if (depTime) {
            activeAssets.push({ id: dep.id, amount: dep.amount, time: depTime });
          }
        });
    }

    // 2. From investments (purchased plans)
    if (investments && investments.length > 0) {
      investments
        .filter((inv) => inv.status === 'active')
        .forEach((inv) => {
          const invTime = inv.createdAt?.seconds 
            ? inv.createdAt.seconds * 1000 
            : new Date(inv.timestamp).getTime() || 0;
          if (invTime) {
            activeAssets.push({ id: inv.id, amount: inv.amount, time: invTime, planId: inv.planId });
          }
        });
    }

    // For each calendar day in our chart, calculate the total active investment profit generated on that day
    dataPoints.forEach((pt, dayIdx) => {
      // Find the start date timestamp of this calendar day
      const targetDay = new Date(today.getTime() - (9 - dayIdx) * 24 * 60 * 60 * 1000);
      const targetTime = targetDay.getTime();

      let dailyProfitSum = 0;
      activeAssets.forEach((asset) => {
        // An asset generates profit starting the day after its creation
        if (targetTime > asset.time) {
          const elapsedMs = targetTime - asset.time;
          const dayNumOnTargetDay = Math.floor(elapsedMs / (24 * 60 * 60 * 1000)) + 1;

          let hash = 0;
          const str = (asset.id || String(asset.time)) + "_" + dayNumOnTargetDay;
          for (let idx = 0; idx < str.length; idx++) {
            hash = str.charCodeAt(idx) + ((hash << 5) - hash);
          }
          const index = Math.abs(hash) % 4;
          const normalizedPlanId = (asset.planId || '').toLowerCase().trim();
          const planCap = getPlanCapPercent(normalizedPlanId, asset.amount);
          const baseDailyRatePercent = (planCap * 100) / 30;
          const multiplier = [0.98, 1.02, 0.95, 1.05][index];
          const dailyPercent = baseDailyRatePercent * multiplier;

          dailyProfitSum += asset.amount * (dailyPercent / 100) * (globalSettings?.yieldMultiplier || 1.0);
        }
      });
      pt.profit = dailyProfitSum;
    });

    // Compute cumulative trends over this 10-day period
    let runBonus = userProfile?.signupBonus || 0.10; // Start with the signup bonus as initial seed base
    let runProfit = 0;

    dataPoints.forEach((pt) => {
      runBonus += pt.bonus;
      runProfit += pt.profit;
      pt.cumulativeBonus = runBonus;
      pt.cumulativeProfit = runProfit;
    });

    return dataPoints;
  }, [dailyRewardLogs, deposits, investments, userProfile?.signupBonus]);

  // Determine if there has been high yield / high growth detected (e.g. peak combined daily yield exceeds 0.08 USD)
  const hasHighGrowth = useMemo(() => {
    if (!bonusAndProfitChartData || bonusAndProfitChartData.length === 0) return false;
    const maxDayYield = Math.max(...bonusAndProfitChartData.map(pt => pt.bonus + pt.profit));
    // High Growth threshold: active staking/rewards exceeding 0.08 equivalent base units
    return maxDayYield >= 0.08;
  }, [bonusAndProfitChartData]);

  // Compute Referrals Data for the last 7 days for the new bar chart
  const referralChartData = useMemo(() => {
    const data: { day: string; earnings: number; fullDate: string }[] = [];
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      data.push({
        day: d.toLocaleDateString(undefined, { weekday: 'short' }),
        fullDate: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        earnings: 0
      });
    }

    if (logs && logs.length > 0) {
      logs.forEach((log) => {
        const amount = log.amount !== undefined ? log.amount : 0.05;
        const ts = log.createdAt?.seconds ? log.createdAt.seconds * 1000 : new Date(log.timestamp).getTime() || 0;
        
        const logDate = new Date(ts);
        const logDay = new Date(logDate.getFullYear(), logDate.getMonth(), logDate.getDate());
        
        const diffDays = Math.floor((today.getTime() - logDay.getTime()) / (24 * 60 * 60 * 1000));
        
        if (diffDays >= 0 && diffDays < 7) {
          const index = 6 - diffDays;
          data[index].earnings += amount;
        }
      });
    }
    
    return data;
  }, [logs]);

  const [showBalance, setShowBalance] = useState(true);

  return (
    <div 
      className={`${theme === 'dark' ? 'dark bg-[#08080c] text-[#E5E7EB]' : 'bg-[#FAFCFA] text-slate-800'} w-full max-w-5xl mx-auto md:rounded-[32px] md:border-2 md:border-gray-200/50 dark:md:border-white/5 md:shadow-[0_20px_50px_rgba(0,0,0,0.08)] dark:md:shadow-[0_20px_50px_rgba(0,0,0,0.55)] overflow-visible md:overflow-hidden flex flex-col font-sans relative transition-all duration-300 shadow-sm`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* 📱 TOP HEADER (Redesigned premium style) */}
      <div className="bg-white/85 dark:bg-[#0c0d12]/85 backdrop-blur-md border-b border-gray-150/80 dark:border-white/5 py-4 px-5 flex items-center justify-between shrink-0 sticky top-20 z-40 select-none shadow-sm transition-colors">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => {
              if (activeTab !== 'overview') {
                setActiveTab('overview');
              }
            }}
            className="w-10 h-10 rounded-full border border-gray-200 dark:border-white/10 text-slate-500 dark:text-slate-400 flex items-center justify-center bg-gray-50 dark:bg-white/5 hover:text-emerald-500 hover:border-emerald-500/30 transition-all cursor-pointer active:scale-95"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="text-left">
            <p className="text-[10px] font-bold text-slate-400 dark:text-white/40 uppercase tracking-widest leading-none">Welcome Back</p>
            <h1 className="text-sm font-black text-slate-800 dark:text-white font-sans mt-1 leading-none flex items-center gap-1.5">
              <span>{name || 'User'}</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Notification Bell */}
          <button 
            onClick={() => {
              setShowNotificationModal(true);
              setNotificationsRead(true);
            }}
            className="w-10 h-10 rounded-full border border-gray-200 dark:border-white/10 text-slate-500 dark:text-slate-400 flex items-center justify-center bg-gray-50 dark:bg-white/5 hover:text-emerald-500 hover:border-emerald-500/30 relative transition-all cursor-pointer active:scale-95"
          >
            <Bell className="w-4 h-4" />
            {!notificationsRead && (
              <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-rose-500 border-2 border-white dark:border-[#0c0d12] rounded-full animate-bounce" />
            )}
          </button>

          {/* Volume Control Mute/Unmute */}
          <button 
            onClick={toggleMuted}
            className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
              isMuted 
                ? 'border-gray-200 dark:border-white/10 text-slate-400 bg-gray-50 dark:bg-white/5' 
                : 'border-emerald-500/30 text-emerald-500 bg-emerald-500/5 hover:bg-emerald-500/10'
            }`}
            title={isMuted ? "Enable Audio Feedback" : "Mute Audio Feedback"}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Settings Trigger */}
          <button 
            onClick={() => setActiveTab('settings')}
            className="w-10 h-10 rounded-full border border-gray-200 dark:border-white/10 text-slate-500 dark:text-slate-400 flex items-center justify-center bg-gray-50 dark:bg-white/5 hover:text-emerald-500 hover:border-emerald-500/30 transition-all cursor-pointer active:scale-95"
            title="Profile Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Pull down refresh indicator */}
      <div 
        className="overflow-hidden transition-all duration-200 flex items-center justify-center bg-[#070707]/10 dark:bg-[#070707]/60 border-b border-white/5 relative z-50 text-blue-400 shrink-0"
        style={{ height: pullDistance > 0 || pullStatus === 'refreshing' ? `${Math.max(pullDistance, pullStatus === 'refreshing' ? 40 : 0)}px` : '0px' }}
      >
        <div className="flex items-center gap-2 py-1.5">
          <RefreshCw className={`w-3 h-3 ${pullStatus === 'refreshing' ? 'animate-spin' : ''}`} style={{ transform: pullStatus !== 'refreshing' ? `rotate(${pullDistance * 6}deg)` : undefined }} />
          <span className="text-[8px] uppercase tracking-[0.15em] font-sans font-bold">
            {pullStatus === 'pulling' && 'Pull down to refresh'}
            {pullStatus === 'ready' && 'Release to refresh'}
            {pullStatus === 'refreshing' && 'Refreshing ledger...'}
          </span>
        </div>
      </div>

      {/* SECURITY / SYSTEM LIVE BROADCAST ANNOUNCEMENT LEVEL 1 MARQUEE */}
      {globalSettings?.isAnnouncementActive && globalSettings?.systemAnnouncement && (
        <div className="bg-[#22C55E]/10 border-b border-[#22C55E]/15 px-4 py-2 flex items-center gap-3.5 relative overflow-hidden z-20 shrink-0 font-sans">
          <Sparkles className="w-3.5 h-3.5 text-emerald-500 shrink-0 animate-pulse" />
          <div className="flex-1 overflow-hidden relative">
            <div className="animate-marquee whitespace-nowrap text-[10px] font-bold text-emerald-700 dark:text-emerald-300 tracking-wider">
              {globalSettings.systemAnnouncement}
            </div>
          </div>
        </div>
      )}

      {/* Main middle area of the container */}
      <div className="p-5 space-y-6 pb-28">
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div
              key="overview-tab"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="space-y-6"
            >
              {/* Premium redone Balance Card with Green Gradient */}
              <motion.div
                id="live-wallet-balance-card"
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ y: -3 }}
                className="bg-gradient-to-br from-[#22C55E] to-[#16A34A] rounded-[24px] p-6 text-white relative overflow-hidden shadow-[0_12px_30px_rgba(22,163,74,0.22)] select-none border border-[#22C55E]/30"
              >
                {/* Abstract graphic grid backgrounds inside card */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_60%)] pointer-events-none" />
                <div className="absolute -right-10 -bottom-10 w-44 h-44 rounded-full bg-white/5 blur-xl pointer-events-none" />
                <div className="absolute top-4 right-4 opacity-10">
                  <DollarSign className="w-24 h-24" />
                </div>

                <div className="flex flex-col gap-5 relative z-10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-black uppercase tracking-[0.15em] text-white/80">Available Wallet Balance</span>
                      <span className="px-2 py-0.5 rounded-full bg-white/15 text-[8px] uppercase tracking-wider font-extrabold text-emerald-100">Live Ledger</span>
                    </div>
                    
                    {/* Hide / Show Balance Toggle button */}
                    <button 
                      onClick={() => setShowBalance(!showBalance)}
                      className="p-1.5 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-all bg-transparent border-0 cursor-pointer active:scale-90"
                      title={showBalance ? "Hide Balance" : "Show Balance"}
                    >
                      {showBalance ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  <div className="flex items-baseline gap-2.5">
                    <span className="text-xl font-bold text-emerald-100">{currencySymbol}</span>
                    <h2 className="text-3xl md:text-4xl font-black font-sans tracking-tight">
                      {showBalance ? animatedBalanceDisplay : "••••••"}
                    </h2>
                  </div>

                  {/* Accrued and Matured balances */}
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/15 text-left">
                    <div>
                      <p className="text-[9px] uppercase tracking-wider text-emerald-100/70 font-semibold leading-none">Matured Balance</p>
                      <p className="text-sm font-bold text-white mt-1.5">
                        {currencySymbol}{(maturedBalance * conversionRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] uppercase tracking-wider text-emerald-100/70 font-semibold leading-none">Active Plans</p>
                      <p className="text-sm font-bold text-white mt-1.5 flex items-center justify-end gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-300 animate-ping" />
                        <span>{investments.filter(i => i.status === 'active').length} Active</span>
                      </p>
                    </div>
                  </div>

                  {/* Quick Action Deposit & Withdraw Buttons Inside Balance Card */}
                  <div className="grid grid-cols-2 gap-3.5 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('funding');
                        playSound('new_referral');
                        onAddToast('Redirected to deposit channel.', 'success');
                      }}
                      className="py-3 px-4 rounded-xl bg-white text-[#16A34A] hover:bg-emerald-50 font-black text-xs uppercase tracking-widest transition-all duration-200 text-center cursor-pointer shadow-md shadow-emerald-800/10 border-0 flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-4 h-4 text-[#16A34A] shrink-0" />
                      <span>Deposit</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('funding');
                        playSound('new_referral');
                        onAddToast('Redirected to withdrawal forms.', 'success');
                      }}
                      className="py-3 px-4 rounded-xl bg-emerald-600/35 hover:bg-emerald-600/50 text-white border border-white/20 font-black text-xs uppercase tracking-widest transition-all duration-200 text-center cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <ArrowUpRight className="w-4 h-4 text-white shrink-0" />
                      <span>Withdraw</span>
                    </button>
                  </div>
                </div>
              </motion.div>

              {/* 📊 DUAL STATS GRID (Deposit & Withdrawal Tracker) */}
              <div className="grid grid-cols-2 gap-4">
                {/* 1. Total Approved Deposit Card */}
                <div className="bg-white dark:bg-[#0f1016] border border-gray-150/80 dark:border-white/5 rounded-2xl p-4.5 text-left relative overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">
                  <div className="absolute -top-3 -right-3 text-emerald-500/5 dark:text-emerald-400/5 pointer-events-none">
                    <ArrowDownLeft className="w-16 h-16" />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0">
                      <ArrowDownLeft className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 dark:text-white/30 uppercase tracking-widest">Total Deposit</span>
                  </div>
                  <h3 className="text-lg md:text-xl font-black font-sans tracking-tight text-slate-800 dark:text-white mt-3">
                    {currencySymbol}{(deposits.filter(d => d.status === 'approved').reduce((sum, d) => sum + d.amount, 0) * conversionRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </h3>
                  <p className="text-[8.5px] text-emerald-500 font-medium mt-1.5 flex items-center gap-1">
                    <CheckCircle className="w-2.5 h-2.5 shrink-0" />
                    <span>Instant automatic credit</span>
                  </p>
                </div>

                {/* 2. Total Approved Withdrawal Card */}
                <div className="bg-white dark:bg-[#0f1016] border border-gray-150/80 dark:border-white/5 rounded-2xl p-4.5 text-left relative overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">
                  <div className="absolute -top-3 -right-3 text-rose-500/5 dark:text-rose-400/5 pointer-events-none">
                    <ArrowUpRight className="w-16 h-16" />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center shrink-0">
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 dark:text-white/30 uppercase tracking-widest">Total Withdraw</span>
                  </div>
                  <h3 className="text-lg md:text-xl font-black font-sans tracking-tight text-slate-800 dark:text-white mt-3">
                    {currencySymbol}{(withdrawals.filter(w => w.status === 'approved').reduce((sum, w) => sum + w.amount, 0) * conversionRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </h3>
                  <button 
                    onClick={() => setShowWithdrawalProgressModal(true)}
                    className="text-[8.5px] text-blue-500 hover:text-blue-600 font-bold mt-1.5 flex items-center gap-1 bg-transparent border-0 cursor-pointer p-0 select-none outline-none hover:underline"
                  >
                    <RefreshCw className="w-2.5 h-2.5 shrink-0 animate-spin" />
                    <span>Track progress stepper</span>
                  </button>
                </div>
              </div>

              {/* ⚡ MORE SHORTCUTS (Quick Actions Grid Redesigned) */}
              <div className="space-y-3 text-left">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/30">More Shortcuts</h4>
                  <span className="text-[8px] uppercase tracking-wider bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 px-2 py-0.5 rounded-full text-slate-500 dark:text-white/50">12 shortcuts</span>
                </div>

                <div className="grid grid-cols-4 gap-3">
                  {/* Shortcut 1: Tasks */}
                  <button
                    onClick={() => {
                      setShowTasksModal(true);
                      playSound('new_referral');
                    }}
                    className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-white dark:bg-[#0f1016] border border-gray-150/80 dark:border-white/5 hover:border-emerald-500/20 hover:bg-emerald-500/5 dark:hover:bg-[#22C55E]/5 cursor-pointer transition-all active:scale-95"
                  >
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center">
                      <CheckSquare className="w-5 h-5" />
                    </div>
                    <span className="text-[9.5px] font-bold text-slate-600 dark:text-white/80 leading-none">Tasks</span>
                  </button>

                  {/* Shortcut 2: Deposit */}
                  <button
                    onClick={() => {
                      setActiveTab('funding');
                      setDepositMethodTab('pakistan');
                      playSound('new_referral');
                    }}
                    className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-white dark:bg-[#0f1016] border border-gray-150/80 dark:border-white/5 hover:border-emerald-500/20 hover:bg-emerald-500/5 dark:hover:bg-[#22C55E]/5 cursor-pointer transition-all active:scale-95"
                  >
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-500 flex items-center justify-center">
                      <ArrowDownLeft className="w-5 h-5" />
                    </div>
                    <span className="text-[9.5px] font-bold text-slate-600 dark:text-white/80 leading-none">Deposit</span>
                  </button>

                  {/* Shortcut 3: Withdraw */}
                  <button
                    onClick={() => {
                      setActiveTab('funding');
                      playSound('new_referral');
                    }}
                    className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-white dark:bg-[#0f1016] border border-gray-150/80 dark:border-white/5 hover:border-emerald-500/20 hover:bg-emerald-500/5 dark:hover:bg-[#22C55E]/5 cursor-pointer transition-all active:scale-95"
                  >
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-500 flex items-center justify-center">
                      <ArrowUpRight className="w-5 h-5" />
                    </div>
                    <span className="text-[9.5px] font-bold text-slate-600 dark:text-white/80 leading-none">Withdraw</span>
                  </button>

                  {/* Shortcut 4: Portfolios */}
                  <button
                    onClick={() => {
                      onAddToast('Scroll down to discover and lock investment portfolios below!', 'success');
                    }}
                    className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-white dark:bg-[#0f1016] border border-gray-150/80 dark:border-white/5 hover:border-emerald-500/20 hover:bg-emerald-500/5 dark:hover:bg-[#22C55E]/5 cursor-pointer transition-all active:scale-95"
                  >
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center">
                      <Layers className="w-5 h-5" />
                    </div>
                    <span className="text-[9.5px] font-bold text-slate-600 dark:text-white/80 leading-none">Plans</span>
                  </button>

                  {/* Shortcut 5: History */}
                  <button
                    onClick={() => {
                      setActiveTab('funding');
                      onAddToast('Scroll down to view detailed transaction ledger histories!', 'success');
                    }}
                    className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-white dark:bg-[#0f1016] border border-gray-150/80 dark:border-white/5 hover:border-emerald-500/20 hover:bg-emerald-500/5 dark:hover:bg-[#22C55E]/5 cursor-pointer transition-all active:scale-95"
                  >
                    <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-500 flex items-center justify-center">
                      <Coins className="w-5 h-5" />
                    </div>
                    <span className="text-[9.5px] font-bold text-slate-600 dark:text-white/80 leading-none">History</span>
                  </button>

                  {/* Shortcut 6: Referral */}
                  <button
                    onClick={() => {
                      handleCopy();
                      playSound('new_referral');
                      onAddToast('Referral link copied to clipboard! Share with friends to earn.', 'success');
                    }}
                    className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-white dark:bg-[#0f1016] border border-gray-150/80 dark:border-white/5 hover:border-emerald-500/20 hover:bg-emerald-500/5 dark:hover:bg-[#22C55E]/5 cursor-pointer transition-all active:scale-95"
                  >
                    <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center">
                      <Users className="w-5 h-5" />
                    </div>
                    <span className="text-[9.5px] font-bold text-slate-600 dark:text-white/80 leading-none">Invite</span>
                  </button>



                  {/* Shortcut 8: Lucky Spin */}
                  <button
                    onClick={() => {
                      setShowSpinModal(true);
                      playSound('new_referral');
                    }}
                    className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-white dark:bg-[#0f1016] border border-gray-150/80 dark:border-white/5 hover:border-emerald-500/20 hover:bg-emerald-500/5 dark:hover:bg-[#22C55E]/5 cursor-pointer transition-all active:scale-95"
                  >
                    <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-500 flex items-center justify-center">
                      <Sparkles className="w-5 h-5 animate-pulse" />
                    </div>
                    <span className="text-[9.5px] font-bold text-slate-600 dark:text-white/80 leading-none">Lucky Spin</span>
                  </button>

                  {/* Shortcut 9: Support */}
                  <button
                    onClick={() => {
                      window.open('https://t.me/apexcapital_official', '_blank');
                      playSound('new_referral');
                      onAddToast('Redirecting to MoneyMind Space support helpline...', 'success');
                    }}
                    className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-white dark:bg-[#0f1016] border border-gray-150/80 dark:border-white/5 hover:border-emerald-500/20 hover:bg-emerald-500/5 dark:hover:bg-[#22C55E]/5 cursor-pointer transition-all active:scale-95"
                  >
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-500 flex items-center justify-center">
                      <HelpCircle className="w-5 h-5" />
                    </div>
                    <span className="text-[9.5px] font-bold text-slate-600 dark:text-white/80 leading-none">Help Desk</span>
                  </button>

                  {/* Shortcut 10: WhatsApp */}
                  <button
                    onClick={() => {
                      window.open('https://whatsapp.com/channel/0029VbAa01YEKyZNN2FRqe1v', '_blank');
                      playSound('new_referral');
                      onAddToast('Redirecting to WhatsApp Channel...', 'success');
                    }}
                    className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-white dark:bg-[#0f1016] border border-gray-150/80 dark:border-white/5 hover:border-emerald-500/20 hover:bg-emerald-500/5 dark:hover:bg-[#22C55E]/5 cursor-pointer transition-all active:scale-95"
                  >
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center">
                      <MessageCircle className="w-5 h-5" />
                    </div>
                    <span className="text-[9.5px] font-bold text-slate-600 dark:text-white/80 leading-none">WhatsApp</span>
                  </button>

                  {/* Shortcut 10: Wallet */}
                  <button
                    onClick={() => {
                      setActiveTab('funding');
                      playSound('new_referral');
                    }}
                    className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-white dark:bg-[#0f1016] border border-gray-150/80 dark:border-white/5 hover:border-emerald-500/20 hover:bg-emerald-500/5 dark:hover:bg-[#22C55E]/5 cursor-pointer transition-all active:scale-95"
                  >
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 flex items-center justify-center">
                      <Wallet className="w-5 h-5" />
                    </div>
                    <span className="text-[9.5px] font-bold text-slate-600 dark:text-white/80 leading-none">Wallet</span>
                  </button>

                  {/* Shortcut 11: Leaderboard */}
                  <button
                    onClick={() => {
                      setShowLeaderboardModal(true);
                      playSound('new_referral');
                    }}
                    className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-white dark:bg-[#0f1016] border border-gray-150/80 dark:border-white/5 hover:border-emerald-500/20 hover:bg-emerald-500/5 dark:hover:bg-[#22C55E]/5 cursor-pointer transition-all active:scale-95"
                  >
                    <div className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 flex items-center justify-center">
                      <Award className="w-5 h-5" />
                    </div>
                    <span className="text-[9.5px] font-bold text-slate-600 dark:text-white/80 leading-none">Trophy</span>
                  </button>

                  {/* Shortcut 12: Gift Card */}
                  <button
                    onClick={() => {
                      setShowGiftModal(true);
                      playSound('new_referral');
                    }}
                    className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-white dark:bg-[#0f1016] border border-gray-150/80 dark:border-white/5 hover:border-emerald-500/20 hover:bg-emerald-500/5 dark:hover:bg-[#22C55E]/5 cursor-pointer transition-all active:scale-95"
                  >
                    <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center">
                      <Zap className="w-5 h-5" />
                    </div>
                    <span className="text-[9.5px] font-bold text-slate-600 dark:text-white/80 leading-none">Gift Voucher</span>
                  </button>
                </div>
              </div>

              {/* 🏆 PREMIUM CAMPAIGNS (Banners & Featured VIP plans) */}
              <div className="space-y-3.5 text-left">
                <h4 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/30">Premium Yield Portfolios</h4>
              </div>

              <PlanMatrix
                balance={balance}
                investments={investments}
                onCreatePlan={onCreatePlan!}
                onCancelPlan={onCancelPlan!}
                currencySymbol={currencySymbol}
                conversionRate={conversionRate}
                theme={theme}
              />

              {/* Yield & Reward Analytics: Daily Check-In Bonus vs Staking Dividends Trend */}
              <div className="bg-white/[0.02] rounded-2xl border border-white/5 p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-[11px] uppercase tracking-wider font-sans font-semibold text-white/40">Yield & Reward Analytics</h4>
                      {hasHighGrowth && (
                        <span 
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_12px_rgba(16,185,129,0.15)] animate-pulse"
                          title={`Peak daily yield has exceeded ${currencySymbol}${(0.08 * conversionRate).toFixed(2)}`}
                        >
                          <TrendingUp className="w-2.5 h-2.5 animate-bounce" /> High Growth Detected
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-white/30 leading-none">Daily check-in bonuses vs. active staking dividends over time</p>
                  </div>
                  <div className="flex items-center gap-3 self-start sm:self-center">
                    <span className="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider text-blue-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                      Bonus Trend
                    </span>
                    <span className="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider text-emerald-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Staking Yield
                    </span>
                  </div>
                </div>
                
                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={bonusAndProfitChartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                      <XAxis 
                        dataKey="date" 
                        stroke="rgba(255,255,255,0.2)" 
                        fontSize={9} 
                        tickLine={false} 
                        axisLine={false}
                        dy={8}
                      />
                      <YAxis 
                        stroke="rgba(255,255,255,0.2)" 
                        fontSize={9} 
                        tickLine={false} 
                        axisLine={false}
                        tickFormatter={(val) => `${currencySymbol.trim()}${(val * conversionRate).toFixed(1)}`}
                      />
                      <Tooltip 
                        cursor={{ stroke: 'rgba(215, 175, 52, 0.1)', strokeWidth: 1 }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const bonusAccum = Number(payload[0]?.value) || 0;
                            const profitAccum = Number(payload[1]?.value) || 0;
                            const d = payload[0]?.payload || {};
                            return (
                              <div className="bg-[#121212] border border-white/10 p-3 rounded-xl shadow-2xl font-sans text-xs space-y-1.5 min-w-[170px]">
                                <p className="text-white/40 font-bold uppercase tracking-widest text-[8px] mb-1">
                                  {d.date} Performance
                                </p>
                                <div className="flex items-center justify-between gap-4">
                                  <span className="text-white/60 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600" /> Daily Bonus:
                                  </span>
                                  <span className="text-blue-400 font-mono font-bold">
                                    {currencySymbol}{(d.bonus * conversionRate).toFixed(2)}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                  <span className="text-white/60 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Staking Yield:
                                  </span>
                                  <span className="text-emerald-400 font-mono font-bold">
                                    {currencySymbol}{(d.profit * conversionRate).toFixed(2)}
                                  </span>
                                </div>
                                <div className="border-t border-white/5 pt-1.5 space-y-1">
                                  <div className="flex items-center justify-between gap-4 text-[10px]">
                                    <span className="text-white/40 font-semibold">Bonus Total:</span>
                                    <span className="text-blue-400 font-bold font-mono">
                                      {currencySymbol}{(bonusAccum * conversionRate).toFixed(2)}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between gap-4 text-[10px]">
                                    <span className="text-white/40 font-semibold">Staking Total:</span>
                                    <span className="text-emerald-400 font-bold font-mono">
                                      {currencySymbol}{(profitAccum * conversionRate).toFixed(2)}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between gap-4 text-[10px] border-t border-white/5 pt-1">
                                    <span className="text-white/60 font-semibold">Aggregate Profit:</span>
                                    <span className="text-white font-bold font-mono">
                                      {currencySymbol}{((bonusAccum + profitAccum) * conversionRate).toFixed(2)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                        wrapperStyle={{ outline: 'none' }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="cumulativeBonus" 
                        name="Bonus Rewards"
                        stroke="#D4AF37" 
                        strokeWidth={2}
                        dot={{ r: 2.5, stroke: '#111111', strokeWidth: 1, fill: '#D4AF37' }}
                        activeDot={{ r: 4.5, stroke: '#111111', strokeWidth: 1.5, fill: '#D4AF37' }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="cumulativeProfit" 
                        name="Staking Profits"
                        stroke="#10b981" 
                        strokeWidth={2}
                        dot={{ r: 2.5, stroke: '#111111', strokeWidth: 1, fill: '#10b981' }}
                        activeDot={{ r: 4.5, stroke: '#111111', strokeWidth: 1.5, fill: '#10b981' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* 7-Day Referral Earnings Bar Chart */}
              <div className="bg-white/[0.02] rounded-2xl border border-white/5 p-5 space-y-4">
                <div className="flex items-center justify-between text-[11px] uppercase tracking-wider font-sans">
                  <span className="font-semibold text-white/40">7-Day Referral Distribution</span>
                  <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    Referral Volume
                  </span>
                </div>
                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={referralChartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                      <XAxis 
                        dataKey="day" 
                        stroke="rgba(255,255,255,0.2)" 
                        fontSize={9} 
                        tickLine={false} 
                        axisLine={false}
                        dy={8}
                      />
                      <YAxis 
                        stroke="rgba(255,255,255,0.2)" 
                        fontSize={9} 
                        tickLine={false} 
                        axisLine={false}
                        tickFormatter={(val) => `${currencySymbol.trim()}${(val * conversionRate).toFixed(0)}`}
                      />
                      <Tooltip 
                        cursor={{ fill: 'rgba(255, 255, 255, 0.02)' }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-[#161616] border border-white/10 p-2.5 rounded-lg shadow-xl font-sans">
                                <p className="text-white/40 font-semibold mb-1 uppercase tracking-widest text-[8px]">
                                  {payload[0].payload.fullDate}
                                </p>
                                <p className="text-emerald-400 font-bold font-mono text-xs">
                                  Referrals: {currencySymbol}{Number(Number(payload[0].value) * conversionRate).toFixed(2)}
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                        wrapperStyle={{ outline: 'none' }}
                      />
                      <Bar 
                        dataKey="earnings" 
                        fill="#10b981" 
                        radius={[4, 4, 0, 0]} 
                        barSize={20}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Milestone Gamification Progress */}
              <div className="bg-white/[0.02] rounded-2xl border border-white/5 p-5 space-y-2.5">
                <div className="flex items-center justify-between text-[11px] uppercase tracking-wider font-sans">
                  <span className="font-semibold text-white/40">Target Reward Milestone</span>
                  <span className={`font-bold transition-all duration-300 ${
                    flashType === 'up'
                      ? 'text-emerald-400'
                      : flashType === 'down'
                      ? 'text-rose-400'
                      : 'text-blue-400'
                  }`}>{currencySymbol}<motion.span key={currency}>{animatedBalanceDisplay}</motion.span> / {currencySymbol}{(nextMilestone * conversionRate).toFixed(2)}</span>
                </div>
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ease-out ${
                      flashType === 'up'
                        ? 'bg-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.5)]'
                        : flashType === 'down'
                        ? 'bg-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.5)]'
                        : 'bg-blue-600 shadow-[0_0_8px_rgba(59,130,246,0.4)]'
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className="flex justify-between items-center text-[9px] text-white/30 uppercase tracking-[0.15em] pt-0.5">
                  <span>Diamond tier progress</span>
                  <span>Next milestone at {currencySymbol}{(nextMilestone * conversionRate).toFixed(0)}</span>
                </div>
              </div>



              {/* Direct Referral Link Copy Area */}
              <div className="space-y-3 pt-2">
                <label className="block text-[10px] font-bold text-white/40 uppercase tracking-[0.2em]">
                  Your Personal Direct Referral Link
                </label>
                
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <div className="flex-1 bg-[#0A0A0A] border border-white/10 rounded-2xl px-5 py-3.5 text-sm text-blue-400 font-mono tracking-wider overflow-x-auto whitespace-nowrap scrollbar-none flex items-center justify-between gap-3">
                    <span>{referralLink}</span>
                    <AnimatePresence>
                      {copied && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.5, x: 5 }}
                          animate={{ opacity: 1, scale: 1, x: 0 }}
                          exit={{ opacity: 0, scale: 0.5, x: 5 }}
                          className="flex items-center gap-1 text-emerald-400 shrink-0 select-none pb-0.5"
                        >
                          <Check className="w-4 h-4 animate-bounce" />
                          <span className="text-[9px] font-black uppercase tracking-wider font-sans">Copied</span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  
                  <button
                    onClick={handleCopy}
                    className={`px-5 py-3.5 rounded-2xl border flex items-center justify-center gap-2 font-bold text-xs uppercase tracking-wider transition-all duration-200 outline-none cursor-pointer shrink-0 ${
                      copied 
                        ? 'bg-blue-600/10 border-blue-500/30 text-blue-400' 
                        : 'bg-white/5 border-white/10 hover:bg-white/10 text-white hover:border-white/20 active:scale-[0.98]'
                    }`}
                    title="Copy referral link to clipboard"
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      {copied ? (
                        <motion.div
                          key="checked"
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.8, opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          className="flex items-center gap-1.5"
                        >
                          <Check className="w-4 h-4" />
                          <span>Copied!</span>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="copy"
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.8, opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          className="flex items-center gap-1.5"
                        >
                          <Copy className="w-4 h-4" />
                          <span>Copy Link</span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </button>
                </div>

                <div className="pt-1.5 flex flex-col sm:flex-row items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span className="text-[9px] text-white/30 uppercase tracking-[0.2em] font-semibold">Live Cloud Connection Active</span>
                  </div>
                  <span className="text-[9px] text-white/20 uppercase tracking-widest font-semibold">Onboard new partners in real-time</span>
                </div>
              </div>

              {/* Premium Official Telegram Community & Public Group Card */}
              <div className="bg-[#0D0D0C] border-2 border-blue-500/35 rounded-2xl p-6 relative overflow-hidden mt-6 transition-all hover:border-blue-500/65 shadow-[0_0_20px_rgba(59,130,246,0.05)]">
                {/* Premium gold & telegram blue decorative gradients */}
                <div className="absolute top-0 right-0 w-44 h-44 bg-gradient-to-br from-[#24A1DE]/15 to-blue-400/10 blur-3xl pointer-events-none" />
                <div className="absolute top-2 right-2 text-[#24A1DE]/5 font-black text-6xl select-none uppercase tracking-widest font-serif">
                  TG
                </div>

                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
                  <div className="space-y-3 max-w-xl text-left">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#24A1DE]/10 border border-[#24A1DE]/25 text-[#24A1DE] text-[8.5px] uppercase font-black tracking-wider">
                        💬 Public Group B
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-600/15 border border-blue-500/25 text-blue-400 text-[8.5px] uppercase font-black tracking-wider">
                        Official Community
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-white tracking-wide">
                      Join Our Global Telegram Community Channel
                    </h3>
                    
                    <p className="text-xs text-white/70 leading-relaxed">
                      Join our official community for daily market insights and platform updates.
                    </p>

                    {/* Highly convincing community benefits checklist */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1.5 text-[11px] text-white/50">
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-400 font-bold">✓</span>
                        <span>Receive instant staking & deposit event alerts</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-400 font-bold">✓</span>
                        <span>Share payment payout logs and withdrawal checks</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-400 font-bold">✓</span>
                        <span>Unlock special Telegram exclusive promo codes</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-400 font-bold">✓</span>
                        <span>Connect live with VIP partners & direct assistance</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2.5 shrink-0 w-full lg:w-auto">
                    <a
                      href="https://t.me/apexcapital_official"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-[#24A1DE] via-[#229ED9] to-[#24A1DE] text-white font-black text-xs uppercase tracking-widest hover:brightness-110 active:scale-[0.98] transition-all duration-200 shadow-md shadow-[#24A1DE]/20 text-center cursor-pointer"
                    >
                      <span>Join Official Group</span>
                      <span className="font-mono text-[9px] bg-slate-950/20 px-1.5 py-0.5 rounded">Group B</span>
                    </a>
                    
                    <p className="text-[8.5px] text-white/35 font-mono text-center">
                      Secure Communication Channel
                    </p>
                  </div>
                </div>
              </div>

            </motion.div>
          )}

          {activeTab === 'funding' && (
            <motion.div
              key="funding-tab"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="space-y-8"
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 1. DEPOSIT PORTAL - UPGRADED GLASSMORPHISM CARD WITH MULTI-RAIL PAKISTAN & CRYPTO SUPPORT */}
                <div 
                  id="deposit-section" 
                  className={`relative overflow-hidden rounded-3xl bg-gradient-to-b ${
                    theme === 'dark' 
                      ? depositMethodTab === 'pakistan' 
                        ? 'from-[#031d10] via-[#010905] to-black border-2 border-emerald-500/40 hover:border-emerald-500/70 shadow-[0_0_40px_rgba(16,185,129,0.15)] shadow-emerald-500/10' 
                        : 'from-[#0B0B0B] via-[#050505] to-black border-2 border-blue-500/45 hover:border-emerald-500/60 shadow-[0_0_40px_rgba(59,130,246,0.12)]'
                      : depositMethodTab === 'pakistan'
                        ? 'from-emerald-50/30 via-white to-emerald-50/10 border-2 border-emerald-500/20 hover:border-emerald-500/40 shadow-[0_12px_45px_rgba(16,185,129,0.04)] shadow-emerald-500/5'
                        : 'from-white via-slate-50 to-white border-2 border-slate-200 hover:border-slate-300 shadow-[0_12px_45px_rgba(0,0,0,0.03)]'
                  } hover:shadow-[0_0_55px_rgba(16,185,129,0.18)] transition-all duration-500 p-6 md:p-8 space-y-7 scroll-mt-24 backdrop-blur-xl`}
                >
                  {/* Premium color overlay gradients */}
                  <div className={`absolute top-0 right-0 w-72 h-72 bg-gradient-to-br ${depositMethodTab === 'pakistan' ? 'from-emerald-500/10 to-transparent' : 'from-blue-600/6 via-[#10B981]/3 to-transparent'} blur-3xl pointer-events-none`} />
                  <div className="absolute -bottom-10 -left-10 w-44 h-44 bg-emerald-500/5 blur-3xl pointer-events-none" />

                  {/* Portal Header */}
                  <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b ${theme === 'dark' ? 'border-white/5' : 'border-slate-200/60'} pb-4`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${
                        theme === 'dark' 
                          ? depositMethodTab === 'pakistan' 
                            ? 'from-emerald-500/25 to-black border border-emerald-500/40' 
                            : 'from-blue-600/20 to-black border border-blue-500/40'
                          : depositMethodTab === 'pakistan'
                            ? 'from-emerald-500/10 to-white border border-emerald-500/20 shadow-sm'
                            : 'from-blue-50 to-white border border-blue-200 shadow-sm'
                      } flex items-center justify-center ring-1 ring-white/5`}>
                        <span className="text-xl">{depositMethodTab === 'pakistan' ? '🇵🇰' : '💳'}</span>
                      </div>
                      <div>
                        <h3 className={`text-sm font-black uppercase tracking-widest ${theme === 'dark' ? 'text-white' : 'text-slate-800'} leading-none`}>
                          {depositMethodTab === 'pakistan' ? 'Pakistan Deposit Center' : 'Deposit Portal'}
                        </h3>
                        <p className={`text-[8.5px] ${depositMethodTab === 'pakistan' ? 'text-emerald-500 font-black' : 'text-blue-500'} uppercase tracking-widest mt-1.5 font-mono font-bold animate-pulse`}>
                          {depositMethodTab === 'pakistan' ? 'PKR local rails active' : 'Crypto protocol active'}
                        </p>
                      </div>
                    </div>
                    
                    <span className={`self-start sm:self-auto text-[8.5px] ${depositMethodTab === 'pakistan' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30' : 'bg-[#10B981]/10 text-emerald-600 border border-emerald-500/30'} px-3 py-1.5 rounded-full uppercase tracking-widest font-black flex items-center gap-2`}>
                      <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span>
                      Verified Secure Core
                    </span>
                  </div>

                  {/* Live Available Balance Block / Description */}
                  {depositMethodTab === 'pakistan' ? (
                    <div className={`bg-gradient-to-r ${theme === 'dark' ? 'from-emerald-950/20 via-white/[0.01]' : 'from-emerald-50 via-white'} to-transparent p-5 rounded-2xl border ${theme === 'dark' ? 'border-white/5' : 'border-emerald-500/10'} relative`}>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#10B981] mb-2 flex items-center gap-1.5">
                        <span>🇵🇰 Instantly Secure Local Route</span>
                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
                      </p>
                      <p className={`text-[11.5px] ${theme === 'dark' ? 'text-white/80' : 'text-slate-600'} leading-relaxed font-sans`}>
                        Add funds to your account instantly and securely using available payment methods in Pakistan.
                      </p>
                    </div>
                  ) : (
                    <div className={`bg-gradient-to-r ${theme === 'dark' ? 'from-white/[0.01] via-white/[0.02]' : 'from-slate-50 via-white'} to-transparent p-5 rounded-2xl border ${theme === 'dark' ? 'border-white/5' : 'border-slate-200'} relative`}>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500 mb-2 flex items-center gap-1.5">
                        <span>💎 Official Smart Contract Node</span>
                        <span className="w-1.5 h-1.5 bg-blue-600 rounded-full"></span>
                      </p>
                      <div className="flex items-baseline gap-2">
                        <span className={`text-2xl font-mono font-black ${theme === 'dark' ? 'text-white' : 'text-slate-800'} tracking-tight`}>
                          100% Instant
                        </span>
                        <span className={`text-xs ${theme === 'dark' ? 'text-white/40' : 'text-slate-400'} uppercase font-mono tracking-wider`}>
                          Auto-Credited Funds
                        </span>
                      </div>
                      <p className="text-[9.5px] text-emerald-600 mt-2 flex items-center gap-1 font-semibold">
                        <span>✅ Audited deposit addresses connected to our automated processing ledger.</span>
                      </p>
                    </div>
                  )}

                  {/* Custom Navigation Tab Toggle Bar */}
                  <div className={`${theme === 'dark' ? 'bg-slate-950/60 border-white/5 shadow-black' : 'bg-slate-100 border-slate-200/80'} border p-1 rounded-xl grid grid-cols-2 gap-1.5 shadow-inner`}>
                    <button
                      type="button"
                      onClick={() => {
                        setDepositMethodTab('pakistan');
                        setPkDepError('');
                        setPkDepSuccess('');
                      }}
                      className={`py-2 px-3 rounded-lg text-[9.5px] font-black uppercase tracking-wider transition-all duration-200 cursor-pointer text-center ${
                        depositMethodTab === 'pakistan'
                          ? theme === 'dark'
                            ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 shadow-sm'
                            : 'bg-emerald-600 text-white border border-emerald-700 shadow-md'
                          : theme === 'dark'
                            ? 'text-white/40 hover:text-white/70 border border-transparent'
                            : 'text-slate-500 hover:text-slate-800 border border-transparent'
                      }`}
                    >
                      🇵🇰 Pakistan Center
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDepositMethodTab('crypto');
                        setDepError('');
                        setDepSuccess('');
                      }}
                      className={`py-2 px-3 rounded-lg text-[9.5px] font-black uppercase tracking-wider transition-all duration-200 cursor-pointer text-center ${
                        depositMethodTab === 'crypto'
                          ? theme === 'dark'
                            ? 'bg-blue-600/15 text-blue-400 border border-blue-500/25 shadow-sm'
                            : 'bg-emerald-600 text-white border border-emerald-700 shadow-md'
                          : theme === 'dark'
                            ? 'text-white/40 hover:text-white/70 border border-transparent'
                            : 'text-slate-500 hover:text-slate-800 border border-transparent'
                      }`}
                    >
                      🌐 Crypto Deposits
                    </button>
                  </div>

                  {/* Divider */}
                  <div className={`w-full h-[1px] bg-gradient-to-r from-transparent ${depositMethodTab === 'pakistan' ? 'via-emerald-500/30' : 'via-[#D4AF37]/30'} to-transparent my-1`} />

                  {/* SUBTAB 1: PAKISTAN DEPOSIT PORTAL */}
                  {depositMethodTab === 'pakistan' && (
                    <motion.div
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4 }}
                      className="space-y-6"
                    >
                      {/* Available Deposit Method Title */}
                      <div className="space-y-2.5 text-left">
                        <label className="block text-[9px] font-black text-white/50 uppercase tracking-widest">Available Deposit Methods (Select One)</label>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {/* Easypaisa */}
                          <div
                            className={`p-3.5 rounded-xl flex items-center justify-between select-none cursor-pointer text-left border-2 bg-emerald-950/25 border-emerald-500`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-lg">✅</span>
                              <div>
                                <p className="font-bold text-white leading-tight">Easypaisa</p>
                                <p className="text-[8px] text-emerald-400 uppercase tracking-widest font-extrabold mt-0.5">Active</p>
                              </div>
                            </div>
                            <span className="text-[8px] bg-white/10 text-white rounded border border-white/20 py-0.5 px-1.5 uppercase font-semibold">PKR</span>
                          </div>

                          {/* JazzCash */}
                          <div className="p-3.5 rounded-xl bg-slate-950/40 border border-white/5 opacity-60 select-none text-left flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">🚧</span>
                              <div>
                                <p className="font-bold text-white/70 leading-tight">JazzCash</p>
                                <p className="text-[8.5px] text-amber-500 uppercase tracking-widest font-extrabold mt-0.5">Soon</p>
                              </div>
                            </div>
                            <span className="text-[8px] border border-white/10 text-white/40 rounded py-0.5 px-1.5 uppercase font-semibold">PKR</span>
                          </div>

                          {/* SadaPay */}
                          <div className="p-3.5 rounded-xl bg-slate-950/40 border border-white/5 opacity-60 select-none text-left flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">🚧</span>
                              <div>
                                <p className="font-bold text-white/70 leading-tight">SadaPay</p>
                                <p className="text-[8.5px] text-amber-500 uppercase tracking-widest font-extrabold mt-0.5">Soon</p>
                              </div>
                            </div>
                            <span className="text-[8px] border border-white/10 text-white/40 rounded py-0.5 px-1.5 uppercase font-semibold">PKR</span>
                          </div>

                          {/* NayaPay */}
                          <div className="p-3.5 rounded-xl bg-slate-950/40 border border-white/5 opacity-60 select-none text-left flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">🚧</span>
                              <div>
                                <p className="font-bold text-white/70 leading-tight">NayaPay</p>
                                <p className="text-[8.5px] text-amber-500 uppercase tracking-widest font-extrabold mt-0.5">Soon</p>
                              </div>
                            </div>
                            <span className="text-[8px] border border-white/10 text-white/40 rounded py-0.5 px-1.5 uppercase font-semibold">PKR</span>
                          </div>

                          {/* Bank Transfer */}
                          <div className="p-3.5 rounded-xl bg-slate-950/40 border border-white/5 col-span-2 opacity-60 select-none text-left flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">🚧</span>
                              <div>
                                <p className="font-bold text-white/70 leading-tight">Bank Transfer</p>
                                <p className="text-[8.5px] text-amber-500 uppercase tracking-widest font-extrabold mt-0.5">Soon</p>
                              </div>
                            </div>
                            <span className="text-[8px] border border-white/10 text-white/40 rounded py-0.5 px-1.5 uppercase font-semibold">Local Bank</span>
                          </div>
                        </div>
                      </div>

                      {/* Display platform Easypaisa account number */}
                      <div className="bg-slate-950/60 border border-emerald-500/20 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-left relative overflow-hidden">
                        <div className="space-y-1 z-10">
                          <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Easypaisa Number</p>
                          <h5 className="text-[15px] font-mono font-black text-white tracking-widest">03435319202</h5>
                        </div>
                        <button
                          type="button"
                          onClick={handleCopyPkDepNumber}
                          className="w-full sm:w-auto px-4 py-2 shrink-0 text-[10px] tracking-widest uppercase font-black text-white bg-emerald-600 hover:bg-emerald-500 border-0 rounded-xl transition-all cursor-pointer font-sans z-10 shadow-lg shadow-emerald-700/20"
                        >
                          {copiedPkDepNumber ? 'COPIED ✅' : 'COPY NUMBER 📋'}
                        </button>
                      </div>

                      {/* Notice Box */}
                      <div className="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/15 text-left text-xs leading-relaxed text-emerald-300">
                        📢 We are currently negotiating with payment agents in Pakistan to provide additional deposit options. More deposit methods will be available soon.
                      </div>

                      {/* Pakistan submission Form */}
                      <form onSubmit={handlePkDepositSubmit} className="space-y-4.5 text-left">
                        {/* Amount Box */}
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm">💵</span>
                            <label className="block text-[9px] font-black text-white/70 uppercase tracking-widest">Deposit Amount ({currency})</label>
                          </div>
                          <input
                            type="number"
                            placeholder={`Minimum ${currencySymbol}${Math.ceil(5 * conversionRate)}`}
                            value={pkDepAmount}
                            onChange={(e) => setPkDepAmount(e.target.value)}
                            className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-3.5 text-xs text-white placeholder-white/25 outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/20 transition-all shadow-inner shadow-black"
                            min="1"
                            step="any"
                          />
                          <p className="text-[9px] text-[#10B981] font-mono tracking-wider">
                            {currency === 'USD' ? (
                              `Approximate equivalent: ₨ ${(pkDepAmount ? parseFloat(pkDepAmount) * 280 : 1400).toFixed(2)} PKR`
                            ) : (
                              `Approximate equivalent: $ ${(pkDepAmount ? parseFloat(pkDepAmount) / conversionRate : 5).toFixed(2)} USD`
                            )}
                          </p>
                        </div>

                        {/* Your Sender Mobile/Account Number */}
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm">📱</span>
                            <label className="block text-[9px] font-black text-white/70 uppercase tracking-widest">Your Sender Easypaisa Account Number</label>
                          </div>
                          <input
                            type="text"
                            placeholder="e.g. 03123456789"
                            value={pkDepSenderNumber}
                            onChange={(e) => setPkDepSenderNumber(e.target.value)}
                            className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-3.5 text-xs text-white font-mono placeholder-white/25 outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/20 transition-all shadow-inner shadow-black"
                          />
                        </div>

                        {/* Your Sender Account Title / Name */}
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm">👤</span>
                            <label className="block text-[9px] font-black text-white/70 uppercase tracking-widest">Your Sender Account Title / Holder Name</label>
                          </div>
                          <input
                            type="text"
                            placeholder="e.g. your name here"
                            value={pkDepSenderName}
                            onChange={(e) => setPkDepSenderName(e.target.value)}
                            className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-3.5 text-xs text-white placeholder-white/25 outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/20 transition-all shadow-inner shadow-black"
                          />
                        </div>

                        {/* TXID / Ref receipt Number */}
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs">🔑</span>
                            <label className="block text-[9px] font-black text-white/70 uppercase tracking-widest">Transaction ID (TID) / Reference Number</label>
                          </div>
                          <input
                            type="text"
                            placeholder="e.g. 37829471928"
                            value={pkDepTxid}
                            onChange={(e) => setPkDepTxid(e.target.value)}
                            className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-3.5 text-xs text-white placeholder-white/25 outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/20 transition-all shadow-inner shadow-black"
                          />
                        </div>

                        {/* Payment Screenshot */}
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs">📸</span>
                            <label className="block text-[9px] font-black text-white/70 uppercase tracking-widest">Payment Screenshot</label>
                          </div>
                          {pkDepScreenshot ? (
                            <div className="relative rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-2 flex flex-col items-center justify-center gap-3">
                               <div className="relative inline-block">
                                 <img src={pkDepScreenshot} alt="Screenshot" className="max-h-32 object-contain rounded-lg border border-white/10" />
                                 <div className="absolute top-2 right-2 bg-emerald-500 text-white text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded shadow-md border border-emerald-400 flex items-center gap-1">
                                   <CheckCircle className="w-3 h-3" />
                                   Attached
                                 </div>
                               </div>
                               <button 
                                 type="button" 
                                 onClick={() => setPkDepScreenshot('')}
                                 className="text-[10px] text-red-400 font-bold hover:text-red-300 transition-colors bg-red-400/10 px-3 py-1.5 rounded-lg"
                               >
                                 Remove Screenshot
                               </button>
                            </div>
                          ) : (
                            <label className="flex flex-col items-center justify-center w-full h-24 bg-slate-950/80 border border-white/10 border-dashed rounded-xl cursor-pointer hover:bg-white/5 hover:border-emerald-500/50 transition-all group shadow-inner shadow-black">
                              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                <Upload className="w-5 h-5 text-white/40 mb-2 group-hover:text-emerald-500/70 transition-colors" />
                                <p className="text-[10px] text-white/50 uppercase tracking-wider font-bold">
                                  Click to upload payment receipt
                                </p>
                              </div>
                              <input
                                type="file"
                                className="hidden"
                                accept="image/*"
                                onChange={(e) => handleScreenshotUpload(e, setPkDepScreenshot, setPkDepError)}
                              />
                            </label>
                          )}
                        </div>

                        {/* Important Notice Box */}
                        <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/15 text-left text-xs leading-relaxed text-amber-300 space-y-1.5">
                          <p className="font-extrabold flex items-center gap-1 text-amber-400">⚠️ IMPORTANT NOTICE</p>
                          <p>To ensure secure transactions and prevent fraud, all deposit payments are manually verified before being added to your account. Please send payment to the correct details and upload proof if required. Processing may take 2 minutes to 2 hours after verification.</p>
                        </div>

                        {/* Deposit Rules */}
                        <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-left space-y-2 text-xs">
                          <p className="font-black text-white uppercase tracking-wider text-[9px] text-[#10B981]">🇵🇰 Deposit Rules & requirements</p>
                          <ul className="space-y-1 text-white/70 list-disc list-inside">
                            <li>Minimum Deposit: {currencySymbol}{Math.ceil(5 * conversionRate)}</li>
                            <li>Processing Time: 2 Minutes to 2 Hours</li>
                            <li>One deposit request at a time</li>
                            <li>Always keep payment proof (screenshot/receipt)</li>
                          </ul>
                        </div>

                        {/* Alerts */}
                        {pkDepError && (
                          <p className="text-[10px] font-semibold text-rose-500 leading-relaxed font-mono flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-lg">
                            <span>{pkDepError}</span>
                          </p>
                        )}
                        {pkDepSuccess && (
                          <p className="text-[10.5px] font-extrabold text-[#10B981] leading-relaxed font-mono flex items-center gap-1.5 bg-[#10B981]/10 border border-[#10B981]/20 p-2.5 rounded-lg select-all">
                            <span>{pkDepSuccess}</span>
                          </p>
                        )}

                        <button
                          type="submit"
                          disabled={submitting}
                          className="relative overflow-hidden w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-600 text-white shadow-[0_0_25px_rgba(16,185,129,0.35)] hover:shadow-[0_0_45px_rgba(16,185,129,0.6)] active:scale-[0.98] transition-all duration-500 font-extrabold text-xs uppercase tracking-widest cursor-pointer disabled:opacity-40 border-0 text-center flex items-center justify-center gap-2"
                        >
                          {submitting ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin text-white" />
                              <span>Processing Deposit...</span>
                            </>
                          ) : (
                            <>
                              <span>💰 Deposit Now</span>
                            </>
                          )}
                        </button>
                      </form>
                    </motion.div>
                  )}

                  {/* SUBTAB 2: CRYPTO DEPOSITS */}
                  {depositMethodTab === 'crypto' && (
                    <motion.div
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4 }}
                      className="space-y-6"
                    >
                      {/* Deposit Submission Form */}
                      <form onSubmit={handleDepositSubmit} className="space-y-5 text-left">
                        {/* Select Network */}
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm">🏦</span>
                            <label className="block text-[9px] font-black text-white/70 uppercase tracking-widest">Select Network Token</label>
                          </div>
                          <select
                            value={depNetwork}
                            onChange={(e) => {
                              setDepNetwork(e.target.value);
                              setDepError('');
                              setDepSuccess('');
                            }}
                            className="w-full bg-slate-950/80 border border-blue-500/30 hover:border-[#10B981]/60 focus:border-blue-500/30 rounded-xl p-3.5 text-xs text-white uppercase font-black tracking-wider outline-none transition-all cursor-pointer shadow-inner shadow-black"
                          >
                            <option value="BNB">BNB (BEP20)</option>
                            <option value="TRX">USDT TRON (TRC20)</option>
                            <option value="MATIC">Polygon (MATIC)</option>
                          </select>
                        </div>

                        {/* Display Transfer Address block */}
                        <div className="space-y-1.5 bg-slate-950/80 border border-blue-500/25 rounded-2xl p-4 relative overflow-hidden shadow-inner shadow-black">
                          <div className="flex items-center gap-1 md:gap-1.5 mb-1.5">
                            <span className="text-xs">🔑</span>
                            <p className="text-[9px] font-black text-blue-400 uppercase tracking-[0.15em]">Official Safe Receiver Address</p>
                          </div>
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                            <span className="text-[11px] font-mono text-white/90 select-all break-all tracking-wider font-semibold">
                              {depositAddresses[depNetwork]}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyAddr(depNetwork, depositAddresses[depNetwork])}
                              className="px-4 py-2 shrink-0 text-[10px] tracking-widest uppercase font-black text-black bg-blue-600 hover:brightness-110 border-0 rounded-xl transition-all cursor-pointer font-sans"
                            >
                              {copiedAddr === depNetwork ? 'COPIED ✅' : 'COPY ADDR 📋'}
                            </button>
                          </div>
                        </div>

                        {/* Amount Block */}
                        <div className="space-y-1.5 bg-transparent">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm">💵</span>
                            <label className="block text-[9px] font-black text-white/70 uppercase tracking-widest">Amount ({currencySymbol} Equiv.)</label>
                          </div>
                          <input
                            type="number"
                            placeholder={`Enter amount eg: ${(100 * conversionRate).toFixed(0)}`}
                            value={depAmount}
                            onChange={(e) => setDepAmount(e.target.value)}
                            className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-3.5 text-xs text-white placeholder-white/25 select-all outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/20 transition-all rounded-xl shadow-inner shadow-black"
                            min="1"
                            step="any"
                          />
                        </div>

                        {/* Tx Hash proof */}
                        <div className="space-y-1.5 bg-transparent">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm">🔑</span>
                            <label className="block text-[9px] font-black text-white/70 uppercase tracking-widest">Transaction Hash / ID</label>
                          </div>
                          <input
                            type="text"
                            placeholder="e.g. 0x82f... or TRX transfer TxID"
                            value={depTxHash}
                            onChange={(e) => setDepTxHash(e.target.value)}
                            className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-3.5 text-xs text-white placeholder-white/25 outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/20 transition-all shadow-inner shadow-black"
                          />
                        </div>

                        {/* Screenshot Proof */}
                        <div className="space-y-1.5 bg-transparent">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm">📸</span>
                            <label className="block text-[9px] font-black text-white/70 uppercase tracking-widest">Transaction Receipt Screenshot</label>
                          </div>
                          {depScreenshot ? (
                            <div className="relative rounded-xl border border-blue-500/30 bg-blue-600/5 p-2 flex flex-col items-center justify-center gap-3">
                               <div className="relative inline-block">
                                 <img src={depScreenshot} alt="Screenshot" className="max-h-32 object-contain rounded-lg border border-white/10" />
                                 <div className="absolute top-2 right-2 bg-blue-600 text-black text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded shadow-md border border-amber-300 flex items-center gap-1">
                                   <CheckCircle className="w-3 h-3" />
                                   Attached
                                 </div>
                               </div>
                               <button 
                                 type="button" 
                                 onClick={() => setDepScreenshot('')}
                                 className="text-[10px] text-red-400 font-bold hover:text-red-300 transition-colors bg-red-400/10 px-3 py-1.5 rounded-lg"
                               >
                                 Remove Screenshot
                               </button>
                            </div>
                          ) : (
                            <label className="flex flex-col items-center justify-center w-full h-24 bg-slate-950/80 border border-white/10 border-dashed rounded-xl cursor-pointer hover:bg-white/5 hover:border-blue-500/50 transition-all group shadow-inner shadow-black">
                              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                <Upload className="w-5 h-5 text-white/40 mb-2 group-hover:text-blue-400/70 transition-colors" />
                                <p className="text-[10px] text-white/50 uppercase tracking-wider font-bold">
                                  Click to upload receipt
                                </p>
                              </div>
                              <input
                                type="file"
                                className="hidden"
                                accept="image/*"
                                onChange={(e) => handleScreenshotUpload(e, setDepScreenshot, setDepError)}
                              />
                            </label>
                          )}
                        </div>

                        {/* Divider line style */}
                        <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-[#D4AF37]/45 to-transparent my-1" />

                        {/* Core metrics display */}
                        <div className="grid grid-cols-2 gap-3.5 pt-1 text-xs">
                          <div className="p-3 rounded-lg bg-white/[0.01] border border-white/5 space-y-1">
                            <p className="text-[7.5px] text-white/40 uppercase tracking-widest font-black flex items-center gap-1">
                              <span>⏱</span> Verification Time
                            </p>
                            <p className="text-[10px] font-black text-emerald-400 font-mono">⏱ Est: 5-15 Minutes</p>
                          </div>
                          <div className="p-3 rounded-lg bg-white/[0.01] border border-white/5 space-y-1">
                            <p className="text-[7.5px] text-white/40 uppercase tracking-widest font-black flex items-center gap-1">
                              <span>🔒</span> Core Safety
                            </p>
                            <p className="text-[10px] font-black text-blue-400 font-mono">🔒 SSL Direct Escrow</p>
                          </div>
                        </div>

                        {/* Status feedback alerts */}
                        {depError && (
                          <p className="text-[10px] font-semibold text-rose-500 leading-relaxed font-mono flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-lg">
                            <span>⚠️ Error:</span>
                            <span>{depError}</span>
                          </p>
                        )}
                        {depSuccess && (
                          <p className="text-[10.5px] font-extrabold text-[#10B981] leading-relaxed font-mono flex items-center gap-1.5 bg-[#10B981]/10 border border-[#10B981]/20 p-2.5 rounded-lg select-all">
                            <span>✅ Success:</span>
                            <span>{depSuccess}</span>
                          </p>
                        )}

                        <button
                          type="submit"
                          disabled={submitting}
                          className="relative overflow-hidden w-full py-4 px-6 rounded-2xl bg-blue-600 hover:bg-blue-500 bg-[length:200%_auto] hover:bg-right text-black shadow-[0_0_25px_rgba(59,130,246,0.35)] hover:shadow-[0_0_45px_rgba(59,130,246,0.6)] active:scale-[0.98] transition-all duration-500 font-black text-xs uppercase tracking-widest cursor-pointer disabled:opacity-40 border-0 text-center flex items-center justify-center gap-2"
                        >
                          {submitting ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin text-black" />
                              <span>Routing Proof...</span>
                            </>
                          ) : (
                            <>
                              <span>🚀 Submit Deposit Proof</span>
                            </>
                          )}
                        </button>
                      </form>
                    </motion.div>
                  )}
                </div>

                {/* 2. WITHDRAW PORTAL - UPGRADED WITH MULTI-RAIL PAKISTAN & CRYPTO SUPPORT */}
                <div 
                  id="withdraw-section" 
                  className={`relative overflow-hidden rounded-3xl bg-gradient-to-b ${withdrawMethodTab === 'pakistan' ? 'from-[#031d10] via-[#010905] to-black border-2 border-emerald-500/40 hover:border-emerald-500/70 shadow-[0_0_40px_rgba(16,185,129,0.15)]' : 'from-[#0B0B0B] via-[#050505] to-black border-2 border-blue-500/45 hover:border-emerald-500/60 shadow-[0_0_40px_rgba(59,130,246,0.12)]'} hover:shadow-[0_0_55px_rgba(16,185,129,0.18)] transition-all duration-500 p-6 md:p-8 space-y-7 scroll-mt-24 backdrop-blur-xl`}
                >
                  {/* Premium color overlay gradients */}
                  <div className={`absolute top-0 right-0 w-72 h-72 bg-gradient-to-br ${withdrawMethodTab === 'pakistan' ? 'from-emerald-500/10 to-transparent' : 'from-blue-600/6 via-[#10B981]/3 to-transparent'} blur-3xl pointer-events-none`} />
                  <div className="absolute -bottom-10 -left-10 w-44 h-44 bg-emerald-500/5 blur-3xl pointer-events-none" />

                  {/* Portal Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${withdrawMethodTab === 'pakistan' ? 'from-emerald-500/25 to-black border border-emerald-500/40' : 'from-blue-600/20 to-black border border-blue-500/40'} flex items-center justify-center ring-1 ring-white/5`}>
                        <span className="text-xl">{withdrawMethodTab === 'pakistan' ? '🇵🇰' : '💰'}</span>
                      </div>
                      <div>
                        <h3 className="text-sm font-black uppercase tracking-widest text-white leading-none">Withdrawal Gateway</h3>
                        <p className={`text-[8.5px] ${withdrawMethodTab === 'pakistan' ? 'text-emerald-400' : 'text-blue-400'} uppercase tracking-widest mt-1.5 font-mono font-bold animate-pulse`}>
                          {withdrawMethodTab === 'pakistan' ? 'PKR local rails active' : 'Crypto protocol active'}
                        </p>
                      </div>
                    </div>
                    
                    <span className={`self-start sm:self-auto text-[8.5px] ${withdrawMethodTab === 'pakistan' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/30'} px-3 py-1.5 rounded-full uppercase tracking-widest font-black flex items-center gap-2`}>
                      <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span>
                      Verified Secure Core
                    </span>
                  </div>

                  {/* 💰 Live Available Balance Block */}
                  <div className={`bg-gradient-to-r ${withdrawMethodTab === 'pakistan' ? 'from-emerald-950/20 via-white/[0.01]' : 'from-white/[0.01] via-white/[0.02]'} to-transparent p-5 rounded-2xl border border-white/5 relative`}>
                    <p className={`text-[9.5px] font-black uppercase tracking-[0.2em] ${withdrawMethodTab === 'pakistan' ? 'text-emerald-400' : 'text-blue-400'} mb-2 flex items-center gap-1.5`}>
                      <span>💰 Available balance</span>
                      <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
                    </p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-mono font-black text-white tracking-tight">
                        {currencySymbol}{(balance * conversionRate).toFixed(2)}
                      </span>
                      <span className="text-xs text-white/40 uppercase font-mono tracking-wider">
                        ({currency}) Base Liquidity
                      </span>
                    </div>
                    <p className="text-[9.5px] text-emerald-400 mt-2 flex items-center gap-1 font-semibold">
                      <span>✅ Safely secured under high-performance cryptographic locks.</span>
                    </p>
                  </div>

                  {/* Custom Navigation Tab Toggle Bar */}
                  <div className="bg-slate-950/60 border border-white/5 p-1 rounded-xl grid grid-cols-2 gap-1.5 shadow-inner shadow-black">
                    <button
                      type="button"
                      onClick={() => {
                        setWithdrawMethodTab('pakistan');
                        setPkWithdrawError('');
                        setPkWithdrawSuccess('');
                      }}
                      className={`py-2 px-3 rounded-lg text-[9.5px] font-black uppercase tracking-wider transition-all duration-200 cursor-pointer text-center ${
                        withdrawMethodTab === 'pakistan'
                          ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 shadow-sm'
                          : 'text-white/40 hover:text-white/70 border border-transparent'
                      }`}
                    >
                      🇵🇰 Pakistan Center
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setWithdrawMethodTab('crypto');
                        setWithdrawError('');
                        setWithdrawSuccess('');
                      }}
                      className={`py-2 px-3 rounded-lg text-[9.5px] font-black uppercase tracking-wider transition-all duration-200 cursor-pointer text-center ${
                        withdrawMethodTab === 'crypto'
                          ? 'bg-blue-600/15 text-blue-400 border border-blue-500/25 shadow-sm'
                          : 'text-white/40 hover:text-white/70 border border-transparent'
                      }`}
                    >
                      🌐 Crypto Payouts
                    </button>
                  </div>

                  {/* Divider */}
                  <div className={`w-full h-[1px] bg-gradient-to-r from-transparent ${withdrawMethodTab === 'pakistan' ? 'via-emerald-500/30' : 'via-[#D4AF37]/30'} to-transparent my-1`} />

                  {/* SUBTAB 1: PAKISTAN WITHDRAWAL CENTER */}
                  {withdrawMethodTab === 'pakistan' && (
                    <motion.div
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4 }}
                      className="space-y-6"
                    >
                      {/* Section Title & Description */}
                      <div className="text-left space-y-1.5">
                        <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
                          <span>🇵🇰</span> Pakistan Withdrawal Center
                        </h4>
                        <p className="text-[11.5px] text-white/60 leading-relaxed font-sans">
                          Withdraw your earnings safely and quickly through our available payment methods in Pakistan.
                        </p>
                      </div>

                      {/* Payment Methods Grid */}
                      <div className="space-y-2.5 text-left">
                        <label className="block text-[9px] font-black text-white/50 uppercase tracking-widest">Available Withdrawal Methods (Select One)</label>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {/* Easypaisa */}
                          <button
                            type="button"
                            onClick={() => {
                              setPkMethod('EASYPAISA');
                              setPkWithdrawError('');
                              setPkWithdrawSuccess('');
                            }}
                            className={`p-3.5 rounded-xl flex items-center justify-between select-none hover:bg-emerald-950/20 transition-all cursor-pointer text-left border-2 ${
                              pkMethod === 'EASYPAISA' 
                                ? 'bg-emerald-950/25 border-emerald-500' 
                                : 'bg-slate-950/40 border-white/5 hover:border-white/20'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-lg">✅</span>
                              <div>
                                <p className="font-bold text-white leading-tight">Easypaisa</p>
                                <p className="text-[8px] text-emerald-400 uppercase tracking-widest font-extrabold mt-0.5">Active</p>
                              </div>
                            </div>
                            <span className="text-[8px] bg-white/10 text-white rounded border border-white/20 py-0.5 px-1.5 uppercase font-semibold">PKR</span>
                          </button>

                          {/* JazzCash */}
                          <button
                            type="button"
                            onClick={() => {
                              setPkMethod('JAZZCASH');
                              setPkWithdrawError('');
                              setPkWithdrawSuccess('');
                            }}
                            className={`p-3.5 rounded-xl flex items-center justify-between select-none hover:bg-emerald-950/20 transition-all cursor-pointer text-left border-2 ${
                              pkMethod === 'JAZZCASH' 
                                ? 'bg-emerald-950/25 border-emerald-500' 
                                : 'bg-slate-950/40 border-white/5 hover:border-white/20'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-lg">✅</span>
                              <div>
                                <p className="font-bold text-white leading-tight">JazzCash</p>
                                <p className="text-[8px] text-emerald-400 uppercase tracking-widest font-extrabold mt-0.5">Active</p>
                              </div>
                            </div>
                            <span className="text-[8px] bg-white/10 text-white rounded border border-white/20 py-0.5 px-1.5 uppercase font-semibold">PKR</span>
                          </button>

                          {/* SadaPay */}
                          <button
                            type="button"
                            onClick={() => {
                              setPkMethod('SADAPAY');
                              setPkWithdrawError('');
                              setPkWithdrawSuccess('');
                            }}
                            className={`p-3.5 rounded-xl flex items-center justify-between select-none hover:bg-emerald-950/20 transition-all cursor-pointer text-left border-2 ${
                              pkMethod === 'SADAPAY' 
                                ? 'bg-emerald-950/25 border-emerald-500' 
                                : 'bg-slate-950/40 border-white/5 hover:border-white/20'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-lg">✅</span>
                              <div>
                                <p className="font-bold text-white leading-tight">SadaPay</p>
                                <p className="text-[8px] text-emerald-400 uppercase tracking-widest font-extrabold mt-0.5">Active</p>
                              </div>
                            </div>
                            <span className="text-[8px] bg-white/10 text-white rounded border border-white/20 py-0.5 px-1.5 uppercase font-semibold">PKR</span>
                          </button>

                          {/* NayaPay */}
                          <button
                            type="button"
                            onClick={() => {
                              setPkMethod('NAYAPAY');
                              setPkWithdrawError('');
                              setPkWithdrawSuccess('');
                            }}
                            className={`p-3.5 rounded-xl flex items-center justify-between select-none hover:bg-emerald-950/20 transition-all cursor-pointer text-left border-2 ${
                              pkMethod === 'NAYAPAY' 
                                ? 'bg-emerald-950/25 border-emerald-500' 
                                : 'bg-slate-950/40 border-white/5 hover:border-white/20'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-lg">✅</span>
                              <div>
                                <p className="font-bold text-white leading-tight">NayaPay</p>
                                <p className="text-[8px] text-emerald-400 uppercase tracking-widest font-extrabold mt-0.5">Active</p>
                              </div>
                            </div>
                            <span className="text-[8px] bg-white/10 text-white rounded border border-white/20 py-0.5 px-1.5 uppercase font-semibold">PKR</span>
                          </button>

                          {/* Bank Transfer */}
                          <button
                            type="button"
                            onClick={() => {
                              setPkMethod('BANK');
                              setPkWithdrawError('');
                              setPkWithdrawSuccess('');
                            }}
                            className={`p-3.5 rounded-xl flex items-center justify-between col-span-2 select-none hover:bg-emerald-950/20 transition-all cursor-pointer text-left border-2 ${
                              pkMethod === 'BANK' 
                                ? 'bg-emerald-950/25 border-emerald-500' 
                                : 'bg-slate-950/40 border-white/5 hover:border-white/20'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-lg">🏛️</span>
                              <div>
                                <p className="font-bold text-white leading-tight">Bank Transfer</p>
                                <p className="text-[8px] text-emerald-400 uppercase tracking-widest font-extrabold mt-0.5">Active</p>
                              </div>
                            </div>
                            <span className="text-[8px] bg-white/10 text-white rounded border border-white/20 py-0.5 px-1.5 uppercase font-semibold">Local Bank</span>
                          </button>
                        </div>
                      </div>

                      {/* Pakistan submission form */}
                      <form onSubmit={handlePkWithdrawSubmit} className="space-y-4 text-left">
                        {/* Selected local account key details (Number/IBAN) */}
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm">📱</span>
                            <label className="block text-[9px] font-black text-white/70 uppercase tracking-widest">
                              {pkMethod === 'BANK' ? 'Bank Account Number / IBAN' : `${pkMethod === 'EASYPAISA' ? 'Easypaisa' : pkMethod === 'JAZZCASH' ? 'JazzCash' : pkMethod === 'SADAPAY' ? 'SadaPay' : 'NayaPay'} Account Number`}
                            </label>
                          </div>
                          <input
                            type="text"
                            placeholder={pkMethod === 'BANK' ? 'e.g. PK00UNTY0000000000000000' : 'e.g. 03123456789'}
                            value={pkWithdrawNumber}
                            onChange={(e) => setPkWithdrawNumber(e.target.value)}
                            className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-3.5 text-xs text-white font-mono placeholder-white/25 outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/20 transition-all shadow-inner shadow-black"
                          />
                        </div>

                        {/* Selected local account title name */}
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm">👤</span>
                            <label className="block text-[9px] font-black text-white/70 uppercase tracking-widest">
                              {pkMethod === 'BANK' ? 'Account Title / Holder Name' : `Your ${pkMethod === 'EASYPAISA' ? 'Easypaisa' : pkMethod === 'JAZZCASH' ? 'JazzCash' : pkMethod === 'SADAPAY' ? 'SadaPay' : 'NayaPay'} Account Title/Name`}
                            </label>
                          </div>
                          <input
                            type="text"
                            placeholder="e.g. your name here"
                            value={pkWithdrawName}
                            onChange={(e) => setPkWithdrawName(e.target.value)}
                            className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-3.5 text-xs text-white placeholder-white/25 outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/20 transition-all shadow-inner shadow-black"
                          />
                        </div>

                        {/* Amount Box */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm">💵</span>
                              <label className="block text-[9px] font-black text-white/70 uppercase tracking-widest">Amount to Withdraw ({currency})</label>
                            </div>
                            <button
                              type="button"
                              onClick={() => setPkWithdrawAmount((balance * conversionRate).toFixed(2))}
                              className="text-[9px] font-extrabold text-emerald-400 uppercase tracking-wider hover:underline hover:text-white transition-all"
                            >
                              Max Avail: {currencySymbol}{(balance * conversionRate).toFixed(2)}
                            </button>
                          </div>
                          <input
                            type="number"
                            placeholder={`Min ${currencySymbol}${Math.ceil(10 * conversionRate)}`}
                            value={pkWithdrawAmount}
                            onChange={(e) => setPkWithdrawAmount(e.target.value)}
                            className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-3.5 text-xs text-white placeholder-white/25 outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/20 transition-all shadow-inner shadow-black"
                            step="any"
                          />
                          {parseFloat(pkWithdrawAmount) > 0 && (
                            <p className="text-[10px] text-emerald-400 font-bold font-mono">
                              💸 Approx equivalent: {currency === 'USD' ? `₨ ${(parseFloat(pkWithdrawAmount) * 280).toFixed(0)} PKR` : `$ ${(parseFloat(pkWithdrawAmount) / conversionRate).toFixed(2)} USD`} (at current rate)
                            </p>
                          )}
                        </div>

                        {/* Notice Box */}
                        <div className="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/15 text-left text-xs leading-relaxed text-emerald-300">
                          📢 All local payment networks in Pakistan are fully active and synchronized. Enter your account details correctly to initiate direct local clearing agent routing.
                        </div>

                        {/* Important Notice Box */}
                        <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/15 text-left text-xs leading-relaxed text-amber-300">
                          ⚠️ To ensure secure transactions and prevent fraudulent activity, all withdrawal requests are manually reviewed before processing. Please make sure your payment details are correct. Processing may take 2–24 hours after approval.
                        </div>

                        {/* Withdrawal Rules */}
                        <div className="p-4 rounded-xl bg-slate-950/40 border border-white/5 text-left text-xs space-y-1 text-white/75 font-sans leading-relaxed">
                          <p className="font-bold text-white text-[10px] uppercase tracking-widest mb-1 font-sans">Withdrawal Rules:</p>
                          <p className="flex items-center gap-2">• Minimum Withdrawal: {currencySymbol}{Math.ceil(10 * conversionRate)}</p>
                          <p className="flex items-center gap-2">• Processing Time: 2–24 Hours</p>
                          <p className="flex items-center gap-2">• One withdrawal request at a time</p>
                          <p className="flex items-center gap-2">• Ensure payment details are correct before submitting</p>
                        </div>

                        {/* Status feedback alerts */}
                        {pkWithdrawError && (
                          <div className="text-[10px] font-semibold text-rose-500 leading-relaxed font-mono flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-lg select-all">
                            <span>{pkWithdrawError}</span>
                          </div>
                        )}
                        {pkWithdrawSuccess && (
                          <div className="text-[10.5px] font-extrabold text-[#10B981] leading-relaxed font-mono flex items-center gap-1.5 bg-[#10B981]/10 border border-[#10B981]/20 p-2.5 rounded-lg select-all">
                            <span>{pkWithdrawSuccess}</span>
                          </div>
                        )}

                        {/* Large "Withdraw Now" button */}
                        <button
                          type="submit"
                          disabled={submitting}
                          className="relative overflow-hidden w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-600 bg-[length:200%_auto] hover:bg-right text-white shadow-[0_0_25px_rgba(16,185,129,0.35)] hover:shadow-[0_0_45px_rgba(16,185,129,0.6)] active:scale-[0.98] transition-all duration-500 font-black text-xs uppercase tracking-widest cursor-pointer disabled:opacity-40 border-0 text-center flex items-center justify-center gap-2"
                        >
                          {submitting ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin text-white" />
                              <span>Routing Request...</span>
                            </>
                          ) : (
                            <>
                              <span>💸 Withdraw Now</span>
                            </>
                          )}
                        </button>
                      </form>
                    </motion.div>
                  )}

                  {/* SUBTAB 2: GENERAL CRYPTO PORTAL */}
                  {withdrawMethodTab === 'crypto' && (
                    <motion.div
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4 }}
                      className="space-y-5"
                    >
                      <form onSubmit={handleWithdrawSubmit} className="space-y-5 text-left">
                        {/* Method Dropdown selection */}
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm">🏦</span>
                            <label className="block text-[9px] font-black text-white/70 uppercase tracking-widest">Withdraw To</label>
                          </div>
                          <select
                            value={withdrawNetwork}
                            onChange={(e) => {
                              setWithdrawNetwork(e.target.value);
                              setWithdrawError('');
                              setWithdrawSuccess('');
                            }}
                            className="w-full bg-slate-950/80 border border-blue-500/30 hover:border-[#10B981]/60 focus:border-blue-500/30 rounded-xl p-3.5 text-xs text-white uppercase font-black tracking-wider outline-none transition-all cursor-pointer shadow-inner shadow-black"
                          >
                            <option value="BNB">Binance BNB (BEP20)</option>
                            <option value="TRX">Binance USDT (TRC20)</option>
                            <option value="MATIC">Binance Polygon (MATIC)</option>
                          </select>
                        </div>

                        {/* Target Address input */}
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm">📱</span>
                            <label className="block text-[9px] font-black text-white/70 uppercase tracking-widest">
                              Destination Wallet Address / Binance Pay ID
                            </label>
                          </div>
                          <input
                            type="text"
                            placeholder="e.g., Binance Pay ID or BEP20 Wallet Address"
                            value={withdrawWallet}
                            onChange={(e) => setWithdrawWallet(e.target.value)}
                            className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-3.5 text-xs text-white font-mono placeholder-white/25 select-all outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/20 transition-all rounded-xl shadow-inner shadow-black"
                          />
                        </div>

                        {/* Value Amount input */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-sans">💵</span>
                              <label className="block text-[9px] font-black text-white/70 uppercase tracking-widest">Amount to Withdraw ({currencySymbol})</label>
                            </div>
                            <button
                              type="button"
                              onClick={() => setWithdrawAmount((balance * conversionRate).toFixed(2))}
                              className="text-[9px] font-extrabold text-blue-400 uppercase tracking-wider hover:underline hover:text-[#10B981] transition-all"
                            >
                              Max Avail: {currencySymbol}{(balance * conversionRate).toFixed(2)}
                            </button>
                          </div>
                          <input
                            type="number"
                            placeholder="$0.00 equivalent value"
                            value={withdrawAmount}
                            onChange={(e) => setWithdrawAmount(e.target.value)}
                            className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-3.5 text-xs text-white placeholder-white/25 select-all outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/20 transition-all rounded-xl shadow-inner shadow-black"
                            step="any"
                          />
                        </div>

                        {/* Divider line style */}
                        <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-[#D4AF37]/45 to-transparent my-1" />

                        {/* Core metrics display */}
                        <div className="grid grid-cols-2 gap-3.5 pt-1 text-xs">
                          <div className="p-3 rounded-lg bg-white/[0.01] border border-white/5 space-y-1">
                            <p className="text-[7.5px] text-white/40 uppercase tracking-widest font-black flex items-center gap-1">
                              <span>⚡</span> Instant Withdrawal
                            </p>
                            <p className="text-[10px] font-black text-emerald-400 font-mono">⏱ Processing: 1-2 Minutes</p>
                          </div>
                          <div className="p-3 rounded-lg bg-white/[0.01] border border-white/5 space-y-1">
                            <p className="text-[7.5px] text-white/40 uppercase tracking-widest font-black flex items-center gap-1">
                              <span>🔒</span> Secure Gateway
                            </p>
                            <p className="text-[10px] font-black text-blue-400 font-mono">✅ Min Withdraw: $1.00</p>
                          </div>
                        </div>

                        {/* Status Feedback alerts */}
                        {withdrawError && (
                          <p className="text-[10px] font-semibold text-rose-500 leading-relaxed font-mono flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-lg">
                            <span>⚠️ Error:</span>
                            <span>{withdrawError}</span>
                          </p>
                        )}
                        {withdrawSuccess && (
                          <p className="text-[10.5px] font-extrabold text-[#10B981] leading-relaxed font-mono flex items-center gap-1.5 bg-[#10B981]/10 border border-[#10B981]/20 p-2.5 rounded-lg select-all">
                            <span>✅ Success:</span>
                            <span>{withdrawSuccess}</span>
                          </p>
                        )}

                        {/* Gold Glowing Core Button with Custom hover scale & glow tracking */}
                        <button
                          type="submit"
                          disabled={submitting}
                          className="relative overflow-hidden w-full py-4 px-6 rounded-2xl bg-blue-600 hover:bg-blue-500 bg-[length:200%_auto] hover:bg-right text-black shadow-[0_0_25px_rgba(59,130,246,0.35)] hover:shadow-[0_0_45px_rgba(59,130,246,0.6)] active:scale-[0.98] transition-all duration-500 font-black text-xs uppercase tracking-widest cursor-pointer disabled:opacity-40 border-0 text-center flex items-center justify-center gap-2"
                        >
                          {submitting ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin text-black" />
                              <span>Routing Request...</span>
                            </>
                          ) : (
                            <>
                              <span>🚀 Withdraw Now</span>
                            </>
                          )}
                        </button>
                      </form>
                    </motion.div>
                  )}
                </div>

                {/* 🔒 CERTIFIED TRUST SECTION */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-2xl bg-[#090909] border border-blue-500/15 text-left space-y-1">
                    <span className="text-blue-400 text-md">⚡</span>
                    <h5 className="text-[9px] font-black uppercase text-white tracking-widest">Fast Automated</h5>
                    <p className="text-[7.5px] text-white/50 uppercase tracking-widest leading-none font-bold">Direct Withdrawals</p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-[#090909] border border-blue-500/15 text-left space-y-1">
                    <span className="text-emerald-400 text-md">💸</span>
                    <h5 className="text-[9px] font-black uppercase text-white tracking-widest">24/7 Processing</h5>
                    <p className="text-[7.5px] text-white/50 uppercase tracking-widest leading-none font-bold">Uninterrupted Yields</p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-[#090909] border border-blue-500/15 text-left space-y-1">
                    <span className="text-emerald-500 text-md">🔒</span>
                    <h5 className="text-[9px] font-black uppercase text-white tracking-widest">100% Secure</h5>
                    <p className="text-[7.5px] text-white/50 uppercase tracking-widest leading-none font-bold">Encrypted Ledger</p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-[#090909] border border-blue-500/15 text-left space-y-1">
                    <span className="text-blue-400 text-md">📱</span>
                    <h5 className="text-[9px] font-black uppercase text-white tracking-widest">Easy/Jazz/Binance</h5>
                    <p className="text-[7.5px] text-white/50 uppercase tracking-widest leading-none font-bold">Standard Channels</p>
                  </div>
                </div>
              </div>

              {/* 🏆 LATEST WITHDRAWALS (TRUST PROOF SECTION) */}
              <div className="bg-[#0B0B0B] border border-white/5 rounded-2xl p-6 space-y-4 shadow-[0_0_25px_rgba(0,0,0,0.5)]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">🏆</span>
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-widest text-blue-400">Latest Withdrawals</h4>
                      <p className="text-[8px] text-[#10B981] uppercase tracking-wider font-bold animate-pulse mt-0.5">Real-time Platform Payouts</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#10B981]/10 text-[#10B981] text-[7.5px] uppercase font-black border border-[#10B981]/20">
                    <span className="w-1 h-1 bg-[#10B981] rounded-full animate-ping"></span>
                    <span>Verified</span>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-white/5 bg-[#050505]">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="bg-white/[0.01] border-b border-white/5 text-white/30 uppercase text-[8px] tracking-widest">
                        <th className="py-3 px-4 font-bold">User</th>
                        <th className="py-3 px-4 font-bold">Amount</th>
                        <th className="py-3 px-4 font-bold text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.03]">
                      {[
                        { name: "A*** Khan", amount: "$50", method: "EasyPaisa", time: "Just now" },
                        { name: "M*** Ali", amount: "$20", method: "JazzCash", time: "1 min ago" },
                        { name: "B*** Crypto", amount: "$130", method: "Binance", time: "5 mins ago" },
                        { name: "S*** Ahmed", amount: "$85", method: "EasyPaisa", time: "12 mins ago" },
                        { name: "Z*** Malik", amount: "$30", method: "JazzCash", time: "18 mins ago" }
                      ].map((item, idx) => (
                        <motion.tr 
                          key={idx} 
                          initial={{ opacity: 0, y: 15 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: true, margin: "-10px" }}
                          transition={{ duration: 0.4, delay: idx * 0.05 }}
                          className="hover:bg-white/[0.01] transition-all"
                        >
                          <td className="py-3 px-4 font-medium text-white/90">
                            <div className="flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]"></span>
                              <span>{item.name}</span>
                              <span className="text-[7px] text-white/30 uppercase px-1.5 py-0.5 rounded border border-white/5 bg-white/[0.01]">{item.method}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-blue-400">{item.amount}</td>
                          <td className="py-3 px-4 text-right">
                            <span className="inline-flex items-center gap-1 text-[8.5px] text-[#10B981] font-black uppercase tracking-wider bg-[#10B981]/10 border border-[#10B981]/20 px-2.5 py-1 rounded">
                              ✅ Paid
                            </span>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 3. FUNDING STATEMENT LEDGER */}
              <div className="bg-[#0B0B0B] border border-white/5 rounded-2xl p-6 space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-widest text-blue-400 mb-2">My Funding Statement History</h4>

                
                {/* Deposits History list */}
                <div className="space-y-4">
                  <div>
                    <p className="text-[9px] font-bold text-white/40 uppercase tracking-wider mb-2.5">Registered Cryptographic Deposits</p>
                    {(!deposits || deposits.length === 0) ? (
                      <div className="p-4 bg-white/[0.01] border border-dashed border-white/5 rounded-xl text-center text-[10px] text-white/30 uppercase tracking-widest">
                        No cryptographic deposit logs yet.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-[10.5px]">
                          <thead>
                            <tr className="border-b border-white/5 text-white/40 uppercase text-[8px] tracking-widest">
                              <th className="pb-2 font-semibold">Registered Timestamp</th>
                              <th className="pb-2 font-semibold">Protocol Token</th>
                              <th className="pb-2 font-semibold">Value ($)</th>
                              <th className="pb-2 font-semibold">Proof (TXHash)</th>
                              <th className="pb-2 font-semibold text-right">Approval State</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {paginatedDeposits.map((dep, idx) => (
                              <motion.tr 
                                key={dep.id} 
                                initial={{ opacity: 0, y: 15 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: "-10px" }}
                                transition={{ duration: 0.4, delay: Math.min(idx * 0.05, 0.3) }}
                                className="text-white/80"
                              >
                                <td className="py-2.5 text-[10px] font-mono text-white/40">{dep.timestamp}</td>
                                <td className="py-2.5 font-bold uppercase text-white">{dep.network}</td>
                                <td className="py-2.5 font-medium text-blue-400">{currencySymbol}{(dep.amount * conversionRate).toFixed(2)}</td>
                                <td className="py-2.5 font-mono text-white/40 text-[9px] truncate max-w-[120px]" title={dep.txHash}>{dep.txHash}</td>
                                <td className="py-2.5 text-right">
                                  <div className="flex flex-col items-end gap-1.5">
                                    <div className="flex items-center gap-1">
                                      {dep.status === 'pending' && (
                                        <span className="inline-flex items-center gap-1 text-amber-500 font-bold uppercase tracking-wider text-[9px] bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">
                                          <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
                                          Pending Validation
                                        </span>
                                      )}
                                      {dep.status === 'approved' && (
                                        <span className="inline-flex items-center gap-1 text-emerald-400 font-bold uppercase tracking-wider text-[9px] bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded-md">
                                          <CheckCircle className="w-3 h-3 text-emerald-400" />
                                          Approved
                                        </span>
                                      )}
                                      {dep.status === 'rejected' && (
                                        <span className="inline-flex items-center gap-1 text-rose-500 font-bold uppercase tracking-wider text-[9px] bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-md">
                                          <XCircle className="w-3 h-3 text-rose-500" />
                                          Rejected
                                        </span>
                                      )}
                                    </div>
                                    {dep.status === 'pending' && (
                                      <div className="w-24 sm:w-28 bg-white/5 h-1 rounded-full overflow-hidden relative">
                                        <motion.div 
                                          className="bg-blue-600 h-full rounded-full"
                                          initial={{ x: '-100%' }}
                                          animate={{ x: '100%' }}
                                          transition={{ 
                                            repeat: Infinity, 
                                            duration: 1.5, 
                                            ease: "linear" 
                                          }}
                                        />
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </motion.tr>
                            ))}
                          </tbody>
                        </table>

                        {totalDepositsPages > 1 && (
                          <div className="flex items-center justify-between pt-4 border-t border-white/5 mt-4">
                            <button
                              disabled={depositsPage === 1}
                              onClick={() => setDepositsPage(prev => Math.max(prev - 1, 1))}
                              className="px-3 py-1.5 rounded-lg border border-white/10 text-white/60 hover:text-white hover:bg-white/[0.02] disabled:opacity-30 disabled:pointer-events-none transition-all duration-150 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider cursor-pointer"
                            >
                              <ChevronLeft className="w-3.5 h-3.5" /> Prev
                            </button>
                            <span className="text-[10px] text-white/50 font-mono">
                              Page {depositsPage} of {totalDepositsPages}
                            </span>
                            <button
                              disabled={depositsPage === totalDepositsPages}
                              onClick={() => setDepositsPage(prev => Math.min(prev + 1, totalDepositsPages))}
                              className="px-3 py-1.5 rounded-lg border border-white/10 text-white/60 hover:text-white hover:bg-white/[0.02] disabled:opacity-30 disabled:pointer-events-none transition-all duration-150 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider cursor-pointer"
                            >
                              Next <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <hr className="border-white/5" />

                  {/* Upgraded Withdrawals History - Transformed to chronological cards with green success indicators per design requirements */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">📥</span>
                        <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest leading-none">My Payout Records (Chronological Cards)</p>
                      </div>
                      <span className="text-[7.5px] font-black text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2.5 py-1 rounded-full uppercase tracking-wider">
                        Secure SSL Gateway Live
                      </span>
                    </div>

                    {(!withdrawals || withdrawals.length === 0) ? (
                      <div className="p-8 bg-[#050505] border border-dashed border-white/5 rounded-xl text-center text-[10px] text-white/30 uppercase tracking-widest">
                        No payout withdrawal payouts logged yet.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {paginatedWithdrawals.map((wit, idx) => {
                          const isApproved = wit.status === 'approved';
                          const isPending = wit.status === 'pending';
                          return (
                            <motion.div 
                              initial={{ opacity: 0, y: 20 }}
                              whileInView={{ opacity: 1, y: 0 }}
                              viewport={{ once: true, margin: "-20px" }}
                              transition={{ duration: 0.5, delay: Math.min(idx * 0.05, 0.3) }}
                              whileHover={{ scale: 1.015, borderColor: isApproved ? 'rgba(16,185,129,0.3)' : 'rgba(59,130,246,0.2)' }}
                              key={wit.id} 
                              className={`p-4 rounded-xl border transition-all duration-300 backdrop-blur-md relative overflow-hidden ${
                                isApproved 
                                  ? 'bg-[#10B981]/5 border-[#10B981]/20 shadow-[0_4px_20px_rgba(16,185,129,0.04)]' 
                                  : isPending 
                                  ? 'bg-amber-500/5 border-amber-500/15' 
                                  : 'bg-rose-500/5 border-rose-500/15'
                              }`}
                            >
                              {/* Glowing success or pending corner flare */}
                              <div className={`absolute top-0 right-0 w-24 h-24 blur-2xl pointer-events-none opacity-40 ${
                                isApproved ? 'bg-[#10B981]/20' : 'bg-blue-600/10'
                              }`} />

                              <div className="flex flex-col justify-between h-full space-y-3 relative z-10 text-left">
                                <div className="flex items-center justify-between">
                                  <span className={`inline-flex items-center gap-1.5 text-[8.5px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md border ${
                                    isApproved 
                                      ? 'text-emerald-400 bg-emerald-400/15 border-emerald-400/20' 
                                      : isPending 
                                      ? 'text-amber-400 bg-amber-400/15 border-amber-400/20 animate-pulse'
                                      : 'text-rose-400 bg-rose-500/15 border-rose-500/20'
                                  }`}>
                                    {isApproved ? '✅ Withdrawal Completed' : isPending ? '⏳ Processing Request' : '❌ Withdrawal Rejected'}
                                  </span>
                                  <span className="text-[9px] font-mono text-white/30 font-semibold">{wit.timestamp}</span>
                                </div>

                                <div className="space-y-1">
                                  <div className="flex items-baseline gap-2">
                                    <span className="text-lg md:text-xl font-mono font-black text-white tracking-tight">
                                      {currencySymbol}{(wit.amount * conversionRate).toFixed(2)}
                                    </span>
                                    <span className="text-white/30 text-xs">→</span>
                                    <span className="text-xs font-black uppercase text-blue-400 tracking-wider">
                                      {wit.network}
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-white/40 font-mono truncate max-w-xs" title={wit.wallet}>
                                    <span className="text-white/20 select-none">ID/Acc: </span>
                                    {wit.wallet}
                                  </p>
                                </div>

                                {/* Visual Progress Step Tracker Pipeline */}
                                <div className="pt-4 border-t border-white/5 mt-2.5">
                                  <p className="text-[8px] font-black uppercase text-white/40 tracking-widest mb-3 flex items-center justify-between">
                                    <span>🔍 Payout Track Pipeline</span>
                                    {isPending && <span className="text-amber-400 font-mono text-[7px] animate-pulse">Under Review (2–24h)</span>}
                                    {isApproved && <span className="text-emerald-400 font-mono text-[7px]">Processed & Disbursed</span>}
                                    {wit.status === 'rejected' && <span className="text-rose-400 font-mono text-[7px]">Audit Rejected</span>}
                                  </p>
                                  
                                  <div className="relative flex items-center justify-between px-1.5">
                                    {/* Line connector underneath */}
                                    <div className="absolute left-3 right-3 top-[7px] h-[2px] bg-white/5 -z-10" />
                                    {/* Active transition fill line */}
                                    <div 
                                      className={`absolute left-3 top-[7px] h-[2px] transition-all duration-700 -z-10 ${
                                        isApproved ? 'bg-emerald-500 w-[calc(100%-1.5rem)]' : 
                                        wit.status === 'rejected' ? 'bg-rose-500 w-[calc(100%-1.5rem)]' :
                                        'bg-amber-500/60 w-[calc(50%-0.75rem)] animate-pulse'
                                      }`}
                                    />

                                    {/* Step 1: Pending (Always Submitted successfully) */}
                                    <div className="flex flex-col items-center gap-1.5 text-center">
                                      <div className="w-4.5 h-4.5 rounded-full bg-emerald-500/20 border border-emerald-500 flex items-center justify-center text-[7.5px] text-emerald-400 font-black relative shadow-[0_0_8px_rgba(16,185,129,0.2)]">
                                        ✓
                                      </div>
                                      <span className="text-[7px] font-black uppercase tracking-wider text-emerald-400">Pending</span>
                                    </div>

                                    {/* Step 2: Under Review */}
                                    <div className="flex flex-col items-center gap-1.5 text-center">
                                      <div className={`w-4.5 h-4.5 rounded-full flex items-center justify-center text-[7.5px] font-black relative transition-all duration-300 ${
                                        isApproved || wit.status === 'rejected'
                                          ? 'bg-emerald-500/20 border border-emerald-500 text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.2)]'
                                          : 'bg-amber-500/20 border border-amber-500 text-amber-400 animate-pulse shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                                      }`}>
                                        {(isApproved || wit.status === 'rejected') ? '✓' : '•'}
                                      </div>
                                      <span className={`text-[7px] font-black uppercase tracking-wider ${
                                        isApproved || wit.status === 'rejected' ? 'text-emerald-400/80' : 'text-amber-400'
                                      }`}>Under Review</span>
                                    </div>

                                    {/* Step 3: Approved / Paid */}
                                    <div className="flex flex-col items-center gap-1.5 text-center">
                                      <div className={`w-4.5 h-4.5 rounded-full flex items-center justify-center text-[7.5px] font-black relative transition-all duration-300 ${
                                        isApproved
                                          ? 'bg-emerald-500 border border-emerald-400 text-white shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                                          : wit.status === 'rejected'
                                          ? 'bg-rose-500 border border-rose-400 text-white shadow-[0_0_12px_rgba(244,63,94,0.4)]'
                                          : 'bg-white/5 border border-white/10 text-white/30'
                                      }`}>
                                        {isApproved ? '✓' : wit.status === 'rejected' ? '✗' : '3'}
                                      </div>
                                      <span className={`text-[7px] font-black uppercase tracking-wider ${
                                        isApproved ? 'text-emerald-400 font-bold' : wit.status === 'rejected' ? 'text-rose-400 font-bold' : 'text-white/30'
                                      }`}>{wit.status === 'rejected' ? 'Rejected' : 'Approved'}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}

                        {totalWithdrawalsPages > 1 && (
                          <div className="col-span-1 md:col-span-2 flex items-center justify-between pt-4 border-t border-white/5 mt-4">
                            <button
                              disabled={withdrawalsPage === 1}
                              onClick={() => setWithdrawalsPage(prev => Math.max(prev - 1, 1))}
                              className="px-3 py-1.5 rounded-lg border border-white/10 text-white/60 hover:text-white hover:bg-white/[0.02] disabled:opacity-30 disabled:pointer-events-none transition-all duration-150 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider cursor-pointer"
                            >
                              <ChevronLeft className="w-3.5 h-3.5" /> Prev
                            </button>
                            <span className="text-[10px] text-white/50 font-mono">
                              Page {withdrawalsPage} of {totalWithdrawalsPages}
                            </span>
                            <button
                              disabled={withdrawalsPage === totalWithdrawalsPages}
                              onClick={() => setWithdrawalsPage(prev => Math.min(prev + 1, totalWithdrawalsPages))}
                              className="px-3 py-1.5 rounded-lg border border-white/10 text-white/60 hover:text-white hover:bg-white/[0.02] disabled:opacity-30 disabled:pointer-events-none transition-all duration-150 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider cursor-pointer"
                            >
                              Next <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'faq' && (
            <motion.div
              key="faq-tab"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="space-y-6 scroll-mt-24"
              id="faq-section"
            >
              <FaqSection theme={theme} />
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div
              key="settings-tab"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="space-y-6 scroll-mt-24"
              id="settings-section"
            >
              <div className="bg-white dark:bg-[#131B2E] border border-gray-100 dark:border-white/5 rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-md dark:shadow-2xl">
                {/* Visual gradient backdrop decor */}
                <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600/5 blur-[120px] rounded-full pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-500/5 blur-[120px] rounded-full pointer-events-none" />

                <div className="relative space-y-6">
                  {/* Title & Description */}
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-black text-emerald-500 tracking-[0.2em] uppercase font-sans">
                      Account Hub
                    </span>
                    <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white tracking-tight">
                      Profile Settings
                    </h2>
                    <p className="text-xs text-zinc-400">
                      Manage your profile identity. Update your display name and avatar.
                    </p>
                  </div>

                  {/* Form Container */}
                  <form 
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!profileName.trim()) {
                        onAddToast('Display name cannot be empty!', 'error');
                        return;
                      }
                      if (profileName.length > 50) {
                        onAddToast('Display name must be less than 50 characters!', 'error');
                        return;
                      }
                      setIsSavingProfile(true);
                      try {
                        if (onUpdateProfile) {
                          await onUpdateProfile(profileName.trim(), profileAvatar);
                          playSound('new_referral');
                        } else {
                          onAddToast('Profile update handler is not configured.', 'error');
                        }
                      } catch (err) {
                        console.error("Profile save error:", err);
                        onAddToast('Failed to save profile settings.', 'error');
                      } finally {
                        setIsSavingProfile(false);
                      }
                    }} 
                    className="grid grid-cols-1 lg:grid-cols-12 gap-8"
                  >
                    {/* Left Column: Input and Save Button */}
                    <div className="lg:col-span-5 space-y-6 flex flex-col justify-between">
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <label className="block text-[10px] font-black text-zinc-500 dark:text-white/70 uppercase tracking-widest font-sans">
                            Display Name
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="Enter display name"
                            value={profileName}
                            onChange={(e) => setProfileName(e.target.value)}
                            className="w-full bg-zinc-50 dark:bg-slate-950/80 border border-gray-200 dark:border-white/10 rounded-xl p-3.5 text-xs text-slate-800 dark:text-white font-sans placeholder-slate-400 dark:placeholder-white/25 outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/20 transition-all shadow-inner"
                          />
                        </div>

                        {/* Public Member details */}
                        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 space-y-3">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-zinc-500 uppercase font-black tracking-widest">Status:</span>
                            {userProfile?.emailVerified ? (
                              <span className="text-emerald-400 font-bold uppercase tracking-widest bg-emerald-600/10 px-2.5 py-0.5 rounded-md border border-emerald-500/20">
                                Email Verified
                              </span>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="text-red-400 font-bold uppercase tracking-widest bg-red-600/10 px-2.5 py-0.5 rounded-md border border-red-500/20">
                                  Unverified
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setShowEmailVerificationModal(true)}
                                  className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-gradient-to-r from-emerald-500 to-teal-500 text-black hover:brightness-110 active:scale-95 transition-all cursor-pointer border-0"
                                >
                                  Verify Now
                                </button>
                              </div>
                            )}
                          </div>
                          
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-zinc-500 uppercase font-black tracking-widest">Email:</span>
                            <span className="text-zinc-400 font-mono text-[10px] break-all max-w-[150px] text-right">
                              {userProfile?.email || 'N/A'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-zinc-500 uppercase font-black tracking-widest">ID:</span>
                            <span className="text-zinc-400 font-mono text-[10px] break-all max-w-[150px] text-right">
                              {userProfile?.userId || 'N/A'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-zinc-500 uppercase font-black tracking-widest">Registered On:</span>
                            <span className="text-zinc-400">
                              {userProfile?.createdAt ? new Date(userProfile.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-4 lg:pt-0">
                        <button
                          type="submit"
                          disabled={isSavingProfile}
                          className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-black font-black text-[11px] uppercase tracking-[0.2em] rounded-xl hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer shadow-lg shadow-blue-500/10 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
                        >
                          {isSavingProfile ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              Saving Changes...
                            </>
                          ) : (
                            'Save Profile Settings'
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Right Column: Avatar Customization Hub */}
                    <div className="lg:col-span-7 space-y-4">
                      <label className="block text-[10px] font-black text-white/70 uppercase tracking-widest font-sans">
                        Choose Your Profile Emblem
                      </label>

                      {/* Selected Badge Preview */}
                      <div className="bg-slate-950/60 border border-white/5 rounded-2xl p-4 flex items-center gap-4">
                        <div className={`w-14 h-14 rounded-xl border flex items-center justify-center shadow-lg transition-all duration-300 ${getAvatarConfig(profileAvatar).color}`}>
                          <AvatarIcon id={profileAvatar} className="w-8 h-8" />
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest font-sans">Active Emblem</p>
                          <h4 className="text-sm font-bold text-white tracking-wide">{getAvatarConfig(profileAvatar).label}</h4>
                          <p className="text-[10px] text-zinc-500 font-sans">Click on any avatar below to assign to your name.</p>
                        </div>
                      </div>

                      {/* Avatar Selection Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {AVATAR_PRESETS.map((preset) => {
                          const isSelected = profileAvatar === preset.id;
                          return (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() => setProfileAvatar(preset.id)}
                              className={`p-3.5 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all cursor-pointer text-center relative group bg-transparent ${
                                isSelected
                                  ? 'bg-blue-600/10 border-blue-500/80 text-blue-400 scale-105 shadow-md shadow-black/40 ring-1 ring-blue-500/30'
                                  : 'border-white/5 hover:border-white/20 bg-white/[0.01] hover:bg-white/[0.03] text-white/60 hover:text-white'
                              }`}
                            >
                              <div className={`p-2 rounded-lg border transition-transform duration-300 group-hover:scale-110 ${preset.color}`}>
                                <AvatarIcon id={preset.id} className="w-5 h-5" />
                              </div>
                              <span className="text-[10px] font-bold uppercase tracking-wider block">
                                {preset.label}
                              </span>
                              {isSelected && (
                                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-blue-600" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </form>
                </div>
              </div>

              {/* Notification Settings Section */}
              <div className="bg-white dark:bg-[#131B2E] border border-gray-100 dark:border-white/5 rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-md dark:shadow-2xl mt-6">
                <div className="relative space-y-6">
                  {/* Title & Description */}
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-black text-emerald-500 tracking-[0.2em] uppercase font-sans">
                      Preferences
                    </span>
                    <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
                      <Bell className="w-6 h-6 text-emerald-500" />
                      Notification Settings
                    </h2>
                    <p className="text-xs text-zinc-400">
                      Manage how and when you receive updates regarding your account activity.
                    </p>
                  </div>

                  <div className="bg-zinc-55/5 dark:bg-white/[0.02] border border-gray-200 dark:border-white/5 rounded-2xl p-5 flex items-center justify-between transition-colors hover:bg-zinc-50 dark:hover:bg-white/[0.03]">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-xl bg-gray-100 dark:bg-slate-950 border border-gray-200 dark:border-white/10">
                        <Mail className="w-5 h-5 text-emerald-500" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-bold text-slate-800 dark:text-white tracking-wide">Email Alerts</h4>
                        <p className="text-xs text-zinc-500 font-sans max-w-[230px]">Receive notifications for deposit and withdrawal status changes.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEmailAlertsEnabled(!emailAlertsEnabled)}
                      className="text-emerald-500 hover:text-emerald-400 transition-colors focus:outline-none cursor-pointer bg-transparent border-0"
                    >
                      {emailAlertsEnabled ? (
                        <ToggleRight className="w-10 h-10" />
                      ) : (
                        <ToggleLeft className="w-10 h-10 text-zinc-400 dark:text-zinc-600 hover:text-zinc-500" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Theme & Preferences Section */}
              <div className="bg-white dark:bg-[#131B2E] border border-gray-100 dark:border-white/5 rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-md dark:shadow-2xl mt-6">
                <div className="relative space-y-6">
                  {/* Title & Description */}
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-black text-emerald-500 tracking-[0.2em] uppercase font-sans">
                      Appearance & Core
                    </span>
                    <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
                      <Settings className="w-6 h-6 text-emerald-500" />
                      App Customization
                    </h2>
                    <p className="text-xs text-zinc-400">
                      Customize your default currency values and audio parameters.
                    </p>
                  </div>

                  {/* 2. Currency Selector Option */}
                  <div className="bg-zinc-55/5 dark:bg-white/[0.02] border border-gray-200 dark:border-white/5 rounded-2xl p-5 flex items-center justify-between transition-colors hover:bg-zinc-50 dark:hover:bg-white/[0.03]">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-xl bg-gray-100 dark:bg-slate-950 border border-gray-200 dark:border-white/10">
                        <Coins className="w-5 h-5 text-emerald-500" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-bold text-slate-800 dark:text-white tracking-wide">Primary Currency</h4>
                        <p className="text-xs text-zinc-500 font-sans">Choose which local currency values are calculated.</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-950 border border-gray-200 dark:border-white/10 rounded-xl px-2.5 py-1.5 text-xs font-extrabold select-none relative hover:border-emerald-500/35 transition-all">
                      <select
                        value={currency}
                        onChange={(e) => changeCurrency(e.target.value as CurrencyCode)}
                        className="bg-transparent border-none outline-none pr-4 text-slate-800 dark:text-white uppercase text-[10px] font-extrabold cursor-pointer appearance-none transition-all flex items-center justify-center leading-none"
                        style={{ WebkitAppearance: 'none', MozAppearance: 'none' }}
                      >
                        {Object.keys(SUPPORTED_CURRENCIES).map((code) => (
                          <option key={code} value={code} className="bg-white dark:bg-[#111111] text-slate-800 dark:text-white/90 py-1 text-xs">
                            {code} ({SUPPORTED_CURRENCIES[code as CurrencyCode].symbol.trim()})
                          </option>
                        ))}
                      </select>
                      <span className="text-zinc-400 dark:text-white/30 text-[8px] pointer-events-none absolute right-2">▼</span>
                    </div>
                  </div>

                  {/* 3. System Sound Option */}
                  <div className="bg-zinc-55/5 dark:bg-white/[0.02] border border-gray-200 dark:border-white/5 rounded-2xl p-5 flex items-center justify-between transition-colors hover:bg-zinc-50 dark:hover:bg-white/[0.03]">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-xl bg-gray-100 dark:bg-slate-950 border border-gray-200 dark:border-white/10">
                        {isMuted ? <VolumeX className="w-5 h-5 text-zinc-400" /> : <Volume2 className="w-5 h-5 text-emerald-500 animate-pulse" />}
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-bold text-slate-800 dark:text-white tracking-wide">Sound System</h4>
                        <p className="text-xs text-zinc-500 font-sans font-sans">Toggle live audio and dividend alerts.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={toggleMuted}
                      className="px-4 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl border transition-all cursor-pointer h-9 flex items-center justify-center border-gray-200 dark:border-white/10 hover:border-emerald-500 bg-gray-100 dark:bg-slate-950 text-slate-800 dark:text-white"
                    >
                      {isMuted ? 'Muted' : 'Enabled'}
                    </button>
                  </div>

                  {/* 4. Database Sync Option */}
                  <div className="bg-zinc-55/5 dark:bg-white/[0.02] border border-gray-200 dark:border-white/5 rounded-2xl p-5 flex items-center justify-between transition-colors hover:bg-zinc-50 dark:hover:bg-white/[0.03]">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-xl bg-gray-100 dark:bg-slate-950 border border-gray-200 dark:border-white/10">
                        <RefreshCw className={`w-5 h-5 text-emerald-500 ${isRefreshing ? 'animate-spin' : ''}`} />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-bold text-slate-800 dark:text-white tracking-wide">Manual Database Sync</h4>
                        <p className="text-xs text-zinc-500 font-sans">Fetch latest verification ledgers.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleManualRefresh}
                      disabled={isRefreshing}
                      className="px-4 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl border transition-all cursor-pointer h-9 flex items-center justify-center border-gray-200 dark:border-white/10 hover:border-emerald-500 bg-gray-100 dark:bg-slate-950 text-slate-800 dark:text-white"
                    >
                      Sync Now
                    </button>
                  </div>

                  {/* 5. Sign Out Option */}
                  {onSignOut && (
                    <button
                      type="button"
                      onClick={onSignOut}
                      className="w-full py-4 text-xs font-black uppercase tracking-widest rounded-2xl border border-red-500/20 hover:border-red-500 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Terminate Session (Sign Out)</span>
                    </button>
                  )}

                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'security' && (
            <motion.div
              key="security-tab"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="space-y-6 scroll-mt-24"
              id="security-section"
            >
              <div className="bg-white dark:bg-[#131B2E] border border-gray-100 dark:border-white/5 rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-md dark:shadow-2xl">
                <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-600/5 blur-[120px] rounded-full pointer-events-none" />
                
                <div className="relative space-y-6">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-black text-emerald-500 tracking-[0.2em] uppercase font-sans">
                      Security & Privacy
                    </span>
                    <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">
                      Security Center
                    </h2>
                  </div>

                  <div className="space-y-4">
                    <div className="p-5 border border-emerald-500/30 bg-emerald-500/10 rounded-2xl flex items-center justify-between">
                      <div className="flex items-start gap-3">
                        <ShieldCheck className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" />
                        <div>
                          <h4 className="text-sm font-black text-slate-800 dark:text-white">Two-Factor Authentication (2FA)</h4>
                          <p className="text-xs text-slate-500 dark:text-white/60 mt-1 pr-4 font-sans leading-relaxed">
                            Require an email OTP verification for every withdrawal request to maximize your account's safety.
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          const newState = !is2faEnabled;
                          setIs2faEnabled(newState);
                          localStorage.setItem('apex_2fa_enabled', newState ? 'true' : 'false');
                          onAddToast(newState ? '2FA Enabled successfully' : '2FA Disabled successfully', 'success');
                        }}
                        className={`relative w-12 h-6 rounded-full transition-colors duration-300 focus:outline-none shrink-0 ${is2faEnabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}
                      >
                        <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform duration-300 ${is2faEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 🚀 HIGH-FIDELITY TIKTOK / YOUTUBE FRIENDLY POPUP WITH SIMULATED VERIFICATION */}
      <AnimatePresence>
        {recentSuccessWithdraw && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="relative w-full max-w-md overflow-hidden rounded-3xl bg-gradient-to-b from-[#111111] to-black border-2 border-[#10B981]/40 hover:border-blue-500/50 shadow-[0_0_80px_rgba(16,185,129,0.25)] p-6 md:p-8 space-y-6 text-center"
            >
              {/* Golden circular glow background effect */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-[#10B981]/15 to-blue-400/5 blur-3xl pointer-events-none" />
              
              <div className="space-y-4">
                <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-[#10B981]/20 to-blue-400/15 flex items-center justify-center border-2 border-[#10B981]/50 relative">
                  {successStep === 'completed' ? (
                    <motion.span 
                      initial={{ scale: 0.5, rotate: -45 }}
                      animate={{ scale: 1, rotate: 0 }}
                      className="text-3xl"
                    >
                      🎉
                    </motion.span>
                  ) : (
                    <RefreshCw className="w-7 h-7 text-[#10B981] animate-spin" />
                  )}
                  {successStep === 'completed' && (
                    <span className="absolute -top-1.5 -right-1.5 text-xs bg-[#10B981] text-black font-black uppercase px-1.5 py-0.5 rounded-full">
                      LIVE
                    </span>
                  )}
                </div>

                <div className="space-y-1.5">
                  <h3 className="text-xl font-black uppercase tracking-wider text-white">
                    {successStep === 'completed' ? '🎉 Withdrawal Successful' : '⚡ Submitting Real-time Request'}
                  </h3>
                  <p className="text-xs text-white/50 tracking-wider">
                    High-Seed Automatic Routing Protocol
                  </p>
                </div>
              </div>

              {/* Glassmorphic payout confirmation values */}
              <div className="p-5 rounded-2xl bg-slate-950/80 border border-white/5 space-y-3">
                <p className="text-[10px] text-white/40 uppercase tracking-widest font-black">Transaction Value Dispatched</p>
                <h4 className="text-3xl font-mono font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-[#D4AF37] to-emerald-400 bg-size-[200%_auto] tracking-tight">
                  {currencySymbol}{(recentSuccessWithdraw.amount * conversionRate).toFixed(2)}
                </h4>
                <div className="h-[1px] bg-white/5" />
                <div className="grid grid-cols-2 gap-2 text-left">
                  <div>
                    <span className="text-[8px] text-white/30 uppercase tracking-widest block font-bold">Network/Type</span>
                    <span className="text-[11px] font-black text-white uppercase tracking-wider block mt-0.5">{recentSuccessWithdraw.network}</span>
                  </div>
                  <div>
                    <span className="text-[8px] text-white/30 uppercase tracking-widest block font-bold">Payout Target</span>
                    <span className="text-[11px] font-mono font-medium text-blue-400 block mt-0.5 truncate select-all" title={recentSuccessWithdraw.wallet}>
                      {recentSuccessWithdraw.wallet}
                    </span>
                  </div>
                </div>
              </div>

              {/* Progress bar and simulated auditing output */}
              <div className="space-y-3.5">
                <div className="flex justify-between items-center text-xs font-mono font-extrabold text-white">
                  <span className="text-[10px] text-white/40 uppercase tracking-wider">
                    {successStep === 'completed' ? '✅ Dispatch Completed' : '⚡ Routing Ledger Verify'}
                  </span>
                  <span className="text-emerald-400">{successProgress}%</span>
                </div>
                
                {/* Visual Progress Bar */}
                <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden border border-white/15 relative">
                  <motion.div 
                    initial={{ width: '0%' }}
                    animate={{ width: `${successProgress}%` }}
                    className="absolute top-0 left-0 bottom-0 bg-gradient-to-r from-[#10B981] via-[#D4AF37] to-[#10B981] bg-[length:200%_auto] rounded-full"
                  />
                </div>

                <div className="flex items-center justify-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${successStep === 'completed' ? 'bg-[#10B981] animate-pulse' : 'bg-amber-500 animate-ping'}`} />
                  <span className="text-[9.5px] font-mono text-white/60 tracking-wider">
                    {successStep === 'completed' 
                      ? '✅ Completed: Sent to ' + recentSuccessWithdraw.network 
                      : 'Syncing with Multi-Auditor Cryptographic Protocol...'
                    }
                  </span>
                </div>
              </div>

              {/* Close Button Trigger */}
              {successStep === 'completed' && (
                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => setRecentSuccessWithdraw(null)}
                  className="w-full py-4 rounded-xl bg-gradient-to-r from-[#10B981] to-[#059669] text-black font-black text-xs uppercase tracking-widest cursor-pointer hover:shadow-[0_0_25px_rgba(16,185,129,0.4)] active:scale-95 transition-all text-center flex items-center justify-center gap-2"
                >
                  <span>🚀 Continue Earning</span>
                </motion.button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🎡 LUCKY SPIN WHEEL GAME MODAL */}
      <AnimatePresence>
        {showSpinModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { if (!isSpinning) setShowSpinModal(false); }}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md z-[100] flex items-center justify-center p-4"
            />
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="absolute top-12 left-1/2 -translate-x-1/2 w-[90%] max-w-sm bg-white dark:bg-[#0f1016] border border-gray-200 dark:border-white/10 rounded-3xl p-6 shadow-2xl z-[101] text-center space-y-5 select-none"
            >
              <div className="flex justify-between items-center pb-2 border-b border-gray-100 dark:border-white/5">
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-white flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-500 animate-spin" />
                  <span>Lucky Spin Wheel</span>
                </h3>
                <button
                  onClick={() => setShowSpinModal(false)}
                  disabled={isSpinning}
                  className="w-7 h-7 rounded-full bg-gray-100 dark:bg-white/5 text-slate-400 hover:text-slate-600 dark:hover:text-white flex items-center justify-center border-0 cursor-pointer disabled:opacity-40"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>

              {/* Animated Virtual Wheel */}
              <div className="relative w-48 h-48 mx-auto flex items-center justify-center">
                {/* Pointer Indicator */}
                <div className="absolute -top-1.5 z-20 text-emerald-500 text-lg animate-bounce">
                  🎯
                </div>
                
                {/* Wheel Body */}
                <div 
                  style={{ transform: `rotate(${spinRotation}deg)`, transition: isSpinning ? 'transform 4s cubic-bezier(0.15, 0.85, 0.35, 1)' : 'none' }}
                  className="w-44 h-44 rounded-full border-4 border-emerald-500 bg-slate-50 dark:bg-slate-950 overflow-hidden relative shadow-lg flex items-center justify-center"
                >
                  {/* Digital Wheel divisions overlay */}
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(34,197,94,0.1),transparent_70%)]" />
                  
                  {/* Wheel segments indicators */}
                  <div className="absolute w-full h-[1px] bg-emerald-500/30 rotate-0" />
                  <div className="absolute w-full h-[1px] bg-emerald-500/30 rotate-45" />
                  <div className="absolute w-full h-[1px] bg-emerald-500/30 rotate-90" />
                  <div className="absolute w-full h-[1px] bg-emerald-500/30 rotate-135" />
                  
                  {/* Custom segment titles */}
                  <span className="absolute top-3 text-[8px] font-black text-emerald-600 dark:text-emerald-400">Rs. 28</span>
                  <span className="absolute right-3 text-[8px] font-black text-[#229ED9]">Rs. 70</span>
                  <span className="absolute bottom-3 text-[8px] font-black text-amber-500">Rs. 14</span>
                  <span className="absolute left-3 text-[8px] font-black text-purple-500">Rs. 140</span>
                  <span className="absolute top-10 right-10 text-[7px] font-semibold text-rose-500 rotate-45">Rs. 280</span>
                  <span className="absolute bottom-10 right-10 text-[7px] font-semibold text-zinc-500 rotate-135">Try Again</span>
                  <span className="absolute bottom-10 left-10 text-[7px] font-semibold text-teal-500 -rotate-135">Rs. 42</span>
                  <span className="absolute top-10 left-10 text-[7px] font-semibold text-yellow-500 -rotate-45">Rs. 22</span>
                </div>
                
                {/* Center Core Hub */}
                <div className="absolute w-10 h-10 rounded-full bg-[#16A34A] border-2 border-white flex items-center justify-center shadow-md z-10">
                  <Award className="w-4 h-4 text-white" />
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="text-[10px] text-slate-400 dark:text-white/40 uppercase tracking-widest font-bold">Spin with automatic balance check</p>
                <h4 className="text-sm font-bold text-slate-800 dark:text-white leading-tight">
                  Win up to <span className="text-emerald-500 font-extrabold">Rs. 280</span> instant payout
                </h4>
              </div>

              {/* Spin Trigger Button */}
              <button
                type="button"
                onClick={handleSpinClick}
                disabled={isSpinning || (Date.now() - lastSpinTime < 48 * 60 * 60 * 1000)}
                className={`w-full py-3.5 rounded-xl text-white font-black text-xs uppercase tracking-widest transition-all shadow-md active:scale-[0.98] cursor-pointer disabled:opacity-50 ${(Date.now() - lastSpinTime < 48 * 60 * 60 * 1000) ? 'bg-slate-500' : 'bg-gradient-to-r from-[#22C55E] to-[#16A34A] shadow-emerald-700/10'}`}
              >
                {isSpinning ? '🌀 Spin Active...' : (Date.now() - lastSpinTime < 48 * 60 * 60 * 1000 ? `⏳ Next spin in ${Math.ceil((48 * 60 * 60 * 1000 - (Date.now() - lastSpinTime)) / (1000 * 60 * 60))}h` : '🔥 Spin Now')}
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 📋 SOCIAL TASK CENTER MODAL */}
      <AnimatePresence>
        {showTasksModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { if (!verifyingTaskId) setShowTasksModal(false); }}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md z-[100] flex items-center justify-center p-4"
            />
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="absolute top-12 left-1/2 -translate-x-1/2 w-[90%] max-w-sm bg-white dark:bg-[#0f1016] border border-gray-200 dark:border-white/10 rounded-3xl p-6 shadow-2xl z-[101] flex flex-col gap-4 select-none"
            >
              <div className="flex justify-between items-center pb-2 border-b border-gray-100 dark:border-white/5">
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-white flex items-center gap-1.5">
                  <CheckSquare className="w-4 h-4 text-emerald-500" />
                  <span>Social Task Hub</span>
                </h3>
                <button
                  onClick={() => setShowTasksModal(false)}
                  disabled={!!verifyingTaskId}
                  className="w-7 h-7 rounded-full bg-gray-100 dark:bg-white/5 text-slate-400 hover:text-slate-600 dark:hover:text-white flex items-center justify-center border-0 cursor-pointer disabled:opacity-40"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>

              <p className="text-[10px] text-slate-400 dark:text-white/40 leading-relaxed font-bold uppercase tracking-wider text-left">
                Complete simple social platform interactions to unlock real-time PKR bonuses credited to your available balance:
              </p>

              {/* Task Items list */}
              <div className="space-y-3 overflow-y-auto max-h-[70vh] pr-1 hide-scrollbar text-left">
                {selectedTaskForSubmission ? (
                  /* SUBMISSION VIEW */
                  <div className="space-y-4 animate-fade-in">
                    <button 
                      onClick={() => {
                        setSelectedTaskForSubmission(null);
                        setScreenshotFile(null);
                        setScreenshotPreview(null);
                      }}
                      className="flex items-center gap-2 text-[10px] font-black uppercase text-blue-500 hover:text-blue-400 transition-colors mb-2 cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Back to Task List
                    </button>
                    
                    <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center gap-2">
                         <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${
                           selectedTaskForSubmission.platform === 'YouTube' ? 'bg-red-500 text-white' :
                           selectedTaskForSubmission.platform === 'TikTok' ? 'bg-white text-black' :
                           'bg-blue-600 text-white'
                         }`}>
                           {selectedTaskForSubmission.platform}
                         </span>
                         <h4 className="text-xs font-black text-white">{selectedTaskForSubmission.title}</h4>
                      </div>
                      <p className="text-[10px] text-white/40 leading-relaxed">{selectedTaskForSubmission.description}</p>
                    </div>

                    <div className="space-y-4">
                       <div className="space-y-2">
                         <p className="text-[9px] font-black uppercase text-white/50 tracking-wider">Step 1: Open Task & Complete</p>
                         <button
                           onClick={() => handleOpenTask(selectedTaskForSubmission)}
                           className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-black font-black text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-blue-500/10 flex items-center justify-center gap-2 cursor-pointer"
                         >
                           <ExternalLink className="w-3.5 h-3.5" />
                           Open Task Link
                         </button>
                       </div>

                       <div className="space-y-3 pt-2">
                         <p className="text-[9px] font-black uppercase text-white/50 tracking-wider">Step 2: Upload Proof Screenshot</p>
                         
                         {screenshotPreview ? (
                           <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-black aspect-video group">
                             <img src={screenshotPreview} alt="Preview" className="w-full h-full object-contain" />
                             <button 
                               onClick={() => {
                                 setScreenshotFile(null);
                                 setScreenshotPreview(null);
                               }}
                               className="absolute top-2 right-2 w-8 h-8 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                             >
                               ✕
                             </button>
                           </div>
                         ) : (
                           <label className="block w-full border-2 border-dashed border-white/10 rounded-2xl p-8 hover:border-blue-500/30 transition-all cursor-pointer text-center group">
                             <input 
                               type="file" 
                               accept="image/*" 
                               onChange={handleScreenshotChange}
                               className="hidden" 
                             />
                             <div className="space-y-2">
                               <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center mx-auto text-white/30 group-hover:text-blue-400 transition-colors">
                                 <Upload className="w-5 h-5" />
                               </div>
                               <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Select Screenshot</p>
                               <p className="text-[8px] text-white/20 uppercase font-mono">JPG, PNG, JPEG (MAX 5MB)</p>
                             </div>
                           </label>
                         )}
                       </div>

                       <button
                         onClick={handleSubmitTask}
                         disabled={!screenshotFile || isSubmittingTask}
                         className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-30 disabled:hover:bg-emerald-500 text-black font-black text-[11px] uppercase tracking-[0.2em] rounded-2xl transition-all shadow-xl shadow-emerald-500/10 mt-2 cursor-pointer"
                       >
                         {isSubmittingTask ? `Uploading ${uploadProgress}%...` : "Submit for Verification"}
                       </button>
                    </div>
                  </div>
                ) : (
                  /* TASK LIST VIEW */
                  <div className="space-y-3">
                    {tasks && tasks.filter(t => t.status === 'Active').length > 0 ? (
                      tasks.filter(t => t.status === 'Active').map((task) => {
                        const submission = taskSubmissions.find(s => s.taskId === task.id && s.userId === userId);
                        const isCompleted = submission?.status === 'Approved';
                        const isPending = submission?.status === 'Pending';
                        
                        return (
                          <div 
                            key={task.id}
                            className="p-4 rounded-2xl border border-gray-150 dark:border-white/5 bg-gray-50 dark:bg-slate-900/40 flex flex-col gap-3 transition-all hover:border-blue-500/20"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${
                                  task.platform === 'YouTube' ? 'bg-red-500 text-white' :
                                  task.platform === 'TikTok' ? 'bg-white text-black' :
                                  'bg-blue-600 text-white'
                                }`}>
                                  {task.platform}
                                </span>
                                <span className="text-xs font-black text-slate-800 dark:text-white line-clamp-1">{task.title}</span>
                              </div>
                              <span className="text-xs font-black text-emerald-500 shrink-0">+${task.reward.toFixed(2)}</span>
                            </div>

                            <p className="text-[9px] text-slate-500 dark:text-white/30 line-clamp-1">{task.description}</p>

                            {isCompleted ? (
                              <div className="text-[9px] text-emerald-500 font-black uppercase flex items-center gap-1.5 pt-1">
                                <CheckCircle className="w-3.5 h-3.5" />
                                <span>Reward Credited</span>
                              </div>
                            ) : isPending ? (
                              <div className="text-[9px] text-amber-500 font-black uppercase flex items-center gap-1.5 pt-1">
                                <Clock className="w-3.5 h-3.5 animate-pulse" />
                                <span>Awaiting Review</span>
                              </div>
                            ) : (
                              <button
                                onClick={() => setSelectedTaskForSubmission(task)}
                                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-black font-black text-[9px] uppercase tracking-widest cursor-pointer transition-all border-0 shadow-lg shadow-blue-500/10"
                              >
                                View Task Details
                              </button>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="py-12 text-center border border-dashed border-gray-200 dark:border-white/10 rounded-2xl">
                        <p className="text-[9px] text-slate-400 dark:text-white/20 uppercase tracking-[0.2em] font-black">No Active Tasks Available</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>



      {/* 🏆 LEADERBOARD MODAL */}
      <AnimatePresence>
        {showLeaderboardModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLeaderboardModal(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md z-[100] flex items-center justify-center p-4"
            />
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="absolute top-12 left-1/2 -translate-x-1/2 w-[90%] max-w-sm bg-white dark:bg-[#0f1016] border border-gray-200 dark:border-white/10 rounded-3xl p-6 shadow-2xl z-[101] text-left space-y-4 select-none"
            >
              <div className="flex justify-between items-center pb-2 border-b border-gray-100 dark:border-white/5">
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-white flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-emerald-500" />
                  <span>Earner Hall of Fame</span>
                </h3>
                <button
                  onClick={() => setShowLeaderboardModal(false)}
                  className="w-7 h-7 rounded-full bg-gray-100 dark:bg-white/5 text-slate-400 hover:text-slate-600 dark:hover:text-white flex items-center justify-center border-0 cursor-pointer"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2.5">
                {[
                  { rank: 1, name: 'Daniyal Khan', city: 'Rawalpindi', profit: '₨ 342,800', crown: '🥇' },
                  { rank: 2, name: 'Ayesha Malik', city: 'Lahore', profit: '₨ 289,500', crown: '🥈' },
                  { rank: 3, name: 'Zainab Shah', city: 'Karachi', profit: '₨ 194,200', crown: '🥉' },
                  { rank: 4, name: 'Danish Danish', city: 'Faisalabad', profit: '₨ 150,400', crown: '👑' },
                  { rank: 5, name: 'Hamza Ali', city: 'Islamabad', profit: '₨ 120,500', crown: '⭐' },
                ].map((user) => (
                  <div 
                    key={user.rank}
                    className="p-3 rounded-xl border border-gray-150 dark:border-white/5 bg-gray-50 dark:bg-slate-900/40 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{user.crown}</span>
                      <div>
                        <h4 className="text-xs font-black text-slate-800 dark:text-white">{user.name}</h4>
                        <span className="text-[8.5px] text-slate-400 dark:text-white/30 font-medium uppercase tracking-wider">{user.city}</span>
                      </div>
                    </div>
                    <span className="text-xs font-black text-[#16A34A]">{user.profit}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 🎟 GIFT CARD REDEEM MODAL */}
      <AnimatePresence>
        {showGiftModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowGiftModal(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md z-[100] flex items-center justify-center p-4"
            />
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="absolute top-12 left-1/2 -translate-x-1/2 w-[90%] max-w-sm bg-white dark:bg-[#0f1016] border border-gray-200 dark:border-white/10 rounded-3xl p-6 shadow-2xl z-[101] text-center space-y-5 select-none"
            >
              <div className="flex justify-between items-center pb-2 border-b border-gray-100 dark:border-white/5">
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-white flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-emerald-500" />
                  <span>Promo Voucher</span>
                </h3>
                <button
                  onClick={() => setShowGiftModal(false)}
                  className="w-7 h-7 rounded-full bg-gray-100 dark:bg-white/5 text-slate-400 hover:text-slate-600 dark:hover:text-white flex items-center justify-center border-0 cursor-pointer"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2 text-left">
                <label className="text-[9px] uppercase tracking-widest text-slate-400 dark:text-white/30 font-bold block">Enter Promo Voucher Code</label>
                <input 
                  type="text"
                  placeholder="Enter your code here"
                  value={giftCode}
                  onChange={(e) => setGiftCode(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-250 dark:border-white/10 bg-gray-50 dark:bg-slate-950/60 text-slate-800 dark:text-white font-mono text-sm uppercase font-bold tracking-wider text-center outline-none focus:border-[#16A34A] transition-all"
                />
                <div className="space-y-3 mt-3">
                  <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-white/5">
                    <p className="text-[11px] text-slate-700 dark:text-slate-300 font-bold leading-relaxed text-center mb-2">
                      🎁 JOIN OUR OFFICIAL WHATSAPP GROUP 🎁<br/><br/>
                      Get the latest Promo Codes before everyone else!<br/><br/>
                      💰 WIN UP TO PKR 500 💰<br/><br/>
                      Promo codes are shared ONLY in our official WhatsApp Group.
                    </p>
                    <a
                      href="https://whatsapp.com/channel/0029VbAa01YEKyZNN2FRqe1v"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full py-3 rounded-lg bg-emerald-500 text-white font-black text-[11px] uppercase tracking-widest text-center hover:bg-emerald-600 transition-all border-0"
                    >
                      👇 Join Now 👇
                    </a>
                  </div>
                </div>

              </div>

              <button
                type="button"
                onClick={handleRedeemGiftCode}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#22C55E] to-[#16A34A] text-white font-black text-xs uppercase tracking-widest cursor-pointer hover:brightness-105 active:scale-95 transition-all text-center border-0"
              >
                Claim Free Dividends
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 🔔 NOTIFICATIONS INBOX MODAL */}
      <AnimatePresence>
        {showNotificationModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowNotificationModal(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md z-[100] flex items-center justify-center p-4"
            />
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="absolute top-12 left-1/2 -translate-x-1/2 w-[90%] max-w-sm bg-white dark:bg-[#0f1016] border border-gray-200 dark:border-white/10 rounded-3xl p-6 shadow-2xl z-[101] text-left space-y-4 select-none"
            >
              <div className="flex justify-between items-center pb-2 border-b border-gray-100 dark:border-white/5">
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-white flex items-center gap-1.5">
                  <Bell className="w-4 h-4 text-emerald-500 animate-swing" />
                  <span>System Bulletins</span>
                </h3>
                <button
                  onClick={() => setShowNotificationModal(false)}
                  className="w-7 h-7 rounded-full bg-gray-100 dark:bg-white/5 text-slate-400 hover:text-slate-600 dark:hover:text-white flex items-center justify-center border-0 cursor-pointer"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 max-h-80 overflow-y-auto pr-1 hide-scrollbar">
                {[
                  { id: 1, title: '🔐 Security PIN Configured', msg: 'Your withdrawal private PIN audit has been validated. Multi-auditing logs successfully registered on the cloud.', date: 'Today' },
                  { id: 2, title: '💚 PKR Liquidity Pool Injection', msg: 'Platform reserves successfully expanded. Direct instant bank payouts are running with 100% automated settlement routing.', date: 'Yesterday' },
                  { id: 3, title: '🚀 MoneyMind Space Revamp', msg: 'Welcome to the premium MoneyMind Space! Experience lightning-fast automatic loading and sleek glassmorphism themes.', date: 'July 2026' }
                ].map((item) => (
                  <div key={item.id} className="p-3.5 rounded-xl border border-gray-150 dark:border-white/5 bg-gray-50 dark:bg-slate-900/40 space-y-1">
                    <div className="flex justify-between items-baseline">
                      <h4 className="text-xs font-black text-slate-800 dark:text-white">{item.title}</h4>
                      <span className="text-[8px] font-bold text-slate-400 dark:text-white/30 uppercase">{item.date}</span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-white/60 leading-relaxed font-medium">{item.msg}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 📊 WITHDRAWAL PROGRESS STEPPER MODAL */}
      <AnimatePresence>
        {showWithdrawalProgressModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowWithdrawalProgressModal(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md z-[100] flex items-center justify-center p-4"
            />
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="absolute top-12 left-1/2 -translate-x-1/2 w-[90%] max-w-sm bg-white dark:bg-[#0f1016] border border-gray-200 dark:border-white/10 rounded-3xl p-6 shadow-2xl z-[101] text-left space-y-4 select-none"
            >
              <div className="flex justify-between items-center pb-2 border-b border-gray-100 dark:border-white/5">
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-white flex items-center gap-1.5">
                  <RefreshCw className="w-4 h-4 text-emerald-500 animate-spin" />
                  <span>Withdrawal Stepper</span>
                </h3>
                <button
                  onClick={() => setShowWithdrawalProgressModal(false)}
                  className="w-7 h-7 rounded-full bg-gray-100 dark:bg-white/5 text-slate-400 hover:text-slate-600 dark:hover:text-white flex items-center justify-center border-0 cursor-pointer"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4 pt-1 text-left">
                {[
                  { step: '1', title: 'Request Dispatched', desc: 'Secure transaction ticket submitted.', status: 'completed' },
                  { step: '2', title: 'Cryptographic Audit', desc: 'Validating cryptographic block signatures.', status: 'active' },
                  { step: '3', title: 'Liquidity Pool Lock', desc: 'Reserving payout channels in bank portal.', status: 'pending' },
                  { step: '4', title: 'Completed Settlement', desc: 'Disbursed directly into your local account.', status: 'pending' }
                ].map((s, idx) => (
                  <div key={idx} className="flex gap-3.5 relative">
                    {/* Line connector */}
                    {idx < 3 && (
                      <div className="absolute top-6 left-3 w-[1.5px] h-9 bg-gray-150 dark:bg-white/10" />
                    )}
                    
                    <div className={`w-6.5 h-6.5 rounded-full border-2 flex items-center justify-center font-bold text-[10px] shrink-0 z-10 ${
                      s.status === 'completed' 
                        ? 'border-emerald-500 bg-emerald-500 text-white' 
                        : s.status === 'active' 
                        ? 'border-[#16A34A] bg-[#16A34A]/10 text-[#16A34A] animate-pulse' 
                        : 'border-gray-200 dark:border-white/10 bg-transparent text-slate-400 dark:text-white/30'
                    }`}>
                      {s.status === 'completed' ? '✓' : s.step}
                    </div>

                    <div>
                      <h4 className={`text-xs font-black uppercase tracking-wider ${s.status === 'completed' || s.status === 'active' ? 'text-slate-800 dark:text-white' : 'text-slate-400 dark:text-white/30'}`}>
                        {s.title}
                      </h4>
                      <p className="text-[10px] text-slate-500 dark:text-white/60 leading-normal font-sans mt-0.5">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 🔮 GLASSMORPHIC BOTTOM DRAWER FOR QUICK ACTIONS (DEPOSIT & WITHDRAW) */}
      <AnimatePresence>
        {showQuickActionsDrawer && (
          <>
            {/* Backdrop Blur overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowQuickActionsDrawer(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md z-[80]"
            />
            {/* Glassmorphic Sheet */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="absolute bottom-0 left-0 right-0 bg-white/30 dark:bg-black/40 backdrop-blur-2xl border-t border-white/20 rounded-t-[32px] p-6 z-[90] shadow-[0_-15px_30px_rgba(0,0,0,0.3)] flex flex-col gap-5 select-none"
            >
              {/* Drag Handle Decor */}
              <div className="w-12 h-1 bg-white/30 rounded-full mx-auto mb-1" />

              <div className="text-center space-y-1">
                <h3 className="text-sm font-black uppercase tracking-widest text-white">Quick Actions Gateway</h3>
                <p className="text-[10px] text-white/60 font-sans">Choose an action below for instant automated settlement.</p>
              </div>

              {/* Action Buttons Grid */}
              <div className="grid grid-cols-2 gap-4">
                {/* Deposit action */}
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('funding');
                    setShowQuickActionsDrawer(false);
                    playSound('new_referral');
                    onAddToast('Redirected to deposit gateway.', 'success');
                  }}
                  className="flex flex-col items-center justify-center p-4 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 hover:from-emerald-500/30 border border-emerald-500/30 hover:border-emerald-500/50 transition-all group cursor-pointer text-white gap-2.5 shadow-lg"
                >
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center transition-transform group-hover:scale-110">
                    <ArrowDownLeft className="w-6 h-6 text-emerald-400" />
                  </div>
                  <span className="text-xs font-black uppercase tracking-widest font-sans">Deposit Cash</span>
                  <span className="text-[8px] text-emerald-300 font-mono tracking-wider">Local/Crypto Channels</span>
                </button>

                {/* Withdraw action */}
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('funding');
                    setShowQuickActionsDrawer(false);
                    playSound('new_referral');
                    onAddToast('Redirected to withdrawal gateway.', 'success');
                  }}
                  className="flex flex-col items-center justify-center p-4 rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 hover:from-blue-500/30 border border-blue-500/30 hover:border-blue-500/50 transition-all group cursor-pointer text-white gap-2.5 shadow-lg"
                >
                  <div className="w-12 h-12 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center transition-transform group-hover:scale-110">
                    <ArrowUpRight className="w-6 h-6 text-blue-400" />
                  </div>
                  <span className="text-xs font-black uppercase tracking-widest font-sans">Withdraw Cash</span>
                  <span className="text-[8px] text-blue-300 font-mono tracking-wider">Instant Local Payouts</span>
                </button>
              </div>

              {/* Cancel Button */}
              <button
                type="button"
                onClick={() => setShowQuickActionsDrawer(false)}
                className="w-full py-3.5 text-xs font-black uppercase tracking-widest text-white/80 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl transition-all cursor-pointer"
              >
                Cancel / Back
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showOTPModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-[#131B2E] border border-blue-500/20 rounded-[32px] p-6 max-w-sm w-full shadow-2xl relative overflow-hidden text-center"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-[100px] rounded-full pointer-events-none" />
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/40 mb-4 text-emerald-400">
                  <ShieldCheck className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-black text-white mb-2">Security Verification</h3>
                <p className="text-xs text-white/60 mb-6 px-4">
                  For your safety, 2FA is required for this withdrawal. We've sent a 6-digit code to your registered email address.
                </p>

                <div className="w-full mb-4">
                  <input
                    type="text"
                    maxLength={6}
                    value={otpInput}
                    onChange={(e) => {
                      setOtpInput(e.target.value.replace(/\D/g, ''));
                      setOtpError('');
                    }}
                    placeholder="Enter 6-digit OTP"
                    className="w-full bg-[#0A0F1C] border border-white/10 rounded-xl px-4 py-4 text-center text-2xl font-mono text-white tracking-[0.5em] focus:outline-none focus:border-emerald-500/50 transition-colors"
                  />
                  {otpError && (
                    <p className="text-red-400 text-[10px] mt-2 font-bold uppercase tracking-widest">{otpError}</p>
                  )}
                </div>

                <div className="w-full flex gap-3">
                  <button 
                    onClick={() => {
                      setShowOTPModal(false);
                      setOtpInput('');
                      pendingWithdrawalRef.current = null;
                    }}
                    className="flex-1 py-3.5 rounded-xl border border-white/10 text-white/70 text-xs font-black uppercase tracking-widest hover:bg-white/5 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={execute2FAVerified}
                    className="flex-1 py-3.5 rounded-xl bg-emerald-500 text-slate-900 text-xs font-black uppercase tracking-widest hover:brightness-110 transition-all"
                  >
                    Verify
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <EmailVerificationModal
        isOpen={showEmailVerificationModal}
        onClose={() => setShowEmailVerificationModal(false)}
        email={userProfile?.email || ''}
        onVerifySuccess={async () => {
          if (onVerifyEmail) {
            await onVerifyEmail();
          }
        }}
        onAddToast={onAddToast}
      />

      {/* 📱 STICKY BOTTOM NAVIGATION BAR (Screenshot style: Home, Funding, FAQ, Profile) */}
      {activeTab === 'overview' && (
        <div className="fixed bottom-0 left-0 right-0 max-w-5xl mx-auto bg-white/95 dark:bg-[#131B2E]/95 backdrop-blur-md border-t border-gray-100 dark:border-white/5 py-2.5 px-3 flex items-center justify-around z-40 select-none shadow-[0_-5px_30px_rgba(0,0,0,0.15)] md:rounded-t-3xl">
          <button 
            onClick={() => setActiveTab('overview')}
            className={`flex flex-col items-center gap-1 bg-transparent border-0 cursor-pointer transition-all ${activeTab === 'overview' ? 'text-emerald-500 scale-105 font-bold font-sans' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-sans'}`}
          >
            <Home className="w-5 h-5" />
            <span className="text-[9px] uppercase tracking-wider">Home</span>
          </button>

          <button 
            onClick={() => setActiveTab('funding')}
            className={`flex flex-col items-center gap-1 bg-transparent border-0 cursor-pointer transition-all ${activeTab === 'funding' ? 'text-emerald-500 scale-105 font-bold font-sans' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-sans'}`}
          >
            <Wallet className="w-5 h-5" />
            <span className="text-[9px] uppercase tracking-wider font-sans">Funding</span>
          </button>

          {/* Floating Quick Actions Plus Trigger */}
          <button 
            onClick={() => setShowQuickActionsDrawer(true)}
            className="flex flex-col items-center justify-center -mt-6 w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-[0_4px_20px_rgba(16,185,129,0.4)] border-4 border-white dark:border-[#131B2E] cursor-pointer transition-transform hover:scale-110 active:scale-95 z-50 group"
            title="Quick Actions"
          >
            <Plus className="w-5 h-5 text-white transition-transform group-hover:rotate-90 duration-300" />
          </button>

          <button 
            onClick={() => setActiveTab('faq')}
            className={`flex flex-col items-center gap-1 bg-transparent border-0 cursor-pointer transition-all ${activeTab === 'faq' ? 'text-emerald-500 scale-105 font-bold font-sans' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-sans'}`}
          >
            <HelpCircle className="w-5 h-5" />
            <span className="text-[9px] uppercase tracking-wider font-sans">FAQ</span>
          </button>

          <button 
            onClick={() => setActiveTab('settings')}
            className={`flex flex-col items-center gap-1 bg-transparent border-0 cursor-pointer transition-all ${activeTab === 'settings' ? 'text-emerald-500 scale-105 font-bold font-sans' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-sans'}`}
          >
            <User className="w-5 h-5" />
            <span className="text-[9px] uppercase tracking-wider font-sans">Profile</span>
          </button>

          <button 
            onClick={() => setActiveTab('security')}
            className={`flex flex-col items-center gap-1 bg-transparent border-0 cursor-pointer transition-all ${activeTab === 'security' ? 'text-emerald-500 scale-105 font-bold font-sans' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-sans'}`}
          >
            <ShieldCheck className="w-5 h-5" />
            <span className="text-[9px] uppercase tracking-wider font-sans">Security</span>
          </button>
        </div>
      )}
    </div>
  );
}
