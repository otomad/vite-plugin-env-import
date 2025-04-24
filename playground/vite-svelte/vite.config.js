import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { isoImport } from 'vite-plugin-env-import'

export default defineConfig({
  plugins: [svelte(), isoImport()]
})
