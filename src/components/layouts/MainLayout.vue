<script setup>
import { onMounted } from "vue";
import { toast } from "vue-sonner";
import { Sidebar, SidebarHeader, SidebarContent, SidebarFooter, SidebarItem } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useSerialStore } from "@/stores/serial";
import { useDark, useToggle } from "@vueuse/core";
import { 
  SettingsIcon, 
  LayoutDashboardIcon, 
  CpuIcon, 
  ScrollTextIcon,
  MoonIcon,
  SunIcon
} from "lucide-vue-next";

const props = defineProps({
  activeTab: {
    type: String,
    required: true
  }
});

const emit = defineEmits(["update:activeTab"]);

const serialStore = useSerialStore();
const isDark = useDark();
const toggleDark = useToggle(isDark);

onMounted(async () => {
  await serialStore.loadSettings();
  await serialStore.setupEventListeners();
  await serialStore.scanDevices();
});

const handleConnection = () => {
  if (serialStore.isConnected) {
    serialStore.disconnect();
  } else {
    const target = serialStore.selectedDevice || serialStore.lastConnectedDevice;

    if (target) {
      serialStore.connect(target);
    } else if (serialStore.deviceType !== 'serialport') {
      serialStore.connect('Default IC');
    } else {
      serialStore.scanDevices();
    }
  }
};
</script>

<template>
  <div class="flex h-screen w-full overflow-hidden bg-background">
    <!-- Sidebar -->
    <Sidebar>
      <SidebarHeader class="border-b px-6 py-4 flex flex-row items-center justify-between">
        <h2 class="text-xl font-bold tracking-tight">IC CONTROLLER</h2>
        <div 
          class="flex items-center gap-2 cursor-pointer group active:scale-95 transition-transform"
          @click="handleConnection"
        >
          <span 
            class="h-2.5 w-2.5 rounded-full transition-all duration-300"
            :class="[
              serialStore.isConnected 
                ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse' 
                : serialStore.isConnecting
                ? 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.6)] animate-pulse'
                : 'bg-muted-foreground/30'
            ]"
          ></span>
          <span 
            class="text-[10px] font-bold uppercase tracking-widest transition-colors select-none"
            :class="[
              serialStore.isConnected ? 'text-green-500' : 
              serialStore.isConnecting ? 'text-yellow-500 animate-pulse' :
              'text-muted-foreground/50 group-hover:text-muted-foreground'
            ]"
          >
            {{ serialStore.isConnected ? 'Online' : serialStore.isConnecting ? 'Connecting...' : 'Offline' }}
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent class="py-4">
        <div class="px-3 py-2">
          <h3 class="mb-4 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
            Navigation
          </h3>
          <div class="space-y-1">
            <SidebarItem
              :active="activeTab === 'config'"
              @click="emit('update:activeTab', 'config')"
            >
              <SettingsIcon class="mr-2 h-4 w-4" />
              <span>Configuration</span>
            </SidebarItem>
            <SidebarItem
              :active="activeTab === 'dashboard'"
              @click="emit('update:activeTab', 'dashboard')"
            >
              <LayoutDashboardIcon class="mr-2 h-4 w-4" />
              <span>Dashboard</span>
            </SidebarItem>
            <SidebarItem
              :active="activeTab === 'registers'"
              @click="emit('update:activeTab', 'registers')"
            >
              <CpuIcon class="mr-2 h-4 w-4" />
              <span>Register Map</span>
            </SidebarItem>
            <SidebarItem
              :active="activeTab === 'logs'"
              @click="emit('update:activeTab', 'logs')"
            >
              <ScrollTextIcon class="mr-2 h-4 w-4" />
              <span>Logs</span>
            </SidebarItem>
          </div>
        </div>

      </SidebarContent>

      <!-- Sidebar Footer (Absolute Bottom) -->
      <SidebarFooter class="space-y-3">
        <!-- Dark Mode Toggle -->
        <div class="flex items-center justify-between px-2 py-2 rounded-md hover:bg-muted/30 transition-colors">
          <div class="flex items-center gap-2">
            <div class="flex h-7 w-7 items-center justify-center rounded-md bg-muted/60">
              <SunIcon v-if="!isDark" class="h-4 w-4 text-orange-500" />
              <MoonIcon v-else class="h-4 w-4 text-blue-400" />
            </div>
            <span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">Theme</span>
          </div>
          <Switch
            :model-value="isDark"
            @update:model-value="toggleDark()"
          />
        </div>

        <!-- Simulation Toggle -->
        <div class="flex items-center justify-between px-2 py-2 rounded-md bg-primary/5 border border-primary/10">
          <div class="flex items-center gap-2">
            <div class="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4 animate-pulse"><path d="m3 21 1.9-1.9"/><path d="m3 18 5.9-5.9"/><circle cx="12" cy="12" r="2"/><path d="m15.1 8.9 5.9-5.9"/><path d="m18 3 3 3"/><path d="M21 21a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <div class="flex flex-col">
              <span class="text-[10px] font-bold uppercase tracking-wider text-primary">Simulation</span>
              <span class="text-[8px] text-muted-foreground italic leading-none">VIRTUAL CORE</span>
            </div>
          </div>
          <Switch
            :model-value="serialStore.isSimulationMode"
            @update:model-value="(val) => {
              serialStore.isSimulationMode = val;
              serialStore.scanDevices();
            }"
          />
        </div>
      </SidebarFooter>
    </Sidebar>

    <!-- Main Content -->
    <main class="flex flex-1 flex-col overflow-hidden bg-muted/10">
      <slot />
    </main>
  </div>
</template>

