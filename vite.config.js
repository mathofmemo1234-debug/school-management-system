import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Adapt base path:
// - On Vercel or standard root domain: '/'
// - On GitHub Pages (via GitHub Actions): '/<repo-name>/'
const isGitHubPages = Boolean(process.env.GITHUB_ACTIONS && process.env.GITHUB_REPOSITORY && !process.env.VERCEL);
const repoName = isGitHubPages ? process.env.GITHUB_REPOSITORY.split('/')[1] : '';
const basePath = isGitHubPages && repoName ? `/${repoName}/` : '/';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'react/jsx-runtime': path.resolve(__dirname, 'src/safe-jsx-runtime.js'),
      'react/jsx-dev-runtime': path.resolve(__dirname, 'src/safe-jsx-runtime.js')
    }
  },
  base: basePath,
})
