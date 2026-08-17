import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import CreateWorkspaceModal from '@/components/workspaces/CreateWorkspaceModal'
import { CreateFirstWorkspaceClient } from '@/components/workspaces/CreateFirstWorkspaceClient'
import { WorkspaceAIConfiguration } from '@/components/settings/WorkspaceAIConfiguration'
import { SalesProcessSettings } from '@/components/workspaces/SalesProcessSettings'
import { ManageWorkspacesClient } from '@/components/workspaces/ManageWorkspacesClient'
import WorkspaceSwitcher from '@/components/workspaces/WorkspaceSwitcher'

const push = vi.fn()
const refresh = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
  usePathname: () => '/dashboard/acme/automations',
}))

afterEach(() => {
  vi.unstubAllGlobals()
})

function mockFetch(response: { ok: boolean; body: unknown }) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: response.ok,
    json: vi.fn().mockResolvedValue(response.body),
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

async function openModal() {
  const user = userEvent.setup()
  render(React.createElement(CreateWorkspaceModal))
  await user.click(screen.getByRole('button', { name: /create workspace/i }))
  return user
}

function dialog() {
  return within(screen.getByRole('dialog'))
}

function expectDisabled(element: HTMLElement, disabled: boolean) {
  expect((element as HTMLButtonElement).disabled).toBe(disabled)
}

function textboxes() {
  const [workspaceName, businessName, industry] = dialog().getAllByRole(
    'textbox',
  ) as HTMLInputElement[]
  return { workspaceName, businessName, industry }
}

function expectCanonicalStepOne() {
  expect(
    screen.getByRole('heading', { name: /create a new workspace/i }),
  ).toBeTruthy()
  expect(screen.getByLabelText(/workspace name/i)).toBeTruthy()
  expect(screen.getByLabelText(/business name/i)).toBeTruthy()
  expect(screen.getByLabelText(/industry/i)).toBeTruthy()
}

async function continueToStepTwo(
  user: ReturnType<typeof userEvent.setup>,
  options: { industry?: string; workspaceName?: string } = {},
) {
  await user.type(
    screen.getByLabelText(/workspace name/i),
    options.workspaceName ?? 'Skillify Ecom',
  )
  if (options.industry) {
    await user.type(screen.getByLabelText(/industry/i), options.industry)
  }
  await user.click(dialog().getByRole('button', { name: /continue/i }))
}

function expectCanonicalStepTwo() {
  const modal = dialog()
  expect(
    screen.getByRole('heading', {
      name: /choose how your business works/i,
    }),
  ).toBeTruthy()
  expect(
    modal.getByRole('radiogroup', { name: /business model/i }),
  ).toBeTruthy()
  expect(modal.getByRole('radio', { name: /service business/i })).toBeTruthy()
  expect(modal.getByRole('radio', { name: /consultative sales/i })).toBeTruthy()
  expect(modal.getByRole('radio', { name: /sales & services/i })).toBeTruthy()
  expect(modal.getByRole('radio', { name: /product & commerce/i })).toBeTruthy()
}

function modelCard(name: RegExp | string) {
  return dialog().getByRole('radio', { name })
}

async function openHelpMeChoose(user: ReturnType<typeof userEvent.setup>) {
  await user.click(dialog().getByRole('button', { name: /help me choose/i }))
}

async function chooseQuestionOption(
  user: ReturnType<typeof userEvent.setup>,
  question: RegExp,
  option: RegExp,
) {
  const group = dialog().getByRole('radiogroup', { name: question })
  await user.click(within(group).getByRole('radio', { name: option }))
}

async function answerConsultativeSignals(
  user: ReturnType<typeof userEvent.setup>,
) {
  await chooseQuestionOption(
    user,
    /contact your business before purchasing/i,
    /usually/i,
  )
  await chooseQuestionOption(user, /consultations.*discovery calls/i, /often/i)
  await chooseQuestionOption(user, /custom proposals/i, /often/i)
  await chooseQuestionOption(
    user,
    /directly from an inquiry/i,
    /no, usually not/i,
  )
  await chooseQuestionOption(user, /products, orders, fulfillment/i, /^no$/i)
}

async function answerCommerceSignals(user: ReturnType<typeof userEvent.setup>) {
  await chooseQuestionOption(
    user,
    /contact your business before purchasing/i,
    /rarely or never/i,
  )
  await chooseQuestionOption(
    user,
    /consultations.*discovery calls/i,
    /rarely or never/i,
  )
  await chooseQuestionOption(user, /custom proposals/i, /rarely or never/i)
  await chooseQuestionOption(user, /directly from an inquiry/i, /yes, usually/i)
  await chooseQuestionOption(
    user,
    /products, orders, fulfillment/i,
    /yes, primarily/i,
  )
}

describe('CreateWorkspaceModal', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    push.mockReset()
    refresh.mockReset()
  })

  it('keeps Continue disabled for an empty workspace name', async () => {
    await openModal()

    expectDisabled(dialog().getByRole('button', { name: /continue/i }), true)
  })

  it('renders first-workspace creation inside the onboarding shell', () => {
    render(React.createElement(CreateFirstWorkspaceClient))

    expect(
      screen.getByRole('heading', { name: /create your first workspace/i }),
    ).toBeTruthy()
    expect(screen.getByText(/workspace setup/i)).toBeTruthy()
    expect(screen.getByText(/organize leads and customers/i)).toBeTruthy()
    expect(screen.getByText(/schedule and manage work/i)).toBeTruthy()
    expect(screen.getByTestId('first-workspace-product-preview')).toBeTruthy()
    expect(
      screen.getByRole('button', { name: /create workspace/i }),
    ).toBeTruthy()
    expect(document.body.textContent).not.toMatch(/powered by skillify/i)
    expect(document.body.textContent).not.toMatch(/acme|corbin|rachel|\$[0-9]/i)
  })

  it('keeps Continue disabled for a whitespace-only workspace name', async () => {
    const user = await openModal()

    await user.type(screen.getByLabelText(/workspace name/i), '   ')

    expectDisabled(dialog().getByRole('button', { name: /continue/i }), true)
  })

  it('enables Continue for a valid workspace name while optional fields are empty', async () => {
    const user = await openModal()

    await user.type(screen.getByLabelText(/workspace name/i), 'Acme')

    expectDisabled(dialog().getByRole('button', { name: /continue/i }), false)
  })

  it('updates the controlled Workspace Name input value as the user types', async () => {
    const user = await openModal()
    const { workspaceName } = textboxes()

    await user.type(workspaceName, 'Skillify Ecom')

    expect(workspaceName.value).toBe('Skillify Ecom')
    expect(workspaceName.className).toContain('text-app-primary')
    expect(workspaceName.className).toContain('placeholder:text-app-muted')
    expectDisabled(dialog().getByRole('button', { name: /continue/i }), false)
  })

  it('does not enable Continue when only Business Name has text', async () => {
    const user = await openModal()
    const { businessName } = textboxes()

    await user.type(businessName, 'Skillify Ecom LLC')

    expectDisabled(dialog().getByRole('button', { name: /continue/i }), true)
  })

  it('does not enable Continue when only Industry has text', async () => {
    const user = await openModal()
    const { industry } = textboxes()

    await user.type(industry, 'Retail')

    expectDisabled(dialog().getByRole('button', { name: /continue/i }), true)
  })

  it('disables Continue again after Workspace Name is cleared', async () => {
    const user = await openModal()
    const { workspaceName } = textboxes()

    await user.type(workspaceName, 'Skillify Ecom')
    expectDisabled(dialog().getByRole('button', { name: /continue/i }), false)

    await user.clear(workspaceName)

    expect(workspaceName.value).toBe('')
    expectDisabled(dialog().getByRole('button', { name: /continue/i }), true)
  })

  it('does not require Business Name or Industry to continue', async () => {
    const user = await openModal()

    await user.type(screen.getByLabelText(/workspace name/i), 'A')
    await user.click(dialog().getByRole('button', { name: /continue/i }))

    expect(
      screen.getByRole('heading', {
        name: /choose how your business works/i,
      }),
    ).toBeTruthy()
  })

  it('moves from Step 1 to Step 2 when Continue is clicked', async () => {
    const user = await openModal()
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await user.type(screen.getByLabelText(/workspace name/i), 'Acme')
    await user.click(dialog().getByRole('button', { name: /continue/i }))

    expect(screen.getByText(/step 2 of 2/i)).toBeTruthy()
    expectCanonicalStepTwo()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('opens Step 2 when Enter is pressed with a valid Workspace Name', async () => {
    const user = await openModal()
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { workspaceName } = textboxes()

    await user.type(workspaceName, 'Skillify Ecom')
    await user.keyboard('{Enter}')

    expect(
      screen.getByRole('heading', {
        name: /choose how your business works/i,
      }),
    ).toBeTruthy()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('stays on Step 1 when Enter is pressed with an invalid Workspace Name', async () => {
    const user = await openModal()
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { workspaceName } = textboxes()

    await user.type(workspaceName, '   ')
    await user.keyboard('{Enter}')

    expect(
      screen.getByRole('heading', { name: /create a new workspace/i }),
    ).toBeTruthy()
    expect(
      screen.queryByRole('heading', {
        name: /choose how your business works/i,
      }),
    ).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('requires a model before final creation', async () => {
    const user = await openModal()

    await user.type(screen.getByLabelText(/workspace name/i), 'Acme')
    await user.click(screen.getByRole('button', { name: /continue/i }))

    expectDisabled(
      dialog().getByRole('button', { name: /create workspace/i }),
      true,
    )
  })

  it('recommends Product & Commerce for product-like industries without forcing selection', async () => {
    const user = await openModal()

    await continueToStepTwo(user, { industry: 'Ecom' })

    expect(screen.getByText(/recommended for ecom/i)).toBeTruthy()
    expect(modelCard(/product & commerce/i).getAttribute('aria-checked')).toBe(
      'false',
    )
    expect(
      within(modelCard(/product & commerce/i)).getByText(
        /recommended for you/i,
      ),
    ).toBeTruthy()
    expectDisabled(
      dialog().getByRole('button', { name: /create workspace/i }),
      true,
    )
  })

  it('recommends Service Business for service industries without forcing selection', async () => {
    const user = await openModal()

    await continueToStepTwo(user, { industry: 'Plumbing' })

    expect(screen.getByText(/recommended for plumbing/i)).toBeTruthy()
    expect(
      screen.getByText('Recommended').nextElementSibling?.className,
    ).toContain('max-w-3xl')
    expect(modelCard(/service business/i).getAttribute('aria-checked')).toBe(
      'false',
    )
  })

  it('does not show an industry hint for ambiguous industries', async () => {
    const user = await openModal()

    await continueToStepTwo(user, { industry: 'Construction' })

    expect(screen.queryByText(/recommended for construction/i)).toBeNull()
    expect(screen.getByText(/not sure which layout fits/i)).toBeTruthy()
  })

  it('lets questionnaire recommendations override the industry hint', async () => {
    const user = await openModal()

    await continueToStepTwo(user, { industry: 'Plumbing' })
    await openHelpMeChoose(user)
    await answerConsultativeSignals(user)
    await user.click(
      dialog().getByRole('button', { name: /recommend my layout/i }),
    )

    expect(screen.getByText('Recommended for your business')).toBeTruthy()
    expect(screen.queryByText(/recommended for plumbing/i)).toBeNull()
    expect(modelCard(/consultative sales/i).getAttribute('aria-checked')).toBe(
      'true',
    )
  })

  it('renders model-specific workspace previews', async () => {
    const user = await openModal()

    await continueToStepTwo(user)

    const consultative = modelCard(/consultative sales/i)
    const direct = modelCard(/sales & services/i)
    const commerce = modelCard(/product & commerce/i)
    const simple = modelCard(/service business/i)

    expect(within(simple).getByText('Leads')).toBeTruthy()
    expect(within(simple).getByText('Customers')).toBeTruthy()
    expect(within(simple).queryByText('Jobs')).toBeNull()
    expect(within(simple).queryByText('Job Steps')).toBeNull()

    expect(within(consultative).getByText('Leads')).toBeTruthy()
    expect(within(consultative).getByText('Opportunities')).toBeTruthy()
    expect(within(consultative).getByText('Sales Pipeline')).toBeTruthy()
    expect(within(consultative).getByText('Clients')).toBeTruthy()

    expect(within(direct).getByText('Leads')).toBeTruthy()
    expect(within(direct).getByText('Sales Pipeline')).toBeTruthy()
    expect(within(direct).getByText('Clients')).toBeTruthy()
    expect(within(direct).queryByText('Opportunities')).toBeNull()

    expect(within(commerce).getByText('Customers')).toBeTruthy()
    expect(within(commerce).getByText('Orders')).toBeTruthy()
    expect(within(commerce).getByText('Fulfillment')).toBeTruthy()
    expect(within(commerce).getByText('Support')).toBeTruthy()
  })

  it('updates radio selected state when a model is selected', async () => {
    const user = await openModal()

    await continueToStepTwo(user)
    const direct = modelCard(/sales & services/i)

    expect(direct.getAttribute('aria-checked')).toBe('false')

    await user.click(direct)

    expect(direct.getAttribute('aria-checked')).toBe('true')
    expect(modelCard(/consultative sales/i).getAttribute('aria-checked')).toBe(
      'false',
    )
  })

  it('keeps Service Business selected after click and enables creation', async () => {
    const user = await openModal()

    await continueToStepTwo(user, { industry: 'Lawn services' })
    const serviceBusiness = modelCard(/service business/i)

    expect(serviceBusiness.getAttribute('aria-checked')).toBe('false')
    expectDisabled(
      dialog().getByRole('button', { name: /create workspace/i }),
      true,
    )

    await user.click(serviceBusiness)

    expect(serviceBusiness.getAttribute('aria-checked')).toBe('true')
    expectDisabled(
      dialog().getByRole('button', { name: /create workspace/i }),
      false,
    )
  })

  it('keeps Back and Cancel visually secondary while preserving focus styles', async () => {
    const user = await openModal()
    const cancel = dialog().getByRole('button', { name: /cancel/i })

    expect(cancel.className).toContain('bg-white/[0.025]')
    expect(cancel.className).toContain('focus-visible:ring')

    await continueToStepTwo(user)
    const back = dialog().getByRole('button', { name: /back/i })

    expect(back.className).toContain('text-white/65')
    expect(back.className).toContain('hover:bg-white/[0.06]')
  })

  it('supports keyboard selection between model cards', async () => {
    const user = await openModal()

    await continueToStepTwo(user)
    const service = modelCard(/service business/i)
    service.focus()

    await user.keyboard('{ArrowRight}')

    expect(modelCard(/sales & services/i).getAttribute('aria-checked')).toBe(
      'true',
    )

    await user.keyboard('{ArrowLeft}')

    expect(service.getAttribute('aria-checked')).toBe('true')
  })

  it('opens the Help me choose questionnaire from Step 2', async () => {
    const user = await openModal()

    await continueToStepTwo(user)
    await openHelpMeChoose(user)

    expect(
      screen.getByRole('heading', {
        name: /help skillify recommend a layout/i,
      }),
    ).toBeTruthy()
    expect(
      dialog().getByRole('radiogroup', {
        name: /contact your business before purchasing/i,
      }),
    ).toBeTruthy()
    expect(
      dialog().getByRole('radiogroup', {
        name: /products, orders, fulfillment/i,
      }),
    ).toBeTruthy()
  })

  it('does not show a recommendation until all questionnaire questions are answered', async () => {
    const user = await openModal()

    await continueToStepTwo(user)
    await openHelpMeChoose(user)

    expectDisabled(
      dialog().getByRole('button', { name: /recommend my layout/i }),
      true,
    )

    await answerConsultativeSignals(user)

    expectDisabled(
      dialog().getByRole('button', { name: /recommend my layout/i }),
      false,
    )
  })

  it('recommends Consultative Sales and returns directly to layout cards', async () => {
    const user = await openModal()

    await continueToStepTwo(user)
    await openHelpMeChoose(user)
    await answerConsultativeSignals(user)
    await user.click(
      dialog().getByRole('button', { name: /recommend my layout/i }),
    )

    expectCanonicalStepTwo()
    expect(screen.getByText('Recommended for your business')).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: /use this layout/i }),
    ).toBeNull()
    expect(modelCard(/consultative sales/i).getAttribute('aria-checked')).toBe(
      'true',
    )
    expectDisabled(
      dialog().getByRole('button', { name: /create workspace/i }),
      false,
    )
  })

  it('recommends product & commerce for commerce questionnaire answers', async () => {
    const user = await openModal()

    await continueToStepTwo(user)
    await openHelpMeChoose(user)
    await answerCommerceSignals(user)
    await user.click(
      dialog().getByRole('button', { name: /recommend my layout/i }),
    )

    expectCanonicalStepTwo()
    expect(modelCard(/product & commerce/i).getAttribute('aria-checked')).toBe(
      'true',
    )
    expect(
      within(modelCard(/product & commerce/i)).getByText(
        /recommended for you/i,
      ),
    ).toBeTruthy()
  })

  it('dismisses the recommendation without clearing the selected layout', async () => {
    const user = await openModal()

    await continueToStepTwo(user)
    await openHelpMeChoose(user)
    await answerConsultativeSignals(user)
    await user.click(
      dialog().getByRole('button', { name: /recommend my layout/i }),
    )

    await user.click(
      dialog().getByRole('button', { name: /dismiss recommendation/i }),
    )

    expectCanonicalStepTwo()
    expect(modelCard(/consultative sales/i).getAttribute('aria-checked')).toBe(
      'true',
    )
    expect(
      within(modelCard(/consultative sales/i)).queryByText(
        /recommended for you/i,
      ),
    ).toBeNull()
    expect(screen.queryByText('Recommended for your business')).toBeNull()
    expectDisabled(
      dialog().getByRole('button', { name: /create workspace/i }),
      false,
    )
  })

  it('keeps previous answers when changing answers from the recommendation banner', async () => {
    const user = await openModal()

    await continueToStepTwo(user)
    await openHelpMeChoose(user)
    await answerCommerceSignals(user)
    await user.click(
      dialog().getByRole('button', { name: /recommend my layout/i }),
    )
    await user.click(dialog().getByRole('button', { name: /change answers/i }))

    expect(
      screen.getByRole('heading', {
        name: /help skillify recommend a layout/i,
      }),
    ).toBeTruthy()
    expect(
      dialog()
        .getByRole('radiogroup', {
          name: /products, orders, fulfillment/i,
        })
        .querySelector('[aria-checked="true"]')?.textContent,
    ).toMatch(/yes, primarily/i)
  })

  it('allows selecting a different card after receiving a recommendation', async () => {
    const user = await openModal()

    await continueToStepTwo(user)
    await openHelpMeChoose(user)
    await answerCommerceSignals(user)
    await user.click(
      dialog().getByRole('button', { name: /recommend my layout/i }),
    )
    await user.click(modelCard(/sales & services/i))

    expect(modelCard(/sales & services/i).getAttribute('aria-checked')).toBe(
      'true',
    )
    expect(modelCard(/product & commerce/i).getAttribute('aria-checked')).toBe(
      'false',
    )
    expect(
      within(modelCard(/product & commerce/i)).getByText(
        /recommended for you/i,
      ),
    ).toBeTruthy()
  })

  it('can recommend again after dismissing without losing questionnaire answers', async () => {
    const user = await openModal()

    await continueToStepTwo(user)
    await openHelpMeChoose(user)
    await answerCommerceSignals(user)
    await user.click(
      dialog().getByRole('button', { name: /recommend my layout/i }),
    )
    await user.click(
      dialog().getByRole('button', { name: /dismiss recommendation/i }),
    )
    await openHelpMeChoose(user)

    expect(
      dialog()
        .getByRole('radiogroup', {
          name: /products, orders, fulfillment/i,
        })
        .querySelector('[aria-checked="true"]')?.textContent,
    ).toMatch(/yes, primarily/i)

    await user.click(
      dialog().getByRole('button', { name: /recommend my layout/i }),
    )

    expect(screen.getByText('Recommended for your business')).toBeTruthy()
    expect(modelCard(/product & commerce/i).getAttribute('aria-checked')).toBe(
      'true',
    )
  })

  it('shows a simplified Workspace Ready screen after a business model is selected', async () => {
    const fetchMock = mockFetch({
      ok: true,
      body: { workspace: { id: 'ws_1', name: 'Acme', slug: 'acme' } },
    })
    const user = await openModal()

    const { workspaceName, businessName } = textboxes()
    await user.type(workspaceName, ' Acme ')
    await user.type(businessName, 'Acme LLC')
    await user.click(dialog().getByRole('button', { name: /continue/i }))
    await user.click(modelCard(/sales & services/i))
    const createButton = dialog().getByRole('button', {
      name: /create workspace/i,
    })
    await user.click(createButton)
    await user.click(createButton)

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const [, requestInit] = fetchMock.mock.calls[0]
    expect(requestInit).toMatchObject({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    expect(JSON.parse(requestInit.body as string)).toMatchObject({
      name: 'Acme',
      businessName: 'Acme LLC',
      industry: '',
      businessModel: 'DIRECT_SALES',
    })
    expect(
      screen.getByRole('heading', { name: /workspace ready/i }),
    ).toBeTruthy()
    expect(
      screen.getByText(
        /complete setup to personalize skillify for your business, team, scheduling, ai, and operations/i,
      ),
    ).toBeTruthy()
    expect(
      screen.getByText(
        /setup takes you through business information, team, scheduling, ai, lead intake, and notifications/i,
      ),
    ).toBeTruthy()
    expect(dialog().queryByRole('button', { name: /configure ai/i })).toBeNull()
    expect(
      dialog().getByRole('button', { name: /go to dashboard/i }),
    ).toBeTruthy()
    expect(push).not.toHaveBeenCalled()

    await user.click(
      dialog().getByRole('button', { name: /start workspace setup/i }),
    )

    expect(push).toHaveBeenCalledWith('/dashboard/acme?setup=1')
    expect(refresh).toHaveBeenCalled()
  })

  it('submits SIMPLE_SERVICE_BUSINESS when Service Business is selected', async () => {
    const fetchMock = mockFetch({
      ok: true,
      body: { workspace: { id: 'ws_1', name: 'Lawn Co', slug: 'lawn-co' } },
    })
    const user = await openModal()

    await user.type(screen.getByLabelText(/workspace name/i), 'Lawn Co')
    await user.type(screen.getByLabelText(/industry/i), 'Lawn services')
    await user.click(dialog().getByRole('button', { name: /continue/i }))
    await user.click(modelCard(/service business/i))
    await user.click(
      dialog().getByRole('button', { name: /create workspace/i }),
    )

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const [, requestInit] = fetchMock.mock.calls[0]
    expect(JSON.parse(requestInit.body as string)).toMatchObject({
      name: 'Lawn Co',
      industry: 'Lawn services',
      businessModel: 'SIMPLE_SERVICE_BUSINESS',
    })
  })

  it('can continue from Workspace Ready to the dashboard through the secondary action', async () => {
    mockFetch({
      ok: true,
      body: { workspace: { id: 'ws_1', name: 'Acme', slug: 'acme' } },
    })
    const user = await openModal()

    await user.type(screen.getByLabelText(/workspace name/i), 'Acme')
    await user.click(dialog().getByRole('button', { name: /continue/i }))
    await user.click(modelCard(/sales & services/i))
    await user.click(
      dialog().getByRole('button', { name: /create workspace/i }),
    )
    await user.click(
      await screen.findByRole('button', { name: /go to dashboard/i }),
    )

    expect(push).toHaveBeenCalledWith('/dashboard/acme')
    expect(refresh).toHaveBeenCalled()
  })

  it('keeps the modal open and displays an inline error after API failure', async () => {
    mockFetch({ ok: false, body: { error: 'Workspace already exists.' } })
    const user = await openModal()

    await user.type(screen.getByLabelText(/workspace name/i), 'Acme')
    await user.click(dialog().getByRole('button', { name: /continue/i }))
    await user.click(modelCard(/consultative sales/i))
    await user.click(
      dialog().getByRole('button', { name: /create workspace/i }),
    )

    expect(await screen.findByText('Workspace already exists.')).toBeTruthy()
    expect(
      screen.getByRole('heading', {
        name: /choose how your business works/i,
      }),
    ).toBeTruthy()
  })
})

describe('WorkspaceSwitcher create workspace interaction', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    push.mockReset()
    refresh.mockReset()
  })

  it('closes the switcher dropdown before opening the setup modal', async () => {
    const user = userEvent.setup()
    render(
      React.createElement(WorkspaceSwitcher, {
        currentSlug: 'acme',
        workspaces: [
          {
            id: 'ws_1',
            name: 'Acme',
            slug: 'acme',
            plan: 'Free',
            memberRole: 'OWNER',
          },
        ],
      }),
    )

    await user.click(screen.getByRole('button', { name: /acme/i }))
    const menu = screen.getByRole('menu')
    await user.click(
      within(menu).getByRole('menuitem', { name: /create workspace/i }),
    )

    expect(screen.queryByRole('menu')).toBeNull()
    expectCanonicalStepOne()
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(screen.getByRole('dialog').parentElement).toBe(document.body)
  })

  it('opens the same Step 2 business-model layout from the switcher modal', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    render(
      React.createElement(WorkspaceSwitcher, {
        currentSlug: 'acme',
        workspaces: [
          {
            id: 'ws_1',
            name: 'Acme',
            slug: 'acme',
            plan: 'Free',
            memberRole: 'OWNER',
          },
        ],
      }),
    )

    await user.click(screen.getByRole('button', { name: /acme/i }))
    await user.click(
      within(screen.getByRole('menu')).getByRole('menuitem', {
        name: /create workspace/i,
      }),
    )
    await continueToStepTwo(user, { industry: 'Marketing agency' })

    expectCanonicalStepTwo()
    expect(screen.getByText(/recommended for marketing agency/i)).toBeTruthy()
    await openHelpMeChoose(user)
    expect(
      screen.getByRole('heading', {
        name: /help skillify recommend a layout/i,
      }),
    ).toBeTruthy()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('ManageWorkspacesClient create workspace interaction', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    push.mockReset()
    refresh.mockReset()
  })

  it('opens the canonical modal from Manage Workspaces', async () => {
    const user = userEvent.setup()
    render(
      React.createElement(ManageWorkspacesClient, {
        currentSlug: 'acme',
        workspaces: [
          {
            id: 'ws_1',
            name: 'Acme',
            slug: 'acme',
            plan: 'Free',
            ownerName: 'Owner',
            membersCount: 1,
            createdAt: new Date('2026-01-01'),
            memberRole: 'OWNER',
          },
        ],
      }),
    )

    await user.click(screen.getByRole('button', { name: /create workspace/i }))

    expectCanonicalStepOne()
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(screen.getByRole('dialog').parentElement).toBe(document.body)
  })

  it('opens the same Step 2 business-model layout from Manage Workspaces', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    render(
      React.createElement(ManageWorkspacesClient, {
        currentSlug: 'acme',
        workspaces: [
          {
            id: 'ws_1',
            name: 'Acme',
            slug: 'acme',
            plan: 'Free',
            ownerName: 'Owner',
            membersCount: 1,
            createdAt: new Date('2026-01-01'),
            memberRole: 'OWNER',
          },
        ],
      }),
    )

    await user.click(screen.getByRole('button', { name: /create workspace/i }))
    await continueToStepTwo(user, { industry: 'Retail' })

    expectCanonicalStepTwo()
    expect(screen.getByText(/recommended for retail/i)).toBeTruthy()
    await openHelpMeChoose(user)
    expect(
      screen.getByRole('heading', {
        name: /help skillify recommend a layout/i,
      }),
    ).toBeTruthy()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('keeps Open Workspace visible and moves secondary actions into the menu', async () => {
    const user = userEvent.setup()
    render(
      React.createElement(ManageWorkspacesClient, {
        currentSlug: 'acme',
        workspaces: [
          {
            id: 'ws_1',
            name: 'Acme',
            slug: 'acme',
            plan: 'Free',
            ownerName: 'Owner',
            membersCount: 1,
            createdAt: new Date('2026-01-01'),
            memberRole: 'OWNER',
          },
        ],
      }),
    )

    expect(screen.getByRole('button', { name: /open workspace/i })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^rename$/i })).toBeNull()

    await user.click(
      screen.getByRole('button', { name: /workspace actions for acme/i }),
    )

    const menu = screen.getByRole('menu')
    expect(within(menu).getByRole('menuitem', { name: /rename/i })).toBeTruthy()
    expect(
      within(menu).getByRole('menuitem', { name: /ai configuration/i }),
    ).toBeTruthy()
    expect(within(menu).getByRole('menuitem', { name: /delete/i })).toBeTruthy()
  })

  it('opens a workspace through the server-authorized switch route', async () => {
    const fetchMock = mockFetch({
      ok: true,
      body: { ok: true, redirectTo: '/dashboard/beta' },
    })
    const user = userEvent.setup()
    render(
      React.createElement(ManageWorkspacesClient, {
        currentSlug: 'acme',
        workspaces: [
          {
            id: 'ws_2',
            name: 'Beta',
            slug: 'beta',
            plan: 'Free',
            ownerName: 'Owner',
            membersCount: 1,
            createdAt: new Date('2026-01-01'),
            memberRole: 'MEMBER',
          },
        ],
      }),
    )

    await user.click(screen.getByRole('button', { name: /open workspace/i }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/workspaces/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: 'ws_2',
          workspaceSlug: 'beta',
        }),
      })
      expect(push).toHaveBeenCalledWith('/dashboard/beta')
    })
  })

  it('shows a visible error when workspace selection is rejected', async () => {
    mockFetch({
      ok: false,
      body: {
        error: 'You do not have access to that workspace.',
        code: 'WORKSPACE_ACCESS_DENIED',
      },
    })
    const user = userEvent.setup()
    render(
      React.createElement(ManageWorkspacesClient, {
        currentSlug: 'acme',
        workspaces: [
          {
            id: 'ws_2',
            name: 'Beta',
            slug: 'beta',
            plan: 'Free',
            ownerName: 'Owner',
            membersCount: 1,
            createdAt: new Date('2026-01-01'),
            memberRole: 'MEMBER',
          },
        ],
      }),
    )

    await user.click(screen.getByRole('button', { name: /open workspace/i }))

    expect(
      await screen.findByText('You do not have access to that workspace.'),
    ).toBeTruthy()
    expect(push).not.toHaveBeenCalled()
    expect(
      (
        screen.getByRole('button', {
          name: /open workspace/i,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false)
  })

  it('hides unauthorized destructive workspace actions from non-owners', async () => {
    const user = userEvent.setup()
    render(
      React.createElement(ManageWorkspacesClient, {
        currentSlug: 'acme',
        workspaces: [
          {
            id: 'ws_1',
            name: 'Acme',
            slug: 'acme',
            plan: 'Free',
            ownerName: 'Owner',
            membersCount: 1,
            createdAt: new Date('2026-01-01'),
            memberRole: 'MEMBER',
          },
        ],
      }),
    )

    await user.click(
      screen.getByRole('button', { name: /workspace actions for acme/i }),
    )

    const menu = screen.getByRole('menu')
    expect(within(menu).queryByRole('menuitem', { name: /delete/i })).toBeNull()
    expect(
      within(menu).queryByRole('menuitem', { name: /archive/i }),
    ).toBeNull()
  })

  it('opens AI Configuration for the selected workspace from the menu', async () => {
    const user = userEvent.setup()
    render(
      React.createElement(ManageWorkspacesClient, {
        currentSlug: 'acme',
        workspaces: [
          {
            id: 'ws_1',
            name: 'Beta',
            slug: 'beta',
            plan: 'Free',
            ownerName: 'Owner',
            membersCount: 1,
            createdAt: new Date('2026-01-01'),
            memberRole: 'OWNER',
          },
        ],
      }),
    )

    await user.click(
      screen.getByRole('button', { name: /workspace actions for beta/i }),
    )
    await user.click(
      within(screen.getByRole('menu')).getByRole('menuitem', {
        name: /ai configuration/i,
      }),
    )

    expect(push).toHaveBeenCalledWith(
      '/dashboard/beta/settings#ai-configuration',
    )
  })

  it('uses the shared delete dialog and confirmation payload', async () => {
    const fetchMock = mockFetch({
      ok: true,
      body: { ok: true, redirectTo: '/dashboard/beta' },
    })
    const user = userEvent.setup()
    render(
      React.createElement(ManageWorkspacesClient, {
        currentSlug: 'acme',
        workspaces: [
          {
            id: 'ws_1',
            name: 'Acme',
            slug: 'acme',
            plan: 'Free',
            ownerName: 'Owner',
            membersCount: 1,
            createdAt: new Date('2026-01-01'),
            memberRole: 'OWNER',
          },
        ],
      }),
    )

    await user.click(
      screen.getByRole('button', { name: /workspace actions for acme/i }),
    )
    await user.click(
      within(screen.getByRole('menu')).getByRole('menuitem', {
        name: /delete/i,
      }),
    )

    expect(screen.getByRole('dialog', { name: /delete acme/i })).toBeTruthy()
    expect(screen.getByText('"Acme"')).toBeTruthy()
    expect(
      screen.getByText(/to permanently delete this workspace\./i),
    ).toBeTruthy()
    expectDisabled(
      screen.getAllByRole('button', { name: /^delete workspace$/i })[0],
      true,
    )
    await user.type(screen.getByRole('textbox'), 'NOPE')
    expect(fetchMock).not.toHaveBeenCalled()
    await user.clear(screen.getByRole('textbox'))
    await user.type(screen.getByRole('textbox'), 'Acme')
    await user.click(
      screen.getAllByRole('button', { name: /^delete workspace$/i })[0],
    )

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(fetchMock.mock.calls[0][0]).toBe('/api/workspaces/ws_1')
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      confirmation: 'Acme',
    })
    expect(push).toHaveBeenCalledWith('/dashboard/beta')
  })

  it('deletes another workspace without navigating away from the current workspace', async () => {
    const fetchMock = mockFetch({
      ok: true,
      body: { ok: true, redirectTo: '/dashboard/acme' },
    })
    const user = userEvent.setup()
    render(
      React.createElement(ManageWorkspacesClient, {
        currentSlug: 'acme',
        workspaces: [
          {
            id: 'ws_1',
            name: 'Acme',
            slug: 'acme',
            plan: 'Free',
            ownerName: 'Owner',
            membersCount: 1,
            createdAt: new Date('2026-01-01'),
            memberRole: 'OWNER',
          },
          {
            id: 'ws_2',
            name: 'Beta',
            slug: 'beta',
            plan: 'Free',
            ownerName: 'Owner',
            membersCount: 1,
            createdAt: new Date('2026-01-01'),
            memberRole: 'OWNER',
          },
        ],
      }),
    )

    await user.click(
      screen.getByRole('button', { name: /workspace actions for beta/i }),
    )
    await user.click(
      within(screen.getByRole('menu')).getByRole('menuitem', {
        name: /delete/i,
      }),
    )
    await user.type(
      screen.getByLabelText(/type beta to confirm workspace deletion/i),
      'Beta',
    )
    await user.click(
      screen.getAllByRole('button', { name: /^delete workspace$/i })[0],
    )

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(push).not.toHaveBeenCalled()
    expect(screen.queryByText('Beta')).toBeNull()
  })

  it('archives the current workspace through an app dialog and routes to the safe target', async () => {
    const fetchMock = mockFetch({
      ok: true,
      body: {
        ok: true,
        redirectTo: '/dashboard/beta',
        workspace: {
          id: 'ws_1',
          name: 'Acme',
          slug: 'acme',
          archivedAt: '2026-01-02T00:00:00.000Z',
        },
      },
    })
    const alertSpy = vi.spyOn(window, 'alert')
    const confirmSpy = vi.spyOn(window, 'confirm')
    const user = userEvent.setup()
    render(
      React.createElement(ManageWorkspacesClient, {
        currentSlug: 'acme',
        workspaces: [
          {
            id: 'ws_1',
            name: 'Acme',
            slug: 'acme',
            plan: 'Free',
            ownerName: 'Owner',
            membersCount: 1,
            createdAt: new Date('2026-01-01'),
            memberRole: 'OWNER',
          },
          {
            id: 'ws_2',
            name: 'Beta',
            slug: 'beta',
            plan: 'Free',
            ownerName: 'Owner',
            membersCount: 1,
            createdAt: new Date('2026-01-01'),
            memberRole: 'OWNER',
          },
        ],
      }),
    )

    await user.click(
      screen.getByRole('button', { name: /workspace actions for acme/i }),
    )
    await user.click(
      within(screen.getByRole('menu')).getByRole('menuitem', {
        name: /^archive$/i,
      }),
    )

    expect(screen.getByRole('dialog', { name: /archive acme/i })).toBeTruthy()
    expect(alertSpy).not.toHaveBeenCalled()
    expect(confirmSpy).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: /archive workspace/i }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      action: 'archive',
    })
    expect(push).toHaveBeenCalledWith('/dashboard/beta')
  })

  it('shows Unarchive for archived workspaces and restores them without opening disabled cards', async () => {
    const fetchMock = mockFetch({
      ok: true,
      body: {
        ok: true,
        workspace: {
          id: 'ws_2',
          name: 'Beta',
          slug: 'beta',
          archivedAt: null,
        },
      },
    })
    const user = userEvent.setup()
    render(
      React.createElement(ManageWorkspacesClient, {
        currentSlug: 'acme',
        workspaces: [
          {
            id: 'ws_1',
            name: 'Acme',
            slug: 'acme',
            plan: 'Free',
            ownerName: 'Owner',
            membersCount: 1,
            createdAt: new Date('2026-01-01'),
            memberRole: 'OWNER',
          },
          {
            id: 'ws_2',
            name: 'Beta',
            slug: 'beta',
            plan: 'Free',
            ownerName: 'Owner',
            membersCount: 1,
            createdAt: new Date('2026-01-01'),
            archivedAt: new Date('2026-01-02'),
            memberRole: 'OWNER',
          },
        ],
      }),
    )

    expect(screen.getByText('Archived Workspaces')).toBeTruthy()
    expectDisabled(
      screen.getAllByRole('button', { name: /open workspace/i })[1],
      true,
    )
    await user.click(
      screen.getByRole('button', { name: /workspace actions for beta/i }),
    )
    const menu = screen.getByRole('menu')
    expect(
      within(menu).getByRole('menuitem', { name: /unarchive/i }),
    ).toBeTruthy()
    expect(
      within(menu).queryByRole('menuitem', { name: /^archive$/i }),
    ).toBeNull()
    await user.click(within(menu).getByRole('menuitem', { name: /unarchive/i }))
    await user.click(
      screen.getByRole('button', { name: /unarchive workspace/i }),
    )

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      action: 'restore',
    })
    expect(push).not.toHaveBeenCalled()
  })

  it('allows admins to archive but keeps delete owner-only', async () => {
    const user = userEvent.setup()
    render(
      React.createElement(ManageWorkspacesClient, {
        currentSlug: 'acme',
        workspaces: [
          {
            id: 'ws_1',
            name: 'Acme',
            slug: 'acme',
            plan: 'Free',
            ownerName: 'Owner',
            membersCount: 1,
            createdAt: new Date('2026-01-01'),
            memberRole: 'ADMIN',
          },
        ],
      }),
    )

    await user.click(
      screen.getByRole('button', { name: /workspace actions for acme/i }),
    )

    const menu = screen.getByRole('menu')
    expect(
      within(menu).getByRole('menuitem', { name: /^archive$/i }),
    ).toBeTruthy()
    expect(within(menu).queryByRole('menuitem', { name: /delete/i })).toBeNull()
  })
})

describe('WorkspaceAIConfiguration', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    push.mockReset()
    refresh.mockReset()
  })

  const baseProfile = {
    enabled: false,
    status: 'NOT_CONFIGURED' as const,
    businessSummary: null,
    productsAndServices: null,
    operatingGuidelines: null,
    brandVoice: null,
    customerPolicies: null,
    automationGuardrails: null,
  }

  it('shows commerce-specific plain-language examples', () => {
    render(
      React.createElement(WorkspaceAIConfiguration, {
        workspaceId: 'ws_1',
        canEdit: true,
        initialProfile: baseProfile,
        initialActivity: [],
        workspaceConfig: { businessModel: 'PRODUCT_COMMERCE' },
      }),
    )

    expect(screen.getByText(/teach skillify about your business/i)).toBeTruthy()
    expect(screen.getAllByText('Products').length).toBeGreaterThan(0)
    expect(screen.getByPlaceholderText(/Wholesale cases/i)).toBeTruthy()
    expect(screen.getAllByText(/one item per line/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/not available yet/i)).toBeTruthy()
  })

  it('shows unsaved changes and discard for AI edits', async () => {
    const user = userEvent.setup()
    render(
      React.createElement(WorkspaceAIConfiguration, {
        workspaceId: 'ws_1',
        canEdit: true,
        initialProfile: baseProfile,
        initialActivity: [],
        workspaceConfig: { businessModel: 'DIRECT_SALES' },
      }),
    )

    await user.type(screen.getAllByRole('textbox')[0], 'We fix HVAC systems.')

    expect(screen.getAllByText(/unsaved changes/i).length).toBeGreaterThan(0)
    await user.click(screen.getAllByRole('button', { name: /discard/i })[0])
    expect(screen.queryByText(/unsaved changes/i)).toBeNull()
    expect(
      (screen.getAllByRole('textbox')[0] as HTMLTextAreaElement).value,
    ).toBe('')
  })

  it('keeps AI text fields mounted and focused while typing', async () => {
    const user = userEvent.setup()
    render(
      React.createElement(WorkspaceAIConfiguration, {
        workspaceId: 'ws_1',
        canEdit: true,
        initialProfile: baseProfile,
        initialActivity: [],
        workspaceConfig: { businessModel: 'DIRECT_SALES' },
      }),
    )

    const fields = screen.getAllByRole('textbox') as HTMLTextAreaElement[]
    await user.click(fields[0])
    await user.keyboard('We follow up with homeowners after service.')

    expect(document.activeElement).toBe(fields[0])
    expect(fields[0].value).toBe('We follow up with homeowners after service.')

    await user.click(fields[1])
    await user.keyboard('HVAC repair{Enter}Maintenance plans')

    expect(document.activeElement).toBe(fields[1])
    expect(fields[1].value).toBe('HVAC repair\nMaintenance plans')
    expect(fields[0].value).toBe('We follow up with homeowners after service.')
    expect(screen.getAllByText(/unsaved changes/i).length).toBeGreaterThan(0)
  })
})

describe('SalesProcessSettings', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  const directConfig = {
    businessModel: 'DIRECT_SALES',
    opportunitiesEnabled: false,
    commerceEnabled: false,
    defaultLeadDestination: 'SALE',
    allowDirectLeadToSale: true,
    customerSingularLabel: 'Client',
    customerPluralLabel: 'Clients',
    salesLabel: 'Sales',
  }

  const consultativeConfig = {
    businessModel: 'CONSULTATIVE_SALES',
    opportunitiesEnabled: true,
    commerceEnabled: false,
    defaultLeadDestination: 'OPPORTUNITY',
    allowDirectLeadToSale: true,
    customerSingularLabel: 'Client',
    customerPluralLabel: 'Clients',
    salesLabel: 'Sales',
  }

  it('marks layout changes dirty and explains save is required', async () => {
    const user = userEvent.setup()
    render(
      React.createElement(SalesProcessSettings, {
        workspaceId: 'ws_1',
        canEdit: true,
        initialConfig: directConfig,
      }),
    )

    await user.selectOptions(
      screen.getByLabelText(/workspace layout/i),
      'PRODUCT_COMMERCE',
    )

    expect(screen.getAllByText(/unsaved changes/i).length).toBeGreaterThan(0)
    expect(
      screen.getByText(/save these changes to apply the new workspace layout/i),
    ).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /discard/i }))
    expect(screen.queryByText(/unsaved changes/i)).toBeNull()
  })

  it('shows a read-only Lead to Sale summary when Opportunities is disabled', () => {
    render(
      React.createElement(SalesProcessSettings, {
        workspaceId: 'ws_1',
        canEdit: true,
        initialConfig: directConfig,
      }),
    )

    expect(screen.getByText('Lead → Sale')).toBeTruthy()
    expect(
      screen.getByText(/converted leads move directly into sales/i),
    ).toBeTruthy()
    expect(screen.queryByLabelText(/default lead destination/i)).toBeNull()
    expect(screen.queryByText(/allow direct conversion to sale/i)).toBeNull()
    expect(screen.getAllByRole('combobox')).toHaveLength(1)
  })

  it('shows conversion path cards when Opportunities is enabled', () => {
    render(
      React.createElement(SalesProcessSettings, {
        workspaceId: 'ws_1',
        canEdit: true,
        initialConfig: consultativeConfig,
      }),
    )

    const group = screen.getByRole('radiogroup', {
      name: /lead conversion path/i,
    })
    expect(
      within(group).getByRole('radio', { name: /convert to opportunity/i }),
    ).toBeTruthy()
    expect(
      within(group).getByRole('radio', { name: /convert directly to sale/i }),
    ).toBeTruthy()
    expect(within(group).getByText(/recommended/i)).toBeTruthy()
    expect(screen.getByText(/allow direct conversion to sale/i)).toBeTruthy()
  })

  it('lets users select the pending conversion destination independently of the override toggle', async () => {
    const user = userEvent.setup()
    render(
      React.createElement(SalesProcessSettings, {
        workspaceId: 'ws_1',
        canEdit: true,
        initialConfig: consultativeConfig,
      }),
    )

    const opportunity = screen.getByRole('radio', {
      name: /convert to opportunity/i,
    })
    const sale = screen.getByRole('radio', {
      name: /convert directly to sale/i,
    })
    const override = screen.getByLabelText(/allow direct conversion to sale/i)

    expect(opportunity.getAttribute('aria-checked')).toBe('true')
    expect((override as HTMLInputElement).checked).toBe(true)

    await user.click(sale)

    expect(sale.getAttribute('aria-checked')).toBe('true')
    expect((override as HTMLInputElement).checked).toBe(true)
    expect(screen.getAllByText(/unsaved changes/i).length).toBeGreaterThan(0)

    await user.click(opportunity)

    expect(opportunity.getAttribute('aria-checked')).toBe('true')
  })

  it('supports keyboard selection for conversion destination cards', async () => {
    const user = userEvent.setup()
    render(
      React.createElement(SalesProcessSettings, {
        workspaceId: 'ws_1',
        canEdit: true,
        initialConfig: consultativeConfig,
      }),
    )

    const sale = screen.getByRole('radio', {
      name: /convert directly to sale/i,
    })
    sale.focus()
    await user.keyboard('{Enter}')

    expect(sale.getAttribute('aria-checked')).toBe('true')
  })

  it('turning Opportunities off normalizes the pending destination to Sale', async () => {
    const fetchMock = mockFetch({
      ok: true,
      body: {
        workspace: {
          ...consultativeConfig,
          opportunitiesEnabled: false,
          defaultLeadDestination: 'SALE',
        },
      },
    })
    const user = userEvent.setup()
    render(
      React.createElement(SalesProcessSettings, {
        workspaceId: 'ws_1',
        canEdit: true,
        initialConfig: consultativeConfig,
      }),
    )

    await user.click(screen.getByLabelText(/opportunities pipeline enabled/i))

    expect(screen.getByText('Lead → Sale')).toBeTruthy()
    expect(
      screen.queryByRole('radiogroup', { name: /lead conversion path/i }),
    ).toBeNull()
    expect(screen.queryByText(/allow direct conversion to sale/i)).toBeNull()

    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      opportunitiesEnabled: false,
      defaultLeadDestination: 'SALE',
    })
  })

  it('discard restores the saved conversion path', async () => {
    const user = userEvent.setup()
    render(
      React.createElement(SalesProcessSettings, {
        workspaceId: 'ws_1',
        canEdit: true,
        initialConfig: consultativeConfig,
      }),
    )

    await user.click(
      screen.getByRole('radio', { name: /convert directly to sale/i }),
    )
    expect(
      screen
        .getByRole('radio', { name: /convert directly to sale/i })
        .getAttribute('aria-checked'),
    ).toBe('true')

    await user.click(screen.getByRole('button', { name: /discard/i }))

    expect(
      screen
        .getByRole('radio', { name: /convert to opportunity/i })
        .getAttribute('aria-checked'),
    ).toBe('true')
    expect(screen.queryByText(/unsaved changes/i)).toBeNull()
  })

  it('save applies the selected conversion path and clears dirty state', async () => {
    const fetchMock = mockFetch({
      ok: true,
      body: {
        workspace: {
          ...consultativeConfig,
          defaultLeadDestination: 'SALE',
        },
      },
    })
    const user = userEvent.setup()
    render(
      React.createElement(SalesProcessSettings, {
        workspaceId: 'ws_1',
        canEdit: true,
        initialConfig: consultativeConfig,
      }),
    )

    await user.click(
      screen.getByRole('radio', { name: /convert directly to sale/i }),
    )
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      defaultLeadDestination: 'SALE',
      allowDirectLeadToSale: true,
    })
    await waitFor(() =>
      expect(screen.queryByText(/unsaved changes/i)).toBeNull(),
    )
  })

  it('distinguishes saved and pending workspace layout labels', async () => {
    const user = userEvent.setup()
    render(
      React.createElement(SalesProcessSettings, {
        workspaceId: 'ws_1',
        canEdit: true,
        initialConfig: directConfig,
      }),
    )

    expect(screen.getByText(/current: sales & services/i)).toBeTruthy()
    await user.selectOptions(
      screen.getByLabelText(/workspace layout/i),
      'CONSULTATIVE_SALES',
    )

    expect(screen.getByText(/current: sales & services/i)).toBeTruthy()
    expect(screen.getByText(/pending: consultative sales/i)).toBeTruthy()
  })

  it('does not present service lead conversion controls for product & commerce without Leads', () => {
    render(
      React.createElement(SalesProcessSettings, {
        workspaceId: 'ws_1',
        canEdit: true,
        initialConfig: {
          businessModel: 'PRODUCT_COMMERCE',
          opportunitiesEnabled: false,
          commerceEnabled: true,
          defaultLeadDestination: 'CUSTOMER',
          allowDirectLeadToSale: false,
          customerSingularLabel: 'Customer',
          customerPluralLabel: 'Customers',
          salesLabel: 'Orders',
        },
      }),
    )

    expect(screen.getAllByText(/commerce structure/i).length).toBeGreaterThan(0)
    expect(
      screen.getAllByText(/customer → order → fulfillment/i).length,
    ).toBeGreaterThan(0)
    expect(screen.getByText(/future commerce crm capabilities/i)).toBeTruthy()
    expect(
      screen.queryByRole('radiogroup', { name: /lead conversion path/i }),
    ).toBeNull()
  })
})
