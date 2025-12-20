<script setup>
import { ref, computed, watch } from "vue";
import { useVirtualizer } from "@tanstack/vue-virtual";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSerialStore } from "@/stores/serial";
import { Trash2Icon, ArrowUpIcon, ArrowDownIcon } from "lucide-vue-next";

const serialStore = useSerialStore();
const sortColumn = ref("timestamp");
const sortDirection = ref("desc");
const parentRef = ref(null);

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

const rowVirtualizer = useVirtualizer({
  count: computed(() => sortedData.value.length),
  getScrollElement: () => parentRef.value?.$el?.querySelector('[data-radix-scroll-area-viewport]'),
  estimateSize: () => 45, // Estimated row height
  overscan: 10,
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

// Watch for data changes to scroll to bottom if needed (optional)
watch(() => sortedData.value.length, () => {
  if (sortDirection.value === "desc") {
    // Usually we want to stay at the top if newest is at the top
  }
});
</script>

<template>
  <Card class="m-6 flex flex-1 flex-col overflow-hidden">
    <CardHeader>
      <div class="flex items-center justify-between">
        <CardTitle>수신 데이터 로그</CardTitle>
        <Button variant="outline" size="sm" @click="clearData">
          <Trash2Icon class="mr-2 h-4 w-4" />
          지우기
        </Button>
      </div>
    </CardHeader>
    <CardContent class="flex-1 overflow-hidden p-0">
      <ScrollArea ref="parentRef" class="h-full w-full">
        <div class="relative w-full" :style="{ height: `${rowVirtualizer.getTotalSize()}px` }">
          <table class="w-full border-collapse">
            <thead class="sticky top-0 z-10 bg-background border-b">
              <tr>
                <th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground w-1/4">
                  <Button
                    variant="ghost"
                    class="h-auto p-0 font-medium"
                    @click="toggleSort('timestamp')"
                  >
                    시간
                    <ArrowUpIcon
                      v-if="sortColumn === 'timestamp' && sortDirection === 'asc'"
                      class="ml-2 h-4 w-4"
                    />
                    <ArrowDownIcon
                      v-else-if="sortColumn === 'timestamp' && sortDirection === 'desc'"
                      class="ml-2 h-4 w-4"
                    />
                  </Button>
                </th>
                <th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                  데이터
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="virtualRow in rowVirtualizer.getVirtualItems()"
                :key="virtualRow.key"
                :data-index="virtualRow.index"
                class="absolute left-0 w-full border-b transition-colors hover:bg-muted/50 flex"
                :style="{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                  top: '48px' /* Height of thead */
                }"
              >
                <td class="p-4 align-middle w-1/4 truncate">{{ formatTimestamp(sortedData[virtualRow.index].timestamp) }}</td>
                <td class="p-4 align-middle font-mono text-sm flex-1 truncate">{{ formatData(sortedData[virtualRow.index].data) }}</td>
              </tr>
              <tr v-if="sortedData.length === 0" class="flex items-center justify-center h-24 text-muted-foreground">
                <td class="w-full text-center">
                  수신된 데이터가 없습니다.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </ScrollArea>
    </CardContent>
    <div class="p-4 pt-0 text-sm text-muted-foreground border-t bg-background">
      총 {{ serialStore.receivedData.length }}개 항목 (최근 10,000개 유지)
    </div>
  </Card>
</template>

<style scoped>
/* Ensure table layout doesn't break virtualization with absolute rows */
tbody {
  display: block;
  position: relative;
}
thead tr {
  display: flex;
}
tr {
  width: 100%;
}
</style>

