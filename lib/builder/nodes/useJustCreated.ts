import { useEffect } from 'react'

// Inline focus helper.
// Creation-only.
// No inference or execution mutation.
export function useJustCreated(
  justCreated: boolean | undefined,
  onConsume: () => void,
  focusFn: () => void,
) {
  useEffect(() => {
    if (justCreated) {
      focusFn()
      onConsume()
    }
  }, [justCreated, onConsume, focusFn])
}
