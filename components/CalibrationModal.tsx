"use client";

import React, { useState, useEffect } from "react";
import { Compass, X, Check, ArrowRight, Sparkles } from "lucide-react";
import {
  COMPASS_FOUR,
  DEVELOPMENT_AREAS,
  UserTier,
  computeCompassFromAreas,
} from "../lib/types";
import { getAuthHeaders } from "../lib/supabase";

interface CalibrationModalProps {
  isOpen: boolean;
  initialView?: "wizard" | "overview";
  onClose: () => void;
  userTier: UserTier;
  backendUrl: string;
  darkMode: boolean;
  savedScores: Record<string, number> | null;
  onSaved: (scores: Record<string, number>) => void;
  onExploreWithFalk: (prompt: string) => void;
}

const QUICK_LEVELS = [
  { value: 20, label: "Behöver omsorg" },
  { value: 40, label: "I rörelse" },
  { value: 60, label: "Stabil grund" },
  { value: 80, label: "Stark riktning" },
  { value: 100, label: "I full balans" },
];

export default function CalibrationModal({
  isOpen,
  initialView = "wizard",
  onClose,
  userTier,
  backendUrl,
  darkMode,
  savedScores,
  onSaved,
  onExploreWithFalk,
}: CalibrationModalProps) {
  const [view, setView] = useState<"wizard" | "overview">(initialView);
  const [areaScores, setAreaScores] = useState<Record<string, number>>(() => {
    const base: Record<string, number> = {};
    DEVELOPMENT_AREAS.forEach((a) => {
      base[a.name] = savedScores?.[a.name] ?? 60;
    });
    return base;
  });
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    setView(initialView);
    setStatusMsg(null);
    if (savedScores) {
      setAreaScores((prev) => {
        const next = { ...prev };
        DEVELOPMENT_AREAS.forEach((a) => {
          if (typeof savedScores[a.name] === "number") {
            next[a.name] = savedScores[a.name];
          }
        });
        return next;
      });
    }
  }, [isOpen, initialView, savedScores]);

  if (!isOpen) return null;

  const computed = computeCompassFromAreas(areaScores);

  const handleSave = async () => {
    setSaving(true);
    setStatusMsg(null);
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem("falk_latest_calibration", JSON.stringify(computed));
      }
      if (userTier !== "guest") {
        const headers = await getAuthHeaders();
        const res = await fetch(`${backendUrl}/api/calibration`, {
          method: "POST",
          headers,
          body: JSON.stringify({ scores: computed }),
        });
        if (!res.ok) {
          throw new Error("Kunde inte spara kalibreringen i databasen.");
        }
      }
      onSaved(computed);
      setView("overview");
      setStatusMsg(
        userTier === "guest"
          ? "Kalibrering sparad för din session. Logga in för att spara historik över tid."
          : "Din kompasskalibrering är sparad i din utvecklingsprofil."
      );
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : "Ett fel uppstod vid sparning.");
    } finally {
      setSaving(false);
    }
  };

  const handleExplore = () => {
    const sortedAreas = [...DEVELOPMENT_AREAS].sort(
      (a, b) => (areaScores[a.name] ?? 60) - (areaScores[b.name] ?? 60)
    );
    const lowest = sortedAreas[0];
    const highest = sortedAreas[sortedAreas.length - 1];
    const prompt = `Jag har precis gjort en kompasskalibrering. Mina 4 kompasser ligger på: Personlig ${computed.Personlig}%, Relation ${computed.Relation}%, Arbete ${computed.Arbete}% och Liv ${computed.Liv}%. Mitt lägsta område just nu är ${lowest.name} (${areaScores[lowest.name]}%) och mitt starkaste är ${highest.name} (${areaScores[highest.name]}%). Hjälp mig reflektera kring min riktning och vad ett rimligt nästa steg kan vara.`;
    onClose();
    onExploreWithFalk(prompt);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div
        className={`w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden ${
          darkMode
            ? "bg-[#22211E] text-[#F5EFE6] border-[#3A3832]"
            : "bg-[#F7F2E8] text-[#1C1C1C] border-[#D4C7AF]"
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-6 py-4 border-b ${
            darkMode ? "border-[#3A3832] bg-[#1C1B18]" : "border-[#DFD4BE] bg-[#EFE6D5]"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#4E5C4B] text-white flex items-center justify-center">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold tracking-tight">
                Kompasskalibrering™
              </h2>
              <p className="text-xs opacity-75">
                4 kompasser · 8 utvecklingsområden · Nuläge utan prestation
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded-lg p-0.5 bg-black/5 dark:bg-white/5 text-xs">
              <button
                type="button"
                onClick={() => setView("wizard")}
                className={`px-3 py-1.5 rounded-md font-medium transition ${
                  view === "wizard"
                    ? "bg-[#4E5C4B] text-white shadow-sm"
                    : "opacity-75 hover:opacity-100"
                }`}
              >
                Kalibrera (8 områden)
              </button>
              <button
                type="button"
                onClick={() => setView("overview")}
                className={`px-3 py-1.5 rounded-md font-medium transition ${
                  view === "overview"
                    ? "bg-[#4E5C4B] text-white shadow-sm"
                    : "opacity-75 hover:opacity-100"
                }`}
              >
                4 Kompasser
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Stäng kompasskalibrering"
              className="p-2 rounded-lg hover:bg-black/5 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {statusMsg && (
            <div className="rounded-xl px-4 py-3 text-xs font-medium bg-[#A8BFA1]/30 border border-[#4E5C4B]/30 text-[#1C1C1C] dark:text-[#F5EFE6]">
              {statusMsg}
            </div>
          )}

          {/* Sammanfattningsrad för de 4 kompasserna */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {COMPASS_FOUR.map((c) => {
              const score = computed[c.key] ?? 60;
              return (
                <div
                  key={c.key}
                  className={`rounded-xl p-3.5 border ${
                    darkMode
                      ? "bg-[#2B2925] border-[#3A3832]"
                      : "bg-white/90 border-[#DFD4BE]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-[#4E5C4B] dark:text-[#A8BFA1]">
                      {c.label}
                    </span>
                    <span className="text-sm font-bold">{score}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-black/10 overflow-hidden mb-1.5">
                    <div
                      className="h-full rounded-full bg-[#4E5C4B] transition-all duration-300"
                      style={{ width: `${score}%` }}
                    />
                  </div>
                  <p className="text-[11px] opacity-70 leading-snug">{c.question}</p>
                </div>
              );
            })}
          </div>

          {view === "wizard" ? (
            <div className="space-y-4">
              <p className="text-xs opacity-80">
                Välj det alternativ som bäst speglar ditt nuläge inom varje område. Det finns inga rätt eller fel — bara riktning.
              </p>
              {DEVELOPMENT_AREAS.map((area, idx) => {
                const current = areaScores[area.name] ?? 60;
                return (
                  <div
                    key={area.name}
                    className={`rounded-xl p-4 border space-y-3 ${
                      darkMode
                        ? "bg-[#2B2925] border-[#3A3832]"
                        : "bg-white border-[#E2D8C5]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-[#E8DCC4] text-[#4E5C4B]">
                            {idx + 1}. {area.compass}
                          </span>
                          <h3 className="text-sm font-semibold">{area.name}</h3>
                        </div>
                        <p className="text-xs opacity-75 mt-1">{area.prompt}</p>
                      </div>
                      <span className="text-sm font-bold text-[#C57B57] shrink-0">
                        {current}%
                      </span>
                    </div>

                    {/* Snabbvalsknappar */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                      {QUICK_LEVELS.map((lvl) => {
                        const selected = current === lvl.value;
                        return (
                          <button
                            key={lvl.value}
                            type="button"
                            onClick={() =>
                              setAreaScores((prev) => ({ ...prev, [area.name]: lvl.value }))
                            }
                            className={`px-2.5 py-2 rounded-lg text-left border text-[11px] transition ${
                              selected
                                ? "bg-[#4E5C4B] text-white border-[#4E5C4B] font-medium"
                                : darkMode
                                ? "bg-[#22211E] border-[#3A3832] hover:border-[#A8BFA1]"
                                : "bg-[#FAF6EE] border-[#E2D8C5] hover:border-[#4E5C4B]"
                            }`}
                          >
                            <div className="font-semibold">{lvl.value}%</div>
                            <div className="opacity-85 truncate">{lvl.label}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {COMPASS_FOUR.map((c) => {
                  const score = computed[c.key] ?? 60;
                  return (
                    <div
                      key={c.key}
                      className={`rounded-xl p-5 border space-y-3 ${
                        darkMode
                          ? "bg-[#2B2925] border-[#3A3832]"
                          : "bg-white border-[#E2D8C5]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-base font-semibold">{c.label}</h3>
                          <p className="text-xs opacity-70">{c.question}</p>
                        </div>
                        <div className="text-2xl font-bold text-[#4E5C4B] dark:text-[#A8BFA1]">
                          {score}%
                        </div>
                      </div>

                      <div className="space-y-2 pt-2 border-t border-black/5 dark:border-white/5">
                        {c.areas.map((areaName) => {
                          const aVal = areaScores[areaName] ?? 60;
                          return (
                            <div key={areaName} className="space-y-1">
                              <div className="flex justify-between text-xs">
                                <span>{areaName}</span>
                                <span className="font-semibold">{aVal}%</span>
                              </div>
                              <div className="w-full h-1.5 rounded-full bg-black/10 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-[#C57B57]"
                                  style={{ width: `${aVal}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className={`flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-t ${
            darkMode ? "border-[#3A3832] bg-[#1C1B18]" : "border-[#DFD4BE] bg-[#EFE6D5]"
          }`}
        >
          <button
            type="button"
            onClick={handleExplore}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium bg-[#C57B57] text-white hover:opacity-95 transition"
          >
            <Sparkles className="w-4 h-4" />
            Utforska resultatet med Falk
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium border border-black/15 dark:border-white/15 hover:bg-black/5 transition"
            >
              Stäng
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-[#4E5C4B] text-white hover:opacity-95 disabled:opacity-50 transition"
            >
              <Check className="w-4 h-4" />
              {saving ? "Sparar..." : "Spara kompasskalibrering"}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
