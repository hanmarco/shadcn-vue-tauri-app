<script setup>
import { ref, computed, onMounted, onUnmounted, provide } from "vue";
import { Primitive } from "reka-ui";
import { cn } from "@/lib/utils";
import { ChevronDownIcon } from "lucide-vue-next";

const props = defineProps({
  modelValue: { type: [String, Number], default: null },
  disabled: { type: Boolean, default: false },
  placeholder: { type: String, default: "Select..." },
  class: { type: null, required: false },
});

const emit = defineEmits(["update:modelValue"]);

const isOpen = ref(false);
const selectRef = ref(null);

const value = computed({
  get: () => props.modelValue,
  set: (val) => emit("update:modelValue", val),
});

const onSelect = (val) => {
  value.value = val;
  isOpen.value = false;
};

provide("select-context", {
  onSelect,
  modelValue: computed(() => props.modelValue),
});

const toggle = () => {
  if (!props.disabled) {
    isOpen.value = !isOpen.value;
  }
};

const handleClickOutside = (event) => {
  if (selectRef.value && !selectRef.value.contains(event.target)) {
    isOpen.value = false;
  }
};

onMounted(() => {
  document.addEventListener("click", handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener("click", handleClickOutside);
});
</script>

<template>
  <div ref="selectRef" :class="cn('relative', props.class)">
    <Primitive
      as="button"
      type="button"
      :disabled="disabled"
      :class="cn(
        'flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        props.class
      )"
      @click="toggle"
    >
      <span>{{ value !== null && value !== undefined ? value : placeholder }}</span>
      <ChevronDownIcon class="h-4 w-4 opacity-50" />
    </Primitive>
    <div
      v-if="isOpen"
      class="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md"
      @click.stop
    >
      <slot />
    </div>
  </div>
</template>

