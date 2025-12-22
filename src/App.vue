<script setup>
import { ref } from "vue";
import MainLayout from "@/components/layouts/MainLayout.vue";
import SerialSettings from "@/components/SerialSettings.vue";
import ControlPanel from "@/components/ControlPanel.vue";
import DataTable from "@/components/DataTable.vue";
import RegisterMap from "@/components/RegisterMap.vue";

const activeTab = ref("config");
</script>

<template>
  <MainLayout v-model:activeTab="activeTab">
    <div class="h-full flex flex-col overflow-hidden">
      <!-- Configuration View -->
      <div v-if="activeTab === 'config'" class="h-full overflow-y-auto">
        <SerialSettings />
      </div>

      <!-- Dashboard View -->
      <div v-if="activeTab === 'dashboard'" class="h-full overflow-y-auto">
        <ControlPanel />
      </div>

      <!-- Register Map View -->
      <div v-if="activeTab === 'registers'" class="h-full overflow-y-auto">
        <RegisterMap />
      </div>

      <!-- Log View -->
      <div v-if="activeTab === 'logs'" class="h-full overflow-hidden flex flex-col">
        <DataTable />
      </div>
    </div>
  </MainLayout>
</template>
