"use strict";(()=>{function $(){let a=document.createElement("style");return a.textContent=`
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
    .pn-toast-notice {
      font-size: 12px;
      line-height: 1.4;
      color: #7c2d12;
      background: #fef3c7;
      border: 1px solid #f59e0b;
      border-radius: 8px;
      padding: 8px 10px;
    }
    .pn-toast-code { font-size: 11px; color: #605d66; margin-top: 2px; }
    .pn-toast-label { font-size: 11px; color: #605d66; margin-bottom: 4px; }
    .pn-toast-select, .pn-toast-input {
      width: 100%;
      padding: 8px 10px;
      border-radius: 8px;
      border: 1px solid #cac4d0;
      background: #fff;
      font-size: 13px;
      color: #1c1b1f;
    }
    .pn-toast-input.invalid { border-color: #dc2626; }
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
  `,a}function I(a,t,l,x,b){let d=a.getBoundingClientRect(),n=document.createElement("div");n.className="pn-toast",n.style.left=`${Math.max(8,d.left+window.scrollX)}px`,n.style.top=`${Math.max(8,d.bottom+window.scrollY+8)}px`;let h=$();n.appendChild(h);let p=document.createElement("div");p.className="pn-toast-title",p.textContent="Add to Project PN",n.appendChild(p);let r=document.createElement("div");r.className="pn-toast-word",r.textContent=t.text,n.appendChild(r);let c=!!(t.manualOnly||t.senseOptions.length===0),v=c||!!t.translationMissing;if(t.errorMessage||t.translationMissing){let e=document.createElement("div");e.className="pn-toast-notice";let o=document.createElement("div");if(o.textContent=t.errorMessage??"No localized meaning found \u2014 enter your own meaning below to save.",e.appendChild(o),t.errorCode){let s=document.createElement("div");s.className="pn-toast-code",s.textContent=`Code: ${t.errorCode}`,e.appendChild(s)}n.appendChild(e)}let m=null;if(!c){let e=document.createElement("div");e.className="pn-toast-label",e.textContent="Sense",n.appendChild(e),m=document.createElement("select"),m.className="pn-toast-select",t.senseOptions.forEach(o=>{let s=document.createElement("option");s.value=o.word_sense_id;let g=t.translationMissing?o.definition:o.localized_short_definition??o.localized_definition;s.textContent=`${o.lemma} \xB7 ${o.part_of_speech} \xB7 ${g}`,m.appendChild(s)}),t.defaultSenseId&&(m.value=t.defaultSenseId),n.appendChild(m)}let i=null;if(v){let e=document.createElement("div");e.className="pn-toast-label",e.textContent="Your meaning",n.appendChild(e),i=document.createElement("input"),i.type="text",i.className="pn-toast-input",i.placeholder="Type the meaning to remember",n.appendChild(i)}let T=document.createElement("div");T.className="pn-toast-label",T.textContent="Deck",n.appendChild(T);let E=document.createElement("select");E.className="pn-toast-select",t.decks.forEach(e=>{let o=document.createElement("option");o.value=e.id,o.textContent=e.name,E.appendChild(o)}),t.defaultDeckId&&(E.value=t.defaultDeckId),n.appendChild(E);let C=null;if(!v){let e=document.createElement("div");e.className="pn-toast-progress",C=document.createElement("div"),C.className="pn-toast-progress-bar",e.appendChild(C),n.appendChild(e)}let A=document.createElement("div");A.className="pn-toast-actions";let f=document.createElement("button");f.className="pn-toast-btn primary",f.textContent=c?"Save meaning":"Add",A.appendChild(f);let w=document.createElement("button");w.className="pn-toast-btn secondary",w.textContent="Cancel",A.appendChild(w),n.appendChild(A),document.body.appendChild(n);let _=!v&&t.senseOptions.length>0&&t.decks.length>0;(!(t.decks.length>0)||!c&&t.senseOptions.length===0)&&(f.disabled=!0,f.title="No deck available");let k=!1,S=0,M=0,u=()=>{k||(k=!0,clearTimeout(S),cancelAnimationFrame(M),n.remove(),document.removeEventListener("keydown",D),document.removeEventListener("click",L))},N=()=>{if(k)return;let e=E.value;if(!e)return;if(v){let s=i?.value.trim()??"";if(!s){i?.classList.add("invalid"),i?.focus();return}if(c){u(),x(s,e);return}let g=m?.value;if(!g)return;u(),l(g,e,s);return}let o=m?.value;o&&(u(),l(o,e))};f.addEventListener("click",N),w.addEventListener("click",()=>{u(),b()});let D=e=>{e.key==="Escape"?(u(),b()):e.key==="Enter"&&v&&document.activeElement===i&&N()};document.addEventListener("keydown",D);let L=e=>{n.contains(e.target)||(u(),b())};if(document.addEventListener("click",L),_&&C){let e=performance.now(),o=s=>{let g=s-e,O=Math.max(0,5e3-g),z=O/5e3;C.style.transform=`scaleX(${z})`,O>0&&!k&&(M=requestAnimationFrame(o))};M=requestAnimationFrame(o),S=window.setTimeout(()=>{!k&&_&&N()},5e3)}return{close:u}}chrome.runtime.onMessage.addListener((a,t,l)=>{if(a.type==="PING")return l({ok:!0}),!0;if(a.type==="SHOW_ADD_TOAST"||a.type==="SHOW_MANUAL_ADD_TOAST"){let x=window.getSelection();if(!x||x.rangeCount===0)return;let b=x.getRangeAt(0),d=a.payload,{close:n}=I(b,d,(h,p,r)=>{chrome.runtime.sendMessage({type:"ADD_ITEM",payload:{wordSenseId:h,deckId:p,displayLanguage:d.displayLanguage,personalNote:r}},c=>{n(),c?.success?y(`Added \u201C${d.text}\u201D to deck`):y(c?.error??`Failed to add \u201C${d.text}\u201D`),l({handled:!0})})},(h,p)=>{chrome.runtime.sendMessage({type:"ADD_MANUAL_ITEM",payload:{text:d.text,deckId:p,displayLanguage:d.displayLanguage,targetLanguage:d.targetLanguage,personalNote:h}},r=>{n(),r?.success?y(`Added \u201C${d.text}\u201D to deck`):y(r?.error??`Failed to add \u201C${d.text}\u201D`),l({handled:!0})})},()=>{n(),l({handled:!0})});return!0}a.type==="SHOW_ERROR_TOAST"&&y(a.payload.message)});function y(a){let t=document.createElement("div");t.textContent=a,t.style.cssText="position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#1c1b1f;color:#fff;padding:12px 20px;border-radius:999px;z-index:2147483647;font-family:sans-serif;font-size:14px;",document.body.appendChild(t),setTimeout(()=>t.remove(),3e3)}})();
