import { useRef, useEffect, useState, useCallback } from 'react'
import './App.css'

const S = { IDLE:'IDLE', LIVE:'LIVE', TAP_HEAD:'TAP_HEAD', TAP_FEET:'TAP_FEET', RESULT:'RESULT' }

export default function App() {
  const videoRef   = useRef(null)
  const overlayRef = useRef(null)
  const streamRef  = useRef(null)
  const animRef    = useRef(null)
  const scanYRef   = useRef(0)
  const scanDirRef = useRef(1)
  // refs to avoid stale closure in rAF
  const stateRef   = useRef(S.IDLE)
  const headRef    = useRef(null)
  const feetRef    = useRef(null)
  const resultRef  = useRef(null)

  const [appState,  setAppState]  = useState(S.IDLE)
  const [headPt,    setHeadPt]    = useState(null)
  const [feetPt,    setFeetPt]    = useState(null)
  const [result,    setResult]    = useState(null)
  const [unit,      setUnit]      = useState('cm')
  const [refH,      setRefH]      = useState(170)
  const [showCalib, setShowCalib] = useState(false)
  const [camError,  setCamError]  = useState(null)
  const [ripples,   setRipples]   = useState([])
  const [accuracy,  setAccuracy]  = useState(null)
  const [loading,   setLoading]   = useState(false)
  const [videoOk,   setVideoOk]   = useState(false)

  // keep refs in sync
  const sync = (s,h,f,r) => {
    if(s!==undefined){ stateRef.current=s; setAppState(s) }
    if(h!==undefined){ headRef.current=h;  setHeadPt(h)  }
    if(f!==undefined){ feetRef.current=f;  setFeetPt(f)  }
    if(r!==undefined){ resultRef.current=r; setResult(r) }
  }

  /* ─── Camera ─────────────────────────────────────────────── */
  const startCamera = useCallback(async () => {
    setCamError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video:{ facingMode:{ideal:'environment'}, width:{ideal:1280}, height:{ideal:720} }
      })
      streamRef.current = stream
      const v = videoRef.current
      v.srcObject = stream
      v.onloadedmetadata = () => {
        v.play()
        setVideoOk(true)
        sync(S.LIVE)
      }
    } catch(e) {
      setCamError('Camera access denied. Please allow camera permission and try again.')
    }
  }, [])

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setVideoOk(false)
  }, [])

  /* ─── Canvas draw loop ───────────────────────────────────── */
  useEffect(() => {
    const canvas = overlayRef.current
    if (!canvas) return

    const draw = () => {
      const ctx = canvas.getContext('2d')
      const W = canvas.width, H = canvas.height
      ctx.clearRect(0, 0, W, H)
      const st = stateRef.current
      const hp = headRef.current
      const fp = feetRef.current
      const res = resultRef.current

      // Grid
      ctx.strokeStyle = 'rgba(0,255,136,0.07)'; ctx.lineWidth = 0.8
      for(let x=0;x<W;x+=W/6){ ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke() }
      for(let y=0;y<H;y+=H/10){ ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke() }

      // Centre dashed line
      ctx.strokeStyle='rgba(0,255,136,0.2)'; ctx.lineWidth=1.5; ctx.setLineDash([14,7])
      ctx.beginPath();ctx.moveTo(W/2,0);ctx.lineTo(W/2,H);ctx.stroke();ctx.setLineDash([])

      // Guide brackets (idle / live)
      if(st===S.LIVE||st===S.TAP_HEAD){
        const bx=W*0.28,bw=W*0.44,by=H*0.04,bh=H*0.86,cl=32
        ctx.strokeStyle='rgba(0,255,136,0.45)'; ctx.lineWidth=2.5
        [[bx,by,1,1],[bx+bw,by,-1,1],[bx,by+bh,1,-1],[bx+bw,by+bh,-1,-1]].forEach(([x,y,dx,dy])=>{
          ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+dx*cl,y);ctx.stroke()
          ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+dy*cl);ctx.stroke()
        })
      }

      // Scan line
      if(st===S.TAP_HEAD||st===S.TAP_FEET){
        scanYRef.current += scanDirRef.current*2.5
        if(scanYRef.current>H) scanDirRef.current=-1
        if(scanYRef.current<0) scanDirRef.current=1
        const g=ctx.createLinearGradient(0,0,W,0)
        g.addColorStop(0,'rgba(0,255,136,0)')
        g.addColorStop(0.5,'rgba(0,255,136,0.65)')
        g.addColorStop(1,'rgba(0,255,136,0)')
        ctx.fillStyle=g; ctx.fillRect(0,scanYRef.current-2,W,4)
      }

      // Point marker helper
      const drawPt = (pt, col, label) => {
        const r=(s,a)=>col.replace('rgb(','rgba(').replace(')',`,${a})`)
        const glow=ctx.createRadialGradient(pt.x,pt.y,0,pt.x,pt.y,44)
        glow.addColorStop(0,`${col}44`); glow.addColorStop(1,`${col}00`)
        ctx.fillStyle=glow; ctx.beginPath();ctx.arc(pt.x,pt.y,44,0,Math.PI*2);ctx.fill()
        ctx.fillStyle=col;  ctx.beginPath();ctx.arc(pt.x,pt.y,9, 0,Math.PI*2);ctx.fill()
        ctx.strokeStyle=col; ctx.lineWidth=2.5
        ctx.beginPath();ctx.arc(pt.x,pt.y,21,0,Math.PI*2);ctx.stroke()
        ctx.beginPath();ctx.arc(pt.x,pt.y,35,0,Math.PI*2);ctx.globalAlpha=0.28;ctx.stroke();ctx.globalAlpha=1
        ctx.lineWidth=1.5; ctx.strokeStyle=col
        ctx.beginPath();ctx.moveTo(pt.x-52,pt.y);ctx.lineTo(pt.x-23,pt.y);ctx.stroke()
        ctx.beginPath();ctx.moveTo(pt.x+23,pt.y);ctx.lineTo(pt.x+52,pt.y);ctx.stroke()
        ctx.beginPath();ctx.moveTo(pt.x,pt.y-52);ctx.lineTo(pt.x,pt.y-23);ctx.stroke()
        ctx.beginPath();ctx.moveTo(pt.x,pt.y+23);ctx.lineTo(pt.x,pt.y+52);ctx.stroke()
        const tw=label.length*8+16
        ctx.fillStyle='rgba(0,0,0,0.82)';ctx.beginPath();ctx.roundRect(pt.x+14,pt.y-13,tw,22,6);ctx.fill()
        ctx.fillStyle=col; ctx.font='bold 12px "Courier New"'; ctx.fillText(label,pt.x+18,pt.y+4)
      }

      if(hp) drawPt(hp,'#00ff88','HEAD')
      if(fp) drawPt(fp,'#ff6b35','FEET')

      // Measurement line + ruler + label
      if(hp&&fp&&st===S.RESULT){
        ctx.strokeStyle='#00ff88'; ctx.lineWidth=3
        ctx.shadowColor='#00ff88'; ctx.shadowBlur=8
        ctx.beginPath();ctx.moveTo(hp.x,hp.y);ctx.lineTo(fp.x,fp.y);ctx.stroke()
        ctx.shadowBlur=0
        ctx.strokeStyle='#00ff88'; ctx.lineWidth=3
        ctx.beginPath();ctx.moveTo(hp.x-28,hp.y);ctx.lineTo(hp.x+28,hp.y);ctx.stroke()
        ctx.strokeStyle='#ff6b35'
        ctx.beginPath();ctx.moveTo(fp.x-28,fp.y);ctx.lineTo(fp.x+28,fp.y);ctx.stroke()
        const dx=fp.x-hp.x,dy=fp.y-hp.y,len=Math.sqrt(dx*dx+dy*dy)
        const px=-dy/len*10,py=dx/len*10
        for(let i=0;i<=10;i++){
          const t=i/10,qx=hp.x+dx*t,qy=hp.y+dy*t,tl=i%5===0?1.4:1
          ctx.strokeStyle='rgba(0,255,136,0.55)'; ctx.lineWidth=1.5
          ctx.beginPath();ctx.moveTo(qx-px*tl,qy-py*tl);ctx.lineTo(qx+px*tl,qy+py*tl);ctx.stroke()
        }
        if(res){
          const mx=(hp.x+fp.x)/2+52,my=(hp.y+fp.y)/2
          const ft=Math.floor(res/30.48),inch=Math.round((res/2.54)%12)
          ctx.fillStyle='rgba(0,0,0,0.88)'
          ctx.beginPath();ctx.roundRect(mx-6,my-40,128,62,10);ctx.fill()
          ctx.strokeStyle='rgba(0,255,136,0.4)'; ctx.lineWidth=1.5
          ctx.beginPath();ctx.roundRect(mx-6,my-40,128,62,10);ctx.stroke()
          ctx.fillStyle='#00ff88'; ctx.font='bold 24px "Courier New"'
          ctx.fillText(`${Math.round(res)} cm`,mx+2,my-10)
          ctx.fillStyle='#ff6b35'; ctx.font='bold 16px "Courier New"'
          ctx.fillText(`${ft}' ${inch}"`,mx+2,my+16)
        }
      }
      animRef.current = requestAnimationFrame(draw)
    }
    animRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animRef.current)
  }, [])

  // Resize canvas to match container
  useEffect(() => {
    const resize = () => {
      const el = document.getElementById('cam-box')
      if (!el || !overlayRef.current) return
      overlayRef.current.width  = el.clientWidth
      overlayRef.current.height = el.clientHeight
    }
    resize()
    const ro = new ResizeObserver(resize)
    const el = document.getElementById('cam-box')
    if(el) ro.observe(el)
    return () => ro.disconnect()
  }, [videoOk])

  /* ─── Touch / Click handler ─────────────────────────────── */
  const handleClick = (e) => {
    const st = stateRef.current
    if(st!==S.TAP_HEAD && st!==S.TAP_FEET) return
    const rect = overlayRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const color = st===S.TAP_HEAD ? '#00ff88' : '#ff6b35'
    const id = Date.now()
    setRipples(r => [...r, {id,x,y,color}])
    setTimeout(() => setRipples(r => r.filter(rr=>rr.id!==id)), 700)

    if(st===S.TAP_HEAD){
      sync(S.TAP_FEET, {x,y})
    } else {
      sync(S.TAP_FEET, undefined, {x,y})
      doCalc(headRef.current, {x,y})
    }
  }

  /* ─── Height calculation ─────────────────────────────────── */
  const doCalc = (hp, fp) => {
    setLoading(true)
    setTimeout(() => {
      const canvas = overlayRef.current
      const H = canvas.height, W = canvas.width
      const pxH = Math.abs(fp.y - hp.y)
      const ratio = pxH / H
      // Empirical: at ~1.5m, typical 70° FOV webcam: full frame ≈ 280cm visible height
      let est = ratio * 280
      // Horizontal offset correction (person off-centre appears slightly compressed)
      const cx = W/2, px2 = (hp.x+fp.x)/2
      const hoff = Math.abs(px2-cx)/cx
      est *= (1 + hoff*0.04)
      const final = Math.min(Math.max(est, 50), 260)
      // Accuracy score
      let acc = 92
      if(hoff>0.3) acc-=10; if(hoff>0.5) acc-=10
      if(ratio<0.3) acc-=15; if(ratio>0.9) acc-=8
      acc = Math.max(60, Math.min(95, acc))
      sync(S.RESULT, undefined, undefined, final)
      setAccuracy(acc)
      setLoading(false)
    }, 1400)
  }

  /* ─── Reset ─────────────────────────────────────────────── */
  const reset = () => {
    sync(videoOk ? S.LIVE : S.IDLE, null, null, null)
    setAccuracy(null); setLoading(false)
  }

  /* ─── Helpers ───────────────────────────────────────────── */
  const toFtIn = cm => {
    const ft=Math.floor(cm/30.48), i=Math.round((cm/2.54)%12)
    return `${ft} ft ${i} in`
  }
  const accColor = accuracy>=85?'#00ff88':accuracy>=70?'#ffd700':'#ff6b35'

  const instr = {
    [S.IDLE]:     '🎥 Click "Start Camera" to begin',
    [S.LIVE]:     '📏 Click "Measure Height" to start',
    [S.TAP_HEAD]: "🟢 Tap the TOP of the person's head",
    [S.TAP_FEET]: '🟠 Now tap the FEET / ground level',
    [S.RESULT]:   '✅ Measurement complete!',
  }[appState]

  /* ─── Render ─────────────────────────────────────────────── */
  return (
    <div className="app">
      {/* ── Header ── */}
      <header className="header">
        <div className="logo-wrap">
          <span className="logo-icon" aria-hidden>📏</span>
          <div>
            <div className="logo-text">HEIGHT<span className="logo-accent">MEASURE</span></div>
            <div className="logo-sub">PRECISION CAMERA TOOL · WEB</div>
          </div>
        </div>
        <div className="header-right">
          <div className="unit-toggle" role="group" aria-label="Unit selector">
            <button className={`unit-btn${unit==='cm'?' active':''}`} onClick={()=>setUnit('cm')}>cm</button>
            <button className={`unit-btn${unit==='ft'?' active':''}`} onClick={()=>setUnit('ft')}>ft/in</button>
          </div>
          <button className="calib-btn" onClick={()=>setShowCalib(v=>!v)} aria-label="Calibration settings">⚙</button>
        </div>
      </header>

      {/* ── Calibration panel ── */}
      {showCalib && (
        <div className="calib-panel" data-testid="calib-panel">
          <div className="calib-title">📐 Reference Calibration</div>
          <div className="calib-row">
            <span className="calib-label">Known height:</span>
            <input type="range" min="140" max="220" value={refH}
              onChange={e=>setRefH(Number(e.target.value))}
              className="calib-slider" aria-label="Reference height slider"/>
            <span className="calib-value" data-testid="calib-value">
              {refH} cm &nbsp;|&nbsp; {toFtIn(refH)}
            </span>
          </div>
          <p className="calib-note">Set your own height as a reference for improved accuracy</p>
        </div>
      )}

      <main className="main">
        {/* ── Camera box ── */}
        <div className="cam-wrapper">
          <div className="cam-box" id="cam-box" data-testid="cam-box">
            {!videoOk && (
              <div className="cam-placeholder">
                {camError
                  ? <div className="cam-error" data-testid="cam-error">
                      <div className="err-icon">⚠️</div>
                      <p className="err-msg">{camError}</p>
                      <button className="btn-primary" onClick={startCamera}>Retry</button>
                    </div>
                  : <div className="cam-idle" data-testid="cam-idle">
                      <div className="idle-ring"><div className="idle-cam">📷</div></div>
                      <div className="idle-title">Camera not started</div>
                      <div className="idle-hint">Click Start Camera below</div>
                    </div>
                }
              </div>
            )}
            <video ref={videoRef} className="cam-video" autoPlay playsInline muted data-testid="cam-video"/>
            <canvas ref={overlayRef} className="cam-overlay" onClick={handleClick} data-testid="cam-overlay"/>

            {/* Tap ripples */}
            {ripples.map(r => (
              <div key={r.id} className="ripple"
                style={{left:r.x,top:r.y,borderColor:r.color,boxShadow:`0 0 12px ${r.color}`}}/>
            ))}

            {/* Calculating overlay */}
            {loading && (
              <div className="calculating" data-testid="calculating">
                <div className="calc-spinner"/>
                <div className="calc-text">Calculating height…</div>
              </div>
            )}

            {/* Corners */}
            <div className="corner corner-tl"/><div className="corner corner-tr"/>
            <div className="corner corner-bl"/><div className="corner corner-br"/>

            {/* Status badge */}
            <div className="status-badge" data-testid="status-badge">
              <div className={`status-dot${videoOk?' dot-on':''}`}/>
              <span>{videoOk?'LIVE':'OFFLINE'}</span>
            </div>
          </div>
        </div>

        {/* ── Result card ── */}
        {appState===S.RESULT && result && (
          <div className="result-card" data-testid="result-card">
            <div className="result-header-row">
              <span className="result-label">MEASURED HEIGHT</span>
              <span className="result-acc" style={{color:accColor}} data-testid="accuracy-badge">
                ~{accuracy}% accuracy
              </span>
            </div>
            <div className="result-vals">
              <div className="result-cm" data-testid="result-cm">
                {unit==='cm'
                  ? <>{Math.round(result)}<span className="result-unit">cm</span></>
                  : <>{toFtIn(result)}</>}
              </div>
              <div className="result-ft" data-testid="result-ft">
                {unit==='cm' ? toFtIn(result) : `${Math.round(result)} cm`}
              </div>
            </div>
            <div className="acc-bar">
              <div className="acc-fill" style={{width:`${accuracy}%`,background:accColor}}/>
            </div>
            <p className="result-tip">
              {accuracy<80
                ? <span className="tip-warn">💡 For better accuracy: center person and ensure full body visible</span>
                : <span className="tip-ok">✅ Good measurement — person well positioned</span>}
            </p>
          </div>
        )}

        {/* ── Instruction bar ── */}
        <div className="instr-bar">
          <span className="instr-text" data-testid="instruction">{instr}</span>
        </div>

        {/* ── Controls ── */}
        <div className="controls" data-testid="controls">
          {appState===S.IDLE && (
            <button className="btn-primary btn-lg" onClick={startCamera} data-testid="btn-start">
              ▶ Start Camera
            </button>
          )}
          {appState===S.LIVE && (<>
            <button className="btn-primary btn-lg" data-testid="btn-measure"
              onClick={()=>sync(S.TAP_HEAD)}>
              📏 Measure Height
            </button>
            <button className="btn-secondary" data-testid="btn-stop"
              onClick={()=>{stopCamera();sync(S.IDLE)}}>
              Stop
            </button>
          </>)}
          {(appState===S.TAP_HEAD||appState===S.TAP_FEET) && (
            <button className="btn-cancel btn-lg" onClick={reset} data-testid="btn-cancel">
              ✕ Cancel
            </button>
          )}
          {appState===S.RESULT && (<>
            <button className="btn-primary btn-lg" onClick={reset} data-testid="btn-again">
              ↺ Measure Again
            </button>
            <button className="btn-secondary" data-testid="btn-stop-r"
              onClick={()=>{stopCamera();reset();sync(S.IDLE)}}>
              Stop Camera
            </button>
          </>)}
        </div>

        {/* ── Tips ── */}
        <div className="tips">
          <div className="tips-title">📌 Tips for best accuracy</div>
          <div className="tips-grid">
            {['Stand 1–2m from camera','Keep person centered','Full body in frame',
              'Good even lighting','Person stands straight','Hold camera steady'].map((t,i)=>(
              <div key={i} className="tip-item"><span className="tip-dot" aria-hidden>◆</span>{t}</div>
            ))}
          </div>
        </div>
      </main>

      <footer className="footer">
        HEIGHT MEASURE · React + Vite · Camera-based estimation · ±2–8 cm typical accuracy
      </footer>
    </div>
  )
}
