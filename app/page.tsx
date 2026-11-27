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
  TrendingUp,
  Users,
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
  B2B_DEVELOPMENT_AREAS,
  B2bCompassKey,
  AreaBadge,
  CalibrationExploreData,
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

function renderFormattedBoldText(text: string): React.ReactNode {
  const parts = text.split(/(\*{2}[^*]+\*{2})/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={i} className="font-bold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

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
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    (typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
      ? "http://127.0.0.1:5001"
      : "https://falk-backend.onrender.com");

  // Tema & vyer
  const [darkMode, setDarkMode] = useState(false);
  const [activeView, setActiveView] = useState<MainView>('chat');
  const [isLeftOpen, setIsLeftOpen] = useState(false);
  const [isRightOpen, setIsRightOpen] = useState(false);
  const [showWelcomeCard, setShowWelcomeCard] = useState(true);
  const [sessionMode, setSessionMode] = useState<string | null>(null);
const [cardContext, setCardContext] = useState<{
  kind: 'onboarding' | 'exercise' | 'compass_session';
  title: string;
  purpose?: string;
  steps?: string[];
} | null>(null);
  const [showSessionsDrawer, setShowSessionsDrawer] = useState(false);

  const COMPASS_SESSION_OPTIONS = [
    { id: "hitta_riktning", title: "Hitta riktning", duration: "15 min", desc: "När livet känns oklart och du vill kalibrera din kompass." },
    { id: "stora_beslut", title: "Stora beslut", duration: "30 min", desc: "Utforska ett vägval genom värderingar och andra ordningens konsekvenser." },
    { id: "relationer_fokus", title: "Relationer i fokus", duration: "30 min", desc: "När kommunikationen kärvar och du vill se nya perspektiv." },
    { id: "aterhamta_balansen", title: "Återhämta balansen", duration: "15 min", desc: "När stress och krav tar över och du behöver landa." },
    { id: "bygg_en_vana", title: "Bygg en vana", duration: "15 min", desc: "Skapa hållbar förändring genom identitet och små steg." },
    { id: "veckoreflektion", title: "Veckoreflektion", duration: "30 min", desc: "Fågelperspektiv över veckan som gått och riktning framåt." },
  ] as const;

  // Auth & användarprofil
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isPremium, setIsPremium] = useState(false);
  const [guestUuid, setGuestUuid] = useState('');
  const [guestMessageCount, setGuestMessageCount] = useState(0);

  // Web Push & In-app-larm för påminnelser
  const [pushPermission, setPushPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [dismissedPushBanner, setDismissedPushBanner] = useState(false);
  const [activeDueReminder, setActiveDueReminder] = useState<DrawerReminder | null>(null);
  const triggeredAlarmIdsRef = useRef<Set<string>>(new Set());

  const isGuest = !userId;
  const userTier: UserTier = isGuest ? 'guest' : isPremium ? 'premium' : 'free';

  // Modaler
  const [activeModal, setActiveModal] = useState<ActiveModalType>(null);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [paywallReason, setPaywallReason] = useState(
    'Lås upp hela FALK med ett Premium-medlemskap.'
  );
  const [selectedMessageContent, setSelectedMessageContent] = useState('');
  const [selectedMessageId, setSelectedMessageId] = useState('');
  const [feedbackSentiment, setFeedbackSentiment] = useState<
    'positive' | 'negative'
  >('positive');

  // Kompasskalibrering (B2C + B2B tilläggslager)
  const [isCalibrationOpen, setIsCalibrationOpen] = useState(false);
  const [calibrationView, setCalibrationView] = useState<'wizard' | 'overview'>(
    'wizard'
  );
  const [calibrationSegment, setCalibrationSegment] = useState<'b2c' | 'b2b'>('b2c');
  const [savedCompassScores, setSavedCompassScores] = useState<Record<
    string,
    number
  > | null>(null);
  const [savedB2bCompassScores, setSavedB2bCompassScores] = useState<Record<
    string,
    number
  > | null>(null);
  const [hasB2bAccess, setHasB2bAccess] = useState(false);
  const [b2bContext, setB2bContext] = useState<{
    active: boolean;
    level: 'individual' | 'leadership' | 'company';
  } | null>(null);

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
  const [seenRightDrawerKeys, setSeenRightDrawerKeys] = useState<string[]>([]);

  const getRightDrawerItemKeys = useCallback(() => {
    const insightKeys = insights.map(
      (item, idx) => `insight:${String((item as { id?: string | number }).id ?? idx)}`
    );
    const reminderKeys = reminders.map(
      (item, idx) => `reminder:${String((item as { id?: string | number }).id ?? idx)}`
    );
    return [...insightKeys, ...reminderKeys];
  }, [insights, reminders]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storageKey = userId ? `falk_seen_right_drawer_${userId}` : 'falk_seen_right_drawer';
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setSeenRightDrawerKeys(parsed.map(String));
          return;
        }
      }
    } catch {
      // Ignorera trasig localStorage-data
    }
    setSeenRightDrawerKeys([]);
  }, [userId]);

  const markRightDrawerItemsSeen = useCallback(() => {
    const currentKeys = getRightDrawerItemKeys();
    if (currentKeys.length === 0) return;
    setSeenRightDrawerKeys((prev) => {
      const merged = Array.from(new Set([...prev, ...currentKeys]));
      if (merged.length === prev.length) return prev;
      if (typeof window !== 'undefined') {
        const storageKey = userId ? `falk_seen_right_drawer_${userId}` : 'falk_seen_right_drawer';
        try {
          localStorage.setItem(storageKey, JSON.stringify(merged));
        } catch {
          // Ignorera storage-fel
        }
      }
      return merged;
    });
  }, [getRightDrawerItemKeys, userId]);

  useEffect(() => {
    if (isRightOpen) {
      markRightDrawerItemsSeen();
    }
  }, [isRightOpen, markRightDrawerItemsSeen]);

  const hasUnreadRightDrawerItems =
    isPremium &&
    getRightDrawerItemKeys().some((key) => !seenRightDrawerKeys.includes(key));

  // Fokusreglage (0-100%, default 0% = Standard FALK)
  const [focusSliders, setFocusSliders] = useState<FocusSliders>(DEFAULT_FOCUS);
  const [isFocusOpen, setIsFocusOpen] = useState(false);

  // Röstinmatning (Mikrofon) & Uppläsning (TTS)
  const [isListening, setIsListening] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(
    null
  );
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  const ttsUrlRef = useRef<string | null>(null);
  const ttsAbortRef = useRef<AbortController | null>(null);

  const stopAllSpeech = useCallback(() => {
    if (ttsAbortRef.current) {
      ttsAbortRef.current.abort();
      ttsAbortRef.current = null;
    }
    if (ttsAudioRef.current) {
      ttsAudioRef.current.pause();
      ttsAudioRef.current.src = "";
      ttsAudioRef.current = null;
    }
    if (ttsUrlRef.current) {
      URL.revokeObjectURL(ttsUrlRef.current);
      ttsUrlRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setSpeakingMessageId(null);
  }, []);

  useEffect(() => {
    return () => {
      stopAllSpeech();
    };
  }, [stopAllSpeech]);
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

    try {
      const rawB2bCal = localStorage.getItem('falk_latest_b2b_calibration');
      if (rawB2bCal) {
        const parsedB2b = JSON.parse(rawB2bCal);
        if (parsedB2b && typeof parsedB2b === 'object') {
          setSavedB2bCompassScores(parsedB2b);
        }
      }
    } catch {
      // Ignorera trasig lokal B2B-kalibreringsdata
    }

    if (typeof window !== 'undefined') {
      const initParams = new URLSearchParams(window.location.search);
      const segParam = initParams.get('segment');
      const viewParam = initParams.get('view');
      const levelParam = initParams.get('b2b_level');

      if (segParam === 'b2b') {
        const validLevel =
          levelParam === 'leadership' || levelParam === 'company'
            ? levelParam
            : 'individual';
        setB2bContext({ active: true, level: validLevel });

        if (viewParam === 'calibration') {
          setCalibrationSegment('b2b');
          setCalibrationView('wizard');
          setIsCalibrationOpen(true);
        } else if (viewParam === 'library') {
          setActiveView('library');
        } else if (levelParam === 'individual' || levelParam === 'leadership' || levelParam === 'company') {
          const introByLevel: Record<'individual' | 'leadership' | 'company', string> = {
            individual:
              "Välkommen in i ditt arbets- och självledarskapsperspektiv. Här utforskar vi din riktning, energi och kommunikation i vardagen – helt konfidentiellt för dig.\n\nVad känns viktigast att stanna upp vid i din arbetssituation just nu?",
            leadership:
              "Välkommen in i ledarskapsperspektivet. Som ledare bär man ofta både sin egen riktning och andras förväntningar i samma rum.\n\nOm vi lyfter blicken ett ögonblick: var märker du mest friktion eller behov av klarhet i ditt ledarskap just nu?",
            company:
              "Välkommen in i organisations- och företagsperspektivet. Här lyfter vi blicken till system, kultur, samarbete och långsiktig hållbarhet – utan att någonsin röra enskilda medarbetares privata samtal.\n\nVilket mönster eller vilken riktning i verksamheten vill du utforska tillsammans?",
          };
          const openingText = introByLevel[validLevel];
          setActiveConversationId(null);
          setActiveView('chat');
          setMessages([
            {
              id: `falk-b2b-init-${Date.now()}`,
              sender: 'falk',
              content: openingText,
              timestamp: new Date().toISOString(),
              variants: [{ content: openingText, mode: 'default' }],
              activeVariantIndex: 0,
              feedback: null,
            },
          ]);
        }
        window.history.replaceState({}, '', window.location.pathname);
      }
    }

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
    const fetchWithTimeout = async (
      url: string,
      options: RequestInit = {},
      timeoutMs = 15000
    ) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      try {
        return await fetch(url, { ...options, signal: controller.signal });
      } finally {
        clearTimeout(timeoutId);
      }
    };

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

    // Kontrollera om användaren har ett aktivt B2B-organisationssäte
    const { data: hasB2bSeat } = await supabase.rpc('user_has_active_b2b_seat', {
      p_user_id: user.id,
    });
    const activeB2bSeat = hasB2bSeat === true;
    setHasB2bAccess(activeB2bSeat);
    if (activeB2bSeat && !effectiveIsPremium) {
      effectiveIsPremium = true;
      setIsPremium(true);
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
          const redeemRes = await fetchWithTimeout(`${backendUrl}/api/promo/redeem`, {
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
            // Tyst fallback till B2B-inbjudningskod om det inte var en B2C-rabattkod
            try {
              const joinRes = await fetchWithTimeout(`${backendUrl}/api/b2b/join`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ code: pendingPromo }),
              });
              const joinJson = await joinRes.json().catch(() => ({}));
              if (joinRes.ok && joinJson?.ok) {
                setIsPremium(true);
              }
              if (
                joinRes.ok ||
                joinRes.status === 400 ||
                joinRes.status === 403 ||
                joinRes.status === 404 ||
                joinRes.status === 409
              ) {
                window.localStorage.removeItem('falk_pending_promo');
                window.sessionStorage.removeItem('falk_pending_promo');
              }
            } catch {
              // Behåll koden vid tillfälligt nätverksfel
            }
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
        fetchWithTimeout(`${backendUrl}/api/insights`, { headers }),
        fetchWithTimeout(`${backendUrl}/api/reminders`, { headers }),
        fetchWithTimeout(`${backendUrl}/api/calibration`, { headers }),
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
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
        setActiveModal('auth');
      }
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
    const cleanConvId = String(convId || '').trim();
    if (!cleanConvId) return;

    setActiveConversationId(cleanConvId);
    setMessages([]);
    setActiveView('chat');
    setIsLeftOpen(false);
    setShowWelcomeCard(false);

    try {
      const { data: msgRows, error } = await supabase
        .from('messages')
        .select('id, sender, content, created_at')
        .eq('conversation_id', cleanConvId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Kunde inte ladda meddelanden från Supabase:', error.message);
        setMessages([
          {
            id: `err-${Date.now()}`,
            sender: 'falk',
            content: 'Kunde inte hämta historiken för den här sessionen just nu. Kontrollera behörighet eller försök igen.',
            timestamp: new Date().toISOString(),
            variants: [{ content: 'Kunde inte hämta historiken för den här sessionen just nu.', mode: 'default' }],
            activeVariantIndex: 0,
            feedback: null,
          },
        ]);
        return;
      }

      const sortedRows = [...(msgRows || [])].sort((a: any, b: any) => {
        const tA = a.created_at || '';
        const tB = b.created_at || '';
        if (tA !== tB) return tA.localeCompare(tB);
        const orderA = a.sender === 'user' ? 0 : 1;
        const orderB = b.sender === 'user' ? 0 : 1;
        if (orderA !== orderB) return orderA - orderB;
        return String(a.id || '').localeCompare(String(b.id || ''));
      });

      const mapped: Message[] = sortedRows.map((m: any) => {
        const rawRole = m.role ?? m.sender;
        const isUser = rawRole === 'user';
        return {
          id: String(m.id),
          sender: isUser ? 'user' : 'falk',
          content: m.content,
          timestamp: m.created_at || new Date().toISOString(),
          variants: !isUser ? [{ content: m.content, mode: 'default' }] : undefined,
          activeVariantIndex: 0,
          feedback: null,
        };
      });
      setMessages(mapped);
    } catch (err) {
      console.error('Fel vid laddning av session:', err);
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
    setSessionMode(null);
    setCardContext(null);
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
    await handleDeleteConversations([id]);
  };

  // Radera flera eller alla sessioner
  const handleDeleteConversations = async (ids: string[]) => {
    const uniqueIds = Array.from(new Set(ids)).filter(Boolean);
    if (uniqueIds.length === 0) return;

    const { data: msgRows } = await supabase
      .from('messages')
      .select('id')
      .in('conversation_id', uniqueIds);
    const msgIds = (msgRows || []).map((r: any) => r.id).filter(Boolean);
    if (msgIds.length > 0) {
      await supabase.from('message_feedback').delete().in('message_id', msgIds);
    }

    const { error: msgErr } = await supabase
      .from('messages')
      .delete()
      .in('conversation_id', uniqueIds);
    if (msgErr) {
      console.error('Fel vid radering av meddelanden:', msgErr);
    }

    const { error: convErr } = await supabase
      .from('conversations')
      .delete()
      .in('id', uniqueIds);
    if (convErr) {
      console.error('Fel vid radering av konversationer:', convErr);
      return;
    }

    if (activeConversationId && uniqueIds.includes(activeConversationId)) {
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

  // Öppna FALKs sammanfattning direkt efter kompasskalibrering (utan användarbubbla)
  const handleExploreCalibration = (data: CalibrationExploreData) => {
    const { compassScores, areaScores, segment } = data;
    const isB2b = segment === 'b2b';

    if (isB2b) {
      setB2bContext((prev) => ({
        active: true,
        level: prev?.level || 'individual',
      }));
    }

    const activeAreas = isB2b ? B2B_DEVELOPMENT_AREAS : DEVELOPMENT_AREAS;
    const sortedBadges: AreaBadge[] = [...activeAreas]
      .map((a) => ({
        name: a.name,
        score: areaScores[a.name] ?? 60,
        compass: a.compass as AreaBadge['compass'],
      }))
      .sort((a, b) => a.score - b.score);

    const lowest = sortedBadges[0];
    const highest = sortedBadges[sortedBadges.length - 1];

    const summaryText = isB2b
      ? `Jag har tagit del av din B2B-kompasskalibrering och lyfter blicken för att se helheten i din arbetssituation just nu.\n\n` +
        `Dina fyra arbetskompasser ligger på Självledarskap ${(compassScores as Record<B2bCompassKey, number>).b2b_self_leadership ?? 60}%, Team & Tillit ${(compassScores as Record<B2bCompassKey, number>).b2b_team_trust ?? 60}%, Hållbar Energi ${(compassScores as Record<B2bCompassKey, number>).b2b_sustainable_energy ?? 60}% och Riktning & Kultur ${(compassScores as Record<B2bCompassKey, number>).b2b_direction_culture ?? 60}%.\n\n` +
        `Just nu tar ${lowest.name} (${lowest.score}%) mest utrymme att utforska vidare, medan ${highest.name} (${highest.score}%) ser ut att ha en stabilare grund.\n\n` +
        `Välj ett av utvecklingsområdena nedan som du vill utforska tillsammans, öppna en guidad B2B-övning i biblioteket, eller skriv fritt vad som känns viktigast för dig just nu.`
      : `Jag har tagit del av din kompasskalibrering och lyfter blicken för att se helheten just nu.\n\n` +
        `Dina fyra kompasser ligger på Personlig ${compassScores.Personlig ?? 60}%, Relation ${compassScores.Relation ?? 60}%, Arbete ${compassScores.Arbete ?? 60}% och Liv ${compassScores.Liv ?? 60}%.\n\n` +
        `Just nu tar ${lowest.name} (${lowest.score}%) mest utrymme att utforska vidare, medan ${highest.name} (${highest.score}%) ser ut att ha en stabilare grund.\n\n` +
        `Välj ett av utvecklingsområdena nedan som du vill utforska tillsammans, eller skriv fritt vad som känns viktigast för dig just nu.`;

    const falkSummaryMsg: Message = {
      id: `falk-cal-${Date.now()}`,
      sender: 'falk',
      content: summaryText,
      timestamp: new Date().toISOString(),
      variants: [{ content: summaryText, mode: 'default' }],
      activeVariantIndex: 0,
      feedback: null,
      areaBadges: sortedBadges,
    };

    setActiveConversationId(null);
    setInputText('');
    setIsFocusOpen(false);
    setActiveView('chat');
    setMessages([falkSummaryMsg]);
  };

  // Hjälpfunktion: konvertera VAPID base64url till Uint8Array
  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  // Registrera /sw.js och synka Web Push-prenumeration med backend
  const registerWebPushSubscription = useCallback(async (requestPermissionIfDefault = false) => {
    if (typeof window === 'undefined' || isGuest || !isPremium) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setPushPermission('unsupported');
      return;
    }
    try {
      let perm: NotificationPermission = Notification.permission;
      if (perm === 'default' && requestPermissionIfDefault) {
        perm = await Notification.requestPermission();
      }
      setPushPermission(perm);
      if (perm !== 'granted') return;

      const reg = await navigator.serviceWorker.register('/sw.js');
      await reg.update().catch(() => {});
      await navigator.serviceWorker.ready;

      const headers = await getAuthHeaders();
      const keyRes = await fetch(`${backendUrl}/api/push/vapid-public-key`, { headers });
      if (!keyRes.ok) return;
      const keyJson = await keyRes.json().catch(() => ({}));
      const publicKey = keyJson?.public_key || keyJson?.vapid_public_key;
      if (!publicKey) return;

      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      }

      const subJson = sub.toJSON();
      const saveRes = await fetch(`${backendUrl}/api/push/subscribe`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          keys: subJson.keys,
          user_agent: navigator.userAgent,
        }),
      });
      if (saveRes.ok) {
        setPushSubscribed(true);
      }
    } catch {
      // Tyst fallback till in-app-larm om webbläsaren blockerar push
    }
  }, [backendUrl, isGuest, isPremium]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window)) {
      setPushPermission('unsupported');
      return;
    }
    setPushPermission(Notification.permission);
    try {
      const saved = JSON.parse(localStorage.getItem('falk_triggered_alarms') || '[]');
      if (Array.isArray(saved)) {
        triggeredAlarmIdsRef.current = new Set(saved.map(String));
      }
    } catch {}
    if (!isGuest && isPremium && Notification.permission === 'granted') {
      registerWebPushSubscription(false);
    }
  }, [isGuest, isPremium, registerWebPushSubscription]);

  // Spela en mjuk, lugn FALK-klang vid in-app-larm
  const playSoftReminderChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      [523.25, 659.25].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.18);
        gain.gain.setValueAtTime(0.001, now + idx * 0.18);
        gain.gain.exponentialRampToValueAtTime(0.08, now + idx * 0.18 + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.18 + 0.55);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.18);
        osc.stop(now + idx * 0.18 + 0.6);
      });
    } catch {}
  };

  // Bevaka förfallna påminnelser i realtid (in-app-larm var 20:e sekund)
  useEffect(() => {
    if (isGuest || !isPremium || reminders.length === 0) return;

    const checkDueReminders = () => {
      const nowMs = Date.now();
      for (const r of reminders) {
        const raw = r as unknown as Record<string, unknown>;
        const rawTime = raw.remind_at || raw.due_at || raw.scheduled_for;
        if (!rawTime) continue;
        const dueMs = new Date(String(rawTime)).getTime();
        if (Number.isNaN(dueMs)) continue;
        const remId = String(raw.id || dueMs);
        if (dueMs <= nowMs && nowMs - dueMs < 24 * 60 * 60 * 1000 && !triggeredAlarmIdsRef.current.has(remId)) {
          triggeredAlarmIdsRef.current.add(remId);
          try {
            localStorage.setItem('falk_triggered_alarms', JSON.stringify(Array.from(triggeredAlarmIdsRef.current).slice(-100)));
          } catch {}
          setActiveDueReminder(r);
          playSoftReminderChime();
          const bodyText = String(raw.title || raw.context || raw.note || 'Dags för din reflektion eller ditt nästa steg.');
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            try {
              new Notification('FALK – Påminnelse', {
                body: bodyText,
                icon: '/favicon.ico',
                tag: `falk-inapp-${remId}`,
              });
            } catch {}
          }
          break;
        }
      }
    };

    checkDueReminders();
    const interval = window.setInterval(checkDueReminders, 20000);
    return () => window.clearInterval(interval);
  }, [isGuest, isPremium, reminders]);

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
      const isFinalCompassTrigger =
        text.startsWith("Avsluta med The Final Compass") ||
        text.includes("[FINAL_COMPASS]");
      const payload = {
        message: text,
        display_name: displayName.trim() || undefined,
        session_mode: sessionMode || undefined,
        card_context: cardContext || undefined,
        final_compass: isFinalCompassTrigger || undefined,
        conversation_id: activeConversationId,
        session_id: activeConversationId,
        focus_sliders: focusSliders,
        is_guest: isGuest,
        guest_uuid: guestUuid || getOrCreateGuestUuid(),
        ...(b2bContext?.active ? { b2b_context: b2bContext } : {}),
        history: nextHistory.slice(-10).map((m) => ({
          role: m.sender === 'user' ? 'user' : 'assistant',
          content:
            m.variants && typeof m.activeVariantIndex === 'number'
              ? m.variants[m.activeVariantIndex]?.content || m.content
              : m.content,
        })),
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000);
      let res: Response;
      try {
        res = await fetch(`${backendUrl}/api/chat`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

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
      setIsSending(false);

      if (isGuest) {
        const todayKey = `falk_guest_msg_count_${new Date().toISOString().slice(0, 10)}`;
        const prevToday = Number(localStorage.getItem(todayKey) || '0');
        const updatedCount = (Number.isNaN(prevToday) ? 0 : prevToday) + 1;
        setGuestMessageCount(updatedCount);
        localStorage.setItem(todayKey, String(updatedCount));
      } else {
        await loadUserData();
        if (data?.reminder && isPremium) {
          void registerWebPushSubscription(Notification.permission === 'default');
        }
      }
    } catch (err) {
      const isTimeout =
        err instanceof Error &&
        (err.name === 'AbortError' || err.message.toLowerCase().includes('abort'));
      const errText = isTimeout
        ? 'FALK startar upp eller svarar långsammare än vanligt just nu. Vänta några sekunder och försök igen.'
        : err instanceof Error
        ? err.message
        : 'Ett oväntat fel uppstod.';
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

  // TTS (Högtalare - ikon 1 av 9: OpenAI TTS för Premium/B2B, Web Speech fallback för Gäst)
  const handleToggleSpeak = async (msg: Message) => {
    if (speakingMessageId === msg.id) {
      stopAllSpeech();
      return;
    }

    stopAllSpeech();
    const activeText =
      msg.variants && typeof msg.activeVariantIndex === 'number'
        ? msg.variants[msg.activeVariantIndex]?.content || msg.content
        : msg.content;

    const speakWithWebSpeech = () => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        setSpeakingMessageId(null);
        return;
      }
      const utterance = new SpeechSynthesisUtterance(activeText);
      utterance.lang = 'sv-SE';
      utterance.rate = 0.96;
      utterance.onend = () => setSpeakingMessageId(null);
      utterance.onerror = () => setSpeakingMessageId(null);
      setSpeakingMessageId(msg.id);
      window.speechSynthesis.speak(utterance);
    };

    if (!isPremium || isGuest) {
      speakWithWebSpeech();
      return;
    }

    let selectedVoice = 'onyx';
    try {
      const storedVoice = localStorage.getItem('falk_tts_voice');
      if (storedVoice) selectedVoice = storedVoice;
    } catch {
      // Ignorera storage-fel
    }

    const controller = new AbortController();
    ttsAbortRef.current = controller;
    setSpeakingMessageId(msg.id);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) {
        if (!controller.signal.aborted) speakWithWebSpeech();
        return;
      }

      const res = await fetch(`${backendUrl}/api/tts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: activeText.slice(0, 1500),
          voice: selectedVoice,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error('TTS API error');
      }

      const blob = await res.blob();
      if (controller.signal.aborted) return;

      const url = URL.createObjectURL(blob);
      ttsUrlRef.current = url;
      const audio = new Audio(url);
      ttsAudioRef.current = audio;
      audio.onended = () => stopAllSpeech();
      audio.onerror = () => stopAllSpeech();
      await audio.play();
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      if (!controller.signal.aborted) {
        speakWithWebSpeech();
      }
    }
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

  const [dailyMoodEnabled, setDailyMoodEnabled] = useState<boolean>(false);
  const [showDailyMoodPopup, setShowDailyMoodPopup] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const todayKey = new Date().toISOString().slice(0, 10);
    const syncAndCheck = () => {
      try {
        const enabled = window.localStorage.getItem('falk_daily_mood_popup_enabled') === 'true';
        setDailyMoodEnabled(enabled);
        const lastShown = window.localStorage.getItem('falk_daily_mood_last_shown_date') || '';
        if (enabled && lastShown !== todayKey) {
          setShowDailyMoodPopup(true);
        } else if (!enabled) {
          setShowDailyMoodPopup(false);
        }
      } catch {
        // ignore storage errors
      }
    };
    syncAndCheck();
    const onToggleEvent = () => syncAndCheck();
    window.addEventListener('falk:daily-mood-toggle', onToggleEvent);
    return () => window.removeEventListener('falk:daily-mood-toggle', onToggleEvent);
  }, []);

  const DAILY_MOOD_OPTIONS: Array<{
    id: string;
    label: string;
    hint: string;
    focusPatch: Record<string, number>;
    promptNote: string;
  }> = [
    {
      id: 'grounded_clear',
      label: '1. Stadig & klar',
      hint: 'God riktning och lugn bas — kalibrerar mot inre riktning & mod.',
      focusPatch: { motivation: 70, handlingskraft: 60, stresshantering: 20 },
      promptNote: 'Min dagsform idag är stadig och klar. Hjälp mig kalibrera kompassen mot min riktning och nästa kloka steg.',
    },
    {
      id: 'flowing_motivated',
      label: '2. Framåtriktad & engagerad',
      hint: 'Hög energi och vilja — kalibrerar mot handlingskraft & Mikromod.',
      focusPatch: { handlingskraft: 80, motivation: 75, stresshantering: 25 },
      promptNote: 'Min dagsform idag är framåtriktad och engagerad. Hjälp mig omsätta energi till ett tydligt litet steg.',
    },
    {
      id: 'mixed_shifting',
      label: '3. Skiftande / mitt emellan',
      hint: 'Blandade signaler — kalibrerar kompassen för att sortera läget.',
      focusPatch: { sjalvfortroende: 55, motivation: 50, stresshantering: 45 },
      promptNote: 'Min dagsform idag är lite skiftande. Hjälp mig stanna upp och sortera vad som är viktigast i min kompass just nu.',
    },
    {
      id: 'stretched_boundaries',
      label: '4. Pressad / behov av gränser',
      hint: 'Ytterkrav eller högt tempo — kalibrerar mot gränssättning & återhämtning.',
      focusPatch: { granssattning: 75, stresshantering: 70 },
      promptNote: 'Min dagsform idag känns pressad med behov av tydligare gränser. Hjälp mig kalibrera kompassen runt vad jag behöver säga ja eller nej till.',
    },
    {
      id: 'heavy_drained',
      label: '5. Tung & trött (behöver lugn)',
      hint: 'Låg energi / belastning — sänker tempot och kalibrerar mot stresshantering.',
      focusPatch: { stresshantering: 85, granssattning: 60 },
      promptNote: 'Min dagsform idag är tung och trött. Möts mig lugnt och hjälp mig kalibrera kompassen för återhämtning.',
    },
  ];

  const handleSelectDailyMood = (
    opt: {
      id: string;
      label: string;
      hint: string;
      focusPatch: Record<string, number>;
      promptNote: string;
    },
    options?: { openCalibration?: boolean; startChat?: boolean }
  ) => {
    const todayKey = new Date().toISOString().slice(0, 10);
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('falk_daily_mood_last_shown_date', todayKey);
        window.localStorage.setItem('falk_daily_mood_today', opt.id);
      }
    } catch {
      // ignore storage errors
    }
    setFocusSliders((prev: any) => ({
      ...(prev && typeof prev === 'object' ? prev : {}),
      ...opt.focusPatch,
    }));
    setShowDailyMoodPopup(false);
    if (options?.openCalibration) {
      setIsCalibrationOpen(true);
    } else if (options?.startChat) {
      setActiveView('chat');
      handleSendMessage(opt.promptNote);
    }
  };

  const handleDismissDailyMoodPopup = () => {
    const todayKey = new Date().toISOString().slice(0, 10);
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('falk_daily_mood_last_shown_date', todayKey);
      }
    } catch {
      // ignore storage errors
    }
    setShowDailyMoodPopup(false);
  };


  return (
    <div
      className={`min-h-[100dvh] flex flex-col transition-colors ${
        darkMode
          ? 'bg-[#181715] text-[#F5EFE6]'
          : 'bg-[#E8DCC4] text-[#1C1C1C]'
      }`}
    >
      {/* HEADER */}
      <header
        className={`fixed top-0 left-0 right-0 z-30 border-b px-4 sm:px-6 pt-[env(safe-area-inset-top,0px)] h-[calc(4rem+env(safe-area-inset-top,0px))] flex items-center justify-between ${
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
          className="absolute left-1/2 -translate-x-1/2 text-xl sm:text-2xl font-bold tracking-[0.22em] uppercase select-none"
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
                markRightDrawerItemsSeen();
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
            {hasUnreadRightDrawerItems && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#C57B57]" />
            )}
          </button>
        </div>
      </header>

      {/* HUVUDINNEHÅLL */}
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 pt-[calc(5.5rem+env(safe-area-inset-top,0px))] pb-44 flex flex-col">
        {/* IN-APP-LARM FÖR FÖRFALLEN PÅMINNELSE */}
        {activeDueReminder && (() => {
          const dueRaw = activeDueReminder as unknown as Record<string, unknown>;
          const dueTitle = String(dueRaw.title || dueRaw.context || dueRaw.note || 'Du har en planerad påminnelse.');
          const dueSub = dueRaw.title && (dueRaw.context || dueRaw.note) ? String(dueRaw.context || dueRaw.note) : '';
          return (
            <div
              role="alert"
              className={`mb-4 rounded-2xl p-4 border shadow-md flex items-start justify-between gap-3 transition ${
                darkMode
                  ? 'bg-[#23221F] border-[#C57B57] text-[#F5EFE6]'
                  : 'bg-[#FAF7F0] border-[#C57B57] text-[#1C1C1C]'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 p-2 rounded-xl bg-[#C57B57]/15 text-[#C57B57]">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#C57B57]">
                    Påminnelse från FALK
                  </div>
                  <p className="text-sm font-medium mt-0.5">{dueTitle}</p>
                  {dueSub && <p className="text-xs opacity-75 mt-0.5">{dueSub}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setActiveDueReminder(null);
                    setIsRightOpen(true);
                  }}
                  className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-[#4E5C4B] text-white hover:opacity-90 transition"
                >
                  Visa
                </button>
                <button
                  type="button"
                  onClick={() => setActiveDueReminder(null)}
                  aria-label="Stäng larm"
                  className="p-1.5 rounded-lg opacity-70 hover:opacity-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })()}

        {/* DISKRET INBJUDAN ATT AKTIVERA BAKGRUNDS-PUSH NÄR PÅMINNELSER FINNS */}
        {!isGuest && isPremium && reminders.length > 0 && pushPermission === 'default' && !pushSubscribed && !dismissedPushBanner && (
          <div
            className={`mb-4 rounded-2xl px-4 py-3 border flex flex-wrap items-center justify-between gap-2 text-xs ${
              darkMode
                ? 'bg-[#23221F] border-[#383630] text-[#E8DCC4]'
                : 'bg-[#FAF7F0] border-[#DFD4BE] text-[#1C1C1C]'
            }`}
          >
            <span className="flex items-center gap-2">
              <Bell className="w-3.5 h-3.5 text-[#C57B57] shrink-0" />
              <span>Vill du få påminnelser från FALK även när appen är stängd?</span>
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => registerWebPushSubscription(true)}
                className="px-3 py-1 rounded-full bg-[#4E5C4B] text-white font-medium hover:opacity-90 transition"
              >
                Aktivera notiser
              </button>
              <button
                type="button"
                onClick={() => setDismissedPushBanner(true)}
                aria-label="Avfärda"
                className="opacity-60 hover:opacity-100 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
        {activeView === 'chat' && (
          <>
            {/* VÄLKOMSTKORT + KOMPASSKALIBRERING */}
            {!activeConversationId && showWelcomeCard && messages.length === 0 && (
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

                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 text-xs font-semibold tracking-wider uppercase text-[#C57B57]">
                    <Compass className="w-4 h-4" />
                    <span>KORSNINGEN / DIN NAVIGATIONSSTART</span>
                  </div>
                  <span
                    className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                      darkMode
                        ? 'bg-[#2B2925] border-[#44413A] text-[#E8DCC4]'
                        : 'bg-white border-[#DFD4BE] text-[#4E5C4B]'
                    }`}
                  >
                    Läge: Enskilt samtal
                  </span>
                </div>

                <h1 className="text-lg sm:text-xl font-bold mb-2">
                  Kompassen
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
                    Starta kompasskalibrering
                  </button>
                </div>
              </section>
            )}

            {/* COMPASS SESSIONS™ (GUIDADE MENTORSESSIONER – FALK BIBLE KAP. 6) */}
            {!activeConversationId && messages.length === 0 && (
              <div className="mb-5">
                <div className="flex items-center justify-between mb-2 px-1">
                  <button
                    type="button"
                    onClick={() => setShowSessionsDrawer((v) => !v)}
                    className={`text-xs font-semibold tracking-wider uppercase flex items-center gap-1.5 transition ${
                      darkMode ? "text-[#C57B57] hover:text-[#E8DCC4]" : "text-[#4E5C4B] hover:opacity-80"
                    }`}
                  >
                    <span>🧭 Kompass-sessioner™ (Guidade mentorsessioner)</span>
                    <span>{showSessionsDrawer ? "▲" : "▼"}</span>
                  </button>
                  {sessionMode && (
                    <button
                      type="button"
                      onClick={() => setSessionMode(null)}
                      className="text-xs underline opacity-75 hover:opacity-100"
                    >
                      Avsluta sessionsläge
                    </button>
                  )}
                </div>

                {showSessionsDrawer && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-2">
                    {COMPASS_SESSION_OPTIONS.map((opt) => {
                      const active = sessionMode === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            if (isGuest) {
                              openPaywall("Compass Sessions™ är en guidad mentorfunktion för Premium-medlemmar.");
                              return;
                            }
                            setSessionMode(opt.id);
                setCardContext({
                  kind: 'compass_session',
                  title: opt.title,
                  purpose: opt.desc,
                });
                setShowWelcomeCard(false);
                handleSendMessage(`Jag vill starta en guidad Kompass-session: ${opt.title} (${opt.duration}).`);
                          }}
                          className={`text-left p-3.5 rounded-2xl border transition ${
                            active
                              ? "border-[#C57B57] bg-[#C57B57]/15"
                              : darkMode
                              ? "border-[#383630] bg-[#23221F] hover:border-[#C57B57]/60"
                              : "border-[#DFD4BE] bg-[#FAF7F0] hover:border-[#4E5C4B]"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-sm">{opt.title}</span>
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#4E5C4B]/15 text-[#4E5C4B] dark:text-[#A8BFA1]">
                              {opt.duration}
                            </span>
                          </div>
                          <p className="text-xs opacity-80 mt-1 leading-relaxed">{opt.desc}</p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 9 ONBOARDINGKORT (VISAS INNAN FÖRSTA MEDDELANDET) */}
            {!activeConversationId && messages.length === 0 && (
              <section className="space-y-2.5 mb-6">
                {ONBOARDING_CARDS.map((card) => (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => {
                setCardContext({
                  kind: 'onboarding',
                  title: card.title,
                  purpose: card.prompt,
                });
                handleSendMessage(card.prompt);
              }}
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

            {/* AKTIV COMPASS SESSION & THE FINAL COMPASS™ (FALK BIBLE KAP. 4 & 6) */}
            {messages.length > 0 && (sessionMode || messages.filter((m) => m.sender === "user").length >= 3) && (
              <div className="mb-3 px-1 flex flex-wrap items-center justify-between gap-2">
                {sessionMode ? (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-[#4E5C4B]/15 text-[#4E5C4B] dark:text-[#A8BFA1] font-medium">
                    🧭 Aktiv Kompass-session: {COMPASS_SESSION_OPTIONS.find((o) => o.id === sessionMode)?.title || sessionMode}
                  </span>
                ) : (
                  <span />
                )}
                {!isGuest && messages.filter((m) => m.sender === "user").length >= 3 && (
                  <button
                    type="button"
                    disabled={isSending}
                    onClick={() =>
                      handleSendMessage(
                        "Avsluta med The Final Compass™: sammanfatta vad vi har förstått, vad som verkar viktigast, vilket perspektiv som saknades från början, vad som känns mest sant för mig nu och vad mitt nästa steg blir."
                      )
                    }
                    className={`text-xs px-3 py-1.5 rounded-full border transition ${
                      darkMode
                        ? "border-[#C57B57]/50 text-[#E8DCC4] hover:bg-[#C57B57]/20"
                        : "border-[#4E5C4B]/40 text-[#4E5C4B] bg-[#FAF7F0] hover:bg-[#4E5C4B] hover:text-white"
                    }`}
                  >
                    🧭 Avsluta med The Final Compass™
                  </button>
                )}
              </div>
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

                if (isSending && !displayContent?.trim()) {
                  return null;
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
                      <div className="whitespace-pre-wrap">{renderFormattedBoldText(displayContent)}</div>

                      {/* Klickbara notisbrickor/badges per utvecklingsområde efter kompasskalibrering */}
                      {msg.areaBadges && msg.areaBadges.length > 0 && (
                        <div
                          className={`mt-4 pt-3 border-t ${
                            darkMode ? 'border-[#383630]' : 'border-[#EFE7D8]'
                          }`}
                        >
                          <p
                            className={`text-[11px] font-semibold uppercase tracking-wider mb-2 ${
                              darkMode ? 'text-[#A89F91]' : 'text-[#6E675C]'
                            }`}
                          >
                            Utforska ett utvecklingsområde
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {msg.areaBadges.map((badge) => {
                              const needsCare = badge.score < 50;
                              return (
                                <button
                                  key={badge.name}
                                  type="button"
                                  disabled={isSending}
                                  onClick={() =>
                                    handleSendMessage(
                                      `Jag vill utforska området ${badge.name} (${badge.score}%, ${badge.compass}-kompassen) utifrån min kompasskalibrering. Hjälp mig reflektera kring var jag står och vad ett rimligt nästa steg kan vara.`
                                    )
                                  }
                                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition disabled:opacity-50 ${
                                    needsCare
                                      ? darkMode
                                        ? 'bg-[#C57B57]/20 border-[#C57B57]/60 text-[#F5EFE6] hover:bg-[#C57B57]/30'
                                        : 'bg-[#C57B57]/12 border-[#C57B57]/50 text-[#8A4626] hover:bg-[#C57B57]/20'
                                      : darkMode
                                      ? 'bg-[#2F2D28] border-[#45423A] text-[#E5DEC9] hover:bg-[#3A3832]'
                                      : 'bg-[#F7F2E8] border-[#D4C7AF] text-[#2F3A2D] hover:bg-[#EFE6D5]'
                                  }`}
                                >
                                  <span>{badge.name}</span>
                                  <span
                                    className={`font-semibold ${
                                      needsCare
                                        ? 'text-[#C57B57]'
                                        : darkMode
                                        ? 'text-[#A8BFA1]'
                                        : 'text-[#4E5C4B]'
                                    }`}
                                  >
                                    {badge.score}%
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

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
                    <div className="flex flex-wrap items-center gap-1.5 max-w-full mt-1 pt-1.5 pb-1.5 ml-0.5">
                      {/* Kluster 1: 4 öppna interaktionsikoner */}
                      <div
                        className={`inline-flex flex-wrap items-center gap-1 px-1.5 py-1 rounded-xl border ${
                          darkMode
                            ? 'bg-[#23211D]/80 border-[#32302B]'
                            : 'bg-[#F2ECE0]/85 border-[#DCD0B6]'
                        }`}
                      >
                        {/* 1. Högtalare (TTS - Öppen för gäst) */}
                        <button
                          type="button"
                          onClick={() => handleToggleSpeak(msg)}
                          title={
                            speakingMessageId === msg.id
                              ? 'Stoppa uppläsning'
                              : 'Läs upp svar'
                          }
                          className={`min-w-[32px] min-h-[32px] flex items-center justify-center p-1.5 rounded-lg transition ${
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
                          className={`min-w-[32px] min-h-[32px] flex items-center justify-center p-1.5 rounded-lg transition ${
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
                          className={`min-w-[32px] min-h-[32px] flex items-center justify-center p-1.5 rounded-lg transition ${
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
                          className={`min-w-[32px] min-h-[32px] flex items-center justify-center p-1.5 rounded-lg transition ${
                            msg.feedback === 'down'
                              ? 'text-[#C57B57] bg-[#C57B57]/20'
                              : darkMode
                              ? 'text-[#B8B0A2] hover:bg-[#2A2824]'
                              : 'text-[#5A544B] hover:bg-[#DCD0B6]'
                          }`}
                        >
                          <ThumbsDown className="w-4 h-4" />
                        </button>

                        {/* 5 Premium-verktyg */}
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
                          className={`relative min-w-[32px] min-h-[32px] flex items-center justify-center p-1.5 rounded-lg transition ${
                            darkMode
                              ? 'text-[#B8B0A2] hover:bg-[#2A2824]'
                              : 'text-[#5A544B] hover:bg-[#DCD0B6]'
                          }`}
                        >
                          <Plus className="w-4 h-4" />
                          {!isPremium && (
                            <Lock className="w-2.5 h-2.5 text-[#C57B57] absolute top-0 -right-0.5" />
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
                          className={`relative min-w-[32px] min-h-[32px] flex items-center justify-center p-1.5 rounded-lg transition ${
                            darkMode
                              ? 'text-[#B8B0A2] hover:bg-[#2A2824]'
                              : 'text-[#5A544B] hover:bg-[#DCD0B6]'
                          }`}
                        >
                          <Minus className="w-4 h-4" />
                          {!isPremium && (
                            <Lock className="w-2.5 h-2.5 text-[#C57B57] absolute top-0 -right-0.5" />
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
                          className={`relative min-w-[32px] min-h-[32px] flex items-center justify-center p-1.5 rounded-lg transition ${
                            darkMode
                              ? 'text-[#B8B0A2] hover:bg-[#2A2824]'
                              : 'text-[#5A544B] hover:bg-[#DCD0B6]'
                          }`}
                        >
                          <Bell className="w-4 h-4" />
                          {!isPremium && (
                            <Lock className="w-2.5 h-2.5 text-[#C57B57] absolute top-0 -right-0.5" />
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
                          className={`relative min-w-[32px] min-h-[32px] flex items-center justify-center p-1.5 rounded-lg transition ${
                            darkMode
                              ? 'text-[#B8B0A2] hover:bg-[#2A2824]'
                              : 'text-[#5A544B] hover:bg-[#DCD0B6]'
                          }`}
                        >
                          <Pin className="w-4 h-4" />
                          {!isPremium && (
                            <Lock className="w-2.5 h-2.5 text-[#C57B57] absolute top-0 -right-0.5" />
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
                          className={`relative min-w-[32px] min-h-[32px] flex items-center justify-center p-1.5 rounded-lg transition ${
                            darkMode
                              ? 'text-[#B8B0A2] hover:bg-[#2A2824]'
                              : 'text-[#5A544B] hover:bg-[#DCD0B6]'
                          }`}
                        >
                          <Target className="w-4 h-4" />
                          {!isPremium && (
                            <Lock className="w-2.5 h-2.5 text-[#C57B57] absolute top-0 -right-0.5" />
                          )}
                        </button>

                      </div>
                    </div>
                  </div>
                );
              })}

              {isSending &&
                (messages.length === 0 ||
                  messages[messages.length - 1]?.sender === 'user' ||
                  !messages[messages.length - 1]?.content?.trim()) && (
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
                    <span className="inline-flex items-center gap-1.5 py-1" role="status" aria-label="FALK reflekterar">
                      <span
                        className={`h-2 w-2 rounded-full falk-wave-dot ${darkMode ? 'bg-[#A8B0A2]' : 'bg-[#4E5C4B]'}`}
                        style={{ animationDelay: '0ms' }}
                      />
                      <span
                        className={`h-2 w-2 rounded-full falk-wave-dot ${darkMode ? 'bg-[#A8B0A2]' : 'bg-[#4E5C4B]'}`}
                        style={{ animationDelay: '180ms' }}
                      />
                      <span
                        className={`h-2 w-2 rounded-full falk-wave-dot ${darkMode ? 'bg-[#A8B0A2]' : 'bg-[#4E5C4B]'}`}
                        style={{ animationDelay: '360ms' }}
                      />
                    </span>
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
            initialSegment={b2bContext?.active ? 'b2b' : hasB2bAccess ? 'all' : 'b2c'}
            allowSegmentSwitch={hasB2bAccess || Boolean(b2bContext?.active)}
            onStartExercise={(card) => {
                if (card.segment === 'b2b') {
                  setB2bContext((prev) => ({
                    active: true,
                    level: prev?.level || 'individual',
                  }));
                }
                setCardContext({
                  kind: 'exercise',
                  title: card.title,
                  purpose: card.goal || card.description,
                  steps: Array.isArray(card.steps) ? card.steps : undefined,
                });
                setActiveConversationId(null);
                setMessages([]);
                setActiveView('chat');
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

      {/* MOBIL SNABBMENY (HORISONTELL PILL OVANFÖR SKRIVFÄLT) */}
      <nav
        aria-label="Snabbmeny mobil"
        className="fixed inset-x-0 z-20 md:hidden bottom-[calc(6.25rem+env(safe-area-inset-bottom,0px))] flex justify-center px-4 pointer-events-none"
      >
        <div
          className={`pointer-events-auto inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border shadow-md backdrop-blur-md transition-all ${
            darkMode
              ? 'bg-[#23221F]/92 border-[#3A3832] text-[#F5EFE6]'
              : 'bg-[#FAF7F0]/92 border-[#D5C7AC] text-[#1C1C1C]'
          }`}
        >
          <button
            type="button"
            onClick={handleNewChat}
            title="Ny chatt"
            aria-label="Ny chatt"
            className={`w-9 h-9 rounded-full flex items-center justify-center transition active:scale-95 ${
              darkMode ? 'hover:bg-[#32302B]' : 'hover:bg-[#E8DCC4]/70'
            }`}
          >
            <Plus className="w-5 h-5" strokeWidth={2.1} />
          </button>

          <button
            type="button"
            onClick={() => {
              setCalibrationView('wizard');
              setIsCalibrationOpen(true);
            }}
            title="Kompasskalibrering"
            aria-label="Kompasskalibrering"
            className={`w-9 h-9 rounded-full flex items-center justify-center transition active:scale-95 ${
              darkMode ? 'hover:bg-[#32302B]' : 'hover:bg-[#E8DCC4]/70'
            }`}
          >
            <Compass className="w-5 h-5" strokeWidth={2} />
          </button>

          <button
            type="button"
            onClick={() => {
              if (isGuest) {
                openPaywall('Biblioteket med 15 guidade övningar låses upp när du skapar konto eller uppgraderar till FALK Premium.');
                return;
              }
              setActiveView(activeView === 'library' ? 'chat' : 'library');
            }}
            title="Bibliotek"
            aria-label="Bibliotek"
            className={`w-9 h-9 rounded-full flex items-center justify-center transition active:scale-95 ${
              activeView === 'library'
                ? 'bg-[#4E5C4B] text-white'
                : darkMode
                  ? 'hover:bg-[#32302B]'
                  : 'hover:bg-[#E8DCC4]/70'
            }`}
          >
            <BookOpen className="w-5 h-5" strokeWidth={2} />
          </button>

          <button
            type="button"
            onClick={() => {
              if (isGuest) {
                openPaywall('Min utveckling och din personliga kompassöversikt låses upp när du skapar konto eller uppgraderar till FALK Premium.');
                return;
              }
              setActiveView(activeView === 'dashboard' ? 'chat' : 'dashboard');
            }}
            title="Min utveckling"
            aria-label="Min utveckling"
            className={`w-9 h-9 rounded-full flex items-center justify-center transition active:scale-95 ${
              activeView === 'dashboard'
                ? 'bg-[#4E5C4B] text-white'
                : darkMode
                  ? 'hover:bg-[#32302B]'
                  : 'hover:bg-[#E8DCC4]/70'
            }`}
          >
            <TrendingUp className="w-5 h-5" strokeWidth={2} />
          </button>

          <button
            type="button"
            onClick={() => {
              if (!isPremium) {
                openPaywall('FALK Moderator (neutral samtalsledare för relationer och team) ingår i FALK Premium.');
                return;
              }
              window.location.href = '/moderator';
            }}
            title="FALK Moderator"
            aria-label="FALK Moderator"
            className={`w-9 h-9 rounded-full flex items-center justify-center transition active:scale-95 ${
              darkMode ? 'hover:bg-[#32302B]' : 'hover:bg-[#E8DCC4]/70'
            }`}
          >
            <Users className="w-5 h-5" strokeWidth={2} />
          </button>

          <button
            type="button"
            onClick={() => {
              if (!isPremium) {
                openPaywall('Insikter och påminnelser från dina samtal ingår i FALK Premium.');
              } else {
                markRightDrawerItemsSeen();
                setIsRightOpen(true);
              }
            }}
            title="Insikter & Påminnelser"
            aria-label="Insikter och Påminnelser"
            className={`relative w-9 h-9 rounded-full flex items-center justify-center transition active:scale-95 ${
              darkMode ? 'hover:bg-[#32302B]' : 'hover:bg-[#E8DCC4]/70'
            }`}
          >
            <Lightbulb className="w-5 h-5" strokeWidth={2} />
            {hasUnreadRightDrawerItems && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#C57B57]" />
            )}
          </button>
        </div>
      </nav>

      {/* FAST BOTTENPANEL: 5 FOKUSREGLAGE + SKRIVFÄLT */}
      <footer
        className={`fixed bottom-0 inset-x-0 z-20 px-4 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] ${
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
            className={`flex items-end gap-2 rounded-2xl px-3 py-2 border shadow-sm ${
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
              className={`shrink-0 p-1.5 sm:p-2 rounded-xl transition ${
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
              className={`relative shrink-0 p-1.5 sm:p-2 rounded-xl transition ${
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

            <textarea
              rows={1}
              ref={(el) => {
                if (!el) return;
                el.style.height = "auto";
                el.style.height = `${Math.min(el.scrollHeight, 176)}px`;
              }}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder="Dela dina tankar med FALK..."
              className="flex-1 min-w-0 w-full bg-transparent text-sm sm:text-base leading-6 outline-none px-1 py-1 resize-none overflow-y-auto max-h-[176px]"
            />

            <button
              type="submit"
              disabled={!inputText.trim() || isSending}
              aria-label="Skicka"
              title="Skicka"
              className="shrink-0 whitespace-nowrap flex items-center justify-center gap-1.5 p-2 sm:px-4 sm:py-2 rounded-xl bg-[#C57B57] hover:bg-[#B46B48] disabled:opacity-45 text-white text-sm font-medium transition"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">Skicka</span>
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
        isGuest={isGuest}
        isPremium={isPremium}
        isDarkMode={darkMode}
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
        onTogglePinConversation={handleTogglePinConversation}
        onDeleteConversation={handleDeleteConversation}
        onDeleteConversations={handleDeleteConversations}
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
        isPasswordRecovery={isPasswordRecovery}
        onPasswordRecoveryComplete={() => setIsPasswordRecovery(false)}
        onClose={() => {
          setIsPasswordRecovery(false);
          setActiveModal(null);
        }}
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
        segment={calibrationSegment}
        onClose={() => {
          setIsCalibrationOpen(false);
          setCalibrationSegment('b2c');
        }}
        userTier={userTier}
        backendUrl={backendUrl}
        darkMode={darkMode}
        savedScores={calibrationSegment === 'b2b' ? savedB2bCompassScores : savedCompassScores}
        onSaved={(scores) => {
          if (calibrationSegment === 'b2b') {
            setSavedB2bCompassScores(scores);
          } else {
            setSavedCompassScores(scores);
          }
        }}
        onExploreWithFalk={handleExploreCalibration}
      />
          {/* Valbar daglig dagsformspopup (5 alternativ kopplade till kompasskalibrering) */}
      {dailyMoodEnabled && showDailyMoodPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[1px]">
          <div className="w-full max-w-md rounded-2xl border border-[#4E5C4B]/25 bg-[#F7F2E8] p-6 text-[#1C211B] shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#4E5C4B]">
                  DAGLIG DAGSFORM &middot; KOMPASSKALIBRERING
                </p>
                <h2 className="text-lg font-semibold mt-0.5">Hur känns din dagsform idag?</h2>
                <p className="text-xs text-[#4E5C4B] mt-1">
                  Välj ett av fem lägen för att kalibrera FALK:s fokusläge inför dagen.
                </p>
              </div>
              <button
                type="button"
                onClick={handleDismissDailyMoodPopup}
                aria-label="Stäng dagsformspopup"
                className="rounded-lg px-2 py-1 text-xs font-medium text-[#4E5C4B] hover:bg-black/10"
              >
                Stäng
              </button>
            </div>

            <div className="space-y-2">
              {DAILY_MOOD_OPTIONS.map((opt) => (
                <div
                  key={opt.id}
                  className="rounded-xl border border-[#4E5C4B]/15 bg-white/85 p-3 flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[#1C211B]">{opt.label}</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleSelectDailyMood(opt, { openCalibration: true })}
                        className="rounded-lg border border-[#4E5C4B]/30 px-2.5 py-1 text-[11px] font-medium text-[#1C211B] hover:bg-[#E8DCC4]/70"
                      >
                        Kalibrera kompass
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectDailyMood(opt, { startChat: true })}
                        className="rounded-lg bg-[#4E5C4B] px-2.5 py-1 text-[11px] font-medium text-white hover:bg-[#3F4B3C]"
                      >
                        Kalibrera &amp; samtala
                      </button>
                    </div>
                  </div>
                  <p className="text-[11px] text-[#4E5C4B] leading-snug">{opt.hint}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

</div>
  );
}
