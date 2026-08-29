import React, { useState } from 'react';
import {
  Sparkles,
  TrendingUp,
  Target,
  CheckCircle2,
  Circle,
  AlertTriangle,
  Lightbulb,
  Compass,
  Calendar,
  RefreshCw,
  Plus,
  Trash2,
  ArrowRight,
  BookOpen,
  HelpCircle,
  Check,
  Tag,
  Copy,
} from 'lucide-react';
import {
  InteractionEntry,
  InsightEntry,
  ActionItemEntry,
  ThemeInsight,
  GenerateInsightsResponse,
} from '../types';
import {
  saveInsight,
  deleteInsight,
  saveActionItem,
  toggleActionItemStatus,
  deleteActionItem,
  getCurrentUserToken,
} from '../firebase';

interface InsightsViewProps {
  userId: string;
  entries: InteractionEntry[];
  insights: InsightEntry[];
  actionItems: ActionItemEntry[];
  onNavigateToNew: () => void;
  onNavigateToEntry: (entry: InteractionEntry) => void;
}

export const InsightsView: React.FC<InsightsViewProps> = ({
  userId,
  entries,
  insights,
  actionItems,
  onNavigateToNew,
  onNavigateToEntry,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newActionTitle, setNewActionTitle] = useState('');
  const [actionFilter, setActionFilter] = useState<'all' | 'open' | 'completed'>('all');
  const [copiedInsightId, setCopiedInsightId] = useState<string | null>(null);

  const latestInsight = insights.length > 0 ? insights[0] : null;

  // Calculate dashboard summary metrics
  const totalEntries = entries.length;
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const entriesLast7Days = entries.filter((e) => new Date(e.createdAt) >= sevenDaysAgo).length;

  const openActions = actionItems.filter((a) => a.status === 'open');
  const completedActions = actionItems.filter((a) => a.status === 'completed');
  const actionCompletionRate =
    actionItems.length > 0 ? Math.round((completedActions.length / actionItems.length) * 100) : 0;

  // Aggregate topics/tags from real entries
  const tagCounts: Record<string, number> = {};
  entries.forEach((e) => {
    (e.tags || []).forEach((t) => {
      tagCounts[t] = (tagCounts[t] || 0) + 1;
    });
  });
  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const topThemeName =
    latestInsight && latestInsight.themes && latestInsight.themes.length > 0
      ? typeof latestInsight.themes[0] === 'string'
        ? latestInsight.themes[0]
        : latestInsight.themes[0].name
      : topTags.length > 0
      ? topTags[0][0]
      : 'Self Discovery';

  const totalGoalsCount = latestInsight?.goals?.length || 0;

  // Trigger Gemini Reflection Intelligence
  const handleGenerateInsights = async () => {
    if (entries.length < 2) {
      setError('At least 2 journal entries are required to generate cross-entry reflection intelligence.');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const token = await getCurrentUserToken();
      if (!token) {
        throw new Error('You must be signed in to generate reflection intelligence.');
      }

      // Prepare payload with summaries only (respecting data privacy)
      const summariesPayload = entries.map((e) => ({
        id: e.id,
        title: e.title,
        summary: e.summary || (e.messages?.[0]?.content?.slice(0, 200) ?? ''),
        keyInsights: e.keyInsights || [],
        tags: e.tags || [],
        mood: e.mood || 'neutral',
        mode: e.mode,
        createdAt: e.createdAt,
      }));

      const res = await fetch('/api/gemini/insights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ summaries: summariesPayload }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error ${res.status}`);
      }

      const data: GenerateInsightsResponse = await res.json();

      const newInsightId = `insight_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const insightEntry: InsightEntry = {
        id: newInsightId,
        userId,
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
        themes: data.themes || [],
        goals: data.goals || [],
        actionItems: data.actionItems || [],
        recurringChallenges: data.recurringChallenges || [],
        positivePatterns: data.positivePatterns || [],
        suggestedFocus: data.suggestedFocus || '',
        weeklyReflection: data.weeklyReflection || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await saveInsight(userId, insightEntry);

      // Also automatically save newly extracted action items to the user's action items collection
      if (Array.isArray(data.actionItems)) {
        for (const item of data.actionItems) {
          const itemTitle = typeof item === 'string' ? item : item.title;
          if (itemTitle && itemTitle.trim()) {
            const actionId = `action_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            const actionEntry: ActionItemEntry = {
              id: actionId,
              userId,
              title: itemTitle.trim(),
              status: 'open',
              createdAt: new Date().toISOString(),
              sourceJournalTitle: typeof item !== 'string' ? item.suggestedFrom : 'Reflection Intelligence',
            };
            await saveActionItem(userId, actionEntry);
          }
        }
      }
    } catch (err: unknown) {
      console.error('Failed to generate insights:', err);
      setError((err as Error)?.message || 'Failed to generate reflection intelligence.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Add custom action item
  const handleAddCustomAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newActionTitle.trim()) return;

    try {
      const actionId = `action_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const newAction: ActionItemEntry = {
        id: actionId,
        userId,
        title: newActionTitle.trim(),
        status: 'open',
        createdAt: new Date().toISOString(),
      };
      await saveActionItem(userId, newAction);
      setNewActionTitle('');
    } catch (err) {
      console.error('Failed to add action item:', err);
      setError('Could not save action item.');
    }
  };

  // Copy insight markdown
  const handleCopyInsight = (insight: InsightEntry) => {
    const formatted = `
# Reflection Intelligence Report
*Period:* ${new Date(insight.periodStart).toLocaleDateString()} - ${new Date(
      insight.periodEnd
    ).toLocaleDateString()}

## Weekly Reflection
${insight.weeklyReflection || 'N/A'}

## Suggested Next Focus
${insight.suggestedFocus || 'N/A'}

## Personal Goals
${insight.goals?.map((g) => `- ${g}`).join('\n') || 'None recorded'}

## Positive Patterns & Growth
${insight.positivePatterns?.map((p) => `- ${p}`).join('\n') || 'None recorded'}

## Recurring Challenges
${insight.recurringChallenges?.map((c) => `- ${c}`).join('\n') || 'None recorded'}
    `.trim();

    navigator.clipboard.writeText(formatted);
    setCopiedInsightId(insight.id);
    setTimeout(() => setCopiedInsightId(null), 2000);
  };

  const filteredActionItems = actionItems.filter((item) => {
    if (actionFilter === 'open') return item.status === 'open';
    if (actionFilter === 'completed') return item.status === 'completed';
    return true;
  });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      {/* Header Banner */}
      <div className="bg-[#EFEEE7] border border-[#D6D5CD] rounded-3xl p-6 sm:p-8 mb-8 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="p-1.5 bg-[#5A5A40]/15 text-[#5A5A40] rounded-xl border border-[#5A5A40]/30">
                <Sparkles className="w-4 h-4" />
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-[#5A5A40]">
                Cognitive Meta-Analysis
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-serif font-bold text-[#3A3A35] leading-tight">
              Reflection Intelligence
            </h1>
            <p className="text-sm text-[#73726B] mt-1.5 max-w-2xl leading-relaxed">
              Synthesizes patterns, recurring goals, hurdles, and actionable next steps across your personal journal history.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <button
              id="generate-insights-btn"
              onClick={handleGenerateInsights}
              disabled={isGenerating || entries.length < 2}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#5A5A40] hover:bg-[#4E4E37] text-white font-medium rounded-xl text-sm shadow-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Synthesizing Intelligence...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  <span>{insights.length > 0 ? 'Refresh Intelligence' : 'Generate Insights'}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Insufficient Entries Warning */}
        {entries.length < 2 && (
          <div className="mt-6 p-4 bg-[#F5F5F0] border border-[#D6D5CD] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <HelpCircle className="w-5 h-5 text-[#5A5A40] shrink-0" />
              <div>
                <p className="text-sm font-semibold text-[#3A3A35]">
                  Need More Journal Entries for Meta-Analysis
                </p>
                <p className="text-xs text-[#73726B] mt-0.5">
                  You currently have {entries.length} entry. Create at least 2 journal entries to unlock cross-journal themes, goal detection, and pattern insights.
                </p>
              </div>
            </div>
            <button
              id="insufficient-new-reflection-btn"
              onClick={onNavigateToNew}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#3A3A35] hover:bg-black text-white text-xs font-semibold rounded-xl shadow-xs transition-colors shrink-0 cursor-pointer"
            >
              <span>Write Reflection</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="mt-4 p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">Intelligence Synthesis Notice</p>
              <p className="mt-0.5">{error}</p>
            </div>
          </div>
        )}
      </div>

      {/* 4 Core Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Card 1: Journal Entries */}
        <div className="bg-white border border-[#D6D5CD] rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#73726B] mb-3">
            <span className="text-xs font-medium uppercase tracking-wider">Journal Entries</span>
            <BookOpen className="w-4 h-4 text-[#5A5A40]" />
          </div>
          <div>
            <div className="text-3xl font-serif font-bold text-[#3A3A35]">{totalEntries}</div>
            <p className="text-xs text-[#73726B] mt-1 flex items-center gap-1">
              <span className="text-[#4B6350] font-semibold">+{entriesLast7Days}</span>
              <span>entries in past 7 days</span>
            </p>
          </div>
        </div>

        {/* Card 2: Active Goals */}
        <div className="bg-white border border-[#D6D5CD] rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#73726B] mb-3">
            <span className="text-xs font-medium uppercase tracking-wider">Active Goals</span>
            <Target className="w-4 h-4 text-[#5A5A40]" />
          </div>
          <div>
            <div className="text-3xl font-serif font-bold text-[#3A3A35]">{totalGoalsCount}</div>
            <p className="text-xs text-[#73726B] mt-1">
              {latestInsight ? 'Detected across reflections' : 'Run synthesis to detect'}
            </p>
          </div>
        </div>

        {/* Card 3: Open Actions */}
        <div className="bg-white border border-[#D6D5CD] rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#73726B] mb-3">
            <span className="text-xs font-medium uppercase tracking-wider">Open Actions</span>
            <CheckCircle2 className="w-4 h-4 text-[#5A5A40]" />
          </div>
          <div>
            <div className="text-3xl font-serif font-bold text-[#3A3A35]">
              {openActions.length}
              <span className="text-sm font-normal text-[#73726B] ml-1.5">
                / {actionItems.length} total
              </span>
            </div>
            <div className="w-full bg-[#EFEEE7] h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className="bg-[#4B6350] h-full rounded-full transition-all duration-500"
                style={{ width: `${actionCompletionRate}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card 4: Top Emerging Theme */}
        <div className="bg-white border border-[#D6D5CD] rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#73726B] mb-3">
            <span className="text-xs font-medium uppercase tracking-wider">Top Theme</span>
            <TrendingUp className="w-4 h-4 text-[#5A5A40]" />
          </div>
          <div>
            <div className="text-xl font-serif font-bold text-[#3A3A35] truncate" title={topThemeName}>
              {topThemeName}
            </div>
            <p className="text-xs text-[#73726B] mt-1 flex items-center gap-1">
              <Tag className="w-3 h-3" />
              <span>Recurring focal pattern</span>
            </p>
          </div>
        </div>
      </div>

      {/* Main Intelligence Grid */}
      {latestInsight ? (
        <div className="space-y-8">
          {/* Section 1: Weekly Reflection & Suggested Focus */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Weekly Reflection */}
            <div className="lg:col-span-2 bg-[#EFEEE7] border border-[#D6D5CD] rounded-3xl p-6 sm:p-7 shadow-xs">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#D6D5CD]">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#5A5A40]" />
                  <h3 className="text-sm font-semibold text-[#3A3A35] uppercase tracking-wider">
                    Weekly Activity Synthesis
                  </h3>
                </div>
                <span className="text-xs text-[#73726B]">
                  {new Date(latestInsight.periodStart).toLocaleDateString()} –{' '}
                  {new Date(latestInsight.periodEnd).toLocaleDateString()}
                </span>
              </div>
              <p className="text-base text-[#3A3A35] leading-relaxed font-serif italic whitespace-pre-line">
                "{latestInsight.weeklyReflection || 'Consistent journaling creates clarity and builds cognitive momentum.'}"
              </p>
            </div>

            {/* Suggested Next Focus */}
            <div className="bg-white border border-[#D6D5CD] rounded-3xl p-6 sm:p-7 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Compass className="w-4 h-4 text-[#5A5A40]" />
                  <h3 className="text-sm font-semibold text-[#3A3A35] uppercase tracking-wider">
                    Recommended Next Focus
                  </h3>
                </div>
                <p className="text-sm text-[#3A3A35] leading-relaxed">
                  {latestInsight.suggestedFocus}
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-[#D6D5CD]/60 flex items-center justify-between">
                <button
                  onClick={onNavigateToNew}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5A5A40] hover:text-[#3A3A35] transition-colors cursor-pointer"
                >
                  <span>Explore this in a new reflection</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Section 2: Recurring Themes & Personal Goals */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recurring Themes */}
            <div className="bg-white border border-[#D6D5CD] rounded-3xl p-6 sm:p-7 shadow-xs">
              <div className="flex items-center gap-2 mb-5">
                <Lightbulb className="w-4 h-4 text-[#5A5A40]" />
                <h3 className="text-sm font-semibold text-[#3A3A35] uppercase tracking-wider">
                  Recurring Themes & Patterns
                </h3>
              </div>

              {latestInsight.themes && latestInsight.themes.length > 0 ? (
                <div className="space-y-3.5">
                  {latestInsight.themes.map((t, idx) => {
                    const themeObj: ThemeInsight =
                      typeof t === 'string'
                        ? { name: t, count: 1, description: 'Recurring topic in journal thoughts.' }
                        : t;
                    return (
                      <div
                        key={idx}
                        className="p-4 rounded-2xl bg-[#F5F5F0] border border-[#D6D5CD] transition-all hover:border-[#5A5A40]/40"
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-sm font-bold text-[#3A3A35]">{themeObj.name}</span>
                          {themeObj.count > 1 && (
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#EFEEE7] text-[#5A5A40] border border-[#D6D5CD]">
                              {themeObj.count} mentions
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#73726B] leading-relaxed">
                          {themeObj.description}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-[#73726B]">No specific themes detected yet.</p>
              )}
            </div>

            {/* Personal Goals Identified */}
            <div className="bg-white border border-[#D6D5CD] rounded-3xl p-6 sm:p-7 shadow-xs">
              <div className="flex items-center gap-2 mb-5">
                <Target className="w-4 h-4 text-[#5A5A40]" />
                <h3 className="text-sm font-semibold text-[#3A3A35] uppercase tracking-wider">
                  Identified Goals & Aspirations
                </h3>
              </div>

              {latestInsight.goals && latestInsight.goals.length > 0 ? (
                <ul className="space-y-3">
                  {latestInsight.goals.map((g, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-3 p-3.5 rounded-2xl bg-[#F5F5F0] border border-[#D6D5CD]"
                    >
                      <span className="w-5 h-5 rounded-full bg-[#5A5A40]/15 text-[#5A5A40] flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">
                        {idx + 1}
                      </span>
                      <span className="text-sm text-[#3A3A35] leading-relaxed">{g}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-[#73726B]">No clear goals formulated in recent entries.</p>
              )}
            </div>
          </div>

          {/* Section 3: Positive Growth vs Recurring Challenges */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Positive Patterns & Wins */}
            <div className="bg-[#4B6350]/5 border border-[#4B6350]/20 rounded-3xl p-6 sm:p-7 shadow-xs">
              <div className="flex items-center gap-2 mb-4 text-[#4B6350]">
                <TrendingUp className="w-4 h-4" />
                <h3 className="text-sm font-semibold uppercase tracking-wider">
                  Positive Progress & Resilience
                </h3>
              </div>
              <ul className="space-y-2.5">
                {(latestInsight.positivePatterns || []).map((p, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 text-xs text-[#3A3A35] leading-relaxed">
                    <Check className="w-3.5 h-3.5 text-[#4B6350] shrink-0 mt-0.5" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Recurring Challenges */}
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-3xl p-6 sm:p-7 shadow-xs">
              <div className="flex items-center gap-2 mb-4 text-amber-800">
                <AlertTriangle className="w-4 h-4" />
                <h3 className="text-sm font-semibold uppercase tracking-wider">
                  Recurring Hurdles & Challenges
                </h3>
              </div>
              <ul className="space-y-2.5">
                {(latestInsight.recurringChallenges || []).map((c, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 text-xs text-[#3A3A35] leading-relaxed">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-600 shrink-0 mt-1.5" />
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Section 4: Action Items Tracker */}
          <div className="bg-white border border-[#D6D5CD] rounded-3xl p-6 sm:p-7 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#D6D5CD]">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#5A5A40]" />
                <h3 className="text-sm font-semibold text-[#3A3A35] uppercase tracking-wider">
                  Extracted Action Items
                </h3>
                <span className="text-xs bg-[#EFEEE7] text-[#5A5A40] px-2 py-0.5 rounded-full border border-[#D6D5CD] font-semibold">
                  {openActions.length} open
                </span>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1 bg-[#EFEEE7] p-1 rounded-xl border border-[#D6D5CD]">
                {(['all', 'open', 'completed'] as const).map((filterType) => (
                  <button
                    key={filterType}
                    onClick={() => setActionFilter(filterType)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer ${
                      actionFilter === filterType
                        ? 'bg-white text-[#3A3A35] shadow-xs'
                        : 'text-[#73726B] hover:text-[#3A3A35]'
                    }`}
                  >
                    {filterType}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Add Custom Action Item */}
            <form onSubmit={handleAddCustomAction} className="mt-4 flex gap-2">
              <input
                id="new-action-input"
                type="text"
                value={newActionTitle}
                onChange={(e) => setNewActionTitle(e.target.value)}
                placeholder="Add a new action item or commitment..."
                className="flex-1 px-4 py-2 bg-[#F5F5F0] border border-[#D6D5CD] rounded-xl text-xs text-[#3A3A35] focus:outline-none focus:border-[#5A5A40]"
              />
              <button
                id="add-action-btn"
                type="submit"
                disabled={!newActionTitle.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#5A5A40] hover:bg-[#4E4E37] text-white text-xs font-semibold rounded-xl transition-all disabled:opacity-50 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Task</span>
              </button>
            </form>

            {/* Actions List */}
            <div className="mt-4 space-y-2">
              {filteredActionItems.length > 0 ? (
                filteredActionItems.map((item) => {
                  const isCompleted = item.status === 'completed';
                  return (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between gap-3 p-3.5 rounded-2xl border transition-all ${
                        isCompleted
                          ? 'bg-[#F5F5F0]/60 border-[#D6D5CD]/60 text-[#73726B]'
                          : 'bg-white border-[#D6D5CD] text-[#3A3A35] hover:border-[#5A5A40]/40'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <button
                          onClick={() => toggleActionItemStatus(userId, item.id, item.status)}
                          className="text-[#5A5A40] hover:text-[#3A3A35] transition-colors cursor-pointer shrink-0"
                          title={isCompleted ? 'Mark as Open' : 'Mark as Completed'}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="w-5 h-5 text-[#4B6350]" />
                          ) : (
                            <Circle className="w-5 h-5 text-[#B5B4AC]" />
                          )}
                        </button>

                        <div className="min-w-0">
                          <p
                            className={`text-xs font-medium truncate ${
                              isCompleted ? 'line-through text-[#73726B]' : 'text-[#3A3A35]'
                            }`}
                          >
                            {item.title}
                          </p>
                          {item.sourceJournalTitle && (
                            <p className="text-[11px] text-[#B5B4AC] mt-0.5 truncate">
                              From: {item.sourceJournalTitle}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => deleteActionItem(userId, item.id)}
                          className="p-1.5 text-[#B5B4AC] hover:text-rose-600 transition-colors cursor-pointer rounded-lg hover:bg-rose-50"
                          title="Delete Action Item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-6 text-xs text-[#73726B]">
                  No {actionFilter !== 'all' ? actionFilter : ''} action items found.
                </div>
              )}
            </div>
          </div>

          {/* Section 5: Past Generated Insights History */}
          {insights.length > 1 && (
            <div className="bg-[#F5F5F0] border border-[#D6D5CD] rounded-3xl p-6 sm:p-7 shadow-xs">
              <h3 className="text-sm font-semibold text-[#3A3A35] uppercase tracking-wider mb-4">
                Historical Synthesis Archives
              </h3>
              <div className="space-y-3">
                {insights.map((ins) => (
                  <div
                    key={ins.id}
                    className="p-4 rounded-2xl bg-white border border-[#D6D5CD] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#3A3A35]">
                          Synthesis Report
                        </span>
                        <span className="text-xs text-[#73726B]">
                          {new Date(ins.createdAt).toLocaleDateString(undefined, {
                            dateStyle: 'medium',
                          })}
                        </span>
                      </div>
                      <p className="text-xs text-[#73726B] mt-1 line-clamp-1">
                        {ins.weeklyReflection || ins.suggestedFocus}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <button
                        onClick={() => handleCopyInsight(ins)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#EFEEE7] hover:bg-[#E8E6DF] text-[#3A3A35] text-xs font-medium rounded-lg border border-[#D6D5CD] transition-colors cursor-pointer"
                      >
                        {copiedInsightId === ins.id ? (
                          <Check className="w-3.5 h-3.5 text-[#4B6350]" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>{copiedInsightId === ins.id ? 'Copied' : 'Copy'}</span>
                      </button>

                      <button
                        onClick={() => deleteInsight(userId, ins.id)}
                        className="p-1.5 text-[#B5B4AC] hover:text-rose-600 transition-colors cursor-pointer rounded-lg hover:bg-rose-50"
                        title="Delete Insight"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Empty State before first generation */
        <div className="text-center py-16 bg-white border border-[#D6D5CD] rounded-3xl p-8 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-[#EFEEE7] text-[#5A5A40] flex items-center justify-center mx-auto mb-4 border border-[#D6D5CD]">
            <Sparkles className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-serif font-bold text-[#3A3A35]">
            Discover Patterns in Your Thoughts
          </h2>
          <p className="text-sm text-[#73726B] max-w-md mx-auto mt-2 leading-relaxed">
            Gemini Reflection Intelligence analyzes your journal history to surface recurring themes, subconscious goals, positive growth habits, and high-impact action items.
          </p>
          <button
            id="empty-state-generate-btn"
            onClick={handleGenerateInsights}
            disabled={entries.length < 2 || isGenerating}
            className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-[#5A5A40] hover:bg-[#4E4E37] text-white text-sm font-semibold rounded-xl shadow-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Generate First Reflection Intelligence Report</span>
          </button>
        </div>
      )}
    </div>
  );
};
