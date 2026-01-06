<script setup>
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { LazyStore } from "@tauri-apps/plugin-store";
import {
    MessageCircleIcon,
    SendIcon,
    SettingsIcon,
    Trash2Icon,
    XIcon,
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import SelectItem from "@/components/ui/select/SelectItem.vue";
import { useSerialStore } from "@/stores/serial";
import { useControlStore } from "@/stores/control";

const props = defineProps({
    activeTab: {
        type: String,
        required: true,
    },
});

const emit = defineEmits(["update:activeTab"]);

const serialStore = useSerialStore();
const controlStore = useControlStore();

const isOpen = ref(false);
const showSettings = ref(false);
const isSending = ref(false);
const input = ref("");
const messages = ref([]);
const scrollRef = ref(null);

const settingsStore = new LazyStore("llm_settings.json");
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
});

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
        default:
            return action.type;
    }
}

async function runAction(action) {
    if (!action || action.status === "running") return;

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
                if (typeof action.address === "number") {
                    controlStore.registerAddress = action.address;
                }
                if (typeof action.value === "number") {
                    await controlStore.setRegisterValue(action.value);
                }
                break;
            default:
                break;
        }
        action.status = "done";
    } catch (error) {
        action.status = "error";
        action.error = error.toString();
    }
}
</script>

<template>
    <div class="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        <Card
            v-if="isOpen"
            class="w-[360px] max-w-[92vw] overflow-hidden shadow-xl"
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
                        :disabled="!messages.length"
                        @click="clearMessages"
                    >
                        <Trash2Icon />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        @click="isOpen = false"
                    >
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
                class="max-h-[360px] overflow-y-auto px-4 py-3 space-y-3"
                ref="scrollRef"
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
                <div
                    v-if="!settings.baseUrl || !settings.model"
                    class="mt-2 text-[11px] text-muted-foreground"
                >
                    Configure the base URL and model to enable requests.
                </div>
            </form>
        </Card>

        <Button
            size="icon-lg"
            class="rounded-full shadow-lg"
            @click="isOpen = !isOpen"
        >
            <MessageCircleIcon />
        </Button>
    </div>
</template>
