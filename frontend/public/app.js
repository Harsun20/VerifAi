(() => {
  const apiBase = "";
  const state = {token: "", user: null, cases: [], selectedId: null};
  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? "");
  const setMessage = (id, text, success=false) => {const el=$(id);el.textContent=text;el.classList.toggle("success",success)};
  const request = async (path, options={}) => {
    const headers = new Headers(options.headers || {});
    if (state.token) headers.set("Authorization", `Bearer ${state.token}`);
    const response = await fetch(`${apiBase}/api/v1${path}`, {...options, headers});
    const type=response.headers.get("content-type")||"";
    const data=type.includes("application/json")?await response.json():{};
    if(!response.ok) throw new Error(data.error||`Request failed (${response.status})`);
    return data;
  };
  const connection = async () => {
    const el=$("connection");
    try {await request("/health",{headers:{}});el.className="connection ok";el.lastElementChild.textContent="Backend connected";return true}
    catch(e){el.className="connection bad";el.lastElementChild.textContent="Backend unavailable";return false}
  };
  const node=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=esc(text);return e};
  const loadCases = async () => {
    const data=await request("/cases");state.cases=data.cases||[];
    const list=$("case-list");list.replaceChildren();
    if(!state.cases.length){list.append(node("p","muted","No applications yet."));$("detail-panel").innerHTML='<div class="empty"><h2>No applications yet</h2><p class="muted">Submit a document or ask an administrator to provision an applicant account.</p></div>';return}
    for(const item of state.cases){
      const b=node("button","case-item"),title=node("span","case-item-title",item.title),meta=node("div","case-meta"),left=node("span","",`${item.reference} · ${item.status}`),badge=node("span",`risk ${item.risk_level.toLowerCase()}`,`${item.risk_level} risk`);
      meta.append(left,badge);b.append(title,meta);b.addEventListener("click",()=>showCase(item.id));list.append(b);
    }
    if(!state.selectedId||!state.cases.some(c=>c.id===state.selectedId))state.selectedId=state.cases[0].id;
    await showCase(state.selectedId);
  };
  const showCase = async (id) => {
    state.selectedId=id;const {case:item}=await request(`/cases/${id}`);const panel=$("detail-panel");panel.replaceChildren();
    const top=node("div","detail-top"),left=node("div"),ref=node("div","detail-ref",item.reference),title=node("h2","mt-2",item.title),sub=node("p","muted mb-0",`${item.application_type} · Submitted ${item.created_at}`),badge=node("span",`risk ${item.risk_level.toLowerCase()}`,`${item.risk_score}/100 · ${item.risk_level}`);
    left.append(ref,title,sub);top.append(left,badge);panel.append(top);
    const divider=node("div","divider");panel.append(divider,node("h2","mb-3","Review findings"));
    for(const f of item.findings||[]){const card=node("article",`finding ${f.severity||"low"}`);card.append(node("div","finding-title",`${(f.severity||"low").toUpperCase()} · ${f.title}`),node("p","muted mb-2 mt-2",f.detail),node("p","mb-0",`Next step: ${f.recommendation}`));panel.append(card)}
    if(item.review_note){panel.append(node("div","divider"),node("h2","mb-2","Officer note"),node("p","muted",item.review_note))}
    if(item.has_file){const download=node("button","btn btn-outline-light btn-sm mt-3","Download submitted file");download.addEventListener("click",async()=>{try{const r=await fetch(`${apiBase}/api/v1/cases/${id}/file`,{headers:{Authorization:`Bearer ${state.token}`}});if(!r.ok)throw new Error("Download failed");const blob=await r.blob(),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=item.file_name||"document";a.click();URL.revokeObjectURL(url)}catch(e){alert(e.message)}});panel.append(download)}
    if(state.user.role==="admin"||state.user.role==="officer"){
      panel.append(node("div","divider"));const form=node("form","review-form"),heading=node("h2","mb-3","Record officer review"),lab1=node("label","form-label","Application status"),sel=node("select","form-select mb-3"),statuses=["Submitted","Under Review","Needs Correction","Approved","Rejected"];
      sel.name="status";for(const status of statuses){const opt=node("option","",status);opt.value=status;opt.selected=status===item.status;sel.append(opt)}
      const lab2=node("label","form-label","Review note"),area=node("textarea","form-control mb-3",item.review_note);area.rows=3;area.name="review_note";const save=node("button","btn btn-primary","Save review"),msg=node("p","message mb-0");form.append(heading,lab1,sel,lab2,area,save,msg);form.addEventListener("submit",async(e)=>{e.preventDefault();try{await request(`/cases/${id}/review`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({status:sel.value,review_note:area.value})});msg.textContent="Review saved.";msg.className="message success mb-0";await loadCases()}catch(err){msg.textContent=err.message}});panel.append(form);
    }
  };
  const showApp = async (user) => {state.user=user;$("login-panel").hidden=true;$("app-panel").hidden=false;$('welcome').textContent=`Hello, ${user.display_name}`;$('role-line').textContent=`Signed in as ${user.role}`;await loadCases()};
  $("login-form").addEventListener("submit",async(e)=>{e.preventDefault();setMessage("login-message","Signing in…");try{const data=await request("/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:$('username').value,password:$('password').value})});state.token=data.accessToken;setMessage("login-message","",true);await showApp(data.user)}catch(err){setMessage("login-message",err.message)}});
  $("submit-form").addEventListener("submit",async(e)=>{e.preventDefault();setMessage("submit-message","Uploading and checking document…");try{const body=new FormData(e.currentTarget);const data=await request("/cases",{method:"POST",body});setMessage("submit-message",`Created ${data.case.reference}.`,true);e.currentTarget.reset();state.selectedId=data.case.id;await loadCases()}catch(err){setMessage("submit-message",err.message)}});
  $("refresh").addEventListener("click",()=>loadCases().catch(e=>setMessage("submit-message",e.message)));
  $("logout").addEventListener("click",async()=>{try{await request("/auth/logout",{method:"POST"})}catch{}state.token="";state.user=null;state.selectedId=null;$('app-panel').hidden=true;$('login-panel').hidden=false;$('password').value=""});
  connection();
})();