const config = {
  '*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}': ['eslint', 'prettier --check'],
  '*.{json,jsonc,md,mdx,yml,yaml,css,scss,html}': 'prettier --check',
}

export default config
