/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ReferralLog {
  id: string;
  timestamp: string;
  amount: number;
  referrerName?: string;
  refereeId: string;
  createdAt: any; // can be Firestore Timestamp
  refereeAvatar?: string;
  source?: string;
  level?: number;
  referredBy?: string;
  refereeName?: string;
}

export interface UserProfile {
  userId: string;
  name: string;
  createdAt: any;
  updatedAt: any;
  avatar?: string;
  signupBonus?: number;
  lastClaimedAt?: string;
  claimStreak?: number;
  dailyBonusEarnings?: number;
  blocked?: boolean;
  isSuspicious?: boolean;
  ipAddress?: string;
  deviceFingerprint?: string;
  browserInfo?: string;
  email?: string;
  emailVerified?: boolean;
  usedGiftCodes?: string[];
}

export interface DepositLog {
  id: string;
  amount: number;
  network: string;
  txHash: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: any;
  timestamp: string;
  screenshot?: string;
  userName?: string;
  userId?: string;
  email?: string;
}

export interface WithdrawalLog {
  id: string;
  amount: number;
  wallet: string;
  network: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: any;
  timestamp: string;
  userName?: string;
  userId?: string;
  email?: string;
}

export interface UserPlan {
  id: string;
  planId: string;
  amount: number;
  status: 'active' | 'cancelled' | 'completed';
  createdAt: any;
  timestamp: string;
  cancelledAt?: any;
  completedAt?: any;
}

export interface DailyRewardLog {
  id: string;
  amount: number;
  streak: number;
  timestamp: string;
  createdAt: any;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  platform: 'YouTube' | 'TikTok' | 'Facebook';
  link: string;
  reward: number;
  expiryDate?: any;
  status: 'Active' | 'Inactive';
  createdAt: any;
}

export interface TaskSubmission {
  id: string;
  userId: string;
  username: string;
  taskId: string;
  taskTitle: string;
  platform: string;
  reward: number;
  screenshot: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  submissionTime: any;
  reviewedAt?: any;
  reviewedBy?: any;
  rejectionReason?: string;
}
