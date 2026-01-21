import { defineConfig } from 'vite';
import { copyFileSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';

export default defineConfig({
  base: './',
  server: {
    port: 5173,
    open: true,
    strictPort: true
  },
  optimizeDeps: {
    exclude: ['pkg']
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  },
  plugins: [
    {
      name: 'copy-questions',
      closeBundle() {
        const questionsDir = 'questions';
        const distQuestionsDir = 'dist/questions';
        
        try {
          mkdirSync(distQuestionsDir, { recursive: true });
          const files = readdirSync(questionsDir).filter(f => f.endsWith('.json'));
          files.forEach(file => {
            copyFileSync(join(questionsDir, file), join(distQuestionsDir, file));
          });
          console.log(`✓ Copied ${files.length} question sets to dist/questions/`);
        } catch (err) {
          console.error('Error copying questions:', err);
        }
      }
    }
  ]
});
