'use client'

import { companies, exampleReports } from '@/baseData'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { useEffect, useRef, useState } from 'react'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

type ReportType = 'CEO' | 'investment'

interface ActivityItem {
  id: number
  reportType: ReportType
  message: string
  rawType?: string
}

export default function Home() {
  const [selectedCompanyId, setSelectedCompanyId] = useState(companies[0].id)
  const [loading, setLoading] = useState(false)

  const [reports, setReports] = useState<{
    investmentReport: string
    CEOReport: string
  }>({
    investmentReport: '',
    CEOReport: '',
  })

  const [error, setError] = useState<string | null>(null)
  const [activityLog, setActivityLog] = useState<ActivityItem[]>([])
  const [currentStreaming, setCurrentStreaming] = useState<ReportType | null>(
    null
  )

  const logRef = useRef<HTMLDivElement | null>(null)

  const selectedCompany = companies.find((c) => c.id === selectedCompanyId)

  // Auto-scroll activity log to bottom
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [activityLog])

  const appendActivity = (
    reportType: ReportType,
    message: string,
    rawType?: string
  ) => {
    setActivityLog((prev) => [
      ...prev,
      {
        id: prev.length + 1,
        reportType,
        message,
        rawType,
      },
    ])
  }

  const loadSampleReports = () => {
    setError(null)
    setActivityLog([])
    setReports({
      CEOReport: exampleReports.CEOReport,
      investmentReport: exampleReports.investmentReport,
    })
  }

  // Helper to stream one report (CEO or investment)
  const streamReport = async (reportType: ReportType) => {
    if (!selectedCompany) return
    setCurrentStreaming(reportType)

    const response = await fetch('/api/research/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyName: selectedCompany.name,
        companyLocation: selectedCompany.location,
        companyRevenue: selectedCompany.revenue,
        reportType,
      }),
    })

    if (!response.ok || !response.body) {
      let msg = `Failed to start ${reportType} stream`
      try {
        const data = await response.json()
        if (data?.error) msg = data.error
      } catch {
        /* ignore */
      }
      throw new Error(msg)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''
    const reportKey = reportType === 'CEO' ? 'CEOReport' : 'investmentReport'

    let streamDone = false

    while (!streamDone) {
      const { value, done } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // Parse SSE chunks (separated by double newline)
      let boundary = buffer.indexOf('\n\n')
      while (boundary !== -1) {
        const rawEvent = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)

        const lines = rawEvent.split('\n')
        let eventName = 'message'
        let dataStr = ''

        for (const line of lines) {
          if (line.startsWith('event:')) {
            eventName = line.slice('event:'.length).trim()
          } else if (line.startsWith('data:')) {
            const piece = line.slice('data:'.length).trim()
            // handle multi-line data
            dataStr = dataStr ? `${dataStr}\n${piece}` : piece
          }
        }

        if (dataStr) {
          let payload: any
          try {
            payload = JSON.parse(dataStr)
          } catch {
            payload = { raw: dataStr }
          }

          if (eventName === 'activity') {
            const msg = payload.message ?? ''
            const rawType = payload.type
            appendActivity(reportType, msg, rawType)
          } else if (eventName === 'delta') {
            const textDelta: string = payload.textDelta ?? ''
            if (textDelta) {
              setReports((prev) => ({
                ...prev,
                [reportKey]: (prev[reportKey] ?? '') + textDelta,
              }))
            }
          } else if (eventName === 'error') {
            const msg =
              payload?.message ??
              `Error while streaming ${reportType.toUpperCase()} report.`
            appendActivity(reportType, `❌ ${msg}`)
            throw new Error(msg)
          } else if (eventName === 'done') {
            streamDone = true
          }
        }

        boundary = buffer.indexOf('\n\n')
      }
    }
  }

  const handleGenerateReports = async () => {
    if (!selectedCompany) return

    setLoading(true)
    setError(null)
    setActivityLog([])
    setReports({
      investmentReport: '',
      CEOReport: '',
    })

    try {
      // 1) CEO report (streamed)
      await streamReport('CEO')

      // 2) Investment memo (streamed)
      await streamReport('investment')
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to generate reports'
      setError(message)
      console.error('Error generating reports:', err)
    } finally {
      setCurrentStreaming(null)
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold tracking-tight text-foreground mb-2">
            PE Research Tool
          </h1>
          <p className="text-muted-foreground">
            Generate investment reports powered by OpenAI Deep Research
          </p>
        </div>

        {/* Top row: Company selector + Activity log */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Selection Card */}
          <Card>
            <CardHeader>
              <CardTitle>Select Company</CardTitle>
              <CardDescription>
                Choose a company to research and generate reports
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {companies.map((company) => (
                  <div key={company.id} className="flex items-center space-x-3">
                    <input
                      type="radio"
                      id={company.id}
                      name="company"
                      value={company.id}
                      checked={selectedCompanyId === company.id}
                      onChange={(e) => setSelectedCompanyId(e.target.value)}
                      className="w-4 h-4"
                    />
                    <label
                      htmlFor={company.id}
                      className="flex-1 cursor-pointer"
                    >
                      <div className="font-medium text-foreground">
                        {company.name}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {company.location} • Revenue: {company.revenue}
                      </div>
                    </label>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-3 mt-4">
                <Button
                  onClick={loadSampleReports}
                  disabled={loading}
                  size="lg"
                  className="w-full"
                  variant="outline"
                >
                  Load Sample Reports
                </Button>

                <Button
                  onClick={handleGenerateReports}
                  disabled={loading}
                  size="lg"
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <Spinner className="mr-2 h-4 w-4" />
                      Generating Reports…
                    </>
                  ) : (
                    'Generate Reports'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Activity Log Card */}
          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle>Activity Log</CardTitle>
              <CardDescription>
                {currentStreaming === 'CEO' && 'Streaming CEO report activity'}
                {currentStreaming === 'investment' &&
                  'Streaming Investment memo activity'}
                {!currentStreaming &&
                  activityLog.length === 0 &&
                  'No active research yet.'}
                {!currentStreaming && activityLog.length > 0 && 'Research log'}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <div
                ref={logRef}
                className="h-64 md:h-80 overflow-y-auto rounded border border-border/40 bg-muted/30 p-3 text-xs font-mono leading-relaxed space-y-1"
              >
                {activityLog.length === 0 && (
                  <p className="text-muted-foreground">
                    Activity will appear here as the model thinks, searches, and
                    writes.
                  </p>
                )}

                {activityLog.map((item) => (
                  <div key={item.id} className="flex gap-2">
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground shrink-0 w-20">
                      {item.reportType === 'CEO' ? 'CEO' : 'INVESTMENT'}
                    </span>
                    <span>{item.message}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Error State */}
        {error && (
          <Card className="mb-8 border-destructive bg-destructive/10">
            <CardHeader>
              <CardTitle className="text-destructive">Error</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-destructive text-sm">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Reports */}
        <div className="space-y-8">
          {/* CEO Report */}
          {reports.CEOReport && (
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">CEO Report</CardTitle>
                <CardDescription>
                  Leadership Profile &amp; Key Insights
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="prose prose-slate prose-sm text-base prose-li:marker:text-foreground leading-relaxed max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {reports.CEOReport}
                  </ReactMarkdown>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Investment Report */}
          {reports.investmentReport && (
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Investment Report</CardTitle>
                <CardDescription>
                  {selectedCompany?.name} – PE Investment Committee Memo
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="prose prose-slate prose-sm text-base prose-li:marker:text-foreground leading-relaxed max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {reports.investmentReport}
                  </ReactMarkdown>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </main>
  )
}
