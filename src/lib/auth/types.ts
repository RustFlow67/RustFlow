import type { BuildInput } from "@/lib/models/build";

export interface PlayerAccount {
  id: string;
  name: string;
  registeredAt?: string; // absent for device profiles created before v12
  kind: "cloud" | "local";
  avatar: string | null;
  build: BuildInput | null;
}

export interface SessionView {
  user: PlayerAccount | null;
  admin: boolean;
  passwordEnabled: boolean;
  googleEnabled: boolean;
  steamEnabled: boolean;
  secureOrigin: boolean;
}
