<script setup>
import { computed, ref } from "vue";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectItem } from "@/components/ui/select";
import RegisterHexController from "@/components/RegisterHexController.vue";
import { useSerialStore } from "@/stores/serial";
import { useRegisterStore } from "@/stores/registers";

const serialStore = useSerialStore();
const registerStore = useRegisterStore();

const clampByte = (val) => Math.min(255, Math.max(0, Math.round(Number(val) || 0)));
const generalSlaveAddress = ref(0);
const generalData = ref(Array.from({ length: 256 }, () => 0));
const generalAddressesLeft = computed(() => Array.from({ length: 0x80 }, (_, i) => i));
const generalAddressesRight = computed(() => Array.from({ length: 0xff - 0x7F }, (_, i) => 0x80 + i));
const slaveOptions = computed(() =>
  Array.from({ length: 256 }, (_, i) => ({
    value: i,
    label: `0x${i.toString(16).toUpperCase().padStart(2, "0")}`,
  })),
);

function setGeneralData(address, value) {
  generalData.value[address] = clampByte(value);
}

async function handleGeneralReadAll() {
  for (let addr = 0; addr <= 0xff; addr += 1) {
    await registerStore.readRegister(addr);
    const reg = registerStore.registers.find((r) => r.address === addr);
    if (reg && typeof reg.value === "number") {
      setGeneralData(addr, reg.value);
    }
  }
}

async function handleGeneralWriteAll() {
  for (let addr = 0; addr <= 0xff; addr += 1) {
    await registerStore.writeRegister(addr, generalData.value[addr]);
  }
}

function handleGeneralClearAll() {
  generalData.value = Array.from({ length: 256 }, () => 0);
}
</script>

<template>
  <Card class="h-full border-primary/20 bg-background/60 backdrop-blur-md">
    <CardHeader class="pb-2">
      <CardTitle class="flex items-center gap-2 text-sm font-semibold">
        General Panel
      </CardTitle>
      <CardDescription class="text-xs">
        0x00~0xFF 레인지 전체를 빠르게 제어합니다.
      </CardDescription>
    </CardHeader>
    <CardContent class="space-y-3">
      <div class="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          class="h-8 px-3 text-xs"
          :disabled="!serialStore.isConnected"
          @click="handleGeneralReadAll"
        >
          Read All
        </Button>
        <Button
          size="sm"
          variant="secondary"
          class="h-8 px-3 text-xs"
          :disabled="!serialStore.isConnected"
          @click="handleGeneralWriteAll"
        >
          Write All
        </Button>
        <Button
          size="sm"
          variant="ghost"
          class="h-8 px-3 text-xs"
          :disabled="!serialStore.isConnected"
          @click="handleGeneralClearAll"
        >
          Clear All (Data=0)
        </Button>
        <div class="flex items-center gap-2 ml-auto">
          <span class="text-[11px] text-muted-foreground">Slave</span>
          <Select v-model="generalSlaveAddress" :disabled="!serialStore.isConnected">
            <SelectItem v-for="opt in slaveOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </SelectItem>
          </Select>
        </div>
      </div>

      <div class="grid gap-2 lg:grid-cols-2">
        <div class="space-y-2 max-h-[600px] overflow-y-auto pr-1">
          <RegisterHexController
            v-for="addr in generalAddressesLeft"
            :key="`left-${addr}`"
            :slave-address="generalSlaveAddress"
            :register-address="addr"
            :data="generalData[addr]"
            :show-slave="false"
            :show-bits="false"
            :show-actions="false"
            :disabled="!serialStore.isConnected"
            @update:data="setGeneralData(addr, $event)"
          />
        </div>
        <div class="space-y-2 max-h-[600px] overflow-y-auto pr-1">
          <RegisterHexController
            v-for="addr in generalAddressesRight"
            :key="`right-${addr}`"
            :slave-address="generalSlaveAddress"
            :register-address="addr"
            :data="generalData[addr]"
            :show-slave="false"
            :show-bits="false"
            :show-actions="false"
            :disabled="!serialStore.isConnected"
            @update:data="setGeneralData(addr, $event)"
          />
        </div>
      </div>
    </CardContent>
  </Card>
</template>
