export function hasPlan(userPlan: string, required?: string) {
  if (!required) return true

  const order = ['Free', 'Basic', 'Pro', 'Elite']
  return order.indexOf(userPlan) >= order.indexOf(required)
}
