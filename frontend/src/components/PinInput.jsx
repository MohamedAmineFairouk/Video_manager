import { useEffect, useRef } from 'react'

export default function PinInput({ length = 4, value, onChange, onComplete, autoFocus = true, error }) {
  const inputRefs = useRef([])
  const digits = value.padEnd(length, ' ').slice(0, length).split('').map((c) => (c === ' ' ? '' : c))

  useEffect(() => {
    if (autoFocus) inputRefs.current[0]?.focus()
  }, [autoFocus])

  const setDigit = (index, digit) => {
    const chars = value.split('')
    chars[index] = digit
    const next = chars.join('').slice(0, length)
    onChange(next)
    if (digit && index < length - 1) inputRefs.current[index + 1]?.focus()
    if (next.length === length && next.split('').every((c) => c !== '')) {
      onComplete?.(next)
    }
  }

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  return (
    <div className={`pin-input-group ${error ? 'error' : ''}`}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { inputRefs.current[i] = el }}
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          className="pin-input-box"
          value={d}
          onChange={(e) => setDigit(i, e.target.value.replace(/\D/g, '').slice(-1))}
          onKeyDown={(e) => handleKeyDown(i, e)}
        />
      ))}
    </div>
  )
}
