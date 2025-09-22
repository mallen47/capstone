import { toast } from 'react-toastify'
import React from 'react'

// Custom toast content component for transaction-related toasts
const ToastContent = ({ message, txHash, showTxHash = true }) => (
  <div>
    <div className="fw-bold mb-1">{message}</div>
    {txHash && showTxHash && (
      <div>
        <small className="text-muted">Transaction: </small>
        <a
          href={`https://sepolia.etherscan.io/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-decoration-none"
          onClick={(e) => e.stopPropagation()} // Prevent toast from closing when clicking link
        >
          {`${txHash.slice(0, 6)}...${txHash.slice(-4)}`}
        </a>
      </div>
    )}
  </div>
)

// Success toast - auto-dismisses after 3 seconds with slide animation
export const showSuccessToast = (message, txHash = null) => {
  toast.success(<ToastContent message={message} txHash={txHash} />, {
    autoClose: 3000,
    transition: toast.TRANSITIONS.SLIDE,
    className: 'toast-success',
  })
}

// Info toast - manual dismiss, no animation
export const showInfoToast = (message, txHash = null) => {
  toast.info(<ToastContent message={message} txHash={txHash} showTxHash={false} />, {
    autoClose: false,
    closeButton: true,
    className: 'toast-info',
  })
}

// Error toast - manual dismiss, no animation  
export const showErrorToast = (message, txHash = null) => {
  toast.error(<ToastContent message={message} txHash={txHash} showTxHash={false} />, {
    autoClose: false,
    closeButton: true,
    className: 'toast-error',
  })
}

// Warning toast - manual dismiss, no animation
export const showWarningToast = (message, txHash = null) => {
  toast.warning(<ToastContent message={message} txHash={txHash} showTxHash={false} />, {
    autoClose: false,
    closeButton: true,
    className: 'toast-warning',
  })
}

// Generic toast function that maps to the appropriate type
export const showToast = (type, message, txHash = null) => {
  switch (type) {
    case 'success':
      showSuccessToast(message, txHash)
      break
    case 'info':
      showInfoToast(message, txHash)
      break
    case 'error':
    case 'danger': // Map Bootstrap 'danger' to 'error'
      showErrorToast(message, txHash)
      break
    case 'warning':
      showWarningToast(message, txHash)
      break
    default:
      toast(message)
  }
}