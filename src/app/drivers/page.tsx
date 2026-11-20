import type { Metadata } from "next";
import { DockIntro } from "@/components/DockIntro";
import ReadingCatalog from "@/components/catalog/ReadingCatalog";
import { driverGroups } from "@/lib/catalog/reading";
import DriverLibrary from "@/components/DriverLibrary";
export const metadata: Metadata = {
  title: "Драйверы GPU, сети, чипсета и звука",
  description: "Выбор совместимой ветки драйвера по серии, чистая установка и откат.",
};
export default function DriversPage() {
  return (
    <>
      <DockIntro href="/drivers" />
      <DriverLibrary />
      <ReadingCatalog section="guide" label="Статьи о драйверах" groups={driverGroups} />
    </>
  );
}
