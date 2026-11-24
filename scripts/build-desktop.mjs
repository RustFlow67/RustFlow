// Build a separate source tree: server-only routes cannot be statically exported.
// The web source and its request-time pages are never modified.
import { cpSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
const root = process.cwd(), stage = path.join(root, '.desktop-build');
rmSync(stage, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });
for (const name of ['src', 'public', 'next.config.ts', 'tsconfig.json', 'postcss.config.mjs', 'package.json', 'next-env.d.ts']) {
  cpSync(path.join(root, name), path.join(stage, name), { recursive: true });
}
symlinkSync(path.join(root, 'node_modules'), path.join(stage, 'node_modules'), 'junction');
for (const route of ['api', 'admin']) rmSync(path.join(stage, 'src/app', route), { recursive: true, force: true });
// Desktop-only UI sources live outside the public web routes.
cpSync(path.join(root, 'desktop-src'), path.join(stage, 'src/app'), { recursive: true, force: true });
// Convert request-time query parsing to client-side parsing. Keep the original
// render bodies so deep links behave the same without a Next server.
for (const name of ['benchmark', 'presets', 'tweaker']) {
  const file = path.join(stage, 'src/app', name, 'page.tsx');
  // Git for Windows commonly checks out CRLF. Normalize before transforming.
  let code = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  code = code.replace(/import type \{ Metadata \} from "next";\n/, '');
  code = code.replace(/export const metadata: Metadata = \{[\s\S]*?\n\};\n/, '');
  if (/export\s+(?:const\s+metadata|(?:async\s+)?function\s+generateMetadata)\b/.test(code)) {
    throw new Error(`Move metadata out of the desktop client page: ${file}`);
  }
  const start = code.indexOf('export default async function ');
  const body = code.indexOf('\n  const ', start);
  if (start < 0 || body < 0) throw new Error(`Unexpected ${name} page structure`);
  const fn = name === 'benchmark' ? 'BenchmarkPage' : name === 'presets' ? 'PresetsPage' : 'TweakerPage';
  code = code.slice(0, start) + `export default function ${fn}() {\n  const query = useSearchParams();\n  const searchParams = Object.fromEntries(query.entries());` + code.slice(body);
  code = code.replace('(await searchParams).open', 'searchParams.open')
    .replace('await searchParams;', 'searchParams;');
  code = '"use client";\nimport { useSearchParams } from "next/navigation";\n' + code;
  // useSearchParams must be below a Suspense boundary during prerendering.
  code = code.replace(`export default function ${fn}()`, `function ${fn}()`);
  code += `\nexport default function Page() { return <Suspense fallback={null}><${fn} /></Suspense>; }\n`;
  code = 'import { Suspense } from "react";\n' + code; // directive must remain first
  code = code.replace('import { Suspense } from "react";\n"use client";', '"use client";\nimport { Suspense } from "react";');
  writeFileSync(file, code);
}
const next = path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next');
const result = spawnSync(process.execPath, [next, 'build', '--webpack'], { cwd: stage, stdio: 'inherit', env: { ...process.env, TAURI_ENV: 'true', NEXT_PUBLIC_IS_DESKTOP_APP: 'true' } });
if (result.status !== 0) process.exit(result.status || 1);
rmSync(path.join(root, 'out'), { recursive: true, force: true });
cpSync(path.join(stage, 'out'), path.join(root, 'out'), { recursive: true });
