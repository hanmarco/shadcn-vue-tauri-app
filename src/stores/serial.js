import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export const useSerialStore = defineStore("serial", () => {
  // State
  const connectedDevices = ref([]);
  const selectedDevice = ref(null);
  const isConnected = ref(false);
  const baudRate = ref(9600);
  const parity = ref("none");
  const stopBits = ref(1);
  const dataBits = ref(8);
  const receivedData = ref([]);
  const txEnabled = ref(false);
  const rxEnabled = ref(false);

  // Getters
  const connectionStatus = computed(() => {
    if (isConnected.value) {
      return "connected";
    }
    return "disconnected";
  });

  // Actions
  async function scanDevices() {
    try {
      const devices = await invoke("scan_serial_devices");
      connectedDevices.value = devices || [];
      return devices;
    } catch (error) {
      console.error("Failed to scan devices:", error);
      return [];
    }
  }

  async function connect(portName) {
    try {
      await invoke("connect_serial", {
        portName,
        baudRate: baudRate.value,
        parity: parity.value,
        stopBits: stopBits.value,
        dataBits: dataBits.value,
      });
      selectedDevice.value = portName;
      isConnected.value = true;
      return true;
    } catch (error) {
      console.error("Failed to connect:", error);
      isConnected.value = false;
      return false;
    }
  }

  async function disconnect() {
    try {
      await invoke("disconnect_serial");
      isConnected.value = false;
      selectedDevice.value = null;
      return true;
    } catch (error) {
      console.error("Failed to disconnect:", error);
      return false;
    }
  }

  async function sendData(data) {
    if (!isConnected.value) {
      throw new Error("Not connected");
    }
    try {
      await invoke("send_serial_data", { data });
      return true;
    } catch (error) {
      console.error("Failed to send data:", error);
      return false;
    }
  }

  function addReceivedData(data) {
    receivedData.value.push({
      timestamp: new Date().toISOString(),
      data,
    });
    // 최대 10000개까지만 유지 (성능 최적화)
    if (receivedData.value.length > 10000) {
      receivedData.value.shift();
    }
  }

  function clearReceivedData() {
    receivedData.value = [];
  }

  // Event listener 설정
  async function setupEventListeners() {
    await listen("serial-data-received", (event) => {
      addReceivedData(event.payload);
    });
  }

  return {
    // State
    connectedDevices,
    selectedDevice,
    isConnected,
    baudRate,
    parity,
    stopBits,
    dataBits,
    receivedData,
    txEnabled,
    rxEnabled,
    // Getters
    connectionStatus,
    // Actions
    scanDevices,
    connect,
    disconnect,
    sendData,
    addReceivedData,
    clearReceivedData,
    setupEventListeners,
  };
});

