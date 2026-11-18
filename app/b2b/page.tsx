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

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
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
      const email = data?.session?.user?.email || null;
      if (mounted) {
        setSessionEmail(email);
        setAuthChecking(false);
      }
      if (email && mounted) {
        await loadOrganizationData("");
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
      setSessionEmail(email);
      setLoginPassword("");
      await loadOrganizationData(departmentFilter);
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
              <input
                type="password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#4E5C4B]/25 text-sm text-[#1C211B] focus:outline-none focus:border-[#4E5C4B]"
              />
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

          <div className="flex items-center gap-3">
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
                      onChange={(e) => setInviteRole(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[#4E5C4B]/25 text-xs text-[#1C211B]"
                    >
                      <option value="member">Medarbetare / Deltagare</option>
                      <option value="hr_viewer">HR-analytiker (läsbehörighet)</option>
                      <option value="org_admin">Organisationsadministratör</option>
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
                    disabled={creatingInvite}
                    className="w-full py-2.5 px-4 rounded-xl bg-[#C57B57] text-white text-xs font-semibold hover:bg-[#B26B48] transition disabled:opacity-50"
                  >
                    {creatingInvite ? "Skapar kod..." : "Generera inbjudningskod"}
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
                        return (
                          <tr key={m.id} className="hover:bg-white/40">
                            <td className="py-3 pr-4">
                              <p className="font-medium text-[#1C211B]">
                                {m.email || `Användare ${m.user_id.slice(0, 8)}...`}
                              </p>
                              {m.joined_at && (
                                <p className="text-[11px] text-[#4E5C4B]">
                                  Ansluten {new Date(m.joined_at).toLocaleDateString("sv-SE")}
                                </p>
                              )}
                            </td>

                            <td className="py-3 px-4">
                              {isEditing ? (
                                <select
                                  value={editRole}
                                  onChange={(e) => setEditRole(e.target.value)}
                                  className="px-2 py-1 rounded bg-white border border-[#4E5C4B]/30 text-xs"
                                >
                                  <option value="member">Medarbetare / Deltagare</option>
                                  <option value="hr_viewer">HR-analytiker</option>
                                  <option value="org_admin">Organisationsadmin</option>
                                </select>
                              ) : (
                                formatRole(m.role)
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
                                  {isEditing ? (
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
                                      <button
                                        type="button"
                                        disabled={revokingMemberId === m.id}
                                        onClick={() => handleRevokeMember(m)}
                                        className="px-2.5 py-1 rounded border border-[#C57B57]/50 text-[#8F3519] hover:bg-[#C57B57]/15"
                                      >
                                        {revokingMemberId === m.id ? "..." : "Återkalla"}
                                      </button>
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
      </main>
    </div>
  );
}
