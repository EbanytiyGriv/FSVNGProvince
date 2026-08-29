// API endpoint для обработки анкеты набора
export default async function handler(req, res) {
  // Разрешаем только POST запросы
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  try {
    const { answers } = req.body;

    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({ error: 'Invalid data' });
    }

    // Discord webhook URL (хранится на сервере, недоступен клиенту)
    const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_RECRUIT;

    if (!WEBHOOK_URL) {
      console.error('DISCORD_WEBHOOK_RECRUIT не настроен');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Формируем описание для Discord
    let description = '';
    answers.forEach((answer, index) => {
      description += `**${index + 1}. ${answer.question}**\n${answer.answer || '—'}\n\n`;
    });

    // Отправляем в Discord
    const discordResponse = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title: 'Новая заявка на набор',
          description: description.slice(0, 4090),
          color: 0xE0A458,
          timestamp: new Date().toISOString()
        }]
      })
    });

    if (!discordResponse.ok) {
      throw new Error('Discord webhook failed');
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
