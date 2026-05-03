import { spawnSync } from 'node:child_process';
import path from 'node:path';

const tscPath = path.join('node_modules', '.bin', 'tsc.cmd');
const result = spawnSync(tscPath, ['--noEmit', '--pretty', 'false'], {
  encoding: 'utf8',
  shell: true,
});

process.stdout.write(result.stdout || '');
process.stderr.write(result.stderr || '');
process.exit(result.status || 0);
