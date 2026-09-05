import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Send,
  Save,
  RotateCcw,
  Tag,
  Smile,
  CheckCircle2,
  AlertCircle,
  Lightbulb,
  FileText,
  ListTodo,
  Compass,
  MessageSquare,
  Bot,
  User as UserIcon,
  BellRing,
  Plus,
  History,
  Loader2,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { InteractionEntry, ReflectionMode, ChatMessage, GenerateAIResponse, JournalLocation, WebhookConfig } from '../types';
import { saveInteraction, logAuditEvent, authedFetch } from '../firebase';
import { LocationPicker } from './LocationPicker';

interface JournalEditorProps {
  userId: string;
  userEmail?: string | null;
  webhooks?: WebhookConfig[];
  onEntrySaved: (entry: InteractionEntry) => void;
  onViewHistory: () => void;
  onStartNewReflection?: () => void;
}

const MODES: Array<{
  id: ReflectionMode;
  name: string;
  icon: React.ElementType;
  description: string;
}> = [
  {
    id: 'reflection',
    name: 'Mindful Reflection',
    icon: Sparkles,
    description: 'Empathetic feedback, emotional validation, and gentle reframing.',
  },
  {
    id: 'brainstorm',
    name: 'Brainstorm Sparks',
    icon: Lightbulb,
    description: 'Expansive ideas, creative possibilities, and alternative angles.',
  },
  {
    id: 'summary',
    name: 'Executive Summary',
    icon: FileText,
    description: 'Concise synthesis, key themes, and high-level core takeaways.',
  },
  {
    id: 'action_plan',
    name: 'Action Blueprint',
    icon: ListTodo,
    description: 'Step-by-step prioritization, timeline estimation, and momentum plan.',
  },
  {
    id: 'deep_inquiry',
    name: 'Socratic Inquiry',
    icon: Compass,
    description: 'Challenging assumptions and probing root motivations.',
  },
];

const MOODS = [
  { id: 'Calm', emoji: '😌', label: 'Calm' },
  { id: 'Inspired', emoji: '✨', label: 'Inspired' },
  { id: 'Grateful', emoji: '🙏', label: 'Grateful' },
  { id: 'Focused', emoji: '🎯', label: 'Focused' },
  { id: 'Curious', emoji: '🤔', label: 'Curious' },
  { id: 'Overwhelmed', emoji: '🌪️', label: 'Overwhelmed' },
  { id: 'Restless', emoji: '⚡', label: 'Restless' },
];

const SUGGESTED_STANDARD_TAGS = [
  'Career',
  'Learning',
  'Work',
  'Personal Growth',
  'Ideas',
  'Goals',
  'Challenges',
  'Planning',
];

export const JournalEditor: React.FC<JournalEditorProps> = ({
  userId,
  userEmail,
  webhooks = [],
  onEntrySaved,
  onViewHistory,
  onStartNewReflection,
}) => {
  const [entryId, setEntryId] = useState<string>(() => `entry_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`);
  const [title, setTitle] = useState<string>('');
  const [mode, setMode] = useState<ReflectionMode>('reflection');
  const [selectedMood, setSelectedMood] = useState<string>('Calm');
  const [currentInput, setCurrentInput] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [summary, setSummary] = useState<string>('');
  const [keyInsights, setKeyInsights] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>(['Personal Growth']);
  const [newTagInput, setNewTagInput] = useState<string>('');
  const [selectedLocation, setSelectedLocation] = useState<JournalLocation | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSavedEntry, setLastSavedEntry] = useState<InteractionEntry | null>(null);
  const [webhookStatus, setWebhookStatus] = useState<string | null>(null);

  const reflectionLoaderRef = useRef<HTMLDivElement>(null);

  // Keep reflection loader in a convenient, visible place by auto-scrolling on submission
  useEffect(() => {
    if (isLoading) {
      const timer = setTimeout(() => {
        reflectionLoaderRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  const handleStartFresh = () => {
    if (onStartNewReflection) {
      onStartNewReflection();
    } else {
      setEntryId(`entry_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`);
      setTitle('');
      setMode('reflection');
      setSelectedMood('Calm');
      setCurrentInput('');
      setMessages([]);
      setSummary('');
      setKeyInsights([]);
      setTags(['Personal Growth']);
      setNewTagInput('');
      setSelectedLocation(null);
      setApiError(null);
      setSaveStatus('idle');
      setLastSavedEntry(null);
      setWebhookStatus(null);
    }
  };

  const handleAddTag = (tagToAdd?: string) => {
    const target = (tagToAdd || newTagInput).trim();
    if (target && !tags.includes(target)) {
      setTags([...tags, target]);
      if (!tagToAdd) setNewTagInput('');
    }
  };

  const handleToggleSuggestedTag = (tag: string) => {
    if (tags.includes(tag)) {
      setTags(tags.filter((t) => t !== tag));
    } else {
      setTags([...tags, tag]);
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handlePersistToFirestore = async (entryToSave: InteractionEntry) => {
    setSaveStatus('saving');
    try {
      await saveInteraction(userId, entryToSave);
      setSaveStatus('saved');
      setLastSavedEntry(entryToSave);
      onEntrySaved(entryToSave);

      // Webhook Dispatch Integration: Trigger enabled webhooks
      const activeWebhooks = webhooks.filter((wh) => {
        if (!wh.enabled) return false;
        if (wh.trigger === 'all') return true;
        if (wh.trigger === 'action_items_only') return entryToSave.extractedActions && entryToSave.extractedActions.length > 0;
        if (wh.trigger === 'action_plan_only') return entryToSave.mode === 'action_plan';
        if (wh.trigger === 'deep_inquiry_only') return entryToSave.mode === 'deep_inquiry';
        return true;
      });

      if (activeWebhooks.length > 0) {
        let dispatched = 0;
        let failed = 0;
        for (const wh of activeWebhooks) {
          try {
            const whRes = await authedFetch('/api/notifications/dispatch', {
              method: 'POST',
              body: JSON.stringify({
                webhookUrl: wh.url,
                provider: wh.provider,
                reflection: {
                  title: entryToSave.title,
                  summary: entryToSave.summary,
                  mode: entryToSave.mode,
                  mood: entryToSave.mood,
                  actionItems: entryToSave.extractedActions || [],
                  location: entryToSave.location,
                },
              }),
            });

            if (!whRes.ok) {
              const detail = await whRes.json().catch(() => ({}));
              throw new Error(detail.error || `Webhook returned HTTP ${whRes.status}`);
            }

            dispatched += 1;
            await logAuditEvent({
              eventType: 'webhook_dispatched',
              severity: 'info',
              actorId: userId,
              actorEmail: userEmail || 'user@local',
              details: `Dispatched reflection notification to ${wh.provider.toUpperCase()} ("${wh.name}")`,
            });
          } catch (whErr) {
            failed += 1;
            console.error('Webhook dispatch failed for', wh.name, whErr);
          }
        }
        setWebhookStatus(
          failed > 0
            ? `Dispatched to ${dispatched} channel(s); ${failed} failed`
            : `Dispatched to ${dispatched} external channel(s)`
        );
        setTimeout(() => setWebhookStatus(null), 5000);
      }
    } catch (err: unknown) {
      console.warn('Firestore save notice:', err);
      setSaveStatus('error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentInput.trim() || isLoading) return;

    const userMessageContent = currentInput.trim();
    const userMsg: ChatMessage = {
      role: 'user',
      content: userMessageContent,
      timestamp: new Date().toISOString(),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setCurrentInput('');
    setIsLoading(true);
    setApiError(null);

    // Auto-populate a title if empty
    const activeTitle = title.trim() || userMessageContent.slice(0, 48) + (userMessageContent.length > 48 ? '...' : '');
    if (!title.trim()) {
      setTitle(activeTitle);
    }

    try {
      const res = await authedFetch('/api/gemini/reflect', {
        method: 'POST',
        body: JSON.stringify({
          mode,
          messages: updatedMessages,
          currentInput: userMessageContent,
          mood: selectedMood,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Server responded with status ${res.status}`);
      }

      const data: GenerateAIResponse = await res.json();

      const aiMsg: ChatMessage = {
        role: 'model',
        content: data.reply,
        timestamp: new Date().toISOString(),
      };

      const finalMessages = [...updatedMessages, aiMsg];
      setMessages(finalMessages);

      if (data.summary) setSummary(data.summary);
      if (data.keyInsights && data.keyInsights.length > 0) setKeyInsights(data.keyInsights);
      
      const combinedTags = Array.from(new Set([...tags, ...(data.suggestedTags || [])]));
      setTags(combinedTags);

      const entryPayload: InteractionEntry = {
        id: entryId,
        userId,
        title: activeTitle,
        mode,
        mood: selectedMood,
        messages: finalMessages,
        summary: data.summary || summary,
        keyInsights: (data.keyInsights && data.keyInsights.length > 0) ? data.keyInsights : keyInsights,
        tags: combinedTags,
        location: selectedLocation || null,
        createdAt: finalMessages[0]?.timestamp || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await handlePersistToFirestore(entryPayload);
    } catch (err: unknown) {
      console.warn('Gemini communication notice:', err);
      setApiError((err as Error)?.message || 'Could not connect to Gemini AI.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualRetrySave = async () => {
    if (!lastSavedEntry && messages.length === 0) return;
    const entryToSave: InteractionEntry = lastSavedEntry || {
      id: entryId,
      userId,
      title: title.trim() || 'Untitled Reflection',
      mode,
      mood: selectedMood,
      messages,
      summary,
      keyInsights,
      tags,
      location: selectedLocation || null,
      createdAt: messages[0]?.timestamp || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await handlePersistToFirestore(entryToSave);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      {/* Save Status Bar & Mode Switcher */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-[#D6D5CD]">
        <div>
          <h2 className="text-2xl sm:text-3xl font-serif font-bold text-[#3A3A35]">
            {messages.length === 0 ? 'New Reflection' : title || 'Active Reflection'}
          </h2>
          <p className="text-sm text-[#73726B] mt-0.5 font-sans">
            Express your thoughts freely. Gemini will reflect, summarize, and brainstorm with you.
          </p>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-center">
          {saveStatus === 'saving' && (
            <span className="inline-flex items-center gap-1.5 text-xs text-[#5A5A40] font-medium">
              <div className="w-3.5 h-3.5 border-2 border-[#5A5A40] border-t-transparent rounded-full animate-spin" />
              Saving to Firestore...
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="inline-flex items-center gap-1 text-xs text-[#4B6350] font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#4B6350]" />
              Saved to Firestore
            </span>
          )}
          {saveStatus === 'error' && (
            <button
              id="retry-save-btn"
              onClick={handleManualRetrySave}
              className="inline-flex items-center gap-1 text-xs bg-rose-100 text-rose-700 px-2.5 py-1 rounded-md hover:bg-rose-200 transition-colors font-medium cursor-pointer"
            >
              <AlertCircle className="w-3.5 h-3.5" />
              Retry Save
            </button>
          )}

          {messages.length > 0 && (
            <button
              id="start-fresh-reflection-btn"
              onClick={handleStartFresh}
              className="inline-flex items-center gap-1.5 text-xs text-[#5A5A40] hover:text-[#3A3A35] bg-[#5A5A40]/10 hover:bg-[#5A5A40]/20 px-3 py-1.5 rounded-lg border border-[#5A5A40]/30 font-medium transition-colors cursor-pointer whitespace-nowrap"
              title="Clear current conversation and start a new reflection"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Reflection</span>
            </button>
          )}

          <button
            id="view-all-entries-btn"
            onClick={onViewHistory}
            className="inline-flex items-center gap-1.5 text-xs text-[#3A3A35] hover:text-black bg-[#EFEEE7] hover:bg-[#E8E6DF] px-3 py-1.5 rounded-lg border border-[#D6D5CD] font-medium transition-colors cursor-pointer whitespace-nowrap"
            title="View reflection history"
          >
            <History className="w-3.5 h-3.5 text-[#5A5A40]" />
            <span>History</span>
          </button>
        </div>
      </div>

      {/* Sticky Floating Reflection Loader Pill (Guaranteed visible in viewport regardless of scroll position) */}
      {isLoading && (
        <div
          id="sticky-reflection-loader"
          role="status"
          aria-live="polite"
          onClick={() => {
            reflectionLoaderRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }}
          className="sticky top-20 z-30 mx-auto my-3 w-fit flex items-center gap-2.5 px-4 py-2 bg-[#3A3A35] text-[#F5F5F0] border border-[#5A5A40] rounded-full shadow-lg backdrop-blur-md cursor-pointer hover:bg-[#484842] transition-all transform hover:scale-102 animate-in fade-in slide-in-from-top-2 duration-200"
          title="Click to jump directly to the reflection in progress"
        >
          <div className="w-4 h-4 border-2 border-[#9AC29F] border-t-transparent rounded-full animate-spin shrink-0" />
          <span className="text-xs font-medium text-[#E8E6DF]">
            Gemini is reflecting on your entry...
          </span>
          <span className="text-[10px] bg-[#5A5A40] text-[#F5F5F0] px-2 py-0.5 rounded-full font-mono font-medium">
            In progress
          </span>
        </div>
      )}

      {/* Editor Controls: Title, Mode, Mood */}
      <div className="mt-6 space-y-6">
        {/* Title & Mood Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-[#3A3A35] uppercase tracking-wider mb-1.5">
              Entry Title
            </label>
            <input
              id="entry-title-input"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Unwinding after a challenging sprint / Decision about next career step"
              className="w-full px-4 py-2.5 bg-white border border-[#D6D5CD] rounded-xl text-[#3A3A35] placeholder:text-[#B5B4AC] focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/40 focus:border-[#5A5A40] text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#3A3A35] uppercase tracking-wider mb-1.5">
              Current Mood
            </label>
            <div className="flex flex-wrap gap-1.5">
              {MOODS.map((m) => (
                <button
                  key={m.id}
                  id={`mood-btn-${m.id.toLowerCase()}`}
                  type="button"
                  onClick={() => setSelectedMood(m.id)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs transition-all cursor-pointer ${
                    selectedMood === m.id
                      ? 'bg-[#5A5A40]/15 text-[#3A3A35] border border-[#5A5A40]/60 font-semibold shadow-xs'
                      : 'bg-white text-[#73726B] border border-[#D6D5CD] hover:bg-[#F5F5F0]'
                  }`}
                >
                  <span>{m.emoji}</span>
                  <span>{m.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Reflection Mode Chips */}
        <div>
          <label className="block text-xs font-semibold text-[#3A3A35] uppercase tracking-wider mb-1.5">
            Reflection Persona & Goal
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {MODES.map((m) => {
              const Icon = m.icon;
              const isActive = mode === m.id;
              return (
                <button
                  key={m.id}
                  id={`mode-chip-${m.id}`}
                  type="button"
                  onClick={() => setMode(m.id)}
                  className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#5A5A40]/12 border-[#5A5A40] text-[#3A3A35] ring-1 ring-[#5A5A40] shadow-xs'
                      : 'bg-white border-[#D6D5CD] text-[#3A3A35] hover:border-[#B5B4AC] hover:bg-[#F5F5F0]'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-[#5A5A40]' : 'text-[#73726B]'}`} />
                    <span className="text-xs font-semibold">{m.name}</span>
                  </div>
                  <p className="text-[11px] text-[#73726B] leading-tight line-clamp-2">
                    {m.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Conversation / Chat Stream */}
        {messages.length > 0 && (
          <div className="space-y-6 pt-4">
            {messages.map((msg, index) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={index}
                  className={`flex items-start gap-3.5 ${
                    isUser ? 'flex-row-reverse' : 'flex-row'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      isUser
                        ? 'bg-[#3A3A35] text-[#F5F5F0]'
                        : 'bg-[#5A5A40]/15 text-[#5A5A40] border border-[#5A5A40]/30'
                    }`}
                  >
                    {isUser ? <UserIcon className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>

                  <div
                    className={`max-w-[85%] rounded-2xl px-5 py-4 ${
                      isUser
                        ? 'bg-[#3A3A35] text-[#F5F5F0] shadow-xs'
                        : 'bg-white border border-[#D6D5CD] text-[#3A3A35] shadow-xs'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4 mb-2 pb-1.5 border-b border-[#D6D5CD]/50 text-xs">
                      <span className={`font-semibold ${isUser ? 'text-[#B5B4AC]' : 'text-[#73726B]'}`}>
                        {isUser ? 'You' : 'Gemini Reflection Engine'}
                      </span>
                      <span className={`text-[11px] ${isUser ? 'text-[#B5B4AC]' : 'text-[#73726B]'}`}>
                        {new Date(msg.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <div className="prose prose-sm max-w-none leading-relaxed">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* In-Thread Reflection Loader Bubble (Prominently placed right under user input) */}
            {isLoading && (
              <div
                ref={reflectionLoaderRef}
                id="in-thread-reflection-loader"
                role="status"
                aria-live="polite"
                className="flex items-start gap-3.5 flex-row pt-1 animate-in fade-in duration-300"
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-[#5A5A40]/15 text-[#5A5A40] border border-[#5A5A40]/30 animate-pulse">
                  <Sparkles className="w-4 h-4 text-[#5A5A40] animate-spin" style={{ animationDuration: '3s' }} />
                </div>

                <div className="max-w-[85%] rounded-2xl px-5 py-4 bg-white border border-[#5A5A40]/40 text-[#3A3A35] shadow-md">
                  <div className="flex items-center justify-between gap-4 mb-2.5 pb-1.5 border-b border-[#D6D5CD]/60 text-xs">
                    <span className="font-semibold text-[#5A5A40] flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#5A5A40] animate-ping" />
                      Gemini Reflection Engine
                    </span>
                    <span className="text-[11px] text-[#73726B] font-mono">Synthesizing...</span>
                  </div>

                  <div className="space-y-2 py-1">
                    <div className="flex items-center gap-2.5 text-sm text-[#5A5A40] font-medium">
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-[#5A5A40] animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 rounded-full bg-[#5A5A40] animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 rounded-full bg-[#5A5A40] animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span className="text-xs sm:text-sm text-[#3A3A35] font-serif italic">
                        Reflecting deeply on your thoughts...
                      </span>
                    </div>
                    <p className="text-xs text-[#73726B] font-sans pl-6">
                      Formulating perspective, identifying insights, and organizing next steps.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Executive Summary & Key Insights Box (if available) */}
        {(summary || (keyInsights && keyInsights.length > 0)) && (
          <div className="bg-[#EFEEE7] border border-[#D6D5CD] rounded-2xl p-5 shadow-xs">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-[#5A5A40]" />
              <h4 className="text-sm font-semibold text-[#3A3A35] uppercase tracking-wider">
                Automated Reflection Synthesis
              </h4>
            </div>

            {summary && (
              <p className="text-base text-[#3A3A35] leading-relaxed mb-4 italic font-serif">
                "{summary}"
              </p>
            )}

            {keyInsights && keyInsights.length > 0 && (
              <div>
                <span className="text-xs font-semibold text-[#3A3A35] block mb-1.5">
                  Core Insights:
                </span>
                <ul className="space-y-1 text-xs text-[#3A3A35] list-disc list-inside">
                  {keyInsights.map((insight, idx) => (
                    <li key={idx} className="leading-snug">
                      {insight}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Tags input bar & suggestions */}
        <div className="space-y-2 pt-2">
          <div className="flex flex-wrap items-center gap-2">
            <Tag className="w-3.5 h-3.5 text-[#73726B]" />
            <span className="text-xs text-[#73726B] font-medium">Tags:</span>
            {tags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 bg-[#EFEEE7] text-[#3A3A35] text-xs px-2.5 py-0.5 rounded-full border border-[#D6D5CD]"
              >
                #{t}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(t)}
                  className="hover:text-rose-600 text-[#73726B] font-bold ml-0.5 cursor-pointer"
                >
                  &times;
                </button>
              </span>
            ))}
            <div className="inline-flex items-center gap-1">
              <input
                id="new-tag-input"
                type="text"
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                placeholder="Add tag..."
                className="px-2 py-0.5 text-xs bg-white border border-[#D6D5CD] rounded-md focus:outline-none focus:ring-1 focus:ring-[#5A5A40] w-24 text-[#3A3A35]"
              />
              <button
                id="add-tag-btn"
                type="button"
                onClick={() => handleAddTag()}
                className="text-xs bg-[#EFEEE7] hover:bg-[#E8E6DF] px-2 py-0.5 rounded-md text-[#3A3A35] cursor-pointer"
              >
                +
              </button>
            </div>
          </div>

          {/* Quick Suggested Tags */}
          <div className="flex flex-wrap items-center gap-1.5 pl-5">
            <span className="text-[11px] text-[#B5B4AC]">Suggested:</span>
            {SUGGESTED_STANDARD_TAGS.map((stag) => {
              const isSelected = tags.includes(stag);
              return (
                <button
                  key={stag}
                  type="button"
                  onClick={() => handleToggleSuggestedTag(stag)}
                  className={`text-[11px] px-2 py-0.5 rounded-full border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#5A5A40]/15 text-[#5A5A40] border-[#5A5A40]/40 font-semibold'
                      : 'bg-[#F5F5F0] text-[#73726B] border-[#D6D5CD] hover:border-[#B5B4AC]'
                  }`}
                >
                  {isSelected ? '✓ ' : '+ '}#{stag}
                </button>
              );
            })}
          </div>
        </div>

        {/* Optional Location Attachment */}
        <LocationPicker
          selectedLocation={selectedLocation}
          onSelectLocation={setSelectedLocation}
          className="pt-1"
        />

        {/* Error Notification */}
        {apiError && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-sm flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">AI Generation Notice</p>
              <p className="text-xs text-rose-700 mt-0.5">{apiError}</p>
            </div>
          </div>
        )}

        {/* Input Composer Box */}
        <form onSubmit={handleSubmit} className="relative mt-4">
          <div className="bg-white border-2 border-[#D6D5CD] focus-within:border-[#5A5A40] rounded-2xl shadow-xs transition-all overflow-hidden">
            {/* In-Composer Active Reflection Status Bar */}
            {isLoading && (
              <div
                id="composer-reflection-bar"
                className="flex items-center justify-between px-4 py-2.5 bg-[#5A5A40]/10 border-b border-[#5A5A40]/25 text-xs text-[#5A5A40] font-medium animate-in fade-in"
              >
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 border-2 border-[#5A5A40] border-t-transparent rounded-full animate-spin shrink-0" />
                  <span className="font-semibold">Gemini is actively reflecting on your entry...</span>
                </div>
                <span className="text-[11px] text-[#73726B] font-sans hidden sm:inline">Please wait a moment</span>
              </div>
            )}

            <textarea
              id="journal-entry-textarea"
              rows={messages.length === 0 ? 6 : 4}
              value={currentInput}
              disabled={isLoading}
              onChange={(e) => setCurrentInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder={
                isLoading
                  ? 'Gemini is reflecting on your entry... your response will appear in a moment.'
                  : messages.length === 0
                  ? "What's on your mind today? Write candidly about your achievements, challenges, decisions, or thoughts... (Ctrl+Enter to send)"
                  : 'Reply or ask a follow-up question to deepen the reflection... (Ctrl+Enter to send)'
              }
              className="w-full p-4 text-[#3A3A35] placeholder:text-[#B5B4AC] focus:outline-none resize-y text-base font-sans leading-relaxed disabled:bg-[#FAF9F5] disabled:cursor-not-allowed"
            />

            <div className="flex items-center justify-between px-4 py-3 bg-[#F5F5F0] border-t border-[#D6D5CD]">
              <div className="flex items-center gap-2 text-xs text-[#73726B]">
                <span className="hidden sm:inline">Press <kbd className="px-1.5 py-0.5 bg-[#E8E6DF] rounded font-mono text-[10px] text-[#3A3A35]">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 bg-[#E8E6DF] rounded font-mono text-[10px] text-[#3A3A35]">Enter</kbd> to reflect</span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  id="submit-reflection-btn"
                  type="submit"
                  disabled={!currentInput.trim() || isLoading}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#5A5A40] hover:bg-[#4E4E37] text-white font-semibold rounded-xl text-sm shadow-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Reflecting with Gemini...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-white" />
                      <span>{messages.length === 0 ? 'Reflect with Gemini' : 'Send Reply'}</span>
                      <Send className="w-3.5 h-3.5 ml-0.5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
