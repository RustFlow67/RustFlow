import { spawn } from 'node:child_process';
const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const child = spawn(command, ['run', 'dev'], { stdio: 'inherit', env: { ...process.env, NEXT_PUBLIC_IS_DESKTOP_APP: 'true' } });
child.on('exit', code => process.exit(code ?? 1));
