'use client'

import { Recommendation } from '@/hooks/useRecommendations'
import { Card, CardContent } from '@/components/ui/card'
import { Music } from 'lucide-react'

interface RecommendationCardProps {
  recommendation: Recommendation
}

export function RecommendationCard({ recommendation }: RecommendationCardProps) {
  return (
    <Card className="border-l-4 border-l-primary">
      <CardContent className="p-4">
        <div className="flex items-start space-x-3">
          <Music className="h-5 w-5 text-primary mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">
              {recommendation.song} by {recommendation.artist}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {recommendation.reason}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}






