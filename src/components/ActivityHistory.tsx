import React, { useEffect, useState } from 'react';
import { Clock, ShieldAlert, Smartphone } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';

interface Activity {
  id: string;
  action: string;
  details: string;
  timestamp: any;
  ipAddress?: string;
  device?: string;
}

interface ActivityHistoryProps {
  userId: string;
}

export function ActivityHistory({ userId }: ActivityHistoryProps) {
  const [activities, setActivities] = useState<Activity[]>([]);

  useEffect(() => {
    if (!userId) return;

    const activitiesRef = collection(db, 'users', userId, 'activities');
    const activitiesQuery = query(activitiesRef, orderBy('timestamp', 'desc'));

    const unsub = onSnapshot(activitiesQuery, (snapshot) => {
      const list: Activity[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Activity);
      });
      setActivities(list);
    });

    return () => unsub();
  }, [userId]);

  return (
    <div className="bg-[#111111] border border-white/5 rounded-2xl p-6 space-y-4">
      <h3 className="text-sm font-black text-blue-400 uppercase tracking-widest flex items-center gap-2">
        <Clock className="w-5 h-5" /> Account Activity History
      </h3>
      
      <div className="space-y-3">
        {activities.map((activity) => (
          <div key={activity.id} className="bg-slate-950/40 border border-white/5 rounded-xl p-4 text-xs flex gap-4">
            <div className="mt-1 text-blue-400">
                {activity.action.toLowerCase().includes('login') ? <Smartphone className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
            </div>
            <div className="flex-1">
              <p className="font-bold text-white/80">{activity.action}</p>
              <p className="text-white/60">{activity.details}</p>
              <p className="text-white/30 mt-1">
                {activity.timestamp?.toDate ? activity.timestamp.toDate().toLocaleString() : 'Just now'}
              </p>
            </div>
          </div>
        ))}
        {activities.length === 0 && <p className="text-white/30 text-center py-4">No recent activity.</p>}
      </div>
    </div>
  );
}
