import test from 'node:test'
import assert from 'node:assert/strict'
import { assessImage, visionMiddleware } from './vision.js'

const image = 'data:image/jpeg;base64,/9j/AA=='

test('rejects invalid images before calling a provider', async () => {
  let called = false
  await assert.rejects(assessImage({ crop: 'Tomatoes', image: 'https://example.com/photo' }, () => { called = true }), TypeError)
  assert.equal(called, false)
})

test('sends the image as vision input and accepts an insufficient assessment', async () => {
  const result = await assessImage({ crop: 'Tomatoes', image }, async (request) => {
    assert.equal(request.input[0].content[1].image_url, image)
    assert.equal(request.text.format.type, 'json_schema')
    return { output_text: JSON.stringify({ imageQuality: 'insufficient', visibleCues: 'Fruit is out of focus.', assessment: 'Cannot judge ripeness.', nextCheck: 'Take another photo in daylight.' }) }
  })
  assert.equal(result.imageQuality, 'insufficient')
  assert.match(result.assessment, /Cannot judge/)
})

test('returns a configuration error without exposing a credential', async () => {
  const response = { headers: {}, setHeader(name, value) { this.headers[name] = value }, end(body) { this.body = JSON.parse(body) } }
  await visionMiddleware(null)({ url: '/api/vision', method: 'POST' }, response, () => {})
  assert.equal(response.statusCode, 503)
  assert.match(response.body.error, /OPENAI_API_KEY/)
  assert.equal(response.headers['Cache-Control'], 'no-store')
})