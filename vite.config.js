import { defineConfig } from 'vite'

export default defineConfig({
  // GitHub Pages serves a project site below its repository name.
  base: process.env.GITHUB_ACTIONS ? '/twenty-four-flavors/' : '/',
})
