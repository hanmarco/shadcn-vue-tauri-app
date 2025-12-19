<script setup>
import { Primitive } from "reka-ui";
import { cn } from "@/lib/utils";

const props = defineProps({
  class: { type: null, required: false },
  asChild: { type: Boolean, required: false },
  as: { type: null, required: false, default: "aside" },
});
</script>

<template>
  <Primitive
    :as="as"
    :as-child="asChild"
    :class="cn('flex h-screen w-64 flex-col border-r bg-sidebar text-sidebar-foreground', props.class)"
  >
    <slot />
  </Primitive>
</template>

