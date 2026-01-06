use libftd2xx::FtdiCommon;
use serde::{Deserialize, Serialize};
use serialport::{SerialPort, SerialPortType};
use std::fs::File;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

// 시리얼 포트 상태 관리
// 통신 브릿지: 다양한 하드웨어 인터페이스 추상화
enum CommBridge {
    Serial(Box<dyn SerialPort>),
    Hid(hidapi::HidDevice),
    Ftdi(libftd2xx::Ftdi), // FT2232D/H 공통 핸들
}

// 시리얼 포트 상태 관리
struct SerialState {
    device: Option<Arc<Mutex<CommBridge>>>,
    reader_thread: Option<thread::JoinHandle<()>>,
    stop_signal: Arc<AtomicBool>,
}

impl SerialState {
    fn new() -> Self {
        Self {
            device: None,
            reader_thread: None,
            stop_signal: Arc::new(AtomicBool::new(false)),
        }
    }
}

// 전역 상태
struct AppState {
    serial: Mutex<SerialState>,
}

#[tauri::command]
fn scan_serial_devices() -> Vec<String> {
    let mut available_ports = Vec::new();

    if let Ok(ports) = serialport::available_ports() {
        for port_info in ports {
            // Windows에서 COM1은 일반적으로 시스템 포트이므로 제외
            #[cfg(windows)]
            {
                if port_info.port_name == "COM1" {
                    // USB 포트가 아닌 경우에만 제외
                    if !matches!(port_info.port_type, SerialPortType::UsbPort(_)) {
                        continue;
                    }
                }
            }

            // 포트를 실제로 열어보는 테스트는 성능 저하를 유발하므로 제거하고
            // 가용 포트 정보를 즉시 반환합니다.
            let display_name = match &port_info.port_type {
                SerialPortType::UsbPort(info) => {
                    // FTDI 칩 감지 (VID:0403)
                    if info.vid == 0x0403 {
                        format!(
                            "{} (FTDI VID:{:04X} PID:{:04X})",
                            port_info.port_name, info.vid, info.pid
                        )
                    } else {
                        format!(
                            "{} (VID:{:04X} PID:{:04X})",
                            port_info.port_name, info.vid, info.pid
                        )
                    }
                }
                _ => port_info.port_name.clone(),
            };
            available_ports.push(display_name);
        }
    }

    available_ports
}

#[tauri::command]
fn connect_device(
    device_type: String,
    port_name: Option<String>,
    baud_rate: u32,
    parity: String,
    stop_bits: u8,
    data_bits: u8,
    flow_control: String,
    ftdi_channel: Option<String>,
    ftdi_mode: Option<String>,
    ft260_mode: Option<String>,
    ft260_i2c_speed: Option<u32>,
    state: tauri::State<AppState>,
    app: AppHandle,
) -> Result<(), String> {
    let mut serial_state = state.serial.lock().map_err(|e| e.to_string())?;

    // 이미 연결되어 있으면 해제
    if serial_state.device.is_some() {
        serial_state.stop_signal.store(true, Ordering::SeqCst);
        serial_state.device = None;
        if let Some(handle) = serial_state.reader_thread.take() {
            let _ = handle.join();
        }
    }

    println!(
        "Connecting to {} (Port: {:?}, Baud: {}, Parity: {}, Config: {:?}/{:?}/{:?}/{:?})",
        device_type,
        port_name,
        baud_rate,
        parity,
        ftdi_channel,
        ftdi_mode,
        ft260_mode,
        ft260_i2c_speed
    );

    let device = match device_type.as_str() {
        "serialport" => {
            let name = port_name.ok_or("Port name is required for serial mode")?;
            let actual_name = if name.contains(" (") {
                name.split(" (").next().unwrap_or(&name)
            } else {
                &name
            };

            // Parity, Stop bits, Data bits 설정 (기존 로직 유지)
            let parity_setting = match parity.as_str() {
                "even" => serialport::Parity::Even,
                "odd" => serialport::Parity::Odd,
                _ => serialport::Parity::None,
            };
            let stop_bits_setting = if stop_bits == 2 {
                serialport::StopBits::Two
            } else {
                serialport::StopBits::One
            };
            let data_bits_setting = match data_bits {
                5 => serialport::DataBits::Five,
                6 => serialport::DataBits::Six,
                7 => serialport::DataBits::Seven,
                _ => serialport::DataBits::Eight,
            };
            let flow_control_setting = match flow_control.as_str() {
                "hardware" => serialport::FlowControl::Hardware,
                "software" => serialport::FlowControl::Software,
                _ => serialport::FlowControl::None,
            };

            let port = serialport::new(actual_name, baud_rate)
                .parity(parity_setting)
                .stop_bits(stop_bits_setting)
                .data_bits(data_bits_setting)
                .flow_control(flow_control_setting)
                .timeout(Duration::from_millis(100))
                .open()
                .map_err(|e| format!("Failed to open serial port: {}", e))?;

            CommBridge::Serial(port)
        }
        "ft260" => {
            let api = hidapi::HidApi::new().map_err(|e| e.to_string())?;
            // FT260 VID:0403, PID:6030
            let device = api
                .open(0x0403, 0x6030)
                .map_err(|e| format!("Failed to open FT260: {}", e))?;
            CommBridge::Hid(device)
        }
        "ft2232d" | "ft2232h" => {
            let channel_name = ftdi_channel.as_deref().unwrap_or("A");
            let channel_idx = if channel_name == "B" { 1 } else { 0 };

            let device = libftd2xx::Ftdi::with_index(channel_idx as i32)
                .map_err(|e| format!("Failed to open FTDI Channel {}: {:?}", channel_name, e))?;

            CommBridge::Ftdi(device)
        }
        _ => return Err(format!("Unsupported device type: {}", device_type)),
    };

    let device_arc = Arc::new(Mutex::new(device));
    serial_state.device = Some(device_arc.clone());

    // 백그라운드 리더 스레드
    let app_clone = app.clone();
    let device_clone = device_arc.clone();
    let stop_signal_clone = serial_state.stop_signal.clone();

    let handle = thread::spawn(move || {
        let mut buffer = vec![0u8; 1024];
        loop {
            if stop_signal_clone.load(Ordering::SeqCst) {
                break;
            }

            let mut device_guard = match device_clone.lock() {
                Ok(guard) => guard,
                Err(_) => break,
            };

            match &mut *device_guard {
                CommBridge::Serial(port) => match port.read(&mut buffer) {
                    Ok(bytes_read) if bytes_read > 0 => {
                        let data = String::from_utf8_lossy(&buffer[..bytes_read]);
                        let _ = app_clone.emit("serial-data-received", data.to_string());
                    }
                    _ => {}
                },
                CommBridge::Hid(hid_dev) => {
                    // HID 리포트 읽기
                    match hid_dev.read_timeout(&mut buffer, 100) {
                        Ok(bytes_read) if bytes_read > 0 => {
                            let data = hex::encode(&buffer[..bytes_read]); // 바이너리 앱의 경우 헥사 표시 선호
                            let _ =
                                app_clone.emit("serial-data-received", format!("[HID] {}", data));
                        }
                        _ => {}
                    }
                }
                CommBridge::Ftdi(ftdi_dev) => {
                    // FTDI D2XX 읽기
                    match ftdi_dev.read(&mut buffer) {
                        Ok(bytes_read) if bytes_read > 0 => {
                            let data = String::from_utf8_lossy(&buffer[..bytes_read]);
                            let _ = app_clone.emit("serial-data-received", data.to_string());
                        }
                        _ => {}
                    }
                }
            }
            drop(device_guard);
            thread::sleep(Duration::from_millis(10));
        }
    });

    serial_state.reader_thread = Some(handle);
    Ok(())
}

#[tauri::command]
fn disconnect_serial(state: tauri::State<AppState>) -> Result<(), String> {
    let mut serial_state = state.serial.lock().map_err(|e| e.to_string())?;

    serial_state.stop_signal.store(true, Ordering::SeqCst);
    serial_state.device = None;

    if let Some(handle) = serial_state.reader_thread.take() {
        let _ = handle.join();
    }
    Ok(())
}

#[tauri::command]
fn send_serial_data(data: String, state: tauri::State<AppState>) -> Result<(), String> {
    let serial_state = state.serial.lock().map_err(|e| e.to_string())?;

    if let Some(ref device_arc) = serial_state.device {
        let mut device = device_arc.lock().map_err(|e| e.to_string())?;
        match &mut *device {
            CommBridge::Serial(port) => {
                port.write(data.as_bytes())
                    .map_err(|e| format!("Failed to write to serial: {}", e))?;
            }
            CommBridge::Hid(hid_dev) => {
                // HID 전송 (일반적으로 Report ID 0 사용 또는 상황에 맞게 조정)
                let mut buf = vec![0u8; data.len() + 1];
                buf[1..].copy_from_slice(data.as_bytes());
                hid_dev
                    .write(&buf)
                    .map_err(|e| format!("Failed to write to HID: {}", e))?;
            }
            CommBridge::Ftdi(ftdi_dev) => {
                ftdi_dev
                    .write(data.as_bytes())
                    .map_err(|e| format!("Failed to write to FTDI: {:?}", e))?;
            }
        }
        Ok(())
    } else {
        Err("Device is not connected".to_string())
    }
}

#[tauri::command]
async fn set_voltage(state: tauri::State<'_, AppState>, value: f64) -> Result<(), String> {
    let serial_state = state.serial.lock().map_err(|e| e.to_string())?;
    if let Some(ref device_arc) = serial_state.device {
        let mut device = device_arc.lock().map_err(|e| e.to_string())?;
        let cmd = format!("VOLT:{:.2}\n", value);

        match &mut *device {
            CommBridge::Serial(port) => {
                port.write_all(cmd.as_bytes()).map_err(|e| e.to_string())?;
                port.flush().map_err(|e| e.to_string())?;
            }
            CommBridge::Hid(hid_dev) => {
                let mut buf = vec![0u8; cmd.len() + 1];
                buf[1..].copy_from_slice(cmd.as_bytes());
                hid_dev.write(&buf).map_err(|e| e.to_string())?;
            }
            CommBridge::Ftdi(ftdi_dev) => {
                ftdi_dev
                    .write(cmd.as_bytes())
                    .map_err(|e| format!("{:?}", e))?;
            }
        }
        Ok(())
    } else {
        Err("Device is not connected".into())
    }
}

#[tauri::command]
async fn set_frequency(state: tauri::State<'_, AppState>, value: u64) -> Result<(), String> {
    let serial_state = state.serial.lock().map_err(|e| e.to_string())?;
    if let Some(ref device_arc) = serial_state.device {
        let mut device = device_arc.lock().map_err(|e| e.to_string())?;
        let cmd = format!("FREQ:{}\n", value);
        match &mut *device {
            CommBridge::Serial(port) => {
                port.write_all(cmd.as_bytes()).map_err(|e| e.to_string())?;
                port.flush().map_err(|e| e.to_string())?;
            }
            CommBridge::Hid(hid_dev) => {
                let mut buf = vec![0u8; cmd.len() + 1];
                buf[1..].copy_from_slice(cmd.as_bytes());
                hid_dev.write(&buf).map_err(|e| e.to_string())?;
            }
            CommBridge::Ftdi(ftdi_dev) => {
                ftdi_dev
                    .write(cmd.as_bytes())
                    .map_err(|e| format!("{:?}", e))?;
            }
        }
        Ok(())
    } else {
        Err("Device is not connected".into())
    }
}

#[tauri::command]
async fn set_register(state: tauri::State<'_, AppState>, value: u32) -> Result<(), String> {
    let serial_state = state.serial.lock().map_err(|e| e.to_string())?;
    if let Some(ref device_arc) = serial_state.device {
        let mut device = device_arc.lock().map_err(|e| e.to_string())?;
        let cmd = format!("REG:0x{:08X}\n", value);
        match &mut *device {
            CommBridge::Serial(port) => {
                port.write_all(cmd.as_bytes()).map_err(|e| e.to_string())?;
                port.flush().map_err(|e| e.to_string())?;
            }
            CommBridge::Hid(hid_dev) => {
                let mut buf = vec![0u8; cmd.len() + 1];
                buf[1..].copy_from_slice(cmd.as_bytes());
                hid_dev.write(&buf).map_err(|e| e.to_string())?;
            }
            CommBridge::Ftdi(ftdi_dev) => {
                ftdi_dev
                    .write(cmd.as_bytes())
                    .map_err(|e| format!("{:?}", e))?;
            }
        }
        Ok(())
    } else {
        Err("Device is not connected".into())
    }
}

#[tauri::command]
async fn read_register(state: tauri::State<'_, AppState>, address: u32) -> Result<u32, String> {
    let serial_state = state.serial.lock().map_err(|e| e.to_string())?;
    if let Some(ref device_arc) = serial_state.device {
        let mut device = device_arc.lock().map_err(|e| e.to_string())?;
        let cmd = format!("RREG:0x{:02X}\n", address);
        match &mut *device {
            CommBridge::Serial(port) => {
                port.write_all(cmd.as_bytes()).map_err(|e| e.to_string())?;
                port.flush().map_err(|e| e.to_string())?;
            }
            CommBridge::Hid(hid_dev) => {
                let mut buf = vec![0u8; cmd.len() + 1];
                buf[1..].copy_from_slice(cmd.as_bytes());
                hid_dev.write(&buf).map_err(|e| e.to_string())?;
            }
            CommBridge::Ftdi(ftdi_dev) => {
                ftdi_dev
                    .write(cmd.as_bytes())
                    .map_err(|e| format!("{:?}", e))?;
            }
        }
        Ok(0)
    } else {
        Err("Device is not connected".into())
    }
}

#[tauri::command]
async fn write_register(
    state: tauri::State<'_, AppState>,
    address: u32,
    value: u32,
) -> Result<(), String> {
    let serial_state = state.serial.lock().map_err(|e| e.to_string())?;
    if let Some(ref device_arc) = serial_state.device {
        let mut device = device_arc.lock().map_err(|e| e.to_string())?;
        let cmd = format!("WREG:0x{:02X},0x{:02X}\n", address, value);
        match &mut *device {
            CommBridge::Serial(port) => {
                port.write_all(cmd.as_bytes()).map_err(|e| e.to_string())?;
                port.flush().map_err(|e| e.to_string())?;
            }
            CommBridge::Hid(hid_dev) => {
                let mut buf = vec![0u8; cmd.len() + 1];
                buf[1..].copy_from_slice(cmd.as_bytes());
                hid_dev.write(&buf).map_err(|e| e.to_string())?;
            }
            CommBridge::Ftdi(ftdi_dev) => {
                ftdi_dev
                    .write(cmd.as_bytes())
                    .map_err(|e| format!("{:?}", e))?;
            }
        }
        Ok(())
    } else {
        Err("Device is not connected".into())
    }
}

#[tauri::command]
fn save_log_to_file(path: String, content: String) -> Result<(), String> {
    let mut file = File::create(&path).map_err(|e| format!("Failed to create file: {}", e))?;
    file.write_all(content.as_bytes())
        .map_err(|e| format!("Failed to write to file: {}", e))?;
    Ok(())
}

fn exe_dir() -> Result<PathBuf, String> {
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let dir = exe
        .parent()
        .ok_or_else(|| "Failed to resolve executable directory".to_string())?;
    Ok(dir.to_path_buf())
}

#[tauri::command]
fn load_register_map() -> Result<Option<String>, String> {
    let path = exe_dir()?.join("registers.user.yaml");
    if !path.exists() {
        return Ok(None);
    }
    std::fs::read_to_string(&path)
        .map(Some)
        .map_err(|e| format!("Failed to read register map: {}", e))
}

#[tauri::command]
fn save_register_map(content: String) -> Result<(), String> {
    let path = exe_dir()?.join("registers.user.yaml");
    std::fs::write(&path, content).map_err(|e| format!("Failed to write register map: {}", e))
}

#[derive(Serialize, Deserialize)]
struct ChatMessage {
    role: String,
    content: String,
}

#[derive(Deserialize)]
struct ChatCompletionRequest {
    base_url: String,
    api_key: Option<String>,
    model: String,
    messages: Vec<ChatMessage>,
    temperature: Option<f32>,
    max_tokens: Option<u32>,
}

#[derive(Deserialize)]
struct ChatCompletionResponse {
    choices: Vec<ChatChoice>,
}

#[derive(Deserialize)]
struct ChatChoice {
    message: ChatResponseMessage,
}

#[derive(Deserialize)]
struct ChatResponseMessage {
    content: Option<String>,
}

fn normalize_chat_url(base_url: &str) -> String {
    let trimmed = base_url.trim_end_matches('/');
    if trimmed.contains("/chat/completions") || trimmed.contains("/responses") {
        return trimmed.to_string();
    }
    if trimmed.ends_with("/v1") {
        format!("{}/chat/completions", trimmed)
    } else {
        format!("{}/v1/chat/completions", trimmed)
    }
}

fn normalize_models_url(base_url: &str) -> String {
    let trimmed = base_url.trim_end_matches('/');
    if trimmed.contains("/models") {
        return trimmed.to_string();
    }
    if trimmed.ends_with("/v1") {
        format!("{}/models", trimmed)
    } else {
        format!("{}/v1/models", trimmed)
    }
}

fn model_supports_temperature(model: &str) -> bool {
    let name = model.trim().to_lowercase();
    !(name.starts_with("o1") || name.starts_with("o3"))
}

#[tauri::command]
async fn llm_chat(request: ChatCompletionRequest) -> Result<String, String> {
    let url = normalize_chat_url(&request.base_url);
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(90))
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    let mut body = serde_json::json!({
        "model": request.model,
        "messages": request.messages,
    });
    if let Some(temp) = request.temperature {
        if model_supports_temperature(&request.model) {
            body["temperature"] = serde_json::json!(temp);
        }
    }
    if let Some(max_tokens) = request.max_tokens {
        body["max_completion_tokens"] = serde_json::json!(max_tokens);
    }

    let api_key = request.api_key.and_then(|key| {
        let trimmed = key.trim().to_string();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    });

    let mut response = send_llm_request(&client, &url, &body, api_key.as_deref()).await?;

    if !response.status().is_success() {
        let status = response.status();
        let detail = response.text().await.unwrap_or_default();

        if status.as_u16() == 400 && detail.contains("temperature") {
            let mut retry_body = body.clone();
            if let Some(obj) = retry_body.as_object_mut() {
                obj.remove("temperature");
            }
            response = send_llm_request(&client, &url, &retry_body, api_key.as_deref()).await?;
            if !response.status().is_success() {
                let retry_status = response.status();
                let retry_detail = response.text().await.unwrap_or_default();
                return Err(format!(
                    "LLM request failed ({}): {}",
                    retry_status, retry_detail
                ));
            }
        } else {
            return Err(format!("LLM request failed ({}): {}", status, detail));
        }
    }

    let payload = response
        .json::<ChatCompletionResponse>()
        .await
        .map_err(|e| format!("Failed to parse LLM response: {}", e))?;

    let content = payload
        .choices
        .first()
        .and_then(|choice| choice.message.content.clone())
        .unwrap_or_default();

    Ok(content)
}

#[derive(Deserialize)]
struct ModelListResponse {
    data: Vec<ModelEntry>,
}

#[derive(Deserialize)]
struct ModelEntry {
    id: String,
}

#[tauri::command]
async fn list_llm_models(base_url: String, api_key: Option<String>) -> Result<Vec<String>, String> {
    let url = normalize_models_url(&base_url);
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    let api_key = api_key.and_then(|key| {
        let trimmed = key.trim().to_string();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    });

    let mut request_builder = client.get(url);
    if let Some(key) = api_key.as_deref() {
        request_builder = request_builder.bearer_auth(key);
    }

    let response = request_builder
        .send()
        .await
        .map_err(|e| format!("Model request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let detail = response.text().await.unwrap_or_default();
        return Err(format!("Model request failed ({}): {}", status, detail));
    }

    let payload = response
        .json::<ModelListResponse>()
        .await
        .map_err(|e| format!("Failed to parse model list: {}", e))?;

    let mut models: Vec<String> = payload.data.into_iter().map(|item| item.id).collect();
    models.sort();
    models.dedup();
    Ok(models)
}

async fn send_llm_request(
    client: &reqwest::Client,
    url: &str,
    body: &serde_json::Value,
    api_key: Option<&str>,
) -> Result<reqwest::Response, String> {
    let mut request_builder = client.post(url).json(body);
    if let Some(key) = api_key {
        request_builder = request_builder.bearer_auth(key);
    }
    request_builder
        .send()
        .await
        .map_err(|e| format!("LLM request failed: {}", e))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .manage(AppState {
            serial: Mutex::new(SerialState::new()),
        })
        .invoke_handler(tauri::generate_handler![
            scan_serial_devices,
            connect_device,
            disconnect_serial,
            send_serial_data,
            set_voltage,
            set_frequency,
            set_register,
            read_register,
            write_register,
            save_log_to_file,
            load_register_map,
            save_register_map,
            llm_chat,
            list_llm_models
        ])
        .setup(|app| {
            // DLL 검색 경로에 리소스 디렉토리 추가 (윈도우 전용)
            #[cfg(windows)]
            {
                use std::os::windows::ffi::OsStrExt;
                let resource_dir = app.path().resource_dir().unwrap_or_default();
                let mut path_u16: Vec<u16> = resource_dir.as_os_str().encode_wide().collect();
                path_u16.push(0); // Null terminator

                extern "system" {
                    fn SetDllDirectoryW(lpPathName: *const u16) -> i32;
                }

                unsafe {
                    SetDllDirectoryW(path_u16.as_ptr());
                }
                println!("Resource dir added to DLL search path: {:?}", resource_dir);
            }

            if let Some(window) = app.get_webview_window("main") {
                let package_info = app.package_info();
                let title = format!("IC 제어 앱 v{}", package_info.version);
                let _ = window.set_title(&title);
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
