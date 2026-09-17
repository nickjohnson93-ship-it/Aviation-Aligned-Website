import { useEffect, useRef, useState } from 'react'
import { ArrowRight, BookOpenCheck, Check, ChevronDown, FileCheck2, Layers3, Menu, Radar, ShieldCheck, X } from 'lucide-react'
import FlightSceneBoundary from '../components/FlightSceneBoundary'
import FlightPlane from '../components/FlightPlane'
import { heroSequenceAt, helicopterScrollProgress } from '../heroSequence'

const portalUrl='https://portal.aviationaligned.com.au'

const capabilities=[
  {icon:Radar,title:'One live training view',body:'See what is current, due soon, overdue, awaiting completion or needs review across the operation.'},
  {icon:Layers3,title:'Configured to your operation',body:'Map divisions and training profiles to requirements, then keep individual assignments synchronised.'},
  {icon:FileCheck2,title:'Evidence behind the status',body:'Keep results connected to their source, assessment version where applicable, and retained completion evidence.'},
]

const faqs=[
  ['Does Aviation Aligned make us CASA compliant?',"No. Compliance remains the operator's responsibility. Aviation Aligned supports training allocation, recurrence, evidence and controlled records. It does not determine applicability, approve an SMS or exposition, secure safety-manager acceptance, or replace professional advice."],
  ['Is this a complete safety management system platform?',"Not today. Aviation Aligned focuses on training control and evidence. Hazard, risk, occurrence, assurance and management-of-change modules are possible future additions, not current capabilities."],
  ['Can it support human factors and SMS-related training?',"It can support human factors and non-technical skills (HFNTS) and safety management system (SMS) training through configured role-based requirements, controlled knowledge assessments and retained evidence. The operator must confirm coverage, content, delivery method and any practical competency elements against its approved arrangements and current CASA guidance."],
  ['Can we bring our existing records?',"Reviewed legacy evidence can be migrated with provenance. Source spreadsheets are treated as evidence to validate, not unquestioned truth. Missing, conflicting or ambiguous records require an operator decision."],
  ['What about external training?',"External-provider evidence can be recorded and verified without representing it as Aviation Aligned-delivered training—important where CASA, a registered training organisation (RTO) or another authorised provider controls delivery. Recording external evidence does not issue an Aviation Aligned assessment certificate."],
]

export default function MarketingSite(){
  const [menuOpen,setMenuOpen]=useState(false)
  const [openFaq,setOpenFaq]=useState(0)
  const heroRef=useRef<HTMLElement>(null)
  const menuButtonRef=useRef<HTMLButtonElement>(null)
  const progressRef=useRef(0)
  useEffect(()=>{
    const previous=document.title
    document.title='Aviation Aligned | Training control and compliance evidence'
    return()=>{document.title=previous}
  },[])
  useEffect(()=>{
    let frame=0
    const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)')
    const update=()=>{
      if(frame)return
      frame=requestAnimationFrame(()=>{
        frame=0
        const hero=heroRef.current
        if(!hero)return
        const rect=hero.getBoundingClientRect()
        const travel=Math.max(1,hero.offsetHeight-window.innerHeight)
        const progress=Math.min(1,Math.max(0,-rect.top/travel))
        progressRef.current=helicopterScrollProgress(-rect.top,window.innerHeight,window.innerWidth<=760)
        hero.style.setProperty('--flight-progress',String(progress))
        const sequence=heroSequenceAt(progress,hero.clientWidth,window.innerHeight)
        for(const [key,value] of Object.entries(sequence)){
          const cssName=key.replace(/[A-Z]/g,letter=>'-'+letter.toLowerCase())
          if(key==='fansRunning')hero.style.setProperty('--fan-play-state',value?'running':'paused')
          else if(key==='logoDock')hero.style.setProperty('--logo-dock-progress',String(value))
          else hero.style.setProperty('--'+cssName,String(value)+(key==='logoWidth'?'px':''))
        }
        hero.dataset.sequenceVersion='6'
        const manifesto=hero.querySelector<HTMLElement>('.flight-manifesto')
        if(manifesto)manifesto.inert=sequence.manifestoOpacity<.01&&!reducedMotion.matches
      })
    }
    update();window.addEventListener('scroll',update,{passive:true});window.addEventListener('resize',update);reducedMotion.addEventListener('change',update)
    return()=>{if(frame)cancelAnimationFrame(frame);window.removeEventListener('scroll',update);window.removeEventListener('resize',update);reducedMotion.removeEventListener('change',update)}
  },[])
  return <div className="marketing-site">
    <a className="marketing-skip-link" href="#product">Skip introduction</a>
    <header className="marketing-header" onKeyDown={event=>{if(event.key==='Escape'&&menuOpen){setMenuOpen(false);menuButtonRef.current?.focus()}}}>
      <a className="marketing-brand marketing-wordmark" href="#top" aria-label="Aviation Aligned home"><span>AVIATION</span><b>ALIGNED</b></a>
      <button ref={menuButtonRef} className="marketing-menu" type="button" aria-label={menuOpen?'Close navigation menu':'Open navigation menu'} aria-expanded={menuOpen} aria-controls="marketing-navigation" onClick={()=>setMenuOpen(value=>!value)}>{menuOpen?<X aria-hidden="true"/>:<Menu aria-hidden="true"/>}<span>Menu</span></button>
      <nav id="marketing-navigation" className={menuOpen?'is-open':''} aria-label="Main navigation">
        <a href="#product" onClick={()=>setMenuOpen(false)}>Product</a><a href="#approach" onClick={()=>setMenuOpen(false)}>Compliance approach</a><a href="#implementation" onClick={()=>setMenuOpen(false)}>Implementation</a><a href="#roadmap" onClick={()=>setMenuOpen(false)}>Roadmap</a><a href="#faq" onClick={()=>setMenuOpen(false)}>FAQ</a>
        <a className="marketing-mobile-account" href={`${portalUrl}/login`} onClick={()=>setMenuOpen(false)}>Customer sign in</a>
        <a className="marketing-mobile-account" href={`${portalUrl}/demo`} onClick={()=>setMenuOpen(false)}>Explore the demo</a>
      </nav>
      <div className="marketing-header-actions"><a href={`${portalUrl}/login`}>Customer sign in</a><a className="marketing-button compact" href={`${portalUrl}/demo`}>Explore the demo</a></div>
    </header>

    <main id="top">
      <section className="flight-story" ref={heroRef} aria-label="Aviation Aligned introduction">
        <div className="flight-stage">
          <div className="flight-sky" aria-hidden="true"/>
          <div className="flight-terrain" aria-hidden="true"/>
          <div className="flight-terrain-light" aria-hidden="true"/>
          <div className="flight-clouds cloud-a" aria-hidden="true"/><div className="flight-clouds cloud-b" aria-hidden="true"/>
          <div className="flight-grid" aria-hidden="true"><i/><i/><i/><span>ENGINEERING CONTROL / TRAINING / EVIDENCE</span></div>
          <div className="flight-target" aria-hidden="true"><i/><i/></div>
          <p className="flight-kicker">AUSTRALIAN AVIATION · TRAINING CONTROL</p>
          <div className="flight-wordmark"><img src="/brand/aviation-aligned-logo-primary.svg" width="256" height="214" decoding="async" alt="Aviation Aligned"/></div>
          <FlightSceneBoundary progressRef={progressRef}/>
          <FlightPlane/>
          <div className="flight-manifesto"><h1>Control the requirement.<br/>Prove the result.</h1><p>Aviation Aligned connects people, operational roles, controlled source material and retained training evidence—without losing sight of how aviation actually works.</p><div className="marketing-actions"><a className="marketing-button" href={`${portalUrl}/demo`}>Explore the working demo <ArrowRight size={17}/></a><a className="marketing-text-link" href="#product">Discover the platform</a></div></div>
          <div className="flight-scroll"><span>SCROLL TO ENTER</span><i/></div>
        </div>
      </section>

      <section className="deadline-strip" id="approach">
        <div><span className="deadline-date">01</span><span>DEC<br/>2026</span></div>
        <h2>The December deadline is an implementation deadline.</h2>
        <p>CASA sets 1 December 2026 for affected operators to implement their safety management system, required human factors and non-technical skills training and any applicable flight data analysis program, and have their safety manager accepted. The documentation and nomination deadline was 1 September 2026. Aviation Aligned supports training control—not regulatory approval or advice. Confirm what applies to your operation with CASA.</p>
        <a href="https://www.casa.gov.au/rules/changing-rules/flight-operations-regulations-transition/transition-requirements-and-deadlines" target="_blank" rel="noopener noreferrer" aria-label="Official CASA transition requirements and deadlines (opens in a new tab)">Official CASA guidance <ArrowRight size={15} aria-hidden="true"/></a>
      </section>

      <section className="marketing-section" id="product">
        <div className="section-heading"><p className="marketing-eyebrow">TAILORED TO YOUR OPERATION</p><h2>Training control takes more<br/><em>than a list of dates.</em></h2><p>Configure your own divisions, operational roles and training profiles, then map the requirements, recurrence and controlled source material that apply to each. Connect each status to the action required and the evidence behind it, with requirements tailored to your operation.</p></div>
        <div className="capability-grid">{capabilities.map(({icon:Icon,title,body},index)=><article key={title}><span className="capability-number" aria-hidden="true">0{index+1}</span><span className="capability-icon"><Icon aria-hidden="true"/></span><h3>{title}</h3><p>{body}</p></article>)}</div>
      </section>

      <section className="marketing-section flow-section">
        <div className="section-heading narrow"><p className="marketing-eyebrow">HOW IT WORKS</p><h2>From operational requirement to <em>retrievable evidence.</em></h2></div>
        <ol className="marketing-flow"><li><span aria-hidden="true">01</span><div><h3>Configure the operation</h3><p>People, divisions, roles and agreed requirements.</p></div></li><li><span aria-hidden="true">02</span><div><h3>Assign the right pathway</h3><p>A platform assessment, operator training record or external evidence.</p></div></li><li><span aria-hidden="true">03</span><div><h3>Complete and follow up</h3><p>Focused employee training and clear manager follow-up.</p></div></li><li><span aria-hidden="true">04</span><div><h3>Retrieve the record</h3><p>Protected certificates and evidence packs from retained history.</p></div></li></ol>
      </section>

      <section className="marketing-section evidence-section">
        <div className="evidence-panel"><p className="marketing-eyebrow">WHY AVIATION ALIGNED</p><h2>Built for aviation evidence,<br/><em>not generic course consumption.</em></h2><p>Training content stays connected to controlled source material and published versions. External credentials stay labelled as external. Historical completions are retained.</p><ul><li><Check aria-hidden="true"/> Versioned courses and source-traceable assessments</li><li><Check aria-hidden="true"/> Server-graded assessments and protected certificates</li><li><Check aria-hidden="true"/> Knowledge-deficiency follow-up without rewriting history</li><li><Check aria-hidden="true"/> Separate client workspaces with privileged-access multi-factor authentication</li></ul></div>
        <div className="evidence-card"><ShieldCheck aria-hidden="true"/><span>EVIDENCE INTEGRITY</span><h3>Every current status should have a record behind it.</h3><p>Move from the live matrix to the person, requirement, completion and evidence trail without reconstructing the story across folders and inboxes.</p><div><BookOpenCheck aria-hidden="true"/><span>Controlled source</span><strong>Traceable</strong></div><div><FileCheck2 aria-hidden="true"/><span>Completion evidence</span><strong>Protected</strong></div></div>
      </section>

      <section className="marketing-section implementation-section" id="implementation">
        <div className="section-heading"><p className="marketing-eyebrow">FOUNDATION IMPLEMENTATION</p><h2>A controlled implementation.<br/><em>Not a software hand-off.</em></h2><p>Foundation operators work directly with Aviation Aligned to map sources, clean the starting record, configure roles and validate the first live evidence set.</p></div>
        <div className="implementation-steps"><article><span aria-hidden="true">01</span><h3>Fit and responsibilities</h3><p>Confirm the operation, people, priorities and each party's responsibilities.</p></article><article><span aria-hidden="true">02</span><h3>Source review</h3><p>Review the matrix, controlled material, external credentials and record gaps.</p></article><article><span aria-hidden="true">03</span><h3>Configuration</h3><p>Set roles, profiles, requirements, recurrence and controlled pathways.</p></article><article><span aria-hidden="true">04</span><h3>Acceptance</h3><p>Validate access, workflows, evidence and agreed controls before go-live.</p></article></div>
      </section>

      <section className="marketing-section roadmap-section" id="roadmap">
        <div className="roadmap-current"><p className="marketing-eyebrow">CURRENT PLATFORM SCOPE</p><h2>Focused on training control today.</h2><p>Training structures shown in the internal pilot include safety-management knowledge, human factors and non-technical skills (HFNTS), drug and alcohol management plan (DAMP) knowledge, emergency response, fatigue, electronic flight bag (EFB) and induction pathways. Operator-specific content remains subject to source, licence, scope and review.</p><div className="chips"><span>Role profiles</span><span>Recurrent training</span><span>External evidence</span><span>Controlled manuals</span><span>Evidence packs</span></div></div>
        <div className="roadmap-future"><span>FUTURE — NOT IN THE LAUNCH PROMISE</span><h3>Broader SMS operating modules</h3><p>Hazard and occurrence reporting, risk registers, assurance, performance indicators, management of change and action tracking are credible expansion areas—not capabilities for sale today.</p></div>
      </section>

      <section className="marketing-section faq-section" id="faq">
        <div className="section-heading narrow"><p className="marketing-eyebrow">STRAIGHT ANSWERS</p><h2>Clarity before <em>commitment.</em></h2></div>
        <div className="faq-list">{faqs.map(([question,answer],index)=><article key={question}><button id={`faq-question-${index}`} type="button" aria-expanded={openFaq===index} aria-controls={openFaq===index?`faq-answer-${index}`:undefined} onClick={()=>setOpenFaq(openFaq===index?-1:index)}><span>{question}</span><ChevronDown aria-hidden="true"/></button>{openFaq===index&&<p id={`faq-answer-${index}`}>{answer}</p>}</article>)}</div>
      </section>

      <section className="contact-section" id="contact">
        <div><p className="marketing-eyebrow">FOUNDATION CONVERSATIONS</p><h2>Bring your matrix, your role structure and the problem you are trying to control.</h2></div><div><p>In a 30-minute working session, we can map your current process, identify priority gaps in your training evidence and decide whether a foundation implementation is a sensible fit.</p><p className="contact-status">Start with the public product tour, then contact Aviation Aligned when you are ready to discuss your own operation.</p><a className="marketing-button light" href={`${portalUrl}/demo`}>Explore the working demo <ArrowRight size={17} aria-hidden="true"/></a><a className="marketing-contact-link" href="mailto:accounts@aviationaligned.com.au?subject=Aviation%20Aligned%20foundation%20conversation">accounts@aviationaligned.com.au</a></div>
      </section>
    </main>
    <footer className="marketing-footer"><img src="/brand/aviation-aligned-logo-reverse.svg" width="256" height="214" alt="Aviation Aligned"/><p>Australian aviation training control and compliance evidence.</p><span>Software and implementation support—not legal or regulatory advice.</span>{new URLSearchParams(window.location.search).get('aircraft')!=='h145'&&<a className="aircraft-attribution" href="/campaign/light-twin/aircraft-refinement-source-v6.zip">Aircraft mesh: Heiko Schulz · GPL-2.0 · Corresponding source and refinements</a>}</footer>
  </div>
}

