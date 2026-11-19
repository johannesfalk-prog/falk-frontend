export type UserTier = "guest" | "free" | "premium";

export interface MessageVariant {
  content: string;
  mode: string;
}

export interface AreaBadge {
  name: string;
  score: number;
  compass: string;
}

export interface CalibrationExploreData {
  compassScores: Record<string, number>;
  areaScores: Record<string, number>;
  segment?: 'b2c' | 'b2b';
}

export interface Message {
  areaBadges?: AreaBadge[];
  id: string;
  sender: "user" | "falk";
  content: string;
  timestamp: string;
  variants?: MessageVariant[];
  activeVariantIndex?: number;
  feedback?: "up" | "down" | null;
}

export interface SessionItem {
  id: string;
  title: string;
  date: string;
  created_at: string;
  isPinned: boolean;
  messages: Message[];
}

export interface InsightItem {
  id: string;
  type: "insikt" | "paminnelse";
  content: string;
  source_context?: string;
  session_id?: string;
  reminder_at?: string;
  frequency?: string;
  created_at: string;
}

export interface ReminderItem {
  id: string;
  content: string;
  frequency?: string;
  remind_at?: string;
  reminder_at?: string;
  is_active?: boolean;
  created_at: string;
}

export interface GoalItem {
  id: string;
  title: string;
  area: string;
  progress: number;
  status?: string;
  created_at?: string;
}

export interface FocusSliders {
  Självförtroende: number;
  Stresshantering: number;
  Handlingskraft: number;
  Gränssättning: number;
  Motivation: number;
}

export const DEFAULT_FOCUS: FocusSliders = {
  Självförtroende: 0,
  Stresshantering: 0,
  Handlingskraft: 0,
  Gränssättning: 0,
  Motivation: 0,
};

export const COMPASS_FOUR = [
  {
    key: "Personlig",
    label: "Personlig kompass",
    question: "Hur leder jag mig själv?",
    areas: ["Personlig utveckling", "Spiritualitet"],
  },
  {
    key: "Relation",
    label: "Relationskompass",
    question: "Hur bygger jag starka relationer?",
    areas: ["Intim relation", "Familj"],
  },
  {
    key: "Arbete",
    label: "Arbetskompass",
    question: "Hur skapar jag värde?",
    areas: ["Jobb och karriär", "Finans"],
  },
  {
    key: "Liv",
    label: "Livskompass",
    question: "Hur bygger jag ett hållbart liv?",
    areas: ["Hälsa och träning", "Ägodelar"],
  },
] as const;

export const DEVELOPMENT_AREAS = [
  {
    name: "Hälsa och träning",
    compass: "Liv",
    prompt: "Hur upplever du din fysiska energi, sömn och återhämtning just nu?",
  },
  {
    name: "Jobb och karriär",
    compass: "Arbete",
    prompt: "Hur meningsfull och hållbar känns din arbetssituation?",
  },
  {
    name: "Familj",
    compass: "Relation",
    prompt: "Hur närvarande och balanserad känner du dig i dina familjerelationer?",
  },
  {
    name: "Ägodelar",
    compass: "Liv",
    prompt: "Hur väl stöder din fysiska miljö, tid och struktur ditt lugn?",
  },
  {
    name: "Personlig utveckling",
    compass: "Personlig",
    prompt: "Hur tydlig är din självinsikt, riktning och inre trygghet?",
  },
  {
    name: "Intim relation",
    compass: "Relation",
    prompt: "Hur upplever du närhet, tillit och kommunikation i din närmaste relation?",
  },
  {
    name: "Spiritualitet",
    compass: "Personlig",
    prompt: "Hur stark är din kontakt med mening, stillhet och dina djupaste värderingar?",
  },
  {
    name: "Finans",
    compass: "Arbete",
    prompt: "Hur trygg och medveten känner du dig kring din ekonomiska riktning?",
  },
] as const;

export const ONBOARDING_CARDS = [
  {
    id: 1,
    title: "Mening & livsriktning",
    prompt: "Jag vill förstå vad som verkligen betyder något för mig och leva mer i linje med det.",
    icon: "✨",
  },
  {
    id: 2,
    title: "När tankarna tar över",
    prompt: "Hjälp mig sortera tankarna och hitta klarhet.",
    icon: "💭",
  },
  {
    id: 3,
    title: "Jobb, ansvar & ledarskap",
    prompt: "Hjälp mig hantera utmaningar och hitta nästa steg.",
    icon: "💼",
  },
  {
    id: 4,
    title: "Hitta lugnet igen",
    prompt: "Jag känner mig stressad eller orolig och behöver landa.",
    icon: "🌱",
  },
  {
    id: 5,
    title: "Från mål till handling",
    prompt: "Hjälp mig komma vidare och få saker att hända.",
    icon: "🎯",
  },
  {
    id: 6,
    title: "Relationer & svåra samtal",
    prompt: "Hjälp mig förstå en situation och kommunicera bättre.",
    icon: "💬",
  },
  {
    id: 7,
    title: "Mer energi & balans",
    prompt: "Hjälp mig hitta hållbara vanor för sömn, energi och fokus.",
    icon: "⚡",
  },
  {
    id: 8,
    title: "Förstå mig själv bättre",
    prompt: "Hjälp mig upptäcka mina behov, drivkrafter och mönster.",
    icon: "🔍",
  },
  {
    id: 9,
    title: "Utmana mina tankar",
    prompt: "Hjälp mig se nya perspektiv och ifrågasätta det jag tar för givet.",
    icon: "🧩",
  },
];

export function computeCompassFromAreas(areaScores: Record<string, number>): Record<string, number> {
  const safeVal = (key: string) => {
    const n = Number(areaScores?.[key]);
    return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 50;
  };
  const avg = (a: string, b: string) =>
    Math.round((safeVal(a) + safeVal(b)) / 2);

  return {
    Personlig: avg("Personlig utveckling", "Spiritualitet"),
    Relation: avg("Intim relation", "Familj"),
    Arbete: avg("Jobb och karriär", "Finans"),
    Liv: avg("Hälsa och träning", "Ägodelar"),
    ...areaScores,
  };
}

// ============================================================================
// B2B TILLÄGGSLAGER (Strikt separerat från B2C COMPASS_FOUR & DEVELOPMENT_AREAS)
// ============================================================================

export type B2bCompassKey =
  | 'b2b_self_leadership'
  | 'b2b_team_trust'
  | 'b2b_sustainable_energy'
  | 'b2b_direction_culture';

export type B2bDialogueLevel = 'individ' | 'ledning' | 'foretag';

export interface B2bContextPayload {
  level: B2bDialogueLevel;
  org_name?: string;
  role?: string;
  topic_hint?: string;
  compass_scores?: Record<string, number>;
  compass_averages?: Record<string, number>;
}

export interface B2bCompassMeta {
  key: B2bCompassKey;
  label: string;
  subtitle: string;
  question: string;
}

export const B2B_COMPASS_FOUR: B2bCompassMeta[] = [
  {
    key: 'b2b_self_leadership',
    label: 'Självledarskap',
    subtitle: 'Tydlighet i roll, prioritering och eget ansvar',
    question: 'Hur leder jag mig själv och min arbetsvardag just nu?',
  },
  {
    key: 'b2b_team_trust',
    label: 'Team & Tillit',
    subtitle: 'Psykologisk trygghet, samarbete och kommunikation',
    question: 'Hur fungerar tillit, dialog och samarbete i teamet?',
  },
  {
    key: 'b2b_sustainable_energy',
    label: 'Hållbar Energi',
    subtitle: 'Arbetsbelastning, återhämtning och hållbart tempo',
    question: 'Hur hållbar är min energi och återhämtning i arbetet?',
  },
  {
    key: 'b2b_direction_culture',
    label: 'Riktning & Kultur',
    subtitle: 'Meningsfullhet, värderingar och gemensam kurs',
    question: 'Hur tydlig och meningsfull känns riktningen framåt?',
  },
];

export interface B2bDevelopmentArea {
  name: string;
  compass: B2bCompassKey;
  compassLabel: string;
  categoryHint: 'Ledarskap' | 'Kommunikation' | 'Stresshantering' | 'Effektivisering';
  question: string;
}

export const B2B_DEVELOPMENT_AREAS: B2bDevelopmentArea[] = [
  {
    name: 'Prioritering & fokus',
    compass: 'b2b_self_leadership',
    compassLabel: 'Självledarskap',
    categoryHint: 'Effektivisering',
    question: 'Hur tydligt kan du prioritera det viktigaste i ditt dagliga arbete?',
  },
  {
    name: 'Beslutsmod & ansvar',
    compass: 'b2b_self_leadership',
    compassLabel: 'Självledarskap',
    categoryHint: 'Ledarskap',
    question: 'Hur trygg känner du dig i att fatta beslut och ta ägarskap i din roll?',
  },
  {
    name: 'Svåra samtal & feedback',
    compass: 'b2b_team_trust',
    compassLabel: 'Team & Tillit',
    categoryHint: 'Kommunikation',
    question: 'Hur väl fungerar öppen feedback och svåra samtal med kollegor eller team?',
  },
  {
    name: 'Psykologisk trygghet',
    compass: 'b2b_team_trust',
    compassLabel: 'Team & Tillit',
    categoryHint: 'Ledarskap',
    question: 'Hur tryggt upplever du att det är att lyfta osäkerhet och idéer i gruppen?',
  },
  {
    name: 'Gränssättning & tempo',
    compass: 'b2b_sustainable_energy',
    compassLabel: 'Hållbar Energi',
    categoryHint: 'Stresshantering',
    question: 'Hur väl lyckas du sätta gränser och reglera tempot under intensiva perioder?',
  },
  {
    name: 'Återhämtning i vardagen',
    compass: 'b2b_sustainable_energy',
    compassLabel: 'Hållbar Energi',
    categoryHint: 'Stresshantering',
    question: 'Hur väl får du återhämtning mellan krävande arbetsuppgifter?',
  },
  {
    name: 'Gemensam målbild',
    compass: 'b2b_direction_culture',
    compassLabel: 'Riktning & Kultur',
    categoryHint: 'Effektivisering',
    question: 'Hur tydligt ser du hur ditt arbete bidrar till organisationens riktning?',
  },
  {
    name: 'Värderingsstyrt ledarskap',
    compass: 'b2b_direction_culture',
    compassLabel: 'Riktning & Kultur',
    categoryHint: 'Kommunikation',
    question: 'Hur väl genomsyrar era gemensamma värderingar vardagens beslut?',
  },
];

export function computeB2bCompassFromAreas(
  areaScores: Record<string, number>
): Record<B2bCompassKey, number> {
  const sums: Record<B2bCompassKey, { total: number; count: number }> = {
    b2b_self_leadership: { total: 0, count: 0 },
    b2b_team_trust: { total: 0, count: 0 },
    b2b_sustainable_energy: { total: 0, count: 0 },
    b2b_direction_culture: { total: 0, count: 0 },
  };

  for (const area of B2B_DEVELOPMENT_AREAS) {
    const val = typeof areaScores[area.name] === 'number' ? areaScores[area.name] : 60;
    sums[area.compass].total += val;
    sums[area.compass].count += 1;
  }

  return {
    b2b_self_leadership: Math.round(
      sums.b2b_self_leadership.total / Math.max(1, sums.b2b_self_leadership.count)
    ),
    b2b_team_trust: Math.round(
      sums.b2b_team_trust.total / Math.max(1, sums.b2b_team_trust.count)
    ),
    b2b_sustainable_energy: Math.round(
      sums.b2b_sustainable_energy.total / Math.max(1, sums.b2b_sustainable_energy.count)
    ),
    b2b_direction_culture: Math.round(
      sums.b2b_direction_culture.total / Math.max(1, sums.b2b_direction_culture.count)
    ),
  };
}
