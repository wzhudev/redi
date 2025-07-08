import { defineConfig } from 'rolldown';
import { dts } from 'rolldown-plugin-dts';

export default defineConfig([
  {
    input: 'src/index.ts',
    output: {
      format: 'esm',
      sourcemap: true,
      dir: 'dist',
    },
    plugins: [dts()],
  },
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.js',
      format: 'cjs',
      sourcemap: true,
    },
  },
  {
    input: 'src/react-bindings/index.ts',
    external: ['@wendellhu/redi', 'react', 'react/jsx-runtime'],
    output: {
      format: 'esm',
      dir: 'dist/react-bindings',
      sourcemap: true,
    },
    plugins: [dts()],
  },
  {
    input: 'src/react-bindings/index.ts',
    external: ['@wendellhu/redi', 'react', 'react/jsx-runtime'],
    output: {
      file: 'dist/react-bindings/index.js',
      format: 'cjs',
      sourcemap: true,
    },
  },
]);
