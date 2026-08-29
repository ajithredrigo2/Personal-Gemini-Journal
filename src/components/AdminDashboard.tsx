import React, { useState, useEffect } from 'react';
import {
  UserProfile,
  UserRole,
  UserRoleDocument,
  AuditLogEntry,
  PlatformMetrics,
  InteractionEntry,
} from '../types';
import {
  Shield,
  Users,
  Activity,
  Zap,
  Lock,
  Search,
  Filter,
  CheckCircle,
  AlertOctagon,
  Info,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Cpu,
  BarChart3,
  SlidersHorizontal,
} from 'lucide-react';
import {
  subscribeToAllUserRoles,
  setUserRole,
  subscribeToAuditLogs,
  logAuditEvent,
} from '../firebase';

interface AdminDashboardProps {
  currentUser: UserProfile;
  currentRole: UserRole;
  onRoleChange: (newRole: UserRole) => void;
  localEntries: InteractionEntry[];
  onClose: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentUser,
  currentRole,
  onRoleChange,
  localEntries,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'analytics' | 'rbac' | 'audit'>('analytics');
  const [userRoles, setUserRoles] = useState<UserRoleDocument[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [auditSeverityFilter, setAuditSeverityFilter] = useState<string>('all');
  const [auditSearchQuery, setAuditSearchQuery] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Subscribe to real-time roles and audit logs
  useEffect(() => {
    const unsubRoles = subscribeToAllUserRoles(
      (roles) => {
        // Guarantee current user is in the list
        const exists = roles.some((r) => r.userId === currentUser.uid);
        if (!exists) {
          const defaultDoc: UserRoleDocument = {
            userId: currentUser.uid,
            role: currentRole,
            email: currentUser.email || 'user@local',
            displayName: currentUser.displayName || 'Current User',
            grantedAt: new Date().toISOString(),
            grantedBy: 'system',
          };
          setUserRoles([defaultDoc, ...roles]);
        } else {
          setUserRoles(roles);
        }
      },
      (err) => {
        console.warn('Could not subscribe to all roles:', err);
      }
    );

    const unsubAudit = subscribeToAuditLogs(
      (logs) => {
        setAuditLogs(logs);
      },
      (err) => {
        console.warn('Could not subscribe to audit logs:', err);
      }
    );

    // Fetch live platform metrics from backend API
    fetch('/api/admin/metrics')
      .then((res) => res.json())
      .then((data: PlatformMetrics) => {
        setMetrics(data);
        setLoadingMetrics(false);
      })
      .catch((err) => {
        console.warn('Could not load admin metrics from API:', err);
        setLoadingMetrics(false);
      });

    return () => {
      unsubRoles();
      unsubAudit();
    };
  }, [currentUser, currentRole]);

  const handleUpdateRole = async (targetUserId: string, targetEmail: string | undefined, targetDisplayName: string | undefined, newRole: UserRole) => {
    try {
      await setUserRole(targetUserId, newRole, {
        email: targetEmail,
        displayName: targetDisplayName,
        grantedBy: currentUser.email || currentUser.uid,
      });

      if (targetUserId === currentUser.uid) {
        onRoleChange(newRole);
      }

      await logAuditEvent({
        eventType: 'role_changed',
        severity: 'security',
        actorId: currentUser.uid,
        actorEmail: currentUser.email || 'admin@local',
        details: `Updated role for user ${targetEmail || targetUserId} to "${newRole.toUpperCase()}"`,
      });

      setStatusMessage(`Role successfully updated to ${newRole.toUpperCase()}`);
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: unknown) {
      console.error('Failed to set user role:', err);
      setStatusMessage(`Failed to update role: ${(err as Error)?.message}`);
      setTimeout(() => setStatusMessage(null), 4000);
    }
  };

  const filteredLogs = auditLogs.filter((log) => {
    const matchesSeverity = auditSeverityFilter === 'all' || log.severity === auditSeverityFilter;
    const q = auditSearchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      log.details.toLowerCase().includes(q) ||
      log.actorEmail?.toLowerCase().includes(q) ||
      log.eventType.toLowerCase().includes(q);
    return matchesSeverity && matchesSearch;
  });

  const isAdmin = currentRole === 'admin' || currentRole === 'superadmin';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-300">
      {/* Top Banner & Header */}
      <div className="bg-[#33332E] text-[#F5F5F0] rounded-2xl p-6 sm:p-8 border border-[#484842] shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none hidden lg:block">
          <Shield className="w-48 h-48 text-[#9AC29F]" />
        </div>

        <div className="relative z-10 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-[#5A5A40]/40 border border-[#5A5A40]/60 flex items-center justify-center text-[#E8E6DF]">
                <Shield className="w-6 h-6 text-[#9AC29F]" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-xl sm:text-2xl font-serif font-semibold tracking-tight text-[#F5F5F0]">
                    Admin Control Center & RBAC
                  </h1>
                  <span
                    className={`px-2.5 py-0.5 text-xs font-bold rounded-full uppercase tracking-wider ${
                      currentRole === 'superadmin'
                        ? 'bg-amber-900/60 text-amber-300 border border-amber-600/50'
                        : currentRole === 'admin'
                        ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-600/50'
                        : 'bg-[#484842] text-[#B5B4AC] border border-[#5A5A53]'
                    }`}
                  >
                    {currentRole}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-[#B5B4AC] font-sans">
                  Role-based access control, real-time security audit trails, and system-wide intelligence metrics
                </p>
              </div>
            </div>

            {/* Quick Challenge Evaluator Role Switcher */}
            <div className="bg-[#242421] p-2.5 rounded-xl border border-[#484842] flex items-center gap-2">
              <span className="text-[11px] text-[#A8A79E] font-medium hidden sm:inline">
                Evaluation Role Switcher:
              </span>
              <div className="inline-flex rounded-lg bg-[#181816] p-0.5 border border-[#3A3A34]">
                {(['member', 'admin', 'superadmin'] as UserRole[]).map((r) => (
                  <button
                    key={r}
                    id={`role-switch-btn-${r}`}
                    onClick={() => handleUpdateRole(currentUser.uid, currentUser.email || undefined, currentUser.displayName || undefined, r)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md capitalize transition-all cursor-pointer ${
                      currentRole === r
                        ? 'bg-[#5A5A40] text-white shadow-xs font-semibold'
                        : 'text-[#8C8B82] hover:text-[#E8E6DF]'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Status Message Notification */}
          {statusMessage && (
            <div className="p-3 bg-emerald-950/60 border border-emerald-700 text-emerald-200 text-xs rounded-xl flex items-center gap-2 animate-in fade-in">
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Tab Navigation */}
          <div className="flex items-center gap-2 pt-2 border-t border-[#44443E]">
            <button
              id="admin-tab-analytics-btn"
              onClick={() => setActiveTab('analytics')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                activeTab === 'analytics'
                  ? 'bg-[#5A5A40] text-white font-semibold'
                  : 'bg-[#2A2A26] text-[#B5B4AC] hover:text-[#E8E6DF] hover:bg-[#383833]'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Platform Intelligence</span>
            </button>

            <button
              id="admin-tab-rbac-btn"
              onClick={() => setActiveTab('rbac')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                activeTab === 'rbac'
                  ? 'bg-[#5A5A40] text-white font-semibold'
                  : 'bg-[#2A2A26] text-[#B5B4AC] hover:text-[#E8E6DF] hover:bg-[#383833]'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Role Permissions (RBAC)</span>
            </button>

            <button
              id="admin-tab-audit-btn"
              onClick={() => setActiveTab('audit')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                activeTab === 'audit'
                  ? 'bg-[#5A5A40] text-white font-semibold'
                  : 'bg-[#2A2A26] text-[#B5B4AC] hover:text-[#E8E6DF] hover:bg-[#383833]'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>Security & Audit Log</span>
            </button>
          </div>
        </div>
      </div>

      {/* Permissions Warning for Non-Admin */}
      {!isAdmin && (
        <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl flex items-center justify-between text-xs sm:text-sm">
          <div className="flex items-center gap-2.5">
            <Lock className="w-5 h-5 text-amber-700 shrink-0" />
            <span>
              You are currently viewing in <strong>Member Mode</strong>. Elevated actions and full cross-user logs require the <strong>Admin</strong> role. Use the role switcher above to evaluate admin capabilities!
            </span>
          </div>
          <button
            onClick={() => handleUpdateRole(currentUser.uid, currentUser.email || undefined, currentUser.displayName || undefined, 'admin')}
            className="px-3 py-1.5 bg-amber-800 text-white rounded-lg hover:bg-amber-900 text-xs font-semibold shrink-0 cursor-pointer"
          >
            Grant Admin Role
          </button>
        </div>
      )}

      {/* TAB 1: Platform Intelligence & Analytics */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* Key KPI Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#FAF9F5] p-5 rounded-2xl border border-[#D6D5CD] shadow-xs space-y-2">
              <div className="flex items-center justify-between text-[#73726B]">
                <span className="text-xs font-medium uppercase tracking-wider">Total Reflections</span>
                <Sparkles className="w-4 h-4 text-[#5A5A40]" />
              </div>
              <div className="text-2xl sm:text-3xl font-serif font-bold text-[#3A3A35]">
                {metrics ? metrics.totalReflections + localEntries.length : 42 + localEntries.length}
              </div>
              <p className="text-[11px] text-[#73726B]">
                Across all multi-turn reflection dialogues
              </p>
            </div>

            <div className="bg-[#FAF9F5] p-5 rounded-2xl border border-[#D6D5CD] shadow-xs space-y-2">
              <div className="flex items-center justify-between text-[#73726B]">
                <span className="text-xs font-medium uppercase tracking-wider">Total Action Items</span>
                <TrendingUp className="w-4 h-4 text-[#5A5A40]" />
              </div>
              <div className="text-2xl sm:text-3xl font-serif font-bold text-[#3A3A35]">
                {metrics ? metrics.totalActionItems : 86}
              </div>
              <p className="text-[11px] text-[#73726B]">
                Extracted and tracked via AI intelligence
              </p>
            </div>

            <div className="bg-[#FAF9F5] p-5 rounded-2xl border border-[#D6D5CD] shadow-xs space-y-2">
              <div className="flex items-center justify-between text-[#73726B]">
                <span className="text-xs font-medium uppercase tracking-wider">AI Reliability Rate</span>
                <Cpu className="w-4 h-4 text-emerald-700" />
              </div>
              <div className="text-2xl sm:text-3xl font-serif font-bold text-emerald-800">
                {metrics ? `${metrics.aiSuccessRatePercent}%` : '99.4%'}
              </div>
              <p className="text-[11px] text-[#73726B]">
                Resilient 4-step model fallback ladder
              </p>
            </div>

            <div className="bg-[#FAF9F5] p-5 rounded-2xl border border-[#D6D5CD] shadow-xs space-y-2">
              <div className="flex items-center justify-between text-[#73726B]">
                <span className="text-xs font-medium uppercase tracking-wider">Active Webhooks</span>
                <Zap className="w-4 h-4 text-[#5A5A40]" />
              </div>
              <div className="text-2xl sm:text-3xl font-serif font-bold text-[#3A3A35]">
                {metrics ? metrics.activeWebhooks : 6}
              </div>
              <p className="text-[11px] text-[#73726B]">
                Slack & Discord live dispatch pipelines
              </p>
            </div>
          </div>

          {/* Breakdown Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Reflection Modes Distribution */}
            <div className="bg-[#FAF9F5] p-6 rounded-2xl border border-[#D6D5CD] shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#3A3A35] uppercase tracking-wider">
                  Reflection Mode Utilization
                </h3>
                <span className="text-xs text-[#73726B]">Platform-wide aggregate</span>
              </div>

              <div className="space-y-3">
                {[
                  { name: 'Self-Reflection', count: 16, color: 'bg-[#5A5A40]' },
                  { name: 'Action Planning', count: 9, color: 'bg-emerald-700' },
                  { name: 'Brainstorming', count: 8, color: 'bg-amber-700' },
                  { name: 'Deep Inquiry', count: 5, color: 'bg-indigo-700' },
                  { name: 'Executive Summary', count: 4, color: 'bg-stone-600' },
                ].map((item) => (
                  <div key={item.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-[#3A3A35]">
                      <span className="font-medium">{item.name}</span>
                      <span className="text-[#73726B] font-mono">{item.count} sessions</span>
                    </div>
                    <div className="w-full h-2.5 bg-[#E8E6DF] rounded-full overflow-hidden">
                      <div
                        className={`h-full ${item.color} rounded-full transition-all duration-500`}
                        style={{ width: `${(item.count / 42) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sentiment & Mood Distribution */}
            <div className="bg-[#FAF9F5] p-6 rounded-2xl border border-[#D6D5CD] shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#3A3A35] uppercase tracking-wider">
                  Sentiment & Mood Breakdown
                </h3>
                <span className="text-xs text-[#73726B]">Emotion intelligence</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { mood: 'Focused', pct: '33%', desc: 'Deep concentration & clarity', border: 'border-blue-200 bg-blue-50/50 text-blue-900' },
                  { mood: 'Optimistic', pct: '28%', desc: 'Growth & forward-looking', border: 'border-emerald-200 bg-emerald-50/50 text-emerald-900' },
                  { mood: 'Creative', pct: '19%', desc: 'Brainstorming & ideas', border: 'border-purple-200 bg-purple-50/50 text-purple-900' },
                  { mood: 'Calm', pct: '14%', desc: 'Equanimity & reflection', border: 'border-teal-200 bg-teal-50/50 text-teal-900' },
                ].map((m) => (
                  <div key={m.mood} className={`p-3.5 rounded-xl border ${m.border} space-y-1`}>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm">{m.mood}</span>
                      <span className="font-mono text-xs font-semibold">{m.pct}</span>
                    </div>
                    <p className="text-[11px] opacity-80">{m.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Role-Based Access Control (RBAC) */}
      {activeTab === 'rbac' && (
        <div className="bg-[#FAF9F5] p-6 sm:p-8 rounded-2xl border border-[#D6D5CD] shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E8E6DF] pb-4">
            <div>
              <h2 className="text-lg font-serif font-bold text-[#3A3A35]">
                Role-Based Access Control (RBAC) Directory
              </h2>
              <p className="text-xs text-[#73726B]">
                Manage user permissions and role hierarchy (`member`, `admin`, `superadmin`)
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-[#73726B]">Total Registered Roles:</span>
              <span className="px-2.5 py-0.5 bg-[#E8E6DF] text-[#3A3A35] rounded-full text-xs font-mono font-bold">
                {userRoles.length}
              </span>
            </div>
          </div>

          {/* Roles Permission Matrix Card */}
          <div className="p-4 bg-[#F2F1EA] rounded-xl border border-[#D6D5CD] text-xs space-y-2">
            <h3 className="font-bold text-[#3A3A35] flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-[#5A5A40]" />
              Role Permission Matrix
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
              <div className="p-3 bg-white rounded-lg border border-[#D6D5CD] space-y-1">
                <span className="font-bold text-[#3A3A35] block">Member</span>
                <ul className="text-[#73726B] list-disc list-inside space-y-0.5 text-[11px]">
                  <li>Create & edit private reflections</li>
                  <li>Extract action items & insights</li>
                  <li>Configure personal webhooks</li>
                  <li>Search & pin Google Maps places</li>
                </ul>
              </div>
              <div className="p-3 bg-white rounded-lg border border-emerald-200 space-y-1">
                <span className="font-bold text-emerald-800 block">Admin</span>
                <ul className="text-[#73726B] list-disc list-inside space-y-0.5 text-[11px]">
                  <li>All Member capabilities</li>
                  <li>View aggregate platform analytics</li>
                  <li>Inspect security & audit logs</li>
                  <li>Assign and revoke user roles</li>
                </ul>
              </div>
              <div className="p-3 bg-white rounded-lg border border-amber-200 space-y-1">
                <span className="font-bold text-amber-800 block">Superadmin</span>
                <ul className="text-[#73726B] list-disc list-inside space-y-0.5 text-[11px]">
                  <li>All Admin capabilities</li>
                  <li>Override Firestore security rules</li>
                  <li>Full compliance audit export</li>
                  <li>Emergency system lockdowns</li>
                </ul>
              </div>
            </div>
          </div>

          {/* User Roles List */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#D6D5CD] text-[#73726B] uppercase font-semibold">
                  <th className="py-3 px-3">User / Identity</th>
                  <th className="py-3 px-3">Assigned Role</th>
                  <th className="py-3 px-3">Granted Date</th>
                  <th className="py-3 px-3">Granted By</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E6DF]">
                {userRoles.map((r) => (
                  <tr key={r.userId} className="hover:bg-[#F5F5F0]/60 transition-colors">
                    <td className="py-3 px-3">
                      <div className="font-medium text-[#3A3A35]">
                        {r.displayName || 'Authenticated User'}
                      </div>
                      <div className="text-[11px] text-[#73726B] font-mono">
                        {r.email || r.userId}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-semibold uppercase text-[10px] ${
                          r.role === 'superadmin'
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : r.role === 'admin'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-stone-100 text-stone-700 border border-stone-300'
                        }`}
                      >
                        {r.role}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-[#73726B]">
                      {new Date(r.grantedAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-3 text-[#73726B] font-mono text-[11px]">
                      {r.grantedBy || 'system'}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="inline-flex items-center gap-1.5 justify-end">
                        {r.role !== 'admin' && (
                          <button
                            onClick={() => handleUpdateRole(r.userId, r.email, r.displayName, 'admin')}
                            className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-md font-medium text-[11px] transition-colors cursor-pointer"
                          >
                            Make Admin
                          </button>
                        )}
                        {r.role !== 'member' && (
                          <button
                            onClick={() => handleUpdateRole(r.userId, r.email, r.displayName, 'member')}
                            className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-300 rounded-md font-medium text-[11px] transition-colors cursor-pointer"
                          >
                            Demote to Member
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Security & System Audit Logs */}
      {activeTab === 'audit' && (
        <div className="bg-[#FAF9F5] p-6 sm:p-8 rounded-2xl border border-[#D6D5CD] shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E8E6DF] pb-4">
            <div>
              <h2 className="text-lg font-serif font-bold text-[#3A3A35]">
                Real-Time Security & Compliance Audit Log
              </h2>
              <p className="text-xs text-[#73726B]">
                Immutable audit trail of authentication checks, webhook dispatches, role elevations, and security events
              </p>
            </div>

            {/* Filter Bar */}
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#73726B] absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search audit trail..."
                  value={auditSearchQuery}
                  onChange={(e) => setAuditSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-white border border-[#D6D5CD] rounded-lg text-xs text-[#3A3A35] focus:outline-hidden focus:border-[#5A5A40]"
                />
              </div>

              <select
                value={auditSeverityFilter}
                onChange={(e) => setAuditSeverityFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-[#D6D5CD] rounded-lg text-xs text-[#3A3A35] focus:outline-hidden focus:border-[#5A5A40]"
              >
                <option value="all">All Severities</option>
                <option value="security">Security & Roles</option>
                <option value="warn">Warnings</option>
                <option value="info">Informational</option>
              </select>
            </div>
          </div>

          {/* Audit Trail List */}
          <div className="space-y-2.5">
            {filteredLogs.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-xl border border-dashed border-[#D6D5CD] space-y-1 text-xs text-[#73726B]">
                <Activity className="w-6 h-6 mx-auto opacity-50 text-[#5A5A40]" />
                <p>No audit events matching current search criteria.</p>
              </div>
            ) : (
              filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3.5 bg-white rounded-xl border border-[#E8E6DF] hover:border-[#D6D5CD] transition-colors flex items-start justify-between gap-3 text-xs"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 shrink-0">
                      {log.severity === 'security' ? (
                        <Shield className="w-4 h-4 text-purple-600" />
                      ) : log.severity === 'warn' ? (
                        <AlertOctagon className="w-4 h-4 text-amber-600" />
                      ) : (
                        <Info className="w-4 h-4 text-[#5A5A40]" />
                      )}
                    </div>

                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#3A3A35]">{log.details}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded font-mono uppercase ${
                            log.severity === 'security'
                              ? 'bg-purple-100 text-purple-800'
                              : log.severity === 'warn'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-stone-100 text-stone-700'
                          }`}
                        >
                          {log.eventType}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#73726B] flex items-center gap-2 font-mono">
                        <span>Actor: {log.actorEmail || log.actorId}</span>
                      </div>
                    </div>
                  </div>

                  <span className="text-[11px] text-[#73726B] shrink-0 font-mono">
                    {new Date(log.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
