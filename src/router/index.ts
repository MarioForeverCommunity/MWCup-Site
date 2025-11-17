import { createRouter, createWebHistory } from 'vue-router'
import RoundSelector from '../components/RoundSelector.vue'
import UploadSystem from '../components/UploadSystem.vue'
import LevelFileSearch from '../components/LevelFileSearch.vue'
import StatsAnalysis from '../components/StatsAnalysis.vue'
import DocumentDisplay from '../components/DocumentDisplay.vue'

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
    component: UploadSystem
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
    name: 'Stats',
    component: StatsAnalysis,
    children: [
      {
        path: '',
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
        redirect: { name: 'StatsTotalPoints', params: { year: '2025' } }
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
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router