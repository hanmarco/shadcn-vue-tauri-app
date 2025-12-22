import { defineStore } from "pinia";
import { ref, computed, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { save } from "@tauri-apps/plugin-dialog";
import { LazyStore } from "@tauri-apps/plugin-store";

const store = new LazyStore("settings.json");

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
  const txEnabled = ref(true);
  const rxEnabled = ref(true);
  const connectionError = ref(null);
  const isConnecting = ref(false);
  const isSimulationMode = ref(false);
  const deviceType = ref("serialport"); // 'serialport', 'ft2232d', 'ft2232h', 'ft260'

  // Specific settings for ICs
  const ftdiChannel = ref("A"); // 'A', 'B'
  const ftdiMode = ref("UART"); // 'UART', 'Bitbang', 'MPSSE'
  const ft260Mode = ref("I2C"); // 'I2C', 'UART'
  const ft260I2cSpeed = ref(400); // kHz

  const VIRTUAL_DEVICE = "Virtual Simulator (SIM)";

  // Throttling state
  const pendingData = ref([]);
  let throttleTimeout = null;

  // Persistence logic
  const SETTINGS_KEY = "serial-settings";
  const SIMULATION_KEY = "simulation-mode";
  const isLoading = ref(false);

  async function loadSettings() {
    isLoading.value = true;
    try {
      console.log("Loading settings...");
      const saved = await store.get(SETTINGS_KEY);
      if (saved) {
        console.log("Restoring saved settings:", saved);
        baudRate.value = saved.baudRate || 9600;
        parity.value = saved.parity || "none";
        stopBits.value = saved.stopBits || 1;
        dataBits.value = saved.dataBits || 8;
        deviceType.value = saved.deviceType || "serialport";
        ftdiChannel.value = saved.ftdiChannel || "A";
        ftdiMode.value = saved.ftdiMode || "UART";
        ft260Mode.value = saved.ft260Mode || "I2C";
        ft260I2cSpeed.value = saved.ft260I2cSpeed || 400;
        txEnabled.value = saved.txEnabled !== undefined ? saved.txEnabled : true;
        rxEnabled.value = saved.rxEnabled !== undefined ? saved.rxEnabled : true;
      }

      const simMode = await store.get(SIMULATION_KEY);
      if (simMode !== null) {
        isSimulationMode.value = !!simMode;
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
    } finally {
      isLoading.value = false;
    }
  }

  async function saveSettings() {
    if (isLoading.value) return;

    try {
      console.log("Saving settings...");
      await store.set(SETTINGS_KEY, {
        baudRate: baudRate.value,
        parity: parity.value,
        stopBits: stopBits.value,
        dataBits: dataBits.value,
        deviceType: deviceType.value,
        ftdiChannel: ftdiChannel.value,
        ftdiMode: ftdiMode.value,
        ft260Mode: ft260Mode.value,
        ft260I2cSpeed: ft260I2cSpeed.value,
        txEnabled: txEnabled.value,
        rxEnabled: rxEnabled.value,
      });
      await store.set(SIMULATION_KEY, isSimulationMode.value);
      await store.save();
      console.log("Settings saved successfully.");
    } catch (error) {
      console.error("Failed to save settings:", error);
    }
  }

  // Watch for changes and save
  watch([
    baudRate, parity, stopBits, dataBits, deviceType,
    ftdiChannel, ftdiMode, ft260Mode, ft260I2cSpeed,
    isSimulationMode, txEnabled, rxEnabled
  ], () => {
    saveSettings();
  });

  // Actions
  async function scanDevices() {
    try {
      let devices = [];
      if (!isSimulationMode.value) {
        devices = await invoke("scan_serial_devices");
      }

      if (isSimulationMode.value) {
        devices = [VIRTUAL_DEVICE];
      }

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
      if (portName === VIRTUAL_DEVICE) {
        // Simulation mode: artificial delay
        await new Promise(resolve => setTimeout(resolve, 800));
        selectedDevice.value = portName;
        isConnected.value = true;
        return true;
      }

      const actualPortName = portName.includes(" (") ? portName.split(" (")[0] : portName;

      await invoke("connect_serial", {
        portName: actualPortName,
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
      if (selectedDevice.value === VIRTUAL_DEVICE) {
        isConnected.value = false;
        selectedDevice.value = null;
        return true;
      }

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

    if (selectedDevice.value === VIRTUAL_DEVICE) {
      // Mock response for simulation
      const mockResponse = `[SIM] ACK: Received "${data.trim()}" at ${new Date().toLocaleTimeString()}`;
      addReceivedData(data, "tx", true); // Log the transmitted data (always force)
      setTimeout(() => {
        addReceivedData(mockResponse, "rx", true); // Force add to logs
      }, 100);
      return true;
    }

    try {
      await invoke("send_serial_data", { data });
      addReceivedData(data, "tx", true); // Log the transmitted data (always force)
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

    // Create new entries with unique IDs, types, and ports
    const newEntries = pendingData.value.map((item, index) => ({
      id: `${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp,
      data: item.data,
      type: item.type || "rx",
      port: item.port || "Unknown",
    }));

    // Update state with a new array reference to ensure reactivity
    let updatedData = [...receivedData.value, ...newEntries];

    // Keep only last 10,000 items
    if (updatedData.length > 10000) {
      updatedData = updatedData.slice(updatedData.length - 10000);
    }

    receivedData.value = updatedData;
    pendingData.value = [];

    throttleTimeout = null;
  }

  function addReceivedData(data, type = "rx", force = false) {
    if (type === "rx" && !rxEnabled.value && !force) return;
    if (type === "tx" && !txEnabled.value && !force) return;

    // Get current port name (only the COMx part if possible)
    const portName = selectedDevice.value || "Unknown";
    const actualPort = portName.includes(" (") ? portName.split(" (")[0] : portName;

    pendingData.value.push({ data, type, port: actualPort });

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
        // CSV Format: Timestamp, Type, Port, Data
        content = "Timestamp,Type,Port,Data\n";
        content += receivedData.value
          .map((item) => `"${item.timestamp}","${item.type || "rx"}","${item.port || "Unknown"}","${item.data.replace(/"/g, '""')}"`)
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
    isSimulationMode,
    deviceType,
    ftdiChannel,
    ftdiMode,
    ft260Mode,
    ft260I2cSpeed,
    VIRTUAL_DEVICE,
    scanDevices,
    connect,
    disconnect,
    sendData,
    addReceivedData,
    clearReceivedData,
    exportLogs,
    setupEventListeners,
    loadSettings,
  };
});

