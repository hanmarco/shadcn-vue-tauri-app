According to a document from 2025-12-29, SC4415 통신은 “모드 선택(RFFE/SPI/I3C) + VIO 설정 + (즉시 실행 또는 버퍼/트리거 기반 실행) + Data Queue에서 결과 수거(read)”로 구성된다. 모드 변경은 Data/Command Queue를 초기화하고 VIO를 외부(0)로 되돌리며, 트리거를 해제하고 즉시 모드로 복귀시킨다.

---

## 0) 공통 개념: Queue / Immediate / Buffered / Data Queue

### A. Queue 속성

* 각 명령은 “Queue Yes/No” 속성을 가진다.

  * Queue Yes: Buffer Mode에서 Command Queue에 적재 가능
  * Queue No: 즉시 실행 성격(상태/설정/조회 등)

### B. Data Queue (수신 데이터 버퍼)

* “읽기(read) 성격의 명령”은 결과 데이터를 Data Queue에 저장한다.
* 앱은 `read` 명령으로 Data Queue에서 바이트를 꺼내 파싱한다.

**Data Queue 수거 명령 구조**

```text
read [<NUM> [<FORMAT>]]
```

* `<NUM>`: 반환할 바이트 수 (1–4096). 요청 수가 가용량보다 크면 “가용한 전부” 반환.
* `<FORMAT>`:

  * `1` = Stream Format(연속 바이트 스트림, 앱 파싱에 적합)
  * `2` = User Format(기본, 테이블/패리티 표시)

### C. Buffered Mode + Trigger(대량 실행)

버퍼 실행은 “명령 적재 → 트리거 입력 → 큐 실행 → Data Queue 수거” 순서다.

**1) Buffer Mode 진입**

```text
buffer <SELECT>
```

* `<SELECT>`: `1`=Primary Queue, `2`=Secondary Queue
* 버퍼 모드에서는 선택된 Command Queue에 다수 명령을 적재해두고 트리거로 일괄 실행한다.

**2) 트리거 설정/실행**

```text
trigger_in <SOURCE> [<REPEAT>]
```

* `<SOURCE>`:

  * `1`=Software Trigger(기본): Primary → Secondary 순으로 실행
  * `2`=Hardware Trigger: Trigger Input 핀의 에지에 따라 실행

    * Positive Edge=Primary, Negative Edge=Secondary
* `<REPEAT>`:

  * `1`=Enabled: 큐 내용 유지(다중 트리거 반복 실행). `clear`로 해제.
  * Software Trigger에서 repeat를 쓴 경우, “명령은 다음 트리거 명령(예: `trigger_in 1`)이 들어오기 전까지 실행되지 않음”

**3) 트리거 출력(선택)**

```text
trigger_out
```

* 수동 1-shot pulse를 출력하며 자동 트리거 모드를 비활성화할 수 있음. 복구는 `clear`.

**4) 버퍼 중단/복귀**

```text
clear
```

* Buffer Mode 종료, pending trigger abort.

### D. 상태 폴링(필수)

```text
status
```

* Busy(명령 처리 중/트리거 대기 중), System Error, Data Queue Bytes, Command Queue 공간 등을 제공한다.

---

## 1) 초기화 시퀀스(모든 앱의 공통 “세션 시작”)

### 1. 연결 직후(기본 조회)

```text
version
license
status
```

* `version`: 시스템 정보(시리얼/버전).
* `license`: 활성 기능 조회.
* `status`: Busy/Queue 상태 확인.

### 2. 모드 선택(필수)

```text
mode <SELECT>
```

* `<SELECT>`:

  * `1`=RFFE
  * `2`=SPI
  * `3`=I3C
* 모드 변경 시 내부적으로: Data/Command Queue clear, VIO=0(external), 트리거 해제, Immediate Mode로 설정된다.

### 3. VIO 설정(필수)

```text
vio <SELECT>
```

* 모드별 허용 전압:

  * `0`=External VIO Reference (RFFE/SPI/I3C 모두 가능)
  * `1`=Internal 1.2V (RFFE/SPI/I3C)
  * `2`=Internal 1.8V (RFFE/SPI/I3C)
  * `3`=Internal 2.5V (SPI만)
  * `4`=Internal 3.3V (SPI/I3C)

---

## 2) RFFE 통신(Mode 1)

### A. RFFE 기본 설정 시퀀스

1. `mode 1`
2. `vio <0|1|2>` (RFFE는 2.5V/3.3V 내부 설정 불가)
3. 클럭/응답 옵션

```text
clock <FREQ>
hsdr <ENABLE>
```

* `clock`: SCLK(kHz) 100–60000, 기본 26000kHz.
* `hsdr`: 슬레이브 응답 구간에서 클럭 반속(0=Disable, 1=Enable).

### B. RFFE Read 시퀀스(단발)

1. 읽기 명령 실행(아래 중 택1)
2. `read`로 Data Queue에서 결과 수거

#### 1) Register Read

```text
rr <SA> <ADDR>
```

* `<SA>`: 0–15
* `<ADDR>`: 0x00–0x1F
* 반환 데이터는 Data Queue에 저장 → `read`로 수거.

#### 2) Extended Register Read

```text
err <SA> <BC> <ADDR>
```

* `<SA>`: 0–15
* `<BC>`: 0–15 (0이면 1바이트)
* `<ADDR>`: 0x00–0x1F
* 결과는 `read`로 수거.

#### 3) Extended Register Read Long

```text
erl <SA> <BC> <ADDR_H> <ADDR_L>
```

* `<SA>`: 0–15
* `<BC>`: 0–7 (0이면 1바이트)
* `<ADDR_H>/<ADDR_L>`: 0x00–0xFF
* 결과는 `read`로 수거.

### C. RFFE Write 시퀀스(단발)

#### 1) Register Zero Write

```text
rzw <SA> <DATA>
```

* `<DATA>`: 0x00–0x7F (7-bit)

#### 2) Register Write

```text
rw <SA> <ADDR> <DATA>
```

* `<ADDR>`: 0x00–0x1F
* `<DATA>`: 0x00–0xFF

#### 3) Extended Register Write

```text
erw <SA> <BC> <ADDR> <DATA1> … [<DATAn>]
```

* `<BC>`: 0–15 (0이면 1바이트)
* `<ADDR>`: 0x00–0xFF
* 데이터 개수는 BC 규칙에 맞게 구성.

### D. RFFE 대량 실행(Buffered + Trigger)

* `buffer <1|2>`로 큐 선택 → Queue Yes 명령(`rr/err/erl/rzw/rw/erw`)을 여러 개 전송해 큐에 적재 → `trigger_in …`로 실행 → 모든 read 결과는 Data Queue에 누적 → `read`로 원하는 바이트 수만큼 반복 수거.

---

## 3) SPI 통신(Mode 2)

### A. SPI 기본 설정 시퀀스(권장 “일괄 설정”)

1. `mode 2`
2. `vio <0|1|2|3|4>` (SPI는 2.5V/3.3V 내부 지원)
3. `clock <FREQ>`
4. `config …` 또는 폭/대기 사이클 개별 설정

#### 1) SPI Clock

```text
clock <FREQ>
```

* kHz, 50–26000, 기본 5000kHz.

#### 2) SPI Full Config(핵심)

```text
config
config <SPI_SELECT> <SEL_POL> <SPI_MODE> <CMD_WIDTH> <ADDR_WIDTH> <WR_WIDTH> <RD_WIDTH> <WAIT_CYCLES>
```

* SPI 인터페이스 전체 구성을 한 번에 설정한다.

#### 3) 폭/대기 사이클(개별 제어에 사용하는 핵심 파라미터)

* Command Word 폭(0=없음, 1–16비트)
* Address Word 폭(0=없음, 1–16비트)
* Write Data 폭

  * 0=없음, 1=1바이트, 2=2바이트, 3=4바이트
* Read Data 폭

  * 0=없음, 1=1바이트, 2=2바이트, 3=4바이트
* Read 전 Wait Cycle(0–255)

### B. SPI Write 시퀀스(단발)

1. (필요 시) 폭/대기 설정 반영
2. `s_write …` 실행

```text
s_write <WORDS> <CMD> <ADDR> <DATA1> … [<DATAn>]
```

* `<WORDS>`: burst 길이. `w_write` 폭에 따라 허용 범위가 달라짐

  * 1바이트: 1–24, 2바이트: 1–12, 4바이트: 1–6
* `<CMD>`: SPI 디바이스 규격에 맞는 커맨드(폭은 `w_command` 설정에 종속)
* `<ADDR>`: 디바이스 규격 주소(폭은 `w_address`에 종속)
* `<DATAn>`: `w_write` 폭에 맞는 데이터, 개수는 WORDS와 동일

### C. SPI Read 시퀀스(단발)

1. (필요 시) 폭/대기 설정 반영
2. `s_read …` 실행 → 결과는 Data Queue에 저장
3. `read`로 수거

```text
s_read <WORDS> <CMD> <ADDR>
```

* `<WORDS>` 범위는 `w_read` 폭에 종속(1바이트 1–24 등)
* 실행 후 결과는 `read`로 수거.

### D. SPI 대량 실행(Buffered + Trigger)

* `buffer`로 큐에 `s_write/s_read`를 다수 적재 → `trigger_in`으로 일괄 실행 → `s_read` 결과는 Data Queue에 누적 → `read(format=1)`로 스트림 수거.

---

## 4) I3C / I2C(Legacy) 통신(Mode 3)

I3C는 “Bus Definition 구성(add/remove/view) + init으로 버스 초기화 + (SDR/HDR/CCC/IBI/Legacy) 트랜잭션 수행”이 기본이며, 버스 사용 전 정의/초기화가 요구된다.

### A. I3C 기본 설정 시퀀스(버스 준비)

1. `mode 3`
2. `vio <0|1|2|4>` (I3C는 2.5V 내부 불가)
3. 클럭/풀업/에러메시지 정책

```text
clkset <I3C_RATE> <I2C_RATE>
pullup <VALUE>
err_msg <ENABLE>
```

* `clkset`: I3C/I2C 각각의 속도 인덱스 설정(최대 12.5MHz 선택지 포함).
* `pullup`: 내부 풀업 저항값(500–4500Ω) 또는 0=Disable. 변경 시 버스는 uninitialized 된다.
* `err_msg`: 버스 에러 메시지 출력 On/Off(기본 Enable).

4. Bus Definition 구성

```text
add <TYPE=’1’> <STATIC>
add <TYPE=’2’> [<STATIC>]
view
remove ‘ALL’ | <INDEX>
```

* `add`: I2C 슬레이브(TYPE=1)는 Static Address 필수, I3C(TYPE=2)는 optional.
* `view`: Bus Definition 테이블 표시, Index는 add 순서 기반이며 init 이후 Dynamic Address가 할당된다.
* `remove`: 개별 또는 전체 삭제. 표준 I2C/I3C 삭제 시 버스 uninitialized(Hot-Join 효과적으로 제거).

5. 버스 초기화

```text
init
```

* 현재 Bus Definition으로 버스를 Initialize/Reinitialize 한다.
* init 트리거는 “버스 정의 완료 후 init 호출”로 발생한다.

### B. 주소/Hot-Join/CCC 기본 제어(운영 시퀀스)

#### 1) Dynamic Address 변경(SETNEWDA)

```text
new_da <INDEX> <NEW_DA>
```

* init 이후 CCC SETNEWDA로 DA를 갱신.

#### 2) Hot-Join 허용/차단

```text
hot_join <ENABLE>
```

* 0=Disable(기본), 1=Enable. Disable 시 Hot-Join 요청은 NACK.

#### 3) CCC Write (Broadcast/Direct)

```text
ccc_write <INDEX> <CCC> <BC> <DATA1> ... [<DATAn>]
```

* `<INDEX>`: 0이면 Broadcast, 1..N이면 Direct
* `<CCC>`: ENEC/DISEC/SETMWL/SETMRL/ENTTM 등이 정의됨(B/D 가능 여부 표기)
* `<BC>`: 0–128

#### 4) Vendor CCC Read/Write (필요 시)

* Vendor Read 예:

```text
vendor_read <INDEX> <VSCCC> <BC>
```

* `<VSCCC>`: 0xE0–0xFE, `<BC>`: 1–128, 결과는 `read`로 수거.

#### 5) IBI 데이터 수거

```text
ibi_read <INDEX>
```

* 마지막 IBI의 데이터 요청, 결과는 `read`로 수거.

### C. Legacy I2C 트랜잭션(버스 초기화 전/정적주소 기반)

#### 1) Legacy Write

```text
legacy_write <INDEX> <CMB> <BC> <DATA1> ... [<DATAn>]
```

* Legacy 명령은 I2C 또는 I3C 타입에 발행 가능.
* 단, I3C 디바이스는 “Static Address 보유 + Bus Initialization 이전”에서만 legacy 유효.
* `<CMB>`: 1이면 다음 legacy read/write와 [Sr] Repeated Start로 결합(Buffered Mode에서 유효).

#### 2) Legacy Read

* 문서 스니펫에 `legacy_read`의 synopsis 줄이 `legacy_write …`로 표기되어 있으나, 섹션/설명은 Legacy Read 동작(읽기)이며 결과는 `read`로 수거한다.

### D. I3C SDR 트랜잭션(버스 초기화 후)

#### 1) SDR Write

```text
sdr_write <INDEX> <CMB> <BC> <DATA1> ... [<DATAn>]
```

* I3C device type에만 유효, direct/broadcast 모두 지원.
* `<CMB>`: 1이면 다음 `sdr_write/sdr_read`와 [Sr]로 결합(Buffered Mode에서 유효).

#### 2) SDR Read

```text
sdr_read <INDEX> <CMB> <BC>
```

* 결과는 `read`로 수거.

#### 3) SDR Reserved Byte(7’h7E) 사용 여부

```text
sdr_rsvd <ENABLE>
```

* 1=Enable(default), 0=Disable.

### E. I3C HDR-DDR 트랜잭션(버스 초기화 후)

HDR-DDR은 “Combined Message”가 버퍼 모드에서만 유효하다는 점이 핵심이다.

#### 1) DDR Write

```text
ddr_write <INDEX> <CMB> <CMD> <WC> <DATA1> ... [<DATAn>]
```

* `<CMB>`: 1이면 다음 `ddr_write/ddr_read`와 HDR Restart로 결합(Buffered Mode에서만 유효).
* `<CMD>`: 0x00–0x7F
* `<WC>`: 0–64 (2바이트 워드 개수)
* 데이터 워드는 0x0000–0xFFFF, 개수는 WC와 동일.

#### 2) DDR Read

```text
ddr_read <INDEX> <CMB> <CMD> <WC>
```

* `<CMD>`: 0x80–0xFF
* `<WC>`: 1–64, 결과는 `read`로 수거.

---

## 5) 앱 구현에 필요한 “행동 시퀀스” 템플릿

### 템플릿 1: 단발 Read (RFFE/SPI/I3C 공통)

1. `mode …` (필요 시)
2. `vio …` (필요 시)
3. (필요 시) bus/clock/config 세팅
4. 실제 read 명령(예: `rr` / `s_read` / `sdr_read` / `ddr_read` / `vendor_read` / `ibi_read`)
5. `read <NUM> 1` 로 스트림 수거(권장)

### 템플릿 2: 대량 실행(정밀 타이밍/동시성 필요)

1. `buffer <1|2>`
2. Queue Yes 명령들을 원하는 순서대로 전송(장비가 큐에 적재)
3. `trigger_in <1|2> [1]`

   * 소프트웨어 일괄 실행이면 `trigger_in 1`
   * 하드웨어 에지 분기 실행이면 `trigger_in 2`
   * 반복 트리거가 필요하면 `trigger_in … 1`
4. `status`로 Busy/Queue bytes 확인
5. `read` 반복 호출로 Data Queue 배출
6. 종료 시 `clear`로 즉시 모드 복귀/트리거 해제

---
