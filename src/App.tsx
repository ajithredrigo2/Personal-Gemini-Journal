/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { UserProfile, InteractionEntry, InsightEntry, ActionItemEntry } from './types';
import {
  loginWithGoogle,
  logoutUser,
  subscribeAuthState,
  subscribeToUserInteractions,
  subscribeToUserInsights,
  subscribeToUserActionItems,
  deleteInteraction,
} from './firebase';
import { Navbar } from './components/Navbar';
import { LandingPage } from './components/LandingPage';
import { JournalEditor } from './components/JournalEditor';
import { EntryHistory } from './components/EntryHistory';
import { EntryDetailView } from './components/EntryDetailView';
import { InsightsView } from './components/InsightsView';
import { ConfirmModal } from './components/ConfirmModal';
import { SecurityModal } from './components/SecurityBadge';
import { APIProvider } from '@vis.gl/react-google-maps';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authInitialized, setAuthInitialized] = useState(false);
  const [activeView, setActiveView] = useState<'new' | 'insights' | 'history' | 'detail'>('new');
  const [selectedEntry, setSelectedEntry] = useState<InteractionEntry | null>(null);

  // Firestore entries, insights, and action items state
  const [entries, setEntries] = useState<InteractionEntry[]>([]);
  const [insights, setInsights] = useState<InsightEntry[]>([]);
  const [actionItems, setActionItems] = useState<ActionItemEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState<boolean>(true);
  const [firestoreError, setFirestoreError] = useState<string | null>(null);

  // Modals state
  const [entryToDelete, setEntryToDelete] = useState<string | null>(null);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);

  // Subscribe to Firebase Auth State
  useEffect(() => {
    const unsubscribeAuth = subscribeAuthState((firebaseUser: User | null) => {
      if (firebaseUser) {
        setCurrentUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
        });
      } else {
        setCurrentUser(null);
        setEntries([]);
        setInsights([]);
        setActionItems([]);
      }
      setAuthInitialized(true);
    });

    return () => unsubscribeAuth();
  }, []);

  // Subscribe to user-isolated Firestore entries, insights, and action items
  useEffect(() => {
    if (!currentUser) {
      setEntries([]);
      setInsights([]);
      setActionItems([]);
      setLoadingEntries(false);
      return;
    }

    setLoadingEntries(true);
    setFirestoreError(null);

    const unsubscribeInteractions = subscribeToUserInteractions(
      currentUser.uid,
      (fetchedEntries) => {
        setEntries(fetchedEntries);
        setLoadingEntries(false);

        // Keep selectedEntry in sync if it's currently open
        if (selectedEntry) {
          const updated = fetchedEntries.find((e) => e.id === selectedEntry.id);
          if (updated) setSelectedEntry(updated);
        }
      },
      (err) => {
        console.error('Failed to subscribe to entries:', err);
        setFirestoreError(err.message || 'Error syncing entries from Cloud Firestore');
        setLoadingEntries(false);
      }
    );

    const unsubscribeInsights = subscribeToUserInsights(
      currentUser.uid,
      (fetchedInsights) => {
        setInsights(fetchedInsights);
      },
      (err) => {
        console.error('Failed to subscribe to insights:', err);
      }
    );

    const unsubscribeActionItems = subscribeToUserActionItems(
      currentUser.uid,
      (fetchedActions) => {
        setActionItems(fetchedActions);
      },
      (err) => {
        console.error('Failed to subscribe to action items:', err);
      }
    );

    return () => {
      unsubscribeInteractions();
      unsubscribeInsights();
      unsubscribeActionItems();
    };
  }, [currentUser?.uid]);

  const handleSignIn = async () => {
    try {
      await loginWithGoogle();
      setActiveView('new');
    } catch (err: unknown) {
      console.error('Sign-in error:', err);
      throw err;
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
      setCurrentUser(null);
      setSelectedEntry(null);
      setActiveView('new');
    } catch (err) {
      console.error('Sign-out error:', err);
    }
  };

  const handleSelectEntry = (entry: InteractionEntry) => {
    setSelectedEntry(entry);
    setActiveView('detail');
  };

  const handleDeletePrompt = (entryId: string) => {
    setEntryToDelete(entryId);
  };

  const handleConfirmDelete = async () => {
    if (!entryToDelete || !currentUser) return;
    try {
      await deleteInteraction(currentUser.uid, entryToDelete);
      if (selectedEntry?.id === entryToDelete) {
        setSelectedEntry(null);
        setActiveView('history');
      }
    } catch (err) {
      console.error('Failed to delete interaction:', err);
    } finally {
      setEntryToDelete(null);
    }
  };

  const handleEntrySaved = (entry: InteractionEntry) => {
    setSelectedEntry(entry);
  };

  // Loading initial authentication state
  if (!authInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F0]">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-[#5A5A40] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm font-medium text-[#73726B]">Initializing MindScribe...</p>
        </div>
      </div>
    );
  }

  return (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY} libraries={['places', 'marker']}>
      <div className="min-h-screen bg-[#F5F5F0] text-[#3A3A35] flex flex-col font-sans">
        <Navbar
          user={currentUser}
          activeView={activeView}
          onNewEntry={() => {
            setSelectedEntry(null);
            setActiveView('new');
          }}
          onViewInsights={() => {
            setSelectedEntry(null);
            setActiveView('insights');
          }}
          onViewHistory={() => {
            setSelectedEntry(null);
            setActiveView('history');
          }}
          onLogout={handleLogout}
          onOpenSecurityModal={() => setIsSecurityModalOpen(true)}
        />

        <main className="flex-1">
          {!currentUser ? (
            <LandingPage
              onSignIn={handleSignIn}
              onOpenSecurityModal={() => setIsSecurityModalOpen(true)}
            />
          ) : (
            <>
              {firestoreError && (
                <div className="max-w-4xl mx-auto mt-4 px-4">
                  <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center justify-between">
                    <span>Firestore Notice: {firestoreError}</span>
                    <button
                      onClick={() => setFirestoreError(null)}
                      className="font-bold hover:text-rose-950 px-2 cursor-pointer"
                    >
                      &times;
                    </button>
                  </div>
                </div>
              )}

              {activeView === 'new' && (
                <JournalEditor
                  userId={currentUser.uid}
                  onEntrySaved={handleEntrySaved}
                  onViewHistory={() => setActiveView('history')}
                />
              )}

              {activeView === 'insights' && (
                <InsightsView
                  userId={currentUser.uid}
                  entries={entries}
                  insights={insights}
                  actionItems={actionItems}
                  onNavigateToNew={() => {
                    setSelectedEntry(null);
                    setActiveView('new');
                  }}
                  onNavigateToEntry={handleSelectEntry}
                />
              )}

              {activeView === 'history' && (
                <EntryHistory
                  entries={entries}
                  loading={loadingEntries}
                  onSelectEntry={handleSelectEntry}
                  onDeleteEntry={handleDeletePrompt}
                  onNewEntry={() => {
                    setSelectedEntry(null);
                    setActiveView('new');
                  }}
                />
              )}

              {activeView === 'detail' && selectedEntry && (
                <EntryDetailView
                  entry={selectedEntry}
                  userId={currentUser.uid}
                  onBack={() => setActiveView('history')}
                  onDelete={handleDeletePrompt}
                  onUpdateEntry={(updated) => setSelectedEntry(updated)}
                />
              )}
            </>
          )}
        </main>

        {/* Confirmation Modal for Deletion */}
        <ConfirmModal
          isOpen={!!entryToDelete}
          title="Delete Reflection Entry"
          message="Are you sure you want to delete this reflection? This action will permanently remove the multi-turn discussion and synthesis from Cloud Firestore."
          confirmLabel="Permanently Delete"
          cancelLabel="Cancel"
          onConfirm={handleConfirmDelete}
          onCancel={() => setEntryToDelete(null)}
        />

        {/* Security and Privacy Architecture Modal */}
        <SecurityModal
          isOpen={isSecurityModalOpen}
          onClose={() => setIsSecurityModalOpen(false)}
        />
      </div>
    </APIProvider>
  );
}

