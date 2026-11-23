import { createRouter, createWebHistory } from 'vue-router'
import RoundSelector from '../components/RoundSelector.vue'
import UploadSystem from '../components/UploadSystem.vue'
import Admin2027 from '../components/Admin2027.vue'
import LevelFileSearch from '../components/LevelFileSearch.vue'
import StatsAnalysis from '../components/StatsAnalysis.vue'
import DocumentDisplay from '../components/DocumentDisplay.vue'
import PokerTable from '../components/PokerTable.vue'

const routes = [
  {
    path: '/',
    redirect: '/matches'
  },
  {
    path: '/matches',
    name: 'Matches',
    component: RoundSelector
  },
  {
    path: '/matches/:year',
    name: 'MatchesYear',
    component: RoundSelector,
    props: true
  },
  {
    path: '/matches/:year/:round',
    name: 'MatchesYearRound',
    component: RoundSelector,
    props: true
  },
  {
    path: '/upload',
    name: 'Upload',
    redirect: '/upload/2027'
  },
  {
    path: '/upload/:year',
    name: 'UploadYear',
    component: UploadSystem,
    props: true
  },
  {
    path: '/levels',
    name: 'Levels',
    component: LevelFileSearch
  },
  {
    path: '/stats',
    component: StatsAnalysis,
    children: [
      {
        path: '',
        name: 'Stats',
        redirect: { name: 'StatsRanking', params: { type: 'single' } }
      },
      {
        path: 'ranking',
        redirect: { name: 'StatsRanking', params: { type: 'single' } }
      },
      {
        path: 'ranking/:type',
        name: 'StatsRanking',
        component: () => import('../components/RankingModule.vue'),
        props: true
      },
      {
        path: 'totalpoints',
        redirect: { name: 'StatsTotalPoints', params: { year: '2026' } }
      },
      {
        path: 'totalpoints/:year',
        name: 'StatsTotalPoints',
        component: () => import('../components/TotalPointsRanking.vue'),
        props: true
      },
      {
        path: ':stat',
        name: 'StatsSub',
        component: StatsAnalysis,
        props: true
      }
    ]
  },
  {
    path: '/docs',
    name: 'Docs',
    component: DocumentDisplay
  },
  {
    path: '/docs/:doc',
    name: 'DocsSub',
    component: DocumentDisplay,
    props: true
  },
  {
    path: '/poker',
    name: 'Poker',
    component: PokerTable
  },
  {
    // 管理控制台：URL 带 secret（即 manage_url），由比赛系统 /admin_gate/<secret> 校验后直接返回本 SPA，
    // 浏览器 URL 保持不变（与旧版 /manage/<secret> 行为一致）
    path: '/admin/2027/:secret',
    name: 'Admin2027',
    component: Admin2027
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
