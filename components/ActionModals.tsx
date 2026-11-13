'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Lock,
  Sparkles,
  CheckCircle2,
  Bell,
  Pin,
  Target,
  ThumbsUp,
  ThumbsDown,
  Download,
  Trash2,
  CreditCard,
  ShieldCheck,
  Sun,
  Moon,
  ExternalLink,
  AlertTriangle,
  User,
} from 'lucide-react';
import { supabase, getAuthHeaders } from '@/lib/supabase';
import { DEVELOPMENT_AREAS } from '@/lib/types';

export type ActiveModalType =
  | null
  | 'paywall'
  | 'auth'
  | 'feedback'
  | 'reminder'
  | 'insight'
  | 'goal'
  | 'settings';

interface ActionModalsProps {
  activeModal: ActiveModalType;
  onClose: () => void;
  // Användar- & auth-tillstånd
  isGuest: boolean;
  isPremium: boolean;
  userEmail: string;
  displayName: string;
  onAuthSuccess: () => Promise<void>;
  onSignOut: () => Promise<void>;
  // Tema
  darkMode: boolean;
  onToggleDarkMode: () => void;
  // Kontext från valt FALK-meddelande (vid klick på svarsikoner)
  selectedMessageContent?: string;
  selectedMessageId?: string;
  currentSessionId?: string | null;
  feedbackSentiment?: 'positive' | 'negative';
  paywallReason?: string;
  // Callbacks för att uppdatera listor efter sparande
  onDataSaved?: () => Promise<void>;
}

export default function ActionModals({
  activeModal,
  onClose,
  isGuest,
  isPremium,
  userEmail,
  displayName,
  onAuthSuccess,
  onSignOut,
  darkMode,
  onToggleDarkMode,
  selectedMessageContent = '',
  selectedMessageId = '',
  currentSessionId = null,
  feedbackSentiment = 'positive',
  paywallReason = 'Lås upp hela FALK med ett Premium-medlemskap.',
  onDataSaved,
}: ActionModalsProps) {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:5001';

  // Gemensam status
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Auth / Paywall state
  const [authMode, setAuthMode] = useState<'login' | 'register'>('register');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [isAdultConfirmed, setIsAdultConfirmed] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showLegalDoc, setShowLegalDoc] = useState<'terms' | 'privacy' | null>(null);

  // Feedback state
  const [feedbackComment, setFeedbackComment] = useState('');

  // Reminder state
  const [reminderContent, setReminderContent] = useState('');
  const [reminderFrequency, setReminderFrequency] = useState<'once' | 'daily' | 'weekly' | 'monthly'>('once');
  const [reminderDateTime, setReminderDateTime] = useState('');
  const [alsoSaveAsInsight, setAlsoSaveAsInsight] = useState(false);

  // Insight state
  const [insightContent, setInsightContent] = useState('');
  const [alsoSetReminder, setAlsoSetReminder] = useState(false);
  const [insightReminderDateTime, setInsightReminderDateTime] = useState('');

  // Goal state
  const [goalTitle, setGoalTitle] = useState('');
  const [goalArea, setGoalArea] = useState<string>(DEVELOPMENT_AREAS[4]?.name || 'Personlig utveckling');
  const [goalTargetDate, setGoalTargetDate] = useState('');

  // Settings / GDPR state
  const [settingsName, setSettingsName] = useState(displayName);
  const [settingsEmail, setSettingsEmail] = useState(userEmail);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Synka fält när modal öppnas
  useEffect(() => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(false);

    if (activeModal === 'paywall' || activeModal === 'auth') {
      setAuthMode(activeModal === 'auth' ? 'login' : 'register');
      setShowLegalDoc(null);
    }
    if (activeModal === 'feedback') {
      setFeedbackComment('');
    }
    if (activeModal === 'reminder') {
      setReminderContent(selectedMessageContent.slice(0, 500));
      setReminderFrequency('once');
      setAlsoSaveAsInsight(false);
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      setReminderDateTime(tomorrow.toISOString().slice(0, 16));
    }
    if (activeModal === 'insight') {
      setInsightContent(selectedMessageContent.slice(0, 800));
      setAlsoSetReminder(false);
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      setInsightReminderDateTime(tomorrow.toISOString().slice(0, 16));
    }
    if (activeModal === 'goal') {
      const firstSentence = selectedMessageContent.split(/[.!?\n]/)[0]?.trim() || '';
      setGoalTitle(firstSentence.slice(0, 120));
      setGoalTargetDate('');
    }
    if (activeModal === 'settings') {
      setSettingsName(displayName);
      setSettingsEmail(userEmail);
      setShowDeleteConfirm(false);
      setDeleteConfirmText('');
      setShowLegalDoc(null);
    }
  }, [activeModal, selectedMessageContent, displayName, userEmail]);

  if (!activeModal) return null;

  const cardBg = darkMode
    ? 'bg-[#1E241D] text-[#E8DCC4] border-[#4E5C4B]'
    : 'bg-[#FBF8F3] text-[#2C332B] border-[#D8CCB8]';
  const inputBg = darkMode
    ? 'bg-[#141813] border-[#4E5C4B] text-[#E8DCC4] placeholder-[#8A9488]'
    : 'bg-white border-[#D8CCB8] text-[#2C332B] placeholder-[#8C8272]';
  const subText = darkMode ? 'text-[#A8BFA1]' : 'text-[#5C5346]';

  // --- HANDLERS ---

  const startStripeCheckout = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${backendUrl}/api/checkout`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          success_url: `${window.location.origin}/?checkout=success`,
          cancel_url: `${window.location.origin}/?checkout=cancel`,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error || 'Kunde inte starta betalningssession.');
      }
      window.location.href = data.url;
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Ett fel uppstod vid betalning.');
      setLoading(false);
    }
  };

  const openBillingPortal = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${backendUrl}/api/billing/portal`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          return_url: window.location.origin,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error || 'Kunde inte öppna kundportalen.');
      }
      window.location.href = data.url;
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Kunde inte öppna betalningshantering.');
      setLoading(false);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!emailInput.trim() || !passwordInput.trim()) {
      setErrorMsg('Fyll i både e-postadress och lösenord.');
      return;
    }

    if (authMode === 'register') {
      if (!isAdultConfirmed) {
        setErrorMsg('Du måste bekräfta att du är minst 18 år för att skapa konto.');
        return;
      }
      if (!termsAccepted) {
        setErrorMsg('Du måste godkänna Användarvillkoren och Integritetspolicyn.');
        return;
      }
    }

    setLoading(true);
    try {
      if (authMode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email: emailInput.trim(),
          password: passwordInput,
        });
        if (error) throw error;
        await onAuthSuccess();
        setSuccessMsg('Inloggad!');
        setTimeout(() => onClose(), 500);
      } else {
        const nowIso = new Date().toISOString();
        const { data: signUpData, error } = await supabase.auth.signUp({
          email: emailInput.trim(),
          password: passwordInput,
          options: {
            data: {
              display_name: nameInput.trim() || emailInput.split('@')[0],
              is_adult_confirmed: true,
              terms_accepted_at: nowIso,
              privacy_accepted_at: nowIso,
            },
          },
        });
        if (error) throw error;

        if (signUpData.user && signUpData.session) {
          await supabase.from('user_profiles').upsert(
            {
              user_id: signUpData.user.id,
              email: emailInput.trim(),
              display_name: nameInput.trim() || emailInput.split('@')[0],
              is_adult_confirmed: true,
              terms_accepted_at: nowIso,
              privacy_accepted_at: nowIso,
            },
            { onConflict: 'user_id' }
          );
        }

        if (!signUpData.session) {
          setSuccessMsg(
            activeModal === 'paywall'
              ? 'Konto skapat! Bekräfta din e-postadress via länken vi skickat och logga sedan in för att aktivera Premium.'
              : 'Konto skapat! Kontrollera din e-post och bekräfta ditt konto innan du loggar in.'
          );
          return;
        }

        await onAuthSuccess();
        if (activeModal === 'paywall') {
          await startStripeCheckout();
        } else {
          setSuccessMsg('Konto skapat!');
          setTimeout(() => onClose(), 900);
        }
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Autentisering misslyckades.');
    } finally {
      setLoading(false);
    }
  };

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${backendUrl}/api/feedback`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message_id: selectedMessageId || null,
          session_id: currentSessionId,
          rating: feedbackSentiment === 'positive' ? 'up' : 'down',
          sentiment: feedbackSentiment,
          comment: feedbackComment.trim(),
          message_excerpt: selectedMessageContent.slice(0, 300),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Kunde inte skicka feedback.');
      }
      setSuccessMsg('Tack för din återkoppling till FALK.');
      setTimeout(() => onClose(), 700);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Fel vid sändning av feedback.');
    } finally {
      setLoading(false);
    }
  };

  const handleReminderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reminderContent.trim()) {
      setErrorMsg('Skriv vad påminnelsen gäller.');
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const headers = await getAuthHeaders();
      const isoDate = reminderDateTime ? new Date(reminderDateTime).toISOString() : null;

      const res = await fetch(`${backendUrl}/api/reminders`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          content: reminderContent.trim(),
          frequency: reminderFrequency,
          reminder_at: isoDate,
          remind_at: isoDate,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Kunde inte spara påminnelse.');
      }

      if (alsoSaveAsInsight) {
        await fetch(`${backendUrl}/api/insights`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            content: reminderContent.trim(),
            type: 'reflection',
            session_id: currentSessionId,
            source_context: selectedMessageContent.slice(0, 400),
            reminder_at: isoDate,
          }),
        });
      }

      if (onDataSaved) await onDataSaved();
      setSuccessMsg('Påminnelse sparad.');
      setTimeout(() => onClose(), 650);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Kunde inte spara påminnelse.');
    } finally {
      setLoading(false);
    }
  };

  const handleInsightSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!insightContent.trim()) {
      setErrorMsg('Insikten kan inte vara tom.');
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const headers = await getAuthHeaders();
      const isoDate =
        alsoSetReminder && insightReminderDateTime
          ? new Date(insightReminderDateTime).toISOString()
          : null;

      const res = await fetch(`${backendUrl}/api/insights`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          content: insightContent.trim(),
          type: 'insight',
          is_pinned: true,
          session_id: currentSessionId,
          source_context: selectedMessageContent.slice(0, 500),
          reminder_at: isoDate,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Kunde inte spara insikt.');
      }

      if (alsoSetReminder && isoDate) {
        await fetch(`${backendUrl}/api/reminders`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            content: insightContent.trim().slice(0, 300),
            frequency: 'once',
            reminder_at: isoDate,
            remind_at: isoDate,
          }),
        });
      }

      if (onDataSaved) await onDataSaved();
      setSuccessMsg('Insikt sparad i din högra meny.');
      setTimeout(() => onClose(), 650);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Kunde inte spara insikt.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalTitle.trim()) {
      setErrorMsg('Ange en titel för ditt mål.');
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${backendUrl}/api/goals`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title: goalTitle.trim(),
          area: goalArea,
          target_date: goalTargetDate || null,
          progress: 0,
          status: 'active',
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Kunde inte spara mål.');
      }

      if (onDataSaved) await onDataSaved();
      setSuccessMsg('Mål sparat under Min utveckling.');
      setTimeout(() => onClose(), 650);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Kunde inte spara mål.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Ingen aktiv session.');

      if (settingsName.trim() !== displayName) {
        const { error: profErr } = await supabase
          .from('user_profiles')
          .update({ display_name: settingsName.trim() })
          .eq('user_id', user.id);
        if (profErr) throw profErr;
      }

      if (settingsEmail.trim() && settingsEmail.trim() !== userEmail) {
        const { error: emailErr } = await supabase.auth.updateUser({
          email: settingsEmail.trim(),
        });
        if (emailErr) throw emailErr;
      }

      await onAuthSuccess();
      setSuccessMsg('Profiluppgifter uppdaterade.');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Kunde inte uppdatera profil.');
    } finally {
      setLoading(false);
    }
  };

  const handleExportGdprData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${backendUrl}/api/user/export`, {
        method: 'GET',
        headers,
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Kunde inte exportera data.');
      }
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `falk-gdpr-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setSuccessMsg('Komplett dataexport nedladdad.');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Fel vid dataexport.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'RADERA') {
      setErrorMsg('Skriv RADERA med versaler för att bekräfta permanent radering.');
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${backendUrl}/api/user/delete`, {
        method: 'DELETE',
        headers,
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Kunde inte radera konto.');
      }
      await onSignOut();
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Fel vid kontoradering.');
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className={`relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border p-6 shadow-2xl ${cardBg}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Stäng"
          className="absolute right-4 top-4 rounded-full p-1.5 opacity-70 hover:opacity-100 transition"
        >
          <X className="h-5 w-5" />
        </button>

        {errorMsg && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-400/50 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-[#4E5C4B]/40 bg-[#A8BFA1]/25 p-3 text-sm text-[#2C332B] dark:text-[#E8DCC4]">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-[#4E5C4B]" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* 1. PAYWALL & AUTH MODAL */}
        {(activeModal === 'paywall' || activeModal === 'auth') && (
          <div>
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#C57B57]/15 text-[#C57B57]">
                {activeModal === 'paywall' ? <Lock className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
              </div>
              <div>
                <h2 className="text-lg font-semibold">
                  {activeModal === 'paywall' ? 'Fortsätt din resa med FALK' : 'Ditt FALK-konto'}
                </h2>
                <p className={`text-xs ${subText}`}>
                  {activeModal === 'paywall' ? paywallReason : 'Logga in eller skapa ett konto (18+).'}
                </p>
              </div>
            </div>

            {!isGuest && !isPremium ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-[#C57B57]/40 bg-[#C57B57]/10 p-4 text-sm">
                  <p className="font-medium mb-1">Du är inloggad som {userEmail}</p>
                  <p className={subText}>
                    Aktivera FALK Premium för obegränsade samtal, Biblioteket (15 övningskort),
                    Min utveckling (4 kompasser &amp; 8 områden), insikter, påminnelser och mål.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={loading}
                  onClick={startStripeCheckout}
                  className="w-full rounded-xl bg-[#C57B57] py-3 font-medium text-white hover:bg-[#b56d4a] transition disabled:opacity-50"
                >
                  {loading ? 'Öppnar Stripe...' : 'Uppgradera till FALK Premium →'}
                </button>
              </div>
            ) : (
              <>
                <div className="mb-4 grid grid-cols-2 rounded-xl bg-black/5 p-1 text-sm">
                  <button
                    type="button"
                    onClick={() => setAuthMode('register')}
                    className={`rounded-lg py-1.5 font-medium transition ${
                      authMode === 'register'
                        ? 'bg-[#4E5C4B] text-white shadow-xs'
                        : 'opacity-70 hover:opacity-100'
                    }`}
                  >
                    Skapa konto (18+)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthMode('login')}
                    className={`rounded-lg py-1.5 font-medium transition ${
                      authMode === 'login'
                        ? 'bg-[#4E5C4B] text-white shadow-xs'
                        : 'opacity-70 hover:opacity-100'
                    }`}
                  >
                    Logga in
                  </button>
                </div>

                <form onSubmit={handleAuthSubmit} className="space-y-3">
                  {authMode === 'register' && (
                    <div>
                      <label className="mb-1 block text-xs font-medium">Namn (valfritt)</label>
                      <input
                        type="text"
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                        placeholder="Ditt förnamn"
                        className={`w-full rounded-xl border px-3 py-2 text-sm outline-none ${inputBg}`}
                      />
                    </div>
                  )}

                  <div>
                    <label className="mb-1 block text-xs font-medium">E-postadress</label>
                    <input
                      type="email"
                      required
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      placeholder="namn@exempel.se"
                      className={`w-full rounded-xl border px-3 py-2 text-sm outline-none ${inputBg}`}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium">Lösenord</label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      placeholder="Minst 6 tecken"
                      className={`w-full rounded-xl border px-3 py-2 text-sm outline-none ${inputBg}`}
                    />
                  </div>

                  {authMode === 'register' && (
                    <div className="space-y-2 pt-1 text-xs">
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isAdultConfirmed}
                          onChange={(e) => setIsAdultConfirmed(e.target.checked)}
                          className="mt-0.5 rounded border-[#4E5C4B]"
                        />
                        <span>Jag bekräftar att jag är <strong>18 år eller äldre</strong>.</span>
                      </label>

                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={termsAccepted}
                          onChange={(e) => setTermsAccepted(e.target.checked)}
                          className="mt-0.5 rounded border-[#4E5C4B]"
                        />
                        <span>
                          Jag godkänner{' '}
                          <button
                            type="button"
                            onClick={() => setShowLegalDoc(showLegalDoc === 'terms' ? null : 'terms')}
                            className="underline font-medium text-[#C57B57]"
                          >
                            Användarvillkoren
                          </button>{' '}
                          och{' '}
                          <button
                            type="button"
                            onClick={() => setShowLegalDoc(showLegalDoc === 'privacy' ? null : 'privacy')}
                            className="underline font-medium text-[#C57B57]"
                          >
                            Integritetspolicyn (GDPR)
                          </button>
                          .
                        </span>
                      </label>

                      {showLegalDoc && (
                        <div className="rounded-xl border border-[#D8CCB8] bg-black/5 p-3 text-[11px] leading-relaxed">
                          {showLegalDoc === 'terms' ? (
                            <p>
                              <strong>Användarvillkor (WAYJS / FALK):</strong> FALK är en digital
                              mentor för självreflektion och personlig utveckling – inte sjukvård,
                              terapi eller juridisk/finansiell rådgivning. Konto kräver 18 års ålder.
                            </p>
                          ) : (
                            <p>
                              <strong>Integritetspolicy (GDPR):</strong> Dina samtal, kompassvärden,
                              insikter och mål lagras krypterat med strikt åtkomstkontroll (RLS). Du
                              kan när som helst exportera all din data eller radera ditt konto
                              permanent under Inställningar.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="mt-2 w-full rounded-xl bg-[#4E5C4B] py-2.5 text-sm font-medium text-white hover:bg-[#3f4b3c] transition disabled:opacity-50"
                  >
                    {loading
                      ? 'Bearbetar...'
                      : authMode === 'login'
                      ? 'Logga in'
                      : activeModal === 'paywall'
                      ? 'Skapa konto & fortsätt till betalning'
                      : 'Skapa konto'}
                  </button>
                </form>
              </>
            )}
          </div>
        )}

        {/* 2. FEEDBACK MODAL */}
        {activeModal === 'feedback' && (
          <form onSubmit={handleFeedbackSubmit} className="space-y-4">
            <div className="flex items-center gap-2">
              {feedbackSentiment === 'positive' ? (
                <ThumbsUp className="h-5 w-5 text-[#4E5C4B]" />
              ) : (
                <ThumbsDown className="h-5 w-5 text-[#C57B57]" />
              )}
              <h2 className="text-lg font-semibold">
                {feedbackSentiment === 'positive'
                  ? 'Vad var hjälpsamt i svaret?'
                  : 'Rapportera eller ge feedback'}
              </h2>
            </div>

            <p className={`text-xs ${subText}`}>
              Din återkoppling hjälper oss att kvalitetssäkra FALK enligt Wayjs principer.
            </p>

            <textarea
              rows={3}
              value={feedbackComment}
              onChange={(e) => setFeedbackComment(e.target.value)}
              placeholder="Valfri kommentar..."
              className={`w-full rounded-xl border p-3 text-sm outline-none ${inputBg}`}
            />

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl px-4 py-2 text-sm opacity-75 hover:opacity-100"
              >
                Avbryt
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-xl bg-[#4E5C4B] px-5 py-2 text-sm font-medium text-white hover:bg-[#3f4b3c] disabled:opacity-50"
              >
                {loading ? 'Skickar...' : 'Skicka feedback'}
              </button>
            </div>
          </form>
        )}

        {/* 3. PÅMINNELSE MODAL */}
        {activeModal === 'reminder' && (
          <form onSubmit={handleReminderSubmit} className="space-y-4">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-[#C57B57]" />
              <h2 className="text-lg font-semibold">Ställ in påminnelse</h2>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium">Kontext / Påminnelsetext</label>
              <textarea
                rows={3}
                required
                value={reminderContent}
                onChange={(e) => setReminderContent(e.target.value)}
                className={`w-full rounded-xl border p-3 text-sm outline-none ${inputBg}`}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium">Frekvens</label>
                <select
                  value={reminderFrequency}
                  onChange={(e) =>
                    setReminderFrequency(e.target.value as 'once' | 'daily' | 'weekly' | 'monthly')
                  }
                  className={`w-full rounded-xl border px-3 py-2 text-sm outline-none ${inputBg}`}
                >
                  <option value="once">En gång</option>
                  <option value="daily">Dagligen</option>
                  <option value="weekly">Veckovis</option>
                  <option value="monthly">Månadsvis</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium">Tidpunkt</label>
                <input
                  type="datetime-local"
                  value={reminderDateTime}
                  onChange={(e) => setReminderDateTime(e.target.value)}
                  className={`w-full rounded-xl border px-3 py-2 text-sm outline-none ${inputBg}`}
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={alsoSaveAsInsight}
                onChange={(e) => setAlsoSaveAsInsight(e.target.checked)}
                className="rounded border-[#4E5C4B]"
              />
              <span>Spara även detta som en Insikt i högra menyn</span>
            </label>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl px-4 py-2 text-sm opacity-75 hover:opacity-100"
              >
                Avbryt
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-xl bg-[#4E5C4B] px-5 py-2 text-sm font-medium text-white hover:bg-[#3f4b3c] disabled:opacity-50"
              >
                {loading ? 'Sparar...' : 'Spara påminnelse'}
              </button>
            </div>
          </form>
        )}

        {/* 4. INSIKT / PIN MODAL */}
        {activeModal === 'insight' && (
          <form onSubmit={handleInsightSubmit} className="space-y-4">
            <div className="flex items-center gap-2">
              <Pin className="h-5 w-5 text-[#C57B57]" />
              <h2 className="text-lg font-semibold">Spara som Insikt</h2>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium">Insikt (redigerbar)</label>
              <textarea
                rows={4}
                required
                value={insightContent}
                onChange={(e) => setInsightContent(e.target.value)}
                className={`w-full rounded-xl border p-3 text-sm outline-none ${inputBg}`}
              />
              <p className={`mt-1 text-[11px] ${subText}`}>
                Länk tillbaka till ursprungskontexten i detta samtal sparas automatiskt.
              </p>
            </div>

            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={alsoSetReminder}
                onChange={(e) => setAlsoSetReminder(e.target.checked)}
                className="rounded border-[#4E5C4B]"
              />
              <span>Sätt även en påminnelse för denna insikt</span>
            </label>

            {alsoSetReminder && (
              <div>
                <label className="mb-1 block text-xs font-medium">Påminnelsetidpunkt</label>
                <input
                  type="datetime-local"
                  value={insightReminderDateTime}
                  onChange={(e) => setInsightReminderDateTime(e.target.value)}
                  className={`w-full rounded-xl border px-3 py-2 text-sm outline-none ${inputBg}`}
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl px-4 py-2 text-sm opacity-75 hover:opacity-100"
              >
                Avbryt
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-xl bg-[#4E5C4B] px-5 py-2 text-sm font-medium text-white hover:bg-[#3f4b3c] disabled:opacity-50"
              >
                {loading ? 'Sparar...' : 'Spara insikt'}
              </button>
            </div>
          </form>
        )}

        {/* 5. MÅLTAVLA / MÅL MODAL */}
        {activeModal === 'goal' && (
          <form onSubmit={handleGoalSubmit} className="space-y-4">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-[#C57B57]" />
              <h2 className="text-lg font-semibold">Skapa nytt Mål</h2>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium">Målformulering</label>
              <input
                type="text"
                required
                value={goalTitle}
                onChange={(e) => setGoalTitle(e.target.value)}
                placeholder="T.ex. Skapa 30 min återhämtning varje kväll"
                className={`w-full rounded-xl border px-3 py-2 text-sm outline-none ${inputBg}`}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium">Utvecklingsområde</label>
                <select
                  value={goalArea}
                  onChange={(e) => setGoalArea(e.target.value)}
                  className={`w-full rounded-xl border px-3 py-2 text-sm outline-none ${inputBg}`}
                >
                  {DEVELOPMENT_AREAS.map((area) => (
                    <option key={area.name} value={area.name}>
                      {area.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium">Måldatum (valfritt)</label>
                <input
                  type="date"
                  value={goalTargetDate}
                  onChange={(e) => setGoalTargetDate(e.target.value)}
                  className={`w-full rounded-xl border px-3 py-2 text-sm outline-none ${inputBg}`}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl px-4 py-2 text-sm opacity-75 hover:opacity-100"
              >
                Avbryt
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-xl bg-[#4E5C4B] px-5 py-2 text-sm font-medium text-white hover:bg-[#3f4b3c] disabled:opacity-50"
              >
                {loading ? 'Sparar...' : 'Spara mål i Dashboard'}
              </button>
            </div>
          </form>
        )}

        {/* 6. INSTÄLLNINGAR & INTEGRITET (GDPR) */}
        {activeModal === 'settings' && (
          <div className="space-y-5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-[#4E5C4B]" />
              <h2 className="text-lg font-semibold">Inställningar &amp; Integritet</h2>
            </div>

            {/* Vy / Tema */}
            <div className="flex items-center justify-between rounded-xl border border-[#D8CCB8]/60 p-3">
              <div>
                <p className="text-sm font-medium">Utseende / Vy</p>
                <p className={`text-xs ${subText}`}>
                  {darkMode ? 'Mörkt läge aktivt' : 'Standardläge (#E8DCC4) aktivt'}
                </p>
              </div>
              <button
                type="button"
                onClick={onToggleDarkMode}
                className="flex items-center gap-2 rounded-xl border border-[#4E5C4B]/40 px-3 py-1.5 text-xs font-medium hover:bg-[#4E5C4B]/10 transition"
              >
                {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                {darkMode ? 'Byt till Standard' : 'Byt till Mörk vy'}
              </button>
            </div>

            {/* Profil (enbart inloggad) */}
            {!isGuest && (
              <form onSubmit={handleUpdateProfile} className="space-y-3 rounded-xl border border-[#D8CCB8]/60 p-3">
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <User className="h-4 w-4 text-[#4E5C4B]" />
                  <span>Profil &amp; Inloggning</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={settingsName}
                    onChange={(e) => setSettingsName(e.target.value)}
                    placeholder="Användarnamn"
                    className={`rounded-xl border px-3 py-1.5 text-sm outline-none ${inputBg}`}
                  />
                  <input
                    type="email"
                    value={settingsEmail}
                    onChange={(e) => setSettingsEmail(e.target.value)}
                    placeholder="E-postadress"
                    className={`rounded-xl border px-3 py-1.5 text-sm outline-none ${inputBg}`}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-xl bg-[#4E5C4B] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#3f4b3c] disabled:opacity-50"
                >
                  Spara ändringar
                </button>
              </form>
            )}

            {/* Medlemskap & Betalmetod */}
            <div className="rounded-xl border border-[#D8CCB8]/60 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <CreditCard className="h-4 w-4 text-[#C57B57]" />
                  <span>Medlemskap</span>
                </div>
                <span className="rounded-full bg-[#4E5C4B] px-2.5 py-0.5 text-[11px] font-semibold text-white">
                  {isPremium ? 'PREMIUM' : 'GÄST'}
                </span>
              </div>

              {isPremium ? (
                <button
                  type="button"
                  disabled={loading}
                  onClick={openBillingPortal}
                  className="flex items-center gap-1.5 rounded-xl border border-[#4E5C4B]/40 px-3 py-2 text-xs font-medium hover:bg-[#4E5C4B]/10 transition"
                >
                  <span>Hantera medlemskap &amp; betalningsmetod</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => (isGuest ? setAuthMode('register') : startStripeCheckout())}
                  className="rounded-xl bg-[#C57B57] px-3 py-2 text-xs font-medium text-white hover:bg-[#b56d4a] transition"
                >
                  {isGuest ? 'Skapa konto för Premium' : 'Uppgradera till Premium'}
                </button>
              )}
            </div>

            {/* Juridiska dokument */}
            <div className="rounded-xl border border-[#D8CCB8]/60 p-3 space-y-2">
              <p className="text-sm font-medium">Villkor &amp; Integritetspolicy</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowLegalDoc(showLegalDoc === 'terms' ? null : 'terms')}
                  className="rounded-lg border border-[#D8CCB8] px-3 py-1 text-xs hover:bg-black/5"
                >
                  Läs Användarvillkor
                </button>
                <button
                  type="button"
                  onClick={() => setShowLegalDoc(showLegalDoc === 'privacy' ? null : 'privacy')}
                  className="rounded-lg border border-[#D8CCB8] px-3 py-1 text-xs hover:bg-black/5"
                >
                  Läs Integritetspolicy
                </button>
              </div>
              {showLegalDoc && (
                <div className="rounded-lg bg-black/5 p-2.5 text-xs leading-relaxed">
                  {showLegalDoc === 'terms' ? (
                    <p>
                      <strong>Användarvillkor (FALK / WAYJS):</strong> Tjänsten tillhandahåller
                      strukturerad självreflektion och digitalt mentorskap. Premium kräver minst 18
                      års ålder. FALK ersätter inte medicinsk, psykologisk eller juridisk expertis.
                    </p>
                  ) : (
                    <p>
                      <strong>Integritetspolicy (GDPR):</strong> All persondata behandlas enligt
                      EU:s dataskyddsförordning (GDPR). Du har full rätt till registerutdrag
                      (JSON-export nedan) och rätten att bli glömd genom permanent kontoradering.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* GDPR: Export & Radering (för inloggade) */}
            {!isGuest && (
              <div className="rounded-xl border border-[#D8CCB8]/60 p-3 space-y-3">
                <p className="text-sm font-medium">Dina GDPR-rättigheter</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleExportGdprData}
                    className="flex items-center gap-1.5 rounded-xl border border-[#4E5C4B] px-3 py-2 text-xs font-medium hover:bg-[#4E5C4B]/10 transition"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Exportera all data (inkl. Dashboard)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(!showDeleteConfirm)}
                    className="flex items-center gap-1.5 rounded-xl border border-red-500/50 px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-500/10 transition"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Radera konto och all data</span>
                  </button>
                </div>

                {showDeleteConfirm && (
                  <div className="rounded-xl border border-red-500/40 bg-red-500/5 p-3 space-y-2 text-xs">
                    <p className="font-medium text-red-700 dark:text-red-300">
                      Varning: Detta raderar permanent ditt konto, alla samtal, kompassvärden,
                      insikter, påminnelser, mål och avslutar eventuellt medlemskap.
                    </p>
                    <input
                      type="text"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      placeholder="Skriv RADERA för att bekräfta"
                      className={`w-full rounded-lg border px-2.5 py-1.5 text-xs outline-none ${inputBg}`}
                    />
                    <button
                      type="button"
                      disabled={loading || deleteConfirmText !== 'RADERA'}
                      onClick={handleDeleteAccount}
                      className="rounded-lg bg-red-600 px-3 py-1.5 font-medium text-white hover:bg-red-700 disabled:opacity-40"
                    >
                      {loading ? 'Raderar...' : 'Bekräfta permanent radering'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
