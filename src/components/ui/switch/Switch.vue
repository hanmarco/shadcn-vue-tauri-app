<script setup>
import { computed } from "vue";
import { Primitive } from "reka-ui";
import { cn } from "@/lib/utils";

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  class: { type: null, required: false },
});

const emit = defineEmits(["update:modelValue"]);

const checked = computed({
  get: () => props.modelValue,
  set: (val) => emit("update:modelValue", val),
});

const toggle = () => {
  if (!props.disabled) {
    checked.value = !checked.value;
  }
};
</script>

<template>
  <Primitive
    as="button"
    type="button"
    role="switch"
    :aria-checked="checked"
    :disabled="disabled"
    :class="cn(
      'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50',
      checked ? 'bg-primary' : 'bg-input',
      props.class
    )"
    @click="toggle"
  >
    <span
      :class="cn(
        'pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform',
        checked ? 'translate-x-4' : 'translate-x-0'
      )"
    />
  </Primitive>
</template>

