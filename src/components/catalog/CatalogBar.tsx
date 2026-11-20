"use client";
import LiquidGlass from "@/components/LiquidGlass";
import { Search } from "lucide-react";
import { Input } from "../ui";
import LiquidSelect, { type LiquidOption } from "../LiquidSelect";
export default function CatalogBar<T extends string>({
  label,
  query,
  onQuery,
  sort,
  onSort,
  options,
  hint,
}: {
  label: string;
  query: string;
  onQuery: (query: string) => void;
  sort: T;
  onSort: (sort: T) => void;
  options: readonly LiquidOption<T>[];
  hint?: string;
}) {
  return (
    <LiquidGlass as="section" className="glass catalog-bar" aria-label={`Фильтры: ${label}`}>
      <Input
        type="search"
        label={`Поиск: ${label}`}
        value={query}
        placeholder="Название, команда или ключевое слово…"
        onChange={(e) => onQuery(e.target.value)}
        onClear={() => onQuery("")}
        icon={<Search size={16} />}
      />
      <LiquidSelect label={`Сортировка: ${label}`} value={sort} onChange={onSort} options={options} />
      {hint && <p className="catalog-hint">{hint}</p>}
    </LiquidGlass>
  );
}
