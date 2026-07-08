import React from 'react';

interface CodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  sentCode: string | null;
}

export default function CodeModal({ isOpen, onClose, sentCode }: CodeModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="bg-[#111] border border-blue-500/50 p-8 rounded-3xl text-center shadow-2xl max-w-sm w-full">
        <h3 className="text-blue-400 font-black uppercase tracking-widest mb-4">Verification Code</h3>
        <p className="text-white text-sm mb-6 bg-slate-950 p-4 rounded-xl border border-white/10 font-mono">{sentCode || "No code generated."}</p>
        <button
          className="w-full bg-blue-600 text-black font-black py-3 rounded-xl uppercase tracking-widest text-xs"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>
  );
}
