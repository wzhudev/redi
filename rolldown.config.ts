import { defineConfig } from 'rolldown';
import { dts } from 'rolldown-plugin-dts';

export default defineConfig([
  {
    input: 'src/index.ts',
    external: ['@wendellhu/redi', 'react', 'react/jsx-runtime', 'rxjs'],
    output: {
      format: 'esm',
      sourcemap: true,
      dir: 'dist/esm',
    },
    plugins: [dts()],
  },
  {
    input: 'src/index.ts',
    external: ['@wendellhu/redi', 'react', 'react/jsx-runtime', 'rxjs'],
    output: {
      file: 'dist/cjs/index.js',
      format: 'cjs',
      sourcemap: true,
    },
  },
  {
    input: 'src/index.ts',
    external: ['@wendellhu/redi', 'react', 'react/jsx-runtime', 'rxjs'],
    output: {
      file: 'dist/umd/index.js',
      format: 'umd',
      name: '@wendellhu/redi',
      sourcemap: true,
    },
  },
  {
    input: 'src/react-bindings/index.ts',
    external: ['@wendellhu/redi', 'react', 'react/jsx-runtime', 'rxjs'],
    output: {
      format: 'es',
      dir: 'dist/esm/react-bindings',
      sourcemap: true,
    },
    plugins: [dts()],
  },
  {
    input: 'src/react-bindings/index.ts',
    external: ['@wendellhu/redi', 'react', 'react/jsx-runtime', 'rxjs'],
    output: {
      file: 'dist/cjs/react-bindings/index.js',
      format: 'cjs',
      sourcemap: true,
    },
  },
  {
    input: 'src/react-bindings/index.ts',
    external: ['@wendellhu/redi', 'react', 'react/jsx-runtime', 'rxjs'],
    output: {
      file: 'dist/umd/react-bindings/index.js',
      format: 'umd',
      name: '@wendellhu/redi/react-bindings',
      sourcemap: true,
      globals: {
        react: 'React',
        'react/jsx-runtime': 'React',
        rxjs: 'rxjs',
        '@wendellhu/redi': '@wendellhu/redi',
      },
    },
  },
]);
