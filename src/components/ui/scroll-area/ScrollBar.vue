<script setup>
import { Primitive } from "reka-ui";
import { cn } from "@/lib/utils";

const props = defineProps({
  orientation: { type: String, default: "vertical" },
  class: { type: null, required: false },
  asChild: { type: Boolean, required: false },
});
</script>

<template>
  <Primitive
    :as-child="asChild"
    :class="cn(
      'flex touch-none select-none transition-colors',
      orientation === 'vertical' && 'h-full w-2.5 border-l border-l-transparent p-[1px]',
      orientation === 'horizontal' && 'h-2.5 flex-col border-t border-t-transparent p-[1px]',
      props.class
    )"
  >
    <div
      :class="cn(
        'relative flex-1 rounded-full bg-border',
        orientation === 'vertical' && 'w-full',
        orientation === 'horizontal' && 'h-full'
      )"
    />
  </Primitive>
</template>

