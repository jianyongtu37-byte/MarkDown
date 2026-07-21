export interface FlashcardVO {
  id: number
  articleId?: number
  articleTitle?: string
  frontText: string
  backText: string
  easeFactor?: number
  intervalDays?: number
  repetitions?: number
  nextReviewDate?: string
  lastReviewDate?: string
  reviewCount?: number
}

export interface ReviewResultVO {
  nextReviewDate: string
  newInterval: number
  cardsReviewedToday: number
  cardsRemaining: number
}

export interface FlashcardStatsVO {
  totalCards: number
  reviewedToday: number
  dueCount: number
  streak: number
}

export interface CreateFlashcardDTO {
  articleId?: number
  frontText: string
  backText: string
}
