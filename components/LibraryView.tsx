'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Compass,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
} from 'lucide-react';

export interface LibraryCard {
  id: string;
  title: string;
  category: string;
  tag?: string;
  description: string;
  prompt_trigger: string;
}

interface LibraryViewProps {
  backendUrl: string;
  getAuthHeaders: () => Promise<Record<string, string>>;
  darkMode: boolean;
  onStartExercise: (card: LibraryCard) => void;
  onBackToChat: () => void;
}

type SortOption = 'default' | 'title_asc' | 'category_asc';

const CATEGORY_PALETTES = [
  {
    light: "border border-[#C6D6BC] bg-[#E5ECDF] text-[#354732]",
    dark: "border border-[#384B36] bg-[#263325] text-[#A8BFA1]",
  },
  {
    light: "border border-[#E5C4AE] bg-[#F5E4D7] text-[#8A4626]",
    dark: "border border-[#54372B] bg-[#38251D] text-[#E6A382]",
  },
  {
    light: "border border-[#E0BFC4] bg-[#F2E0E2] text-[#7D3842]",
    dark: "border border-[#523338] bg-[#362225] text-[#E2A3AC]",
  },
  {
    light: "border border-[#C2CBE0] bg-[#E2E6F0] text-[#354366]",
    dark: "border border-[#343C54] bg-[#232838] text-[#A9B8E0]",
  },
  {
    light: "border border-[#B8D6D0] bg-[#DCECE9] text-[#28544E]",
    dark: "border border-[#2D4B46] bg-[#1E322F] text-[#94CFC6]",
  },
  {
    light: "border border-[#E0CFA8] bg-[#F3E9D2] text-[#6E5219]",
    dark: "border border-[#4D4129] bg-[#332B1B] text-[#E0C382]",
  },
  {
    light: "border border-[#D1C2E0] bg-[#EAE3F0] text-[#4E3866]",
    dark: "border border-[#413452] bg-[#2B2336] text-[#C5B0E0]",
  },
];

function getCategoryBadgeClasses(category: string, darkMode: boolean): string {
  const key = (category || "").trim().toLowerCase();
  let idx = -1;

  if (/(personlig|självledarskap|identitet|självkänsla|självförtroende)/.test(key)) idx = 0;
  else if (/(arbete|jobb|karriär|ledarskap|fokus|produktivitet|handlingskraft)/.test(key)) idx = 1;
  else if (/(relation|familj|kommunikation|gräns|intim)/.test(key)) idx = 2;
  else if (/(liv|riktning|mening|spiritualitet|kompass|värdering)/.test(key)) idx = 3;
  else if (/(hälsa|träning|stress|återhämtning|lugn|energi|balans)/.test(key)) idx = 4;
  else if (/(finans|ekonomi|ägodelar|beslut|tanke|perspektiv)/.test(key)) idx = 5;
  else if (/(motivation|vana|vanor|utveckling|lärande)/.test(key)) idx = 6;
  else {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
    }
    idx = hash % CATEGORY_PALETTES.length;
  }

  const palette = CATEGORY_PALETTES[idx];
  return darkMode ? palette.dark : palette.light;
}

export default function LibraryView({
  backendUrl,
  getAuthHeaders,
  darkMode,
  onStartExercise,
  onBackToChat,
}: LibraryViewProps) {
  const [cards, setCards] = useState<LibraryCard[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('Alla');
  const [sortBy, setSortBy] = useState<SortOption>('default');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fetchLibrary = async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${backendUrl}/api/library`, { headers });
      if (!res.ok) {
        throw new Error(`Kunde inte hämta biblioteket (${res.status})`);
      }
      const data = await res.json();
      const list: LibraryCard[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.cards)
        ? data.cards
        : [];
      setCards(list);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Ett oväntat fel uppstod vid hämtning av biblioteket.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLibrary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backendUrl]);

  const categories = useMemo(() => {
    const unique = Array.from(
      new Set(
        cards
          .map((c) => (c.category || '').trim())
          .filter((c) => c.length > 0)
      )
    );
    return ['Alla', ...unique];
  }, [cards]);

  const filteredAndSortedCards = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = cards.filter((card) => {
      const matchesCat =
        selectedCategory === 'Alla' ||
        (card.category || '').trim() === selectedCategory;
      if (!matchesCat) return false;
      if (!q) return true;
      return (
        card.title.toLowerCase().includes(q) ||
        card.description.toLowerCase().includes(q) ||
        (card.category || '').toLowerCase().includes(q) ||
        (card.tag || '').toLowerCase().includes(q)
      );
    });

    if (sortBy === 'title_asc') {
      return [...filtered].sort((a, b) => a.title.localeCompare(b.title, 'sv'));
    }
    if (sortBy === 'category_asc') {
      return [...filtered].sort((a, b) => {
        const catCmp = (a.category || '').localeCompare(b.category || '', 'sv');
        return catCmp !== 0 ? catCmp : a.title.localeCompare(b.title, 'sv');
      });
    }
    return filtered;
  }, [cards, selectedCategory, sortBy, searchQuery]);

  return (
    <div
      className={`flex-1 overflow-y-auto px-4 py-6 sm:px-8 ${
        darkMode ? 'bg-[#171A17] text-[#F2EDE4]' : 'bg-[#E8DCC4] text-[#1F241E]'
      }`}
    >
      <div className="mx-auto max-w-5xl space-y-6 pb-12">
        {/* Toppnavigation & Rubrik */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <button
              type="button"
              onClick={onBackToChat}
              className={`mb-2 inline-flex items-center gap-1.5 text-xs font-medium transition ${
                darkMode
                  ? 'text-[#A8BFA1] hover:text-white'
                  : 'text-[#4E5C4B] hover:text-[#1F241E]'
              }`}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Tillbaka till samtalet
            </button>
            <div className="flex items-center gap-2.5">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                  darkMode
                    ? 'bg-[#252B24] text-[#A8BFA1]'
                    : 'bg-[#4E5C4B] text-[#F7F3EA]'
                }`}
              >
                <BookOpen className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                  Övningsbiblioteket
                </h1>
                <p
                  className={`text-xs sm:text-sm ${
                    darkMode ? 'text-[#B8B2A6]' : 'text-[#4E5C4B]'
                  }`}
                >
                  {cards.length > 0
                    ? `${cards.length} guidade övningar för reflektion, riktning och självledarskap`
                    : 'Guidade övningar för reflektion, riktning och självledarskap'}
                </p>
              </div>
            </div>
          </div>

          {/* Sök & Sortering */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <Search
                className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${
                  darkMode ? 'text-[#8E968C]' : 'text-[#6B675E]'
                }`}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Sök övning eller tema..."
                className={`w-full rounded-xl border py-2 pl-9 pr-3 text-sm outline-none transition sm:w-56 ${
                  darkMode
                    ? 'border-[#333A32] bg-[#212620] text-[#F2EDE4] placeholder-[#7F877D] focus:border-[#A8BFA1]'
                    : 'border-[#D5C7AC] bg-[#F7F3EA] text-[#1F241E] placeholder-[#7C7568] focus:border-[#4E5C4B]'
                }`}
              />
            </div>

            <div className="relative flex items-center">
              <Filter
                className={`pointer-events-none absolute left-3 h-3.5 w-3.5 ${
                  darkMode ? 'text-[#A8BFA1]' : 'text-[#4E5C4B]'
                }`}
              />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                aria-label="Sortera övningar"
                className={`w-full appearance-none rounded-xl border py-2 pl-8 pr-7 text-sm outline-none transition sm:w-auto ${
                  darkMode
                    ? 'border-[#333A32] bg-[#212620] text-[#F2EDE4] focus:border-[#A8BFA1]'
                    : 'border-[#D5C7AC] bg-[#F7F3EA] text-[#1F241E] focus:border-[#4E5C4B]'
                }`}
              >
                <option value="default">Rekommenderad ordning</option>
                <option value="category_asc">Sortera efter område</option>
                <option value="title_asc">Sortera A–Ö</option>
              </select>
            </div>
          </div>
        </div>

        {/* Kategorifilter (Chips) */}
        {categories.length > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            {categories.map((category) => {
              const active = selectedCategory === category;
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => setSelectedCategory(category)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                    active
                      ? 'bg-[#4E5C4B] text-[#F7F3EA] shadow-sm'
                      : darkMode
                      ? 'border border-[#333A32] bg-[#212620] text-[#CFC9BC] hover:border-[#A8BFA1]'
                      : 'border border-[#D5C7AC] bg-[#F7F3EA]/80 text-[#3B4239] hover:border-[#4E5C4B] hover:bg-[#F7F3EA]'
                  }`}
                >
                  {category}
                </button>
              );
            })}
          </div>
        )}

        {/* Innehåll: Laddning / Fel / Grid med 15 kort */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Loader2
              className={`h-7 w-7 animate-spin ${
                darkMode ? 'text-[#A8BFA1]' : 'text-[#4E5C4B]'
              }`}
            />
            <p
              className={`mt-3 text-sm ${
                darkMode ? 'text-[#B8B2A6]' : 'text-[#4E5C4B]'
              }`}
            >
              Laddar övningskorten...
            </p>
          </div>
        ) : error ? (
          <div
            className={`rounded-2xl border p-6 text-center ${
              darkMode
                ? 'border-[#4A322B] bg-[#251E1B] text-[#F2EDE4]'
                : 'border-[#D8B4A0] bg-[#FBF6F2] text-[#1F241E]'
            }`}
          >
            <p className="text-sm font-medium">{error}</p>
            <button
              type="button"
              onClick={fetchLibrary}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#C57B57] px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Försök igen
            </button>
          </div>
        ) : filteredAndSortedCards.length === 0 ? (
          <div
            className={`rounded-2xl border p-8 text-center ${
              darkMode
                ? 'border-[#333A32] bg-[#212620] text-[#B8B2A6]'
                : 'border-[#D5C7AC] bg-[#F7F3EA] text-[#4E5C4B]'
            }`}
          >
            <Compass className="mx-auto mb-2 h-6 w-6 opacity-70" />
            <p className="text-sm font-medium">
              Inga övningar matchade ditt filter.
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('Alla');
                setSearchQuery('');
              }}
              className="mt-3 text-xs font-semibold text-[#C57B57] underline"
            >
              Återställ filter
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredAndSortedCards.map((card) => (
              <div
                key={card.id}
                onClick={() => onStartExercise(card)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onStartExercise(card);
                  }
                }}
                className={`group flex cursor-pointer flex-col justify-between rounded-2xl border p-5 transition duration-200 ${
                  darkMode
                    ? 'border-[#333A32] bg-[#212620] hover:border-[#A8BFA1] hover:bg-[#262C25]'
                    : 'border-[#D5C7AC] bg-[#F7F3EA] shadow-sm hover:-translate-y-0.5 hover:border-[#4E5C4B] hover:shadow-md'
                }`}
              >
                <div>
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${getCategoryBadgeClasses(
                        card.category,
                        darkMode
                      )}`}
                    >
                      <Sparkles className="h-3 w-3" />
                      {card.category}
                    </span>
                    {card.tag && (
                      <span
                        className={`text-[11px] font-medium ${
                          darkMode ? 'text-[#8E968C]' : 'text-[#7C7568]'
                        }`}
                      >
                        {card.tag}
                      </span>
                    )}
                  </div>

                  <h2 className="text-base font-semibold leading-snug">
                    {card.title}
                  </h2>
                  <p
                    className={`mt-2 text-xs leading-relaxed sm:text-sm ${
                      darkMode ? 'text-[#B8B2A6]' : 'text-[#4E5C4B]'
                    }`}
                  >
                    {card.description}
                  </p>
                </div>

                <div
                  className={`mt-5 flex items-center justify-between border-t pt-3 text-xs font-semibold ${
                    darkMode
                      ? 'border-[#333A32] text-[#C57B57]'
                      : 'border-[#E6DCC8] text-[#C57B57]'
                  }`}
                >
                  <span>Starta övning med FALK</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
