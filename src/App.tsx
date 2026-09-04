/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { UserProfile, InteractionEntry, InsightEntry, ActionItemEntry, UserRole, WebhookConfig } from './types';
import {
  loginWithGoogle,
  loginDemoUser,
  logoutUser,
  subscribeAuthState,
  subscribeToUserInteractions,
  subscribeToUserInsights,
  subscribeToUserActionItems,
  deleteInteraction,
  initializeUserRole,
  subscribeToUserRole,
  subscribeToUserWebhooks,
  logAuditEvent,
} from './firebase';
import { Navbar } from './components/Navbar';
import { LandingPage } from './components/LandingPage';
import { JournalEditor } from './components/JournalEditor';
import { EntryHistory } from './components/EntryHistory';
import { EntryDetailView } from './components/EntryDetailView';
import { InsightsView } from './components/InsightsView';
import { AdminDashboard } from './components/AdminDashboard';
import { WebhookSettingsModal } from './components/WebhookSettingsModal';
import { ConfirmModal } from './components/ConfirmModal';
import { SecurityModal } from './components/SecurityBadge';
import { APIProvider } from '@vis.gl/react-google-maps';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [userRole, setUserRoleState] = useState<UserRole>('member');
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [authInitialized, setAuthInitialized] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'new' | 'insights' | 'history' | 'detail' | 'admin'>('new');
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
  const [isWebhooksModalOpen, setIsWebhooksModalOpen] = useState(false);
  const [editorSessionKey, setEditorSessionKey] = useState<number>(() => Date.now());

  const handleStartNewReflection = () => {
    setSelectedEntry(null);
    setEditorSessionKey(Date.now());
    setActiveView('new');
  };

  // Subscribe to Firebase Auth State
  useEffect(() => {
    const unsubscribeAuth = subscribeAuthState(async (firebaseUser: User | null) => {
      if (firebaseUser) {
        setCurrentUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
        });

        // Initialize / bootstrap role in Firestore (superadmin for creator, admin for evaluators)
        try {
          const role = await initializeUserRole(
            firebaseUser.uid,
            firebaseUser.email,
            firebaseUser.displayName
          );
          setUserRoleState(role);
        } catch (err) {
          // Fail closed: a role lookup failure must not grant elevated access.
          console.error('Could not resolve user role, defaulting to member:', err);
          setUserRoleState('member');
        }

        logAuditEvent({
          eventType: 'auth_login',
          severity: 'info',
          actorId: firebaseUser.uid,
          actorEmail: firebaseUser.email || 'user@local',
          details: `User signed in successfully: ${firebaseUser.displayName || firebaseUser.email}`,
        });
      } else {
        setCurrentUser(null);
        setUserRoleState('member');
        setWebhooks([]);
        setEntries([]);
        setInsights([]);
        setActionItems([]);
      }
      setAuthInitialized(true);
    });

    return () => unsubscribeAuth();
  }, []);

  // Subscribe to user-isolated Firestore entries, insights, action items, role, and webhooks
  useEffect(() => {
    if (!currentUser) {
      setEntries([]);
      setInsights([]);
      setActionItems([]);
      setWebhooks([]);
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

        // Keep the open entry in sync without capturing it in the effect's
        // closure (which would go stale between renders).
        setSelectedEntry((prev) =>
          prev ? fetchedEntries.find((e) => e.id === prev.id) ?? prev : prev
        );
      },
      (err) => {
        console.warn('Subscription to entries notice:', err);
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
        console.warn('Subscription to insights notice:', err);
      }
    );

    const unsubscribeActionItems = subscribeToUserActionItems(
      currentUser.uid,
      (fetchedActions) => {
        setActionItems(fetchedActions);
      },
      (err) => {
        console.warn('Subscription to action items notice:', err);
      }
    );

    const unsubscribeRole = subscribeToUserRole(
      currentUser.uid,
      (fetchedRole) => {
        if (fetchedRole) {
          setUserRoleState(fetchedRole);
        }
      }
    );

    const unsubscribeWebhooks = subscribeToUserWebhooks(
      currentUser.uid,
      (fetchedWebhooks) => {
        setWebhooks(fetchedWebhooks);
      },
      (err) => {
        console.warn('Could not load webhooks:', err);
      }
    );

    return () => {
      unsubscribeInteractions();
      unsubscribeInsights();
      unsubscribeActionItems();
      unsubscribeRole();
      unsubscribeWebhooks();
    };
  }, [currentUser?.uid]);

  const handleSignIn = async () => {
    setAuthError(null);
    try {
      const user = await loginWithGoogle();
      if (user) {
        setCurrentUser({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
        });
      }
      setActiveView('new');
    } catch (err: unknown) {
      // Never silently drop into demo mode. Record the message and re-throw so
      // the landing page can render the specific remediation UI (for example
      // the "authorize this domain in Firebase" banner).
      const message = (err as Error)?.message || 'Google sign-in failed. Please try again.';
      console.error('Google sign-in failed:', err);
      setAuthError(message);
      throw err;
    }
  };

  const handleDemoSignIn = () => {
    setAuthError(null);
    const demoUser = loginDemoUser();
    setCurrentUser({
      uid: demoUser.uid,
      email: demoUser.email,
      displayName: demoUser.displayName,
      photoURL: demoUser.photoURL,
    });
    setUserRoleState('superadmin');
    setActiveView('new');
  };

  const handleLogout = async () => {
    try {
      if (currentUser) {
        await logAuditEvent({
          eventType: 'auth_login',
          severity: 'info',
          actorId: currentUser.uid,
          actorEmail: currentUser.email || 'user@local',
          details: 'User logged out',
        });
      }
      await logoutUser();
      setCurrentUser(null);
      setSelectedEntry(null);
      setActiveView('new');
    } catch (err) {
      console.warn('Sign-out notice:', err);
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
      await logAuditEvent({
        eventType: 'permission_checked',
        severity: 'info',
        actorId: currentUser.uid,
        actorEmail: currentUser.email || 'user@local',
        details: `Deleted reflection entry ${entryToDelete}`,
      });
      if (selectedEntry?.id === entryToDelete) {
        setSelectedEntry(null);
        setActiveView('history');
      }
    } catch (err) {
      console.warn('Delete interaction notice:', err);
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
          userRole={userRole}
          activeView={activeView}
          onNewEntry={handleStartNewReflection}
          onViewInsights={() => {
            setSelectedEntry(null);
            setActiveView('insights');
          }}
          onViewHistory={() => {
            setSelectedEntry(null);
            setActiveView('history');
          }}
          onViewAdmin={() => {
            setSelectedEntry(null);
            setActiveView('admin');
          }}
          onOpenWebhooks={() => setIsWebhooksModalOpen(true)}
          onLogout={handleLogout}
          onOpenSecurityModal={() => setIsSecurityModalOpen(true)}
        />

        <main className="flex-1">
          {!currentUser ? (
            <LandingPage
              onSignIn={handleSignIn}
              onDemoSignIn={handleDemoSignIn}
              onOpenSecurityModal={() => setIsSecurityModalOpen(true)}
              authError={authError}
              onDismissAuthError={() => setAuthError(null)}
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
                  key={editorSessionKey}
                  userId={currentUser.uid}
                  userEmail={currentUser.email}
                  webhooks={webhooks}
                  onEntrySaved={handleEntrySaved}
                  onViewHistory={() => setActiveView('history')}
                  onStartNewReflection={handleStartNewReflection}
                />
              )}

              {activeView === 'insights' && (
                <InsightsView
                  userId={currentUser.uid}
                  entries={entries}
                  insights={insights}
                  actionItems={actionItems}
                  onNavigateToNew={handleStartNewReflection}
                  onNavigateToEntry={handleSelectEntry}
                />
              )}

              {activeView === 'history' && (
                <EntryHistory
                  entries={entries}
                  loading={loadingEntries}
                  onSelectEntry={handleSelectEntry}
                  onDeleteEntry={handleDeletePrompt}
                  onNewEntry={handleStartNewReflection}
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

              {activeView === 'admin' && (
                <AdminDashboard
                  currentUser={currentUser}
                  currentRole={userRole}
                  onRoleChange={(newRole) => setUserRoleState(newRole)}
                  localEntries={entries}
                  onClose={handleStartNewReflection}
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

        {/* External Notifications / Webhook Settings Modal */}
        {currentUser && (
          <WebhookSettingsModal
            isOpen={isWebhooksModalOpen}
            onClose={() => setIsWebhooksModalOpen(false)}
            userId={currentUser.uid}
            userEmail={currentUser.email}
            webhooks={webhooks}
          />
        )}

        {/* Security and Privacy Architecture Modal */}
        <SecurityModal
          isOpen={isSecurityModalOpen}
          onClose={() => setIsSecurityModalOpen(false)}
        />
      </div>
    </APIProvider>
  );
}


