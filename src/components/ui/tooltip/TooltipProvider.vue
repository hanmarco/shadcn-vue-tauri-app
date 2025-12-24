<script setup>
import { TooltipProvider } from "reka-ui";

const props = defineProps({
  delayDuration: { type: Number, required: false, default: 100 },
  skipDelayDuration: { type: Number, required: false, default: 300 },
  disableHoverableContent: { type: Boolean, required: false },
});
</script>

<template>
  <TooltipProvider v-bind="props">
    <slot />
  </TooltipProvider>
</template>
