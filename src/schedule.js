export const day = (date) => date.toISOString().slice(0, 10)

export function addDays(value, count) {
  const date = new Date(`${value}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + Number(count))
  return day(date)
}

export function daysBetween(from, to) {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000)
}

export function stagesFor(grow) {
  const labels = ['Establish', 'Grow', 'Flower / fruit', 'Finish']
  let offset = 0
  return labels.map((label, index) => {
    const start = addDays(grow.startDate, offset)
    offset += Number(grow.durations[index])
    return { label, start, end: addDays(grow.startDate, offset), days: Number(grow.durations[index]) }
  })
}

export function harvestDate(grow) {
  return stagesFor(grow).at(-1).end
}

export function growComparison(grow) {
  if (!grow.harvestedAt) return null
  const planned = grow.harvestedPlanDate || harvestDate(grow)
  return {
    planned,
    actual: grow.harvestedAt,
    plannedDays: daysBetween(grow.startDate, planned),
    actualDays: daysBetween(grow.startDate, grow.harvestedAt),
    differenceDays: daysBetween(planned, grow.harvestedAt),
  }
}

export function stageAt(grow, today) {
  if (daysBetween(today, grow.startDate) > 0) return 'Planned'
  if (daysBetween(harvestDate(grow), today) >= 0) return 'Harvest check'
  return stagesFor(grow).find((stage) => today < stage.end)?.label ?? 'Harvest check'
}

export function nextCareDate(grow, kind, today) {
  const interval = Number(kind === 'water' ? grow.waterEvery : grow.feedEvery)
  if (!interval) return null
  const last = kind === 'water' ? grow.lastWatered : grow.lastFed
  if (last) return addDays(last, interval)
  if (today < grow.startDate) return addDays(grow.startDate, interval)
  const elapsed = daysBetween(grow.startDate, today)
  return addDays(grow.startDate, Math.floor(elapsed / interval) * interval)
}

export function suggestedPlan(crop) {
  const durations = {
    Tomatoes: [10, 45, 30, 35], Peppers: [12, 50, 35, 40], Lettuce: [7, 25, 10, 5],
  }[crop] || [10, 35, 30, 25]
  return { durations, waterEvery: 2, feedEvery: 14 }
}

export function careDatesFor(grow, kind, from = grow.startDate, count = 8) {
  const interval = Number(kind === 'water' ? grow.waterEvery : grow.feedEvery)
  if (!interval || grow.harvested) return []
  const end = harvestDate(grow)
  const anchor = kind === 'water' ? grow.lastWatered : grow.lastFed
  let date = anchor ? addDays(anchor, interval) : addDays(grow.startDate, interval)
  while (date < from) date = addDays(date, interval)
  const dates = []
  while (date < end && dates.length < count) {
    dates.push(date)
    date = addDays(date, interval)
  }
  return dates
}

export function weeklyChecklist(grow) {
  const end = harvestDate(grow)
  const stages = stagesFor(grow)
  const weeks = []
  let date = grow.startDate
  while (date <= end) {
    const start = date
    const days = []
    do {
      const elapsed = daysBetween(grow.startDate, date)
      const tasks = []
      if (elapsed === 0) tasks.push('Start grow')
      const stage = stages.find((item) => item.start === date && item.start !== grow.startDate)
      if (stage) tasks.push(`Begin ${stage.label}`)
      if (date === end) tasks.push('Inspect for harvest')
      if (date < end && elapsed > 0) {
        if (grow.waterEvery && elapsed % Number(grow.waterEvery) === 0) tasks.push('Check water needs')
        if (grow.feedEvery && elapsed % Number(grow.feedEvery) === 0) tasks.push('Review feeding needs')
      }
      days.push({ date, stage: stageAt(grow, date), tasks })
      date = addDays(date, 1)
    } while (date <= end && (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7 !== 0)
    weeks.push({ start, end: days.at(-1).date, days })
  }
  return weeks
}

export function plannedCycles(year) {
  return [
    { name: 'Peppers (start indoors)', crop: 'Peppers', startDate: `${year}-02-20`, location: 'Indoor' },
    { name: 'Tomatoes (start indoors)', crop: 'Tomatoes', startDate: `${year}-03-01`, location: 'Indoor' },
    { name: 'Spring lettuce', crop: 'Lettuce', startDate: `${year}-03-20`, location: 'Outdoor' },
    { name: 'Summer beans', crop: 'Beans', startDate: `${year}-05-20`, location: 'Outdoor' },
  ].map((cycle) => ({ ...cycle, ...suggestedPlan(cycle.crop), lastWatered: '', lastFed: '', notes: '', photos: [], harvested: false }))
}