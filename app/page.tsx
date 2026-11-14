'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Menu,
  Plus,
  Lightbulb,
  Compass,
  Volume2,
  VolumeX,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  Minus,
  Bell,
  Pin,
  Target,
  Lock,
  Mic,
  MicOff,
  SlidersHorizontal,
  Send,
  X,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import { supabase, getAuthHeaders } from '../lib/supabase';
import {
  UserTier,
  Message,
  MessageVariant,
  FocusSliders,
  DEFAULT_FOCUS,
  ONBOARDING_CARDS,
  COMPASS_FOUR,
  DEVELOPMENT_AREAS,
} from '../lib/types';
import SideDrawers, {
  MainView,
  DrawerConversation,
  DrawerInsight,
  DrawerReminder,
} from '../components/SideDrawers';
import ActionModals, { ActiveModalType } from '../components/ActionModals';
import CalibrationModal from '../components/CalibrationModal';
import LibraryView from '../components/LibraryView';
import DashboardView from '../components/DashboardView';

const FOCUS_KEYS: (keyof FocusSliders)[] = [
  'Självförtroende',
  'Stresshantering',
  'Handlingskraft',
  'Gränssättning',
  'Motivation',
];

function getOrCreateGuestUuid(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem('falk_guest_uuid');
  if (!id) {
    id =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `guest-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem('falk_guest_uuid', id);
  }
  return id;
}

export default function FalkHomePage() {
  const backendUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:5001';

  // Tema & vyer
  const [darkMode, setDarkMode] = useState(false);
  const [activeView, setActiveView] = useState<MainView>('chat');
  const [isLeftOpen, setIsLeftOpen] = useState(false);
  const [isRightOpen, setIsRightOpen] = useState(false);
  const [showWelcomeCard, setShowWelcomeCard] = useState(true);

  // Auth & användarprofil
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isPremium, setIsPremium] = useState(false);
  const [guestUuid, setGuestUuid] = useState('');
  const [guestMessageCount, setGuestMessageCount] = useState(0);

  const isGuest = !userId;
  const userTier: UserTier = isGuest ? 'guest' : isPremium ? 'premium' : 'free';

  // Modaler
  const [activeModal, setActiveModal] = useState<ActiveModalType>(null);
  const [paywallReason, setPaywallReason] = useState(
    'Lås upp hela FALK med ett Premium-medlemskap.'
  );
  const [selectedMessageContent, setSelectedMessageContent] = useState('');
  const [selectedMessageId, setSelectedMessageId] = useState('');
  const [feedbackSentiment, setFeedbackSentiment] = useState<
    'positive' | 'negative'
  >('positive');

  // Kompasskalibrering
  const [isCalibrationOpen, setIsCalibrationOpen] = useState(false);
  const [calibrationView, setCalibrationView] = useState<'wizard' | 'overview'>(
    'wizard'
  );
  const [savedCompassScores, setSavedCompassScores] = useState<Record<
    string,
    number
  > | null>(null);

  // Chatt & historik
  const [conversations, setConversations] = useState<DrawerConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [variationLoadingId, setVariationLoadingId] = useState<string | null>(
    null
  );

  // Insikter & Påminnelser (Höger meny)
  const [insights, setInsights] = useState<DrawerInsight[]>([]);
  const [reminders, setReminders] = useState<DrawerReminder[]>([]);

  // Fokusreglage (0-100%, default 0% = Standard FALK)
  const [focusSliders, setFocusSliders] = useState<FocusSliders>(DEFAULT_FOCUS);
  const [isFocusOpen, setIsFocusOpen] = useState(false);

  // Röstinmatning (Mikrofon) & Uppläsning (TTS)
  const [isListening, setIsListening] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(
    null
  );
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const openPaywall = useCallback((reason: string) => {
    setPaywallReason(reason);
    setActiveModal('paywall');
  }, []);

  // Initiera tema, guestUuid och lokal kalibrering
  useEffect(() => {
    const savedTheme = localStorage.getItem('falk_dark_mode');
    if (savedTheme === 'true') setDarkMode(true);
    setGuestUuid(getOrCreateGuestUuid());

    const todayKey = `falk_guest_msg_count_${new Date().toISOString().slice(0, 10)}`;
    localStorage.removeItem('falk_guest_msg_count');
    const storedCount = Number(localStorage.getItem(todayKey) || '0');
    if (!Number.isNaN(storedCount)) setGuestMessageCount(storedCount);

    // Hantera återkomst från Stripe Checkout (?checkout=success / ?checkout=canceled)
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const checkoutStatus = params.get('checkout');
      if (checkoutStatus === 'success') {
        window.history.replaceState({}, '', window.location.pathname);
        let attempts = 0;
        const pollTimer = window.setInterval(async () => {
          attempts += 1;
          try {
            const { data: authData } = await supabase.auth.getUser();
            const uid = authData?.user?.id;
            if (uid) {
              const { data: prof } = await supabase
                .from('user_profiles')
                .select('is_premium')
                .eq('user_id', uid)
                .maybeSingle();
              if (prof?.is_premium) {
                setIsPremium(true);
                await loadUserData();
                window.clearInterval(pollTimer);
                return;
              }
            }
          } catch {
            // Ignorera tillfälliga nätverksfel under polling
          }
          if (attempts >= 8) {
            window.clearInterval(pollTimer);
          }
        }, 1500);
      } else if (checkoutStatus === 'canceled') {
        window.history.replaceState({}, '', window.location.pathname);
      }
    }

    const rawCal = localStorage.getItem('falk_latest_calibration');
    if (rawCal) {
      try {
        setSavedCompassScores(JSON.parse(rawCal));
      } catch {
        // Ignorera trasig JSON
      }
    }
  }, []);

  const handleToggleDarkMode = () => {
    setDarkMode((prev) => {
      const next = !prev;
      localStorage.setItem('falk_dark_mode', String(next));
      return next;
    });
  };

  // Ladda användardata (profil, konversationer, insikter, påminnelser, kalibrering)
  const loadUserData = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;

    if (!user) {
      setUserId(null);
      setUserEmail('');
      setDisplayName('');
      setIsPremium(false);
      setConversations([]);
      setInsights([]);
      setReminders([]);
      return;
    }

    setUserId(user.id);
    setUserEmail(user.email || '');

    // Hämta profil i Supabase
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('display_name, email, is_premium')
      .eq('user_id', user.id)
      .maybeSingle();

    let effectiveIsPremium = false;

    if (profile) {
      setDisplayName(profile.display_name || user.email?.split('@')[0] || '');
      if (profile.email) setUserEmail(profile.email);
      effectiveIsPremium = Boolean(profile.is_premium);
      setIsPremium(effectiveIsPremium);
    } else {
      const meta = (user.user_metadata || {}) as Record<string, unknown>;
      const fallbackName =
        (typeof meta.display_name === 'string' && meta.display_name.trim()) ||
        user.email?.split('@')[0] ||
        '';
      const adultConfirmed = Boolean(meta.is_adult_confirmed || meta.age_verified_18_plus);
      const termsAt =
        typeof meta.terms_accepted_at === 'string'
          ? meta.terms_accepted_at
          : meta.terms_accepted
          ? new Date().toISOString()
          : null;
      const privacyAt =
        typeof meta.privacy_accepted_at === 'string' ? meta.privacy_accepted_at : termsAt;

      setDisplayName(fallbackName);
      setIsPremium(false);

      const { error: healError } = await supabase.from('user_profiles').upsert(
        {
          id: user.id,
          user_id: user.id,
          email: user.email || null,
          display_name: fallbackName,
          is_adult_confirmed: adultConfirmed,
          terms_accepted_at: termsAt,
          privacy_accepted_at: privacyAt,
        },
        { onConflict: 'id' }
      );
      if (healError) {
        console.error('Kunde inte självläka användarprofil:', healError);
      }
    }

    // Automatisk inlösen av väntande rabattkod efter e-postaktivering
    let pendingPromo = '';
    try {
      pendingPromo = (
        window.localStorage.getItem('falk_pending_promo') ||
        window.sessionStorage.getItem('falk_pending_promo') ||
        ''
      ).trim();
    } catch {}

    if (pendingPromo) {
      if (effectiveIsPremium) {
        try {
          window.localStorage.removeItem('falk_pending_promo');
          window.sessionStorage.removeItem('falk_pending_promo');
        } catch {}
      } else {
        try {
          const headers = await getAuthHeaders();
          const redeemRes = await fetch(`${backendUrl}/api/promo/redeem`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ code: pendingPromo }),
          });
          const redeemJson = await redeemRes.json().catch(() => ({}));
          if (redeemRes.ok && redeemJson?.ok) {
            setIsPremium(true);
            try {
              window.localStorage.removeItem('falk_pending_promo');
              window.sessionStorage.removeItem('falk_pending_promo');
            } catch {}
          } else if (redeemRes.status === 400 || redeemRes.status === 409) {
            try {
              window.localStorage.removeItem('falk_pending_promo');
              window.sessionStorage.removeItem('falk_pending_promo');
            } catch {}
          }
        } catch {
          // Behåll koden vid tillfälligt nätverksfel för nytt försök vid nästa synk
        }
      }
    }

    // Hämta konversationer
    const { data: convRows } = await supabase
      .from('conversations')
      .select('id, title, is_pinned, created_at, updated_at')
      .eq('user_id', user.id)
      .order('is_pinned', { ascending: false })
      .order('updated_at', { ascending: false });

    if (convRows) {
      setConversations(convRows as DrawerConversation[]);
    }

    // Hämta insikter, påminnelser & kalibrering via backend
    try {
      const headers = await getAuthHeaders();
      const [insRes, remRes, calRes] = await Promise.all([
        fetch(`${backendUrl}/api/insights`, { headers }),
        fetch(`${backendUrl}/api/reminders`, { headers }),
        fetch(`${backendUrl}/api/calibration`, { headers }),
      ]);

      if (insRes.ok) {
        const insJson = await insRes.json();
        setInsights(Array.isArray(insJson) ? insJson : insJson.insights || []);
      }
      if (remRes.ok) {
        const remJson = await remRes.json();
        setReminders(
          Array.isArray(remJson) ? remJson : remJson.reminders || []
        );
      }
      if (calRes.ok) {
        const calJson = await calRes.json();
        const latest =
          calJson?.latest?.scores ||
          calJson?.scores ||
          (Array.isArray(calJson) && calJson[0]?.scores) ||
          null;
        if (latest && typeof latest === 'object') {
          setSavedCompassScores(latest);
        }
      }
    } catch {
      // Ignorera nätverksfel vid bakgrundssynk
    }
  }, [backendUrl]);

  useEffect(() => {
    loadUserData();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadUserData();
    });
    return () => {
      subscription.unsubscribe();
    };
  }, [loadUserData]);

  // Scrolla till toppen på startsidan (tom chatt) och till senaste meddelandet i aktiv chatt
  useEffect(() => {
    if (messages.length === 0 && !isSending) {
      window.scrollTo({ top: 0, behavior: 'auto' });
      return;
    }
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  // Välj befintlig konversation från vänstermenyn
  const handleSelectConversation = async (convId: string) => {
    setActiveConversationId(convId);
    setActiveView('chat');
    setIsLeftOpen(false);
    setShowWelcomeCard(false);

    const { data: msgRows } = await supabase
      .from('messages')
      .select('id, sender, content, created_at')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true });

    if (msgRows) {
      const mapped: Message[] = msgRows.map((m) => ({
        id: m.id,
        sender: m.sender === 'user' ? 'user' : 'falk',
        content: m.content,
        timestamp: m.created_at,
        variants:
          m.sender !== 'user'
            ? [{ content: m.content, mode: 'default' }]
            : undefined,
        activeVariantIndex: 0,
        feedback: null,
      }));
      setMessages(mapped);
    }
  };

  // Ny chatt
  const handleNewChat = () => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setSpeakingMessageId(null);
    }
    setActiveConversationId(null);
    setMessages([]);
    setShowWelcomeCard(true);
    setActiveView('chat');
    setIsLeftOpen(false);
  };

  // Nåla / avnåla session
  const handleTogglePinConversation = async (
    id: string,
    nextPinned: boolean
  ) => {
    await supabase
      .from('conversations')
      .update({ is_pinned: nextPinned })
      .eq('id', id);
    await loadUserData();
  };

  // Radera session
  const handleDeleteConversation = async (id: string) => {
    await supabase.from('messages').delete().eq('conversation_id', id);
    await supabase.from('conversations').delete().eq('id', id);
    if (activeConversationId === id) {
      handleNewChat();
    }
    await loadUserData();
  };

  // Exportera session som PDF / utskriftsvy
  const handleExportSessionPdf = async (id: string) => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${backendUrl}/api/export/pdf`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ conversation_id: id, session_id: id }),
      });
      if (!res.ok) return;
      const html = await res.text();
      const win = window.open('', '_blank');
      if (win) {
        win.document.open();
        win.document.write(html);
        win.document.close();
      }
    } catch {
      // Ignorera vid popup-blockering
    }
  };

  // Radera insikt eller påminnelse i höger meny
  const handleDeleteInsight = async (id: string) => {
    const headers = await getAuthHeaders();
    await fetch(`${backendUrl}/api/insights/${id}`, {
      method: 'DELETE',
      headers,
    });
    await loadUserData();
  };

  const handleDeleteReminder = async (id: string) => {
    const headers = await getAuthHeaders();
    await fetch(`${backendUrl}/api/reminders/${id}`, {
      method: 'DELETE',
      headers,
    });
    await loadUserData();
  };

  // Skicka meddelande till FALK
  const handleSendMessage = async (overrideText?: string) => {
    const text = (overrideText ?? inputText).trim();
    if (!text || isSending) return;

    // Lokal snabbkontroll för gäst (6 meddelanden/dygn) innan anrop
    const todayKey = `falk_guest_msg_count_${new Date().toISOString().slice(0, 10)}`;
    const storedToday = Number(localStorage.getItem(todayKey) || '0');
    const effectiveGuestCount = Number.isNaN(storedToday) ? 0 : storedToday;
    if (isGuest && effectiveGuestCount !== guestMessageCount) {
      setGuestMessageCount(effectiveGuestCount);
    }
    if (isGuest && effectiveGuestCount >= 6) {
      openPaywall(
        'Du har använt dina 6 kostnadsfria gästmeddelanden för idag. Skapa ett konto och bli Premium-medlem för obegränsade samtal med FALK.'
      );
      return;
    }

    if (!overrideText) setInputText('');
    setIsFocusOpen(false);
    setActiveView('chat');

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setIsSending(true);

    try {
      const headers = await getAuthHeaders();
      const payload = {
        message: text,
        conversation_id: activeConversationId,
        session_id: activeConversationId,
        focus_sliders: focusSliders,
        is_guest: isGuest,
        guest_uuid: guestUuid || getOrCreateGuestUuid(),
        history: nextHistory.slice(-10).map((m) => ({
          role: m.sender === 'user' ? 'user' : 'assistant',
          content:
            m.variants && typeof m.activeVariantIndex === 'number'
              ? m.variants[m.activeVariantIndex]?.content || m.content
              : m.content,
        })),
      };

      const res = await fetch(`${backendUrl}/api/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 403 || res.status === 429) {
        setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
        openPaywall(
          data.error ||
            data.message ||
            'Du har nått gränsen för gästläge (6 meddelanden/dygn). Skapa konto eller uppgradera till Premium.'
        );
        return;
      }

      if (!res.ok) {
        throw new Error(
          data.error || 'Kunde inte nå FALK just nu. Försök igen om en stund.'
        );
      }

      const replyText: string =
        data.reply || data.response || data.content || '';
      const returnedConvId: string | null =
        data.conversation_id || data.session_id || activeConversationId;

      if (returnedConvId && returnedConvId !== activeConversationId) {
        setActiveConversationId(returnedConvId);
      }

      const falkMsg: Message = {
        id: data.message_id || `falk-${Date.now()}`,
        sender: 'falk',
        content: replyText,
        timestamp: new Date().toISOString(),
        variants: [{ content: replyText, mode: 'default' }],
        activeVariantIndex: 0,
        feedback: null,
      };

      setMessages((prev) => [...prev, falkMsg]);

      if (isGuest) {
        const todayKey = `falk_guest_msg_count_${new Date().toISOString().slice(0, 10)}`;
        const prevToday = Number(localStorage.getItem(todayKey) || '0');
        const updatedCount = (Number.isNaN(prevToday) ? 0 : prevToday) + 1;
        setGuestMessageCount(updatedCount);
        localStorage.setItem(todayKey, String(updatedCount));
      } else {
        await loadUserData();
      }
    } catch (err) {
      const errText =
        err instanceof Error ? err.message : 'Ett oväntat fel uppstod.';
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'falk',
          content: errText,
          timestamp: new Date().toISOString(),
          variants: [{ content: errText, mode: 'error' }],
          activeVariantIndex: 0,
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  // TTS (Högtalare - ikon 1 av 9)
  const handleToggleSpeak = (msg: Message) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    if (speakingMessageId === msg.id) {
      window.speechSynthesis.cancel();
      setSpeakingMessageId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const activeText =
      msg.variants && typeof msg.activeVariantIndex === 'number'
        ? msg.variants[msg.activeVariantIndex]?.content || msg.content
        : msg.content;

    const utterance = new SpeechSynthesisUtterance(activeText);
    utterance.lang = 'sv-SE';
    utterance.rate = 0.96;
    utterance.onend = () => setSpeakingMessageId(null);
    utterance.onerror = () => setSpeakingMessageId(null);

    setSpeakingMessageId(msg.id);
    window.speechSynthesis.speak(utterance);
  };

  // Svarskarusell: Nytt svar (gäst + premium) samt Plus / Minus (endast premium)
  const handleGenerateVariation = async (
    msg: Message,
    msgIndex: number,
    mode: 'regenerate' | 'longer' | 'shorter'
  ) => {
    if ((mode === 'longer' || mode === 'shorter') && !isPremium) {
      openPaywall(
        mode === 'longer'
          ? 'Fördjupade och längre svar (+) ingår i FALK Premium.'
          : 'Kortare och mer koncisa svar (-) ingår i FALK Premium.'
      );
      return;
    }

    if (variationLoadingId) return;
    setVariationLoadingId(msg.id);

    try {
      const headers = await getAuthHeaders();
      const prevUserMsg = [...messages.slice(0, msgIndex)]
        .reverse()
        .find((m) => m.sender === 'user');
      const currentContent =
        msg.variants && typeof msg.activeVariantIndex === 'number'
          ? msg.variants[msg.activeVariantIndex]?.content || msg.content
          : msg.content;

      const res = await fetch(`${backendUrl}/api/message/variation`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          original_reply: currentContent,
          user_message: prevUserMsg?.content || '',
          mode,
          focus_sliders: focusSliders,
          is_guest: isGuest,
          guest_uuid: guestUuid || getOrCreateGuestUuid(),
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 403 || res.status === 429) {
        openPaywall(
          data.error ||
            'Denna svarsfunktion kräver FALK Premium eller ett registrerat konto.'
        );
        return;
      }

      if (!res.ok) return;

      const newContent: string =
        data.reply || data.variation || data.content || '';
      if (!newContent) return;

      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== msg.id) return m;
          const existingVariants: MessageVariant[] =
            m.variants && m.variants.length > 0
              ? m.variants
              : [{ content: m.content, mode: 'default' }];
          const updatedVariants = [
            ...existingVariants,
            { content: newContent, mode },
          ];
          return {
            ...m,
            content: newContent,
            variants: updatedVariants,
            activeVariantIndex: updatedVariants.length - 1,
          };
        })
      );
    } finally {
      setVariationLoadingId(null);
    }
  };

  const handleSwitchVariant = (msgId: string, delta: number) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== msgId || !m.variants || m.variants.length <= 1) return m;
        const currentIdx = m.activeVariantIndex ?? 0;
        const nextIdx =
          (currentIdx + delta + m.variants.length) % m.variants.length;
        return {
          ...m,
          activeVariantIndex: nextIdx,
          content: m.variants[nextIdx].content,
        };
      })
    );
  };

  // Tumme upp / Tumme ner (ikon 3 & 4 av 9 - öppet för gäst & inloggad)
  const handleFeedbackClick = async (
    msg: Message,
    sentiment: 'positive' | 'negative'
  ) => {
    const activeText =
      msg.variants && typeof msg.activeVariantIndex === 'number'
        ? msg.variants[msg.activeVariantIndex]?.content || msg.content
        : msg.content;

    setMessages((prev) =>
      prev.map((m) =>
        m.id === msg.id
          ? { ...m, feedback: sentiment === 'positive' ? 'up' : 'down' }
          : m
      )
    );

    // Skicka omedelbar signal till backend
    try {
      const headers = await getAuthHeaders();
      await fetch(`${backendUrl}/api/feedback`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          sentiment,
          message_content: activeText,
          message_id: msg.id,
          session_id: activeConversationId,
          comment: '',
        }),
      });
    } catch {
      // Ignorera nätverksfel
    }

    // Öppna feedback-modalen för möjlighet att lämna skriftlig kommentar/anmälan
    setSelectedMessageContent(activeText);
    setSelectedMessageId(msg.id);
    setFeedbackSentiment(sentiment);
    setActiveModal('feedback');
  };

  // Låsta Premium-ikoner under svar (Klocka, Pin, Måltavla)
  const handlePremiumActionIcon = (
    msg: Message,
    modal: 'reminder' | 'insight' | 'goal',
    reason: string
  ) => {
    if (!isPremium) {
      openPaywall(reason);
      return;
    }
    const activeText =
      msg.variants && typeof msg.activeVariantIndex === 'number'
        ? msg.variants[msg.activeVariantIndex]?.content || msg.content
        : msg.content;

    setSelectedMessageContent(activeText);
    setSelectedMessageId(msg.id);
    setActiveModal(modal);
  };

  // Mikrofon (Tal-till-text)
  const handleToggleMicrophone = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    if (typeof window === 'undefined') return;
    const win = window as unknown as {
      SpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        continuous: boolean;
        onresult: (event: {
          results: ArrayLike<ArrayLike<{ transcript: string }>>;
        }) => void;
        onerror: () => void;
        onend: () => void;
        start: () => void;
        stop: () => void;
      };
      webkitSpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        continuous: boolean;
        onresult: (event: {
          results: ArrayLike<ArrayLike<{ transcript: string }>>;
        }) => void;
        onerror: () => void;
        onend: () => void;
        start: () => void;
        stop: () => void;
      };
    };

    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechRec) return;

    const recognition = new SpeechRec();
    recognition.lang = 'sv-SE';
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0]?.transcript || '')
        .join(' ')
        .trim();
      if (transcript) {
        setInputText((prev) => (prev ? `${prev} ${transcript}` : transcript));
      }
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    setIsListening(true);
    recognition.start();
  };

  const activeFocusCount = FOCUS_KEYS.filter(
    (k) => focusSliders[k] > 0
  ).length;

  return (
    <div
      className={`min-h-screen flex flex-col transition-colors ${
        darkMode
          ? 'bg-[#181715] text-[#F5EFE6]'
          : 'bg-[#E8DCC4] text-[#1C1C1C]'
      }`}
    >
      {/* HEADER */}
      <header
        className={`sticky top-0 z-30 border-b px-4 sm:px-6 h-16 flex items-center justify-between ${
          darkMode
            ? 'bg-[#181715]/95 border-[#32302B] text-[#F5EFE6]'
            : 'bg-[#E8DCC4]/95 border-[#D5C7AC] text-[#111111]'
        } backdrop-blur-sm`}
      >
        {/* Vänster: Hamburgermeny */}
        <button
          type="button"
          onClick={() => setIsLeftOpen(true)}
          aria-label="Öppna meny"
          className={`p-2 rounded-xl transition ${
            darkMode ? 'hover:bg-[#2A2824]' : 'hover:bg-[#DCD0B6]'
          }`}
        >
          <Menu className="w-6 h-6" strokeWidth={2.2} />
        </button>

        {/* Mitten: FALK-logga */}
        <button
          type="button"
          onClick={handleNewChat}
          className="text-xl sm:text-2xl font-bold tracking-[0.22em] uppercase select-none"
        >
          FALK
        </button>

        {/* Höger: Plus (ny chatt) + Glödlampa (Insikter & Påminnelser) */}
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={handleNewChat}
            title="Ny chatt"
            aria-label="Ny chatt"
            className={`p-2 rounded-xl transition ${
              darkMode ? 'hover:bg-[#2A2824]' : 'hover:bg-[#DCD0B6]'
            }`}
          >
            <Plus className="w-6 h-6" strokeWidth={2.2} />
          </button>

          <button
            type="button"
            onClick={() => {
              if (!isPremium) {
                openPaywall(
                  'Insikter och påminnelser från dina samtal ingår i FALK Premium.'
                );
              } else {
                setIsRightOpen(true);
              }
            }}
            title="Insikter & Påminnelser"
            aria-label="Öppna Insikter och Påminnelser"
            className={`relative p-2 rounded-xl transition ${
              darkMode ? 'hover:bg-[#2A2824]' : 'hover:bg-[#DCD0B6]'
            }`}
          >
            <Lightbulb className="w-6 h-6" strokeWidth={2} />
            {isPremium && insights.length + reminders.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#C57B57]" />
            )}
          </button>
        </div>
      </header>

      {/* HUVUDINNEHÅLL */}
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 pt-6 pb-36 flex flex-col">
        {activeView === 'chat' && (
          <>
            {/* VÄLKOMSTKORT + KOMPASSKALIBRERING */}
            {showWelcomeCard && messages.length === 0 && (
              <section
                className={`relative rounded-2xl p-6 sm:p-7 mb-6 border shadow-sm ${
                  darkMode
                    ? 'bg-[#23221F] border-[#383630] text-[#F5EFE6]'
                    : 'bg-[#FAF7F0] border-[#DFD4BE] text-[#1C1C1C]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setShowWelcomeCard(false)}
                  aria-label="Stäng välkomstkort"
                  className="absolute top-4 right-4 p-1.5 rounded-lg opacity-60 hover:opacity-100 transition"
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-2 text-xs font-semibold tracking-wider uppercase text-[#C57B57] mb-2">
                  <Compass className="w-4 h-4" />
                  <span>KORSNINGEN / DIN NAVIGATIONSSTART</span>
                </div>

                <h1 className="text-lg sm:text-xl font-bold mb-2">
                  Välkommen till The Human Navigation System™
                </h1>

                <p
                  className={`text-sm leading-relaxed mb-5 ${
                    darkMode ? 'text-[#CFC8BC]' : 'text-[#4A4740]'
                  }`}
                >
                  FALK mäter inte framgång i prestation eller tempo, utan i
                  riktning och medvetenhet. Ska vi göra en 3-minuters
                  kompasskalibrering för dina 4 kompasser?
                </p>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setCalibrationView('wizard');
                      setIsCalibrationOpen(true);
                    }}
                    className="px-4 py-2.5 rounded-xl bg-[#4E5C4B] hover:bg-[#3F4B3D] text-white text-sm font-medium transition shadow-sm"
                  >
                    Starta Kompasskalibrering™ →
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCalibrationView('overview');
                      setIsCalibrationOpen(true);
                    }}
                    className={`px-4 py-2.5 rounded-xl border text-sm font-medium transition ${
                      darkMode
                        ? 'border-[#3E3C35] bg-[#2C2A26] hover:bg-[#35332E] text-[#F5EFE6]'
                        : 'border-[#D5C7AC] bg-[#F2ECE0] hover:bg-[#E7DEC9] text-[#2C2A25]'
                    }`}
                  >
                    Visa mina 4 Kompasser
                  </button>
                </div>
              </section>
            )}

            {/* 9 ONBOARDINGKORT (VISAS INNAN FÖRSTA MEDDELANDET) */}
            {messages.length === 0 && (
              <section className="space-y-2.5 mb-6">
                {ONBOARDING_CARDS.map((card) => (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => handleSendMessage(card.prompt)}
                    className={`w-full text-left rounded-2xl px-5 py-4 border transition shadow-xs hover:translate-y-[-1px] ${
                      darkMode
                        ? 'bg-[#23221F] border-[#383630] hover:border-[#C57B57]/60'
                        : 'bg-[#FAF7F0] border-[#DFD4BE] hover:border-[#C57B57]'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-semibold text-sm sm:text-base mb-1">
                      <span>{card.icon}</span>
                      <span>{card.title}</span>
                    </div>
                    <p
                      className={`text-xs sm:text-sm italic ${
                        darkMode ? 'text-[#B8B0A2]' : 'text-[#5A554C]'
                      }`}
                    >
                      &ldquo;{card.prompt}&rdquo;
                    </p>
                  </button>
                ))}
              </section>
            )}

            {/* CHATTFLÖDE */}
            <div className="space-y-6">
              {messages.map((msg, idx) => {
                const isUser = msg.sender === 'user';
                const variants = msg.variants || [
                  { content: msg.content, mode: 'default' },
                ];
                const activeIdx = msg.activeVariantIndex ?? 0;
                const displayContent =
                  variants[activeIdx]?.content || msg.content;

                if (isUser) {
                  return (
                    <div key={msg.id} className="flex justify-end">
                      <div className="max-w-[82%] rounded-2xl rounded-br-sm px-5 py-3.5 bg-[#4E5C4B] text-white text-sm sm:text-base leading-relaxed shadow-xs whitespace-pre-wrap">
                        {displayContent}
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={msg.id} className="flex flex-col items-start">
                    <span
                      className={`text-[11px] font-semibold tracking-widest uppercase mb-1.5 ml-1 ${
                        darkMode ? 'text-[#A89F91]' : 'text-[#6E675C]'
                      }`}
                    >
                      FALK
                    </span>

                    {/* Vit bubbla med svart text (standard) */}
                    <div
                      className={`max-w-[90%] rounded-2xl rounded-bl-sm px-5 py-4 text-sm sm:text-base leading-relaxed shadow-xs border ${
                        darkMode
                          ? 'bg-[#252420] border-[#383630] text-[#F5EFE6]'
                          : 'bg-white border-[#E4DAC7] text-[#1C1C1C]'
                      }`}
                    >
                      <div className="whitespace-pre-wrap">{displayContent}</div>

                      {/* Svarskarusell om flera varianter finns i samma bubbla */}
                      {variants.length > 1 && (
                        <div
                          className={`mt-3 pt-2.5 border-t flex items-center justify-between text-xs ${
                            darkMode
                              ? 'border-[#383630] text-[#B8B0A2]'
                              : 'border-[#EFE7D8] text-[#6E675C]'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleSwitchVariant(msg.id, -1)}
                              aria-label="Föregående svar"
                              className="p-1 rounded hover:bg-black/5"
                            >
                              <ChevronLeft className="w-3.5 h-3.5" />
                            </button>
                            <span className="font-medium">
                              Svar {activeIdx + 1} / {variants.length}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleSwitchVariant(msg.id, 1)}
                              aria-label="Nästa svar"
                              className="p-1 rounded hover:bg-black/5"
                            >
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <span className="opacity-75">
                            {variants[activeIdx]?.mode === 'longer'
                              ? 'Fördjupat'
                              : variants[activeIdx]?.mode === 'shorter'
                              ? 'Kortare'
                              : variants[activeIdx]?.mode === 'regenerate'
                              ? 'Alternativ'
                              : 'Original'}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* DE 9 SVARSIKONERNA UNDER VARJE FALK-MEDDELANDE */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-2 ml-1">
                      {/* 1. Högtalare (TTS - Öppen för gäst) */}
                      <button
                        type="button"
                        onClick={() => handleToggleSpeak(msg)}
                        title={
                          speakingMessageId === msg.id
                            ? 'Stoppa uppläsning'
                            : 'Läs upp svar'
                        }
                        className={`p-1.5 rounded-lg transition ${
                          speakingMessageId === msg.id
                            ? 'bg-[#C57B57] text-white'
                            : darkMode
                            ? 'text-[#B8B0A2] hover:bg-[#2A2824]'
                            : 'text-[#5A544B] hover:bg-[#DCD0B6]'
                        }`}
                      >
                        {speakingMessageId === msg.id ? (
                          <VolumeX className="w-4 h-4" />
                        ) : (
                          <Volume2 className="w-4 h-4" />
                        )}
                      </button>

                      {/* 2. Nytt svar (Karusell - Öppen för gäst) */}
                      <button
                        type="button"
                        onClick={() =>
                          handleGenerateVariation(msg, idx, 'regenerate')
                        }
                        disabled={variationLoadingId === msg.id}
                        title="Nytt svar (alternativ formulering)"
                        className={`p-1.5 rounded-lg transition ${
                          darkMode
                            ? 'text-[#B8B0A2] hover:bg-[#2A2824]'
                            : 'text-[#5A544B] hover:bg-[#DCD0B6]'
                        } disabled:opacity-40`}
                      >
                        <RefreshCw
                          className={`w-4 h-4 ${
                            variationLoadingId === msg.id ? 'animate-spin' : ''
                          }`}
                        />
                      </button>

                      {/* 3. Tumme upp (Öppen för gäst) */}
                      <button
                        type="button"
                        onClick={() => handleFeedbackClick(msg, 'positive')}
                        title="Bra svar"
                        className={`p-1.5 rounded-lg transition ${
                          msg.feedback === 'up'
                            ? 'text-[#4E5C4B] bg-[#A8BFA1]/30'
                            : darkMode
                            ? 'text-[#B8B0A2] hover:bg-[#2A2824]'
                            : 'text-[#5A544B] hover:bg-[#DCD0B6]'
                        }`}
                      >
                        <ThumbsUp className="w-4 h-4" />
                      </button>

                      {/* 4. Tumme ner (Öppen för gäst) */}
                      <button
                        type="button"
                        onClick={() => handleFeedbackClick(msg, 'negative')}
                        title="Mindre bra / Rapportera"
                        className={`p-1.5 rounded-lg transition ${
                          msg.feedback === 'down'
                            ? 'text-[#C57B57] bg-[#C57B57]/20'
                            : darkMode
                            ? 'text-[#B8B0A2] hover:bg-[#2A2824]'
                            : 'text-[#5A544B] hover:bg-[#DCD0B6]'
                        }`}
                      >
                        <ThumbsDown className="w-4 h-4" />
                      </button>

                      {/* 5. Plus - Längre/djupare svar (Premium) */}
                      <button
                        type="button"
                        onClick={() =>
                          handleGenerateVariation(msg, idx, 'longer')
                        }
                        title={
                          isPremium
                            ? 'Fördjupa svaret (+)'
                            : 'Premium: Fördjupa svaret (+)'
                        }
                        className={`relative p-1.5 rounded-lg transition ${
                          darkMode
                            ? 'text-[#B8B0A2] hover:bg-[#2A2824]'
                            : 'text-[#5A544B] hover:bg-[#DCD0B6]'
                        }`}
                      >
                        <Plus className="w-4 h-4" />
                        {!isPremium && (
                          <Lock className="w-2.5 h-2.5 text-[#C57B57] absolute -top-0.5 -right-0.5" />
                        )}
                      </button>

                      {/* 6. Minus - Kortare/koncist svar (Premium) */}
                      <button
                        type="button"
                        onClick={() =>
                          handleGenerateVariation(msg, idx, 'shorter')
                        }
                        title={
                          isPremium
                            ? 'Korta ner svaret (-)'
                            : 'Premium: Korta ner svaret (-)'
                        }
                        className={`relative p-1.5 rounded-lg transition ${
                          darkMode
                            ? 'text-[#B8B0A2] hover:bg-[#2A2824]'
                            : 'text-[#5A544B] hover:bg-[#DCD0B6]'
                        }`}
                      >
                        <Minus className="w-4 h-4" />
                        {!isPremium && (
                          <Lock className="w-2.5 h-2.5 text-[#C57B57] absolute -top-0.5 -right-0.5" />
                        )}
                      </button>

                      {/* 7. Klocka - Skapa påminnelse (Premium) */}
                      <button
                        type="button"
                        onClick={() =>
                          handlePremiumActionIcon(
                            msg,
                            'reminder',
                            'Påminnelser kopplade till dina samtal ingår i FALK Premium.'
                          )
                        }
                        title={
                          isPremium
                            ? 'Skapa påminnelse'
                            : 'Premium: Skapa påminnelse'
                        }
                        className={`relative p-1.5 rounded-lg transition ${
                          darkMode
                            ? 'text-[#B8B0A2] hover:bg-[#2A2824]'
                            : 'text-[#5A544B] hover:bg-[#DCD0B6]'
                        }`}
                      >
                        <Bell className="w-4 h-4" />
                        {!isPremium && (
                          <Lock className="w-2.5 h-2.5 text-[#C57B57] absolute -top-0.5 -right-0.5" />
                        )}
                      </button>

                      {/* 8. Pin - Spara som insikt (Premium) */}
                      <button
                        type="button"
                        onClick={() =>
                          handlePremiumActionIcon(
                            msg,
                            'insight',
                            'Att spara insikter med ursprungskontext ingår i FALK Premium.'
                          )
                        }
                        title={
                          isPremium
                            ? 'Spara som insikt'
                            : 'Premium: Spara som insikt'
                        }
                        className={`relative p-1.5 rounded-lg transition ${
                          darkMode
                            ? 'text-[#B8B0A2] hover:bg-[#2A2824]'
                            : 'text-[#5A544B] hover:bg-[#DCD0B6]'
                        }`}
                      >
                        <Pin className="w-4 h-4" />
                        {!isPremium && (
                          <Lock className="w-2.5 h-2.5 text-[#C57B57] absolute -top-0.5 -right-0.5" />
                        )}
                      </button>

                      {/* 9. Måltavla - Skapa mål (Premium) */}
                      <button
                        type="button"
                        onClick={() =>
                          handlePremiumActionIcon(
                            msg,
                            'goal',
                            'Mål och utvecklingsuppföljning i Min utveckling ingår i FALK Premium.'
                          )
                        }
                        title={
                          isPremium ? 'Skapa mål' : 'Premium: Skapa mål'
                        }
                        className={`relative p-1.5 rounded-lg transition ${
                          darkMode
                            ? 'text-[#B8B0A2] hover:bg-[#2A2824]'
                            : 'text-[#5A544B] hover:bg-[#DCD0B6]'
                        }`}
                      >
                        <Target className="w-4 h-4" />
                        {!isPremium && (
                          <Lock className="w-2.5 h-2.5 text-[#C57B57] absolute -top-0.5 -right-0.5" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}

              {isSending && (
                <div className="flex flex-col items-start">
                  <span className="text-[11px] font-semibold tracking-widest uppercase mb-1.5 ml-1 opacity-60">
                    FALK
                  </span>
                  <div
                    className={`rounded-2xl px-5 py-3.5 text-sm border ${
                      darkMode
                        ? 'bg-[#252420] border-[#383630] text-[#B8B0A2]'
                        : 'bg-white border-[#E4DAC7] text-[#6E675C]'
                    }`}
                  >
                    FALK reflekterar...
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>
          </>
        )}

        {activeView === 'library' && isPremium && (
          <LibraryView
            backendUrl={backendUrl}
            getAuthHeaders={getAuthHeaders}
            darkMode={darkMode}
            onStartExercise={(card) => {
              setActiveConversationId(null);
              setMessages([]);
              handleSendMessage(card.prompt_trigger || card.title);
            }}
            onBackToChat={() => setActiveView('chat')}
          />
        )}

        {activeView === 'dashboard' && isPremium && (
          <DashboardView
            backendUrl={backendUrl}
            getAuthHeaders={getAuthHeaders}
            darkMode={darkMode}
            savedCompassScores={savedCompassScores}
            insights={insights}
            onOpenCalibration={() => {
              setCalibrationView('wizard');
              setIsCalibrationOpen(true);
            }}
            onStartReflection={(promptText) => {
              setActiveConversationId(null);
              setMessages([]);
              handleSendMessage(promptText);
            }}
            onBackToChat={() => setActiveView('chat')}
            onSyncLatestScores={setSavedCompassScores}
          />
        )}
      </main>

      {/* FAST BOTTENPANEL: 5 FOKUSREGLAGE + SKRIVFÄLT */}
      <footer
        className={`fixed bottom-0 inset-x-0 z-20 px-4 pt-2 pb-3 ${
          darkMode
            ? 'bg-gradient-to-t from-[#181715] via-[#181715]/95 to-transparent'
            : 'bg-gradient-to-t from-[#E8DCC4] via-[#E8DCC4]/95 to-transparent'
        }`}
      >
        <div className="max-w-3xl mx-auto">
          {/* POPOVER MED DE 5 FOKUSREGLAGEN (0–100%) */}
          {isFocusOpen && (
            <div
              className={`mb-2.5 rounded-2xl p-4 border shadow-lg ${
                darkMode
                  ? 'bg-[#23221F] border-[#3A3832] text-[#F5EFE6]'
                  : 'bg-[#FAF7F0] border-[#D5C7AC] text-[#1C1C1C]'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#C57B57]">
                    Fokusreglage (0–100 %)
                  </h3>
                  <p className="text-[11px] opacity-75">
                    0 % = Standard FALK. Justera för att vikta samtalets fokus i
                    realtid.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFocusSliders(DEFAULT_FOCUS)}
                  className="text-xs underline opacity-75 hover:opacity-100"
                >
                  Återställ (0 %)
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
                {FOCUS_KEYS.map((key) => (
                  <div key={key} className="flex flex-col gap-1">
                    <div className="flex justify-between text-xs font-medium">
                      <span>{key}</span>
                      <span className="text-[#C57B57] font-semibold">
                        {focusSliders[key]}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={focusSliders[key]}
                      onChange={(e) =>
                        setFocusSliders((prev) => ({
                          ...prev,
                          [key]: Number(e.target.value),
                        }))
                      }
                      className="w-full accent-[#4E5C4B] cursor-pointer h-1.5"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SKRIVFÄLT MED MIKROFON + FOKUS-TOGGLE + SKICKA */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className={`flex items-center gap-2 rounded-2xl px-3 py-2 border shadow-sm ${
              darkMode
                ? 'bg-[#252420] border-[#3A3832]'
                : 'bg-white border-[#D5C7AC]'
            }`}
          >
            {/* Ikon 1: Mikrofon */}
            <button
              type="button"
              onClick={handleToggleMicrophone}
              title={
                isListening ? 'Stoppa röstinmatning' : 'Tala in meddelande'
              }
              aria-label="Mikrofon"
              className={`p-2 rounded-xl transition ${
                isListening
                  ? 'bg-[#C57B57] text-white animate-pulse'
                  : darkMode
                  ? 'text-[#B8B0A2] hover:bg-[#32302B]'
                  : 'text-[#5A544B] hover:bg-[#F2ECE0]'
              }`}
            >
              {isListening ? (
                <MicOff className="w-5 h-5" />
              ) : (
                <Mic className="w-5 h-5" />
              )}
            </button>

            {/* Ikon 2: Fokus-toggle (5 reglage) */}
            <button
              type="button"
              onClick={() => setIsFocusOpen((prev) => !prev)}
              title="Fokusreglage (0–100%)"
              aria-label="Fokusreglage"
              className={`relative p-2 rounded-xl transition ${
                isFocusOpen || activeFocusCount > 0
                  ? 'bg-[#A8BFA1]/35 text-[#4E5C4B]'
                  : darkMode
                  ? 'text-[#B8B0A2] hover:bg-[#32302B]'
                  : 'text-[#5A544B] hover:bg-[#F2ECE0]'
              }`}
            >
              <SlidersHorizontal className="w-5 h-5" />
              {activeFocusCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#C57B57] text-white text-[10px] font-bold flex items-center justify-center">
                  {activeFocusCount}
                </span>
              )}
            </button>

            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Dela dina tankar eller ditt dilemma med Falk..."
              className="flex-1 bg-transparent text-sm sm:text-base outline-none px-1"
            />

            <button
              type="submit"
              disabled={!inputText.trim() || isSending}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#C57B57] hover:bg-[#B46B48] disabled:opacity-45 text-white text-sm font-medium transition"
            >
              <Send className="w-4 h-4" />
              <span>Skicka</span>
            </button>
          </form>

          <div className="text-center mt-1.5 text-[10px] tracking-[0.2em] uppercase opacity-55">
            POWERED BY WAYJS
          </div>
        </div>
      </footer>

      {/* VÄNSTER & HÖGER MENY (SIDEDRAWERS) */}
      <SideDrawers
        isLeftOpen={isLeftOpen}
        onCloseLeft={() => setIsLeftOpen(false)}
        isRightOpen={isRightOpen}
        onCloseRight={() => setIsRightOpen(false)}
        activeView={activeView}
        onSelectView={(v) => setActiveView(v)}
        isLoggedIn={!isGuest}
        isPremium={isPremium}
        isDarkMode={darkMode}
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
        onTogglePinConversation={handleTogglePinConversation}
        onDeleteConversation={handleDeleteConversation}
        onExportSessionPdf={handleExportSessionPdf}
        onOpenAuth={() => setActiveModal('auth')}
        onLogout={async () => {
          await supabase.auth.signOut();
          await loadUserData();
        }}
        onOpenSettings={() => setActiveModal('settings')}
        onOpenPaywall={openPaywall}
        insights={insights}
        reminders={reminders}
        onDeleteInsight={handleDeleteInsight}
        onDeleteReminder={handleDeleteReminder}
        onOpenCreateReminder={() => {
          if (!isPremium) {
            openPaywall('Påminnelser ingår i FALK Premium.');
            return;
          }
          setSelectedMessageContent('');
          setActiveModal('reminder');
        }}
        onJumpToSession={(sessionId) => {
          setIsRightOpen(false);
          handleSelectConversation(sessionId);
        }}
      />

      {/* ALLA ACTIONMODALER (PAYWALL, AUTH 18+, FEEDBACK, PÅMINNELSE, INSIKT, MÅL, INSTÄLLNINGAR/GDPR) */}
      <ActionModals
        activeModal={activeModal}
        onClose={() => setActiveModal(null)}
        isGuest={isGuest}
        isPremium={isPremium}
        userEmail={userEmail}
        displayName={displayName}
        onAuthSuccess={loadUserData}
        onSignOut={async () => {
          await supabase.auth.signOut();
          await loadUserData();
        }}
        darkMode={darkMode}
        onToggleDarkMode={handleToggleDarkMode}
        selectedMessageContent={selectedMessageContent}
        selectedMessageId={selectedMessageId}
        currentSessionId={activeConversationId}
        feedbackSentiment={feedbackSentiment}
        paywallReason={paywallReason}
        onDataSaved={loadUserData}
      />

      {/* KOMPASSKALIBRERING MODAL */}
      <CalibrationModal
        isOpen={isCalibrationOpen}
        initialView={calibrationView}
        onClose={() => setIsCalibrationOpen(false)}
        userTier={userTier}
        backendUrl={backendUrl}
        darkMode={darkMode}
        savedScores={savedCompassScores}
        onSaved={(scores) => setSavedCompassScores(scores)}
        onExploreWithFalk={(prompt) => handleSendMessage(prompt)}
      />
    </div>
  );
}
