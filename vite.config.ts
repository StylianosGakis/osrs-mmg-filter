import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';

const __dirname = import.meta.dirname;

// Both the content script and the MV3 service worker must be self-contained IIFE
// bundles (no ES modules, no code splitting). Rollup's iife format only supports a
// single entry per build, so the two are built in separate passes selected by mode:
//   `vite build`                  -> content script (clears dist)
//   `vite build --mode background` -> service worker (appends to dist)
export default defineConfig(({ mode }) => {
  const isBackground = mode === 'background';
  const entryName = isBackground ? 'background' : 'content';
  const entryFile = isBackground ? 'src/background.ts' : 'src/content.ts';

  return {
    plugins: [svelte()],
    resolve: {
      alias: {
        '$lib': resolve(__dirname, './src/lib'),
      },
    },
    build: {
      outDir: 'dist',
      // Only the first (content) pass clears dist; the background pass appends to it.
      emptyOutDir: !isBackground,
      rollupOptions: {
        input: {
          [entryName]: resolve(__dirname, entryFile),
        },
        output: {
          entryFileNames: '[name].js',
          assetFileNames: '[name].[ext]',
          format: 'iife',
        },
      },
      // Inline CSS into JS for Shadow DOM injection
      cssCodeSplit: false,
    },
  };
});
