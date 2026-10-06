import test from 'node:test'
import assert from 'node:assert/strict'
import { makeBackup, readBackup } from './backup.js'

const grow = {
  id: 'grow-1', name: 'Test', crop: 'Tomatoes', startDate: '2026-05-01', durations: [10, 20, 40, 15],
  waterEvery: 2, feedEvery: 7, harvestedAt: '2026-07-25', harvestedPlanDate: '2026-07-25',
  photos: [{ id: 'photo-1', image: 'data:image/jpeg;base64,/9j/AA==', note: 'Fruit color check', review: { imageQuality: 'adequate', visibleCues: 'Visible', assessment: 'Inconclusive', nextCheck: 'Look again' } }],
}

test('exports and restores photos, user notes, AI comments and harvest comparison dates', () => {
  assert.deepEqual(readBackup(makeBackup([grow])), [grow])
})

test('rejects invalid JSON, duplicate ids and unsafe photo data', () => {
  assert.throws(() => readBackup('{bad'), /valid JSON/)
  assert.throws(() => readBackup(makeBackup([grow, grow])), /invalid grow/)
  assert.throws(() => readBackup(makeBackup([{ ...grow, startDate: '2026-99-99' }])), /invalid grow/)
  assert.throws(() => readBackup(makeBackup([null])), /invalid grow/)
  assert.throws(() => readBackup(makeBackup([{ ...grow, photos: [{ ...grow.photos[0], image: 'javascript:alert(1)' }] }])), /invalid photo/)
})