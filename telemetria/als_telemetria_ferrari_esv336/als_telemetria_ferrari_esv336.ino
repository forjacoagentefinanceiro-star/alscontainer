// ============================================================
//  ALS DEPOT — Telemetria Ferrari ESV 336 (J1939 / Cummins) v4.0
//  Hardware: ESP32 WROOM + MCP2515 (TJA1050), cristal 8 MHz
//  Saída: BLE Nordic UART (mesmos UUIDs do app) — 1 JSON por linha
//
//  LIGAÇÃO ESP32 -> MCP2515
//    GPIO5  -> CS      GPIO18 -> SCK
//    GPIO23 -> SI      GPIO19 -> SO
//    5V     -> VCC     GND    -> GND
//  CONECTOR DEUTSCH 9 pinos: A=GND, B=+24V, C=CAN H, D=CAN L
//  (24V -> LM2596 -> 5V para o ESP32/MCP2515)
//
//  BIBLIOTECA: "mcp_can" de Cory J. Fowler (Gerenciador de Bibliotecas).
//  PLACA: ESP32 Dev Module.  Monitor serial: 115200.
//
//  COMO ELE FUNCIONA
//  1. Autoteste do MCP2515 em loopback (prova que SPI/chip/cristal OK,
//     independente da máquina).
//  2. Escuta o barramento em modo SOMENTE-ESCUTA (não transmite, não
//     dá ACK, não interfere na rede da máquina). Testa 250k e 500k.
//  3. Lista todo PGN que aparece (tabela) — mesmo os que não decodifica.
//  4. Decodifica os PGNs J1939 padrão e envia JSON por BLE a cada 2 s.
//
//  COMANDOS NO MONITOR SERIAL (digite a letra e Enter)
//    d = liga/desliga despejo dos frames brutos
//    p = imprime a tabela de PGNs vistos
//    b = força nova detecção de baud
//    r = zera contadores e tabela
//
//  LEITURA DO DIAGNÓSTICO
//    can_frames = 0 .......... nada chega: fiação, GND, baud ou a porta
//                              não está ligada ao barramento do motor
//    can_std > 0, ext = 0 .... barramento com IDs de 11 bits (não é J1939)
//    frames chegam, RPM nulo . o motor usa outro PGN: veja a tabela (p)
// ============================================================

#include <SPI.h>
#include <mcp_can.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// ---------------- Configuração ----------------
#define PIN_CS   5
#define PIN_SCK  18
#define PIN_MISO 19
#define PIN_MOSI 23

const char* NOME_DISPOSITIVO = "ALS-Ferrari-01";

// Endereço (SA) do motor. 0xFF = aceita de qualquer origem; 0 = só o ECM padrão.
#define SA_MOTOR 0xFF

#define UART_SERVICE_UUID "6e400001-b5a3-f393-e0a9-e50e24dcca9e"
#define UART_TX_CHAR_UUID "6e400003-b5a3-f393-e0a9-e50e24dcca9e"

const unsigned long INTERVALO_JSON_MS  = 2000;
const unsigned long JANELA_DETECCAO_MS = 3000;   // escuta por baud
const unsigned long SEM_FRAME_MS       = 15000;  // sem tráfego -> redetecta
const unsigned long CAN_ATIVO_MS       = 5000;   // "can_ok" se frame há menos disso
const uint8_t       BAUDS[2]           = {CAN_250KBPS, CAN_500KBPS};
const long          BAUD_VALOR[2]      = {250000, 500000};

// ---------------- Estado ----------------
MCP_CAN CAN(PIN_CS);

enum Estado { DETECTANDO, ESCUTANDO };
Estado        estado        = DETECTANDO;
int           tentativa     = 0;      // baud em teste
int           baudAtual     = -1;     // baud travado
unsigned long tInicioJanela = 0;
unsigned long framesInicio  = 0;

unsigned long framesTotal = 0, framesExt = 0, framesStd = 0;
unsigned long ultimoFrame = 0, ultimoEnvio = 0, ultimoResumo = 0;
bool          despejo     = false;
unsigned long ultimoDespejo = 0;

// Valores decodificados; NAN = nunca recebido / não disponível
float rpm = NAN, cargaPct = NAN, torquePct = NAN, pedalPct = NAN;
float horimetroH = NAN, tempC = NAN, tempOleoC = NAN, pressaoKpa = NAN;
float nivelOleoPct = NAN, combustivelPct = NAN, consumoLh = NAN;
float bateriaV = NAN, velocidadeKmh = NAN;
int   lampVermelha = -1, lampAmbar = -1;
char  dtc[40] = "";

// ---------------- Tabela de PGNs vistos ----------------
struct Visto {
  bool          ext;
  uint32_t      chave;       // PGN (ext) ou ID de 11 bits (std)
  uint8_t       sa;
  uint32_t      n;
  unsigned long primeiro;
  uint8_t       len;
  uint8_t       d[8];
};
const int MAX_VISTOS = 64;
Visto vistos[MAX_VISTOS];
int   nVistos = 0;

// ---------------- BLE ----------------
BLEServer*         pServer = nullptr;
BLECharacteristic* pTxChar = nullptr;
volatile bool      clienteConectado = false;

char   txBuf[640];
size_t txLen = 0, txPos = 0;
unsigned long txT = 0;

class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer*) override { clienteConectado = true; }
  void onDisconnect(BLEServer*) override {
    clienteConectado = false;
    txPos = txLen;                  // descarta o que faltava enviar
    BLEDevice::startAdvertising();
  }
};

// ---------------- MCP2515 ----------------
// Prova que SPI, chip e cristal funcionam, sem depender do barramento da máquina.
bool autotesteMCP() {
  if (CAN.begin(MCP_ANY, CAN_250KBPS, MCP_8MHZ) != CAN_OK) return false;
  if (CAN.setMode(MCP_LOOPBACK) != MCP2515_OK) return false;
  byte tx[8] = {0xA5, 0x5A, 1, 2, 3, 4, 5, 6};
  if (CAN.sendMsgBuf(0x18FEF1AA, 1, 8, tx) != CAN_OK) return false;
  unsigned long t0 = millis();
  while (millis() - t0 < 300) {
    if (CAN.checkReceive() == CAN_MSGAVAIL) {
      unsigned long id; byte len; byte rx[8];
      if (CAN.readMsgBuf(&id, &len, rx) != CAN_OK) return false;
      return len == 8 && memcmp(tx, rx, 8) == 0;
    }
  }
  return false;
}

// OBS.: begin() deixa o chip em LOOPBACK; por isso o setMode explícito é obrigatório.
bool iniciaEscuta(int idx) {
  if (CAN.begin(MCP_ANY, BAUDS[idx], MCP_8MHZ) != CAN_OK) return false;
  return CAN.setMode(MCP_LISTENONLY) == MCP2515_OK;
}

void iniciaJanela(int idx) {
  tentativa = idx;
  if (!iniciaEscuta(idx)) Serial.println("[CAN] falha ao iniciar o MCP2515 (SPI/CS/cristal?)");
  else Serial.printf("[CAN] escutando a %ld bps...\n", BAUD_VALOR[idx]);
  tInicioJanela = millis();
  framesInicio  = framesTotal;
}

// ---------------- Decodificação J1939 ----------------
static inline bool ok8(uint8_t b)    { return b < 0xFE; }          // FE=erro, FF=n/d
static inline bool ok16(uint16_t w)  { return w < 0xFB00; }
static inline uint16_t u16(const uint8_t* d, int i) { return d[i] | (d[i + 1] << 8); }

const char* nomePGN(uint32_t pgn) {
  switch (pgn) {
    case 61444: return "EEC1 rotacao/torque";
    case 61443: return "EEC2 pedal/carga";
    case 65262: return "ET1 temperaturas";
    case 65263: return "EFL/P1 oleo/pressoes";
    case 65253: return "HOURS horimetro";
    case 65266: return "LFE consumo";
    case 65276: return "DD painel/combustivel";
    case 65271: return "VEP1 bateria";
    case 65265: return "CCVS velocidade";
    case 65226: return "DM1 falhas ativas";
    case 65227: return "DM2 falhas anteriores";
    case 65269: return "AMB ambiente";
    case 65270: return "IC1 admissao";
    case 65272: return "TRF1 transmissao";
    case 61445: return "ETC2 marcha";
    case 60416: case 60160: return "TP (transporte)";
    case 59904: return "REQUEST";
    case 60928: return "ADDRESS CLAIM";
    default:    return "";
  }
}

void decodifica(uint32_t pgn, uint8_t sa, const uint8_t* d, uint8_t len) {
  if (len < 8) return;
  if (SA_MOTOR != 0xFF && sa != SA_MOTOR) return;

  switch (pgn) {
    case 61444: {  // EEC1: d[2]=torque real (-125%), d[3..4]=rpm (0,125/bit)
      uint16_t raw = u16(d, 3);
      if (ok16(raw)) rpm = raw * 0.125f;
      if (ok8(d[2])) torquePct = (float)d[2] - 125.0f;
      break;
    }
    case 61443:    // EEC2: d[1]=pedal (0,4%/bit), d[2]=carga do motor (1%/bit)
      if (ok8(d[1])) pedalPct = d[1] * 0.4f;
      if (ok8(d[2])) cargaPct = d[2];
      break;
    case 65262: {  // ET1: d[0]=arrefecimento (-40), d[2..3]=óleo (0,03125/bit, -273)
      if (ok8(d[0])) tempC = (float)d[0] - 40.0f;
      uint16_t raw = u16(d, 2);
      if (ok16(raw)) tempOleoC = raw * 0.03125f - 273.0f;
      break;
    }
    case 65263:    // EFL/P1: d[2]=nível óleo (0,4%), d[3]=pressão óleo (4 kPa/bit)
      if (ok8(d[2])) nivelOleoPct = d[2] * 0.4f;
      if (ok8(d[3])) pressaoKpa   = d[3] * 4.0f;
      break;
    case 65253: {  // HOURS: d[0..3] = horas totais do motor (0,05 h/bit)
      uint32_t raw = d[0] | (d[1] << 8) | (d[2] << 16) | ((uint32_t)d[3] << 24);
      if (raw < 0xFB000000UL) horimetroH = raw * 0.05f;
      break;
    }
    case 65266: {  // LFE: d[0..1] = consumo (0,05 L/h por bit)
      uint16_t raw = u16(d, 0);
      if (ok16(raw)) consumoLh = raw * 0.05f;
      break;
    }
    case 65276:    // DD: d[1] = nível de combustível (0,4%/bit)
      if (ok8(d[1])) combustivelPct = d[1] * 0.4f;
      break;
    case 65271: {  // VEP1: d[6..7] = tensão da bateria (0,05 V/bit)
      uint16_t raw = u16(d, 6);
      if (ok16(raw)) bateriaV = raw * 0.05f;
      break;
    }
    case 65265: {  // CCVS: d[1..2] = velocidade (1/256 km/h por bit)
      uint16_t raw = u16(d, 1);
      if (ok16(raw)) velocidadeKmh = raw / 256.0f;
      break;
    }
    case 65226: {  // DM1: d[0] = lâmpadas, DTC1 = SPN (19 bits) + FMI (5 bits)
      lampAmbar    = (d[0] >> 2) & 0x03;
      lampVermelha = (d[0] >> 4) & 0x03;
      uint32_t spn = d[2] | (d[3] << 8) | ((uint32_t)(d[4] >> 5) << 16);
      uint8_t  fmi = d[4] & 0x1F;
      if (spn == 0 || spn == 0x7FFFF) strcpy(dtc, "OK");
      else snprintf(dtc, sizeof(dtc), "SPN:%lu FMI:%u", (unsigned long)spn, fmi);
      break;
    }
  }
}

void registraVisto(bool ext, uint32_t chave, uint8_t sa, const uint8_t* d, uint8_t len) {
  for (int i = 0; i < nVistos; i++) {
    if (vistos[i].ext == ext && vistos[i].chave == chave && vistos[i].sa == sa) {
      vistos[i].n++;
      vistos[i].len = len;
      memcpy(vistos[i].d, d, len > 8 ? 8 : len);
      return;
    }
  }
  if (nVistos >= MAX_VISTOS) return;
  Visto& v = vistos[nVistos++];
  v.ext = ext; v.chave = chave; v.sa = sa; v.n = 1; v.primeiro = millis();
  v.len = len;
  memcpy(v.d, d, len > 8 ? 8 : len);
}

void leCAN() {
  for (int k = 0; k < 40 && CAN.checkReceive() == CAN_MSGAVAIL; k++) {
    unsigned long id; byte len; byte buf[8];
    if (CAN.readMsgBuf(&id, &len, buf) != CAN_OK) return;
    if (id & 0x40000000UL) continue;            // RTR
    bool ext = (id & 0x80000000UL) != 0;
    id &= ext ? 0x1FFFFFFFUL : 0x7FFUL;
    if (len > 8) len = 8;

    framesTotal++;
    ultimoFrame = millis();

    if (despejo && millis() - ultimoDespejo >= 20) {
      ultimoDespejo = millis();
      Serial.printf("%s %08lX [%u]", ext ? "EXT" : "STD", id, len);
      for (int i = 0; i < len; i++) Serial.printf(" %02X", buf[i]);
      Serial.println();
    }

    if (!ext) {
      framesStd++;
      registraVisto(false, id, 0, buf, len);
      continue;
    }
    framesExt++;
    uint8_t  pf = (id >> 16) & 0xFF;
    uint8_t  ps = (id >> 8) & 0xFF;
    uint8_t  dp = (id >> 24) & 0x01;
    uint8_t  sa = id & 0xFF;
    uint32_t pgn = ((uint32_t)dp << 16) | ((uint32_t)pf << 8) | (pf >= 240 ? ps : 0);
    registraVisto(true, pgn, sa, buf, len);
    decodifica(pgn, sa, buf, len);
  }
}

// ---------------- JSON / BLE ----------------
size_t addNum(char* b, size_t n, size_t pos, const char* k, float v, int dec) {
  if (pos + 40 >= n) return pos;
  int r = isnan(v) ? snprintf(b + pos, n - pos, "\"%s\":null,", k)
                   : snprintf(b + pos, n - pos, "\"%s\":%.*f,", k, dec, v);
  return r > 0 ? pos + r : pos;
}

void enviaJSON() {
  bool canOk = estado == ESCUTANDO && (millis() - ultimoFrame) < CAN_ATIVO_MS;
  char* b = txBuf;
  const size_t n = sizeof(txBuf);
  size_t p = snprintf(b, n, "{\"dispositivo\":\"%s\",", NOME_DISPOSITIVO);
  p = addNum(b, n, p, "rpm", rpm, 1);
  p = addNum(b, n, p, "carga_pct", cargaPct, 1);
  p = addNum(b, n, p, "horimetro_h", horimetroH, 2);
  p = addNum(b, n, p, "temp_c", tempC, 1);
  p = addNum(b, n, p, "pressao_kpa", pressaoKpa, 1);
  p = addNum(b, n, p, "combustivel_pct", combustivelPct, 1);
  p = addNum(b, n, p, "temp_oleo_c", tempOleoC, 1);
  p = addNum(b, n, p, "nivel_oleo_pct", nivelOleoPct, 1);
  p = addNum(b, n, p, "consumo_lh", consumoLh, 1);
  p = addNum(b, n, p, "bateria_v", bateriaV, 1);
  p = addNum(b, n, p, "pedal_pct", pedalPct, 1);
  p = addNum(b, n, p, "torque_pct", torquePct, 0);
  p = addNum(b, n, p, "velocidade_kmh", velocidadeKmh, 1);
  p += snprintf(b + p, n - p, "\"lamp_vermelha\":%d,\"lamp_ambar\":%d,", lampVermelha, lampAmbar);
  p += snprintf(b + p, n - p, "\"dtc\":\"%s\",", dtc);
  p += snprintf(b + p, n - p,
                "\"can_ok\":%s,\"can_baud\":%ld,\"can_frames\":%lu,\"can_std\":%lu}\n",
                canOk ? "true" : "false",
                baudAtual >= 0 ? BAUD_VALOR[baudAtual] : 0L, framesExt, framesStd);

  Serial.print(b);
  if (clienteConectado && txPos >= txLen) {   // só começa outro se o anterior terminou
    txLen = p;
    txPos = 0;
  }
}

// Envia 1 pedaço de 20 bytes por vez, sem travar a leitura do CAN.
void servePorBLE() {
  if (!clienteConectado || txPos >= txLen) return;
  if (millis() - txT < 15) return;
  size_t n = txLen - txPos;
  if (n > 20) n = 20;
  pTxChar->setValue((uint8_t*)(txBuf + txPos), n);
  pTxChar->notify();
  txPos += n;
  txT = millis();
}

// ---------------- Diagnóstico serial ----------------
void imprimeTabela() {
  Serial.printf("\n--- PGNs vistos: %d ---\n", nVistos);
  for (int i = 0; i < nVistos; i++) {
    const Visto& v = vistos[i];
    float hz = v.n * 1000.0f / (float)(millis() - v.primeiro + 1);
    if (v.ext) Serial.printf("PGN %-6lu 0x%05lX SA %3u  n=%-6lu %5.1f Hz  %-22s", (unsigned long)v.chave,
                             (unsigned long)v.chave, v.sa, (unsigned long)v.n, hz, nomePGN(v.chave));
    else       Serial.printf("STD ID 0x%03lX        n=%-6lu %5.1f Hz  %-22s", (unsigned long)v.chave,
                             (unsigned long)v.n, hz, "");
    for (int j = 0; j < v.len && j < 8; j++) Serial.printf(" %02X", v.d[j]);
    Serial.println();
  }
  Serial.println("---\n");
}

void comandosSerial() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c == 'd') { despejo = !despejo; Serial.printf("[despejo %s]\n", despejo ? "LIGADO" : "desligado"); }
    else if (c == 'p') imprimeTabela();
    else if (c == 'b') { estado = DETECTANDO; iniciaJanela(0); Serial.println("[redetectando baud]"); }
    else if (c == 'r') { nVistos = 0; framesTotal = framesExt = framesStd = 0; Serial.println("[contadores zerados]"); }
  }
}

// ---------------- Arduino ----------------
void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.println("\nALS Telemetria Ferrari ESV 336 — v4.0 (J1939)");
  Serial.println("Comandos: d=despejo  p=tabela PGN  b=redetecta baud  r=zera");

  SPI.begin(PIN_SCK, PIN_MISO, PIN_MOSI, PIN_CS);

  while (!autotesteMCP()) {
    Serial.println("AUTOTESTE MCP2515 FALHOU: confira CS=GPIO5, SCK=18, SO=19, SI=23, 5V, GND e o cristal. Repetindo...");
    delay(2000);
  }
  Serial.println("Autoteste MCP2515 OK (SPI, chip e cristal funcionam).");

  BLEDevice::init(NOME_DISPOSITIVO);
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new ServerCallbacks());
  BLEService* svc = pServer->createService(UART_SERVICE_UUID);
  pTxChar = svc->createCharacteristic(UART_TX_CHAR_UUID, BLECharacteristic::PROPERTY_NOTIFY);
  pTxChar->addDescriptor(new BLE2902());
  svc->start();
  BLEAdvertising* adv = BLEDevice::getAdvertising();
  adv->addServiceUUID(UART_SERVICE_UUID);
  adv->setScanResponse(true);
  BLEDevice::startAdvertising();

  ultimoFrame = millis();
  iniciaJanela(0);
}

void loop() {
  comandosSerial();
  leCAN();
  servePorBLE();

  if (estado == DETECTANDO) {
    if (framesTotal > framesInicio) {            // chegou frame neste baud: trava
      estado    = ESCUTANDO;
      baudAtual = tentativa;
      Serial.printf("[CAN] barramento detectado a %ld bps\n", BAUD_VALOR[baudAtual]);
    } else if (millis() - tInicioJanela > JANELA_DETECCAO_MS) {
      iniciaJanela(tentativa ^ 1);               // alterna 250k <-> 500k
    }
  } else if (millis() - ultimoFrame > SEM_FRAME_MS) {
    Serial.println("[CAN] sem frames ha 15 s (motor desligado ou baud mudou). Redetectando...");
    estado = DETECTANDO;
    iniciaJanela(baudAtual >= 0 ? baudAtual : 0);
  }

  if (millis() - ultimoEnvio >= INTERVALO_JSON_MS) {
    ultimoEnvio = millis();
    enviaJSON();
  }

  if (millis() - ultimoResumo >= 5000) {
    ultimoResumo = millis();
    Serial.printf("[CAN] %s | baud %ld | ext %lu | std %lu | erros RX %u\n",
                  estado == ESCUTANDO ? "ESCUTANDO" : "DETECTANDO",
                  baudAtual >= 0 ? BAUD_VALOR[baudAtual] : 0L, framesExt, framesStd,
                  CAN.errorCountRX());
  }
}
