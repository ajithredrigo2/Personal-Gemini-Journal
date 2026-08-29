import React from 'react';
import { Sparkles, LogOut, BookOpen, ShieldCheck, Plus, History, TrendingUp, Shield, Bell } from 'lucide-react';
import { UserProfile, UserRole } from '../types';

interface NavbarProps {
  user: UserProfile | null;
  userRole?: UserRole;
  activeView: 'new' | 'insights' | 'history' | 'detail' | 'admin';
  onNewEntry: () => void;
  onViewInsights: () => void;
  onViewHistory: () => void;
  onViewAdmin: () => void;
  onOpenWebhooks: () => void;
  onLogout: () => void;
  onOpenSecurityModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  userRole = 'member',
  activeView,
  onNewEntry,
  onViewInsights,
  onViewHistory,
  onViewAdmin,
  onOpenWebhooks,
  onLogout,
  onOpenSecurityModal,
}) => {
  const isAdmin = userRole === 'admin' || userRole === 'superadmin';

  return (
    <header className="sticky top-0 z-40 bg-[#3A3A35] text-[#F5F5F0] border-b border-[#4D4D47] backdrop-blur-md bg-opacity-98 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo & Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#5A5A40]/30 border border-[#5A5A40]/50 flex items-center justify-center text-[#E8E6DF]">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-serif font-semibold tracking-tight text-[#F5F5F0]">
                MindScribe
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-[#5A5A40]/40 text-[#E8E6DF] border border-[#5A5A40]/60 px-2 py-0.5 rounded-full">
                <Sparkles className="w-3 h-3 text-[#E8E6DF]" />
                Gemini 3.6 Flash
              </span>
            </div>
            <p className="text-xs text-[#B5B4AC] hidden sm:block font-sans">
              Private AI Journal & Reflection Engine
            </p>
          </div>
        </div>

        {/* Navigation & User Controls */}
        {user ? (
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            <button
              id="nav-new-entry-btn"
              onClick={onNewEntry}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                activeView === 'new'
                  ? 'bg-[#5A5A40] text-white shadow-xs font-semibold'
                  : 'bg-[#484842] text-[#E8E6DF] hover:bg-[#52524B] border border-[#5A5A53]'
              }`}
            >
              <Plus className="w-4 h-4" />
              <span className="hidden md:inline">New Reflection</span>
              <span className="md:hidden">New</span>
            </button>

            <button
              id="nav-insights-btn"
              onClick={onViewInsights}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                activeView === 'insights'
                  ? 'bg-[#5A5A40] text-white shadow-xs font-semibold'
                  : 'bg-[#484842] text-[#E8E6DF] hover:bg-[#52524B] border border-[#5A5A53]'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              <span>Insights</span>
            </button>

            <button
              id="nav-history-btn"
              onClick={onViewHistory}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                activeView === 'history'
                  ? 'bg-[#5A5A40] text-white shadow-xs font-semibold'
                  : 'bg-[#484842] text-[#E8E6DF] hover:bg-[#52524B] border border-[#5A5A53]'
              }`}
            >
              <History className="w-4 h-4" />
              <span className="hidden sm:inline">Past Entries</span>
              <span className="sm:hidden">History</span>
            </button>

            {/* Admin Dashboard Navigation */}
            <button
              id="nav-admin-btn"
              onClick={onViewAdmin}
              title="Admin Control Center & RBAC"
              className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                activeView === 'admin'
                  ? 'bg-emerald-800 text-white shadow-xs font-semibold'
                  : 'bg-[#484842] text-[#9AC29F] hover:bg-[#52524B] border border-[#9AC29F]/30'
              }`}
            >
              <Shield className="w-4 h-4 text-[#9AC29F]" />
              <span className="hidden lg:inline">Admin Hub</span>
              {isAdmin && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </button>

            {/* Webhooks / Integrations Button */}
            <button
              id="nav-webhooks-btn"
              onClick={onOpenWebhooks}
              title="External Webhooks & Notifications (Slack / Discord)"
              className="p-2 rounded-lg bg-[#484842] hover:bg-[#52524B] text-[#E8E6DF] border border-[#5A5A53] transition-colors cursor-pointer"
            >
              <Bell className="w-4 h-4 text-[#C4C3BA]" />
            </button>

            <button
              id="nav-security-badge-btn"
              onClick={onOpenSecurityModal}
              title="View Security & Cloud Firestore Data Isolation"
              className="p-2 rounded-lg bg-[#484842] hover:bg-[#52524B] text-[#9AC29F] border border-[#9AC29F]/30 transition-colors cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
            </button>

            <div className="h-6 w-px bg-[#5A5A53] hidden sm:block" />

            {/* User Profile avatar & role badge */}
            <div className="flex items-center gap-2">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'User Avatar'}
                  className="w-8 h-8 rounded-full border border-[#6B6B63] object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#5A5A40] border border-[#6B6B4E] text-[#F5F5F0] flex items-center justify-center font-medium text-xs">
                  {user.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'}
                </div>
              )}
            </div>

            <button
              id="nav-logout-btn"
              onClick={onLogout}
              title="Sign Out"
              className="p-2 rounded-lg bg-[#484842] hover:bg-rose-950/40 hover:text-rose-300 text-[#B5B4AC] border border-[#5A5A53] transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            id="nav-security-info-btn"
            onClick={onOpenSecurityModal}
            className="inline-flex items-center gap-1.5 text-xs text-[#E8E6DF] hover:text-white bg-[#484842] px-3 py-1.5 rounded-lg border border-[#5A5A53] transition-colors cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4 text-[#9AC29F]" />
            <span>Encrypted & User-Isolated</span>
          </button>
        )}
      </div>
    </header>
  );
};


