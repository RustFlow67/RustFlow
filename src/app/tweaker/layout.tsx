import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Твикер",
  description:
    "Четыре графических профиля Rust и шесть категорий настроек. Соберите свой client.cfg и ZIP с точными шагами и откатом.",
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
