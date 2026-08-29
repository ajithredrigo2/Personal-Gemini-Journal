import React, { useState, useMemo } from 'react';
import {
  Search,
  Calendar,
  Sparkles,
  Trash2,
  ChevronRight,
  Filter,
  Tag,
  BookOpen,
  Plus,
  MessageSquare,
  FileText,
  ListTodo,
  Lightbulb,
  Compass,
  MapPin,
  Eye,
} from 'lucide-react';
import { InteractionEntry, ReflectionMode, JournalLocation } from '../types';
import { MapModal } from './MapModal';

interface EntryHistoryProps {
  entries: InteractionEntry[];
  loading: boolean;
  onSelectEntry: (entry: InteractionEntry) => void;
  onDeleteEntry: (entryId: string) => void;
  onNewEntry: () => void;
}

const MODE_ICON_MAP: Record<ReflectionMode, React.ElementType> = {
  reflection: Sparkles,
  brainstorm: Lightbulb,
  summary: FileText,
  action_plan: ListTodo,
  deep_inquiry: Compass,
};

export const EntryHistory: React.FC<EntryHistoryProps> = ({
  entries,
  loading,
  onSelectEntry,
  onDeleteEntry,
  onNewEntry,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedModeFilter, setSelectedModeFilter] = useState<string>('all');
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>('all');
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>('all');
  const [modalLocation, setModalLocation] = useState<JournalLocation | null>(null);

  // Collect all unique tags
  const allTags = useMemo(() => {
    const set = new Set<string>();
    entries.forEach((e) => {
      e.tags?.forEach((t) => set.add(t));
    });
    return Array.from(set);
  }, [entries]);

  // Filtered and searched entries
  const filteredEntries = useMemo(() => {
    const now = new Date();
    const past7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const past30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const past90Days = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    return entries.filter((entry) => {
      // Search query match
      const query = searchQuery.toLowerCase();
      const titleMatch = entry.title?.toLowerCase().includes(query);
      const summaryMatch = entry.summary?.toLowerCase().includes(query);
      const contentMatch = entry.messages?.some((m) => m.content.toLowerCase().includes(query));
      const locationMatch =
        entry.location?.name?.toLowerCase().includes(query) ||
        entry.location?.formattedAddress?.toLowerCase().includes(query);
      const matchesSearch = !searchQuery || titleMatch || summaryMatch || contentMatch || locationMatch;

      // Mode filter
      const matchesMode =
        selectedModeFilter === 'all' || entry.mode === selectedModeFilter;

      // Tag filter
      const matchesTag =
        selectedTagFilter === 'all' || (entry.tags && entry.tags.includes(selectedTagFilter));

      // Date filter
      let matchesDate = true;
      const entryDate = new Date(entry.createdAt);
      if (selectedDateFilter === '7days') {
        matchesDate = entryDate >= past7Days;
      } else if (selectedDateFilter === '30days') {
        matchesDate = entryDate >= past30Days;
      } else if (selectedDateFilter === '90days') {
        matchesDate = entryDate >= past90Days;
      }

      return matchesSearch && matchesMode && matchesTag && matchesDate;
    });
  }, [entries, searchQuery, selectedModeFilter, selectedTagFilter, selectedDateFilter]);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-[#D6D5CD]">
        <div>
          <h2 className="text-2xl sm:text-3xl font-serif font-bold text-[#3A3A35]">
            Journal History
          </h2>
          <p className="text-sm text-[#73726B] mt-0.5 font-sans">
            Your private, encrypted reflection records stored in Cloud Firestore.
          </p>
        </div>

        <button
          id="history-create-new-btn"
          onClick={onNewEntry}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#5A5A40] hover:bg-[#4E4E37] text-white font-semibold rounded-xl text-sm shadow-xs transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Reflection</span>
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-[#73726B] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            id="history-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search keyword..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-[#D6D5CD] rounded-xl text-[#3A3A35] placeholder:text-[#B5B4AC] focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/40 text-sm"
          />
        </div>

        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[#73726B] shrink-0" />
          <select
            id="history-date-filter"
            value={selectedDateFilter}
            onChange={(e) => setSelectedDateFilter(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-[#D6D5CD] rounded-xl text-[#3A3A35] text-sm focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/40 cursor-pointer"
          >
            <option value="all">All Dates</option>
            <option value="7days">Past 7 Days</option>
            <option value="30days">Past 30 Days</option>
            <option value="90days">Past 3 Months</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-[#73726B] shrink-0" />
          <select
            id="history-mode-filter"
            value={selectedModeFilter}
            onChange={(e) => setSelectedModeFilter(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-[#D6D5CD] rounded-xl text-[#3A3A35] text-sm focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/40 cursor-pointer"
          >
            <option value="all">All Reflection Modes</option>
            <option value="reflection">Mindful Reflection</option>
            <option value="brainstorm">Brainstorm Sparks</option>
            <option value="summary">Executive Summary</option>
            <option value="action_plan">Action Blueprint</option>
            <option value="deep_inquiry">Socratic Inquiry</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Tag className="w-4 h-4 text-[#73726B] shrink-0" />
          <select
            id="history-tag-filter"
            value={selectedTagFilter}
            onChange={(e) => setSelectedTagFilter(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-[#D6D5CD] rounded-xl text-[#3A3A35] text-sm focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/40 cursor-pointer"
          >
            <option value="all">All Tags ({allTags.length})</option>
            {allTags.map((t) => (
              <option key={t} value={t}>
                #{t}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Content List */}
      <div className="mt-8">
        {loading ? (
          <div className="text-center py-16">
            <div className="w-8 h-8 border-3 border-[#5A5A40] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-[#73726B]">Loading your entries from Firestore...</p>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="text-center py-16 bg-white border border-dashed border-[#D6D5CD] rounded-2xl p-8">
            <BookOpen className="w-12 h-12 text-[#B5B4AC] mx-auto mb-3" />
            <h3 className="text-lg font-serif font-semibold text-[#3A3A35]">
              {searchQuery || selectedModeFilter !== 'all' || selectedTagFilter !== 'all'
                ? 'No matching reflections found'
                : 'No journal entries yet'}
            </h3>
            <p className="text-xs text-[#73726B] max-w-sm mx-auto mt-1 mb-6">
              {searchQuery || selectedModeFilter !== 'all' || selectedTagFilter !== 'all'
                ? 'Try adjusting your search criteria or filter tags.'
                : 'Start a new reflection thread to explore your thoughts and converse with Gemini AI.'}
            </p>
            <button
              id="history-empty-new-btn"
              onClick={onNewEntry}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#3A3A35] hover:bg-[#2D2D29] text-[#F5F5F0] font-medium rounded-xl text-sm transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create First Entry</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredEntries.map((entry) => {
              const Icon = MODE_ICON_MAP[entry.mode] || Sparkles;
              const dateStr = new Date(entry.createdAt).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              });

              return (
                <div
                  key={entry.id}
                  id={`entry-card-${entry.id}`}
                  onClick={() => onSelectEntry(entry)}
                  className="bg-white border border-[#D6D5CD] hover:border-[#5A5A40]/70 rounded-2xl p-5 transition-all shadow-xs hover:shadow-sm cursor-pointer group flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#EFEEE7] text-[#5A5A40] border border-[#D6D5CD]">
                        <Icon className="w-3 h-3 text-[#5A5A40]" />
                        <span className="capitalize">{entry.mode.replace('_', ' ')}</span>
                      </span>

                      {entry.mood && (
                        <span className="inline-flex items-center text-xs bg-[#F5F5F0] text-[#73726B] px-2 py-0.5 rounded-full border border-[#D6D5CD]">
                          Mood: {entry.mood}
                        </span>
                      )}

                      {entry.location && (
                        <span
                          className="inline-flex items-center gap-1 text-xs bg-[#5A5A40]/10 text-[#5A5A40] border border-[#5A5A40]/25 px-2 py-0.5 rounded-full max-w-[200px]"
                          title={`${entry.location.name} - ${entry.location.formattedAddress}`}
                        >
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span className="truncate">{entry.location.name}</span>
                        </span>
                      )}

                      <span className="inline-flex items-center gap-1 text-xs text-[#73726B] ml-auto sm:ml-0">
                        <Calendar className="w-3 h-3" />
                        {dateStr}
                      </span>
                    </div>

                    <h3 className="text-lg font-serif font-semibold text-[#3A3A35] group-hover:text-[#5A5A40] transition-colors truncate">
                      {entry.title || 'Untitled Reflection'}
                    </h3>

                    {entry.summary && (
                      <p className="text-xs text-[#73726B] line-clamp-2 mt-1 italic font-serif">
                        "{entry.summary}"
                      </p>
                    )}

                    {entry.tags && entry.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {entry.tags.map((t) => (
                          <span
                            key={t}
                            className="text-[11px] bg-[#F5F5F0] text-[#73726B] border border-[#D6D5CD] px-2 py-0.5 rounded-md"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2.5 self-end sm:self-center shrink-0">
                    {entry.location && (
                      <button
                        id={`history-view-map-btn-${entry.id}`}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setModalLocation(entry.location || null);
                        }}
                        title={`View on Map: ${entry.location.name}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-[#5A5A40] bg-[#EFEEE7] hover:bg-[#E8E6DF] rounded-lg border border-[#D6D5CD] transition-colors cursor-pointer"
                      >
                        <MapPin className="w-3.5 h-3.5" />
                        <span className="hidden md:inline">Map</span>
                      </button>
                    )}

                    <span className="inline-flex items-center gap-1 text-xs text-[#73726B] bg-[#F5F5F0] px-2.5 py-1 rounded-lg border border-[#D6D5CD]">
                      <MessageSquare className="w-3.5 h-3.5" />
                      {entry.messages?.length || 0} turns
                    </span>

                    <button
                      id={`delete-entry-btn-${entry.id}`}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteEntry(entry.id);
                      }}
                      title="Delete Entry"
                      className="p-2 text-[#73726B] hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <div className="text-[#B5B4AC] group-hover:text-[#5A5A40] transition-colors">
                      <ChevronRight className="w-5 h-5" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Interactive Map Modal */}
      <MapModal
        location={modalLocation}
        isOpen={!!modalLocation}
        onClose={() => setModalLocation(null)}
      />
    </div>
  );
};
