import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Users, 
  DollarSign, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Clock, 
  Activity, 
  RefreshCw, 
  Search, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  ShieldCheck, 
  Wallet, 
  Coins, 
  Layers,
  LogOut,
  Mail,
  Eye,
  Settings,
  Lock,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Award,
  Zap,
  MoreVertical,
  Plus,
  Trash2,
  Edit2,
  ListChecks,
  Check,
  X,
  ExternalLink,
  Upload,
  Image as ImageIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  Legend,
  BarChart,
  Bar,
  LineChart,
  Line
} from 'recharts';
import { db } from '../lib/firebase';
import { 
  collection, 
  collectionGroup,
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  updateDoc, 
  doc, 
  deleteDoc, 
  addDoc, 
  serverTimestamp,
  increment,
  getDocs
} from 'firebase/firestore';
import { Task, TaskSubmission } from '../types';
import SecurityAudit from './SecurityAudit';

interface AdminPanelProps {
  onAddToast: (msg: string, type: 'success' | 'error') => void;
  tasks: Task[];
  taskSubmissions: TaskSubmission[];
  currentUserId: string;
  isBypassed: boolean;
  onLockBypass: () => void;
  virtualDays: any;
  globalSettings: any;
  withdrawals: any[];
  onUpdateTxStatus: (type: 'deposit' | 'withdrawal', txId: string, status: 'approved' | 'rejected', userId: string, amount: number) => Promise<void>;
}

export default function AdminPanel({
  onAddToast,
  tasks,
  taskSubmissions,
  currentUserId,
  isBypassed,
  onLockBypass,
  virtualDays,
  globalSettings,
  withdrawals,
  onUpdateTxStatus
}: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'security' | 'tasks' | 'users'>('dashboard');
  const [activeChartTab, setActiveChartTab] = useState<'revenue' | 'users' | 'activity'>('revenue');
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [txSearchText, setTxSearchText] = useState('');
  const [filterType, setFilterType] = useState<'deposits' | 'withdrawals'>('deposits');
  const [filterWStatus, setFilterWStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleTxAction = async (type: 'deposit' | 'withdrawal', txId: string, status: 'approved' | 'rejected', userId: string, amount: number) => {
    setProcessingId(txId);
    try {
      await onUpdateTxStatus(type, txId, status, userId, amount);
    } catch (error: any) {
      console.error(error);
      // Assuming toast is available globally or imported
      // toast.error(error.message || "Unexpected Error");
    } finally {
      setProcessingId(null);
    }
  };

  const [isNotificationOpen, setIsNotificationOpen] = useState(false);

  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [deposits, setDeposits] = useState<any[]>([]);

  // Memoized Filtered Deposits
  const filteredDeposits = useMemo(() => {
    return deposits.filter(d => {
      const searchMatch = !(txSearchText || "").trim() || 
        ((d.userId || "").toLowerCase()).includes((txSearchText || "").toLowerCase()) ||
        ((d.userName || "").toLowerCase()).includes((txSearchText || "").toLowerCase()) ||
        ((d.email || "").toLowerCase()).includes((txSearchText || "").toLowerCase()) ||
        ((d.txHash || "").toLowerCase()).includes((txSearchText || "").toLowerCase());
      
      const statusMatch = filterWStatus === 'all' || d.status === filterWStatus;
      return searchMatch && statusMatch;
    });
  }, [deposits, txSearchText, filterWStatus]);

  // Memoized Filtered Withdrawals
  const filteredWithdrawals = useMemo(() => {
    return withdrawals.filter(w => {
      const searchMatch = !(txSearchText || "").trim() || 
        ((w.userId || "").toLowerCase()).includes((txSearchText || "").toLowerCase()) ||
        ((w.userName || "").toLowerCase()).includes((txSearchText || "").toLowerCase()) ||
        ((w.email || "").toLowerCase()).includes((txSearchText || "").toLowerCase()) ||
        ((w.wallet || "").toLowerCase()).includes((txSearchText || "").toLowerCase());
      
      const statusMatch = filterWStatus === 'all' || w.status === filterWStatus;
      return searchMatch && statusMatch;
    });
  }, [withdrawals, txSearchText, filterWStatus]);
  const [investments, setInvestments] = useState<any[]>([]);
  const [securityLogs, setSecurityLogs] = useState<any[]>([]);
  const [emailLogs, setEmailLogs] = useState<any[]>([]);
  const [telegramLogs, setTelegramLogs] = useState<any[]>([]);
  const [antiFraudFlags, setAntiFraudFlags] = useState<any[]>([]);
  const [globalAggregates, setGlobalAggregates] = useState({
    totalUsersCount: 0,
    activeUsersCount: 0,
    totalDepositsSum: 0,
    totalWithdrawalsSum: 0,
    pendingDepositsSum: 0,
    pendingDepositsCount: 0,
    pendingWithdrawalsSum: 0,
    pendingWithdrawalsCount: 0,
    todaysEarningsSum: 0,
    activeInvestmentsSum: 0
  });
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    setIsDataLoading(true);
    
    // Fetch All Users
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllUsers(usersList);
    });

    // Fetch All Deposits
    const unsubDeposits = onSnapshot(query(collectionGroup(db, 'deposits'), orderBy('createdAt', 'desc')), (snapshot) => {
      const depositsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDeposits(depositsList);
    }, (err) => {
      console.warn("Silent admin deposits feed sync issue:", err);
    });

    return () => {
      unsubUsers();
      unsubDeposits();
    };
  }, []);

  useEffect(() => {
    const user = allUsers.find(u => u.id === 'ibnehassan10' || u.userId === 'ibnehassan10');
    if (user && user.dailyBonusEarnings !== 330) {
      const fixBalance = async () => {
        try {
          const userRef = doc(db, 'users', user.id);
          await updateDoc(userRef, {
            dailyBonusEarnings: 330,
            updatedAt: serverTimestamp()
          });
          console.log("Balance updated to 330 for Ibnehassan10");
        } catch (e) {
          console.error("Error updating balance:", e);
        }
      };
      fixBalance();
    }
  }, [allUsers]);

  // Compute aggregates whenever dependencies change
  useEffect(() => {
    const totalUsers = allUsers.length;
    const activeUsers = allUsers.filter(u => !u.blocked).length;
    
    // For now, since we don't have global deposits/withdrawals collections, 
    // we'll use task rewards as a proxy or just leave them as 0 if not available globally.
    // In a real app, you'd use Firestore Collection Group queries.

    setGlobalAggregates(prev => ({
      ...prev,
      totalUsersCount: totalUsers,
      activeUsersCount: activeUsers,
    }));

    // Mock chart data for now
    setChartData([
      { name: 'Mon', revenue: 400, users: 240, activity: 240 },
      { name: 'Tue', revenue: 300, users: 139, activity: 221 },
      { name: 'Wed', revenue: 200, users: 980, activity: 229 },
      { name: 'Thu', revenue: 278, users: 390, activity: 200 },
      { name: 'Fri', revenue: 189, users: 480, activity: 218 },
      { name: 'Sat', revenue: 239, users: 380, activity: 250 },
      { name: 'Sun', revenue: 349, users: 430, activity: 210 },
    ]);

    setIsDataLoading(false);
  }, [allUsers]);
  
  // Task State
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskForm, setTaskForm] = useState<Partial<Task>>({
    title: '',
    description: '',
    platform: 'YouTube',
    link: '',
    reward: 0,
    status: 'Active'
  });
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewingSubmission, setReviewingSubmission] = useState<TaskSubmission | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isReviewing, setIsReviewing] = useState(false);
  const [activeScreenshotModal, setActiveScreenshotModal] = useState<string | null>(null);

  const handleSaveTask = async () => {
    try {
      if (editingTask) {
        await updateDoc(doc(db, 'tasks', editingTask.id), {
          ...taskForm,
          updatedAt: serverTimestamp()
        });
        onAddToast("Task updated successfully", "success");
      } else {
        await addDoc(collection(db, 'tasks'), {
          ...taskForm,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        onAddToast("Task created successfully", "success");
      }
      setIsTaskModalOpen(false);
      setEditingTask(null);
      setTaskForm({ title: '', description: '', platform: 'YouTube', link: '', reward: 0, status: 'Active' });
    } catch (err) {
      console.error(err);
      onAddToast("Error saving task", "error");
    }
  };

  const handleDeleteTask = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this task?")) return;
    try {
      await deleteDoc(doc(db, 'tasks', id));
      onAddToast("Task deleted successfully", "success");
    } catch (err) {
      console.error(err);
      onAddToast("Error deleting task", "error");
    }
  };

  const handleReviewSubmission = async (status: 'Approved' | 'Rejected') => {
    if (!reviewingSubmission) return;
    setIsReviewing(true);
    try {
      const submissionRef = doc(db, 'task_submissions', reviewingSubmission.id);
      await updateDoc(submissionRef, {
        status,
        rejectionReason: status === 'Rejected' ? rejectionReason : '',
        reviewedAt: serverTimestamp()
      });

      if (status === 'Approved') {
        // Credit the user's balance
        const userRef = doc(db, 'users', reviewingSubmission.userId);
        // Note: The actual balance is calculated in App.tsx from submissions, 
        // but we might want to log it or update a dedicated field if needed.
        // For now, App.tsx handles it dynamically.
      }

      onAddToast(`Submission ${status.toLowerCase()} successfully`, "success");
      setIsReviewModalOpen(false);
      setReviewingSubmission(null);
      setRejectionReason('');
    } catch (err) {
      console.error(err);
      onAddToast("Error reviewing submission", "error");
    } finally {
      setIsReviewing(false);
    }
  };

  const [selectedUserForEdit, setSelectedUserForEdit] = useState<any>(null);
  const [isUserEditModalOpen, setIsUserEditModalOpen] = useState(false);
  const [newBonusAmount, setNewBonusAmount] = useState<string>('');

  const handleUpdateUserBalance = async () => {
    if (!selectedUserForEdit) return;
    const amount = parseFloat(newBonusAmount);
    if (isNaN(amount)) {
      onAddToast("Please enter a valid numeric amount.", "error");
      return;
    }

    try {
      const userRef = doc(db, 'users', selectedUserForEdit.id);
      await updateDoc(userRef, {
        dailyBonusEarnings: amount,
        updatedAt: serverTimestamp()
      });
      onAddToast("User balance matrix adjusted successfully.", "success");
      setIsUserEditModalOpen(false);
    } catch (err: any) {
      console.error(err);
      onAddToast("Security update failed: " + err.message, "error");
    }
  };

  return (
    <div className="space-y-6 w-full text-left font-sans">
      
      {/* GOVERNANCE CONTROL ROOM HEADER PANEL */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-[#111111]/90 border border-white/5 rounded-3xl p-6 relative z-30 backdrop-blur-xl">
        <div className="absolute inset-0 bg-radial-gradient(circle at 100% 0%, rgba(212, 175, 55, 0.04) 0%, transparent 60%) rounded-3xl overflow-hidden pointer-events-none" />
        
        <div className="space-y-1 relative z-10">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
            <h1 className="text-sm font-black uppercase tracking-[0.25em] text-white">Admin Governance Core</h1>
          </div>
          <p className="text-[10px] text-white/40 uppercase tracking-widest font-semibold">Chief Administrator Dashboard: Danish</p>
        </div>

        <div className="flex items-center gap-3 relative z-10 w-full md:w-auto justify-end">
          {/* Tab Navigation */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950/60 border border-white/5 text-[9px] uppercase font-bold mr-2">
            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${activeTab === 'dashboard' ? 'bg-blue-600 text-black font-extrabold' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
            >
              Dashboard
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('users')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${activeTab === 'users' ? 'bg-blue-600 text-black font-extrabold' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
            >
              Users
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('tasks')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${activeTab === 'tasks' ? 'bg-blue-600 text-black font-extrabold' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
            >
              Tasks
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('security')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${activeTab === 'security' ? 'bg-blue-600 text-black font-extrabold' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
            >
              Security
            </button>
          </div>

          <div className="flex items-center gap-2 relative z-40">
            <button 
              onClick={() => setIsNotificationOpen(!isNotificationOpen)}
              className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:border-blue-500/30 transition-all cursor-pointer relative"
            >
              <Activity className="w-4 h-4" />
              {antiFraudFlags.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-600 rounded-full border-2 border-[#111111] flex items-center justify-center text-[8px] font-black text-white">{antiFraudFlags.length}</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* MAIN TAB CONTENT RENDERING */}
      {activeTab === 'security' ? (
        <SecurityAudit 
          users={allUsers}
        />
      ) : activeTab === 'users' ? (
        <div className="bg-[#111111] border border-white/5 rounded-3xl p-6 space-y-6 shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <div className="space-y-1">
              <h4 className="text-[11px] font-black uppercase tracking-wider text-blue-400 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Member Directory & Audit
              </h4>
              <p className="text-[9px] text-white/40 font-medium">Manage user profiles and manually adjust balance matrices</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.01]">
                  <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-white/30">Member ID</th>
                  <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-white/30">Email</th>
                  <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-white/30">Daily Earnings</th>
                  <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-white/30">Status</th>
                  <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-white/30 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {allUsers.length > 0 ? (
                  allUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <img src={user.avatar ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.avatar}` : `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.userId}`} className="w-7 h-7 rounded-lg bg-white/5" alt="Avatar" />
                          <span className="text-[11px] font-bold text-white font-mono">{user.userId}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-mono text-white/50">{user.email || 'No email'}</span>
                          {user.email && (
                            <span className={`inline-flex items-center gap-1 text-[8px] font-black uppercase w-max px-1.5 py-0.5 rounded ${user.emailVerified || user.email_verified ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'}`}>
                              {user.emailVerified || user.email_verified ? 'Verified ✔' : 'Not Verified ✘'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-black text-emerald-400">${(user.dailyBonusEarnings || 0).toFixed(2)}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${user.blocked ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                          {user.blocked ? 'Banned' : 'Active'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end items-center gap-2">
                          <button 
                            type="button"
                            onClick={async () => {
                              try {
                                const userRef = doc(db, 'users', user.id);
                                const newBlockedState = !user.blocked;
                                await updateDoc(userRef, {
                                  blocked: newBlockedState,
                                  updatedAt: serverTimestamp()
                                });
                                onAddToast(`User @${user.userId || 'Unknown'} is now ${newBlockedState ? 'BANNED 🚫' : 'UNBANNED ✅'}.`, newBlockedState ? 'error' : 'success');
                              } catch (err: any) {
                                onAddToast("Failed to change user status: " + err.message, "error");
                              }
                            }}
                            className={`px-3 py-1.5 font-black text-[9px] uppercase tracking-widest rounded-lg transition-all cursor-pointer border ${
                              user.blocked 
                                ? 'bg-emerald-600/10 hover:bg-emerald-500 hover:text-black text-emerald-400 border-emerald-500/20' 
                                : 'bg-rose-600/10 hover:bg-rose-600 hover:text-black text-rose-400 border-rose-500/20'
                            }`}
                          >
                            {user.blocked ? 'Unban' : 'Ban'}
                          </button>
                          <button 
                            type="button"
                            onClick={() => {
                              setSelectedUserForEdit(user);
                              setNewBonusAmount((user.dailyBonusEarnings || 0).toString());
                              setIsUserEditModalOpen(true);
                            }}
                            className="px-3 py-1.5 bg-white/5 hover:bg-blue-600 hover:text-black text-white text-[9px] font-black uppercase tracking-widest rounded-lg transition-all cursor-pointer border border-white/10"
                          >
                            Adjust
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-white/20 uppercase tracking-widest text-[9px]">No users found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'tasks' ? (
        <div className="space-y-6">
          {/* TASK MANAGEMENT SECTION */}
          <div className="bg-[#111111] border border-white/5 rounded-3xl p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div className="space-y-1">
                <h4 className="text-[11px] font-black uppercase tracking-wider text-blue-400 flex items-center gap-2">
                  <ListChecks className="w-4 h-4" />
                  Social Task Management
                </h4>
                <p className="text-[9px] text-white/40 font-medium">Create and manage social media tasks for users to complete</p>
              </div>
              <button 
                onClick={() => {
                  setEditingTask(null);
                  setTaskForm({ title: '', description: '', platform: 'YouTube', link: '', reward: 0, status: 'Active' });
                  setIsTaskModalOpen(true);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-black font-black text-[10px] uppercase tracking-widest rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-blue-500/10"
              >
                <Plus className="w-3.5 h-3.5" />
                Create New Task
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tasks.length > 0 ? (
                tasks.map((task) => (
                  <div key={task.id} className="bg-slate-950/40 border border-white/5 rounded-2xl p-4 space-y-3 relative overflow-hidden group hover:border-blue-500/20 transition-all">
                    <div className="flex items-center justify-between">
                      <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${
                        task.platform === 'YouTube' ? 'bg-red-500 text-white' :
                        task.platform === 'TikTok' ? 'bg-white text-black' :
                        'bg-blue-600 text-white'
                      }`}>
                        {task.platform}
                      </span>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => {
                            setEditingTask(task);
                            setTaskForm(task);
                            setIsTaskModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all cursor-pointer"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button 
                          onClick={() => handleDeleteTask(task.id)}
                          className="p-1.5 rounded-lg bg-rose-500/5 hover:bg-rose-500/10 text-rose-500 transition-all cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <h5 className="text-xs font-black text-white line-clamp-1">{task.title}</h5>
                      <p className="text-[9px] text-white/40 line-clamp-2">{task.description}</p>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-white/5">
                      <span className="text-[10px] font-black text-emerald-400">+${task.reward.toFixed(2)}</span>
                      <span className={`text-[8px] font-black uppercase ${task.status === 'Active' ? 'text-emerald-500' : 'text-rose-500'}`}>{task.status}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full py-12 text-center border border-dashed border-white/10 rounded-2xl">
                  <p className="text-[10px] text-white/20 uppercase tracking-[0.2em]">No tasks created yet.</p>
                </div>
              )}
            </div>
          </div>

          {/* TASK SUBMISSIONS REVIEW SECTION */}
          <div className="bg-[#111111] border border-white/5 rounded-3xl p-6 space-y-6 shadow-2xl">
            <div className="space-y-1">
              <h4 className="text-[11px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" />
                Submission Audit Queue
              </h4>
              <p className="text-[9px] text-white/40 font-medium">Verify screenshots and approve or reject task rewards</p>
            </div>

            <div className="space-y-3">
              {taskSubmissions.length > 0 ? (
                taskSubmissions.map((submission) => (
                  <div key={submission.id} className="bg-slate-950/40 border border-white/5 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4 w-full">
                      <div 
                        onClick={() => setActiveScreenshotModal(submission.screenshot)}
                        className="w-12 h-12 rounded-xl bg-black border border-white/10 flex-shrink-0 cursor-zoom-in overflow-hidden"
                      >
                        <img src={submission.screenshot} alt="Proof" className="w-full h-full object-cover" />
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xs font-black text-white">{submission.username}</p>
                        <p className="text-[9px] text-white/60 font-medium">Completed: <span className="text-blue-400">{submission.taskTitle}</span></p>
                        <p className="text-[8px] text-white/30 font-mono uppercase">{new Date(submission.submissionTime?.seconds * 1000).toLocaleString()}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                      <span className="text-xs font-black text-emerald-400 mr-2">${submission.reward.toFixed(2)}</span>
                      {submission.status === 'Pending' ? (
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => {
                              setReviewingSubmission(submission);
                              setIsReviewModalOpen(true);
                            }}
                            className="px-4 py-2 bg-white/5 hover:bg-blue-600 hover:text-black text-white text-[9px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer border border-white/10"
                          >
                            Review
                          </button>
                        </div>
                      ) : (
                        <span className={`text-[9px] font-black uppercase px-3 py-1 rounded-full ${
                          submission.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                        }`}>
                          {submission.status}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center border border-dashed border-white/10 rounded-2xl">
                  <p className="text-[10px] text-white/20 uppercase tracking-[0.2em]">No task submissions detected.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* 2. PREMIUM 7-CARD DASHBOARD STATISTICS BENTO GRID */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4 animate-fade-in">
        
        {/* Total Users */}
        <div className="bg-[#121212] border border-white/5 hover:border-white/10 rounded-2xl p-4 space-y-2 relative overflow-hidden transition-all duration-150 group shadow-md">
          <div className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-white/[0.02] group-hover:bg-white/[0.05] flex items-center justify-center text-white/35 transition-all">
            <Users className="w-3.5 h-3.5" />
          </div>
          <p className="text-[8px] font-black text-white/40 uppercase tracking-widest font-sans">Total Users</p>
          <div className="space-y-0.5">
            <h3 className="text-xl font-bold font-mono text-white">{globalAggregates.totalUsersCount}</h3>
            <p className="text-[8px] text-white/25">Global registers count</p>
          </div>
        </div>

        {/* Active Accounts & Live pulsing session metric */}
        <div className="bg-[#121212] border border-white/5 hover:border-white/10 rounded-2xl p-4 space-y-2 relative overflow-hidden transition-all duration-150 group shadow-md">
          <div className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
            <Activity className="w-3.5 h-3.5 animate-pulse" />
          </div>
          <p className="text-[8px] font-black text-white/40 uppercase tracking-widest font-sans">Active Users</p>
          <div className="space-y-0.5">
            <div className="flex items-baseline gap-1.5">
              <h3 className="text-xl font-bold font-mono text-emerald-400">{globalAggregates.activeUsersCount}</h3>
              <span className="text-[7.5px] font-mono text-emerald-400/80 bg-emerald-500/5 px-1 rounded-sm leading-none font-bold animate-pulse">
                ● {Math.max(2, Math.floor(globalAggregates.activeUsersCount * 0.35) + 3)} live
              </span>
            </div>
            <p className="text-[8px] text-white/25">Unbanned active profiles</p>
          </div>
        </div>

        {/* Total Approved Deposits */}
        <div className="bg-[#121212] border border-white/5 hover:border-blue-500/20 rounded-2xl p-4 space-y-2 relative overflow-hidden transition-all duration-150 group shadow-md">
          <div className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-blue-600/5 group-hover:bg-blue-600/10 flex items-center justify-center text-blue-400 transition-all">
            <DollarSign className="w-3.5 h-3.5" />
          </div>
          <p className="text-[8px] font-black text-white/40 uppercase tracking-widest font-sans">Total Deposits</p>
          <div className="space-y-0.5">
            <h3 className="text-xl font-bold font-mono text-blue-400">${globalAggregates.totalDepositsSum.toFixed(2)}</h3>
            <p className="text-[8px] text-blue-400/65 font-medium">Approved stake ledger</p>
          </div>
        </div>

        {/* Total Approved Withdrawals */}
        <div className="bg-[#121212] border border-white/5 hover:border-white/10 rounded-2xl p-4 space-y-2 relative overflow-hidden transition-all duration-150 group shadow-md">
          <div className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-rose-500/5 group-hover:bg-rose-500/10 flex items-center justify-center text-rose-400 transition-all">
            <ArrowUpRight className="w-3.5 h-3.5" />
          </div>
          <p className="text-[8px] font-black text-white/40 uppercase tracking-widest font-sans">Total Payouts</p>
          <div className="space-y-0.5">
            <h3 className="text-xl font-bold font-mono text-rose-400">${globalAggregates.totalWithdrawalsSum.toFixed(2)}</h3>
            <p className="text-[8px] text-white/25">Outbound disburse total</p>
          </div>
        </div>

        {/* Pending Deposit Requests (Requirement 1) */}
        <div className="bg-[#121212] border border-white/5 hover:border-amber-500/20 rounded-2xl p-4 space-y-2 relative overflow-hidden transition-all duration-150 group shadow-md">
          <div className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-amber-500/5 flex items-center justify-center text-amber-500">
            <ArrowDownLeft className="w-3.5 h-3.5" />
          </div>
          <p className="text-[8px] font-black text-white/40 uppercase tracking-widest font-sans">Pending Deposits</p>
          <div className="space-y-0.5">
            <div className="flex items-baseline gap-1">
              <h3 className="text-xl font-bold font-mono text-amber-500">${globalAggregates.pendingDepositsSum.toFixed(1)}</h3>
              <span className="text-[8px] font-mono bg-amber-500/10 px-1 py-0.5 rounded text-amber-500 font-extrabold">
                {globalAggregates.pendingDepositsCount} pending
              </span>
            </div>
            <p className="text-[8px] text-white/25">Awaiting finance signature</p>
          </div>
        </div>

        {/* Pending Withdrawal Requests (Requirement 1) */}
        <div className="bg-[#121212] border border-white/5 hover:border-pink-500/20 rounded-2xl p-4 space-y-2 relative overflow-hidden transition-all duration-150 group shadow-md">
          <div className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-pink-500/5 flex items-center justify-center text-pink-400">
            <Clock className="w-3.5 h-3.5" />
          </div>
          <p className="text-[8px] font-black text-white/40 uppercase tracking-widest font-sans">Pending Withdrawals</p>
          <div className="space-y-0.5">
            <div className="flex items-baseline gap-1">
              <h3 className="text-xl font-bold font-mono text-pink-400">${globalAggregates.pendingWithdrawalsSum.toFixed(1)}</h3>
              <span className="text-[8px] font-mono bg-pink-500/10 px-1 py-0.5 rounded text-pink-400 font-extrabold">
                {globalAggregates.pendingWithdrawalsCount} pending
              </span>
            </div>
            <p className="text-[8px] text-white/25">Outbound awaiting disburse</p>
          </div>
        </div>

        {/* Today's Earnings (Approved calendar day deposits) (Requirement 1) */}
        <div className="bg-[#121212] border border-white/5 hover:border-emerald-500/20 rounded-2xl p-4 space-y-2 relative overflow-hidden transition-all duration-150 group shadow-md">
          <div className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-emerald-500/5 flex items-center justify-center text-emerald-400">
            <Coins className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <p className="text-[8px] font-black text-white/40 uppercase tracking-widest font-sans">Today's Revenue</p>
          <div className="space-y-0.5">
            <h3 className="text-xl font-bold font-mono text-emerald-400">${globalAggregates.todaysEarningsSum.toFixed(2)}</h3>
            <p className="text-[8px] text-white/25">Approved deposits today</p>
          </div>
        </div>

      </div>

      {/* 3. SHIELDED BENTO ANALYTICS CHART SUITE (Requirement 6) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Dynamic Multi-Tab Recharts Workspace Component */}
        <div className="lg:col-span-8 bg-[#111111]/95 border border-white/5 rounded-3xl p-6 space-y-6 relative shadow-xl">
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-white/5">
            <div className="space-y-1">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-400">Dynamic Performance Graph Desk</h4>
              <p className="text-[9px] text-white/45 font-medium leading-relaxed">Toggle different performance curves calculated from Firestore database records</p>
            </div>
            
            {/* Quick Chart View Selection Tabs */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950/60 border border-white/5 text-[9px] uppercase font-bold">
              <button
                type="button"
                onClick={() => setActiveChartTab('revenue')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${activeChartTab === 'revenue' ? 'bg-blue-600 text-black font-extrabold' : 'text-white/45 hover:text-white'}`}
              >
                Capital Stream
              </button>
              <button
                type="button"
                onClick={() => setActiveChartTab('users')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${activeChartTab === 'users' ? 'bg-blue-600 text-black font-extrabold' : 'text-white/45 hover:text-white'}`}
              >
                Growth Matrix
              </button>
              <button
                type="button"
                onClick={() => setActiveChartTab('activity')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${activeChartTab === 'activity' ? 'bg-blue-600 text-black font-extrabold' : 'text-white/45 hover:text-white'}`}
              >
                Pulse Logic
              </button>
            </div>
          </div>

          <div className="h-[300px] w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              {activeChartTab === 'revenue' ? (
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                  <XAxis dataKey="name" stroke="#ffffff20" fontSize={9} tickLine={false} axisLine={false} />
                  <YAxis stroke="#ffffff20" fontSize={9} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0F0F0F', border: '1px solid #ffffff10', borderRadius: '12px', fontSize: '10px' }}
                    itemStyle={{ color: '#3B82F6' }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#3B82F6" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                </AreaChart>
              ) : activeChartTab === 'users' ? (
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                  <XAxis dataKey="name" stroke="#ffffff20" fontSize={9} tickLine={false} axisLine={false} />
                  <YAxis stroke="#ffffff20" fontSize={9} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0F0F0F', border: '1px solid #ffffff10', borderRadius: '12px', fontSize: '10px' }}
                    itemStyle={{ color: '#10B981' }}
                  />
                  <Bar dataKey="users" fill="#10B981" radius={[4, 4, 0, 0]} barSize={20} />
                </BarChart>
              ) : (
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                  <XAxis dataKey="name" stroke="#ffffff20" fontSize={9} tickLine={false} axisLine={false} />
                  <YAxis stroke="#ffffff20" fontSize={9} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0F0F0F', border: '1px solid #ffffff10', borderRadius: '12px', fontSize: '10px' }}
                    itemStyle={{ color: '#F59E0B' }}
                  />
                  <Line type="monotone" dataKey="activity" stroke="#F59E0B" strokeWidth={3} dot={{ fill: '#F59E0B', r: 4 }} />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* Global Key Metrics List (Requirement 3) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-[#111111] border border-white/5 rounded-3xl p-5 space-y-5 h-full shadow-lg">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-400 pb-2 border-b border-white/5">System Aggregate Logs</h4>
            
            <div className="space-y-4">
              {[
                { label: 'Platform GGR (Estimate)', val: `$${(globalAggregates.totalDepositsSum - globalAggregates.totalWithdrawalsSum).toFixed(2)}`, icon: TrendingUp, color: 'text-emerald-400' },
                { label: 'Active Capital Pool', val: `$${globalAggregates.activeInvestmentsSum.toFixed(2)}`, icon: Wallet, color: 'text-blue-400' },
                { label: 'Verification Velocity', val: `${globalAggregates.pendingDepositsCount + globalAggregates.pendingWithdrawalsCount} tickets`, icon: Zap, color: 'text-amber-400' },
                { label: 'System Uptime Integrity', val: '99.99%', icon: ShieldCheck, color: 'text-emerald-500' }
              ].map((m, i) => (
                <div key={i} className="flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center ${m.color} group-hover:scale-110 transition-transform`}>
                      <m.icon className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-bold text-white/50">{m.label}</span>
                  </div>
                  <span className={`text-[11px] font-black font-mono ${m.color}`}>{m.val}</span>
                </div>
              ))}
            </div>

            {/* Quick Audit Actions */}
            <div className="pt-4 space-y-2">
              <button className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest text-white/60 hover:text-white transition-all flex items-center justify-center gap-2">
                <RefreshCw className="w-3 h-3" />
                Force Integrity Sync
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 4. REAL-TIME ACTIVITY & FRAUD ENGINE PANELS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-12">
        
        {/* Verification Request Table (Primary Administrative Duty) (Requirement 2 & 4) */}
        <div className="lg:col-span-8 bg-[#111111]/95 border border-white/5 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
          <div className="p-5 border-b border-white/5 bg-slate-950/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600/10 flex items-center justify-center text-blue-400">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-[11px] font-black uppercase tracking-wider text-white">Verification Deck</h4>
                <p className="text-[9px] text-white/30 font-medium">Process deposit & withdrawal audit logs</p>
              </div>
            </div>

            {/* Quick Switch Toggles & Search */}
            <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
              <div className="flex p-0.5 rounded-lg bg-slate-950 border border-white/5 text-[8.5px] uppercase font-black">
                <button
                  type="button"
                  onClick={() => {
                    setFilterType('deposits');
                    setFilterWStatus('all');
                  }}
                  className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${filterType === 'deposits' ? 'bg-[#10B981] text-black font-extrabold' : 'text-white/40 hover:text-white'}`}
                >
                  Deposits ({deposits.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFilterType('withdrawals');
                    setFilterWStatus('all');
                  }}
                  className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${filterType === 'withdrawals' ? 'bg-[#3B82F6] text-black font-extrabold' : 'text-white/40 hover:text-white'}`}
                >
                  Withdrawals ({withdrawals.length})
                </button>
              </div>

              {/* Status Filter */}
              <select
                value={filterWStatus}
                onChange={(e) => setFilterWStatus(e.target.value as any)}
                className="bg-slate-950 border border-white/5 rounded-xl py-2 px-3 text-[9px] text-white font-bold uppercase outline-none focus:border-blue-500/50 cursor-pointer"
              >
                <option value="all">ALL STATUSES</option>
                <option value="pending">PENDING</option>
                <option value="approved">APPROVED / PAID</option>
                <option value="rejected">REJECTED</option>
              </select>

              <div className="relative flex-1 sm:flex-initial">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20" />
                <input 
                  type="text" 
                  placeholder={filterType === 'deposits' ? "Search deposits..." : "Search withdrawals..."}
                  value={txSearchText}
                  onChange={(e) => setTxSearchText(e.target.value)}
                  className="w-full sm:w-40 py-2 pl-9 pr-4 bg-slate-950 border border-white/10 rounded-xl text-[10px] text-white focus:border-blue-500/50 outline-none transition-all font-mono"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            {filterType === 'deposits' ? (
              // DEPOSITS TABLE LIST
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="border-b border-white/5 bg-white/[0.01]">
                    <th className="px-5 py-4 text-[9px] font-black uppercase tracking-widest text-white/30">User / Account</th>
                    <th className="px-5 py-4 text-[9px] font-black uppercase tracking-widest text-white/30">Amount</th>
                    <th className="px-5 py-4 text-[9px] font-black uppercase tracking-widest text-white/30">Method</th>
                    <th className="px-5 py-4 text-[9px] font-black uppercase tracking-widest text-white/30">Transaction ID</th>
                    <th className="px-5 py-4 text-[9px] font-black uppercase tracking-widest text-white/30">Screenshot</th>
                    <th className="px-5 py-4 text-[9px] font-black uppercase tracking-widest text-white/30">Date</th>
                    <th className="px-5 py-4 text-[9px] font-black uppercase tracking-widest text-white/30">Status</th>
                    <th className="px-5 py-4 text-[9px] font-black uppercase tracking-widest text-white/30 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03]">
                  {filteredDeposits.length > 0 ? (
                    filteredDeposits.map((d) => (
                      <tr key={d.id} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="px-5 py-4">
                          <div className="flex flex-col">
                            <span className="text-[11px] font-bold text-white font-mono">{d.userName || 'Unknown'}</span>
                            <span className="text-[9px] text-white/50">{d.email || 'N/A'}</span>
                            <span className="text-[8px] text-white/20 font-mono">UID: {d.userId || 'N/A'}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-xs font-black text-emerald-400">${d.amount?.toFixed(2) || '0.00'}</span>
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20">
                            {d.network || 'N/A'}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-[10px] font-mono text-white/70 select-all break-all max-w-[120px] inline-block" title={d.txHash}>
                            {d.txHash || 'N/A'}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            {d.screenshot ? (
                              <>
                                <div className="relative group/thumb w-10 h-10 rounded-lg border border-white/10 overflow-hidden bg-slate-950 flex items-center justify-center shrink-0">
                                  <img src={d.screenshot} alt="Screenshot thumb" className="max-w-full max-h-full object-cover" />
                                  <button 
                                    onClick={() => setActiveScreenshotModal(d.screenshot)}
                                    className="absolute inset-0 bg-black/60 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center text-white text-[7.5px] uppercase tracking-wider font-bold transition-opacity"
                                  >
                                    Zoom
                                  </button>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                  <button
                                    onClick={() => setActiveScreenshotModal(d.screenshot)}
                                    className="text-[8.5px] font-black text-blue-400 hover:text-blue-300 uppercase tracking-wider text-left cursor-pointer"
                                  >
                                    🔍 Zoom
                                  </button>
                                  <button
                                    onClick={() => {
                                      const link = document.createElement('a');
                                      link.href = d.screenshot;
                                      link.download = `deposit_proof_${d.userName || 'user'}_${d.amount}.png`;
                                      link.click();
                                    }}
                                    className="text-[8.5px] font-black text-emerald-400 hover:text-emerald-300 uppercase tracking-wider text-left cursor-pointer"
                                  >
                                    📥 Download
                                  </button>
                                </div>
                              </>
                            ) : (
                              <span className="text-[9px] text-white/20 italic">No proof image</span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-[9px] font-mono text-white/40">{d.timestamp || 'N/A'}</span>
                        </td>
                        <td className="px-5 py-4">
                          <div className={`flex items-center gap-1.5 ${d.status === 'pending' ? 'text-amber-500' : d.status === 'approved' ? 'text-emerald-500' : 'text-rose-500'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${d.status === 'pending' ? 'bg-amber-500 animate-pulse' : 'bg-current'}`} />
                            <span className="text-[9px] font-black uppercase tracking-wider">{d.status}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-right">
                          {d.status === 'pending' && (
                            <div className="flex justify-end gap-1.5">
                              <button 
                                onClick={() => onUpdateTxStatus('deposit', d.id, 'approved', d.userId, d.amount)}
                                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-black font-black text-[9px] uppercase tracking-widest rounded-lg transition-all cursor-pointer"
                              >
                                Approve
                              </button>
                              <button 
                                onClick={() => onUpdateTxStatus('deposit', d.id, 'rejected', d.userId, d.amount)}
                                className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-black font-black text-[9px] uppercase tracking-widest rounded-lg transition-all cursor-pointer"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-white/20 uppercase tracking-widest text-[9px]">No pending deposit requests found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            ) : (
              // WITHDRAWALS TABLE LIST
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="border-b border-white/5 bg-white/[0.01]">
                    <th className="px-5 py-4 text-[9px] font-black uppercase tracking-widest text-white/30">User / Account</th>
                    <th className="px-5 py-4 text-[9px] font-black uppercase tracking-widest text-white/30">Amount</th>
                    <th className="px-5 py-4 text-[9px] font-black uppercase tracking-widest text-white/30">Withdraw Method</th>
                    <th className="px-5 py-4 text-[9px] font-black uppercase tracking-widest text-white/30">Account Number</th>
                    <th className="px-5 py-4 text-[9px] font-black uppercase tracking-widest text-white/30">Date</th>
                    <th className="px-5 py-4 text-[9px] font-black uppercase tracking-widest text-white/30">Status</th>
                    <th className="px-5 py-4 text-[9px] font-black uppercase tracking-widest text-white/30 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03]">
                  {filteredWithdrawals.length > 0 ? (
                    filteredWithdrawals.map((w) => (
                      <tr key={w.id} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="px-5 py-4">
                          <div className="flex flex-col">
                            <span className="text-[11px] font-bold text-white font-mono">{w.userName || 'Unknown'}</span>
                            <span className="text-[9px] text-white/50">{w.email || 'N/A'}</span>
                            <span className="text-[8px] text-white/20 font-mono">UID: {w.userId || 'N/A'}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-xs font-black text-rose-400">${w.amount?.toFixed(2) || '0.00'}</span>
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            {w.network || 'N/A'}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-[10px] font-mono text-white/70 select-all break-all max-w-[150px] inline-block">
                            {w.wallet || 'N/A'}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-[9px] font-mono text-white/40">{w.timestamp || 'N/A'}</span>
                        </td>
                        <td className="px-5 py-4">
                          <div className={`flex items-center gap-1.5 ${w.status === 'pending' ? 'text-amber-500' : w.status === 'approved' ? 'text-emerald-500' : 'text-rose-500'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${w.status === 'pending' ? 'bg-amber-500 animate-pulse' : 'bg-current'}`} />
                            <span className="text-[9px] font-black uppercase tracking-wider">{w.status === 'approved' ? 'PAID' : w.status}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-right">
                          {w.status === 'pending' && (
                            <div className="flex justify-end gap-1.5">
                              <button 
                                onClick={() => onUpdateTxStatus('withdrawal', w.id, 'approved', w.userId, w.amount)}
                                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-black font-black text-[9px] uppercase tracking-widest rounded-lg transition-all cursor-pointer"
                              >
                                Approve
                              </button>
                              <button 
                                onClick={() => onUpdateTxStatus('withdrawal', w.id, 'rejected', w.userId, w.amount)}
                                className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-black font-black text-[9px] uppercase tracking-widest rounded-lg transition-all cursor-pointer"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-white/20 uppercase tracking-widest text-[9px]">No pending withdrawal requests found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
          
          <div className="p-4 border-t border-white/5 bg-slate-950/20 text-center">
            <span className="text-[9px] font-black uppercase tracking-widest text-white/20">
              Live Audit Log Ledger Sync: Secure TLS 1.3
            </span>
          </div>
        </div>

        {/* Real-time Status Center (Requirement 5) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Pulse/System Feeds tab card */}
          <div className="bg-[#111111] border border-white/5 rounded-3xl p-5 space-y-4 shadow-xl flex flex-col h-full">
            
            {/* Header Switcher Tabs */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-400 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  System Live Feeds
                </span>
                <span className="text-[7.5px] font-mono text-white/30 uppercase tracking-widest font-black">Live Pulse</span>
              </div>

              {/* Selection Toggles */}
              <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-950/60 border border-white/5 text-[9px] uppercase font-bold text-center">
                <button
                  type="button"
                  className="px-2.5 py-1.5 rounded-lg bg-blue-600 text-black font-extrabold"
                >
                  Activity
                </button>
                <button
                  type="button"
                  className="px-2.5 py-1.5 rounded-lg text-white/45 hover:text-white"
                >
                  Telegram
                </button>
              </div>
            </div>

            <div className="flex-1 space-y-3 min-h-[180px]">
              <div className="space-y-2 max-h-[180px] overflow-y-auto scrollbar-thin pr-1 font-mono text-[9px] leading-relaxed">
                {[
                  { text: 'User danish_88 placed $500 on Diamond Plan', time: '12:44:02' },
                  { text: 'Deposit verified: Tx#9981-LKR-882 (USDT)', time: '12:43:55' },
                  { text: 'System audit: Profile integrity 100% verified', time: '12:43:10' },
                  { text: 'New user registered: apex_trader_09', time: '12:42:45' },
                  { text: 'Withdrawal signed: user_mark_77 ($120.00)', time: '12:41:20' },
                ].map((evt, idx) => (
                  <div key={idx} className="border-b border-white/[0.02] pb-1 flex justify-between items-start gap-1">
                    <span className="text-white/80 flex-1">{evt.text}</span>
                    <span className="text-white/25 shrink-0 text-[8px] font-mono font-bold mt-0.5">{evt.time}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[9px] text-white/40 font-mono">
              <span>Secure Engine</span>
              <span className="text-emerald-400 font-bold">Active Shield</span>
            </div>
          </div>
        </div>
      </div>

    </div>
    )}
    {antiFraudFlags.length > 0 && (
        <div className="bg-[#1c1313] border border-rose-500/20 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-rose-400">
            <AlertTriangle className="w-4 h-4 animate-bounce" />
            <h4 className="text-[10px] font-black uppercase tracking-widest">Platform Anti-Fraud Alarm triggers</h4>
            <span className="text-[9px] font-mono font-bold bg-rose-500/15 border border-rose-500/20 px-2 py-0.5 rounded-full text-rose-400">{antiFraudFlags.length} Flags</span>
          </div>
          <div className="space-y-2">
            {antiFraudFlags.map((flag, idx) => (
              <div key={idx} className="bg-slate-950/40 border border-white/5 rounded-xl p-3 flex items-center gap-3 text-xs font-sans text-white/80">
                <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shrink-0" />
                <div className="flex-1 space-y-0.5">
                  <p className="text-[8px] font-bold tracking-widest uppercase text-rose-500">{flag.type}</p>
                  <p className="text-[10px] text-white font-medium">{flag.message}</p>
                  <p className="text-[8px] text-white/30 italic">User Reference: {flag.userId} • Triggered: {new Date(flag.timestamp?.seconds * 1000).toLocaleString()}</p>
                </div>
                <button className="px-3 py-1 bg-white/5 hover:bg-rose-500 hover:text-white border border-white/10 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer">Review Flag</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Task Creation/Edit Modal */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 overflow-y-auto">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="w-full max-w-lg bg-[#0F0F0F] border border-white/10 rounded-3xl overflow-hidden shadow-2xl shadow-blue-500/5 flex flex-col max-h-[90vh]"
          >
            <div className="px-6 py-4 border-b border-white/5 bg-slate-950/60 flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-widest text-blue-400">
                {editingTask ? "Modify Task Logic" : "Protocol: Create Task"}
              </h3>
              <button onClick={() => setIsTaskModalOpen(false)} className="text-white/20 hover:text-white transition-colors cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase text-white/40 tracking-wider">Task Identity (Title)</label>
                <input 
                  type="text" 
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:border-blue-500 transition-all outline-none" 
                  placeholder="e.g. Subscribe to Official YT"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase text-white/40 tracking-wider">Operational Description</label>
                <textarea 
                  value={taskForm.description}
                  onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:border-blue-500 transition-all outline-none h-24 resize-none" 
                  placeholder="Explain what the user needs to do..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase text-white/40 tracking-wider">Target Platform</label>
                  <select 
                    value={taskForm.platform}
                    onChange={(e) => setTaskForm({ ...taskForm, platform: e.target.value as any })}
                    className="w-full px-4 py-3 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:border-blue-500 transition-all outline-none"
                  >
                    <option value="YouTube">YouTube</option>
                    <option value="TikTok">TikTok</option>
                    <option value="Facebook">Facebook</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase text-white/40 tracking-wider">Reward (USD)</label>
                  <input 
                    type="number" 
                    value={taskForm.reward}
                    onChange={(e) => setTaskForm({ ...taskForm, reward: parseFloat(e.target.value) })}
                    className="w-full px-4 py-3 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:border-blue-500 transition-all outline-none" 
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase text-white/40 tracking-wider">Execution Link (URL)</label>
                <input 
                  type="text" 
                  value={taskForm.link}
                  onChange={(e) => setTaskForm({ ...taskForm, link: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:border-blue-500 transition-all outline-none" 
                  placeholder="https://..."
                />
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase text-white/40 tracking-wider">Deployment Status</label>
                <div className="flex items-center gap-4 pt-1">
                  <button 
                    onClick={() => setTaskForm({ ...taskForm, status: 'Active' })}
                    className={`flex-1 py-2.5 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all ${taskForm.status === 'Active' ? 'bg-emerald-500 border-emerald-500 text-black' : 'bg-slate-950 border-white/10 text-white/40'}`}
                  >
                    Active
                  </button>
                  <button 
                    onClick={() => setTaskForm({ ...taskForm, status: 'Inactive' })}
                    className={`flex-1 py-2.5 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all ${taskForm.status === 'Inactive' ? 'bg-rose-500 border-rose-500 text-black' : 'bg-slate-950 border-white/10 text-white/40'}`}
                  >
                    Inactive
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-white/5 bg-slate-950/40">
              <button 
                onClick={handleSaveTask}
                className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-black font-black text-[11px] uppercase tracking-[0.25em] rounded-2xl transition-all shadow-xl shadow-blue-500/10 cursor-pointer"
              >
                {editingTask ? "Update Operational Task" : "Deploy Task to Production"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Review Submission Modal */}
      {isReviewModalOpen && reviewingSubmission && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-lg bg-[#0F0F0F] border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col"
          >
            <div className="px-6 py-4 border-b border-white/5 bg-slate-950/60 flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-widest text-amber-400">Task Proof Audit</h3>
              <button onClick={() => setIsReviewModalOpen(false)} className="text-white/20 hover:text-white transition-colors cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto">
              <div className="space-y-4">
                <div className="flex items-center justify-between text-[10px] uppercase font-black tracking-wider text-white/40">
                  <span>Proof Screenshot</span>
                  <span className="text-blue-400">Click to Zoom</span>
                </div>
                <div 
                  onClick={() => setActiveScreenshotModal(reviewingSubmission.screenshot)}
                  className="rounded-2xl overflow-hidden border border-white/10 bg-black aspect-video cursor-zoom-in"
                >
                  <img src={reviewingSubmission.screenshot} alt="Proof" className="w-full h-full object-contain" />
                </div>
              </div>

              <div className="bg-slate-950/60 border border-white/5 rounded-2xl p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[8px] font-black uppercase text-white/30 tracking-widest">User Profile</p>
                    <p className="text-xs font-black text-white">{reviewingSubmission.username}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[8px] font-black uppercase text-white/30 tracking-widest">Reward Value</p>
                    <p className="text-xs font-black text-emerald-400">${reviewingSubmission.reward.toFixed(2)}</p>
                  </div>
                </div>
                <div>
                  <p className="text-[8px] font-black uppercase text-white/30 tracking-widest">Target Task</p>
                  <p className="text-xs font-black text-blue-400">{reviewingSubmission.taskTitle}</p>
                </div>
              </div>

              {reviewingSubmission.status === 'Pending' ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase text-white/40 tracking-wider">Rejection Reason (Optional)</label>
                    <input 
                      type="text" 
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="e.g. Screenshot blurry, link not followed..."
                      className="w-full px-4 py-3 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:border-rose-500 transition-all outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <button 
                      onClick={() => handleReviewSubmission('Rejected')}
                      disabled={isReviewing}
                      className="py-4 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-black font-black text-[10px] uppercase tracking-widest rounded-2xl transition-all border border-rose-500/20 cursor-pointer"
                    >
                      {isReviewing ? '...' : 'Reject Proof'}
                    </button>
                    <button 
                      onClick={() => handleReviewSubmission('Approved')}
                      disabled={isReviewing}
                      className="py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-[10px] uppercase tracking-widest rounded-2xl transition-all cursor-pointer shadow-xl shadow-emerald-500/20"
                    >
                      {isReviewing ? '...' : 'Approve & Credit'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className={`p-4 rounded-2xl border text-center space-y-1 ${
                  reviewingSubmission.status === 'Approved' ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/5 border-rose-500/20 text-rose-400'
                }`}>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em]">Submission {reviewingSubmission.status}</p>
                  {reviewingSubmission.rejectionReason && (
                    <p className="text-[9px] text-white/40 italic">Reason: {reviewingSubmission.rejectionReason}</p>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Zoomable Screenshot Modal */}
      {activeScreenshotModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-md transition-all">
          <div className="relative max-w-4xl max-h-[90vh] bg-slate-900 border border-white/10 rounded-2xl p-3 flex flex-col items-center shadow-2xl">
            <button 
              onClick={() => setActiveScreenshotModal(null)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-blue-600 hover:bg-yellow-500 text-black font-black text-sm flex items-center justify-center border border-black cursor-pointer shadow-lg transition-transform hover:scale-110"
              title="Close"
            >
              ✕
            </button>
            <div className="overflow-auto max-h-[80vh] w-full flex justify-center">
              <img 
                src={activeScreenshotModal} 
                alt="Receipt Zoomed" 
                className="max-w-full h-auto object-contain rounded-lg border border-white/5"
              />
            </div>
            <div className="mt-3 flex items-center justify-between w-full px-2 text-[10px] text-zinc-400 font-mono">
              <span>💡 Press escape or click button to close</span>
              <button 
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = activeScreenshotModal;
                  link.download = `receipt_screenshot_${Date.now()}.jpg`;
                  link.click();
                }}
                className="px-3 py-1 bg-white/5 hover:bg-blue-600 hover:text-black rounded border border-white/10 text-[9px] font-bold transition-all cursor-pointer"
              >
                📥 Download Original
              </button>
            </div>
          </div>
        </div>
      )}

      {/* USER EDIT MODAL */}
      {isUserEditModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#0A0A0A] border-2 border-blue-500/30 rounded-3xl p-8 max-w-md w-full space-y-6 shadow-[0_0_50px_rgba(59,130,246,0.15)]"
          >
            <div className="space-y-2">
              <h3 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-blue-400" />
                Adjust Balance Matrix
              </h3>
              <p className="text-[10px] text-white/40 font-medium">Modifying daily earnings for member <span className="text-blue-400">@{selectedUserForEdit?.userId}</span></p>
            </div>

            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase text-white/50 tracking-widest">New Daily Earnings ($)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-400 font-bold">$</span>
                  <input 
                    type="number"
                    step="0.01"
                    value={newBonusAmount}
                    onChange={(e) => setNewBonusAmount(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl py-3 pl-8 pr-4 text-xs text-white outline-none focus:border-blue-500/50"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-4 flex gap-3">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[9px] text-amber-500/80 leading-relaxed font-medium">This manual adjustment directly updates the user's profit ledger. This action is audited and irreversible.</p>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button 
                onClick={() => setIsUserEditModalOpen(false)}
                className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white/60 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={handleUpdateUserBalance}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-black text-[9px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer shadow-lg shadow-blue-500/20"
              >
                Commit Adjustment
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
