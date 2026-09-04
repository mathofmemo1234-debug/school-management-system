import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Automatically adapt base path to the active GitHub repository name
const repoName = process.env.GITHUB_REPOSITORY ? process.env.GITHUB_REPOSITORY.split('/')[1] : 'school-management-system';
const basePath = repoName ? `/${repoName}/` : './';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: basePath,
})
