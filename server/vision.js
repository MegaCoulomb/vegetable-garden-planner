const schema = {
  type: 'object',
  properties: {
    imageQuality: { type: 'string', enum: ['adequate', 'insufficient'] },
    visibleCues: { type: 'string' },
    assessment: { type: 'string' },
    nextCheck: { type: 'string' },
  },
  required: ['imageQuality', 'visibleCues', 'assessment', 'nextCheck'],
  additionalProperties: false,
}

export async function assessImage({ crop, image }, create) {
  if (typeof crop !== 'string' || !crop.trim() || crop.length > 80 ||
      typeof image !== 'string' || image.length > 1_500_000 ||
      !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(image)) {
    throw new TypeError('Provide a crop and a JPEG photo smaller than 1 MB.')
  }

  const response = await create({
    model: 'gpt-4.1-mini',
    input: [{
      role: 'user',
      content: [
        { type: 'input_text', text: `Assess this ${crop} plant photo as a cautious visual field observation. Describe only features actually visible. Discuss crop-specific color and development only when the edible part is visible. If the crop, focus, lighting, or magnification prevents assessment, set imageQuality to insufficient and explain why. Give a suggested visual follow-up, not a harvest verdict. Do not claim food safety or an exact harvest date. Keep each field concise.` },
        { type: 'input_image', image_url: image, detail: 'high' },
      ],
    }],
    text: { format: { type: 'json_schema', name: 'garden_visual_check', schema, strict: true } },
    max_output_tokens: 400,
  })
  const result = JSON.parse(response.output_text || 'null')
  if (!result || !['adequate', 'insufficient'].includes(result.imageQuality) ||
      !['visibleCues', 'assessment', 'nextCheck'].every((field) => typeof result[field] === 'string')) {
    throw new Error('The vision service did not return an assessment.')
  }
  return result
}

export function visionMiddleware(create) {
  return async (request, response, next) => {
    if (request.url?.split('?')[0] !== '/api/vision') return next()
    response.setHeader('Content-Type', 'application/json; charset=utf-8')
    response.setHeader('Cache-Control', 'no-store')
    if (request.method !== 'POST') {
      response.statusCode = 405
      response.end(JSON.stringify({ error: 'Use POST to check a photo.' }))
      return
    }
    if (!create) {
      response.statusCode = 503
      response.end(JSON.stringify({ error: 'Vision is not configured. Set OPENAI_API_KEY in .env.local and restart the server.' }))
      return
    }
    try {
      let body = ''
      for await (const chunk of request) {
        body += chunk
        if (body.length > 1_600_000) {
          response.statusCode = 413
          response.end(JSON.stringify({ error: 'Photo is too large to analyze.' }))
          return
        }
      }
      let input
      try { input = JSON.parse(body) } catch { input = null }
      const result = await assessImage(input || {}, create)
      response.end(JSON.stringify(result))
    } catch (error) {
      response.statusCode = error instanceof TypeError ? 400 : 502
      response.end(JSON.stringify({ error: error instanceof TypeError ? error.message : 'Vision review failed. Your photo can still be saved locally.' }))
    }
  }
}