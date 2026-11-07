import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseIntentWithLLM } from "@/lib/llm";
import { ParsedActionSchema } from "@/lib/types";

const RequestBodySchema = z.object({
  text: z.string().min(1, "Request text cannot be empty"),
  addressBook: z.record(z.string()).default({}),
  tokenList: z
    .array(
      z.object({
        symbol: z.string(),
        mint: z.string(),
        decimals: z.number(),
      })
    )
    .optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validatedInput = RequestBodySchema.safeParse(body);

    if (!validatedInput.success) {
      return NextResponse.json(
        {
          error: "Invalid request payload",
          details: validatedInput.error.format(),
        },
        { status: 400 }
      );
    }

    const { text, addressBook, tokenList } = validatedInput.data;

    const parsedAction = await parseIntentWithLLM({
      text,
      addressBook,
      tokenList,
    });

    // Double check output against strict Zod schema
    const verifiedOutput = ParsedActionSchema.parse(parsedAction);

    return NextResponse.json(verifiedOutput);
  } catch (error: any) {
    console.error("Error in /api/parse route:", error);
    return NextResponse.json(
      {
        action: "unknown",
        token: "SOL",
        amount: 0,
        recipient: null,
        recipientLabel: null,
        clarification:
          "SolSafe encountered an error processing your instruction. Please try again.",
      },
      { status: 500 }
    );
  }
}

