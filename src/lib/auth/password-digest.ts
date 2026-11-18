import { compare, hash } from "bcryptjs";
import { sha256 } from "js-sha256";

// A fixed-size domain-separated input avoids bcrypt's 72-byte truncation of Unicode passwords.
const prehash = (password: string) => sha256(`rustflow:password:v1\0${password}`);
export const hashPassword = (password: string, rounds: number) => hash(prehash(password), rounds);
export const verifyPassword = (password: string, digest: string) => compare(prehash(password), digest);
export const isBcryptDigest = (value: unknown): value is string => typeof value === "string" && /^\$2[aby]\$(?:10|11|12)\$[./A-Za-z0-9]{53}$/.test(value);
