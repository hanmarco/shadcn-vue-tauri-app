<script setup>
import { computed } from "vue";
import { Primitive } from "reka-ui";
import { cn } from "@/lib/utils";

const props = defineProps({
  active: { type: Boolean, default: false },
  class: { type: null, required: false },
  asChild: { type: Boolean, required: false },
  as: { type: null, required: false, default: "div" },
});

const itemClass = computed(() =>
  cn(
    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
    props.active && "bg-sidebar-accent text-sidebar-accent-foreground",
    props.class
  )
);
</script>

<template>
  <Primitive
    :as="as"
    :as-child="asChild"
    :class="itemClass"
  >
    <slot />
  </Primitive>
</template>

