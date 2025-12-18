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
    <h1 class="text-3xl font-bold mb-8">Welcome to Tauri + Vue</h1>

    <div class="flex justify-center mb-8">
      <a href="https://vite.dev" target="_blank">
        <img src="/vite.svg" class="logo vite" alt="Vite logo" />
      </a>
      <a href="https://tauri.app" target="_blank">
        <img src="/tauri.svg" class="logo tauri" alt="Tauri logo" />
      </a>
      <a href="https://vuejs.org/" target="_blank">
        <img src="./assets/vue.svg" class="logo vue" alt="Vue logo" />
      </a>
    </div>
    <p class="mb-8 text-muted-foreground text-lg">Click on the Tauri, Vite, and Vue logos to learn more.</p>

    <form class="flex justify-center gap-2 mb-12" @submit.prevent="greet">
      <input 
        id="greet-input" 
        v-model="name" 
        placeholder="Enter a name..." 
        class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 max-w-[200px]"
      />
      <Button size="sm" variant="default">Greet</Button>
    </form>
    
    <p class="mb-8 font-medium">{{ greetMsg }}</p>

    <div class="flex flex-col items-start gap-8 sm:flex-row p-6 border rounded-lg bg-card">
      <div class="flex items-start gap-2">
        <Button size="sm" variant="outline">
          Small
        </Button>
        <Button size="icon" aria-label="Submit" variant="outline" class="w-8 h-8">
          <ArrowUpRightIcon class="w-4 h-4" />
        </Button>
      </div>
      <div class="flex items-start gap-2">
        <Button variant="outline">
          Default
        </Button>
        <Button size="icon" aria-label="Submit" variant="outline">
          <ArrowUpRightIcon class="w-5 h-5" />
        </Button>
      </div>
      <div class="flex items-start gap-2">
        <Button variant="outline" size="lg">
          Large
        </Button>
        <Button size="icon" aria-label="Submit" variant="outline" class="w-12 h-12">
          <ArrowUpRightIcon class="w-6 h-6" />
        </Button>
      </div>
    </div>
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
