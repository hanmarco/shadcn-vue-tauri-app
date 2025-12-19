<script setup>
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Select, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useSerialStore } from "@/stores/serial";
import { RefreshCwIcon, PowerIcon } from "lucide-vue-next";

const serialStore = useSerialStore();

const baudRates = [9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600];
const parities = [
  { value: "none", label: "None" },
  { value: "even", label: "Even" },
  { value: "odd", label: "Odd" },
];
const stopBitsOptions = [1, 2];
const dataBitsOptions = [5, 6, 7, 8];

async function handleConnect() {
  if (serialStore.isConnected) {
    await serialStore.disconnect();
  } else if (serialStore.selectedDevice) {
    await serialStore.connect(serialStore.selectedDevice);
  }
}

async function handleRefresh() {
  await serialStore.scanDevices();
}
</script>

<template>
  <Card class="m-6">
    <CardHeader>
      <CardTitle>시리얼 통신 설정</CardTitle>
      <CardDescription>Baud Rate, Parity, Stop Bit 등 통신 파라미터 설정</CardDescription>
    </CardHeader>
    <CardContent class="space-y-4">
      <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div class="space-y-2">
          <label class="text-sm font-medium">Baud Rate</label>
          <Select
            v-model="serialStore.baudRate"
            :disabled="serialStore.isConnected"
            placeholder="Baud Rate 선택"
          >
            <SelectItem
              v-for="rate in baudRates"
              :key="rate"
              :value="rate"
              @select="serialStore.baudRate = $event"
            >
              {{ rate }}
            </SelectItem>
          </Select>
        </div>

        <div class="space-y-2">
          <label class="text-sm font-medium">Parity</label>
          <Select
            v-model="serialStore.parity"
            :disabled="serialStore.isConnected"
            placeholder="Parity 선택"
          >
            <SelectItem
              v-for="p in parities"
              :key="p.value"
              :value="p.value"
              @select="serialStore.parity = $event"
            >
              {{ p.label }}
            </SelectItem>
          </Select>
        </div>

        <div class="space-y-2">
          <label class="text-sm font-medium">Stop Bits</label>
          <Select
            v-model="serialStore.stopBits"
            :disabled="serialStore.isConnected"
            placeholder="Stop Bits 선택"
          >
            <SelectItem
              v-for="bits in stopBitsOptions"
              :key="bits"
              :value="bits"
              @select="serialStore.stopBits = $event"
            >
              {{ bits }}
            </SelectItem>
          </Select>
        </div>

        <div class="space-y-2">
          <label class="text-sm font-medium">Data Bits</label>
          <Select
            v-model="serialStore.dataBits"
            :disabled="serialStore.isConnected"
            placeholder="Data Bits 선택"
          >
            <SelectItem
              v-for="bits in dataBitsOptions"
              :key="bits"
              :value="bits"
              @select="serialStore.dataBits = $event"
            >
              {{ bits }}
            </SelectItem>
          </Select>
        </div>
      </div>

      <Separator />

      <div class="flex items-center gap-2">
        <Button
          :variant="serialStore.isConnected ? 'destructive' : 'default'"
          @click="handleConnect"
          :disabled="!serialStore.selectedDevice"
        >
          <PowerIcon class="mr-2 h-4 w-4" />
          {{ serialStore.isConnected ? "연결 해제" : "연결" }}
        </Button>
        <Button variant="outline" @click="handleRefresh">
          <RefreshCwIcon class="mr-2 h-4 w-4" />
          장치 새로고침
        </Button>
      </div>
    </CardContent>
  </Card>
</template>

