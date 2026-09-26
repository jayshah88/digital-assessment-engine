import{r as Q}from"./vendor-charts.BD2twUse.js";import{c as x}from"./vendor-zustand.Cx0H0Oic.js";import{r as I}from"./vendor-query.BH03Kj_B.js";var E,C=Q;E=C.createRoot,C.hydrateRoot;const q={};function A(t,n){let e;try{e=t()}catch{return}return{getItem:o=>{var r;const d=m=>m===null?null:JSON.parse(m,void 0),u=(r=e.getItem(o))!=null?r:null;return u instanceof Promise?u.then(d):d(u)},setItem:(o,r)=>e.setItem(o,JSON.stringify(r,void 0)),removeItem:o=>e.removeItem(o)}}const S=t=>n=>{try{const e=t(n);return e instanceof Promise?e:{then(s){return S(s)(e)},catch(s){return this}}}catch(e){return{then(s){return this},catch(s){return S(s)(e)}}}},T=(t,n)=>(e,s,o)=>{let r={getStorage:()=>localStorage,serialize:JSON.stringify,deserialize:JSON.parse,partialize:i=>i,version:0,merge:(i,h)=>({...h,...i}),...n},d=!1;const u=new Set,m=new Set;let l;try{l=r.getStorage()}catch{}if(!l)return t((...i)=>{e(...i)},s,o);const p=S(r.serialize),g=()=>{const i=r.partialize({...s()});let h;const a=p({state:i,version:r.version}).then(f=>l.setItem(r.name,f)).catch(f=>{h=f});if(h)throw h;return a},y=o.setState;o.setState=(i,h)=>{y(i,h),g()};const v=t((...i)=>{e(...i),g()},s,o);let k;const c=()=>{var i;if(!l)return;d=!1,u.forEach(a=>a(s()));const h=((i=r.onRehydrateStorage)==null?void 0:i.call(r,s()))||void 0;return S(l.getItem.bind(l))(r.name).then(a=>{if(a)return r.deserialize(a)}).then(a=>{if(a)if(typeof a.version=="number"&&a.version!==r.version){if(r.migrate)return r.migrate(a.state,a.version)}else return a.state}).then(a=>{var f;return k=r.merge(a,(f=s())!=null?f:v),e(k,!0),g()}).then(()=>{h?.(k,void 0),d=!0,m.forEach(a=>a(k))}).catch(a=>{h?.(void 0,a)})};return o.persist={setOptions:i=>{r={...r,...i},i.getStorage&&(l=i.getStorage())},clearStorage:()=>{l?.removeItem(r.name)},getOptions:()=>r,rehydrate:()=>c(),hasHydrated:()=>d,onHydrate:i=>(u.add(i),()=>{u.delete(i)}),onFinishHydration:i=>(m.add(i),()=>{m.delete(i)})},c(),k||v},N=(t,n)=>(e,s,o)=>{let r={storage:A(()=>localStorage),partialize:c=>c,version:0,merge:(c,i)=>({...i,...c}),...n},d=!1;const u=new Set,m=new Set;let l=r.storage;if(!l)return t((...c)=>{e(...c)},s,o);const p=()=>{const c=r.partialize({...s()});return l.setItem(r.name,{state:c,version:r.version})},g=o.setState;o.setState=(c,i)=>{g(c,i),p()};const y=t((...c)=>{e(...c),p()},s,o);o.getInitialState=()=>y;let v;const k=()=>{var c,i;if(!l)return;d=!1,u.forEach(a=>{var f;return a((f=s())!=null?f:y)});const h=((i=r.onRehydrateStorage)==null?void 0:i.call(r,(c=s())!=null?c:y))||void 0;return S(l.getItem.bind(l))(r.name).then(a=>{if(a)if(typeof a.version=="number"&&a.version!==r.version){if(r.migrate)return[!0,r.migrate(a.state,a.version)]}else return[!1,a.state];return[!1,void 0]}).then(a=>{var f;const[R,M]=a;if(v=r.merge(M,(f=s())!=null?f:y),e(v,!0),R)return p()}).then(()=>{h?.(v,void 0),v=s(),d=!0,m.forEach(a=>a(v))}).catch(a=>{h?.(void 0,a)})};return o.persist={setOptions:c=>{r={...r,...c},c.storage&&(l=c.storage)},clearStorage:()=>{l?.removeItem(r.name)},getOptions:()=>r,rehydrate:()=>k(),hasHydrated:()=>d,onHydrate:c=>(u.add(c),()=>{u.delete(c)}),onFinishHydration:c=>(m.add(c),()=>{m.delete(c)})},r.skipHydration||k(),v||y},D=(t,n)=>"getStorage"in n||"serialize"in n||"deserialize"in n?T(t,n):N(t,n),P=D,L=window.dapConfig||window.dapAdmin||{},H=t=>{if(t.startsWith("http://")||t.startsWith("https://")){const n=new URL(t),e=window.location,s=(n.hostname==="localhost"||n.hostname==="127.0.0.1")&&(e.hostname==="localhost"||e.hostname==="127.0.0.1");if(n.origin!==e.origin&&!s&&n.hostname!==e.hostname)throw new Error("Invalid target URL origin")}return t},b={baseUrl:L.apiUrl||"/wp-json/assessment/v1",nonce:L.nonce||"",async request(t,n={}){const e=new AbortController,s=setTimeout(()=>e.abort(),3e4),o=window.wpApiSettings?.nonce||window.dapConfig?.nonce||window.dapAdmin?.nonce||this.nonce;try{const r=await fetch(H(`${this.baseUrl}${t}`),{...n,signal:e.signal,headers:{"Content-Type":"application/json","X-WP-Nonce":o,...n.headers||{}},credentials:"same-origin"});clearTimeout(s);const d=await r.text();let u;try{u=JSON.parse(d)}catch{throw r.ok?new _("Invalid response from server.",500):new _(`Server Error (${r.status})`,r.status)}if(!r.ok)throw new _(u.message||"Request failed",r.status,u.code);return u}catch(r){throw clearTimeout(s),r.name==="AbortError"?new _("Request timed out.",408):r}},get:t=>b.request(t),post:(t,n)=>b.request(t,{method:"POST",body:JSON.stringify(n)}),put:(t,n)=>b.request(t,{method:"PUT",body:JSON.stringify(n)}),delete:t=>b.request(t,{method:"DELETE"})};class _ extends Error{constructor(n,e,s){super(n),this.status=e,this.code=s}}const $=x(P((t,n)=>({assessment:null,blocks:[],allQuestions:[],currentBlock:0,currentQuestion:0,assessmentId:null,answers:{},result:null,submissionUuid:null,submissionId:null,leadCaptured:!1,phase:"intro",isLoading:!1,error:null,startedAt:null,sessionId:crypto.randomUUID(),setAssessment:(e,s)=>{const{assessmentId:o,allQuestions:r,reset:d}=n(),u=(s||[]).flatMap(g=>(g.questions||[]).map(y=>({...y,blockId:g.id,blockTitle:g.title,blockColor:g.color,blockIcon:g.icon,blockWeight:g.weight}))),m=o&&e.id&&Number(e.id)!==Number(o),l=o&&e.id&&r.length>0&&r.length!==u.length,p=o&&e.id&&r.length>0&&u.length>0&&r[0].id!==u[0].id;(m||l||p)&&d(),!(o===e.id&&n().allQuestions.length>0&&!l&&!p)&&t({assessment:e,blocks:s,assessmentId:e.id,allQuestions:u})},startAssessment:()=>t({phase:"questions",currentBlock:0,currentQuestion:0,startedAt:Date.now()}),setAnswer:(e,s)=>t(o=>({answers:{...o.answers,[e]:s}})),goNext:()=>{const{allQuestions:e,currentQuestion:s}=n();s<e.length-1&&t({currentQuestion:s+1})},goPrev:()=>{const{currentQuestion:e}=n();e>0&&t({currentQuestion:e-1})},goToQuestion:e=>t({currentQuestion:Math.max(0,e)}),submitAssessment:async()=>{const{answers:e,assessment:s,startedAt:o,sessionId:r}=n();t({phase:"submitting",isLoading:!0,error:null});try{const d=o?Math.round((Date.now()-o)/1e3):0,u=window.dapConfig?.leadGate??!0,m=await b.post("/submit",{assessment_id:s.id,answers:e,session_uuid:r,duration_seconds:d,utm_source:new URLSearchParams(location.search).get("utm_source")||"",utm_medium:new URLSearchParams(location.search).get("utm_medium")||"",utm_campaign:new URLSearchParams(location.search).get("utm_campaign")||"",is_preview:u}),l=m.data||m;t({result:l,submissionUuid:l.uuid||null,submissionId:l.submission_id||null,isLoading:!1}),await new Promise(p=>setTimeout(p,600)),t({phase:l.require_lead?"results":"full-results"})}catch(d){t({error:d.message||"The server encountered an issue while processing your report.",phase:"questions",isLoading:!1})}},submitLead:async e=>{t({isLoading:!0,error:null});try{let{submissionId:s,answers:o,assessment:r,sessionId:d,startedAt:u}=n();if(!s){const m=u?Math.round((Date.now()-u)/1e3):0,l=await b.post("/submit",{assessment_id:r.id,answers:o,session_uuid:d,duration_seconds:m,utm_source:new URLSearchParams(location.search).get("utm_source")||"",utm_medium:new URLSearchParams(location.search).get("utm_medium")||"",utm_campaign:new URLSearchParams(location.search).get("utm_campaign")||"",is_preview:!1}),p=l.data||l;s=p.submission_id,t({submissionId:s,submissionUuid:p.uuid})}await b.post("/lead",{...e,submission_id:s}),t({leadCaptured:!0,phase:"full-results",isLoading:!1})}catch(s){throw t({error:s.message,isLoading:!1}),s}},reset:()=>t({phase:"intro",answers:{},result:null,submissionUuid:null,submissionId:null,leadCaptured:!1,currentBlock:0,currentQuestion:0,startedAt:null,error:null,sessionId:crypto.randomUUID()}),get currentQ(){const{allQuestions:e,currentQuestion:s}=n();return e[s]||null},get progress(){const{allQuestions:e,currentQuestion:s}=n();return e.length>0?Math.round(s/e.length*100):0},get answeredCount(){return Object.keys(n().answers).length},get isCurrentAnswered(){const e=n().currentQ;return e?n().answers[e.id]!==void 0:!1}}),{name:"dap-session",storage:A(()=>localStorage),partialize:t=>({answers:t.answers,currentQuestion:t.currentQuestion,sessionId:t.sessionId,startedAt:t.startedAt,phase:t.phase==="submitting"?"questions":t.phase,result:t.result,submissionUuid:t.submissionUuid,submissionId:t.submissionId,leadCaptured:t.leadCaptured})}));typeof window<"u"&&(window.__dapStore=$);/**
 * @license lucide-react v0.408.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const j=t=>t.replace(/([a-z0-9])([A-Z])/g,"$1-$2").toLowerCase(),U=(...t)=>t.filter((n,e,s)=>!!n&&s.indexOf(n)===e).join(" ");/**
 * @license lucide-react v0.408.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */var z={xmlns:"http://www.w3.org/2000/svg",width:24,height:24,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2,strokeLinecap:"round",strokeLinejoin:"round"};/**
 * @license lucide-react v0.408.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const J=I.forwardRef(({color:t="currentColor",size:n=24,strokeWidth:e=2,absoluteStrokeWidth:s,className:o="",children:r,iconNode:d,...u},m)=>I.createElement("svg",{ref:m,...z,width:n,height:n,stroke:t,strokeWidth:s?Number(e)*24/Number(n):e,className:U("lucide",o),...u},[...d.map(([l,p])=>I.createElement(l,p)),...Array.isArray(r)?r:[r]]));/**
 * @license lucide-react v0.408.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const w=(t,n)=>{const e=I.forwardRef(({className:s,...o},r)=>I.createElement(J,{ref:r,iconNode:n,className:U(`lucide-${j(t)}`,s),...o}));return e.displayName=`${t}`,e};/**
 * @license lucide-react v0.408.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const G=w("Check",[["path",{d:"M20 6 9 17l-5-5",key:"1gmf2c"}]]);/**
 * @license lucide-react v0.408.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const W=w("CircleAlert",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["line",{x1:"12",x2:"12",y1:"8",y2:"12",key:"1pkeuh"}],["line",{x1:"12",x2:"12.01",y1:"16",y2:"16",key:"4dfq90"}]]);/**
 * @license lucide-react v0.408.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const K=w("CircleCheckBig",[["path",{d:"M22 11.08V12a10 10 0 1 1-5.93-9.14",key:"g774vq"}],["path",{d:"m9 11 3 3L22 4",key:"1pflzl"}]]);/**
 * @license lucide-react v0.408.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const X=w("Download",[["path",{d:"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4",key:"ih7n3h"}],["polyline",{points:"7 10 12 15 17 10",key:"2ggqvy"}],["line",{x1:"12",x2:"12",y1:"15",y2:"3",key:"1vk2je"}]]);/**
 * @license lucide-react v0.408.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Z=w("Globe",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20",key:"13o1zl"}],["path",{d:"M2 12h20",key:"9i4pu4"}]]);/**
 * @license lucide-react v0.408.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Y=w("Info",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"M12 16v-4",key:"1dtifu"}],["path",{d:"M12 8h.01",key:"e9boi3"}]]);/**
 * @license lucide-react v0.408.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const V=w("Mail",[["rect",{width:"20",height:"16",x:"2",y:"4",rx:"2",key:"18n3k1"}],["path",{d:"m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7",key:"1ocrg3"}]]);/**
 * @license lucide-react v0.408.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ee=w("RefreshCw",[["path",{d:"M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8",key:"v9h5vc"}],["path",{d:"M21 3v5h-5",key:"1q7to0"}],["path",{d:"M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16",key:"3uifl3"}],["path",{d:"M8 16H3v5",key:"1cv678"}]]);/**
 * @license lucide-react v0.408.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const te=w("TrendingUp",[["polyline",{points:"22 7 13.5 15.5 8.5 10.5 2 17",key:"126l90"}],["polyline",{points:"16 7 22 7 22 13",key:"kwv8wd"}]]);/**
 * @license lucide-react v0.408.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const re=w("TriangleAlert",[["path",{d:"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3",key:"wmoenq"}],["path",{d:"M12 9v4",key:"juzpu7"}],["path",{d:"M12 17h.01",key:"p32p05"}]]);export{W as C,X as D,Z as G,Y as I,V as M,ee as R,te as T,G as a,K as b,w as c,re as d,b as e,E as f,P as p,$ as u};
