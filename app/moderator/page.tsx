'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Send,
  Lock,
  Sparkles,
  Mic,
  MicOff,
  Volume2,
  Square,
  Users,
  Link2,
  Copy,
  Check,
  EyeOff,
  Compass,
  Download,
  Trash2,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { getAuthHeaders } from '@/lib/supabase';

type ModeratorPhase =
  | 'TRYGGHET'
  | 'FÖRSTÅELSE'
  | 'PERSPEKTIV'
  | 'KLARHET'
  | 'NÄSTA_STEG';

interface PerspectiveTriangle {
  part_1_need: string;
  part_2_need: string;
  shared_ground: string;
  core_question: string;
}

interface FinalCompassSummary {
  understood: string;
  most_important: string;
  missing_perspective: string;
  most_true_now: string;
  next_steps: string[];
}

interface ModeratorMeta {
  phase: ModeratorPhase;
  perspective_triangle: PerspectiveTriangle;
  compass_summary: FinalCompassSummary | null;
}

interface ModeratorMessage {
  id: string;
  sender: 'falk' | 'participant';
  role?: 'falk' | 'part_1' | 'part_2';
  speaker: string;
  content: string;
  timestamp: string;
}

interface RoomCheckinStatus {
  part_1_submitted: boolean;
  part_2_submitted: boolean;
  synthesized: boolean;
}

interface PublicRoomMessage {
  id: string;
  role: 'falk' | 'part_1' | 'part_2';
  speaker_name: string;
  content: string;
  ts: number;
}

interface PublicModeratorRoom {
  room_code: string;
  context: 'private' | 'b2b';
  part_1_name: string;
  part_2_name: string;
  guest_joined: boolean;
  checkin_status: RoomCheckinStatus;
  messages: PublicRoomMessage[];
  moderator_meta: ModeratorMeta;
  speaker_counts: { part_1: number; part_2: number };
  expires_at: number;
  viewer_role: '' | 'part_1' | 'part_2';
}

interface BrowserSpeechRecognitionEvent {
  results: {
    [index: number]: {
      [altIndex: number]: { transcript: string };
    };
    length: number;
  };
}

interface BrowserSpeechRecognition {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

const PHASES: { key: ModeratorPhase; label: string }[] = [
  { key: 'TRYGGHET', label: '1. Trygghet' },
  { key: 'FÖRSTÅELSE', label: '2. Förståelse' },
  { key: 'PERSPEKTIV', label: '3. Perspektiv' },
  { key: 'KLARHET', label: '4. Klarhet' },
  { key: 'NÄSTA_STEG', label: '5. Nästa steg' },
];

const DEFAULT_META: ModeratorMeta = {
  phase: 'TRYGGHET',
  perspective_triangle: {
    part_1_need: '',
    part_2_need: '',
    shared_ground: '',
    core_question: '',
  },
  compass_summary: null,
};

const INITIAL_MODERATOR_PHRASE =
  'Välkomna. Jag är här som en neutral samtalspartner för att hjälpa er lyssna på varandra och se klarare – utan att ta sida. Vem vill börja berätta vad ni vill utforska tillsammans idag?';

function encodeWinAnsi(str: string): string {
  let out = '';
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    const code = str.charCodeAt(i);
    if (ch === '\\' || ch === '(' || ch === ')') {
      out += '\\' + ch;
    } else if (code >= 32 && code <= 126) {
      out += ch;
    } else if (code >= 160 && code <= 255) {
      out += '\\' + code.toString(8).padStart(3, '0');
    } else if (ch === '–') {
      out += '\\226';
    } else if (ch === '—') {
      out += '\\227';
    } else if (ch === '•') {
      out += '\\225';
    } else if (ch === '…') {
      out += '...';
    } else if (ch === '’' || ch === '‘') {
      out += '\x27';
    } else if (ch === '”' || ch === '“') {
      out += '\\"';
    } else {
      out += ' ' ;
    }
  }
  return out;
}

function wrapLines(text: string, maxChars: number): string[] {
  const paragraphs = text.split(/\r?\n/);
  const result: string[] = [];
  for (const p of paragraphs) {
    const trimmed = p.trim();
    if (!trimmed) {
      result.push('');
      continue;
    }
    const words = trimmed.split(/\s+/);
    let current = '';
    for (const w of words) {
      if (!current) {
        current = w;
      } else if (current.length + 1 + w.length <= maxChars) {
        current += ' ' + w;
      } else {
        result.push(current);
        current = w;
      }
    }
    if (current) result.push(current);
  }
  return result;
}

function downloadFinalCompassPdf(params: {
  compass: FinalCompassSummary;
  triangle: PerspectiveTriangle;
  part1Name: string;
  part2Name: string;
  context: 'private' | 'b2b';
}) {
  const { compass, triangle, part1Name, part2Name, context } = params;
  const dateStr = new Date().toLocaleDateString('sv-SE');

  const rawBlocks: { text: string; bold?: boolean; size?: number; gapAfter?: number }[] = [
    { text: 'WAYJS · THE FINAL COMPASS™', bold: true, size: 16, gapAfter: 4 },
    {
      text: `Neutralt moderatorsamtal (${context === 'b2b' ? 'Organisation & Ledarskap' : 'Relation & Privat'}) · ${dateStr}`,
      size: 9,
      gapAfter: 4,
    },
    { text: `Parter: ${part1Name} & ${part2Name}`, size: 10, gapAfter: 14 },
  ];

  if (
    triangle.shared_ground ||
    triangle.core_question ||
    triangle.part_1_need ||
    triangle.part_2_need
  ) {
    rawBlocks.push({ text: 'PERSPEKTIVTRIANGELN (FÅGELPERSPEKTIVET)', bold: true, size: 11, gapAfter: 4 });
    if (triangle.part_1_need) {
      rawBlocks.push({ text: `${part1Name}s behov: ${triangle.part_1_need}`, size: 10, gapAfter: 3 });
    }
    if (triangle.part_2_need) {
      rawBlocks.push({ text: `${part2Name}s behov: ${triangle.part_2_need}`, size: 10, gapAfter: 3 });
    }
    if (triangle.shared_ground) {
      rawBlocks.push({ text: `Gemensam grund: ${triangle.shared_ground}`, size: 10, gapAfter: 3 });
    }
    if (triangle.core_question) {
      rawBlocks.push({ text: `Kärnfråga att utforska: ${triangle.core_question}`, size: 10, gapAfter: 12 });
    }
  }

  const sections: { title: string; body: string }[] = [
    { title: '1. Vad har vi förstått?', body: compass.understood || '—' },
    { title: '2. Vad verkar viktigast?', body: compass.most_important || '—' },
    { title: '3. Vilket perspektiv saknades från början?', body: compass.missing_perspective || '—' },
    { title: '4. Vad känns mest sant nu?', body: compass.most_true_now || '—' },
  ];

  for (const sec of sections) {
    rawBlocks.push({ text: sec.title, bold: true, size: 11, gapAfter: 3 });
    rawBlocks.push({ text: sec.body, size: 10, gapAfter: 10 });
  }

  rawBlocks.push({ text: '5. Nästa steg (erat eget ansvar)', bold: true, size: 11, gapAfter: 4 });
  if (compass.next_steps && compass.next_steps.length > 0) {
    compass.next_steps.forEach((step, idx) => {
      rawBlocks.push({ text: `• Steg ${idx + 1}: ${step}`, size: 10, gapAfter: 4 });
    });
  } else {
    rawBlocks.push({ text: '• Definiera ett första litet steg tillsammans.', size: 10, gapAfter: 4 });
  }

  rawBlocks.push({
    text: '\nGenererad lokalt i FALK Moderator · Inget samtalsinnehåll lagras i privat minne.',
    size: 8,
    gapAfter: 0,
  });

  // Bygg sidor med enkel koordinatplacering (A4: 595 x 842 pt)
  const pagesOps: string[][] = [[]];
  let y = 785;
  const leftMargin = 54;

  for (const block of rawBlocks) {
    const fontSize = block.size || 10;
    const lineHeight = fontSize + 5;
    const maxChars = fontSize >= 14 ? 58 : fontSize >= 11 ? 76 : 84;
    const lines = wrapLines(block.text, maxChars);

    for (const line of lines) {
      if (y < 64) {
        pagesOps.push([]);
        y = 785;
      }
      if (line) {
        const fontTag = block.bold ? '/F2' : '/F1';
        const encoded = encodeWinAnsi(line);
        pagesOps[pagesOps.length - 1].push(
          `BT ${fontTag} ${fontSize} Tf ${leftMargin} ${y} Td (${encoded}) Tj ET`
        );
      }
      y -= lineHeight;
    }
    y -= block.gapAfter || 0;
  }

  // Konstruera PDF-objekt
  const objects: string[] = [];
  const pageCount = pagesOps.length;
  // 1: Catalog, 2: Pages, 3: Font Regular, 4: Font Bold
  // Sedan för varje sida i (0..pageCount-1): PageObj = 5 + i*2, ContentObj = 6 + i*2
  const pageRefs = Array.from({ length: pageCount }, (_, i) => `${5 + i * 2} 0 R`).join(' ');
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj');
  objects.push(`2 0 obj\n<< /Type /Pages /Kids [${pageRefs}] /Count ${pageCount} >>\nendobj`);
  objects.push('3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj');
  objects.push('4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj');

  pagesOps.forEach((ops, i) => {
    const pageObjNum = 5 + i * 2;
    const contentObjNum = 6 + i * 2;
    const streamBody = ops.join('\n');
    objects.push(
      `${pageObjNum} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjNum} 0 R >>\nendobj`
    );
    objects.push(
      `${contentObjNum} 0 obj\n<< /Length ${streamBody.length} >>\nstream\n${streamBody}\nendstream\nendobj`
    );
  });

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += obj + '\n';
  }
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  const blob = new Blob([pdf], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `FALK-Final-Compass-${dateStr}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export default function ModeratorPage() {
  const backendUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    (typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? 'http://127.0.0.1:5001'
      : 'https://falk-backend.onrender.com');

  // Samtalskontext (Privat relation eller B2B organisation)
  const [contextMode, setContextMode] = useState<'private' | 'b2b'>('private');

  // Deltagare i lokalt läge (samma enhet)
  const [participants, setParticipants] = useState<string[]>([
    'Deltagare 1',
    'Deltagare 2',
  ]);
  const [activeSpeakerIndex, setActiveSpeakerIndex] = useState<number>(0);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  const [autoSwitchSpeaker, setAutoSwitchSpeaker] = useState<boolean>(true);

  // Lokalt chattflöde & metadata
  const [messages, setMessages] = useState<ModeratorMessage[]>([
    {
      id: 'falk-intro',
      sender: 'falk',
      speaker: 'FALK',
      content: INITIAL_MODERATOR_PHRASE,
      timestamp: new Date().toISOString(),
    },
  ]);
  const [localMeta, setLocalMeta] = useState<ModeratorMeta>(DEFAULT_META);
  const [localSpeakerCounts, setLocalSpeakerCounts] = useState<{ part_1: number; part_2: number }>({
    part_1: 0,
    part_2: 0,
  });

  // Dold enskild incheckning i lokalt överlämningsläge
  const [localCheckinOpen, setLocalCheckinOpen] = useState<boolean>(false);
  const [localCheckinStep, setLocalCheckinStep] = useState<'p1' | 'handover' | 'p2'>('p1');
  const [localP1Secret, setLocalP1Secret] = useState<string>('');
  const [localP2Secret, setLocalP2Secret] = useState<string>('');
  const [localCheckinSynthesized, setLocalCheckinSynthesized] = useState<boolean>(false);

  // Delat samtalsrum (Inbjudningsmodell A: rumskod/länk utan kontokrav för motpart)
  const [roomCode, setRoomCode] = useState<string>('');
  const [participantToken, setParticipantToken] = useState<string>('');
  const [viewerRole, setViewerRole] = useState<'' | 'part_1' | 'part_2'>('');
  const [roomData, setRoomData] = useState<PublicModeratorRoom | null>(null);
  const [joinPromptCode, setJoinPromptCode] = useState<string>('');
  const [joinGuestName, setJoinGuestName] = useState<string>('');
  const [showJoinModal, setShowJoinModal] = useState<boolean>(false);
  const [isCreatingRoom, setIsCreatingRoom] = useState<boolean>(false);
  const [isJoiningRoom, setIsJoiningRoom] = useState<boolean>(false);
  const [copiedInvite, setCopiedInvite] = useState<boolean>(false);

  // Dold enskild incheckning i delat rum
  const [roomCheckinOpen, setRoomCheckinOpen] = useState<boolean>(false);
  const [roomPrivateText, setRoomPrivateText] = useState<string>('');
  const [roomPrivateSubmitted, setRoomPrivateSubmitted] = useState<boolean>(false);
  const [isSubmittingCheckin, setIsSubmittingCheckin] = useState<boolean>(false);

  // UI-paneler, skrivfält, röst & TTS
  const [showTriangle, setShowTriangle] = useState<boolean>(true);
  const [input, setInput] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [isGeneratingCompass, setIsGeneratingCompass] = useState<boolean>(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);

  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Läs URL-parametrar (?room=XXXXXX, ?join=1, ?context=b2b) vid laddning
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const ctx = (params.get('context') || '').trim().toLowerCase();
    if (ctx === 'b2b') {
      setContextMode('b2b');
    }
    const rCode = (params.get('room') || '').trim().toUpperCase();
    const joinFlag = (params.get('join') || '').trim();
    if (/^[A-Z0-9]{4,10}$/.test(rCode)) {
      setJoinPromptCode(rCode);
      const savedToken = window.sessionStorage.getItem(`falk_mod_token_${rCode}`) || '';
      const savedRole = (window.sessionStorage.getItem(`falk_mod_role_${rCode}`) || '') as
        | ''
        | 'part_1'
        | 'part_2';
      if (savedToken && (savedRole === 'part_1' || savedRole === 'part_2')) {
        setRoomCode(rCode);
        setParticipantToken(savedToken);
        setViewerRole(savedRole);
      } else {
        setShowJoinModal(true);
      }
    } else if (joinFlag === '1') {
      setShowJoinModal(true);
    }
  }, []);

  // Rensa tal/mikrofon vid unmount
  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.stop();
      } catch {
        // Ignorera
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const activeMessages: ModeratorMessage[] = roomData
    ? [
        {
          id: 'room-intro',
          sender: 'falk',
          role: 'falk',
          speaker: 'FALK',
          content: INITIAL_MODERATOR_PHRASE,
          timestamp: new Date().toISOString(),
        },
        ...roomData.messages.map((m) => ({
          id: m.id,
          sender: (m.role === 'falk' ? 'falk' : 'participant') as 'falk' | 'participant',
          role: m.role,
          speaker: m.speaker_name,
          content: m.content,
          timestamp: new Date(m.ts || Date.now()).toISOString(),
        })),
      ]
    : messages;

  const activeMeta: ModeratorMeta = roomData ? roomData.moderator_meta : localMeta;
  const activeCounts = roomData ? roomData.speaker_counts : localSpeakerCounts;
  const part1Label = roomData ? roomData.part_1_name : participants[0] || 'Deltagare 1';
  const part2Label = roomData ? roomData.part_2_name : participants[1] || 'Deltagare 2';

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages.length, isSending]);

  // Polling för synkat samtalsrum (var 3:e sekund)
  const fetchRoomState = useCallback(
    async (codeToFetch: string, tokenToUse: string) => {
      if (!codeToFetch) return;
      try {
        const res = await fetch(
          `${backendUrl}/api/moderator/room/${encodeURIComponent(codeToFetch)}`,
          {
            headers: tokenToUse ? { 'X-Moderator-Token': tokenToUse } : {},
          }
        );
        if (res.status === 404) {
          setRoomData(null);
          setRoomCode('');
          setParticipantToken('');
          setViewerRole('');
          setErrorBanner(
            'Samtalsrummet har avslutats eller löpt ut (raderas automatiskt efter 4 timmar av integritetsskäl).'
          );
          return;
        }
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.room) {
          setRoomData(data.room);
        }
      } catch {
        // Tyst vid tillfälligt nätverksavbrott under polling
      }
    },
    [backendUrl]
  );

  useEffect(() => {
    if (!roomCode || !participantToken) return;
    fetchRoomState(roomCode, participantToken);
    const timer = setInterval(() => {
      fetchRoomState(roomCode, participantToken);
    }, 3000);
    return () => clearInterval(timer);
  }, [roomCode, participantToken, fetchRoomState]);

  const activeSpeaker = roomData
    ? viewerRole === 'part_2'
      ? roomData.part_2_name
      : roomData.part_1_name
    : participants[activeSpeakerIndex] || 'Deltagare 1';

  // TTS Uppläsning per FALK-meddelande
  const handleToggleSpeak = (msg: ModeratorMessage) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setErrorBanner('Din webbläsare saknar stöd för uppläsning (TTS).');
      return;
    }
    if (speakingMessageId === msg.id) {
      window.speechSynthesis.cancel();
      setSpeakingMessageId(null);
      return;
    }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(msg.content);
    utter.lang = 'sv-SE';
    utter.rate = 0.96;
    utter.onend = () => setSpeakingMessageId(null);
    utter.onerror = () => setSpeakingMessageId(null);
    setSpeakingMessageId(msg.id);
    window.speechSynthesis.speak(utter);
  };

  // Röstinmatning (Mikrofon -> text)
  const handleToggleMic = () => {
    if (typeof window === 'undefined') return;
    if (isListening) {
      try {
        recognitionRef.current?.stop();
      } catch {
        // Ignorera
      }
      setIsListening(false);
      return;
    }

    const win = window as unknown as {
      SpeechRecognition?: new () => BrowserSpeechRecognition;
      webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
    };
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechRec) {
      setErrorBanner('Röstinmatning stöds inte i denna webbläsare. Skriv ditt svar i fältet.');
      return;
    }

    try {
      const rec = new SpeechRec();
      rec.lang = 'sv-SE';
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.onresult = (event: BrowserSpeechRecognitionEvent) => {
        const transcript = event.results?.[0]?.[0]?.transcript || '';
        if (transcript.trim()) {
          setInput((prev) => (prev ? `${prev.trim()} ${transcript.trim()}` : transcript.trim()));
        }
      };
      rec.onerror = () => setIsListening(false);
      rec.onend = () => setIsListening(false);
      recognitionRef.current = rec;
      setIsListening(true);
      rec.start();
    } catch {
      setIsListening(false);
    }
  };

  // Lokala deltagarhanterare
  const handleStartRename = (idx: number) => {
    setEditingIndex(idx);
    setEditingName(participants[idx] || '');
  };

  const handleCommitRename = () => {
    if (editingIndex === null) return;
    const cleaned = editingName.trim();
    if (cleaned) {
      setParticipants((prev) =>
        prev.map((name, idx) => (idx === editingIndex ? cleaned.slice(0, 24) : name))
      );
    }
    setEditingIndex(null);
    setEditingName('');
  };

  const handleAddParticipant = () => {
    if (participants.length >= 4) return;
    const nextNum = participants.length + 1;
    setParticipants((prev) => [...prev, `Deltagare ${nextNum}`]);
    setActiveSpeakerIndex(participants.length);
  };

  const handleRemoveParticipant = (idx: number) => {
    if (participants.length <= 2) return;
    setParticipants((prev) => prev.filter((_, i) => i !== idx));
    setActiveSpeakerIndex(0);
    if (editingIndex === idx) setEditingIndex(null);
  };

  // Skapa delat rum (Värd = Premium)
  const handleCreateSharedRoom = async () => {
    if (isCreatingRoom) return;
    setIsCreatingRoom(true);
    setErrorBanner(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${backendUrl}/api/moderator/room`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          context: contextMode,
          part_1_name: participants[0] || 'Part 1',
          part_2_name: participants[1] || 'Part 2',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Kunde inte skapa delat samtalsrum.');
      }
      const createdRoom: PublicModeratorRoom = data.room;
      const tok: string = data.participant_token;
      setRoomCode(createdRoom.room_code);
      setParticipantToken(tok);
      setViewerRole('part_1');
      setRoomData(createdRoom);
      setRoomPrivateSubmitted(false);
      setRoomPrivateText('');
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(`falk_mod_token_${createdRoom.room_code}`, tok);
        window.sessionStorage.setItem(`falk_mod_role_${createdRoom.room_code}`, 'part_1');
      }
    } catch (err: unknown) {
      setErrorBanner(err instanceof Error ? err.message : 'Kunde inte starta rummet.');
    } finally {
      setIsCreatingRoom(false);
    }
  };

  // Anslut som motpart till rum (utan kontokrav)
  const handleJoinSharedRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    const codeClean = joinPromptCode.trim().toUpperCase();
    if (!codeClean || isJoiningRoom) return;
    setIsJoiningRoom(true);
    setErrorBanner(null);
    try {
      const res = await fetch(
        `${backendUrl}/api/moderator/room/${encodeURIComponent(codeClean)}/join`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guest_name: joinGuestName.trim() || 'Part 2',
          }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Kunde inte ansluta till rummet.');
      }
      const joinedRoom: PublicModeratorRoom = data.room;
      const tok: string = data.participant_token;
      setRoomCode(joinedRoom.room_code);
      setParticipantToken(tok);
      setViewerRole('part_2');
      setRoomData(joinedRoom);
      setContextMode(joinedRoom.context || 'private');
      setShowJoinModal(false);
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(`falk_mod_token_${joinedRoom.room_code}`, tok);
        window.sessionStorage.setItem(`falk_mod_role_${joinedRoom.room_code}`, 'part_2');
      }
    } catch (err: unknown) {
      setErrorBanner(err instanceof Error ? err.message : 'Kontrollera rumskoden och försök igen.');
    } finally {
      setIsJoiningRoom(false);
    }
  };

  const handleCopyInviteLink = () => {
    if (!roomCode || typeof window === 'undefined') return;
    const inviteUrl = `${window.location.origin}/moderator?room=${roomCode}`;
    navigator.clipboard?.writeText(inviteUrl);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2500);
  };

  // Dold enskild incheckning i delat rum
  const handleSubmitRoomCheckin = async (forceSynthesize = false) => {
    if (!roomCode || !participantToken || isSubmittingCheckin) return;
    if (!forceSynthesize && !roomPrivateText.trim()) return;
    setIsSubmittingCheckin(true);
    setErrorBanner(null);
    try {
      const res = await fetch(
        `${backendUrl}/api/moderator/room/${encodeURIComponent(roomCode)}/checkin`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Moderator-Token': participantToken,
          },
          body: JSON.stringify({
            participant_token: participantToken,
            private_text: roomPrivateText.trim(),
            force_synthesize: forceSynthesize,
          }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Kunde inte skicka incheckning.');
      }
      if (data.room) {
        setRoomData(data.room);
      }
      setRoomPrivateSubmitted(true);
      setRoomPrivateText('');
      if (data.room?.checkin_status?.synthesized) {
        setRoomCheckinOpen(false);
      }
    } catch (err: unknown) {
      setErrorBanner(err instanceof Error ? err.message : 'Fel vid enskild incheckning.');
    } finally {
      setIsSubmittingCheckin(false);
    }
  };

  // Dold enskild incheckning i lokalt överlämningsläge
  const handleSynthesizeLocalCheckin = async () => {
    if ((!localP1Secret.trim() && !localP2Secret.trim()) || isSending) return;
    setIsSending(true);
    setErrorBanner(null);

    const p1 = participants[0] || 'Deltagare 1';
    const p2 = participants[1] || 'Deltagare 2';
    const synthPrompt =
      `ENSKILD FÖRBEREDELSE (KONFIDENTIELLT UNDERLAG – ÅTERGE EJ ORDAGRANT):\n` +
      `- ${p1} delade enskilt: ${localP1Secret.trim() || '(Ej angivet)'}\n` +
      `- ${p2} delade enskilt: ${localP2Secret.trim() || '(Ej angivet)'}\n\n` +
      `Översätt bådas utsagor till underliggande mänskliga behov och gemensam riktning utan att avslöja vad någon skrev enskilt, och öppna det gemensamma samtalet.`;

    // Råtext rensas direkt ur minnet
    setLocalP1Secret('');
    setLocalP2Secret('');
    setLocalCheckinOpen(false);
    setLocalCheckinStep('p1');

    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${backendUrl}/api/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: synthPrompt,
          session_mode: {
            track: 'moderator',
            context: contextMode,
            check_in_synthesis: true,
          },
          is_guest: false,
          history: [],
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Kunde inte sammanställa incheckningen.');
      }
      const replyText =
        typeof data.reply === 'string' && data.reply.trim()
          ? data.reply.trim()
          : 'Tack för att ni båda delade er utgångspunkt enskilt. Jag ser gemensamma behov av trygghet och ömsesidig förståelse. Vad vill ni börja utforska tillsammans?';
      if (data.moderator_meta) {
        setLocalMeta(data.moderator_meta);
      }
      setLocalCheckinSynthesized(true);
      setMessages((prev) => [
        ...prev,
        {
          id: `falk-checkin-${Date.now()}`,
          sender: 'falk',
          speaker: 'FALK',
          content: replyText,
          timestamp: new Date().toISOString(),
        },
      ]);
    } catch (err: unknown) {
      setErrorBanner(err instanceof Error ? err.message : 'Fel vid lokal syntes.');
    } finally {
      setIsSending(false);
    }
  };

  // Nollställ / Radera rum
  const handleResetSession = async () => {
    if (roomCode && participantToken) {
      try {
        await fetch(`${backendUrl}/api/moderator/room/${encodeURIComponent(roomCode)}`, {
          method: 'DELETE',
          headers: { 'X-Moderator-Token': participantToken },
        });
      } catch {
        // Ignorera
      }
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(`falk_mod_token_${roomCode}`);
        window.sessionStorage.removeItem(`falk_mod_role_${roomCode}`);
      }
    }
    setRoomCode('');
    setParticipantToken('');
    setViewerRole('');
    setRoomData(null);
    setRoomPrivateSubmitted(false);
    setRoomPrivateText('');
    setRoomCheckinOpen(false);

    setMessages([
      {
        id: `falk-intro-${Date.now()}`,
        sender: 'falk',
        speaker: 'FALK',
        content: INITIAL_MODERATOR_PHRASE,
        timestamp: new Date().toISOString(),
      },
    ]);
    setLocalMeta(DEFAULT_META);
    setLocalSpeakerCounts({ part_1: 0, part_2: 0 });
    setLocalP1Secret('');
    setLocalP2Secret('');
    setLocalCheckinSynthesized(false);
    setLocalCheckinOpen(false);
    setLocalCheckinStep('p1');
    setActiveSpeakerIndex(0);
    setErrorBanner(null);
    setInput('');
  };

  // Skicka meddelande (antingen till delat rum eller lokalt /api/chat)
  const handleSendMessage = async (e?: React.FormEvent, requestFinalCompass = false) => {
    if (e) e.preventDefault();
    const trimmed = input.trim();
    if (!requestFinalCompass && (!trimmed || isSending)) return;
    if (requestFinalCompass && (isGeneratingCompass || isSending)) return;

    setErrorBanner(null);

    if (requestFinalCompass) {
      setIsGeneratingCompass(true);
    } else {
      setIsSending(true);
    }

    try {
      // LÄGE A: Delat samtalsrum
      if (roomCode && participantToken) {
        if (!requestFinalCompass) setInput('');
        const res = await fetch(
          `${backendUrl}/api/moderator/room/${encodeURIComponent(roomCode)}/message`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Moderator-Token': participantToken,
            },
            body: JSON.stringify({
              participant_token: participantToken,
              content: requestFinalCompass
                ? trimmed || 'Vi vill avsluta och sammanfatta samtalet med The Final Compass™.'
                : trimmed,
              request_falk: true,
              final_compass: requestFinalCompass,
            }),
          }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.message || data.error || 'Kunde inte skicka inlägg till rummet.');
        }
        if (data.room) {
          setRoomData(data.room);
        }
        return;
      }

      // LÄGE B: Lokalt delat gränssnitt
      const currentSpeaker = activeSpeaker;
      const speakerRoleKey = activeSpeakerIndex === 0 ? 'part_1' : 'part_2';
      const outgoingContent = requestFinalCompass
        ? trimmed || 'Vi vill nu runda av och sammanfatta samtalet i The Final Compass™.'
        : trimmed;

      const userMsg: ModeratorMessage = {
        id: `user-${Date.now()}`,
        sender: 'participant',
        role: speakerRoleKey,
        speaker: currentSpeaker,
        content: outgoingContent,
        timestamp: new Date().toISOString(),
      };

      const nextHistory = [...messages, userMsg];
      setMessages(nextHistory);
      setInput('');

      if (!requestFinalCompass) {
        setLocalSpeakerCounts((prev) => ({
          ...prev,
          [speakerRoleKey]: prev[speakerRoleKey] + 1,
        }));
        if (autoSwitchSpeaker && participants.length > 1) {
          setActiveSpeakerIndex((prev) => (prev + 1) % participants.length);
        }
      }

      const headers = await getAuthHeaders();
      const payload = {
        message: `[${currentSpeaker}]: ${outgoingContent}`,
        session_mode: {
          track: 'moderator',
          context: contextMode,
        },
        final_compass: requestFinalCompass,
        is_guest: false,
        history: nextHistory.slice(-14).map((m) => ({
          role: m.sender === 'participant' ? 'user' : 'assistant',
          content:
            m.sender === 'participant' ? `[${m.speaker}]: ${m.content}` : m.content,
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
        setErrorBanner(
          data.message ||
            data.error ||
            'Moderatorläget kräver aktivt FALK Premium-medlemskap.'
        );
        return;
      }

      if (!res.ok) {
        throw new Error(
          data.error || 'Kunde inte nå FALK just nu. Försök igen om en stund.'
        );
      }

      const replyText: string =
        typeof data.reply === 'string' && data.reply.trim()
          ? data.reply.trim()
          : 'Jag lyssnar. Vill någon av er utveckla vad som känns viktigast här?';

      if (data.moderator_meta) {
        setLocalMeta(data.moderator_meta);
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `falk-${Date.now()}`,
          sender: 'falk',
          role: 'falk',
          speaker: 'FALK',
          content: replyText,
          timestamp: new Date().toISOString(),
        },
      ]);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Ett oväntat fel uppstod i anslutningen till FALK.';
      setErrorBanner(message);
    } finally {
      setIsSending(false);
      setIsGeneratingCompass(false);
    }
  };

  const totalTurns = activeCounts.part_1 + activeCounts.part_2;
  const p1Pct = totalTurns > 0 ? Math.round((activeCounts.part_1 / totalTurns) * 100) : 50;
  const p2Pct = totalTurns > 0 ? 100 - p1Pct : 50;
  const activePhaseIdx = Math.max(
    0,
    PHASES.findIndex((p) => p.key === activeMeta.phase)
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#E8DCC4] text-[#1F241D]">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-[#E8DCC4]/95 backdrop-blur-sm border-b border-[#1F241D]/10 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-2">
          <Link
            href={contextMode === 'b2b' ? '/b2b' : '/'}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-[#F5EFE4] hover:bg-white transition border border-[#1F241D]/10"
          >
            <span aria-hidden="true">←</span>
            <span>{contextMode === 'b2b' ? 'B2B-vy' : 'Tillbaka'}</span>
          </Link>

          <div className="flex flex-col items-center text-center">
            <div className="flex items-center gap-2">
              <span className="font-semibold tracking-[0.22em] text-sm">FALK</span>
              <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-[#4E5C4B] text-white">
                Moderator
              </span>
              {roomCode && (
                <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-[#C57B57] text-white">
                  Rum {roomCode}
                </span>
              )}
            </div>
            <span className="text-[11px] text-[#1F241D]/65 flex items-center gap-1 mt-0.5">
              <Lock className="w-3 h-3" />
              {roomCode
                ? 'Flyktigt samtalsrum · Raderas automatiskt efter avslutat samtal'
                : 'Neutralt samtalsrum · Sparas inte i privat minne'}
            </span>
          </div>

          <button
            type="button"
            onClick={handleResetSession}
            className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full bg-[#F5EFE4] hover:bg-white transition border border-[#1F241D]/10"
            title={roomCode ? 'Avsluta och radera samtalsrummet permanent' : 'Starta om samtalet'}
          >
            {roomCode ? <Trash2 className="w-3.5 h-3.5 text-[#C57B57]" /> : null}
            <span>{roomCode ? 'Avsluta rum' : 'Nytt samtal'}</span>
          </button>
        </div>
      </header>

      {/* Samtalsrytm (5 faser) & Talarbalans */}
      <section className="border-b border-[#1F241D]/10 bg-[#F5EFE4]/90 px-4 py-2.5">
        <div className="max-w-3xl mx-auto space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
              {PHASES.map((p, idx) => {
                const isCurrent = idx === activePhaseIdx;
                const isPassed = idx < activePhaseIdx;
                return (
                  <span
                    key={p.key}
                    className={`text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap transition ${
                      isCurrent
                        ? 'bg-[#4E5C4B] text-white font-semibold'
                        : isPassed
                          ? 'bg-[#A8BFA1]/35 text-[#1F241D] font-medium'
                          : 'bg-[#E8DCC4]/70 text-[#1F241D]/55'
                    }`}
                  >
                    {p.label}
                  </span>
                );
              })}
            </div>

            {/* Kontext-switch när inget rum är skapat ännu */}
            {!roomCode && (
              <div className="inline-flex rounded-full bg-[#E8DCC4] p-0.5 border border-[#1F241D]/10 text-[11px]">
                <button
                  type="button"
                  onClick={() => setContextMode('private')}
                  className={`px-2.5 py-0.5 rounded-full transition ${
                    contextMode === 'private'
                      ? 'bg-white text-[#1F241D] font-medium shadow-xs'
                      : 'text-[#1F241D]/65'
                  }`}
                >
                  Relation / Privat
                </button>
                <button
                  type="button"
                  onClick={() => setContextMode('b2b')}
                  className={`px-2.5 py-0.5 rounded-full transition ${
                    contextMode === 'b2b'
                      ? 'bg-white text-[#1F241D] font-medium shadow-xs'
                      : 'text-[#1F241D]/65'
                  }`}
                >
                  Organisation / Team
                </button>
              </div>
            )}
          </div>

          {/* Talarbalans-indikator */}
          <div className="flex items-center gap-2 text-[11px] text-[#1F241D]/70">
            <span className="truncate max-w-[110px] font-medium">
              {part1Label} ({activeCounts.part_1})
            </span>
            <div className="flex-1 h-1.5 rounded-full bg-[#E8DCC4] overflow-hidden flex">
              <div
                className="bg-[#4E5C4B] transition-all duration-300"
                style={{ width: `${p1Pct}%` }}
              />
              <div
                className="bg-[#C57B57] transition-all duration-300"
                style={{ width: `${p2Pct}%` }}
              />
            </div>
            <span className="truncate max-w-[110px] font-medium text-right">
              ({activeCounts.part_2}) {part2Label}
            </span>
          </div>
        </div>
      </section>

      {/* Deltagar- & Inbjudningspanel (Hybridmodell A) */}
      <section className="border-b border-[#1F241D]/10 bg-[#EFE6D5]/80 px-4 py-2.5">
        <div className="max-w-3xl mx-auto flex flex-col gap-2">
          {!roomCode ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-medium text-[#1F241D]/70 mr-1">
                  Talar nu:
                </span>
                {participants.map((name, idx) => {
                  const isSelected = idx === activeSpeakerIndex;
                  if (editingIndex === idx) {
                    return (
                      <input
                        key={idx}
                        type="text"
                        value={editingName}
                        autoFocus
                        maxLength={24}
                        onChange={(e) => setEditingName(e.target.value)}
                        onBlur={handleCommitRename}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleCommitRename();
                          }
                          if (e.key === 'Escape') setEditingIndex(null);
                        }}
                        className="text-xs px-2.5 py-1 rounded-full bg-white border border-[#4E5C4B] text-[#1F241D] outline-none w-32"
                      />
                    );
                  }
                  return (
                    <div
                      key={idx}
                      className={`inline-flex items-center rounded-full text-xs transition border ${
                        isSelected
                          ? 'bg-[#4E5C4B] text-white border-[#4E5C4B] shadow-xs'
                          : 'bg-[#F5EFE4] text-[#1F241D] border-[#1F241D]/15 hover:bg-white'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setActiveSpeakerIndex(idx)}
                        onDoubleClick={() => handleStartRename(idx)}
                        className="px-3 py-1 font-medium"
                      >
                        {name}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStartRename(idx)}
                        title="Byt namn"
                        className={`pr-2 text-[10px] opacity-75 hover:opacity-100 ${
                          isSelected ? 'text-white' : 'text-[#1F241D]'
                        }`}
                      >
                        ✎
                      </button>
                      {participants.length > 2 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveParticipant(idx)}
                          title="Ta bort deltagare"
                          className={`pr-2.5 text-[10px] opacity-75 hover:opacity-100 ${
                            isSelected ? 'text-white' : 'text-[#1F241D]'
                          }`}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  );
                })}

                {participants.length < 4 && (
                  <button
                    type="button"
                    onClick={handleAddParticipant}
                    className="text-xs px-2.5 py-1 rounded-full bg-transparent hover:bg-white/60 text-[#1F241D]/75 border border-dashed border-[#1F241D]/25 transition"
                  >
                    + Deltagare
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-1.5 text-[11px] text-[#1F241D]/75 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoSwitchSpeaker}
                    onChange={(e) => setAutoSwitchSpeaker(e.target.checked)}
                    className="accent-[#4E5C4B] rounded"
                  />
                  <span>Växla talare</span>
                </label>

                <button
                  type="button"
                  onClick={() => {
                    setLocalCheckinOpen((v) => !v);
                    setLocalCheckinStep('p1');
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full bg-[#F5EFE4] hover:bg-white border border-[#1F241D]/15 transition"
                >
                  <EyeOff className="w-3 h-3 text-[#C57B57]" />
                  <span>
                    {localCheckinSynthesized ? 'Incheckning klar' : 'Enskild incheckning'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleCreateSharedRoom}
                  disabled={isCreatingRoom}
                  className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full bg-[#4E5C4B] text-white hover:bg-[#3f4b3c] transition disabled:opacity-50"
                >
                  <Link2 className="w-3 h-3" />
                  <span>{isCreatingRoom ? 'Skapar rum...' : 'Bjud in på distans'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowJoinModal(true)}
                  className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full bg-[#F5EFE4] hover:bg-white border border-[#1F241D]/15 transition"
                >
                  <Users className="w-3 h-3 text-[#4E5C4B]" />
                  <span>Ange rumskod</span>
                </button>
              </div>
            </div>
          ) : (
            /* Aktivt delat rum (två enheter) */
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#4E5C4B] text-white font-medium">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Du deltar som: {activeSpeaker}
                </span>
                <span className="text-[11px] text-[#1F241D]/75">
                  {roomData?.guest_joined
                    ? `Ansluten med ${roomData.part_2_name}`
                    : `Väntar på att ${roomData?.part_2_name || 'motparten'} ansluter...`}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRoomCheckinOpen((v) => !v)}
                  className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full bg-[#F5EFE4] hover:bg-white border border-[#1F241D]/15 transition"
                >
                  <EyeOff className="w-3 h-3 text-[#C57B57]" />
                  <span>
                    {roomData?.checkin_status?.synthesized
                      ? 'Incheckning sammanvägd'
                      : 'Enskild incheckning'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyInviteLink}
                  className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full bg-white hover:bg-[#F5EFE4] border border-[#1F241D]/15 transition"
                >
                  {copiedInvite ? (
                    <>
                      <Check className="w-3 h-3 text-[#4E5C4B]" />
                      <span>Länk kopierad ({roomCode})</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 text-[#4E5C4B]" />
                      <span>Kopiera inbjudningslänk ({roomCode})</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Lokal dold enskild incheckning (överlämning på samma enhet) */}
          {!roomCode && localCheckinOpen && (
            <div className="mt-1 rounded-2xl bg-white border border-[#1F241D]/15 p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-[#1F241D] flex items-center gap-1.5">
                  <EyeOff className="w-3.5 h-3.5 text-[#C57B57]" />
                  Enskild förberedelse (dold för den andra personen)
                </p>
                <button
                  type="button"
                  onClick={() => setLocalCheckinOpen(false)}
                  className="text-xs text-[#1F241D]/60 hover:text-[#1F241D]"
                >
                  Stäng
                </button>
              </div>

              {localCheckinStep === 'p1' && (
                <div className="space-y-2.5">
                  <p className="text-xs text-[#1F241D]/75">
                    <strong>{participants[0] || 'Deltagare 1'}:</strong> Skriv kort vad som känns svårast och vad du egentligen behöver. Texten döljs innan skärmen lämnas över.
                  </p>
                  <textarea
                    rows={3}
                    value={localP1Secret}
                    onChange={(e) => setLocalP1Secret(e.target.value)}
                    placeholder="Skriv din ärliga utgångspunkt här..."
                    className="w-full rounded-xl bg-[#F5EFE4]/60 border border-[#1F241D]/15 p-2.5 text-xs outline-none focus:border-[#4E5C4B]"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={!localP1Secret.trim()}
                      onClick={() => setLocalCheckinStep('handover')}
                      className="inline-flex items-center gap-1.5 text-xs font-medium px-3.5 py-1.5 rounded-full bg-[#4E5C4B] text-white disabled:opacity-40"
                    >
                      <span>Dölj text & lämna över skärmen</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {localCheckinStep === 'handover' && (
                <div className="py-4 text-center space-y-3 bg-[#F5EFE4] rounded-xl px-4">
                  <p className="text-xs font-medium text-[#1F241D]">
                    {participants[0] || 'Deltagare 1'}s svar är nu dolt.
                  </p>
                  <p className="text-xs text-[#1F241D]/70">
                    Lämna över enheten till <strong>{participants[1] || 'Deltagare 2'}</strong>.
                  </p>
                  <button
                    type="button"
                    onClick={() => setLocalCheckinStep('p2')}
                    className="inline-flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-full bg-[#4E5C4B] text-white"
                  >
                    <span>Jag är {participants[1] || 'Deltagare 2'} – fortsätt</span>
                  </button>
                </div>
              )}

              {localCheckinStep === 'p2' && (
                <div className="space-y-2.5">
                  <p className="text-xs text-[#1F241D]/75">
                    <strong>{participants[1] || 'Deltagare 2'}:</strong> Skriv vad som känns viktigast och vad du behöver i det här samtalet. FALK översätter bådas svar till gemensamma behov utan att citera råtexten.
                  </p>
                  <textarea
                    rows={3}
                    value={localP2Secret}
                    onChange={(e) => setLocalP2Secret(e.target.value)}
                    placeholder="Skriv din ärliga utgångspunkt här..."
                    className="w-full rounded-xl bg-[#F5EFE4]/60 border border-[#1F241D]/15 p-2.5 text-xs outline-none focus:border-[#4E5C4B]"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      disabled={!localP2Secret.trim() || isSending}
                      onClick={handleSynthesizeLocalCheckin}
                      className="inline-flex items-center gap-1.5 text-xs font-medium px-4 py-1.5 rounded-full bg-[#C57B57] text-white disabled:opacity-40"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{isSending ? 'Väver samman...' : 'Låt FALK väva samman behoven'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Dold enskild incheckning i delat rum */}
          {roomCode && roomCheckinOpen && (
            <div className="mt-1 rounded-2xl bg-white border border-[#1F241D]/15 p-4 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-[#1F241D] flex items-center gap-1.5">
                  <EyeOff className="w-3.5 h-3.5 text-[#C57B57]" />
                  Enskild incheckning till FALK (visas aldrig i klartext för motparten)
                </p>
                <button
                  type="button"
                  onClick={() => setRoomCheckinOpen(false)}
                  className="text-xs text-[#1F241D]/60 hover:text-[#1F241D]"
                >
                  Stäng
                </button>
              </div>
              <p className="text-[11px] text-[#1F241D]/70">
                Status: {roomData?.part_1_name} ({roomData?.checkin_status?.part_1_submitted ? 'Inskickad' : 'Väntar'}) · 
                {roomData?.part_2_name} ({roomData?.checkin_status?.part_2_submitted ? 'Inskickad' : 'Väntar'}). Råtexten raderas omedelbart när FALK har syntetiserat behoven.
              </p>

              {!roomPrivateSubmitted && !roomData?.checkin_status?.synthesized ? (
                <>
                  <textarea
                    rows={3}
                    value={roomPrivateText}
                    onChange={(e) => setRoomPrivateText(e.target.value)}
                    placeholder="Vad känns svårast att säga rakt ut, och vad hoppas du att ni landar i?"
                    className="w-full rounded-xl bg-[#F5EFE4]/60 border border-[#1F241D]/15 p-2.5 text-xs outline-none focus:border-[#4E5C4B]"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      disabled={!roomPrivateText.trim() || isSubmittingCheckin}
                      onClick={() => handleSubmitRoomCheckin(false)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium px-3.5 py-1.5 rounded-full bg-[#4E5C4B] text-white disabled:opacity-40"
                    >
                      <span>{isSubmittingCheckin ? 'Skickar...' : 'Skicka enskilt till FALK'}</span>
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2 bg-[#F5EFE4] rounded-xl p-3 text-xs">
                  <span>
                    {roomData?.checkin_status?.synthesized
                      ? 'Bådas utgångspunkter har vägts samman i Perspektivtriangeln.'
                      : 'Din incheckning är mottagen. Inväntar motparten...'}
                  </span>
                  {viewerRole === 'part_1' && !roomData?.checkin_status?.synthesized && (
                    <button
                      type="button"
                      onClick={() => handleSubmitRoomCheckin(true)}
                      disabled={isSubmittingCheckin}
                      className="text-[11px] font-medium px-3 py-1 rounded-full bg-[#C57B57] text-white"
                    >
                      Starta nu ändå
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Anslutningsmodal för motpart (Inbjudningsmodell A – inget konto krävs) */}
      {showJoinModal && (
        <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleJoinSharedRoom}
            className="w-full max-w-md rounded-2xl bg-[#F5EFE4] border border-[#1F241D]/15 p-6 shadow-xl space-y-4"
          >
            <div className="space-y-1">
              <span className="text-[11px] uppercase tracking-widest text-[#C57B57] font-semibold">
                FALK Moderator · Delat rum
              </span>
              <h2 className="text-lg font-semibold text-[#1F241D]">
                Anslut till samtalsrum
              </h2>
              <p className="text-xs text-[#1F241D]/75 leading-relaxed">
                Inget konto krävs. Samtalet är flyktigt, krypterat under överföring och sparas inte i något privat minne.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1">Rumskod</label>
                <input
                  type="text"
                  value={joinPromptCode}
                  onChange={(e) => setJoinPromptCode(e.target.value.toUpperCase())}
                  maxLength={8}
                  placeholder="T.ex. K7P9M2"
                  required
                  className="w-full rounded-xl bg-white border border-[#1F241D]/15 px-3 py-2 text-sm font-mono uppercase tracking-widest outline-none focus:border-[#4E5C4B]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Ditt förnamn eller roll</label>
                <input
                  type="text"
                  value={joinGuestName}
                  onChange={(e) => setJoinGuestName(e.target.value)}
                  maxLength={32}
                  placeholder="T.ex. Alex"
                  required
                  className="w-full rounded-xl bg-white border border-[#1F241D]/15 px-3 py-2 text-sm outline-none focus:border-[#4E5C4B]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowJoinModal(false)}
                className="text-xs font-medium px-3.5 py-2 rounded-full bg-white border border-[#1F241D]/15"
              >
                Avbryt
              </button>
              <button
                type="submit"
                disabled={!joinPromptCode.trim() || !joinGuestName.trim() || isJoiningRoom}
                className="text-xs font-medium px-4 py-2 rounded-full bg-[#4E5C4B] text-white disabled:opacity-40"
              >
                {isJoiningRoom ? 'Ansluter...' : 'Gå in i samtalsrummet'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Chattflöde + Perspektivtriangel + The Final Compass™ */}
      <main className="flex-1 overflow-y-auto px-4 py-5">
        <div className="max-w-3xl mx-auto space-y-4">
          {/* Perspektivtriangeln (Fågelperspektivet) */}
          <div className="rounded-2xl bg-[#F5EFE4] border border-[#1F241D]/12 p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-[#C57B57]" />
                <h2 className="text-xs font-semibold uppercase tracking-wider text-[#1F241D]">
                  Perspektivtriangeln · Fågelperspektivet
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowTriangle((v) => !v)}
                className="text-[11px] text-[#1F241D]/65 hover:text-[#1F241D]"
              >
                {showTriangle ? 'Dölj' : 'Visa'}
              </button>
            </div>

            {showTriangle && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <div className="rounded-xl bg-white/85 p-3 border border-[#1F241D]/8">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[#4E5C4B]">
                    {part1Label}s behov
                  </span>
                  <p className="mt-1 text-[#1F241D]/85 leading-relaxed">
                    {activeMeta.perspective_triangle.part_1_need ||
                      'FALK lyssnar efter underliggande behov under samtalets gång...'}
                  </p>
                </div>

                <div className="rounded-xl bg-white/85 p-3 border border-[#1F241D]/8">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[#C57B57]">
                    {part2Label}s behov
                  </span>
                  <p className="mt-1 text-[#1F241D]/85 leading-relaxed">
                    {activeMeta.perspective_triangle.part_2_need ||
                      'FALK lyssnar efter underliggande behov under samtalets gång...'}
                  </p>
                </div>

                <div className="sm:col-span-2 rounded-xl bg-[#4E5C4B]/8 p-3 border border-[#4E5C4B]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[#4E5C4B]">
                      Gemensam grund & riktning
                    </span>
                    <p className="mt-0.5 text-[#1F241D] font-medium">
                      {activeMeta.perspective_triangle.shared_ground ||
                        'Ömsesidig respekt och vilja att förstå varandra klarare.'}
                    </p>
                  </div>
                  {activeMeta.perspective_triangle.core_question && (
                    <div className="sm:max-w-xs text-[11px] text-[#1F241D]/80 italic border-t sm:border-t-0 sm:border-l border-[#1F241D]/15 pt-2 sm:pt-0 sm:pl-3">
                      “{activeMeta.perspective_triangle.core_question}”
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Meddelanden */}
          {activeMessages.map((msg) => {
            const isFalk = msg.sender === 'falk';
            const isPart2 = msg.role === 'part_2';
            const isSpeakingThis = speakingMessageId === msg.id;
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isFalk ? 'items-start' : 'items-end'}`}
              >
                <span className="text-[11px] font-medium text-[#1F241D]/60 mb-1 px-1 flex items-center gap-1.5">
                  {isFalk && <Sparkles className="w-3 h-3 text-[#C57B57]" />}
                  <span>{msg.speaker}</span>
                  {isFalk && (
                    <button
                      type="button"
                      onClick={() => handleToggleSpeak(msg)}
                      title={isSpeakingThis ? 'Stoppa uppläsning' : 'Läs upp FALKs reflektion'}
                      className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-white/80 hover:bg-white border border-[#1F241D]/10 text-[#1F241D]/75 transition"
                    >
                      {isSpeakingThis ? (
                        <>
                          <Square className="w-2.5 h-2.5 text-[#C57B57]" />
                          <span>Stoppa</span>
                        </>
                      ) : (
                        <>
                          <Volume2 className="w-2.5 h-2.5 text-[#4E5C4B]" />
                          <span>Lyssna</span>
                        </>
                      )}
                    </button>
                  )}
                </span>
                <div
                  className={`max-w-[88%] sm:max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap shadow-xs ${
                    isFalk
                      ? 'bg-white text-[#1F241D] border border-[#1F241D]/5'
                      : isPart2
                        ? 'bg-[#C57B57] text-white'
                        : 'bg-[#4E5C4B] text-white'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            );
          })}

          {(isSending || isGeneratingCompass) && (
            <div className="flex flex-col items-start">
              <span className="text-[11px] font-medium text-[#1F241D]/60 mb-1 px-1">
                FALK
              </span>
              <div className="bg-white text-[#1F241D]/70 rounded-2xl px-4 py-3 text-sm shadow-xs">
                {isGeneratingCompass
                  ? 'Sammanställer er gemensamma kompass i The Final Compass™...'
                  : 'Lyssnar och väger samman perspektiven...'}
              </div>
            </div>
          )}

          {/* The Final Compass™ Kort & PDF-export */}
          {activeMeta.compass_summary && (
            <div className="rounded-2xl bg-white border-2 border-[#4E5C4B]/30 p-5 shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1F241D]/10 pb-3">
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#C57B57]">
                    WAYJS · GEMENSAM ÖVERENSKOMMELSE
                  </span>
                  <h3 className="text-base font-semibold text-[#1F241D]">
                    The Final Compass™
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    downloadFinalCompassPdf({
                      compass: activeMeta.compass_summary!,
                      triangle: activeMeta.perspective_triangle,
                      part1Name: part1Label,
                      part2Name: part2Label,
                      context: contextMode,
                    })
                  }
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3.5 py-2 rounded-full bg-[#4E5C4B] text-white hover:bg-[#3f4b3c] transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Ladda ner PDF</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl bg-[#F5EFE4]/70 p-3">
                  <p className="font-semibold text-[#4E5C4B] mb-1">1. Vad har vi förstått?</p>
                  <p className="text-[#1F241D]/85 leading-relaxed">
                    {activeMeta.compass_summary.understood}
                  </p>
                </div>
                <div className="rounded-xl bg-[#F5EFE4]/70 p-3">
                  <p className="font-semibold text-[#4E5C4B] mb-1">2. Vad verkar viktigast?</p>
                  <p className="text-[#1F241D]/85 leading-relaxed">
                    {activeMeta.compass_summary.most_important}
                  </p>
                </div>
                <div className="rounded-xl bg-[#F5EFE4]/70 p-3">
                  <p className="font-semibold text-[#4E5C4B] mb-1">
                    3. Vilket perspektiv saknades från början?
                  </p>
                  <p className="text-[#1F241D]/85 leading-relaxed">
                    {activeMeta.compass_summary.missing_perspective}
                  </p>
                </div>
                <div className="rounded-xl bg-[#F5EFE4]/70 p-3">
                  <p className="font-semibold text-[#4E5C4B] mb-1">4. Vad känns mest sant nu?</p>
                  <p className="text-[#1F241D]/85 leading-relaxed">
                    {activeMeta.compass_summary.most_true_now}
                  </p>
                </div>
              </div>

              {activeMeta.compass_summary.next_steps?.length > 0 && (
                <div className="rounded-xl bg-[#4E5C4B]/8 border border-[#4E5C4B]/20 p-3.5 text-xs">
                  <p className="font-semibold text-[#1F241D] mb-1.5">
                    5. Era nästa steg (ert eget val och ansvar)
                  </p>
                  <ul className="space-y-1 text-[#1F241D]/85">
                    {activeMeta.compass_summary.next_steps.map((step, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-[#C57B57] font-bold">•</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {errorBanner && (
            <div className="rounded-xl bg-[#C57B57]/15 border border-[#C57B57]/40 px-4 py-3 text-xs text-[#1F241D] flex items-center justify-between gap-2">
              <span>{errorBanner}</span>
              {roomCode && participantToken && (
                <button
                  type="button"
                  onClick={() => fetchRoomState(roomCode, participantToken)}
                  className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full bg-white shrink-0"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Uppdatera</span>
                </button>
              )}
            </div>
          )}

          <div ref={chatEndRef} />
        </div>
      </main>

      {/* Skrivfält & Avslut med The Final Compass™ */}
      <footer className="sticky bottom-0 bg-[#E8DCC4] border-t border-[#1F241D]/10 px-4 py-3">
        <div className="max-w-3xl mx-auto space-y-2">
          {activeMessages.length >= 3 && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => handleSendMessage(undefined, true)}
                disabled={isGeneratingCompass || isSending}
                className="inline-flex items-center gap-1.5 text-[11px] font-medium px-3 py-1 rounded-full bg-[#F5EFE4] hover:bg-white text-[#1F241D] border border-[#1F241D]/15 transition disabled:opacity-40"
              >
                <Compass className="w-3.5 h-3.5 text-[#C57B57]" />
                <span>
                  {isGeneratingCompass
                    ? 'Skapar The Final Compass™...'
                    : 'Avsluta & skapa The Final Compass™'}
                </span>
              </button>
            </div>
          )}

          <form
            onSubmit={(e) => handleSendMessage(e, false)}
            className="flex items-center gap-2 bg-white rounded-full px-3.5 py-2 shadow-xs border border-[#1F241D]/10"
          >
            <span
              className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${
                roomData && viewerRole === 'part_2'
                  ? 'bg-[#C57B57]/15 text-[#C57B57]'
                  : 'bg-[#4E5C4B]/10 text-[#4E5C4B]'
              }`}
            >
              {activeSpeaker}
            </span>

            <button
              type="button"
              onClick={handleToggleMic}
              title={isListening ? 'Stoppa röstinmatning' : 'Tala in ditt perspektiv'}
              className={`p-1.5 rounded-full transition shrink-0 ${
                isListening
                  ? 'bg-[#C57B57] text-white animate-pulse'
                  : 'text-[#1F241D]/65 hover:bg-[#F5EFE4]'
              }`}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Dela ${activeSpeaker}s perspektiv med FALK...`}
              disabled={isSending || isGeneratingCompass}
              className="flex-1 bg-transparent text-sm text-[#1F241D] placeholder:text-[#1F241D]/45 outline-none min-w-0"
            />

            <button
              type="submit"
              disabled={!input.trim() || isSending || isGeneratingCompass}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#4E5C4B] text-white text-xs font-medium disabled:opacity-40 hover:bg-[#3f4b3c] transition shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Skicka</span>
            </button>
          </form>

          <p className="text-center text-[10px] tracking-[0.2em] text-[#1F241D]/45">
            POWERED BY WAYJS
          </p>
        </div>
      </footer>
    </div>
  );
}
