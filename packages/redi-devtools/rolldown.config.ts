import { rmSync } from 'node:fs';
import { defineConfig } from 'rolldown';
import { dts } from 'rolldown-plugin-dts';

rmSync(new URL('./dist', import.meta.url), { force: true, recursive: true });

const external = [
  '@wendellhu/redi',
  '@xyflow/react',
  'react',
  'react-dom/client',
  'react/jsx-runtime',
];

export default defineConfig([
  {
    input: 'src/index.ts',
    external,
    output: {
      dir: 'dist/esm',
      entryFileNames: '[name].js',
      format: 'esm',
      sourcemap: true,
    },
    plugins: [dts({ sourcemap: true })],
  },
  {
    input: 'src/index.ts',
    external,
    output: {
      file: 'dist/cjs/index.cjs',
      format: 'cjs',
      sourcemap: true,
    },
  },
]);
