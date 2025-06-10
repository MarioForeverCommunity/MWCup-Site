<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import RoundSelector from './components/RoundSelector.vue'
import LevelFileTest from './components/LevelFileSearch.vue'
import UploadSystem from './components/UploadSystem.vue'
import UserManagement from './components/UserManagement.vue'
import StatsAnalysis from './components/StatsAnalysis.vue'
import DocumentDisplay from './components/DocumentDisplay.vue'

type TabType = 'matches'  | 'upload' | 'levels' | 'users' | 'stats' | 'docs'

const getSavedTab = (): TabType => {
  const savedTab = sessionStorage.getItem('mwcup-active-tab')
  return (savedTab as TabType) || 'matches'
}

const activeTab = ref<TabType>(getSavedTab())
const isSidebarOpen = ref(true)
const isMobileView = ref(false)
const showBackToTop = ref(false)

// 监听标签页变化并保存到 sessionStorage
const setActiveTab = (tab: TabType) => {
  activeTab.value = tab
  sessionStorage.setItem('mwcup-active-tab', tab)
  
  // 移动端点击导航项后自动收起侧边栏
  if (isMobileView.value) {
    isSidebarOpen.value = false
  }
}

// 检测当前视图是否为移动设备
const checkMobileView = () => {
  const newIsMobileView = window.innerWidth < 768
  // 如果从移动视图切换到桌面视图，确保侧边栏打开
  if (isMobileView.value && !newIsMobileView) {
    isSidebarOpen.value = true
  }
  isMobileView.value = newIsMobileView
}

// 当窗口尺寸改变时更新视图状态
onMounted(() => {
  checkMobileView()
  window.addEventListener('resize', checkMobileView)
  window.addEventListener('scroll', handleScroll)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobileView)
  window.removeEventListener('scroll', handleScroll)
})

const openSidebar = () => {
  isSidebarOpen.value = true
}

// 返回顶部功能
const scrollToTop = () => {
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  })
}

// 监听滚动事件，控制返回顶部按钮显示
const handleScroll = () => {
  showBackToTop.value = window.scrollY > 300
}
</script>

<template>
  <div class="app-container">
    <button v-if="!isSidebarOpen && isMobileView" class="sidebar-open-btn" @click="openSidebar">
      <span class="toggle-icon">☰</span>
    </button>
    <aside class="sidebar" :class="{ 'sidebar-closed': !isSidebarOpen && isMobileView }">
      <header class="sidebar-header">
        <h1 class="app-title">Mario Worker 杯官网</h1>
      </header>
      <nav class="sidebar-nav">
        <button 
          @click="setActiveTab('matches')" 
          :class="{ active: activeTab === 'matches' }"
          class="nav-btn hover-scale"
        >
          <span class="nav-icon">📚</span>
          <span class="nav-text">赛事详览</span>
        </button>
        <button 
          @click="setActiveTab('upload')" 
          :class="{ active: activeTab === 'upload' }"
          class="nav-btn hover-scale"
        >
          <span class="nav-icon">📤</span>
          <span class="nav-text">上传系统</span>
        </button>
        <button 
          @click="setActiveTab('levels')" 
          :class="{ active: activeTab === 'levels' }"
          class="nav-btn hover-scale"
        >
          <span class="nav-icon">🎮</span>
          <span class="nav-text">关卡查询</span>
        </button>
        <button 
          @click="setActiveTab('stats')" 
          :class="{ active: activeTab === 'stats' }"
          class="nav-btn hover-scale"
        >
          <span class="nav-icon">📊</span>
          <span class="nav-text">数据统计</span>
        </button>
        <button 
          @click="setActiveTab('users')" 
          :class="{ active: activeTab === 'users' }"
          class="nav-btn hover-scale"
        >
          <span class="nav-icon">👥</span>
          <span class="nav-text">用户一览</span>
        </button>
        <button 
          @click="setActiveTab('docs')" 
          :class="{ active: activeTab === 'docs' }"
          class="nav-btn hover-scale"
        >
          <span class="nav-icon">📄</span>
          <span class="nav-text">规章标准</span>
        </button>
      </nav>
    </aside>
    <!-- 遮罩层，移动端且菜单展开时显示 -->
    <div 
      v-if="isSidebarOpen && isMobileView" 
      class="sidebar-mask" 
      @click="isSidebarOpen = false"
    ></div>
    <main class="main-content" :class="{ 'content-expanded': !isSidebarOpen }">
      <Transition name="slide-fade" mode="out-in">
        <!-- 上传系统独立布局，不使用 content-container -->
        <div v-if="activeTab === 'upload'" class="upload-container animate-fadeInUp" key="upload">
          <UploadSystem />
        </div>
        
        <!-- 其他页面使用 content-container -->
        <div v-else class="content-container">
          <div v-if="activeTab === 'matches'" class="content-panel animate-fadeInUp" key="matches">
            <RoundSelector />
          </div>
          
          <div v-else-if="activeTab === 'docs'" class="content-panel animate-fadeInUp" key="docs">
            <DocumentDisplay />
          </div>
          
          <div v-else-if="activeTab === 'levels'" class="content-panel animate-fadeInUp" key="levels">
            <LevelFileTest />
          </div>
          
          <div v-else-if="activeTab === 'stats'" class="content-panel animate-fadeInUp" key="stats-main">
            <StatsAnalysis />
          </div>
          
          <div v-else-if="activeTab === 'users'" class="content-panel animate-fadeInUp" key="users">
            <UserManagement />
          </div>
        </div>
      </Transition>
    </main>
    
    <!-- 返回顶部按钮 -->
    <Transition name="fade">
      <button 
        v-if="showBackToTop"
        @click="scrollToTop"
        class="back-to-top-btn"
        :class="{ 'mobile': isMobileView }"
        title="返回顶部"
      >
        <span class="back-to-top-icon">↑</span>
      </button>
    </Transition>
  </div>
</template>

<style scoped>
/* App.vue specific styles only - layout styles moved to layout.css */
.app-title {
  margin: 0;
  text-align: center;
  color: var(--text-primary);
  font-size: 24px;
  font-weight: 600;
  line-height: 1.2;
  animation: fadeInDown 0.5s ease-out;
  width: 100%; /* 确保标题占据整个可用宽度 */
}

/* 导航按钮样式增强 */

.nav-icon {
  font-size: 18px;
  transition: all 0.3s ease;
  display: inline-block;
}

.nav-btn:hover .nav-icon {
  transform: scale(1.2) rotate(5deg);
}

.nav-text {
  transition: all 0.3s ease;
}

/* 侧边栏动画 */
@media (min-width: 768px) {
  .sidebar {
    animation: slideInLeft 0.5s ease-out;
  }

  .sidebar-mask {
    display: none;
  }

  /* 主内容区动画 */
  .main-content {
    animation: slideInRight 0.5s ease-out 0.2s both;
  }
}

.content-panel {
  position: relative;
  overflow: hidden;
}

.content-panel::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.2),
    transparent
  );
  animation: shimmer 3s ease-in-out infinite;
}

/* Responsive adjustments for app title */
@media (max-width: 1024px) {
  .app-title {
    font-size: 20px;
  }
}

@media (max-width: 768px) {
  .app-title {
    font-size: 18px;
  }
  
  .nav-btn {
    flex-direction: column;
    gap: 6px;
  }
}

/* Legacy styles for logo (if needed) */
.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
  transition: filter 300ms;
}

.logo:hover {
  filter: drop-shadow(0 0 2em #646cffaa);
}

.logo.vue:hover {
  filter: drop-shadow(0 0 2em #42b883aa);
}

/* Toggle sidebar button styles */
.toggle-sidebar {
  position: fixed;
  top: 20px;
  left: 20px;
  background: var(--primary);
  color: white;
  border: none;
  border-radius: 4px;
  padding: 10px 15px;
  cursor: pointer;
  font-size: 18px;
  transition: background 0.3s ease;
  z-index: 1000;
}

.toggle-sidebar:hover {
  background: var(--primary-dark);
}

/* 新增样式：折叠侧边栏时的样式 */
.sidebar-closed {
  width: 80px; /* 或者你想要的任何宽度 */
}

.sidebar-closed .nav-text {
  display: none;
}

.content-expanded {
  margin-left: 80px; /* 或者与.sidebar-closed相同的值 */
}

/* 侧边栏折叠按钮 */
.sidebar-toggle {
  display: none;
  position: absolute;
  top: 10px;
  right: 10px;
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-size: 24px;
  cursor: pointer;
  z-index: 100;
  padding: 5px;
  transition: all 0.3s ease;
}

.toggle-icon {
  display: inline-block;
  transition: transform 0.3s ease;
}

.sidebar-toggle:hover .toggle-icon {
  transform: scale(1.1);
}

@media (max-width: 768px) {
  .sidebar-toggle {
    display: block;
  }

  .sidebar {
    position: fixed;
    left: 0;
    top: 0;
    height: 100vh;
    width: 250px;
    z-index: 1001; /* 提高侧边栏层级，确保在遮罩层之上 */
    transform: translateX(0);
    transition: transform 0.3s ease-in-out;
    box-shadow: 2px 0 5px rgba(0, 0, 0, 0.1);
  }

  .sidebar-nav {
    margin-top: 20px;
    display: flex;
    flex-direction: column;
    width: 100%;
    padding: 0 10px;
    box-sizing: border-box;
  }

  .nav-btn {
    width: calc(100% - 10px);
    display: flex;
    align-items: center;
    padding: 12px;
    margin: 0 5px;
    justify-content: flex-start;
    flex-direction: row !important;
    box-sizing: border-box;
  }

  .nav-icon {
    width: 24px;
    text-align: center;
  }

  .nav-text {
    flex: 1;
  }

  .sidebar-closed {
    transform: translateX(-100%);
  }

  .main-content {
    margin-left: 0;
    width: 100%;
    transition: margin-left 0.3s ease-in-out;
  }

  .content-expanded {
    margin-left: 0;
  }

  .sidebar-header {
    display: flex;
    justify-content: center; /* 水平居中 */
    align-items: center; /* 垂直居中 */
    position: relative;
    padding: 25px 0 5px 0;
    width: 100%;
  }
  
  .app-title {
    font-size: 18px;
    margin: 0; /* 消除标题默认外边距 */
    width: 100%;
    text-align: center;
  }

  .sidebar-mask {
    display: block;
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.5);
    z-index: 1000;
    transition: opacity 0.3s;
  }
  
  /* 侧边栏呼出按钮 */
  .sidebar-open-btn {
    position: fixed;
    bottom: 20px;
    left: 20px;
    width: 48px;
    height: 48px;
    background-color: var(--primary-color);
    color: white;
    border: none;
    border-radius: 50%;
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 999;
    cursor: pointer;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
    transition: transform 0.3s ease, background-color 0.3s ease;
    animation: bounceIn 0.5s ease;
  }
  
  .sidebar-open-btn:hover {
    transform: scale(1.1);
    background-color: var(--accent-color);
  }
}

/* 上传系统独立容器样式 */
.upload-container {
  width: 100%;
  height: 100%;
  padding: 0;
  margin: 0;
  overflow: hidden;
}

/* 确保上传系统在移动端也能全屏显示 */
@media (max-width: 768px) {
  .upload-container {
    padding: 0;
    margin: 0;
  }
}

/* 返回顶部按钮样式 */
.back-to-top-btn {
  position: fixed;
  width: 48px;
  height: 48px;
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transition: all 0.3s ease;
  z-index: 999;
  
  /* 桌面端位置：右下角 */
  bottom: 30px;
  right: 30px;
}

.back-to-top-btn:hover {
  background: var(--primary-active);
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
}

.back-to-top-btn.mobile {
  /* 移动端位置：菜单按钮正上方，大小与菜单按钮一致 */
  bottom: 78px; /* 48px按钮+10px间距+20px安全边距 */
  left: 20px;
  right: auto;
  width: 48px;
  height: 48px;
}

@media (max-width: 768px) {
  .back-to-top-btn {
    width: 48px;
    height: 48px;
    font-size: 1.2rem;
    /* 其余样式同上 */
  }
  .back-to-top-btn.mobile {
    bottom: 78px;
    left: 20px;
    right: auto;
    width: 48px;
    height: 48px;
    z-index: 999;
  }
  /* 菜单和遮罩z-index更高，确保遮住返回顶部按钮 */
  .sidebar-open-btn {
    z-index: 999;
  }
}

/* 返回顶部按钮淡入淡出动画 */
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>
