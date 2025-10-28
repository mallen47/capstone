import { ethers } from "ethers"
import { useState, useEffect, useCallback } from "react"
import { useSelector } from "react-redux"
import Card from "react-bootstrap/Card"
import Form from "react-bootstrap/Form"
import Row from "react-bootstrap/Row"
import Col from "react-bootstrap/Col"
import Badge from "react-bootstrap/Badge"
import Button from "react-bootstrap/Button"
import Spinner from "react-bootstrap/Spinner"

const PoolStats = () => {
  const [poolData, setPoolData] = useState(null)
  const [currentPrice, setCurrentPrice] = useState(null)
  const [totalLiquidity, setTotalLiquidity] = useState(null)
  const [userLPValue, setUserLPValue] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showPoolDetails, setShowPoolDetails] = useState(false)
  const [showUserPosition, setShowUserPosition] = useState(false)
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
        // K value is reserve0 * reserve1 in wei, so it's in wei² units
        // Need to divide by 1e36 to get token² units (divide by 1e18 twice)
        kValue: parseFloat(ethers.utils.formatEther(kValue)) / 1e18,
      }

      setPoolData(formattedPoolData)
      setCurrentPrice(price)
      // Total liquidity is also K value in wei² units, needs same conversion
      setTotalLiquidity(
        parseFloat(ethers.utils.formatEther(liquidityResult)) / 1e18
      )

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
    <Card
      className="mx-auto px-4"
      style={{ maxWidth: "600px", margin: "50px auto" }}
    >
      <div style={{ paddingTop: "50px", paddingBottom: "50px" }}>
        {/* Header with Live Badge */}
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h5 className="mb-0">Pool Analytics</h5>
          <Badge bg="success" className="d-flex align-items-center gap-1">
            <i className="bi bi-circle-fill" style={{ fontSize: "0.5em" }}></i>
            Live
          </Badge>
        </div>

        {/* Key Metrics Summary */}
        {currentPrice && (
          <div className="border rounded p-3 mb-3 bg-light text-center">
            <Form.Label className="small text-muted mb-2">
              <strong>Current Exchange Rate</strong>
            </Form.Label>
            <div className="h4 mb-1 text-primary">
              1 {symbols[0]} = {currentPrice.toFixed(6)} {symbols[1]}
            </div>
            <div className="text-muted small">
              1 {symbols[1]} = {(1 / currentPrice).toFixed(6)} {symbols[0]}
            </div>
          </div>
        )}

        {/* Pool Details Section */}
        <Row className="mt-3 mb-3">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <small className="text-muted">
              <strong>Total Liquidity:</strong>{" "}
              {totalLiquidity.toLocaleString()} (K Value)
            </small>
            <Button
              size="sm"
              variant="outline-secondary"
              onClick={() => setShowPoolDetails(!showPoolDetails)}
              className="d-flex align-items-center gap-1 py-1 px-2"
              style={{ fontSize: "0.813rem" }}
            >
              <i className="bi bi-bar-chart-line"></i>
              <span>{showPoolDetails ? "Hide" : "Details"}</span>
            </Button>
          </div>

          {showPoolDetails && (
            <div className="border rounded my-2 p-3 mb-2 bg-light">
              <Form.Label className="small">
                <strong>Pool Reserves</strong>
              </Form.Label>
              <Row className="mb-2">
                <Col xs={6}>
                  <small className="text-muted">{symbols[0]} Reserve:</small>
                </Col>
                <Col xs={6} className="text-end">
                  <strong>{poolData.reserve0.toLocaleString()}</strong>
                </Col>
              </Row>
              <Row className="mb-3">
                <Col xs={6}>
                  <small className="text-muted">{symbols[1]} Reserve:</small>
                </Col>
                <Col xs={6} className="text-end">
                  <strong>{poolData.reserve1.toLocaleString()}</strong>
                </Col>
              </Row>

              <hr className="my-3" />

              <Form.Label className="small">
                <strong>Pool Metrics</strong>
              </Form.Label>
              <Row className="mb-2">
                <Col xs={7}>
                  <small className="text-muted">Total LP Shares:</small>
                </Col>
                <Col xs={5} className="text-end">
                  <small>{poolData.totalShares.toLocaleString()}</small>
                </Col>
              </Row>
              <Row className="mb-2">
                <Col xs={7}>
                  <small className="text-muted">K Value (x*y):</small>
                </Col>
                <Col xs={5} className="text-end">
                  <small>{poolData.kValue.toLocaleString()}</small>
                </Col>
              </Row>
              <Row className="mb-2">
                <Col xs={7}>
                  <small className="text-muted">Est. Pool Value:</small>
                </Col>
                <Col xs={5} className="text-end">
                  <small>
                    ~
                    {(
                      (poolData.reserve0 +
                        poolData.reserve1 * (currentPrice || 1)) /
                      1000
                    ).toFixed(1)}
                    K {symbols[1]}
                  </small>
                </Col>
              </Row>
            </div>
          )}
        </Row>

        {/* User Position Section */}
        {userLPValue && (
          <Row className="mt-3 mb-3">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <small className="text-muted">
                <strong>Your Position:</strong>{" "}
                {((parseFloat(shares) / poolData.totalShares) * 100).toFixed(2)}
                % of pool
              </small>
              <Button
                size="sm"
                variant="outline-secondary"
                onClick={() => setShowUserPosition(!showUserPosition)}
                className="d-flex align-items-center gap-1 py-1 px-2"
                style={{ fontSize: "0.813rem" }}
              >
                <i className="bi bi-wallet2"></i>
                <span>{showUserPosition ? "Hide" : "Details"}</span>
              </Button>
            </div>

            {showUserPosition && (
              <div className="border rounded my-2 p-3 mb-2 bg-light">
                <Form.Label className="small">
                  <strong>Your LP Token Value</strong>
                </Form.Label>
                <Row className="mb-2">
                  <Col xs={6}>
                    <small className="text-muted">{symbols[0]}:</small>
                  </Col>
                  <Col xs={6} className="text-end">
                    <strong>{userLPValue.token1.toFixed(6)}</strong>
                  </Col>
                </Row>
                <Row className="mb-3">
                  <Col xs={6}>
                    <small className="text-muted">{symbols[1]}:</small>
                  </Col>
                  <Col xs={6} className="text-end">
                    <strong>{userLPValue.token2.toFixed(6)}</strong>
                  </Col>
                </Row>

                <hr className="my-3" />

                <Row className="mb-2">
                  <Col xs={6}>
                    <small className="text-muted">Your LP Shares:</small>
                  </Col>
                  <Col xs={6} className="text-end">
                    <small>{parseFloat(shares).toFixed(4)}</small>
                  </Col>
                </Row>
                <Row className="mb-2">
                  <Col xs={6}>
                    <small className="text-muted">Pool Ownership:</small>
                  </Col>
                  <Col xs={6} className="text-end">
                    <small>
                      {(
                        (parseFloat(shares) / poolData.totalShares) *
                        100
                      ).toFixed(4)}
                      %
                    </small>
                  </Col>
                </Row>
              </div>
            )}
          </Row>
        )}
      </div>
    </Card>
  )
}

export default PoolStats
