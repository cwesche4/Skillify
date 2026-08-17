export const commerceNumericInputRules = {
  money: {
    min: '0',
    step: '0.01',
    inputMode: 'decimal',
  },
  quantity: {
    min: '1',
    step: '1',
    inputMode: 'numeric',
  },
  inventory: {
    min: '0',
    step: '1',
    inputMode: 'numeric',
  },
  percentage: {
    min: '0',
    max: '100',
    step: '1',
    inputMode: 'decimal',
  },
} as const
