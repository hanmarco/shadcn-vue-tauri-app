use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use serialport::{SerialPortType, SerialPort};
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
    serialport::available_ports()
        .unwrap_or_default()
        .iter()
        .map(|port_info| {
            match &port_info.port_type {
                SerialPortType::UsbPort(info) => {
                    // FTDI 칩 감지 (VID:0403)
                    if info.vid == 0x0403 {
                        format!(
                            "{} (FTDI VID:{:04X} PID:{:04X})",
                            port_info.port_name,
                            info.vid,
                            info.pid
                        )
                    } else {
                        format!(
                            "{} (VID:{:04X} PID:{:04X})",
                            port_info.port_name,
                            info.vid,
                            info.pid
                        )
                    }
                }
                _ => port_info.port_name.clone(),
            }
        })
        .collect()
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

    // 시리얼 포트 열기
    let builder = serialport::new(&port_name, baud_rate)
        .parity(parity_setting)
        .stop_bits(stop_bits_setting)
        .data_bits(data_bits_setting)
        .timeout(Duration::from_millis(1000));

    match builder.open() {
        Ok(port) => {
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
        Err(e) => Err(format!("Failed to open serial port: {}", e)),
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
fn set_voltage(value: f64) -> Result<(), String> {
    // TODO: 실제 IC 제어 로직 구현
    println!("Setting voltage to: {}V", value);
    Ok(())
}

#[tauri::command]
fn set_frequency(value: u64) -> Result<(), String> {
    // TODO: 실제 IC 제어 로직 구현
    println!("Setting frequency to: {}Hz", value);
    Ok(())
}

#[tauri::command]
fn set_register(value: u32) -> Result<(), String> {
    // TODO: 실제 IC 제어 로직 구현
    println!("Setting register to: 0x{:X}", value);
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
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
            set_register
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
