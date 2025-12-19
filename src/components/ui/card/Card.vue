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
    :class="cn('rounded-xl border bg-card text-card-foreground shadow', props.class)"
  >
    <slot />
  </Primitive>
</template>

