import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  LogOut,
  BookOpen,
  ShieldCheck,
  Plus,
  History,
  TrendingUp,
  Shield,
  Bell,
  Menu,
  X,
  ChevronRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isAdmin = userRole === 'admin' || userRole === 'superadmin';

  // Close mobile menu on Escape key or when viewport expands to desktop
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMobileMenuOpen(false);
    };
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleMobileNavAction = (action: () => void) => {
    action();
    setIsMobileMenuOpen(false);
  };

  const getRoleBadge = (role: UserRole) => {
    if (role === 'superadmin') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold tracking-wide bg-[#4A3B58] text-[#E5D7F2] border border-[#6B557F] px-2 py-0.5 rounded-md whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
          Superadmin
        </span>
      );
    }
    if (role === 'admin') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold tracking-wide bg-[#2C4436] text-[#C2E8D0] border border-[#3E634E] px-2 py-0.5 rounded-md whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Admin
        </span>
      );
    }
    return (
      <span className="inline-flex items-center text-[11px] font-medium bg-[#484842] text-[#D8D7CE] border border-[#5A5A53] px-2 py-0.5 rounded-md whitespace-nowrap">
        Member
      </span>
    );
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-[#3A3A35] text-[#F5F5F0] border-b border-[#4D4D47] backdrop-blur-md bg-opacity-98 shadow-xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
          {/* Brand Logo & Title */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#5A5A40]/30 border border-[#5A5A40]/50 flex items-center justify-center text-[#E8E6DF] shrink-0">
              <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="text-base sm:text-lg lg:text-xl font-serif font-semibold tracking-tight text-[#F5F5F0] whitespace-nowrap">
                  MindScribe
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-medium bg-[#5A5A40]/40 text-[#E8E6DF] border border-[#5A5A40]/60 px-1.5 sm:px-2 py-0.5 rounded-full whitespace-nowrap">
                  <Sparkles className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-[#E8E6DF]" />
                  <span className="hidden xs:inline">Gemini AI</span>
                  <span className="xs:hidden">AI</span>
                </span>
              </div>
              <p className="text-[11px] text-[#B5B4AC] hidden xl:block font-sans">
                Private AI Journal & Reflection Engine
              </p>
            </div>
          </div>

          {/* User Logged In: Navigation Controls */}
          {user ? (
            <>
              {/* Desktop Navigation (>= lg screens) */}
              <div className="hidden lg:flex items-center gap-1.5 xl:gap-2 shrink-0">
                <button
                  id="nav-new-entry-btn"
                  onClick={onNewEntry}
                  className={`h-9 inline-flex items-center gap-1.5 px-3 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
                    activeView === 'new'
                      ? 'bg-[#5A5A40] text-white shadow-xs font-semibold'
                      : 'bg-[#484842] text-[#E8E6DF] hover:bg-[#52524B] border border-[#5A5A53]'
                  }`}
                >
                  <Plus className="w-4 h-4" />
                  <span>New Reflection</span>
                </button>

                <button
                  id="nav-insights-btn"
                  onClick={onViewInsights}
                  className={`h-9 inline-flex items-center gap-1.5 px-3 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
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
                  className={`h-9 inline-flex items-center gap-1.5 px-3 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
                    activeView === 'history'
                      ? 'bg-[#5A5A40] text-white shadow-xs font-semibold'
                      : 'bg-[#484842] text-[#E8E6DF] hover:bg-[#52524B] border border-[#5A5A53]'
                  }`}
                >
                  <History className="w-4 h-4" />
                  <span>History</span>
                </button>

                {/* Admin Dashboard Navigation */}
                <button
                  id="nav-admin-btn"
                  onClick={onViewAdmin}
                  title="Admin Control Center & RBAC"
                  className={`h-9 inline-flex items-center gap-1.5 px-2.5 sm:px-3 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
                    activeView === 'admin'
                      ? 'bg-emerald-800 text-white shadow-xs font-semibold'
                      : 'bg-[#484842] text-[#9AC29F] hover:bg-[#52524B] border border-[#9AC29F]/30'
                  }`}
                >
                  <Shield className="w-4 h-4 text-[#9AC29F]" />
                  <span className="hidden xl:inline">Admin Hub</span>
                  <span className="xl:hidden">Admin</span>
                  {isAdmin && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  )}
                </button>

                {/* Webhooks / Integrations Button */}
                <button
                  id="nav-webhooks-btn"
                  onClick={onOpenWebhooks}
                  title="External Webhooks & Notifications (Slack / Discord)"
                  className="h-9 w-9 inline-flex items-center justify-center rounded-lg bg-[#484842] hover:bg-[#52524B] text-[#E8E6DF] border border-[#5A5A53] transition-colors cursor-pointer"
                >
                  <Bell className="w-4 h-4 text-[#C4C3BA]" />
                </button>

                <button
                  id="nav-security-badge-btn"
                  onClick={onOpenSecurityModal}
                  title="View Security & Cloud Firestore Data Isolation"
                  className="h-9 w-9 inline-flex items-center justify-center rounded-lg bg-[#484842] hover:bg-[#52524B] text-[#9AC29F] border border-[#9AC29F]/30 transition-colors cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                </button>

                <div className="h-6 w-px bg-[#5A5A53] mx-1" />

                {/* User Profile avatar */}
                <div className="flex items-center gap-2">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'User Avatar'}
                      className="w-8.5 h-8.5 rounded-full border border-[#6B6B63] object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-8.5 h-8.5 rounded-full bg-[#5A5A40] border border-[#6B6B4E] text-[#F5F5F0] flex items-center justify-center font-medium text-xs">
                      {user.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'}
                    </div>
                  )}
                </div>

                <button
                  id="nav-logout-btn"
                  onClick={onLogout}
                  title="Sign Out"
                  className="h-9 w-9 inline-flex items-center justify-center rounded-lg bg-[#484842] hover:bg-rose-950/40 hover:text-rose-300 text-[#B5B4AC] border border-[#5A5A53] transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>

              {/* Mobile & Tablet Navigation Header Controls (< lg screens) */}
              <div className="flex lg:hidden items-center gap-1.5 sm:gap-2 shrink-0">
                {/* Quick New Reflection Button (Visible on mobile & tablet) */}
                <button
                  id="mobile-quick-new-btn"
                  onClick={onNewEntry}
                  className={`h-9 inline-flex items-center gap-1 px-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    activeView === 'new'
                      ? 'bg-[#5A5A40] text-white shadow-xs'
                      : 'bg-[#484842] text-[#E8E6DF] hover:bg-[#52524B] border border-[#5A5A53]'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New</span>
                </button>

                {/* Tablet Quick Direct Access: Insights (md to lg) */}
                <button
                  id="tablet-insights-btn"
                  onClick={onViewInsights}
                  className={`h-9 hidden md:inline-flex items-center gap-1.5 px-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                    activeView === 'insights'
                      ? 'bg-[#5A5A40] text-white shadow-xs font-semibold'
                      : 'bg-[#484842] text-[#E8E6DF] hover:bg-[#52524B] border border-[#5A5A53]'
                  }`}
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Insights</span>
                </button>

                {/* Tablet Quick Direct Access: History (md to lg) */}
                <button
                  id="tablet-history-btn"
                  onClick={onViewHistory}
                  className={`h-9 hidden md:inline-flex items-center gap-1.5 px-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                    activeView === 'history'
                      ? 'bg-[#5A5A40] text-white shadow-xs font-semibold'
                      : 'bg-[#484842] text-[#E8E6DF] hover:bg-[#52524B] border border-[#5A5A53]'
                  }`}
                >
                  <History className="w-3.5 h-3.5" />
                  <span>History</span>
                </button>

                {/* Tablet Quick Direct Access: Admin Hub (md to lg) */}
                {isAdmin && (
                  <button
                    id="tablet-admin-btn"
                    onClick={onViewAdmin}
                    className={`h-9 hidden md:inline-flex items-center gap-1.5 px-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                      activeView === 'admin'
                        ? 'bg-emerald-800 text-white shadow-xs font-semibold'
                        : 'bg-[#484842] text-[#9AC29F] hover:bg-[#52524B] border border-emerald-900/40'
                    }`}
                  >
                    <Shield className="w-3.5 h-3.5 text-[#9AC29F]" />
                    <span>Admin</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  </button>
                )}

                {/* Tablet Quick User Avatar */}
                <div className="hidden md:flex items-center">
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

                {/* Mobile & Tablet Navigation Menu Toggle Button */}
                <button
                  id="mobile-nav-toggle-btn"
                  onClick={() => setIsMobileMenuOpen((prev) => !prev)}
                  aria-expanded={isMobileMenuOpen}
                  aria-label="Toggle navigation menu"
                  className={`h-9 w-9 inline-flex items-center justify-center rounded-lg transition-colors cursor-pointer relative ${
                    isMobileMenuOpen
                      ? 'bg-[#5A5A40] text-white border border-[#6D6D4E]'
                      : 'bg-[#484842] hover:bg-[#52524B] text-[#F5F5F0] border border-[#5A5A53]'
                  }`}
                >
                  {isMobileMenuOpen ? (
                    <X className="w-5 h-5 text-[#F5F5F0]" />
                  ) : (
                    <Menu className="w-5 h-5 text-[#F5F5F0]" />
                  )}
                  {isAdmin && !isMobileMenuOpen && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-400 border border-[#3A3A35]" />
                  )}
                </button>
              </div>
            </>
          ) : (
            <button
              id="nav-security-info-btn"
              onClick={onOpenSecurityModal}
              className="h-8.5 inline-flex items-center gap-1.5 text-xs text-[#E8E6DF] hover:text-white bg-[#484842] px-2.5 sm:px-3 rounded-lg border border-[#5A5A53] transition-colors cursor-pointer whitespace-nowrap"
            >
              <ShieldCheck className="w-4 h-4 text-[#9AC29F] shrink-0" />
              <span className="hidden sm:inline">Encrypted & User-Isolated</span>
              <span className="sm:hidden">Encrypted</span>
            </button>
          )}
        </div>
      </header>

      {/* Mobile & Tablet Navigation Drawer / Dropdown Panel */}
      <AnimatePresence>
        {user && isMobileMenuOpen && (
          <>
            {/* Backdrop for outside click dismissal */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 top-16 bg-black/50 backdrop-blur-xs z-35 lg:hidden"
            />

            {/* Slide-down Menu Container */}
            <motion.div
              id="mobile-nav-drawer"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="fixed top-16 left-0 right-0 z-40 bg-[#34342F] text-[#F5F5F0] border-b border-[#4D4D47] shadow-2xl max-h-[calc(100vh-4rem)] overflow-y-auto lg:hidden"
            >
              <div className="p-4 space-y-4 max-w-lg mx-auto">
                {/* User Profile Card */}
                <div className="p-3 bg-[#3F3F39] rounded-xl border border-[#4D4D47] flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt={user.displayName || 'User Avatar'}
                        className="w-10 h-10 rounded-full border border-[#6B6B63] object-cover shrink-0"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-[#5A5A40] border border-[#6B6B4E] text-[#F5F5F0] flex items-center justify-center font-semibold text-sm shrink-0">
                        {user.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#F5F5F0] truncate">
                        {user.displayName || 'MindScribe Member'}
                      </p>
                      <p className="text-xs text-[#B5B4AC] truncate">
                        {user.email || 'Authenticated User'}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0">{getRoleBadge(userRole)}</div>
                </div>

                {/* Primary Navigation Options */}
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#A09F96] px-1 mb-1.5">
                    Navigation
                  </p>

                  <button
                    id="mobile-nav-new-btn"
                    onClick={() => handleMobileNavAction(onNewEntry)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl min-h-[48px] text-left transition-colors cursor-pointer ${
                      activeView === 'new'
                        ? 'bg-[#5A5A40] text-white font-semibold'
                        : 'bg-[#3C3C36] text-[#E8E6DF] hover:bg-[#45453E] border border-[#484842]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-black/20 flex items-center justify-center shrink-0">
                        <Plus className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-sm font-medium">New Reflection</div>
                        <div className="text-xs text-[#C4C3BA]">
                          Write & synthesize with Gemini AI
                        </div>
                      </div>
                    </div>
                    {activeView === 'new' && (
                      <span className="text-[10px] font-semibold uppercase bg-white/20 px-2 py-0.5 rounded-full">
                        Active
                      </span>
                    )}
                  </button>

                  <button
                    id="mobile-nav-insights-btn"
                    onClick={() => handleMobileNavAction(onViewInsights)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl min-h-[48px] text-left transition-colors cursor-pointer ${
                      activeView === 'insights'
                        ? 'bg-[#5A5A40] text-white font-semibold'
                        : 'bg-[#3C3C36] text-[#E8E6DF] hover:bg-[#45453E] border border-[#484842]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-black/20 flex items-center justify-center shrink-0">
                        <TrendingUp className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-sm font-medium">Insights & Growth</div>
                        <div className="text-xs text-[#C4C3BA]">
                          Themes, mood trends & action items
                        </div>
                      </div>
                    </div>
                    {activeView === 'insights' ? (
                      <span className="text-[10px] font-semibold uppercase bg-white/20 px-2 py-0.5 rounded-full">
                        Active
                      </span>
                    ) : (
                      <ChevronRight className="w-4 h-4 text-[#8C8B82]" />
                    )}
                  </button>

                  <button
                    id="mobile-nav-history-btn"
                    onClick={() => handleMobileNavAction(onViewHistory)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl min-h-[48px] text-left transition-colors cursor-pointer ${
                      activeView === 'history'
                        ? 'bg-[#5A5A40] text-white font-semibold'
                        : 'bg-[#3C3C36] text-[#E8E6DF] hover:bg-[#45453E] border border-[#484842]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-black/20 flex items-center justify-center shrink-0">
                        <History className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-sm font-medium">Reflection History</div>
                        <div className="text-xs text-[#C4C3BA]">
                          Browse past journals & AI analysis
                        </div>
                      </div>
                    </div>
                    {activeView === 'history' ? (
                      <span className="text-[10px] font-semibold uppercase bg-white/20 px-2 py-0.5 rounded-full">
                        Active
                      </span>
                    ) : (
                      <ChevronRight className="w-4 h-4 text-[#8C8B82]" />
                    )}
                  </button>

                  <button
                    id="mobile-nav-admin-btn"
                    onClick={() => handleMobileNavAction(onViewAdmin)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl min-h-[48px] text-left transition-colors cursor-pointer ${
                      activeView === 'admin'
                        ? 'bg-emerald-800 text-white font-semibold'
                        : 'bg-[#3C3C36] text-[#C2E8D0] hover:bg-[#45453E] border border-emerald-900/40'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-950/50 border border-emerald-500/30 flex items-center justify-center shrink-0">
                        <Shield className="w-4 h-4 text-[#9AC29F]" />
                      </div>
                      <div>
                        <div className="text-sm font-medium flex items-center gap-2">
                          Admin Control Center
                          {isAdmin && (
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          )}
                        </div>
                        <div className="text-xs text-[#9AC29F]">
                          Role permissions & security audit logs
                        </div>
                      </div>
                    </div>
                    {activeView === 'admin' ? (
                      <span className="text-[10px] font-semibold uppercase bg-white/20 px-2 py-0.5 rounded-full">
                        Active
                      </span>
                    ) : (
                      <ChevronRight className="w-4 h-4 text-[#8C8B82]" />
                    )}
                  </button>
                </div>

                {/* Utilities & Integrations */}
                <div className="space-y-1 pt-1 border-t border-[#484842]">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#A09F96] px-1 mb-1.5">
                    Utilities & Security
                  </p>

                  <button
                    id="mobile-nav-webhooks-btn"
                    onClick={() => handleMobileNavAction(onOpenWebhooks)}
                    className="w-full flex items-center justify-between p-3 rounded-xl min-h-[48px] bg-[#3C3C36] hover:bg-[#45453E] text-[#E8E6DF] border border-[#484842] text-left transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-black/20 flex items-center justify-center shrink-0">
                        <Bell className="w-4 h-4 text-[#C4C3BA]" />
                      </div>
                      <div>
                        <div className="text-sm font-medium">Webhooks & Alerts</div>
                        <div className="text-xs text-[#B5B4AC]">
                          Slack, Discord & custom dispatches
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#8C8B82]" />
                  </button>

                  <button
                    id="mobile-nav-security-btn"
                    onClick={() => handleMobileNavAction(onOpenSecurityModal)}
                    className="w-full flex items-center justify-between p-3 rounded-xl min-h-[48px] bg-[#3C3C36] hover:bg-[#45453E] text-[#E8E6DF] border border-[#484842] text-left transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-950/40 border border-emerald-500/20 flex items-center justify-center shrink-0">
                        <ShieldCheck className="w-4 h-4 text-[#9AC29F]" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-[#D5E8D8]">
                          Security & Cloud Isolation
                        </div>
                        <div className="text-xs text-[#A3BFA8]">
                          Firestore client rules & private storage
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#8C8B82]" />
                  </button>
                </div>

                {/* Sign Out Action */}
                <div className="pt-2 border-t border-[#484842]">
                  <button
                    id="mobile-nav-logout-btn"
                    onClick={() => handleMobileNavAction(onLogout)}
                    className="w-full flex items-center justify-center gap-2 p-3 rounded-xl min-h-[48px] bg-[#433235] hover:bg-[#523A3E] text-rose-200 border border-rose-900/50 font-medium text-sm transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out of MindScribe</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};



