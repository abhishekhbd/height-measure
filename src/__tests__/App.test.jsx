import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import App from '../App'

// ── Mock canvas ──────────────────────────────────────────────
const mockCtx = {
  clearRect:()=>{}, strokeStyle:'', lineWidth:0, beginPath:()=>{},
  moveTo:()=>{}, lineTo:()=>{}, stroke:()=>{}, fill:()=>{},
  arc:()=>{}, fillStyle:'', globalAlpha:1, shadowColor:'', shadowBlur:0,
  fillText:()=>{}, setLineDash:()=>{}, fillRect:()=>{},
  createLinearGradient:()=>({ addColorStop:()=>{} }),
  createRadialGradient:()=>({ addColorStop:()=>{} }),
  roundRect:()=>{}, font:'', save:()=>{}, restore:()=>{},
}
HTMLCanvasElement.prototype.getContext = vi.fn(()=>mockCtx)

// ── Mock requestAnimationFrame ───────────────────────────────
let rafId = 0
vi.stubGlobal('requestAnimationFrame', cb => { rafId++; return rafId })
vi.stubGlobal('cancelAnimationFrame', vi.fn())

// ── Mock ResizeObserver ──────────────────────────────────────
vi.stubGlobal('ResizeObserver', class {
  observe(){}; unobserve(){}; disconnect(){}
})

// ── Mock getUserMedia ────────────────────────────────────────
const mockStream = { getTracks: ()=>[{ stop: vi.fn() }] }
const mockGetUserMedia = vi.fn()
Object.defineProperty(global.navigator, 'mediaDevices', {
  value:{ getUserMedia: mockGetUserMedia }, writable:true, configurable:true
})

// ── Mock HTMLVideoElement.play ───────────────────────────────
window.HTMLVideoElement.prototype.play = vi.fn().mockResolvedValue(undefined)

// ────────────────────────────────────────────────────────────
describe('HeightMeasure App', () => {

  beforeEach(() => { vi.clearAllMocks() })

  // ── 1. Initial render ──────────────────────────────────────
  it('renders header with logo text', () => {
    render(<App/>)
    // logo-text div contains "HEIGHT" + span "MEASURE" — query by class
    const logoText = document.querySelector('.logo-text')
    expect(logoText).toBeInTheDocument()
    expect(logoText.textContent).toContain('HEIGHT')
    expect(logoText.textContent).toContain('MEASURE')
  })

  it('shows OFFLINE status badge on load', () => {
    render(<App/>)
    expect(screen.getByTestId('status-badge')).toHaveTextContent('OFFLINE')
  })

  it('shows Start Camera button in IDLE state', () => {
    render(<App/>)
    expect(screen.getByTestId('btn-start')).toBeInTheDocument()
  })

  it('shows correct idle instruction', () => {
    render(<App/>)
    expect(screen.getByTestId('instruction')).toHaveTextContent('Start Camera')
  })

  it('shows camera placeholder (not live)', () => {
    render(<App/>)
    expect(screen.getByTestId('cam-idle')).toBeInTheDocument()
  })

  // ── 2. Unit toggle ─────────────────────────────────────────
  it('renders cm and ft/in unit buttons', () => {
    render(<App/>)
    expect(screen.getByText('cm')).toBeInTheDocument()
    expect(screen.getByText('ft/in')).toBeInTheDocument()
  })

  it('cm button is active by default', () => {
    render(<App/>)
    expect(screen.getByText('cm')).toHaveClass('active')
  })

  it('switches to ft unit on click', () => {
    render(<App/>)
    fireEvent.click(screen.getByText('ft/in'))
    expect(screen.getByText('ft/in')).toHaveClass('active')
    expect(screen.getByText('cm')).not.toHaveClass('active')
  })

  it('switches back to cm from ft', () => {
    render(<App/>)
    fireEvent.click(screen.getByText('ft/in'))
    fireEvent.click(screen.getByText('cm'))
    expect(screen.getByText('cm')).toHaveClass('active')
  })

  // ── 3. Calibration panel ───────────────────────────────────
  it('calibration panel hidden by default', () => {
    render(<App/>)
    expect(screen.queryByTestId('calib-panel')).not.toBeInTheDocument()
  })

  it('shows calibration panel on gear click', () => {
    render(<App/>)
    fireEvent.click(screen.getByLabelText('Calibration settings'))
    expect(screen.getByTestId('calib-panel')).toBeInTheDocument()
  })

  it('hides calibration panel on second gear click', () => {
    render(<App/>)
    const btn = screen.getByLabelText('Calibration settings')
    fireEvent.click(btn)
    fireEvent.click(btn)
    expect(screen.queryByTestId('calib-panel')).not.toBeInTheDocument()
  })

  it('calibration slider updates reference value display', () => {
    render(<App/>)
    fireEvent.click(screen.getByLabelText('Calibration settings'))
    const slider = screen.getByLabelText('Reference height slider')
    fireEvent.change(slider, { target:{ value:'180' } })
    expect(screen.getByTestId('calib-value')).toHaveTextContent('180 cm')
  })

  it('calibration slider shows ft/in alongside cm', () => {
    render(<App/>)
    fireEvent.click(screen.getByLabelText('Calibration settings'))
    const slider = screen.getByLabelText('Reference height slider')
    fireEvent.change(slider, { target:{ value:'183' } })
    // 183cm = 6ft 0in
    expect(screen.getByTestId('calib-value')).toHaveTextContent('6 ft')
  })

  // ── 4. Camera error handling ───────────────────────────────
  it('shows error message when camera permission is denied', async () => {
    mockGetUserMedia.mockRejectedValueOnce(new Error('Permission denied'))
    render(<App/>)
    await act(async () => { fireEvent.click(screen.getByTestId('btn-start')) })
    await waitFor(()=> expect(screen.getByTestId('cam-error')).toBeInTheDocument())
    expect(screen.getByTestId('cam-error')).toHaveTextContent('Camera access denied')
  })

  it('shows Retry button on camera error', async () => {
    mockGetUserMedia.mockRejectedValueOnce(new Error('denied'))
    render(<App/>)
    await act(async () => { fireEvent.click(screen.getByTestId('btn-start')) })
    await waitFor(()=> expect(screen.getByText('Retry')).toBeInTheDocument())
  })

  // ── 5. Camera start ────────────────────────────────────────
  it('calls getUserMedia on Start Camera click', async () => {
    mockGetUserMedia.mockResolvedValueOnce(mockStream)
    render(<App/>)
    await act(async () => { fireEvent.click(screen.getByTestId('btn-start')) })
    expect(mockGetUserMedia).toHaveBeenCalledOnce()
    expect(mockGetUserMedia).toHaveBeenCalledWith(expect.objectContaining({
      video: expect.any(Object)
    }))
  })

  it('requests environment-facing camera', async () => {
    mockGetUserMedia.mockResolvedValueOnce(mockStream)
    render(<App/>)
    await act(async () => { fireEvent.click(screen.getByTestId('btn-start')) })
    const call = mockGetUserMedia.mock.calls[0][0]
    expect(call.video.facingMode).toEqual({ ideal:'environment' })
  })

  // ── 6. Canvas overlay ─────────────────────────────────────
  it('renders canvas overlay element', () => {
    render(<App/>)
    expect(screen.getByTestId('cam-overlay')).toBeInTheDocument()
  })

  it('canvas overlay has crosshair cursor class', () => {
    render(<App/>)
    const canvas = screen.getByTestId('cam-overlay')
    // cursor is set via CSS class cam-overlay
    expect(canvas).toHaveClass('cam-overlay')
  })

  // ── 7. toFtIn conversion (via calib display) ───────────────
  it('converts 152 cm → 4 ft', () => {
    render(<App/>)
    fireEvent.click(screen.getByLabelText('Calibration settings'))
    fireEvent.change(screen.getByLabelText('Reference height slider'), { target:{value:'152'} })
    expect(screen.getByTestId('calib-value')).toHaveTextContent('4 ft')
  })

  it('converts 180 cm → 5 ft 11 in', () => {
    render(<App/>)
    fireEvent.click(screen.getByLabelText('Calibration settings'))
    fireEvent.change(screen.getByLabelText('Reference height slider'), { target:{value:'180'} })
    const val = screen.getByTestId('calib-value').textContent
    expect(val).toContain('5 ft')
  })

  // ── 8. Tips section ───────────────────────────────────────
  it('renders 6 tips', () => {
    render(<App/>)
    expect(screen.getByText('Stand 1–2m from camera')).toBeInTheDocument()
    expect(screen.getByText('Keep person centered')).toBeInTheDocument()
    expect(screen.getByText('Full body in frame')).toBeInTheDocument()
    expect(screen.getByText('Good even lighting')).toBeInTheDocument()
    expect(screen.getByText('Person stands straight')).toBeInTheDocument()
    expect(screen.getByText('Hold camera steady')).toBeInTheDocument()
  })

  // ── 9. Footer ─────────────────────────────────────────────
  it('renders footer with Vite branding', () => {
    render(<App/>)
    expect(screen.getByRole('contentinfo')).toHaveTextContent('Vite')
  })

  // ── 10. Accessibility ─────────────────────────────────────
  it('Start Camera button has accessible text', () => {
    render(<App/>)
    const btn = screen.getByTestId('btn-start')
    expect(btn).toHaveTextContent('Start Camera')
  })

  it('unit toggle has group aria-label', () => {
    render(<App/>)
    expect(screen.getByRole('group', {name:'Unit selector'})).toBeInTheDocument()
  })

  it('calib gear button has aria-label', () => {
    render(<App/>)
    expect(screen.getByLabelText('Calibration settings')).toBeInTheDocument()
  })
})
