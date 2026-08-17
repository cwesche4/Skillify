import React from 'react'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { WorkspaceSetup } from '@/components/workspaces/WorkspaceSetup'
import { SetupStatusBadge } from '@/components/workspaces/SetupStatusBadge'
import type { LeadIntakeSourceCard } from '@/lib/integrations/leadIntake'
import {
  getWorkspaceSetupStorageKey,
  getWorkspaceSetupSummary,
  normalizeWorkspaceSetupProgress,
  workspaceSetupSteps,
} from '@/lib/workspaces/workspaceSetup'

const navigationMocks = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => window.location.pathname,
  useRouter: () => ({
    replace: navigationMocks.replace,
    refresh: navigationMocks.refresh,
  }),
  useSearchParams: () => new URLSearchParams(window.location.search),
}))

function renderSetup(
  props: Partial<React.ComponentProps<typeof WorkspaceSetup>> = {},
) {
  return render(
    React.createElement(WorkspaceSetup, {
      workspaceId: 'workspace-1',
      workspaceSlug: 'acme',
      workspaceName: 'Acme Services',
      leadIntakeSources: leadIntakeCards,
      ...props,
    }),
  )
}

const leadIntakeCards: LeadIntakeSourceCard[] = [
  {
    id: 'manualEntry',
    title: 'Manual Entry',
    description:
      'Manual leads already enter Skillify through the CRM lead creation flow.',
    status: 'ready',
    statusLabel: 'Ready',
    summary:
      'Manual lead creation is available from the Leads page and can be selected as the fallback intake method.',
    action: { label: 'Use Manual Entry', kind: 'selectManual' },
    providerId: 'none',
  },
  {
    id: 'hubspot',
    title: 'HubSpot',
    description:
      'HubSpot leads and contacts should enter Skillify through the shared intake contract.',
    status: 'configurationRequired',
    statusLabel: 'Configuration Required',
    summary: 'HubSpot requires Skillify deployment configuration.',
    providerId: 'hubspot',
  },
  {
    id: 'googleAdsLeadForms',
    title: 'Google Ads Lead Forms',
    description: 'Google Ads lead forms are planned for a later phase.',
    status: 'comingSoon',
    statusLabel: 'Coming Soon',
    summary: 'Google Ads lead forms are planned for a later phase.',
    providerId: 'googleAds',
  },
]

describe('workspace setup guidance', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.history.replaceState(null, '', '/dashboard/acme')
    navigationMocks.replace.mockReset()
    navigationMocks.refresh.mockReset()
    vi.restoreAllMocks()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    } as Response)
  })

  it('uses the complete guided setup order and title case', () => {
    expect(workspaceSetupSteps.map((step) => step.title)).toEqual([
      'Business Information',
      'Working Hours',
      'Members and Roles',
      'Teams and Business Locations',
      'Calendar Connections',
      'Workspace AI',
      'Website and Lead Intake',
      'Notifications',
      'Review and Finish',
    ])
  })

  it('normalizes progress and tracks required completion separately from optional setup', () => {
    const progress = normalizeWorkspaceSetupProgress({
      business: 'complete',
      calendars: 'actionRequired',
      unknown: 'complete',
    })
    const summary = getWorkspaceSetupSummary(progress)

    expect(progress.business).toBe('complete')
    expect(progress.calendars).toBe('actionRequired')
    expect(summary.completed).toBe(1)
    expect(summary.requiredComplete).toBe(false)
  })

  it('uses one consistent setup status badge layout', () => {
    render(
      React.createElement('div', {}, [
        React.createElement(SetupStatusBadge, {
          key: 'complete',
          status: 'complete',
        }),
        React.createElement(SetupStatusBadge, {
          key: 'notStarted',
          status: 'notStarted',
        }),
        React.createElement(SetupStatusBadge, {
          key: 'actionRequired',
          status: 'actionRequired',
        }),
      ]),
    )

    for (const label of ['Complete', 'Not Started', 'Action Required']) {
      expect(screen.getByLabelText(label).className).toContain('h-6')
      expect(screen.getByLabelText(label).className).toContain(
        'min-w-[6.75rem]',
      )
      expect(screen.getByLabelText(label).className).toContain(
        'whitespace-nowrap',
      )
    }
  })

  it('shows where every setup step lives later', async () => {
    const user = userEvent.setup()
    renderSetup()

    await user.click(screen.getByRole('button', { name: /continue setup/i }))
    const dialog = screen.getByRole('dialog', { name: /business information/i })

    expect(
      within(dialog).getByText(/You can update this anytime in/i),
    ).toBeTruthy()
    expect(
      within(dialog)
        .getByRole('link', { name: workspaceSetupSteps[0].laterLabel })
        .getAttribute('href'),
    ).toBe('/dashboard/acme/settings')
  })

  it('renders a compact dashboard setup banner without the old step-card grid', () => {
    renderSetup()

    expect(
      screen.getByRole('heading', { name: /workspace setup required/i }),
    ).toBeTruthy()
    expect(screen.getByText(/0 of 9 complete/i)).toBeTruthy()
    expect(screen.queryByText(/Find this later in/i)).toBeNull()
    expect(
      screen
        .getByRole('link', { name: /review readiness/i })
        .getAttribute('href'),
    ).toBe('/dashboard/acme/settings/setup')
  })

  it('initializes Business Type from the workspace Industry field', async () => {
    const user = userEvent.setup()
    renderSetup({ initialBusinessType: 'Lawn services' })

    await waitFor(() => {
      expect(screen.getByText(/1 of 9 complete/i)).toBeTruthy()
    })
    await user.click(screen.getByRole('button', { name: /continue setup/i }))
    await user.click(
      screen.getByRole('button', { name: /Business Information/i }),
    )

    expect(
      (screen.getByLabelText(/Business type/i) as HTMLInputElement).value,
    ).toBe('Lawn services')
  })

  it('opens the shared setup modal at the first blocking required step from the dashboard banner', async () => {
    const user = userEvent.setup()
    renderSetup()

    await user.click(screen.getByRole('button', { name: /continue setup/i }))

    expect(
      screen.getByRole('dialog', { name: /business information/i }),
    ).toBeTruthy()
  })

  it('opens a deep-linked setup step without rendering the dashboard launcher', () => {
    window.history.replaceState(
      null,
      '',
      '/dashboard/acme/settings/setup?setup=1&setupStep=notifications',
    )

    render(
      React.createElement(WorkspaceSetup, {
        workspaceId: 'workspace-1',
        workspaceSlug: 'acme',
        workspaceName: 'Acme Services',
        showLauncher: false,
      }),
    )

    expect(
      screen.queryByRole('heading', { name: /^workspace setup$/i }),
    ).toBeNull()
    expect(screen.getByRole('dialog', { name: /notifications/i })).toBeTruthy()
  })

  it('saves, skips optional steps, goes back, and persists workspace-scoped progress in the new order', async () => {
    const user = userEvent.setup()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    } as Response)
    renderSetup()

    await user.click(screen.getByRole('button', { name: /continue setup/i }))
    await user.click(screen.getByRole('button', { name: /save and continue/i }))

    expect(screen.getByRole('dialog', { name: /working hours/i })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /skip for now/i }))
    expect(
      screen.getByRole('dialog', { name: /members and roles/i }),
    ).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /back/i }))
    expect(screen.getByRole('dialog', { name: /working hours/i })).toBeTruthy()

    const stored = JSON.parse(
      window.localStorage.getItem(getWorkspaceSetupStorageKey('acme')) ?? '{}',
    )
    expect(stored.business).toBe('complete')
    expect(stored.workingHours).toBe('skipped')
  })

  it('does not allow a required step to be falsely completed', async () => {
    const user = userEvent.setup()
    render(
      React.createElement(WorkspaceSetup, {
        workspaceId: 'workspace-1',
        workspaceSlug: 'acme',
        workspaceName: '',
      }),
    )

    await user.click(screen.getByRole('button', { name: /continue setup/i }))
    await user.click(screen.getByRole('button', { name: /save and continue/i }))

    expect(
      screen.getByText(/Enter a business or workspace name before continuing/i),
    ).toBeTruthy()
    const stored = JSON.parse(
      window.localStorage.getItem(getWorkspaceSetupStorageKey('acme')) ?? '{}',
    )
    expect(stored.business).not.toBe('complete')
  })

  it('stages repeatable invitations and does not send them before Finish Setup', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    } as Response)
    renderSetup()

    await user.click(screen.getByRole('button', { name: /continue setup/i }))
    await user.click(screen.getByRole('button', { name: /save and continue/i }))
    await user.click(screen.getByRole('button', { name: /skip for now/i }))

    await user.type(
      screen.getByLabelText(/Teammate email/i),
      'employee1@example.com',
    )
    expect(screen.getAllByLabelText(/Teammate email/i)).toHaveLength(2)
    await user.type(
      screen.getAllByLabelText(/Teammate email/i)[1],
      'employee2@example.com',
    )
    expect(screen.getAllByLabelText(/Teammate email/i)).toHaveLength(3)

    await user.click(screen.getByRole('button', { name: /save and continue/i }))
    expect(fetchMock).not.toHaveBeenCalledWith(
      '/api/workspaces/workspace-1/invite',
      expect.anything(),
    )
    expect(
      window.localStorage.getItem(
        `${getWorkspaceSetupStorageKey('acme')}:draft`,
      ),
    ).not.toContain('employee1@example.com')

    await user.click(screen.getByRole('button', { name: /skip for now/i }))
    await user.click(screen.getByRole('button', { name: /skip for now/i }))
    await user.click(screen.getByRole('button', { name: /skip for now/i }))
    await user.click(screen.getByRole('button', { name: /skip for now/i }))
    await user.click(screen.getByRole('button', { name: /skip for now/i }))
    expect(
      screen.getByRole('dialog', { name: /review and finish/i }),
    ).toBeTruthy()
    expect(screen.getByText(/employee1@example.com/i)).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /finish setup/i }))
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/workspaces/workspace-1/invite',
        expect.objectContaining({ method: 'POST' }),
      ),
    )
    expect(
      fetchMock.mock.calls.filter(
        ([url]) => url === '/api/workspaces/workspace-1/invite',
      ),
    ).toHaveLength(2)
  })

  it('stages Manager invitations with the same value accepted by the server', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    } as Response)
    renderSetup()

    await user.click(screen.getByRole('button', { name: /continue setup/i }))
    await user.click(screen.getByRole('button', { name: /save and continue/i }))
    await user.click(screen.getByRole('button', { name: /skip for now/i }))

    await user.type(
      screen.getByLabelText(/Teammate email/i),
      'manager@example.com',
    )
    await user.selectOptions(screen.getAllByLabelText(/^Role$/i)[0], 'MANAGER')
    await user.click(screen.getByRole('button', { name: /save and continue/i }))
    await user.click(screen.getByRole('button', { name: /skip for now/i }))
    await user.click(screen.getByRole('button', { name: /skip for now/i }))
    await user.click(screen.getByRole('button', { name: /skip for now/i }))
    await user.click(screen.getByRole('button', { name: /skip for now/i }))
    await user.click(screen.getByRole('button', { name: /skip for now/i }))

    expect(screen.getByText(/manager@example.com \(Manager\)/i)).toBeTruthy()
    expect(screen.getAllByLabelText('In Progress').length).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: /finish setup/i }))
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/workspaces/workspace-1/invite',
        expect.objectContaining({
          body: expect.stringContaining('"role":"MANAGER"'),
        }),
      ),
    )
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: /review and finish/i }),
      ).toBeNull(),
    )
    expect(navigationMocks.replace).toHaveBeenCalledWith(
      '/dashboard/acme?setupComplete=1',
      { scroll: false },
    )
    expect(
      screen.getByText(
        /Setup Complete|Workspace Ready with Warnings|Workspace Needs Attention/i,
      ),
    ).toBeTruthy()
  })

  it('maps missing calendar deployment configuration to Configuration Required instead of Error', async () => {
    const user = userEvent.setup()
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (String(url).includes('/scheduling/microsoft/connect')) {
        return {
          ok: false,
          status: 503,
          json: async () => ({
            ok: false,
            code: 'configurationRequired',
            safeMessage:
              'Microsoft Outlook Calendar requires Skillify deployment configuration.',
          }),
        } as Response
      }
      return {
        ok: true,
        json: async () => ({ ok: true }),
      } as Response
    })
    renderSetup()

    await user.click(screen.getByRole('button', { name: /continue setup/i }))
    await user.click(screen.getByRole('button', { name: /save and continue/i }))
    await user.click(screen.getByRole('button', { name: /skip for now/i }))
    await user.click(screen.getByRole('button', { name: /skip for now/i }))
    await user.click(screen.getByRole('button', { name: /skip for now/i }))

    await user.click(
      screen.getByRole('button', { name: /connect microsoft calendar/i }),
    )

    await waitFor(() =>
      expect(
        screen.getAllByLabelText('Configuration Required').length,
      ).toBeGreaterThan(0),
    )
    expect(
      screen.getAllByText(/requires Skillify deployment configuration/i).length,
    ).toBeGreaterThan(0)
    expect(screen.queryByLabelText('Error')).toBeNull()

    await user.click(screen.getByRole('button', { name: /skip for now/i }))
    await user.click(screen.getByRole('button', { name: /skip for now/i }))
    await user.click(screen.getByRole('button', { name: /skip for now/i }))
    await user.click(screen.getByRole('button', { name: /skip for now/i }))
    expect(
      screen.getByRole('dialog', { name: /review and finish/i }),
    ).toBeTruthy()
    expect(screen.getAllByLabelText('Skipped').length).toBeGreaterThan(0)
  })

  it('supports repeatable teams and optional business locations', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    } as Response)
    renderSetup()

    await user.click(screen.getByRole('button', { name: /continue setup/i }))
    await user.click(screen.getByRole('button', { name: /save and continue/i }))
    await user.click(screen.getByRole('button', { name: /skip for now/i }))
    await user.click(screen.getByRole('button', { name: /skip for now/i }))

    expect(
      screen.getByRole('dialog', { name: /teams and business locations/i }),
    ).toBeTruthy()
    await user.type(screen.getByLabelText(/Team name/i), 'Service Team')
    expect(screen.getAllByLabelText(/Team name/i)).toHaveLength(2)
    await user.click(screen.getByRole('button', { name: /save and continue/i }))

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/workspaces/workspace-1/teams',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(
      fetchMock.mock.calls.some(
        ([url]) => url === '/api/workspaces/workspace-1/locations',
      ),
    ).toBe(false)
  })

  it('saves displayed Working Hours defaults unchanged using authoritative numeric weekdays', async () => {
    const user = userEvent.setup()
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (url, init) => {
        if (
          String(url).includes('/scheduling/availability') &&
          (!init || init.method === undefined)
        ) {
          return {
            ok: true,
            json: async () => ({ ok: true, value: { availability: [] } }),
          } as Response
        }
        return {
          ok: true,
          json: async () => ({ ok: true }),
        } as Response
      })
    renderSetup()

    await user.click(screen.getByRole('button', { name: /continue setup/i }))
    await user.click(screen.getByRole('button', { name: /save and continue/i }))
    expect(screen.getByRole('dialog', { name: /working hours/i })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /save and continue/i }))

    const saveCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        String(url) === '/api/workspaces/workspace-1/scheduling/availability' &&
        init?.method === 'POST',
    )
    expect(saveCall).toBeTruthy()
    expect(JSON.parse(String(saveCall?.[1]?.body))).toMatchObject({
      record: {
        kind: 'workingHours',
        scope: 'workspace',
        daysOfWeek: [1, 2, 3, 4, 5],
        startsAt: '09:00',
        endsAt: '17:00',
        timezone: 'America/New_York',
      },
    })
    const stored = JSON.parse(
      window.localStorage.getItem(getWorkspaceSetupStorageKey('acme')) ?? '{}',
    )
    expect(stored.workingHours).toBe('complete')
  })

  it('updates existing workspace Working Hours instead of duplicating records', async () => {
    const user = userEvent.setup()
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (url, init) => {
        if (
          String(url).includes('/scheduling/availability') &&
          (!init || init.method === undefined)
        ) {
          return {
            ok: true,
            json: async () => ({
              ok: true,
              value: {
                availability: [
                  {
                    id: 'working-hours-1',
                    kind: 'workingHours',
                    scope: 'workspace',
                    memberId: '',
                    workspaceMemberId: null,
                    teamId: null,
                    locationId: null,
                  },
                ],
              },
            }),
          } as Response
        }
        return {
          ok: true,
          json: async () => ({ ok: true }),
        } as Response
      })
    renderSetup()

    await user.click(screen.getByRole('button', { name: /continue setup/i }))
    await user.click(screen.getByRole('button', { name: /save and continue/i }))
    await user.click(screen.getByRole('button', { name: /save and continue/i }))

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/workspaces/workspace-1/scheduling/availability/working-hours-1',
      expect.objectContaining({ method: 'PATCH' }),
    )
    expect(
      fetchMock.mock.calls.some(
        ([url, init]) =>
          String(url) ===
            '/api/workspaces/workspace-1/scheduling/availability' &&
          init?.method === 'POST',
      ),
    ).toBe(false)
  })

  it('saves displayed Notification defaults unchanged and marks the step complete', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    } as Response)
    renderSetup()

    await user.click(screen.getByRole('button', { name: /continue setup/i }))
    await user.click(screen.getByRole('button', { name: /save and continue/i }))
    await user.click(screen.getByRole('button', { name: /skip for now/i }))
    await user.click(screen.getByRole('button', { name: /skip for now/i }))
    await user.click(screen.getByRole('button', { name: /skip for now/i }))
    await user.click(screen.getByRole('button', { name: /skip for now/i }))
    await user.click(screen.getByRole('button', { name: /skip for now/i }))
    await user.click(screen.getByRole('button', { name: /skip for now/i }))

    expect(
      screen.getByRole('dialog', { name: /^notifications$/i }),
    ).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /save and continue/i }))

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/workspaces/workspace-1/scheduling/notification-preferences',
      expect.objectContaining({
        method: 'PATCH',
        body: expect.stringContaining('"inAppEnabled":true'),
      }),
    )
    const stored = JSON.parse(
      window.localStorage.getItem(getWorkspaceSetupStorageKey('acme')) ?? '{}',
    )
    expect(stored.notifications).toBe('complete')
  })

  it('renders structured Workspace AI fields and maps them to the AI profile API', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    } as Response)
    renderSetup()

    await user.click(screen.getByRole('button', { name: /continue setup/i }))
    await user.click(screen.getByRole('button', { name: /save and continue/i }))
    await user.click(screen.getByRole('button', { name: /skip for now/i }))
    await user.click(screen.getByRole('button', { name: /skip for now/i }))
    await user.click(screen.getByRole('button', { name: /skip for now/i }))
    await user.click(screen.getByRole('button', { name: /skip for now/i }))

    expect(screen.getByRole('dialog', { name: /^workspace ai$/i })).toBeTruthy()
    fireEvent.click(screen.getByLabelText(/Enable Workspace AI/i))
    await user.type(
      screen.getByLabelText(/Products and services/i),
      'HVAC repair',
    )
    await user.type(
      screen.getByLabelText(/Customer policies/i),
      'No same-day cancellations',
    )
    await user.click(screen.getByRole('button', { name: /save and continue/i }))

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/workspaces/workspace-1/settings/ai-profile',
      expect.objectContaining({
        method: 'PATCH',
        body: expect.stringContaining('productsAndServices'),
      }),
    )
  })

  it('shows truthful lead-source cards and notification setup independent of calendars', async () => {
    const user = userEvent.setup()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    } as Response)
    renderSetup()

    await user.click(screen.getByRole('button', { name: /continue setup/i }))
    await user.click(screen.getByRole('button', { name: /save and continue/i }))
    await user.click(screen.getByRole('button', { name: /skip for now/i }))
    await user.click(screen.getByRole('button', { name: /skip for now/i }))
    await user.click(screen.getByRole('button', { name: /skip for now/i }))
    await user.click(screen.getByRole('button', { name: /skip for now/i }))
    await user.click(screen.getByRole('button', { name: /skip for now/i }))

    expect(
      screen.getByRole('dialog', { name: /website and lead intake/i }),
    ).toBeTruthy()
    expect(screen.getByText('Google Ads Lead Forms')).toBeTruthy()
    expect(screen.getAllByText(/Coming soon/i).length).toBeGreaterThan(0)
    await user.click(screen.getByRole('button', { name: /skip for now/i }))

    expect(
      screen.getByRole('dialog', { name: /^notifications$/i }),
    ).toBeTruthy()
    expect(
      screen.getByText(/External calendar connections are optional/i),
    ).toBeTruthy()
    fireEvent.click(screen.getByLabelText(/In-app notifications/i))
    await user.click(screen.getByRole('button', { name: /save and continue/i }))
    expect(
      screen.getByRole('dialog', { name: /review and finish/i }),
    ).toBeTruthy()
  })

  it('selects Manual Entry as a fallback without completing automated lead-source readiness', async () => {
    const user = userEvent.setup()
    window.history.replaceState(
      null,
      '',
      '/dashboard/acme?setup=1&setupStep=leadIntake',
    )
    renderSetup({ leadIntakeSources: leadIntakeCards })

    expect(
      screen.getByRole('dialog', { name: /website and lead intake/i }),
    ).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /use manual entry/i }))

    expect(screen.getAllByText(/Selected fallback/i).length).toBeGreaterThan(0)
    await user.click(screen.getByRole('button', { name: /save and continue/i }))

    const stored = JSON.parse(
      window.localStorage.getItem(getWorkspaceSetupStorageKey('acme')) ?? '{}',
    )
    const draft = JSON.parse(
      window.localStorage.getItem(
        `${getWorkspaceSetupStorageKey('acme')}:draft`,
      ) ?? '{}',
    )
    expect(stored.leadIntake).toBe('complete')
    expect(draft.manualLeadIntakeSelected).toBe(true)
    expect(draft.websiteIntakeEnabled).toBe(false)
  })

  it('shows HubSpot configuration requirements and keeps coming-soon lead providers inactive', () => {
    window.history.replaceState(
      null,
      '',
      '/dashboard/acme?setup=1&setupStep=leadIntake',
    )
    renderSetup({ leadIntakeSources: leadIntakeCards })

    expect(screen.getByText('HubSpot')).toBeTruthy()
    expect(screen.getByText('Configuration Required')).toBeTruthy()
    expect(screen.getByText('Google Ads Lead Forms')).toBeTruthy()
    expect(screen.getByText('Coming Soon')).toBeTruthy()
    expect(screen.queryByRole('link', { name: /connect hubspot/i })).toBeNull()
  })
})
