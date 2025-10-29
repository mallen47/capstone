import { ethers } from "ethers"
import Table from "react-bootstrap/Table"
import Pagination from "react-bootstrap/Pagination"
import Chart from "react-apexcharts"
import { chartSelector } from "../store/selectors"
import { options } from "./Charts.config"
import { useSelector, useDispatch } from "react-redux"
import { useEffect, useState } from "react"
import Loading from "./Loading"
import { loadAllSwaps } from "../store/interactions"

const Charts = () => {
  const provider = useSelector(state => state.provider.connection)
  const tokens = useSelector(state => state.tokens.contracts)
  const symbols = useSelector(state => state.tokens.symbols)
  const amm = useSelector(state => state.amm.contract)
  const chart = useSelector(chartSelector)
  const dispatch = useDispatch()

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  useEffect(() => {
    if (provider && amm) {
      loadAllSwaps(provider, amm, dispatch)
    }
  }, [provider, amm, dispatch])

  // Calculate pagination values
  const swaps = chart?.series?.[0]?.swaps || []
  const totalItems = swaps.length
  const totalPages = Math.ceil(totalItems / itemsPerPage)

  // Get current page items
  const indexOfLastItem = currentPage * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const currentSwaps = swaps.slice(indexOfFirstItem, indexOfLastItem)

  // Reset to page 1 if swaps change (e.g., network switch)
  useEffect(() => {
    setCurrentPage(1)
  }, [totalItems])

  // Page change handler
  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber)
  }

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages = []
    const maxPagesToShow = 5

    if (totalPages <= maxPagesToShow) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      // Show smart pagination with ellipsis
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i)
        pages.push('...')
        pages.push(totalPages)
      } else if (currentPage >= totalPages - 2) {
        pages.push(1)
        pages.push('...')
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i)
      } else {
        pages.push(1)
        pages.push('...')
        pages.push(currentPage - 1)
        pages.push(currentPage)
        pages.push(currentPage + 1)
        pages.push('...')
        pages.push(totalPages)
      }
    }

    return pages
  }

  return (
    <div>
      {provider && amm ? (
        <div>
          <div className="mb-4 p-3 bg-body-secondary rounded border">
            <Chart
              options={options}
              series={chart.series}
              type="line"
              width="100%"
              height="250"
            />
          </div>
          {/* Pagination Info */}
          {totalItems > 0 && (
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div className="text-muted">
                Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, totalItems)} of {totalItems} transactions
              </div>
            </div>
          )}

          <Table striped bordered hover>
            <thead>
              <tr>
                <th>Transaction Hash</th>
                <th>Token Give</th>
                <th>Amount Give</th>
                <th>Token Get</th>
                <th>Amount Get</th>
                <th>User</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {currentSwaps.length > 0 ? (
                currentSwaps.map((swap, index) => (
                  <tr key={index}>
                    <td>
                      {swap.hash.slice(0, 5) + "..." + swap.hash.slice(61, 66)}
                    </td>
                    <td>
                      {swap.args.tokenGive === tokens[0].address
                        ? symbols[0]
                        : symbols[1]}
                    </td>
                    <td>
                      {ethers.utils.formatUnits(
                        swap.args.tokenGiveAmount.toString(),
                        "ether"
                      )}
                    </td>
                    <td>
                      {swap.args.tokenGet === tokens[0].address
                        ? symbols[0]
                        : symbols[1]}
                    </td>
                    <td>
                      {ethers.utils.formatUnits(
                        swap.args.tokenGetAmount.toString(),
                        "ether"
                      )}
                    </td>
                    <td>
                      {swap.args.user.slice(0, 5) +
                        "..." +
                        swap.args.user.slice(38, 42)}
                    </td>
                    <td>
                      {new Date(
                        Number(swap.args.timestamp.toString() + "000")
                      ).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "numeric",
                        minute: "numeric",
                        second: "numeric",
                      })}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="text-center text-muted py-4">
                    No transactions found
                  </td>
                </tr>
              )}
            </tbody>
          </Table>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="d-flex justify-content-center mt-4">
              <Pagination>
                <Pagination.First
                  onClick={() => handlePageChange(1)}
                  disabled={currentPage === 1}
                />
                <Pagination.Prev
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                />

                {getPageNumbers().map((page, index) =>
                  page === '...' ? (
                    <Pagination.Ellipsis key={`ellipsis-${index}`} disabled />
                  ) : (
                    <Pagination.Item
                      key={page}
                      active={page === currentPage}
                      onClick={() => handlePageChange(page)}
                    >
                      {page}
                    </Pagination.Item>
                  )
                )}

                <Pagination.Next
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                />
                <Pagination.Last
                  onClick={() => handlePageChange(totalPages)}
                  disabled={currentPage === totalPages}
                />
              </Pagination>
            </div>
          )}
        </div>
      ) : (
        <Loading />
      )}
    </div>
  )
}

export default Charts
