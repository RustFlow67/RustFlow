import { WINDOWS_TAB_HREF } from "@/lib/tweaker-routes";
import { HARDWARE_PRESETS } from "@/lib/models/preset";
import { TWEAKS_LITE } from "@/lib/tweaks";
import { isSupersededTweak, packEligible, tweakerHref } from "@/lib/tweaker";
import CommandPalette, { type CommandEntry } from "./CommandPalette";
import { ProgressObserver } from "./OptimizerLevel";

const ENTRIES: CommandEntry[] = [
  { href: "/", title: "Главная", kind: "Страница" },
  { href: "/benchmark", title: "Сборка", kind: "Страница", keywords: "оценка ПК CPU GPU FPS" },
  { href: "/tweaker", title: "Твикер", kind: "Страница", keywords: "твики ZIP откат client.cfg" },
  { href: "/presets", title: "Пресеты железа", kind: "Страница" },
  { href: "/faq", title: "Мифы и EAC", kind: "Страница" },
  { href: "/tools", title: "Мастерская оптимизации", kind: "Страница" },
  { href: "/tools#quiz", title: "Миф или правда", kind: "Инструмент", keywords: "квиз викторина" },
  { href: "/tools#level", title: "Уровень оптимизатора", kind: "Инструмент", keywords: "достижения опыт XP" },
  { href: "/guide", title: "С чего начать", kind: "Страница", keywords:"дорожная карта база знаний" },
  {href:WINDOWS_TAB_HREF,title:"Твикер · Система Windows",kind:"Страница"},
  ...TWEAKS_LITE.filter((t) => !isSupersededTweak(t.slug)).map((tweak): CommandEntry => ({
    href: tweakerHref(tweak.slug), title: tweak.title, kind: "Твик", keywords: tweak.tagline,
  })),
  ...HARDWARE_PRESETS.map((preset): CommandEntry => ({
    href: `/presets#preset-${preset.slug}`, title: preset.title, kind: "Пресет", keywords: preset.badge,
  })),
];
const ELIGIBLE = TWEAKS_LITE.filter((tweak) => tweak.riskLevel === "safe" && packEligible(tweak)).map(({ slug }) => slug);

export default function PaletteMount() {
  // Only display/search metadata crosses the server–client boundary, never tweak scripts.
  return <>
    <CommandPalette entries={ENTRIES} />
    <ProgressObserver eligibleSlugs={ELIGIBLE} />
  </>;
}
