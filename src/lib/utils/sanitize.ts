/**
 * Sanitize user input for safe use in prompts and API calls
 */

/**
 * Sanitizes text for use in OpenAI prompts to prevent prompt injection
 * @param text - Text to sanitize
 * @param maxLength - Maximum length (default: 200)
 * @returns Sanitized text
 */
export function sanitizeForPrompt(text: string, maxLength = 200): string {
  if (!text || typeof text !== 'string') {
    return ''
  }
  
  return text
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .replace(/[{}[\]\\]/g, '') // Remove JSON special characters that could break structure
    .replace(/["']/g, '') // Remove quotes that could break string parsing
    .slice(0, maxLength) // Limit length
    .trim()
}

/**
 * Sanitizes text for general use (removes control characters)
 * @param text - Text to sanitize
 * @returns Sanitized text
 */
export function sanitizeText(text: string): string {
  if (!text || typeof text !== 'string') {
    return ''
  }
  
  return text
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .trim()
}


