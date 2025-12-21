<script setup>
import { onMounted } from "vue";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Select, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useSerialStore } from "@/stores/serial";
import { UsbIcon, RefreshCwIcon, PowerIcon, AlertCircleIcon, LoaderIcon } from "lucide-vue-next";

const serialStore = useSerialStore();

onMounted(async () => {
  await serialStore.loadSettings();
  await serialStore.scanDevices();
  await serialStore.setupEventListeners();
});

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

const handleRefresh = async () => {
  await serialStore.scanDevices();
}
</script>

<template>
  <div class="space-y-6 m-6">
    <!-- 장치 선택 섹션 -->
    <Card>
      <CardHeader>
        <CardTitle class="flex items-center gap-2">
          <UsbIcon class="h-5 w-5 text-primary" />
          장치 선택
        </CardTitle>
        <CardDescription>연결 가능한 시리얼 장치 목록을 확인하고 선택하세요</CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <div v-if="serialStore.connectedDevices.length === 0" class="flex flex-col items-center justify-center p-8 border border-dashed rounded-lg text-muted-foreground italic">
          검색된 장치가 없습니다.
          <Button variant="link" @click="handleRefresh" class="mt-2">
            <RefreshCwIcon class="mr-2 h-4 w-4" />
            다시 검색
          </Button>
        </div>
        <div v-else class="grid gap-2">
          <div
            v-for="device in serialStore.connectedDevices"
            :key="device"
            @click="serialStore.selectedDevice = device"
            :class="[
              'flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer hover:bg-muted/50',
              serialStore.selectedDevice === device ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border'
            ]"
          >
            <div class="flex items-center gap-3">
              <div :class="['p-2 rounded-full', serialStore.selectedDevice === device ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground']">
                <UsbIcon class="h-4 w-4" />
              </div>
              <div>
                <div class="font-medium">{{ device }}</div>
                <div class="text-xs text-muted-foreground">Serial Port Device</div>
              </div>
            </div>
            <Badge
              v-if="serialStore.isConnected && serialStore.selectedDevice === device"
              variant="success"
              class="ml-auto"
            >
              연결됨
            </Badge>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <Button
            :variant="serialStore.isConnected ? 'destructive' : 'default'"
            @click="handleConnect"
            :disabled="!serialStore.selectedDevice || serialStore.isConnecting"
            class="min-w-[120px]"
          >
            <LoaderIcon
              v-if="serialStore.isConnecting"
              class="mr-2 h-4 w-4 animate-spin"
            />
            <PowerIcon
              v-else
              class="mr-2 h-4 w-4"
            />
            {{
              serialStore.isConnecting
                ? "연결 중..."
                : serialStore.isConnected
                ? "연결 해제"
                : "장치 연결"
            }}
          </Button>
          <Button
            variant="outline"
            @click="handleRefresh"
            :disabled="serialStore.isConnecting"
          >
            <RefreshCwIcon class="mr-2 h-4 w-4" />
            목록 새로고침
          </Button>
        </div>
      </CardContent>
    </Card>

    <!-- 시리얼 설정 섹션 -->
    <Card>
      <CardHeader>
        <CardTitle>시리얼 통신 설정</CardTitle>
        <CardDescription>Baud Rate, Parity, Stop Bit 등 세부 통신 파라미터 설정</CardDescription>
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
              >
                {{ bits }}
              </SelectItem>
            </Select>
          </div>
        </div>

        <Separator />

        <!-- 에러 메시지 표시 -->
        <div v-if="serialStore.connectionError" class="rounded-md bg-destructive/10 border border-destructive/20 p-3">
          <div class="flex items-center gap-2 text-destructive">
            <AlertCircleIcon class="h-4 w-4" />
            <span class="text-sm font-medium">연결 실패</span>
          </div>
          <p class="mt-1 text-sm text-destructive/80">{{ serialStore.connectionError }}</p>
        </div>
      </CardContent>
    </Card>
  </div>
</template>

