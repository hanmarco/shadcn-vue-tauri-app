use serialport::{SerialPort, SerialPortType};
use std::fs::File;
use std::io::Write;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

// 시리얼 포트 상태 관리
struct SerialState {
    port: Option<Arc<Mutex<Box<dyn SerialPort>>>>,
    reader_thread: Option<thread::JoinHandle<()>>,
}

impl SerialState {
    fn new() -> Self {
        Self {
            port: None,
            reader_thread: None,
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

            // 포트가 실제로 열 수 있는지 빠르게 테스트
            let test_builder =
                serialport::new(&port_info.port_name, 9600).timeout(Duration::from_millis(100));

            // 포트 열기 테스트 (타임아웃 짧게 설정)
            match test_builder.open() {
                Ok(_) => {
                    // 포트를 열 수 있으면 리스트에 추가
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
                Err(_) => {
                    // 포트를 열 수 없으면 스킵 (에러 무시)
                    continue;
                }
            }
        }
    }

    available_ports
}

#[tauri::command]
fn connect_serial(
    port_name: String,
    baud_rate: u32,
    parity: String,
    stop_bits: u8,
    data_bits: u8,
    state: tauri::State<AppState>,
    app: AppHandle,
) -> Result<(), String> {
    let mut serial_state = state.serial.lock().map_err(|e| e.to_string())?;

    // 이미 연결되어 있으면 해제
    if serial_state.port.is_some() {
        serial_state.port = None;
        if let Some(handle) = serial_state.reader_thread.take() {
            let _ = handle.join();
        }
    }

    // Parity 설정
    let parity_setting = match parity.as_str() {
        "even" => serialport::Parity::Even,
        "odd" => serialport::Parity::Odd,
        _ => serialport::Parity::None,
    };

    // Stop bits 설정
    let stop_bits_setting = match stop_bits {
        2 => serialport::StopBits::Two,
        _ => serialport::StopBits::One,
    };

    // Data bits 설정
    let data_bits_setting = match data_bits {
        5 => serialport::DataBits::Five,
        6 => serialport::DataBits::Six,
        7 => serialport::DataBits::Seven,
        _ => serialport::DataBits::Eight,
    };

    // 시리얼 포트 열기 (타임아웃 설정)
    // 연결 시도를 별도 스레드에서 실행하여 블로킹 방지
    let port_name_clone = port_name.clone();
    let parity_setting_clone = parity_setting;
    let stop_bits_setting_clone = stop_bits_setting;
    let data_bits_setting_clone = data_bits_setting;
    let (tx, rx) = std::sync::mpsc::channel();

    thread::spawn(move || {
        let builder = serialport::new(&port_name_clone, baud_rate)
            .parity(parity_setting_clone)
            .stop_bits(stop_bits_setting_clone)
            .data_bits(data_bits_setting_clone)
            .timeout(Duration::from_millis(1000));

        match builder.open() {
            Ok(port) => {
                let _ = tx.send(Ok(port));
            }
            Err(e) => {
                let _ = tx.send(Err(format!(
                    "Failed to open serial port {}: {}",
                    port_name_clone, e
                )));
            }
        }
    });

    // 최대 2초 대기
    match rx.recv_timeout(Duration::from_secs(2)) {
        Ok(Ok(port)) => {
            let port_arc = Arc::new(Mutex::new(port));
            serial_state.port = Some(port_arc.clone());

            // 백그라운드에서 데이터 읽기 시작
            let app_clone = app.clone();
            let port_clone = port_arc.clone();
            let handle = thread::spawn(move || {
                let mut buffer = vec![0u8; 1024];
                loop {
                    let mut port_guard = match port_clone.lock() {
                        Ok(guard) => guard,
                        Err(_) => break,
                    };

                    match port_guard.read(&mut buffer) {
                        Ok(bytes_read) if bytes_read > 0 => {
                            let data = String::from_utf8_lossy(&buffer[..bytes_read]);
                            let _ = app_clone.emit("serial-data-received", data.to_string());
                        }
                        Ok(_) => {}
                        Err(ref e) if e.kind() == std::io::ErrorKind::TimedOut => {
                            // 타임아웃은 정상적인 상황
                        }
                        Err(_) => break,
                    }

                    drop(port_guard);
                    thread::sleep(Duration::from_millis(10));
                }
            });

            serial_state.reader_thread = Some(handle);
            Ok(())
        }
        Ok(Err(e)) => Err(e),
        Err(_) => Err(format!(
            "Connection timeout: Failed to open serial port {} within 2 seconds",
            port_name
        )),
    }
}

#[tauri::command]
fn disconnect_serial(state: tauri::State<AppState>) -> Result<(), String> {
    let mut serial_state = state.serial.lock().map_err(|e| e.to_string())?;
    serial_state.port = None;
    if let Some(handle) = serial_state.reader_thread.take() {
        let _ = handle.join();
    }
    Ok(())
}

#[tauri::command]
fn send_serial_data(data: String, state: tauri::State<AppState>) -> Result<(), String> {
    let serial_state = state.serial.lock().map_err(|e| e.to_string())?;

    if let Some(ref port_arc) = serial_state.port {
        let mut port = port_arc.lock().map_err(|e| e.to_string())?;
        port.write(data.as_bytes())
            .map_err(|e| format!("Failed to write data: {}", e))?;
        Ok(())
    } else {
        Err("Serial port is not connected".to_string())
    }
}

#[tauri::command]
async fn set_voltage(state: tauri::State<'_, AppState>, value: f64) -> Result<(), String> {
    let serial_state = state.serial.lock().map_err(|e| e.to_string())?;
    if let Some(ref port_arc) = serial_state.port {
        let mut port = port_arc.lock().map_err(|e| e.to_string())?;
        let cmd = format!("VOLT:{:.2}\n", value);
        port.write_all(cmd.as_bytes()).map_err(|e| e.to_string())?;
        port.flush().map_err(|e| e.to_string())?;
        println!("Sent command: {}", cmd.trim());
        Ok(())
    } else {
        Err("Serial port is not connected".into())
    }
}

#[tauri::command]
async fn set_frequency(state: tauri::State<'_, AppState>, value: u64) -> Result<(), String> {
    let serial_state = state.serial.lock().map_err(|e| e.to_string())?;
    if let Some(ref port_arc) = serial_state.port {
        let mut port = port_arc.lock().map_err(|e| e.to_string())?;
        let cmd = format!("FREQ:{}\n", value);
        port.write_all(cmd.as_bytes()).map_err(|e| e.to_string())?;
        port.flush().map_err(|e| e.to_string())?;
        println!("Sent command: {}", cmd.trim());
        Ok(())
    } else {
        Err("Serial port is not connected".into())
    }
}

#[tauri::command]
async fn set_register(state: tauri::State<'_, AppState>, value: u32) -> Result<(), String> {
    let serial_state = state.serial.lock().map_err(|e| e.to_string())?;
    if let Some(ref port_arc) = serial_state.port {
        let mut port = port_arc.lock().map_err(|e| e.to_string())?;
        let cmd = format!("REG:0x{:08X}\n", value);
        port.write_all(cmd.as_bytes()).map_err(|e| e.to_string())?;
        port.flush().map_err(|e| e.to_string())?;
        println!("Sent command: {}", cmd.trim());
        Ok(())
    } else {
        Err("Serial port is not connected".into())
    }
}

#[tauri::command]
async fn read_register(state: tauri::State<'_, AppState>, address: u32) -> Result<u32, String> {
    let serial_state = state.serial.lock().map_err(|e| e.to_string())?;
    if let Some(ref port_arc) = serial_state.port {
        let mut port = port_arc.lock().map_err(|e| e.to_string())?;
        let cmd = format!("RREG:0x{:02X}\n", address);
        port.write_all(cmd.as_bytes()).map_err(|e| e.to_string())?;
        port.flush().map_err(|e| e.to_string())?;

        // Note: Real implementation would wait for response from IC
        // Here we just return a dummy value or simulate the read
        println!("Sent command: {}", cmd.trim());
        Ok(0) // Dummy response
    } else {
        Err("Serial port is not connected".into())
    }
}

#[tauri::command]
async fn write_register(
    state: tauri::State<'_, AppState>,
    address: u32,
    value: u32,
) -> Result<(), String> {
    let serial_state = state.serial.lock().map_err(|e| e.to_string())?;
    if let Some(ref port_arc) = serial_state.port {
        let mut port = port_arc.lock().map_err(|e| e.to_string())?;
        let cmd = format!("WREG:0x{:02X},0x{:02X}\n", address, value);
        port.write_all(cmd.as_bytes()).map_err(|e| e.to_string())?;
        port.flush().map_err(|e| e.to_string())?;
        println!("Sent command: {}", cmd.trim());
        Ok(())
    } else {
        Err("Serial port is not connected".into())
    }
}

#[tauri::command]
fn save_log_to_file(path: String, content: String) -> Result<(), String> {
    let mut file = File::create(&path).map_err(|e| format!("Failed to create file: {}", e))?;
    file.write_all(content.as_bytes())
        .map_err(|e| format!("Failed to write to file: {}", e))?;
    Ok(())
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
            connect_serial,
            disconnect_serial,
            send_serial_data,
            set_voltage,
            set_frequency,
            set_register,
            read_register,
            write_register,
            save_log_to_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
