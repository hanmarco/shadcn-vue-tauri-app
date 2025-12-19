<script setup>
import { Primitive } from "reka-ui";
import { cn } from "@/lib/utils";

const props = defineProps({
  class: { type: null, required: false },
  asChild: { type: Boolean, required: false },
  as: { type: null, required: false, default: "div" },
});
</script>

<template>
  <Primitive
    :as="as"
    :as-child="asChild"
    :class="cn('relative overflow-hidden', props.class)"
  >
    <div class="h-full w-full rounded-[inherit] [&>[data-radix-scroll-area-viewport]]:h-full [&>[data-radix-scroll-area-viewport]]:w-full [&>[data-radix-scroll-area-viewport]]:rounded-[inherit]">
      <slot />
    </div>
    <div class="flex touch-none select-none transition-colors">
      <div class="h-full w-2.5 border-r border-l border-transparent p-[1px]">
        <div class="h-full w-full rounded-full bg-border" />
      </div>
    </div>
  </Primitive>
</template>

