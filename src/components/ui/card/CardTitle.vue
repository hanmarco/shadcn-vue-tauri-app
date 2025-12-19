<script setup>
import { Primitive } from "reka-ui";
import { cn } from "@/lib/utils";

const props = defineProps({
  class: { type: null, required: false },
  asChild: { type: Boolean, required: false },
  as: { type: null, required: false, default: "h3" },
});
</script>

<template>
  <Primitive
    :as="as"
    :as-child="asChild"
    :class="cn('font-semibold leading-none tracking-tight', props.class)"
  >
    <slot />
  </Primitive>
</template>

