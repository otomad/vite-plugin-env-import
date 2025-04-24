import { defineConfig } from 'vite'
import { sveltekit } from '@sveltejs/kit/vite'
import { isoImport } from 'vite-plugin-env-import'

export default defineConfig({
  plugins: [sveltekit(), isoImport()]
})
