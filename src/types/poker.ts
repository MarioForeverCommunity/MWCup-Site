export interface PokerCard {
  cardCode: string
  year: string
  round: string
  playerCode: string
  levelNickname: string
  comment1: string
  commentAuthor1: string
  comment2: string
  commentAuthor2: string
}

export interface PokerData {
  year: string
  cards: PokerCard[]
}

export type SuitType = 'S' | 'H' | 'C' | 'D' | 'R' | 'B'

export interface CardDisplayInfo {
  suit: SuitType
  rank: number
  displayName: string
  imageName: string
}

export function getCardDisplayInfo(cardCode: string): CardDisplayInfo {
  const suitMap: Record<string, { suit: SuitType; name: string; color: string }> = {
    S: { suit: 'S', name: '♠', color: '#000' },
    H: { suit: 'H', name: '♥', color: '#e31b23' },
    C: { suit: 'C', name: '♣', color: '#000' },
    D: { suit: 'D', name: '♦', color: '#e31b23' },
    R: { suit: 'R', name: '大王', color: '#e31b23' },
    B: { suit: 'B', name: '小王', color: '#000' }
  }

  const rankNames: Record<string, string> = {
    '1': 'A',
    '11': 'J',
    '12': 'Q',
    '13': 'K'
  }

  if (cardCode === 'R') {
    return {
      suit: 'R',
      rank: 0,
      displayName: '大王',
      imageName: 'R'
    }
  }

  if (cardCode === 'B') {
    return {
      suit: 'B',
      rank: 0,
      displayName: '小王',
      imageName: 'B'
    }
  }

  const suitChar = cardCode.charAt(0)
  const rankStr = cardCode.substring(1)
  const rank = parseInt(rankStr, 10)
  const suitInfo = suitMap[suitChar]
  const rankName = rankNames[rankStr] || rankStr

  return {
    suit: suitInfo.suit,
    rank,
    displayName: `${suitInfo.name}${rankName}`,
    imageName: cardCode
  }
}

export function getCardSortOrder(cardCode: string): number {
  const suitOrder: Record<string, number> = {
    R: 0,
    B: 1,
    S: 2,
    H: 3,
    C: 4,
    D: 5
  }

  if (cardCode === 'R') return 0
  if (cardCode === 'B') return 1

  const suitChar = cardCode.charAt(0)
  const rankStr = cardCode.substring(1)
  const rank = parseInt(rankStr, 10)

  return suitOrder[suitChar] * 100 + rank
}
