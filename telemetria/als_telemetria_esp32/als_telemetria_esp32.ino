// ============================================================
//  ALS DEPOT — Telemetria J1939 Cummins
//  Hardware: ESP32 + MCP2515 (TJA1050)
//  Protocolo: SAE J1939 via CAN Bus
//  Saída: BLE (Nordic UART Service) para tablet Android
//  Autor: ALS Depot / Anderson Melies
//  Versão: 2.0 — migrado de Bluetooth Clássico (SPP) para BLE
// ============================================================
//
//  BIBLIOTECAS NECESSÁRIAS (instalar no Arduino IDE):
//  - mcp_can  (de Cory J. Fowler) — Gerenciador de Bibliotecas
//  - ESP32 BLE Arduino — já incluída no pacote ESP32 da Espressif
//
//  ATENÇÃO — mudança de versão:
//  O painel HTML (als_telemetria_painel.html) usa Web Bluetooth,
//  que só conversa com BLE (Bluetooth Low Energy), nunca com
//  Bluetooth Clássico (SPP). A v1.0 deste firmware usava
//  BluetoothSerial (SPP) e por isso NUNCA conectava ao painel.
//  Esta versão expõe um serviço BLE UART (Nordic UART Service)
//  com o mesmo UUID que o painel já espera.
//
//  LIGAÇÃO DOS PINOS (ESP32 → MCP2515):
//  ESP32 GPIO5  → MCP2515 CS
//  ESP32 GPIO19 → MCP2515 SO (MISO)
//  ESP32 GPIO23 → MCP2515 SI (MOSI)
//  ESP32 GPIO18 → MCP2515 SCK
//  ESP32 5V     → MCP2515 VCC  (módulo com TJA1050 exige 5V, não 3.3V)
//  ESP32 GND    → MCP2515 GND
//
//  LIGAÇÃO J1939 (Conector Deutsch 9p → MCP2515):
//  Pino C (CAN H) → MCP2515 CANH
//  Pino D (CAN L) → MCP2515 CANL
//  Pino A (GND)   → GND geral
//  Pino B (+24V)  → LM2596 entrada → saída 5V → VCC (ESP32 e MCP2515)
// ============================================================

#include <SPI.h>
#include <mcp_can.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// ---- Configuração de pinos ----
#define CAN_CS_PIN   4    // Chip Select do MCP2515 — TESTE: temporariamente em D4 (era D5) para descartar contato ruim
#define CAN_INT_PIN  4    // Interrupção (opcional, pode deixar desconectado)

// ---- Objetos principais ----
MCP_CAN CAN(CAN_CS_PIN);

// ---- Nome do dispositivo BLE (aparece no tablet) ----
// Altere o número para identificar cada máquina
const String NOME_DISPOSITIVO = "ALS-Kone-01";
// Exemplos: "ALS-Linde-01", "ALS-Ferrari-01", "ALS-Kone-01"

// ---- Nordic UART Service — mesmo UUID usado pelo painel HTML ----
#define UART_SERVICE_UUID  "6e400001-b5a3-f393-e0a9-e50e24dcca9e"
#define UART_TX_CHAR_UUID  "6e400003-b5a3-f393-e0a9-e50e24dcca9e" // notificações ESP32 -> tablet

BLEServer*         pServer       = nullptr;
BLECharacteristic* pTxChar       = nullptr;
bool               clienteConectado = false;

// ---- Callback de conexão/desconexão BLE ----
class ServerCallbacks: public BLEServerCallbacks {
  void onConnect(BLEServer* s) override {
    clienteConectado = true;
    Serial.println("Tablet conectado via BLE.");
  }
  void onDisconnect(BLEServer* s) override {
    clienteConectado = false;
    Serial.println("Tablet desconectado. Reiniciando anúncio BLE...");
    BLEDevice::startAdvertising();
  }
};

// ---- PGNs J1939 que vamos monitorar ----
// PGN = Parameter Group Number (endereço do dado no barramento)
#define PGN_RPM_CARGA      0xF004  // 61444 — RPM e carga do motor
#define PGN_HORIMETRO      0xFEE5  // 65253 — Horas totais do motor
#define PGN_TEMPERATURA    0xFEEE  // 65262 — Temperatura do líquido de arrefecimento
#define PGN_PRESSAO_OLEO   0xFEEF  // 65263 — Pressão do óleo do motor
#define PGN_COMBUSTIVEL    0xFEFC  // 65276 — Nível de combustível
#define PGN_FALHAS         0xFECA  // 65226 — Códigos de falha ativos (DTC)

// ---- Variáveis dos dados lidos ----
float  rpm          = 0;
float  carga_motor  = 0;   // %
float  horimetro    = 0;   // horas
float  temperatura  = 0;   // °C
float  pressao_oleo = 0;   // kPa
float  combustivel  = 0;   // %
String dtc_ativo    = "";

// ---- Controle de tempo de envio ----
unsigned long ultimo_envio = 0;
const unsigned long INTERVALO_ENVIO = 2000; // envia dados a cada 2 segundos

// ============================================================
//  SETUP — executa uma vez ao ligar
// ============================================================
void setup() {
  Serial.begin(115200);
  Serial.println("ALS Depot — Telemetria J1939 iniciando...");

  // ---- Inicia BLE com o nome da máquina ----
  BLEDevice::init(NOME_DISPOSITIVO.c_str());
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new ServerCallbacks());

  BLEService* pService = pServer->createService(UART_SERVICE_UUID);

  pTxChar = pService->createCharacteristic(
    UART_TX_CHAR_UUID,
    BLECharacteristic::PROPERTY_NOTIFY
  );
  pTxChar->addDescriptor(new BLE2902());

  pService->start();

  BLEAdvertising* pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(UART_SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  BLEDevice::startAdvertising();

  Serial.println("BLE iniciado e anunciando: " + NOME_DISPOSITIVO);

  // ---- TESTE: 500 kbps em vez de 250 kbps ----
  // Sem tráfego nenhum chegando em 250kbps na Ferrari — testando a outra
  // velocidade padrão do J1939 (comum em motores Cummins mais novos).
  while (CAN.begin(MCP_ANY, CAN_500KBPS, MCP_8MHZ) != CAN_OK) {
    Serial.println("Erro ao iniciar MCP2515. Tentando novamente em 2s...");
    delay(2000);
  }

  CAN.setMode(MCP_LOOPBACK);
  Serial.println("CAN Bus J1939 iniciado a 250 kbps.");
  Serial.println("Aguardando dados do motor Cummins...");
}

// ============================================================
//  LOOP — executa continuamente
// ============================================================
void loop() {
  // Verifica se chegou alguma mensagem no barramento CAN
  if (CAN_MSGAVAIL == CAN.checkReceive()) {
    lerMensagemCAN();
  }

  // Envia os dados via BLE a cada INTERVALO_ENVIO ms
  if (millis() - ultimo_envio >= INTERVALO_ENVIO) {
    enviarDadosBLE();
    ultimo_envio = millis();
  }
}

// ============================================================
//  LER MENSAGEM CAN — decodifica os PGNs J1939
// ============================================================
void lerMensagemCAN() {
  long unsigned int rxId;
  unsigned char len = 0;
  unsigned char rxBuf[8];

  CAN.readMsgBuf(&rxId, &len, rxBuf);

  // Extrai o PGN do ID J1939
  // No J1939, o PGN está nos bits 8-25 do ID de 29 bits
  unsigned long pgn = (rxId >> 8) & 0x3FFFF;

  // ---- DEBUG: mostra toda mensagem CAN bruta recebida ----
  // Ative pra diagnosticar se há tráfego no barramento e em quais PGNs.
  // Comente esta linha (ou remova) depois de confirmar o funcionamento.
  Serial.print("CAN RX | ID:0x"); Serial.print(rxId, HEX);
  Serial.print(" PGN:"); Serial.print(pgn);
  Serial.print(" Len:"); Serial.print(len);
  Serial.print(" Data:");
  for (int i = 0; i < len; i++) { Serial.print(" "); Serial.print(rxBuf[i], HEX); }
  Serial.println();

  // Decodifica cada PGN
  switch (pgn) {

    // ---- RPM e Carga do Motor (PGN 61444) ----
    case PGN_RPM_CARGA:
      // SPN 190: RPM — bytes 4-5, resolução 0.125 rpm/bit
      rpm = ((rxBuf[4] | (rxBuf[5] << 8)) * 0.125);
      // SPN 92: Carga — byte 3, resolução 0.4 %/bit
      carga_motor = rxBuf[3] * 0.4;
      break;

    // ---- Horímetro Total (PGN 65253) ----
    case PGN_HORIMETRO:
      // SPN 247: horas totais — bytes 0-3, resolução 0.05 h/bit
      horimetro = ((rxBuf[0] | (rxBuf[1] << 8) |
                    (rxBuf[2] << 16) | (rxBuf[3] << 24)) * 0.05);
      break;

    // ---- Temperatura do Motor (PGN 65262) ----
    case PGN_TEMPERATURA:
      // SPN 110: temperatura — byte 0, offset -40°C, resolução 1°C/bit
      temperatura = rxBuf[0] - 40;
      break;

    // ---- Pressão do Óleo (PGN 65263) ----
    case PGN_PRESSAO_OLEO:
      // SPN 100: pressão — byte 3, resolução 4 kPa/bit
      pressao_oleo = rxBuf[3] * 4;
      break;

    // ---- Nível de Combustível (PGN 65276) ----
    case PGN_COMBUSTIVEL:
      // SPN 96: nível — byte 1, resolução 0.4 %/bit
      combustivel = rxBuf[1] * 0.4;
      break;

    // ---- Falhas Ativas / DTC (PGN 65226) ----
    case PGN_FALHAS:
      // SPN básico — extrai SPN e FMI do primeiro DTC
      {
        unsigned int spn = rxBuf[3] | ((rxBuf[4] & 0x07) << 8);
        unsigned int fmi = rxBuf[4] >> 3;
        if (spn > 0) {
          dtc_ativo = "SPN:" + String(spn) + " FMI:" + String(fmi);
        } else {
          dtc_ativo = "OK";
        }
      }
      break;
  }
}

// ============================================================
//  ENVIAR DADOS VIA BLE (Nordic UART Service)
//  Formato JSON — fácil de consumir no app Android
// ============================================================
void enviarDadosBLE() {
  // Monta o JSON com todos os dados
  String json = "{";
  json += "\"dispositivo\":\"" + NOME_DISPOSITIVO + "\",";
  json += "\"rpm\":"          + String(rpm, 1)          + ",";
  json += "\"carga_pct\":"    + String(carga_motor, 1)   + ",";
  json += "\"horimetro_h\":"  + String(horimetro, 2)     + ",";
  json += "\"temp_c\":"       + String(temperatura, 1)   + ",";
  json += "\"pressao_kpa\":"  + String(pressao_oleo, 1)  + ",";
  json += "\"combustivel_pct\":" + String(combustivel, 1) + ",";
  json += "\"dtc\":\"" + dtc_ativo + "\"";
  json += "}\n"; // \n marca o fim da mensagem para o painel remontar o JSON

  // Envia via BLE notify, em pedaços de até 20 bytes (limite do MTU padrão BLE)
  if (clienteConectado) {
    const int MTU = 20;
    for (size_t i = 0; i < json.length(); i += MTU) {
      String chunk = json.substring(i, min(i + MTU, json.length()));
      pTxChar->setValue((uint8_t*)chunk.c_str(), chunk.length());
      pTxChar->notify();
      delay(30); // evita perder pacotes por flood do buffer BLE
    }
  }

  // Também imprime no monitor serial para debug durante desenvolvimento
  Serial.println(json);
}

// ============================================================
//  EXEMPLO DE SAÍDA JSON A CADA 2 SEGUNDOS:
//
//  {"dispositivo":"ALS-Kone-01","rpm":1450.0,"carga_pct":42.0,
//   "horimetro_h":2847.35,"temp_c":88.0,"pressao_kpa":340.0,
//   "combustivel_pct":67.2,"dtc":"OK"}
//
//  Se houver falha ativa:
//  {"dtc":"SPN:100 FMI:4"}  → pressão de óleo baixa
// ============================================================
