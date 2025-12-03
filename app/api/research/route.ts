import { promptData } from '@/baseData'
import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

interface ResearchRequest {
  companyName: string
  companyLocation: string
  companyRevenue: string
  reportType: 'CEO' | 'investment'
}

export async function POST(request: NextRequest) {
  try {
    const body: ResearchRequest = await request.json()
    const { companyName, companyLocation, companyRevenue, reportType } = body

    if (!companyName || !companyLocation || !companyRevenue || !reportType) {
      return NextResponse.json(
        {
          error:
            'Missing required fields: companyName, companyLocation, companyRevenue, reportType',
        },
        { status: 400 }
      )
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      )
    }

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    let responseText: string = ''

    // Handling different report types
    if (reportType === 'CEO') {
      const CEOInput = [
        {
          role: 'system',
          content: [
            { type: 'input_text', text: promptData.CEOReport.systemPrompt },
          ],
        },
        {
          role: 'developer',
          content: [
            { type: 'input_text', text: promptData.CEOReport.developerPrompt },
          ],
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: `
                Company: ${companyName}
                Headquarters: ${companyLocation}
                Latest annual revenue: ${companyRevenue}
                Please apply the CEO profile structure and guidance on the CEO of the company`,
            },
          ],
        },
      ]

      responseText = await callOpenAIResponses(client, CEOInput)
    } else if (reportType === 'investment') {
      const investmentInput = [
        {
          role: 'system',
          content: [
            {
              type: 'input_text',
              text: promptData.investmentReport.systemPrompt,
            },
          ],
        },
        {
          role: 'developer',
          content: [
            {
              type: 'input_text',
              text: promptData.investmentReport.developerPrompt,
            },
          ],
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: `
                Company: ${companyName}
                Headquarters: ${companyLocation}
                Latest annual revenue: ${companyRevenue}
                Please apply the investment memo structure and guidance on the company`,
            },
          ],
        },
      ]

      responseText = await callOpenAIResponses(client, investmentInput)
    }

    return NextResponse.json({
      [reportType + 'Report']: responseText,
    })
  } catch (error) {
    console.error('Error in research endpoint:', error)

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred'

    if (errorMessage.includes('401') || errorMessage.includes('unauthorized')) {
      return NextResponse.json(
        { error: 'Invalid OpenAI API key' },
        { status: 401 }
      )
    }

    if (errorMessage.includes('429')) {
      return NextResponse.json(
        { error: 'Rate limited by OpenAI. Please try again in a moment.' },
        { status: 429 }
      )
    }

    return NextResponse.json(
      { error: `Research failed: ${errorMessage}` },
      { status: 500 }
    )
  }
}

async function callOpenAIResponses(
  client: OpenAI,
  userInput: any
): Promise<string> {
  const response = await client.responses.create(
    {
      model: process.env.OPEN_AI_MODEL || 'o4-mini-deep-research-2025-06-26',
      input: userInput,
      reasoning: { effort: 'medium' },

      max_output_tokens: process.env.OPEN_AI_MAX_OUTPUT_TOKENS
        ? parseInt(process.env.OPEN_AI_MAX_OUTPUT_TOKENS)
        : 35000,
      text: {
        format: { type: 'text' },
      },
      // @ts-ignore
      max_tool_calls: 5, // Set max_tool_calls as per your requirement
      tool_choice: 'auto',
      tools: [{ type: 'web_search_preview', search_context_size: 'medium' }],
    },
    {
      timeout: 20 * 60 * 1000,
    }
  )

  if (!response.output || !Array.isArray(response.output)) {
    throw new Error('Invalid response structure from Deep Research API')
  }

  const messageOutput = response.output.find(
    (item: any) => item.type === 'message'
  )
  //@ts-ignore
  if (!messageOutput || !messageOutput.content) {
    throw new Error(
      'No message output found in response. Research ended prematurely.'
    )
  }

  //@ts-ignore
  return messageOutput.content[0]?.text.trim()
}
