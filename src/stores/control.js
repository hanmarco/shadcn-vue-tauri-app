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

  // Actions
  async function setVoltage(value) {
    voltage.value = value;
    const cmd = `VOLT:${value.toFixed(2)}\n`;
    const success = await serialStore.sendData(cmd);
    if (!success) {
      console.warn("Failed to send voltage command");
    }
  }

  async function setFrequency(value) {
    frequency.value = value;
    const cmd = `FREQ:${value}\n`;
    const success = await serialStore.sendData(cmd);
    if (!success) {
      console.warn("Failed to send frequency command");
    }
  }

  async function setRegisterValue(value) {
    registerValue.value = value;
    const cmd = `REG:0x${value.toString(16).toUpperCase().padStart(8, '0')}\n`;
    const success = await serialStore.sendData(cmd);
    if (!success) {
      console.warn("Failed to send register command");
    }
  }

  return {
    voltage,
    frequency,
    registerValue,
    setVoltage,
    setFrequency,
    setRegisterValue,
    loadControlSettings,
  };
});

