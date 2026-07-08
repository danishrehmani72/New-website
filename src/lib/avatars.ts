/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  Crown, 
  Star, 
  Zap, 
  Shield, 
  Coins, 
  Globe, 
  Rocket, 
  Flame 
} from 'lucide-react';

export const AVATAR_PRESETS = [
  { id: 'crown', label: 'Monarch', icon: Crown, color: 'text-[#D4AF37] border-[#D4AF37]/30 bg-[#D4AF37]/10' },
  { id: 'rocket', label: 'Catalyst', icon: Rocket, color: 'text-sky-400 border-sky-400/30 bg-sky-400/10' },
  { id: 'zap', label: 'Vanguard', icon: Zap, color: 'text-amber-400 border-amber-400/30 bg-amber-400/10' },
  { id: 'shield', label: 'Guardian', icon: Shield, color: 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10' },
  { id: 'coins', label: 'Treasurer', icon: Coins, color: 'text-yellow-500 border-yellow-500/30 bg-yellow-500/10' },
  { id: 'globe', label: 'Ambassador', icon: Globe, color: 'text-teal-400 border-teal-400/30 bg-teal-400/10' },
  { id: 'star', label: 'Virtuoso', icon: Star, color: 'text-indigo-400 border-indigo-400/30 bg-indigo-400/10' },
  { id: 'flame', label: 'Dynamo', icon: Flame, color: 'text-rose-500 border-rose-500/30 bg-rose-500/10' },
];

export function getAvatarConfig(id: string | undefined) {
  const default_val = { id: 'star', label: 'Virtuoso', icon: Star, color: 'text-[#D4AF37] border-[#D4AF37]/30 bg-[#D4AF37]/10' };
  if (!id) return default_val;
  return AVATAR_PRESETS.find(p => p.id === id) || default_val;
}

interface AvatarIconProps {
  id: string | undefined;
  className?: string;
  size?: number;
}

export function AvatarIcon({ id, className = 'w-5 h-5', size }: AvatarIconProps) {
  const config = getAvatarConfig(id);
  const IconComponent = config.icon;
  return React.createElement(IconComponent, { className, size });
}
