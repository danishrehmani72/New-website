import React, { useState } from 'react';
import { motion } from 'motion/react';
import { UserPlan } from '../types';
import { ShieldCheck, CheckCircle2, TrendingUp, XCircle, ArrowRight, Lock, Zap } from 'lucide-react';

interface PlanMatrixProps {
  balance: number;
  investments: UserPlan[];
  onCreatePlan: (planId: string, amount: number) => Promise<void>;
  onCancelPlan: (invId: string) => Promise<void>;
  currencySymbol: string;
  conversionRate: number;
  theme?: 'light' | 'dark';
}

const PLANS = [
  { id: 'mini', name: 'Mini Portfolio', min: 25, max: 99.99, targetPercent: 5, color: 'text-blue-500 dark:text-blue-400', badgeColor: 'bg-blue-500/10 text-blue-600 dark:text-blue-300 border-blue-500/15', border: 'border-gray-100 dark:border-white/5', accentBg: 'from-blue-500/10 to-transparent' },
  { id: 'bronze', name: 'Starter Portfolio', min: 100, max: 999.99, targetPercent: 8, color: 'text-emerald-500 dark:text-emerald-400', badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/15', border: 'border-gray-100 dark:border-white/5', accentBg: 'from-emerald-500/10 to-transparent' },
  { id: 'silver', name: 'Growth Portfolio', min: 1000, max: 4999.99, targetPercent: 12, color: 'text-emerald-600 dark:text-emerald-400', badgeColor: 'bg-teal-500/10 text-teal-600 dark:text-teal-300 border-teal-500/15', border: 'border-gray-100 dark:border-white/5', accentBg: 'from-teal-500/10 to-transparent' },
  { id: 'gold', name: 'Pro Portfolio', min: 5000, max: 24999.99, targetPercent: 18, color: 'text-[#16A34A] dark:text-emerald-400', badgeColor: 'bg-emerald-600/10 text-emerald-700 dark:text-emerald-300 border-emerald-600/15', border: 'border-gray-100 dark:border-white/5', accentBg: 'from-[#16A34A]/10 to-transparent' },
  { id: 'diamond', name: 'Elite Portfolio', min: 25000, max: Infinity, targetPercent: 24, color: 'text-[#22C55E] dark:text-emerald-400', badgeColor: 'bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/15', border: 'border-gray-100 dark:border-white/5', accentBg: 'from-[#22C55E]/15 to-transparent' },
];

export function PlanMatrix({ balance, investments, onCreatePlan, onCancelPlan, currencySymbol, conversionRate, theme = 'light' }: PlanMatrixProps) {
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const activePlans = investments.filter(inv => inv.status === 'active');
  const completedPlans = investments.filter(inv => inv.status === 'completed');

  const handleActivate = async () => {
    setError('');
    const amt = parseFloat(depositAmount) / conversionRate;
    
    if (isNaN(amt) || amt < selectedPlan.min) {
      setError(`Minimum deposit for ${selectedPlan.name} is ${currencySymbol}${(selectedPlan.min * conversionRate).toFixed(2)}`);
      return;
    }
    if (selectedPlan.max !== Infinity && amt > selectedPlan.max) {
      setError(`Maximum deposit for ${selectedPlan.name} is ${currencySymbol}${(selectedPlan.max * conversionRate).toFixed(2)}`);
      return;
    }
    if (amt > balance) {
      setError(`Insufficient wallet balance. Please add funds.`);
      return;
    }
    
    setIsLoading(true);
    await onCreatePlan(selectedPlan.id, amt);
    setIsLoading(false);
    setSelectedPlan(null);
    setDepositAmount('');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {PLANS.map(plan => {
          const hasActive = activePlans.some(inv => inv.planId === plan.id);
          
          return (
            <motion.div 
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.99 }}
              key={plan.id} 
              className={`rounded-[20px] border ${plan.border} p-6 relative overflow-hidden flex flex-col justify-between transition-all duration-300 cursor-pointer shadow-[0_8px_30px_rgb(0,0,0,0.02)] hover:shadow-[0_15px_40px_rgba(34,197,94,0.06)] dark:hover:shadow-[0_15px_40px_rgba(22,163,74,0.12)] ${
                theme === 'dark' 
                  ? 'bg-[#111625]/80 backdrop-blur-md text-white hover:border-[#22C55E]/20' 
                  : 'bg-white text-slate-800 hover:border-[#22C55E]/30'
              }`} 
              onClick={() => setSelectedPlan(plan)}
            >
               {/* Accent Gradient Glow Corner */}
               <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${plan.accentBg} blur-2xl opacity-40 rounded-full pointer-events-none`} />

               <div className="space-y-4 relative z-10 mb-5">
                 <div className="flex items-start justify-between">
                   <h4 className={`text-lg font-black tracking-tight ${plan.color}`}>{plan.name}</h4>
                   <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${plan.badgeColor}`}>
                     {plan.targetPercent}% ROI
                   </span>
                 </div>

                 <div className="space-y-2.5">
                   <div className="flex items-center justify-between text-xs py-1 border-b border-gray-100/50 dark:border-white/5">
                     <span className="text-slate-400 dark:text-zinc-500 font-medium">Staking Limit</span>
                     <strong className="font-extrabold font-mono text-slate-700 dark:text-zinc-200">
                       {currencySymbol}{(plan.min * conversionRate).toLocaleString(undefined, { maximumFractionDigits: 0 })} {plan.max === Infinity ? '+' : `- ${currencySymbol}${(plan.max * conversionRate).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                     </strong>
                   </div>

                   <div className="flex items-center justify-between text-xs py-1 border-b border-gray-100/50 dark:border-white/5">
                     <span className="text-slate-400 dark:text-zinc-500 font-medium">Daily Interest</span>
                     <strong className="font-extrabold text-[#22C55E]">Dynamic Return</strong>
                   </div>

                   <div className="flex items-center justify-between text-xs py-1">
                     <span className="text-slate-400 dark:text-zinc-500 font-medium">Lock-up Period</span>
                     <strong className="font-extrabold text-slate-700 dark:text-zinc-200">30 Days</strong>
                   </div>
                 </div>
               </div>
               
               <div className="relative z-10 w-full">
                  <button className={`w-full py-3 rounded-xl font-bold uppercase tracking-widest text-[10px] transition-all cursor-pointer border-0 flex items-center justify-center gap-1.5 ${
                    hasActive 
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-extrabold border border-emerald-500/20' 
                      : 'bg-gradient-to-r from-[#22C55E] to-[#16A34A] text-white hover:opacity-90 shadow-md shadow-emerald-500/10'
                  }`}>
                     {hasActive ? (
                       <>
                         <CheckCircle2 className="w-3.5 h-3.5" />
                         <span>Plan Active</span>
                       </>
                     ) : (
                       <>
                         <span>Stake Portfolio</span>
                         <ArrowRight className="w-3.5 h-3.5" />
                       </>
                     )}
                  </button>
               </div>
               
               <div className={`absolute -right-8 -bottom-8 opacity-[0.03] dark:opacity-[0.05] ${plan.color}`}>
                  <ShieldCheck className="w-32 h-32" />
               </div>
            </motion.div>
          );
        })}
      </div>

      {activePlans.length > 0 && (
        <div className={`rounded-[20px] p-6 border ${theme === 'dark' ? 'bg-[#111625]/85 border-white/5' : 'bg-white border-gray-150 shadow-sm'}`}>
           <h3 className={`text-[10px] font-black uppercase tracking-widest mb-4 flex items-center gap-2 ${theme === 'dark' ? 'text-zinc-400' : 'text-slate-500'}`}>
             <Zap className="w-4 h-4 text-emerald-500 animate-pulse" />
             <span>Active Locked Portfolios</span>
           </h3>
           <div className="space-y-3">
             {activePlans.map(inv => {
               const planInfo = PLANS.find(p => p.id === inv.planId);
               const nowTime = Date.now();
               const startTime = inv.createdAt?.seconds 
                 ? inv.createdAt.seconds * 1000 
                 : new Date(inv.timestamp).getTime() || nowTime;
               
               const elapsedMs = nowTime - startTime;
               const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
               const isLocked = elapsedMs < thirtyDaysMs;
               const remainingDays = isLocked ? Math.ceil((thirtyDaysMs - elapsedMs) / (24 * 60 * 60 * 1000)) : 0;
               const elapsedDays = 30 - remainingDays;
               const progressPercent = Math.min(100, Math.max(0, (elapsedDays / 30) * 100));

               // Calculate performance multiplier for the current day
               const currentDay = Math.max(1, elapsedDays);
               const hashStr = (inv.id || String(startTime)) + "_" + currentDay;
               let hash = 0;
               for (let idx = 0; idx < hashStr.length; idx++) {
                 hash = hashStr.charCodeAt(idx) + ((hash << 5) - hash);
               }
               const index = Math.abs(hash) % 4;
               const multiplier = [0.98, 1.02, 0.95, 1.05][index];
               const isAboveTarget = multiplier > 1.0;

               return (
                 <div key={inv.id} className={`flex flex-col rounded-xl p-4 gap-4 border ${theme === 'dark' ? 'bg-slate-950/40 border-white/5' : 'bg-gray-50 border-gray-100'}`}>
                   <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                     <div className="text-left">
                       <p className={`text-sm font-black capitalize ${planInfo?.color || 'text-white'}`}>{inv.planId} Package</p>
                       <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-zinc-500' : 'text-slate-500'}`}>Principal Locked: <strong className="font-mono text-slate-800 dark:text-white">{currencySymbol}{(inv.amount * conversionRate).toFixed(2)}</strong></p>
                     </div>
                     <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                       <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] uppercase font-bold tracking-wider rounded border border-emerald-500/15">Dynamic Profit Accruing</span>
                       
                       <span className={`flex items-center gap-1 px-2.5 py-1 text-[9px] uppercase font-bold tracking-wider rounded border ${isAboveTarget ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border-rose-500/20'}`}>
                         <TrendingUp className={`w-3 h-3 ${isAboveTarget ? '' : 'rotate-180'}`} />
                         {isAboveTarget ? 'Above Target' : 'Below Target'}
                       </span>

                       {true ? (
                         <div className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded select-none cursor-default" title="This plan is locked. Accrued profits automatically transfer upon completion.">
                           <Lock className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                           <span>Locked ({remainingDays}d / Max 30d)</span>
                         </div>
                       ) : (
                         <button onClick={() => onCancelPlan(inv.id)} className="px-3 py-1.5 text-[10px] uppercase font-bold text-rose-400 tracking-wider bg-rose-500/10 border border-rose-500/20 rounded hover:bg-rose-500/20 transition-all border-0 cursor-pointer">Cancel Plan</button>
                       )}
                     </div>
                   </div>
                   
                   {/* Progress Bar */}
                   <div className="w-full space-y-1.5">
                     <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                       <span>Progress: {elapsedDays} Days</span>
                       <span>{progressPercent.toFixed(0)}%</span>
                     </div>
                     <div className="w-full h-2 bg-gray-200 dark:bg-slate-800 rounded-full overflow-hidden">
                       <div 
                         className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-1000 ease-out rounded-full"
                         style={{ width: `${progressPercent}%` }}
                       />
                     </div>
                   </div>
                 </div>
               );
             })}
           </div>
        </div>
      )}

      {completedPlans.length > 0 && (
        <div className={`rounded-[20px] p-6 border ${theme === 'dark' ? 'bg-[#111625]/85 border-emerald-500/10' : 'bg-white border-emerald-500/10 shadow-sm'}`}>
            <h3 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>Completed (Matured) Portfolios</span>
            </h3>
            <div className="space-y-3">
               {completedPlans.map(inv => {
                 const planInfo = PLANS.find(p => p.id === inv.planId);
                 return (
                   <div key={inv.id} className={`flex flex-col sm:flex-row justify-between sm:items-center rounded-xl p-4 gap-4 border ${theme === 'dark' ? 'bg-slate-950/40 border-emerald-500/10' : 'bg-gray-50 border-emerald-500/10'}`}>
                     <div className="text-left">
                       <p className={`text-sm font-black capitalize ${planInfo?.color || 'text-white'}`}>{inv.planId} Package</p>
                       <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-zinc-400' : 'text-slate-500'}`}>Matured Return: <strong className="font-mono text-slate-800 dark:text-white">{currencySymbol}{(inv.amount * (planInfo ? 1 + (planInfo.targetPercent / 100) : 1.20) * conversionRate).toFixed(2)}</strong> (Principal & Yield Credited)</p>
                     </div>
                     <div className="flex items-center gap-4">
                       <div className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase font-bold text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 rounded select-none cursor-default">
                         <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                         <span>Matured</span>
                       </div>
                     </div>
                   </div>
                 );
               })}
            </div>
        </div>
      )}

      {/* Deposit Modal / Plan Setup Modal */}
      {selectedPlan && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
           {/* Backdrop Overlay */}
           <div className={`fixed inset-0 cursor-pointer ${theme === 'dark' ? 'bg-slate-950/80' : 'bg-slate-900/60'} backdrop-blur-sm`} onClick={() => { setSelectedPlan(null); setError(''); }} />

           <motion.div 
             initial={{ opacity: 0, scale: 0.95, y: 15 }}
             animate={{ opacity: 1, scale: 1, y: 0 }}
             exit={{ opacity: 0, scale: 0.95, y: 15 }}
             className={`w-full max-w-md rounded-[24px] shadow-2xl p-6 border relative z-50 ${theme === 'dark' ? 'bg-[#111625] border-white/10 text-white' : 'bg-white border-gray-200 text-slate-800'}`}
           >
              <div className="flex justify-between items-center mb-6">
                 <div className="text-left">
                   <h2 className={`text-lg font-black tracking-tight ${selectedPlan.color}`}>Activate {selectedPlan.name}</h2>
                   <p className={`text-[10px] mt-1 font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-zinc-500' : 'text-slate-400'}`}>Est. Completion ROI: {selectedPlan.targetPercent}%</p>
                 </div>
                 <button onClick={() => { setSelectedPlan(null); setError(''); }} className={`p-2 rounded-full cursor-pointer border-0 transition-colors ${theme === 'dark' ? 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10' : 'bg-gray-100 text-slate-400 hover:text-slate-600 hover:bg-gray-200'}`}>
                   <XCircle className="w-5 h-5" />
                 </button>
              </div>

              <div className="space-y-4">
                 <div className={`border rounded-xl p-4 flex justify-between items-center text-xs font-sans ${theme === 'dark' ? 'bg-slate-950/50 border-white/5' : 'bg-gray-50 border-gray-100'}`}>
                   <span className={theme === 'dark' ? 'text-zinc-400' : 'text-slate-500'}>Available Wallet Balance</span>
                   <span className={`font-mono font-black text-sm ${theme === 'dark' ? 'text-[#22C55E]' : 'text-slate-800'}`}>{currencySymbol}{(balance * conversionRate).toFixed(2)}</span>
                 </div>
                 
                 <div className="space-y-1.5 text-left">
                   <label className={`text-[10px] font-black tracking-widest uppercase ml-1 ${theme === 'dark' ? 'text-zinc-400' : 'text-slate-500'}`}>Investment Amount ({currencySymbol.trim()})</label>
                   <input 
                      type="number" 
                      value={depositAmount} 
                      onChange={e => setDepositAmount(e.target.value)}
                      placeholder={`Min ${selectedPlan.min * conversionRate}`}
                      className={`w-full border rounded-xl px-4 py-3.5 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 font-mono text-sm ${theme === 'dark' ? 'bg-[#161616] border-white/10 text-white' : 'bg-gray-50 border-gray-200 text-slate-800'}`}
                   />
                 </div>

                 {error && (
                   <p className="text-xs text-rose-500 font-bold px-1 text-left">{error}</p>
                 )}

                 <p className={`text-[10px] leading-relaxed px-1 text-left ${theme === 'dark' ? 'text-zinc-500' : 'text-slate-400'}`}>
                   Note: The investment principal will be locked to generate yields. The portfolio automatically matures once the Estimated Yield of {selectedPlan.targetPercent}% is reached, or after a maximum of 30 days. No manual cancellation or auto-renewal is permitted. 
                   Once completed, your matured principal and profit will be credited to your Matured Balance, ready for reinvestment or withdrawal.
                 </p>

                 <button 
                   onClick={handleActivate}
                   disabled={isLoading || !depositAmount}
                   className="w-full bg-gradient-to-r from-[#22C55E] to-[#16A34A] hover:opacity-90 disabled:bg-slate-300 disabled:text-slate-500 text-white font-black uppercase tracking-widest text-[10px] py-4 rounded-xl transition-all disabled:opacity-50 mt-4 flex items-center justify-center gap-2 border-0 cursor-pointer shadow-lg shadow-emerald-500/10"
                 >
                   {isLoading ? 'Processing...' : 'Confirm Activation'} <ArrowRight className="w-4 h-4" />
                 </button>
              </div>
           </motion.div>
        </div>
      )}
    </motion.div>
  );
}
