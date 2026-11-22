import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Clock,
  Mail,
  RefreshCw,
  ShieldCheck,
  User,
  UserCheck,
} from 'lucide-react';
import type { InvestigatorUser } from '../types/clinical';
import { validateNormalLoginInput } from '../utils/accessControl';

export type LoginMode = 'normal' | 'investigator';

interface LoginGateProps {
  onGoogleSignIn: (mode: LoginMode) => void;
  onNormalLogin: (params: { displayName: string; email: string }) => void;
  onRetryPendingCheck: () => void;
  loading: boolean;
  error: string | null;
  pendingApprovalUser: {
    email: string;
    displayName: string;
    status: string;
    role?: InvestigatorUser['role'];
  } | null;
  onLogout: () => void;
}

export const LOGIN_MODE_STORAGE_KEY = 'desai_t2dm_login_mode_v1';

function loadSavedLoginMode(): LoginMode {
  try {
    const saved = sessionStorage.getItem(LOGIN_MODE_STORAGE_KEY);
    if (saved === 'investigator' || saved === 'normal') return saved;
  } catch {
    // ignore storage errors
  }
  return 'normal';
}

export const LoginGate: React.FC<LoginGateProps> = ({
  onGoogleSignIn,
  onNormalLogin,
  onRetryPendingCheck,
  loading,
  error,
  pendingApprovalUser,
  onLogout,
}) => {
  const [loginMode, setLoginMode] = useState<LoginMode>(loadSavedLoginMode);
  const [normalName, setNormalName] = useState('');
  const [normalEmail, setNormalEmail] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const handleSelectMode = (mode: LoginMode) => {
    setLoginMode(mode);
    setFormError(null);
    try {
      sessionStorage.setItem(LOGIN_MODE_STORAGE_KEY, mode);
    } catch {
      // ignore
    }
  };

  const handleNormalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validationErr = validateNormalLoginInput({
      displayName: normalName,
      email: normalEmail,
    });
    if (validationErr) {
      setFormError(validationErr);
      return;
    }
    setFormError(null);
    onNormalLogin({
      displayName: normalName.trim(),
      email: normalEmail.trim().toLowerCase(),
    });
  };

  const activeError = formError || error;
  const isRejected = pendingApprovalUser?.status === 'rejected';

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#EEF5F1] bg-[linear-gradient(to_right,rgba(4,120,87,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(4,120,87,0.04)_1px,transparent_1px)] [background-size:36px_36px] flex items-center justify-center p-4 sm:p-6 lg:p-10">
      {/* Subtle Clinical Ambient Light */}
      <div
        className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_rgba(4,120,87,0.08),_transparent_58%)]"
        aria-hidden="true"
      />

      {/* Centered Clinical Research Portal Card */}
      <div className="login-card-enter relative z-10 max-w-5xl w-full grid grid-cols-1 lg:grid-cols-12 bg-white border border-[#D4E2DA] rounded-2xl overflow-hidden shadow-[0_24px_60px_-24px_rgba(5,59,43,0.18)]">
        {/* Left Clinical Brand & Telemetry Trace Stage */}
        <div className="lg:col-span-6 relative min-h-[240px] sm:min-h-[280px] lg:min-h-[540px] bg-gradient-to-br from-[#F7FBF9] via-[#FFFFFF] to-[#EBF5F0] border-b lg:border-b-0 lg:border-r border-[#E2ECE6] flex flex-col items-center justify-center p-8 sm:p-12 overflow-hidden">
          {/* Crisp Clinical Accent Rail */}
          <div
            className="login-rail-reveal hidden lg:block absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-[#047857] via-[#10B981] to-[#053B2B]"
            aria-hidden="true"
          />
          <div
            className="lg:hidden absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#047857] via-[#10B981] to-[#053B2B]"
            aria-hidden="true"
          />

          {/* Subtle Drifting Medical Graph Paper Grid */}
          <div
            className="login-grid-drift absolute -inset-8 pointer-events-none bg-[linear-gradient(to_right,rgba(4,120,87,0.038)_1px,transparent_1px),linear-gradient(to_bottom,rgba(4,120,87,0.038)_1px,transparent_1px)] [background-size:24px_24px]"
            aria-hidden="true"
          />

          {/* Soft Clinical Optical Sheen */}
          <div className="login-stage-sheen" aria-hidden="true" />

          {/* Background-Free Animated Clinic Logo */}
          <div className="relative z-10 flex flex-col items-center w-full max-w-sm">
            <img
              src="/assets/desai-logo-transparent.png"
              alt="Desai Diabetes & Endocrine Clinic - Hormones to Harmony"
              referrerPolicy="no-referrer"
              className="clinic-logo-animated h-24 sm:h-32 lg:h-36 w-auto max-w-full object-contain select-none"
            />

            {/* Clean Clinical Pulse & Metabolic Waveform Trace */}
            <svg
              viewBox="0 0 320 48"
              className="w-56 sm:w-72 h-10 mt-6 text-[#047857]"
              aria-hidden="true"
            >
              <path
                d="M0 30 C44 30, 68 18, 112 20 C156 22, 180 36, 224 30 C268 24, 294 16, 320 22"
                fill="none"
                stroke="rgba(4,120,87,0.22)"
                strokeWidth="1.25"
                strokeLinecap="round"
                className="clinical-glucose-wave"
              />
              <path
                d="M0 24 L88 24 L104 24 L114 14 L126 36 L138 6 L150 32 L160 24 L182 24 L192 18 L202 24 L320 24"
                fill="none"
                stroke="#D4E2DA"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M0 24 L88 24 L104 24 L114 14 L126 36 L138 6 L150 32 L160 24 L182 24 L192 18 L202 24 L320 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="clinical-ecg-trace"
              />
            </svg>
          </div>
        </div>

        {/* Right Role-Aware Sign-In Console */}
        <div className="lg:col-span-6 p-7 sm:p-10 lg:p-12 flex flex-col justify-center bg-white">
          {pendingApprovalUser ? (
            <div className="login-panel-switch space-y-5" role="status" aria-live="polite">
              <div
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold border ${
                  isRejected
                    ? 'text-rose-800 bg-rose-50 border-rose-200'
                    : 'text-amber-800 bg-amber-50 border-amber-200'
                }`}
              >
                {isRejected ? (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                ) : (
                  <Clock className="w-4 h-4 shrink-0" />
                )}
                <span>
                  {isRejected
                    ? 'Portal access has been revoked or denied'
                    : 'Permission Required — Awaiting Investigator Approval'}
                </span>
              </div>

              <div>
                <h2 className="font-display text-xl font-bold text-[#14201B]">
                  {pendingApprovalUser.displayName || pendingApprovalUser.email}
                </h2>
                <p className="text-xs font-mono text-[#4B6157] mt-0.5">
                  {pendingApprovalUser.email}
                </p>
                <p className="mt-3 text-sm text-[#4B6157] leading-relaxed">
                  {isRejected
                    ? 'Your login access request is currently denied or revoked. Contact a study investigator to enable your account.'
                    : 'Your approval request has been delivered to the study investigators. You will automatically enter the website once approved.'}
                </p>
                {!isRejected && (
                  <p className="mt-2 text-xs text-[#6B8076] flex items-center gap-1.5">
                    <RefreshCw className="w-3 h-3 animate-spin text-[#047857] shrink-0" />
                    <span>Checking automatically every few seconds for investigator approval...</span>
                  </p>
                )}
              </div>

              {activeError && (
                <div
                  role="alert"
                  className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{activeError}</span>
                </div>
              )}

              <div className="flex flex-wrap gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={onRetryPendingCheck}
                  disabled={loading}
                  className="cta-sheen-wrap flex-1 px-4 py-2.5 rounded-xl bg-[#047857] hover:bg-[#065F46] text-white text-xs font-semibold transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap shadow-sm disabled:opacity-60"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  <span>{loading ? 'Checking...' : 'Check Approval Status'}</span>
                </button>
                <button
                  type="button"
                  onClick={onLogout}
                  className="px-4 py-2.5 rounded-xl border border-[#DDE8E2] text-xs font-semibold text-[#4B6157] hover:bg-[#F6F9F7] transition-colors whitespace-nowrap shrink-0"
                >
                  Back to Sign In
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Heading */}
              <div className="login-stagger-1">
                <h2 className="font-display text-2xl font-bold text-[#14201B] tracking-tight text-balance">
                  Sign in to Study Portal
                </h2>
                <p className="mt-1.5 text-sm text-[#4B6157]">
                  Select your portal access level to continue.
                </p>
              </div>

              {/* Segmented Role Switcher */}
              <div
                className="login-stagger-2 grid grid-cols-2 p-1 bg-[#F2F6F4] border border-[#DDE8E2] rounded-xl gap-1"
                role="tablist"
                aria-label="Login access role"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={loginMode === 'normal'}
                  onClick={() => handleSelectMode('normal')}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-all whitespace-nowrap ${
                    loginMode === 'normal'
                      ? 'bg-white text-[#053B2B] shadow-sm border border-[#D4E2DA]'
                      : 'text-[#4B6157] hover:text-[#14201B]'
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5 shrink-0" />
                  <span>User Login</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={loginMode === 'investigator'}
                  onClick={() => handleSelectMode('investigator')}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-all whitespace-nowrap ${
                    loginMode === 'investigator'
                      ? 'bg-[#053B2B] text-white shadow-sm'
                      : 'text-[#4B6157] hover:text-[#14201B]'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                  <span>Investigator Login</span>
                </button>
              </div>

              {activeError && (
                <div
                  role="alert"
                  className="login-panel-switch p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{activeError}</span>
                </div>
              )}

              {loginMode === 'normal' ? (
                <form
                  key="normal-form"
                  onSubmit={handleNormalSubmit}
                  className="login-panel-switch space-y-4"
                  autoComplete="off"
                  noValidate
                >
                  <div className="login-stagger-3">
                    <label
                      htmlFor="normal-full-name"
                      className="block text-xs font-semibold text-[#14201B] mb-1.5"
                    >
                      Full Name
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-[#6B8076] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="normal-full-name"
                        type="text"
                        value={normalName}
                        onChange={(e) => setNormalName(e.target.value)}
                        autoComplete="off"
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#D4E2DA] bg-[#FAFDFB] text-sm text-[#14201B] focus:outline-none focus:border-[#047857] focus:ring-4 focus:ring-[#047857]/10 focus:bg-white focus:shadow-[0_6px_18px_-10px_rgba(4,120,87,0.35)] transition-all"
                      />
                    </div>
                  </div>

                  <div className="login-stagger-4">
                    <label
                      htmlFor="normal-email"
                      className="block text-xs font-semibold text-[#14201B] mb-1.5"
                    >
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-[#6B8076] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="normal-email"
                        type="email"
                        value={normalEmail}
                        onChange={(e) => setNormalEmail(e.target.value)}
                        autoComplete="off"
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#D4E2DA] bg-[#FAFDFB] text-sm text-[#14201B] focus:outline-none focus:border-[#047857] focus:ring-4 focus:ring-[#047857]/10 focus:bg-white focus:shadow-[0_6px_18px_-10px_rgba(4,120,87,0.35)] transition-all"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="login-stagger-5 cta-sheen-wrap group w-full px-4 py-2.5 rounded-xl bg-[#047857] hover:bg-[#065F46] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap shadow-sm hover:shadow-[0_8px_20px_-8px_rgba(4,120,87,0.5)]"
                  >
                    <span>Enter Study Portal</span>
                    <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                  </button>

                  <div className="login-stagger-6 space-y-4">
                    <div className="relative flex items-center py-1">
                      <div className="flex-grow border-t border-[#E5EEE9]" />
                      <span className="mx-3 text-[11px] font-medium text-[#6B8076]">
                        or quick sign-in
                      </span>
                      <div className="flex-grow border-t border-[#E5EEE9]" />
                    </div>

                    <button
                      type="button"
                      onClick={() => onGoogleSignIn('normal')}
                      disabled={loading}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#D4E2DA] bg-white hover:bg-[#F6F9F7] text-xs font-semibold text-[#14201B] inline-flex items-center justify-center gap-2.5 transition-all hover:border-[#BFD5C9] whitespace-nowrap"
                    >
                      <svg
                        version="1.1"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 48 48"
                        className="w-4 h-4 shrink-0"
                        aria-hidden="true"
                      >
                        <path
                          fill="#EA4335"
                          d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                        />
                        <path
                          fill="#4285F4"
                          d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                        />
                        <path
                          fill="#34A853"
                          d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                        />
                      </svg>
                      <span>Continue with Google</span>
                    </button>
                  </div>
                </form>
              ) : (
                <div key="investigator-panel" className="login-panel-switch space-y-3.5">
                  <button
                    type="button"
                    onClick={() => onGoogleSignIn('investigator')}
                    disabled={loading}
                    className="gsi-material-button w-full justify-center"
                  >
                    <div className="gsi-material-button-content-wrapper">
                      <div className="gsi-material-button-icon">
                        <svg
                          version="1.1"
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 48 48"
                          style={{ display: 'block' }}
                        >
                          <path
                            fill="#EA4335"
                            d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                          />
                          <path
                            fill="#4285F4"
                            d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                          />
                          <path
                            fill="#34A853"
                            d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                          />
                          <path fill="none" d="M0 0h48v48H0z" />
                        </svg>
                      </div>
                      <span className="gsi-material-button-contents">
                        {loading ? 'Signing in...' : 'Sign in with Google (Investigator)'}
                      </span>
                    </div>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
