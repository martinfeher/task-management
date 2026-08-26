export async function checkGrammar(text: string): Promise<string> {
  const response = await fetch("/api/grammar-check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  const data = (await response.json()) as {
    correctedText?: string;
    error?: string;
  };

  if (!response.ok) {
    throw new Error(data.error ?? "Failed to check grammar");
  }

  if (!data.correctedText) {
    throw new Error("No grammar suggestion was returned");
  }

  return data.correctedText;
}
