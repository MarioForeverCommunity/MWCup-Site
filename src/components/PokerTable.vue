<template>
  <div class="poker-module">
    <div v-if="loading" class="content-panel animate-fadeInUp">
      <div class="loading-state animate-pulse">
        <div class="loading-spinner"></div>
        <div class="loading-text">正在加载扑克牌数据<span class="loading-dots"></span></div>
      </div>
    </div>
    <div v-else-if="error" class="content-panel">
      <div class="error-state">{{ error }}</div>
    </div>
    <div v-else class="content-panel animate-fadeInUp">
      <div class="section-title">
        <h3>MW杯官方扑克牌 2020版</h3>
      </div>

      <div class="poker-intro">
        <p>Mario Worker杯扑克牌是MW杯推出的官方周边和纪念品，于2020年推出首版，收录了2013至2019年间的54个优秀关卡。2020版扑克牌共制造了若干套普通版扑克牌，以及14套冠、亚军纪念版扑克牌，后者作为2013至2019年MW杯冠、亚军选手的奖品发放。</p>
        <p>目前，2026版扑克牌正在筹备中，计划收录2020至2025年MW杯的优秀参赛关卡。</p>
      </div>

      <div class="draw-button-wrapper">
        <div class="draw-controls">
          <button class="btn-primary draw-btn" @click="randomDraw">抽一张牌</button>
          <div class="multi-draw-group">
            <input
              v-model.number="drawCount"
              type="number"
              min="2"
              max="10"
              class="draw-input"
            />
            <label class="joker-toggle">
              <input v-model="excludeJokers" type="checkbox" />
              <span>不抽大小王</span>
            </label>
            <button class="btn-primary draw-btn" @click="multiRandomDraw">抽多张牌</button>
          </div>
        </div>
      </div>

      <div class="poker-grid">
        <div
          v-for="card in sortedCards"
          :key="card.cardCode"
          class="poker-card"
          @click="openCardDetail(card)"
        >
          <div class="card-image-wrapper">
            <img
              :src="getCardImagePath(card.cardCode)"
              :alt="getCardDisplayInfo(card.cardCode).displayName"
              class="card-image"
              @error="handleImageError"
            />
          </div>
          <div class="card-info">
            <div class="card-name" :class="{ 'card-red': isRedCard(card.cardCode) }">
              {{ getCardDisplayInfo(card.cardCode).displayName }} {{ getCardMeaning(card.cardCode) }}
            </div>
            <div class="card-level-name">{{ getLevelDisplayName(card) }}</div>
            <div class="card-source">{{ getPlayerName(card) }} · {{ getYearWithEdition(card.year) }}{{ getRoundDisplayName(card.round) }}</div>
          </div>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="selectedCards.length > 0" class="card-detail-modal" @click.self="closeCardDetail">
          <button class="close-btn" @click="closeCardDetail">&times;</button>

          <div class="modal-body-container" @click.self="closeCardDetail">
            <div
              ref="scrollContainer"
              class="modal-content-scroll"
              :class="{ 'multi-card-layout': isMultipleDraw }"
              @click.self="closeCardDetail"
              @scroll="handleScroll"
            >
              <div
                v-for="card in selectedCards"
                :key="card.cardCode"
                class="poker-card-real"
                :class="{ 'poker-red': isRedCard(card.cardCode), 'multi-card-item': isMultipleDraw }"
              >
                <button v-if="isRandomDraw && !isMultipleDraw" class="btn-secondary poker-redraw-btn" @click="randomDraw">再次抽取</button>
                <div class="poker-corner poker-corner-tl">
                  <span class="corner-rank">{{ getPokerRank(card.cardCode) }}</span>
                  <img :src="getPokerSymbolPath(card.cardCode)" class="corner-symbol-img" alt="" />
                </div>
                <div class="poker-center">
                  <h2 class="poker-title" :class="{ 'poker-title-small': getTitleLength(card) > 28 }">{{ getLevelFileName(card) || card.levelNickname || '—' }}</h2>
                  <div class="poker-image-wrapper">
                    <img
                      :src="getCardImagePath(card.cardCode)"
                      :alt="getLevelFileName(card) || ''"
                      class="poker-image"
                    />
                  </div>
                  <div class="poker-comments">
                    <div v-if="card.comment1" class="comment-item">
                      <p class="comment-body" v-html="formatComment(card.comment1)"></p>
                      <p class="comment-author">——{{ card.commentAuthor1 }}</p>
                    </div>
                    <div v-if="card.comment2" class="comment-item">
                      <p class="comment-body" v-html="formatComment(card.comment2)"></p>
                      <p class="comment-author">——{{ card.commentAuthor2 }}</p>
                    </div>
                  </div>
                </div>
                <div class="poker-footer">
                  {{ card.playerCode }} {{ getPlayerName(card) }} {{ getYearWithEdition(card.year) }}{{ getRoundDisplayName(card.round) }}{{ !getLevelFileName(card) ? '*' : '' }}
                </div>
                <div class="poker-corner poker-corner-br">
                  <span class="corner-rank">{{ getPokerRank(card.cardCode) }}</span>
                  <img :src="getPokerSymbolPath(card.cardCode)" class="corner-symbol-img" alt="" />
                </div>
              </div>
            </div>

            <div v-if="isMultipleDraw" class="modal-actions">
              <div class="pagination-dots mobile-only">
                <span
                  v-for="(_, index) in selectedCards"
                  :key="index"
                  class="dot"
                  :class="{ active: index === activeIndex }"
                  @click="scrollToCard(index)"
                ></span>
              </div>
              <button class="btn-primary multi-redraw-btn desktop-only" @click="multiRandomDraw">全部重抽</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import Papa from 'papaparse'
import type { PokerCard } from '../types/poker'
import { getCardDisplayInfo, getCardSortOrder } from '../types/poker'
import { getRoundChineseName } from '../utils/roundNames'
import { fetchMarioWorkerYaml } from '../utils/yamlLoader'

interface LevelIndexItem {
  name: string
  path: string
  playerCode: string
  year: number
  roundType: string
  playerName: string
  roundKey: string
  groupCode: string | null
}

interface YamlPlayerMap {
  [year: string]: {
    [round: string]: {
      [playerCode: string]: string
    }
  }
}

const loading = ref(true)
const error = ref<string | null>(null)
const allCards = ref<PokerCard[]>([])
const levelIndex = ref<LevelIndexItem[]>([])
const yamlPlayerMap = ref<YamlPlayerMap>({})
const selectedCards = ref<PokerCard[]>([])
const isRandomDraw = ref(false)
const drawCount = ref(5)
const excludeJokers = ref(false)
const activeIndex = ref(0)
const scrollContainer = ref<HTMLElement | null>(null)
const isUpdatingCards = ref(false)
const isMultipleDraw = computed(() => selectedCards.value.length > 1)

const sortedCards = computed(() => {
  return [...allCards.value].sort((a, b) => getCardSortOrder(a.cardCode) - getCardSortOrder(b.cardCode))
})

function getCardImagePath(cardCode: string): string {
  return `/images/poker2020/${cardCode}.webp`
}

function handleImageError(event: Event): void {
  const target = event.target as HTMLImageElement
  target.style.display = 'none'
}

function formatComment(comment: string): string {
  return comment.replace(/\\n/g, '<br>　　')
}

function getRoundDisplayName(round: string): string {
  return getRoundChineseName(round)
}

function isRedCard(cardCode: string): boolean {
  if (cardCode === 'R') return true
  const suitChar = cardCode.charAt(0)
  return suitChar === 'H' || suitChar === 'D'
}

function getYearWithEdition(year: string): string {
  const yearNum = parseInt(year)
  const edition = yearNum - 2011
  const chineseEdition = toChineseNumber(edition)
  return `${year}年第${chineseEdition}届`
}

function toChineseNumber(num: number): string {
  const chineseNums = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十',
    '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十']
  if (num >= 0 && num < chineseNums.length) {
    return chineseNums[num]
  }
  return num.toString()
}

function getPokerSymbolPath(cardCode: string): string {
  if (cardCode === 'R') return '/images/RedJoker.png'
  if (cardCode === 'B') return '/images/BlackJoker.png'
  const suitChar = cardCode.charAt(0)
  const symbolMap: Record<string, string> = {
    S: '/images/Spades.png',
    H: '/images/Hearts.png',
    C: '/images/Clubs.png',
    D: '/images/Diamonds.png'
  }
  return symbolMap[suitChar] || ''
}

function getPokerRank(cardCode: string): string {
  if (cardCode === 'R') return 'M'
  if (cardCode === 'B') return 'W'
  const rankStr = cardCode.substring(1)
  const rankNames: Record<string, string> = {
    '1': 'A',
    '11': 'J',
    '12': 'Q',
    '13': 'K'
  }
  return rankNames[rankStr] || rankStr
}

function getCardMeaning(cardCode: string): string {
  if (cardCode === 'R' || cardCode === 'B') return '日月同辉'
  const rankStr = cardCode.substring(1)
  const meaningMap: Record<string, string> = {
    '1': '大道至简',
    '2': '巧夺天工',
    '3': '沧海桑田',
    '4': '节气周转',
    '5': '独有千秋',
    '6': '峰回路转',
    '7': '吐故纳新',
    '8': '险象环生',
    '9': '另辟蹊径',
    '10': '终焉一战',
    '11': '电光石火',
    '12': '雾里看花',
    '13': '万剑归宗'
  }
  return meaningMap[rankStr] || ''
}

function normalizePlayerCode(code: string): string {
  return code.toUpperCase()
}

function findLevelInfo(card: PokerCard): LevelIndexItem | null {
  const year = parseInt(card.year)
  const playerCode = normalizePlayerCode(card.playerCode)

  return levelIndex.value.find(item => {
    if (item.year !== year) return false

    const itemPlayerCode = normalizePlayerCode(item.playerCode)
    if (itemPlayerCode !== playerCode) return false

    if (card.round === item.roundKey) return true

    if (card.round === 'Q' && item.roundKey.startsWith('Q')) return true
    if (card.round === 'S' && item.roundKey.startsWith('S')) return true
    if (card.round === 'G' && item.roundKey.startsWith('G')) return true
    if (card.round === 'P1' && (item.roundKey === 'P1' || item.roundType.includes('热身赛') || item.roundType.includes('预选赛'))) return true
    if (card.round === 'P2' && (item.roundKey === 'P2' || item.roundType.includes('资格赛'))) return true

    return false
  }) || null
}

function getPlayerNameFromYaml(card: PokerCard): string | null {
  const yearMap = yamlPlayerMap.value[card.year]
  if (!yearMap) return null

  const playerCode = card.playerCode.toUpperCase()

  for (const [roundKey, roundPlayers] of Object.entries(yearMap)) {
    const roundMatch = card.round === roundKey ||
      (card.round === 'Q' && roundKey.startsWith('Q')) ||
      (card.round === 'S' && roundKey.startsWith('S')) ||
      (card.round === 'G' && roundKey.startsWith('G')) ||
      (card.round === 'F' && roundKey === 'F')

    if (!roundMatch) continue

    for (const [code, name] of Object.entries(roundPlayers)) {
      if (code.toUpperCase() === playerCode) {
        return name
      }
    }
  }

  return null
}

function getPlayerName(card: PokerCard): string {
  const yamlName = getPlayerNameFromYaml(card)
  if (yamlName) return yamlName

  const levelInfo = findLevelInfo(card)
  if (levelInfo && levelInfo.playerName) {
    return levelInfo.playerName
  }
  return card.playerCode
}

function getLevelFileName(card: PokerCard): string {
  const levelInfo = findLevelInfo(card)
  if (!levelInfo) return ''

  let name = levelInfo.name
  const extIndex = name.lastIndexOf('.')
  if (extIndex > 0) {
    name = name.substring(0, extIndex)
  }

  const dashIndex = name.indexOf('-')
  if (dashIndex > 0 && dashIndex < name.length - 1) {
    name = name.substring(dashIndex + 1)
  }

  return name
}

function getLevelDisplayName(card: PokerCard): string {
  const fileName = getLevelFileName(card)
  if (card.levelNickname) {
    if (fileName) {
      return `${fileName}（${card.levelNickname}）`
    }
    return card.levelNickname
  }
  return fileName || '—'
}

function getTitleLength(card: PokerCard): number {
  const title = getLevelFileName(card) || card.levelNickname || ''
  return title.length
}

function openCardDetail(card: PokerCard): void {
  isUpdatingCards.value = true
  selectedCards.value = [card]
  activeIndex.value = 0
  isRandomDraw.value = false
  document.body.style.overflow = 'hidden'

  nextTick(() => {
    if (scrollContainer.value) {
      scrollContainer.value.scrollLeft = 0
    }
    isUpdatingCards.value = false
  })
}

function closeCardDetail(): void {
  selectedCards.value = []
  activeIndex.value = 0
  isRandomDraw.value = false
  document.body.style.overflow = ''
}

function randomDraw(): void {
  if (allCards.value.length === 0) return

  isUpdatingCards.value = true
  let pool = allCards.value
  if (excludeJokers.value) {
    pool = pool.filter(card => card.cardCode !== 'R' && card.cardCode !== 'B')
  }

  const randomIndex = Math.floor(Math.random() * pool.length)
  selectedCards.value = [pool[randomIndex]]
  activeIndex.value = 0
  isRandomDraw.value = true
  document.body.style.overflow = 'hidden'

  nextTick(() => {
    if (scrollContainer.value) {
      scrollContainer.value.scrollLeft = 0
    }
    isUpdatingCards.value = false
  })
}

function multiRandomDraw(): void {
  if (allCards.value.length === 0) return

  isUpdatingCards.value = true
  let pool = [...allCards.value]
  if (excludeJokers.value) {
    pool = pool.filter(card => card.cardCode !== 'R' && card.cardCode !== 'B')
  }

  const count = Math.min(Math.max(drawCount.value || 2, 2), Math.min(10, pool.length))
  const shuffled = pool.sort(() => 0.5 - Math.random())
  selectedCards.value = shuffled.slice(0, count)
  activeIndex.value = 0
  isRandomDraw.value = true
  document.body.style.overflow = 'hidden'

  // 在 DOM 更新后重置滚动位置
  nextTick(() => {
    if (scrollContainer.value) {
      scrollContainer.value.scrollLeft = 0
    }
    // 延迟一小段时间恢复滚动监听，确保 snap 已经稳定
    setTimeout(() => {
      isUpdatingCards.value = false
    }, 50)
  })
}

function handleScroll(event: Event): void {
  if (isUpdatingCards.value) return
  const container = event.target as HTMLElement
  if (!container) return

  const scrollWidth = container.scrollWidth - container.clientWidth
  if (scrollWidth <= 0) {
    activeIndex.value = 0
    return
  }

  // 计算当前滚动到的索引
  const items = container.querySelectorAll('.multi-card-item')
  if (items.length === 0) return

  let closestIndex = 0
  let minDistance = Infinity

  const containerRect = container.getBoundingClientRect()
  const containerCenter = containerRect.left + containerRect.width / 2

  items.forEach((item, index) => {
    const itemRect = item.getBoundingClientRect()
    const itemCenter = itemRect.left + itemRect.width / 2
    const distance = Math.abs(containerCenter - itemCenter)
    if (distance < minDistance) {
      minDistance = distance
      closestIndex = index
    }
  })

  activeIndex.value = closestIndex
}

function scrollToCard(index: number): void {
  if (!scrollContainer.value) return

  const items = scrollContainer.value.querySelectorAll('.multi-card-item')
  if (!items[index]) return

  items[index].scrollIntoView({
    behavior: 'smooth',
    block: 'nearest',
    inline: 'center'
  })
}

function buildYamlPlayerMap(yamlData: any): YamlPlayerMap {
  const map: YamlPlayerMap = {}

  if (!yamlData?.season) return map

  for (const [year, yearData] of Object.entries(yamlData.season)) {
    if (!yearData || typeof yearData !== 'object') continue
    const typedYearData = yearData as { rounds?: any }
    if (!typedYearData.rounds) continue

    map[year] = {}

    for (const [roundKey, roundData] of Object.entries(typedYearData.rounds)) {
      if (!roundData || typeof roundData !== 'object') continue
      const typedRoundData = roundData as { players?: any }
      if (!typedRoundData.players) continue

      map[year][roundKey] = {}

      const processPlayers = (players: any) => {
        if (typeof players === 'string') {
          return
        }
        if (typeof players === 'object' && players !== null) {
          for (const [code, value] of Object.entries(players)) {
            if (typeof value === 'string') {
              map[year][roundKey][code] = value
            } else if (typeof value === 'object' && value !== null) {
              processPlayers(value)
            }
          }
        }
      }

      processPlayers(typedRoundData.players)
    }
  }

  return map
}

async function loadData(): Promise<void> {
  try {
    loading.value = true
    error.value = null

    const [csvResponse, indexResponse, yamlData] = await Promise.all([
      fetch('/data/poker2020.csv'),
      fetch('/data/levels/index.json'),
      fetchMarioWorkerYaml()
    ])

    if (!csvResponse.ok) {
      throw new Error('无法加载扑克牌数据')
    }
    if (!indexResponse.ok) {
      throw new Error('无法加载关卡索引数据')
    }

    const csvText = await csvResponse.text()
    const indexData: LevelIndexItem[] = await indexResponse.json()

    levelIndex.value = indexData
    yamlPlayerMap.value = buildYamlPlayerMap(yamlData)

    const result = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true
    })

    const cards: PokerCard[] = (result.data as Record<string, string>[]).map(row => ({
      cardCode: row['牌号'],
      year: row['年份'],
      round: row['轮次'],
      playerCode: row['选手码'],
      levelNickname: row['关卡外号'] || '',
      comment1: row['评语1'] || '',
      commentAuthor1: row['评语作者1'] || '',
      comment2: row['评语2'] || '',
      commentAuthor2: row['评语作者2'] || ''
    }))

    allCards.value = cards
  } catch (err) {
    console.error('加载数据失败:', err)
    error.value = '加载数据失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.poker-module {
  width: 100%;
}

.poker-info p {
  margin: var(--spacing-xs) 0;
}

.poker-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--spacing-lg);
  padding: var(--spacing-md);
}

.poker-intro {
  color: var(--text-secondary);
}

.poker-intro p {
  margin: 0 0 var(--spacing-sm) 0;
}

.draw-button-wrapper {
  padding: var(--spacing-sm);
  display: flex;
  justify-content: center;
}

.draw-controls {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
  justify-content: center;
}

.multi-draw-group {
  display: flex;
  align-items: center;
  background: var(--bg-panel);
  padding: 4px;
  border-radius: var(--radius-medium);
  border: 1px solid var(--border-light);
}

.draw-btn {
  font-size: 16px;
}

.draw-input {
  width: 40px;
  padding: 6px 8px;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-small);
  text-align: center;
  font-size: 14px;
}

.joker-toggle {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0 4px;
  user-select: none;
}

.joker-toggle input {
  cursor: pointer;
  accent-color: var(--primary-color);
}

.poker-card {
  background: var(--bg-card);
  border-radius: var(--radius-large);
  overflow: hidden;
  box-shadow: var(--shadow-soft);
  border: 1px solid var(--border-light);
  cursor: pointer;
  transition: var(--transition-normal);
}

.poker-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-medium);
  border-color: var(--primary-hover);
}

.card-image-wrapper {
  width: 100%;
  aspect-ratio: 4/3;
  background: linear-gradient(135deg, #f5f5f5, #e8e8e8);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.card-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.card-info {
  padding: var(--spacing-md);
  text-align: center;
}

.card-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--spacing-xs);
}

.card-red {
  color: #e31b23;
}

.card-level-name {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: var(--spacing-xs);
  line-height: 1.4;
}

.card-source {
  font-size: 12px;
  color: var(--text-muted);
}

@media (max-width: 768px) {
  .poker-grid {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: var(--spacing-md);
    padding: var(--spacing-sm);
  }

  .draw-btn {
    font-size: 14px;
  }
}
</style>

<style>
.card-detail-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  padding: 20px;
  overflow-y: auto; /* 允许整个模态框垂直滚动 */
}

.modal-body-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  gap: 20px;
  margin: auto; /* 在垂直滚动时也能保持居中 */
  padding: 40px 0;
}

.modal-content-scroll {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: flex-start; /* 顶部对齐，防止高度过高时顶部被裁剪 */
  overflow-x: auto;
  overflow-y: hidden;
  gap: 12px;
  padding: 20px 0;
}

.modal-content-scroll.multi-card-layout {
  justify-content: safe center;
  scroll-snap-type: x mandatory;
  padding-left: 40px;
  padding-right: 40px;
}

.multi-card-item {
  flex: 0 0 auto;
  scroll-snap-align: center;
  transform: scale(0.95);
}

.modal-actions {
  display: flex;
  justify-content: center;
}

.multi-redraw-btn {
  font-size: 16px;
}

.pagination-dots {
  display: flex;
  gap: 8px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.3);
  transition: var(--transition-fast);
}

.dot.active {
  background: var(--primary-color);
  transform: scale(1.3);
  box-shadow: 0 0 8px var(--primary-color);
}

.mobile-only {
  display: none;
}

@media (max-width: 532px) {
  .mobile-only {
    display: flex;
  }

  .desktop-only {
    display: none;
  }
}

.card-detail-modal .close-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 40px;
  height: 40px;
  background: rgba(255, 255, 255, 0.9);
  border: none;
  border-radius: 50%;
  font-size: 26px;
  cursor: pointer;
  color: #666;
  z-index: 1100;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  transition: var(--transition-fast);
}

.card-detail-modal .close-btn:hover {
  background: #fff;
  color: #333;
  transform: scale(1.1);
}

.poker-card-real {
  position: relative;
  width: 512px;
  max-width: 90vw;
  height: auto;
  aspect-ratio: 1 / 1.54;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  color: #222;
  flex-shrink: 0;
}

.poker-card-real.poker-red .corner-rank {
  color: #c41e3a;
}

.poker-redraw-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 10;
  padding: 6px 12px;
  font-size: 14px;
  color: var(--primary-color);
}

.poker-corner {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  font-weight: bold;
  z-index: 2;
}

.poker-corner-tl {
  top: 12px;
  left: 12px;
}

.poker-corner-br {
  bottom: 10px;
  right: 14px;
  transform: rotate(180deg);
}

.corner-symbol-img {
  width: 32px;
  display: block;
}

.corner-rank {
  font-size: 40px;
  line-height: 1.1;
  font-family: serif;
}

.poker-center {
  padding: 60px 48px 28px;
  text-align: center;
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
}

.poker-title {
  margin: 0 0 16px;
  font-size: 28px;
  font-weight: bold;
  letter-spacing: 0.5px;
  color: #222;
}

.poker-title-small {
  font-size: 22px;
}

.poker-image-wrapper {
  margin: 0 auto 20px;
  max-width: 400px;
  border: 3px solid #ccc;
  border-radius: 4px;
  overflow: hidden;
  background: #f0f0f0;
}

.poker-image {
  width: 100%;
  height: auto;
  display: block;
}

.poker-comments {
  text-align: left;
  padding: 0 8px;
}

.comment-item {
  margin-bottom: 16px;
}

.comment-item:last-child {
  margin-bottom: 0;
}

.comment-body {
  margin: 0 0 4px;
  font-size: 17px;
  line-height: 1.5;
  color: #333;
  text-indent: 2em;
}

.comment-author {
  margin: 0;
  font-size: 13px;
  color: #888;
  text-align: right;
  font-style: italic;
}

.poker-footer {
  position: absolute;
  bottom: 8px;
  left: 12px;
  font-size: 13px;
  color: #666;
  font-style: italic;
}

@media (max-width: 532px) {
  .card-detail-modal {
    padding: 10px;
  }

  .poker-card-real {
    width: 100%;
    max-width: 512px;
  }

  .poker-center {
    padding: 38px 32px 24px;
  }

  .poker-title {
    font-size: 24px;
  }

  .poker-title-small {
    font-size: 18px;
  }

  .comment-body {
    font-size: 13px;
    line-height: 1.4;
  }

  .comment-item {
    margin-bottom: 8px;
  }

  .comment-author {
    font-size: 11px;
  }

  .corner-symbol-img {
    width: 26px;
  }

  .corner-rank {
    font-size: 32px;
  }

  .poker-redraw-btn {
    top: 10px;
    right: 10px;
    padding: 4px 8px;
    font-size: 12px;
  }

  .modal-content-scroll {
    gap: 10px;
    padding: 10px 0;
  }

  .modal-content-scroll.multi-card-layout {
    padding-left: 10px;
    padding-right: 10px;
    justify-content: flex-start;
  }

  .modal-body-container {
    gap: 15px;
    padding: 20px 0;
  }

  .multi-card-item {
    transform: scale(1);
    width: calc(100vw - 20px); /* 减去 modal 的 10px * 2 左右内边距 */
    max-width: 512px;
  }

  .multi-redraw-btn {
    font-size: 14px;
  }
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.25s ease;
}

.modal-fade-enter-active .poker-card-real,
.modal-fade-leave-active .poker-card-real {
  transition: transform 0.25s ease, opacity 0.25s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-from .poker-card-real,
.modal-fade-leave-to .poker-card-real {
  transform: scale(0.95);
  opacity: 0;
}
</style>
