import { defineStore } from "pinia";
import { ref } from "vue";

export const useUiStore = defineStore("ui", () => {
  const isScreenTransitionEnabled = ref(false);
  const logSearchQuery = ref("");

  return {
    isScreenTransitionEnabled,
    logSearchQuery,
  };
});
