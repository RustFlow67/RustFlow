import LiquidGlass from "@/components/LiquidGlass";
import type { ReactNode } from "react";
import styles from "./addons.module.css";

export default function Panel({ id, kicker, title, description, icon, children }: {
  id: string;
  kicker: string;
  title: string;
  description?: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <LiquidGlass as="section" id={id} aria-labelledby={`${id}-heading`} className={`glass ${styles.surface} ${styles.panel}`}>
        <header className={styles.heading}>
          <span className={styles.emblem} aria-hidden="true">{icon}</span>
          <div className="min-w-0">
            <p className={`rubric ${styles.kicker}`}>{kicker}</p>
            <h2 id={`${id}-heading`} className={styles.title}>{title}</h2>
            {description && <p className={styles.intro}>{description}</p>}
          </div>
        </header>
      <div className={styles.content}>{children}</div>
    </LiquidGlass>
  );
}
