"use client";

import React, { useState } from "react";

export type B2BNavCategory =
  | "oversikt"
  | "matningar"
  | "samtal"
  | "organisation"
  | "alla";

interface B2BSuiteToolsProps {
  activeTab: B2BNavCategory;
  orgName?: string;
}

interface ActionPlanItem {
  id: string;
  sourceSurvey: "Pulsmätning" | "Trygghetsenkät";
  title: string;
  ownerRole: string;
  dueDate: string;
  status: "Planerad" | "Pågår" | "Uppföljd";
  cohortCount: number;
}

interface OnboardingMilestone {
  day: 30 | 60 | 90;
  label: string;
  focus: string;
  cohortCount: number;
  readinessScore: number;
}

interface ChangeInitiative {
  id: string;
  name: string;
  stage: string;
  cohortCount: number;
  clarityNote: string;
}

interface OneOnOneSession {
  id: string;
  track: "1-on-1 Check-in" | "Utvecklingssamtal";
  topic: string;
  actionPoint: string;
  nextCheckIn: string;
  status: "Öppen" | "Klart nästa steg";
}

interface OsaSamEntry {
  id: string;
  category: "Arbetsbelastning" | "Arbetstid & Återhämtning" | "Kränkande särbehandling";
  riskSummary: string;
  measure: string;
  owner: string;
  followUpDate: string;
  status: "Aktiv åtgärd" | "Uppföljd";
}

interface WhistleCase {
  id: string;
  code: string;
  area: "Ekonomi & Regelefterlevnad" | "Arbetsmiljö & Etik" | "Dataskydd & Säkerhet";
  summary: string;
  status: "Ny" | "Under granskning" | "Avslutad";
}

interface RetentionPolicyRow {
  dataDomain: string;
  retentionRule: string;
  privacyGuarantee: string;
  active: boolean;
}

const INITIAL_ACTION_PLANS: ActionPlanItem[] = [
  {
    id: "ap-1",
    sourceSurvey: "Pulsmätning",
    title: "Mötesfri förmiddag onsdagar för fokuserat arbete",
    ownerRole: "Teamchef & Produktledning",
    dueDate: "2026-12-15",
    status: "Pågår",
    cohortCount: 8,
  },
  {
    id: "ap-2",
    sourceSurvey: "Trygghetsenkät",
    title: "Tydligare eskaleringsväg vid hög releasebelastning",
    ownerRole: "HR & Avdelningschef",
    dueDate: "2027-01-10",
    status: "Planerad",
    cohortCount: 12,
  },
];

const INITIAL_ONBOARDING: OnboardingMilestone[] = [
  {
    day: 30,
    label: "30-dagars puls",
    focus: "Verktyg, introduktion & första förväntningar",
    cohortCount: 6,
    readinessScore: 82,
  },
  {
    day: 60,
    label: "60-dagars puls",
    focus: "Rolltydlighet, samarbete & feedbackloop",
    cohortCount: 4,
    readinessScore: 76,
  },
  {
    day: 90,
    label: "90-dagars puls",
    focus: "Självständighet, arbetsbelastning & långsiktig riktning",
    cohortCount: 7,
    readinessScore: 85,
  },
];

const INITIAL_CHANGES: ChangeInitiative[] = [
  {
    id: "chg-1",
    name: "Ny kvartalsvis planeringsrytm & ansvarfördelning",
    stage: "Fas 2 – Införande",
    cohortCount: 9,
    clarityNote: "Fokus på tydliga prioriteringar mellan avdelningar.",
  },
  {
    id: "chg-2",
    name: "Uppdaterad modell för hybridarbete",
    stage: "Fas 1 – Förankring",
    cohortCount: 3,
    clarityNote: "Inväntar minst 5 deltagare i aktuell grupp för aggregerad visning.",
  },
];

const INITIAL_ONE_ON_ONES: OneOnOneSession[] = [
  {
    id: "o3-1",
    track: "Utvecklingssamtal",
    topic: "Kompetensväg mot senior roll & arkitekturansvar",
    actionPoint: "Ta fram konkret lärplan med två mentoravstämningar under kvartalet",
    nextCheckIn: "2026-12-18",
    status: "Öppen",
  },
  {
    id: "o3-2",
    track: "1-on-1 Check-in",
    topic: "Arbetsbelastning, prioriteringar & återhämtning",
    actionPoint: "Omfördela lågprioriterad uppgift inför kommande sprint",
    nextCheckIn: "2026-12-08",
    status: "Klart nästa steg",
  },
];

const INITIAL_OSA_SAM: OsaSamEntry[] = [
  {
    id: "osa-1",
    category: "Arbetsbelastning",
    riskSummary: "Obalans mellan parallella leveranser och återhämtning vid kvartalsslut",
    measure: "Prioriteringsgenomgång varannan vecka med tak på aktiva parallella spår",
    owner: "Drift- & Leveransansvarig",
    followUpDate: "2026-12-19",
    status: "Aktiv åtgärd",
  },
];

const INITIAL_WHISTLE_CASES: WhistleCase[] = [
  {
    id: "wb-1",
    code: "WB-2026-014",
    area: "Ekonomi & Regelefterlevnad",
    summary: "Anonymiserad rapport om otydlig leverantörskontroll vid extrabeställning",
    status: "Under granskning",
  },
];

const INITIAL_RETENTION: RetentionPolicyRow[] = [
  {
    dataDomain: "Team- & pulsaggregat (k ≥ 5)",
    retentionRule: "24 månader rullande trend",
    privacyGuarantee: "Visas endast vid minst 5 unika deltagare",
    active: true,
  },
  {
    dataDomain: "Individuella samtal & reflektioner",
    retentionRule: "Enligt användarens val / RLS-isolerad",
    privacyGuarantee: "Aldrig exponerade för arbetsgivare eller HR",
    active: true,
  },
  {
    dataDomain: "Visselblåsar- & OSA-loggar",
    retentionRule: "Minimerad lagring & åtkomstkontroll",
    privacyGuarantee: "Separerad granskningsbehörighet & GDPR-spårbarhet",
    active: true,
  },
];

export default function B2BSuiteTools({
  activeTab,
  orgName = "Organisationen",
}: B2BSuiteToolsProps) {
  const showMeasurements = activeTab === "matningar" || activeTab === "alla";
  const showOverview = activeTab === "oversikt" || activeTab === "alla";
  const showConversations = activeTab === "samtal" || activeTab === "alla";
  const showOrgIntegrity = activeTab === "organisation" || activeTab === "alla";

  // 1. Handlingsplaner efter puls- & trygghetsmätning
  const [plans, setPlans] = useState<ActionPlanItem[]>(INITIAL_ACTION_PLANS);
  const [newTitle, setNewTitle] = useState("");
  const [newOwner, setNewOwner] = useState("Teamchef");
  const [newDueDate, setNewDueDate] = useState("2026-12-20");
  const [newSource, setNewSource] = useState<"Pulsmätning" | "Trygghetsenkät">("Pulsmätning");
  const [newCohortCount, setNewCohortCount] = useState(6);

  // 2. 30/60/90-dagars onboardingpuls
  const [onboarding, setOnboarding] = useState<OnboardingMilestone[]>(INITIAL_ONBOARDING);
  const [selectedDay, setSelectedDay] = useState<30 | 60 | 90>(30);
  const [onboardingCohortInput, setOnboardingCohortInput] = useState(6);

  // 3. Förändrings- & omorganisationspuls
  const [changes, setChanges] = useState<ChangeInitiative[]>(INITIAL_CHANGES);
  const [changeName, setChangeName] = useState("");
  const [changeStage, setChangeStage] = useState("Fas 1 – Förankring");
  const [changeCohort, setChangeCohort] = useState(6);

  // 5. 1-on-1 & utvecklingssamtal med handlingspunkter
  const [sessions, setSessions] = useState<OneOnOneSession[]>(INITIAL_ONE_ON_ONES);
  const [sessionTrack, setSessionTrack] = useState<"1-on-1 Check-in" | "Utvecklingssamtal">("1-on-1 Check-in");
  const [sessionTopic, setSessionTopic] = useState("");
  const [sessionAction, setSessionAction] = useState("");
  const [sessionDate, setSessionDate] = useState("2026-12-14");

  // 1. OSA- & Arbetsmiljöloggbok (AFS / SAM)
  const [osaEntries, setOsaEntries] = useState<OsaSamEntry[]>(INITIAL_OSA_SAM);
  const [osaCategory, setOsaCategory] = useState<OsaSamEntry["category"]>("Arbetsbelastning");
  const [osaRisk, setOsaRisk] = useState("");
  const [osaMeasure, setOsaMeasure] = useState("");
  const [osaOwner, setOsaOwner] = useState("Skyddsombud / Chef");
  const [osaDate, setOsaDate] = useState("2026-12-22");

  // 2. Visselblåsarkanal / Etisk anmälningsflöde
  const [whistleCases, setWhistleCases] = useState<WhistleCase[]>(INITIAL_WHISTLE_CASES);
  const [whistleArea, setWhistleArea] = useState<WhistleCase["area"]>("Arbetsmiljö & Etik");
  const [whistleSummary, setWhistleSummary] = useState("");

  // 3. GDPR- & Integritetskontroll (DPIA / Radering & Retention)
  const [retentionRows, setRetentionRows] = useState<RetentionPolicyRow[]>(INITIAL_RETENTION);

  const handleAddPlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const item: ActionPlanItem = {
      id: `ap-${Date.now()}`,
      sourceSurvey: newSource,
      title: newTitle.trim(),
      ownerRole: newOwner.trim() || "Ansvarig chef",
      dueDate: newDueDate || "2026-12-31",
      status: "Planerad",
      cohortCount: Math.max(1, Number(newCohortCount) || 1),
    };
    setPlans((prev) => [item, ...prev]);
    setNewTitle("");
  };

  const handleCycleStatus = (id: string) => {
    const order: ActionPlanItem["status"][] = ["Planerad", "Pågår", "Uppföljd"];
    setPlans((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const nextIdx = (order.indexOf(item.status) + 1) % order.length;
        return { ...item, status: order[nextIdx] };
      })
    );
  };

  const handleUpdateOnboardingCohort = (e: React.FormEvent) => {
    e.preventDefault();
    const safeCount = Math.max(0, Number(onboardingCohortInput) || 0);
    setOnboarding((prev) =>
      prev.map((m) => (m.day === selectedDay ? { ...m, cohortCount: safeCount } : m))
    );
  };

  const handleAddChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!changeName.trim()) return;
    const item: ChangeInitiative = {
      id: `chg-${Date.now()}`,
      name: changeName.trim(),
      stage: changeStage,
      cohortCount: Math.max(1, Number(changeCohort) || 1),
      clarityNote: "Uppföljning av förväntningar och arbetsbelastning i förändring.",
    };
    setChanges((prev) => [item, ...prev]);
    setChangeName("");
  };

  const handleAddSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionTopic.trim() || !sessionAction.trim()) return;
    const nextItem: OneOnOneSession = {
      id: `o3-${Date.now()}`,
      track: sessionTrack,
      topic: sessionTopic.trim(),
      actionPoint: sessionAction.trim(),
      nextCheckIn: sessionDate || "2026-12-20",
      status: "Öppen",
    };
    setSessions((prev) => [nextItem, ...prev]);
    setSessionTopic("");
    setSessionAction("");
  };

  const handleToggleSessionStatus = (id: string) => {
    setSessions((prev) =>
      prev.map((s) =>
        s.id === id
          ? { ...s, status: s.status === "Öppen" ? "Klart nästa steg" : "Öppen" }
          : s
      )
    );
  };

  const handleAddOsa = (e: React.FormEvent) => {
    e.preventDefault();
    if (!osaRisk.trim() || !osaMeasure.trim()) return;
    const item: OsaSamEntry = {
      id: `osa-${Date.now()}`,
      category: osaCategory,
      riskSummary: osaRisk.trim(),
      measure: osaMeasure.trim(),
      owner: osaOwner.trim() || "Ansvarig chef",
      followUpDate: osaDate || "2026-12-22",
      status: "Aktiv åtgärd",
    };
    setOsaEntries((prev) => [item, ...prev]);
    setOsaRisk("");
    setOsaMeasure("");
  };

  const handleToggleOsaStatus = (id: string) => {
    setOsaEntries((prev) =>
      prev.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              status: entry.status === "Aktiv åtgärd" ? "Uppföljd" : "Aktiv åtgärd",
            }
          : entry
      )
    );
  };

  const handleAddWhistleCase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!whistleSummary.trim()) return;
    const suffix = String(Math.floor(100 + Math.random() * 900));
    const nextCase: WhistleCase = {
      id: `wb-${Date.now()}`,
      code: `WB-2026-${suffix}`,
      area: whistleArea,
      summary: whistleSummary.trim(),
      status: "Ny",
    };
    setWhistleCases((prev) => [nextCase, ...prev]);
    setWhistleSummary("");
  };

  const handleCycleWhistleStatus = (id: string) => {
    const order: WhistleCase["status"][] = ["Ny", "Under granskning", "Avslutad"];
    setWhistleCases((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const nextIdx = (order.indexOf(c.status) + 1) % order.length;
        return { ...c, status: order[nextIdx] };
      })
    );
  };

  const handleToggleRetentionActive = (idx: number) => {
    setRetentionRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, active: !r.active } : r))
    );
  };

  if (!showMeasurements && !showOverview && !showConversations && !showOrgIntegrity) {
    return null;
  }

  return (
    <div className="space-y-8 mt-8">
      {/* 4. Handlingsplaner efter puls- & trygghetsmätning */}
      {(showMeasurements || showOverview) && (
        <section className="bg-[#F7F2E8] border border-[#4E5C4B]/20 rounded-2xl p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#4E5C4B]">
                Mätningar &amp; Uppföljning
              </p>
              <h2 className="text-base font-semibold text-[#1C211B]">
                Handlingsplaner efter puls- &amp; trygghetsmätning
              </h2>
              <p className="text-xs text-[#4E5C4B] mt-0.5">
                Koppla mätresultat till konkreta teamåtgärder för {orgName} med uppföljningsdatum.
              </p>
            </div>
            <span className="text-[11px] px-2.5 py-1 rounded-full bg-[#E8DCC4] text-[#1C211B] font-medium self-start">
              k-anonymitet ≥ 5 för teamutfall
            </span>
          </div>

          <form onSubmit={handleAddPlan} className="grid grid-cols-1 md:grid-cols-5 gap-2.5">
            <select
              value={newSource}
              onChange={(e) =>
                setNewSource(e.target.value as "Pulsmätning" | "Trygghetsenkät")
              }
              aria-label="Källa för handlingsplan"
              className="px-3 py-2 rounded-xl bg-white border border-[#4E5C4B]/25 text-xs text-[#1C211B]"
            >
              <option value="Pulsmätning">Pulsmätning</option>
              <option value="Trygghetsenkät">Trygghetsenkät</option>
            </select>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Ny teamåtgärd (t.ex. avlastning inför leverans)..."
              className="md:col-span-2 px-3 py-2 rounded-xl bg-white border border-[#4E5C4B]/25 text-xs text-[#1C211B]"
            />
            <input
              type="text"
              value={newOwner}
              onChange={(e) => setNewOwner(e.target.value)}
              placeholder="Ansvarig roll"
              className="px-3 py-2 rounded-xl bg-white border border-[#4E5C4B]/25 text-xs text-[#1C211B]"
            />
            <div className="flex gap-2">
              <input
                type="date"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                aria-label="Uppföljningsdatum"
                className="flex-1 px-2.5 py-2 rounded-xl bg-white border border-[#4E5C4B]/25 text-xs text-[#1C211B]"
              />
              <button
                type="submit"
                className="px-3.5 py-2 rounded-xl bg-[#4E5C4B] text-white text-xs font-medium hover:bg-[#3F4B3C] transition shrink-0"
              >
                Lägg till
              </button>
            </div>
          </form>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {plans.map((plan) => {
              const meetsK = plan.cohortCount >= 5;
              return (
                <div
                  key={plan.id}
                  className="rounded-xl border border-[#4E5C4B]/15 bg-white/85 p-4 space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-[#4E5C4B]">
                      {plan.sourceSurvey} · {plan.dueDate}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCycleStatus(plan.id)}
                      className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#E8DCC4] text-[#1C211B] font-medium hover:bg-[#DFD0B4] transition"
                    >
                      {plan.status}
                    </button>
                  </div>
                  <p className="text-sm font-medium text-[#1C211B]">{plan.title}</p>
                  <div className="flex items-center justify-between text-xs text-[#4E5C4B] pt-1 border-t border-[#4E5C4B]/10">
                    <span>Ansvar: {plan.ownerRole}</span>
                    {meetsK ? (
                      <span className="font-medium text-[#1C211B]">
                        Kohort: {plan.cohortCount} deltagare (k ≥ 5)
                      </span>
                    ) : (
                      <span className="text-[#8F3519]">
                        Väntar på minst 5 deltagare ({plan.cohortCount}/5)
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 6 & 7. 30/60/90-dagars onboardingpuls + Förändrings- & omorganisationspuls */}
      {showMeasurements && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 6. Introduktions- & 30/60/90-dagars pulspaket */}
          <section className="bg-[#F7F2E8] border border-[#4E5C4B]/20 rounded-2xl p-6 space-y-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#4E5C4B]">
                Introduktion &amp; Onboarding
              </p>
              <h3 className="text-base font-semibold text-[#1C211B]">
                30 / 60 / 90-dagars pulspaket
              </h3>
              <p className="text-xs text-[#4E5C4B] mt-0.5">
                Följer introduktionskvalitet och rolltydlighet i kohorter med strikt k ≥ 5-gräns.
              </p>
            </div>

            <div className="space-y-2.5">
              {onboarding.map((m) => {
                const unlocked = m.cohortCount >= 5;
                return (
                  <div
                    key={m.day}
                    className="rounded-xl border border-[#4E5C4B]/15 bg-white/85 p-3.5 flex items-center justify-between gap-3"
                  >
                    <div className="space-y-0.5">
                      <div className="text-xs font-semibold text-[#1C211B]">{m.label}</div>
                      <div className="text-xs text-[#4E5C4B]">{m.focus}</div>
                    </div>
                    <div className="text-right shrink-0">
                      {unlocked ? (
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#A8BFA1]/45 text-[#1C211B]">
                          Index {m.readinessScore}/100 ({m.cohortCount} pers)
                        </span>
                      ) : (
                        <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-[#C57B57]/20 text-[#6E2712]">
                          Spärrad ({m.cohortCount}/5 pers)
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <form
              onSubmit={handleUpdateOnboardingCohort}
              className="pt-2 border-t border-[#4E5C4B]/15 flex flex-wrap items-center gap-2"
            >
              <select
                value={selectedDay}
                onChange={(e) => setSelectedDay(Number(e.target.value) as 30 | 60 | 90)}
                aria-label="Välj onboardingmilstolpe"
                className="px-3 py-1.5 rounded-lg bg-white border border-[#4E5C4B]/25 text-xs text-[#1C211B]"
              >
                <option value={30}>30 dagar</option>
                <option value={60}>60 dagar</option>
                <option value={90}>90 dagar</option>
              </select>
              <input
                type="number"
                min={0}
                value={onboardingCohortInput}
                onChange={(e) => setOnboardingCohortInput(Number(e.target.value))}
                aria-label="Antal deltagare i kohort"
                className="w-24 px-2.5 py-1.5 rounded-lg bg-white border border-[#4E5C4B]/25 text-xs text-[#1C211B]"
              />
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg bg-[#4E5C4B] text-white text-xs font-medium hover:bg-[#3F4B3C] transition"
              >
                Uppdatera kohort
              </button>
            </form>
          </section>

          {/* 7. Förändrings- & omorganisationspuls */}
          <section className="bg-[#F7F2E8] border border-[#4E5C4B]/20 rounded-2xl p-6 space-y-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#4E5C4B]">
                Förändringsledning
              </p>
              <h3 className="text-base font-semibold text-[#1C211B]">
                Förändrings- &amp; omorganisationspuls
              </h3>
              <p className="text-xs text-[#4E5C4B] mt-0.5">
                Fångar otydlighet och belastning under nya arbetssätt eller förändringar.
              </p>
            </div>

            <form onSubmit={handleAddChange} className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={changeName}
                onChange={(e) => setChangeName(e.target.value)}
                placeholder="Ny förändringsinsats..."
                className="flex-1 px-3 py-1.5 rounded-lg bg-white border border-[#4E5C4B]/25 text-xs text-[#1C211B]"
              />
              <select
                value={changeStage}
                onChange={(e) => setChangeStage(e.target.value)}
                aria-label="Förändringsfas"
                className="px-2.5 py-1.5 rounded-lg bg-white border border-[#4E5C4B]/25 text-xs text-[#1C211B]"
              >
                <option value="Fas 1 – Förankring">Fas 1 – Förankring</option>
                <option value="Fas 2 – Införande">Fas 2 – Införande</option>
                <option value="Fas 3 – Uppföljning">Fas 3 – Uppföljning</option>
              </select>
              <input
                type="number"
                min={1}
                value={changeCohort}
                onChange={(e) => setChangeCohort(Number(e.target.value))}
                aria-label="Antal svarande"
                className="w-20 px-2.5 py-1.5 rounded-lg bg-white border border-[#4E5C4B]/25 text-xs text-[#1C211B]"
              />
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg bg-[#4E5C4B] text-white text-xs font-medium hover:bg-[#3F4B3C] transition shrink-0"
              >
                Starta
              </button>
            </form>

            <div className="space-y-2.5">
              {changes.map((chg) => {
                const canShowMetrics = chg.cohortCount >= 5;
                return (
                  <div
                    key={chg.id}
                    className="rounded-xl border border-[#4E5C4B]/15 bg-white/85 p-3.5 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-[#1C211B]">{chg.name}</span>
                      <span className="text-[11px] text-[#4E5C4B] shrink-0">{chg.stage}</span>
                    </div>
                    <p className="text-xs text-[#4E5C4B]">{chg.clarityNote}</p>
                    <div className="text-[11px]">
                      {canShowMetrics ? (
                        <span className="text-[#1C211B] font-medium">
                          Aggregerad förändringspuls aktiv ({chg.cohortCount} deltagare, k ≥ 5)
                        </span>
                      ) : (
                        <span className="text-[#8F3519]">
                          Anonymitetsspärr aktiv ({chg.cohortCount}/5 deltagare) – visas vid ≥ 5
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {/* 5. 1-on-1 & utvecklingssamtal med handlingspunkter */}
      {showConversations && (
        <section className="bg-[#F7F2E8] border border-[#4E5C4B]/20 rounded-2xl p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#4E5C4B]">
                Samtal &amp; Ledarskap
              </p>
              <h2 className="text-base font-semibold text-[#1C211B]">
                1-on-1 &amp; Utvecklingssamtal med handlingspunkter
              </h2>
              <p className="text-xs text-[#4E5C4B] mt-0.5">
                Löpande samtalsspår för förväntningar, kompetensutveckling och konkreta nästa steg.
              </p>
            </div>
            <span className="text-[11px] px-2.5 py-1 rounded-full bg-[#E8DCC4] text-[#1C211B] font-medium self-start">
              Enskilda anteckningar isolerade · Teamdata k ≥ 5
            </span>
          </div>

          <form onSubmit={handleAddSession} className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
            <select
              value={sessionTrack}
              onChange={(e) =>
                setSessionTrack(e.target.value as "1-on-1 Check-in" | "Utvecklingssamtal")
              }
              aria-label="Samtalstyp"
              className="px-3 py-2 rounded-xl bg-white border border-[#4E5C4B]/25 text-xs text-[#1C211B]"
            >
              <option value="1-on-1 Check-in">1-on-1 Check-in</option>
              <option value="Utvecklingssamtal">Utvecklingssamtal</option>
            </select>
            <input
              type="text"
              value={sessionTopic}
              onChange={(e) => setSessionTopic(e.target.value)}
              placeholder="Samtalsämne / utvecklingsspår..."
              className="px-3 py-2 rounded-xl bg-white border border-[#4E5C4B]/25 text-xs text-[#1C211B]"
            />
            <input
              type="text"
              value={sessionAction}
              onChange={(e) => setSessionAction(e.target.value)}
              placeholder="Konkret handlingspunkt..."
              className="px-3 py-2 rounded-xl bg-white border border-[#4E5C4B]/25 text-xs text-[#1C211B]"
            />
            <div className="flex gap-2">
              <input
                type="date"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                aria-label="Nästa avstämning"
                className="flex-1 px-2.5 py-2 rounded-xl bg-white border border-[#4E5C4B]/25 text-xs text-[#1C211B]"
              />
              <button
                type="submit"
                className="px-3.5 py-2 rounded-xl bg-[#4E5C4B] text-white text-xs font-medium hover:bg-[#3F4B3C] transition shrink-0"
              >
                Spara
              </button>
            </div>
          </form>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sessions.map((s) => (
              <div
                key={s.id}
                className="rounded-xl border border-[#4E5C4B]/15 bg-white/85 p-4 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[#4E5C4B]">
                    {s.track} · Nästa: {s.nextCheckIn}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleToggleSessionStatus(s.id)}
                    className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#E8DCC4] text-[#1C211B] font-medium hover:bg-[#DFD0B4] transition"
                  >
                    {s.status}
                  </button>
                </div>
                <p className="text-sm font-medium text-[#1C211B]">{s.topic}</p>
                <p className="text-xs text-[#4E5C4B]">Handlingspunkt: {s.actionPoint}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 1, 2 & 3. OSA/SAM-loggbok, Visselblåsarkanal & GDPR/Retention-kontroll */}
      {showOrgIntegrity && (
        <div className="space-y-6">
          {/* 1. OSA- & Arbetsmiljöloggbok (AFS / SAM) */}
          <section className="bg-[#F7F2E8] border border-[#4E5C4B]/20 rounded-2xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#4E5C4B]">
                  Systematiskt Arbetsmiljöarbete (SAM / OSA)
                </p>
                <h2 className="text-base font-semibold text-[#1C211B]">
                  OSA- &amp; Arbetsmiljöloggbok
                </h2>
                <p className="text-xs text-[#4E5C4B] mt-0.5">
                  Dokumentera riskbedömning, förebyggande åtgärd, ansvarig roll och uppföljningsdatum.
                </p>
              </div>
              <span className="text-[11px] px-2.5 py-1 rounded-full bg-[#E8DCC4] text-[#1C211B] font-medium self-start">
                AFS / SAM-uppföljning
              </span>
            </div>

            <form onSubmit={handleAddOsa} className="grid grid-cols-1 md:grid-cols-5 gap-2.5">
              <select
                value={osaCategory}
                onChange={(e) => setOsaCategory(e.target.value as OsaSamEntry["category"])}
                aria-label="OSA-kategori"
                className="px-3 py-2 rounded-xl bg-white border border-[#4E5C4B]/25 text-xs text-[#1C211B]"
              >
                <option value="Arbetsbelastning">Arbetsbelastning</option>
                <option value="Arbetstid & Återhämtning">Arbetstid &amp; Återhämtning</option>
                <option value="Kränkande särbehandling">Kränkande särbehandling</option>
              </select>
              <input
                type="text"
                value={osaRisk}
                onChange={(e) => setOsaRisk(e.target.value)}
                placeholder="Identifierad risk / observation..."
                className="px-3 py-2 rounded-xl bg-white border border-[#4E5C4B]/25 text-xs text-[#1C211B]"
              />
              <input
                type="text"
                value={osaMeasure}
                onChange={(e) => setOsaMeasure(e.target.value)}
                placeholder="Förebyggande åtgärd..."
                className="px-3 py-2 rounded-xl bg-white border border-[#4E5C4B]/25 text-xs text-[#1C211B]"
              />
              <input
                type="text"
                value={osaOwner}
                onChange={(e) => setOsaOwner(e.target.value)}
                placeholder="Ansvarig"
                className="px-3 py-2 rounded-xl bg-white border border-[#4E5C4B]/25 text-xs text-[#1C211B]"
              />
              <div className="flex gap-2">
                <input
                  type="date"
                  value={osaDate}
                  onChange={(e) => setOsaDate(e.target.value)}
                  aria-label="Uppföljningsdatum OSA"
                  className="flex-1 px-2.5 py-2 rounded-xl bg-white border border-[#4E5C4B]/25 text-xs text-[#1C211B]"
                />
                <button
                  type="submit"
                  className="px-3.5 py-2 rounded-xl bg-[#4E5C4B] text-white text-xs font-medium hover:bg-[#3F4B3C] transition shrink-0"
                >
                  Logga
                </button>
              </div>
            </form>

            <div className="space-y-2.5">
              {osaEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-xl border border-[#4E5C4B]/15 bg-white/85 p-4 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-[#4E5C4B]">
                      {entry.category} · Uppföljning: {entry.followUpDate} · Ansvar: {entry.owner}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleToggleOsaStatus(entry.id)}
                      className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#E8DCC4] text-[#1C211B] font-medium hover:bg-[#DFD0B4] transition"
                    >
                      {entry.status}
                    </button>
                  </div>
                  <p className="text-xs font-semibold text-[#1C211B]">Risk: {entry.riskSummary}</p>
                  <p className="text-xs text-[#4E5C4B]">Åtgärd: {entry.measure}</p>
                </div>
              ))}
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 2. Visselblåsarkanal / Etisk anmälningsflöde */}
            <section className="bg-[#F7F2E8] border border-[#4E5C4B]/20 rounded-2xl p-6 space-y-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#4E5C4B]">
                  Etik &amp; Regelefterlevnad
                </p>
                <h3 className="text-base font-semibold text-[#1C211B]">
                  Visselblåsarkanal
                </h3>
                <p className="text-xs text-[#4E5C4B] mt-0.5">
                  Strukturerad rapportering av missförhållanden med ärendekod och statusspårning.
                </p>
              </div>

              <form onSubmit={handleAddWhistleCase} className="space-y-2">
                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    value={whistleArea}
                    onChange={(e) => setWhistleArea(e.target.value as WhistleCase["area"])}
                    aria-label="Anmälningsområde"
                    className="px-3 py-1.5 rounded-lg bg-white border border-[#4E5C4B]/25 text-xs text-[#1C211B]"
                  >
                    <option value="Arbetsmiljö & Etik">Arbetsmiljö &amp; Etik</option>
                    <option value="Ekonomi & Regelefterlevnad">Ekonomi &amp; Regelefterlevnad</option>
                    <option value="Dataskydd & Säkerhet">Dataskydd &amp; Säkerhet</option>
                  </select>
                  <input
                    type="text"
                    value={whistleSummary}
                    onChange={(e) => setWhistleSummary(e.target.value)}
                    placeholder="Kort beskrivning av ärende utan personkänslig rådata..."
                    className="flex-1 px-3 py-1.5 rounded-lg bg-white border border-[#4E5C4B]/25 text-xs text-[#1C211B]"
                  />
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 rounded-lg bg-[#4E5C4B] text-white text-xs font-medium hover:bg-[#3F4B3C] transition shrink-0"
                  >
                    Registrera
                  </button>
                </div>
              </form>

              <div className="space-y-2">
                {whistleCases.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-xl border border-[#4E5C4B]/15 bg-white/85 p-3.5 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-[#1C211B]">
                        {c.code} · {c.area}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCycleWhistleStatus(c.id)}
                        className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#E8DCC4] text-[#1C211B] font-medium hover:bg-[#DFD0B4] transition"
                      >
                        {c.status}
                      </button>
                    </div>
                    <p className="text-xs text-[#4E5C4B]">{c.summary}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* 3. GDPR- & Integritetskontroll (DPIA / Radering & Retention) */}
            <section className="bg-[#F7F2E8] border border-[#4E5C4B]/20 rounded-2xl p-6 space-y-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#4E5C4B]">
                  Dataskydd &amp; Integritet
                </p>
                <h3 className="text-base font-semibold text-[#1C211B]">
                  GDPR- &amp; Retentionsöversikt
                </h3>
                <p className="text-xs text-[#4E5C4B] mt-0.5">
                  Lagringsprinciper, RLS-isolering och k ≥ 5-anonymitetströskel för {orgName}.
                </p>
              </div>

              <div className="space-y-2">
                {retentionRows.map((row, idx) => (
                  <div
                    key={row.dataDomain}
                    className="rounded-xl border border-[#4E5C4B]/15 bg-white/85 p-3.5 flex items-start justify-between gap-3"
                  >
                    <div className="space-y-0.5">
                      <div className="text-xs font-semibold text-[#1C211B]">{row.dataDomain}</div>
                      <div className="text-[11px] text-[#4E5C4B]">
                        Retention: {row.retentionRule} · {row.privacyGuarantee}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleRetentionActive(idx)}
                      className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium shrink-0 transition ${
                        row.active
                          ? "bg-[#A8BFA1]/45 text-[#1C211B]"
                          : "bg-[#C57B57]/20 text-[#6E2712]"
                      }`}
                    >
                      {row.active ? "Aktiv policy" : "Pausad"}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
