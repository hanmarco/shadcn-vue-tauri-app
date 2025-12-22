<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { useSerialStore } from "@/stores/serial";
import { 
  DownloadIcon, 
  Trash2Icon, 
  ArrowUpIcon, 
  ArrowDownIcon, 
  SearchIcon,
  FilterIcon,
  ZapIcon,
  RadioIcon,
  DatabaseIcon
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";

const serialStore = useSerialStore();
const scrollContainer = ref(null);
const sortColumn = ref("timestamp");
const sortDirection = ref("desc");

// New features: Search and Filtering
const searchQuery = ref("");
const typeFilter = ref("all"); // 'all', 'tx', 'rx'

const filteredData = computed(() => {
  let data = [...serialStore.receivedData];
  
  // Apply Type Filter
  if (typeFilter.value !== 'all') {
    data = data.filter(item => item.type === typeFilter.value);
  }
  
  // Apply Search Query
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase();
    data = data.filter(item => 
      item.data.toLowerCase().includes(q) || 
      (item.port && item.port.toLowerCase().includes(q))
    );
  }
  
  // Apply Sorting
  return data.sort((a, b) => {
    let valA = a[sortColumn.value];
    let valB = b[sortColumn.value];

    if (sortColumn.value === "timestamp") {
      valA = new Date(valA).getTime();
      valB = new Date(valB).getTime();
    }

    if (valA < valB) return sortDirection.value === "asc" ? -1 : 1;
    if (valA > valB) return sortDirection.value === "asc" ? 1 : -1;
    return 0;
  });
});

function toggleSort(column) {
  if (sortColumn.value === column) {
    sortDirection.value = sortDirection.value === "asc" ? "desc" : "asc";
  } else {
    sortColumn.value = column;
    sortDirection.value = "desc";
  }
}

function clearData() {
  serialStore.clearReceivedData();
}

function formatTimestamp(isoString) {
  const date = new Date(isoString);
  return date.toLocaleTimeString("ko-KR", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  });
}

// Auto-scroll logic
watch(() => serialStore.receivedData.length, () => {
  if (scrollContainer.value) {
    setTimeout(() => {
      scrollContainer.value.scrollTop = scrollContainer.value.scrollHeight;
    }, 50);
  }
});

onMounted(() => {
  if (scrollContainer.value) {
    scrollContainer.value.scrollTop = scrollContainer.value.scrollHeight;
  }
});
</script>

<template>
  <Card class="m-6 flex flex-1 flex-col overflow-hidden bg-background/50 backdrop-blur-sm border-primary/10">
    <CardHeader class="pb-3 border-b">
      <div class="flex flex-col gap-4">
        <!-- Top Row: Title and Global Actions -->
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div class="p-2 rounded-md bg-primary/10 text-primary">
              <DatabaseIcon class="h-4 w-4" />
            </div>
            <CardTitle class="text-xl font-bold tracking-tight">송수신 데이터 로그</CardTitle>
          </div>
          <div class="flex gap-2">
            <Button variant="outline" size="sm" class="h-8 gap-2" @click="serialStore.exportLogs">
              <DownloadIcon class="h-3.5 w-3.5" />
              내보내기
            </Button>
            <Button variant="outline" size="sm" class="h-8 gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive" @click="clearData">
              <Trash2Icon class="h-3.5 w-3.5" />
              지우기
            </Button>
          </div>
        </div>

        <!-- Filter Row -->
        <div class="flex items-center gap-4">
          <!-- Search Bar -->
          <div class="relative flex-1 group">
            <SearchIcon class="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Filter by command or port..."
              class="w-full h-9 rounded-md border border-input bg-background/50 pl-9 pr-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:bg-background transition-all"
            />
          </div>

          <!-- Type Filters -->
          <div class="flex items-center bg-muted/30 p-1 rounded-lg border">
            <button 
              @click="typeFilter = 'all'"
              :class="[
                'px-3 py-1 text-xs font-semibold rounded-md transition-all',
                typeFilter === 'all' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              ]"
            >
              All
            </button>
            <button 
              @click="typeFilter = 'tx'"
              :class="[
                'px-3 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5',
                typeFilter === 'tx' ? 'bg-blue-500/20 text-blue-400 shadow-sm' : 'text-muted-foreground hover:text-foreground'
              ]"
            >
              <ZapIcon class="h-3 w-3" />
              TX
            </button>
            <button 
              @click="typeFilter = 'rx'"
              :class="[
                'px-3 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5',
                typeFilter === 'rx' ? 'bg-emerald-500/20 text-emerald-400 shadow-sm' : 'text-muted-foreground hover:text-foreground'
              ]"
            >
              <RadioIcon class="h-3 w-3" />
              RX
            </button>
          </div>
        </div>
      </div>
    </CardHeader>

    <CardContent class="flex-1 overflow-hidden p-0 relative flex flex-col">
      <div 
        ref="scrollContainer" 
        class="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-primary/10 hover:scrollbar-thumb-primary/20"
      >
        <Table class="relative w-full border-collapse">
          <TableHeader class="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b">
            <TableRow class="hover:bg-transparent">
              <TableHead class="w-[120px] font-bold text-[10px] uppercase tracking-wider">
                <button @click="toggleSort('timestamp')" class="flex items-center gap-1.5 py-2 hover:text-primary transition-colors">
                  Timestamp
                  <ArrowUpIcon v-if="sortColumn === 'timestamp' && sortDirection === 'asc'" class="h-3 w-3" />
                  <ArrowDownIcon v-else-if="sortColumn === 'timestamp' && sortDirection === 'desc'" class="h-3 w-3" />
                </button>
              </TableHead>
              <TableHead class="w-[60px] font-bold text-[10px] uppercase tracking-wider text-center">Type</TableHead>
              <TableHead class="w-[100px] font-bold text-[10px] uppercase tracking-wider">Port</TableHead>
              <TableHead class="font-bold text-[10px] uppercase tracking-wider">Data Stream</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow
              v-for="row in filteredData"
              :key="row.id"
              :class="[
                'group border-b border-border/50',
                row.type === 'tx' ? 'bg-blue-500/10 hover:bg-blue-500/10' : 'bg-emerald-500/10 hover:bg-emerald-500/10'
              ]"
            >
              <TableCell class="font-mono text-[11px] text-muted-foreground/80 py-2">
                {{ formatTimestamp(row.timestamp) }}
              </TableCell>
              
              <TableCell class="text-center py-2">
                <Badge 
                  :class="[
                    'text-[9px] h-4 px-1.5 font-black border-0',
                    row.type === 'tx' ? 'bg-blue-500/20 text-blue-400' : 'bg-emerald-500/20 text-emerald-400'
                  ]"
                >
                  {{ row.type === 'tx' ? 'TX' : 'RX' }}
                </Badge>
              </TableCell>
              
              <TableCell class="font-mono text-[11px] font-semibold py-2">
                {{ row.port || '-' }}
              </TableCell>
              
              <TableCell class="font-mono text-[12px] py-1">
                <div class="flex items-center gap-2">
                  <Badge 
                    v-if="row.data.includes('[SIM]')" 
                    variant="outline" 
                    class="h-5 px-1 text-[8px] font-bold border-primary/30 text-primary bg-primary/5 uppercase"
                  >
                    Sim
                  </Badge>
                  <span 
                    :class="[
                      'tracking-tight break-all leading-tight',
                      row.type === 'tx' ? 'text-blue-500 font-medium' : 'text-emerald-500'
                    ]"
                  >
                    {{ row.data.includes('[SIM]') ? row.data.replace('[SIM] ', '') : row.data }}
                  </span>
                </div>
              </TableCell>
            </TableRow>
            <TableRow v-if="filteredData.length === 0">
              <TableCell colspan="4" class="h-32 text-center text-muted-foreground italic opacity-50">
                <div class="flex flex-col items-center justify-center gap-2">
                  <DatabaseIcon class="h-8 w-8 opacity-20" />
                  <span>No matching log entries found.</span>
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </CardContent>
    <div class="px-4 py-1.5 text-[9px] text-muted-foreground/60 border-t bg-muted/20 flex justify-between items-center font-mono tracking-tight uppercase">
      <div class="flex gap-4">
        <span>History: {{ serialStore.receivedData.length }} Entries</span>
        <span>Filter: {{ filteredData.length }} Match</span>
      </div>
      <div class="flex items-center gap-1.5">
        <div class="h-1.5 w-1.5 rounded-full bg-green-500/50 animate-pulse"></div>
        <span>Log System Active</span>
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

