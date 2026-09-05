import React, { useState, useEffect } from 'react';
import {
  X,
  Mail,
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  Sparkles,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  ShieldCheck,
  UserCheck,
  MailCheck,
  Send,
  LogIn,
} from 'lucide-react';
import { motion } from 'motion/react';
import {
  registerWithEmailPassword,
  loginWithEmailPassword,
  resetPasswordWithEmail,
  sendAccountVerificationEmail,
} from '../firebase';
import { User } from 'firebase/auth';

export type AuthModalMode = 'register' | 'signin' | 'forgot_password' | 'email_confirmation';

interface AuthModalProps {
  isOpen: boolean;
  initialMode?: AuthModalMode;
  onClose: () => void;
  onSuccess: (user: User) => void;
  onGoogleSignIn: () => Promise<void>;
  onDemoSignIn?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialMode = 'register',
  onClose,
  onSuccess,
  onGoogleSignIn,
  onDemoSignIn,
}) => {
  const [mode, setMode] = useState<AuthModalMode>(initialMode);

  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null);
  const [isAlreadyRegistered, setIsAlreadyRegistered] = useState(false);
  const [registeredUser, setRegisteredUser] = useState<User | null>(null);
  const [resendStatus, setResendStatus] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);

  // Sync mode when initialMode changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setErrorMessage(null);
      setResetSuccessMessage(null);
      setIsAlreadyRegistered(false);
      setRegisteredUser(null);
      setResendStatus(null);
      setIsResending(false);
      setName('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setIsLoading(false);
      setIsGoogleLoading(false);
    }
  }, [isOpen, initialMode]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsAlreadyRegistered(false);

    const cleanName = name.trim();
    const cleanEmail = email.trim();

    if (!cleanName) {
      setErrorMessage('Please enter your full name or nickname.');
      return;
    }
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('Password must contain at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please verify your confirmation password.');
      return;
    }

    try {
      setIsLoading(true);
      const user = await registerWithEmailPassword(cleanEmail, password, cleanName);
      setRegisteredUser(user);
      setResendStatus(null);
      setMode('email_confirmation');
    } catch (err: any) {
      console.error('[AuthModal] Registration error:', err);
      const isAlready =
        Boolean(err?.isAlreadyRegistered) ||
        err?.code === 'auth/email-already-in-use' ||
        (typeof err?.message === 'string' &&
          (err.message.toLowerCase().includes('already registered') ||
            err.message.toLowerCase().includes('already in use') ||
            err.message.toLowerCase().includes('already exists')));

      if (isAlready) {
        setIsAlreadyRegistered(true);
        setErrorMessage(
          err?.message || `This email address (${cleanEmail}) is already registered in MindScribe.`
        );
      } else {
        setIsAlreadyRegistered(false);
        setErrorMessage(err?.message || 'Failed to create account. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    try {
      setIsResending(true);
      setResendStatus(null);
      const res = await sendAccountVerificationEmail(registeredUser);
      setResendStatus(res.message || 'Confirmation email dispatched! Check your inbox.');
    } catch (err: any) {
      setResendStatus(err?.message || 'Could not resend email right now. Please check your inbox or try again shortly.');
    } finally {
      setIsResending(false);
    }
  };

  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsAlreadyRegistered(false);

    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMessage('Please enter your email address.');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    try {
      setIsLoading(true);
      const user = await loginWithEmailPassword(cleanEmail, password);
      onSuccess(user);
      onClose();
    } catch (err: any) {
      console.error('[AuthModal] Sign in error:', err);
      setErrorMessage(err?.message || 'Failed to sign in. Please verify your email and password.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setResetSuccessMessage(null);
    setIsAlreadyRegistered(false);

    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    try {
      setIsLoading(true);
      await resetPasswordWithEmail(cleanEmail);
      setResetSuccessMessage(
        `If an account exists for ${cleanEmail}, a password recovery link has been dispatched.`
      );
    } catch (err: any) {
      console.error('[AuthModal] Password reset error:', err);
      setErrorMessage(err?.message || 'Could not send reset link. Please check the email address.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleClick = async () => {
    setErrorMessage(null);
    setIsAlreadyRegistered(false);
    try {
      setIsGoogleLoading(true);
      await onGoogleSignIn();
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Google sign-in could not be completed.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleGuestClick = () => {
    if (onDemoSignIn) {
      onDemoSignIn();
      onClose();
    }
  };

  return (
    <div
      id="auth-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/50 backdrop-blur-xs overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        id="auth-modal-container"
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2 }}
        className="relative bg-[#FAF9F5] text-[#3A3A35] rounded-3xl max-w-md w-full max-h-[min(90vh,760px)] shadow-2xl border border-[#D6D5CD] flex flex-col my-auto overflow-hidden"
      >
        {/* Modal Header */}
        <div className="px-5 sm:px-6 pt-5 pb-3.5 bg-white border-b border-[#E8E6DF] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#5A5A40]/15 text-[#5A5A40] flex items-center justify-center border border-[#5A5A40]/30">
              {mode === 'email_confirmation' ? (
                <MailCheck className="w-4.5 h-4.5 text-[#4D7C4F]" />
              ) : (
                <Sparkles className="w-4.5 h-4.5" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-serif font-bold text-[#3A3A35] leading-tight">
                {mode === 'register' && 'Create MindScribe Account'}
                {mode === 'signin' && 'Welcome Back'}
                {mode === 'forgot_password' && 'Reset Your Password'}
                {mode === 'email_confirmation' && 'Check Your Email'}
              </h2>
              <p className="text-[11px] text-[#73726B] font-sans">
                {mode === 'register' && 'Register your private journal workspace'}
                {mode === 'signin' && 'Sign in to access your private reflections'}
                {mode === 'forgot_password' && 'Enter your email to receive recovery instructions'}
                {mode === 'email_confirmation' && 'Confirmation email has been dispatched'}
              </p>
            </div>
          </div>

          <button
            id="auth-modal-close-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8C8B82] hover:text-[#3A3A35] hover:bg-[#F5F5F0] transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher (Register vs Sign In) */}
        {mode !== 'forgot_password' && mode !== 'email_confirmation' && (
          <div className="px-5 sm:px-6 pt-3 pb-0 shrink-0 bg-[#FAF9F5]">
            <div className="grid grid-cols-2 p-1 bg-[#EFEEE7] rounded-xl border border-[#D6D5CD]">
              <button
                id="auth-tab-register-btn"
                type="button"
                onClick={() => {
                  setMode('register');
                  setErrorMessage(null);
                  setIsAlreadyRegistered(false);
                }}
                className={`py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  mode === 'register'
                    ? 'bg-white text-[#3A3A35] shadow-xs'
                    : 'text-[#73726B] hover:text-[#3A3A35]'
                }`}
              >
                Register
              </button>
              <button
                id="auth-tab-signin-btn"
                type="button"
                onClick={() => {
                  setMode('signin');
                  setErrorMessage(null);
                  setIsAlreadyRegistered(false);
                }}
                className={`py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  mode === 'signin'
                    ? 'bg-white text-[#3A3A35] shadow-xs'
                    : 'text-[#73726B] hover:text-[#3A3A35]'
                }`}
              >
                Sign In
              </button>
            </div>
          </div>
        )}

        {/* Form Body */}
        <div className="p-5 sm:p-6 flex-1 min-h-0 overflow-y-auto overscroll-contain">
          {/* Already Registered Comment Banner */}
          {isAlreadyRegistered && mode === 'register' && (
            <div
              id="already-registered-comment-box"
              className="mb-4.5 p-3.5 bg-amber-50/95 border border-amber-300 text-[#3D3A2A] rounded-2xl text-xs space-y-2.5 shadow-2xs"
            >
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4.5 h-4.5 text-amber-700 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-amber-900 text-xs">
                    Account Already Registered
                  </p>
                  <p className="text-[11px] text-amber-800 mt-1 leading-relaxed">
                    An account with <strong className="font-semibold text-amber-950">{email}</strong> already exists in MindScribe. You do not need to register again.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-amber-200/80">
                <button
                  id="already-registered-signin-action"
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    setErrorMessage(null);
                    setIsAlreadyRegistered(false);
                  }}
                  className="px-3 py-1.5 bg-[#5A5A40] text-white hover:bg-[#4A4A32] rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Sign In with this Account</span>
                </button>
                <button
                  id="already-registered-forgot-action"
                  type="button"
                  onClick={() => {
                    setMode('forgot_password');
                    setErrorMessage(null);
                    setIsAlreadyRegistered(false);
                  }}
                  className="px-2.5 py-1.5 text-xs text-[#5A5A40] hover:text-[#3A3A28] font-medium hover:underline cursor-pointer"
                >
                  Forgot Password?
                </button>
              </div>
            </div>
          )}

          {/* Error Banner (for generic registration, sign in, or reset errors) */}
          {!isAlreadyRegistered && errorMessage && (
            <div
              id="auth-error-banner"
              className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {/* Success Banner (for Password Reset) */}
          {resetSuccessMessage && (
            <div
              id="auth-success-banner"
              className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-start gap-2"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{resetSuccessMessage}</div>
            </div>
          )}

          {/* 1. Registration Form */}
          {mode === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div>
                <label
                  htmlFor="register-name-input"
                  className="block text-xs font-medium text-[#4D4D47] mb-1"
                >
                  Full Name / Display Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#8C8B82]">
                    <UserIcon className="w-4 h-4" />
                  </div>
                  <input
                    id="register-name-input"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (isAlreadyRegistered) setIsAlreadyRegistered(false);
                    }}
                    placeholder="e.g. Alex Miller"
                    className="w-full pl-9.5 pr-3 py-2.5 bg-white border border-[#D6D5CD] rounded-xl text-sm text-[#3A3A35] placeholder-[#9E9D95] focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/30 focus:border-[#5A5A40] transition-all"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="register-email-input"
                  className="block text-xs font-medium text-[#4D4D47] mb-1"
                >
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#8C8B82]">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="register-email-input"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (isAlreadyRegistered) setIsAlreadyRegistered(false);
                    }}
                    placeholder="you@domain.com"
                    className="w-full pl-9.5 pr-3 py-2.5 bg-white border border-[#D6D5CD] rounded-xl text-sm text-[#3A3A35] placeholder-[#9E9D95] focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/30 focus:border-[#5A5A40] transition-all"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="register-password-input"
                  className="block text-xs font-medium text-[#4D4D47] mb-1"
                >
                  Password (min. 6 characters)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#8C8B82]">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="register-password-input"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9.5 pr-10 py-2.5 bg-white border border-[#D6D5CD] rounded-xl text-sm text-[#3A3A35] placeholder-[#9E9D95] focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/30 focus:border-[#5A5A40] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#8C8B82] hover:text-[#3A3A35] cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="register-confirm-password-input"
                  className="block text-xs font-medium text-[#4D4D47] mb-1"
                >
                  Confirm Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#8C8B82]">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    id="register-confirm-password-input"
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9.5 pr-10 py-2.5 bg-white border border-[#D6D5CD] rounded-xl text-sm text-[#3A3A35] placeholder-[#9E9D95] focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/30 focus:border-[#5A5A40] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((p) => !p)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#8C8B82] hover:text-[#3A3A35] cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  id="register-submit-btn"
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-4 bg-[#5A5A40] hover:bg-[#4A4A32] text-white rounded-xl text-sm font-semibold shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Create Account &amp; Send Verification</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

              <div className="text-center text-[11px] text-[#73726B] pt-1">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    setErrorMessage(null);
                    setIsAlreadyRegistered(false);
                  }}
                  className="text-[#5A5A40] font-semibold hover:underline cursor-pointer"
                >
                  Sign in here
                </button>
              </div>
            </form>
          )}

          {/* 2. Sign In Form */}
          {mode === 'signin' && (
            <form onSubmit={handleSignInSubmit} className="space-y-3.5">
              <div>
                <label
                  htmlFor="login-email-input"
                  className="block text-xs font-medium text-[#4D4D47] mb-1"
                >
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#8C8B82]">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="login-email-input"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@domain.com"
                    className="w-full pl-9.5 pr-3 py-2.5 bg-white border border-[#D6D5CD] rounded-xl text-sm text-[#3A3A35] placeholder-[#9E9D95] focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/30 focus:border-[#5A5A40] transition-all"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="login-password-input"
                    className="block text-xs font-medium text-[#4D4D47]"
                  >
                    Password
                  </label>
                  <button
                    id="login-forgot-password-link"
                    type="button"
                    onClick={() => {
                      setMode('forgot_password');
                      setErrorMessage(null);
                      setResetSuccessMessage(null);
                      setIsAlreadyRegistered(false);
                    }}
                    className="text-[11px] text-[#5A5A40] hover:underline cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#8C8B82]">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="login-password-input"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9.5 pr-10 py-2.5 bg-white border border-[#D6D5CD] rounded-xl text-sm text-[#3A3A35] placeholder-[#9E9D95] focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/30 focus:border-[#5A5A40] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#8C8B82] hover:text-[#3A3A35] cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  id="login-submit-btn"
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-4 bg-[#3A3A35] hover:bg-[#2D2D29] text-[#F5F5F0] rounded-xl text-sm font-semibold shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Sign In</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

              <div className="text-center text-[11px] text-[#73726B] pt-1">
                Don't have an account yet?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setErrorMessage(null);
                    setIsAlreadyRegistered(false);
                  }}
                  className="text-[#5A5A40] font-semibold hover:underline cursor-pointer"
                >
                  Register here
                </button>
              </div>
            </form>
          )}

          {/* 3. Forgot Password Form */}
          {mode === 'forgot_password' && (
            <form onSubmit={handleForgotPasswordSubmit} className="space-y-3.5">
              <div>
                <label
                  htmlFor="forgot-password-email-input"
                  className="block text-xs font-medium text-[#4D4D47] mb-1"
                >
                  Account Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#8C8B82]">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="forgot-password-email-input"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@domain.com"
                    className="w-full pl-9.5 pr-3 py-2.5 bg-white border border-[#D6D5CD] rounded-xl text-sm text-[#3A3A35] placeholder-[#9E9D95] focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/30 focus:border-[#5A5A40] transition-all"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  id="forgot-password-submit-btn"
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-4 bg-[#3A3A35] hover:bg-[#2D2D29] text-[#F5F5F0] rounded-xl text-sm font-semibold shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Send Recovery Instructions</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

              <div className="text-center text-[11px] text-[#73726B] pt-1">
                Remember your password?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    setErrorMessage(null);
                    setResetSuccessMessage(null);
                    setIsAlreadyRegistered(false);
                  }}
                  className="text-[#5A5A40] font-semibold hover:underline cursor-pointer"
                >
                  Back to Sign In
                </button>
              </div>
            </form>
          )}

          {/* 4. Confirmation Email Sent Step */}
          {mode === 'email_confirmation' && (
            <div className="space-y-4 py-2 text-center animate-in fade-in">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-[#9AC29F]/20 text-[#3B663F] flex items-center justify-center border border-[#9AC29F]/45 shadow-xs">
                <MailCheck className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-base font-serif font-bold text-[#3A3A35]">
                  Confirmation Email Sent!
                </h3>
                <p className="text-xs text-[#6B6A63] mt-1.5 max-w-xs mx-auto leading-relaxed">
                  We've sent an account confirmation email to:
                </p>
                <div className="inline-block mt-1 px-3 py-1 bg-[#EFEEE7] text-[#3A3A35] rounded-lg font-mono text-xs font-semibold border border-[#D6D5CD]">
                  {registeredUser?.email || email}
                </div>
              </div>

              <div className="p-3.5 bg-[#FAF8F2] border border-[#E3E0D5] rounded-xl text-left text-xs text-[#5C5B54] space-y-1.5">
                <div className="flex items-center gap-1.5 font-semibold text-[#3A3A35]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#5A5A40]" />
                  <span>Next Steps to Verify:</span>
                </div>
                <p className="text-[11px] leading-relaxed pl-5 text-[#636259]">
                  1. Check your email inbox for the verification message from MindScribe.<br />
                  2. Click the confirmation link to verify your email.<br />
                  3. If you don't see it within a minute, check your Spam or Promotions folder.
                </p>
              </div>

              {resendStatus && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>{resendStatus}</span>
                </div>
              )}

              <div className="space-y-2 pt-2">
                <button
                  id="confirmation-continue-btn"
                  type="button"
                  onClick={() => {
                    if (registeredUser) {
                      onSuccess(registeredUser);
                    }
                    onClose();
                  }}
                  className="w-full py-3 px-4 bg-[#5A5A40] hover:bg-[#4A4A32] text-white rounded-xl text-xs font-semibold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Continue to My Journal</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  id="confirmation-resend-btn"
                  type="button"
                  disabled={isResending}
                  onClick={handleResendConfirmation}
                  className="w-full py-2 px-3 text-xs text-[#5A5A40] hover:text-[#3A3A28] font-medium hover:bg-[#EFEEE7] rounded-lg transition-colors cursor-pointer disabled:opacity-60 flex items-center justify-center gap-1.5"
                >
                  {isResending ? (
                    <>
                      <div className="w-3 h-3 border-2 border-[#5A5A40] border-t-transparent rounded-full animate-spin" />
                      <span>Resending confirmation email...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Resend Confirmation Email</span>
                    </>
                  )}
                </button>
              </div>

              <div className="pt-2 text-[11px] text-[#73726B]">
                Need to use another address?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setErrorMessage(null);
                    setIsAlreadyRegistered(false);
                  }}
                  className="text-[#5A5A40] font-semibold hover:underline cursor-pointer"
                >
                  Register again
                </button>
              </div>
            </div>
          )}

          {/* Social / Alternative Divider (only if not in confirmation step) */}
          {mode !== 'email_confirmation' && (
            <>
              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#D6D5CD]" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-2.5 bg-[#FAF9F5] text-[#8C8B82] font-sans">
                    or continue with
                  </span>
                </div>
              </div>

              {/* Alternative Auth Buttons */}
              <div className="space-y-2">
                <button
                  id="modal-google-signin-btn"
                  type="button"
                  onClick={handleGoogleClick}
                  disabled={isGoogleLoading || isLoading}
                  className="w-full py-2.5 px-4 bg-white hover:bg-[#F5F5F0] text-[#3A3A35] border border-[#D6D5CD] rounded-xl text-xs font-semibold shadow-2xs transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-70"
                >
                  {isGoogleLoading ? (
                    <div className="w-4 h-4 border-2 border-[#5A5A40] border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
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
                  <span>Continue with Google</span>
                </button>

                {onDemoSignIn && (
                  <button
                    id="modal-demo-signin-btn"
                    type="button"
                    onClick={handleGuestClick}
                    className="w-full py-2.5 px-4 bg-[#EFEEE7] hover:bg-[#E8E6DF] text-[#41412A] border border-[#D6D5CD] rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <UserCheck className="w-4 h-4 text-[#5A5A40]" />
                    <span>Explore as Guest (Instant Demo)</span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Security & Privacy Footer */}
        <div className="px-5 sm:px-6 py-2.5 bg-[#F0EFEA] border-t border-[#E8E6DF] text-[11px] text-[#73726B] flex items-center justify-center gap-1.5 font-sans shrink-0">
          <ShieldCheck className="w-3.5 h-3.5 text-[#5A5A40]" />
          <span>All reflections are privately encrypted and isolated to your account</span>
        </div>
      </motion.div>
    </div>
  );
};
