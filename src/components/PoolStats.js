import { ethers } from "ethers"
import { useState, useEffect, useCallback } from "react"
import { useSelector } from "react-redux"
import Card from "react-bootstrap/Card"
import Row from "react-bootstrap/Row"
import Col from "react-bootstrap/Col"
import Badge from "react-bootstrap/Badge"
import Spinner from "react-bootstrap/Spinner"

const PoolStats = () => {
  const [poolData, setPoolData] = useState(null)
  const [currentPrice, setCurrentPrice] = useState(null)
  const [totalLiquidity, setTotalLiquidity] = useState(null)
  const [userLPValue, setUserLPValue] = useState(null)
  const [loading, setLoading] = useState(true)

  const provider = useSelector(state => state.provider.connection)
  const account = useSelector(state => state.provider.account)
  const tokens = useSelector(state => state.tokens.contracts)
  const symbols = useSelector(state => state.tokens.symbols)
  const amm = useSelector(state => state.amm.contract)
  const shares = useSelector(state => state.amm.shares)

  // Fetch comprehensive pool information
  const fetchPoolData = useCallback(async () => {
    if (!amm || !tokens || !symbols) return

    try {
      setLoading(true)

      // Use getPoolInfo() for efficient single call
      const poolInfo = await amm.getPoolInfo()
      const [reserve0, reserve1, totalShares_, kValue] = poolInfo

      // Get current price using getPrice()
      let price = null
      try {
        const priceResult = await amm.getPrice()
        price = parseFloat(ethers.utils.formatEther(priceResult))
      } catch (error) {
        // Pool might not be initialized
        console.log("Pool not initialized for price data")
      }

      // Get total liquidity using getTotalLiquidity()
      const liquidityResult = await amm.getTotalLiquidity()

      // Format pool data
      const formattedPoolData = {
        reserve0: parseFloat(ethers.utils.formatEther(reserve0)),
        reserve1: parseFloat(ethers.utils.formatEther(reserve1)),
        totalShares: parseFloat(ethers.utils.formatEther(totalShares_)),
        kValue: parseFloat(ethers.utils.formatEther(kValue)),
      }

      setPoolData(formattedPoolData)
      setCurrentPrice(price)
      setTotalLiquidity(parseFloat(ethers.utils.formatEther(liquidityResult)))

      // Get user LP token value if user has shares
      if (account && shares && parseFloat(shares) > 0) {
        const userShares = ethers.utils.parseEther(shares.toString())
        const lpValue = await amm.getLPTokenValue(userShares)
        const [token1Amount, token2Amount] = lpValue

        setUserLPValue({
          token1: parseFloat(ethers.utils.formatEther(token1Amount)),
          token2: parseFloat(ethers.utils.formatEther(token2Amount)),
        })
      } else {
        setUserLPValue(null)
      }
    } catch (error) {
      console.error("Error fetching pool data:", error)
    } finally {
      setLoading(false)
    }
  }, [amm, tokens, symbols, account, shares])

  useEffect(() => {
    fetchPoolData()

    // Refresh pool data every 30 seconds
    const interval = setInterval(fetchPoolData, 30000)
    return () => clearInterval(interval)
  }, [fetchPoolData])

  if (loading) {
    return (
      <Card className="mx-auto mb-4" style={{ maxWidth: "600px" }}>
        <Card.Body className="text-center">
          <Spinner animation="border" />
          <div className="mt-2">Loading Pool Analytics...</div>
        </Card.Body>
      </Card>
    )
  }

  if (!poolData || !poolData.totalShares || poolData.totalShares === 0) {
    return (
      <Card className="mx-auto mb-4" style={{ maxWidth: "600px" }}>
        <Card.Body className="text-center">
          <h5>Pool Not Initialized</h5>
          <p className="text-muted">
            Add liquidity to start the pool and see analytics data.
          </p>
        </Card.Body>
      </Card>
    )
  }

  return (
    <Card className="mx-auto mb-4" style={{ maxWidth: "600px" }}>
      <Card.Header>
        <div className="d-flex justify-content-between align-items-center">
          <h5 className="mb-0">Pool Analytics</h5>
          <Badge bg="success">Live Data</Badge>
        </div>
      </Card.Header>
      <Card.Body>
        {/* Current Price Display */}
        {currentPrice && (
          <Row className="mb-3">
            <Col className="text-center">
              <div className="border rounded p-3 bg-light">
                <h6 className="text-muted mb-1">Current Exchange Rate</h6>
                <div className="h4 mb-1">
                  1 {symbols[0]} = {currentPrice.toFixed(6)} {symbols[1]}
                </div>
                <div className="text-muted small">
                  1 {symbols[1]} = {(1 / currentPrice).toFixed(6)} {symbols[0]}
                </div>
              </div>
            </Col>
          </Row>
        )}

        {/* Pool Reserves */}
        <Row className="mb-3">
          <Col md={6}>
            <div className="text-center p-2">
              <div className="h5 text-primary">
                {poolData.reserve0.toLocaleString()}
              </div>
              <div className="text-muted">{symbols[0]} Reserve</div>
            </div>
          </Col>
          <Col md={6}>
            <div className="text-center p-2">
              <div className="h5 text-primary">
                {poolData.reserve1.toLocaleString()}
              </div>
              <div className="text-muted">{symbols[1]} Reserve</div>
            </div>
          </Col>
        </Row>

        {/* Pool Metrics */}
        <Row className="mb-3">
          <Col md={4}>
            <div className="text-center p-2">
              <div className="h6">{poolData.totalShares.toLocaleString()}</div>
              <div className="text-muted small">Total LP Shares</div>
            </div>
          </Col>
          <Col md={4}>
            <div className="text-center p-2">
              <div className="h6">{totalLiquidity.toLocaleString()}</div>
              <div className="text-muted small">Pool Liquidity (K)</div>
            </div>
          </Col>
          <Col md={4}>
            <div className="text-center p-2">
              <div className="h6">
                {(
                  (poolData.reserve0 +
                    poolData.reserve1 * (currentPrice || 1)) /
                  1000
                ).toFixed(1)}
                K
              </div>
              <div className="text-muted small">Est. Pool Value</div>
            </div>
          </Col>
        </Row>

        {/* User LP Position */}
        {userLPValue && (
          <Row>
            <Col>
              <div className="border rounded p-3 bg-success bg-opacity-10">
                <h6 className="mb-2">Your LP Position</h6>
                <div className="d-flex justify-content-between">
                  <span>
                    {userLPValue.token1.toFixed(4)} {symbols[0]}
                  </span>
                  <span>
                    {userLPValue.token2.toFixed(4)} {symbols[1]}
                  </span>
                </div>
                <div className="text-muted small mt-1">
                  LP Shares: {shares} (
                  {((parseFloat(shares) / poolData.totalShares) * 100).toFixed(
                    2
                  )}
                  % of pool)
                </div>
              </div>
            </Col>
          </Row>
        )}
      </Card.Body>
    </Card>
  )
}

export default PoolStats
