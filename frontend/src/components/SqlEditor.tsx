import React, { useState, useRef } from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism'
import toast from 'react-hot-toast'

interface SqlEditorProps {
  onExecute: (sql: string) => void
  loading: boolean
  initialValue?: string
}

const EXAMPLE_QUERIES = [
  {
    name: 'CEX EVMS Addresses',
    sql: 'SELECT * FROM cex_evms.addresses LIMIT 10'
  },
  {
    name: 'Bitcoin ETF Addresses',
    sql: 'SELECT issuer, address, ticker AS etf_ticker FROM dune.hildobby.dataset_bitcoin_etf_addresses LIMIT 10'
  },
  {
    name: 'Solana Blocks Sample',
    sql: 'SELECT * FROM solana.blocks TABLESAMPLE SYSTEM (100) LIMIT 10'
  }
]

export const SqlEditor: React.FC<SqlEditorProps> = ({ onExecute, loading, initialValue = '' }) => {
  const [sql, setSql] = useState(initialValue)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleExecute = () => {
    if (!sql.trim()) {
      toast.error('Please enter a SQL query')
      return
    }
    onExecute(sql.trim())
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleExecute()
    }
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(sql)
    toast.success('SQL copied to clipboard')
  }

  const resetEditor = () => {
    setSql('')
    if (textareaRef.current) {
      textareaRef.current.focus()
    }
  }

  const loadExample = (exampleSql: string) => {
    setSql(exampleSql)
    if (textareaRef.current) {
      textareaRef.current.focus()
    }
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">SQL Query Editor</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={copyToClipboard}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
          >
            Copy
          </button>
          <button
            onClick={resetEditor}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Example Queries */}
      <div className="mb-4">
        <p className="text-sm text-gray-600 mb-2">Quick examples:</p>
        <div className="flex flex-wrap gap-2">
          {EXAMPLE_QUERIES.map((example, index) => (
            <button
              key={index}
              onClick={() => loadExample(example.sql)}
              className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors"
            >
              {example.name}
            </button>
          ))}
        </div>
      </div>

      {/* SQL Editor */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter your SQL query here... (Ctrl/Cmd + Enter to execute)"
          className="w-full h-64 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono text-sm resize-none overflow-x-auto overflow-y-auto"
          style={{ 
            scrollbarWidth: 'thin',
            scrollbarColor: '#CBD5E0 #F7FAFC'
          }}
          disabled={loading}
        />
        
        {/* Syntax highlighting overlay */}
        {sql && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-lg">
            <SyntaxHighlighter
              language="sql"
              style={tomorrow}
              customStyle={{
                margin: 0,
                padding: '12px 16px',
                background: 'transparent',
                fontSize: '14px',
                lineHeight: '1.5',
                overflow: 'visible',
              }}
              showLineNumbers={false}
            >
              {sql}
            </SyntaxHighlighter>
          </div>
        )}
      </div>

      {/* Execute Button */}
      <div className="flex items-center justify-between mt-4">
        <div className="text-sm text-gray-500">
          {sql.length} characters • Press Ctrl/Cmd + Enter to execute
        </div>
        <button
          onClick={handleExecute}
          disabled={loading || !sql.trim()}
          className="btn-primary flex items-center gap-2"
        >
          {loading ? 'Executing...' : 'Execute Query'}
        </button>
      </div>
    </div>
  )
}
