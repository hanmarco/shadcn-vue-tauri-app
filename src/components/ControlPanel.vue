<script setup>
import { onMounted, computed } from "vue";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Select, SelectItem } from "@/components/ui/select";
import { useControlStore } from "@/stores/control";
import { useSerialStore } from "@/stores/serial";
import { ActivityIcon, ZapIcon, GaugeIcon, CpuIcon, CheckIcon, LoaderIcon } from "lucide-vue-next";

const controlStore = useControlStore();
const serialStore = useSerialStore();

onMounted(async () => {
  await controlStore.loadControlSettings();
});

const vioOptionsByMode = {
  rffe: [
    { value: 0, label: "External VIO (0)" },
    { value: 1, label: "Internal 1.2V (1)" },
    { value: 2, label: "Internal 1.8V (2)" },
  ],
  spi: [
    { value: 0, label: "External VIO (0)" },
    { value: 1, label: "Internal 1.2V (1)" },
    { value: 2, label: "Internal 1.8V (2)" },
    { value: 3, label: "Internal 2.5V (3)" },
    { value: 4, label: "Internal 3.3V (4)" },
  ],
  i3c: [
    { value: 0, label: "External VIO (0)" },
    { value: 1, label: "Internal 1.2V (1)" },
    { value: 2, label: "Internal 1.8V (2)" },
    { value: 4, label: "Internal 3.3V (4)" },
  ],
};

const vioOptions = computed(() => {
  return vioOptionsByMode[serialStore.protocolMode] || vioOptionsByMode.rffe;
});

const clockValue = computed({
  get: () => (serialStore.protocolMode === "spi" ? serialStore.spiClockKHz : serialStore.rffeClockKHz),
  set: (val) => {
    if (serialStore.protocolMode === "spi") {
      serialStore.spiClockKHz = val;
    } else {
      serialStore.rffeClockKHz = val;
    }
  },
});

const clockRange = computed(() => {
  if (serialStore.protocolMode === "spi") {
    return { min: 50, max: 26000, step: 50 };
  }
  return { min: 100, max: 60000, step: 100 };
});
</script>

<template>
  <div class="grid gap-4 p-6 md:grid-cols-2 lg:grid-cols-4">
    <!-- VIO 제어 -->
    <Card class="relative overflow-hidden border-primary/20 bg-background/50 backdrop-blur-md">
      <div class="absolute top-0 right-0 p-2 opacity-5">
        <ZapIcon class="h-16 w-16" />
      </div>
      <CardHeader class="pb-2">
        <CardTitle class="flex items-center gap-2 text-sm font-semibold">
          <ZapIcon class="h-4 w-4 text-yellow-500" />
          VIO 제어
        </CardTitle>
        <CardDescription class="text-xs">SC4415 VIO 레벨 설정</CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-xs font-medium text-muted-foreground">설정값</span>
            <div class="flex items-center gap-2">
              <Badge variant="secondary" class="font-mono">
                {{ vioOptions.find(opt => opt.value === serialStore.vioSetting)?.label || `VIO ${serialStore.vioSetting}` }}
              </Badge>
            </div>
          </div>
          <Select v-model="serialStore.vioSetting">
            <SelectItem v-for="opt in vioOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </SelectItem>
          </Select>
          <Button 
            size="sm" 
            variant="outline"
            :class="[
              'w-full h-8 text-xs gap-2 transition-all duration-300',
              controlStore.sendingStates.voltage.success ? 'bg-green-600 text-white hover:bg-green-700 dark:bg-green-700' : ''
            ]"
            :disabled="!serialStore.isConnected || controlStore.sendingStates.voltage.loading"
            @click="controlStore.setVoltage()"
          >
            <LoaderIcon v-if="controlStore.sendingStates.voltage.loading" class="h-3 w-3 animate-spin" />
            <CheckIcon v-else :class="['h-3 w-3', controlStore.sendingStates.voltage.success ? 'text-white' : '']" />
            {{ controlStore.sendingStates.voltage.loading ? '전송 중...' : controlStore.sendingStates.voltage.success ? '전송 완료' : '전압 전송' }}
          </Button>
          <p v-if="!serialStore.isConnected" class="text-[10px] text-center text-muted-foreground italic">
            장치 연결 필요 (오프라인)
          </p>
          <p v-else-if="serialStore.selectedDevice === serialStore.VIRTUAL_DEVICE" class="text-[10px] text-center text-primary font-medium animate-pulse">
            VIRTUAL SIMULATION ACTIVE
          </p>
        </div>
      </CardContent>
    </Card>

    <!-- 클럭 제어 -->
    <Card class="relative overflow-hidden border-primary/20 bg-background/50 backdrop-blur-md">
      <div class="absolute top-0 right-0 p-2 opacity-5">
        <GaugeIcon class="h-16 w-16" />
      </div>
      <CardHeader class="pb-2">
        <CardTitle class="flex items-center gap-2 text-sm font-semibold">
          <GaugeIcon class="h-4 w-4 text-blue-500" />
          클럭 제어
        </CardTitle>
        <CardDescription class="text-xs">프로토콜 별 클럭 설정</CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="space-y-3">
          <div v-if="serialStore.protocolMode === 'i3c'" class="space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-xs font-medium text-muted-foreground">I3C Rate Index</span>
              <input
                v-model.number="serialStore.i3cRateIndex"
                type="number"
                min="0"
                class="w-20 rounded-md border border-input bg-background/50 px-2 py-1 text-right text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div class="flex items-center justify-between">
              <span class="text-xs font-medium text-muted-foreground">I2C Rate Index</span>
              <input
                v-model.number="serialStore.i2cRateIndex"
                type="number"
                min="0"
                class="w-20 rounded-md border border-input bg-background/50 px-2 py-1 text-right text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
          <div v-else class="space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-xs font-medium text-muted-foreground">설정값</span>
              <div class="flex items-center gap-2">
                <input
                  v-model.number="clockValue"
                  type="number"
                  :min="clockRange.min"
                  :max="clockRange.max"
                  :step="clockRange.step"
                  class="w-24 rounded-md border border-input bg-background/50 px-2 py-1 text-right text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <Badge variant="secondary" class="font-mono">{{ clockValue }}kHz</Badge>
              </div>
            </div>
            <Slider
              :model-value="clockValue"
              :min="clockRange.min"
              :max="clockRange.max"
              :step="clockRange.step"
              class="py-2"
              @update:model-value="(val) => clockValue = val"
            />
          </div>
          <Button 
            size="sm" 
            variant="outline" 
            :class="[
              'w-full h-8 text-xs gap-2 transition-all duration-300',
              controlStore.sendingStates.frequency.success ? 'bg-green-600 text-white hover:bg-green-700 dark:bg-green-700' : ''
            ]"
            :disabled="!serialStore.isConnected || controlStore.sendingStates.frequency.loading"
            @click="controlStore.setFrequency()"
          >
            <LoaderIcon v-if="controlStore.sendingStates.frequency.loading" class="h-3 w-3 animate-spin" />
            <CheckIcon v-else :class="['h-3 w-3', controlStore.sendingStates.frequency.success ? 'text-white' : '']" />
            {{ controlStore.sendingStates.frequency.loading ? '전송 중...' : controlStore.sendingStates.frequency.success ? '전송 완료' : '주파수 전송' }}
          </Button>
          <p v-if="!serialStore.isConnected" class="text-[10px] text-center text-muted-foreground italic">
            장치 연결 필요 (오프라인)
          </p>
          <p v-else-if="serialStore.selectedDevice === serialStore.VIRTUAL_DEVICE" class="text-[10px] text-center text-primary font-medium animate-pulse">
            VIRTUAL SIMULATION ACTIVE
          </p>
        </div>
      </CardContent>
    </Card>

    <!-- 레지스터 제어 -->
    <Card class="relative overflow-hidden border-primary/20 bg-background/50 backdrop-blur-md">
      <div class="absolute top-0 right-0 p-2 opacity-5">
        <CpuIcon class="h-16 w-16" />
      </div>
      <CardHeader class="pb-2">
        <CardTitle class="flex items-center gap-2 text-sm font-semibold">
          <CpuIcon class="h-4 w-4 text-purple-500" />
          레지스터 제어
        </CardTitle>
        <CardDescription class="text-xs">IC 레지스터 값 설정</CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-xs font-medium text-muted-foreground">HEX 값</span>
            <Badge variant="secondary" class="font-mono">0x{{ controlStore.registerValue.toString(16).toUpperCase().padStart(8, '0') }}</Badge>
          </div>
          <div class="flex gap-2">
            <input
              v-model.number="controlStore.registerValue"
              type="number"
              min="0"
              max="4294967295"
              class="flex-1 rounded-md border border-input bg-background/50 px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <Button 
            size="sm" 
            variant="outline" 
            :class="[
              'w-full h-8 text-xs gap-2 transition-all duration-300',
              controlStore.sendingStates.register.success ? 'bg-green-600 text-white hover:bg-green-700 dark:bg-green-700' : ''
            ]"
            :disabled="!serialStore.isConnected || controlStore.sendingStates.register.loading"
            @click="controlStore.setRegisterValue(controlStore.registerValue)"
          >
            <LoaderIcon v-if="controlStore.sendingStates.register.loading" class="h-3 w-3 animate-spin" />
            <CheckIcon v-else :class="['h-3 w-3', controlStore.sendingStates.register.success ? 'text-white' : '']" />
            {{ controlStore.sendingStates.register.loading ? '쓰는 중...' : controlStore.sendingStates.register.success ? '기록 완료' : '레지스터 쓰기' }}
          </Button>
          <p v-if="!serialStore.isConnected" class="text-[10px] text-center text-muted-foreground italic">
            장치 연결 필요 (오프라인)
          </p>
          <p v-else-if="serialStore.selectedDevice === serialStore.VIRTUAL_DEVICE" class="text-[10px] text-center text-primary font-medium animate-pulse">
            VIRTUAL SIMULATION ACTIVE
          </p>
        </div>
      </CardContent>
    </Card>

    <!-- 상태 표시 -->
    <Card class="relative overflow-hidden border-primary/20 bg-background/50 backdrop-blur-md">
      <div class="absolute top-0 right-0 p-2 opacity-5">
        <ActivityIcon class="h-16 w-16" />
      </div>
      <CardHeader class="pb-2">
        <CardTitle class="flex items-center gap-2 text-sm font-semibold">
          <ActivityIcon :class="['h-4 w-4', serialStore.isConnected ? 'text-green-500 animate-pulse' : 'text-destructive']" />
          시스템 상태
        </CardTitle>
        <CardDescription class="text-xs">시리얼 통신 제어</CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="space-y-3">
          <div class="flex items-center justify-between text-xs">
            <span class="text-muted-foreground">연결</span>
            <Badge :variant="serialStore.isConnected ? 'outline' : 'destructive'" class="h-5 px-1.5 text-[10px]">
              {{ serialStore.isConnected ? "CONNECTED" : "OFFLINE" }}
            </Badge>
          </div>
          <Separator class="bg-primary/10" />
          <div class="flex items-center justify-between">
            <span class="text-xs font-medium">TX 활성화</span>
            <Switch
              v-model="serialStore.txEnabled"
              :disabled="!serialStore.isConnected"
              class="scale-75 origin-right"
            />
          </div>
          <div class="flex items-center justify-between">
            <span class="text-xs font-medium">RX 활성화</span>
            <Switch
              v-model="serialStore.rxEnabled"
              :disabled="!serialStore.isConnected"
              class="scale-75 origin-right"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>

