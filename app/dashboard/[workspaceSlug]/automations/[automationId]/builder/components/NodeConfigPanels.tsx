'use client'

import type { ReactNode } from 'react'
import type { Edge, Node } from 'reactflow'
import type {
  NodeConfig,
  NodeConfigField,
  WorkflowNodeDefinition,
} from '@/lib/workflows/types'
import type { NodeValidationResult } from '@/lib/workflows/nodeValidation'
import { RegistryInspectorFields } from './RegistryInspectorFields'
import {
  formatDelayUnit,
  normalizeDelayUnit,
} from '@/lib/workflows/delayConfig'

type NodeConfigPanelProps = {
  definition: WorkflowNodeDefinition | null
  config: NodeConfig
  validation: NodeValidationResult
  onChange: (key: string, value: unknown) => void
  node?: Node | null
  nodes?: Node[]
  edges?: Edge[]
  focusFieldKey?: string | null
  focusFieldKeys?: string[]
  focusRequestId?: number
  onFocusHandled?: () => void
}

function keyForField(field: NodeConfigField) {
  return field.key ?? field.id
}

function getFields(definition: WorkflowNodeDefinition | null, keys: string[]) {
  if (!definition) return []
  const keySet = new Set(keys)
  return definition.configFields.filter(
    (field) => keySet.has(keyForField(field)) || keySet.has(field.id),
  )
}

function hasFields(definition: WorkflowNodeDefinition | null, keys: string[]) {
  return getFields(definition, keys).length > 0
}

function ConfigSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="space-y-3 rounded-xl border border-slate-800/80 bg-slate-950/90 p-3">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          {title}
        </p>
        {description ? (
          <p className="mt-1 text-[11px] text-slate-500">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  )
}

function AdvancedSection({ children }: { children: ReactNode }) {
  return (
    <details className="rounded-xl border border-slate-800/80 bg-slate-950/90">
      <summary className="cursor-pointer px-3 py-2 text-[11px] font-medium text-slate-300">
        Advanced
        <span className="ml-2 rounded-full border border-slate-700 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-slate-500">
          Optional
        </span>
      </summary>
      <div className="space-y-3 border-t border-slate-800/70 p-3">
        {children}
      </div>
    </details>
  )
}

function Fields({
  definition,
  keys,
  config,
  validation,
  onChange,
  node,
  nodes,
  edges,
  focusFieldKey,
  focusFieldKeys,
  focusRequestId,
  onFocusHandled,
}: NodeConfigPanelProps & { keys: string[] }) {
  return (
    <RegistryInspectorFields
      fields={getFields(definition, keys)}
      config={config}
      validation={validation}
      onChange={onChange}
      node={node}
      nodes={nodes}
      edges={edges}
      focusFieldKey={focusFieldKey}
      focusFieldKeys={focusFieldKeys}
      focusRequestId={focusRequestId}
      onFocusHandled={onFocusHandled}
    />
  )
}

function WebhookConfigPanel(props: NodeConfigPanelProps) {
  const advancedKeys = [
    'retryPolicy',
    'timeoutSeconds',
    'authentication',
    'responseParsing',
  ]
  return (
    <div className="space-y-3">
      <ConfigSection
        title="Request"
        description="Configure the outbound request preview."
      >
        <Fields
          {...props}
          keys={[
            'url',
            'method',
            'headers',
            'outputMode',
            'body',
            'fieldMappings',
          ]}
        />
      </ConfigSection>
      {hasFields(props.definition, advancedKeys) ? (
        <AdvancedSection>
          <Fields {...props} keys={advancedKeys} />
        </AdvancedSection>
      ) : null}
    </div>
  )
}

function EmailConfigPanel(props: NodeConfigPanelProps) {
  return (
    <div className="space-y-3">
      <ConfigSection
        title="Message"
        description="Compose the email preview and map recipient data."
      >
        <Fields
          {...props}
          keys={['recipient', 'from', 'cc', 'subject', 'body']}
        />
      </ConfigSection>
      <AdvancedSection>
        <div className="text-[11px] text-slate-500">
          Delivery provider, unsubscribe handling, and tracking settings remain
          preview-only.
        </div>
      </AdvancedSection>
    </div>
  )
}

function SmsConfigPanel(props: NodeConfigPanelProps) {
  return (
    <ConfigSection
      title="Message"
      description="Prepare the SMS preview and map phone data."
    >
      <Fields {...props} keys={['phone', 'message']} />
    </ConfigSection>
  )
}

function CrmActionPanel(props: NodeConfigPanelProps) {
  return (
    <div className="space-y-3">
      <ConfigSection
        title="CRM"
        description="Choose what the future CRM runtime should update."
      >
        <Fields
          {...props}
          keys={[
            'objectType',
            'action',
            'note',
            'health',
            'stage',
            'owner',
            'nextAction',
          ]}
        />
      </ConfigSection>
      <AdvancedSection>
        <div className="text-[11px] text-slate-500">
          Integration credentials and field sync rules will connect in the
          execution phase.
        </div>
      </AdvancedSection>
    </div>
  )
}

function TaskConfigPanel(props: NodeConfigPanelProps) {
  return (
    <div className="space-y-3">
      <ConfigSection
        title="Task"
        description="Define the task that will be created."
      >
        <Fields
          {...props}
          keys={['title', 'description', 'priority', 'status']}
        />
      </ConfigSection>
      <ConfigSection title="Assignment">
        <Fields {...props} keys={['owner', 'dueOffset']} />
      </ConfigSection>
    </div>
  )
}

function ClientUpdatePanel(props: NodeConfigPanelProps) {
  return (
    <ConfigSection
      title="Client"
      description="Choose the client fields this step should update."
    >
      <Fields {...props} keys={['health', 'stage', 'owner', 'nextAction']} />
    </ConfigSection>
  )
}

function AiPromptPanel(props: NodeConfigPanelProps) {
  const advancedKeys = [
    'temperature',
    'topP',
    'frequencyPenalty',
    'presencePenalty',
    'maxTokens',
  ]
  return (
    <div className="space-y-3">
      <ConfigSection
        title="Prompt"
        description="Prompt is the instruction. Variables insert record data into that instruction."
      >
        <Fields
          {...props}
          keys={[
            'prompt',
            'instructions',
            'model',
            'categories',
            'schemaHint',
            'schema',
            'outputMode',
            'confidenceThreshold',
          ]}
        />
      </ConfigSection>
      {hasFields(props.definition, advancedKeys) ? (
        <AdvancedSection>
          <Fields {...props} keys={advancedKeys} />
        </AdvancedSection>
      ) : null}
    </div>
  )
}

function ConditionPanel(props: NodeConfigPanelProps) {
  return (
    <div className="space-y-3">
      <ConfigSection
        title="Branch Logic"
        description="Build the rules that decide which path continues."
      >
        <Fields {...props} keys={['condition', 'conditions']} />
      </ConfigSection>
    </div>
  )
}

function DelayPanel(props: NodeConfigPanelProps) {
  const duration = Number(props.config.duration ?? 5)
  const unit = normalizeDelayUnit(props.config.unit) ?? 'minutes'
  const amount = Number.isFinite(duration) ? duration : 5
  return (
    <ConfigSection
      title="Timing"
      description="Pause the workflow before the next step."
    >
      <div className="flex items-center justify-between rounded-lg border border-slate-800/70 bg-slate-900/45 px-3 py-2 text-[11px] text-slate-300">
        <span>Wait</span>
        <span className="font-semibold text-slate-100">
          {amount} {formatDelayUnit(unit, amount).toLowerCase()}
        </span>
      </div>
      <Fields {...props} keys={['duration', 'unit']} />
    </ConfigSection>
  )
}

export function NodeConfigPanelRenderer(props: NodeConfigPanelProps) {
  const panel = props.definition?.configPanel ?? 'generic'

  if (panel === 'webhook') return <WebhookConfigPanel {...props} />
  if (panel === 'email') return <EmailConfigPanel {...props} />
  if (panel === 'sms') return <SmsConfigPanel {...props} />
  if (panel === 'crm-action') return <CrmActionPanel {...props} />
  if (panel === 'task') return <TaskConfigPanel {...props} />
  if (panel === 'client-update') return <ClientUpdatePanel {...props} />
  if (panel === 'ai-prompt') return <AiPromptPanel {...props} />
  if (panel === 'condition') return <ConditionPanel {...props} />
  if (panel === 'delay') return <DelayPanel {...props} />

  return (
    <RegistryInspectorFields
      fields={props.definition?.configFields ?? []}
      config={props.config}
      validation={props.validation}
      onChange={props.onChange}
      node={props.node}
      nodes={props.nodes}
      edges={props.edges}
      focusFieldKey={props.focusFieldKey}
      focusFieldKeys={props.focusFieldKeys}
      focusRequestId={props.focusRequestId}
      onFocusHandled={props.onFocusHandled}
    />
  )
}
