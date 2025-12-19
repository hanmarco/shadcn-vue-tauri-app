<script setup>
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useControlStore } from "@/stores/control";
import { useSerialStore } from "@/stores/serial";
import { ActivityIcon, ZapIcon, GaugeIcon } from "lucide-vue-next";

const controlStore = useControlStore();
const serialStore = useSerialStore();
</script>

<template>
  <div class="grid gap-4 p-6 md:grid-cols-2 lg:grid-cols-3">
    <!-- 전압 제어 -->
    <Card>
      <CardHeader>
        <CardTitle class="flex items-center gap-2">
          <ZapIcon class="h-5 w-5" />
          전압 제어
        </CardTitle>
        <CardDescription>IC 전압 설정 (0V ~ 5V)</CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-sm text-muted-foreground">전압</span>
            <Badge variant="secondary">{{ controlStore.voltage.toFixed(2) }}V</Badge>
          </div>
          <Slider
            v-model="controlStore.voltage"
            :min="0"
            :max="5"
            :step="0.1"
            :disabled="!serialStore.isConnected"
            @update:model-value="controlStore.setVoltage"
          />
        </div>
      </CardContent>
    </Card>

    <!-- 주파수 제어 -->
    <Card>
      <CardHeader>
        <CardTitle class="flex items-center gap-2">
          <GaugeIcon class="h-5 w-5" />
          주파수 제어
        </CardTitle>
        <CardDescription>IC 클럭 주파수 설정</CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-sm text-muted-foreground">주파수</span>
            <Badge variant="secondary">{{ (controlStore.frequency / 1000).toFixed(0) }}kHz</Badge>
          </div>
          <Slider
            v-model="controlStore.frequency"
            :min="1000"
            :max="10000000"
            :step="1000"
            :disabled="!serialStore.isConnected"
            @update:model-value="controlStore.setFrequency"
          />
        </div>
      </CardContent>
    </Card>

    <!-- 상태 표시 -->
    <Card>
      <CardHeader>
        <CardTitle class="flex items-center gap-2">
          <ActivityIcon class="h-5 w-5" />
          연결 상태
        </CardTitle>
        <CardDescription>시리얼 통신 상태</CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-sm">연결 상태</span>
            <Badge :variant="serialStore.isConnected ? 'success' : 'destructive'">
              {{ serialStore.isConnected ? "연결됨" : "연결 안 됨" }}
            </Badge>
          </div>
          <Separator />
          <div class="flex items-center justify-between">
            <span class="text-sm">TX 활성화</span>
            <Switch
              v-model="serialStore.txEnabled"
              :disabled="!serialStore.isConnected"
            />
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm">RX 활성화</span>
            <Switch
              v-model="serialStore.rxEnabled"
              :disabled="!serialStore.isConnected"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>

