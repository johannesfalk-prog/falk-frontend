"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase, getAuthHeaders } from "@/lib/supabase";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  (typeof window !== "undefined" &&
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    ? "http://127.0.0.1:5001"
    : "https://falk-backend.onrender.com");

interface OrgSummary {
  id: string;
  name: string;
  org_type?: string;
  seat_limit?: number;
  active_seats?: number;
  available_seats?: number | null;
}

interface OrgMember {
  id: string;
  user_id: string;
  email: string | null;
  role: "org_admin" | "hr_viewer" | "member" | string;
  department: string | null;
  status: "active" | "revoked" | string;
  joined_at: string | null;
  revoked_at: string | null;
}

interface OrgInvite {
  id: string;
  invite_code: string;
  email: string | null;
  role: string;
  department: string | null;
  max_uses: number;
  used_count: number;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
}

const LABELS_SV: Record<string, string> = {
  personlig: "Personliga kompassen",
  personal: "Personliga kompassen",
  relation: "Relationskompassen",
  relations: "Relationskompassen",
  arbete: "Arbetskompassen",
  work: "Arbetskompassen",
  liv: "Livskompassen",
  life: "Livskompassen",
  halsa: "Hälsa & träning",
  health: "Hälsa & träning",
  karriar: "Jobb & karriär",
  career: "Jobb & karriär",
  familj: "Familj",
  family: "Familj",
  agodelar: "Ägodelar & miljö",
  personlig_utveckling: "Personlig utveckling",
  intim_relation: "Intim relation",
  spiritualitet: "Spiritualitet & mening",
  finans: "Finans & trygghet",
  finance: "Finans & trygghet",
  overall: "Övergripande kompassindex",
  b2b_self_leadership: "Självledarskap & Rollklarhet",
  b2b_team_trust: "Samarbete & Psykologisk Trygghet",
  b2b_sustainable_energy: "Hållbar Energi & Belastningsbalans",
  b2b_direction_culture: "Strategisk Riktning & Gemensam Kompass",
};

function formatLabel(key: string): string {
  const normalized = key.toLowerCase().trim();
  if (LABELS_SV[normalized]) return LABELS_SV[normalized];
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatRole(role: string): string {
  if (role === "org_admin") return "Organisationsadmin";
  if (role === "hr_viewer") return "HR-analytiker";
  return "Medarbetare / Deltagare";
}

function formatOrgType(orgType?: string): string {
  if (orgType === "insurance") return "Försäkring & Hälsa";
  if (orgType === "enterprise") return "Företag & Organisation";
  return orgType || "Organisation";
}

export default function B2BPortalPage() {
  const [authChecking, setAuthChecking] = useState(true);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [callerRole, setCallerRole] = useState<string | null>(null);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  const [orgInfo, setOrgInfo] = useState<OrgSummary | null>(null);
  const [analytics, setAnalytics] = useState<Record<string, any> | null>(null);
  const [departmentFilter, setDepartmentFilter] = useState<string>("");
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [invites, setInvites] = useState<OrgInvite[]>([]);

  const [loadingData, setLoadingData] = useState(false);
  const [accessDeniedMsg, setAccessDeniedMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [redeemCode, setRedeemCode] = useState("");
  const [redeemLoading, setRedeemLoading] = useState(false);

  const [inviteRole, setInviteRole] = useState<"member" | "hr_viewer" | "org_admin">("member");
  const [inviteDepartment, setInviteDepartment] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteMaxUses, setInviteMaxUses] = useState(10);
  const [inviteExpiresDays, setInviteExpiresDays] = useState(30);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<string>("member");
  const [editDepartment, setEditDepartment] = useState<string>("");
  const [savingMember, setSavingMember] = useState(false);
  const [revokingMemberId, setRevokingMemberId] = useState<string | null>(null);
  const [pulseTitle, setPulseTitle] = useState("Veckans Team- & Riktningpuls");
  const [pulseQuestions, setPulseQuestions] = useState<string[]>([
    "Hur tydlig är prioriteringen och riktningen i ditt arbete just nu?",
    "Hur upplever du balansen mellan tempo, fokus och återhämtning?",
    "Vad behöver vi förtydliga eller justera tillsammans kommande vecka?",
  ]);
  const [newPulseQuestion, setNewPulseQuestion] = useState("");
  const [pulseFrequency, setPulseFrequency] = useState<"once" | "weekly" | "daily">("once");
  const [pulseRemindAt, setPulseRemindAt] = useState("");
  const [pulseTargetAll, setPulseTargetAll] = useState(true);
  const [selectedPulseMemberIds, setSelectedPulseMemberIds] = useState<string[]>([]);
  const [dispatchingPulse, setDispatchingPulse] = useState(false);
  const [jointPulseOpen, setJointPulseOpen] = useState(false);
  const [jointPulseAnswers, setJointPulseAnswers] = useState<Record<number, string>>({});
  const [jointPulseNotes, setJointPulseNotes] = useState("");
  const [jointPulseSummary, setJointPulseSummary] = useState("");

  // Trygghetsenkät (redigerbara frågor + utskick till Påminnelser)
  const defaultSafetyQuestions = [
    "Hur tryggt känns det att ta upp misstag, tveksamheter eller avvikande åsikter i teamet?",
    "Hur upplever du öppenhet, respekt och stöd när arbetsbelastningen eller tempot ökar?",
    "Vad skulle göra det ännu enklare att be om hjälp eller lyfta risker tidigt?",
  ];
  const [safetyTitle, setSafetyTitle] = useState("Team-trygghetsenkät");
  const [safetyQuestions, setSafetyQuestions] = useState<string[]>(defaultSafetyQuestions);
  const [safetyFrequency, setSafetyFrequency] = useState<"once" | "weekly" | "monthly">("once");
  const [safetyRemindAt, setSafetyRemindAt] = useState("");
  const [safetyTargetAll, setSafetyTargetAll] = useState(true);
  const [selectedSafetyMemberIds, setSelectedSafetyMemberIds] = useState<string[]>([]);
  const [safetyDispatching, setSafetyDispatching] = useState(false);
  const [safetyStatusMsg, setSafetyStatusMsg] = useState<string | null>(null);

  // Medarbetarsamtal (redigerbara frågor + utskick till Påminnelser + gemensamt genomförande)
  const defaultOneOnOneQuestions = [
    "Vad har gett dig mest energi och tydligast riktning i rollen på sistone?",
    "Vilka resultat eller situationer vill du lyfta fram från perioden som gått?",
    "Vad behöver du mest av i stöd, mandat eller prioriteringar framåt?",
  ];
  const [oneOnOneTitle, setOneOnOneTitle] = useState("Medarbetarsamtal");
  const [oneOnOneQuestions, setOneOnOneQuestions] = useState<string[]>(defaultOneOnOneQuestions);
  const [oneOnOneFrequency, setOneOnOneFrequency] = useState<"once" | "weekly" | "monthly">("once");
  const [oneOnOneRemindAt, setOneOnOneRemindAt] = useState("");
  const [oneOnOneTargetAll, setOneOnOneTargetAll] = useState(true);
  const [selectedOneOnOneMemberIds, setSelectedOneOnOneMemberIds] = useState<string[]>([]);
  const [oneOnOneDispatching, setOneOnOneDispatching] = useState(false);
  const [oneOnOneStatusMsg, setOneOnOneStatusMsg] = useState<string | null>(null);
  const [jointOneOnOneOpen, setJointOneOnOneOpen] = useState(false);
  const [jointOneOnOneAnswers, setJointOneOnOneAnswers] = useState<Record<number, string>>({});
  const [jointOneOnOneNotes, setJointOneOnOneNotes] = useState("");
  const [jointOneOnOneSummary, setJointOneOnOneSummary] = useState("");
  const [copiedOneOnOneSummary, setCopiedOneOnOneSummary] = useState(false);
  const [salaryRole, setSalaryRole] = useState<"employer" | "employee">("employer");
  const [salaryQuestions, setSalaryQuestions] = useState<{
    employer: string[];
    employee: string[];
  }>({
    employer: [
      "Hur tydligt har medarbetarens leverans, ansvar och bidrag till helheten varit under perioden?",
      "Hur förhåller sig nuvarande lön och ersättningsstruktur till rollens ansvar, marknadsläge och intern balans?",
      "Vilka konkreta förväntningar, mål eller utvecklingssteg behöver vara tydliga inför nästa period?",
    ],
    employee: [
      "Vilka konkreta resultat, ansvarstaganden och bidrag vill jag lyfta fram från perioden som gått?",
      "Hur har min roll och mitt ansvar utvecklats i förhållande till min nuvarande lön och villkor?",
      "Vilka förväntningar, mandat eller utvecklingsmål driver min riktning och motivation framåt?",
    ],
  });
  const [newSalaryQuestion, setNewSalaryQuestion] = useState("");
  const [salaryAnswers, setSalaryAnswers] = useState<{
    employer: Record<number, string>;
    employee: Record<number, string>;
  }>({
    employer: {},
    employee: {},
  });
  const [salarySummary, setSalarySummary] = useState("");
  const [copiedSalarySummary, setCopiedSalarySummary] = useState(false);

  const loadOrganizationData = useCallback(
    async (dept: string = "") => {
      setLoadingData(true);
      setErrorMsg("");
      setAccessDeniedMsg("");

      try {
        const headers = await getAuthHeaders();
        const analyticsUrl = new URL(`${BACKEND_URL}/api/b2b/org/analytics`);
        if (dept.trim()) {
          analyticsUrl.searchParams.set("department", dept.trim());
        }

        const [analyticsRes, membersRes] = await Promise.all([
          fetch(analyticsUrl.toString(), { method: "GET", headers }),
          fetch(`${BACKEND_URL}/api/b2b/org/members`, { method: "GET", headers }),
        ]);

        const analyticsJson = await analyticsRes.json().catch(() => ({}));
        const membersJson = await membersRes.json().catch(() => ({}));

        if (analyticsRes.status === 401 || membersRes.status === 401) {
          setSessionEmail(null);
          setSessionUserId(null);
          setCallerRole(null);
          return;
        }

        if (analyticsRes.status === 403 || membersRes.status === 403) {
          setAccessDeniedMsg(
            analyticsJson.message ||
              membersJson.message ||
              "Ditt konto saknar behörighet som HR- eller organisationsadministratör."
          );
          setOrgInfo(null);
          setAnalytics(null);
          setMembers([]);
          setInvites([]);
          setCallerRole(null);
          return;
        }

        if (!analyticsRes.ok) {
          throw new Error(analyticsJson.message || "Kunde inte hämta organisationsanalys.");
        }
        if (!membersRes.ok) {
          throw new Error(membersJson.message || "Kunde inte hämta organisationsmedlemmar.");
        }

        setOrgInfo({
          ...(analyticsJson.organization || {}),
          ...(membersJson.organization || {}),
        });
        setAnalytics(analyticsJson.analytics || {});
        setMembers(Array.isArray(membersJson.members) ? membersJson.members : []);
        setInvites(Array.isArray(membersJson.invites) ? membersJson.invites : []);
        const resolvedRole =
          membersJson.caller_role ||
          membersJson.current_user_role ||
          analyticsJson.caller_role ||
          analyticsJson.role ||
          null;
        if (resolvedRole) {
          setCallerRole(resolvedRole);
        }
      } catch (err: any) {
        setErrorMsg(err?.message || "Ett oväntat fel uppstod vid hämtning av organisationsdata.");
      } finally {
        setLoadingData(false);
      }
    },
    []
  );

  useEffect(() => {
    let mounted = true;
    async function initAuth() {
      if (!supabase) {
        if (mounted) setAuthChecking(false);
        return;
      }
      const { data } = await supabase.auth.getSession();
      const user = data?.session?.user || null;
      const email = user?.email || null;
      const uid = user?.id || null;
      if (email && mounted) {
        setSessionUserId(uid);
        await loadOrganizationData("");
      }
      if (mounted) {
        setSessionUserId(uid);
        setSessionEmail(email);
        setAuthChecking(false);
      }
    }
    initAuth();
    return () => {
      mounted = false;
    };
  }, [loadOrganizationData]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setLoginLoading(true);
    setLoginError("");
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail.trim(),
        password: loginPassword,
      });
      if (error) throw error;
      const email = data?.user?.email || loginEmail.trim();
      const uid = data?.user?.id || null;
      setSessionUserId(uid);
      setLoginPassword("");
      await loadOrganizationData(departmentFilter);
      setSessionEmail(email);
    } catch (err: any) {
      setLoginError(err?.message || "Inloggningen misslyckades. Kontrollera e-post och lösenord.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    setSessionEmail(null);
    setSessionUserId(null);
    setCallerRole(null);
    setOrgInfo(null);
    setAnalytics(null);
    setMembers([]);
    setInvites([]);
    setAccessDeniedMsg("");
    setSuccessMsg("");
    setErrorMsg("");
  };

  const handleRedeemOrgCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!redeemCode.trim()) return;
    setRedeemLoading(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${BACKEND_URL}/api/b2b/join`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ invite_code: redeemCode.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "Koden kunde inte aktiveras.");
      }
      setRedeemCode("");
      setSuccessMsg(data.message || "Organisationskoden har aktiverats.");
      await loadOrganizationData(departmentFilter);
    } catch (err: any) {
      setErrorMsg(err?.message || "Fel vid aktivering av organisationskod.");
    } finally {
      setRedeemLoading(false);
    }
  };

  const handleDepartmentChange = async (newDept: string) => {
    setDepartmentFilter(newDept);
    await loadOrganizationData(newDept);
  };

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingInvite(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${BACKEND_URL}/api/b2b/org/members`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_invite",
          org_id: orgInfo?.id,
          role: inviteRole,
          department: inviteDepartment.trim() || null,
          email: inviteEmail.trim() || null,
          max_uses: Number(inviteMaxUses) || 1,
          expires_in_days: Number(inviteExpiresDays) || 30,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "Kunde inte skapa inbjudningskod.");
      }
      setInviteDepartment("");
      setInviteEmail("");
      setSuccessMsg(
        data?.invite?.invite_code
          ? `Ny inbjudningskod skapad: ${data.invite.invite_code}`
          : "Ny inbjudningskod skapad."
      );
      await loadOrganizationData(departmentFilter);
    } catch (err: any) {
      setErrorMsg(err?.message || "Fel vid skapande av inbjudningskod.");
    } finally {
      setCreatingInvite(false);
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard?.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const startEditMember = (m: OrgMember) => {
    setEditingMemberId(m.id);
    setEditRole(m.role);
    setEditDepartment(m.department || "");
  };

  const handleSaveMember = async (memberId: string) => {
    setSavingMember(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${BACKEND_URL}/api/b2b/org/members`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_member",
          org_id: orgInfo?.id,
          member_id: memberId,
          role: editRole,
          department: editDepartment.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "Kunde inte uppdatera medlem.");
      }
      setEditingMemberId(null);
      setSuccessMsg("Medlemmens roll och avdelning har uppdaterats.");
      await loadOrganizationData(departmentFilter);
    } catch (err: any) {
      setErrorMsg(err?.message || "Fel vid uppdatering av medlem.");
    } finally {
      setSavingMember(false);
    }
  };

  const handleAddPulseQuestion = () => {
    const trimmed = newPulseQuestion.trim();
    if (!trimmed) return;
    setPulseQuestions((prev) => [...prev, trimmed]);
    setNewPulseQuestion("");
  };

  const handleUpdatePulseQuestion = (idx: number, val: string) => {
    setPulseQuestions((prev) => prev.map((q, i) => (i === idx ? val : q)));
  };

  const handleRemovePulseQuestion = (idx: number) => {
    setPulseQuestions((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));
  };

  const handleDispatchPulseToReminders = async (e: React.FormEvent) => {
    e.preventDefault();
    setDispatchingPulse(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const cleanQs = pulseQuestions.map((q) => q.trim()).filter(Boolean);
      if (cleanQs.length === 0) {
        throw new Error("Lägg till minst en pulsmätningsfråga.");
      }
      const headers = await getAuthHeaders();
      const res = await fetch(`${BACKEND_URL}/api/b2b/org/pulse-dispatch`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          org_id: orgInfo?.id,
          title: pulseTitle.trim() || "Team-pulsmätning",
          questions: cleanQs,
          frequency: pulseFrequency,
          remind_at: pulseRemindAt ? new Date(pulseRemindAt).toISOString() : null,
          member_ids: pulseTargetAll ? null : selectedPulseMemberIds,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "Kunde inte skicka ut pulsmätningen till Påminnelser.");
      }
      setSuccessMsg(
        `Pulsmätningen skickades till Påminnelser (${data.dispatched_count ?? 0} mottagare).`
      );
    } catch (err: any) {
      setErrorMsg(err?.message || "Fel vid utskick av pulsmätning.");
    } finally {
      setDispatchingPulse(false);
    }
  };

  const handleAddSalaryQuestion = () => {
    const trimmed = newSalaryQuestion.trim();
    if (!trimmed) return;
    setSalaryQuestions((prev) => ({
      ...prev,
      [salaryRole]: [...prev[salaryRole], trimmed],
    }));
    setNewSalaryQuestion("");
  };

  const handleUpdateSalaryQuestion = (idx: number, val: string) => {
    setSalaryQuestions((prev) => ({
      ...prev,
      [salaryRole]: prev[salaryRole].map((q, i) => (i === idx ? val : q)),
    }));
  };

  const handleRemoveSalaryQuestion = (idx: number) => {
    setSalaryQuestions((prev) => {
      if (prev[salaryRole].length <= 1) return prev;
      return {
        ...prev,
        [salaryRole]: prev[salaryRole].filter((_, i) => i !== idx),
      };
    });
  };

  const handleResetSalaryQuestions = () => {
    setSalaryQuestions((prev) => ({
      ...prev,
      [salaryRole]:
        salaryRole === "employer"
          ? [
              "Hur tydligt har medarbetarens leverans, ansvar och bidrag till helheten varit under perioden?",
              "Hur förhåller sig nuvarande lön och ersättningsstruktur till rollens ansvar, marknadsläge och intern balans?",
              "Vilka konkreta förväntningar, mål eller utvecklingssteg behöver vara tydliga inför nästa period?",
            ]
          : [
              "Vilka konkreta resultat, ansvarstaganden och bidrag vill jag lyfta fram från perioden som gått?",
              "Hur har min roll och mitt ansvar utvecklats i förhållande till min nuvarande lön och villkor?",
              "Vilka förväntningar, mandat eller utvecklingsmål driver min riktning och motivation framåt?",
            ],
    }));
  };

  const handleGenerateSalarySummary = () => {
    const roleLabel = salaryRole === "employer" ? "Arbetsgivare / Chef" : "Medarbetare";
    const qs = salaryQuestions[salaryRole].map((q) => q.trim()).filter(Boolean);
    const ansMap = salaryAnswers[salaryRole] || {};
    const items = qs.map((q, idx) => {
      const note = (ansMap[idx] || "").trim() || "Ingen anteckning ifylld ännu";
      return `${idx + 1}. ${q}
   Notering: ${note}`;
    });
    setSalarySummary(`Lönesamtalsunderlag (${roleLabel}):

` + items.join("\n\n"));
    setCopiedSalarySummary(false);
  };

  const handleCopySalarySummary = () => {
    if (!salarySummary) return;
    navigator.clipboard?.writeText(salarySummary);
    setCopiedSalarySummary(true);
    setTimeout(() => setCopiedSalarySummary(false), 2500);
  };

  const handleGenerateJointPulseSummary = () => {
    const cleanQs = pulseQuestions.map((q) => q.trim()).filter(Boolean);
    const lines = cleanQs.map((q, idx) => {
      const ans = (jointPulseAnswers[idx] || "").trim() || "Ingen gemensam notering angiven";
      return `- ${q}: ${ans}`;
    });
    if (jointPulseNotes.trim()) {
      lines.push(`- Gemensamt nästa steg / överenskommelse: ${jointPulseNotes.trim()}`);
    }
    setJointPulseSummary(
      `Gemensam pulssession (${pulseTitle.trim() || "Pulsmätning"}):
` + lines.join("\n")
    );
  };

  const handleDispatchSafetySurvey = async (e: React.FormEvent) => {
    e.preventDefault();
    setSafetyStatusMsg(null);
    const cleanQs = safetyQuestions.map((q) => q.trim()).filter(Boolean);
    if (cleanQs.length === 0) {
      setSafetyStatusMsg("Lägg till minst en fråga till trygghetsenkäten.");
      return;
    }
    setSafetyDispatching(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${BACKEND_URL}/api/b2b/org/safety-survey-dispatch`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          org_id: orgInfo?.id,
          title: safetyTitle.trim() || "Trygghetsenkät",
          questions: cleanQs,
          frequency: safetyFrequency,
          remind_at: safetyRemindAt ? new Date(safetyRemindAt).toISOString() : null,
          member_ids: safetyTargetAll ? null : selectedSafetyMemberIds,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "Kunde inte skicka ut trygghetsenkäten till Påminnelser.");
      }
      setSafetyStatusMsg(
        `Trygghetsenkäten skickades till Påminnelser för ${data.dispatched_count ?? "valda"} medarbetare.`
      );
    } catch (err: any) {
      setSafetyStatusMsg(err?.message || "Kunde inte skicka ut trygghetsenkäten.");
    } finally {
      setSafetyDispatching(false);
    }
  };

  const handleDispatchOneOnOne = async (e: React.FormEvent) => {
    e.preventDefault();
    setOneOnOneStatusMsg(null);
    const cleanQs = oneOnOneQuestions.map((q) => q.trim()).filter(Boolean);
    if (cleanQs.length === 0) {
      setOneOnOneStatusMsg("Lägg till minst en fråga till medarbetarsamtalet.");
      return;
    }
    setOneOnOneDispatching(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${BACKEND_URL}/api/b2b/org/one-on-one-dispatch`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          org_id: orgInfo?.id,
          title: oneOnOneTitle.trim() || "Medarbetarsamtal",
          questions: cleanQs,
          frequency: oneOnOneFrequency,
          remind_at: oneOnOneRemindAt ? new Date(oneOnOneRemindAt).toISOString() : null,
          member_ids: oneOnOneTargetAll ? null : selectedOneOnOneMemberIds,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "Kunde inte skicka ut medarbetarsamtalet till Påminnelser.");
      }
      setOneOnOneStatusMsg(
        `Underlag för medarbetarsamtal skickades till Påminnelser för ${data.dispatched_count ?? "valda"} medarbetare.`
      );
    } catch (err: any) {
      setOneOnOneStatusMsg(err?.message || "Kunde inte skicka ut medarbetarsamtalet.");
    } finally {
      setOneOnOneDispatching(false);
    }
  };

  const handleGenerateJointOneOnOneSummary = () => {
    const cleanQs = oneOnOneQuestions.map((q) => q.trim()).filter(Boolean);
    const lines = cleanQs.map((q, idx) => {
      const ans = (jointOneOnOneAnswers[idx] || "").trim() || "Ingen notering angiven";
      return `- ${q}: ${ans}`;
    });
    if (jointOneOnOneNotes.trim()) {
      lines.push(`- Gemensam överenskommelse / nästa steg: ${jointOneOnOneNotes.trim()}`);
    }
    setJointOneOnOneSummary(
      `Sammanfattning medarbetarsamtal (${oneOnOneTitle.trim() || "Medarbetarsamtal"}):\n` +
        lines.join("\n")
    );
    setCopiedOneOnOneSummary(false);
  };

  const handleCopyOneOnOneSummary = async () => {
    if (!jointOneOnOneSummary) return;
    try {
      await navigator.clipboard.writeText(jointOneOnOneSummary);
      setCopiedOneOnOneSummary(true);
      setTimeout(() => setCopiedOneOnOneSummary(false), 2500);
    } catch {
      setOneOnOneStatusMsg("Kunde inte kopiera sammanfattningen automatiskt.");
    }
  };

  const handleRevokeMember = async (member: OrgMember) => {
    const label = member.email || member.user_id;
    if (!window.confirm(`Vill du återkalla organisationssätet för ${label}?`)) {
      return;
    }
    setRevokingMemberId(member.id);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const headers = await getAuthHeaders();
      const url = new URL(`${BACKEND_URL}/api/b2b/org/members`);
      url.searchParams.set("member_id", member.id);
      if (orgInfo?.id) url.searchParams.set("org_id", orgInfo.id);

      const res = await fetch(url.toString(), {
        method: "DELETE",
        headers,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "Kunde inte återkalla organisationssätet.");
      }
      setSuccessMsg(data.message || "Organisationssätet har återkallats.");
      await loadOrganizationData(departmentFilter);
    } catch (err: any) {
      setErrorMsg(err?.message || "Fel vid återkallande av säte.");
    } finally {
      setRevokingMemberId(null);
    }
  };

  const availableDepartments = useMemo(() => {
    const set = new Set<string>();
    members.forEach((m) => {
      if (m.department && m.department.trim()) set.add(m.department.trim());
    });
    invites.forEach((i) => {
      if (i.department && i.department.trim()) set.add(i.department.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "sv"));
  }, [members, invites]);

  const effectiveRole = useMemo(() => {
    if (callerRole) return callerRole;
    const me = members.find(
      (m) =>
        m.status === "active" &&
        ((sessionUserId && m.user_id === sessionUserId) ||
          (sessionEmail && m.email && m.email.toLowerCase() === sessionEmail.toLowerCase()))
    );
    return me?.role || "hr_viewer";
  }, [callerRole, members, sessionUserId, sessionEmail]);

  const isOrgAdmin = effectiveRole === "org_admin";

  const activeAdminCount = useMemo(
    () => members.filter((m) => m.status === "active" && m.role === "org_admin").length,
    [members]
  );

  const isSelfMember = useCallback(
    (m: OrgMember) =>
      Boolean(
        (sessionUserId && m.user_id === sessionUserId) ||
          (sessionEmail && m.email && m.email.toLowerCase() === sessionEmail.toLowerCase())
      ),
    [sessionUserId, sessionEmail]
  );

  const parsedMetrics = useMemo(() => {
    if (!analytics || typeof analytics !== "object") {
      return {
        kThresholdMet: false,
        participantCount: 0,
        minK: 5,
        metrics: [] as Array<{ key: string; label: string; value: number }>,
      };
    }

    const kThresholdMet = Boolean(
      analytics.k_threshold_met ?? analytics.k_anonymity_met ?? analytics.has_enough_data ?? false
    );
    const participantCount = Number(
      analytics.active_participants ??
        analytics.participant_count ??
        analytics.sample_size ??
        analytics.calibrated_members ??
        0
    );
    const minK = Number(analytics.k_threshold ?? analytics.min_participants ?? 5);

    const entries: Array<{ key: string; label: string; value: number }> = [];
    const nestedSources = [
      analytics.compass_averages,
      analytics.dimension_averages,
      analytics.averages,
      analytics.scores,
    ];

    for (const src of nestedSources) {
      if (src && typeof src === "object" && !Array.isArray(src)) {
        Object.entries(src).forEach(([k, v]) => {
          if (typeof v === "number" && !Number.isNaN(v)) {
            entries.push({ key: k, label: formatLabel(k), value: v });
          }
        });
      } else if (Array.isArray(src)) {
        src.forEach((item: any) => {
          const k = String(item?.dimension || item?.area || item?.name || item?.key || "");
          const val = Number(item?.average ?? item?.score ?? item?.value);
          if (k && !Number.isNaN(val)) {
            entries.push({ key: k, label: formatLabel(k), value: val });
          }
        });
      }
    }

    if (entries.length === 0) {
      const ignoredKeys = new Set([
        "k_threshold",
        "min_participants",
        "participant_count",
        "active_participants",
        "active_members",
        "total_members",
        "sample_size",
        "calibrated_members",
      ]);
      Object.entries(analytics).forEach(([k, v]) => {
        if (!ignoredKeys.has(k) && typeof v === "number" && !Number.isNaN(v)) {
          entries.push({ key: k, label: formatLabel(k), value: v });
        }
      });
    }

    return { kThresholdMet, participantCount, minK, metrics: entries };
  }, [analytics]);

  if (authChecking) {
    return (
      <div className="min-h-screen bg-[#E8DCC4] text-[#1C211B] flex items-center justify-center p-6">
        <p className="text-sm tracking-wide text-[#4E5C4B] font-medium">
          Verifierar organisationsbehörighet...
        </p>
      </div>
    );
  }

  if (!sessionEmail) {
    return (
      <div className="min-h-screen bg-[#E8DCC4] text-[#1C211B] flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md bg-[#F7F2E8] border border-[#4E5C4B]/20 rounded-2xl p-8 shadow-sm">
          <div className="mb-4">
            <a
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#4E5C4B] hover:text-[#1C211B] transition"
            >
              <span>&larr;</span>
              <span>Tillbaka till FALK</span>
            </a>
          </div>
          <div className="mb-6">
            <p className="text-xs uppercase tracking-[0.2em] text-[#4E5C4B] font-semibold">
              FALK ORGANISATION &amp; HR
            </p>
            <h1 className="text-2xl font-semibold text-[#1C211B] mt-1">
              Organisationsportal
            </h1>
            <p className="text-sm text-[#4E5C4B] mt-2 leading-relaxed">
              Logga in med ditt administratörskonto för att hantera teamplatser och se
              anonymiserad kompassutveckling.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#4E5C4B] mb-1">
                E-postadress
              </label>
              <input
                type="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="namn@organisation.se"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#4E5C4B]/25 text-sm text-[#1C211B] focus:outline-none focus:border-[#4E5C4B]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#4E5C4B] mb-1">
                Lösenord
              </label>
              <div className="relative flex items-center">
                <input
                  type={showLoginPassword ? "text" : "password"}
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 pr-16 rounded-xl bg-white border border-[#4E5C4B]/25 text-sm text-[#1C211B] focus:outline-none focus:border-[#4E5C4B]"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword((prev) => !prev)}
                  aria-label={showLoginPassword ? "Dölj lösenord" : "Visa lösenord"}
                  className="absolute right-3 text-xs font-medium text-[#4E5C4B] hover:opacity-80"
                >
                  {showLoginPassword ? "Dölj" : "Visa"}
                </button>
              </div>
            </div>

            {loginError && (
              <p className="text-xs text-[#A34224] bg-[#C57B57]/15 px-3 py-2 rounded-lg">
                {loginError}
              </p>
            )}

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-[#4E5C4B] text-white text-sm font-medium hover:bg-[#3F4B3C] transition disabled:opacity-60"
            >
              {loginLoading ? "Loggar in..." : "Logga in i portalen"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#E8DCC4] text-[#1C211B]">
      {/* Toppmeny */}
      <header className="border-b border-[#4E5C4B]/15 bg-[#E8DCC4]/95 sticky top-0 z-10 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <a
              href="/"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#4E5C4B]/30 bg-[#F7F2E8]/80 text-xs font-medium text-[#1C211B] hover:bg-[#4E5C4B]/10 transition"
            >
              <span>&larr;</span>
              <span>Tillbaka till FALK</span>
            </a>
            <div>
              <div className="flex items-center gap-2.5">
                <span className="text-lg font-bold tracking-[0.18em] text-[#1C211B]">
                  FALK
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#4E5C4B] text-white font-medium">
                  {orgInfo ? formatOrgType(orgInfo.org_type) : "Organisationsvy"}
                </span>
              </div>
              <p className="text-xs text-[#4E5C4B] mt-0.5">
                {orgInfo?.name || "Fågelperspektiv för team & organisation"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {!accessDeniedMsg && (
              <span className="text-[11px] px-2.5 py-1 rounded-full bg-[#F7F2E8] border border-[#4E5C4B]/20 text-[#1C211B] font-medium">
                {formatRole(effectiveRole)}
              </span>
            )}
            <span className="text-xs text-[#4E5C4B] hidden sm:inline">{sessionEmail}</span>
            <button
              onClick={handleLogout}
              className="px-3.5 py-1.5 rounded-lg border border-[#4E5C4B]/30 text-xs font-medium text-[#1C211B] hover:bg-[#4E5C4B]/10 transition"
            >
              Logga ut
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Statusmeddelanden */}
        {errorMsg && (
          <div className="p-4 rounded-xl bg-[#C57B57]/20 border border-[#C57B57] text-sm text-[#6E2712]">
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="p-4 rounded-xl bg-[#A8BFA1]/35 border border-[#4E5C4B]/40 text-sm text-[#1C211B]">
            {successMsg}
          </div>
        )}

        {/* Om kontot saknar HR/Admin-roll ännu */}
        {accessDeniedMsg ? (
          <div className="max-w-xl mx-auto bg-[#F7F2E8] border border-[#4E5C4B]/20 rounded-2xl p-8 space-y-5">
            <h2 className="text-lg font-semibold text-[#1C211B]">
              Behörighet krävs för organisationsvyn
            </h2>
            <p className="text-sm text-[#4E5C4B] leading-relaxed">{accessDeniedMsg}</p>
            <p className="text-sm text-[#4E5C4B] leading-relaxed">
              Har du fått en administratörskod för din organisation? Aktivera den nedan för att
              koppla ditt konto.
            </p>

            <form onSubmit={handleRedeemOrgCode} className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="text"
                value={redeemCode}
                onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
                placeholder="t.ex. FALK-XXXXXXXX"
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-white border border-[#4E5C4B]/25 text-sm text-[#1C211B] focus:outline-none focus:border-[#4E5C4B]"
              />
              <button
                type="submit"
                disabled={redeemLoading || !redeemCode.trim()}
                className="px-5 py-2.5 rounded-xl bg-[#4E5C4B] text-white text-sm font-medium hover:bg-[#3F4B3C] transition disabled:opacity-50"
              >
                {redeemLoading ? "Aktiverar..." : "Aktivera kod"}
              </button>
            </form>

            <div className="pt-4 border-t border-[#4E5C4B]/15 space-y-2.5">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#4E5C4B]">
                Dina individuella B2B-verktyg
              </p>
              <div className="flex flex-wrap gap-2">
                <a
                  href="/?segment=b2b&view=calibration"
                  className="px-3.5 py-2 rounded-xl bg-[#4E5C4B] text-white text-xs font-medium hover:bg-[#3F4B3C] transition"
                >
                  Kalibrera B2B-kompasser
                </a>
                <a
                  href="/?segment=b2b&view=library"
                  className="px-3.5 py-2 rounded-xl bg-white border border-[#4E5C4B]/25 text-xs font-medium text-[#1C211B] hover:bg-[#E8DCC4]/60 transition"
                >
                  B2B-biblioteket
                </a>
                <a
                  href="/?segment=b2b&b2b_level=individual"
                  className="px-3.5 py-2 rounded-xl bg-white border border-[#4E5C4B]/25 text-xs font-medium text-[#1C211B] hover:bg-[#E8DCC4]/60 transition"
                >
                  Samtala med FALK
                </a>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Integritetsgaranti */}
            <section className="bg-[#F7F2E8] border border-[#4E5C4B]/20 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.15em] text-[#4E5C4B] font-semibold">
                  Integritet &amp; Sekretessgaranti (k-anonymitet &ge; 5)
                </p>
                <p className="text-sm text-[#1C211B]/90 leading-relaxed">
                  Enskilda medarbetares samtal, reflektioner och journalanteckningar är strikt
                  isolerade och kan aldrig läsas av arbetsgivare, HR eller försäkringsgivare.
                  Aggregerad kompassdata visas endast när minst 5 aktiva deltagare ingår i urvalet.
                </p>
              </div>
              {orgInfo && (
                <div className="shrink-0 bg-[#E8DCC4]/70 border border-[#4E5C4B]/15 rounded-xl px-4 py-3 text-right">
                  <p className="text-xs text-[#4E5C4B]">Aktiva säten</p>
                  <p className="text-xl font-semibold text-[#1C211B]">
                    {orgInfo.active_seats ?? 0}
                    {typeof orgInfo.seat_limit === "number" && orgInfo.seat_limit > 0
                      ? ` / ${orgInfo.seat_limit}`
                      : ""}
                  </p>
                </div>
              )}
            </section>

            {/* B2B-kompasser, Bibliotek & FALK på individ-, lednings- och företagsnivå */}
            <section className="bg-[#F7F2E8] border border-[#4E5C4B]/20 rounded-2xl p-6 space-y-5">
              <div className="border-b border-[#4E5C4B]/10 pb-4">
                <p className="text-xs uppercase tracking-[0.15em] text-[#4E5C4B] font-semibold">
                  Wayjs Workplace Navigation
                </p>
                <h2 className="text-lg font-semibold text-[#1C211B] mt-1">
                  B2B-kompasser, Bibliotek &amp; Samtal med FALK
                </h2>
                <p className="text-xs text-[#4E5C4B] mt-0.5">
                  Riktning före tempo – arbeta med självledarskap, kommunikation, stresshantering och effektivisering på tre nivåer.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. Individnivå */}
                <div className="bg-[#E8DCC4]/55 border border-[#4E5C4B]/15 rounded-xl p-5 flex flex-col justify-between space-y-4">
                  <div className="space-y-1.5">
                    <span className="inline-block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#4E5C4B]">
                      Nivå 1 &middot; Individ
                    </span>
                    <h3 className="text-base font-semibold text-[#1C211B]">
                      Medarbetare &amp; Ledare
                    </h3>
                    <p className="text-xs text-[#1C211B]/85 leading-relaxed">
                      Kalibrera dina fyra B2B-kompasser, gör guidade övningar eller för ett konfidentiellt reflektionssamtal med FALK.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 pt-1">
                    <a
                      href="/?segment=b2b&view=calibration"
                      className="w-full text-center px-3.5 py-2 rounded-xl bg-[#4E5C4B] text-white text-xs font-medium hover:bg-[#3F4B3C] transition"
                    >
                      Kalibrera B2B-kompasser
                    </a>
                    <a
                      href="/?segment=b2b&view=library"
                      className="w-full text-center px-3.5 py-2 rounded-xl bg-white border border-[#4E5C4B]/25 text-xs font-medium text-[#1C211B] hover:bg-[#F7F2E8] transition"
                    >
                      Öppna B2B-biblioteket (8 övningar)
                    </a>
                    <a
                      href="/?segment=b2b&b2b_level=individual"
                      className="w-full text-center px-3.5 py-2 rounded-xl bg-white border border-[#4E5C4B]/25 text-xs font-medium text-[#1C211B] hover:bg-[#F7F2E8] transition"
                    >
                      Samtala med FALK (Individ)
                    </a>
                  </div>
                </div>

                {/* 2. Ledningsnivå */}
                <div className="bg-[#E8DCC4]/55 border border-[#4E5C4B]/15 rounded-xl p-5 flex flex-col justify-between space-y-4">
                  <div className="space-y-1.5">
                    <span className="inline-block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#4E5C4B]">
                      Nivå 2 &middot; Ledning
                    </span>
                    <h3 className="text-base font-semibold text-[#1C211B]">
                      Chef &amp; Ledningsgrupp
                    </h3>
                    <p className="text-xs text-[#1C211B]/85 leading-relaxed">
                      Fågelperspektiv över teamdynamik, mandat och psykologisk trygghet – med full individsekretess.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 pt-1">
                    <a
                      href="/?segment=b2b&b2b_level=leadership"
                      className="w-full text-center px-3.5 py-2 rounded-xl bg-[#4E5C4B] text-white text-xs font-medium hover:bg-[#3F4B3C] transition"
                    >
                      Bjud in FALK till ledningssamtal
                    </a>
                    <a
                      href="/?segment=b2b&view=library"
                      className="w-full text-center px-3.5 py-2 rounded-xl bg-white border border-[#4E5C4B]/25 text-xs font-medium text-[#1C211B] hover:bg-[#F7F2E8] transition"
                    >
                      Övningar för ledarskap &amp; kommunikation
                    </a>
                    <a
                      href="/moderator?context=b2b"
                      className="w-full text-center px-3.5 py-2 rounded-xl bg-[#C57B57] text-white text-xs font-medium hover:bg-[#B26B49] transition"
                    >
                      Neutralt moderatorsamtal (2 parter)
                    </a>
                  </div>
                </div>

                {/* 3. Företagsnivå */}
                <div className="bg-[#E8DCC4]/55 border border-[#4E5C4B]/15 rounded-xl p-5 flex flex-col justify-between space-y-4">
                  <div className="space-y-1.5">
                    <span className="inline-block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#4E5C4B]">
                      Nivå 3 &middot; Företag
                    </span>
                    <h3 className="text-base font-semibold text-[#1C211B]">
                      Organisation &amp; Kultur
                    </h3>
                    <p className="text-xs text-[#1C211B]/85 leading-relaxed">
                      Systemperspektiv på kultur, hållbar energi och gemensam kompass utifrån anonymiserat gruppunderlag.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 pt-1">
                    <a
                      href="/?segment=b2b&b2b_level=company"
                      className="w-full text-center px-3.5 py-2 rounded-xl bg-[#4E5C4B] text-white text-xs font-medium hover:bg-[#3F4B3C] transition"
                    >
                      Bjud in FALK till organisationssamtal
                    </a>
                    <a
                      href="/?segment=b2b&view=library"
                      className="w-full text-center px-3.5 py-2 rounded-xl bg-white border border-[#4E5C4B]/25 text-xs font-medium text-[#1C211B] hover:bg-[#F7F2E8] transition"
                    >
                      Övningar för stresshantering &amp; flöde
                    </a>
                  </div>
                </div>
              </div>
            </section>

            {/* Aggregerad kompassanalys */}
            <section className="bg-[#F7F2E8] border border-[#4E5C4B]/20 rounded-2xl p-6 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#4E5C4B]/10 pb-4">
                <div>
                  <h2 className="text-lg font-semibold text-[#1C211B]">
                    Aggregerad kompassöversikt
                  </h2>
                  <p className="text-xs text-[#4E5C4B] mt-0.5">
                    Fågelperspektiv över riktning, balans och välmående på gruppnivå
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <label htmlFor="dept-filter" className="text-xs font-medium text-[#4E5C4B]">
                    Avdelning / Enhet:
                  </label>
                  <select
                    id="dept-filter"
                    value={departmentFilter}
                    onChange={(e) => handleDepartmentChange(e.target.value)}
                    className="px-3 py-1.5 rounded-lg bg-white border border-[#4E5C4B]/25 text-xs text-[#1C211B] focus:outline-none focus:border-[#4E5C4B]"
                  >
                    <option value="">Hela organisationen</option>
                    {availableDepartments.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {loadingData ? (
                <p className="text-sm text-[#4E5C4B] py-6">Hämtar anonymiserad kompassdata...</p>
              ) : !parsedMetrics.kThresholdMet ? (
                <div className="bg-[#E8DCC4]/60 border border-[#4E5C4B]/20 rounded-xl p-6 text-center space-y-2">
                  <p className="text-sm font-semibold text-[#1C211B]">
                    Anonymitetsspärr aktiv (färre än {parsedMetrics.minK} aktiva deltagare)
                  </p>
                  <p className="text-xs text-[#4E5C4B] max-w-lg mx-auto leading-relaxed">
                    Det valda urvalet har för närvarande {parsedMetrics.participantCount} aktiva
                    deltagare. Minst {parsedMetrics.minK} deltagare krävs innan genomsnittsvärden
                    beräknas och visas.
                  </p>
                </div>
              ) : parsedMetrics.metrics.length === 0 ? (
                <div className="bg-[#E8DCC4]/60 border border-[#4E5C4B]/20 rounded-xl p-6 text-center">
                  <p className="text-sm text-[#4E5C4B]">
                    Anonymitetskravet är uppfyllt ({parsedMetrics.participantCount} aktiva
                    deltagare), men inga kompasskalibreringar har registrerats ännu.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs text-[#4E5C4B]">
                    Underlag: <strong className="text-[#1C211B]">{parsedMetrics.participantCount}</strong>{" "}
                    aktiva deltagare {departmentFilter ? `inom ${departmentFilter}` : "i organisationen"}
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {parsedMetrics.metrics.map((item) => {
                      const pct = Math.max(0, Math.min(100, Math.round(item.value * 10)));
                      return (
                        <div
                          key={item.key}
                          className="bg-white/80 border border-[#4E5C4B]/15 rounded-xl p-4 space-y-2"
                        >
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium text-[#1C211B]">{item.label}</span>
                            <span className="font-semibold text-[#4E5C4B]">
                              {item.value.toFixed(1)} / 10
                            </span>
                          </div>
                          <div className="w-full h-2.5 bg-[#E8DCC4] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#4E5C4B] rounded-full transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>

            {/* Redigerbar pulsmätarmodul: utskick till Påminnelser eller gemensam session */}
        <section className="bg-[#F7F2E8] border border-[#4E5C4B]/20 rounded-2xl p-6 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#4E5C4B]/10 pb-4">
            <div>
              <p className="text-xs uppercase tracking-[0.15em] text-[#4E5C4B] font-semibold">
                PULSMÄTNING &amp; PÅMINNELSER
              </p>
              <h2 className="text-lg font-semibold text-[#1C211B] mt-1">
                Redigerbar pulsmätning för team &amp; medarbetare
              </h2>
              <p className="text-xs text-[#4E5C4B] mt-0.5">
                Anpassa frågorna, skicka ut till mottagarnas Påminnelser i högra menyn eller kör en gemensam pulssession direkt.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setJointPulseOpen((prev) => !prev)}
              className="px-4 py-2 rounded-xl bg-[#4E5C4B] text-white text-xs font-medium hover:bg-[#3F4B3C] transition"
            >
              {jointPulseOpen ? "Dölj gemensam session" : "Starta gemensam session"}
            </button>
          </div>

          <form onSubmit={handleDispatchPulseToReminders} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-[#4E5C4B] mb-1">
                  Rubrik på pulsmätning
                </label>
                <input
                  type="text"
                  value={pulseTitle}
                  onChange={(e) => setPulseTitle(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#4E5C4B]/25 text-xs text-[#1C211B]"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-medium text-[#4E5C4B]">
                  Frågor i pulsmätningen (redigerbara)
                </label>
                {pulseQuestions.map((q, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-[#4E5C4B] w-5">{idx + 1}.</span>
                    <input
                      type="text"
                      value={q}
                      onChange={(e) => handleUpdatePulseQuestion(idx, e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl bg-white border border-[#4E5C4B]/25 text-xs text-[#1C211B]"
                    />
                    {pulseQuestions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemovePulseQuestion(idx)}
                        className="px-2.5 py-2 rounded-xl border border-[#C57B57]/40 text-xs text-[#8F3519] hover:bg-[#C57B57]/10"
                      >
                        Ta bort
                      </button>
                    )}
                  </div>
                ))}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={newPulseQuestion}
                    onChange={(e) => setNewPulseQuestion(e.target.value)}
                    placeholder="Lägg till ny fråga..."
                    className="flex-1 px-3 py-2 rounded-xl bg-white border border-[#4E5C4B]/25 text-xs text-[#1C211B]"
                  />
                  <button
                    type="button"
                    onClick={handleAddPulseQuestion}
                    className="px-3.5 py-2 rounded-xl bg-[#E8DCC4] border border-[#4E5C4B]/25 text-xs font-medium text-[#1C211B] hover:bg-[#E8DCC4]/80"
                  >
                    + Lägg till fråga
                  </button>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 bg-[#E8DCC4]/55 border border-[#4E5C4B]/15 rounded-xl p-4 space-y-3.5">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#4E5C4B]">
                Utskick till Påminnelser (höger meny)
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#4E5C4B] mb-1">Frekvens</label>
                  <select
                    value={pulseFrequency}
                    onChange={(e) => setPulseFrequency(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-[#4E5C4B]/25 text-xs text-[#1C211B]"
                  >
                    <option value="once">Engångsutskick</option>
                    <option value="weekly">Veckovis</option>
                    <option value="daily">Dagligen</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#4E5C4B] mb-1">Påminnelsetid (valfri)</label>
                  <input
                    type="datetime-local"
                    value={pulseRemindAt}
                    onChange={(e) => setPulseRemindAt(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-[#4E5C4B]/25 text-xs text-[#1C211B]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="inline-flex items-center gap-2 text-xs font-medium text-[#1C211B]">
                  <input
                    type="checkbox"
                    checked={pulseTargetAll}
                    onChange={(e) => setPulseTargetAll(e.target.checked)}
                    className="accent-[#4E5C4B]"
                  />
                  Skicka till alla aktiva medlemmar i organisationen
                </label>

                {!pulseTargetAll && (
                  <div className="max-h-28 overflow-y-auto rounded-xl bg-white/80 border border-[#4E5C4B]/20 p-2 space-y-1">
                    {members
                      .filter((m) => m.status === "active")
                      .map((m) => {
                        const uid = m.user_id;
                        const checked = selectedPulseMemberIds.includes(uid);
                        return (
                          <label key={m.id} className="flex items-center gap-2 text-xs text-[#1C211B]">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                setSelectedPulseMemberIds((prev) =>
                                  e.target.checked ? [...prev, uid] : prev.filter((x) => x !== uid)
                                );
                              }}
                              className="accent-[#4E5C4B]"
                            />
                            <span className="truncate">{m.email || uid.slice(0, 8)}</span>
                          </label>
                        );
                      })}
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={dispatchingPulse || !isOrgAdmin}
                className="w-full py-2.5 px-4 rounded-xl bg-[#C57B57] text-white text-xs font-semibold hover:bg-[#B26B48] transition disabled:opacity-50"
              >
                {!isOrgAdmin
                  ? "Endast Organisationsadmin kan skicka ut"
                  : dispatchingPulse
                  ? "Skickar till Påminnelser..."
                  : "Skicka ut till Påminnelser"}
              </button>
            </div>
          </form>

          {jointPulseOpen && (
            <div className="mt-4 rounded-xl border border-[#4E5C4B]/25 bg-white/85 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[#1C211B]">
                  Gemensam pulsmätningssession: {pulseTitle || "Pulsmätning"}
                </h3>
                <span className="text-[11px] text-[#4E5C4B]">Tillsammans i session</span>
              </div>
              <div className="space-y-2.5">
                {pulseQuestions.map((q, idx) => (
                  <div key={idx} className="space-y-1">
                    <label className="block text-xs font-medium text-[#1C211B]">
                      {idx + 1}. {q}
                    </label>
                    <input
                      type="text"
                      value={jointPulseAnswers[idx] || ""}
                      onChange={(e) =>
                        setJointPulseAnswers((prev) => ({ ...prev, [idx]: e.target.value }))
                      }
                      placeholder="Skriv gemensam reflektion eller svar..."
                      className="w-full px-3 py-2 rounded-lg bg-[#FAF7F0] border border-[#4E5C4B]/25 text-xs text-[#1C211B]"
                    />
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-xs font-medium text-[#4E5C4B] mb-1">
                  Gemensamma anteckningar / nästa steg
                </label>
                <textarea
                  rows={2}
                  value={jointPulseNotes}
                  onChange={(e) => setJointPulseNotes(e.target.value)}
                  placeholder="Vad kommer ni överens om efter denna gemensamma pulsmätning?"
                  className="w-full px-3 py-2 rounded-lg bg-[#FAF7F0] border border-[#4E5C4B]/25 text-xs text-[#1C211B]"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleGenerateJointPulseSummary}
                  className="px-4 py-2 rounded-xl bg-[#4E5C4B] text-white text-xs font-medium hover:bg-[#3F4B3C] transition"
                >
                  Sammanställ gemensam session
                </button>
              </div>
              {jointPulseSummary && (
                <pre className="whitespace-pre-wrap rounded-xl bg-[#F2ECE0] border border-[#4E5C4B]/20 p-3 text-xs text-[#1C211B] font-sans">
                  {jointPulseSummary}
                </pre>
              )}
            </div>
          )}
        </section>

        {/* Trygghetsenkät (redigerbara frågor + utskick till Påminnelser) */}
        <section className="bg-[#F7F2E8] border border-[#4E5C4B]/20 rounded-2xl p-6 space-y-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-[#1C211B]">
                Trygghetsenkät
              </h2>
              <p className="text-xs text-[#4E5C4B] mt-0.5">
                Redigera, lägg till eller ta bort frågor och skicka ut trygghetsenkäten direkt till medarbetarnas Påminnelser.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSafetyQuestions([...defaultSafetyQuestions]);
                setSafetyStatusMsg(null);
              }}
              className="self-start md:self-auto px-3 py-1.5 rounded-xl border border-[#4E5C4B]/25 text-xs font-medium text-[#1C211B] hover:bg-[#E8DCC4]/60 transition"
            >
              Återställ standardfrågor
            </button>
          </div>

          <form onSubmit={handleDispatchSafetySurvey} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#1C211B] mb-1">
                  Rubrik på trygghetsenkät
                </label>
                <input
                  type="text"
                  value={safetyTitle}
                  onChange={(e) => setSafetyTitle(e.target.value)}
                  className="w-full rounded-xl border border-[#4E5C4B]/25 bg-white px-3 py-2 text-xs text-[#1C211B]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#1C211B] mb-1">
                  Frekvens
                </label>
                <select
                  value={safetyFrequency}
                  onChange={(e) =>
                    setSafetyFrequency(e.target.value as "once" | "weekly" | "monthly")
                  }
                  className="w-full rounded-xl border border-[#4E5C4B]/25 bg-white px-3 py-2 text-xs text-[#1C211B]"
                >
                  <option value="once">Engångsutskick</option>
                  <option value="weekly">Varje vecka</option>
                  <option value="monthly">Varje månad</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#1C211B] mb-1">
                  Påminnelsetid (valfritt)
                </label>
                <input
                  type="datetime-local"
                  value={safetyRemindAt}
                  onChange={(e) => setSafetyRemindAt(e.target.value)}
                  className="w-full rounded-xl border border-[#4E5C4B]/25 bg-white px-3 py-2 text-xs text-[#1C211B]"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#1C211B]">
                  Frågor i trygghetsenkäten ({safetyQuestions.length})
                </span>
                <button
                  type="button"
                  onClick={() => setSafetyQuestions((prev) => [...prev, ""])}
                  className="px-3 py-1 rounded-lg border border-[#4E5C4B]/25 text-xs font-medium text-[#1C211B] hover:bg-[#E8DCC4]/60 transition"
                >
                  + Lägg till fråga
                </button>
              </div>

              <div className="space-y-2">
                {safetyQuestions.map((q, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-[#4E5C4B] w-5">
                      {idx + 1}.
                    </span>
                    <input
                      type="text"
                      value={q}
                      onChange={(e) => {
                        const next = [...safetyQuestions];
                        next[idx] = e.target.value;
                        setSafetyQuestions(next);
                      }}
                      placeholder="Skriv fråga till trygghetsenkäten..."
                      className="flex-1 rounded-xl border border-[#4E5C4B]/25 bg-white px-3 py-2 text-xs text-[#1C211B]"
                    />
                    {safetyQuestions.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setSafetyQuestions((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="px-2.5 py-2 rounded-xl border border-red-300 text-xs text-red-700 hover:bg-red-50 transition"
                      >
                        Ta bort
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <label className="inline-flex items-center gap-2 text-xs font-medium text-[#1C211B]">
                <input
                  type="checkbox"
                  checked={safetyTargetAll}
                  onChange={(e) => setSafetyTargetAll(e.target.checked)}
                  className="rounded border-[#4E5C4B]/40"
                />
                Skicka till alla aktiva medlemmar i organisationen
              </label>

              {!safetyTargetAll && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {members
                    .filter((m) => m.status === "active")
                    .map((m) => {
                      const active = selectedSafetyMemberIds.includes(m.user_id);
                      return (
                        <button
                          key={m.user_id}
                          type="button"
                          onClick={() =>
                            setSelectedSafetyMemberIds((prev) =>
                              active
                                ? prev.filter((id) => id !== m.user_id)
                                : [...prev, m.user_id]
                            )
                          }
                          className={`px-3 py-1 rounded-full text-xs border transition ${
                            active
                              ? "bg-[#4E5C4B] text-white border-[#4E5C4B]"
                              : "bg-white text-[#1C211B] border-[#4E5C4B]/25"
                          }`}
                        >
                          {m.email || m.user_id}
                        </button>
                      );
                    })}
                </div>
              )}
            </div>

            {safetyStatusMsg && (
              <p className="text-xs font-medium text-[#2E5A36] bg-[#E3EFE5] border border-[#2E5A36]/20 rounded-xl px-3 py-2">
                {safetyStatusMsg}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={safetyDispatching}
                className="px-4 py-2 rounded-xl bg-[#4E5C4B] text-white text-xs font-medium hover:bg-[#3F4B3C] disabled:opacity-50 transition"
              >
                {safetyDispatching ? "Skickar ut..." : "Skicka ut trygghetsenkät till Påminnelser"}
              </button>
            </div>
          </form>
        </section>

        {/* Medarbetarsamtal (redigerbara frågor + utskick till Påminnelser + gemensamt genomförande) */}
        <section className="bg-[#F7F2E8] border border-[#4E5C4B]/20 rounded-2xl p-6 space-y-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-[#1C211B]">
                Medarbetarsamtal
              </h2>
              <p className="text-xs text-[#4E5C4B] mt-0.5">
                Anpassa frågorna, skicka ut underlag till medarbetarnas Påminnelser eller genomför medarbetarsamtalet gemensamt.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setOneOnOneQuestions([...defaultOneOnOneQuestions]);
                  setOneOnOneStatusMsg(null);
                }}
                className="px-3 py-1.5 rounded-xl border border-[#4E5C4B]/25 text-xs font-medium text-[#1C211B] hover:bg-[#E8DCC4]/60 transition"
              >
                Återställ standardfrågor
              </button>
              <button
                type="button"
                onClick={() => setJointOneOnOneOpen((prev) => !prev)}
                className="px-3 py-1.5 rounded-xl border border-[#4E5C4B] text-xs font-medium text-[#1C211B] hover:bg-[#E8DCC4]/70 transition"
              >
                {jointOneOnOneOpen ? "Dölj gemensamt samtal" : "Genomför gemensamt"}
              </button>
            </div>
          </div>

          <form onSubmit={handleDispatchOneOnOne} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#1C211B] mb-1">
                  Rubrik på medarbetarsamtal
                </label>
                <input
                  type="text"
                  value={oneOnOneTitle}
                  onChange={(e) => setOneOnOneTitle(e.target.value)}
                  className="w-full rounded-xl border border-[#4E5C4B]/25 bg-white px-3 py-2 text-xs text-[#1C211B]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#1C211B] mb-1">
                  Frekvens
                </label>
                <select
                  value={oneOnOneFrequency}
                  onChange={(e) =>
                    setOneOnOneFrequency(e.target.value as "once" | "weekly" | "monthly")
                  }
                  className="w-full rounded-xl border border-[#4E5C4B]/25 bg-white px-3 py-2 text-xs text-[#1C211B]"
                >
                  <option value="once">Engångsutskick</option>
                  <option value="weekly">Varje vecka</option>
                  <option value="monthly">Varje månad</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#1C211B] mb-1">
                  Påminnelsetid (valfritt)
                </label>
                <input
                  type="datetime-local"
                  value={oneOnOneRemindAt}
                  onChange={(e) => setOneOnOneRemindAt(e.target.value)}
                  className="w-full rounded-xl border border-[#4E5C4B]/25 bg-white px-3 py-2 text-xs text-[#1C211B]"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#1C211B]">
                  Samtalsfrågor ({oneOnOneQuestions.length})
                </span>
                <button
                  type="button"
                  onClick={() => setOneOnOneQuestions((prev) => [...prev, ""])}
                  className="px-3 py-1 rounded-lg border border-[#4E5C4B]/25 text-xs font-medium text-[#1C211B] hover:bg-[#E8DCC4]/60 transition"
                >
                  + Lägg till fråga
                </button>
              </div>

              <div className="space-y-2">
                {oneOnOneQuestions.map((q, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-[#4E5C4B] w-5">
                      {idx + 1}.
                    </span>
                    <input
                      type="text"
                      value={q}
                      onChange={(e) => {
                        const next = [...oneOnOneQuestions];
                        next[idx] = e.target.value;
                        setOneOnOneQuestions(next);
                      }}
                      placeholder="Skriv fråga till medarbetarsamtalet..."
                      className="flex-1 rounded-xl border border-[#4E5C4B]/25 bg-white px-3 py-2 text-xs text-[#1C211B]"
                    />
                    {oneOnOneQuestions.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setOneOnOneQuestions((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="px-2.5 py-2 rounded-xl border border-red-300 text-xs text-red-700 hover:bg-red-50 transition"
                      >
                        Ta bort
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <label className="inline-flex items-center gap-2 text-xs font-medium text-[#1C211B]">
                <input
                  type="checkbox"
                  checked={oneOnOneTargetAll}
                  onChange={(e) => setOneOnOneTargetAll(e.target.checked)}
                  className="rounded border-[#4E5C4B]/40"
                />
                Skicka till alla aktiva medlemmar i organisationen
              </label>

              {!oneOnOneTargetAll && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {members
                    .filter((m) => m.status === "active")
                    .map((m) => {
                      const active = selectedOneOnOneMemberIds.includes(m.user_id);
                      return (
                        <button
                          key={m.user_id}
                          type="button"
                          onClick={() =>
                            setSelectedOneOnOneMemberIds((prev) =>
                              active
                                ? prev.filter((id) => id !== m.user_id)
                                : [...prev, m.user_id]
                            )
                          }
                          className={`px-3 py-1 rounded-full text-xs border transition ${
                            active
                              ? "bg-[#4E5C4B] text-white border-[#4E5C4B]"
                              : "bg-white text-[#1C211B] border-[#4E5C4B]/25"
                          }`}
                        >
                          {m.email || m.user_id}
                        </button>
                      );
                    })}
                </div>
              )}
            </div>

            {oneOnOneStatusMsg && (
              <p className="text-xs font-medium text-[#2E5A36] bg-[#E3EFE5] border border-[#2E5A36]/20 rounded-xl px-3 py-2">
                {oneOnOneStatusMsg}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={oneOnOneDispatching}
                className="px-4 py-2 rounded-xl bg-[#4E5C4B] text-white text-xs font-medium hover:bg-[#3F4B3C] disabled:opacity-50 transition"
              >
                {oneOnOneDispatching
                  ? "Skickar ut..."
                  : "Skicka ut medarbetarsamtal till Påminnelser"}
              </button>
            </div>
          </form>

          {jointOneOnOneOpen && (
            <div className="rounded-2xl border border-[#4E5C4B]/25 bg-white/85 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#4E5C4B]">
                  Gemensamt genomförande — {oneOnOneTitle || "Medarbetarsamtal"}
                </h3>
                <button
                  type="button"
                  onClick={() => setJointOneOnOneOpen(false)}
                  className="text-xs text-[#4E5C4B] hover:underline"
                >
                  Stäng
                </button>
              </div>

              <div className="space-y-2.5">
                {oneOnOneQuestions
                  .map((q) => q.trim())
                  .filter(Boolean)
                  .map((q, idx) => (
                    <div key={idx} className="space-y-1">
                      <label className="block text-xs font-medium text-[#1C211B]">
                        {idx + 1}. {q}
                      </label>
                      <input
                        type="text"
                        value={jointOneOnOneAnswers[idx] || ""}
                        onChange={(e) =>
                          setJointOneOnOneAnswers((prev) => ({
                            ...prev,
                            [idx]: e.target.value,
                          }))
                        }
                        placeholder="Anteckna samtalspunkt eller svar gemensamt..."
                        className="w-full rounded-xl border border-[#4E5C4B]/25 bg-white px-3 py-1.5 text-xs text-[#1C211B]"
                      />
                    </div>
                  ))}
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1C211B] mb-1">
                  Gemensam överenskommelse / nästa steg
                </label>
                <textarea
                  rows={2}
                  value={jointOneOnOneNotes}
                  onChange={(e) => setJointOneOnOneNotes(e.target.value)}
                  placeholder="Skriv överenskomna mål, stöd eller uppföljning..."
                  className="w-full rounded-xl border border-[#4E5C4B]/25 bg-white px-3 py-2 text-xs text-[#1C211B]"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleGenerateJointOneOnOneSummary}
                  className="px-4 py-2 rounded-xl bg-[#4E5C4B] text-white text-xs font-medium hover:bg-[#3F4B3C] transition"
                >
                  Sammanställ medarbetarsamtal
                </button>
                {jointOneOnOneSummary && (
                  <button
                    type="button"
                    onClick={handleCopyOneOnOneSummary}
                    className="px-3.5 py-2 rounded-xl border border-[#4E5C4B]/30 text-xs font-medium text-[#1C211B] hover:bg-[#E8DCC4]/60 transition"
                  >
                    {copiedOneOnOneSummary ? "Kopierat!" : "Kopiera sammanfattning"}
                  </button>
                )}
              </div>

              {jointOneOnOneSummary && (
                <pre className="whitespace-pre-wrap rounded-xl bg-[#F2ECE0] border border-[#4E5C4B]/20 p-3 text-xs text-[#1C211B] font-sans">
                  {jointOneOnOneSummary}
                </pre>
              )}
            </div>
          )}
        </section>

        {/* Skapa inbjudningskod & aktiva koder */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-5 bg-[#F7F2E8] border border-[#4E5C4B]/20 rounded-2xl p-6 space-y-4">
                <div>
                  <h2 className="text-base font-semibold text-[#1C211B]">
                    Skapa inbjudningskod
                  </h2>
                  <p className="text-xs text-[#4E5C4B] mt-0.5">
                    Dela koden med medarbetare eller HR-kollegor för aktivering
                  </p>
                </div>

                <form onSubmit={handleCreateInvite} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-medium text-[#4E5C4B] mb-1">
                      Roll
                    </label>
                    <select
                      value={inviteRole}
                      disabled={!isOrgAdmin}
                      onChange={(e) => setInviteRole(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[#4E5C4B]/25 text-xs text-[#1C211B] disabled:opacity-60"
                    >
                      <option value="member">Medarbetare / Deltagare</option>
                      <option value="hr_viewer">HR-analytiker (läsbehörighet)</option>
                      {isOrgAdmin && (
                        <option value="org_admin">Organisationsadministratör</option>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#4E5C4B] mb-1">
                      Avdelning / Enhet (valfritt)
                    </label>
                    <input
                      type="text"
                      value={inviteDepartment}
                      onChange={(e) => setInviteDepartment(e.target.value)}
                      placeholder="t.ex. Produktutveckling, Ledning"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[#4E5C4B]/25 text-xs text-[#1C211B]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#4E5C4B] mb-1">
                      Lås till specifik e-post (valfritt)
                    </label>
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="Lämna tomt för gruppkod"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[#4E5C4B]/25 text-xs text-[#1C211B]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-[#4E5C4B] mb-1">
                        Antal användningar
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={500}
                        value={inviteMaxUses}
                        onChange={(e) => setInviteMaxUses(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-xl bg-white border border-[#4E5C4B]/25 text-xs text-[#1C211B]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#4E5C4B] mb-1">
                        Giltig (dagar)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={365}
                        value={inviteExpiresDays}
                        onChange={(e) => setInviteExpiresDays(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-xl bg-white border border-[#4E5C4B]/25 text-xs text-[#1C211B]"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={creatingInvite || !isOrgAdmin}
                    className="w-full py-2.5 px-4 rounded-xl bg-[#C57B57] text-white text-xs font-semibold hover:bg-[#B26B48] transition disabled:opacity-50"
                  >
                    {!isOrgAdmin
                      ? "Endast Organisationsadmin kan skapa koder"
                      : creatingInvite
                        ? "Skapar kod..."
                        : "Generera inbjudningskod"}
                  </button>
                </form>
              </div>

              <div className="lg:col-span-7 bg-[#F7F2E8] border border-[#4E5C4B]/20 rounded-2xl p-6 space-y-4">
                <div>
                  <h2 className="text-base font-semibold text-[#1C211B]">
                    Inbjudningskoder ({invites.length})
                  </h2>
                  <p className="text-xs text-[#4E5C4B] mt-0.5">
                    Klicka på en kod för att kopiera och dela med deltagare
                  </p>
                </div>

                {invites.length === 0 ? (
                  <p className="text-xs text-[#4E5C4B] py-4">
                    Inga inbjudningskoder har skapats ännu.
                  </p>
                ) : (
                  <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                    {invites.map((inv) => (
                      <div
                        key={inv.id}
                        className="bg-white/80 border border-[#4E5C4B]/15 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <code className="text-xs font-bold px-2.5 py-1 rounded-md bg-[#E8DCC4] text-[#1C211B]">
                              {inv.invite_code}
                            </code>
                            <button
                              type="button"
                              onClick={() => handleCopyCode(inv.invite_code)}
                              className="text-xs text-[#4E5C4B] underline hover:text-[#1C211B]"
                            >
                              {copiedCode === inv.invite_code ? "Kopierad" : "Kopiera"}
                            </button>
                          </div>
                          <p className="text-xs text-[#4E5C4B]">
                            {formatRole(inv.role)}
                            {inv.department ? ` • ${inv.department}` : ""}
                            {inv.email ? ` • ${inv.email}` : ""}
                          </p>
                        </div>

                        <div className="text-right text-xs text-[#4E5C4B]">
                          <p className="font-medium text-[#1C211B]">
                            {inv.used_count} / {inv.max_uses} använda
                          </p>
                          <p>
                            {inv.is_active ? "Aktiv" : "Inaktiv"}
                            {inv.expires_at
                              ? ` • Utgår ${new Date(inv.expires_at).toLocaleDateString("sv-SE")}`
                              : ""}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* Medlemslista */}
            <section className="bg-[#F7F2E8] border border-[#4E5C4B]/20 rounded-2xl p-6 space-y-4">
              <div>
                <h2 className="text-base font-semibold text-[#1C211B]">
                  Organisationsmedlemmar ({members.length})
                </h2>
                <p className="text-xs text-[#4E5C4B] mt-0.5">
                  Hantera roller, avdelningstillhörighet och aktiva licenssäten
                </p>
              </div>

              {members.length === 0 ? (
                <p className="text-xs text-[#4E5C4B] py-4">
                  Inga medlemmar registrerade ännu.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#4E5C4B]/15 text-xs text-[#4E5C4B]">
                        <th className="py-2.5 pr-4 font-semibold">Deltagare</th>
                        <th className="py-2.5 px-4 font-semibold">Roll</th>
                        <th className="py-2.5 px-4 font-semibold">Avdelning</th>
                        <th className="py-2.5 px-4 font-semibold">Status</th>
                        <th className="py-2.5 pl-4 font-semibold text-right">Åtgärd</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#4E5C4B]/10 text-xs">
                      {members.map((m) => {
                        const isEditing = editingMemberId === m.id;
                        const isSelf = isSelfMember(m);
                        const isTargetAdmin = m.role === "org_admin";
                        const isLastAdmin = isTargetAdmin && activeAdminCount <= 1;
                        const roleLocked = isTargetAdmin && (isSelf || isLastAdmin);
                        const canManageRow = isOrgAdmin;
                        const canRevokeRow = isOrgAdmin && !isSelf && !isLastAdmin;

                        return (
                          <tr key={m.id} className="hover:bg-white/40">
                            <td className="py-3 pr-4">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-[#1C211B]">
                                  {m.email || `Användare ${m.user_id.slice(0, 8)}...`}
                                </p>
                                {isSelf && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#4E5C4B]/15 text-[#1C211B] font-semibold">
                                    Du
                                  </span>
                                )}
                              </div>
                              {m.joined_at && (
                                <p className="text-[11px] text-[#4E5C4B]">
                                  Ansluten {new Date(m.joined_at).toLocaleDateString("sv-SE")}
                                </p>
                              )}
                            </td>

                            <td className="py-3 px-4">
                              {isEditing ? (
                                <div className="space-y-1">
                                  <select
                                    value={editRole}
                                    disabled={roleLocked}
                                    onChange={(e) => setEditRole(e.target.value)}
                                    className="px-2 py-1 rounded bg-white border border-[#4E5C4B]/30 text-xs disabled:opacity-60"
                                  >
                                    <option value="member">Medarbetare / Deltagare</option>
                                    <option value="hr_viewer">HR-analytiker</option>
                                    <option value="org_admin">Organisationsadmin</option>
                                  </select>
                                  {roleLocked && (
                                    <p className="text-[10px] text-[#4E5C4B]">
                                      Skyddad högsta roll
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  <span>{formatRole(m.role)}</span>
                                  {isTargetAdmin && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#4E5C4B]/10 text-[#4E5C4B] font-medium">
                                      Högsta nivå
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>

                            <td className="py-3 px-4">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editDepartment}
                                  onChange={(e) => setEditDepartment(e.target.value)}
                                  placeholder="Avdelning"
                                  className="px-2 py-1 rounded bg-white border border-[#4E5C4B]/30 text-xs w-36"
                                />
                              ) : (
                                m.department || "—"
                              )}
                            </td>

                            <td className="py-3 px-4">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                                  m.status === "active"
                                    ? "bg-[#A8BFA1]/45 text-[#1C211B]"
                                    : "bg-[#C57B57]/25 text-[#6E2712]"
                                }`}
                              >
                                {m.status === "active" ? "Aktiv" : "Återkallad"}
                              </span>
                            </td>

                            <td className="py-3 pl-4 text-right space-x-2">
                              {m.status === "active" && (
                                <>
                                  {!canManageRow ? (
                                    <span className="text-[11px] text-[#4E5C4B]">
                                      Läsbehörighet
                                    </span>
                                  ) : isEditing ? (
                                    <>
                                      <button
                                        type="button"
                                        disabled={savingMember}
                                        onClick={() => handleSaveMember(m.id)}
                                        className="px-2.5 py-1 rounded bg-[#4E5C4B] text-white font-medium hover:bg-[#3F4B3C]"
                                      >
                                        {savingMember ? "Sparar..." : "Spara"}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setEditingMemberId(null)}
                                        className="px-2 py-1 rounded border border-[#4E5C4B]/30 text-[#4E5C4B]"
                                      >
                                        Avbryt
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => startEditMember(m)}
                                        className="px-2.5 py-1 rounded border border-[#4E5C4B]/30 text-[#1C211B] hover:bg-[#4E5C4B]/10"
                                      >
                                        Ändra
                                      </button>
                                      {canRevokeRow && (
                                        <button
                                          type="button"
                                          disabled={revokingMemberId === m.id}
                                          onClick={() => handleRevokeMember(m)}
                                          className="px-2.5 py-1 rounded border border-[#C57B57]/50 text-[#8F3519] hover:bg-[#C57B57]/15"
                                        >
                                          {revokingMemberId === m.id ? "..." : "Återkalla"}
                                        </button>
                                      )}
                                    </>
                                  )}
                                </>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      
        {/* Rollväxlad lönesamtalsmodul med redigerbara frågor */}
        <section className="mt-8 rounded-2xl border border-[#4E5C4B]/20 bg-[#F7F2E8] p-6 space-y-5 text-[#1C211B]">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#4E5C4B]/10 pb-4">
            <div>
              <p className="text-xs uppercase tracking-[0.15em] text-[#4E5C4B] font-semibold">
                LÖNESAMTAL &amp; FÖRBEREDELSE
              </p>
              <h2 className="text-lg font-semibold text-[#1C211B] mt-1">
                Lönesamtalsmodul för arbetsgivare &amp; medarbetare
              </h2>
              <p className="text-xs text-[#4E5C4B] mt-0.5">
                Växla roll, redigera förinställda frågor, lägg till egna samtalsfrågor och förbered ett tydligt underlag inför samtalet.
              </p>
            </div>

            <div className="inline-flex rounded-xl bg-[#E8DCC4] p-1 border border-[#4E5C4B]/20">
              <button
                type="button"
                onClick={() => setSalaryRole("employer")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition ${
                  salaryRole === "employer"
                    ? "bg-[#4E5C4B] text-white shadow-xs"
                    : "text-[#1C211B] hover:bg-white/50"
                }`}
              >
                Arbetsgivare / Chef
              </button>
              <button
                type="button"
                onClick={() => setSalaryRole("employee")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition ${
                  salaryRole === "employee"
                    ? "bg-[#4E5C4B] text-white shadow-xs"
                    : "text-[#1C211B] hover:bg-white/50"
                }`}
              >
                Medarbetare
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.1em] text-[#4E5C4B]">
                Frågor &amp; reflektioner — {salaryRole === "employer" ? "Arbetsgivare / Chef" : "Medarbetare"}
              </span>
              <button
                type="button"
                onClick={handleResetSalaryQuestions}
                className="text-xs font-medium text-[#4E5C4B] underline hover:text-[#1C211B]"
              >
                Återställ förinställda frågor
              </button>
            </div>

            {salaryQuestions[salaryRole].map((q, idx) => (
              <div
                key={`${salaryRole}-${idx}`}
                className="rounded-xl border border-[#4E5C4B]/15 bg-white/80 p-3.5 space-y-2"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[#4E5C4B] w-5">{idx + 1}.</span>
                  <input
                    type="text"
                    value={q}
                    onChange={(e) => handleUpdateSalaryQuestion(idx, e.target.value)}
                    aria-label={`Lönesamtalsfråga ${idx + 1}`}
                    className="flex-1 px-3 py-1.5 rounded-lg bg-white border border-[#4E5C4B]/25 text-xs font-medium text-[#1C211B]"
                  />
                  {salaryQuestions[salaryRole].length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveSalaryQuestion(idx)}
                      className="px-2.5 py-1.5 rounded-lg border border-[#C57B57]/40 text-xs text-[#8F3519] hover:bg-[#C57B57]/10"
                    >
                      Ta bort
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={salaryAnswers[salaryRole]?.[idx] || ""}
                  onChange={(e) =>
                    setSalaryAnswers((prev) => ({
                      ...prev,
                      [salaryRole]: {
                        ...(prev[salaryRole] || {}),
                        [idx]: e.target.value,
                      },
                    }))
                  }
                  placeholder={
                    salaryRole === "employer"
                      ? "Anteckning inför lönesamtalet (chefsperspektiv)..."
                      : "Anteckning inför lönesamtalet (medarbetarperspektiv)..."
                  }
                  className="w-full px-3 py-1.5 rounded-lg bg-[#FAF7F0] border border-[#4E5C4B]/20 text-xs text-[#1C211B]"
                />
              </div>
            ))}

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
              <input
                type="text"
                value={newSalaryQuestion}
                onChange={(e) => setNewSalaryQuestion(e.target.value)}
                placeholder={`Lägg till egen fråga för ${salaryRole === "employer" ? "arbetsgivare/chef" : "medarbetare"}...`}
                className="flex-1 px-3.5 py-2 rounded-xl bg-white border border-[#4E5C4B]/25 text-xs text-[#1C211B]"
              />
              <button
                type="button"
                onClick={handleAddSalaryQuestion}
                className="px-4 py-2 rounded-xl bg-[#E8DCC4] border border-[#4E5C4B]/25 text-xs font-medium text-[#1C211B] hover:bg-[#E8DCC4]/80"
              >
                + Lägg till fråga
              </button>
              <button
                type="button"
                onClick={handleGenerateSalarySummary}
                className="px-4 py-2 rounded-xl bg-[#4E5C4B] text-white text-xs font-medium hover:bg-[#3F4B3C] transition"
              >
                Skapa samtalsunderlag
              </button>
            </div>
          </div>

          {salarySummary && (
            <div className="rounded-xl bg-[#F2ECE0] border border-[#4E5C4B]/20 p-4 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.1em] text-[#4E5C4B]">
                  Sammanfattning inför lönesamtal
                </span>
                <button
                  type="button"
                  onClick={handleCopySalarySummary}
                  className="px-3 py-1 rounded-lg bg-white border border-[#4E5C4B]/25 text-xs font-medium text-[#1C211B] hover:bg-[#FAF7F0]"
                >
                  {copiedSalarySummary ? "Kopierad" : "Kopiera underlag"}
                </button>
              </div>
              <pre className="whitespace-pre-wrap text-xs text-[#1C211B] font-sans leading-relaxed">
                {salarySummary}
              </pre>
            </div>
          )}
        </section>

        {/* B2B LEDARSKAPS- & TEAMKOMPASS (FALK BIBLE KAP. 5 – STRIKT K-ANONYMITET) */}
        <section className="mt-8 rounded-2xl border border-[#DFD4BE] bg-[#FAF7F0] p-6 shadow-xs text-[#1C1C1C]">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-[#C57B57]">
                WAYJS B2B • AGGREGERAD TEAMKOMPASS™
              </span>
              <h2 className="text-lg font-bold mt-0.5">
                Ledarskap &amp; Teamriktning (k-anonymiserad översikt)
              </h2>
            </div>
            <span className="text-xs px-3 py-1 rounded-full bg-[#4E5C4B]/15 text-[#4E5C4B] font-medium">
              🔒 Integritetsskyddad (k ≥ 5)
            </span>
          </div>

          <p className="text-sm text-[#4A4740] leading-relaxed mb-5">
            Visar teamets samlade rörelse över de fyra kompassområdena utan att någonsin exponera enskilda medarbetares samtal, journaler eller individuella svar.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            {[
              { area: "Riktning", desc: "Tydlighet i syfte, prioriteringar och gemensam nordstjärna.", focus: "Strategisk klarhet" },
              { area: "Balans", desc: "Hållbart tempo, återhämtning och hantering av arbetsbelastning.", focus: "Hållbar energi" },
              { area: "Handling", desc: "Förmåga att omsätta beslut i konkreta, små steg i vardagen.", focus: "Genomförandekraft" },
              { area: "Reflektion", desc: "Psykologisk trygghet, lärande och perspektivskifte i teamet.", focus: "Lärandekultur" },
            ].map((item) => (
              <div
                key={item.area}
                className="rounded-xl border border-[#DFD4BE] bg-white/80 p-4 flex flex-col justify-between"
              >
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-[#4E5C4B]">
                    {item.area}
                  </div>
                  <p className="text-xs text-[#4A4740] mt-1.5 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-[#EFE7D6] text-[11px] font-medium text-[#C57B57]">
                  Fokus: {item.focus}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl bg-[#F2ECE0] border border-[#DFD4BE] p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="text-xs text-[#3A3730] leading-relaxed">
              <strong>K-anonymitetsgaranti:</strong> Teamindex aktiveras automatiskt först när minst 5 unika teammedlemmar genomfört kompasskalibrering eller veckoreflektion under perioden. Inga rådata kan härledas till individ.
            </div>
            <a
              href="/?session=stora_beslut"
              className="shrink-0 px-4 py-2 rounded-xl bg-[#4E5C4B] hover:bg-[#3F4B3D] text-white text-xs font-medium transition text-center"
            >
              Öppna Ledarskapsreflektion i FALK →
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}
