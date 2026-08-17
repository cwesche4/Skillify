'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronDown,
  LayoutTemplate,
  Search,
  Sparkles,
  Star,
  X,
} from 'lucide-react'

import { Badge } from '@/components/ui/Badge'
import { type BuilderNodeType, type PlanId } from '@/lib/builder/node-types'
import { getWorkflowNodeRecommendations } from '@/lib/workflows/connectionRules'
import {
  WORKFLOW_DISCOVERY_DOMAIN_LABELS,
  WORKFLOW_DISCOVERY_TYPES,
  discoverWorkflowNodes,
  getWorkflowDiscoveryDomains,
  getWorkflowNodeCardContextLabel,
  groupWorkflowNodeResults,
  isWorkflowNodeSelectable,
  workflowNodeAvailabilityLabel,
  type WorkflowNodeDiscoveryGroup,
  type WorkflowNodeDiscoveryResult,
} from '@/lib/workflows/nodeDiscovery'
import {
  readWorkflowNodeDiscoveryPreferences,
  recordWorkflowNodeRecentUse,
  toggleWorkflowNodeFavorite,
  writeWorkflowNodeDiscoveryPreferences,
  type WorkflowNodeDiscoveryPreferences,
} from '@/lib/workflows/nodeDiscoveryPreferences'
import {
  getBuilderNodeTypeForDefinition,
  isNodeAllowedForPlan,
  workflowNodeRegistry,
} from '@/lib/workflows/nodeRegistry'
import type {
  WorkflowDiscoveryNodeDomain,
  WorkflowDiscoveryNodeType,
  WorkflowNodeDefinition,
} from '@/lib/workflows/types'
import type { Node } from 'reactflow'

type AddNodeModalProps = {
  open: boolean
  plan: PlanId
  sourceLabel?: string
  sourceNode?: Node | null
  initialCategory?: string
  helperText?: string
  preferredNodeIds?: string[]
  insertionContext?: 'before' | 'after' | 'between' | 'branch' | 'disconnected'
  onClose: () => void
  onAddNode: (type: BuilderNodeType, registryNodeId?: string) => void
  onGenerateWithAi?: () => void
  onBrowseTemplates?: () => void
}

type PrimaryTypeFilter = WorkflowDiscoveryNodeType | 'all'
type DomainFilter = WorkflowDiscoveryNodeDomain | 'all'

type RegistryItem = WorkflowNodeDiscoveryResult & {
  builderType: BuilderNodeType
  requiredPlan?: 'Pro' | 'Elite'
}

const COMMON_NODE_IDS = [
  'crm.trigger',
  'task.create',
  'send.email',
  'ai.generate_response',
  'wait.delay',
  'condition.branch',
]

function planLabel(
  required?: 'basic' | 'pro' | 'elite',
): 'Pro' | 'Elite' | undefined {
  if (required === 'elite') return 'Elite'
  if (required === 'pro') return 'Pro'
  return undefined
}

function filtersForInitialCategory(
  initialCategory: string | undefined,
  insertionContext: AddNodeModalProps['insertionContext'],
): { type: PrimaryTypeFilter; domain: DomainFilter } {
  if (initialCategory === 'Scheduling')
    return { type: 'all', domain: 'scheduling' }
  if (initialCategory === 'Triggers') return { type: 'trigger', domain: 'all' }
  if (initialCategory === 'Business / CRM')
    return { type: 'all', domain: 'crm' }
  if (initialCategory === 'Communication')
    return { type: 'communication', domain: 'all' }
  if (initialCategory === 'Logic') return { type: 'condition', domain: 'all' }
  if (initialCategory === 'AI') return { type: 'ai', domain: 'all' }
  if (initialCategory === 'Integrations')
    return { type: 'integration', domain: 'all' }
  if (initialCategory === 'Utilities') return { type: 'utility', domain: 'all' }
  if (initialCategory === 'Organization')
    return { type: 'utility', domain: 'organization' }
  if (insertionContext === 'before') return { type: 'trigger', domain: 'all' }
  return { type: 'all', domain: 'all' }
}

function isPlanOrDiscoverySelectable(item: RegistryItem, plan: PlanId) {
  return (
    isNodeAllowedForPlan(item.node, plan) && isWorkflowNodeSelectable(item.node)
  )
}

function availabilityCopy(node: WorkflowNodeDefinition, plan: PlanId) {
  if (!isNodeAllowedForPlan(node, plan)) {
    const requiredPlan = planLabel(node.planRequirement)
    return {
      label: requiredPlan,
      message: `Upgrade to ${requiredPlan} to add this step.`,
    }
  }
  const label = workflowNodeAvailabilityLabel(node.availability)
  if (!label) return null
  return {
    label,
    message: node.availability?.message ?? label,
  }
}

function contextLabel(type: PrimaryTypeFilter, domain: DomainFilter) {
  const typeLabel =
    WORKFLOW_DISCOVERY_TYPES.find((item) => item.id === type)?.label ?? 'All'
  const typeNoun = typeLabel.toLowerCase()
  const domainLabel =
    domain === 'all' ? 'All Domains' : WORKFLOW_DISCOVERY_DOMAIN_LABELS[domain]
  if (type === 'all' && domain === 'all') return 'Browsing all workflow steps'
  if (type === 'all') return `Browsing ${domainLabel}`
  if (domain === 'all') return `Browsing ${typeNoun}`
  return `Browsing ${domainLabel} ${typeNoun}`
}

function searchContextLabel(
  type: PrimaryTypeFilter,
  domain: DomainFilter,
  query: string,
) {
  const trimmed = query.trim()
  if (trimmed) return `Search results for "${trimmed}"`
  return contextLabel(type, domain)
}

function pluralizeCount(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

const emptyStateActionClass =
  'rounded-full border border-slate-700/90 bg-slate-950/40 px-3 py-1 text-[11px] font-medium text-slate-300 transition-colors duration-150 hover:border-slate-600 hover:bg-slate-900 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/50 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950'

export default function AddNodeModal({
  open,
  plan,
  sourceLabel,
  sourceNode,
  initialCategory,
  helperText,
  preferredNodeIds = [],
  insertionContext = 'disconnected',
  onClose,
  onAddNode,
  onGenerateWithAi,
  onBrowseTemplates,
}: AddNodeModalProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const initialFilters = useMemo(
    () => filtersForInitialCategory(initialCategory, insertionContext),
    [initialCategory, insertionContext],
  )
  const [primaryType, setPrimaryType] = useState<PrimaryTypeFilter>(
    initialFilters.type,
  )
  const [domain, setDomain] = useState<DomainFilter>(initialFilters.domain)
  const [activeIndex, setActiveIndex] = useState(0)
  const [keyboardActive, setKeyboardActive] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [preferences, setPreferences] =
    useState<WorkflowNodeDiscoveryPreferences>({
      favorites: [],
      recent: [],
    })
  const preferredIdSet = useMemo(
    () => new Set(preferredNodeIds),
    [preferredNodeIds],
  )

  const registry = useMemo(() => {
    const isAfterContext =
      insertionContext === 'after' || insertionContext === 'branch'
    const isBeforeContext = insertionContext === 'before'
    const recommended =
      sourceNode && isAfterContext
        ? new Map(
            getWorkflowNodeRecommendations({
              source: sourceNode,
              plan,
              limit: workflowNodeRegistry.length,
            }).map((item) => [item.id, item.score]),
          )
        : null

    return workflowNodeRegistry
      .filter((definition) => {
        if (recommended && !recommended.has(definition.id)) return false
        if (isBeforeContext) return definition.connectionRole === 'trigger'
        if (isAfterContext) return definition.connectionRole !== 'trigger'
        return true
      })
      .sort((a, b) => {
        const scoreDelta =
          (recommended?.get(b.id) ?? 0) - (recommended?.get(a.id) ?? 0)
        if (scoreDelta !== 0) return scoreDelta
        const preferredDelta =
          Number(preferredIdSet.has(b.id)) - Number(preferredIdSet.has(a.id))
        if (preferredDelta !== 0) return preferredDelta
        const commonDelta =
          Number(COMMON_NODE_IDS.includes(b.id)) -
          Number(COMMON_NODE_IDS.includes(a.id))
        if (commonDelta !== 0) return commonDelta
        return a.label.localeCompare(b.label)
      })
  }, [insertionContext, plan, preferredIdSet, sourceNode])

  const domains = useMemo(
    () => getWorkflowDiscoveryDomains(registry),
    [registry],
  )
  const favoriteIds = preferences.favorites
  const recentIds = preferences.recent.map((item) => item.nodeId)

  const discovered = useMemo<RegistryItem[]>(() => {
    return discoverWorkflowNodes(registry, {
      type: primaryType,
      domain,
      query,
      favoriteIds,
      recentIds,
      includeUnavailable: true,
    }).map((result) => ({
      ...result,
      builderType: getBuilderNodeTypeForDefinition(result.node),
      requiredPlan: planLabel(result.node.planRequirement),
    }))
  }, [domain, favoriteIds, primaryType, query, recentIds, registry])

  const searchActive = query.trim().length > 0
  const favoriteResults = !searchActive
    ? discovered
        .filter(
          (item) => item.isFavorite && isPlanOrDiscoverySelectable(item, plan),
        )
        .slice(0, 6)
    : []
  const recentResults = !searchActive
    ? discovered
        .filter(
          (item) =>
            item.recentRank !== undefined &&
            isPlanOrDiscoverySelectable(item, plan),
        )
        .filter(
          (item) =>
            !favoriteResults.some(
              (favorite) => favorite.node.id === item.node.id,
            ),
        )
        .sort((a, b) => (a.recentRank ?? 999) - (b.recentRank ?? 999))
        .slice(0, 5)
    : []
  const reservedIds = new Set([
    ...favoriteResults.map((item) => item.node.id),
    ...recentResults.map((item) => item.node.id),
  ])
  const groupedResults = groupWorkflowNodeResults(
    searchActive
      ? discovered
      : discovered.filter((item) => !reservedIds.has(item.node.id)),
    { type: primaryType, domain },
  )
  const activeGroupKey = groupedResults.map((group) => group.id).join('|')
  const flatSelectable = [
    ...favoriteResults,
    ...recentResults,
    ...groupedResults.flatMap((group) =>
      searchActive || expandedGroups.has(group.id) ? group.items : [],
    ),
  ].filter((item) => isPlanOrDiscoverySelectable(item, plan))

  const persistPreferences = useCallback(
    (next: WorkflowNodeDiscoveryPreferences) => {
      setPreferences(next)
      writeWorkflowNodeDiscoveryPreferences(next)
    },
    [],
  )

  const selectNode = useCallback(
    (item: RegistryItem) => {
      if (!isPlanOrDiscoverySelectable(item, plan)) return
      setKeyboardActive(false)
      const nextPreferences = recordWorkflowNodeRecentUse(
        preferences,
        item.node.id,
      )
      persistPreferences(nextPreferences)
      onAddNode(item.builderType, item.node.id)
    },
    [onAddNode, persistPreferences, plan, preferences],
  )

  const toggleFavorite = useCallback(
    (nodeId: string) => {
      persistPreferences(toggleWorkflowNodeFavorite(preferences, nodeId))
    },
    [persistPreferences, preferences],
  )

  const resetFilters = useCallback(
    (next?: Partial<{ type: PrimaryTypeFilter; domain: DomainFilter }>) => {
      if (next?.type) setPrimaryType(next.type)
      if (next?.domain) setDomain(next.domain)
      setQuery('')
    },
    [],
  )

  useEffect(() => {
    if (!open) return
    const nextFilters = filtersForInitialCategory(
      initialCategory,
      insertionContext,
    )
    setQuery('')
    setPrimaryType(nextFilters.type)
    setDomain(nextFilters.domain)
    setActiveIndex(0)
    setKeyboardActive(false)
    setPreferences(readWorkflowNodeDiscoveryPreferences())
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [initialCategory, insertionContext, open])

  useEffect(() => {
    const activeGroupNames = activeGroupKey ? activeGroupKey.split('|') : []
    if (searchActive) {
      setExpandedGroups(new Set(activeGroupNames))
      return
    }
    setExpandedGroups((previous) => {
      const valid = new Set(
        activeGroupNames.filter((name) => previous.has(name)),
      )
      if (valid.size === 0 && activeGroupNames[0])
        valid.add(activeGroupNames[0])
      return valid
    })
  }, [activeGroupKey, searchActive])

  useEffect(() => {
    setActiveIndex(0)
    setKeyboardActive(false)
    if (typeof scrollRef.current?.scrollTo === 'function') {
      scrollRef.current.scrollTo({ top: 0 })
    } else if (scrollRef.current) {
      scrollRef.current.scrollTop = 0
    }
  }, [domain, primaryType, query])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setKeyboardActive(true)
        setActiveIndex((idx) => Math.min(flatSelectable.length - 1, idx + 1))
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setKeyboardActive(true)
        setActiveIndex((idx) => Math.max(0, idx - 1))
        return
      }
      if (event.key === 'Enter') {
        const item = flatSelectable[activeIndex]
        if (!item) return
        event.preventDefault()
        selectNode(item)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeIndex, flatSelectable, onClose, open, selectNode])

  if (!open) return null

  const renderStepCard = (item: RegistryItem) => {
    const locked = !isPlanOrDiscoverySelectable(item, plan)
    const availability = availabilityCopy(item.node, plan)
    const keyboardSelected =
      keyboardActive && flatSelectable[activeIndex]?.node.id === item.node.id
    const contextLabel = getWorkflowNodeCardContextLabel({
      node: item.node,
      selectedType: primaryType,
      selectedDomain: domain,
      effectiveGroup: item.node.discovery?.group,
    })

    return (
      <div
        key={item.node.id}
        role="button"
        tabIndex={locked ? -1 : 0}
        aria-disabled={locked}
        aria-label={`Add ${item.node.label}`}
        data-keyboard-active={keyboardSelected ? 'true' : 'false'}
        data-node-card-state={
          locked ? 'disabled' : keyboardSelected ? 'keyboard-active' : 'default'
        }
        className={[
          'group rounded-lg border p-3 text-left transition-[background-color,border-color,box-shadow,transform] duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 motion-reduce:transition-none',
          keyboardSelected
            ? 'border-sky-400/55 bg-slate-900/85 shadow-[inset_3px_0_0_rgba(56,189,248,0.7)]'
            : 'border-slate-800/90 bg-slate-900/45',
          locked
            ? 'cursor-not-allowed opacity-65'
            : 'cursor-pointer hover:-translate-y-px hover:border-slate-600/90 hover:bg-slate-900/85 hover:shadow-sm hover:shadow-slate-950/30 active:translate-y-0 active:scale-[0.995] active:border-sky-500/40 active:bg-slate-900 motion-reduce:hover:translate-y-0',
        ].join(' ')}
        onPointerEnter={() => setKeyboardActive(false)}
        onPointerLeave={() => setKeyboardActive(false)}
        onClick={() => selectNode(item)}
        onKeyDown={(event) => {
          if (locked) return
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            event.stopPropagation()
            selectNode(item)
          }
        }}
        title={availability?.message ?? `Add ${item.node.label}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-100 transition-colors duration-150 group-hover:text-white">
              {item.node.label}
            </div>
            {contextLabel && (
              <div className="mt-1 text-[10.5px] font-medium leading-4 text-slate-500">
                {contextLabel}
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {availability && (
              <Badge size="xs" variant={locked ? 'yellow' : 'blue'}>
                {availability.label}
              </Badge>
            )}
            <button
              type="button"
              className={[
                'rounded-md p-1 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/70 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950',
                item.isFavorite
                  ? 'text-amber-300 hover:bg-amber-300/15 hover:text-amber-200'
                  : 'text-slate-500 hover:bg-slate-800/90 hover:text-slate-100',
              ].join(' ')}
              aria-label={
                item.isFavorite
                  ? `Remove ${item.node.label} from favorites`
                  : `Add ${item.node.label} to favorites`
              }
              title={
                item.isFavorite ? 'Remove from favorites' : 'Add to favorites'
              }
              onMouseDown={(event) => event.stopPropagation()}
              onPointerEnter={() => setKeyboardActive(false)}
              onKeyDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                toggleFavorite(item.node.id)
              }}
            >
              <Star
                className="h-3.5 w-3.5"
                fill={item.isFavorite ? 'currentColor' : 'none'}
              />
            </button>
          </div>
        </div>
        {item.node.description && (
          <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-400/90">
            {item.node.description}
          </p>
        )}
        {searchActive && item.score.matchReasons.length > 0 && (
          <p className="mt-2 text-[11px] text-sky-200/70">
            Matched{' '}
            {item.score.matchReasons.slice(0, 2).join(', ').toLowerCase()}
          </p>
        )}
        {locked && availability?.message && (
          <p className="mt-2 text-[11px] text-amber-300">
            {availability.message}
          </p>
        )}
      </div>
    )
  }

  const renderSection = (
    section:
      | WorkflowNodeDiscoveryGroup<RegistryItem>
      | {
          id: string
          group: string
          items: RegistryItem[]
          subgroups: []
        },
    options: { collapsible?: boolean; forceExpanded?: boolean } = {},
  ) => {
    const { id, group: title, items, subgroups } = section
    if (items.length === 0) return null
    const panelId = `add-step-group-${id.replace(/[^a-z0-9_-]+/gi, '-')}`
    const expanded =
      options.forceExpanded || !options.collapsible || expandedGroups.has(id)
    return (
      <section key={id} data-add-step-group={id}>
        <button
          type="button"
          className={[
            'mb-2.5 flex w-full items-center justify-between rounded-lg border px-2.5 py-2 text-left text-xs font-semibold transition-[background-color,border-color,box-shadow,color] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/45 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950',
            expanded
              ? 'border-slate-700/90 bg-slate-900/85 text-slate-100 shadow-[inset_0_-1px_0_rgba(148,163,184,0.18)]'
              : 'border-slate-900/60 bg-slate-950/20 text-slate-300 hover:border-slate-800 hover:bg-slate-900/65 hover:text-slate-100',
          ].join(' ')}
          aria-expanded={expanded}
          aria-controls={panelId}
          aria-label={`${title} ${items.length}`}
          onClick={() => {
            if (!options.collapsible) return
            setExpandedGroups((current) => {
              const next = new Set(current)
              if (next.has(id)) next.delete(id)
              else next.add(id)
              return next
            })
          }}
        >
          <span className="flex min-w-0 items-center gap-2">
            {options.collapsible && (
              <ChevronDown
                className={[
                  'h-4 w-4 shrink-0 text-slate-400 transition-transform duration-150 ease-out',
                  expanded ? 'rotate-180 text-slate-300' : '',
                ].join(' ')}
              />
            )}
            <span className="truncate">{title}</span>
          </span>
          <span className="inline-flex h-5 min-w-8 shrink-0 items-center justify-center rounded-full border border-slate-700/90 bg-slate-950/85 px-2 text-[11px] font-semibold tabular-nums leading-none text-slate-200">
            {items.length}
          </span>
        </button>
        {expanded && (
          <div id={panelId} className="mb-4 space-y-3 pl-0.5">
            {subgroups.length > 1 ? (
              subgroups.map((subgroup) => (
                <div key={subgroup.id} className="space-y-2.5">
                  <div className="px-1 text-[10.5px] font-semibold uppercase leading-4 tracking-[0.025em] text-slate-400/80">
                    {subgroup.label}
                  </div>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {subgroup.items.map(renderStepCard)}
                  </div>
                </div>
              ))
            ) : (
              <div className="grid gap-2.5 sm:grid-cols-2">
                {items.map(renderStepCard)}
              </div>
            )}
          </div>
        )}
      </section>
    )
  }

  const resultCountText = searchActive
    ? pluralizeCount(discovered.length, 'result')
    : pluralizeCount(discovered.length, 'step')

  return (
    <div
      className="fixed inset-0 z-[90] flex items-start justify-center bg-black/55 px-4 py-16 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="flex max-h-[78vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-slate-800/80 bg-slate-950 text-slate-100 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-800/80 p-4">
          <div>
            <h2 className="text-sm font-semibold">Add Step</h2>
            <p className="mt-1 text-xs text-slate-400">
              {helperText ??
                (sourceLabel
                  ? `Choose the next step after ${sourceLabel}.`
                  : 'Search or browse workflow steps.')}
            </p>
          </div>
          <button
            className="rounded-md p-1 text-slate-400 hover:bg-slate-900 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/50"
            onClick={onClose}
            aria-label="Close add node"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="shrink-0 border-b border-slate-800/70 p-4">
          {(onGenerateWithAi || onBrowseTemplates) && (
            <div className="mb-3 grid gap-2 sm:grid-cols-2">
              {onGenerateWithAi && (
                <button
                  type="button"
                  className="bg-cyan-500/12 hover:bg-cyan-500/18 group flex items-center gap-3 rounded-xl border border-cyan-400/35 px-3 py-3 text-left shadow-lg shadow-cyan-950/20 transition hover:border-cyan-300/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
                  onClick={onGenerateWithAi}
                >
                  <span className="bg-cyan-300/12 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-cyan-300/35 text-cyan-100 transition group-hover:border-cyan-200/60">
                    <Sparkles className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-cyan-50">
                      Generate with AI
                    </span>
                    <span className="mt-0.5 block text-[11px] text-cyan-100/70">
                      Draft nodes from a prompt
                    </span>
                  </span>
                </button>
              )}
              {onBrowseTemplates && (
                <button
                  type="button"
                  className="bg-violet-500/12 hover:bg-violet-500/18 group flex items-center gap-3 rounded-xl border border-violet-400/30 px-3 py-3 text-left shadow-lg shadow-violet-950/20 transition hover:border-violet-300/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/45"
                  onClick={onBrowseTemplates}
                >
                  <span className="bg-violet-300/12 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-violet-300/35 text-violet-100 transition group-hover:border-violet-200/60">
                    <LayoutTemplate className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-violet-50">
                      Templates
                    </span>
                    <span className="mt-0.5 block text-[11px] text-violet-100/70">
                      Start from a proven flow
                    </span>
                  </span>
                </button>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2">
            <Search className="h-4 w-4 text-slate-500" />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search triggers, actions, conditions..."
              className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
              aria-describedby="add-step-search-context"
            />
          </div>
          <div
            id="add-step-search-context"
            className="mt-2 flex items-center justify-between gap-3 text-[11px] text-slate-500"
            aria-live="polite"
          >
            <span>{searchContextLabel(primaryType, domain, query)}</span>
            <span>{resultCountText}</span>
          </div>

          <div
            className="mt-3 flex flex-wrap gap-2"
            role="tablist"
            aria-label="Step type filters"
          >
            {WORKFLOW_DISCOVERY_TYPES.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={primaryType === item.id}
                className={[
                  'rounded-full border px-3 py-1 text-[11px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/50',
                  primaryType === item.id
                    ? 'border-sky-500/60 bg-sky-500/10 text-sky-200'
                    : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:text-slate-200',
                ].join(' ')}
                onClick={() => setPrimaryType(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div
            className="mt-2 flex flex-wrap gap-2"
            role="tablist"
            aria-label="Step domain filters"
          >
            {[
              { id: 'all' as const, label: 'All Domains' },
              ...domains.map((item) => ({
                id: item,
                label: WORKFLOW_DISCOVERY_DOMAIN_LABELS[item],
              })),
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={domain === item.id}
                className={[
                  'rounded-full border px-3 py-1 text-[11px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/50',
                  domain === item.id
                    ? 'border-cyan-500/55 bg-cyan-500/10 text-cyan-100'
                    : 'border-slate-800 bg-slate-900/50 text-slate-400 hover:border-slate-700 hover:text-slate-200',
                ].join(' ')}
                onClick={() => setDomain(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div
          ref={scrollRef}
          data-testid="add-step-results-scroll"
          className="min-h-0 flex-1 overflow-y-auto p-3 pb-6 [scrollbar-color:theme(colors.slate.700)_transparent] [scrollbar-width:thin]"
        >
          {discovered.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-800 bg-slate-900/40 p-6 text-center text-sm text-slate-400">
              <div>
                No matching{' '}
                {domain === 'all'
                  ? 'workflow'
                  : WORKFLOW_DISCOVERY_DOMAIN_LABELS[domain].toLowerCase()}{' '}
                {primaryType === 'all'
                  ? 'steps'
                  : WORKFLOW_DISCOVERY_TYPES.find(
                      (item) => item.id === primaryType,
                    )?.label.toLowerCase()}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Try changing the type or domain filters.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {query.trim() && (
                  <button
                    type="button"
                    className={emptyStateActionClass}
                    onClick={() => setQuery('')}
                  >
                    Clear search
                  </button>
                )}
                {primaryType !== 'all' && (
                  <button
                    type="button"
                    className={emptyStateActionClass}
                    onClick={() => resetFilters({ type: 'all' })}
                  >
                    Search all types
                  </button>
                )}
                {domain !== 'all' && (
                  <button
                    type="button"
                    className={emptyStateActionClass}
                    onClick={() => resetFilters({ domain: 'all' })}
                  >
                    Search all domains
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {!searchActive &&
                renderSection(
                  {
                    id: 'favorites',
                    group: 'Favorites',
                    items: favoriteResults,
                    subgroups: [],
                  },
                  { forceExpanded: true },
                )}
              {!searchActive &&
                renderSection(
                  {
                    id: 'recent',
                    group: 'Recent',
                    items: recentResults,
                    subgroups: [],
                  },
                  { forceExpanded: true },
                )}
              {groupedResults.map((group) =>
                renderSection(group, { collapsible: true }),
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
