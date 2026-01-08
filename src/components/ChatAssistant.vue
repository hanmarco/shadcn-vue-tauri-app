<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { LazyStore } from "@tauri-apps/plugin-store";
import {
    MessageCircleIcon,
    SendIcon,
    SettingsIcon,
    PanelRightIcon,
    Trash2Icon,
    XIcon,
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import SelectItem from "@/components/ui/select/SelectItem.vue";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSerialStore } from "@/stores/serial";
import { useControlStore } from "@/stores/control";
import { useRegisterStore } from "@/stores/registers";

const props = defineProps({
    activeTab: {
        type: String,
        required: true,
    },
});

const emit = defineEmits(["update:activeTab"]);

const serialStore = useSerialStore();
const controlStore = useControlStore();
const registerStore = useRegisterStore();

const isOpen = ref(false);
const showSettings = ref(false);
const isSending = ref(false);
const input = ref("");
const messages = ref([]);
const scrollRef = ref(null);
const isDocked = ref(false);
const preferredDocked = ref(false);
const dockedClassName = "chat-docked";
const showActionFx = ref(false);
const actionFxKey = ref(0);
let actionFxTimer = null;

const showPanel = computed(() => isOpen.value);
const isDockedActive = computed(() => isDocked.value && isOpen.value);

const settingsStore = new LazyStore("llm_settings.json");
const autoApprovedKey = "auto-approved";
const settings = ref({
    baseUrl: "",
    apiKey: "",
    model: "gpt-4o-mini",
    temperature: 0.2,
    maxTokens: 600,
});
const isLoadingSettings = ref(false);
const modelOptions = ref([]);
const modelError = ref("");
const isLoadingModels = ref(false);
const registerQuery = ref("");
const autoApproved = ref(false);
const isAutoApproving = ref(false);
const isLoadingAutoApproved = ref(false);

const canSend = computed(() => {
    return (
        !!settings.value.baseUrl &&
        !!settings.value.model &&
        input.value.trim() &&
        !isSending.value
    );
});

const contextSnapshot = computed(() => {
    return {
        activeTab: props.activeTab,
        isConnected: serialStore.isConnected,
        selectedDevice: serialStore.selectedDevice || null,
        deviceType: serialStore.deviceType,
        protocolMode: serialStore.protocolMode,
        simulationMode: serialStore.isSimulationMode,
    };
});

const systemPrompt = computed(() => {
    return [
        "You are the built-in assistant for the IC Controller app.",
        "Explain the app, answer questions, and propose control actions when asked.",
        "Always respond with valid JSON only, no markdown:",
        '{"reply":"...", "actions":[{"type":"set_tab","tab":"config|dashboard|registers|logs"}]}',
        "Allowed action types:",
        "- set_tab (tab)",
        "- scan_devices",
        "- connect (port)",
        "- disconnect",
        "- send_command (data)",
        "- set_vio (value)",
        "- set_frequency",
        "- set_register (address, value)",
        "- select_register (name is preferred; use address only if you have a numeric address)",
        `Context snapshot: ${JSON.stringify(contextSnapshot.value)}`,
    ].join("\n");
});

async function loadSettings() {
    isLoadingSettings.value = true;
    try {
        const saved = await settingsStore.get("llm-settings");
        if (saved) {
            settings.value.baseUrl = saved.baseUrl || "";
            settings.value.apiKey = saved.apiKey || "";
            settings.value.model = saved.model || settings.value.model;
            settings.value.temperature =
                saved.temperature ?? settings.value.temperature;
            settings.value.maxTokens =
                saved.maxTokens ?? settings.value.maxTokens;
        }
    } finally {
        isLoadingSettings.value = false;
    }
}

async function loadAutoApproved() {
    isLoadingAutoApproved.value = true;
    try {
        const saved = await settingsStore.get(autoApprovedKey);
        if (typeof saved === "boolean") {
            autoApproved.value = saved;
        }
    } finally {
        isLoadingAutoApproved.value = false;
    }
}

async function saveAutoApproved() {
    if (isLoadingAutoApproved.value) return;
    await settingsStore.set(autoApprovedKey, autoApproved.value);
    await settingsStore.save();
}

async function saveSettings() {
    if (isLoadingSettings.value) return;
    await settingsStore.set("llm-settings", { ...settings.value });
    await settingsStore.save();
}

watch(
    settings,
    () => {
        saveSettings();
    },
    { deep: true },
);

onMounted(() => {
    loadSettings();
    loadAutoApproved();
});

watch(
    isDockedActive,
    (value) => {
        if (typeof document === "undefined") return;
        document.body.classList.toggle(dockedClassName, value);
    },
    { immediate: true },
);

onUnmounted(() => {
    if (typeof document === "undefined") return;
    document.body.classList.remove(dockedClassName);
});
onUnmounted(() => {
    if (actionFxTimer) {
        clearTimeout(actionFxTimer);
        actionFxTimer = null;
    }
});

function triggerActionFx() {
    showActionFx.value = false;
    actionFxKey.value += 1;
    showActionFx.value = true;
    if (actionFxTimer) {
        clearTimeout(actionFxTimer);
    }
    actionFxTimer = setTimeout(() => {
        showActionFx.value = false;
        actionFxTimer = null;
    }, 500);
}

async function fetchModels() {
    modelError.value = "";
    modelOptions.value = [];
    if (!settings.value.baseUrl) {
        modelError.value = "Set the base URL first.";
        return;
    }
    isLoadingModels.value = true;
    try {
        const models = await invoke("list_llm_models", {
            baseUrl: settings.value.baseUrl,
            apiKey: settings.value.apiKey || null,
        });
        modelOptions.value = Array.isArray(models) ? models : [];
        if (!modelOptions.value.length) {
            modelError.value = "No models returned.";
        }
    } catch (error) {
        modelError.value = error.toString();
    } finally {
        isLoadingModels.value = false;
    }
}

function normalizeAssistantPayload(rawText) {
    const trimmed = rawText.trim();
    if (!trimmed) {
        return { reply: "", actions: [] };
    }

    const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const candidate = fencedMatch ? fencedMatch[1].trim() : trimmed;

    try {
        const parsed = JSON.parse(candidate);
        return {
            reply: typeof parsed.reply === "string" ? parsed.reply : rawText,
            actions: Array.isArray(parsed.actions) ? parsed.actions : [],
        };
    } catch (error) {
        return { reply: rawText, actions: [] };
    }
}

function scrollToBottom() {
    nextTick(() => {
        if (scrollRef.value) {
            scrollRef.value.scrollTop = scrollRef.value.scrollHeight;
        }
    });
}

function clearMessages() {
    messages.value = [];
}

function toggleDocked() {
    isDocked.value = !isDocked.value;
    preferredDocked.value = isDocked.value;
    if (isDocked.value) {
        isOpen.value = true;
    }
}

function closePanel() {
    isOpen.value = false;
    isDocked.value = false;
}

function openPanel() {
    isDocked.value = preferredDocked.value;
    isOpen.value = true;
}

const registerResults = computed(() => {
    const query = registerQuery.value.trim().toLowerCase();
    if (!query) return [];
    const list = registerStore.registers || [];
    const matches = list.filter((reg) => {
        const addressHex = `0x${reg.address.toString(16).toLowerCase()}`;
        return (
            reg.name.toLowerCase().includes(query) ||
            reg.description.toLowerCase().includes(query) ||
            addressHex.includes(query) ||
            reg.address.toString(10).includes(query)
        );
    });
    return matches.slice(0, 6);
});

function parseRegisterAddress(value) {
    if (typeof value === "number") return value;
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith("0x") || trimmed.startsWith("0X")) {
        const parsed = Number.parseInt(trimmed.slice(2), 16);
        return Number.isNaN(parsed) ? null : parsed;
    }
    const regMatch = trimmed.match(/^reg[_\s-]?([0-9a-f]+)$/i);
    if (regMatch) {
        const parsed = Number.parseInt(regMatch[1], 16);
        return Number.isNaN(parsed) ? null : parsed;
    }
    const parsed = Number.parseInt(trimmed, 10);
    return Number.isNaN(parsed) ? null : parsed;
}

function parseRegisterValue(value) {
    if (typeof value === "number") return value;
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith("0x") || trimmed.startsWith("0X")) {
        const parsed = Number.parseInt(trimmed.slice(2), 16);
        return Number.isNaN(parsed) ? null : parsed;
    }
    const parsed = Number.parseInt(trimmed, 16);
    return Number.isNaN(parsed) ? null : parsed;
}

function resolveRegisterTarget(action) {
    const list = registerStore.registers || [];
    const addressValue = parseRegisterAddress(action?.address);
    if (addressValue !== null) {
        return list.find((reg) => reg.address === addressValue) || null;
    }
    const nameValue =
        typeof action?.name === "string"
            ? action.name
            : typeof action?.address === "string"
              ? action.address
              : "";
    if (typeof nameValue === "string" && nameValue.trim()) {
        const needle = nameValue.toLowerCase().trim();
        if (!needle) return null;
        return (
            list.find((reg) => reg.name.toLowerCase() === needle) ||
            list.find((reg) => reg.name.toLowerCase().includes(needle)) ||
            list.find((reg) =>
                reg.description.toLowerCase().includes(needle),
            ) ||
            null
        );
    }
    return null;
}

function selectRegisterFromSearch(reg) {
    if (!reg) return;
    registerStore.selectedRegisterAddress = reg.address;
    emit("update:activeTab", "registers");
    registerQuery.value = "";
}

async function sendMessage() {
    if (!canSend.value) return;

    const text = input.value.trim();
    if (!text) return;

    input.value = "";
    messages.value.push({ role: "user", content: text });
    scrollToBottom();

    isSending.value = true;
    try {
        const chatMessages = [
            { role: "system", content: systemPrompt.value },
            ...messages.value.map((message) => ({
                role: message.role,
                content: message.content,
            })),
        ];

        const response = await invoke("llm_chat", {
            request: {
                base_url: settings.value.baseUrl,
                api_key: settings.value.apiKey || null,
                model: settings.value.model,
                messages: chatMessages,
                temperature: settings.value.temperature,
                max_tokens: settings.value.maxTokens,
            },
        });

        const payload = normalizeAssistantPayload(String(response || ""));
        const normalizedActions = (payload.actions || []).map((action) => ({
            ...action,
            status: "idle",
        }));

        messages.value.push({
            role: "assistant",
            content: payload.reply || "No response.",
            actions: normalizedActions,
        });
        runAutoApproveQueue();
    } catch (error) {
        messages.value.push({
            role: "assistant",
            content: `Request failed: ${error.toString()}`,
            actions: [],
        });
    } finally {
        isSending.value = false;
        scrollToBottom();
    }
}

function formatActionLabel(action) {
    if (!action || !action.type) return "unknown";
    switch (action.type) {
        case "set_tab":
            return `set_tab -> ${action.tab}`;
        case "scan_devices":
            return "scan_devices";
        case "connect":
            return `connect -> ${action.port}`;
        case "disconnect":
            return "disconnect";
        case "send_command":
            return `send_command -> ${action.data}`;
        case "set_vio":
            return `set_vio -> ${action.value}`;
        case "set_frequency":
            return "set_frequency";
        case "set_register":
            return `set_register -> ${action.address}, ${action.value}`;
        case "select_register":
            if (typeof action.address === "number") {
                return `select_register -> 0x${action.address
                    .toString(16)
                    .toUpperCase()}`;
            }
            if (typeof action.name === "string") {
                return `select_register -> ${action.name}`;
            }
            if (typeof action.address === "string") {
                return `select_register -> 0x${action.address}`;
            }
            return "select_register";
        default:
            return action.type;
    }
}

function findNextPendingAction() {
    for (const message of messages.value) {
        const actions = message.actions || [];
        for (const action of actions) {
            if (!action) continue;
            if (action.status === "running" || action.status === "done") {
                continue;
            }
            if (action.status === "error") continue;
            return action;
        }
    }
    return null;
}

async function runAutoApproveQueue() {
    if (!autoApproved.value || isAutoApproving.value) return;

    isAutoApproving.value = true;
    try {
        while (autoApproved.value) {
            const nextAction = findNextPendingAction();
            if (!nextAction) break;
            await runAction(nextAction);
        }
    } finally {
        isAutoApproving.value = false;
    }
}

watch(autoApproved, (value) => {
    saveAutoApproved();
    if (value) runAutoApproveQueue();
});

async function runAction(action) {
    if (!action || action.status === "running") return;

    triggerActionFx();
    action.status = "running";
    try {
        switch (action.type) {
            case "set_tab":
                if (action.tab) {
                    emit("update:activeTab", action.tab);
                }
                break;
            case "scan_devices":
                await serialStore.scanDevices();
                break;
            case "connect":
                if (action.port) {
                    await serialStore.connect(action.port);
                }
                break;
            case "disconnect":
                await serialStore.disconnect();
                break;
            case "send_command":
                if (action.data) {
                    await serialStore.sendData(String(action.data));
                }
                break;
            case "set_vio":
                if (typeof action.value === "number") {
                    serialStore.vioSetting = action.value;
                    await controlStore.setVoltage();
                }
                break;
            case "set_frequency":
                await controlStore.setFrequency();
                break;
            case "set_register":
                emit("update:activeTab", "registers");
                if (
                    (!registerStore.registers ||
                        registerStore.registers.length === 0) &&
                    !registerStore.isLoading
                ) {
                    await registerStore.loadRegisters();
                }
                let targetAddress = null;
                if (typeof action.address === "number") {
                    targetAddress = action.address;
                } else if (typeof action.address === "string") {
                    const addr = parseRegisterAddress(action.address);
                    if (addr !== null) {
                        targetAddress = addr;
                    } else if (action.address.trim()) {
                        const target = resolveRegisterTarget(action);
                        if (target) {
                            targetAddress = target.address;
                        }
                    }
                }
                if (typeof targetAddress === "number") {
                    controlStore.registerAddress = targetAddress;
                    registerStore.selectedRegisterAddress = targetAddress;
                }
                console.log("Setting register", targetAddress, action.value);
                const parsedValue = parseRegisterValue(action.value);
                if (typeof parsedValue === "number") {
                    if (typeof targetAddress === "number") {
                        registerStore.updateRegisterMeta(targetAddress, {
                            value: parsedValue,
                        });
                    }
                    await controlStore.setRegisterValue(parsedValue);
                }
                break;
            case "select_register": {
                emit("update:activeTab", "registers");
                if (
                    (!registerStore.registers ||
                        registerStore.registers.length === 0) &&
                    !registerStore.isLoading
                ) {
                    await registerStore.loadRegisters();
                }
                const target = resolveRegisterTarget(action);
                if (target) {
                    registerStore.selectedRegisterAddress = target.address;
                    controlStore.registerAddress = target.address;
                    emit("update:activeTab", "registers");
                }
                break;
            }
            default:
                break;
        }
        action.status = "done";
    } catch (error) {
        action.status = "error";
        action.error = error.toString();
    } finally {
        if (autoApproved.value) {
            runAutoApproveQueue();
        }
    }
}
</script>

<template>
    <div
        v-if="showPanel"
        class="fixed z-50"
        :class="
            isDocked
                ? 'top-0 right-0 h-screen w-[360px] max-w-[92vw]'
                : 'bottom-6 right-6 flex flex-col items-end gap-3'
        "
    >
        <Card
            :class="
                isDocked
                    ? 'h-full overflow-hidden shadow-xl flex flex-col'
                    : 'w-[360px] max-w-[92vw] overflow-hidden shadow-xl'
            "
        >
            <div class="flex items-center justify-between border-b px-4 py-3">
                <div class="text-sm font-semibold">LLM Assistant</div>
                <div class="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        @click="showSettings = !showSettings"
                    >
                        <SettingsIcon />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        @click="toggleDocked"
                    >
                        <PanelRightIcon />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        :disabled="!messages.length"
                        @click="clearMessages"
                    >
                        <Trash2Icon />
                    </Button>
                    <Button variant="ghost" size="icon-sm" @click="closePanel">
                        <XIcon />
                    </Button>
                </div>
            </div>

            <div v-if="showSettings" class="border-b px-4 py-3 space-y-3">
                <div class="space-y-1">
                    <label
                        class="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                        >Base URL</label
                    >
                    <input
                        v-model="settings.baseUrl"
                        placeholder="https://api.openai.com/v1"
                        class="h-9 w-full rounded-md border bg-background px-3 text-xs"
                    />
                </div>
                <div class="space-y-1">
                    <label
                        class="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                        >Model</label
                    >
                    <div class="flex items-center gap-2">
                        <Select
                            v-if="modelOptions.length"
                            v-model="settings.model"
                            class="flex-1"
                        >
                            <SelectItem
                                v-for="model in modelOptions"
                                :key="model"
                                :value="model"
                            >
                                {{ model }}
                            </SelectItem>
                        </Select>
                        <input
                            v-else
                            v-model="settings.model"
                            placeholder="gpt-4o-mini"
                            class="h-9 w-full rounded-md border bg-background px-3 text-xs"
                        />
                        <Button
                            size="sm"
                            variant="secondary"
                            :disabled="isLoadingModels"
                            @click="fetchModels"
                        >
                            <span v-if="isLoadingModels">Loading</span>
                            <span v-else>Fetch</span>
                        </Button>
                    </div>
                    <div v-if="modelError" class="text-[11px] text-destructive">
                        {{ modelError }}
                    </div>
                </div>
                <div class="space-y-1">
                    <label
                        class="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                        >API Key</label
                    >
                    <input
                        v-model="settings.apiKey"
                        type="password"
                        placeholder="sk-..."
                        class="h-9 w-full rounded-md border bg-background px-3 text-xs"
                    />
                </div>
                <div class="flex gap-2">
                    <div class="flex-1 space-y-1">
                        <label
                            class="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                            >Temperature</label
                        >
                        <input
                            v-model.number="settings.temperature"
                            type="number"
                            min="0"
                            max="2"
                            step="0.1"
                            class="h-9 w-full rounded-md border bg-background px-3 text-xs"
                        />
                    </div>
                    <div class="flex-1 space-y-1">
                        <label
                            class="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                            >Max Tokens</label
                        >
                        <input
                            v-model.number="settings.maxTokens"
                            type="number"
                            min="1"
                            step="1"
                            class="h-9 w-full rounded-md border bg-background px-3 text-xs"
                        />
                    </div>
                </div>
            </div>
            <div
                ref="scrollRef"
                :class="
                    isDocked
                        ? 'flex-1 overflow-y-auto px-4 py-3 space-y-3'
                        : 'max-h-[360px] overflow-y-auto px-4 py-3 space-y-3'
                "
            >
                <div
                    v-if="!messages.length"
                    class="text-xs text-muted-foreground"
                >
                    Ask about the app or request an action.
                </div>
                <div
                    v-for="(message, index) in messages"
                    :key="index"
                    class="flex"
                    :class="
                        message.role === 'user'
                            ? 'justify-end'
                            : 'justify-start'
                    "
                >
                    <div
                        class="max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed"
                        :class="
                            message.role === 'user'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-foreground'
                        "
                    >
                        {{ message.content }}
                        <div
                            v-if="message.actions?.length"
                            class="mt-3 space-y-2"
                        >
                            <div
                                v-for="(action, actionIndex) in message.actions"
                                :key="actionIndex"
                                class="flex items-center justify-between gap-2 rounded-md border bg-background px-2 py-2 text-[11px]"
                            >
                                <span class="font-mono">{{
                                    formatActionLabel(action)
                                }}</span>
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    :disabled="action.status === 'running'"
                                    @click="runAction(action)"
                                >
                                    <span v-if="action.status === 'running'"
                                        >Running...</span
                                    >
                                    <span v-else-if="action.status === 'done'"
                                        >Done</span
                                    >
                                    <span v-else-if="action.status === 'error'"
                                        >Failed</span
                                    >
                                    <span v-else>Run</span>
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <form class="border-t p-3" @submit.prevent="sendMessage">
                <div class="flex items-end gap-2">
                    <textarea
                        v-model="input"
                        rows="2"
                        placeholder="Ask the assistant..."
                        class="min-h-[38px] w-full resize-none rounded-md border bg-background px-3 py-2 text-xs"
                        @keydown.enter.exact.prevent="sendMessage"
                    />
                    <Button size="icon" :disabled="!canSend">
                        <SendIcon />
                    </Button>
                </div>
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger as-child>
                            <label class="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                                <input
                                    v-model="autoApproved"
                                    type="checkbox"
                                    class="h-3 w-3 rounded border border-muted-foreground"
                                />
                                Auto Approved
                            </label>
                        </TooltipTrigger>
                        <TooltipContent
                            side="right"
                            :side-offset="6"
                            class="max-w-[220px] text-xs"
                        >
                            Auto Approved를 켜면 승인 버튼이 자동으로 순서대로 수행됩니다.
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
                <div
                    v-if="!settings.baseUrl || !settings.model"
                    class="mt-2 text-[11px] text-muted-foreground"
                >
                    Configure the base URL and model to enable requests.
                </div>
            </form>
        </Card>
    </div>

    <Button
        v-if="!showPanel"
        size="icon-lg"
        class="fixed z-50 rounded-full shadow-lg"
        :class="'bottom-6 right-6'"
        @click="openPanel"
    >
        <MessageCircleIcon />
    </Button>

    <div
        v-if="showActionFx"
        :key="actionFxKey"
        class="ai-action-overlay"
        aria-hidden="true"
    >
        <div class="ai-action-sweep"></div>
    </div>
</template>

<style scoped>
.ai-action-overlay {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 60;
    overflow: hidden;
}

.ai-action-sweep {
    position: absolute;
    inset: -30%;
    background: linear-gradient(
        45deg,
        rgba(59, 130, 246, 0.2),
        rgba(59, 130, 246, 0)
    );
    animation: ai-action-sweep 500ms ease-out forwards;
    transform: translate(-30%, 30%);
}

@keyframes ai-action-sweep {
    0% {
        opacity: 0.2;
        transform: translate(-30%, 30%);
    }
    100% {
        opacity: 0;
        transform: translate(30%, -30%);
    }
}
</style>
