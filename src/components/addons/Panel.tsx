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
    <section id={id} aria-labelledby={`${id}-heading`} className={`glass ${styles.surface} ${styles.panel}`}>
        <header className={styles.heading}>
          <span className={styles.emblem} aria-hidden="true">{icon}</span>
          <div className="min-w-0">
            <p className={`${styles.kicker} rf-enter-text`}>{kicker}</p>
            <h2 id={`${id}-heading`} className={`${styles.title} rf-enter-text`}>{title}</h2>
            {description && <p className={`${styles.intro} rf-enter-text`}>{description}</p>}
          </div>
        </header>
      <div className={styles.content}>{children}</div>
    </section>
  );
}
