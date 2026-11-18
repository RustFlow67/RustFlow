import type { BuildInput } from "@/lib/models/build";

export interface PlayerAccount {
  id: string;
  name: string;
  kind: "cloud" | "local";
  avatar: string | null;
  build: BuildInput | null;
}

export interface SessionView {
  user: PlayerAccount | null;
  admin: boolean;
  googleEnabled: boolean;
  secureOrigin: boolean;
}
