<script setup>
import { inject } from "vue";
import { Primitive } from "reka-ui";
import { cn } from "@/lib/utils";

const props = defineProps({
  value: { type: [String, Number], required: true },
  disabled: { type: Boolean, default: false },
  class: { type: null, required: false },
});

const emit = defineEmits(["select"]);

const context = inject("select-context", null);

const handleClick = () => {
  if (!props.disabled) {
    emit("select", props.value);
    if (context) {
      context.onSelect(props.value);
    }
  }
};
</script>

<template>
  <Primitive
    as="div"
    :class="cn(
      'relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      props.class
    )"
    :data-disabled="disabled ? '' : undefined"
    @click="handleClick"
  >
    <slot />
  </Primitive>
</template>

