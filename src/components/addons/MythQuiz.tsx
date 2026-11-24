"use client";

import { Brain, Check, RotateCcw, Share2, X } from "lucide-react";
import { useState } from "react";
import Link from "@/components/RouteLink";
import { MYTHS } from "@/lib/content";
import { grantAchievements, QUIZ_LENGTH, useProgress } from "@/lib/addons/progress";
import { shareText } from "@/lib/addons/share-text";
import { useToast } from "@/components/ui/Toast";
import { Meter } from "../ui";
import Panel from "./Panel";
import styles from "./addons.module.css";

const QUESTIONS = [
  {
    claim: "Смена DNS уменьшает пинг на сервере в бою.",
    truth: false,
    explanation: MYTHS[2].truth,
  },
  {
    claim: "У двух замеров с одинаковым Avg FPS могут быть разные просадки 1% low.",
    truth: true,
    explanation: "Среднее скрывает отдельные длинные кадры. Смотрите также на 1% low и график времени кадра.",
  },
  {
    claim: "Параметр Arma -maxMem увеличивает доступную Rust память.",
    truth: false,
    explanation: MYTHS[0].truth,
  },
  {
    claim: "Чтобы узнать эффект твика, нужно сравнивать замеры на одном маршруте и менять по одной настройке.",
    truth: true,
    explanation: "Так меньше шансов принять смену сцены, времени суток или нагрузки сервера за прирост FPS.",
  },
  {
    claim: "Ежедневная очистка Prefetch повышает FPS в Rust.",
    truth: false,
    explanation: MYTHS[5].truth,
  },
  {
    claim: "Расчётная оценка FPS для сборки не заменяет собственный замер в игре.",
    truth: true,
    explanation: "Замеры зависят от сцены, настроек и сервера. Оценка нужна для ориентира, а не для обещания кадров.",
  },
] as const satisfies readonly { claim: string; truth: boolean; explanation: string }[] & { length: typeof QUIZ_LENGTH };

export default function MythQuiz() {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<boolean[]>([]);
  const [manual, setManual] = useState("");
  const { quizBest } = useProgress();
  const { toast } = useToast();
  const question = QUESTIONS[index];
  const answer = answers[index];
  const score = answers.filter((value, i) => value === QUESTIONS[i].truth).length;

  function advance() {
    if (answer === undefined) return;
    if (index + 1 === QUESTIONS.length) {
      grantAchievements(score === QUESTIONS.length ? ["quiz", "quiz-perfect"] : ["quiz"], score);
    }
    setIndex(index + 1);
  }

  async function handleShare() {
    const url = new URL("/tools#quiz", window.location.origin).href;
    const text = `«Миф или правда» в SHIFT: ${score}/${QUESTIONS.length} правильных ответов.`;
    const result = await shareText({ title: "Миф или правда · SHIFT", text, url });
    if (result === "done") toast({ title: "Результат готов к отправке" });
    if (result === "manual") setManual(`${text}\n${url}`);
  }

  return (
    <Panel id="quiz" kicker="Проверка знаний" title="Миф или правда" icon={<Brain />}
      description="Шесть утверждений про FPS, сеть и настройки Rust. После ответа покажем объяснение.">
      {question ? (
        <>
          <div className={styles.row}>
            <span className={styles.capsule}>Вопрос {index + 1} из {QUESTIONS.length}</span>
            <span className={styles.pill}>Верно: {score}</span>
          </div>
          <Meter percent={100 * answers.length / QUESTIONS.length} label="Сколько вопросов отвечено" />
          <p className={`${styles.inset} text-base font-bold`} aria-live="polite">{question.claim}</p>
          <div className={styles.actions}>
            <button type="button" className={styles.action} aria-pressed={answer === false} disabled={answer !== undefined}
              onClick={() => setAnswers([...answers, false])}><X aria-hidden="true" />Миф</button>
            <button type="button" className={styles.action} aria-pressed={answer === true} disabled={answer !== undefined}
              onClick={() => setAnswers([...answers, true])}><Check aria-hidden="true" />Правда</button>
            {answer !== undefined && <button type="button" className={`${styles.action} ${styles.primary}`} onClick={advance}>
              {index + 1 === QUESTIONS.length ? "Итог" : "Следующий вопрос"}
            </button>}
          </div>
          <div aria-live="polite">
            {answer !== undefined && (
              <p className={`${styles.feedback} ${answer === question.truth ? styles.success : styles.alert}`}>
                <strong>{answer === question.truth ? "Верно." : `Ответ: ${question.truth ? "правда" : "миф"}.`}</strong>{" "}
                {question.explanation}
              </p>
            )}
          </div>
        </>
      ) : (
        <>
          <div aria-live="polite" className={`${styles.inset} ${styles.spaced}`}>
            <span className={styles.capsule}>Викторина завершена</span>
            <strong className={styles.metric}>{score} из {QUESTIONS.length}</strong>
            <p className={styles.muted}>Личный рекорд: {quizBest ?? score}/{QUESTIONS.length}. Награды — в <Link className={styles.link} href="#level">уровне оптимизатора</Link>.</p>
          </div>
          <div className={styles.actions}>
            <button type="button" className={`${styles.action} ${styles.primary}`} onClick={handleShare}><Share2 aria-hidden="true" />Поделиться результатом</button>
            <button type="button" className={styles.action} onClick={() => { setIndex(0); setAnswers([]); setManual(""); }}>
              <RotateCcw aria-hidden="true" />Пройти ещё раз
            </button>
          </div>
          {manual && <label className={styles.label}>Скопируйте результат вручную
            <textarea readOnly className={styles.input} value={manual} rows={3} onFocus={(event) => event.target.select()} />
          </label>}
        </>
      )}
      <p className={styles.muted}><Link href="/faq" className={styles.link}>К разбору мифов и EAC</Link></p>
    </Panel>
  );
}
