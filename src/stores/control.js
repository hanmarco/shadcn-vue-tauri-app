import { defineStore } from "pinia";
import { ref, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { useSerialStore } from "./serial";
import { LazyStore } from "@tauri-apps/plugin-store";

const store = new LazyStore("control_settings.json");

export const useControlStore = defineStore("control", () => {
  const serialStore = useSerialStore();

  // IC 제어 파라미터
  const voltage = ref(3.3);
  const frequency = ref(1000000); // 1MHz
  const registerValue = ref(0);

  // Persistence logic
  const CONTROL_KEY = "ic-controls";
  const isLoading = ref(false);

  async function loadControlSettings() {
    isLoading.value = true;
    try {
      const saved = await store.get(CONTROL_KEY);
      if (saved) {
        voltage.value = saved.voltage ?? 3.3;
        frequency.value = saved.frequency ?? 1000000;
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
        voltage: voltage.value,
        frequency: frequency.value,
        registerValue: registerValue.value,
      });
      await store.save();
    } catch (error) {
      console.error("Failed to save control settings:", error);
    }
  }

  // Watch for changes and save (sliders move these immediately)
  watch([voltage, frequency, registerValue], () => {
    saveControlSettings();
  });

  // 전송 상태 관리 (UI 피드백용)
  const sendingStates = ref({
    voltage: { loading: false, success: false },
    frequency: { loading: false, success: false },
    register: { loading: false, success: false },
  });

  async function setVoltage(value) {
    voltage.value = value;
    sendingStates.value.voltage.loading = true;
    sendingStates.value.voltage.success = false;

    const cmd = `VOLT:${value.toFixed(2)}\n`;
    const success = await serialStore.sendData(cmd);

    // UX를 위해 최소 로딩 시간 부여
    await new Promise(resolve => setTimeout(resolve, 400));

    sendingStates.value.voltage.loading = false;
    if (success) {
      sendingStates.value.voltage.success = true;
      setTimeout(() => { sendingStates.value.voltage.success = false; }, 2000);
    }
  }

  async function setFrequency(value) {
    frequency.value = value;
    sendingStates.value.frequency.loading = true;
    sendingStates.value.frequency.success = false;

    const cmd = `FREQ:${value}\n`;
    const success = await serialStore.sendData(cmd);

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

    const cmd = `REG:0x${value.toString(16).toUpperCase().padStart(8, '0')}\n`;
    const success = await serialStore.sendData(cmd);

    await new Promise(resolve => setTimeout(resolve, 400));

    sendingStates.value.register.loading = false;
    if (success) {
      sendingStates.value.register.success = true;
      setTimeout(() => { sendingStates.value.register.success = false; }, 2000);
    }
  }

  return {
    voltage,
    frequency,
    registerValue,
    sendingStates,
    setVoltage,
    setFrequency,
    setRegisterValue,
    loadControlSettings,
  };
});

