<script setup>
import { ref, computed } from "vue";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSerialStore } from "@/stores/serial";
import { Trash2Icon, ArrowUpIcon, ArrowDownIcon } from "lucide-vue-next";

const serialStore = useSerialStore();
const sortColumn = ref("timestamp");
const sortDirection = ref("desc");

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
</script>

<template>
  <Card class="m-6">
    <CardHeader>
      <div class="flex items-center justify-between">
        <CardTitle>수신 데이터 로그</CardTitle>
        <Button variant="outline" size="sm" @click="clearData">
          <Trash2Icon class="mr-2 h-4 w-4" />
          지우기
        </Button>
      </div>
    </CardHeader>
    <CardContent>
      <ScrollArea class="h-[400px]">
        <table class="w-full border-collapse">
          <thead>
            <tr class="border-b">
              <th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
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
              v-for="(item, index) in sortedData"
              :key="index"
              class="border-b transition-colors hover:bg-muted/50"
            >
              <td class="p-4 align-middle">{{ formatTimestamp(item.timestamp) }}</td>
              <td class="p-4 align-middle font-mono text-sm">{{ formatData(item.data) }}</td>
            </tr>
            <tr v-if="sortedData.length === 0">
              <td colspan="2" class="h-24 text-center text-muted-foreground">
                수신된 데이터가 없습니다.
              </td>
            </tr>
          </tbody>
        </table>
      </ScrollArea>
      <div class="mt-4 text-sm text-muted-foreground">
        총 {{ serialStore.receivedData.length }}개 항목
      </div>
    </CardContent>
  </Card>
</template>

