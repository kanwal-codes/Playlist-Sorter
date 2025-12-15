import { useState } from 'react'

export interface Recommendation {
  song: string
  artist: string
  reason: string
}

export function useRecommendations() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchRecommendations = async (playlistId: string) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/ai/recommendations?playlistId=${playlistId}`,
        { credentials: 'include' } // Include cookies in request
      )
      if (response.ok) {
        try {
          const data = await response.json()
          setRecommendations(data.recommendations || [])
        } catch (error) {
          console.error('Failed to parse recommendations data:', error)
          setError('Failed to parse recommendations')
        }
      } else {
        try {
          const errorData = await response.json()
          setError(errorData.error || 'Failed to fetch recommendations')
        } catch (parseError) {
          console.error('Failed to parse error response:', parseError)
          setError('Failed to fetch recommendations')
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return {
    recommendations,
    loading,
    error,
    fetchRecommendations,
  }
}


