import { pluginFetch } from '@kubb/plugin-fetch';
import { pluginReactQuery } from '@kubb/plugin-react-query';
import { pluginTs } from '@kubb/plugin-ts';
import { pluginZod } from '@kubb/plugin-zod';
import { defineConfig } from 'kubb/config';

export default defineConfig({
  input: '../contracts/dist/openapi.json',
  output: { path: './src/generated/api', clean: true },
  plugins: [
    pluginTs({ output: { path: 'types', barrel: { type: 'named' } } }),
    pluginZod({ output: { path: 'zod', barrel: { type: 'named' } }, inferred: true }),
    pluginFetch({ output: { path: 'clients', barrel: { type: 'named' } }, validator: 'zod' }),
    pluginReactQuery({
      output: { path: 'hooks', barrel: { type: 'named' } },
      client: 'fetch',
      hooks: true,
      query: { methods: ['get'] },
      mutation: { methods: ['post', 'put', 'delete'] },
    }),
  ],
});
