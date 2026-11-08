interface SendAlertParams {
  monitorName: string;
  url: string;
  statusCode: number;
  error?: string;
}

export async function sendDiscordAlert({
  monitorName,
  url,
  statusCode,
  error,
}: SendAlertParams) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return;

  const payload = {
    embeds: [
      {
        title: `🔴 Service Outage: ${monitorName}`,
        description: `Service **${monitorName}** mengalami kendala atau tidak merespons request.`,
        color: 15158332, // Red
        fields: [
          { name: "Target URL", value: url, inline: false },
          { name: "HTTP Status", value: statusCode > 0 ? `${statusCode}` : "Timeout / Connection Failed", inline: true },
          { name: "Error Detail", value: error || "No response received", inline: true },
          { name: "Timestamp", value: new Date().toISOString(), inline: false },
        ],
        footer: { text: "Pylexia Sentinel" },
      },
    ],
  };

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("Failed to send Discord webhook:", err);
  }
}
