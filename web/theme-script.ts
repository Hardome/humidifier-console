import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ModuleKind, ScriptTarget, transpileModule } from 'typescript';
import type { Plugin } from 'vite';

export function themeScript(): Plugin {
  const filename = fileURLToPath(new URL('./src/app/theme-init.ts', import.meta.url));

  const compile = () =>
    transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: {
        target: ScriptTarget.ES2022,
        module: ModuleKind.None,
      },
    }).outputText;

  return {
    name: 'theme-script',
    buildStart() {
      this.addWatchFile(filename);
    },
    configureServer(server) {
      server.middlewares.use('/theme.js', (_request, response) => {
        response.setHeader('Content-Type', 'application/javascript');
        response.end(compile());
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'theme.js', source: compile() });
    },
    transformIndexHtml: {
      order: 'post',
      handler() {
        return [{ tag: 'script', attrs: { src: '/theme.js' }, injectTo: 'head-prepend' }];
      },
    },
  };
}
