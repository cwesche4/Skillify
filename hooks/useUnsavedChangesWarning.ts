'use client'

import { useEffect } from 'react'

const MESSAGE = 'You have unsaved changes. Leave without saving?'
let activeWarningCount = 0
let cleanupGlobalListeners: (() => void) | null = null

function attachGlobalListeners() {
  const onBeforeUnload = (event: BeforeUnloadEvent) => {
    event.preventDefault()
    event.returnValue = MESSAGE
    return MESSAGE
  }

  const onClick = (event: MouseEvent) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return
    }
    const target = event.target
    if (!(target instanceof Element)) return
    const anchor = target.closest('a[href]')
    if (!(anchor instanceof HTMLAnchorElement)) return
    if (anchor.target || anchor.hasAttribute('download')) return
    const href = anchor.getAttribute('href')
    if (!href || href.startsWith('#')) return
    const nextUrl = new URL(anchor.href, window.location.href)
    if (
      nextUrl.pathname === window.location.pathname &&
      nextUrl.search === window.location.search &&
      nextUrl.hash !== window.location.hash
    ) {
      return
    }
    if (!window.confirm(MESSAGE)) {
      event.preventDefault()
      event.stopPropagation()
    }
  }

  window.addEventListener('beforeunload', onBeforeUnload)
  document.addEventListener('click', onClick, true)
  return () => {
    window.removeEventListener('beforeunload', onBeforeUnload)
    document.removeEventListener('click', onClick, true)
  }
}

export function useUnsavedChangesWarning(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    activeWarningCount += 1
    if (!cleanupGlobalListeners) {
      cleanupGlobalListeners = attachGlobalListeners()
    }
    return () => {
      activeWarningCount = Math.max(0, activeWarningCount - 1)
      if (activeWarningCount === 0) {
        cleanupGlobalListeners?.()
        cleanupGlobalListeners = null
      }
    }
  }, [enabled])
}
