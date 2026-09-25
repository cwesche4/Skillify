'use client'

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { Info, X } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type {
  SimpleAutomationDefinition,
  SimpleAutomationInstallationSummary,
  SimpleAutomationReadinessSummary,
  SimpleAutomationSetupField,
} from '@/lib/automations/simpleAutomationCatalog'
import { cn } from '@/lib/utils'

type ConfigurationValue = string | string[] | boolean
type Configuration = Record<string, ConfigurationValue>

const focusableSelector = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function initialConfiguration(
  recipe: SimpleAutomationDefinition,
  saved?: SimpleAutomationInstallationSummary,
) {
  return recipe.setupFields.reduce<Configuration>((values, field) => {
    values[field.id] = saved?.config[field.id] ?? field.defaultValue
    if (field.customInput) {
      values[`${field.id}-custom`] = saved?.config[`${field.id}-custom`] ?? ''
    }
    return values
  }, {})
}

export function SimpleAutomationSetupPanel({
  recipe,
  workspaceId,
  installation,
  canManage,
  onClose,
  onSaved,
  onRemoved,
}: {
  recipe: SimpleAutomationDefinition | null
  workspaceId: string
  installation?: SimpleAutomationInstallationSummary
  canManage: boolean
  onClose: () => void
  onSaved: (
    installation: SimpleAutomationInstallationSummary,
    readiness: SimpleAutomationReadinessSummary,
  ) => void
  onRemoved: (definitionKey: string) => void
}) {
  const [portalReady, setPortalReady] = useState(false)
  const [configuration, setConfiguration] = useState<Configuration>({})
  const [isSaving, setIsSaving] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)
  const [confirmingRemoval, setConfirmingRemoval] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const panelRef = useRef<HTMLElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => setPortalReady(true), [])

  useEffect(() => {
    if (!recipe) return

    setConfiguration(initialConfiguration(recipe, installation))
    setError(null)
    setConfirmingRemoval(false)
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const frame = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus()
    })

    return () => {
      window.cancelAnimationFrame(frame)
      document.body.style.overflow = previousOverflow
      previousFocusRef.current?.focus?.()
    }
  }, [installation, recipe])

  if (!portalReady || !recipe) return null

  const titleId = `simple-automation-${recipe.key}-title`
  const descriptionId = `simple-automation-${recipe.key}-description`

  const setValue = (fieldId: string, value: ConfigurationValue) => {
    setConfiguration((current) => ({ ...current, [fieldId]: value }))
  }

  const endpoint = `/api/workspaces/${encodeURIComponent(
    workspaceId,
  )}/simple-automations/${encodeURIComponent(recipe.key)}`

  const saveConfiguration = async () => {
    if (!canManage) return
    setError(null)
    setIsSaving(true)
    try {
      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: configuration }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload.error ?? 'Configuration could not be saved.')
      }

      onSaved(
        payload.installation as SimpleAutomationInstallationSummary,
        payload.readiness as SimpleAutomationReadinessSummary,
      )
      toast.success(
        installation?.automationStatus === 'ACTIVE'
          ? 'Configuration saved. The automation was paused for review.'
          : 'Configuration saved. Activation availability is shown on the card.',
      )
      onClose()
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Configuration could not be saved.',
      )
    } finally {
      setIsSaving(false)
    }
  }

  const removeSetup = async () => {
    if (!canManage) return
    setError(null)
    setIsRemoving(true)
    try {
      const response = await fetch(endpoint, { method: 'DELETE' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload.error ?? 'Setup could not be removed.')
      }

      onRemoved(recipe.key)
      toast.success('Simple Automation setup removed.')
      onClose()
    } catch (removeError) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : 'Setup could not be removed.',
      )
    } finally {
      setIsRemoving(false)
    }
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }
    if (event.key !== 'Tab') return

    const focusable = Array.from(
      panelRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? [],
    ).filter((element) => element.offsetParent !== null)
    if (!focusable.length) return

    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[90] flex justify-end bg-slate-950/65 backdrop-blur-sm">
      <button
        type="button"
        aria-label={`Close ${recipe.title} setup`}
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />

      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onKeyDown={handleKeyDown}
        className="border-app bg-app-surface relative z-10 flex h-full w-full max-w-xl flex-col border-l shadow-2xl shadow-black/40"
      >
        <header className="border-app flex items-start justify-between gap-4 border-b px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-primary">
              {!canManage
                ? 'View setup'
                : installation
                  ? 'Edit setup'
                  : 'Set up automation'}
            </p>
            <h2
              id={titleId}
              className="text-app-primary mt-1 text-lg font-semibold"
            >
              {recipe.title}
            </h2>
            <p
              id={descriptionId}
              className="text-app-secondary mt-1 text-sm leading-6"
            >
              {recipe.description}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="border-app bg-app-surface-muted text-app-secondary hover:bg-app-surface-hover hover:text-app-primary focus-visible:ring-brand-primary/70 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors focus-visible:outline-none focus-visible:ring-2"
            aria-label={`Close ${recipe.title} setup`}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault()
            void saveConfiguration()
          }}
        >
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6">
            <div className="border-brand-primary/25 bg-brand-primary/10 text-app-secondary flex gap-3 rounded-xl border px-4 py-3 text-sm leading-6">
              <Info
                className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary"
                aria-hidden="true"
              />
              <p>
                {canManage
                  ? installation?.automationStatus === 'ACTIVE'
                    ? 'Saving changes will pause this automation. Review the updated setup, then resume it from the card.'
                    : 'Save your configuration here. Production-ready recipes can then be activated from the card.'
                  : installation?.automationStatus === 'ACTIVE'
                    ? 'This active configuration is read-only for workspace members.'
                    : 'This saved configuration is read-only for workspace members.'}
              </p>
            </div>

            {error ? (
              <div
                role="alert"
                className="rounded-xl border border-rose-500/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
              >
                {error}
              </div>
            ) : null}

            {recipe.setupFields.map((field) => (
              <SetupField
                key={field.id}
                recipeKey={recipe.key}
                field={field}
                value={configuration[field.id] ?? field.defaultValue}
                customValue={String(configuration[`${field.id}-custom`] ?? '')}
                onChange={(value) => setValue(field.id, value)}
                onCustomChange={(value) =>
                  setValue(`${field.id}-custom`, value)
                }
                disabled={!canManage}
              />
            ))}

            {recipe.messagePreview ? (
              <section aria-labelledby={`${recipe.key}-message-preview`}>
                <h3
                  id={`${recipe.key}-message-preview`}
                  className="text-app-primary text-sm font-semibold"
                >
                  Message preview
                </h3>
                <div className="border-app bg-app-surface-muted text-app-secondary mt-2 rounded-xl border p-4 text-sm leading-6">
                  “{recipe.messagePreview}”
                </div>
              </section>
            ) : null}

            {recipe.statusHelpText ? (
              <p className="text-app-muted text-xs leading-5">
                {recipe.statusHelpText}
              </p>
            ) : null}

            {recipe.activationNotice &&
            installation?.automationStatus !== 'ACTIVE' ? (
              <div className="border-app bg-app-surface-muted rounded-xl border px-4 py-3">
                <p className="text-app-primary text-xs font-semibold">
                  When you activate
                </p>
                <p className="text-app-secondary mt-1 text-xs leading-5">
                  {recipe.activationNotice}
                </p>
              </div>
            ) : null}
          </div>

          <footer className="border-app bg-app-surface-raised flex flex-col-reverse gap-2 border-t px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              {installation && canManage ? (
                confirmingRemoval ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-app-muted text-xs">
                      Remove saved setup?
                    </span>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      loading={isRemoving}
                      disabled={isSaving}
                      onClick={() => void removeSetup()}
                    >
                      Remove
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={isRemoving}
                      onClick={() => setConfirmingRemoval(false)}
                    >
                      Keep setup
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isSaving}
                    onClick={() => setConfirmingRemoval(true)}
                  >
                    Remove Setup
                  </Button>
                )
              ) : canManage ? (
                <p className="text-app-muted text-xs">
                  Activation availability is shown on the automation card.
                </p>
              ) : (
                <p className="text-app-muted text-xs">
                  Owner, Admin, or Manager access is required to make changes.
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={isSaving || isRemoving}
                onClick={onClose}
              >
                Close
              </Button>
              {canManage ? (
                <Button type="submit" loading={isSaving} disabled={isRemoving}>
                  Save Configuration
                </Button>
              ) : null}
            </div>
          </footer>
        </form>
      </aside>
    </div>,
    document.body,
  )
}

function SetupField({
  recipeKey,
  field,
  value,
  customValue,
  onChange,
  onCustomChange,
  disabled,
}: {
  recipeKey: string
  field: SimpleAutomationSetupField
  value: ConfigurationValue
  customValue: string
  onChange: (value: ConfigurationValue) => void
  onCustomChange: (value: string) => void
  disabled: boolean
}) {
  const fieldId = `${recipeKey}-${field.id}`

  if (field.control === 'toggle') {
    return (
      <div className="border-app bg-app-surface-muted rounded-xl border p-4">
        <label
          className={cn(
            'flex cursor-pointer items-start gap-3',
            disabled && 'cursor-not-allowed opacity-60',
          )}
          htmlFor={fieldId}
        >
          <input
            id={fieldId}
            type="checkbox"
            checked={Boolean(value)}
            disabled={disabled}
            onChange={(event) => onChange(event.target.checked)}
            className="mt-0.5 h-4 w-4 accent-blue-500"
          />
          <span>
            <span className="text-app-primary block text-sm font-medium">
              {field.label}
            </span>
            {field.helpText ? (
              <span className="text-app-muted mt-1 block text-xs leading-5">
                {field.helpText}
              </span>
            ) : null}
          </span>
        </label>
      </div>
    )
  }

  const selectedValues = Array.isArray(value) ? value : []

  return (
    <fieldset>
      <legend className="text-app-primary text-sm font-semibold">
        {field.label}
      </legend>
      {field.helpText ? (
        <p className="text-app-muted mt-1 text-xs leading-5">
          {field.helpText}
        </p>
      ) : null}
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {field.options?.map((option) => {
          const checked =
            field.control === 'multi-choice'
              ? selectedValues.includes(option.value)
              : value === option.value
          const optionId = `${fieldId}-${option.value}`

          return (
            <label
              key={option.value}
              htmlFor={optionId}
              className={cn(
                'border-app bg-app-surface-raised flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 transition-colors',
                checked && 'border-brand-primary/60 bg-brand-primary/10',
                (disabled || option.disabled) &&
                  'cursor-not-allowed opacity-50',
              )}
            >
              <input
                id={optionId}
                name={fieldId}
                type={field.control === 'multi-choice' ? 'checkbox' : 'radio'}
                value={option.value}
                checked={checked}
                disabled={disabled || option.disabled}
                onChange={() => {
                  if (field.control === 'multi-choice') {
                    onChange(
                      checked
                        ? selectedValues.filter(
                            (selected) => selected !== option.value,
                          )
                        : [...selectedValues, option.value],
                    )
                    return
                  }
                  onChange(option.value)
                }}
                className="mt-0.5 h-4 w-4 accent-blue-500"
              />
              <span className="min-w-0">
                <span className="text-app-primary block text-sm font-medium">
                  {option.label}
                </span>
                {option.helpText ? (
                  <span className="text-app-muted mt-1 block text-xs leading-5">
                    {option.helpText}
                  </span>
                ) : null}
              </span>
            </label>
          )
        })}
      </div>

      {field.customInput && value === field.customInput.whenValue ? (
        <label
          htmlFor={`${fieldId}-custom`}
          className="text-app-primary mt-3 block text-sm font-medium"
        >
          {field.customInput.label}
          <span className="mt-2 flex items-center gap-2">
            <Input
              id={`${fieldId}-custom`}
              type="number"
              min="1"
              inputMode="numeric"
              value={customValue}
              disabled={disabled}
              placeholder={field.customInput.placeholder}
              onChange={(event) => onCustomChange(event.target.value)}
              className="max-w-32"
            />
            {field.customInput.suffix ? (
              <span className="text-app-secondary text-sm">
                {field.customInput.suffix}
              </span>
            ) : null}
          </span>
        </label>
      ) : null}
    </fieldset>
  )
}
