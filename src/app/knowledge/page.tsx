import type { Metadata } from "next";
import { DockIntro } from "@/components/DockIntro";
import KnowledgeExplorer from "@/components/KnowledgeExplorer";
export const metadata: Metadata = { title: "Полезные знания", description: "Команды и советы по Rust с оговорками о версиях игры." };
export default function KnowledgePage() { return <><DockIntro href="/knowledge" /><div className="mt-5"><KnowledgeExplorer /></div></>; }
