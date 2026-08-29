import React, { useState } from 'react';
import {
  Sparkles,
  Shield,
  Lock,
  BrainCircuit,
  Compass,
  ArrowRight,
  CheckCircle2,
  Cpu,
  Database,
  KeyRound,
} from 'lucide-react';
import { motion } from 'motion/react';

interface LandingPageProps {
  onSignIn: () => Promise<void>;
  onOpenSecurityModal: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onSignIn,
  onOpenSecurityModal,
}) => {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const handleSignInClick = async () => {
    try {
      setIsAuthenticating(true);
      setAuthError(null);
      await onSignIn();
    } catch (err: unknown) {
      console.error('Sign in failed:', err);
      setAuthError(
        (err as Error)?.message || 'Authentication encountered an issue. Please retry.'
      );
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col justify-between py-12 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
      {/* Hero Section */}
      <div className="text-center max-w-3xl mx-auto pt-4 sm:pt-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="inline-flex items-center gap-2 bg-[#5A5A40]/10 border border-[#5A5A40]/25 text-[#5A5A40] px-3.5 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider mb-6"
        >
          <Sparkles className="w-3.5 h-3.5 text-[#5A5A40]" />
          <span>Private AI-Guided Mindful Journal</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-4xl sm:text-5xl lg:text-6xl font-serif font-bold text-[#3A3A35] tracking-tight leading-[1.15]"
        >
          Untangle your thoughts with <span className="text-[#5A5A40] italic">Gemini AI</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-6 text-lg sm:text-xl text-[#73726B] leading-relaxed font-sans max-w-2xl mx-auto"
        >
          Write your daily reflections, explore ideas through multi-turn dialogue, and receive crystal-clear summaries. Every entry is isolated and encrypted in Cloud Firestore.
        </motion.p>

        {/* Authentication Action */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <button
            id="landing-signin-btn"
            onClick={handleSignInClick}
            disabled={isAuthenticating}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 bg-[#3A3A35] text-[#F5F5F0] hover:bg-[#2D2D29] rounded-xl text-base font-semibold shadow-md shadow-[#3A3A35]/10 hover:shadow-lg transition-all disabled:opacity-75 disabled:cursor-not-allowed group cursor-pointer"
          >
            {isAuthenticating ? (
              <div className="w-5 h-5 border-2 border-[#E8E6DF] border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            )}
            <span>{isAuthenticating ? 'Signing you in...' : 'Sign In with Google'}</span>
            <ArrowRight className="w-4 h-4 text-[#D6D5CD] group-hover:translate-x-1 transition-transform" />
          </button>

          <button
            id="landing-architecture-btn"
            onClick={onOpenSecurityModal}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-4 bg-[#EFEEE7] hover:bg-[#E8E6DF] text-[#3A3A35] rounded-xl text-base font-medium border border-[#D6D5CD] transition-colors cursor-pointer"
          >
            <Shield className="w-4 h-4 text-[#5A5A40]" />
            <span>Architecture & Privacy</span>
          </button>
        </motion.div>

        {authError && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-sm max-w-md mx-auto">
            {authError}
          </div>
        )}
      </div>

      {/* Feature Pillar Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-16">
        <div className="bg-white p-6 rounded-2xl border border-[#D6D5CD] shadow-xs hover:border-[#5A5A40]/60 transition-colors">
          <div className="w-12 h-12 rounded-xl bg-[#5A5A40]/10 text-[#5A5A40] flex items-center justify-center mb-4">
            <BrainCircuit className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-serif font-semibold text-[#3A3A35] mb-2">
            Multi-Turn Socratic AI
          </h3>
          <p className="text-sm text-[#73726B] leading-relaxed">
            Converse deeply with Gemini 3.6 Flash. Choose between empathetic reflection, structured brainstorming, or actionable roadmap generation.
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-[#D6D5CD] shadow-xs hover:border-[#5A5A40]/60 transition-colors">
          <div className="w-12 h-12 rounded-xl bg-[#4B6350]/10 text-[#4B6350] flex items-center justify-center mb-4">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-serif font-semibold text-[#3A3A35] mb-2">
            Strict Firestore Isolation
          </h3>
          <p className="text-sm text-[#73726B] leading-relaxed">
            Every entry is protected with rules ensuring only you can read or write documents stored in your private database path.
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-[#D6D5CD] shadow-xs hover:border-[#5A5A40]/60 transition-colors">
          <div className="w-12 h-12 rounded-xl bg-[#485B66]/10 text-[#485B66] flex items-center justify-center mb-4">
            <Compass className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-serif font-semibold text-[#3A3A35] mb-2">
            Automated Executive Insights
          </h3>
          <p className="text-sm text-[#73726B] leading-relaxed">
            Every reflection automatically extracts concise summaries, high-value takeaway bullet points, and categorized thematic tags.
          </p>
        </div>
      </div>

      {/* Trust & Architecture Banner */}
      <div className="bg-[#3A3A35] text-[#E8E6DF] rounded-2xl p-6 sm:p-8 border border-[#484842]">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <h4 className="text-[#F5F5F0] font-serif text-lg font-semibold mb-1">
              Zero-Password Federated Architecture
            </h4>
            <p className="text-xs text-[#B5B4AC] max-w-xl">
              We never collect or store passwords. User identity is mediated directly through Google Identity Services and Firebase Authentication.
            </p>
          </div>
          <div className="flex flex-wrap gap-4 text-xs font-mono">
            <div className="flex items-center gap-1.5 bg-[#484842] px-3 py-1.5 rounded-lg border border-[#5A5A53]">
              <Cpu className="w-3.5 h-3.5 text-[#E8E6DF]" />
              <span>Gemini 3.6 Flash</span>
            </div>
            <div className="flex items-center gap-1.5 bg-[#484842] px-3 py-1.5 rounded-lg border border-[#5A5A53]">
              <Database className="w-3.5 h-3.5 text-[#9AC29F]" />
              <span>Cloud Firestore</span>
            </div>
            <div className="flex items-center gap-1.5 bg-[#484842] px-3 py-1.5 rounded-lg border border-[#5A5A53]">
              <KeyRound className="w-3.5 h-3.5 text-[#9CB6C4]" />
              <span>Secret Manager</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
