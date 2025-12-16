import OpenAI from 'openai'

// Lazy initialization to avoid errors during build when OPENAI_API_KEY is not set
let openaiInstance: OpenAI | null = null

function getOpenAI(): OpenAI {
  if (!openaiInstance) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error(
        'OPENAI_API_KEY is not set. OpenAI features require an API key.'
      )
    }
    openaiInstance = new OpenAI({
      apiKey,
    })
  }
  return openaiInstance
}

export { getOpenAI }






