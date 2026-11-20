"use client";

import { Clock3 } from "lucide-react";
import type { BuildInput } from "@/lib/models/build";
import {
  changeDrive,
  DRIVES,
  DRIVE_CACHE,
  DRIVE_FILL,
  driveEstimate,
  driveId,
  warmupTime,
} from "@/lib/models/drive";
import Segmented from "./Segmented";
import LiquidSelect from "./LiquidSelect";

type Props = { input: BuildInput; patch: (p: Partial<BuildInput>) => void };
export function DriveDetails({ input, patch }: Props) {
  return (
    <div className="drive-details">
      {" "}
      {input.storage !== "hdd" ? (
        <div>
          <h4>Буфер контроллера</h4>
          <Segmented
            ariaLabel="Буфер контроллера"
            className="w-full"
            options={DRIVE_CACHE.filter((c) => input.storage === "nvme" || c.value !== "hmb")}
            value={input.diskCache ?? "dram"}
            onChange={(diskCache) => patch({ diskCache })}
          />
          <p className="drive-note">
            DRAM хранит таблицу адресов на SSD. HMB использует часть ОЗУ и доступен только для NVMe.
          </p>
        </div>
      ) : (
        <p className="drive-note">
          Для HDD учитывается механический поиск. Режимы DRAM и HMB относятся к контроллерам SSD.
        </p>
      )}
      <div>
        <h4>Заполненность диска</h4>
        <Segmented
          ariaLabel="Заполненность диска"
          presentation="grid"
          className="drive-fill"
          options={DRIVE_FILL}
          value={input.diskFill ?? "normal"}
          onChange={(diskFill) => patch({ diskFill })}
        />
      </div>
      <p className="drive-note">
        Если параметры неизвестны, модель предполагает NVMe 3.0 для неуточнённого NVMe, DRAM для SSD и
        заполненность менее 70%.
      </p>
    </div>
  );
}
export default function DriveControls({ input, patch }: Props) {
  const d = driveEstimate(input);
  return (
    <div className="drive-controls">
      <LiquidSelect
        label="Интерфейс и поколение"
        options={[...DRIVES].reverse()}
        value={driveId(input)}
        onChange={(id) => patch(changeDrive(input, id))}
      />
      <div className="warmup-readout" aria-live="polite">
        <Clock3 size={17} aria-hidden="true" />
        <div>
          <span>Время загрузки карты</span>
          <strong>
            {warmupTime(d.warmupMin)}–{warmupTime(d.warmupMax)} <small>мин:с</small>
          </strong>
          <p>
            Asset Warmup — игра читает и готовит объекты до входа на карту. Это оценка без очереди и
            скачивания. Риск рывков при подгрузке: <b>{d.risk.toLowerCase()}</b>.
          </p>
        </div>
      </div>
    </div>
  );
}
