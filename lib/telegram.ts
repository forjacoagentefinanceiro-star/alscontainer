// Alerta via Telegram — mesmo bot usado nos alertas do BI (TELEGRAM_TOKEN/TELEGRAM_CHAT_ID).
// Best-effort: nunca lança erro, para não travar a ação que disparou o alerta.
export async function notificarTelegram(mensagem: string) {
  const token = process.env.TELEGRAM_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) {
    console.warn('Telegram não configurado (TELEGRAM_TOKEN/TELEGRAM_CHAT_ID ausentes) — alerta não enviado.')
    return
  }
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: mensagem }),
    })
  } catch (e) {
    console.warn('Falha ao enviar alerta no Telegram:', e)
  }
}
