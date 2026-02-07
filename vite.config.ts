
import { defineConfig } from 'vite';

export default defineConfig({
  // base: './' ensures that assets are loaded relative to the index.html,
  // which is critical for GitHub Pages (e.g. username.github.io/repo-name/)
  base: './',
  define: {
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY || ''),
    'process.env': {}
  },
  build: {
    target: 'esnext',
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: './index.html'
      }
    }
  }
});
