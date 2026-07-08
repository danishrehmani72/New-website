/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ReferralLog } from '../types';
import { 
  History, 
  Share2, 
  Layers, 
  Users, 
  Copy, 
  Check, 
  TrendingUp, 
  CornerDownRight, 
  GitBranch, 
  Wallet,
  Activity,
  ArrowUpRight,
  ShieldAlert,
  User,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AvatarIcon, getAvatarConfig } from '../lib/avatars';

interface ReferralHistoryProps {
  logs: ReferralLog[];
  userId?: string;
  walletBalance?: number;
  theme?: 'light' | 'dark';
}

export default function ReferralHistory({ logs, userId = '', walletBalance = 0, theme = 'light' }: ReferralHistoryProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'logs' | 'tree'>('overview');
  const [copied, setCopied] = useState(false);

  // Pagination for Referral History logs list
  const [logsPage, setLogsPage] = useState(1);
  const logsPerPage = 5;
  const totalLogsPages = Math.ceil(logs.length / logsPerPage);
  const paginatedLogs = logs.slice((logsPage - 1) * logsPerPage, logsPage * logsPerPage);

  // Derive levels
  const level1Logs = logs.filter(log => !log.level || log.level === 1);
  const level2Logs = logs.filter(log => log.level === 2);
  const level3Logs = logs.filter(log => log.level === 3);

  const totalTeam = logs.length;
  const totalEarnings = logs.reduce((sum, log) => sum + (typeof log.amount === 'number' ? log.amount : 0.05), 0);

  // Construct sharing link
  const referralLink = `${window.location.origin}?ref=${userId}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Helper to build visual tree structure
  // We want to group by referrers starting with level 1.
  // Level 1: Users referred directly by current user (since they are level 1, they are directly under us)
  // Level 2: Users whose `referredBy` matches a Level 1 refereeId
  // Level 3: Users whose `referredBy` matches a Level 2 refereeId
  const treeLevelsInfo = {
    level1: level1Logs,
    level2: level2Logs,
    level3: level3Logs
  };

  return (
    <div className={`w-full max-w-2xl rounded-3xl p-6 md:p-8 space-y-6 shadow-2xl text-left transition-all duration-300 ${theme === 'dark' ? 'bg-[#111111] border border-white/5 text-white' : 'bg-white border border-gray-100 shadow-[0_8px_30px_rgba(0,0,0,0.04)] text-slate-800'}`} id="referral-system-container">
      {/* Header and Live Status */}
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5 ${theme === 'dark' ? 'border-white/5' : 'border-gray-100'}`}>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Layers className={`w-4.5 h-4.5 ${theme === 'dark' ? 'text-blue-400' : 'text-emerald-600'}`} id="layers-icon" />
            <h3 className={`text-sm uppercase tracking-[0.2em] font-bold font-sans ${theme === 'dark' ? 'text-white/90' : 'text-slate-800'}`}>3-Level Alliance Matrix</h3>
          </div>
          <p className={`text-[11px] font-sans leading-none ${theme === 'dark' ? 'text-white/40' : 'text-slate-400'}`}>Complete decentralized direct & indirect team ledger tracking</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[9px] uppercase tracking-widest font-extrabold px-3 py-1 rounded-full border ${theme === 'dark' ? 'bg-blue-600/10 text-blue-400 border-blue-500/15' : 'bg-emerald-50 text-emerald-600 border-emerald-500/20'}`}>
            Active Hub
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className={`flex border-b pb-3 gap-2 ${theme === 'dark' ? 'border-white/5' : 'border-gray-100'}`}>
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 text-[10.5px] uppercase tracking-wider font-extrabold rounded-lg transition-all duration-200 border cursor-pointer ${
            activeTab === 'overview'
              ? theme === 'dark'
                ? 'bg-blue-600/5 border-blue-500/30 text-blue-400'
                : 'bg-emerald-50 border-emerald-500/30 text-emerald-600'
              : theme === 'dark'
                ? 'border-transparent text-white/40 hover:text-white/65 hover:bg-white/[0.02]'
                : 'border-transparent text-slate-400 hover:text-slate-700 hover:bg-slate-50'
          }`}
          id="tab-overview-btn"
        >
          Overview & Link
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2 text-[10.5px] uppercase tracking-wider font-extrabold rounded-lg transition-all duration-200 border cursor-pointer ${
            activeTab === 'logs'
              ? theme === 'dark'
                ? 'bg-blue-600/5 border-blue-500/30 text-blue-400'
                : 'bg-emerald-50 border-emerald-500/30 text-emerald-600'
              : theme === 'dark'
                ? 'border-transparent text-white/40 hover:text-white/65 hover:bg-white/[0.02]'
                : 'border-transparent text-slate-400 hover:text-slate-700 hover:bg-slate-50'
          }`}
          id="tab-logs-btn"
        >
          Referral History
        </button>
        <button
          onClick={() => setActiveTab('tree')}
          className={`px-4 py-2 text-[10.5px] uppercase tracking-wider font-extrabold rounded-lg transition-all duration-200 border cursor-pointer ${
            activeTab === 'tree'
              ? theme === 'dark'
                ? 'bg-blue-600/5 border-blue-500/30 text-blue-400'
                : 'bg-emerald-50 border-emerald-500/30 text-emerald-600'
              : theme === 'dark'
                ? 'border-transparent text-white/40 hover:text-white/65 hover:bg-white/[0.02]'
                : 'border-transparent text-slate-400 hover:text-slate-700 hover:bg-slate-50'
          }`}
          id="tab-tree-btn"
        >
          Team Tree View
        </button>
      </div>

      {/* Tab Contents */}
      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4" id="referral-stats">
              <div className={`p-4 space-y-1 rounded-2xl border transition-all ${theme === 'dark' ? 'bg-[#161616] border-white/5' : 'bg-slate-50 border-gray-150/80'}`}>
                <span className={`text-[9px] uppercase tracking-widest font-bold block leading-none ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>Wallet Balance</span>
                <div className="flex items-center gap-1.5 pt-1">
                  <Wallet className={`w-3.5 h-3.5 ${theme === 'dark' ? 'text-blue-400/75' : 'text-emerald-600'}`} />
                  <span className={`text-sm font-bold font-mono ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>${walletBalance.toFixed(2)}</span>
                </div>
              </div>
              <div className={`p-4 space-y-1 rounded-2xl border transition-all ${theme === 'dark' ? 'bg-[#161616] border-white/5' : 'bg-slate-50 border-gray-150/80'}`}>
                <span className={`text-[9px] uppercase tracking-widest font-bold block leading-none ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>Total Team Matrix</span>
                <div className="flex items-center gap-1.5 pt-1">
                  <Users className={`w-3.5 h-3.5 ${theme === 'dark' ? 'text-blue-400/75' : 'text-emerald-600'}`} />
                  <span className={`text-sm font-bold font-mono ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>{totalTeam} Users</span>
                </div>
              </div>
              <div className={`p-4 space-y-1 col-span-2 rounded-2xl border transition-all ${theme === 'dark' ? 'bg-[#161616] border-white/5' : 'bg-slate-50 border-gray-150/80'}`}>
                <span className={`text-[9px] uppercase tracking-widest font-bold block leading-none ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>Total Reward Earnings</span>
                <div className="flex items-center gap-1.5 pt-1">
                  <TrendingUp className={`w-3.5 h-3.5 ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`} />
                  <span className={`text-sm font-bold font-mono ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`}>+${totalEarnings.toFixed(2)} USD</span>
                </div>
              </div>
            </div>

            {/* Level Breakdown Charts */}
            <div className="grid grid-cols-3 gap-3">
              <div className={`border rounded-xl p-3.5 text-center relative overflow-hidden transition-all ${theme === 'dark' ? 'bg-[#161616]/50 border-white/5' : 'bg-slate-50 border-gray-150/80'}`}>
                <div className="absolute top-0 inset-x-0 h-0.5 bg-blue-600/40" />
                <span className={`text-[8px] uppercase tracking-[0.15em] font-bold block ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>Level 1 (Direct)</span>
                <span className={`text-lg font-bold font-mono block mt-1 ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>{level1Logs.length}</span>
                <span className={`text-[8.5px] font-mono font-black mt-1 block py-0.5 rounded-sm uppercase ${theme === 'dark' ? 'text-blue-400 bg-blue-600/5' : 'text-emerald-600 bg-emerald-50'}`}>$0.055 / ref</span>
              </div>
              <div className={`border rounded-xl p-3.5 text-center relative overflow-hidden transition-all ${theme === 'dark' ? 'bg-[#161616]/50 border-white/5' : 'bg-slate-50 border-gray-150/80'}`}>
                <div className="absolute top-0 inset-x-0 h-0.5 bg-indigo-500/40" />
                <span className={`text-[8px] uppercase tracking-[0.15em] font-bold block ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>Level 2 (Indirect)</span>
                <span className={`text-lg font-bold font-mono block mt-1 ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>{level2Logs.length}</span>
                <span className={`text-[8.5px] font-mono font-black mt-1 block py-0.5 rounded-sm uppercase ${theme === 'dark' ? 'text-indigo-400 bg-indigo-500/5' : 'text-teal-600 bg-teal-50'}`}>$0.033 / ref</span>
              </div>
              <div className={`border rounded-xl p-3.5 text-center relative overflow-hidden transition-all ${theme === 'dark' ? 'bg-[#161616]/50 border-white/5' : 'bg-slate-50 border-gray-150/80'}`}>
                <div className="absolute top-0 inset-x-0 h-0.5 bg-sky-500/40" />
                <span className={`text-[8px] uppercase tracking-[0.15em] font-bold block ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>Level 3 (Indirect)</span>
                <span className={`text-lg font-bold font-mono block mt-1 ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>{level3Logs.length}</span>
                <span className={`text-[8.5px] font-mono font-black mt-1 block py-0.5 rounded-sm uppercase ${theme === 'dark' ? 'text-sky-400 bg-sky-500/5' : 'text-cyan-600 bg-cyan-50'}`}>$0.011 / ref</span>
              </div>
            </div>

            {/* Referral Sharing Box */}
            <div className={`border p-5 rounded-2xl space-y-4 transition-all ${theme === 'dark' ? 'bg-[#161616] border-blue-500/10' : 'bg-emerald-50/20 border-emerald-500/15'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Share2 className={`w-3.5 h-3.5 ${theme === 'dark' ? 'text-blue-400' : 'text-emerald-600'}`} />
                  <span className={`text-xs font-bold ${theme === 'dark' ? 'text-white/90' : 'text-slate-800'}`}>Your Personal Invitation Key</span>
                </div>
                <span className={`text-[8px] tracking-widest uppercase font-bold px-2 py-0.5 rounded-md border ${theme === 'dark' ? 'bg-blue-600/10 border-blue-500/20 text-blue-400' : 'bg-emerald-50 border-emerald-500/20 text-emerald-600'}`}>
                  Instant Payout Link
                </span>
              </div>
              <p className={`text-[11px] leading-relaxed ${theme === 'dark' ? 'text-white/50' : 'text-slate-500'}`}>
                Distribute this unique code below to peers. When people join, they immediately claim a **$0.30 registered bonus** (instead of standard $0.10), and your hub maps up to 3 tiers of ongoing payout commissions.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={referralLink}
                  className={`flex-1 rounded-xl px-4 py-3 text-xs font-mono tracking-tight cursor-default focus:outline-none text-ellipsis overflow-hidden border transition-all ${theme === 'dark' ? 'bg-[#0A0A0A] border-white/10 text-white/80 focus:border-blue-500/40' : 'bg-white border-gray-200 text-slate-800 focus:border-emerald-500/40'}`}
                  id="referral-link-input"
                />
                <button
                  onClick={handleCopyLink}
                  className={`px-4 py-3 rounded-xl font-bold text-xs active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 select-none cursor-pointer ${theme === 'dark' ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-[0_4px_12px_rgba(59,130,246,0.15)]' : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-[0_4px_12px_rgba(16,185,129,0.15)]'}`}
                  id="copy-referral-btn"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Code</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Anti Fraud Box Info */}
            <div className={`flex gap-3 border p-4 rounded-xl text-[10.5px] leading-relaxed font-sans mt-2 transition-all ${theme === 'dark' ? 'bg-white/[0.01] border-white/5 text-white/40' : 'bg-amber-50/20 border-amber-500/10 text-slate-500'}`}>
              <ShieldAlert className={`w-4 h-4 shrink-0 mt-0.5 ${theme === 'dark' ? 'text-blue-400/70' : 'text-amber-600'}`} />
              <div>
                <span className={`font-bold block mb-0.5 ${theme === 'dark' ? 'text-white/70' : 'text-slate-700'}`}>Automated Fraud Mitigation Guard</span>
                Multiple accounts per email or hardware device index, duplicate referral self-onboarding loops, and cyclic replication is constantly analyzed. Any flagged violations block withdrawals instantly.
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'logs' && (
          <motion.div
            key="logs"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            <div className="max-h-[380px] overflow-y-auto scrollbar-thin pr-1">
              {logs.length === 0 ? (
                <div className="text-center py-16 space-y-3">
                  <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full border ${theme === 'dark' ? 'bg-white/5 border-white/5 text-white/20' : 'bg-slate-50 border-gray-100 text-slate-300'}`}>
                    <History className={`w-5 h-5 ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`} />
                  </div>
                  <div>
                    <p className={`text-xs font-bold uppercase tracking-widest ${theme === 'dark' ? 'text-white/70' : 'text-slate-700'}`}>No Conversions Detected</p>
                    <p className={`text-[11px] max-w-sm mx-auto mt-2 leading-relaxed ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>
                      Your referral tree is pristine. Share your invite node link to start earning direct level bonuses instantly.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {paginatedLogs.map((log) => {
                    const levelNum = log.level || 1;
                    const levelColors = levelNum === 1 
                      ? { 
                          text: theme === 'dark' ? 'text-blue-400' : 'text-emerald-600', 
                          bg: theme === 'dark' ? 'bg-blue-600/5 border-blue-500/15' : 'bg-emerald-50 border-emerald-500/15', 
                          label: 'Level 1 (Direct)' 
                        }
                      : levelNum === 2 
                      ? { 
                          text: theme === 'dark' ? 'text-indigo-400' : 'text-teal-600', 
                          bg: theme === 'dark' ? 'bg-indigo-500/5 border-indigo-500/15' : 'bg-teal-50 border-teal-500/15', 
                          label: 'Level 2 (Indirect)' 
                        }
                      : { 
                          text: theme === 'dark' ? 'text-sky-400' : 'text-cyan-600', 
                          bg: theme === 'dark' ? 'bg-sky-500/5 border-sky-500/15' : 'bg-cyan-50 border-cyan-500/15', 
                          label: 'Level 3 (Indirect)' 
                        };

                    return (
                      <div
                        key={log.id}
                        className={`flex items-center justify-between p-4 rounded-2xl border transition-all duration-150 ${theme === 'dark' ? 'bg-[#161616] border-white/5 hover:border-blue-500/15' : 'bg-slate-50 border-gray-150/50 hover:border-emerald-500/15'}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${theme === 'dark' ? 'bg-white/5 border-white/10 text-blue-400' : 'bg-emerald-50 border-emerald-500/10 text-emerald-600'}`}>
                            <User className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>{log.refereeName || log.referrerName || 'Anonymous Partner'}</span>
                              <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${levelColors.bg} ${levelColors.text}`}>
                                {levelColors.label}
                              </span>
                            </div>
                            <p className={`text-[9px] font-semibold uppercase tracking-wider mt-1 ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>{log.timestamp}</p>
                          </div>
                        </div>

                        <div className="text-right">
                          <p className={`text-xs font-mono font-black ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`}>
                            +${(log.amount !== undefined ? log.amount : (levelNum === 1 ? 0.055 : levelNum === 2 ? 0.033 : 0.011)).toFixed(3)}
                          </p>
                          <span className={`text-[8px] font-bold uppercase tracking-widest block mt-0.5 ${theme === 'dark' ? 'text-white/20' : 'text-slate-400/60'}`}>Sponsor Payout</span>
                        </div>
                      </div>
                    );
                  })}

                  {totalLogsPages > 1 && (
                    <div className={`flex items-center justify-between pt-4 border-t mt-4 ${theme === 'dark' ? 'border-white/5' : 'border-gray-100'}`}>
                      <button
                        disabled={logsPage === 1}
                        onClick={() => setLogsPage(prev => Math.max(prev - 1, 1))}
                        className={`px-3 py-1.5 rounded-lg border disabled:opacity-30 disabled:pointer-events-none transition-all duration-150 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider cursor-pointer ${theme === 'dark' ? 'border-white/10 text-white/60 hover:text-white hover:bg-white/[0.02]' : 'border-gray-250 text-slate-600 hover:text-slate-800 hover:bg-slate-50'}`}
                      >
                        <ChevronLeft className="w-3.5 h-3.5" /> Prev
                      </button>
                      <span className={`text-[10px] font-mono ${theme === 'dark' ? 'text-white/50' : 'text-slate-500'}`}>
                        Page {logsPage} of {totalLogsPages}
                      </span>
                      <button
                        disabled={logsPage === totalLogsPages}
                        onClick={() => setLogsPage(prev => Math.min(prev + 1, totalLogsPages))}
                        className={`px-3 py-1.5 rounded-lg border disabled:opacity-30 disabled:pointer-events-none transition-all duration-150 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider cursor-pointer ${theme === 'dark' ? 'border-white/10 text-white/60 hover:text-white hover:bg-white/[0.02]' : 'border-gray-250 text-slate-600 hover:text-slate-800 hover:bg-slate-50'}`}
                      >
                        Next <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'tree' && (
          <motion.div
            key="tree"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            <div className={`p-4 rounded-2xl border space-y-3 transition-all ${theme === 'dark' ? 'bg-[#141414] border-white/5' : 'bg-slate-50 border-gray-150/80'}`}>
              <div className="flex items-center gap-2">
                <GitBranch className={`w-4 h-4 ${theme === 'dark' ? 'text-blue-400' : 'text-emerald-600'}`} />
                <span className={`text-xs font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>Your Decentered Genealogy Tree</span>
              </div>
              <p className={`text-[11px] leading-relaxed mb-4 ${theme === 'dark' ? 'text-white/40' : 'text-slate-400'}`}>
                Interactive mapping of Tier-1, Tier-2, and Tier-3 referral members underneath your custom node in sequential tree.
              </p>

              {level1Logs.length === 0 ? (
                <div className={`text-center py-12 text-[11px] uppercase tracking-wider ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>
                  No registered members inside your structure to draw a tree view.
                </div>
              ) : (
                <div className="space-y-4 font-sans max-h-[380px] overflow-y-auto scrollbar-thin pr-1">
                  {/* Tree Core Node representing Current User */}
                  <div className={`p-3 rounded-xl flex items-center gap-2 max-w-[200px] shadow-sm relative border ${theme === 'dark' ? 'bg-white/[0.02] border-white/5' : 'bg-white border-gray-150/80'}`}>
                    <div className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-black border ${theme === 'dark' ? 'bg-blue-600/10 text-blue-400 border-blue-500/20' : 'bg-emerald-50 text-emerald-600 border-emerald-500/20'}`}>
                      YOU
                    </div>
                    <div>
                      <span className={`text-[10px] font-bold uppercase block tracking-wider ${theme === 'dark' ? 'text-white/80' : 'text-slate-800'}`}>Master Agent Node</span>
                      <span className={`text-[8.5px] font-mono block ${theme === 'dark' ? 'text-blue-400' : 'text-emerald-600'}`}>ID: {userId || 'self'}</span>
                    </div>
                  </div>

                  {/* Level 1 Loop */}
                  <div className={`pl-4 space-y-4 border-l relative ${theme === 'dark' ? 'border-white/5' : 'border-gray-100'}`}>
                    {level1Logs.map((lvl1) => {
                      // Filter level 2 children whose referrer matches this level 1 referee
                      const level2Children = level2Logs.filter(lvl2 => lvl2.referredBy === lvl1.refereeId);

                      return (
                        <div key={lvl1.id} className="space-y-3 pt-1">
                          {/* Lvl 1 Node Card */}
                          <div className="flex items-center gap-2 relative">
                            <CornerDownRight className={`w-3.5 h-3.5 shrink-0 absolute -left-4 top-1.5 ${theme === 'dark' ? 'text-blue-400/30' : 'text-emerald-600/30'}`} />
                            <div className={`flex-1 rounded-xl p-3 flex items-center justify-between shadow-inner ml-1.5 max-w-md border ${theme === 'dark' ? 'bg-[#1A1A1A] border-blue-500/15' : 'bg-white border-emerald-500/15'}`}>
                              <div className="flex items-center gap-2.5">
                                <div className={`w-6 h-6 rounded flex items-center justify-center border ${theme === 'dark' ? 'border-white/10 bg-white/5 text-blue-400' : 'border-emerald-500/10 bg-emerald-50 text-emerald-600'} text-[10px]`}>
                                  <User className="w-3.5 h-3.5" />
                                </div>
                                <div>
                                  <span className={`text-[10.5px] font-extrabold block ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>{lvl1.refereeName}</span>
                                  <span className={`text-[8.5px] uppercase tracking-widest font-semibold block mt-0.5 ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>Tier 1 Agent</span>
                                </div>
                              </div>
                              <span className={`text-[9px] font-mono px-2 py-0.5 rounded border font-black ${theme === 'dark' ? 'text-emerald-400 bg-emerald-400/5 border-emerald-400/10' : 'text-emerald-600 bg-emerald-50 border-emerald-500/10'}`}>+$0.055</span>
                            </div>
                          </div>

                          {/* Level 2 Loop */}
                          {level2Children.length > 0 && (
                            <div className={`pl-10 space-y-3 border-l ml-4 relative ${theme === 'dark' ? 'border-white/5' : 'border-gray-100'}`}>
                              {level2Children.map((lvl2) => {
                                // Filter level 3 children whose referrer matches this level 2 referee
                                const level3Children = level3Logs.filter(lvl3 => lvl3.referredBy === lvl2.refereeId);

                                return (
                                  <div key={lvl2.id} className="space-y-3 pt-1">
                                    {/* Lvl 2 Node Card */}
                                    <div className="flex items-center gap-2 relative">
                                      <CornerDownRight className={`w-3.5 h-3.5 shrink-0 absolute -left-4 top-1.5 ${theme === 'dark' ? 'text-indigo-500/30' : 'text-teal-600/30'}`} />
                                      <div className={`flex-1 rounded-xl p-3 flex items-center justify-between shadow-inner ml-1.5 max-w-sm border ${theme === 'dark' ? 'bg-[#1A1A1A] border-indigo-500/15' : 'bg-white border-teal-500/15'}`}>
                                        <div className="flex items-center gap-2.5">
                                          <div className={`w-6 h-6 rounded flex items-center justify-center border ${theme === 'dark' ? 'border-white/10 bg-white/5 text-blue-400' : 'border-teal-500/10 bg-teal-50 text-teal-600'} text-[10px]`}>
                                            <User className="w-3.5 h-3.5" />
                                          </div>
                                          <div>
                                            <span className={`text-[10.5px] font-extrabold block ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>{lvl2.refereeName}</span>
                                            <span className={`text-[8.5px] uppercase tracking-widest font-semibold block mt-0.5 ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>Tier 2 Agent</span>
                                          </div>
                                        </div>
                                        <span className={`text-[9px] font-mono px-2 py-0.5 rounded border font-black ${theme === 'dark' ? 'text-emerald-400 bg-emerald-400/5 border-emerald-400/10' : 'text-emerald-600 bg-emerald-50 border-emerald-500/10'}`}>+$0.033</span>
                                      </div>
                                    </div>

                                    {/* Level 3 Loop */}
                                    {level3Children.length > 0 && (
                                      <div className={`pl-10 space-y-2 border-l ml-4 relative ${theme === 'dark' ? 'border-white/5' : 'border-gray-100'}`}>
                                        {level3Children.map((lvl3) => (
                                          <div key={lvl3.id} className="flex items-center gap-2 pt-1 relative">
                                            <CornerDownRight className={`w-3.5 h-3.5 shrink-0 absolute -left-4 top-1.5 ${theme === 'dark' ? 'text-sky-500/30' : 'text-cyan-600/30'}`} />
                                            <div className={`flex-1 rounded-xl p-2.5 flex items-center justify-between shadow-sm ml-1.5 max-w-xs border ${theme === 'dark' ? 'bg-[#1A1A1A] border-sky-400/15' : 'bg-white border-cyan-500/15'}`}>
                                              <div className="flex items-center gap-2">
                                                <div className={`w-5 h-5 rounded flex items-center justify-center border ${theme === 'dark' ? 'border-white/10 bg-white/5 text-blue-400' : 'border-cyan-500/10 bg-cyan-50 text-cyan-600'} text-[9px]`}>
                                                  <User className="w-3 h-3" />
                                                </div>
                                                <div>
                                                  <span className={`text-[10px] font-extrabold block leading-none ${theme === 'dark' ? 'text-white/80' : 'text-slate-800'}`}>{lvl3.refereeName}</span>
                                                  <span className={`text-[8px] uppercase tracking-widest font-semibold block mt-0.5 leading-none ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>Tier 3 Associate</span>
                                                </div>
                                              </div>
                                              <span className={`text-[8.5px] font-mono px-1.5 py-0.5 rounded border font-bold ${theme === 'dark' ? 'text-emerald-400 bg-emerald-400/5 border-emerald-400/10' : 'text-emerald-600 bg-emerald-50 border-emerald-500/10'}`}>+$0.011</span>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
