<script setup>
import { onMounted } from "vue";
import MainLayout from "@/components/layouts/MainLayout.vue";
import SerialSettings from "@/components/SerialSettings.vue";
import ControlPanel from "@/components/ControlPanel.vue";
import DataTable from "@/components/DataTable.vue";
import Toaster from "@/components/ui/sonner/Sonner.vue";
</script>

<template>
  <MainLayout>
    <div class="flex h-full flex-col overflow-hidden bg-background">
      <SerialSettings />
      <ControlPanel />
      <DataTable />
    </div>
    <Toaster />
  </MainLayout>
</template>
