<script setup>
import { computed, ref, watch } from "vue";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const props = defineProps({
  slaveAddress: { type: Number, required: false, default: 0 },
  registerAddress: { type: Number, required: false, default: 0 },
  data: { type: Number, required: false, default: 0 },
  disabled: { type: Boolean, required: false, default: false },
  showSlave: { type: Boolean, required: false, default: true },
  showRegister: { type: Boolean, required: false, default: true },
  showBits: { type: Boolean, required: false, default: true },
  showData: { type: Boolean, required: false, default: true },
  showActions: { type: Boolean, required: false, default: true },
});

const emit = defineEmits([
  "update:slaveAddress",
  "update:registerAddress",
  "update:data",
  "write",
  "read",
]);

const slaveAddress = ref(clampByte(props.slaveAddress));
const registerAddress = ref(clampByte(props.registerAddress));
const dataValue = ref(clampByte(props.data));
const dataHex = ref(toHex(dataValue.value));
const slaveHex = ref(toHex(slaveAddress.value));
const registerHex = ref(toHex(registerAddress.value));

watch(
  () => props.slaveAddress,
  (val) => {
    slaveAddress.value = clampByte(val);
    slaveHex.value = toHex(slaveAddress.value);
  },
);

watch(
  () => props.registerAddress,
  (val) => {
    registerAddress.value = clampByte(val);
    registerHex.value = toHex(registerAddress.value);
  },
);

watch(
  () => props.data,
  (val) => {
    setDataValue(val, false);
  },
);

function clampByte(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.min(255, Math.max(0, Math.trunc(num)));
}

function toHex(val) {
  return clampByte(val).toString(16).toUpperCase().padStart(2, "0");
}

function parseHexInput(raw) {
  const cleaned = String(raw ?? "")
    .replace(/^0x/i, "")
    .toUpperCase()
    .replace(/[^0-9A-F]/g, "")
    .slice(0, 2);
  return cleaned;
}

function parseByteInput(raw) {
  const numeric = Number(raw);
  if (Number.isFinite(numeric)) return clampByte(numeric);
  const hex = parseHexInput(raw);
  return clampByte(hex ? parseInt(hex, 16) : 0);
}

function updateSlave(event) {
  const next = parseByteInput(event?.target?.value ?? event);
  slaveHex.value = toHex(next);
  slaveAddress.value = next;
  emit("update:slaveAddress", slaveAddress.value);
}

function updateRegister(event) {
  const next = parseByteInput(event?.target?.value ?? event);
  registerHex.value = toHex(next);
  registerAddress.value = next;
  emit("update:registerAddress", registerAddress.value);
}

function stepSlave(delta) {
  const next = clampByte(slaveAddress.value + delta);
  slaveHex.value = toHex(next);
  slaveAddress.value = next;
  emit("update:slaveAddress", next);
}

function stepRegister(delta) {
  const next = clampByte(registerAddress.value + delta);
  registerHex.value = toHex(next);
  registerAddress.value = next;
  emit("update:registerAddress", next);
}

function updateSlaveHexInput(event) {
  const raw = String(event?.target?.value ?? "").toUpperCase();
  const cleaned = raw.replace(/[^0-9A-F]/g, "");
  if (!cleaned.length) {
    slaveHex.value = "";
    slaveAddress.value = 0;
    emit("update:slaveAddress", slaveAddress.value);
    return;
  }
  const trimmed = cleaned.slice(-2);
  if (trimmed.length === 1) {
    slaveHex.value = trimmed;
    return;
  }
  const finalHex = trimmed;
  const next = Number.parseInt(finalHex, 16);
  slaveHex.value = finalHex;
  slaveAddress.value = clampByte(next);
  emit("update:slaveAddress", slaveAddress.value);
}

function updateRegisterHexInput(event) {
  const raw = String(event?.target?.value ?? "").toUpperCase();
  const cleaned = raw.replace(/[^0-9A-F]/g, "");
  if (!cleaned.length) {
    registerHex.value = "";
    registerAddress.value = 0;
    emit("update:registerAddress", registerAddress.value);
    return;
  }
  const trimmed = cleaned.slice(-2);
  if (trimmed.length === 1) {
    registerHex.value = trimmed;
    return;
  }
  const finalHex = trimmed;
  const next = Number.parseInt(finalHex, 16);
  registerHex.value = finalHex;
  registerAddress.value = clampByte(next);
  emit("update:registerAddress", registerAddress.value);
}

function setDataValue(val, shouldEmit = true, hexOverride) {
  const next = clampByte(val);
  dataValue.value = next;
  dataHex.value = hexOverride ?? toHex(next);
  if (shouldEmit) emit("update:data", next);
}

function updateData(event) {
  const next = parseByteInput(event?.target?.value ?? event);
  setDataValue(next);
}

function updateDataHexInput(event) {
  const raw = String(event?.target?.value ?? "").toUpperCase();
  const cleaned = raw.replace(/[^0-9A-F]/g, "");
  if (!cleaned.length) {
    setDataValue(0, true, "");
    return;
  }

  const trimmed = cleaned.slice(-2);

  // If only one char after trimming, show that single char (resetting prior content).
  if (trimmed.length === 1) {
    dataHex.value = trimmed;
    return;
  }

  const finalHex = trimmed;
  const next = parseInt(finalHex, 16);
  setDataValue(Number.isNaN(next) ? 0 : next, true, finalHex);
}

function stepData(delta) {
  setDataValue(dataValue.value + delta);
}

function toggleBit(bit) {
  setDataValue(dataValue.value ^ (1 << bit));
}

const bits = computed(() =>
  Array.from({ length: 8 }, (_, idx) => {
    const bit = 7 - idx;
    const checked = Boolean(dataValue.value & (1 << bit));
    return { bit, checked };
  }),
);

function handleWrite() {
  emit("write", {
    slaveAddress: slaveAddress.value,
    registerAddress: registerAddress.value,
    data: dataValue.value,
  });
}

function handleRead() {
  emit("read", {
    slaveAddress: slaveAddress.value,
    registerAddress: registerAddress.value,
  });
}
</script>

<template>
  <TooltipProvider>
    <div
      class="w-full rounded-md border bg-card/60 px-2 py-1 shadow-sm"
      :class="{ 'opacity-60 pointer-events-none': disabled }"
    >
      <div class="flex items-center gap-1.5">
        <template v-if="props.showSlave">
          <Tooltip>
            <TooltipTrigger as-child>
            <div class="flex items-center gap-1 rounded-sm border border-input bg-background/70 px-1 py-0.5">
              <div class="relative">
                <span class="pointer-events-none absolute left-0.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">0x</span>
                <input
                  :value="slaveHex"
                  @input="updateSlaveHexInput"
                  maxlength="2"
                  class="w-9 h-6 rounded-sm border border-input bg-background pl-4 pr-1 text-[11px] font-mono uppercase focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <input
                :value="slaveAddress"
                @input="updateSlave"
                type="number"
                min="0"
                max="255"
                step="1"
                class="w-4 h-6 min-w-[1rem] text-transparent caret-transparent selection:bg-transparent bg-transparent border border-input rounded-sm appearance-auto p-0 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" align="center" class="text-xs">
            슬레이브 주소(0x00~0xFF)
          </TooltipContent>
          </Tooltip>
        </template>

        <Separator v-if="props.showSlave && props.showRegister" orientation="vertical" class="h-6" />

        <template v-if="props.showRegister">
          <Tooltip>
            <TooltipTrigger as-child>
            <div class="flex items-center gap-1 rounded-sm border border-input bg-background/70 px-1 py-0.5">
              <div class="relative">
                <span class="pointer-events-none absolute left-0.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">0x</span>
                <input
                  :value="registerHex"
                  @input="updateRegisterHexInput"
                  maxlength="2"
                  class="w-9 h-6 rounded-sm border border-input bg-background pl-4 pr-1 text-[11px] font-mono uppercase focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <input
                :value="registerAddress"
                @input="updateRegister"
                type="number"
                min="0"
                max="255"
                step="1"
                class="w-4 h-6 min-w-[1rem] text-transparent caret-transparent selection:bg-transparent bg-transparent border border-input rounded-sm appearance-auto p-0 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" align="center" class="text-xs">
            레지스터 주소(0x00~0xFF)
          </TooltipContent>
          </Tooltip>
        </template>

        <Separator
          v-if="props.showBits && (props.showSlave || props.showRegister)"
          orientation="vertical"
          class="h-6"
        />

        <template v-if="props.showBits">
          <Tooltip>
            <TooltipTrigger as-child>
              <div class="flex items-center gap-1">
                <input
                  v-for="item in bits"
                  :key="item.bit"
                  type="checkbox"
                  :checked="item.checked"
                  class="h-3 w-3 accent-primary"
                  @change="toggleBit(item.bit)"
                />
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="center" class="text-xs">
              비트 토글(7~0)
            </TooltipContent>
          </Tooltip>
        </template>

        <Separator
          v-if="props.showData && (props.showBits || props.showSlave || props.showRegister)"
          orientation="vertical"
          class="h-6"
        />

        <template v-if="props.showData">
          <Tooltip>
            <TooltipTrigger as-child>
              <div class="flex items-center gap-1 rounded-sm border border-input bg-background/70 px-1 py-0.5">
                <div class="relative">
                  <span class="pointer-events-none absolute left-0.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">0x</span>
                  <input
                    :value="dataHex"
                    @input="updateDataHexInput"
                    maxlength="2"
                    class="w-9 h-6 rounded-sm border border-input bg-background pl-4 pr-1 text-[11px] font-mono uppercase focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <input
                  :value="dataValue"
                  @input="updateData"
                  type="number"
                  min="0"
                  max="255"
                  step="1"
                  class="w-4 h-6 min-w-[1rem] text-transparent caret-transparent selection:bg-transparent bg-transparent border border-input rounded-sm appearance-auto p-0 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="center" class="text-xs">
              데이터(0x00~0xFF)
            </TooltipContent>
          </Tooltip>
        </template>

        <Separator
          v-if="props.showActions && (props.showData || props.showBits || props.showRegister || props.showSlave)"
          orientation="vertical"
          class="h-6"
        />

        <template v-if="props.showActions">
          <div class="flex items-center gap-1">
            <Button size="sm" variant="secondary" class="h-7 px-2.5 text-[9px]" @click="handleRead">
              Read
            </Button>
            <Button size="sm" variant="outline" class="h-7 px-2.5 text-[9px]" @click="handleWrite">
              Write
            </Button>
          </div>
        </template>
      </div>
    </div>
  </TooltipProvider>
</template>
