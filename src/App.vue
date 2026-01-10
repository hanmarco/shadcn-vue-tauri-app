<script setup>
import { computed, ref } from "vue";
import MainLayout from "@/components/layouts/MainLayout.vue";
import SerialSettings from "@/components/SerialSettings.vue";
import ControlPanel from "@/components/ControlPanel.vue";
import DataTable from "@/components/DataTable.vue";
import RegisterMap from "@/components/RegisterMap.vue";
import ChatAssistant from "@/components/ChatAssistant.vue";

import { Toaster } from "@/components/ui/sonner";
import { useUiStore } from "@/stores/ui";

const activeTab = ref("config");
const uiStore = useUiStore();

const viewMap = {
    config: {
        component: SerialSettings,
        className: "h-full overflow-y-auto",
    },
    dashboard: {
        component: ControlPanel,
        className: "h-full overflow-y-auto",
    },
    registers: {
        component: RegisterMap,
        className: "h-full overflow-y-auto",
    },
    logs: {
        component: DataTable,
        className: "h-full overflow-hidden flex flex-col",
    },
};

const currentView = computed(() => {
    return viewMap[activeTab.value] || viewMap.config;
});
</script>

<template>
    <Toaster position="top-center" close-button rich-colors />
    <MainLayout v-model:activeTab="activeTab">
        <div class="h-full flex flex-col overflow-hidden">
            <Transition
                v-if="uiStore.isScreenTransitionEnabled"
                name="screen-switch"
                mode="out-in"
            >
                <div
                    :key="activeTab"
                    :class="currentView.className"
                >
                    <component :is="currentView.component" />
                </div>
            </Transition>
            <div v-else :class="currentView.className">
                <component :is="currentView.component" />
            </div>
        </div>
    </MainLayout>
    <ChatAssistant v-model:activeTab="activeTab" />
</template>
