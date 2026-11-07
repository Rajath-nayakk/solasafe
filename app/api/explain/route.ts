import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { explainWithLLM } from "@/lib/llm";
import { ParsedActionSchema } from "@/lib/types";

const ExplainRequestBodySchema = z.object({
  action: ParsedActionSchema,
  simulation: z.any(),
  riskAnalysis: z.object({
    overallRisk: z.enum(["Safe", "Review", "Risky"]),
    flags: z.array(
      z.object({
        id: z.string(),
        severity: z.enum(["info", "warning", "danger"]),
        message: z.string(),
        detail: z.string().optional(),
      })
    ),
    hasDanger: z.boolean(),
    hasWarning: z.boolean(),
  }),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = ExplainRequestBodySchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        {
          error: "Invalid request payload",
          details: validated.error.format(),
        },
        { status: 400 }
      );
    }

    const { action, simulation, riskAnalysis } = validated.data;
    const response = await explainWithLLM({
      action,
      simulation,
      riskAnalysis,
    });

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("Error in /api/explain route:", error);
    return NextResponse.json(
      {
        explanation:
          "SolSafe was unable to generate an AI explanation for this transaction. Please review the deterministic risk flags below.",
        verdict: "Manual review required.",
        isAiGenerated: false,
      },
      { status: 500 }
    );
  }
}

