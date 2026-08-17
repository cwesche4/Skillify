'use client'

import type { FC, KeyboardEvent } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import type { BuilderNodeType } from '@/lib/builder/node-types'
import QuickAddRow from './QuickAddRow'

export type PickerOption = {
  type: BuilderNodeType
  label: string
  category?: string
}

type Props = {
  options: PickerOption[]
  recentTypes?: BuilderNodeType[]
  onSelect: (type: BuilderNodeType) => void
  allowedTypes?: BuilderNodeType[]
  onClose?: () => void
  typeAhead?: string
  onTypeAheadConsumed?: () => void
  patterns?: { id: string; name: string; description?: string }[]
  onSelectPattern?: (id: string) => void
  favoriteTypes?: BuilderNodeType[]
}

export const QuickAddNode: FC<Props> = ({
  options,
  recentTypes = [],
  onSelect,
  allowedTypes,
  patterns = [],
  onSelectPattern,
  favoriteTypes = [],
  onClose,
  typeAhead,
  onTypeAheadConsumed,
}) => {
  const [query, setQuery] = useState('')
  const [highlightIndex, setHighlightIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)

  type SelectableItem = {
    type: BuilderNodeType
    label: string
    category?: string
    source: 'allowed' | 'recent' | 'all' | 'pattern'
    patternId?: string
  }

  const buildCanonicalList = ({
    opts,
    allowed,
    recents,
    q,
    patterns,
    favs,
  }: {
    opts: PickerOption[]
    allowed: BuilderNodeType[] | undefined
    recents: BuilderNodeType[]
    q: string
    patterns?: { id: string; name: string; description?: string }[]
    favs?: BuilderNodeType[]
  }): SelectableItem[] => {
    // Builder-only UX.
    // Canonical list must remain deterministic.
    // Never infer compatibility, execution behavior, or persistence.
    const allowedSet = new Set(allowed ?? [])
    const filtered = opts
      .filter((o) => (allowed ? allowedSet.has(o.type) : true))
      .filter(
        (o) =>
          o.label.toLowerCase().includes(q) || o.type.toLowerCase().includes(q),
      )

    const seen = new Set<BuilderNodeType>()
    const list: SelectableItem[] = []

    const isFav = (t: BuilderNodeType) => (favs ? favs.includes(t) : false)

    filtered.forEach((o) => {
      if (seen.has(o.type)) return
      seen.add(o.type)
      list.push({
        ...o,
        source: 'allowed',
        category: isFav(o.type) ? 'Favorite' : o.category,
      })
    })

    recents.forEach((type) => {
      const found = filtered.find((o) => o.type === type)
      if (!found || seen.has(found.type)) return
      seen.add(found.type)
      list.push({ ...found, source: 'recent' })
    })

    filtered.forEach((o) => {
      if (seen.has(o.type)) return
      seen.add(o.type)
      list.push({ ...o, source: 'all' })
    })

    patterns?.forEach((p) => {
      list.push({
        type: 'pattern' as BuilderNodeType,
        label: p.name,
        category: 'Pattern',
        source: 'pattern',
        patternId: p.id,
      } as SelectableItem & { patternId: string })
    })

    return list
  }

  const canonicalList = useMemo(
    () =>
      buildCanonicalList({
        opts: options,
        allowed: allowedTypes,
        recents: recentTypes,
        q: query.toLowerCase(),
        patterns,
        favs: favoriteTypes,
      }),
    [options, allowedTypes, recentTypes, query, patterns, favoriteTypes],
  )

  useEffect(() => {
    setHighlightIndex(canonicalList.length > 0 ? 0 : -1)
  }, [query, canonicalList.length])

  const selectType = (
    type: BuilderNodeType,
    source?: SelectableItem['source'],
    patternId?: string,
  ) => {
    if (source === 'pattern' && patternId && onSelectPattern) {
      onSelectPattern(patternId)
      onClose?.()
      return
    }
    onSelect(type)
    onClose?.()
  }

  useEffect(() => {
    // Type-ahead creation (builder-only).
    // No inference; uses the same canonical list and selection pipeline.
    if (typeAhead && typeAhead.length > 0) {
      setQuery((prev) => prev + typeAhead)
      inputRef.current?.focus()
      onTypeAheadConsumed?.()
    }
  }, [typeAhead, onTypeAheadConsumed])

  const flatList = canonicalList
  const handleKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIndex((idx) => Math.min(idx + 1, flatList.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIndex((idx) => Math.max(idx - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = flatList[highlightIndex]
      if (item) selectType(item.type)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose?.()
    }
  }

  return (
    <div
      className="w-72 rounded border border-slate-800 bg-slate-950 p-3 text-sm text-slate-100 shadow-xl"
      tabIndex={0}
      onKeyDown={handleKey}
    >
      <div className="mb-2 flex items-center gap-2">
        <Search className="h-4 w-4 text-slate-400" aria-hidden />
        <input
          autoFocus
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search nodes..."
          className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[12px] text-slate-100 outline-none focus:border-slate-500"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && flatList[highlightIndex]) {
              selectType(
                flatList[highlightIndex].type,
                flatList[highlightIndex].source,
                flatList[highlightIndex].patternId,
              )
            }
            if (e.key === 'Escape') {
              e.stopPropagation()
              onClose?.()
            }
          }}
        />
      </div>

      <div className="space-y-2">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-slate-400">
            Allowed / Recent / All (compatible)
          </div>
          <div className="mt-1 max-h-56 space-y-1 overflow-y-auto">
            {canonicalList.length === 0 ? (
              <QuickAddRow
                type={'Unknown' as BuilderNodeType}
                label="No compatible nodes"
                disabled
                onClick={() => {}}
              />
            ) : (
              canonicalList.map((o, idx) => (
                <QuickAddRow
                  key={`${o.source}-${o.type}`}
                  type={o.type}
                  label={o.label}
                  category={o.category ?? o.source}
                  highlighted={idx === highlightIndex}
                  onClick={() => selectType(o.type, o.source, o.patternId)}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default QuickAddNode
