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
      <!-- Table Header -->
      <div class="bg-background/95 backdrop-blur-sm border-b shadow-sm z-20">
        <table class="w-full table-fixed">
          <thead>
            <tr class="flex w-full">
              <th class="h-10 px-4 text-left align-middle font-medium text-muted-foreground w-[180px] shrink-0 border-r">
                <Button
                  variant="ghost"
                  class="h-auto p-0 font-bold text-[10px] uppercase tracking-wider h-full w-full justify-start"
                  @click="toggleSort('timestamp')"
                >
                  Timestamp
                  <ArrowUpIcon
                    v-if="sortColumn === 'timestamp' && sortDirection === 'asc'"
                    class="ml-2 h-3 w-3"
                  />
                  <ArrowDownIcon
                    v-else-if="sortColumn === 'timestamp' && sortDirection === 'desc'"
                    class="ml-2 h-3 w-3"
                  />
                </Button>
              </th>
              <th class="h-10 px-4 text-left align-middle font-medium text-muted-foreground flex-1 text-[10px] uppercase tracking-wider font-bold">
                Data Stream
              </th>
            </tr>
          </thead>
        </table>
      </div>

      <!-- Scrollable Table Body -->
      <div 
        ref="scrollContainer" 
        class="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-primary/20"
      >
        <table class="w-full table-auto border-collapse">
          <tbody class="divide-y divide-border">
            <tr
              v-for="row in sortedData"
              :key="row.id || row.timestamp"
              class="transition-colors hover:bg-muted/50 transition-all duration-150"
            >
              <td class="px-4 py-2 w-[160px] text-[11px] text-muted-foreground font-mono bg-muted/5 border-r border-border shrink-0">
                {{ formatTimestamp(row.timestamp) }}
              </td>
              <td class="px-3 py-2 font-mono text-xs flex-1 break-all">
                <span v-if="row.data.startsWith('[SIM]')" class="text-primary font-bold mr-2 text-[9px] border border-primary/20 px-1 rounded bg-primary/5 uppercase">SIM</span>
                {{ row.data.startsWith('[SIM]') ? row.data.replace('[SIM] ', '') : row.data }}
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Empty State -->
        <div v-if="sortedData.length === 0" class="flex flex-col items-center justify-center p-20 text-muted-foreground w-full">
          <Trash2Icon class="h-10 w-10 opacity-10 mb-4" />
          <p class="text-xs font-semibold uppercase tracking-widest opacity-40">WAITING FOR DATA STREAM</p>
          <div class="mt-4 flex gap-3">
             <div class="h-1 w-1 rounded-full bg-primary animate-ping"></div>
             <div class="h-1 w-1 rounded-full bg-primary animate-ping delay-75"></div>
             <div class="h-1 w-1 rounded-full bg-primary animate-ping delay-150"></div>
          </div>
        </div>
      </div>
    </CardContent>
    <div class="px-4 py-2 text-[10px] text-muted-foreground border-t bg-muted/30 flex justify-between items-center font-mono">
      <span>TOTAL ENTRIES: {{ serialStore.receivedData.length }}</span>
      <span class="text-primary/50">DEBUG: DISPLAYED={{ sortedData.length }}</span>
    </div>
  </Card>
</template>

<style scoped>
/* Standard table display for normal v-for */
table {
  width: 100%;
}
</style>

