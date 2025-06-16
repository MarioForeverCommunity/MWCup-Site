<template>
  <button 
    @click="onClick"
    :class="['fold-btn', isFolded ? 'btn-primary' : 'btn-secondary']"
  >
    {{ isFolded ? '展开' : '折叠' }}
  </button>
</template>

<script setup lang="ts">
defineProps<{
  isFolded: boolean;
}>();

const emit = defineEmits<{
  (e: 'toggle'): void
}>();

const onClick = () => {
  emit('toggle');
};
</script>

<style scoped>
/* === 折叠/展开按钮通用样式 === */
.fold-btn {
  float: right;
  padding: 4px 8px;
  color: white;
  border-radius: var(--radius-medium);
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: var(--transition-normal);
  backdrop-filter: var(--blur-light);
  background: none;
  outline: none;
  margin-left: var(--spacing-sm);
}

.fold-btn.btn-primary {
  border: 1px solid var(--border-medium);
  background: linear-gradient(135deg, var(--primary-hover), var(--primary-color));
  color: white;
}

.fold-btn.btn-secondary {
  background: var(--bg-button);
  color: var(--text-primary);
  border: 1px solid var(--primary-hover);
}

.fold-btn:hover {
  filter: brightness(0.95);
}
</style>
