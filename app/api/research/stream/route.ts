import { promptData } from '@/baseData'
import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

export const runtime = 'edge' // recommended for streaming

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

    // --- Build input messages based on reportType ---
    let input: any[]

    if (reportType === 'CEO') {
      input = [
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

Please apply the CEO profile structure and guidance on the CEO of the company.`,
            },
          ],
        },
      ]
    } else {
      input = [
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

Please apply the investment memo structure and guidance on the company.`,
            },
          ],
        },
      ]
    }

    // --- Call OpenAI with streaming enabled ---
    const stream = await client.responses.create(
      {
        model: process.env.OPEN_AI_MODEL || 'o4-mini-deep-research-2025-06-26',
        input,
        reasoning: { effort: 'medium' },
        max_output_tokens: process.env.OPEN_AI_MAX_OUTPUT_TOKENS
          ? parseInt(process.env.OPEN_AI_MAX_OUTPUT_TOKENS, 10)
          : 35000,
        text: {
          format: { type: 'text' },
        },
        // @ts-ignore - SDK type is slightly behind
        max_tool_calls: 5,
        tool_choice: 'auto',
        tools: [{ type: 'web_search_preview', search_context_size: 'medium' }],
        stream: true,
      },
      {
        // keep timeout as requested
        timeout: 20 * 60 * 1000,
      }
    )

    const encoder = new TextEncoder()

    const readable = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: any) => {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          )
        }

        // Initial activity
        send('activity', {
          reportType,
          type: 'start',
          message:
            reportType === 'CEO'
              ? '🔎 Starting CEO research…'
              : '📊 Starting investment memo research…',
        })

        try {
          // stream is an AsyncIterable of events
          for await (const ev of stream as any) {
            const type: string = ev?.type ?? ''

            // Skip stuff you don't care about: file search, MCP, code interpreter, custom tools
            if (
              type.includes('file_search') ||
              type.includes('code_interpreter') ||
              type.includes('mcp') ||
              type.includes('tool_call')
            ) {
              continue
            }

            // --- CORE RESPONSE LIFECYCLE EVENTS ---
            if (type === 'response.created') {
              send('activity', {
                reportType,
                type,
                message: '🧠 Deep research job created.',
              })
            } else if (type === 'response.in_progress') {
              send('activity', {
                reportType,
                type,
                message: '💭 Model is thinking through a research step…',
              })
            } else if (type === 'response.completed') {
              send('activity', {
                reportType,
                type,
                message:
                  reportType === 'CEO'
                    ? '✅ CEO profile research completed.'
                    : '✅ Investment memo research completed.',
              })
            } else if (type === 'response.error') {
              send('activity', {
                reportType,
                type,
                message: '❌ Error during research.',
              })
              send('error', {
                reportType,
                message: ev?.error?.message ?? 'Unknown error from model.',
              })
            }

            // --- OUTPUT TEXT STREAMING ---
            else if (type === 'response.output_text.delta') {
              const delta: string = ev?.delta ?? ''
              if (delta) {
                send('delta', {
                  reportType,
                  textDelta: delta,
                })
              }
            } else if (type === 'response.output_text.done') {
              send('activity', {
                reportType,
                type,
                message: '✍️ Finished writing report text.',
              })
            }

            // --- OUTPUT ITEM & CONTENT PARTS ---
            else if (type === 'response.output_item.added') {
              send('activity', {
                reportType,
                type,
                message: '🧩 Started a new output item…',
              })
            } else if (type === 'response.output_item.done') {
              send('activity', {
                reportType,
                type,
                message: '🧱 Finished an output item.',
              })
            } else if (type === 'response.content_part.added') {
              send('activity', {
                reportType,
                type,
                message: '📄 Adding content part…',
              })
            } else if (type === 'response.content_part.done') {
              send('activity', {
                reportType,
                type,
                message: '📄 Finished a content part.',
              })
            }

            // --- WEB SEARCH EVENTS ---
            else if (type === 'response.web_search_call.searching') {
              send('activity', {
                reportType,
                type,
                message: '🌍 Running web search…',
              })
            } else if (type === 'response.web_search_call.completed') {
              send('activity', {
                reportType,
                type,
                message: '🔎 Web search call completed.',
              })
            } else if (type === 'response.web_search_call.failed') {
              send('activity', {
                reportType,
                type,
                message: '⚠️ Web search call failed.',
              })
            }

            // --- REFUSAL / SEARCH STATE / OTHER SIGNALS ---
            else if (type === 'response.refusal.delta') {
              send('activity', {
                reportType,
                type,
                message: '⚠️ Model indicated a refusal delta.',
              })
            } else if (type === 'response.search_state.delta') {
              send('activity', {
                reportType,
                type,
                message: '📡 Search state updated.',
              })
            } else if (type === 'response.output_text.annotation.added') {
              send('activity', {
                reportType,
                type,
                message: '📎 Added citation/annotation to the text.',
              })
            }

            // Fallback: send raw event type for debugging
            else {
              send('activity', {
                reportType,
                type,
                message: `ℹ️ Event: ${type}`,
              })
            }
          }

          // Mark stream as done for this report
          send('done', {
            reportType,
            message: 'Stream completed.',
          })
          controller.close()
        } catch (err: any) {
          send('error', {
            reportType,
            message:
              err?.message ??
              'Unexpected error while streaming research response.',
          })
          controller.error(err)
        }
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Error in streaming research endpoint:', error)
    const message =
      error instanceof Error ? error.message : 'Unknown error occurred'
    return NextResponse.json(
      { error: `Research stream failed: ${message}` },
      { status: 500 }
    )
  }
}
