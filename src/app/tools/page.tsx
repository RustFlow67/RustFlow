import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import CfgMergeTool from "@/components/addons/CfgMergeTool";
import MeasurementCompare from "@/components/addons/MeasurementCompare";
import MythQuiz from "@/components/addons/MythQuiz";
import OptimizerLevel from "@/components/addons/OptimizerLevel";
import styles from "@/components/addons/addons.module.css";

export const metadata: Metadata = {
  title: "Мастерская оптимизации",
  description: "Викторина по мифам Rust, локальные достижения и инструменты оптимизатора.",
};

export default function ToolsPage() {
  return <>
    <PageHeader eyebrow="Мастерская · Дополнения" title="Мастерская оптимизации"
      text="Проверьте, что знаете о FPS, и следите за достижениями. Данные остаются в браузере, аккаунт не нужен." />
    <div className={styles.stack}>
      <CfgMergeTool />
      <MeasurementCompare />
      <MythQuiz />
      <OptimizerLevel />
    </div>
  </>;
}
