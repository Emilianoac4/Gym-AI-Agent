type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default";
  badge?: number;
};

export const isValidExpoPushToken = (token: string): boolean =>
  token.startsWith("ExponentPushToken[") || token.startsWith("ExpoPushToken[");

export const sendExpoPushNotifications = async (messages: ExpoPushMessage[]): Promise<void> => {
  const valid = messages.filter((m) => isValidExpoPushToken(m.to));
  if (valid.length === 0) return;

  try {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(valid.length === 1 ? valid[0] : valid),
    });

    if (!response.ok) {
      const text = await response.text();
      console.warn("[PUSH] Expo push API error:", text);
    }
  } catch (err) {
    console.warn("[PUSH] Expo push send failed:", err);
  }
};
