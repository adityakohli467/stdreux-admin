/**
 * Utility function to print only table data from the current page
 * Hides all non-table elements and prints only the table
 */
export function printTableData(pageTitle: string = "Table Data") {
  // Find the table element - look for common table containers
  const tableElement = document.querySelector('.overflow-x-auto table, table, [role="table"]') as HTMLTableElement
  
  if (!tableElement) {
    console.warn('No table found to print')
    globalThis.print() // Fallback to regular print
    return
  }

  // Store original display styles to restore later
  const elementsToHide: Array<{ element: HTMLElement; originalDisplay: string }> = []
  const elementsToShow: Array<{ element: HTMLElement; originalDisplay: string }> = []
  
  // Find all elements that should be hidden (everything except the table)
  const allElements = document.querySelectorAll('body > *')
  
  for (const el of allElements) {
    const htmlEl = el as HTMLElement
    // Skip the table container and its parents
    if (tableElement.contains(htmlEl) || htmlEl.contains(tableElement)) {
      continue
    }
    const originalDisplay = globalThis.getComputedStyle(htmlEl).display
    if (originalDisplay !== 'none') {
      elementsToHide.push({ element: htmlEl, originalDisplay })
      htmlEl.style.display = 'none'
    }
  }
  
  // Also hide elements with no-print class
  const noPrintElements = document.querySelectorAll('.no-print')
  for (const el of noPrintElements) {
    const htmlEl = el as HTMLElement
    const originalDisplay = globalThis.getComputedStyle(htmlEl).display
    if (originalDisplay !== 'none') {
      elementsToHide.push({ element: htmlEl, originalDisplay })
      htmlEl.style.display = 'none'
    }
  }
  
  // Clone the table to clean it without modifying the original
  const clonedTable = tableElement.cloneNode(true) as HTMLTableElement
  
  // Remove action buttons and columns from cloned table
  const actionHeaders = clonedTable.querySelectorAll('thead th:last-child')
  const actionCells = clonedTable.querySelectorAll('tbody td:last-child')
  
  // Check if last column contains buttons (likely actions column)
  for (const header of actionHeaders) {
    const headerText = header.textContent?.toLowerCase() || ''
    if (headerText.includes('action') || header.querySelector('button')) {
      header.remove()
    }
  }
  
  for (const cell of actionCells) {
    if (cell.querySelector('button')) {
      cell.remove()
    }
  }
  
  // Remove any remaining buttons from cells
  const buttonsToRemove = clonedTable.querySelectorAll('button, .no-print')
  for (const el of buttonsToRemove) {
    el.remove()
  }
  
  // Create a temporary print container
  const printContainer = document.createElement('div')
  printContainer.id = 'print-container-temp'
  printContainer.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: white;
    z-index: 99999;
    padding: 20px;
    overflow: auto;
  `
  
  const today = new Date().toLocaleDateString('en-AU', { 
    day: '2-digit', 
    month: 'short', 
    year: 'numeric' 
  })
  
  // Create title and date elements
  const titleEl = document.createElement('h1')
  titleEl.textContent = pageTitle
  titleEl.style.cssText = `
    color: #212529;
    margin-bottom: 10px;
    font-size: 24px;
    font-weight: 600;
    font-family: 'Albert Sans', Arial, sans-serif;
  `
  
  const dateEl = document.createElement('div')
  dateEl.textContent = `Printed on: ${today}`
  dateEl.style.cssText = `
    color: #6c757d;
    margin-bottom: 20px;
    font-size: 14px;
    font-family: 'Albert Sans', Arial, sans-serif;
  `
  
  // Style the cloned table
  clonedTable.style.cssText = `
    width: 100%;
    border-collapse: collapse;
    margin-top: 20px;
    font-size: 11px;
    font-family: 'Albert Sans', Arial, sans-serif;
    table-layout: fixed;
  `
  
  // Style table headers and cells
  const style = document.createElement('style')
  style.id = 'print-table-styles'
  style.textContent = `
    #print-container-temp table {
      table-layout: fixed;
      width: 100%;
    }
    #print-container-temp th {
      background-color: #f8f9fa !important;
      font-weight: 600;
      padding: 8px 6px;
      text-align: left;
      border: 1px solid #dee2e6;
      color: #212529;
      white-space: normal !important;
      word-break: break-word;
      overflow-wrap: anywhere;
    }
    #print-container-temp td {
      padding: 8px 6px;
      border: 1px solid #dee2e6;
      color: #495057;
      white-space: normal !important;
      word-break: break-word;
      overflow-wrap: anywhere;
    }
    #print-container-temp tr:nth-child(even) {
      background-color: #f8f9fa;
    }
    @media print {
      body > *:not(#print-container-temp) {
        display: none !important;
      }
      #print-container-temp {
        position: static !important;
        width: 100% !important;
        height: auto !important;
        padding: 0 !important;
        margin: 0 !important;
      }
      @page {
        margin: 1cm;
        size: landscape;
      }
    }
  `
  document.head.appendChild(style)
  
  // Assemble the print container
  printContainer.appendChild(titleEl)
  printContainer.appendChild(dateEl)
  printContainer.appendChild(clonedTable)
  document.body.appendChild(printContainer)
  
  // Function to clean up after printing
  const cleanup = () => {
    // Remove print container
    printContainer.remove()
    
    // Remove print styles
    const printStyle = document.getElementById('print-table-styles')
    if (printStyle) {
      printStyle.remove()
    }
    
    // Restore hidden elements
    for (const { element, originalDisplay } of elementsToHide) {
      element.style.display = originalDisplay
    }
  }
  
  // Handle print completion
  const handleAfterPrint = () => {
    cleanup()
    globalThis.removeEventListener('afterprint', handleAfterPrint)
  }
  
  globalThis.addEventListener('afterprint', handleAfterPrint)
  
  // Trigger print after a short delay to ensure DOM is ready
  setTimeout(() => {
    globalThis.print()
    // Fallback cleanup in case afterprint doesn't fire
    setTimeout(cleanup, 1000)
  }, 100)
}

