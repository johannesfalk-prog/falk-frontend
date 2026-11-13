export type UserTier = "guest" | "free" | "premium";

export interface MessageVariant {
  content: string;
  mode: string;
}

export interface Message {
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
  const avg = (a: string, b: string) =>
    Math.round(((areaScores[a] ?? 50) + (areaScores[b] ?? 50)) / 2);

  return {
    Personlig: avg("Personlig utveckling", "Spiritualitet"),
    Relation: avg("Intim relation", "Familj"),
    Arbete: avg("Jobb och karriär", "Finans"),
    Liv: avg("Hälsa och träning", "Ägodelar"),
    ...areaScores,
  };
}
