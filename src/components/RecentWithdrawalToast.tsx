import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check } from 'lucide-react';
import { playSound } from '../lib/sounds';

export interface RecentWithdrawalRecord {
  id: string;
  amount: number;
  network: string;
  wallet: string;
  timestamp: string;
  userInitial: string;
  status?: string;
  userId?: string;
  userName?: string;
  email?: string;
}

interface RecentWithdrawalToastProps {
  feed?: RecentWithdrawalRecord[];
}

const FALLBACK_USERS = [
  "A*** K***",
  "M*** A***",
  "U*** H***",
  "R*** K***",
  "S*** A***",
  "H*** A***",
  "F*** M***",
  "B*** A***"
];

const FALLBACK_METHODS = [
  "EasyPaisa",
  "JazzCash",
  "Binance",
  "SadaPay"
];

export default function RecentWithdrawalToast({ feed = [] }: RecentWithdrawalToastProps) {
  const [show, setShow] = useState(false);
  const [currentUser, setCurrentUser] = useState("");
  const [currentAmount, setCurrentAmount] = useState("");
  const [currentMethod, setCurrentMethod] = useState("");
  const [currentTime, setCurrentTime] = useState("");

  const prevLenRef = useRef(feed.length);

  const loadRandomData = () => {
    if (feed && feed.length > 0) {
      const record = feed[Math.floor(Math.random() * feed.length)];
      setCurrentUser(record.userInitial || "A guest user");
      setCurrentAmount(`$${Number(record.amount || 10).toFixed(2)}`);
      setCurrentMethod(record.network || "Binance");
      setCurrentTime(record.timestamp || "Just now");
    } else {
      // Offline or empty DB simulation using realistic templates
      const user = FALLBACK_USERS[Math.floor(Math.random() * FALLBACK_USERS.length)];
      const amount = `$${(Math.floor(Math.random() * 80) + 12).toFixed(2)}`;
      const method = FALLBACK_METHODS[Math.floor(Math.random() * FALLBACK_METHODS.length)];
      
      setCurrentUser(user);
      setCurrentAmount(amount);
      setCurrentMethod(method);
      setCurrentTime("Just now");
    }
  };

  // 1. Show dynamic real-time pop-up when a new withdrawal is approved in the database
  useEffect(() => {
    if (!feed || feed.length === 0) return;

    if (feed.length > prevLenRef.current) {
      const latest = feed[0]; // first item is newest
      setCurrentUser(latest.userInitial || "An anonymous client");
      setCurrentAmount(`$${Number(latest.amount || 20).toFixed(2)}`);
      setCurrentMethod(latest.network || "SadaPay");
      setCurrentTime(latest.timestamp || "Just now");
      setShow(true);

      // Play soft notification tone safely
      try {
        playSound('withdrawal_approved');
      } catch (e) {
        console.warn("Sound blocked by browser media policies", e);
      }

      const hideTimer = setTimeout(() => {
        setShow(false);
      }, 6000);

      prevLenRef.current = feed.length;
      return () => clearTimeout(hideTimer);
    }

    prevLenRef.current = feed.length;
  }, [feed]);

  // 2. Continuous rotating feed loop (every 32 seconds)
  useEffect(() => {
    // Show first popup after 12 seconds
    const initialDelay = setTimeout(() => {
      loadRandomData();
      setShow(true);

      const hideTimer = setTimeout(() => {
        setShow(false);
      }, 6000);

      return () => clearTimeout(hideTimer);
    }, 12000);

    const interval = setInterval(() => {
      loadRandomData();
      setShow(true);

      const hideTimer = setTimeout(() => {
        setShow(false);
      }, 6000);

      return () => clearTimeout(hideTimer);
    }, 32000);

    return () => {
      clearTimeout(initialDelay);
      clearInterval(interval);
    };
  }, [feed]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          id="live-payout-popup"
          initial={{ opacity: 0, x: -100, scale: 0.9 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -50, scale: 0.9 }}
          transition={{ type: "spring", damping: 20, stiffness: 120 }}
          className="fixed bottom-24 left-4 sm:bottom-6 sm:left-6 z-[99999] w-[320px] overflow-hidden rounded-2xl bg-[#0F0F0F]/95 border-l-4 border-l-[#10B981] border border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.8)] backdrop-blur-xl p-4 flex flex-col gap-3.5"
        >
          {/* Status pulsing indicator */}
          <div className="absolute top-2 right-2.5 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse"></span>
            <span className="text-[7px] text-[#10B981] font-black uppercase tracking-wider">SECURE PAYOUT DIRECTRY</span>
          </div>

          <div className="flex gap-3 items-center relative">
            <div className="relative flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-[#10B981]/25 to-black border border-[#10B981]/40 flex items-center justify-center text-2xl shadow-[0_0_15px_rgba(16,185,129,0.15)] select-none">
              💸
              <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center border border-black scale-90">
                <Check className="w-2.5 h-2.5 text-black stroke-[3.5]" />
              </span>
            </div>

            <div className="flex-1 text-left min-w-0 pr-4">
              <p className="text-white text-xs font-semibold leading-relaxed leading-snug">
                <span className="text-zinc-300 font-extrabold">{currentUser}</span> successfully withdrew <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-[#D4AF37] to-emerald-400 font-black font-mono">{currentAmount}</span> via <span className="text-blue-400 font-extrabold uppercase text-[9px] tracking-wider bg-blue-600/10 px-1.5 py-0.5 rounded border border-blue-500/20 select-none">{currentMethod}</span>
              </p>
              <span className="text-[10px] text-zinc-500 font-medium font-sans flex items-center gap-1 mt-1 select-none">
                ⏱ {currentTime}
              </span>
            </div>

            <button
              onClick={() => setShow(false)}
              className="absolute -top-1 right-0 text-zinc-500 hover:text-white transition-all p-1 rounded-full bg-white/5 hover:bg-white/10 border-0 cursor-pointer"
              aria-label="Dismiss payout notice"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          
          {/* Visual remaining time line indicator at the bottom */}
          <div className="w-full bg-white/5 h-[2px] rounded-full overflow-hidden absolute bottom-0 left-0 right-0">
            <motion.div 
              initial={{ width: "100%" }}
              animate={{ width: "0%" }}
              transition={{ duration: 6, ease: "linear" }}
              className="h-full bg-gradient-to-r from-[#10B981] to-blue-400"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
