<script setup lang="ts">
import { ref } from 'vue'

defineProps<{ msg: string }>()

const count = ref(0)
</script>

<template>
  <div class="page-header">
    <h1>{{ msg }}</h1>
  </div>

  <div class="content-panel">
    <div class="form-group">
      <button type="button" class="btn-primary" @click="count++">
        count is {{ count }}
      </button>
    </div>
    
    <p>
      Edit
      <code>components/HelloWorld.vue</code> to test HMR
    </p>

    <p>
      Check out
      <a href="https://vuejs.org/guide/quick-start.html#local" target="_blank"
        >create-vue</a
      >, the official Vue + Vite starter
    </p>
    
    <p>
      Learn more about IDE Support for Vue in the
      <a
        href="https://vuejs.org/guide/scaling-up/tooling.html#ide-support"
        target="_blank"
        >Vue Docs Scaling up Guide</a
      >.
    </p>
    
    <p class="read-the-docs">Click on the Vite and Vue logos to learn more</p>
  </div>
</template>

<style scoped>
/* 组件特定样式 - 使用新的CSS类系统 */
.read-the-docs {
  color: var(--text-secondary);
  font-size: 14px;
  text-align: center;
  margin-top: var(--spacing-md);
}
</style>
