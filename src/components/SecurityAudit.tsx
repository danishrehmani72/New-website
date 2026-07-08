import React, { useMemo } from 'react';
import { ShieldCheck, AlertTriangle } from 'lucide-react';

interface SecurityAuditProps {
  users: any[];
}

export default function SecurityAudit({ users }: SecurityAuditProps) {
  const duplicates = useMemo(() => {
    const ipMap: Record<string, any[]> = {};
    const deviceMap: Record<string, any[]> = {};

    users.forEach(u => {
      if (u.ipAddress) {
        if (!ipMap[u.ipAddress]) ipMap[u.ipAddress] = [];
        ipMap[u.ipAddress].push(u);
      }
      if (u.deviceFingerprint) {
        if (!deviceMap[u.deviceFingerprint]) deviceMap[u.deviceFingerprint] = [];
        deviceMap[u.deviceFingerprint].push(u);
      }
    });

    const ipDuplicates = Object.entries(ipMap).filter(([_, list]) => list.length > 1);
    const deviceDuplicates = Object.entries(deviceMap).filter(([_, list]) => list.length > 1);

    return { ipDuplicates, deviceDuplicates };
  }, [users]);

  return (
    <div className="space-y-6">
      <div className="bg-[#111111] border border-white/5 rounded-2xl p-6 space-y-4">
        <h3 className="text-sm font-black text-blue-400 uppercase tracking-widest flex items-center gap-2">
          <ShieldCheck className="w-5 h-5" /> Security Audit: IP Address Duplicates
        </h3>
        <p className="text-xs text-white/50">Potential matching IP addresses detected across {duplicates.ipDuplicates.length} groups.</p>
        
        <div className="space-y-2">
            {duplicates.ipDuplicates.map(([ip, list], i) => (
                <div key={i} className="bg-slate-950/40 border border-white/5 rounded-xl p-4 text-xs">
                    <span className="font-bold text-white/80">IP: {ip}</span>
                    <ul className="list-disc list-inside mt-2 text-white/60">
                        {list.map(u => <li key={u.userId}>{u.name} ({u.userId})</li>)}
                    </ul>
                </div>
            ))}
        </div>
      </div>

      <div className="bg-[#111111] border border-white/5 rounded-2xl p-6 space-y-4">
        <h3 className="text-sm font-black text-blue-400 uppercase tracking-widest flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" /> Security Audit: Device Fingerprint Duplicates
        </h3>
        <p className="text-xs text-white/50">Potential matching device fingerprints detected across {duplicates.deviceDuplicates.length} groups.</p>

        <div className="space-y-2">
            {duplicates.deviceDuplicates.map(([fp, list], i) => (
                <div key={i} className="bg-slate-950/40 border border-white/5 rounded-xl p-4 text-xs">
                    <span className="font-bold text-white/80">Fingerprint: {fp.substring(0, 15)}...</span>
                    <ul className="list-disc list-inside mt-2 text-white/60">
                        {list.map(u => <li key={u.userId}>{u.name} ({u.userId})</li>)}
                    </ul>
                </div>
            ))}
        </div>
      </div>
    </div>
  );
}
