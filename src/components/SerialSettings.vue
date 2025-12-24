<script setup>
import { onMounted } from "vue";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Select, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useSerialStore } from "@/stores/serial";
import { 
  UsbIcon, 
  RefreshCwIcon, 
  PowerIcon, 
  AlertCircleIcon, 
  LoaderIcon,
  CpuIcon,
  ZapIcon
} from "lucide-vue-next";

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
const deviceTypes = [
  { value: "serialport", label: "Standard Serial Port", description: "Default RS232/UART Communication" },
  { value: "ft2232d", label: "FTDI FT2232D", description: "Dual USB to UART/FIFO IC" },
  { value: "ft2232h", label: "FTDI FT2232H", description: "Hi-Speed Dual USB to UART/FIFO" },
  { value: "ft260", label: "HID-class USB to I2C/UART", description: "FTDI FT260 Bridge" },
];

const ftdiChannels = ["A", "B"];
const ftdiModes = ["UART", "Bitbang", "MPSSE", "I2C", "SPI"];
const ft260Modes = ["I2C", "UART"];
const ft260I2cSpeeds = [100, 400, 1000, 3400];

async function handleConnect() {
  if (serialStore.isConnected) {
    await serialStore.disconnect();
  } else {
    const target = serialStore.selectedDevice || serialStore.lastConnectedDevice || 
      (serialStore.deviceType !== 'serialport' ? 'Selected IC' : null);
  
    if (target) {
      await serialStore.connect(target);
    }
  }
}

const handleRefresh = async () => {
  await serialStore.scanDevices();
}
</script>

<template>
  <div class="space-y-6 m-6 pb-12">
    <!-- 통신 모드 선택 (공통) -->
    <Card :class="['border-primary/20 transition-colors', serialStore.isConnected ? 'bg-muted/50 opacity-70' : 'bg-primary/2']">
      <CardHeader class="pb-3">
        <div class="flex items-center justify-between">
          <div class="space-y-1">
            <CardTitle class="flex items-center gap-2 text-primary">
              <ZapIcon class="h-5 w-5" />
              통신 인터페이스 모드
            </CardTitle>
            <CardDescription>사용할 하드웨어 인터페이스 타입을 선택하세요</CardDescription>
          </div>
          <Badge variant="outline" class="bg-primary/10 text-primary border-primary/20 uppercase tracking-widest text-[10px] font-bold">
            {{ serialStore.deviceType }} mode
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div class="grid gap-4">
          <Select
            v-model="serialStore.deviceType"
            :disabled="serialStore.isConnected"
            placeholder="인터페이스 모드 선택"
          >
            <SelectItem
              v-for="type in deviceTypes"
              :key="type.value"
              :value="type.value"
            >
              <div class="flex flex-col py-0.5">
                <span class="font-bold">{{ type.label }}</span>
                <span class="text-[10px] text-muted-foreground">{{ type.description }}</span>
              </div>
            </SelectItem>
          </Select>
        </div>
      </CardContent>
    </Card>

    <!-- [1] Standard Serial Port 전용 화면 -->
    <template v-if="serialStore.deviceType === 'serialport'">
      <!-- 장치 선택 섹션 -->
      <Card :class="['transition-colors', serialStore.isConnected ? 'bg-muted/50 opacity-80' : '']">
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
            <Button variant="link" @click="handleRefresh" class="mt-2 text-primary">
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

      <!-- 시리얼 통신 설정 섹션 -->
      <Card :class="['transition-colors', serialStore.isConnected ? 'bg-muted/50 opacity-80' : '']">
        <CardHeader>
          <CardTitle>시리얼 통신 설정</CardTitle>
          <CardDescription>Baud Rate, Parity, Stop Bit 등 세부 통신 파라미터 설정</CardDescription>
        </CardHeader>
        <CardContent class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
        </CardContent>
      </Card>
    </template>

    <!-- [2] FTDI FT2232D/H 전용 설정 화면 -->
    <template v-else-if="serialStore.deviceType.startsWith('ft2232')">
      <Card :class="['transition-colors', serialStore.isConnected ? 'bg-muted/50 opacity-80' : '']">
        <CardHeader>
          <CardTitle class="flex items-center gap-2">
            <CpuIcon class="h-5 w-5 text-primary" />
            FTDI Chip Configuration
          </CardTitle>
          <CardDescription>FTDI 장치 채널 및 하드웨어 모드 설정</CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <div class="grid gap-6 md:grid-cols-2">
            <!-- Channel Selection -->
            <div class="space-y-2">
              <label class="text-sm font-medium flex items-center gap-2">
                Channel Select
                <Badge variant="secondary" class="text-[9px]">A/B</Badge>
              </label>
              <div class="flex gap-2">
                <Button 
                  v-for="ch in ftdiChannels" 
                  :key="ch"
                  :variant="serialStore.ftdiChannel === ch ? 'default' : 'outline'"
                  class="flex-1"
                  @click="serialStore.ftdiChannel = ch"
                >
                  Channel {{ ch }}
                </Button>
              </div>
            </div>

            <!-- Operating Mode -->
            <div class="space-y-2">
              <label class="text-sm font-medium">Operating Mode</label>
              <Select v-model="serialStore.ftdiMode">
                <SelectItem v-for="mode in ftdiModes" :key="mode" :value="mode">
                  {{ mode }} Mode
                </SelectItem>
              </Select>
            </div>
          </div>

          <Separator v-if="serialStore.ftdiMode === 'UART'" />

          <!-- Baud rate for UART mode in FTDI -->
          <div v-if="serialStore.ftdiMode === 'UART'" class="space-y-2 max-w-xs">
            <label class="text-sm font-medium">Baud Rate (UART)</label>
            <Select v-model="serialStore.baudRate">
              <SelectItem v-for="rate in baudRates" :key="rate" :value="rate">
                {{ rate }}
              </SelectItem>
            </Select>
          </div>

          <div class="pt-2">
            <Button @click="handleConnect" class="min-w-[140px]" :variant="serialStore.isConnected ? 'destructive' : 'default'">
              <PowerIcon class="mr-2 h-4 w-4" />
              {{ serialStore.isConnected ? 'Close Connection' : 'Open FTDI Device' }}
            </Button>
          </div>
        </CardContent>
      </Card>
    </template>

    <!-- [3] FT260 전용 설정 화면 -->
    <template v-else-if="serialStore.deviceType === 'ft260'">
      <Card :class="['transition-colors', serialStore.isConnected ? 'bg-muted/50 opacity-80' : '']">
        <CardHeader>
          <CardTitle class="flex items-center gap-2">
            <CpuIcon class="h-5 w-5 text-primary" />
            FT260 Configuration
          </CardTitle>
          <CardDescription>FT260 HID to I2C/UART Bridge 설정</CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <div class="grid gap-6 md:grid-cols-2">
            <!-- Mode Selection -->
            <div class="space-y-2">
              <label class="text-sm font-medium">Interface Mode</label>
              <div class="flex gap-2">
                <Button 
                  v-for="mode in ft260Modes" 
                  :key="mode"
                  :variant="serialStore.ft260Mode === mode ? 'default' : 'outline'"
                  class="flex-1"
                  @click="serialStore.ft260Mode = mode"
                >
                  {{ mode }}
                </Button>
              </div>
            </div>

            <!-- I2C Speed (Visible only in I2C mode) -->
            <div v-if="serialStore.ft260Mode === 'I2C'" class="space-y-2">
              <label class="text-sm font-medium">I2C Clock Speed</label>
              <Select v-model="serialStore.ft260I2cSpeed">
                <SelectItem v-for="speed in ft260I2cSpeeds" :key="speed" :value="speed">
                  {{ speed }} kHz
                </SelectItem>
              </Select>
            </div>

            <!-- UART Baud Rate (Visible only in UART mode) -->
            <div v-if="serialStore.ft260Mode === 'UART'" class="space-y-2">
              <label class="text-sm font-medium">UART Baud Rate</label>
              <Select v-model="serialStore.baudRate">
                <SelectItem v-for="rate in baudRates" :key="rate" :value="rate">
                  {{ rate }}
                </SelectItem>
              </Select>
            </div>
          </div>
          <div class="pt-2">
            <Button @click="handleConnect" class="min-w-[140px]" :variant="serialStore.isConnected ? 'destructive' : 'default'">
              <PowerIcon class="mr-2 h-4 w-4" />
              {{ serialStore.isConnected ? 'Close Connection' : 'Open FT260' }}
            </Button>
          </div>
        </CardContent>
      </Card>
    </template>

    <!-- 공통 에러 메시지 표시 -->
    <div v-if="serialStore.connectionError" class="rounded-md bg-destructive/10 border border-destructive/20 p-3 mx-2">
      <div class="flex items-center gap-2 text-destructive">
        <AlertCircleIcon class="h-4 w-4" />
        <span class="text-sm font-medium">연결 실패</span>
      </div>
      <p class="mt-1 text-sm text-destructive/80">{{ serialStore.connectionError }}</p>
    </div>
  </div>
</template>
