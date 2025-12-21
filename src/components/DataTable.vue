<script setup>
import { ref, computed, watch, nextTick } from "vue";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSerialStore } from "@/stores/serial";
import { Trash2Icon, ArrowUpIcon, ArrowDownIcon, DownloadIcon } from "lucide-vue-next";

const serialStore = useSerialStore();
const sortColumn = ref("timestamp");
const sortDirection = ref("desc");
const scrollContainer = ref(null);

const sortedData = computed(() => {
  const data = [...serialStore.receivedData];
  if (sortColumn.value === "timestamp") {
    data.sort((a, b) => {
      const dateA = new Date(a.timestamp);
      const dateB = new Date(b.timestamp);
      return sortDirection.value === "asc"
        ? dateA - dateB
        : dateB - dateA;
    });
  }
  return data;
});

function toggleSort(column) {
  if (sortColumn.value === column) {
    sortDirection.value = sortDirection.value === "asc" ? "desc" : "asc";
  } else {
    sortColumn.value = column;
    sortDirection.value = "asc";
  }
}

function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString();
}

function formatData(data) {
  return typeof data === "string" ? data : JSON.stringify(data);
}

function clearData() {
  serialStore.clearReceivedData();
}

// Auto-scroll to bottom when new data arrives
watch(() => serialStore.receivedData.length, async () => {
  if (sortDirection.value === "asc") { // Scroll only if newest is at bottom
    await nextTick();
    if (scrollContainer.value) {
      scrollContainer.value.scrollTop = scrollContainer.value.scrollHeight;
    }
  }
});
</script>

<template>
  <Card class="m-6 flex flex-1 flex-col overflow-hidden">
    <CardHeader>
      <div class="flex items-center justify-between">
        <CardTitle>수신 데이터 로그</CardTitle>
        <div class="flex gap-2">
          <Button variant="outline" size="sm" @click="serialStore.exportLogs">
            <DownloadIcon class="mr-2 h-4 w-4" />
            내보내기
          </Button>
          <Button variant="outline" size="sm" @click="clearData">
            <Trash2Icon class="mr-2 h-4 w-4" />
            지우기
          </Button>
        </div>
      </div>
    </CardHeader>
    <CardContent class="flex-1 overflow-hidden p-0 relative flex flex-col">
      <!-- Scrollable Container with Single Unified Table -->
      <div 
        ref="scrollContainer" 
        class="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-primary/20"
      >
        <table class="w-full border-separate border-spacing-0">
          <thead class="sticky top-0 z-20 bg-background/95 backdrop-blur-md shadow-sm">
            <tr>
              <th class="h-10 px-4 text-left align-middle font-bold text-[10px] uppercase tracking-widest text-muted-foreground w-[180px] border-b border-r border-border">
                <Button
                  variant="ghost"
                  class="h-auto p-0 font-bold text-[10px] uppercase tracking-widest hover:bg-transparent"
                  @click="toggleSort('timestamp')"
                >
                  Timestamp
                  <ArrowUpIcon
                    v-if="sortColumn === 'timestamp' && sortDirection === 'asc'"
                    class="ml-1.5 h-3 w-3 text-primary"
                  />
                  <ArrowDownIcon
                    v-else-if="sortColumn === 'timestamp' && sortDirection === 'desc'"
                    class="ml-1.5 h-3 w-3 text-primary"
                  />
                </Button>
              </th>
              <th class="h-10 px-4 text-left align-middle font-bold text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border">
                Command / Data Stream
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border/50">
            <tr
              v-for="row in sortedData"
              :key="row.id || row.timestamp"
              class="group transition-colors hover:bg-muted/30"
            >
              <td class="px-4 py-2 w-[180px] text-[11px] text-muted-foreground/80 font-mono bg-muted/5 border-r border-border shrink-0">
                {{ formatTimestamp(row.timestamp) }}
              </td>
              <td class="px-4 py-2 font-mono text-[12px] break-all leading-relaxed">
                <div class="flex items-center gap-2">
                  <Badge 
                    v-if="row.data.startsWith('[SIM]')" 
                    variant="outline" 
                    class="h-4 px-1 text-[8px] font-bold border-primary/30 text-primary bg-primary/5 uppercase shrink-0"
                  >
                    Sim
                  </Badge>
                  <span class="opacity-90">{{ row.data.startsWith('[SIM]') ? row.data.replace('[SIM] ', '') : row.data }}</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Enhanced Empty State -->
        <div v-if="sortedData.length === 0" class="flex flex-col items-center justify-center py-32 text-muted-foreground/40 w-full transition-opacity duration-500">
          <div class="relative mb-6">
            <ActivityIcon class="h-16 w-16 opacity-10 animate-pulse" />
            <div class="absolute inset-0 flex items-center justify-center">
              <div class="h-2 w-2 rounded-full bg-primary/30 animate-ping"></div>
            </div>
          </div>
          <p class="text-[10px] font-bold uppercase tracking-[0.2em]">Listening for Data Stream</p>
          <div class="mt-4 flex gap-1.5 items-center">
             <div class="h-1 w-1 rounded-full bg-primary/40 animate-bounce [animation-delay:-0.3s]"></div>
             <div class="h-1 w-1 rounded-full bg-primary/40 animate-bounce [animation-delay:-0.15s]"></div>
             <div class="h-1 w-1 rounded-full bg-primary/40 animate-bounce"></div>
          </div>
        </div>
      </div>
    </CardContent>
    <div class="px-4 py-1.5 text-[9px] text-muted-foreground/60 border-t bg-muted/20 flex justify-between items-center font-mono tracking-tight uppercase">
      <div class="flex gap-4">
        <span>History: {{ serialStore.receivedData.length }}</span>
        <span>View: {{ sortedData.length }}</span>
      </div>
      <div class="flex items-center gap-1.5">
        <div class="h-1.5 w-1.5 rounded-full bg-green-500/50"></div>
        <span>System Ready</span>
      </div>
    </div>
  </Card>
</template>

<style scoped>
/* Standard table display for normal v-for */
table {
  width: 100%;
}
</style>

