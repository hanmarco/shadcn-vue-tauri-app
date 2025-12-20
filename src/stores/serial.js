import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { save } from "@tauri-apps/plugin-dialog";

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
  const connectionError = ref(null);
  const isConnecting = ref(false);

  // Throttling state
  const pendingData = ref([]);
  let throttleTimeout = null;

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
    if (isConnecting.value) return false;

    isConnecting.value = true;
    connectionError.value = null;

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
      connectionError.value = null;
      return true;
    } catch (error) {
      console.error("Failed to connect:", error);
      isConnected.value = false;
      connectionError.value = error.toString();
      return false;
    } finally {
      isConnecting.value = false;
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
      return false;
    }
    try {
      await invoke("send_serial_data", { data });
      return true;
    } catch (error) {
      console.error("Failed to send data:", error);
      return false;
    }
  }

  // Throttled data addition
  function processThrottledData() {
    if (pendingData.value.length === 0) return;

    const timestamp = new Date().toISOString();
    // Batch all pending data into entries
    pendingData.value.forEach(data => {
      receivedData.value.push({
        timestamp,
        data,
      });
    });

    pendingData.value = [];

    // Keep only last 10,000 items
    if (receivedData.value.length > 10000) {
      receivedData.value.splice(0, receivedData.value.length - 10000);
    }

    throttleTimeout = null;
  }

  function addReceivedData(data) {
    if (!rxEnabled.value) return;

    pendingData.value.push(data);

    if (!throttleTimeout) {
      // Use requestAnimationFrame for smoother UI updates
      throttleTimeout = requestAnimationFrame(processThrottledData);
    }
  }

  function clearReceivedData() {
    receivedData.value = [];
  }

  async function exportLogs() {
    if (receivedData.value.length === 0) {
      alert("내보낼 로그 데이터가 없습니다.");
      return;
    }

    try {
      const path = await save({
        filters: [
          { name: "CSV", extensions: ["csv"] },
          { name: "JSON", extensions: ["json"] },
        ],
        defaultPath: `serial_log_${new Date().toISOString().replace(/[:.]/g, "-")}.csv`,
      });

      if (!path) return;

      let content = "";
      if (path.endsWith(".json")) {
        content = JSON.stringify(receivedData.value, null, 2);
      } else {
        // CSV Format: Timestamp, Data
        content = "Timestamp,Data\n";
        content += receivedData.value
          .map((item) => `"${item.timestamp}","${item.data.replace(/"/g, '""')}"`)
          .join("\n");
      }

      await invoke("save_log_to_file", { path, content });
      alert("로그가 성공적으로 저장되었습니다.");
    } catch (error) {
      console.error("Failed to export logs:", error);
      alert(`저장 실패: ${error}`);
    }
  }

  // Event listener 설정
  async function setupEventListeners() {
    await listen("serial-data-received", (event) => {
      addReceivedData(event.payload);
    });
  }

  return {
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
    connectionError,
    isConnecting,
    scanDevices,
    connect,
    disconnect,
    sendData,
    addReceivedData,
    clearReceivedData,
    exportLogs,
    setupEventListeners,
  };
});

