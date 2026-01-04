<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from "vue";
import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
} from "@/components/ui/card";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useRegisterStore } from "@/stores/registers";
import { useSerialStore } from "@/stores/serial";
import {
    SearchIcon,
    SaveIcon,
    RefreshCwIcon,
    CpuIcon,
    BinaryIcon,
    InfoIcon,
} from "lucide-vue-next";

const registerStore = useRegisterStore();
const serialStore = useSerialStore();

const searchQuery = ref("");
const listParentRef = ref(null);
const scrollTop = ref(0);
const containerHeight = ref(0);
const rowHeight = 36;
const overscan = 10;
const detailRegisterAddress = ref(null);
const detailPending = ref(false);
let detailTimer = null;

const filteredRegisters = computed(() => {
    const list = registerStore.registers || [];
    if (!searchQuery.value) return list;
    const q = searchQuery.value.toLowerCase();
    return list.filter(
        (r) =>
            r.name.toLowerCase().includes(q) ||
            r.address.toString(16).toLowerCase().includes(q),
    );
});

const detailRegister = computed(() =>
    registerStore.registers.find(
        (reg) => reg.address === detailRegisterAddress.value,
    ),
);

const totalRows = computed(() => filteredRegisters.value.length);
const visibleStart = computed(() => {
    const start = Math.floor(scrollTop.value / rowHeight) - overscan;
    return Math.max(0, start);
});
const visibleEnd = computed(() => {
    const end =
        Math.ceil((scrollTop.value + containerHeight.value) / rowHeight) +
        overscan;
    return Math.min(totalRows.value, end);
});
const visibleRegisters = computed(() =>
    filteredRegisters.value.slice(visibleStart.value, visibleEnd.value),
);
const paddingTop = computed(() => visibleStart.value * rowHeight);
const paddingBottom = computed(
    () => (totalRows.value - visibleEnd.value) * rowHeight,
);

function updateContainerHeight() {
    if (!listParentRef.value) return;
    containerHeight.value = listParentRef.value.clientHeight;
}

let resizeObserver;
onMounted(() => {
    updateContainerHeight();
    if (listParentRef.value && typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(() => updateContainerHeight());
        resizeObserver.observe(listParentRef.value);
    }
});

onBeforeUnmount(() => {
    if (resizeObserver && listParentRef.value) {
        resizeObserver.unobserve(listParentRef.value);
    }
});

watch(
    () => registerStore.selectedRegisterAddress,
    (address) => {
        if (detailTimer) clearTimeout(detailTimer);
        detailPending.value = true;
        if (address === null || address === undefined) {
            detailRegisterAddress.value = null;
            detailPending.value = false;
            return;
        }
        detailTimer = setTimeout(() => {
            detailRegisterAddress.value = address;
            detailPending.value = false;
        }, 300);
    },
    { immediate: true },
);

function selectRegister(address) {
    registerStore.selectedRegisterAddress = address;
}

function createRipple(event) {
    const target = event.currentTarget;
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const ripple = document.createElement("span");
    ripple.className = "ripple-effect";
    ripple.style.position = "absolute";
    ripple.style.borderRadius = "9999px";
    ripple.style.background = "rgba(99, 102, 241, 0.2)";
    ripple.style.transform = "scale(0)";
    ripple.style.animation = "ripple 450ms ease-out";
    ripple.style.pointerEvents = "none";
    ripple.style.width = `${size}px`;
    ripple.style.height = `${size}px`;
    ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
    ripple.style.top = `${event.clientY - rect.top - size / 2}px`;
    target.appendChild(ripple);
    ripple.addEventListener("animationend", () => {
        ripple.remove();
    });
}

function toggleBit(field, currentValue) {
    const newValue = currentValue === 0 ? 1 : 0;
    registerStore.updateBitfield(detailRegisterAddress.value, field, newValue);
}

function getFieldValue(regValue, field) {
    const mask = (1 << field.size) - 1;
    return (regValue >> field.bit) & mask;
}
</script>

<template>
    <div class="flex h-full flex-col gap-4 p-6 overflow-hidden">
        <div class="flex items-center justify-between">
            <div>
                <h2 class="text-2xl font-bold tracking-tight">Register Map</h2>
                <p class="text-muted-foreground">
                    IC 레지스터 직접 제어 및 비트필드 편집
                </p>
            </div>
            <div
                v-if="!serialStore.isConnected"
                class="flex items-center gap-2 text-destructive text-sm font-medium animate-pulse"
            >
                <InfoIcon class="h-4 w-4" />
                장치 연결 필요 (오프라인)
            </div>
            <div
                v-else-if="
                    serialStore.selectedDevice === serialStore.VIRTUAL_DEVICE
                "
                class="flex items-center gap-2 text-primary text-sm font-medium animate-pulse"
            >
                <CpuIcon class="h-4 w-4" />
                VIRTUAL SIMULATION ACTIVE
            </div>
        </div>

        <div class="grid flex-1 grid-cols-12 gap-4 overflow-hidden">
            <!-- Register List (Left) -->
            <Card
                class="col-span-12 flex flex-col overflow-hidden lg:col-span-5 xl:col-span-4 bg-background/50 backdrop-blur-sm border-primary/10"
            >
                <CardHeader class="p-4 pb-2">
                    <div class="relative">
                        <SearchIcon
                            class="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"
                        />
                        <input
                            v-model="searchQuery"
                            type="text"
                            placeholder="Search registers (Name/Addr)..."
                            class="w-full rounded-md border border-input bg-background pl-9 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                    </div>
                </CardHeader>
                <CardContent class="p-0 flex-1 overflow-hidden">
                    <div
                        ref="listParentRef"
                        class="h-full overflow-auto"
                        @scroll="scrollTop = $event.target.scrollTop"
                    >
                        <div
                            class="sticky top-0 z-10 grid grid-cols-[80px_1fr_90px] items-center gap-2 border-b bg-background/90 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground shadow-sm"
                        >
                            <div>Addr</div>
                            <div>Register</div>
                            <div class="text-right">Value</div>
                        </div>
                        <div
                            class="p-0"
                            :style="{
                                paddingTop: `${paddingTop}px`,
                                paddingBottom: `${paddingBottom}px`,
                            }"
                        >
                            <div
                                v-for="reg in visibleRegisters"
                                :key="reg.address"
                                class="relative overflow-hidden grid grid-cols-[80px_1fr_90px] items-center gap-2 border-b px-4 py-2 cursor-pointer transition-colors"
                                :class="{
                                    'bg-primary/10 border-l-2 border-l-primary':
                                        registerStore.selectedRegisterAddress ===
                                        reg.address,
                                }"
                                @click="
                                    createRipple($event);
                                    selectRegister(reg.address);
                                "
                            >
                                <div class="font-mono text-xs">
                                    0x{{
                                        reg.address
                                            .toString(16)
                                            .toUpperCase()
                                            .padStart(4, "0")
                                    }}
                                </div>
                                <div class="font-medium text-sm">
                                    {{ reg.name }}
                                </div>
                                <div
                                    class="text-right font-mono text-sm tabular-nums"
                                >
                                    0x{{
                                        reg.value
                                            .toString(16)
                                            .toUpperCase()
                                            .padStart(2, "0")
                                    }}
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <!-- Register Detail / Bitfield Editor (Right) -->
            <Card
                class="col-span-12 flex flex-col overflow-hidden lg:col-span-7 xl:col-span-8 bg-background/50 backdrop-blur-sm border-primary/10"
            >
                <template v-if="detailPending">
                    <div
                        class="flex flex-col items-center justify-center h-full text-muted-foreground p-12 text-center"
                    >
                        <div
                            class="h-10 w-10 rounded-full border-2 border-muted border-t-primary animate-spin"
                        />
                        <p class="mt-3 text-sm">Loading register detail...</p>
                    </div>
                </template>
                <template v-else-if="detailRegister">
                    <CardHeader class="p-4 border-b">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-3">
                                <div class="p-2 rounded-lg bg-primary/10">
                                    <CpuIcon class="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <CardTitle class="text-lg"
                                        >0x{{
                                            detailRegister.address
                                                .toString(16)
                                                .toUpperCase()
                                                .padStart(4, "0")
                                        }}: {{ detailRegister.name }}</CardTitle
                                    >
                                    <CardDescription class="text-xs">{{
                                        detailRegister.description
                                    }}</CardDescription>
                                </div>
                            </div>
                            <div class="flex items-center gap-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    class="h-8 gap-2"
                                    :disabled="!serialStore.isConnected"
                                    @click="
                                        registerStore.readRegister(
                                            detailRegister.address,
                                        )
                                    "
                                >
                                    <RefreshCwIcon class="h-3 w-3" />
                                    Read
                                </Button>
                                <Button
                                    size="sm"
                                    variant="default"
                                    class="h-8 gap-2"
                                    v-if="!detailRegister.readOnly"
                                    :disabled="!serialStore.isConnected"
                                    @click="
                                        registerStore.writeRegister(
                                            detailRegister.address,
                                            detailRegister.value,
                                        )
                                    "
                                >
                                    <SaveIcon class="h-3 w-3" />
                                    Write
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent class="p-0 flex-1 overflow-hidden">
                        <div class="h-full overflow-auto">
                            <div class="p-6 space-y-6">
                                <!-- Large Hex Viewer -->
                                <div
                                    class="flex flex-col items-center justify-center py-8 rounded-xl bg-muted/30 border border-dashed"
                                >
                                    <div
                                        class="text-[10px] uppercase font-bold tracking-widest text-muted-foreground mb-1"
                                    >
                                        Current Value
                                    </div>
                                    <div
                                        class="text-5xl font-mono font-bold tracking-tighter text-primary"
                                    >
                                        0x{{
                                            detailRegister.value
                                                .toString(16)
                                                .toUpperCase()
                                                .padStart(2, "0")
                                        }}
                                    </div>
                                    <div
                                        class="text-xs font-mono text-muted-foreground mt-2 opacity-50"
                                    >
                                        BINARY:
                                        {{
                                            detailRegister.value
                                                .toString(2)
                                                .padStart(8, "0")
                                        }}
                                    </div>
                                </div>

                                <!-- Bitfield List -->
                                <div class="space-y-4">
                                    <div class="flex items-center gap-2">
                                        <BinaryIcon
                                            class="h-4 w-4 text-primary"
                                        />
                                        <h4 class="text-sm font-semibold">
                                            Bitfield Specification
                                        </h4>
                                    </div>

                                    <div
                                        v-if="
                                            detailRegister.fields.length === 0
                                        "
                                        class="flex flex-col items-center justify-center p-8 text-center border rounded-lg opacity-40 italic"
                                    >
                                        <p class="text-sm">
                                            No bitfields defined for this
                                            register.
                                        </p>
                                    </div>

                                    <div v-else class="grid gap-3">
                                        <div
                                            v-for="field in detailRegister.fields"
                                            :key="field.name"
                                            class="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors group"
                                        >
                                            <div class="flex flex-col">
                                                <div
                                                    class="flex items-center gap-2"
                                                >
                                                    <span
                                                        class="text-sm font-bold"
                                                        >{{ field.name }}</span
                                                    >
                                                    <span
                                                        class="text-[10px] px-1.5 py-0.5 rounded-full bg-muted font-mono"
                                                    >
                                                        BIT
                                                        {{
                                                            field.size > 1
                                                                ? `${field.bit + field.size - 1}:${field.bit}`
                                                                : field.bit
                                                        }}
                                                    </span>
                                                </div>
                                                <span
                                                    class="text-xs text-muted-foreground"
                                                    >{{
                                                        field.description
                                                    }}</span
                                                >
                                            </div>

                                            <div
                                                class="flex items-center gap-4"
                                            >
                                                <template
                                                    v-if="field.size === 1"
                                                >
                                                    <Switch
                                                        :model-value="
                                                            getFieldValue(
                                                                detailRegister.value,
                                                                field,
                                                            ) === 1
                                                        "
                                                        :disabled="
                                                            detailRegister.readOnly
                                                        "
                                                        @update:model-value="
                                                            toggleBit(
                                                                field,
                                                                getFieldValue(
                                                                    detailRegister.value,
                                                                    field,
                                                                ),
                                                            )
                                                        "
                                                    />
                                                </template>
                                                <template v-else>
                                                    <input
                                                        type="number"
                                                        :min="0"
                                                        :max="
                                                            (1 << field.size) -
                                                            1
                                                        "
                                                        :value="
                                                            getFieldValue(
                                                                detailRegister.value,
                                                                field,
                                                            )
                                                        "
                                                        :disabled="
                                                            detailRegister.readOnly
                                                        "
                                                        class="w-16 rounded border bg-background px-2 py-1 text-right text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                                                        @input="
                                                            (e) =>
                                                                registerStore.updateBitfield(
                                                                    detailRegister.address,
                                                                    field,
                                                                    parseInt(
                                                                        e.target
                                                                            .value,
                                                                    ),
                                                                )
                                                        "
                                                    />
                                                </template>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </template>
                <div
                    v-else
                    class="flex flex-col items-center justify-center h-full text-muted-foreground opacity-30 p-12 text-center"
                >
                    <CpuIcon class="h-16 w-16 mb-4" />
                    <p class="text-lg font-medium">Select a register to edit</p>
                    <p class="text-sm">
                        왼쪽 리스트에서 레지스터를 선택하여 세부 비트 설정을
                        시작하세요.
                    </p>
                </div>
            </Card>
        </div>
    </div>
</template>

<style>
@keyframes ripple {
    to {
        transform: scale(1);
        opacity: 0;
    }
}
</style>
