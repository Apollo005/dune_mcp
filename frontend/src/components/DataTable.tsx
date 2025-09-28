import React, { useState, useMemo } from 'react'
import toast from 'react-hot-toast'

interface DataTableProps {
  data: any[]
  metadata?: any
  loading?: boolean
}

export const DataTable: React.FC<DataTableProps> = ({ data, metadata, loading = false }) => {
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState('')
  const [viewMode, setViewMode] = useState<'table' | 'analyze'>('table')
  const [chartType, setChartType] = useState<'bar' | 'line' | 'pie'>('bar')
  const [hoveredPoint, setHoveredPoint] = useState<{count: number, dayLabel: string} | null>(null)
  const [mousePosition, setMousePosition] = useState<{x: number, y: number} | null>(null)

  // Initialize visible columns when data changes
  React.useEffect(() => {
    if (data.length > 0) {
      const columns = Object.keys(data[0])
      setVisibleColumns(new Set(columns.slice(0, 5))) // Show first 5 columns by default
    }
  }, [data])

  const columns = useMemo(() => {
    if (data.length === 0) return []
    return Object.keys(data[0])
  }, [data])

  const filteredData = useMemo(() => {
    if (!searchTerm) return data
    
    return data.filter(row =>
      Object.values(row).some(value =>
        String(value).toLowerCase().includes(searchTerm.toLowerCase())
      )
    )
  }, [data, searchTerm])

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    const endIndex = startIndex + pageSize
    return filteredData.slice(startIndex, endIndex)
  }, [filteredData, currentPage, pageSize])

  const totalPages = Math.ceil(filteredData.length / pageSize)

  const toggleColumn = (column: string) => {
    const newVisibleColumns = new Set(visibleColumns)
    if (newVisibleColumns.has(column)) {
      newVisibleColumns.delete(column)
    } else {
      newVisibleColumns.add(column)
    }
    setVisibleColumns(newVisibleColumns)
  }

  const exportToCSV = () => {
    if (data.length === 0) {
      toast.error('No data to export')
      return
    }

    const visibleData = data.map(row => {
      const filteredRow: any = {}
      visibleColumns.forEach(column => {
        filteredRow[column] = row[column]
      })
      return filteredRow
    })

    const csvContent = [
      Object.keys(visibleData[0]).join(','),
      ...visibleData.map(row =>
        Object.values(row).map(value =>
          typeof value === 'string' && value.includes(',')
            ? `"${value}"`
            : value
        ).join(',')
      )
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `query-results-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    toast.success('Data exported to CSV')
  }

  // Get numeric columns for charting
  const numericColumns = useMemo(() => {
    if (data.length === 0) return []
    return columns.filter(col => {
      const sampleValues = data.slice(0, 10).map(row => row[col])
      return sampleValues.every(val => 
        val !== null && val !== undefined && !isNaN(Number(val))
      )
    })
  }, [columns, data])

  // Get categorical columns for grouping
  const categoricalColumns = useMemo(() => {
    if (data.length === 0) return []
    return columns.filter(col => {
      const sampleValues = data.slice(0, 10).map(row => row[col])
      return sampleValues.every(val => 
        val !== null && val !== undefined && typeof val === 'string'
      )
    })
  }, [columns, data])

  // Get datetime columns for time series analysis
  const datetimeColumns = useMemo(() => {
    if (data.length === 0) return []
    return columns.filter(col => {
      const sampleValues = data.slice(0, 10).map(row => row[col])
      return sampleValues.some(val => {
        if (val === null || val === undefined) return false
        const date = new Date(val)
        return !isNaN(date.getTime())
      })
    })
  }, [columns, data])

  const renderChart = () => {
    // Analyze actual data for frequency distribution
    const analyzeStringColumn = () => {
      if (categoricalColumns.length === 0) {
        return { categories: [], frequencies: [], selectedColumn: null }
      }
      
      const selectedColumn = categoricalColumns[0] // Use first categorical column
      const valueCounts: { [key: string]: number } = {}
      
      // Count frequency of each string value
      data.forEach(row => {
        const value = String(row[selectedColumn] || 'Unknown')
        valueCounts[value] = (valueCounts[value] || 0) + 1
      })
      
      // Sort by frequency (descending) and limit to top 10
      const sortedEntries = Object.entries(valueCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
      
      const categories = sortedEntries.map(([category]) => category)
      const frequencies = sortedEntries.map(([,freq]) => freq)
      
      return { categories, frequencies, selectedColumn }
    }

    // Analyze datetime data for time series
    const analyzeDateTimeData = () => {
      if (datetimeColumns.length === 0) {
        return { timeSeriesData: [], selectedColumn: null, timeRange: null }
      }
      
      const selectedColumn = datetimeColumns[0] // Use first datetime column
      const dateCounts: { [key: string]: number } = {}
      
      // Count occurrences by date (grouped by day)
      data.forEach(row => {
        const dateValue = row[selectedColumn]
        if (dateValue) {
          const date = new Date(dateValue)
          if (!isNaN(date.getTime())) {
            // Group by day (YYYY-MM-DD format)
            const dayKey = date.toISOString().split('T')[0]
            dateCounts[dayKey] = (dateCounts[dayKey] || 0) + 1
          }
        }
      })
      
      // Convert to time series data and sort by date
      const timeSeriesData = Object.entries(dateCounts)
        .map(([date, count]) => ({
          date: new Date(date),
          count: count,
          dayLabel: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        }))
        .sort((a, b) => a.date.getTime() - b.date.getTime())
      
      const timeRange = timeSeriesData.length > 0 ? {
        start: timeSeriesData[0].date,
        end: timeSeriesData[timeSeriesData.length - 1].date
      } : null
      
      return { timeSeriesData, selectedColumn, timeRange }
    }

    const { categories, frequencies, selectedColumn } = analyzeStringColumn()
    const { timeSeriesData, selectedColumn: timeColumn, timeRange } = analyzeDateTimeData()
    const maxFreq = frequencies.length > 0 ? Math.max(...frequencies) : 0
    const maxCount = timeSeriesData.length > 0 ? Math.max(...timeSeriesData.map(d => d.count)) : 0
    const minCount = timeSeriesData.length > 0 ? Math.min(...timeSeriesData.map(d => d.count)) : 0

    return (
      <div className="h-full flex flex-col">
        <div className="mb-4 flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700">Chart Type:</label>
          <select
            value={chartType}
            onChange={(e) => setChartType(e.target.value as 'bar' | 'line' | 'pie')}
            className="px-3 py-1 border border-gray-300 rounded text-sm"
          >
            <option value="bar">Frequency Chart</option>
            <option value="line">Line Plot</option>
            <option value="pie">Distribution</option>
          </select>
        </div>
        
        <div className="flex-1 overflow-auto">
          {chartType === 'bar' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-lg font-semibold text-gray-800">Frequency Distribution</h4>
                {selectedColumn && (
                  <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                    Column: {selectedColumn}
                  </span>
                )}
              </div>
              
              {categories.length === 0 ? (
                <div className="flex items-center justify-center h-64 text-gray-500">
                  <div className="text-center">
                    <div className="text-4xl mb-2"></div>
                    <p>No string data available for frequency analysis</p>
                    <p className="text-sm">Frequency charts work with text/categorical columns</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {categories.map((category, index) => {
                    const frequency = frequencies[index]
                    const percentage = maxFreq > 0 ? (frequency / maxFreq) * 100 : 0
                    return (
                      <div key={index} className="flex items-center gap-4">
                        <div className="w-32 text-sm text-gray-700 font-medium truncate" title={category}>
                          {category}
                        </div>
                        <div className="flex-1 bg-gray-200 rounded-full h-4 relative">
                          <div
                            className="bg-gradient-to-r from-blue-500 to-blue-600 h-4 rounded-full transition-all duration-500 flex items-center justify-end pr-3"
                            style={{ width: `${percentage}%` }}
                          >
                            <span className="text-white text-xs font-medium">
                              {frequency}
                            </span>
                          </div>
                        </div>
                        <div className="w-12 text-sm text-gray-600 text-right">
                          {percentage.toFixed(1)}%
                        </div>
                      </div>
                    )
                  })}
                  
                  {/* Summary stats */}
                  <div className="mt-6 pt-4 border-t border-gray-200">
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="text-center">
                        <div className="font-semibold text-gray-800">{data.length}</div>
                        <div className="text-gray-500">Total Records</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-gray-800">{categories.length}</div>
                        <div className="text-gray-500">Unique Values</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-gray-800">{maxFreq}</div>
                        <div className="text-gray-500">Most Frequent</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {chartType === 'line' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-lg font-semibold text-gray-800">Time Series Analysis</h4>
                {timeColumn && (
                  <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                    Column: {timeColumn}
                  </span>
                )}
              </div>
              
              {timeSeriesData.length === 0 ? (
                <div className="flex items-center justify-center h-64 text-gray-500">
                  <div className="text-center">
                    <div className="text-4xl mb-2"></div>
                    <p>No datetime data available for time series analysis</p>
                    <p className="text-sm">Time series charts work with date/timestamp columns</p>
                  </div>
                </div>
              ) : (
                <div className="relative h-80 bg-white border border-gray-200 rounded-lg p-4">
                  {/* Y-axis labels */}
                  <div className="absolute left-2 top-4 bottom-4 w-12 flex flex-col justify-between text-sm text-gray-600 font-medium">
                    <span>{maxCount}</span>
                    <span>{Math.round((maxCount + minCount) / 2)}</span>
                    <span>{minCount}</span>
                  </div>
                  
                  {/* Chart area with proper margins */}
                  <div className="ml-16 mr-4 mt-2 mb-6 h-full relative">
                    {/* Grid lines */}
                    <div className="absolute inset-0">
                      {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
                        <div
                          key={i}
                          className="absolute w-full border-t border-gray-100"
                          style={{ top: `${ratio * 100}%` }}
                        />
                      ))}
                    </div>
                    
                    {/* Interactive Line plot */}
                    <svg 
                      className="absolute inset-0 w-full h-full" 
                      viewBox="0 0 100 100" 
                      preserveAspectRatio="none"
                    >
                      {/* Visible thin line */}
                      {timeSeriesData.length > 1 && (
                        <polyline
                          fill="none"
                          stroke="#3B82F6"
                          strokeWidth="0.5"
                          points={timeSeriesData.map((point, index) => {
                            const x = (index / (timeSeriesData.length - 1)) * 100
                            const y = maxCount > minCount ? 100 - ((point.count - minCount) / (maxCount - minCount)) * 100 : 50
                            return `${x},${y}`
                          }).join(' ')}
                        />
                      )}
                      
                      {/* Interactive data points with hover */}
                      {timeSeriesData.map((point, index) => {
                        const x = (index / (timeSeriesData.length - 1)) * 100
                        const y = maxCount > minCount ? 100 - ((point.count - minCount) / (maxCount - minCount)) * 100 : 50
                        
                        return (
                          <g key={index}>
                            {/* Large invisible hover area */}
                            <circle
                              cx={x}
                              cy={y}
                              r="8"
                              fill="transparent"
                              className="cursor-pointer"
                              onMouseEnter={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect()
                                setMousePosition({ x: e.clientX, y: e.clientY })
                                setHoveredPoint({ count: point.count, dayLabel: point.dayLabel })
                              }}
                              onMouseLeave={() => {
                                setHoveredPoint(null)
                                setMousePosition(null)
                              }}
                            />
                            {/* Visible data point */}
                            <circle
                              cx={x}
                              cy={y}
                              r="1.5"
                              fill="#3B82F6"
                              stroke="#ffffff"
                              strokeWidth="0.5"
                            />
                          </g>
                        )
                      })}
                    </svg>
                    
                    {/* Hover tooltip */}
                    {hoveredPoint && mousePosition && (
                      <div 
                        className="fixed bg-gray-800 text-white text-xs px-2 py-1 rounded shadow-lg pointer-events-none z-50"
                        style={{
                          left: mousePosition.x - 20,
                          top: mousePosition.y - 30,
                        }}
                      >
                        <div className="font-medium">{hoveredPoint.dayLabel}</div>
                        <div>Count: {hoveredPoint.count}</div>
                      </div>
                    )}
                    
                    {/* X-axis labels */}
                    <div className="absolute -bottom-4 left-0 right-0 flex justify-between text-xs text-gray-500">
                      {timeSeriesData.length > 0 && (
                        <>
                          <span className="text-center">{timeSeriesData[0].dayLabel}</span>
                          {timeSeriesData.length > 2 && (
                            <span className="text-center">{timeSeriesData[Math.floor(timeSeriesData.length / 2)].dayLabel}</span>
                          )}
                          <span className="text-center">{timeSeriesData[timeSeriesData.length - 1].dayLabel}</span>
                        </>
                      )}
                    </div>
                  </div>
                  
                  
                  {/* Interactive legend */}
                  <div className="absolute top-2 right-2 bg-white bg-opacity-90 rounded px-2 py-1 text-xs text-gray-600">
                    Hover points for details
                  </div>
                </div>
              )}
            </div>
          )}
          
          {chartType === 'pie' && (
            <div className="space-y-4">
              <h4 className="text-lg font-semibold text-gray-800 mb-4">Data Distribution</h4>
              <div className="flex items-center justify-center h-64">
                {(() => {
                  // Find the first string/categorical column
                  const stringColumn = data.length > 0 ? Object.keys(data[0]).find(key => 
                    typeof data[0][key] === 'string' && data[0][key] !== ''
                  ) : null
                  
                  if (!stringColumn) {
                    return (
                      <div className="text-center text-gray-500 text-sm">
                        No string columns found for distribution
                      </div>
                    )
                  }
                  
                  // Count values in the string column
                  const valueCounts: Record<string, number> = {}
                  data.forEach(row => {
                    const value = String(row[stringColumn] || 'Unknown')
                    valueCounts[value] = (valueCounts[value] || 0) + 1
                  })
                  
                  // Sort by frequency (descending) and limit to top 4 for pie chart
                  const sortedEntries = Object.entries(valueCounts)
                    .sort(([,a], [,b]) => b - a)
                    .slice(0, 4)
                  
                  const totalRecords = data.length
                  const colors = ['bg-blue-500', 'bg-blue-400', 'bg-blue-300', 'bg-blue-200']
                  
                  return (
                    <div className="text-center">
                      <div className="w-48 h-48 mx-auto mb-4 relative">
                        {/* Simple pie chart representation */}
                        <div className="w-full h-full rounded-full border-8 border-blue-200 relative overflow-hidden">
                          <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full"></div>
                          <div className="absolute inset-2 bg-white rounded-full flex items-center justify-center">
                            <div className="text-center">
                              <div className="text-2xl font-bold text-gray-800">{totalRecords}</div>
                              <div className="text-sm text-gray-600">Total Records</div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        {sortedEntries.map(([value, count], index) => {
                          const percentage = ((count / totalRecords) * 100).toFixed(1)
                          return (
                            <div key={value} className="flex items-center gap-2">
                              <div className={`w-3 h-3 ${colors[index] || 'bg-gray-400'} rounded-full`}></div>
                              <span className="truncate max-w-[100px]" title={value}>
                                {value}: {percentage}%
                              </span>
                            </div>
                          )
                        })}
                        {Object.keys(valueCounts).length > 4 && (
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                            <span>Others: {((Object.keys(valueCounts).length - 4) / totalRecords * 100).toFixed(1)}%</span>
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-2">
                        Column: <span className="font-medium">{stringColumn}</span>
                      </div>
                    </div>
                  )
                })()}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="card">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="card">
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Data Available</h3>
          <p className="text-gray-500">Execute a query to see results here</p>
        </div>
      </div>
    )
  }

  return (
    <div className="card flex flex-col h-[calc(100vh-200px)]">
      {/* Header Section */}
      <div className="flex items-center justify-between mb-6 flex-shrink-0">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Query Results</h3>
          <p className="text-sm text-gray-500">
            {filteredData.length} rows • {visibleColumns.size} of {columns.length} columns visible
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'table'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Table View"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0V4a1 1 0 011-1h16a1 1 0 011 1v16a1 1 0 01-1 1H4a1 1 0 01-1-1z" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('analyze')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'analyze'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Analysis View"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </button>
          </div>
          <button
            onClick={exportToCSV}
            className="btn-secondary flex items-center gap-2"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Conditional Content Based on View Mode */}
      {viewMode === 'table' ? (
        <>
          {/* Search and Column Controls */}
          <div className="flex flex-col sm:flex-row gap-4 mb-4 flex-shrink-0">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search in results..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-field"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Show:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value={10}>10 rows</option>
                <option value={25}>25 rows</option>
                <option value={50}>50 rows</option>
                <option value={100}>100 rows</option>
              </select>
            </div>
          </div>

          {/* Column Visibility Toggle */}
          <div className="mb-4 flex-shrink-0">
            <div className="flex flex-wrap gap-2">
              {columns.map(column => (
                <button
                  key={column}
                  onClick={() => toggleColumn(column)}
                  className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-md transition-colors ${
                    visibleColumns.has(column)
                      ? 'bg-primary-100 text-primary-800 border border-primary-200'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {visibleColumns.has(column) ? '✓' : '✗'}
                  {column}
                </button>
              ))}
            </div>
          </div>

          {/* Scrollable Table Container */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="flex-1 overflow-auto border border-gray-200 rounded-lg">
              <table className="w-full">
                <thead className="sticky top-0 bg-white z-10">
                  <tr className="border-b border-gray-200">
                    {columns.filter(col => visibleColumns.has(col)).map(column => (
                      <th
                        key={column}
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-white"
                      >
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {paginatedData.map((row, rowIndex) => (
                    <tr key={rowIndex} className="hover:bg-gray-50">
                      {columns.filter(col => visibleColumns.has(col)).map(column => (
                        <td
                          key={column}
                          className="px-4 py-3 text-sm text-gray-900 max-w-xs truncate"
                          title={String(row[column])}
                        >
                          {row[column] !== null && row[column] !== undefined
                            ? String(row[column])
                            : <span className="text-gray-400 italic">null</span>
                          }
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination - Fixed at bottom */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200 flex-shrink-0">
                <div className="text-sm text-gray-500">
                  Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, filteredData.length)} of {filteredData.length} results
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ←
                  </button>
                  <span className="text-sm text-gray-600">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    →
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        /* Chart Analysis View */
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-auto border border-gray-200 rounded-lg p-6">
            {renderChart()}
          </div>
        </div>
      )}
    </div>
  )
}
