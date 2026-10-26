// VERIFY-AI demo API. All records are synthetic and held in memory per function instance.
const records = [
 {id:"VA-26041", applicant:"Aarav Sharma", category:"Scholarship", institution:"Northview Institute of Technology", submitted:"2026-10-25", status:"Needs review", risk:"High", score:62, docs:["Application form","Income certificate","Aadhaar copy"], findings:[{severity:"high",title:"Income certificate expired",detail:"The certificate expiry date is 2026-08-31.",evidence:"Synthetic field: certificate_expiry = 2026-08-31",action:"Request a current income certificate."},{severity:"medium",title:"Name mismatch",detail:"Application says “Aarav Sharma”; income certificate says “Aarav S. Sharma”.",evidence:"Synthetic fields: applicant_name vs certificate_name",action:"Confirm the name with the applicant."}]},
 {id:"VA-26042", applicant:"Meera Reddy", category:"Institution Approval", institution:"Coastal School of Computing", submitted:"2026-10-24", status:"In progress", risk:"Medium", score:81, docs:["Application form","Faculty list","Infrastructure declaration"], findings:[{severity:"medium",title:"Faculty list incomplete",detail:"Two faculty entries are missing qualification details.",evidence:"Synthetic field: faculty_qualification = 2 empty values",action:"Ask the institution to complete the faculty details."}]},
 {id:"VA-26043", applicant:"Ishaan Patel", category:"KYC", institution:"Sample Applicant", submitted:"2026-10-23", status:"Verified (demo)", risk:"Low", score:96, docs:["Application form","Identity proof","Address proof"], findings:[]},
 {id:"VA-26044", applicant:"Ananya Das", category:"MSME Support", institution:"Blue Orbit Labs (synthetic)", submitted:"2026-10-22", status:"Needs review", risk:"High", score:58, docs:["Application form","Registration certificate","Bank proof"], findings:[{severity:"high",title:"Registration ID inconsistency",detail:"The application registration ID does not match the uploaded certificate.",evidence:"Synthetic values: application_id = UDYAM-XX-1042; certificate_id = UDYAM-XX-1402",action:"Verify the registration ID against an authoritative source."},{severity:"medium",title:"Source verification unavailable",detail:"No external registry is connected in this prototype.",evidence:"Source status: NOT_CONNECTED",action:"Route to an authorised officer for manual verification."}]}
];
exports.handler = async (event) => {
 const headers={"content-type":"application/json; charset=utf-8","access-control-allow-origin":"*","access-control-allow-headers":"content-type","access-control-allow-methods":"GET,POST,OPTIONS"};
 if(event.httpMethod==="OPTIONS") return {statusCode:204,headers,body:""};
 const path=(event.path||"").split("/").pop();
 if(event.httpMethod==="GET" && path==="api") return {statusCode:200,headers,body:JSON.stringify({ok:true,app:"VERIFY-AI",demo:true,records})};
 if(event.httpMethod==="POST" && path==="api"){
  let body={}; try{body=JSON.parse(event.body||"{}")}catch{return {statusCode:400,headers,body:JSON.stringify({error:"Invalid JSON"})}}
  if(body.action==="review"){
   const rec=records.find(r=>r.id===body.id); if(!rec)return {statusCode:404,headers,body:JSON.stringify({error:"Case not found"})};
   const allowed=["In progress","Needs review","Verified (demo)","Correction requested"];
   if(!allowed.includes(body.status))return {statusCode:400,headers,body:JSON.stringify({error:"Invalid status"})};
   rec.status=body.status; return {statusCode:200,headers,body:JSON.stringify({ok:true,record:rec,message:"Demo review status updated in this function instance."})};
  }
  if(body.action==="validate"){
   const name=String(body.applicant||"").trim(), category=String(body.category||"").trim(), docs=Array.isArray(body.documents)?body.documents:[];
   const findings=[];
   if(!name)findings.push({severity:"high",title:"Applicant name missing",detail:"Applicant name is required.",action:"Enter the applicant name."});
   if(!category)findings.push({severity:"high",title:"Application category missing",detail:"Choose an application category.",action:"Select a category."});
   if(!docs.includes("Application form"))findings.push({severity:"high",title:"Application form missing",detail:"The application form is not included in this synthetic submission.",action:"Upload the application form."});
   if(!docs.includes("Identity proof"))findings.push({severity:"medium",title:"Identity proof not listed",detail:"Identity proof was not selected in the uploaded-document checklist.",action:"Confirm the applicable checklist and attach proof if required."});
   if(docs.length===0)findings.push({severity:"medium",title:"No documents selected",detail:"No supporting documents were selected.",action:"Select the documents available for review."});
   return {statusCode:200,headers,body:JSON.stringify({ok:true,demo:true,applicant:name||"Unspecified applicant",category:category||"Unspecified",documents:docs,findings,score:Math.max(35,100-findings.reduce((s,f)=>s+(f.severity==="high"?22:10),0)),disclaimer:"Rule-based prototype only. No OCR, external registry, or official compliance decision was performed."})};
  }
  return {statusCode:400,headers,body:JSON.stringify({error:"Unknown action"})};
 }
 return {statusCode:405,headers,body:JSON.stringify({error:"Method not allowed"})};
};
