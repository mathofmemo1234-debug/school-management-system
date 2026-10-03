import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Automatically adapt base path to the active GitHub repository name
const repoName = process.env.GITHUB_REPOSITORY ? process.env.GITHUB_REPOSITORY.split('/')[1] : 'school-management-system';
const basePath = repoName ? `/${repoName}/` : './';

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
