<script setup>
import { onMounted } from "vue";
import { Sidebar, SidebarHeader, SidebarContent, SidebarItem } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSerialStore } from "@/stores/serial";
import { UsbIcon, WifiIcon, ActivityIcon } from "lucide-vue-next";

const serialStore = useSerialStore();

async function handleDeviceClick(device) {
  if (serialStore.isConnecting) {
    return;
  }
  
  // 장치 이름에서 실제 포트 이름 추출 (예: "COM3 (VID:0403 PID:6010)" -> "COM3")
  const portName = device.split(" ")[0];
  if (serialStore.isConnected && serialStore.selectedDevice === device) {
    await serialStore.disconnect();
  } else {
    await serialStore.connect(portName);
  }
}

onMounted(async () => {
  await serialStore.setupEventListeners();
  await serialStore.scanDevices();
});
</script>

<template>
  <div class="flex h-screen w-full overflow-hidden">
    <!-- Sidebar -->
    <Sidebar>
      <SidebarHeader>
        <h2 class="text-lg font-semibold">IC 제어 앱</h2>
      </SidebarHeader>
      <SidebarContent>
        <div class="space-y-2">
          <div class="px-3 py-2">
            <h3 class="mb-2 text-xs font-semibold text-muted-foreground">연결된 장치</h3>
            <div v-if="serialStore.connectedDevices.length === 0" class="text-sm text-muted-foreground">
              장치 없음
            </div>
            <SidebarItem
              v-for="device in serialStore.connectedDevices"
              :key="device"
              :active="serialStore.selectedDevice === device"
              :class="{ 'opacity-50 cursor-not-allowed': serialStore.isConnecting }"
              @click="handleDeviceClick(device)"
            >
              <UsbIcon class="h-4 w-4" />
              <span>{{ device }}</span>
              <Badge
                v-if="serialStore.selectedDevice === device && serialStore.isConnected"
                variant="success"
                class="ml-auto"
              >
                연결됨
              </Badge>
              <Badge
                v-else-if="serialStore.isConnecting && serialStore.selectedDevice === device"
                variant="secondary"
                class="ml-auto"
              >
                연결 중...
              </Badge>
            </SidebarItem>
          </div>
        </div>
      </SidebarContent>
    </Sidebar>

    <!-- Main Content -->
    <div class="flex flex-1 flex-col overflow-hidden">
      <slot />
    </div>
  </div>
</template>

