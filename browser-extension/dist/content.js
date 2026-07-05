"use strict";(()=>{function I(){let o=document.createElement("style");return o.textContent=`
    .pn-toast {
      all: initial;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      color: #1c1b1f;
      background: #f3f0f4;
      border-radius: 16px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.18);
      padding: 16px;
      width: 320px;
      position: absolute;
      z-index: 2147483647;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .pn-toast * { box-sizing: border-box; }
    .pn-toast-title { font-weight: 700; font-size: 15px; }
    .pn-toast-word { font-weight: 600; color: #4a4458; word-break: break-word; }
    .pn-toast-label { font-size: 11px; color: #605d66; margin-bottom: 4px; }
    .pn-toast-select {
      width: 100%;
      padding: 8px 10px;
      border-radius: 8px;
      border: 1px solid #cac4d0;
      background: #fff;
      font-size: 13px;
    }
    .pn-toast-actions { display: flex; gap: 8px; margin-top: 4px; }
    .pn-toast-btn {
      flex: 1;
      padding: 9px 12px;
      border-radius: 8px;
      border: none;
      font-weight: 600;
      cursor: pointer;
      font-size: 13px;
    }
    .pn-toast-btn.primary { background: #4a4458; color: #fff; }
    .pn-toast-btn.secondary { background: #e6e0e9; color: #1c1b1f; }
    .pn-toast-progress {
      height: 3px;
      background: #d0bcff;
      border-radius: 2px;
      overflow: hidden;
      margin-top: 4px;
    }
    .pn-toast-progress-bar {
      height: 100%;
      width: 100%;
      background: #4a4458;
      transform-origin: left;
    }
  `,o}function N(o,n,r,s){let x=o.getBoundingClientRect(),e=document.createElement("div");e.className="pn-toast",e.style.left=`${Math.max(8,x.left+window.scrollX)}px`,e.style.top=`${Math.max(8,x.bottom+window.scrollY+8)}px`;let b=I();e.appendChild(b);let c=document.createElement("div");c.className="pn-toast-title",c.textContent="Add to Project PN",e.appendChild(c);let i=document.createElement("div");i.className="pn-toast-word",i.textContent=n.text,e.appendChild(i);let l=document.createElement("div");l.className="pn-toast-label",l.textContent="Sense",e.appendChild(l);let p=document.createElement("select");p.className="pn-toast-select",n.senseOptions.forEach(t=>{let a=document.createElement("option");a.value=t.word_sense_id,a.textContent=`${t.lemma} \xB7 ${t.part_of_speech} \xB7 ${t.localized_definition}`,p.appendChild(a)}),n.defaultSenseId&&(p.value=n.defaultSenseId),e.appendChild(p);let y=document.createElement("div");y.className="pn-toast-label",y.textContent="Deck",e.appendChild(y);let m=document.createElement("select");m.className="pn-toast-select",n.decks.forEach(t=>{let a=document.createElement("option");a.value=t.id,a.textContent=t.name,m.appendChild(a)}),n.defaultDeckId&&(m.value=n.defaultDeckId),e.appendChild(m);let v=document.createElement("div");v.className="pn-toast-progress";let w=document.createElement("div");w.className="pn-toast-progress-bar",v.appendChild(w),e.appendChild(v);let g=document.createElement("div");g.className="pn-toast-actions";let d=document.createElement("button");d.className="pn-toast-btn primary",d.textContent="Add",g.appendChild(d);let h=document.createElement("button");h.className="pn-toast-btn secondary",h.textContent="Cancel",g.appendChild(h),e.appendChild(g),document.body.appendChild(e);let C=n.senseOptions.length>0&&n.decks.length>0;C||(d.disabled=!0,d.title="No sense or deck available");let u=!1,f=()=>{u||(u=!0,clearTimeout(L),cancelAnimationFrame(E),e.remove(),document.removeEventListener("keydown",T),document.removeEventListener("click",S))},A=()=>{if(u)return;let t=p.value,a=m.value;!t||!a||(f(),r(t,a))};d.addEventListener("click",A),h.addEventListener("click",()=>{f(),s()});let T=t=>{t.key==="Escape"&&(f(),s())};document.addEventListener("keydown",T);let S=t=>{e.contains(t.target)||(f(),s())};document.addEventListener("click",S);let M=performance.now(),E=0,_=t=>{let a=t-M,D=Math.max(0,5e3-a),O=D/5e3;w.style.transform=`scaleX(${O})`,D>0&&!u&&(E=requestAnimationFrame(_))};E=requestAnimationFrame(_);let L=window.setTimeout(()=>{!u&&C&&A()},5e3);return{close:f}}chrome.runtime.onMessage.addListener((o,n,r)=>{if(o.type==="PING")return r({ok:!0}),!0;if(o.type==="SHOW_ADD_TOAST"){let s=window.getSelection();if(!s||s.rangeCount===0)return;let x=s.getRangeAt(0),e=o.payload,{close:b}=N(x,e,(c,i)=>{chrome.runtime.sendMessage({type:"ADD_ITEM",payload:{wordSenseId:c,deckId:i,displayLanguage:e.displayLanguage}},l=>{b(),l?.success?k(`Added \u201C${e.text}\u201D to deck`):k(`Failed to add \u201C${e.text}\u201D`),r({handled:!0})})},()=>{b(),r({handled:!0})});return!0}o.type==="SHOW_ERROR_TOAST"&&k(o.payload.message)});function k(o){let n=document.createElement("div");n.textContent=o,n.style.cssText="position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#1c1b1f;color:#fff;padding:12px 20px;border-radius:999px;z-index:2147483647;font-family:sans-serif;font-size:14px;",document.body.appendChild(n),setTimeout(()=>n.remove(),2500)}})();
