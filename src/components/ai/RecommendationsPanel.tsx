'use client'

import { useState, useEffect } from 'react'
import { useRecommendations, Recommendation } from '@/hooks/useRecommendations'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Sparkles, Loader2 } from 'lucide-react'
import { RecommendationCard } from './RecommendationCard'

interface RecommendationsPanelProps {
  playlistId: string
}

export function RecommendationsPanel({ playlistId }: RecommendationsPanelProps) {
  const { recommendations, loading, error, fetchRecommendations } =
    useRecommendations()
  const [hasFetched, setHasFetched] = useState(false)

  useEffect(() => {
    if (playlistId && !hasFetched) {
      fetchRecommendations(playlistId)
      setHasFetched(true)
    }
  }, [playlistId, hasFetched, fetchRecommendations])

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center">
            <Sparkles className="h-5 w-5 mr-2" />
            AI Recommendations
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() => fetchRecommendations(playlistId)}
            disabled={loading}
          >
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <div className="text-sm text-destructive py-4">{error}</div>
        )}

        {!loading && !error && recommendations.length === 0 && (
          <div className="text-sm text-muted-foreground py-4">
            No recommendations available. Click refresh to generate some!
          </div>
        )}

        {!loading && !error && recommendations.length > 0 && (
          <div className="space-y-3">
            {recommendations.map((rec, index) => (
              <RecommendationCard key={index} recommendation={rec} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}






