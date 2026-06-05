/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface BotStats {
  msgs: number;
  replies: number;
  cmds: number;
  start: number;
}

export interface BotDelays {
  ment: number;
  leak: number;
}

export interface LeakImage {
  id: number;
  url: string;
  text: string;
  added: number;
}

export interface LogEntry {
  id: string;
  timestamp: number;
  level: 'info' | 'success' | 'warn' | 'error' | 'cmd' | 'msg' | 'sys';
  message: string;
}

export interface BotSession {
  id: string; // matches document Id
  ownerId: string;
  name: string;
  phoneNumber?: string;
  status: 'Disconnected' | 'Connecting' | 'Connected' | 'Error';
  errorReason?: string;
  botMode: 'all' | 'group' | 'dm';
  botEnabled: boolean;
  processFromMe: boolean;
  delays: BotDelays;
  stats: BotStats;
  allowedGroups: string[] | null;
  responseTexts: string[];
  owners: string[];
  monitors: string[];
  blocked: string[];
  muted: string[];
  mentUsers: string[];
  leakImages: LeakImage[];
  createdAt: number;
}

export interface WebUser {
  uid: string;
  email: string | null;
  displayName: string | null;
}
