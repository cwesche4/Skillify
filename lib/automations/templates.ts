// lib/automations/templates.ts

export type AutomationTemplate = {
  id: string
  slug: string
  name: string
  description: string
  category: "nurture" | "reminder" | "onboarding" | "cart"
  flow: any
}

export const AUTOMATION_TEMPLATES: AutomationTemplate[] = [
  {
    id: "lead-nurture-basic",
    slug: "lead-nurture-basic",
    name: "Lead Nurture • 3-touch",
    description: "Trigger → AI qualifying → Delay → Reminder webhook.",
    category: "nurture",
    flow: {
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          position: { x: 0, y: 0 },
          data: { label: "New lead created" },
        },
        {
          id: "ai-1",
          type: "ai-llm",
          position: { x: 240, y: 0 },
          data: {
            label: "Qualify lead",
            prompt: "Classify this lead and suggest next step.",
          },
        },
        {
          id: "delay-1",
          type: "delay",
          position: { x: 480, y: 0 },
          data: {
            label: "Wait 1 day",
            durationMinutes: 60 * 24,
          },
        },
        {
          id: "webhook-1",
          type: "webhook",
          position: { x: 720, y: 0 },
          data: {
            label: "Send follow-up",
            url: "https://example.com/webhook",
            method: "POST",
          },
        },
      ],
      edges: [
        { id: "e1", source: "trigger-1", target: "ai-1" },
        { id: "e2", source: "ai-1", target: "delay-1" },
        { id: "e3", source: "delay-1", target: "webhook-1" },
      ],
    },
  },
  {
    id: "abandoned-cart",
    slug: "abandoned-cart",
    name: "Abandoned Cart Recovery",
    description: "Trigger when cart abandoned → reminder → AI copy tweak.",
    category: "cart",
    flow: {
      nodes: [
        {
          id: "trigger-cart",
          type: "trigger",
          position: { x: 0, y: 0 },
          data: { label: "Cart abandoned" },
        },
        {
          id: "delay-cart",
          type: "delay",
          position: { x: 240, y: 0 },
          data: {
            label: "Wait 2 hours",
            durationMinutes: 120,
          },
        },
        {
          id: "ai-cart",
          type: "ai-llm",
          position: { x: 480, y: 0 },
          data: {
            label: "Write reminder copy",
            prompt: "Write a short message reminding user of their cart.",
          },
        },
        {
          id: "webhook-cart",
          type: "webhook",
          position: { x: 720, y: 0 },
          data: {
            label: "Send email",
            url: "https://example.com/email",
            method: "POST",
          },
        },
      ],
      edges: [
        { id: "ec1", source: "trigger-cart", target: "delay-cart" },
        { id: "ec2", source: "delay-cart", target: "ai-cart" },
        { id: "ec3", source: "ai-cart", target: "webhook-cart" },
      ],
    },
  },
]
