<script setup>
import { ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { ArrowUpRightIcon } from "lucide-vue-next";

const greetMsg = ref("");
const name = ref("");

async function greet() {
  // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
  greetMsg.value = await invoke("greet", { name: name.value });
}
</script>

<template>
  <main class="flex flex-col items-center justify-center min-h-screen p-4 text-center">
  </main>
</template>


<style scoped>
.logo.vite:hover {
  filter: drop-shadow(0 0 2em #747bff);
}

.logo.vue:hover {
  filter: drop-shadow(0 0 2em #249b73);
}

.logo.tauri:hover {
  filter: drop-shadow(0 0 2em #24c8db);
}

.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
  transition: 0.75s;
}
</style>
