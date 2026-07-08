import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, HelpCircle } from 'lucide-react';

interface FaqItemConfig {
  question: string;
  answer: (theme: 'light' | 'dark') => React.ReactNode;
}

const faqs: FaqItemConfig[] = [
  {
    question: 'How do deposit cycles and earnings work?',
    answer: (theme) => (
      <div className="space-y-2">
        <p>Your daily profit of approved deposits is distributed every 24 hours based on the tier levels:</p>
        <ol className={`space-y-1 list-decimal list-inside ${theme === 'dark' ? 'text-white/50' : 'text-slate-500'} pl-1`}>
          <li><strong className="text-amber-500">Level 1: Bronze ($5 - $14)</strong> - earns <span className="text-emerald-500 font-bold">3% daily</span></li>
          <li><strong className="text-indigo-500">Level 2: Silver ($15 - $49)</strong> - earns <span className="text-emerald-500 font-bold">4% daily</span></li>
          <li><strong className="text-amber-500">Level 3: Gold ($50 - $99)</strong> - earns <span className="text-emerald-500 font-bold">5% daily</span></li>
          <li><strong className="text-emerald-500">Level 4: Platinum Star ($100+)</strong> - earns <span className="text-emerald-500 font-bold">7% daily</span></li>
        </ol>
        <p className={`text-[11px] ${theme === 'dark' ? 'text-white/40' : 'text-slate-400'} italic`}>Note: The cycle restarts every 24 hours from the time your deposit is validated.</p>
      </div>
    )
  },
  {
    question: 'How do referral earnings work?',
    answer: (theme) => (
      <p className={theme === 'dark' ? 'text-white/60' : 'text-slate-600'}>
        When a new user signs up using your unique referral link and makes their first deposit, you will automatically receive a referral bonus credited to your account balance. Distribute your link to maximize your earnings.
      </p>
    )
  },
  {
    question: 'What are the withdrawal status timelines?',
    answer: (theme) => (
      <span className={theme === 'dark' ? 'text-white/60' : 'text-slate-600'}>
        Withdrawal requests are initially marked as &quot;Pending&quot;. We prioritize <strong>Fast Withdrawals</strong>, meaning they are reviewed and processed by our active ledger checkers at high speeds. Once verified, funds dispatch instantly to your designated wallet address.
      </span>
    )
  },
];

interface FaqSectionProps {
  theme?: 'light' | 'dark';
}

export function FaqSection({ theme = 'light' }: FaqSectionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleOpen = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="space-y-4 font-sans">
      <div className="flex items-center gap-2 mb-6">
        <div className="bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20">
          <HelpCircle className="w-5 h-5 text-emerald-500" />
        </div>
        <div>
          <h2 className={`text-sm font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>Frequently Asked Questions</h2>
          <p className={`text-[11px] ${theme === 'dark' ? 'text-white/50' : 'text-slate-500'} tracking-wide mt-0.5`}>Learn more about cycles, referrals, and withdrawals.</p>
        </div>
      </div>

      <div className="space-y-3">
        {faqs.map((faq, index) => {
          const isOpen = openIndex === index;
          return (
            <div 
              key={index} 
              className={`border overflow-hidden transition-all duration-300 ${
                theme === 'dark'
                  ? `bg-[#131B2E] border-white/5 ${isOpen ? 'rounded-2xl border-white/10' : 'rounded-xl hover:border-white/10'}`
                  : `bg-white border-gray-100 ${isOpen ? 'rounded-2xl border-gray-200 shadow-sm' : 'rounded-xl hover:border-gray-200'}`
              }`}
            >
              <button 
                type="button"
                onClick={() => toggleOpen(index)}
                className="w-full px-5 py-4 flex items-center justify-between text-left focus:outline-none cursor-pointer border-0 bg-transparent"
              >
                <span className={`text-[13px] font-semibold ${theme === 'dark' ? 'text-white/90' : 'text-slate-700'}`}>{faq.question}</span>
                <motion.div
                  animate={{ rotate: isOpen ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  className={`p-1 rounded-full ${theme === 'dark' ? 'bg-white/5 text-white/50' : 'bg-gray-100 text-slate-500'}`}
                >
                  <ChevronDown className="w-4 h-4" />
                </motion.div>
              </button>
              
              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className={`px-5 pb-5 text-[12px] leading-relaxed max-w-2xl border-t pt-3 ${
                      theme === 'dark' ? 'text-white/60 border-white/5' : 'text-slate-600 border-gray-100'
                    }`}>
                      {faq.answer(theme)}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
