// Build the isolated desktop source tree first; the public web app deliberately
// has no tool routes. Restart this command after changing desktop source files.
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
const root=process.cwd();
const prepared=spawnSync(process.execPath,[path.join(root,'scripts/build-desktop.mjs')],{cwd:root,stdio:'inherit'});
if (prepared.status!==0) process.exit(prepared.status || 1);
const next=path.join(root,'node_modules','next','dist','bin','next');
const child=spawn(process.execPath,[next,'dev','--webpack','--hostname','0.0.0.0','--port','3000'],{cwd:path.join(root,'.desktop-build'),stdio:'inherit',env:{...process.env,NEXT_PUBLIC_IS_DESKTOP_APP:'true'}});
child.on('exit',code=>process.exit(code ?? 1));
