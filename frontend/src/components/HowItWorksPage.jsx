import React, { useEffect, useRef, useState } from 'react';
import './HowItWorksPage.css';

function useInView(t=0.2){const r=useRef(null);const[v,sv]=useState(false);useEffect(()=>{const o=new IntersectionObserver(([e])=>{if(e.isIntersecting)sv(true)},{threshold:t});if(r.current)o.observe(r.current);return()=>o.disconnect();},[t]);return[r,v];}

function Counter({to,visible}){const[n,sn]=useState(0);useEffect(()=>{if(!visible)return;let i=0;const s=Math.ceil(to/60);const id=setInterval(()=>{i+=s;if(i>=to){sn(to);clearInterval(id);}else sn(i);},18);return()=>clearInterval(id);},[to,visible]);return<>{n}</>;}

/* ─── Step 1 visual ─── */
function V1({visible}){const[t,st]=useState('');const url='https://github.com/your-org/looker-repo';
useEffect(()=>{if(!visible)return;let i=0;const id=setInterval(()=>{st(url.slice(0,++i));if(i>=url.length)clearInterval(id);},38);return()=>clearInterval(id);},[visible]);
return(
<div className="hiw-card">
  <div style={{fontSize:11,fontFamily:'Sora,sans-serif',fontWeight:700,color:'#9CA3AF',letterSpacing:'0.1em',marginBottom:18}}>PROVIDE YOUR SOURCE</div>
  <div style={{display:'flex',gap:6,marginBottom:18}}>
    {['GitHub URL','Upload ZIP','Local Path'].map((l,i)=><div key={l} style={{padding:'6px 12px',borderRadius:8,fontFamily:'Sora,sans-serif',fontSize:11,fontWeight:600,background:i===0?'#635BFF':'transparent',color:i===0?'#fff':'#9CA3AF',border:`1px solid ${i===0?'#635BFF':'#E2DFF5'}`}}>{l}</div>)}
  </div>
  <div style={{background:'#F8F7FF',border:'1.5px solid #635BFF',borderRadius:10,padding:'11px 14px',fontFamily:"'Fira Code',monospace",fontSize:12,color:'#1E1B4B',marginBottom:12,minHeight:42}}>
    {t}<span style={{display:'inline-block',width:2,height:13,background:'#635BFF',verticalAlign:'middle',animation:'hiwBlink 1s step-end infinite',marginLeft:1}}/>
  </div>
  <div style={{background:'#F8F7FF',border:'1px solid #E2DFF5',borderRadius:10,padding:'9px 14px',fontFamily:"'Fira Code',monospace",fontSize:11,color:'#9CA3AF',marginBottom:18}}>/mock_project <span style={{color:'#C4C0F0'}}>← optional subfolder</span></div>
  <div style={{background:'linear-gradient(135deg,#635BFF,#818CF8)',borderRadius:10,padding:'13px 0',color:'#fff',fontFamily:'Sora,sans-serif',fontSize:13,fontWeight:700,textAlign:'center',boxShadow:'0 4px 16px rgba(99,91,255,0.3)',opacity:visible?1:0,transition:'opacity 0.6s ease 1.6s'}}>Run Audit →</div>
  <div style={{display:'flex',gap:16,marginTop:16}}>
    {[
      [<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#635BFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>, 'No credentials needed'],
      [<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#635BFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>, 'Results in seconds'],
      [<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#635BFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>, 'ZIP or GitHub URL']
    ].map(([e,l])=>(
      <div key={l} style={{flex:1,background:'#F8F7FF',border:'1px solid #E2DFF5',borderRadius:10,padding:'10px',textAlign:'center'}}>
        <div style={{display:'flex',justifyContent:'center',marginBottom:6}}>{e}</div>
        <div style={{fontSize:10,color:'#9CA3AF',fontFamily:'Sora,sans-serif',fontWeight:600}}>{l}</div>
      </div>
    ))}
  </div>
</div>);}

/* ─── Step 2 visual ─── */
const LINES=[
  ['view: orders {','#818CF8'],['  dimension: id {','#818CF8'],['    primary_key: yes','#A5B4FC'],['    sql: ${TABLE}.id ;;','#6EE7B7'],['  }','#818CF8'],
  ['  measure: count {','#818CF8'],['    type: count','#A5B4FC'],['    sql: ${TABLE}.id ;;','#6EE7B7'],['  }','#818CF8'],['}','#818CF8'],
];
function V2({visible}){const[s,ss]=useState(-1);
useEffect(()=>{if(!visible)return;let i=0;const id=setInterval(()=>{ss(i++);if(i>=LINES.length){clearInterval(id);setTimeout(()=>ss(-1),500);}},200);return()=>clearInterval(id);},[visible]);
return(
<div className="hiw-code-win">
  <div className="hiw-code-chrome">
    {['#EF4444','#F59E0B','#22C55E'].map(c=><div key={c} className="hiw-code-dot" style={{background:c}}/>)}
    <span className="hiw-code-filename">orders.view.lkml</span>
    <div style={{marginLeft:'auto',background:'rgba(99,91,255,0.15)',borderRadius:6,padding:'3px 10px',fontFamily:'Sora,sans-serif',fontSize:10,fontWeight:600,color:'#818CF8'}}>Parsing…</div>
  </div>
  {LINES.map(([txt,col],i)=>(
    <div key={i} className={`hiw-code-line${i===s?' hiw-scan-active':''}`} style={{position:'relative'}}>
      <span className="hiw-code-ln">{i+1}</span>
      <span className="hiw-code-txt" style={{color:col}}>{txt}</span>
      {i===s&&<div className="hiw-scan-beam"/>}
    </div>
  ))}
  <div style={{marginTop:14,padding:'8px 12px',background:'rgba(99,91,255,0.08)',borderRadius:8,display:'flex',alignItems:'center',gap:8}}>
    <div style={{width:6,height:6,borderRadius:'50%',background:'#4ADE80',animation:'hiwPulse 1.5s ease-in-out infinite'}}/>
    <span style={{fontFamily:'Sora,sans-serif',fontSize:11,color:'#818CF8',fontWeight:600}}>Zero network requests · 100% local</span>
  </div>
</div>);}

/* ─── Step 3 visual ─── */
const CHECKS=[
  ['Broken References','error',0],['Duplicate Definitions','warning',280],['Join Integrity','error',560],['Field Quality','warning',840],['Orphan Views','info',1120],
];
function V3({visible}){return(
<div className="hiw-card">
  <div style={{fontSize:11,fontFamily:'Sora,sans-serif',fontWeight:700,color:'#9CA3AF',letterSpacing:'0.1em',marginBottom:20}}>RULES ENGINE — 5 CHECKS</div>
  {CHECKS.map(([label,sev,delay])=>(
    <div key={label} className="hiw-check-item" style={{opacity:visible?1:0,transform:visible?'none':'translateX(-18px)',transition:`opacity 0.4s ease ${delay}ms,transform 0.4s ease ${delay}ms`}}>
      <div className="hiw-check-icon" style={{opacity:visible?1:0,transition:`opacity 0.3s ease ${delay+180}ms`}}>
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <span style={{flex:1,fontFamily:'Inter,sans-serif',fontSize:13,fontWeight:500,color:'#1E1B4B'}}>{label}</span>
      <span className={`hiw-sev hiw-sev-${sev==='error'?'error':sev==='warning'?'warn':'info'}`}>{sev}</span>
    </div>
  ))}
  <div style={{marginTop:16,padding:'12px 16px',background:'linear-gradient(135deg,#F0EEFF,#EEF2FF)',borderRadius:12,border:'1px solid #E2DFF5'}}>
    <div style={{fontFamily:'Sora,sans-serif',fontSize:11,fontWeight:700,color:'#635BFF',marginBottom:4}}>ANALYSIS COMPLETE</div>
    <div style={{fontFamily:'Sora,sans-serif',fontSize:24,fontWeight:800,color:'#1E1B4B'}}>
      {visible&&<Counter to={23} visible={visible}/>} issues found
    </div>
  </div>
</div>);}

/* ─── Step 4 visual ─── */
function V4({visible}){const sc=91;const r=30;const circ=2*Math.PI*r;
return(
<div className="hiw-card">
  <div style={{fontSize:11,fontFamily:'Sora,sans-serif',fontWeight:700,color:'#9CA3AF',letterSpacing:'0.1em',marginBottom:20}}>YOUR REPORT</div>
  <div className="hiw-score-card">
    <div>
      <div style={{fontFamily:'Sora,sans-serif',fontSize:11,fontWeight:600,color:'#9CA3AF',marginBottom:4}}>HEALTH SCORE</div>
      <div style={{fontFamily:'Sora,sans-serif',fontSize:54,fontWeight:800,color:'#1E1B4B',lineHeight:1}}>
        {visible&&<Counter to={sc} visible={visible}/>}<span style={{fontSize:20,color:'#9CA3AF'}}>/100</span>
      </div>
      <div style={{display:'inline-flex',alignItems:'center',gap:6,marginTop:8,background:'#F0FDF4',border:'1px solid #86EFAC',borderRadius:20,padding:'3px 12px'}}>
        <div style={{width:6,height:6,borderRadius:'50%',background:'#4ADE80'}}/>
        <span style={{fontFamily:'Sora,sans-serif',fontSize:11,fontWeight:700,color:'#16A34A'}}>Healthy</span>
      </div>
    </div>
    <svg width={80} height={80} viewBox="0 0 80 80">
      <circle cx={40} cy={40} r={r} fill="none" stroke="#E2DFF5" strokeWidth={8}/>
      <circle cx={40} cy={40} r={r} fill="none" stroke="#635BFF" strokeWidth={8} strokeLinecap="round"
        strokeDasharray={`${visible?(sc/100)*circ:0} ${circ}`}
        className="hiw-score-ring"/>
    </svg>
  </div>
  {[['Errors',3,'#EF4444',400],['Warnings',12,'#F59E0B',560],['Info',8,'#3B82F6',720]].map(([l,c,col,d])=>(
    <div key={l} style={{display:'flex',alignItems:'center',gap:10,marginBottom:8,opacity:visible?1:0,transform:visible?'none':'translateY(8px)',transition:`all 0.4s ease ${d}ms`}}>
      <div style={{width:8,height:8,borderRadius:2,background:col,flexShrink:0}}/>
      <span style={{flex:1,fontFamily:'Inter,sans-serif',fontSize:12,color:'#6B7280'}}>{l}</span>
      <span style={{fontFamily:'Sora,sans-serif',fontSize:13,fontWeight:700,color:col}}>{c}</span>
    </div>
  ))}
  <div className="hiw-export" style={{opacity:visible?1:0,transition:'opacity 0.5s ease 1.1s'}}>
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#635BFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1={12} y1={15} x2={12} y2={3}/></svg>
    <span style={{fontFamily:'Sora,sans-serif',fontSize:12,fontWeight:600,color:'#635BFF'}}>Export issues as CSV</span>
    <span style={{marginLeft:'auto',background:'rgba(99,91,255,0.08)',borderRadius:6,padding:'2px 8px',fontFamily:'Sora,sans-serif',fontSize:10,fontWeight:600,color:'#635BFF'}}>23 rows</span>
  </div>
</div>);}

/* ─── Steps config ─── */
const STEPS=[
  {n:'01',title:'Provide Your Source',color:'#6366F1',tags:['GitHub URL','ZIP Upload','Local Path'],
   desc:'Paste a public GitHub URL, drag-and-drop a ZIP file, or point to a local directory. No tokens, no sign-up, no CLI required.',V:V1},
  {n:'02',title:'Parsed Locally in Your Browser',color:'#8B5CF6',tags:['Zero network requests','Python-based AST','Instant tokenisation'],
   desc:'Every .lkml file is tokenised and parsed using a custom AST-based static analyser that runs securely. Your LookML never leaves your machine.',V:V2},
  {n:'03',title:'Rules Engine Runs',color:'#635BFF',tags:['5 rule categories','Severity tagging','File + line numbers'],
   desc:'Five rule categories are evaluated in sequence — Broken References, Duplicate Definitions, Join Integrity, Field Quality, and Orphan Views — each with ERROR, WARNING, or INFO severity.',V:V3},
  {n:'04',title:'Interactive Report Ready',color:'#09A55A',tags:['Health score /100','CSV export','File Viewer'],
   desc:'A 0–100 health score summarises project quality. Drill into every issue with exact file and line numbers, click through to the embedded file viewer, and export the full list as CSV.',V:V4},
];

function StepRow({step,index}){
  const[ref,visible]=useInView(0.18);
  const rev=index%2!==0;
  const {n,title,color,desc,tags,V}=step;
  return(
  <div ref={ref} className={`hiw-step${rev?' rev':''}`} style={{opacity:visible?1:0,transform:visible?'none':'translateY(36px)',transition:'opacity 0.7s ease,transform 0.7s ease'}}>
    <div className="hiw-step-text">
      <div className="hiw-step-badge" style={{background:`${color}12`,border:`1px solid ${color}28`,color}}>{`STEP ${n}`}</div>
      <h3 className="hiw-step-title">{title}</h3>
      <p className="hiw-step-desc">{desc}</p>
      <div className="hiw-step-tags">
        {tags.map(t=><span key={t} className="hiw-step-tag" style={{color,background:`${color}08`,border:`1px solid ${color}20`}}>✓ {t}</span>)}
      </div>
      <div className="hiw-step-num" style={{color}}>{n}</div>
    </div>
    <div><V visible={visible}/></div>
  </div>);}

/* ─── FAQ ─── */
const FAQS=[
  {q:'Does the auditor send my LookML to any server?',a:'No. Every file is parsed and analysed entirely inside your browser using JavaScript. No network requests are made with your LookML content.'},
  {q:'What LookML constructs are supported?',a:'Views (dimensions, measures, dimension_groups, filters, parameters), Explores, Joins, derived tables (SQL-based), and manifest.lkml constants are all fully supported.'},
  {q:'Can I audit a private GitHub repository?',a:'Currently only public repositories are supported via GitHub URL. For private repos, download and upload a ZIP or use the local path option (desktop app only).'},
  {q:'How is the health score calculated?',a:'The score starts at 100 and deducts weighted penalties for each issue — errors carry the highest penalty, warnings moderate, and info issues minimal. Five or more breaking errors cap the score at 70.'},
  {q:'Can I export the results?',a:'Yes. Every audit result can be exported as a CSV file containing all issues with their severity, category, object name, file, and line number.'},
];
function FAQ(){
  const[open,setOpen]=useState(null);
  const[ref,visible]=useInView(0.1);
  return(
  <div className="hiw-faq">
    <div ref={ref} style={{textAlign:'center',marginBottom:48,opacity:visible?1:0,transform:visible?'none':'translateY(24px)',transition:'all 0.6s ease'}}>
      <h2 style={{fontFamily:'Sora,sans-serif',fontSize:'clamp(24px,3vw,36px)',fontWeight:800,color:'#1E1B4B',letterSpacing:'-0.5px',marginBottom:12}}>Frequently asked questions</h2>
      <p style={{fontSize:15,color:'#9CA3AF'}}>Everything you need to know about how the auditor works.</p>
    </div>
    {FAQS.map(({q,a},i)=>(
      <div key={i} className={`hiw-faq-item${open===i?' hiw-faq-open':''}`} style={{opacity:visible?1:0,transform:visible?'none':'translateY(12px)',transition:`all 0.5s ease ${i*80}ms`}}>
        <div className="hiw-faq-q" onClick={()=>setOpen(open===i?null:i)}>
          <span>{q}</span>
          <svg className="hiw-faq-chevron" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        {open===i&&<div className="hiw-faq-a">{a}</div>}
      </div>
    ))}
  </div>);}

/* ─── Trust banner ─── */
function Trust(){
  const[ref,visible]=useInView(0.25);
  return(
  <div className="hiw-trust">
    <div ref={ref} style={{opacity:visible?1:0,transform:visible?'none':'translateY(28px)',transition:'all 0.8s ease'}}>
      <div style={{display:'flex',justifyContent:'center',marginBottom:28}}>
        <div style={{width:72,height:72,borderRadius:20,background:'rgba(99,91,255,0.2)',border:'1px solid rgba(99,91,255,0.35)',display:'flex',alignItems:'center',justifyContent:'center',animation:'hiwFloat 4s ease-in-out infinite'}}>
          <svg width={34} height={34} viewBox="0 0 24 24" fill="none" stroke="#818CF8" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            <polyline points="9 12 11 14 15 10"/>
          </svg>
        </div>
      </div>
      <h2 style={{fontFamily:'Sora,sans-serif',fontSize:'clamp(24px,4vw,38px)',fontWeight:800,color:'#fff',letterSpacing:'-0.5px',marginBottom:16,lineHeight:1.2}}>
        100% Local. Your LookML<br/>never leaves your machine.
      </h2>
      <p style={{fontSize:16,color:'rgba(255,255,255,0.45)',maxWidth:500,margin:'0 auto 36px',lineHeight:1.7}}>
        No server. No storage. No logs. No account. Every byte of your LookML is processed directly inside your browser tab and discarded when you close the page.
      </p>

      <a href="/" style={{
        background: 'white', color: '#635BFF', textDecoration: 'none',
        borderRadius: '10px', padding: '16px 36px',
        font: '16px Sora', fontWeight: 700,
        boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
        transition: 'all 200ms ease',
        display: 'inline-flex', alignItems: 'center', gap: '8px',
        whiteSpace: 'nowrap', marginBottom: '32px'
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.2)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 4px 24px rgba(0,0,0,0.15)';
      }}>
        Start your audit
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
      </a>

      <div className="hiw-trust-pills">
        {[
          [<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>, 'Zero data transmission'],
          [<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22.61 16.95A5 5 0 0 0 18 10h-1.26a8 8 0 0 0-7.05-6M5 5a8 8 0 0 0 4 15h9a5 5 0 0 0 1.7-.3"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>, 'No server or storage'],
          [<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>, 'No telemetry or logs'],
          [<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>, 'Always free to use']
        ].map(([e,l])=>(
          <div key={l} className="hiw-trust-pill"><span style={{display:'flex',alignItems:'center'}}>{e}</span>{l}</div>
        ))}
      </div>
    </div>
  </div>);}

/* ─── Hero stats ─── */
function Hero(){
  const[ref,visible]=useInView(0.1);
  return(
  <div className="hiw-hero">
    <div className="hiw-hero-orb1"/><div className="hiw-hero-orb2"/>
    <div style={{maxWidth: 1100, margin: '0 auto', textAlign: 'left', position: 'relative', zIndex: 10}}>
      <a href="/" style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '48px',
        fontFamily: 'Sora, sans-serif', fontSize: '13px', fontWeight: 600, color: '#635BFF',
        textDecoration: 'none', opacity: 0, animation: 'hiwFadeUp 0.4s ease 0.05s forwards'
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
        </svg>
        Back to App
      </a>
    </div>
    <div className="hiw-hero-badge"><div className="hiw-hero-badge-dot"/><span className="hiw-hero-badge-text">HOW IT WORKS</span></div>
    <h1 className="hiw-hero-title hiw-in hiw-in-1">From repo to report<br/><span>in 4 steps</span></h1>
    <p className="hiw-hero-sub hiw-in hiw-in-2">No sign-up, no CLI, no configuration files. Point to your LookML project and get a full quality report in seconds — entirely inside your browser.</p>
    <div ref={ref} className="hiw-stats hiw-in hiw-in-3">
      {[{n:5,suf:'',label:'Audit rule categories'},{n:100,suf:'%',label:'Local — no data sent'},{n:0,suf:'s',label:'Setup time required'},{n:142,suf:'+',label:'LookML constructs analysed'}].map(({n,suf,label})=>(
        <div key={label} className="hiw-stat">
          <div className="hiw-stat-num"><Counter to={n} visible={visible}/><span>{suf}</span></div>
          <div className="hiw-stat-label">{label}</div>
        </div>
      ))}
    </div>
  </div>);}

/* ─── Root ─── */
export default function HowItWorksPage(){
  return(
  <div className="hiw-page">
    <Hero/>
    <div className="hiw-steps">
      {STEPS.map((s,i)=><StepRow key={s.n} step={s} index={i}/>)}
    </div>
    <FAQ/>
    <Trust/>
  </div>);}
