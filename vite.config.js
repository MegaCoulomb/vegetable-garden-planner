import { defineConfig, loadEnv } from 'vite'
import OpenAI from 'openai'
import { visionMiddleware } from './server/vision.js'

function visionPlugin() {
  return {
    name: 'fieldnotes-vision',
    configureServer(server) {
      const { OPENAI_API_KEY } = { ...loadEnv(server.config.mode, process.cwd(), 'OPENAI_'), ...process.env }
      const client = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null
      server.middlewares.use(visionMiddleware(client ? client.responses.create.bind(client.responses) : null))
    },
    configurePreviewServer(server) {
      const { OPENAI_API_KEY } = { ...loadEnv(server.config.mode, process.cwd(), 'OPENAI_'), ...process.env }
      const client = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null
      server.middlewares.use(visionMiddleware(client ? client.responses.create.bind(client.responses) : null))
    },
  }
}

export default defineConfig({ plugins: [visionPlugin()] })