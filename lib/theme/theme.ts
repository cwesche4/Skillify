export type SkillifyTheme = 'light' | 'dark'

export const SKILLIFY_THEME_STORAGE_KEY = 'skillify.theme'
export const SKILLIFY_THEME_VERSION_KEY = 'skillify.theme.version'
export const SKILLIFY_THEME_VERSION = '2'
export const DEFAULT_SKILLIFY_THEME: SkillifyTheme = 'dark'

type ThemeStorage = Pick<Storage, 'getItem' | 'setItem'>

export function isSkillifyTheme(value: unknown): value is SkillifyTheme {
  return value === 'light' || value === 'dark'
}

export function normalizeStoredSkillifyTheme({
  storedTheme,
  storedVersion,
}: {
  storedTheme: string | null
  storedVersion: string | null
}): SkillifyTheme {
  if (!isSkillifyTheme(storedTheme)) return DEFAULT_SKILLIFY_THEME

  // Before v2, "light" still rendered the dark navy app because the shell and
  // shared primitives were dark-first. Preserve that visual preference once.
  if (storedVersion !== SKILLIFY_THEME_VERSION && storedTheme === 'light') {
    return 'dark'
  }

  return storedTheme
}

export function readSkillifyThemePreference(
  storage: ThemeStorage | null | undefined,
): SkillifyTheme {
  if (!storage) return DEFAULT_SKILLIFY_THEME

  return normalizeStoredSkillifyTheme({
    storedTheme: storage.getItem(SKILLIFY_THEME_STORAGE_KEY),
    storedVersion: storage.getItem(SKILLIFY_THEME_VERSION_KEY),
  })
}

export function persistSkillifyThemePreference(
  storage: ThemeStorage | null | undefined,
  theme: SkillifyTheme,
) {
  if (!storage) return
  storage.setItem(SKILLIFY_THEME_STORAGE_KEY, theme)
  storage.setItem(SKILLIFY_THEME_VERSION_KEY, SKILLIFY_THEME_VERSION)
}

export function applySkillifyThemeToDocument(
  documentElement: HTMLElement,
  theme: SkillifyTheme,
) {
  const isDark = theme === 'dark'
  documentElement.classList.toggle('dark', isDark)
  documentElement.classList.toggle('theme-dark', isDark)
  documentElement.classList.toggle('theme-light', !isDark)
  documentElement.dataset.theme = theme
  documentElement.style.colorScheme = theme
}
