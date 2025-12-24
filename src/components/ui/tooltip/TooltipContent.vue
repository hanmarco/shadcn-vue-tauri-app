<script setup>
import { TooltipContent, TooltipPortal, useForwardPropsEmits } from "reka-ui"
import { cn } from "@/lib/utils"

const props = defineProps({
  forceMount: { type: Boolean, required: false },
  ariaLabel: { type: String, required: false },
  asChild: { type: Boolean, required: false },
  as: { type: null, required: false },
  side: { type: null, required: false, default: "top" },
  sideOffset: { type: Number, required: false, default: 4 },
  align: { type: null, required: false, default: "center" },
  alignOffset: { type: Number, required: false },
  avoidCollisions: { type: Boolean, required: false, default: true },
  collisionBoundary: { type: null, required: false },
  collisionPadding: { type: [Number, Object], required: false, default: 0 },
  arrowPadding: { type: Number, required: false, default: 0 },
  sticky: { type: String, required: false, default: "partial" },
  hideWhenDetached: { type: Boolean, required: false },
  positionStrategy: { type: String, required: false, default: "absolute" },
  updatePositionStrategy: { type: String, required: false, default: "optimized" },
  disableOutsidePointerEvents: { type: Boolean, required: false },
  class: { type: null, required: false },
})

const emits = defineEmits(["escapeKeyDown", "pointerDownOutside", "focusOutside", "interactOutside"])

const forwarded = useForwardPropsEmits(props, emits)
</script>

<template>
  <TooltipPortal>
    <TooltipContent
      v-bind="forwarded"
      :class="cn('z-50 overflow-hidden rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2', props.class)"
    >
      <slot />
    </TooltipContent>
  </TooltipPortal>
</template>
