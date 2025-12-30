import { defineStore } from "pinia";
import { ref, watch } from "vue";
import { useSerialStore } from "./serial";
import { LazyStore } from "@tauri-apps/plugin-store";

const store = new LazyStore("control_settings.json");

export const useControlStore = defineStore("control", () => {
  const serialStore = useSerialStore();

  // IC 제어 파라미터
  const registerValue = ref(0);

  // Persistence logic
  const CONTROL_KEY = "ic-controls";
  const isLoading = ref(false);

  async function loadControlSettings() {
    isLoading.value = true;
    try {
      const saved = await store.get(CONTROL_KEY);
      if (saved) {
        registerValue.value = saved.registerValue ?? 0;
      }
    } catch (error) {
      console.error("Failed to load control settings:", error);
    } finally {
      isLoading.value = false;
    }
  }

  async function saveControlSettings() {
    if (isLoading.value) return;
    try {
      await store.set(CONTROL_KEY, {
        registerValue: registerValue.value,
      });
      await store.save();
    } catch (error) {
      console.error("Failed to save control settings:", error);
    }
  }

  // Watch for changes and save
  watch([registerValue], () => {
    saveControlSettings();
  });

  // 전송 상태 관리 (UI 피드백용)
  const sendingStates = ref({
    voltage: { loading: false, success: false },
    frequency: { loading: false, success: false },
    register: { loading: false, success: false },
  });

  function formatHex(value, width) {
    return `0x${value.toString(16).toUpperCase().padStart(width, "0")}`;
  }

  function splitValueToBytes(value, count) {
    const bytes = [];
    for (let i = count - 1; i >= 0; i -= 1) {
      const byte = (value >> (i * 8)) & 0xff;
      bytes.push(formatHex(byte, 2));
    }
    return bytes;
  }

  async function sendCommandSequence(commands) {
    for (const cmd of commands) {
      if (!cmd) continue;
      const ok = await serialStore.sendData(cmd);
      if (!ok) return false;
    }
    return true;
  }

  async function setVoltage() {
    sendingStates.value.voltage.loading = true;
    sendingStates.value.voltage.success = false;

    const cmd = `vio ${serialStore.vioSetting}`;
    const success = await sendCommandSequence([cmd]);

    // UX를 위해 최소 로딩 시간 부여
    await new Promise(resolve => setTimeout(resolve, 400));

    sendingStates.value.voltage.loading = false;
    if (success) {
      sendingStates.value.voltage.success = true;
      setTimeout(() => { sendingStates.value.voltage.success = false; }, 2000);
    }
  }

  async function setFrequency() {
    sendingStates.value.frequency.loading = true;
    sendingStates.value.frequency.success = false;

    let commands = [];
    if (serialStore.protocolMode === "i3c") {
      commands = [
        `clkset ${serialStore.i3cRateIndex} ${serialStore.i2cRateIndex}`,
        `pullup ${serialStore.i3cPullup}`,
        `err_msg ${serialStore.i3cErrMsg ? 1 : 0}`,
      ];
    } else if (serialStore.protocolMode === "spi") {
      commands = [
        `clock ${serialStore.spiClockKHz}`,
        `config ${serialStore.spiSelect} ${serialStore.spiSelPol} ${serialStore.spiMode} ${serialStore.spiCmdWidth} ${serialStore.spiAddrWidth} ${serialStore.spiWriteWidth} ${serialStore.spiReadWidth} ${serialStore.spiWaitCycles}`,
      ];
    } else {
      commands = [
        `clock ${serialStore.rffeClockKHz}`,
        `hsdr ${serialStore.rffeHsdr ? 1 : 0}`,
      ];
    }

    const success = await sendCommandSequence(commands);

    await new Promise(resolve => setTimeout(resolve, 400));

    sendingStates.value.frequency.loading = false;
    if (success) {
      sendingStates.value.frequency.success = true;
      setTimeout(() => { sendingStates.value.frequency.success = false; }, 2000);
    }
  }

  async function setRegisterValue(value) {
    registerValue.value = value;
    sendingStates.value.register.loading = true;
    sendingStates.value.register.success = false;

    let cmd = "";
    if (serialStore.protocolMode === "rffe") {
      const sa = Math.max(0, Math.min(15, serialStore.rffeSlaveAddress));
      const addr = Math.max(0, Math.min(31, serialStore.rffeRegisterAddress));
      const data = formatHex(value & 0xff, 2);
      cmd = `rw ${sa} ${formatHex(addr, 2)} ${data}`;
    } else if (serialStore.protocolMode === "spi") {
      const widthBytes = serialStore.spiWriteWidth === 3 ? 4 : serialStore.spiWriteWidth === 2 ? 2 : 1;
      const maxMask = widthBytes === 4 ? 0xffffffff : (1 << (widthBytes * 8)) - 1;
      const data = formatHex(value & maxMask, widthBytes * 2);
      const cmdWidth = Math.max(2, Math.ceil(serialStore.spiCmdWidth / 4));
      const addrWidth = Math.max(2, Math.ceil(serialStore.spiAddrWidth / 4));
      const cmdValue = formatHex(serialStore.spiCommand, cmdWidth);
      const addrValue = formatHex(serialStore.spiAddress, addrWidth);
      cmd = `s_write 1 ${cmdValue} ${addrValue} ${data}`;
    } else {
      const byteCount = Math.max(1, Math.min(4, serialStore.i3cByteCount));
      const dataBytes = splitValueToBytes(value, byteCount);
      cmd = `sdr_write ${serialStore.i3cIndex} ${serialStore.i3cCmb} ${byteCount} ${dataBytes.join(" ")}`;
    }

    const success = await sendCommandSequence([cmd]);

    await new Promise(resolve => setTimeout(resolve, 400));

    sendingStates.value.register.loading = false;
    if (success) {
      sendingStates.value.register.success = true;
      setTimeout(() => { sendingStates.value.register.success = false; }, 2000);
    }
  }

  return {
    registerValue,
    sendingStates,
    setVoltage,
    setFrequency,
    setRegisterValue,
    loadControlSettings,
  };
});

