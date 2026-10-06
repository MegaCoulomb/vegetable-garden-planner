import test from 'node:test'
import assert from 'node:assert/strict'
import { addDays, daysBetween, stagesFor, harvestDate, stageAt, nextCareDate, plannedCycles, suggestedPlan, careDatesFor, growComparison, weeklyChecklist } from './schedule.js'

test('date math crosses month and leap day without local timezone drift', () => {
  assert.equal(addDays('2028-02-28', 2), '2028-03-01')
  assert.equal(daysBetween('2028-02-28', '2028-03-01'), 2)
})

test('stages and harvest are based on editable durations', () => {
  const grow = { startDate: '2026-05-01', durations: [7, 14, 21, 7] }
  assert.equal(stagesFor(grow)[1].start, '2026-05-08')
  assert.equal(harvestDate(grow), '2026-06-19')
  assert.equal(stageAt(grow, '2026-05-01'), 'Establish')
  assert.equal(stageAt(grow, '2026-04-30'), 'Planned')
  assert.equal(stageAt(grow, '2026-06-19'), 'Harvest check')
})

test('empirical timing compares against a saved theoretical snapshot', () => {
  const grow = { startDate: '2026-05-01', durations: [7, 14, 21, 7], harvestedAt: '2026-06-22', harvestedPlanDate: '2026-06-19' }
  assert.deepEqual(growComparison(grow), { planned: '2026-06-19', actual: '2026-06-22', plannedDays: 49, actualDays: 52, differenceDays: 3 })
  assert.equal(growComparison({ ...grow, harvestedAt: '' }), null)
  assert.equal(growComparison({ ...grow, harvestedAt: '2026-06-15' }).differenceDays, -4)
})

test('care can be disabled, planned, or anchored to last completion', () => {
  const grow = { startDate: '2026-05-01', waterEvery: 3, feedEvery: 0, lastWatered: '', lastFed: '' }
  assert.equal(nextCareDate(grow, 'water', '2026-04-20'), '2026-05-04')
  assert.equal(nextCareDate(grow, 'water', '2026-05-08'), '2026-05-07')
  assert.equal(nextCareDate({ ...grow, lastWatered: '2026-05-08' }, 'water', '2026-05-08'), '2026-05-11')
  assert.equal(nextCareDate(grow, 'feed', '2026-05-08'), null)
})

test('a new plan suggests editable stage lengths and care checks per crop', () => {
  assert.deepEqual(suggestedPlan('Tomatoes', 'Outdoor').durations, [10, 45, 30, 35])
  assert.deepEqual(suggestedPlan('Lettuce', 'Outdoor').durations, [7, 25, 10, 5])
  assert.deepEqual(suggestedPlan('Squash', 'Outdoor').durations, [10, 35, 30, 25])
  assert.equal(suggestedPlan('Tomatoes', 'Outdoor').feedEvery, 14)
})

test('planned checks stay before harvest and shift after a completed check', () => {
  const grow = { startDate: '2026-05-01', durations: [2, 3, 4, 1], waterEvery: 3, feedEvery: 7 }
  assert.deepEqual(careDatesFor(grow, 'water'), ['2026-05-04', '2026-05-07', '2026-05-10'])
  assert.deepEqual(careDatesFor({ ...grow, lastWatered: '2026-05-05' }, 'water', '2026-05-06'), ['2026-05-08'])
  assert.deepEqual(careDatesFor({ ...grow, harvested: true }, 'feed'), [])
})

test('weekly print checklist aligns to Monday, crosses a month, and includes the harvest inspection', () => {
  const grow = { startDate: '2026-05-29', durations: [2, 2, 2, 2], waterEvery: 2, feedEvery: 4 }
  const weeks = weeklyChecklist(grow)
  assert.deepEqual(weeks.map(({ start, end }) => [start, end]), [['2026-05-29', '2026-05-31'], ['2026-06-01', '2026-06-06']])
  assert.deepEqual(weeks[0].days[0].tasks, ['Start grow'])
  assert.deepEqual(weeks[1].days[1].tasks, ['Begin Flower / fruit', 'Check water needs', 'Review feeding needs'])
  assert.deepEqual(weeks.at(-1).days.at(-1).tasks, ['Inspect for harvest'])
})

test('weekly print checklist has no care tasks when disabled, even for a harvested grow', () => {
  const grow = { startDate: '2026-12-31', durations: [1, 1, 1, 1], waterEvery: 0, feedEvery: 0, harvested: true }
  const days = weeklyChecklist(grow).flatMap((week) => week.days)
  assert.equal(days.length, 5)
  assert.equal(days.at(-1).date, '2027-01-04')
  assert.equal(days.filter((entry) => entry.tasks.includes('Inspect for harvest')).length, 1)
  assert.ok(days.every((entry) => !entry.tasks.includes('Check water needs')))
})

test('season starter plan follows the seasonal guide and finishes within the year', () => {
  const cycles = plannedCycles(2027)
  assert.deepEqual(cycles.map((cycle) => cycle.crop), ['Peppers', 'Tomatoes', 'Lettuce', 'Beans'])
  assert.equal(cycles.filter((cycle) => cycle.location === 'Indoor').length, 2)
  assert.equal(cycles[0].startDate, '2027-02-20')
  assert.ok(cycles.every((cycle) => harvestDate(cycle) <= '2027-12-31'))
})