<script setup>
import { onMounted } from "vue";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { useControlStore } from "@/stores/control";
import { useSerialStore } from "@/stores/serial";
import { ActivityIcon, ZapIcon, GaugeIcon, CpuIcon, CheckIcon, LoaderIcon } from "lucide-vue-next";

const controlStore = useControlStore();
const serialStore = useSerialStore();

onMounted(async () => {
  await controlStore.loadControlSettings();
});
</script>

<template>
  <div class="grid gap-4 p-6 md:grid-cols-2 lg:grid-cols-4">
    <!-- 전압 제어 -->
    <Card class="relative overflow-hidden border-primary/20 bg-background/50 backdrop-blur-md">
      <div class="absolute top-0 right-0 p-2 opacity-5">
        <ZapIcon class="h-16 w-16" />
      </div>
      <CardHeader class="pb-2">
        <CardTitle class="flex items-center gap-2 text-sm font-semibold">
          <ZapIcon class="h-4 w-4 text-yellow-500" />
          전압 제어
        </CardTitle>
        <CardDescription class="text-xs">IC 전압 설정 (0V ~ 5V)</CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-xs font-medium text-muted-foreground">설정값</span>
            <div class="flex items-center gap-2">
              <input
                v-model.number="controlStore.voltage"
                type="number"
                step="0.1"
                min="0"
                max="5"
                class="w-20 rounded-md border border-input bg-background/50 px-2 py-1 text-right text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <Badge variant="secondary" class="font-mono">{{ controlStore.voltage.toFixed(2) }}V</Badge>
            </div>
          </div>
          <Slider
            :model-value="controlStore.voltage"
            :min="0"
            :max="5"
            :step="0.1"
            class="py-2"
            @update:model-value="(val) => controlStore.voltage = val"
          />
          <Button 
            size="sm" 
            variant="outline"
            :class="[
              'w-full h-8 text-xs gap-2 transition-all duration-300',
              controlStore.sendingStates.voltage.success ? 'bg-green-600 text-white hover:bg-green-700 dark:bg-green-700' : ''
            ]"
            :disabled="!serialStore.isConnected || controlStore.sendingStates.voltage.loading"
            @click="controlStore.setVoltage(controlStore.voltage)"
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

    <!-- 주파수 제어 -->
    <Card class="relative overflow-hidden border-primary/20 bg-background/50 backdrop-blur-md">
      <div class="absolute top-0 right-0 p-2 opacity-5">
        <GaugeIcon class="h-16 w-16" />
      </div>
      <CardHeader class="pb-2">
        <CardTitle class="flex items-center gap-2 text-sm font-semibold">
          <GaugeIcon class="h-4 w-4 text-blue-500" />
          주파수 제어
        </CardTitle>
        <CardDescription class="text-xs">IC 클럭 주파수 설정</CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-xs font-medium text-muted-foreground">설정값</span>
            <div class="flex items-center gap-2">
              <input
                v-model.number="controlStore.frequency"
                type="number"
                step="1000"
                min="1000"
                max="10000000"
                class="w-24 rounded-md border border-input bg-background/50 px-2 py-1 text-right text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <Badge variant="secondary" class="font-mono">{{ (controlStore.frequency / 1000).toFixed(0) }}kHz</Badge>
            </div>
          </div>
          <Slider
            :model-value="controlStore.frequency"
            :min="1000"
            :max="10000000"
            :step="1000"
            class="py-2"
            @update:model-value="(val) => controlStore.frequency = val"
          />
          <Button 
            size="sm" 
            variant="outline" 
            :class="[
              'w-full h-8 text-xs gap-2 transition-all duration-300',
              controlStore.sendingStates.frequency.success ? 'bg-green-600 text-white hover:bg-green-700 dark:bg-green-700' : ''
            ]"
            :disabled="!serialStore.isConnected || controlStore.sendingStates.frequency.loading"
            @click="controlStore.setFrequency(controlStore.frequency)"
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

