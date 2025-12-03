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
import { useState } from 'react'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export default function Home() {
  const [selectedCompanyId, setSelectedCompanyId] = useState(companies[0].id)
  const [loading, setLoading] = useState(false)
  const [reports, setReports] = useState<{
    investmentReport: string | null
    CEOReport: string | null
  }>({
    investmentReport: null,
    CEOReport: null,
  })

  const [error, setError] = useState<string | null>(null)

  const selectedCompany = companies.find((c) => c.id === selectedCompanyId)

  const loadSampleReports = () => {
    setReports({
      CEOReport: exampleReports.CEOReport,
      investmentReport: exampleReports.investmentReport,
    })
  }

  const handleGenerateReports = async () => {
    if (!selectedCompany) return

    setLoading(true)
    setError(null)
    setReports({
      investmentReport: null,
      CEOReport: null,
    })

    try {
      // First, fetch CEO report
      const ceoResponse = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: selectedCompany.name,
          companyLocation: selectedCompany.location,
          companyRevenue: selectedCompany.revenue,
          reportType: 'CEO',
        }),
      })

      if (!ceoResponse.ok) {
        const errorData = await ceoResponse.json()
        throw new Error(errorData.error || `API error: ${ceoResponse.status}`)
      }

      const ceoData = await ceoResponse.json()
      setReports((prevReports) => ({
        ...prevReports,
        CEOReport: ceoData.CEOReport,
      }))

      // Then, fetch Investment report after CEO report is done
      const investmentResponse = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: selectedCompany.name,
          companyLocation: selectedCompany.location,
          companyRevenue: selectedCompany.revenue,
          reportType: 'investment',
        }),
      })

      if (!investmentResponse.ok) {
        const errorData = await investmentResponse.json()
        throw new Error(
          errorData.error || `API error: ${investmentResponse.status}`
        )
      }

      const investmentData = await investmentResponse.json()
      setReports((prevReports) => ({
        ...prevReports,
        investmentReport: investmentData.investmentReport,
      }))
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to generate reports'
      setError(message)
      console.error('Error generating reports:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold tracking-tight text-foreground mb-2">
            PE Research Tool
          </h1>
          <p className="text-muted-foreground">
            Generate investment reports powered by OpenAI Deep Research
          </p>
        </div>

        {/* {JSON.stringify(reports)} */}

        {/* Selection Card */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Select Company</CardTitle>
            <CardDescription>Choose a company to research</CardDescription>
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
                  <label htmlFor={company.id} className="flex-1 cursor-pointer">
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

            <Button
              onClick={loadSampleReports}
              disabled={loading}
              size="lg"
              className="w-full mt-6"
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
                  Generating Reports...
                </>
              ) : (
                'Generate Reports'
              )}
            </Button>
          </CardContent>
        </Card>

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
        {reports && (
          <div className="space-y-8">
            {/* CEO Report */}
            {reports.CEOReport && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl">CEO Report</CardTitle>
                  <CardDescription>
                    Leadership Profile & Key Insights
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
                    {selectedCompany?.name} - PE Investment Committee Memo
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-slate prose-sm text-base prose-li:marker:text-foreground leading-relaxed max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {reports.investmentReport}
                    </ReactMarkdown>

                    {/* {reports.investmentReport} */}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Empty State */}
        {!loading && !reports && !error && (
          <Card className="text-center py-12">
            <CardContent>
              <p className="text-muted-foreground">
                Select a company and click "Generate Reports" to begin research.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  )
}
