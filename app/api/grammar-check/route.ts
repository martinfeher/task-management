import { jsonWithCors, optionsWithCors } from "@/lib/api-cors";

type GrammarCheckRequest = {
  text?: string;
};

type OpenAIChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return jsonWithCors(
        { error: "OpenAI API key is not configured" },
        { status: 500 },
      );
    }

    const body = (await request.json()) as GrammarCheckRequest;
    const text = body.text?.trim();

    if (!text) {
      return jsonWithCors({ error: "Text is required" }, { status: 400 });
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        messages: [
          {
            role: "system",
            content:
              "You correct grammar, spelling, and punctuation. Return only the corrected text with no explanations, quotes, or markdown.",
          },
          {
            role: "user",
            content: text,
          },
        ],
      }),
    });

    const data = (await response.json()) as OpenAIChatResponse;

    if (!response.ok) {
      return jsonWithCors(
        { error: data.error?.message ?? "Failed to check grammar" },
        { status: response.status },
      );
    }

    const correctedText = data.choices?.[0]?.message?.content?.trim();
    if (!correctedText) {
      return jsonWithCors(
        { error: "No grammar suggestion was returned" },
        { status: 502 },
      );
    }

    return jsonWithCors({ correctedText });
  } catch (error) {
    console.error("Failed to check grammar:", error);
    return jsonWithCors({ error: "Failed to check grammar" }, { status: 500 });
  }
}

export async function OPTIONS() {
  return optionsWithCors();
}
