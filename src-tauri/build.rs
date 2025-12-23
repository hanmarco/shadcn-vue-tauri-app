use std::env;
use std::fs;
use std::path::PathBuf;

fn main() {
    let target = env::var("TARGET").unwrap();
    let out_dir = PathBuf::from(env::var("OUT_DIR").unwrap());

    // ftd2xx.dll 복사 로직
    // src-tauri 폴더에 있는 dll을 찾아 target 폴더로 복사 시도
    let dll_name = "ftd2xx.dll";
    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap());
    let dll_path = manifest_dir.join(dll_name);

    // 만약 resources 폴더로 옮겼다면 그 경로도 확인
    let dll_path = if dll_path.exists() {
        dll_path
    } else {
        manifest_dir.join("resources").join(dll_name)
    };

    if dll_path.exists() {
        // target/.../debug 디렉토리를 찾기 위해 OUT_DIR에서 상위로 이동
        // 보통 OUT_DIR은 target/i686-pc-windows-msvc/debug/build/... 형태임
        let mut dest_path = out_dir.clone();
        for _ in 0..3 {
            dest_path.pop();
        }
        let dest_path = dest_path.join(dll_name);

        println!("cargo:rerun-if-changed={}", dll_path.display());
        let _ = fs::copy(&dll_path, &dest_path);
        println!(
            "cargo:warning=Copied {} to {}",
            dll_name,
            dest_path.display()
        );
    } else {
        println!(
            "cargo:warning=Could not find {} in {:?}",
            dll_name, manifest_dir
        );
    }

    tauri_build::build()
}
