<script setup>
import { onMounted } from "vue";
import { Sidebar, SidebarHeader, SidebarContent, SidebarItem } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSerialStore } from "@/stores/serial";
import { 
  SettingsIcon, 
  LayoutDashboardIcon, 
  CpuIcon, 
  ScrollTextIcon 
} from "lucide-vue-next";

const props = defineProps({
  activeTab: {
    type: String,
    required: true
  }
});

const emit = defineEmits(["update:activeTab"]);

const serialStore = useSerialStore();

onMounted(async () => {
  await serialStore.setupEventListeners();
  await serialStore.scanDevices();
});
</script>

<template>
  <div class="flex h-screen w-full overflow-hidden bg-background">
    <!-- Sidebar -->
    <Sidebar>
      <SidebarHeader class="border-b px-6 py-4">
        <h2 class="text-xl font-bold tracking-tight">IC CONTROLLER</h2>
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
    </Sidebar>

    <!-- Main Content -->
    <main class="flex flex-1 flex-col overflow-hidden bg-muted/10">
      <slot />
    </main>
  </div>
</template>

