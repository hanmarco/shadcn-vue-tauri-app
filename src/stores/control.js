import { defineStore } from "pinia";
import { ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { useSerialStore } from "./serial";

export const useControlStore = defineStore("control", () => {
  const serialStore = useSerialStore();

  // IC 제어 파라미터
  const voltage = ref(3.3);
  const frequency = ref(1000000); // 1MHz
  const registerValue = ref(0);

  // Actions
  async function setVoltage(value) {
    voltage.value = value;
    if (serialStore.isConnected) {
      try {
        await invoke("set_voltage", { value });
      } catch (error) {
        console.error("Failed to set voltage:", error);
      }
    }
  }

  async function setFrequency(value) {
    frequency.value = value;
    if (serialStore.isConnected) {
      try {
        await invoke("set_frequency", { value });
      } catch (error) {
        console.error("Failed to set frequency:", error);
      }
    }
  }

  async function setRegisterValue(value) {
    registerValue.value = value;
    if (serialStore.isConnected) {
      try {
        await invoke("set_register", { value });
      } catch (error) {
        console.error("Failed to set register:", error);
      }
    }
  }

  return {
    voltage,
    frequency,
    registerValue,
    setVoltage,
    setFrequency,
    setRegisterValue,
  };
});

