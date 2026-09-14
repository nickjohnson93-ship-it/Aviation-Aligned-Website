import { useEffect, useRef, useState } from 'react'
import { ArrowRight, BookOpenCheck, Check, ChevronDown, FileCheck2, Layers3, Menu, Radar, ShieldCheck, X } from 'lucide-react'

const portalUrl='https://portal.aviationaligned.com.au'

const capabilities=[
  {icon:Radar,title:'One live position',body:'See current, due-soon, overdue, pending and review-required training across the operation.'},
  {icon:Layers3,title:'Configured to your operation',body:'Map divisions and training profiles to requirements, then keep individual assignments synchronised.'},
  {icon:FileCheck2,title:'Evidence behind the status',body:'Retain the assessment version, source, completion, certificate and evidence provenance behind every result.'},
]

const faqs=[
  ['Does Aviation Aligned make us CASA compliant?',"No. Compliance remains the operator's responsibility. Aviation Aligned supports training allocation, recurrence, evidence and controlled records. It does not determine applicability, approve an SMS or exposition, secure safety-manager acceptance, or replace professional advice."],
  ['Is this a complete SMS platform?',"Not today. The launch product focuses on the training-control and evidence layer. Hazard, risk, occurrence, assurance and management-of-change modules are possible future expansion, not current capability."],
  ['Can it support HFNTS and SMS-related training?',"It can configure role-based requirements, deliver controlled knowledge assessments and retain completion evidence. The operator must confirm coverage, content, delivery method and any practical competency elements against its approved arrangements and current CASA guidance."],
  ['Can we bring our existing records?',"Reviewed legacy evidence can be migrated with provenance. Source spreadsheets are treated as evidence to validate, not unquestioned truth. Missing, conflicting or ambiguous records require an operator decision."],
  ['What about external training?',"External-provider evidence can be recorded and verified without representing it as Aviation Aligned-delivered training—important where CASA, an RTO or another authorised provider controls delivery."],
]

export default function MarketingSite(){
  const [menuOpen,setMenuOpen]=useState(false)
  const [openFaq,setOpenFaq]=useState(0)
  const heroRef=useRef<HTMLElement>(null)
  useEffect(()=>{
    const previous=document.title
    document.title='Aviation Aligned | Training control and compliance evidence'
    return()=>{document.title=previous}
  },[])
  useEffect(()=>{
    let frame=0
    const update=()=>{
      if(frame)return
      frame=requestAnimationFrame(()=>{
        frame=0
        const hero=heroRef.current
        if(!hero)return
        const rect=hero.getBoundingClientRect()
        const travel=Math.max(1,hero.offsetHeight-window.innerHeight)
        const progress=Math.min(1,Math.max(0,-rect.top/travel))
        hero.style.setProperty('--flight-progress',String(progress))
      })
    }
    update();window.addEventListener('scroll',update,{passive:true});window.addEventListener('resize',update)
    return()=>{if(frame)cancelAnimationFrame(frame);window.removeEventListener('scroll',update);window.removeEventListener('resize',update)}
  },[])
  return <div className="marketing-site">
    <header className="marketing-header">
      <a className="marketing-brand marketing-wordmark" href="#top" aria-label="Aviation Aligned home"><span>AVIATION</span><b>ALIGNED</b></a>
      <button className="marketing-menu" type="button" aria-expanded={menuOpen} aria-controls="marketing-navigation" onClick={()=>setMenuOpen(value=>!value)}>{menuOpen?<X/>:<Menu/>}<span>Menu</span></button>
      <nav id="marketing-navigation" className={menuOpen?'is-open':''} aria-label="Main navigation">
        <a href="#product" onClick={()=>setMenuOpen(false)}>Product</a><a href="#approach" onClick={()=>setMenuOpen(false)}>Compliance approach</a><a href="#implementation" onClick={()=>setMenuOpen(false)}>Implementation</a><a href="#roadmap" onClick={()=>setMenuOpen(false)}>Roadmap</a><a href="#faq" onClick={()=>setMenuOpen(false)}>FAQ</a>
      </nav>
      <div className="marketing-header-actions"><a href={`${portalUrl}/login`}>Customer sign in</a><a className="marketing-button compact" href={`${portalUrl}/demo`}>Explore the demo</a></div>
    </header>

    <main id="top">
      <section className="flight-story" ref={heroRef} aria-label="Aviation Aligned introduction">
        <div className="flight-stage">
          <div className="flight-sky"/><div className="flight-clouds cloud-a"/><div className="flight-clouds cloud-b"/>
          <div className="flight-grid" aria-hidden="true"><i/><i/><i/><span>ENGINEERING CONTROL / TRAINING / EVIDENCE</span></div>
          <p className="flight-kicker">AUSTRALIAN AVIATION · TRAINING CONTROL</p>
          <div className="flight-wordmark"><img src="/brand/aviation-aligned-logo-primary-transparent.webp" width="700" height="585" decoding="async" alt="Aviation Aligned"/></div>
          <img className="flight-aircraft flight-helicopter" src="/campaign/h145-flight-motion.webp" width="1536" height="1024" decoding="async" fetchPriority="high" alt="H145 helicopter in flight"/>
          <img className="flight-aircraft flight-plane" src="/campaign/regional-jet-hero.webp" width="1536" height="1024" decoding="async" alt="Regional jet in flight"/>
          <div className="flight-manifesto"><h1>Control the requirement.<br/>Prove the result.</h1><p>Aviation Aligned connects people, operational roles, controlled source material and retained training evidence—without losing sight of how aviation actually works.</p><div className="marketing-actions"><a className="marketing-button" href={`${portalUrl}/demo`}>Explore the working demo <ArrowRight size={17}/></a><a className="marketing-text-link" href="#product">Discover the platform</a></div></div>
          <div className="flight-scroll"><span>SCROLL TO ENTER</span><i/></div>
        </div>
      </section>

      <section className="deadline-strip" id="approach">
        <div><span className="deadline-date">01</span><span>DEC<br/>2026</span></div>
        <h2>The December deadline is an implementation deadline.</h2>
        <p>CASA says affected operators must have the relevant systems in place—and their safety manager accepted—by 1 December 2026. Aviation Aligned supports the training-control layer. It does not replace your SMS, exposition, safety manager or regulatory advice.</p>
        <a href="https://www.casa.gov.au/rules/changing-rules/flight-operations-regulations-transition/transition-requirements-and-deadlines" target="_blank" rel="noreferrer">Official CASA guidance <ArrowRight size={15}/></a>
      </section>

      <section className="marketing-section" id="product">
        <div className="section-heading"><p className="marketing-eyebrow">TAILORED TO YOUR OPERATION</p><h2>A spreadsheet can list dates.<br/><em>It cannot run the whole control.</em></h2><p>Configure your own divisions, operational roles and training profiles, then map the requirements, recurrence and approved source material that apply to each—so a status can lead to action, and an action can lead back to its record. Not a generic catalogue applied to every operator.</p></div>
        <div className="capability-grid">{capabilities.map(({icon:Icon,title,body},index)=><article key={title}><span className="capability-number">0{index+1}</span><span className="capability-icon"><Icon/></span><h3>{title}</h3><p>{body}</p></article>)}</div>
      </section>

      <section className="marketing-section flow-section">
        <div className="section-heading narrow"><p className="marketing-eyebrow">HOW IT WORKS</p><h2>From operational requirement to <em>retrievable evidence.</em></h2></div>
        <ol className="marketing-flow"><li><span>01</span><div><h3>Configure the operation</h3><p>People, divisions, roles and agreed requirements.</p></div></li><li><span>02</span><div><h3>Assign the right pathway</h3><p>Platform assessment, operator acknowledgement or external evidence.</p></div></li><li><span>03</span><div><h3>Complete and follow up</h3><p>Focused employee training and visible manager exceptions.</p></div></li><li><span>04</span><div><h3>Retrieve the record</h3><p>Protected certificates and evidence packs from retained history.</p></div></li></ol>
      </section>

      <section className="marketing-section evidence-section">
        <div className="evidence-panel"><p className="marketing-eyebrow">WHY AVIATION ALIGNED</p><h2>Built for aviation evidence,<br/><em>not generic course consumption.</em></h2><p>Training content stays connected to controlled source material and published versions. External credentials stay labelled as external. Historical completions are retained.</p><ul><li><Check/> Versioned courses and source-traceable assessments</li><li><Check/> Server-marked results and protected certificates</li><li><Check/> Knowledge-deficiency follow-up without rewriting history</li><li><Check/> Isolated client workspaces and privileged-access MFA</li></ul></div>
        <div className="evidence-card"><ShieldCheck/><span>EVIDENCE INTEGRITY</span><h3>Every green status should have a record behind it.</h3><p>Move from the live matrix to the person, requirement, completion and evidence trail without reconstructing the story across folders and inboxes.</p><div><BookOpenCheck/><span>Controlled source</span><strong>Traceable</strong></div><div><FileCheck2/><span>Completion evidence</span><strong>Protected</strong></div></div>
      </section>

      <section className="marketing-section implementation-section" id="implementation">
        <div className="section-heading"><p className="marketing-eyebrow">FOUNDATION IMPLEMENTATION</p><h2>A controlled implementation.<br/><em>Not a software hand-off.</em></h2><p>Foundation operators work directly with Aviation Aligned to map sources, clean the starting record, configure roles and validate the first live evidence set.</p></div>
        <div className="implementation-steps"><article><span>01</span><h3>Fit & boundary</h3><p>Confirm the operation, people, priorities and what Aviation Aligned will not own.</p></article><article><span>02</span><h3>Source review</h3><p>Inventory the matrix, approved material, external credentials and anomalies.</p></article><article><span>03</span><h3>Configuration</h3><p>Set roles, profiles, requirements, recurrence and controlled pathways.</p></article><article><span>04</span><h3>Acceptance</h3><p>Validate access, journeys, evidence and agreed controls before go-live.</p></article></div>
      </section>

      <section className="marketing-section roadmap-section" id="roadmap">
        <div className="roadmap-current"><p className="marketing-eyebrow">AVAILABLE & CONFIGURABLE</p><h2>Focused on training control today.</h2><p>Current structures demonstrated in the internal pilot include SMS/SQMS knowledge, HFNTS, DAMP, emergency response, fatigue, EFB and induction pathways. Operator-specific content remains subject to source, licence, scope and review.</p><div className="chips"><span>Role profiles</span><span>Recurrent training</span><span>External evidence</span><span>Controlled manuals</span><span>Evidence packs</span></div></div>
        <div className="roadmap-future"><span>FUTURE — NOT IN THE LAUNCH PROMISE</span><h3>Broader SMS operating modules</h3><p>Hazard and occurrence reporting, risk registers, assurance, performance indicators, management of change and action tracking are credible expansion areas—not capabilities for sale today.</p></div>
      </section>

      <section className="marketing-section faq-section" id="faq">
        <div className="section-heading narrow"><p className="marketing-eyebrow">STRAIGHT ANSWERS</p><h2>Clarity before <em>commitment.</em></h2></div>
        <div className="faq-list">{faqs.map(([question,answer],index)=><article key={question}><button type="button" aria-expanded={openFaq===index} onClick={()=>setOpenFaq(openFaq===index?-1:index)}><span>{question}</span><ChevronDown/></button>{openFaq===index&&<p>{answer}</p>}</article>)}</div>
      </section>

      <section className="contact-section" id="contact">
        <div><p className="marketing-eyebrow">FOUNDATION CONVERSATIONS</p><h2>Bring your matrix, your role structure and the problem you are trying to control.</h2></div><div><p>In a 30-minute working session, we can map your current process, identify the highest-risk evidence gaps and decide whether a foundation implementation is a sensible fit.</p><p className="contact-status">Start with the safe product tour, then contact Aviation Aligned when you are ready to discuss your own operation.</p><a className="marketing-button light" href={`${portalUrl}/demo`}>Explore the working demo <ArrowRight size={17}/></a><a className="marketing-contact-link" href="mailto:accounts@aviationaligned.com.au?subject=Aviation%20Aligned%20foundation%20conversation">accounts@aviationaligned.com.au</a></div>
      </section>
    </main>
    <footer className="marketing-footer"><img src="/brand/aviation-aligned-logo-reverse.jpg" alt="Aviation Aligned"/><p>Australian aviation training control and compliance evidence.</p><span>Software and implementation support—not legal or regulatory advice.</span></footer>
  </div>
}

