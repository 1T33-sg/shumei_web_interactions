<script setup lang="ts">
import { RouterView, useRoute } from 'vue-router'
import DashboardShell from './components/layout/DashboardShell.vue'
const route = useRoute()
</script>
<template><RouterView v-if="route.path === '/login'" /><DashboardShell v-else><RouterView /></DashboardShell></template>
