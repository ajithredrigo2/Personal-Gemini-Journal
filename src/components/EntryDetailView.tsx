import React, { useState } from 'react';
import {
  ArrowLeft,
  Sparkles,
  Send,
  Trash2,
  Copy,
  Check,
  Calendar,
  Tag,
  Bot,
  User as UserIcon,
  AlertCircle,
  Lightbulb,
  FileText,
  ListTodo,
  Compass,
  MapPin,
  Eye,
  X,
  ExternalLink,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { InteractionEntry, ChatMessage, GenerateAIResponse, ReflectionMode, JournalLocation } from '../types';
import { saveInteraction, updateEntryLocation } from '../firebase';
import { MapModal } from './MapModal';

interface EntryDetailViewProps {
  entry: InteractionEntry;
  userId: string;
  onBack: () => void;
  onDelete: (entryId: string) => void;
  onUpdateEntry: (updated: InteractionEntry) => void;
}

const MODE_ICON_MAP: Record<ReflectionMode, React.ElementType> = {
  reflection: Sparkles,
  brainstorm: Lightbulb,
  summary: FileText,
  action_plan: ListTodo,
  deep_inquiry: Compass,
};

export const EntryDetailView: React.FC<EntryDetailViewProps> = ({
  entry,
  userId,
  onBack,
  onDelete,
  onUpdateEntry,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(entry.messages || []);
  const [currentInput, setCurrentInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [summary, setSummary] = useState(entry.summary || '');
  const [keyInsights, setKeyInsights] = useState<string[]>(entry.keyInsights || []);
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [isRemovingLocation, setIsRemovingLocation] = useState(false);

  const ModeIcon = MODE_ICON_MAP[entry.mode] || Sparkles;

  const handleCopyFormattedText = () => {
    const formatted = `
# ${entry.title || 'Journal Reflection'}
*Date:* ${new Date(entry.createdAt).toLocaleDateString()}
*Mode:* ${entry.mode} | *Mood:* ${entry.mood || 'N/A'}
${entry.location ? `*Location:* ${entry.location.name} (${entry.location.formattedAddress || 'Lat: ' + entry.location.latitude + ', Lng: ' + entry.location.longitude})` : ''}
*Tags:* ${entry.tags?.join(', ') || 'None'}

## Executive Summary
${summary || 'N/A'}

## Key Insights
${keyInsights.map((i) => `- ${i}`).join('\n')}

---
## Dialogue
${messages
  .map(
    (m) =>
      `### ${m.role === 'user' ? 'You' : 'Gemini AI'} (${new Date(
        m.timestamp
      ).toLocaleTimeString()})\n${m.content}\n`
  )
  .join('\n')}
    `.trim();

    navigator.clipboard.writeText(formatted);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRemoveLocation = async () => {
    if (!entry.location || isRemovingLocation) return;
    setIsRemovingLocation(true);
    try {
      await updateEntryLocation(userId, entry.id, null);
      const updated: InteractionEntry = {
        ...entry,
        location: null,
        updatedAt: new Date().toISOString(),
      };
      onUpdateEntry(updated);
    } catch (err) {
      console.warn('Failed to remove location from entry notice:', err);
    } finally {
      setIsRemovingLocation(false);
    }
  };

  const handleSendFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentInput.trim() || isLoading) return;

    const followUpText = currentInput.trim();
    const userMsg: ChatMessage = {
      role: 'user',
      content: followUpText,
      timestamp: new Date().toISOString(),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setCurrentInput('');
    setIsLoading(true);
    setApiError(null);

    try {
      const res = await fetch('/api/gemini/reflect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: entry.mode,
          messages: updatedMessages,
          currentInput: followUpText,
          mood: entry.mood,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error ${res.status}`);
      }

      const data: GenerateAIResponse = await res.json();
      const aiMsg: ChatMessage = {
        role: 'model',
        content: data.reply,
        timestamp: new Date().toISOString(),
      };

      const finalMessages = [...updatedMessages, aiMsg];
      setMessages(finalMessages);

      const newSummary = data.summary || summary;
      const newInsights =
        data.keyInsights && data.keyInsights.length > 0 ? data.keyInsights : keyInsights;

      if (newSummary) setSummary(newSummary);
      if (newInsights) setKeyInsights(newInsights);

      const updatedPayload: InteractionEntry = {
        ...entry,
        messages: finalMessages,
        summary: newSummary,
        keyInsights: newInsights,
        updatedAt: new Date().toISOString(),
      };

      await saveInteraction(userId, updatedPayload);
      onUpdateEntry(updatedPayload);
    } catch (err: unknown) {
      console.warn('Follow-up generation notice:', err);
      setApiError((err as Error)?.message || 'Failed to send follow-up.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      {/* Top Navigation & Actions Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-[#D6D5CD]">
        <button
          id="detail-back-btn"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-[#3A3A35] hover:text-black text-sm font-medium transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to History</span>
        </button>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <button
            id="detail-copy-btn"
            onClick={handleCopyFormattedText}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#EFEEE7] hover:bg-[#E8E6DF] text-[#3A3A35] text-xs font-medium rounded-lg border border-[#D6D5CD] transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-[#4B6350]" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied Markdown' : 'Copy Entry'}</span>
          </button>

          <button
            id="detail-delete-btn"
            onClick={() => onDelete(entry.id)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-medium rounded-lg border border-rose-200 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </button>
        </div>
      </div>

      {/* Entry Header Info */}
      <div className="mt-6">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#EFEEE7] text-[#5A5A40] border border-[#D6D5CD]">
            <ModeIcon className="w-3 h-3 text-[#5A5A40]" />
            <span className="capitalize">{entry.mode.replace('_', ' ')}</span>
          </span>

          {entry.mood && (
            <span className="inline-flex items-center text-xs bg-[#F5F5F0] text-[#73726B] px-2 py-0.5 rounded-full border border-[#D6D5CD]">
              Mood: {entry.mood}
            </span>
          )}

          <span className="inline-flex items-center gap-1 text-xs text-[#73726B]">
            <Calendar className="w-3.5 h-3.5" />
            {new Date(entry.createdAt).toLocaleString(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-serif font-bold text-[#3A3A35] leading-tight">
          {entry.title || 'Untitled Reflection'}
        </h1>

        {entry.tags && entry.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {entry.tags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-0.5 text-xs bg-[#EFEEE7] text-[#3A3A35] border border-[#D6D5CD] px-2.5 py-0.5 rounded-full"
              >
                <Tag className="w-2.5 h-2.5 text-[#73726B]" />#{t}
              </span>
            ))}
          </div>
        )}

        {/* Location Banner (if attached) */}
        {entry.location && (
          <div
            id="detail-entry-location-card"
            className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 bg-white border border-[#D6D5CD] rounded-2xl shadow-xs"
          >
            <div className="flex items-start sm:items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-full bg-[#5A5A40]/15 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                <MapPin className="w-4 h-4 text-[#5A5A40]" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#3A3A35] truncate">
                    {entry.location.name}
                  </span>
                  <span className="text-[10px] text-[#5A5A40] bg-[#5A5A40]/10 px-1.5 py-0.5 rounded font-medium">
                    Google Maps
                  </span>
                </div>
                <p className="text-[11px] text-[#73726B] truncate max-w-lg">
                  {entry.location.formattedAddress || `${entry.location.latitude.toFixed(4)}, ${entry.location.longitude.toFixed(4)}`}
                </p>
                <div className="text-[10px] text-[#B5B4AC] font-mono mt-0.5">
                  Coordinates: {entry.location.latitude.toFixed(6)}, {entry.location.longitude.toFixed(6)}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
              <button
                id="detail-view-on-map-btn"
                type="button"
                onClick={() => setIsMapModalOpen(true)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-[#5A5A40] hover:bg-[#4E4E37] text-white rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>View on Map</span>
              </button>

              <button
                id="detail-remove-location-btn"
                type="button"
                onClick={handleRemoveLocation}
                disabled={isRemovingLocation}
                className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 text-rose-700 hover:bg-rose-50 rounded-xl border border-rose-200 transition-colors disabled:opacity-50 cursor-pointer"
                title="Remove location from this entry"
              >
                <X className="w-3.5 h-3.5" />
                <span>{isRemovingLocation ? 'Removing...' : 'Remove Location'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Summary Box */}
      {(summary || (keyInsights && keyInsights.length > 0)) && (
        <div className="mt-6 bg-[#EFEEE7] border border-[#D6D5CD] rounded-2xl p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-[#5A5A40]" />
            <h3 className="text-xs font-semibold text-[#3A3A35] uppercase tracking-wider">
              Reflection Synthesis & Key Takeaways
            </h3>
          </div>

          {summary && (
            <p className="text-base text-[#3A3A35] leading-relaxed font-serif italic mb-3">
              "{summary}"
            </p>
          )}

          {keyInsights && keyInsights.length > 0 && (
            <ul className="space-y-1 text-xs text-[#3A3A35] list-disc list-inside">
              {keyInsights.map((insight, idx) => (
                <li key={idx} className="leading-relaxed">
                  {insight}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Dialogue Thread */}
      <div className="mt-8 space-y-6">
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
                    {isUser ? 'You' : 'Gemini 3.6 Flash'}
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
      </div>

      {/* Error Message */}
      {apiError && (
        <div className="mt-4 p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-sm flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">AI Interaction Notice</p>
            <p className="text-xs text-rose-700 mt-0.5">{apiError}</p>
          </div>
        </div>
      )}

      {/* Multi-turn Continuation Box */}
      <form onSubmit={handleSendFollowUp} className="mt-8">
        <div className="bg-white border-2 border-[#D6D5CD] focus-within:border-[#5A5A40] rounded-2xl shadow-xs overflow-hidden transition-all">
          <textarea
            id="detail-followup-textarea"
            rows={3}
            value={currentInput}
            onChange={(e) => setCurrentInput(e.target.value)}
            placeholder="Continue the reflection or explore a deeper angle with Gemini... (Ctrl+Enter to send)"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSendFollowUp(e);
              }
            }}
            className="w-full p-4 text-[#3A3A35] placeholder:text-[#B5B4AC] focus:outline-none resize-y text-sm font-sans"
          />

          <div className="flex items-center justify-between px-4 py-2.5 bg-[#F5F5F0] border-t border-[#D6D5CD]">
            <span className="text-xs text-[#73726B] hidden sm:inline">
              Ctrl + Enter to send
            </span>

            <button
              id="detail-send-followup-btn"
              type="submit"
              disabled={!currentInput.trim() || isLoading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#5A5A40] hover:bg-[#4E4E37] text-white font-semibold rounded-xl text-xs shadow-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLoading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Thinking...</span>
                </>
              ) : (
                <>
                  <span>Send Follow-Up</span>
                  <Send className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Interactive Map Modal */}
      <MapModal
        location={entry.location || null}
        isOpen={isMapModalOpen}
        onClose={() => setIsMapModalOpen(false)}
      />
    </div>
  );
};
