import { defineStore } from "pinia";
import { ref, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { toast } from "vue-sonner";
import { save } from "@tauri-apps/plugin-dialog";
import { LazyStore } from "@tauri-apps/plugin-store";

const store = new LazyStore("settings.json");

export const useSerialStore = defineStore("serial", () => {
  // State
  const connectedDevices = ref([]);
  const selectedDevice = ref(null);
  const isConnected = ref(false);
  const lastConnectedDevice = ref(null);
  const baudRate = ref(9600);
  const parity = ref("none");
  const stopBits = ref(1);
  const dataBits = ref(8);
  const flowControl = ref("none");
  const lineEnding = ref("LF");
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

  // Protocol settings (SC4415)
  const protocolMode = ref("rffe"); // 'rffe', 'spi', 'i3c'
  const vioSetting = ref(0);

  const rffeClockKHz = ref(26000);
  const rffeHsdr = ref(false);
  const rffeSlaveAddress = ref(0);
  const rffeRegisterAddress = ref(0);

  const spiClockKHz = ref(5000);
  const spiSelect = ref(1);
  const spiSelPol = ref(0);
  const spiMode = ref(0);
  const spiCmdWidth = ref(8);
  const spiAddrWidth = ref(8);
  const spiWriteWidth = ref(1);
  const spiReadWidth = ref(1);
  const spiWaitCycles = ref(0);

  const i3cRateIndex = ref(0);
  const i2cRateIndex = ref(0);
  const i3cPullup = ref(0);
  const i3cErrMsg = ref(true);
  const i3cIndex = ref(1);
  const i3cByteCount = ref(1);
  const i3cCmb = ref(0);

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
        flowControl.value = saved.flowControl || "none";
        lineEnding.value = saved.lineEnding || "LF";
        deviceType.value = saved.deviceType || "serialport";
        ftdiChannel.value = saved.ftdiChannel || "A";
        ftdiMode.value = saved.ftdiMode || "UART";
        ft260Mode.value = saved.ft260Mode || "I2C";
        ft260I2cSpeed.value = saved.ft260I2cSpeed || 400;
        txEnabled.value = saved.txEnabled !== undefined ? saved.txEnabled : true;
        rxEnabled.value = saved.rxEnabled !== undefined ? saved.rxEnabled : true;
        protocolMode.value = saved.protocolMode || "rffe";
        vioSetting.value = saved.vioSetting ?? 0;
        rffeClockKHz.value = saved.rffeClockKHz ?? 26000;
        rffeHsdr.value = saved.rffeHsdr ?? false;
        rffeSlaveAddress.value = saved.rffeSlaveAddress ?? 0;
        rffeRegisterAddress.value = saved.rffeRegisterAddress ?? 0;
        spiClockKHz.value = saved.spiClockKHz ?? 5000;
        spiSelect.value = saved.spiSelect ?? 1;
        spiSelPol.value = saved.spiSelPol ?? 0;
        spiMode.value = saved.spiMode ?? 0;
        spiCmdWidth.value = saved.spiCmdWidth ?? 8;
        spiAddrWidth.value = saved.spiAddrWidth ?? 8;
        spiWriteWidth.value = saved.spiWriteWidth ?? 1;
        spiReadWidth.value = saved.spiReadWidth ?? 1;
        spiWaitCycles.value = saved.spiWaitCycles ?? 0;
        i3cRateIndex.value = saved.i3cRateIndex ?? 0;
        i2cRateIndex.value = saved.i2cRateIndex ?? 0;
        i3cPullup.value = saved.i3cPullup ?? 0;
        i3cErrMsg.value = saved.i3cErrMsg ?? true;
        i3cIndex.value = saved.i3cIndex ?? 1;
        i3cByteCount.value = saved.i3cByteCount ?? 1;
        i3cCmb.value = saved.i3cCmb ?? 0;

        if (saved.selectedDevice) {
          selectedDevice.value = saved.selectedDevice;
        }
        if (saved.lastConnectedDevice) {
          lastConnectedDevice.value = saved.lastConnectedDevice;
        }
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
        flowControl: flowControl.value,
        lineEnding: lineEnding.value,
        deviceType: deviceType.value,
        ftdiChannel: ftdiChannel.value,
        ftdiMode: ftdiMode.value,
        ft260Mode: ft260Mode.value,
        ft260I2cSpeed: ft260I2cSpeed.value,
        txEnabled: txEnabled.value,
        rxEnabled: rxEnabled.value,
        selectedDevice: selectedDevice.value,
        lastConnectedDevice: lastConnectedDevice.value,
        protocolMode: protocolMode.value,
        vioSetting: vioSetting.value,
        rffeClockKHz: rffeClockKHz.value,
        rffeHsdr: rffeHsdr.value,
        rffeSlaveAddress: rffeSlaveAddress.value,
        rffeRegisterAddress: rffeRegisterAddress.value,
        spiClockKHz: spiClockKHz.value,
        spiSelect: spiSelect.value,
        spiSelPol: spiSelPol.value,
        spiMode: spiMode.value,
        spiCmdWidth: spiCmdWidth.value,
        spiAddrWidth: spiAddrWidth.value,
        spiWriteWidth: spiWriteWidth.value,
        spiReadWidth: spiReadWidth.value,
        spiWaitCycles: spiWaitCycles.value,
        i3cRateIndex: i3cRateIndex.value,
        i2cRateIndex: i2cRateIndex.value,
        i3cPullup: i3cPullup.value,
        i3cErrMsg: i3cErrMsg.value,
        i3cIndex: i3cIndex.value,
        i3cByteCount: i3cByteCount.value,
        i3cCmb: i3cCmb.value,
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
    baudRate, parity, stopBits, dataBits, flowControl, lineEnding, deviceType,
    ftdiChannel, ftdiMode, ft260Mode, ft260I2cSpeed,
    protocolMode, vioSetting, rffeClockKHz, rffeHsdr, rffeSlaveAddress, rffeRegisterAddress,
    spiClockKHz, spiSelect, spiSelPol, spiMode, spiCmdWidth, spiAddrWidth,
    spiWriteWidth, spiReadWidth, spiWaitCycles,
    i3cRateIndex, i2cRateIndex, i3cPullup, i3cErrMsg, i3cIndex, i3cByteCount, i3cCmb,
    isSimulationMode, txEnabled, rxEnabled, selectedDevice, lastConnectedDevice
  ], () => {
    saveSettings();
  });

  // Reset connection if device type changes
  watch(deviceType, () => {
    if (isConnected.value) {
      disconnect();
    }
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
      if (portName === VIRTUAL_DEVICE && !isSimulationMode.value) {
        const errorMsg = "Simulation mode is disabled.";
        connectionError.value = errorMsg;
        toast.error("연결 실패", {
          description: errorMsg,
        });
        return false;
      }

      if (portName === VIRTUAL_DEVICE) {
        // Simulation mode: artificial delay
        await new Promise(resolve => setTimeout(resolve, 800));
        selectedDevice.value = portName;
        lastConnectedDevice.value = portName;
        isConnected.value = true;
        toast.success("시뮬레이션 모드 연결 성공", {
          description: "가상 디바이스에 연결되었습니다.",
        });
        return true;
      }

      const actualPortName = portName && portName.includes(" (") ? portName.split(" (")[0] : portName;

      await invoke("connect_device", {
        deviceType: deviceType.value,
        portName: actualPortName,
        baudRate: baudRate.value,
        parity: parity.value,
        stopBits: stopBits.value,
        dataBits: dataBits.value,
        flowControl: flowControl.value,
        ftdiChannel: ftdiChannel.value,
        ftdiMode: ftdiMode.value,
        ft260Mode: ft260Mode.value,
        ft260I2cSpeed: ft260I2cSpeed.value,
      });
      selectedDevice.value = portName;
      lastConnectedDevice.value = portName;
      isConnected.value = true;
      connectionError.value = null;
      toast.success("장치 연결 성공", {
        description: `${actualPortName} 포트에 연결되었습니다.`,
      });
      return true;
    } catch (error) {
      console.error("Failed to connect:", error);
      isConnected.value = false;
      const errorMsg = error.toString();
      connectionError.value = errorMsg;
      toast.error("연결 실패", {
        description: errorMsg,
      });
      return false;
    } finally {
      isConnecting.value = false;
    }
  }

  async function disconnect() {
    try {
      if (selectedDevice.value) {
        // 값을 복사해서 저장하여 selectedDevice가 null이 되어도 유지되도록 함
        lastConnectedDevice.value = typeof selectedDevice.value === 'object'
          ? JSON.parse(JSON.stringify(selectedDevice.value))
          : selectedDevice.value;
      }

      if (selectedDevice.value === VIRTUAL_DEVICE) {
        isConnected.value = false;
        selectedDevice.value = null;
        return true;
      }

      await invoke("disconnect_serial");
      isConnected.value = false;

      toast.info("장치 연결 해제", {
        description: "통신 포트 연결이 종료되었습니다.",
      });

      selectedDevice.value = null; // Clear selection on disconnect
      return true;
    } catch (error) {
      console.error("Failed to disconnect:", error);
      return false;
    }
  }

  function applyLineEnding(data) {
    const ending = lineEnding.value === "CRLF"
      ? "\r\n"
      : lineEnding.value === "CR"
      ? "\r"
      : lineEnding.value === "NONE"
      ? ""
      : "\n";

    const normalized = data.replace(/[\r\n]+$/, "");
    return `${normalized}${ending}`;
  }

  async function sendData(data) {
    if (!isConnected.value) {
      return false;
    }

    const payload = applyLineEnding(data);

    if (selectedDevice.value === VIRTUAL_DEVICE) {
      // Mock response for simulation
      const mockResponse = `[SIM] ACK: Received "${payload.trim()}" at ${new Date().toLocaleTimeString()}`;
      addReceivedData(payload, "tx", true); // Log the transmitted data (always force)
      setTimeout(() => {
        addReceivedData(mockResponse, "rx", true); // Force add to logs
      }, 100);
      return true;
    }

    try {
      await invoke("send_serial_data", { data: payload });
      addReceivedData(payload, "tx", true); // Log the transmitted data (always force)
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
      toast.warning("로그 데이터 없음", {
        description: "내보낼 데이터가 존재하지 않습니다.",
      });
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
      toast.success("로그 저장 완료", {
        description: "파일이 성공적으로 저장되었습니다.",
      });
    } catch (error) {
      console.error("Failed to export logs:", error);
      toast.error("저장 실패", {
        description: error.toString(),
      });
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
    lastConnectedDevice,
    baudRate,
    parity,
    stopBits,
    dataBits,
    flowControl,
    lineEnding,
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
    protocolMode,
    vioSetting,
    rffeClockKHz,
    rffeHsdr,
    rffeSlaveAddress,
    rffeRegisterAddress,
    spiClockKHz,
    spiSelect,
    spiSelPol,
    spiMode,
    spiCmdWidth,
    spiAddrWidth,
    spiWriteWidth,
    spiReadWidth,
    spiWaitCycles,
    i3cRateIndex,
    i2cRateIndex,
    i3cPullup,
    i3cErrMsg,
    i3cIndex,
    i3cByteCount,
    i3cCmb,
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

