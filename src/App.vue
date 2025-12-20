<script setup>
import { ref } from "vue";
import MainLayout from "@/components/layouts/MainLayout.vue";
import SerialSettings from "@/components/SerialSettings.vue";
import ControlPanel from "@/components/ControlPanel.vue";
import DataTable from "@/components/DataTable.vue";
import RegisterMap from "@/components/RegisterMap.vue";
import { LayoutDashboardIcon, CpuIcon } from "lucide-vue-next";

const activeTab = ref("dashboard");
</script>

<template>
  <MainLayout>
    <div class="flex h-full flex-col overflow-hidden bg-background">
      <!-- Fixed Settings Header -->
      <SerialSettings />

      <!-- Tab Navigation -->
      <div class="flex items-center gap-1 border-b px-6 bg-muted/20">
        <button
          @click="activeTab = 'dashboard'"
          :class="['flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all border-b-2', 
                    activeTab === 'dashboard' ? 'border-primary text-primary bg-primary/5' : 'border-transparent text-muted-foreground hover:text-foreground']"
        >
          <LayoutDashboardIcon class="h-4 w-4" />
          대시보드 (Dashboard)
        </button>
        <button
          @click="activeTab = 'registers'"
          :class="['flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all border-b-2', 
                    activeTab === 'registers' ? 'border-primary text-primary bg-primary/5' : 'border-transparent text-muted-foreground hover:text-foreground']"
        >
          <CpuIcon class="h-4 w-4" />
          레지스터 맵 (Register Map)
        </button>
      </div>

      <!-- Tab Content -->
      <div class="flex-1 overflow-hidden relative">
        <!-- Dashboard View -->
        <div v-show="activeTab === 'dashboard'" class="h-full flex flex-col overflow-y-auto">
          <ControlPanel />
          <DataTable />
        </div>

        <!-- Register Map View -->
        <div v-show="activeTab === 'registers'" class="h-full">
          <RegisterMap />
        </div>
      </div>
    </div>
  </MainLayout>
</template>
