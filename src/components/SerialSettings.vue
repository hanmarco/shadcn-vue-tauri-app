<script setup>
import { onMounted, computed, ref } from "vue";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Select, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
const isRefreshing = ref(false);

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
const flowControlOptions = [
  { value: "none", label: "None" },
  { value: "hardware", label: "Hardware (RTS/CTS)" },
  { value: "software", label: "Software (XON/XOFF)" },
];
const lineEndingOptions = [
  { value: "LF", label: "LF (\\n)" },
  { value: "CRLF", label: "CRLF (\\r\\n)" },
  { value: "CR", label: "CR (\\r)" },
  { value: "NONE", label: "None" },
];
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

const protocolModes = [
  { value: "rffe", label: "RFFE (mode 1)" },
  { value: "spi", label: "SPI (mode 2)" },
  { value: "i3c", label: "I3C (mode 3)" },
];

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
  isRefreshing.value = true;
  try {
    await Promise.all([
      serialStore.scanDevices(),
      new Promise((resolve) => setTimeout(resolve, 300)),
    ]);
  } finally {
    isRefreshing.value = false;
  }
}
</script>

<template>
  <div class="m-6 pb-12 grid gap-6 grid-cols-[400px_1fr] items-start">
    <!-- 통신 모드 선택 (공통) -->
    <Card :class="['border-primary/20 transition-colors h-fit', serialStore.isConnected ? 'bg-muted/50 opacity-70' : 'bg-primary/2']">
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

    <div class="space-y-6 col-start-2">
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
            {{ isRefreshing ? "검색중..." : "검색된 장치가 없습니다." }}
            <Button variant="link" @click="handleRefresh" class="mt-2 text-primary" :disabled="isRefreshing">
              <LoaderIcon v-if="isRefreshing" class="mr-2 h-4 w-4 animate-spin" />
              <RefreshCwIcon v-else class="mr-2 h-4 w-4" />
              {{ isRefreshing ? "검색중..." : "다시 검색" }}
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
              :disabled="serialStore.isConnecting || isRefreshing"
            >
              <LoaderIcon v-if="isRefreshing" class="mr-2 h-4 w-4 animate-spin" />
              <RefreshCwIcon v-else class="mr-2 h-4 w-4" />
              {{ isRefreshing ? "검색중..." : "목록 새로고침" }}
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

          <div class="space-y-2">
            <label class="text-sm font-medium">Flow Control</label>
            <Select
              v-model="serialStore.flowControl"
              :disabled="serialStore.isConnected"
              placeholder="Flow Control 선택"
            >
              <SelectItem
                v-for="opt in flowControlOptions"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </SelectItem>
            </Select>
          </div>

          <div class="space-y-2">
            <label class="text-sm font-medium">Line Ending</label>
            <Select
              v-model="serialStore.lineEnding"
              :disabled="serialStore.isConnected"
              placeholder="Line Ending 선택"
            >
              <SelectItem
                v-for="opt in lineEndingOptions"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </SelectItem>
            </Select>
          </div>
        </CardContent>
      </Card>

      <!-- SC4415 프로토콜 설정 -->
      <Card :class="['transition-colors', serialStore.isConnected ? 'bg-muted/50 opacity-80' : '']">
        <CardHeader>
          <CardTitle>SC4415 통신 설정</CardTitle>
          <CardDescription>모드/VIO/클럭 및 프로토콜별 파라미터 설정</CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <div class="grid gap-4 md:grid-cols-2">
            <div class="space-y-2">
              <label class="text-sm font-medium">Mode</label>
              <Select v-model="serialStore.protocolMode">
                <SelectItem v-for="mode in protocolModes" :key="mode.value" :value="mode.value">
                  {{ mode.label }}
                </SelectItem>
              </Select>
            </div>

            <div class="space-y-2">
              <label class="text-sm font-medium">VIO</label>
              <Select v-model="serialStore.vioSetting">
                <SelectItem v-for="opt in vioOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </SelectItem>
              </Select>
            </div>
          </div>

          <Separator />

          <!-- RFFE Settings -->
          <div v-if="serialStore.protocolMode === 'rffe'" class="grid gap-4 md:grid-cols-2">
            <div class="space-y-2">
              <label class="text-sm font-medium">Clock (kHz)</label>
              <input
                v-model.number="serialStore.rffeClockKHz"
                type="number"
                min="100"
                max="60000"
                class="w-full rounded-md border border-input bg-background/50 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div class="space-y-2">
              <label class="text-sm font-medium">HSDR</label>
              <div class="flex items-center gap-3">
                <Switch v-model="serialStore.rffeHsdr" />
                <span class="text-xs text-muted-foreground">{{ serialStore.rffeHsdr ? "Enable" : "Disable" }}</span>
              </div>
            </div>
            <div class="space-y-2">
              <label class="text-sm font-medium">Slave Address (SA)</label>
              <input
                v-model.number="serialStore.rffeSlaveAddress"
                type="number"
                min="0"
                max="15"
                class="w-full rounded-md border border-input bg-background/50 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div class="space-y-2">
              <label class="text-sm font-medium">Register Address</label>
              <input
                v-model.number="serialStore.rffeRegisterAddress"
                type="number"
                min="0"
                max="31"
                class="w-full rounded-md border border-input bg-background/50 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <!-- SPI Settings -->
          <div v-else-if="serialStore.protocolMode === 'spi'" class="space-y-4">
            <div class="grid gap-4 md:grid-cols-2">
              <div class="space-y-2">
                <label class="text-sm font-medium">Clock (kHz)</label>
                <input
                  v-model.number="serialStore.spiClockKHz"
                  type="number"
                  min="50"
                  max="26000"
                  class="w-full rounded-md border border-input bg-background/50 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div class="space-y-2">
                <label class="text-sm font-medium">SPI Mode</label>
                <Select v-model="serialStore.spiMode">
                  <SelectItem v-for="mode in [0,1,2,3]" :key="mode" :value="mode">
                    Mode {{ mode }}
                  </SelectItem>
                </Select>
              </div>
            </div>
            <div class="grid gap-4 md:grid-cols-4">
              <div class="space-y-2">
                <label class="text-sm font-medium">Select</label>
                <Select v-model="serialStore.spiSelect">
                  <SelectItem v-for="sel in [1,2]" :key="sel" :value="sel">
                    {{ sel }}
                  </SelectItem>
                </Select>
              </div>
              <div class="space-y-2">
                <label class="text-sm font-medium">Select Polarity</label>
                <Select v-model="serialStore.spiSelPol">
                  <SelectItem v-for="pol in [0,1]" :key="pol" :value="pol">
                    {{ pol }}
                  </SelectItem>
                </Select>
              </div>
              <div class="space-y-2">
                <label class="text-sm font-medium">CMD Width (bits)</label>
                <input
                  v-model.number="serialStore.spiCmdWidth"
                  type="number"
                  min="0"
                  max="16"
                  class="w-full rounded-md border border-input bg-background/50 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div class="space-y-2">
                <label class="text-sm font-medium">ADDR Width (bits)</label>
                <input
                  v-model.number="serialStore.spiAddrWidth"
                  type="number"
                  min="0"
                  max="16"
                  class="w-full rounded-md border border-input bg-background/50 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
            <div class="grid gap-4 md:grid-cols-3">
              <div class="space-y-2">
                <label class="text-sm font-medium">Write Width</label>
                <Select v-model="serialStore.spiWriteWidth">
                  <SelectItem v-for="width in [0,1,2,3]" :key="width" :value="width">
                    {{ width === 0 ? "None" : width === 1 ? "1 byte" : width === 2 ? "2 bytes" : "4 bytes" }}
                  </SelectItem>
                </Select>
              </div>
              <div class="space-y-2">
                <label class="text-sm font-medium">Read Width</label>
                <Select v-model="serialStore.spiReadWidth">
                  <SelectItem v-for="width in [0,1,2,3]" :key="width" :value="width">
                    {{ width === 0 ? "None" : width === 1 ? "1 byte" : width === 2 ? "2 bytes" : "4 bytes" }}
                  </SelectItem>
                </Select>
              </div>
              <div class="space-y-2">
                <label class="text-sm font-medium">Wait Cycles</label>
                <input
                  v-model.number="serialStore.spiWaitCycles"
                  type="number"
                  min="0"
                  max="255"
                  class="w-full rounded-md border border-input bg-background/50 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          </div>

          <!-- I3C Settings -->
          <div v-else class="space-y-4">
            <div class="grid gap-4 md:grid-cols-2">
              <div class="space-y-2">
                <label class="text-sm font-medium">I3C Rate Index</label>
                <input
                  v-model.number="serialStore.i3cRateIndex"
                  type="number"
                  min="0"
                  class="w-full rounded-md border border-input bg-background/50 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div class="space-y-2">
                <label class="text-sm font-medium">I2C Rate Index</label>
                <input
                  v-model.number="serialStore.i2cRateIndex"
                  type="number"
                  min="0"
                  class="w-full rounded-md border border-input bg-background/50 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
            <div class="grid gap-4 md:grid-cols-2">
              <div class="space-y-2">
                <label class="text-sm font-medium">Pull-up (Ω)</label>
                <input
                  v-model.number="serialStore.i3cPullup"
                  type="number"
                  min="0"
                  max="4500"
                  class="w-full rounded-md border border-input bg-background/50 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div class="space-y-2">
                <label class="text-sm font-medium">Error Message</label>
                <div class="flex items-center gap-3">
                  <Switch v-model="serialStore.i3cErrMsg" />
                  <span class="text-xs text-muted-foreground">{{ serialStore.i3cErrMsg ? "Enable" : "Disable" }}</span>
                </div>
              </div>
            </div>
            <div class="grid gap-4 md:grid-cols-3">
              <div class="space-y-2">
                <label class="text-sm font-medium">SDR Index</label>
                <input
                  v-model.number="serialStore.i3cIndex"
                  type="number"
                  min="0"
                  class="w-full rounded-md border border-input bg-background/50 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div class="space-y-2">
                <label class="text-sm font-medium">CMB</label>
                <Select v-model="serialStore.i3cCmb">
                  <SelectItem v-for="cmb in [0,1]" :key="cmb" :value="cmb">
                    {{ cmb }}
                  </SelectItem>
                </Select>
              </div>
              <div class="space-y-2">
                <label class="text-sm font-medium">Byte Count</label>
                <input
                  v-model.number="serialStore.i3cByteCount"
                  type="number"
                  min="1"
                  max="4"
                  class="w-full rounded-md border border-input bg-background/50 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
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
  </div>
</template>
