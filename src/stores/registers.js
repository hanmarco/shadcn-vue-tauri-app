import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { useSerialStore } from "./serial";

export const useRegisterStore = defineStore("registers", () => {
    const serialStore = useSerialStore();

    // Register definitions (Dummy data for now, could be loaded from JSON)
    const registers = ref([
        {
            address: 0x01,
            name: "CONFIG_REG",
            description: "Main configuration register",
            value: 0x00,
            fields: [
                { name: "ENABLE", bit: 0, size: 1, description: "Enable IC" },
                { name: "MODE", bit: 1, size: 2, description: "Operation Mode" },
                { name: "IRQ_EN", bit: 3, size: 1, description: "Interrupt Enable" },
            ]
        },
        {
            address: 0x02,
            name: "STATUS_REG",
            description: "Operational status",
            value: 0x80,
            readOnly: true,
            fields: [
                { name: "READY", bit: 7, size: 1, description: "System Ready" },
                { name: "BUSY", bit: 6, size: 1, description: "Operation in progress" },
                { name: "ERROR", bit: 0, size: 1, description: "Error detected" },
            ]
        },
        {
            address: 0x03,
            name: "DATA_REG",
            description: "Data transfer register",
            value: 0x00,
            fields: []
        }
    ]);

    const selectedRegisterAddress = ref(null);

    const selectedRegister = computed(() => {
        return registers.value.find(r => r.address === selectedRegisterAddress.value);
    });

    // Actions
    async function readRegister(address) {
        if (!serialStore.isConnected) return;

        const cmd = `RREG:0x${address.toString(16).toUpperCase().padStart(2, '0')}\n`;
        await serialStore.sendData(cmd);

        if (serialStore.selectedDevice === serialStore.VIRTUAL_DEVICE) {
            // Simulation: return a random value after a short delay
            setTimeout(() => {
                const mockValue = Math.floor(Math.random() * 256);
                const reg = registers.value.find(r => r.address === address);
                if (reg) reg.value = mockValue;
                serialStore.addReceivedData(`[SIM] Read 0x${address.toString(16).toUpperCase()} = 0x${mockValue.toString(16).toUpperCase()}`, true);
            }, 200);
        } else {
            try {
                const value = await invoke("read_register", { address });
                const reg = registers.value.find(r => r.address === address);
                if (reg) reg.value = value;
            } catch (error) {
                console.error(`Failed to read register 0x${address.toString(16)}:`, error);
            }
        }
    }

    async function writeRegister(address, value) {
        if (!serialStore.isConnected) return;

        const cmd = `WREG:0x${address.toString(16).toUpperCase().padStart(2, '0')},0x${value.toString(16).toUpperCase().padStart(2, '0')}\n`;
        await serialStore.sendData(cmd);

        if (serialStore.selectedDevice === serialStore.VIRTUAL_DEVICE) {
            const reg = registers.value.find(r => r.address === address);
            if (reg) reg.value = value;
        } else {
            try {
                await invoke("write_register", { address, value });
                const reg = registers.value.find(r => r.address === address);
                if (reg) reg.value = value;
            } catch (error) {
                console.error(`Failed to write register 0x${address.toString(16)}:`, error);
            }
        }
    }

    function updateBitfield(regAddress, field, newValue) {
        const reg = registers.value.find(r => r.address === regAddress);
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

    return {
        registers,
        selectedRegisterAddress,
        selectedRegister,
        readRegister,
        writeRegister,
        updateBitfield,
    };
});
