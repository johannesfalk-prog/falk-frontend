'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Compass,
  Lightbulb,
  Loader2,
  MessageSquare,
  Plus,
  RefreshCw,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import {
  COMPASS_FOUR,
  DEVELOPMENT_AREAS,
  GoalItem,
  computeCompassFromAreas,
} from '../lib/types';

export interface CalibrationSnapshot {
  id: string;
  scores: Record<string, number>;
  created_at: string;
}

export interface DashboardInsightPreview {
  id: string;
  content: string;
  type?: string;
  created_at?: string;
}

interface DashboardViewProps {
  backendUrl: string;
  getAuthHeaders: () => Promise<Record<string, string>>;
  darkMode: boolean;
  savedCompassScores: Record<string, number> | null;
  insights: DashboardInsightPreview[];
  onOpenCalibration: () => void;
  onStartReflection: (promptText: string) => void;
  onBackToChat: () => void;
  onSyncLatestScores?: (scores: Record<string, number>) => void;
}

function extractCompassValues(
  scores: Record<string, number> | null
): Record<'personal' | 'relation' | 'work' | 'life', number> | null {
  if (!scores || typeof scores !== 'object') return null;

  const hasAreaKeys = DEVELOPMENT_AREAS.some(
    (a) => typeof scores[a.name] === 'number'
  );
  if (hasAreaKeys) {
    return computeCompassFromAreas(scores);
  }

  const hasCompassKeys = COMPASS_FOUR.some(
    (c) => typeof scores[c.key] === 'number'
  );
  if (hasCompassKeys) {
    return {
      personal: typeof scores.personal === 'number' ? scores.personal : 0,
      relation: typeof scores.relation === 'number' ? scores.relation : 0,
      work: typeof scores.work === 'number' ? scores.work : 0,
      life: typeof scores.life === 'number' ? scores.life : 0,
    };
  }

  return null;
}

function formatShortDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });
}

export default function DashboardView({
  backendUrl,
  getAuthHeaders,
  darkMode,
  savedCompassScores,
  insights,
  onOpenCalibration,
  onStartReflection,
  onBackToChat,
  onSyncLatestScores,
}: DashboardViewProps) {
  const [calibrations, setCalibrations] = useState<CalibrationSnapshot[]>([]);
  const [goals, setGoals] = useState<GoalItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Nytt mål-formulär
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [newGoalArea, setNewGoalArea] = useState<string>(
    DEVELOPMENT_AREAS[0].name
  );
  const [isAddingGoal, setIsAddingGoal] = useState(false);
  const [goalActionId, setGoalActionId] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const [calRes, goalsRes] = await Promise.all([
        fetch(`${backendUrl}/api/calibration`, { headers }),
        fetch(`${backendUrl}/api/goals`, { headers }),
      ]);

      if (calRes.ok) {
        const calJson = await calRes.json();
        const rawList = Array.isArray(calJson?.calibrations)
          ? calJson.calibrations
          : Array.isArray(calJson)
            ? calJson
            : [];
        const normalized: CalibrationSnapshot[] = rawList
          .filter(
            (item: Record<string, unknown>) =>
              item && typeof item.scores === 'object' && item.scores !== null
          )
          .map((item: Record<string, unknown>, idx: number) => ({
            id: String(item.id || `cal-${idx}`),
            scores: item.scores as Record<string, number>,
            created_at: String(item.created_at || ''),
          }));
        setCalibrations(normalized);
        if (normalized.length > 0 && onSyncLatestScores) {
          onSyncLatestScores(normalized[0].scores);
        }
      }

      if (goalsRes.ok) {
        const goalsJson = await goalsRes.json();
        const list = Array.isArray(goalsJson?.goals)
          ? goalsJson.goals
          : Array.isArray(goalsJson)
            ? goalsJson
            : [];
        setGoals(list as GoalItem[]);
      }
    } catch {
      setError('Kunde inte hämta utvecklingsdata just nu.');
    } finally {
      setLoading(false);
    }
  }, [backendUrl, getAuthHeaders, onSyncLatestScores]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Senaste poäng: prioritera databasens senaste rad, annars prop/localStorage
  const activeScores = useMemo(() => {
    if (calibrations.length > 0) return calibrations[0].scores;
    return savedCompassScores;
  }, [calibrations, savedCompassScores]);

  const previousScores = useMemo(() => {
    if (calibrations.length > 1) return calibrations[1].scores;
    return null;
  }, [calibrations]);

  const compassValues = useMemo(
    () => extractCompassValues(activeScores),
    [activeScores]
  );

  const averageCompassScore = useMemo(() => {
    if (!compassValues) return null;
    const sum =
      compassValues.personal +
      compassValues.relation +
      compassValues.work +
      compassValues.life;
    return Math.round(sum / 4);
  }, [compassValues]);

  // Kronologisk serie (äldst -> nyast, max 8 punkter) för utvecklingsgrafen
  const trendSeries = useMemo(() => {
    const chrono = [...calibrations].reverse().slice(-8);
    return chrono.map((snap, idx) => {
      const c = extractCompassValues(snap.scores) || {
        personal: 0,
        relation: 0,
        work: 0,
        life: 0,
      };
      const avg = Math.round((c.personal + c.relation + c.work + c.life) / 4);
      return {
        id: snap.id,
        label: formatShortDate(snap.created_at) || `#${idx + 1}`,
        avg,
        ...c,
      };
    });
  }, [calibrations]);

  // Hitta lägsta område för reflektionsförslag
  const focusSuggestion = useMemo(() => {
    if (!activeScores) return null;
    let lowestArea: string | null = null;
    let lowestVal = 101;
    for (const area of DEVELOPMENT_AREAS) {
      const val = activeScores[area.name];
      if (typeof val === 'number' && val < lowestVal) {
        lowestVal = val;
        lowestArea = area.name;
      }
    }
    if (!lowestArea) return null;
    return { area: lowestArea, score: lowestVal };
  }, [activeScores]);

  // Mål-CRUD
  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newGoalTitle.trim();
    if (!title || isAddingGoal) return;

    setIsAddingGoal(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${backendUrl}/api/goals`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title,
          area: newGoalArea,
          progress: 0,
          status: 'active',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.goal) {
          setGoals((prev) => [data.goal as GoalItem, ...prev]);
        } else {
          await fetchDashboardData();
        }
        setNewGoalTitle('');
      }
    } finally {
      setIsAddingGoal(false);
    }
  };

  const handleUpdateGoalProgress = async (
    goal: GoalItem,
    nextProgress: number
  ) => {
    const clamped = Math.max(0, Math.min(100, nextProgress));
    const nextStatus = clamped >= 100 ? 'completed' : 'active';
    setGoalActionId(goal.id);
    setGoals((prev) =>
      prev.map((g) =>
        g.id === goal.id ? { ...g, progress: clamped, status: nextStatus } : g
      )
    );
    try {
      const headers = await getAuthHeaders();
      await fetch(`${backendUrl}/api/goals`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          id: goal.id,
          progress: clamped,
          status: nextStatus,
        }),
      });
    } finally {
      setGoalActionId(null);
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    setGoalActionId(goalId);
    setGoals((prev) => prev.filter((g) => g.id !== goalId));
    try {
      const headers = await getAuthHeaders();
      await fetch(
        `${backendUrl}/api/goals?id=${encodeURIComponent(goalId)}`,
        {
          method: 'DELETE',
          headers,
        }
      );
    } finally {
      setGoalActionId(null);
    }
  };

  const cardSurface = darkMode
    ? 'bg-[#23221F] border-[#383630] text-[#F5EFE6]'
    : 'bg-[#FAF7F0] border-[#DFD4BE] text-[#1C1C1C]';

  const subtleSurface = darkMode
    ? 'bg-[#1B1A17] border-[#32302B]'
    : 'bg-[#F3ECE0] border-[#E2D7C3]';

  // SVG Radar-koordinater för de 4 kompasserna (Topp=Personlig, Höger=Relation, Botten=Arbete, Vänster=Liv)
  const radarGeometry = useMemo(() => {
    const cx = 110;
    const cy = 110;
    const maxR = 76;
    const vals = compassValues || {
      personal: 0,
      relation: 0,
      work: 0,
      life: 0,
    };
    const pTop = `${cx},${cy - (vals.personal / 100) * maxR}`;
    const pRight = `${cx + (vals.relation / 100) * maxR},${cy}`;
    const pBottom = `${cx},${cy + (vals.work / 100) * maxR}`;
    const pLeft = `${cx - (vals.life / 100) * maxR},${cy}`;
    return {
      cx,
      cy,
      maxR,
      polygonPoints: `${pTop} ${pRight} ${pBottom} ${pLeft}`,
      dots: [
        { x: cx, y: cy - (vals.personal / 100) * maxR },
        { x: cx + (vals.relation / 100) * maxR, y: cy },
        { x: cx, y: cy + (vals.work / 100) * maxR },
        { x: cx - (vals.life / 100) * maxR, y: cy },
      ],
    };
  }, [compassValues]);

  const activeGoalsCount = goals.filter((g) => g.status !== 'completed').length;

  return (
    <section className="space-y-6 pb-8">
      {/* TOPPHEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#C57B57]" />
            <span>Min utveckling</span>
          </h2>
          <p className="text-xs sm:text-sm opacity-75 mt-0.5">
            Översikt över dina 4 kompasser, 8 utvecklingsområden och aktiva mål.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onBackToChat}
            className={`px-3 py-2 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-opacity hover:opacity-90 ${cardSurface}`}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Chatt</span>
          </button>
          <button
            type="button"
            onClick={fetchDashboardData}
            disabled={loading}
            title="Uppdatera data"
            className={`p-2 rounded-xl border text-xs transition-opacity hover:opacity-90 ${cardSurface}`}
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}
            />
          </button>
          <button
            type="button"
            onClick={onOpenCalibration}
            className="px-3.5 py-2 rounded-xl bg-[#4E5C4B] text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm hover:opacity-95 transition-opacity"
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Kalibrera kompassen</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl px-4 py-3 text-xs bg-[#C57B57]/15 border border-[#C57B57]/40 text-[#C57B57]">
          {error}
        </div>
      )}

      {/* 4 KPI-ÖVERSIKTSKORT (RIKTIG DATA) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className={`rounded-2xl p-4 border shadow-xs ${cardSurface}`}>
          <div className="flex items-center justify-between text-xs opacity-70 mb-1">
            <span>Kompassindex</span>
            <Compass className="w-3.5 h-3.5 text-[#4E5C4B]" />
          </div>
          <div className="text-2xl font-bold text-[#4E5C4B] dark:text-[#A8BFA1]">
            {averageCompassScore !== null ? `${averageCompassScore}%` : '—'}
          </div>
          <div className="text-[11px] opacity-65 mt-0.5">
            {averageCompassScore !== null
              ? 'Snitt över 4 kompasser'
              : 'Ej kalibrerad ännu'}
          </div>
        </div>

        <div className={`rounded-2xl p-4 border shadow-xs ${cardSurface}`}>
          <div className="flex items-center justify-between text-xs opacity-70 mb-1">
            <span>Kalibreringar</span>
            <TrendingUp className="w-3.5 h-3.5 text-[#C57B57]" />
          </div>
          <div className="text-2xl font-bold">{calibrations.length}</div>
          <div className="text-[11px] opacity-65 mt-0.5">
            {calibrations[0]?.created_at
              ? `Senast ${formatShortDate(calibrations[0].created_at)}`
              : 'Gör din första mätning'}
          </div>
        </div>

        <div className={`rounded-2xl p-4 border shadow-xs ${cardSurface}`}>
          <div className="flex items-center justify-between text-xs opacity-70 mb-1">
            <span>Aktiva mål</span>
            <Target className="w-3.5 h-3.5 text-[#C57B57]" />
          </div>
          <div className="text-2xl font-bold">{activeGoalsCount}</div>
          <div className="text-[11px] opacity-65 mt-0.5">
            {goals.length} totalt sparade
          </div>
        </div>

        <div className={`rounded-2xl p-4 border shadow-xs ${cardSurface}`}>
          <div className="flex items-center justify-between text-xs opacity-70 mb-1">
            <span>Insikter</span>
            <Lightbulb className="w-3.5 h-3.5 text-[#C57B57]" />
          </div>
          <div className="text-2xl font-bold">{insights.length}</div>
          <div className="text-[11px] opacity-65 mt-0.5">
            Sparade från samtal
          </div>
        </div>
      </div>

      {/* TOMT UTGÅNGSLÄGE OM INGEN KALIBRERING FINNS */}
      {!loading && !compassValues && (
        <div className={`rounded-2xl p-5 border ${cardSurface}`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs font-bold uppercase tracking-wider text-[#C57B57]">
                Kompasskalibrering saknas
              </div>
              <h3 className="text-base font-bold">
                Skapa ditt nuläge över de 8 utvecklingsområdena
              </h3>
              <p className="text-xs opacity-75 max-w-xl">
                FALK mäter inte prestation eller tempo, utan riktning och
                medvetenhet. Gör en 3-minuters kalibrering för att aktivera
                ditt kompasshjul och följa din utveckling över tid.
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenCalibration}
              className="shrink-0 px-4 py-2.5 rounded-xl bg-[#C57B57] text-white text-xs font-semibold hover:opacity-95 transition-opacity"
            >
              Starta Kompasskalibrering
            </button>
          </div>
        </div>
      )}

      {/* RADARHJUL + UTVECKLINGSGRAF ÖVER TID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* KOMPASSHJULET (SVG RADAR) */}
        <div className={`rounded-2xl p-5 border shadow-xs ${cardSurface}`}>
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-sm font-bold">Kompasshjulet</h3>
              <p className="text-[11px] opacity-70">
                Balansen mellan dina 4 livskompasser
              </p>
            </div>
            {compassValues && (
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#4E5C4B]/15 text-[#4E5C4B] dark:text-[#A8BFA1]">
                Nuläge
              </span>
            )}
          </div>

          <div className="flex items-center justify-center py-1">
            <svg
              viewBox="0 0 220 220"
              className="w-52 h-52 overflow-visible"
              aria-label="Kompasshjulet"
            >
              {[0.25, 0.5, 0.75, 1].map((step) => {
                const r = radarGeometry.maxR * step;
                const pts = `${radarGeometry.cx},${radarGeometry.cy - r} ${
                  radarGeometry.cx + r
                },${radarGeometry.cy} ${radarGeometry.cx},${
                  radarGeometry.cy + r
                } ${radarGeometry.cx - r},${radarGeometry.cy}`;
                return (
                  <polygon
                    key={step}
                    points={pts}
                    fill="none"
                    stroke={darkMode ? '#3E3C35' : '#D8CCB6'}
                    strokeWidth="1"
                  />
                );
              })}
              <line
                x1={radarGeometry.cx}
                y1={radarGeometry.cy - radarGeometry.maxR}
                x2={radarGeometry.cx}
                y2={radarGeometry.cy + radarGeometry.maxR}
                stroke={darkMode ? '#3E3C35' : '#D8CCB6'}
                strokeWidth="1"
              />
              <line
                x1={radarGeometry.cx - radarGeometry.maxR}
                y1={radarGeometry.cy}
                x2={radarGeometry.cx + radarGeometry.maxR}
                y2={radarGeometry.cy}
                stroke={darkMode ? '#3E3C35' : '#D8CCB6'}
                strokeWidth="1"
              />

              {compassValues && (
                <>
                  <polygon
                    points={radarGeometry.polygonPoints}
                    fill="#4E5C4B"
                    fillOpacity="0.28"
                    stroke="#4E5C4B"
                    strokeWidth="2"
                  />
                  {radarGeometry.dots.map((pt, i) => (
                    <circle
                      key={i}
                      cx={pt.x}
                      cy={pt.y}
                      r="3.5"
                      fill="#C57B57"
                    />
                  ))}
                </>
              )}

              <text
                x={radarGeometry.cx}
                y={18}
                textAnchor="middle"
                className="text-[10px] font-semibold fill-current"
              >
                Personlig {compassValues ? `${compassValues.personal}%` : ''}
              </text>
              <text
                x={214}
                y={radarGeometry.cy + 3}
                textAnchor="end"
                className="text-[10px] font-semibold fill-current"
              >
                Relation {compassValues ? `${compassValues.relation}%` : ''}
              </text>
              <text
                x={radarGeometry.cx}
                y={210}
                textAnchor="middle"
                className="text-[10px] font-semibold fill-current"
              >
                Arbete {compassValues ? `${compassValues.work}%` : ''}
              </text>
              <text
                x={6}
                y={radarGeometry.cy + 3}
                textAnchor="start"
                className="text-[10px] font-semibold fill-current"
              >
                Liv {compassValues ? `${compassValues.life}%` : ''}
              </text>
            </svg>
          </div>
        </div>

        {/* MIN UTVECKLING ÖVER TID (SVG LINJEGRAF) */}
        <div className={`rounded-2xl p-5 border shadow-xs flex flex-col justify-between ${cardSurface}`}>
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-sm font-bold">Utveckling över tid</h3>
                <p className="text-[11px] opacity-70">
                  Kompassindex per kalibreringstillfälle
                </p>
              </div>
              {trendSeries.length >= 2 && (
                <span className="text-[11px] font-semibold text-[#C57B57]">
                  {trendSeries[trendSeries.length - 1].avg -
                    trendSeries[0].avg >=
                  0
                    ? `+${
                        trendSeries[trendSeries.length - 1].avg -
                        trendSeries[0].avg
                      }%`
                    : `${
                        trendSeries[trendSeries.length - 1].avg -
                        trendSeries[0].avg
                      }%`}
                </span>
              )}
            </div>

            {trendSeries.length === 0 ? (
              <div
                className={`rounded-xl p-6 border text-center text-xs opacity-70 my-4 ${subtleSurface}`}
              >
                Dina kalibreringar ritas ut här över tid så snart du sparat din
                första kompassmätning.
              </div>
            ) : (
              <div className="pt-2">
                <svg
                  viewBox="0 0 320 155"
                  className="w-full h-40 overflow-visible"
                  aria-label="Utveckling över tid"
                >
                  {[0, 50, 100].map((val) => {
                    const y = 120 - (val / 100) * 95;
                    return (
                      <g key={val}>
                        <line
                          x1={28}
                          y1={y}
                          x2={305}
                          y2={y}
                          stroke={darkMode ? '#383630' : '#E2D7C3'}
                          strokeDasharray="3 3"
                          strokeWidth="1"
                        />
                        <text
                          x={22}
                          y={y + 3}
                          textAnchor="end"
                          className="text-[9px] opacity-60 fill-current"
                        >
                          {val}
                        </text>
                      </g>
                    );
                  })}

                  {trendSeries.length > 1 && (
                    <polyline
                      fill="none"
                      stroke="#4E5C4B"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={trendSeries
                        .map((pt, i) => {
                          const x =
                            36 +
                            (i / (trendSeries.length - 1)) * (296 - 36);
                          const y = 120 - (pt.avg / 100) * 95;
                          return `${x},${y}`;
                        })
                        .join(' ')}
                    />
                  )}

                  {trendSeries.map((pt, i) => {
                    const x =
                      trendSeries.length === 1
                        ? 166
                        : 36 + (i / (trendSeries.length - 1)) * (296 - 36);
                    const y = 120 - (pt.avg / 100) * 95;
                    return (
                      <g key={pt.id}>
                        <circle cx={x} cy={y} r="4" fill="#C57B57" />
                        <text
                          x={x}
                          y={y - 8}
                          textAnchor="middle"
                          className="text-[9px] font-bold fill-current"
                        >
                          {pt.avg}%
                        </text>
                        <text
                          x={x}
                          y={140}
                          textAnchor="middle"
                          className="text-[9px] opacity-70 fill-current"
                        >
                          {pt.label}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            )}
          </div>

          {focusSuggestion && (
            <div
              className={`rounded-xl p-3 border text-xs flex items-center justify-between gap-2 mt-2 ${subtleSurface}`}
            >
              <span>
                Fokusområde att utforska:{' '}
                <strong>{focusSuggestion.area}</strong> ({focusSuggestion.score}
                %)
              </span>
              <button
                type="button"
                onClick={() =>
                  onStartReflection(
                    `Jag vill reflektera kring mitt utvecklingsområde "${focusSuggestion.area}" som just nu ligger på ${focusSuggestion.score}% i min kompass. Hjälp mig att sortera nuläge, mönster och ett rimligt nästa steg.`
                  )
                }
                className="shrink-0 text-[11px] font-semibold text-[#C57B57] hover:underline"
              >
                Reflektera →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* DE 4 KOMPASSERNA */}
      <div className="space-y-2.5">
        <h3 className="text-sm font-bold uppercase tracking-wider opacity-75">
          Dina 4 Kompasser
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {COMPASS_FOUR.map((c) => {
            const keyMap = { Personlig: "personal", Relation: "relation", Arbete: "work", Liv: "life" } as const;
            const score = compassValues ? compassValues[keyMap[c.key as keyof typeof keyMap]] : null;
            return (
              <div
                key={c.key}
                className={`rounded-2xl p-4 border shadow-xs ${cardSurface}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-sm">{c.label}</span>
                  <span className="text-sm font-bold text-[#C57B57]">
                    {score !== null ? `${score}%` : '—'}
                  </span>
                </div>
                <p className="text-xs opacity-75 mb-2.5">{c.question}</p>
                <div className="w-full h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden mb-2">
                  <div
                    className="h-full bg-[#4E5C4B] rounded-full transition-all duration-300"
                    style={{ width: `${score ?? 0}%` }}
                  />
                </div>
                <div className="text-[11px] opacity-65">
                  Områden: {c.areas.join(' · ')}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* DE 8 UTVECKLINGSOMRÅDENA */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wider opacity-75">
            De 8 Utvecklingsområdena
          </h3>
          <span className="text-[11px] opacity-65">
            Klicka på ett område för reflektion med FALK
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {DEVELOPMENT_AREAS.map((area) => {
            const rawVal = activeScores?.[area.name];
            const score = typeof rawVal === 'number' ? rawVal : null;
            const prevRaw = previousScores?.[area.name];
            const delta =
              score !== null && typeof prevRaw === 'number'
                ? score - prevRaw
                : null;
            const parentCompass = COMPASS_FOUR.find(
              (c) => c.key === area.compass
            );

            return (
              <div
                key={area.name}
                className={`rounded-xl p-3.5 border flex flex-col justify-between gap-2.5 ${cardSurface}`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wide opacity-60">
                      {parentCompass?.label.replace(' kompassen', '')}
                    </span>
                    {delta !== null && delta !== 0 && (
                      <span
                        className={`text-[10px] font-bold ${
                          delta > 0 ? 'text-[#4E5C4B]' : 'text-[#C57B57]'
                        }`}
                      >
                        {delta > 0 ? `+${delta}%` : `${delta}%`}
                      </span>
                    )}
                  </div>
                  <div className="font-semibold text-xs leading-snug">
                    {area.name}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-[#C57B57]">
                      {score !== null ? `${score}%` : '—'}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        onStartReflection(
                          `Jag vill utforska området "${area.name}"${
                            score !== null
                              ? ` (nuvarande värde ${score}%)`
                              : ''
                          }. Hjälp mig att se nuläget ur ett fågelperspektiv och hitta ett konkret nästa steg.`
                        )
                      }
                      className="inline-flex items-center gap-1 text-[11px] font-medium opacity-80 hover:opacity-100 text-[#4E5C4B] dark:text-[#A8BFA1]"
                    >
                      <MessageSquare className="w-3 h-3" />
                      <span>Reflektera</span>
                    </button>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-[#C57B57] rounded-full transition-all"
                      style={{ width: `${score ?? 0}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MINA MÅL + SENASTE INSIKTER */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* MINA MÅL (2 KOLUMNER) */}
        <div
          className={`lg:col-span-2 rounded-2xl p-5 border shadow-xs space-y-4 ${cardSurface}`}
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold flex items-center gap-1.5">
                <Target className="w-4 h-4 text-[#C57B57]" />
                <span>Mina mål</span>
              </h3>
              <p className="text-[11px] opacity-70">
                Mål du skapat här eller via måltavle-ikonen i chatten
              </p>
            </div>
          </div>

          {/* LÄGG TILL MÅL */}
          <form
            onSubmit={handleCreateGoal}
            className="flex flex-col sm:flex-row gap-2"
          >
            <input
              type="text"
              value={newGoalTitle}
              onChange={(e) => setNewGoalTitle(e.target.value)}
              placeholder="Skriv ett konkret mål eller nästa steg..."
              className={`flex-1 px-3 py-2 rounded-xl border text-xs outline-none ${subtleSurface}`}
            />
            <select
              value={newGoalArea}
              onChange={(e) => setNewGoalArea(e.target.value)}
              className={`px-3 py-2 rounded-xl border text-xs outline-none ${subtleSurface}`}
            >
              {DEVELOPMENT_AREAS.map((a) => (
                <option key={a.name} value={a.name}>
                  {a.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={!newGoalTitle.trim() || isAddingGoal}
              className="px-3.5 py-2 rounded-xl bg-[#4E5C4B] text-white text-xs font-semibold inline-flex items-center justify-center gap-1 disabled:opacity-50"
            >
              {isAddingGoal ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              <span>Lägg till</span>
            </button>
          </form>

          {/* MÅLLISTA */}
          {loading ? (
            <div className="py-6 flex items-center justify-center text-xs opacity-70 gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Laddar mål...</span>
            </div>
          ) : goals.length === 0 ? (
            <div
              className={`rounded-xl p-5 border text-center text-xs opacity-75 ${subtleSurface}`}
            >
              Inga mål sparade ännu. Skapa ett mål ovan eller klicka på
              måltavle-ikonen under ett svar från FALK.
            </div>
          ) : (
            <div className="space-y-2.5">
              {goals.map((goal) => {
                const progress = Number(goal.progress) || 0;
                const isDone = progress >= 100 || goal.status === 'completed';
                return (
                  <div
                    key={goal.id}
                    className={`rounded-xl p-3.5 border space-y-2 ${subtleSurface}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          {isDone && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#4E5C4B] shrink-0" />
                          )}
                          <span
                            className={`text-xs font-semibold ${
                              isDone ? 'line-through opacity-70' : ''
                            }`}
                          >
                            {goal.title}
                          </span>
                        </div>
                        {goal.area && (
                          <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-[#C57B57]/15 text-[#C57B57] font-medium">
                            {goal.area}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-bold text-[#4E5C4B] dark:text-[#A8BFA1]">
                          {progress}%
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteGoal(goal.id)}
                          disabled={goalActionId === goal.id}
                          title="Ta bort mål"
                          className="p-1 rounded-lg opacity-60 hover:opacity-100 hover:text-red-500 transition-opacity"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={progress}
                        onChange={(e) =>
                          handleUpdateGoalProgress(goal, Number(e.target.value))
                        }
                        className="flex-1 accent-[#4E5C4B] h-1.5 cursor-pointer"
                      />
                      {!isDone && (
                        <button
                          type="button"
                          onClick={() => handleUpdateGoalProgress(goal, 100)}
                          className="text-[10px] px-2 py-1 rounded-lg bg-[#4E5C4B]/15 text-[#4E5C4B] dark:text-[#A8BFA1] font-semibold hover:opacity-90"
                        >
                          Klar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* SENASTE INSIKTER (1 KOLUMN) */}
        <div className={`rounded-2xl p-5 border shadow-xs flex flex-col justify-between space-y-4 ${cardSurface}`}>
          <div className="space-y-3">
            <h3 className="text-sm font-bold flex items-center gap-1.5">
              <Lightbulb className="w-4 h-4 text-[#C57B57]" />
              <span>Senaste insikter</span>
            </h3>

            {insights.length === 0 ? (
              <div
                className={`rounded-xl p-4 border text-xs opacity-75 ${subtleSurface}`}
              >
                Nålade insikter från dina samtal med FALK visas här som stöd i
                din reflektion.
              </div>
            ) : (
              <div className="space-y-2">
                {insights.slice(0, 4).map((ins) => (
                  <div
                    key={ins.id}
                    className={`rounded-xl p-3 border text-xs leading-relaxed ${subtleSurface}`}
                  >
                    <p className="line-clamp-3">{ins.content}</p>
                    {ins.created_at && (
                      <div className="text-[10px] opacity-60 mt-1">
                        {formatShortDate(ins.created_at)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={`rounded-xl p-3 border text-[11px] opacity-80 ${subtleSurface}`}>
            Kom ihåg: Riktning före hastighet. Framsteg, inte perfektion.
          </div>
        </div>
      </div>
    </section>
  );
}
