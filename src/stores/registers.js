import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { parse } from "yaml";
import { invoke } from "@tauri-apps/api/core";
import { useSerialStore } from "./serial";

export const useRegisterStore = defineStore("registers", () => {
  const serialStore = useSerialStore();

  const registers = ref([]);
  const registersYamlPath = "/registers.yaml";

  function normalizeNumber(value, fallback = 0) {
    if (typeof value === "number") return value;
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.startsWith("0x") || trimmed.startsWith("0X")) {
        const parsed = Number.parseInt(trimmed.slice(2), 16);
        return Number.isNaN(parsed) ? fallback : parsed;
      }
      const parsed = Number.parseInt(trimmed, 10);
      return Number.isNaN(parsed) ? fallback : parsed;
    }
    return fallback;
  }

  async function loadRegisters() {
    try {
      const response = await fetch(registersYamlPath);
      if (!response.ok) {
        throw new Error(
          `Failed to load ${registersYamlPath}: ${response.status}`,
        );
      }
      const yamlText = await response.text();
      const data = parse(yamlText) || {};
      const list = Array.isArray(data.registers) ? data.registers : [];

      registers.value = list.map((reg) => ({
        address: normalizeNumber(reg.address),
        name: reg.name || "",
        description: reg.description || "",
        value: normalizeNumber(reg.value),
        readOnly: !!reg.readOnly,
        fields: Array.isArray(reg.fields)
          ? reg.fields.map((field) => ({
              name: field.name || "",
              bit: normalizeNumber(field.bit),
              size: normalizeNumber(field.size, 1),
              description: field.description || "",
            }))
          : [],
      }));
    } catch (error) {
      console.error("Failed to load register map:", error);
      registers.value = [];
    }
  }

  const selectedRegisterAddress = ref(null);

  const selectedRegister = computed(() => {
    return registers.value.find(
      (r) => r.address === selectedRegisterAddress.value,
    );
  });

  // Actions
  async function readRegister(address) {
    if (!serialStore.isConnected) return;

    const cmd = `RREG:0x${address.toString(16).toUpperCase().padStart(2, "0")}\n`;
    await serialStore.sendData(cmd);

    if (serialStore.selectedDevice === serialStore.VIRTUAL_DEVICE) {
      // Simulation: return a random value after a short delay
      setTimeout(() => {
        const mockValue = Math.floor(Math.random() * 256);
        const reg = registers.value.find((r) => r.address === address);
        if (reg) reg.value = mockValue;
        serialStore.addReceivedData(
          `[SIM] Read 0x${address.toString(16).toUpperCase()} = 0x${mockValue.toString(16).toUpperCase()}`,
          "rx",
          true,
        );
      }, 200);
    } else {
      try {
        const value = await invoke("read_register", { address });
        const reg = registers.value.find((r) => r.address === address);
        if (reg) reg.value = value;
      } catch (error) {
        console.error(
          `Failed to read register 0x${address.toString(16)}:`,
          error,
        );
      }
    }
  }

  async function writeRegister(address, value) {
    if (!serialStore.isConnected) return;

    const cmd = `WREG:0x${address.toString(16).toUpperCase().padStart(2, "0")},0x${value.toString(16).toUpperCase().padStart(2, "0")}\n`;
    await serialStore.sendData(cmd);

    if (serialStore.selectedDevice === serialStore.VIRTUAL_DEVICE) {
      const reg = registers.value.find((r) => r.address === address);
      if (reg) reg.value = value;
    } else {
      try {
        await invoke("write_register", { address, value });
        const reg = registers.value.find((r) => r.address === address);
        if (reg) reg.value = value;
      } catch (error) {
        console.error(
          `Failed to write register 0x${address.toString(16)}:`,
          error,
        );
      }
    }
  }

  function updateBitfield(regAddress, field, newValue) {
    const reg = registers.value.find((r) => r.address === regAddress);
    if (!reg) return;

    // Clear bits in the field range
    const mask = ((1 << field.size) - 1) << field.bit;
    let val = reg.value & ~mask;

    // Set new bits
    val |= (newValue << field.bit) & mask;

    reg.value = val;

    // Automatically write to hardware if not read-only
    if (!reg.readOnly) {
      writeRegister(regAddress, val);
    }
  }

  loadRegisters();

  return {
    registers,
    selectedRegisterAddress,
    selectedRegister,
    loadRegisters,
    readRegister,
    writeRegister,
    updateBitfield,
  };
});
