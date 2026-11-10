import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const win = process.platform === 'win32';
const python = win ? '.venv/Scripts/python.exe' : '.venv/bin/python';

// pnpm передаёт путь своего JS entrypoint: shell и интерпретация аргументов не нужны.
const pnpm = process.env.npm_execpath;

if (!pnpm || !existsSync(pnpm)) {
  console.error('Run tasks through corepack pnpm from the repository root.');
  process.exit(1);
}

const run = (command, args) => {
  const result = spawnSync(command, args, { stdio: 'inherit' });

  if (result.error) {
    console.error(`Cannot start ${command}: ${result.error.code}`);
  }

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
};

const p = (...args) => run(process.execPath, [pnpm, ...args]);
const task = process.argv[2];

if (task === 'bootstrap') {
  run('uv', ['sync', '--locked']);
  p('install', '--frozen-lockfile');
  p('exec', 'lefthook', 'install');
} else if (task === 'codegen') {
  process.env.KUBB_DISABLE_TELEMETRY ??= '1';
  p('--dir', 'contracts', 'build');
  run(python, [
    '-m',
    'datamodel_code_generator',
    '--input',
    'contracts/dist/openapi.json',
    '--input-file-type',
    'openapi',
    '--output',
    'api/app/generated/models.py',
    '--output-model-type',
    'pydantic_v2.BaseModel',
    '--target-python-version',
    '3.12',
    '--disable-timestamp',
    '--formatters',
    'black',
    'isort',
    '--use-standard-collections',
    '--use-union-operator',
    '--strict-types',
    'str',
    'int',
    'float',
    'bool',
  ]);
  p('--dir', 'web', 'codegen');
} else if (task === 'check') {
  p('--dir', 'contracts', 'build');
  run(python, ['-m', 'ruff', 'check', '.']);
  run(python, ['-m', 'ruff', 'format', '--check', '.']);
  run(python, ['-m', 'mypy']);
  run(python, ['-m', 'pytest', '-q', '--cov', '--cov-report=json:.tmp/coverage.json']);
  run(python, ['-m', 'scripts.check_coverage']);
  p('--dir', 'web', 'check');
} else if (task === 'e2e') {
  p('--dir', 'web', 'exec', 'playwright', 'test');
} else if (task === 'dev') {
  if (existsSync('.env')) {
    process.loadEnvFile('.env');
  }

  if (!process.env.PGPASSWORD && process.env.POSTGRES_PASSWORD) {
    process.env.PGPASSWORD = process.env.POSTGRES_PASSWORD;
  }

  const children = [
    spawn(python, ['-m', 'uvicorn', 'api.app.main:app', '--host', '127.0.0.1', '--port', '8000'], {
      stdio: 'inherit',
    }),
    spawn(process.execPath, [pnpm, '--dir', 'web', 'dev'], { stdio: 'inherit' }),
  ];

  const stop = () => {
    for (const child of children) {
      child.kill();
    }
  };

  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);

  for (const child of children) {
    child.on('exit', stop);
  }
} else {
  console.error('Unknown task');
  process.exit(1);
}
