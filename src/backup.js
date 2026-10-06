const datePattern = /^\d{4}-\d{2}-\d{2}$/
const validDate = (value) => typeof value === 'string' && datePattern.test(value) &&
  !Number.isNaN(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value

export function makeBackup(grows, exportedAt = new Date().toISOString()) {
  return JSON.stringify({ version: 1, exportedAt, grows }, null, 2)
}

export function readBackup(text) {
  if (text.length > 30_000_000) throw new Error('This backup is too large to import.')
  let backup
  try { backup = JSON.parse(text) } catch { throw new Error('This is not a valid JSON backup.') }
  if (backup?.version !== 1 || !Array.isArray(backup.grows) || backup.grows.length > 200) {
    throw new Error('This is not a supported Fieldnotes backup.')
  }
  const ids = new Set()
  for (const grow of backup.grows) {
    if (!grow || typeof grow !== 'object' || typeof grow.id !== 'string' || !grow.id || ids.has(grow.id) ||
      typeof grow.name !== 'string' || typeof grow.crop !== 'string' ||
      !validDate(grow.startDate) || !Array.isArray(grow.durations) || grow.durations.length !== 4 ||
        !grow.durations.every((days) => Number.isInteger(days) && days >= 1 && days <= 365) ||
        !['waterEvery', 'feedEvery'].every((field) => Number.isInteger(grow[field]) && grow[field] >= 0 && grow[field] <= 365) ||
        !Array.isArray(grow.photos) || grow.photos.length > 100 ||
      (grow.harvestedAt && !validDate(grow.harvestedAt))) {
      throw new Error('The backup contains an invalid grow record.')
    }
    ids.add(grow.id)
    for (const photo of grow.photos) {
      if (!photo || typeof photo !== 'object' || typeof photo.id !== 'string' || typeof photo.note !== 'string' ||
          typeof photo.image !== 'string' || photo.image.length > 1_500_000 ||
          !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(photo.image) ||
          (photo.review && !['imageQuality', 'visibleCues', 'assessment', 'nextCheck'].every((field) => typeof photo.review[field] === 'string'))) {
        throw new Error('The backup contains an invalid photo record.')
      }
    }
  }
  return backup.grows
}