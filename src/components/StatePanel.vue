<script setup lang="ts">
import Button from 'primevue/button'
defineProps<{ kind: 'loading' | 'empty' | 'error'; message?: string }>()
defineEmits<{ retry: [] }>()
</script>
<template>
  <div class="state-panel" :role="kind === 'error' ? 'alert' : 'status'">
    <i :class="['pi', kind === 'loading' ? 'pi-spin pi-spinner' : kind === 'error' ? 'pi-exclamation-circle' : 'pi-inbox']" aria-hidden="true" />
    <strong>{{ kind === 'loading' ? '正在读取数据' : kind === 'error' ? '暂时无法加载' : '暂无可用数据' }}</strong>
    <p>{{ message || (kind === 'empty' ? '试试调整对象或时间范围。缺失数据不会补零。' : '请稍候…') }}</p>
    <Button v-if="kind === 'error'" label="重新加载" icon="pi pi-refresh" severity="secondary" @click="$emit('retry')" />
  </div>
</template>
