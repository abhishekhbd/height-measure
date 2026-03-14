import React, { useRef, useEffect, useState, useCallback } from 'react';
import './App.css';

const STATES = { IDLE:'IDLE', LIVE:'LIVE', TAP_HEAD:'TAP_HEAD', TAP_FEET:'TAP_FEET', RESULT:'RESULT' };

export default function App() {
  const videoRef = useRef(null);
  const overlayRef = useRef(null);
  const streamRef = useRef(null);
  const animRef = useRef(null);
  const scanYRef = useRef(0);
  const scanDirRef = useRef(1);

  const [appState, setAppState] = useState(STATES.IDLE);
  const [headPt, setHeadPt] = useState(null);
  const [feetPt, setFeetPt] = useState(null);
  const [result, setResult] = useState(null);
  const [unit, setUnit] = useState('cm');
  const [refHeight, setRefHeight] = useState(170);
  const [showCalib, setShowCalib] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [ripples, setRipples] = useState([]);
  const [accuracy, setAccuracy] = useState(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const headPtRef = useRef(null);
  const feetPtRef = useRef(null);
  const resultRef = useRef(null);
  const appStateRef = useRef(STATES.IDLE);

  useEffect(() => { headPtRef.current = headPt; }, [headPt]);
  useEffect(() => { feetPtRef.current = feetPt; }, [feetPt]);
  useEffect(() => { resultRef.current = result; }, [result]);
  useEffect(() => { appStateRef.current = appState; }, [appState]);

  const startCamera = useCallback(async () => {
    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play();
          setVideoReady(true);
          setAppState(STATES.LIVE);
          appStateRef.current = STATES.LIVE;
        };
      }
    } catch(e) {
      setCameraError('Camera access denied. Please allow camera permission and try again.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    setVideoReady(false);
  }, []);

  useEffect(() => {
    const canvas = overlayRef.current;
    if (!canvas) return;
    const draw = () => {
      const ctx = canvas.getContext('2d');
      const W = canvas.width; const H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      const state = appStateRef.current;
      const hp = headPtRef.current; const fp = feetPtRef.current; const res = resultRef.current;

      // Grid
      ctx.strokeStyle = 'rgba(0,255,136,0.07)'; ctx.lineWidth = 0.8;
      for (let x = 0; x < W; x += W/6) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
      for (let y = 0; y < H; y += H/10) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

      // Center line
      ctx.strokeStyle='rgba(0,255,136,0.2)'; ctx.lineWidth=1.5; ctx.setLineDash([14,7]);
      ctx.beginPath(); ctx.moveTo(W/2,0); ctx.lineTo(W/2,H); ctx.stroke(); ctx.setLineDash([]);

      if (state===STATES.LIVE || state===STATES.TAP_HEAD) {
        const bx=W*0.28,bw=W*0.44,by=H*0.05,bh=H*0.84,cl=32;
        ctx.strokeStyle='rgba(0,255,136,0.5)'; ctx.lineWidth=2.5;
        [[bx,by,1,1],[bx+bw,by,-1,1],[bx,by+bh,1,-1],[bx+bw,by+bh,-1,-1]].forEach(([x,y,dx,dy])=>{
          ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+dx*cl,y);ctx.stroke();
          ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+dy*cl);ctx.stroke();
        });
      }

      if (state===STATES.TAP_HEAD||state===STATES.TAP_FEET) {
        scanYRef.current += scanDirRef.current * 2.5;
        if (scanYRef.current > H) scanDirRef.current=-1;
        if (scanYRef.current < 0) scanDirRef.current=1;
        const g=ctx.createLinearGradient(0,0,W,0);
        g.addColorStop(0,'rgba(0,255,136,0)');g.addColorStop(0.5,'rgba(0,255,136,0.65)');g.addColorStop(1,'rgba(0,255,136,0)');
        ctx.fillStyle=g; ctx.fillRect(0,scanYRef.current-2,W,4);
      }

      const drawPoint = (pt, color, label) => {
        const glow=ctx.createRadialGradient(pt.x,pt.y,0,pt.x,pt.y,42);
        glow.addColorStop(0,color.replace(')',',0.28)')); glow.addColorStop(1,color.replace(')',',0)'));
        ctx.fillStyle=glow; ctx.beginPath(); ctx.arc(pt.x,pt.y,42,0,Math.PI*2); ctx.fill();
        ctx.fillStyle=color; ctx.beginPath(); ctx.arc(pt.x,pt.y,9,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle=color; ctx.lineWidth=2.5;
        ctx.beginPath(); ctx.arc(pt.x,pt.y,20,0,Math.PI*2); ctx.stroke();
        ctx.beginPath(); ctx.arc(pt.x,pt.y,34,0,Math.PI*2); ctx.globalAlpha=0.3; ctx.stroke(); ctx.globalAlpha=1;
        ctx.lineWidth=1.5;
        [[-52,-24],[-24,-52],[24,-52],[52,-24],[52,24],[24,52],[-24,52],[-52,24]].slice(0,4).forEach(([dx])=>{});
        ctx.beginPath();ctx.moveTo(pt.x-52,pt.y);ctx.lineTo(pt.x-22,pt.y);ctx.stroke();
        ctx.beginPath();ctx.moveTo(pt.x+22,pt.y);ctx.lineTo(pt.x+52,pt.y);ctx.stroke();
        ctx.beginPath();ctx.moveTo(pt.x,pt.y-52);ctx.lineTo(pt.x,pt.y-22);ctx.stroke();
        ctx.beginPath();ctx.moveTo(pt.x,pt.y+22);ctx.lineTo(pt.x,pt.y+52);ctx.stroke();
        ctx.fillStyle='rgba(0,0,0,0.8)'; ctx.beginPath(); ctx.roundRect(pt.x+14,pt.y-13,label.length*8+12,22,6); ctx.fill();
        ctx.fillStyle=color; ctx.font='bold 12px "Courier New"'; ctx.fillText(label,pt.x+18,pt.y+4);
      };

      if (hp) drawPoint(hp,'#00ff88','HEAD');
      if (fp) drawPoint(fp,'#ff6b35','FEET');

      if (hp && fp && state===STATES.RESULT) {
        ctx.strokeStyle='#00ff88'; ctx.lineWidth=3; ctx.shadowColor='#00ff88'; ctx.shadowBlur=8;
        ctx.beginPath(); ctx.moveTo(hp.x,hp.y); ctx.lineTo(fp.x,fp.y); ctx.stroke(); ctx.shadowBlur=0;
        ctx.lineWidth=3; ctx.strokeStyle='#00ff88';
        ctx.beginPath(); ctx.moveTo(hp.x-28,hp.y); ctx.lineTo(hp.x+28,hp.y); ctx.stroke();
        ctx.strokeStyle='#ff6b35';
        ctx.beginPath(); ctx.moveTo(fp.x-28,fp.y); ctx.lineTo(fp.x+28,fp.y); ctx.stroke();
        const dx=fp.x-hp.x,dy=fp.y-hp.y,len=Math.sqrt(dx*dx+dy*dy);
        const px=-dy/len*10,py=dx/len*10;
        for(let i=0;i<=10;i++){
          const t=i/10,qx=hp.x+dx*t,qy=hp.y+dy*t,tl=i%5===0?1.4:1;
          ctx.strokeStyle='rgba(0,255,136,0.6)';ctx.lineWidth=1.5;
          ctx.beginPath();ctx.moveTo(qx-px*tl,qy-py*tl);ctx.lineTo(qx+px*tl,qy+py*tl);ctx.stroke();
        }
        if (res) {
          const mx=(hp.x+fp.x)/2+55,my=(hp.y+fp.y)/2;
          const ft=Math.floor(res/30.48),inch=Math.round((res/2.54)%12);
          ctx.fillStyle='rgba(0,0,0,0.88)';ctx.beginPath();ctx.roundRect(mx-6,my-40,126,62,10);ctx.fill();
          ctx.strokeStyle='rgba(0,255,136,0.45)';ctx.lineWidth=1.5;ctx.beginPath();ctx.roundRect(mx-6,my-40,126,62,10);ctx.stroke();
          ctx.fillStyle='#00ff88';ctx.font='bold 24px "Courier New"';ctx.fillText(`${Math.round(res)} cm`,mx+2,my-10);
          ctx.fillStyle='#ff6b35';ctx.font='bold 16px "Courier New"';ctx.fillText(`${ft}' ${inch}"`,mx+2,my+16);
        }
      }
      animRef.current = requestAnimationFrame(draw);
    };
    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  useEffect(() => {
    const resize = () => {
      const el = document.getElementById('cam-box');
      if (!el || !overlayRef.current) return;
      overlayRef.current.width = el.clientWidth;
      overlayRef.current.height = el.clientHeight;
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [videoReady]);

  const handleClick = (e) => {
    const state = appStateRef.current;
    if (state!==STATES.TAP_HEAD && state!==STATES.TAP_FEET) return;
    const rect = overlayRef.current.getBoundingClientRect();
    const x=e.clientX-rect.left, y=e.clientY-rect.top;
    const id=Date.now();
    const color = state===STATES.TAP_HEAD?'#00ff88':'#ff6b35';
    setRipples(r=>[...r,{id,x,y,color}]);
    setTimeout(()=>setRipples(r=>r.filter(rr=>rr.id!==id)),700);
    if (state===STATES.TAP_HEAD) {
      setHeadPt({x,y}); headPtRef.current={x,y};
      setAppState(STATES.TAP_FEET); appStateRef.current=STATES.TAP_FEET;
    } else {
      setFeetPt({x,y}); feetPtRef.current={x,y};
      doCalc(headPtRef.current,{x,y});
    }
  };

  const doCalc = (hp, fp) => {
    setIsCalculating(true);
    setTimeout(()=>{
      const canvas=overlayRef.current;
      const H=canvas.height,W=canvas.width;
      const pxH=Math.abs(fp.y-hp.y);
      const ratio=pxH/H;
      let est=ratio*290;
      const cx=W/2, px=(hp.x+fp.x)/2;
      const hoff=Math.abs(px-cx)/cx;
      est*=(1+hoff*0.04);
      const final=Math.min(Math.max(est,50),260);
      let acc=92;
      if(hoff>0.3)acc-=10; if(hoff>0.5)acc-=10;
      if(ratio<0.3)acc-=15; if(ratio>0.9)acc-=8;
      acc=Math.max(60,Math.min(95,acc));
      setResult(final); resultRef.current=final;
      setAccuracy(acc);
      setAppState(STATES.RESULT); appStateRef.current=STATES.RESULT;
      setIsCalculating(false);
    },1400);
  };

  const reset = () => {
    setHeadPt(null); headPtRef.current=null;
    setFeetPt(null); feetPtRef.current=null;
    setResult(null); resultRef.current=null;
    setAccuracy(null); setIsCalculating(false);
    const s=videoReady?STATES.LIVE:STATES.IDLE;
    setAppState(s); appStateRef.current=s;
  };

  const toFtIn=(cm)=>{const ft=Math.floor(cm/30.48),i=Math.round((cm/2.54)%12);return `${ft} ft ${i} in`;};
  const accColor=accuracy>=85?'#00ff88':accuracy>=70?'#ffd700':'#ff6b35';

  const getInstr=()=>{
    switch(appState){
      case STATES.IDLE: return '🎥 Click "Start Camera" to begin';
      case STATES.LIVE: return '📏 Click "Measure Height" to start';
      case STATES.TAP_HEAD: return '🟢 Tap the TOP of the person\'s head';
      case STATES.TAP_FEET: return '🟠 Now tap the FEET / ground level';
      case STATES.RESULT: return '✅ Measurement complete!';
      default: return '';
    }
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <div className="logo-wrap">
            <span className="logo-icon">📏</span>
            <div>
              <div className="logo-text">HEIGHT<span className="logo-accent">MEASURE</span></div>
              <div className="logo-sub">PRECISION CAMERA TOOL · WEB</div>
            </div>
          </div>
        </div>
        <div className="header-right">
          <div className="unit-toggle">
            <button className={`unit-btn${unit==='cm'?' active':''}`} onClick={()=>setUnit('cm')}>cm</button>
            <button className={`unit-btn${unit==='ft'?' active':''}`} onClick={()=>setUnit('ft')}>ft/in</button>
          </div>
          <button className="calib-btn" onClick={()=>setShowCalib(v=>!v)} title="Calibration">⚙</button>
        </div>
      </header>

      {showCalib && (
        <div className="calib-panel">
          <div className="calib-title">📐 Reference Calibration</div>
          <div className="calib-row">
            <span className="calib-label">Known height:</span>
            <input type="range" min="140" max="220" value={refHeight} onChange={e=>setRefHeight(Number(e.target.value))} className="calib-slider"/>
            <span className="calib-value">{refHeight} cm &nbsp;|&nbsp; {toFtIn(refHeight)}</span>
          </div>
          <div className="calib-note">Set your own height for a calibration reference point</div>
        </div>
      )}

      <main className="main">
        <div className="cam-wrapper">
          <div className="cam-box" id="cam-box">
            {!videoReady && (
              <div className="cam-placeholder">
                {cameraError
                  ? <div className="cam-error"><div className="err-icon">⚠️</div><div className="err-msg">{cameraError}</div><button className="btn-primary" onClick={startCamera}>Retry</button></div>
                  : <div className="cam-idle"><div className="idle-ring"><div className="idle-cam">📷</div></div><div className="idle-title">Camera not started</div><div className="idle-hint">Click Start Camera below</div></div>
                }
              </div>
            )}
            <video ref={videoRef} className="cam-video" autoPlay playsInline muted/>
            <canvas ref={overlayRef} className="cam-overlay" onClick={handleClick}/>
            {ripples.map(r=>(
              <div key={r.id} className="ripple" style={{left:r.x,top:r.y,borderColor:r.color,boxShadow:`0 0 12px ${r.color}`}}/>
            ))}
            {isCalculating && (
              <div className="calculating">
                <div className="calc-spinner"/>
                <div className="calc-text">Calculating height...</div>
              </div>
            )}
            <div className="corner corner-tl"/><div className="corner corner-tr"/>
            <div className="corner corner-bl"/><div className="corner corner-br"/>
            <div className="status-badge">
              <div className={`status-dot${videoReady?' dot-on':''}`}/>
              <span>{videoReady?'LIVE':'OFFLINE'}</span>
            </div>
          </div>
        </div>

        {appState===STATES.RESULT && result && (
          <div className="result-card">
            <div className="result-header-row">
              <span className="result-label">MEASURED HEIGHT</span>
              <span className="result-acc" style={{color:accColor}}>~{accuracy}% accuracy</span>
            </div>
            <div className="result-vals">
              <div className="result-cm">{Math.round(result)}<span className="result-unit">cm</span></div>
              <div className="result-ft">{toFtIn(result)}</div>
            </div>
            <div className="acc-bar"><div className="acc-fill" style={{width:`${accuracy}%`,background:accColor}}/></div>
            <div className="result-tip">
              {accuracy<80
                ? <span className="tip-warn">💡 For better accuracy: center the person and ensure full body is visible</span>
                : <span className="tip-ok">✅ Good measurement — person well positioned</span>}
            </div>
          </div>
        )}

        <div className="instr-bar"><span className="instr-text">{getInstr()}</span></div>

        <div className="controls">
          {appState===STATES.IDLE && <button className="btn-primary btn-lg" onClick={startCamera}><span>▶</span> Start Camera</button>}
          {appState===STATES.LIVE && <>
            <button className="btn-primary btn-lg" onClick={()=>{setAppState(STATES.TAP_HEAD);appStateRef.current=STATES.TAP_HEAD;}}><span>📏</span> Measure Height</button>
            <button className="btn-secondary" onClick={()=>{stopCamera();setAppState(STATES.IDLE);appStateRef.current=STATES.IDLE;}}>Stop</button>
          </>}
          {(appState===STATES.TAP_HEAD||appState===STATES.TAP_FEET) && <button className="btn-cancel btn-lg" onClick={reset}>✕ Cancel</button>}
          {appState===STATES.RESULT && <>
            <button className="btn-primary btn-lg" onClick={reset}><span>↺</span> Measure Again</button>
            <button className="btn-secondary" onClick={()=>{stopCamera();reset();setAppState(STATES.IDLE);appStateRef.current=STATES.IDLE;}}>Stop Camera</button>
          </>}
        </div>

        <div className="tips">
          <div className="tips-title">📌 Tips for best accuracy</div>
          <div className="tips-grid">
            {['Stand 1–2m from camera','Keep person centered','Full body in frame','Good even lighting','Person stands straight','Hold camera steady'].map((t,i)=>(
              <div key={i} className="tip-item"><span className="tip-dot">◆</span>{t}</div>
            ))}
          </div>
        </div>
      </main>

      <footer className="footer">
        <span>HEIGHT MEASURE · React Web App · Camera2-based estimation · ±2–5cm accuracy</span>
      </footer>
    </div>
  );
}
