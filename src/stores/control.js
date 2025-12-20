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
    // 시뮬레이션 모드에서도 값은 항상 저장됨
    // 연결되어 있으면 실제 장치로 전송
    if (serialStore.isConnected) {
      try {
        await invoke("set_voltage", { value });
      } catch (error) {
        console.error("Failed to set voltage:", error);
      }
    } else {
      // 시뮬레이션 모드: 값만 저장 (나중에 연결되면 적용 가능)
      console.log("Simulation mode: Voltage set to", value, "V");
    }
  }

  async function setFrequency(value) {
    frequency.value = value;
    // 시뮬레이션 모드에서도 값은 항상 저장됨
    if (serialStore.isConnected) {
      try {
        await invoke("set_frequency", { value });
      } catch (error) {
        console.error("Failed to set frequency:", error);
      }
    } else {
      // 시뮬레이션 모드: 값만 저장
      console.log("Simulation mode: Frequency set to", value, "Hz");
    }
  }

  async function setRegisterValue(value) {
    registerValue.value = value;
    // 시뮬레이션 모드에서도 값은 항상 저장됨
    if (serialStore.isConnected) {
      try {
        await invoke("set_register", { value });
      } catch (error) {
        console.error("Failed to set register:", error);
      }
    } else {
      // 시뮬레이션 모드: 값만 저장
      console.log("Simulation mode: Register set to 0x" + value.toString(16).toUpperCase());
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

