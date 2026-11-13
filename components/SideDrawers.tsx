'use client';

import React, { useMemo, useState } from 'react';
import {
  X,
  MessageSquare,
  BookOpen,
  Compass,
  Plus,
  ArrowUpDown,
  Pin,
  MoreVertical,
  Trash2,
  FileText,
  Settings,
  LogIn,
  LogOut,
  Lock,
  Lightbulb,
  Clock,
  ExternalLink,
} from 'lucide-react';

export type MainView = 'chat' | 'library' | 'dashboard';

export interface DrawerConversation {
  id: string;
  title: string;
  is_pinned?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface DrawerInsight {
  id: string;
  type?: string;
  content: string;
  is_pinned?: boolean;
  reminder_at?: string | null;
  created_at?: string;
  session_id?: string | null;
  source_context?: string | null;
}

export interface DrawerReminder {
  id: string;
  content: string;
  frequency?: string | null;
  reminder_at?: string | null;
  remind_at?: string | null;
  is_active?: boolean;
  created_at?: string;
}

interface SideDrawersProps {
  isLeftOpen: boolean;
  onCloseLeft: () => void;
  isRightOpen: boolean;
  onCloseRight: () => void;
  activeView: MainView;
  onSelectView: (view: MainView) => void;
  isLoggedIn: boolean;
  isPremium: boolean;
  isDarkMode?: boolean;
  conversations: DrawerConversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onTogglePinConversation: (id: string, nextPinned: boolean) => void;
  onDeleteConversation: (id: string) => void;
  onExportSessionPdf: (id: string) => void;
  onOpenAuth: () => void;
  onLogout: () => void;
  onOpenSettings: () => void;
  onOpenPaywall: (reason: string) => void;
  insights: DrawerInsight[];
  reminders: DrawerReminder[];
  onDeleteInsight: (id: string) => void;
  onDeleteReminder: (id: string) => void;
  onOpenCreateReminder: () => void;
  onJumpToSession?: (sessionId: string) => void;
}

function formatSvDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('sv-SE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatSvDateTime(dateStr?: string | null): string {
  if (!dateStr) return 'Ingen tid angiven';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleString('sv-SE', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatFrequency(freq?: string | null): string {
  switch ((freq || '').toLowerCase()) {
    case 'daily':
    case 'dagligen':
      return 'Dagligen';
    case 'weekly':
    case 'veckovis':
      return 'Veckovis';
    case 'monthly':
    case 'månadsvis':
      return 'Månadsvis';
    default:
      return 'Engångspåminnelse';
  }
}

export default function SideDrawers({
  isLeftOpen,
  onCloseLeft,
  isRightOpen,
  onCloseRight,
  activeView,
  onSelectView,
  isLoggedIn,
  isPremium,
  isDarkMode = false,
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewChat,
  onTogglePinConversation,
  onDeleteConversation,
  onExportSessionPdf,
  onOpenAuth,
  onLogout,
  onOpenSettings,
  onOpenPaywall,
  insights,
  reminders,
  onDeleteInsight,
  onDeleteReminder,
  onOpenCreateReminder,
  onJumpToSession,
}: SideDrawersProps) {
  const [sortNewestFirst, setSortNewestFirst] = useState(true);
  const [openMenuConvId, setOpenMenuConvId] = useState<string | null>(null);
  const [rightFilter, setRightFilter] = useState<'all' | 'insights' | 'reminders'>('all');

  const sortedConversations = useMemo(() => {
    const copy = [...conversations];
    copy.sort((a, b) => {
      const pinA = a.is_pinned ? 1 : 0;
      const pinB = b.is_pinned ? 1 : 0;
      if (pinA !== pinB) return pinB - pinA;

      const timeA = new Date(a.updated_at || a.created_at || 0).getTime();
      const timeB = new Date(b.updated_at || b.created_at || 0).getTime();
      return sortNewestFirst ? timeB - timeA : timeA - timeB;
    });
    return copy;
  }, [conversations, sortNewestFirst]);

  const handleNavClick = (target: MainView) => {
    if (target === 'library' && !isPremium) {
      onCloseLeft();
      onOpenPaywall('Biblioteket med 15 guidade övningar kräver FALK Premium.');
      return;
    }
    if (target === 'dashboard' && !isPremium) {
      onCloseLeft();
      onOpenPaywall('Min utveckling och dina 4 kompasser kräver FALK Premium.');
      return;
    }
    onSelectView(target);
    onCloseLeft();
  };

  const drawerSurface = isDarkMode
    ? 'bg-[#1F241E] text-[#F5EFE6] border-[#3A4338]'
    : 'bg-[#E8DCC4] text-[#1E241D] border-[#C9BC9F]';

  const cardSurface = isDarkMode
    ? 'bg-[#2A3129] border-[#3E483C] text-[#F5EFE6]'
    : 'bg-[#FAF7F2] border-[#D8CCB4] text-[#1E241D]';

  const mutedText = isDarkMode ? 'text-[#B8C2B6]' : 'text-[#5A6358]';

  return (
    <>
      {/* VÄNSTER MENY (HAMBURGERMENY) */}
      {isLeftOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-[1px]"
            onClick={() => {
              setOpenMenuConvId(null);
              onCloseLeft();
            }}
          />
          <aside
            aria-label="Huvudmeny"
            className={`relative z-10 flex h-full w-80 max-w-[85vw] flex-col border-r shadow-2xl transition-transform ${drawerSurface}`}
          >
            {/* Topp */}
            <div className="flex items-start justify-between border-b border-black/10 px-5 py-4">
              <div>
                <span className="block text-xl font-bold tracking-[0.18em]">FALK</span>
                <span className={`mt-0.5 block text-xs italic ${mutedText}`}>
                  En kompass med perspektiv
                </span>
              </div>
              <button
                type="button"
                onClick={onCloseLeft}
                aria-label="Stäng meny"
                className="rounded-lg p-1.5 transition hover:bg-black/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Primär navigation */}
            <nav className="space-y-1.5 border-b border-black/10 px-3 py-3">
              <button
                type="button"
                onClick={() => handleNavClick('chat')}
                className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-left text-sm font-medium transition ${
                  activeView === 'chat'
                    ? 'bg-[#4E5C4B] text-white shadow-sm'
                    : 'hover:bg-black/5'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <MessageSquare className="h-4 w-4" />
                  Chatt
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleNavClick('library')}
                className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-left text-sm font-medium transition ${
                  activeView === 'library'
                    ? 'bg-[#4E5C4B] text-white shadow-sm'
                    : 'hover:bg-black/5'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <BookOpen className="h-4 w-4" />
                  Bibliotek
                </span>
                {!isPremium && <Lock className="h-3.5 w-3.5 text-[#C57B57]" />}
              </button>

              <button
                type="button"
                onClick={() => handleNavClick('dashboard')}
                className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-left text-sm font-medium transition ${
                  activeView === 'dashboard'
                    ? 'bg-[#4E5C4B] text-white shadow-sm'
                    : 'hover:bg-black/5'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Compass className="h-4 w-4" />
                  Min utveckling
                </span>
                {!isPremium && <Lock className="h-3.5 w-3.5 text-[#C57B57]" />}
              </button>
            </nav>

            {/* Mitten: Sessionshistorik */}
            <div className="flex min-h-0 flex-1 flex-col px-3 py-3">
              <div className="mb-2 flex items-center justify-between px-1">
                <span className={`text-xs font-semibold uppercase tracking-wider ${mutedText}`}>
                  Sessioner ({sortedConversations.length})
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setSortNewestFirst((prev) => !prev)}
                    title={sortNewestFirst ? 'Sortering: Senaste först' : 'Sortering: Äldsta först'}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition hover:bg-black/10"
                  >
                    <ArrowUpDown className="h-3.5 w-3.5" />
                    <span>{sortNewestFirst ? 'Senaste' : 'Första'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onNewChat();
                      onCloseLeft();
                    }}
                    title="Ny session / Startsidan"
                    aria-label="Ny session"
                    className="rounded-lg bg-[#4E5C4B] p-1.5 text-white transition hover:opacity-90"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 space-y-1.5 overflow-y-auto pr-1">
                {sortedConversations.length === 0 ? (
                  <p className={`rounded-xl border border-dashed border-black/15 p-3 text-xs ${mutedText}`}>
                    Inga sparade sessioner ännu. Starta ett samtal för att bygga din historik.
                  </p>
                ) : (
                  sortedConversations.map((conv) => {
                    const isSelected = conv.id === activeConversationId && activeView === 'chat';
                    const isMenuOpen = openMenuConvId === conv.id;

                    return (
                      <div
                        key={conv.id}
                        className={`relative rounded-xl border transition ${
                          isSelected
                            ? 'border-[#4E5C4B] bg-[#A8BFA1]/35'
                            : `${cardSurface} hover:border-[#C57B57]/60`
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 px-3 py-2">
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuConvId(null);
                              onSelectConversation(conv.id);
                              onCloseLeft();
                            }}
                            className="min-w-0 flex-1 text-left"
                          >
                            <div className="flex items-center gap-1.5">
                              {conv.is_pinned && (
                                <Pin className="h-3 w-3 shrink-0 text-[#C57B57]" />
                              )}
                              <span className="truncate text-xs font-semibold">
                                {conv.title || 'Kompasssamtal'}
                              </span>
                            </div>
                            <span className={`mt-0.5 block text-[11px] ${mutedText}`}>
                              {formatSvDate(conv.updated_at || conv.created_at)}
                            </span>
                          </button>

                          <button
                            type="button"
                            aria-label="Sessionsalternativ"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuConvId(isMenuOpen ? null : conv.id);
                            }}
                            className="rounded-lg p-1.5 transition hover:bg-black/10"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </div>

                        {isMenuOpen && (
                          <div
                            className={`absolute right-2 top-11 z-20 w-44 rounded-xl border p-1 shadow-lg ${cardSurface}`}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuConvId(null);
                                onTogglePinConversation(conv.id, !conv.is_pinned);
                              }}
                              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition hover:bg-black/5"
                            >
                              <Pin className="h-3.5 w-3.5 text-[#C57B57]" />
                              <span>{conv.is_pinned ? 'Lossa nål' : 'Nåla överst'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuConvId(null);
                                onExportSessionPdf(conv.id);
                              }}
                              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition hover:bg-black/5"
                            >
                              <FileText className="h-3.5 w-3.5 text-[#4E5C4B]" />
                              <span>Dela / Spara PDF</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuConvId(null);
                                onDeleteConversation(conv.id);
                              }}
                              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-red-600 transition hover:bg-red-500/10"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span>Radera session</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Botten: Badge, Auth & Kugghjul */}
            <div className="space-y-2.5 border-t border-black/10 px-4 py-3.5">
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wider text-white ${
                    isPremium ? 'bg-[#4E5C4B]' : 'bg-[#C57B57]'
                  }`}
                >
                  {isPremium ? 'PREMIUM' : 'GÄST'}
                </span>

                {isLoggedIn ? (
                  <button
                    type="button"
                    onClick={() => {
                      onCloseLeft();
                      onLogout();
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition hover:bg-black/10"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Logga ut
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      onCloseLeft();
                      onOpenAuth();
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#4E5C4B] px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90"
                  >
                    <LogIn className="h-3.5 w-3.5" />
                    Logga in
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  onCloseLeft();
                  onOpenSettings();
                }}
                className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-xs font-medium transition hover:border-[#4E5C4B] ${cardSurface}`}
              >
                <Settings className="h-4 w-4 text-[#4E5C4B]" />
                <span>Inställningar &amp; Integritet</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* HÖGER MENY (GLÖDLAMPA: INSIKTER & PÅMINNELSER) */}
      {isRightOpen && isPremium && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-[1px]"
            onClick={onCloseRight}
          />
          <aside
            aria-label="Insikter och påminnelser"
            className={`relative z-10 flex h-full w-96 max-w-[90vw] flex-col border-l shadow-2xl transition-transform ${drawerSurface}`}
          >
            {/* Topp */}
            <div className="flex items-center justify-between border-b border-black/10 px-5 py-4">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-[#C57B57]" />
                <h2 className="text-base font-bold">Insikter &amp; Påminnelser</h2>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={onOpenCreateReminder}
                  title="Skapa ny påminnelse"
                  aria-label="Skapa ny påminnelse"
                  className="inline-flex items-center gap-1 rounded-lg bg-[#4E5C4B] px-2.5 py-1.5 text-xs font-medium text-white transition hover:opacity-90"
                >
                  <Clock className="h-3.5 w-3.5" />
                  <span>+ Påminnelse</span>
                </button>
                <button
                  type="button"
                  onClick={onCloseRight}
                  aria-label="Stäng insiktsmeny"
                  className="rounded-lg p-1.5 transition hover:bg-black/10"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Filter */}
            <div className="grid grid-cols-3 gap-1.5 border-b border-black/10 px-4 py-2.5">
              <button
                type="button"
                onClick={() => setRightFilter('all')}
                className={`rounded-lg py-1.5 text-xs font-medium transition ${
                  rightFilter === 'all'
                    ? 'bg-[#4E5C4B] text-white'
                    : 'hover:bg-black/5'
                }`}
              >
                Visa båda ({insights.length + reminders.length})
              </button>
              <button
                type="button"
                onClick={() => setRightFilter('insights')}
                className={`rounded-lg py-1.5 text-xs font-medium transition ${
                  rightFilter === 'insights'
                    ? 'bg-[#4E5C4B] text-white'
                    : 'hover:bg-black/5'
                }`}
              >
                Insikter ({insights.length})
              </button>
              <button
                type="button"
                onClick={() => setRightFilter('reminders')}
                className={`rounded-lg py-1.5 text-xs font-medium transition ${
                  rightFilter === 'reminders'
                    ? 'bg-[#4E5C4B] text-white'
                    : 'hover:bg-black/5'
                }`}
              >
                Påminnelser ({reminders.length})
              </button>
            </div>

            {/* Lista */}
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {(rightFilter === 'all' || rightFilter === 'insights') &&
                insights.map((item) => (
                  <div
                    key={`insight-${item.id}`}
                    className={`rounded-2xl border p-3.5 shadow-sm ${cardSurface}`}
                  >
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#A8BFA1]/40 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#2F3B2D]">
                        <Lightbulb className="h-3 w-3" />
                        Insikt
                      </span>
                      <div className="flex items-center gap-1">
                        {item.session_id && onJumpToSession && (
                          <button
                            type="button"
                            onClick={() => {
                              onJumpToSession(item.session_id!);
                              onCloseRight();
                            }}
                            title="Gå till ursprungssamtal"
                            className="rounded-lg p-1 text-[#4E5C4B] transition hover:bg-black/10"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onDeleteInsight(item.id)}
                          title="Radera insikt"
                          aria-label="Radera insikt"
                          className="rounded-lg p-1 text-red-600 transition hover:bg-red-500/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <p className="text-sm leading-relaxed">{item.content}</p>

                    {item.source_context && (
                      <p className={`mt-2 border-l-2 border-[#C57B57] pl-2.5 text-xs italic ${mutedText}`}>
                        &ldquo;{item.source_context}&rdquo;
                      </p>
                    )}

                    {item.created_at && (
                      <span className={`mt-2 block text-[11px] ${mutedText}`}>
                        Sparad {formatSvDate(item.created_at)}
                      </span>
                    )}
                  </div>
                ))}

              {(rightFilter === 'all' || rightFilter === 'reminders') &&
                reminders.map((rem) => (
                  <div
                    key={`reminder-${rem.id}`}
                    className={`rounded-2xl border p-3.5 shadow-sm ${cardSurface}`}
                  >
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#C57B57]/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#9A5332]">
                        <Clock className="h-3 w-3" />
                        {formatFrequency(rem.frequency)}
                      </span>
                      <button
                        type="button"
                        onClick={() => onDeleteReminder(rem.id)}
                        title="Radera påminnelse"
                        aria-label="Radera påminnelse"
                        className="rounded-lg p-1 text-red-600 transition hover:bg-red-500/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <p className="text-sm leading-relaxed">{rem.content}</p>

                    <span className={`mt-2 block text-[11px] font-medium ${mutedText}`}>
                      Tidpunkt: {formatSvDateTime(rem.reminder_at || rem.remind_at)}
                    </span>
                  </div>
                ))}

              {((rightFilter === 'all' && insights.length === 0 && reminders.length === 0) ||
                (rightFilter === 'insights' && insights.length === 0) ||
                (rightFilter === 'reminders' && reminders.length === 0)) && (
                <div className={`rounded-2xl border border-dashed border-black/15 p-5 text-center text-xs leading-relaxed ${mutedText}`}>
                  Inga poster att visa här ännu. Använd nål- eller klockikonen under Falks svar för att spara insikter och påminnelser.
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
