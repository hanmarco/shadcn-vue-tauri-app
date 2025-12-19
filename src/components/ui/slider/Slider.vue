<script setup>
import { ref, computed } from "vue";
import { Primitive } from "reka-ui";
import { cn } from "@/lib/utils";

const props = defineProps({
  modelValue: { type: [Number, Array], default: 0 },
  min: { type: Number, default: 0 },
  max: { type: Number, default: 100 },
  step: { type: Number, default: 1 },
  disabled: { type: Boolean, default: false },
  class: { type: null, required: false },
});

const emit = defineEmits(["update:modelValue"]);

const value = computed({
  get: () => props.modelValue,
  set: (val) => emit("update:modelValue", val),
});

const handleInput = (e) => {
  const newValue = parseFloat(e.target.value);
  value.value = newValue;
};
</script>

<template>
  <div :class="cn('relative flex w-full touch-none select-none items-center', props.class)">
    <div class="relative h-2 w-full grow overflow-hidden rounded-full bg-secondary">
      <div
        class="absolute h-full bg-primary"
        :style="{ width: `${((value - min) / (max - min)) * 100}%` }"
      />
    </div>
    <div
      class="absolute h-5 w-5 -translate-x-1/2 rounded-full border-2 border-primary bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
      :style="{ left: `${((value - min) / (max - min)) * 100}%` }"
    />
    <Primitive
      as="input"
      type="range"
      :min="min"
      :max="max"
      :step="step"
      :disabled="disabled"
      :value="value"
      @input="handleInput"
      class="absolute inset-0 z-10 h-full w-full cursor-pointer appearance-none bg-transparent opacity-0"
    />
  </div>
</template>

