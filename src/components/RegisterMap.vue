<script setup>
import { ref, computed } from "vue";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useRegisterStore } from "@/stores/registers";
import { useSerialStore } from "@/stores/serial";
import { SearchIcon, SaveIcon, RefreshCwIcon, CpuIcon, BinaryIcon, InfoIcon } from "lucide-vue-next";

const registerStore = useRegisterStore();
const serialStore = useSerialStore();

const searchQuery = ref("");

const filteredRegisters = computed(() => {
  if (!searchQuery.value) return registerStore.registers;
  const q = searchQuery.value.toLowerCase();
  return registerStore.registers.filter(r => 
    r.name.toLowerCase().includes(q) || 
    r.address.toString(16).toLowerCase().includes(q)
  );
});

function selectRegister(address) {
  registerStore.selectedRegisterAddress = address;
}

function toggleBit(field, currentValue) {
  const newValue = currentValue === 0 ? 1 : 0;
  registerStore.updateBitfield(registerStore.selectedRegisterAddress, field, newValue);
}

function getFieldValue(regValue, field) {
  const mask = ((1 << field.size) - 1);
  return (regValue >> field.bit) & mask;
}
</script>

<template>
  <div class="flex h-full flex-col gap-4 p-6 overflow-hidden">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-bold tracking-tight">Register Map</h2>
        <p class="text-muted-foreground">IC 레지스터 직접 제어 및 비트필드 편집</p>
      </div>
      <div v-if="!serialStore.isConnected" class="flex items-center gap-2 text-destructive text-sm font-medium animate-pulse">
        <InfoIcon class="h-4 w-4" />
        장치 연결이 필요합니다 (현재 시뮬레이션 모드)
      </div>
    </div>

    <div class="grid flex-1 grid-cols-12 gap-4 overflow-hidden">
      <!-- Register List (Left) -->
      <Card class="col-span-12 flex flex-col overflow-hidden lg:col-span-5 xl:col-span-4 bg-background/50 backdrop-blur-sm border-primary/10">
        <CardHeader class="p-4 pb-2">
          <div class="relative">
            <SearchIcon class="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search registers (Name/Addr)..."
              class="w-full rounded-md border border-input bg-background pl-9 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </CardHeader>
        <CardContent class="p-0 flex-1 overflow-hidden">
          <ScrollArea class="h-full">
            <div class="p-4 pt-0">
              <Table>
                <TableHeader class="sticky top-0 bg-background/90 backdrop-blur-sm z-10 shadow-sm">
                  <TableRow>
                    <TableHead class="w-[80px]">Addr</TableHead>
                    <TableHead>Register</TableHead>
                    <TableHead class="text-right">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow
                    v-for="reg in filteredRegisters"
                    :key="reg.address"
                    class="cursor-pointer transition-colors"
                    :class="{ 'bg-primary/10 border-l-2 border-l-primary': registerStore.selectedRegisterAddress === reg.address }"
                    @click="selectRegister(reg.address)"
                  >
                    <TableCell class="font-mono text-xs">0x{{ reg.address.toString(16).toUpperCase().padStart(2, '0') }}</TableCell>
                    <TableCell>
                      <div class="font-medium text-sm">{{ reg.name }}</div>
                    </TableCell>
                    <TableCell class="text-right font-mono text-sm tabular-nums">
                      0x{{ reg.value.toString(16).toUpperCase().padStart(2, '0') }}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <!-- Register Detail / Bitfield Editor (Right) -->
      <Card class="col-span-12 flex flex-col overflow-hidden lg:col-span-7 xl:col-span-8 bg-background/50 backdrop-blur-sm border-primary/10">
        <template v-if="registerStore.selectedRegister">
          <CardHeader class="p-4 border-b">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="p-2 rounded-lg bg-primary/10">
                  <CpuIcon class="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle class="text-lg">0x{{ registerStore.selectedRegister.address.toString(16).toUpperCase().padStart(2, '0') }}: {{ registerStore.selectedRegister.name }}</CardTitle>
                  <CardDescription class="text-xs">{{ registerStore.selectedRegister.description }}</CardDescription>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  class="h-8 gap-2"
                  :disabled="!serialStore.isConnected"
                  @click="registerStore.readRegister(registerStore.selectedRegister.address)"
                >
                  <RefreshCwIcon class="h-3 w-3" />
                  Read
                </Button>
                <Button 
                  size="sm" 
                  variant="default" 
                  class="h-8 gap-2"
                  v-if="!registerStore.selectedRegister.readOnly"
                  :disabled="!serialStore.isConnected"
                  @click="registerStore.writeRegister(registerStore.selectedRegister.address, registerStore.selectedRegister.value)"
                >
                  <SaveIcon class="h-3 w-3" />
                  Write
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent class="p-0 flex-1 overflow-hidden">
            <ScrollArea class="h-full">
              <div class="p-6 space-y-6">
                <!-- Large Hex Viewer -->
                <div class="flex flex-col items-center justify-center py-8 rounded-xl bg-muted/30 border border-dashed">
                  <div class="text-[10px] uppercase font-bold tracking-widest text-muted-foreground mb-1">Current Value</div>
                  <div class="text-5xl font-mono font-bold tracking-tighter text-primary">
                    0x{{ registerStore.selectedRegister.value.toString(16).toUpperCase().padStart(2, '0') }}
                  </div>
                  <div class="text-xs font-mono text-muted-foreground mt-2 opacity-50">
                    BINARY: {{ registerStore.selectedRegister.value.toString(2).padStart(8, '0') }}
                  </div>
                </div>

                <!-- Bitfield List -->
                <div class="space-y-4">
                  <div class="flex items-center gap-2">
                    <BinaryIcon class="h-4 w-4 text-primary" />
                    <h4 class="text-sm font-semibold">Bitfield Specification</h4>
                  </div>
                  
                  <div v-if="registerStore.selectedRegister.fields.length === 0" class="flex flex-col items-center justify-center p-8 text-center border rounded-lg opacity-40 italic">
                    <p class="text-sm">No bitfields defined for this register.</p>
                  </div>

                  <div v-else class="grid gap-3">
                    <div 
                      v-for="field in registerStore.selectedRegister.fields" 
                      :key="field.name"
                      class="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors group"
                    >
                      <div class="flex flex-col">
                        <div class="flex items-center gap-2">
                          <span class="text-sm font-bold">{{ field.name }}</span>
                          <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-muted font-mono">
                            BIT {{ field.size > 1 ? `${field.bit + field.size - 1}:${field.bit}` : field.bit }}
                          </span>
                        </div>
                        <span class="text-xs text-muted-foreground">{{ field.description }}</span>
                      </div>

                      <div class="flex items-center gap-4">
                        <template v-if="field.size === 1">
                          <Switch 
                            :checked="getFieldValue(registerStore.selectedRegister.value, field) === 1"
                            :disabled="registerStore.selectedRegister.readOnly"
                            @update:checked="toggleBit(field, getFieldValue(registerStore.selectedRegister.value, field))"
                          />
                        </template>
                        <template v-else>
                          <input
                            type="number"
                            :min="0"
                            :max="(1 << field.size) - 1"
                            :value="getFieldValue(registerStore.selectedRegister.value, field)"
                            :disabled="registerStore.selectedRegister.readOnly"
                            class="w-16 rounded border bg-background px-2 py-1 text-right text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                            @input="(e) => registerStore.updateBitfield(registerStore.selectedRegister.address, field, parseInt(e.target.value))"
                          />
                        </template>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </CardContent>
        </template>
        <div v-else class="flex flex-col items-center justify-center h-full text-muted-foreground opacity-30 p-12 text-center">
          <CpuIcon class="h-16 w-16 mb-4" />
          <p class="text-lg font-medium">Select a register to edit</p>
          <p class="text-sm">왼쪽 리스트에서 레지스터를 선택하여 세부 비트 설정을 시작하세요.</p>
        </div>
      </Card>
    </div>
  </div>
</template>
