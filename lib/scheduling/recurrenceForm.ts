import {
  getDateKeyWeekday,
  isSchedulingDateKey,
} from '@/lib/scheduling/schedulingDateTime'
import type { SchedulingRecurrenceRule } from '@/lib/scheduling/types'

export type SchedulingRecurrenceFormInput = {
  repeat: string
  date: string
  customInterval: number
  customFrequency: 'daily' | 'weekly' | 'monthly'
  customWeekdays: number[]
  customEndType: 'never' | 'onDate' | 'afterOccurrences'
  customEndDate: string
  customCount: number
}

export function buildSchedulingRecurrenceRule({
  repeat,
  date,
  customInterval,
  customFrequency,
  customWeekdays,
  customEndType,
  customEndDate,
  customCount,
}: SchedulingRecurrenceFormInput): SchedulingRecurrenceRule | null {
  if (!isSchedulingDateKey(date)) return null
  const weekday = getDateKeyWeekday(date)
  if (repeat === 'daily') {
    return { frequency: 'daily', interval: 1, endType: 'never' }
  }
  if (repeat === 'weekly') {
    return {
      frequency: 'weekly',
      interval: 1,
      daysOfWeek: [weekday],
      endType: 'never',
    }
  }
  if (repeat === 'everyTwoWeeks') {
    return {
      frequency: 'weekly',
      interval: 2,
      daysOfWeek: [weekday],
      endType: 'never',
    }
  }
  if (repeat === 'monthly') {
    return { frequency: 'monthly', interval: 1, endType: 'never' }
  }
  if (repeat === 'annually') {
    return { frequency: 'yearly', interval: 1, endType: 'never' }
  }
  if (repeat !== 'custom') return null
  return {
    frequency: customFrequency,
    interval: Math.max(1, customInterval),
    daysOfWeek: customFrequency === 'weekly' ? customWeekdays : undefined,
    endType: customEndType,
    endDate: customEndType === 'onDate' ? customEndDate : undefined,
    occurrenceCount:
      customEndType === 'afterOccurrences' ? customCount : undefined,
  }
}
