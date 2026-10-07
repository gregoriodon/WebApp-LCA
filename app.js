
"use strict";

const STORAGE_KEY = "grinnzove_lca_webapp_v2";
const ACTIVE_KEY = "grinnzove_lca_active_company_v2";
const $ = (q, root=document) => root.querySelector(q);
const $$ = (q, root=document) => [...root.querySelectorAll(q)];
const main = $("#main");
let memory = {};
let persistent = true;
let state = {screen:"home", draft:null, stableDraft:null, boxDraft:null, rationDraft:null, cropsDraft:null, biogasDraft:null,
  batchDraft:null, manureDraft:null, spreadingDraft:null, agroDraft:null, documentDraft:null, documentExtraction:null};

function uid(){ return globalThis.crypto?.randomUUID?.() || "id-"+Date.now()+"-"+Math.random().toString(16).slice(2); }
function today(){ return new Date().toISOString().slice(0,10); }
function esc(v){ return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m])); }

function sget(k){ try{return localStorage.getItem(k)}catch(e){persistent=false;return memory[k]??null} }
function sset(k,v){ try{localStorage.setItem(k,v);return true}catch(e){persistent=false;memory[k]=v;return false} }

const DOC_DB_NAME="grinnzove_lca_documents_v1";
const DOC_STORE="files";
function openDocDB(){
  return new Promise((resolve,reject)=>{
    if(!("indexedDB" in window)){reject(new Error("IndexedDB non disponibile"));return;}
    const req=indexedDB.open(DOC_DB_NAME,1);
    req.onupgradeneeded=()=>{const d=req.result;if(!d.objectStoreNames.contains(DOC_STORE))d.createObjectStore(DOC_STORE,{keyPath:"id"});};
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });
}
async function putDocBlob(id,file){const d=await openDocDB();return new Promise((res,rej)=>{const tx=d.transaction(DOC_STORE,"readwrite");tx.objectStore(DOC_STORE).put({id,blob:file});tx.oncomplete=()=>{d.close();res(true)};tx.onerror=()=>{d.close();rej(tx.error)}})}
async function getDocBlob(id){const d=await openDocDB();return new Promise((res,rej)=>{const tx=d.transaction(DOC_STORE,"readonly");const r=tx.objectStore(DOC_STORE).get(id);r.onsuccess=()=>{d.close();res(r.result?.blob||null)};r.onerror=()=>{d.close();rej(r.error)}})}
async function deleteDocBlob(id){const d=await openDocDB();return new Promise((res,rej)=>{const tx=d.transaction(DOC_STORE,"readwrite");tx.objectStore(DOC_STORE).delete(id);tx.oncomplete=()=>{d.close();res(true)};tx.onerror=()=>{d.close();rej(tx.error)}})}
function db(){
  try{
    const x=JSON.parse(sget(STORAGE_KEY)||'{"companies":[]}');
    if(!Array.isArray(x.companies)) x.companies=[];
    return x;
  }catch{return {companies:[]}}
}
function saveDB(x){
  const ok=sset(STORAGE_KEY,JSON.stringify(x));
  updateStorageChip();
  return ok;
}
function activeId(){ return sget(ACTIVE_KEY)||""; }
function setActiveId(id){ sset(ACTIVE_KEY,id||""); }
function companyById(id){ return db().companies.find(c=>c.id===id); }
function activeCompany(){ return companyById(activeId()); }

function deepGet(o,path){
  return path.split(".").reduce((a,k)=>a==null?undefined:a[k],o);
}
function deepSet(o,path,val){
  const p=path.split("."); let x=o;
  p.forEach((k,i)=>{ if(i===p.length-1){x[k]=val;return} if(!x[k]||typeof x[k]!=="object")x[k]={}; x=x[k]; });
}
function toast(msg){
  const el=$("#toast"); el.textContent=msg; el.classList.add("show");
  clearTimeout(toast.t); toast.t=setTimeout(()=>el.classList.remove("show"),2600);
}
function updateStorageChip(){
  const el=$("#storageChip"); if(!el)return;
  el.textContent=persistent?"Dati locali":"Memoria temporanea";
}
function ensureActive(){
  const d=db();
  if(!d.companies.length){ setActiveId(""); return null; }
  let c=d.companies.find(x=>x.id===activeId());
  if(!c){ c=d.companies[0]; setActiveId(c.id); }
  return c;
}
function upsertCompany(c){
  const d=db(); const i=d.companies.findIndex(x=>x.id===c.id);
  c.updatedAt=new Date().toISOString();
  if(i>=0)d.companies[i]=c;else d.companies.unshift(c);
  saveDB(d); setActiveId(c.id);
}
function updateCompany(id,fn){
  const d=db(); const i=d.companies.findIndex(x=>x.id===id); if(i<0)return;
  fn(d.companies[i]); d.companies[i].updatedAt=new Date().toISOString(); saveDB(d);
}
function newCompanyDraft(){
  return {
    id:uid(),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),
    general:{dataRilievo:today(),ragioneSociale:"",tipo:"",comune:"",provincia:"",cuaa:"",sauHa:"",satHa:"",superficieIrrigataHa:"",consistenzaCapi:""},
    personale:{
      addettiFamiliari:"",ruoliFamiliari:"",istruzioneFamiliari:"",formazioneFamiliari:"",argomentiFamiliari:"",
      addettiSalariati:"",ruoliSalariati:"",istruzioneSalariati:"",formazioneSalariati:"",argomentiSalariati:"",
      veterinario:"",armadietto:"",alimentarista:""
    },
    strutture:{
      nStalle:"",stallaCondizionamento:"",concimaiaCoperta:"",vascaCoperta:"",materialeLettiera:"",qLettiera:"",
      conformitaElettrico:"",approvvigionamentoIdrico:"",analisiAcqua:""
    },
    management:{
      carroModelloMarca:"",carroSemoventeTrainato:"",carroVerticaleOrizzontale:"",controlloMoscheRoditori:"",
      freqAsportazioneDeiezioni:"",freqPuliziaMangiatoia:"",ispezioneGiornaliera:"",rimozioneRefluoVasca:"",
      trinciapaglia:"",biogas:"",produzioneBiogasKW:"",usoTuttoLetame:"",usoTuttoLiquame:"",
      fotovoltaico:"",produzioneFotovoltaicoKW:"",consumiElettricita:"",consumiGasolio:""
    },
    stables:[], boxes:[], rations:[], crops:[], biogasRations:[],
    batches:[], manureSystems:[], spreadingEvents:[], fertilizationRecords:[], cropTreatments:[], irrigationRecords:[],
    energyRecords:[], manureAnalyses:[], feedAnalyses:[], livestockInventoryRecords:[], nitrogenBalanceRecords:[], documents:[]
  };
}
function newStableDraft(){
  return {id:uid(),companyId:activeId(),nome:"",ristallo:"",struttura:{},condizioni:{}};
}
function newBoxDraft(){
  return {id:uid(),companyId:activeId(),stableId:"",nome:"",caratteristiche:{},condizioni:{}};
}
function emptyRationRow(){ return {id:uid(),materiaPrima:"",kgCapoGiorno:"",approvvigionamento:"",origine:""}; }
function newRationDraft(){
  return {id:uid(),companyId:activeId(),dataRilievo:today(),titolo:"",tipoGeneticoSesso:"",rows:Array.from({length:8},emptyRationRow),cartellinoMangime:"",cartellinoIntegratore:""};
}
function emptyCropRow(){ return {id:uid(),coltura:"",superficie:"",prodotto:"",note:"",irrigazione:"",irrigazioneM3Ha:"",resa:"",azotofissatrice:"",nFissazioneKgHa:""}; }
function newCropsDraft(){ return {id:uid(),companyId:activeId(),anno:new Date().getFullYear(),rows:Array.from({length:4},emptyCropRow)}; }
function emptyBiogasRow(){ return {id:uid(),materiaPrima:"",kgGiorno:"",autoprodotto:"",origine:""}; }
function newBiogasDraft(){ return {id:uid(),companyId:activeId(),dataRilievo:today(),rows:Array.from({length:4},emptyBiogasRow)}; }
function newBatchDraft(){return {id:uid(),companyId:activeId(),codice:"",dataIngresso:"",dataUscita:"",capiEntrati:"",capiUsciti:"",capiMorti:"",sesso:"",tipoGenetico:"",pesoIngresso:"",pesoUscita:"",razioneId:"",source:{tipo:"Registro aziendale",qualita:"Registro aziendale",documentoId:""},note:""};}
function newManureDraft(){return {id:uid(),companyId:activeId(),anno:new Date().getFullYear(),stallaId:"",tipoRefluo:"",quotaPercentuale:"",sistemaStabulazione:"",rimozione:"",sistemaStoccaggio:"",copertura:"",durataGiorni:"",quantitaAnnua:"",unita:"m3/anno",nTotale:"",tanPercentN:"",sostanzaSecca:"",vs:"",biogas:"",separazione:"",source:{tipo:"Documento ufficiale",qualita:"Documento ufficiale",documentoId:""},note:""};}
function newSpreadingDraft(){return {id:uid(),companyId:activeId(),data:today(),anno:new Date().getFullYear(),coltura:"",superficieHa:"",tipoInput:"",prodotto:"",quantita:"",unita:"t",nTotale:"",tan:"",p2o5:"",pTotale:"",tecnica:"",incorporazioneOre:"",source:{tipo:"Documento ufficiale",qualita:"Documento ufficiale",documentoId:""},note:""};}
function newAgroDraft(){return {mode:"trattamento",treatment:{id:uid(),companyId:activeId(),data:today(),coltura:"",superficieHa:"",categoria:"",prodotto:"",principioAttivo:"",dose:"",unitaDose:"L/ha",quantitaTotale:"",source:{tipo:"Registro aziendale",qualita:"Registro aziendale",documentoId:""},note:""},irrigation:{id:uid(),companyId:activeId(),anno:new Date().getFullYear(),coltura:"",superficieHa:"",volumeM3:"",m3Ha:"",fonteAcqua:"",sistema:"",metodoStima:"",elettricitaKWh:"",gasolioL:"",source:{tipo:"Registro aziendale",qualita:"Registro aziendale",documentoId:""},note:""}};}
function newDocumentDraft(){return {id:uid(),companyId:activeId(),tipo:"PUA",anno:new Date().getFullYear(),descrizione:"",note:""};}

const NAV=[
  ["home","","Home"],
  ["review","","Dati inseriti"],
  ["company","","Nuova azienda"],
  ["batch","","Partite animali"],
  ["stable","","Nuova stalla"],
  ["box","","Gruppo di box"],
  ["ration","","Razione animali"],
  ["manure","","Reflui e stoccaggi"],
  ["crops","","Piano colturale"],
  ["agro","","Trattamenti / irrigazione"],
  ["biogas","","Razione biogas"],
  ["documents","","Documenti aziendali"],
];
function renderNav(){
  $("#nav").innerHTML=`<div class="nav-group">${NAV.map(([s,i,l])=>`<button class="nav-btn ${state.screen===s?"active":""}" data-nav="${s}">${l}</button>`).join("")}</div>`;
}
function goto(screen){
  state.screen=screen;
  if(screen==="company"){state.draft=newCompanyDraft();}
  if(screen==="stable"){state.stableDraft=newStableDraft();}
  if(screen==="box"){state.boxDraft=newBoxDraft();}
  if(screen==="ration"){state.rationDraft=newRationDraft();}
  if(screen==="crops"){state.cropsDraft=newCropsDraft();}
  if(screen==="biogas"){state.biogasDraft=newBiogasDraft();}
  if(screen==="batch"){state.batchDraft=newBatchDraft();}
  if(screen==="manure"){state.manureDraft=newManureDraft();}
  if(screen==="spreading"){state.spreadingDraft=newSpreadingDraft();}
  if(screen==="agro"){state.agroDraft=newAgroDraft();}
  if(screen==="documents"){state.documentDraft=newDocumentDraft();state.documentExtraction=null;}
  render();
  window.scrollTo({top:0,behavior:"smooth"});
}
function render(){ renderNav(); ({
  home:renderHome,review:renderReview,company:()=>renderCompany(1),companyManagement:()=>renderCompany(2),
  stable:renderStable,box:renderBox,ration:renderRation,crops:renderCrops,biogas:renderBiogas,
  batch:renderBatch,manure:renderManure,spreading:renderSpreading,agro:renderAgro,documents:renderDocuments
}[state.screen]||renderHome)(); }

function activeSelect(cls=""){
  const d=db(), a=activeId();
  return `<select id="activeCompanySelect" class="${cls}">
    <option value="">Seleziona azienda…</option>
    ${d.companies.map(c=>`<option value="${c.id}" ${c.id===a?"selected":""}>${esc(c.general.ragioneSociale||"Azienda senza nome")}</option>`).join("")}
  </select>`;
}
function docOptions(){const c=activeCompany();return (c?.documents||[]).map(d=>({v:d.id,l:`${d.tipo}${d.anno?` ${d.anno}`:""} — ${d.filename||d.descrizione||"documento"}`}));}
function sourceFields(prefix,obj){
  const docs=docOptions();
  return `<div class="fields source-grid">
    ${select("Fonte del dato",`${prefix}.tipo`,obj?.tipo||"",["Documento ufficiale","Registro aziendale","Misurato","Dichiarato dall'allevatore","Stimato / calcolato","Default"],"field third")}
    ${select("Qualità / tracciabilità",`${prefix}.qualita`,obj?.qualita||"",["Documento ufficiale","Registro aziendale","Misurato","Dichiarato","Stimato","Default"],"field third")}
    ${select("Documento collegato",`${prefix}.documentoId`,obj?.documentoId||"",docs,"field third","Nessun documento")}
  </div>`;
}
function rationOptions(){const c=activeCompany();return (c?.rations||[]).map(r=>({v:r.id,l:`${r.titolo||"Razione"} · ${r.tipoGeneticoSesso||""}`}));}
function stableOptions(){const c=activeCompany();return (c?.stables||[]).map(s=>({v:s.id,l:s.nome||"Stalla"}));}

function requirementNote(){
  return ``;
}
function renderHome(){
  const c=ensureActive(), d=db();
  main.innerHTML=`
    <section class="hero">
      <div>
        <span class="eyebrow">Progetto GrInnZoVe</span>
        <h2>Raccolta dati aziendali per analisi LCA</h2>
        
        <div class="hero-actions">
          <button class="btn btn-primary" data-action="new-company">＋ Nuova azienda</button>
          <button class="btn btn-secondary" data-nav="review" ${c?"":"disabled"}>Dati inseriti</button>
          <button class="btn btn-secondary" data-action="export-xlsx" ${c?"":"disabled"}>Esporta Excel azienda</button>
          <button class="btn btn-secondary" data-action="export-json">Backup JSON</button>
          <button class="btn btn-secondary" data-action="import-json">Importa backup</button>
        </div>
      </div>
      <img src="cow.jpg" class="hero-cow" alt="">
    </section>

    ${requirementNote()}

    <div class="context-bar">
      <div class="context-copy"><strong>Azienda attiva</strong><span>Usata per tutti i moduli di raccolta dati e documenti</span></div>
      ${activeSelect()}
      ${c?`<span class="badge">ID: ${esc(companyExcelId(c))}</span><span class="badge">${esc(c.general.comune||"Comune non indicato")}${c.general.provincia?` · ${esc(c.general.provincia)}`:""}</span>`:""}
    </div>

    ${c?`<div class="mini-stats">
      <div class="mini-stat"><span>Partite</span><strong>${c.batches?.length||0}</strong></div>
      <div class="mini-stat"><span>Stalle</span><strong>${c.stables?.length||0}</strong></div>
      <div class="mini-stat"><span>Reflui</span><strong>${c.manureSystems?.length||0}</strong></div>
      <div class="mini-stat"><span>Documenti</span><strong>${c.documents?.length||0}</strong></div>
    </div>`:""}

    <div class="card-grid">
      ${actionCard("＋","Inserisci nuova azienda","Anagrafica, personale, strutture generali e management.","company","Sempre disponibile")}
      ${actionCard("🐄","Partite animali","Normalizza i dati delle schede partita: capi, date, pesi, sesso e genetica.","batch",c?"Documento originale collegabile":"Serve prima un’azienda",!c)}
      ${actionCard("▤","Inserisci nuova stalla","Caratteristiche strutturali, impianti e condizioni della stalla.","stable",c?"Azienda attiva selezionata":"Serve prima un’azienda",!c)}
      ${actionCard("▦","Inserisci gruppo di box","Caratteristiche dei box e valutazione delle condizioni.","box",c?"Collegato a una stalla":"Serve prima un’azienda",!c)}
      ${actionCard("◫","Inserisci razione","Materia prima, kg/capo/giorno, approvvigionamento e origine.","ration","Dati per Tier 2",!c)}
      ${actionCard("▧","Reflui e stoccaggi","Percorso dei reflui, tipo di stoccaggio, copertura, durata e analisi N/TAN.","manure","PUA collegabile",!c)}
            ${actionCard("⌁","Inserisci piano colturale","Superficie, prodotto ottenuto, resa e informazioni di base.","crops","Dati colturali",!c)}
      ${actionCard("☘","Trattamenti e irrigazione","Fitosanitari/erbicidi e volumi irrigui con qualità e fonte del dato.","agro","Registri aziendali",!c)}
      ${actionCard("♻","Inserisci razione biogas","Materie prime, quantità giornaliera e origine.","biogas","Dati impianto",!c)}
      ${actionCard("📎","Documenti aziendali","Allega PUA, registri concimazioni, schede partita, trattamenti e altri file.","documents","Archiviazione locale",!c)}
    </div>`;
}
function actionCard(icon,title,copy,screen,badge,disabled=false){
  return `<article class="action-card">
    <h3>${title}</h3><p>${copy}</p>
    <div><span class="badge">${badge}</span></div>
    <button class="btn ${disabled?"btn-secondary":"btn-primary"}" style="margin-top:12px" data-nav="${screen}" ${disabled?"disabled":""}>Apri modulo</button>
  </article>`;
}

function input(label,path,value="",type="text",cls="field",hint=""){
  return `<div class="${cls}"><label class="label">${esc(label)}</label><input data-bind="${path}" type="${type}" value="${esc(value)}">${hint?`<div class="hint">${esc(hint)}</div>`:""}</div>`;
}
function textarea(label,path,value="",cls="field full"){
  return `<div class="${cls}"><label class="label">${esc(label)}</label><textarea data-bind="${path}">${esc(value)}</textarea></div>`;
}
function select(label,path,value,opts,cls="field",placeholder="Seleziona…"){
  const os=opts.map(x=>typeof x==="string"?{v:x,l:x}:x);
  return `<div class="${cls}"><label class="label">${esc(label)}</label><select data-bind="${path}"><option value="">${placeholder}</option>${os.map(o=>`<option value="${esc(o.v)}" ${String(o.v)===String(value)?"selected":""}>${esc(o.l)}</option>`).join("")}</select></div>`;
}
function yesno(label,path,value,cls="field"){
  return `<div class="${cls}"><label class="label">${esc(label)}</label><div class="segment">
    ${["Sì","No"].map(v=>`<label><input type="radio" name="${path}" data-bind="${path}" value="${v}" ${value===v?"checked":""}><span>${v}</span></label>`).join("")}
  </div></div>`;
}
function card(title,subtitle,body){
  return `<section class="form-card"><div class="form-card-head"><div><h3>${title}</h3>${subtitle?`<p>${subtitle}</p>`:""}</div></div><div class="form-card-body">${body}</div></section>`;
}
function header(title,subtitle,badge=""){
  return `<div class="section-title"><div><span class="eyebrow">Raccolta dati LCA</span><h2>${title}</h2><p>${subtitle}</p></div>${badge?`<span class="badge">${badge}</span>`:""}</div>`;
}
function companyProgress(step){
  return `<div class="progress">
    <div class="progress-step ${step>=1?"done":""} ${step===1?"current":""}"><span class="dot">1</span><span>Azienda</span></div>
    <span class="progress-line"></span>
    <div class="progress-step ${step>=2?"done":""} ${step===2?"current":""}"><span class="dot">2</span><span>Management</span></div>
    <span class="progress-line"></span>
    <div class="progress-step"><span class="dot">3</span><span>Stalla</span></div>
  </div>`;
}
function renderCompany(step){
  if(!state.draft)state.draft=newCompanyDraft();
  const c=state.draft;
  if(step===1){
    main.innerHTML=header("Nuova azienda","Prima parte del flusso guidato originale","Passaggio 1 di 2")+companyProgress(1)+
      card("Anagrafica","Dati generali del rilievo",`<div class="fields">
        ${input("Data rilievo","general.dataRilievo",c.general.dataRilievo,"date","field third")}
        ${input("Ragione sociale","general.ragioneSociale",c.general.ragioneSociale,"text","field")}
        ${input("Tipo azienda","general.tipo",c.general.tipo,"text","field third")}
        ${input("Comune","general.comune",c.general.comune,"text","field")}
        ${input("Provincia","general.provincia",c.general.provincia,"text","field")}
      </div>`)+
      card("Personale","Addetti familiari e salariati",`<div class="fields">
        ${input("Addetti familiari (numero)","personale.addettiFamiliari",c.personale.addettiFamiliari,"number","field third")}
        ${input("Ruolo/i svolto/i in azienda","personale.ruoliFamiliari",c.personale.ruoliFamiliari,"text","field third")}
        ${input("Livello di istruzione","personale.istruzioneFamiliari",c.personale.istruzioneFamiliari,"text","field third")}
        ${input("Frequenza corsi di formazione","personale.formazioneFamiliari",c.personale.formazioneFamiliari)}
        ${textarea("Argomenti formazione","personale.argomentiFamiliari",c.personale.argomentiFamiliari,"field")}
        ${input("Addetti salariati (numero)","personale.addettiSalariati",c.personale.addettiSalariati,"number","field third")}
        ${input("Ruolo/i svolto/i in azienda (salariati)","personale.ruoliSalariati",c.personale.ruoliSalariati,"text","field third")}
        ${input("Livello di istruzione (salariati)","personale.istruzioneSalariati",c.personale.istruzioneSalariati,"text","field third")}
        ${input("Frequenza corsi di formazione (salariati)","personale.formazioneSalariati",c.personale.formazioneSalariati)}
        ${textarea("Argomenti formazione (salariati)","personale.argomentiSalariati",c.personale.argomentiSalariati,"field")}
        ${input("Veterinario (nome e cognome)","personale.veterinario",c.personale.veterinario)}
        ${yesno("Presenza armadietto medicinali","personale.armadietto",c.personale.armadietto)}
        ${input("Alimentarista (nome e cognome)","personale.alimentarista",c.personale.alimentarista)}
      </div>`)+
      card("Strutture aziendali","Informazioni generali dell’azienda",`<div class="fields">
        ${input("Numero stalle","strutture.nStalle",c.strutture.nStalle,"number","field third")}
        ${yesno("Stalla di condizionamento","strutture.stallaCondizionamento",c.strutture.stallaCondizionamento,"field third")}
        ${yesno("Concimaia coperta","strutture.concimaiaCoperta",c.strutture.concimaiaCoperta,"field third")}
        ${yesno("Vasca coperta","strutture.vascaCoperta",c.strutture.vascaCoperta,"field third")}
        ${input("Materiale lettiera (se presente)","strutture.materialeLettiera",c.strutture.materialeLettiera,"text","field third")}
        ${input("Quantità materiale lettiera (q/anno)","strutture.qLettiera",c.strutture.qLettiera,"number","field third")}
        ${yesno("Conformità impianto elettrico","strutture.conformitaElettrico",c.strutture.conformitaElettrico)}
        ${input("Approvvigionamento idrico","strutture.approvvigionamentoIdrico",c.strutture.approvvigionamentoIdrico)}
        ${yesno("Analisi acqua","strutture.analisiAcqua",c.strutture.analisiAcqua)}
      </div>`)+
      `<div class="form-actions"><button class="btn btn-secondary" data-nav="home">Annulla</button><button class="btn btn-primary" data-action="company-next">Avanti → Management</button></div>`;
  }else{
    const m=c.management;
    main.innerHTML=header("Management","Seconda parte dei dati aziendali","Passaggio 2 di 2")+companyProgress(2)+
      card("Gestione e alimentazione","Carro miscelatore, pulizie e controlli",`<div class="fields">
        ${input("Carro miscelatore: modello e marca","management.carroModelloMarca",m.carroModelloMarca)}
        ${select("Carro miscelatore","management.carroSemoventeTrainato",m.carroSemoventeTrainato,["Semovente","Trainato"])}
        ${select("Orientamento carro","management.carroVerticaleOrizzontale",m.carroVerticaleOrizzontale,["Verticale","Orizzontale"])}
        ${input("Controllo mosche e roditori","management.controlloMoscheRoditori",m.controlloMoscheRoditori)}
        ${input("Frequenza asportazione deiezioni","management.freqAsportazioneDeiezioni",m.freqAsportazioneDeiezioni)}
        ${input("Frequenza pulizia mangiatoia (n/giorno)","management.freqPuliziaMangiatoia",m.freqPuliziaMangiatoia,"number")}
        ${yesno("Ispezione giornaliera animali","management.ispezioneGiornaliera",m.ispezioneGiornaliera)}
        ${input("Rimozione refluo vasca sottostante stalla","management.rimozioneRefluoVasca",m.rimozioneRefluoVasca)}
        ${yesno("Trinciapaglia","management.trinciapaglia",m.trinciapaglia)}
      </div>`)+
      card("Biogas","Dati energetici presenti nel modulo Management",`<div class="fields">
        ${yesno("Impianto biogas","management.biogas",m.biogas)}
        ${input("Produzione biogas (kW)","management.produzioneBiogasKW",m.produzioneBiogasKW,"number")}
        ${yesno("Uso di tutto il letame nel biogas","management.usoTuttoLetame",m.usoTuttoLetame)}
        ${yesno("Uso di tutto il liquame nel biogas","management.usoTuttoLiquame",m.usoTuttoLiquame)}
      </div>`)+
      card("Produzione e consumi energetici","Fotovoltaico, elettricità e gasolio",`<div class="fields">
        ${yesno("Fotovoltaico","management.fotovoltaico",m.fotovoltaico)}
        ${input("Produzione fotovoltaico (kW)","management.produzioneFotovoltaicoKW",m.produzioneFotovoltaicoKW,"number")}
        ${input("Consumi elettricità (kW/anno)","management.consumiElettricita",m.consumiElettricita,"number")}
        ${input("Consumi gasolio (L/anno)","management.consumiGasolio",m.consumiGasolio,"number")}
      </div>`)+
      `<div class="form-actions"><button class="btn btn-secondary" data-action="company-back">← Indietro</button><div class="actions-right"><button class="btn btn-primary" data-action="save-company">Salva azienda e continua →</button></div></div>`;
  }
}

function renderStable(){
  if(!activeCompany()){main.innerHTML=header("Nuova stalla","Seleziona o crea prima un’azienda")+`<div class="empty-state">Nessuna azienda disponibile.<br><br><button class="btn btn-primary" data-nav="company">Crea azienda</button></div>`;return}
  if(!state.stableDraft)state.stableDraft=newStableDraft();
  const s=state.stableDraft, a=activeCompany();
  main.innerHTML=header("Nuova stalla",`Azienda: ${esc(a.general.ragioneSociale)}`,"Modulo Stalle")+
    `<div class="context-bar"><div class="context-copy"><strong>Azienda</strong><span>Collegamento della stalla</span></div>${activeSelect()}</div>`+
    card("Identificazione stalla","Campi iniziali del record Stalle",`<div class="fields">
      ${input("Nome stalla","nome",s.nome,"text","field")}
      ${yesno("Ristallo","ristallo",s.ristallo,"field")}
    </div>`)+
    card("Struttura","Geometria, infermeria, tetto, acqua, luce e ventilazione",`<div class="fields">
      ${select("Stalla aperta / chiusa","struttura.apertaChiusa",s.struttura.apertaChiusa||"",["Aperta","Chiusa"])}
      ${input("Dimensioni: lunghezza × larghezza (m)","struttura.dimensioni",s.struttura.dimensioni||"")}
      ${input("Altezza stalla (m)","struttura.altezza",s.struttura.altezza||"","number","field third")}
      ${input("Orientamento","struttura.orientamento",s.struttura.orientamento||"","text","field third")}
      ${input("Corsia (m)","struttura.corsia",s.struttura.corsia||"","number","field third")}
      ${yesno("Infermeria","struttura.infermeria",s.struttura.infermeria||"")}
      ${input("Dimensionamento infermeria","struttura.dimensionamentoInfermeria",s.struttura.dimensionamentoInfermeria||"")}
      ${input("N. box infermeria","struttura.nBoxInfermeria",s.struttura.nBoxInfermeria||"","number")}
      ${input("Tipo stabulazione infermeria","struttura.tipoStabulazioneInfermeria",s.struttura.tipoStabulazioneInfermeria||"")}
      ${input("Falde tetto (n.)","struttura.faldeTetto",s.struttura.faldeTetto||"","number","field third")}
      ${input("Tipo copertura","struttura.tipoCopertura",s.struttura.tipoCopertura||"","text","field third")}
      ${yesno("Copertura con isolamento termico","struttura.isolamentoTermico",s.struttura.isolamentoTermico||"","field third")}
      ${input("Spessore isolante (cm)","struttura.spessoreIsolante",s.struttura.spessoreIsolante||"","number","field third")}
      ${yesno("Cupolino","struttura.cupolino",s.struttura.cupolino||"","field third")}
      ${yesno("Ombreggiamento","struttura.ombreggiamento",s.struttura.ombreggiamento||"","field third")}
      ${yesno("Paddock","struttura.paddock",s.struttura.paddock||"")}
      ${input("Fonte idrica","struttura.fonteIdrica",s.struttura.fonteIdrica||"")}
      ${yesno("Riscaldamento acqua","struttura.riscaldamentoAcqua",s.struttura.riscaldamentoAcqua||"")}
      ${input("Trattamenti acqua","struttura.trattamentiAcqua",s.struttura.trattamentiAcqua||"")}
      ${input("Luci (n.)","struttura.nLuci",s.struttura.nLuci||"","number")}
      ${input("Luci (tipo)","struttura.tipoLuci",s.struttura.tipoLuci||"")}
      ${yesno("Corrente d’aria fredda","struttura.correnteAriaFredda",s.struttura.correnteAriaFredda||"")}
      ${yesno("Ventilazione forzata","struttura.ventilazioneForzata",s.struttura.ventilazioneForzata||"")}
      ${input("Regolazione ventilazione","struttura.regolazioneVentilazione",s.struttura.regolazioneVentilazione||"")}
      ${select("Modalità controllo ventilazione","struttura.modalitaControllo",s.struttura.modalitaControllo||"",["T","THI"])}
      ${input("Numero ventilatori","struttura.nVentilatori",s.struttura.nVentilatori||"","number")}
      ${select("Tipo ventilatori","struttura.tipoVentilatori",s.struttura.tipoVentilatori||"",[{v:"O",l:"Orizzontali (O)"},{v:"D",l:"Destratificatori (D)"}])}
    </div>`)+
    card("Condizioni struttura","Valutazioni qualitative del sopralluogo",`<div class="fields">
      ${select("Livello pulizia stalla","condizioni.pulizia",s.condizioni.pulizia||"",["Buono","Intermedio","Scarso"])}
      ${select("Livello deterioramento stalla","condizioni.deterioramento",s.condizioni.deterioramento||"",["Buono","Intermedio","Scarso"])}
      ${select("Condizione generale attrezzature","condizioni.attrezzature",s.condizioni.attrezzature||"",["Buona","Intermedia","Scarsa"])}
      ${yesno("Ambiente polveroso","condizioni.polveroso",s.condizioni.polveroso||"")}
      ${yesno("Cattivi odori","condizioni.odori",s.condizioni.odori||"")}
    </div>`)+
    `<div class="form-actions"><button class="btn btn-secondary" data-nav="home">Annulla</button><div class="actions-right"><button class="btn btn-primary" data-action="save-stable">Salva stalla</button><button class="btn btn-soft" data-action="save-stable-box">Salva e inserisci box →</button></div></div>`;
}
function renderBox(){
  const c=activeCompany();
  if(!c){main.innerHTML=header("Gruppo di box","Seleziona o crea prima un’azienda")+`<div class="empty-state">Nessuna azienda disponibile.</div>`;return}
  if(!state.boxDraft)state.boxDraft=newBoxDraft();
  const b=state.boxDraft;
  main.innerHTML=header("Nuovo gruppo di box",`Azienda: ${esc(c.general.ragioneSociale)}`,"Modulo Gruppi box")+
    `<div class="context-bar"><div class="context-copy"><strong>Azienda e stalla</strong><span>Il gruppo viene collegato alla struttura scelta</span></div>${activeSelect()}${stableSelect(c,b.stableId)}</div>`+
    card("Identificazione","Riferimenti del gruppo di box",`<div class="fields">${input("ID / nome gruppo box","nome",b.nome,"text","field full")}</div>`)+
    card("Caratteristiche box","Dati dimensionali, animali e dotazioni",`<div class="fields">
      ${input("Box (n.)","caratteristiche.nBox",b.caratteristiche.nBox||"","number","field third")}
      ${input("Dimensioni box (m)","caratteristiche.dimensioni",b.caratteristiche.dimensioni||"","text","field third")}
      ${input("Capi per box (n.)","caratteristiche.capiPerBox",b.caratteristiche.capiPerBox||"","number","field third")}
      ${input("Tipo genetico","caratteristiche.tipoGenetico",b.caratteristiche.tipoGenetico||"")}
      ${select("Sesso","caratteristiche.sesso",b.caratteristiche.sesso||"",["Maschi","Femmine","Misto"])}
      ${input("Box con accesso paddock (n.)","caratteristiche.boxPaddock",b.caratteristiche.boxPaddock||"","number")}
      ${input("Paddock lunghezza × larghezza (m)","caratteristiche.dimPaddock",b.caratteristiche.dimPaddock||"")}
      ${input("% copertura paddock","caratteristiche.coperturaPaddock",b.caratteristiche.coperturaPaddock||"","number")}
      ${yesno("Corridoio movimentazione","caratteristiche.corridoio",b.caratteristiche.corridoio||"")}
      ${input("Pavimento","caratteristiche.pavimento",b.caratteristiche.pavimento||"")}
      ${input("Materiale lettiera","caratteristiche.lettiera",b.caratteristiche.lettiera||"")}
      ${input("Mangiatoia","caratteristiche.mangiatoia",b.caratteristiche.mangiatoia||"")}
      ${yesno("Irraggiamento diretto animali","caratteristiche.irraggiamento",b.caratteristiche.irraggiamento||"")}
      ${yesno("Vie di fuga","caratteristiche.vieFuga",b.caratteristiche.vieFuga||"")}
      ${yesno("Autocatture","caratteristiche.autocatture",b.caratteristiche.autocatture||"")}
      ${input("Abbeveratoi per box (n.)","caratteristiche.nAbbeveratoi",b.caratteristiche.nAbbeveratoi||"","number")}
      ${input("Tipo di abbeveratoi","caratteristiche.tipoAbbeveratoi",b.caratteristiche.tipoAbbeveratoi||"")}
    </div>`)+
    card("Condizioni box","Valutazione dello stato al momento del rilievo",`<div class="fields">
      ${select("Livello pulizia box","condizioni.puliziaBox",b.condizioni.puliziaBox||"",["Buono","Intermedio","Scarso"])}
      ${select("Livello scivolosità pavimento","condizioni.scivolosita",b.condizioni.scivolosita||"",["Basso","Intermedio","Elevato"])}
      ${select("Livello pulizia mangiatoia","condizioni.puliziaMangiatoia",b.condizioni.puliziaMangiatoia||"",["Buono","Intermedio","Scarso"])}
      ${select("Livello pulizia abbeveratoio","condizioni.puliziaAbbeveratoio",b.condizioni.puliziaAbbeveratoio||"",["Buono","Intermedio","Scarso"])}
      ${select("Livello pulizia animali","condizioni.puliziaAnimali",b.condizioni.puliziaAnimali||"",["Buono","Intermedio","Scarso"])}
      ${select("Stato deterioramento cancellate","condizioni.cancellate",b.condizioni.cancellate||"",["Buono","Intermedio","Scarso"])}
    </div>`)+
    `<div class="form-actions"><button class="btn btn-secondary" data-nav="home">Annulla</button><button class="btn btn-primary" data-action="save-box">Salva gruppo box</button></div>`;
}
function stableSelect(c,val){
  return `<select id="stableSelect"><option value="">Seleziona stalla…</option>${(c.stables||[]).map(s=>`<option value="${s.id}" ${s.id===val?"selected":""}>${esc(s.nome||"Stalla senza nome")}</option>`).join("")}</select>`;
}

function renderRation(){
  const c=activeCompany();
  if(!c){main.innerHTML=header("Razione animali","Seleziona o crea prima un’azienda")+`<div class="empty-state">Nessuna azienda disponibile.</div>`;return}
  if(!state.rationDraft)state.rationDraft=newRationDraft();
  const r=state.rationDraft;
  main.innerHTML=header("Razione animali",`Azienda: ${esc(c.general.ragioneSociale)}`,"Modulo Razioni animali")+
    `<div class="context-bar"><div class="context-copy"><strong>Azienda</strong><span>Intestazione della razione</span></div>${activeSelect()}</div>`+
    card("Intestazione razione","Dati identificativi della razione",`<div class="fields">
      ${input("Data rilievo","dataRilievo",r.dataRilievo,"date","field quarter")}
      ${input("Nome / tipo razione","titolo",r.titolo,"text","field quarter")}
      ${input("Tipo genetico e sesso","tipoGeneticoSesso",r.tipoGeneticoSesso,"text","field")}
    </div>`)+
    card("Ingredienti","Sono disponibili 8 righe iniziali; puoi aggiungerne altre.",`<div class="rows" id="rationRows">${r.rows.map((x,i)=>rationRow(x,i)).join("")}</div><button class="btn btn-soft" data-action="add-ration-row" style="margin-top:11px">＋ Aggiungi ingrediente</button>`)+
    card("Cartellini","Foto dei cartellini di mangimi e integratori",`<div class="photo-grid">
      ${photoBox("Cartellino mangime","cartellinoMangime",r.cartellinoMangime)}
      ${photoBox("Cartellino integratore","cartellinoIntegratore",r.cartellinoIntegratore)}
    </div>`)+
    `<div class="form-actions"><button class="btn btn-secondary" data-nav="home">Annulla</button><button class="btn btn-primary" data-action="save-ration">Salva razione</button></div>`;
}
function rationRow(x,i){
  return `<div class="data-row"><div class="data-row-head"><strong>Ingrediente ${i+1}</strong>${i>=1?`<button class="remove-row" data-action="remove-ration-row" data-index="${i}">Rimuovi</button>`:""}</div><div class="fields">
    ${input("Materia prima",`rows.${i}.materiaPrima`,x.materiaPrima,"text","field third")}
    ${input("kg / capo / giorno",`rows.${i}.kgCapoGiorno`,x.kgCapoGiorno,"number","field third")}
    ${input("Approvvigionamento",`rows.${i}.approvvigionamento`,x.approvvigionamento,"text","field third")}
    ${input("Origine",`rows.${i}.origine`,x.origine,"text","field full")}
  </div></div>`;
}
function photoBox(title,key,value){
  return `<div class="photo-box"><strong>${title}</strong><input type="file" accept="image/*" capture="environment" data-photo="${key}">
    <div class="hint">Le immagini vengono ridimensionate prima del salvataggio locale.</div>
    <div class="photo-preview">${value?`<img src="${value}" alt="${title}">`:"Nessuna immagine acquisita"}</div>
    ${value?`<button class="btn btn-secondary" data-action="remove-photo" data-key="${key}" style="margin-top:9px">Rimuovi immagine</button>`:""}
  </div>`;
}

function renderCrops(){
  const c=activeCompany();
  if(!c){main.innerHTML=header("Piano colturale","Seleziona o crea prima un’azienda")+`<div class="empty-state">Nessuna azienda disponibile.</div>`;return}
  if(!state.cropsDraft)state.cropsDraft=newCropsDraft();
  const x=state.cropsDraft;
  main.innerHTML=header("Piano colturale",`Azienda: ${esc(c.general.ragioneSociale)}`,"Modulo Colture aziendali")+
    `<div class="context-bar"><div class="context-copy"><strong>Azienda</strong><span>Intestazione del piano colturale</span></div>${activeSelect()}</div>`+
    card("Anno campagna","Dato comune alle colture inserite",`<div class="fields">${input("Anno campagna","anno",x.anno,"number","field third")}</div>`)+
    card("Colture","Sono disponibili 4 righe iniziali; puoi aggiungerne altre.",`<div class="rows">${x.rows.map((r,i)=>cropRow(r,i)).join("")}</div><button class="btn btn-soft" data-action="add-crop-row" style="margin-top:11px">＋ Aggiungi coltura</button>`)+
    `<div class="form-actions"><button class="btn btn-secondary" data-nav="home">Annulla</button><button class="btn btn-primary" data-action="save-crops">Salva colture</button></div>`;
}
function cropRow(r,i){
  return `<div class="data-row"><div class="data-row-head"><strong>Coltura ${i+1}</strong>${i>=1?`<button class="remove-row" data-action="remove-crop-row" data-index="${i}">Rimuovi</button>`:""}</div><div class="fields">
    ${input("Coltura",`rows.${i}.coltura`,r.coltura,"text","field third")}
    ${input("Superficie (ha)",`rows.${i}.superficie`,r.superficie,"number","field third")}
    ${input("Prodotto ottenuto",`rows.${i}.prodotto`,r.prodotto,"text","field third")}
    ${input("Irrigazione",`rows.${i}.irrigazione`,r.irrigazione,"text","field third")}
    ${input("Irrigazione (m³/ha)",`rows.${i}.irrigazioneM3Ha`,r.irrigazioneM3Ha,"number","field third")}
    ${input("Resa",`rows.${i}.resa`,r.resa,"text","field third")}
    ${yesno("Coltura azotofissatrice",`rows.${i}.azotofissatrice`,r.azotofissatrice,"field third")}
    ${input("N fissato biologicamente (kg N/ha, se stimato)",`rows.${i}.nFissazioneKgHa`,r.nFissazioneKgHa,"number","field third","Per bilancio N; non è una sorgente diretta di N₂O IPCC.")}
    ${textarea("Note",`rows.${i}.note`,r.note,"field full")}
  </div></div>`;
}
function renderBiogas(){
  const c=activeCompany();
  if(!c){main.innerHTML=header("Razione biogas","Seleziona o crea prima un’azienda")+`<div class="empty-state">Nessuna azienda disponibile.</div>`;return}
  if(!state.biogasDraft)state.biogasDraft=newBiogasDraft();
  const x=state.biogasDraft;
  main.innerHTML=header("Razione biogas",`Azienda: ${esc(c.general.ragioneSociale)}`,"Modulo Razioni Biogas")+
    `<div class="context-bar"><div class="context-copy"><strong>Azienda</strong><span>Intestazione della razione biogas</span></div>${activeSelect()}</div>`+
    card("Data rilievo","Dato comune alle materie prime inserite",`<div class="fields">${input("Data rilievo","dataRilievo",x.dataRilievo,"date","field third")}</div>`)+
    card("Materie prime","Sono disponibili 4 righe iniziali; puoi aggiungerne altre.",`<div class="rows">${x.rows.map((r,i)=>biogasRow(r,i)).join("")}</div><button class="btn btn-soft" data-action="add-biogas-row" style="margin-top:11px">＋ Aggiungi materia prima</button>`)+
    `<div class="form-actions"><button class="btn btn-secondary" data-nav="home">Annulla</button><button class="btn btn-primary" data-action="save-biogas">Salva razione biogas</button></div>`;
}
function biogasRow(r,i){
  return `<div class="data-row"><div class="data-row-head"><strong>Materia prima ${i+1}</strong>${i>=1?`<button class="remove-row" data-action="remove-biogas-row" data-index="${i}">Rimuovi</button>`:""}</div><div class="fields">
    ${input("Materia prima",`rows.${i}.materiaPrima`,r.materiaPrima,"text","field third")}
    ${input("kg al giorno",`rows.${i}.kgGiorno`,r.kgGiorno,"number","field third")}
    ${yesno("Autoprodotto",`rows.${i}.autoprodotto`,r.autoprodotto,"field third")}
    ${input("Origine (se non autoprodotto)",`rows.${i}.origine`,r.origine,"text","field full")}
  </div></div>`;
}


function parseNumeric(v){
  if(v===null||v===undefined||String(v).trim()==="")return null;
  const n=Number(String(v).replace(",","."));
  return Number.isFinite(n)?n:null;
}
function isoDateUtc(value){
  const m=String(value||"").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!m)return null;
  return Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3]));
}
function calcBatch(b){
  const a=isoDateUtc(b.dataIngresso), z=isoDateUtc(b.dataUscita);
  const days=(a!==null&&z!==null&&z>a)?Math.floor((z-a)/86400000):null;
  const wi=parseNumeric(b.pesoIngresso), wo=parseNumeric(b.pesoUscita);
  const gain=(wi!==null&&wo!==null)?wo-wi:null;
  const adg=(days&&wi!==null&&wo!==null&&wi>0&&wo>0)?gain/days:null;
  return {days,gain,adg};
}
function renderBatch(){
  const c=activeCompany();if(!c){main.innerHTML=header("Partite animali","Seleziona o crea prima un’azienda")+`<div class="empty-state">Nessuna azienda disponibile.</div>`;return}
  if(!state.batchDraft)state.batchDraft=newBatchDraft();const b=state.batchDraft,calc=calcBatch(b);
  main.innerHTML=header("Partite animali",`Azienda: ${esc(c.general.ragioneSociale)}`,"Dati normalizzati")+
    `<div class="context-bar"><div class="context-copy"><strong>Azienda</strong><span>Ogni partita può essere collegata alla scheda originale</span></div>${activeSelect()}</div>`+
    card("Identificazione e consistenza","Solo i dati necessari per rendere confrontabili formati aziendali diversi",`<div class="fields">
      ${input("Codice / identificativo partita","codice",b.codice,"text","field third")}
      ${input("Data ingresso","dataIngresso",b.dataIngresso,"date","field third")}
      ${input("Data uscita","dataUscita",b.dataUscita,"date","field third")}
      ${input("Capi entrati","capiEntrati",b.capiEntrati,"number","field third")}
      ${input("Capi usciti","capiUsciti",b.capiUsciti,"number","field third")}
      ${input("Capi morti","capiMorti",b.capiMorti,"number","field third")}
      ${select("Sesso","sesso",b.sesso,["Maschi","Femmine","Misto"],"field third")}
      ${input("Tipo genetico / razza","tipoGenetico",b.tipoGenetico,"text","field third")}
      ${select("Razione associata (se disponibile)","razioneId",b.razioneId,rationOptions(),"field third","Nessuna razione")}
      ${input("Peso medio ingresso (kg)","pesoIngresso",b.pesoIngresso,"number","field third")}
      ${input("Peso medio uscita (kg)","pesoUscita",b.pesoUscita,"number","field third")}
      ${textarea("Note","note",b.note)}
    </div>`)+
    `<div class="derived-grid"><div><span>Permanenza</span><strong>${calc.days??"—"} ${calc.days?"giorni":""}</strong></div><div><span>ADG calcolato</span><strong>${calc.adg!=null?calc.adg.toFixed(3)+" kg/capo/giorno":"—"}</strong></div></div><div class="hint" style="margin:-2px 0 14px">ADG = (peso medio uscita − peso medio ingresso) / giorni trascorsi tra data di ingresso e data di uscita.</div>`+
    card("Provenienza del dato","Il documento originale rimane come evidenza; il modello usa i campi normalizzati.",sourceFields("source",b.source))+
    savedRecords("Partite già inserite",c.batches||[],x=>`${x.codice||"Partita"} · ${x.capiEntrati||"?"} capi · ${x.dataIngresso||"?"} → ${x.dataUscita||"?"}`)+
    `<div class="form-actions"><button class="btn btn-secondary" data-nav="home">Annulla</button><button class="btn btn-primary" data-action="save-batch">Salva partita</button></div>`;
}
function renderManure(){
  const c=activeCompany();if(!c){main.innerHTML=header("Reflui e stoccaggi","Seleziona o crea prima un’azienda")+`<div class="empty-state">Nessuna azienda disponibile.</div>`;return}
  if(!state.manureDraft)state.manureDraft=newManureDraft();const m=state.manureDraft;
  main.innerHTML=header("Reflui e stoccaggi",`Azienda: ${esc(c.general.ragioneSociale)}`,"Dati per bilancio N e C")+
    `<div class="context-bar"><div class="context-copy"><strong>Azienda</strong><span>Una riga per ciascun percorso significativo del refluo</span></div>${activeSelect()}</div>`+
    card("Percorso del refluo","Stabulazione → rimozione → stoccaggio",`<div class="fields">
      ${input("Anno di riferimento","anno",m.anno,"number","field third")}
      ${select("Stalla / struttura","stallaId",m.stallaId,stableOptions(),"field third","Non specificata")}
      ${select("Tipo di refluo","tipoRefluo",m.tipoRefluo,["Liquame","Letame","Digestato","Separato solido","Separato liquido","Altro"],"field third")}
      ${input("Quota del refluo su questo percorso (%)","quotaPercentuale",m.quotaPercentuale,"number","field third")}
      ${input("Sistema di stabulazione / pavimento","sistemaStabulazione",m.sistemaStabulazione,"text","field third")}
      ${input("Frequenza / modalità rimozione","rimozione",m.rimozione,"text","field third")}
      ${input("Sistema di stoccaggio","sistemaStoccaggio",m.sistemaStoccaggio,"text","field third")}
      ${select("Copertura stoccaggio","copertura",m.copertura,["Nessuna","Copertura rigida","Copertura flessibile","Crosta naturale","Altro"],"field third")}
      ${input("Durata media stoccaggio (giorni)","durataGiorni",m.durataGiorni,"number","field third")}
      ${yesno("Passaggio in biogas","biogas",m.biogas,"field third")}
      ${yesno("Separazione solido/liquido","separazione",m.separazione,"field third")}
    </div>`)+
    card("Quantità e analisi","Se sono disponibili PUA o analisi, registrare i valori reali; altrimenti il motore potrà stimare da animali e razioni.",`<div class="fields">
      ${input("Quantità annua","quantitaAnnua",m.quantitaAnnua,"number","field third")}
      ${select("Unità quantità","unita",m.unita,["m3/anno","t/anno","kg/anno"],"field third")}
      ${input("N totale (kg N/t o kg N/m³)","nTotale",m.nTotale,"number","field third")}
      ${input("TAN (% dell'N totale)","tanPercentN",m.tanPercentN,"number","field third")}
      ${input("Sostanza secca (%)","sostanzaSecca",m.sostanzaSecca,"number","field third")}
      ${input("Solidi volatili - VS (se disponibili)","vs",m.vs,"number","field third")}
      ${textarea("Note","note",m.note)}
    </div>`)+
    card("Provenienza del dato","PUA e analisi aziendali hanno priorità sui valori dichiarati.",sourceFields("source",m.source))+
    savedRecords("Percorsi reflui già inseriti",c.manureSystems||[],x=>`${x.anno||""} · ${x.tipoRefluo||"Refluo"} · ${x.sistemaStoccaggio||"stoccaggio non indicato"}`)+
    `<div class="form-actions"><button class="btn btn-secondary" data-nav="home">Annulla</button><button class="btn btn-primary" data-action="save-manure">Salva percorso refluo</button></div>`;
}
function renderSpreading(){
  const c=activeCompany();if(!c){main.innerHTML=header("Spandimenti / concimazioni","Seleziona o crea prima un’azienda")+`<div class="empty-state">Nessuna azienda disponibile.</div>`;return}
  if(!state.spreadingDraft)state.spreadingDraft=newSpreadingDraft();const s=state.spreadingDraft;
  main.innerHTML=header("Spandimenti e concimazioni",`Azienda: ${esc(c.general.ragioneSociale)}`,"Registro normalizzato")+
    `<div class="context-bar"><div class="context-copy"><strong>Azienda</strong><span>Derivazione preferenziale dal registro delle concimazioni</span></div>${activeSelect()}</div>`+
    card("Evento di applicazione","Una riga per applicazione omogenea per coltura, materiale e tecnica",`<div class="fields">
      ${input("Data","data",s.data,"date","field third")}
      ${input("Anno campagna","anno",s.anno,"number","field third")}
      ${input("Coltura","coltura",s.coltura,"text","field third")}
      ${input("Superficie interessata (ha)","superficieHa",s.superficieHa,"number","field third")}
      ${select("Tipo input","tipoInput",s.tipoInput,["Liquame","Letame","Digestato","Concime minerale","Ammendante organico","Altro"],"field third")}
      ${input("Prodotto / materiale","prodotto",s.prodotto,"text","field third")}
      ${input("Quantità applicata","quantita",s.quantita,"number","field third")}
      ${select("Unità","unita",s.unita,["t","m3","kg","t/ha","m3/ha","kg/ha"],"field third")}
      ${input("N totale (kg N per unità)","nTotale",s.nTotale,"number","field third")}
      ${input("TAN (kg N per unità, se noto)","tan",s.tan,"number","field third")}
      ${input("P2O5 (kg per unità, se noto)","p2o5",s.p2o5,"number","field third")}
      ${input("P totale (kg P per unità, se noto)","pTotale",s.pTotale,"number","field third")}
      ${input("Tecnica di distribuzione","tecnica",s.tecnica,"text","field third")}
      ${input("Interramento dopo distribuzione (ore)","incorporazioneOre",s.incorporazioneOre,"number","field third")}
      ${textarea("Note","note",s.note)}
    </div>`)+
    card("Provenienza del dato","Per quantità e composizione utilizzare quando possibile registro concimazioni, PUA e analisi.",sourceFields("source",s.source))+
    savedRecords("Applicazioni già inserite",c.spreadingEvents||[],x=>`${x.data||x.anno||""} · ${x.coltura||"Coltura"} · ${x.prodotto||x.tipoInput||"input"}`)+
    `<div class="form-actions"><button class="btn btn-secondary" data-nav="home">Annulla</button><button class="btn btn-primary" data-action="save-spreading">Salva applicazione</button></div>`;
}
function renderAgro(){
  const c=activeCompany();if(!c){main.innerHTML=header("Trattamenti e irrigazione","Seleziona o crea prima un’azienda")+`<div class="empty-state">Nessuna azienda disponibile.</div>`;return}
  if(!state.agroDraft)state.agroDraft=newAgroDraft();const a=state.agroDraft,t=a.treatment,i=a.irrigation;
  const treatment=a.mode==="trattamento";
  main.innerHTML=header("Trattamenti e irrigazione",`Azienda: ${esc(c.general.ragioneSociale)}`,"Input colturali")+
    `<div class="context-bar"><div class="context-copy"><strong>Tipo di registrazione</strong><span>Scegli il blocco da compilare</span></div><div class="segment"><label><input type="radio" name="agromode" data-agromode="trattamento" ${treatment?"checked":""}><span>Trattamento</span></label><label><input type="radio" name="agromode" data-agromode="irrigazione" ${!treatment?"checked":""}><span>Irrigazione</span></label></div></div>`+
    (treatment?
      card("Trattamento colturale","Registrare il dato dal registro trattamenti quando disponibile",`<div class="fields">
        ${input("Data","treatment.data",t.data,"date","field third")}${input("Coltura","treatment.coltura",t.coltura,"text","field third")}${input("Superficie (ha)","treatment.superficieHa",t.superficieHa,"number","field third")}
        ${select("Categoria","treatment.categoria",t.categoria,["Erbicida","Fungicida","Insetticida","Acaricida","Regolatore di crescita","Altro"],"field third")}${input("Prodotto commerciale","treatment.prodotto",t.prodotto,"text","field third")}${input("Principio attivo","treatment.principioAttivo",t.principioAttivo,"text","field third")}
        ${input("Dose","treatment.dose",t.dose,"number","field third")}${select("Unità dose","treatment.unitaDose",t.unitaDose,["L/ha","kg/ha","g/ha","mL/ha"],"field third")}${input("Quantità totale usata","treatment.quantitaTotale",t.quantitaTotale,"number","field third")}${textarea("Note","treatment.note",t.note)}
      </div>`)+card("Provenienza del dato","Registro trattamenti preferenziale",sourceFields("treatment.source",t.source))
      :card("Irrigazione","Registrare volume totale e metodo di misura/stima",`<div class="fields">
        ${input("Anno","irrigation.anno",i.anno,"number","field third")}${input("Coltura","irrigation.coltura",i.coltura,"text","field third")}${input("Superficie irrigata (ha)","irrigation.superficieHa",i.superficieHa,"number","field third")}
        ${input("Volume totale (m³)","irrigation.volumeM3",i.volumeM3,"number","field third")}${input("Volume (m³/ha)","irrigation.m3Ha",i.m3Ha,"number","field third")}${input("Fonte acqua","irrigation.fonteAcqua",i.fonteAcqua,"text","field third")}
        ${input("Sistema irriguo","irrigation.sistema",i.sistema,"text","field third")}${select("Metodo di determinazione volume","irrigation.metodoStima",i.metodoStima,["Contatore","Dato consorzio / bolletta","Ore pompa × portata","Registro aziendale","Dichiarato","Stimato"],"field third")}
        ${input("Elettricità pompaggio (kWh, se nota)","irrigation.elettricitaKWh",i.elettricitaKWh,"number","field third")}${input("Gasolio pompaggio (L, se noto)","irrigation.gasolioL",i.gasolioL,"number","field third")}${textarea("Note","irrigation.note",i.note)}
      </div>`)+card("Provenienza del dato","Contatore o documentazione hanno priorità",sourceFields("irrigation.source",i.source)))+
    savedRecords("Trattamenti registrati",c.cropTreatments||[],x=>`${x.data||""} · ${x.coltura||""} · ${x.prodotto||x.categoria||"trattamento"}`)+
    savedRecords("Irrigazioni registrate",c.irrigationRecords||[],x=>`${x.anno||""} · ${x.coltura||""} · ${x.volumeM3||"?"} m³`)+
    `<div class="form-actions"><button class="btn btn-secondary" data-nav="home">Annulla</button><button class="btn btn-primary" data-action="save-agro">Salva ${treatment?"trattamento":"irrigazione"}</button></div>`;
}
function savedRecords(title,rows,labelFn){
  if(!rows?.length)return "";
  return `<section class="form-card"><div class="form-card-head"><div><h3>${title}</h3></div></div><div class="form-card-body"><div class="record-list">${rows.slice(-8).reverse().map(x=>`<div class="record-line"><span>${esc(labelFn(x))}</span><span class="badge">salvato</span></div>`).join("")}</div></div></section>`;
}
async function renderDocuments(){
  const c=activeCompany();if(!c){main.innerHTML=header("Documenti aziendali","Seleziona o crea prima un’azienda")+`<div class="empty-state">Nessuna azienda disponibile.</div>`;return}
  if(!state.documentDraft)state.documentDraft=newDocumentDraft();const d=state.documentDraft;
  main.innerHTML=header("Documenti aziendali",`Azienda: ${esc(c.general.ragioneSociale)}`)+
    card("Aggiungi documento","",`<div class="fields">
      ${select("Tipo documento","tipo",d.tipo,["PUA","Fascicolo aziendale","Piano Utilizzo / Fascicolo AVEPA","Registro concimazioni","Registro trattamenti","Registro irriguo / dati consorzio","Scheda partita","Modello 4","Analisi reflui","Analisi alimenti","Bollette energia/acqua","Altro"],"field third")}
      ${input("Anno / campagna","anno",d.anno,"number","field third")}
      ${input("Descrizione","descrizione",d.descrizione,"text","field third")}
      ${textarea("Note","note",d.note)}
      <div class="field full"><label class="label">File</label><input id="documentFile" type="file" accept=".xlsx,.csv,.tsv,.txt,.pdf,.xls,.jpg,.jpeg,.png,.webp,.heic,.heif,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/plain,image/*"></div>
    </div>`)+
    extractionPanel()+
    documentsList(c.documents||[])+
    `<div class="form-actions"><button class="btn btn-secondary" data-nav="home">Indietro</button><div class="actions-right"><button class="btn btn-secondary" data-action="save-document">Salva documento</button><button class="btn btn-primary" data-action="save-analyze-document">Salva e ricava dati</button></div></div>`;
}
function documentsList(rows){
  return card("Documenti già associati","",rows.length?`<div class="document-list">${rows.slice().reverse().map(d=>`<div class="document-item"><div><strong>${esc(d.tipo)}</strong><span>${esc(d.anno||"")} · ${esc(d.filename||d.descrizione||"")}${d.importedCount?` · ${d.importedCount} record ricavati`:""}${d.importedTargets?.length?` · ${d.importedTargets.map(t=>extractionTargets().find(x=>x.v===t)?.l||t).join(", ")}`:""}</span></div><div class="actions-right"><button class="btn btn-secondary" data-action="extract-document" data-id="${d.id}">Ricava dati</button><button class="btn btn-secondary" data-action="download-document" data-id="${d.id}">Apri / scarica</button><button class="btn btn-danger" data-action="delete-document" data-id="${d.id}">Elimina</button></div></div>`).join("")}</div>`:`<div class="empty-state">Nessun documento allegato per questa azienda.</div>`);
}


function extractionTargets(){return [
  {v:"azienda",l:"Anagrafica / fascicolo aziendale"},
  {v:"colture",l:"Piano colturale / superfici"},
  {v:"consistenza",l:"Consistenza zootecnica"},
  {v:"bilancio_n",l:"Bilancio azoto / dati PUA"},
  {v:"reflui",l:"Reflui / stoccaggi"},
  {v:"concimazioni",l:"Concimazioni / spandimenti"},
  {v:"trattamenti",l:"Trattamenti colturali"},
  {v:"irrigazione",l:"Irrigazione"},
  {v:"energia",l:"Energia, combustibili e acqua"},
  {v:"analisi_reflui",l:"Analisi reflui"},
  {v:"analisi_alimenti",l:"Analisi alimenti"},
  {v:"partite",l:"Partite animali"}
];}
function defaultExtractionTarget(tipo){
  if(tipo==="Scheda partita"||tipo==="Modello 4")return "partite";
  if(tipo==="Registro trattamenti")return "trattamenti";
  if(tipo==="Registro irriguo / dati consorzio")return "irrigazione";
  if(tipo==="Analisi reflui")return "analisi_reflui";
  if(tipo==="Analisi alimenti")return "analisi_alimenti";
  if(tipo==="Bollette energia/acqua")return "energia";
  if(tipo==="Fascicolo aziendale"||tipo==="Piano Utilizzo / Fascicolo AVEPA")return "azienda";
  if(tipo==="PUA")return "consistenza";
  return "concimazioni";
}
function extractionDefs(target){
  const defs={
    azienda:[
      ["ragioneSociale","Ragione sociale","text",["ragione sociale","azienda","denominazione","intestatario"]],
      ["cuaa","CUAA / codice fiscale","text",["cuaa","codice fiscale","cf azienda"]],
      ["comune","Comune","text",["comune","comune sede","sede azienda"]],
      ["provincia","Provincia","text",["provincia","prov","sigla provincia"]],
      ["sauHa","SAU (ha)","number",["sau","superficie agricola utilizzata","sau ha"]],
      ["satHa","SAT (ha)","number",["sat","superficie agricola totale","sat ha"]],
      ["superficieIrrigataHa","Superficie irrigata (ha)","number",["superficie irrigata","ettari irrigati","ha irrigati"]],
      ["consistenzaCapi","Consistenza bovini (capi)","number",["consistenza bovini","bovini presenti","numero bovini","capi bovini","consistenza zootecnica"]]
    ],
    consistenza:[
      ["anno","Anno","number",["anno","campagna"]],
      ["categoria","Categoria animale","text",["categoria animale","categoria","bovini da carne","vitelloni","vitelli"]],
      ["sistemaStabulazione","Sistema di stabulazione","text",["stabulazione","sistema stabulazione","lettiera","pavimento fessurato","pascolo"]],
      ["capi","Capi","number",["n capi","numero capi","capi"]],
      ["nProdottoKg","N prodotto (kg)","number",["azoto prodotto","n prodotto","kg n prodotto"]],
      ["liquameM3","Liquame (m³)","number",["liquame","liquame m3"]],
      ["letameT","Letame / materiale palabile (t)","number",["letame t","materiale palabile t","tonnellate letame"]],
      ["letameM3","Letame / materiale palabile (m³)","number",["letame m3","materiale palabile m3","mc letame"]],
      ["fosforoKg","Fosforo (kg)","number",["fosforo","p kg"]],
      ["note","Note","text",["note","annotazioni"]]
    ],
    bilancio_n:[
      ["anno","Anno","number",["anno","campagna"]],
      ["nProdottoKg","N prodotto in azienda (kg N)","number",["azoto prodotto in azienda","n prodotto azienda","kg n prodotto"]],
      ["acquaAbbeveraggioM3","Acqua abbeveraggio (m³/anno)","number",["acqua abbeveraggio","mc anno","m3 anno acqua"]],
      ["note","Note","text",["note","annotazioni"]]
    ],
    colture:[
      ["anno","Anno / campagna","number",["anno","campagna","anno campagna"]],
      ["coltura","Coltura","text",["coltura","specie","uso suolo","macrouso","occupazione suolo"]],
      ["superficie","Superficie (ha)","number",["superficie","ettari","ha","superficie ha","sau coltura"]],
      ["prodotto","Prodotto ottenuto","text",["prodotto","destinazione","prodotto ottenuto"]],
      ["resa","Resa","number",["resa","produzione ha","q ha","t ha"]],
      ["irrigazione","Irrigazione","text",["irrigazione","irriguo","irrigata"]],
      ["irrigazioneM3Ha","Irrigazione (m³/ha)","number",["m3 ha","m3/ha","volume irriguo ha"]],
      ["azotofissatrice","Azotofissatrice","text",["azotofissatrice","leguminosa","fissazione azoto"]],
      ["nFissazioneKgHa","N fissato (kg N/ha)","number",["n fissato","kg n ha fissato","fissazione kg n ha"]],
      ["note","Note","text",["note","annotazioni"]]
    ],
    concimazioni:[
      ["data","Data","date",["data","data intervento","data distribuzione","data concimazione"]],
      ["anno","Anno","number",["anno","campagna","anno campagna"]],
      ["coltura","Coltura","text",["coltura","specie","coltura interessata"]],
      ["superficieHa","Superficie (ha)","number",["superficie","ettari","ha","superficie ha"]],
      ["tipoInput","Tipo input","text",["tipo input","tipologia","tipo concime","categoria","matrice"]],
      ["prodotto","Prodotto / materiale","text",["prodotto","concime","fertilizzante","materiale","effluente","nome prodotto"]],
      ["quantita","Quantità","number",["quantita","quantità","dose","qta","quantitativo"]],
      ["unita","Unità","text",["unita","unità","udm","u.m.","unita misura"]],
      ["nTotale","N totale","number",["n totale","azoto totale","kg n","n kg","titolo n"]],
      ["tan","TAN","number",["tan","azoto ammoniacale","n ammoniacale","nh4 n"]],
      ["p2o5","P2O5","number",["p2o5","fosforo p2o5","anidride fosforica"]],
      ["pTotale","P totale","number",["p totale","fosforo totale","kg p"]],
      ["tecnica","Tecnica di distribuzione","text",["tecnica","modalita distribuzione","modalità distribuzione","spandimento","distribuzione"]],
      ["incorporazioneOre","Interramento (ore)","number",["interramento","ore interramento","incorporazione","tempo interramento"]],
      ["note","Note","text",["note","annotazioni","osservazioni"]]
    ],
    partite:[
      ["codice","Codice partita","text",["partita","codice partita","id partita","lotto"]],
      ["dataIngresso","Data ingresso","date",["data ingresso","ingresso","data arrivo","arrivo"]],
      ["dataUscita","Data uscita","date",["data uscita","uscita","data partenza","vendita","macellazione"]],
      ["capiEntrati","Capi entrati","number",["capi entrati","n capi ingresso","numero capi","capi ingresso","entrati"]],
      ["capiUsciti","Capi usciti","number",["capi usciti","n capi uscita","usciti"]],
      ["capiMorti","Capi morti","number",["morti","mortalita","mortalità","capi morti"]],
      ["sesso","Sesso","text",["sesso","sex"]],
      ["tipoGenetico","Tipo genetico / razza","text",["razza","tipo genetico","genetica"]],
      ["pesoIngresso","Peso medio ingresso (kg)","number",["peso ingresso","peso medio ingresso","peso arrivo","kg ingresso"]],
      ["pesoUscita","Peso medio uscita (kg)","number",["peso uscita","peso medio uscita","peso vendita","kg uscita"]],
      ["note","Note","text",["note","annotazioni"]]
    ],
    trattamenti:[
      ["data","Data","date",["data","data trattamento"]],
      ["coltura","Coltura","text",["coltura","specie"]],
      ["superficieHa","Superficie (ha)","number",["superficie","ha","ettari"]],
      ["categoria","Categoria","text",["categoria","tipologia","tipo trattamento"]],
      ["prodotto","Prodotto commerciale","text",["prodotto","prodotto commerciale","fitofarmaco","nome prodotto"]],
      ["principioAttivo","Principio attivo","text",["principio attivo","sostanza attiva","p.a."]],
      ["dose","Dose","number",["dose","dose ha","quantita ha","quantità ha"]],
      ["unitaDose","Unità dose","text",["unita dose","unità dose","udm dose"]],
      ["quantitaTotale","Quantità totale","number",["quantita totale","quantità totale","totale usato"]],
      ["note","Note","text",["note","annotazioni"]]
    ],
    irrigazione:[
      ["anno","Anno","number",["anno","campagna"]],
      ["coltura","Coltura","text",["coltura","specie"]],
      ["superficieHa","Superficie irrigata (ha)","number",["superficie irrigata","superficie","ha","ettari"]],
      ["volumeM3","Volume totale (m³)","number",["volume totale","volume m3","m3 totali","acqua m3"]],
      ["m3Ha","Volume (m³/ha)","number",["m3 ha","m3/ha","volume ha","volume ettaro"]],
      ["fonteAcqua","Fonte acqua","text",["fonte acqua","fonte","origine acqua"]],
      ["sistema","Sistema irriguo","text",["sistema irriguo","sistema","metodo irrigazione"]],
      ["metodoStima","Metodo determinazione volume","text",["metodo stima","metodo misura","metodo determinazione"]],
      ["elettricitaKWh","Elettricità pompaggio (kWh)","number",["elettricita","elettricità","kwh","energia pompaggio"]],
      ["gasolioL","Gasolio pompaggio (L)","number",["gasolio","litri gasolio","gasolio l"]],
      ["note","Note","text",["note","annotazioni"]]
    ],
    reflui:[
      ["anno","Anno","number",["anno","campagna"]],
      ["tipoRefluo","Tipo refluo","text",["tipo refluo","refluo","effluente","matrice","liquame","letame"]],
      ["quotaPercentuale","Quota (%)","number",["quota","percentuale","quota percentuale"]],
      ["sistemaStabulazione","Sistema stabulazione","text",["stabulazione","sistema stabulazione","pavimento"]],
      ["rimozione","Rimozione","text",["rimozione","frequenza rimozione","asportazione"]],
      ["sistemaStoccaggio","Sistema stoccaggio","text",["stoccaggio","sistema stoccaggio","vasca","concimaia"]],
      ["copertura","Copertura","text",["copertura","coperto","vasca coperta"]],
      ["capacita","Capacità stoccaggio","number",["capacita","capacità","capacita stoccaggio","volume vasca","volume stoccaggio"]],
      ["durataGiorni","Durata stoccaggio (giorni)","number",["durata","giorni stoccaggio","durata giorni"]],
      ["quantitaAnnua","Quantità annua","number",["quantita annua","quantità annua","volume annuo","produzione annua"]],
      ["unita","Unità","text",["unita","unità","udm"]],
      ["nTotale","N totale","number",["n totale","azoto totale","kg n"]],
      ["tanPercentN","TAN (% N)","number",["tan","tan %","azoto ammoniacale"]],
      ["sostanzaSecca","Sostanza secca (%)","number",["sostanza secca","ss","ss %"]],
      ["vs","VS (%)","number",["vs","solidi volatili","sv"]],
      ["note","Note","text",["note","annotazioni"]]
    ],
    energia:[
      ["anno","Anno","number",["anno","periodo","campagna"]],
      ["elettricitaKWh","Elettricità acquistata (kWh)","number",["elettricita","elettricità","energia elettrica","kwh","consumo kwh"]],
      ["fotovoltaicoKWh","Fotovoltaico prodotto (kWh)","number",["fotovoltaico","produzione fotovoltaico","kwh fotovoltaico"]],
      ["gasolioL","Gasolio (L)","number",["gasolio","litri gasolio","gasolio l"]],
      ["metanoM3","Metano (m³)","number",["metano","gas naturale","smc","m3 metano"]],
      ["gplL","GPL (L)","number",["gpl","litri gpl"]],
      ["acquaM3","Acqua (m³)","number",["acqua","consumo acqua","m3 acqua"]],
      ["note","Note","text",["note","annotazioni"]]
    ],
    analisi_reflui:[
      ["data","Data analisi","date",["data","data analisi","data campionamento"]],
      ["tipoRefluo","Tipo refluo","text",["tipo refluo","refluo","matrice","campione"]],
      ["nTotale","N totale","number",["n totale","azoto totale","n tot"]],
      ["tan","N ammoniacale / TAN","number",["tan","azoto ammoniacale","nh4 n","n-nh4"]],
      ["pTotale","P totale","number",["p totale","fosforo totale","p tot"]],
      ["p2o5","P2O5","number",["p2o5","anidride fosforica"]],
      ["sostanzaSecca","Sostanza secca (%)","number",["sostanza secca","ss %","ss"]],
      ["vs","Solidi volatili (%)","number",["solidi volatili","vs","sv"]],
      ["unita","Unità / base","text",["unita","unità","base","udm"]],
      ["laboratorio","Laboratorio","text",["laboratorio","lab"]],
      ["note","Note","text",["note","annotazioni"]]
    ],
    analisi_alimenti:[
      ["data","Data analisi","date",["data","data analisi","data campionamento"]],
      ["alimento","Alimento / materia prima","text",["alimento","materia prima","campione","mangime"]],
      ["sostanzaSecca","Sostanza secca (%)","number",["sostanza secca","ss %","dm %","dry matter"]],
      ["proteinaGrezza","Proteina grezza (%)","number",["proteina grezza","pg","cp","crude protein"]],
      ["nTotale","N totale (%)","number",["n totale","azoto totale","n %"]],
      ["ndf","NDF (%)","number",["ndf","fibra ndf"]],
      ["ceneri","Ceneri (%)","number",["ceneri","ash"]],
      ["energiaLorda","Energia lorda (MJ/kg)","number",["energia lorda","gross energy","ge","mj kg"]],
      ["digeribilita","Digeribilità (%)","number",["digeribilita","digeribilità","digestibility"]],
      ["laboratorio","Laboratorio","text",["laboratorio","lab"]],
      ["note","Note","text",["note","annotazioni"]]
    ]
  };
  return defs[target]||defs.concimazioni;
}
function normalizeHeader(v){return String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9%]+/g," ").trim().replace(/\s+/g," ");}
function headerScore(h,aliases){const n=normalizeHeader(h);if(!n)return 0;let best=0;for(const a of aliases){const x=normalizeHeader(a);if(n===x)best=Math.max(best,100);else if(n.includes(x)||x.includes(n))best=Math.max(best,70);else{const nt=new Set(n.split(" ")),xt=x.split(" ");const common=xt.filter(t=>t.length>1&&nt.has(t)).length;if(common)best=Math.max(best,common*15)}}return best;}
function autoMapHeaders(headers,target){const used=new Set(),map={};for(const [key,label,type,aliases] of extractionDefs(target)){let bi=-1,bs=0;headers.forEach((h,i)=>{if(used.has(i))return;const s=headerScore(h,[label,...aliases]);if(s>bs){bs=s;bi=i}});if(bs>=30&&bi>=0){map[key]=bi;used.add(bi)}}return map;}
function bestHeaderForMatrix(matrix,target){let best={row:0,score:-1,map:{}};for(let r=0;r<Math.min(matrix.length,25);r++){const headers=matrix[r]||[];const map=autoMapHeaders(headers,target);const score=Object.keys(map).length;if(score>best.score)best={row:r,score,map};}return best;}
function candidateTargets(ex){
  const out=[];
  for(const t of extractionTargets()){
    let best=0,bestSheet=0;
    (ex.sheets||[]).forEach((s,i)=>{const b=bestHeaderForMatrix(s.rows||[],t.v);const bonus=s.target===t.v?20:0;const score=b.score+bonus;if(score>best){best=score;bestSheet=i;}});
    const denom=Math.max(1,Math.min(6,extractionDefs(t.v).length));
    const pct=Math.min(100,Math.round(best/denom*100));
    if(best>=2)out.push({target:t.v,label:t.l,matches:best,pct,sheetIndex:bestSheet});
  }
  return out.sort((a,b)=>b.matches-a.matches||b.pct-a.pct);
}
function textFieldValue(text,aliases,type){
  const src=String(text||"").replace(/\r/g,"\n");
  for(const a of aliases){
    const ea=String(a).replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
    const re=new RegExp(`(?:^|\\n|\\b)${ea}\\s*(?:[:=\\-]|\\s)\\s*([^\\n;]{1,120})`,`i`);
    const m=src.match(re);if(!m)continue;
    let v=m[1].trim().replace(/^[:=\-\s]+/,"");
    if(type==="number"){const n=v.match(/[-+]?\d[\d.\s]*(?:,\d+)?/);if(n)return parseNumberLocal(n[0]);}
    if(type==="date"){const d=v.match(/\d{1,4}[\/.-]\d{1,2}[\/.-]\d{1,4}/);if(d)return normalizeDateImport(d[0]);}
    return v;
  }
  return "";
}
function textMatrixForTarget(text,target){
  const headers=[],values=[];
  for(const [key,label,type,aliases] of extractionDefs(target)){
    const v=textFieldValue(text,[label,...aliases],type);if(v!==""){headers.push(label);values.push(v);}
  }
  return headers.length>=2?[headers,values]:[];
}
function ensureTextSheet(ex){
  if((ex.originalSheets||[]).length){ex.sheets=ex.originalSheets;return;}
  if(!ex.rawText)return;
  const rows=textMatrixForTarget(ex.rawText,ex.target);
  ex.sheets=rows.length?[{name:"Dati riconosciuti dal testo",rows}]:[];
}

function prepareExtraction(ex){if(!ex)return ex;ensureTextSheet(ex);if(!ex.sheets?.length){ex.headers=[];ex.dataRows=[];ex.mapping={};return ex;}const sh=ex.sheets[ex.sheetIndex||0]||ex.sheets[0];const b=bestHeaderForMatrix(sh.rows||[],ex.target);ex.headerRow=b.row;ex.headers=(sh.rows[b.row]||[]).map((x,i)=>String(x??"").trim()||`Colonna ${i+1}`);ex.dataRows=(sh.rows||[]).slice(b.row+1).filter(r=>r.some(v=>String(v??"").trim()!==""));ex.mapping=b.map;return ex;}
function extractionPanel(){
  const ex=state.documentExtraction;if(!ex)return "";
  const defs=extractionDefs(ex.target),targetOpts=extractionTargets().map(o=>`<option value="${o.v}" ${o.v===ex.target?"selected":""}>${o.l}</option>`).join("");
  const sheetOpts=(ex.sheets||[]).map((s,i)=>`<option value="${i}" ${i===(ex.sheetIndex||0)?"selected":""}>${esc(s.name||`Foglio ${i+1}`)}</option>`).join("");
  const cand=ex.candidates||[];
  let body="";
  if(ex.profileLabel)body+=`<div class="extract-profile"><span class="badge">Profilo: ${esc(ex.profileLabel)}</span>${ex.ocrUsed?`<span class="confidence">OCR completato</span>`:`<span class="confidence">testo digitale</span>`}</div>`;
  if(cand.length){body+=`<div class="extract-status"><strong>Sezioni riconosciute:</strong> ${cand.slice(0,6).map(x=>`<button class="btn btn-secondary" style="margin:4px" data-action="pick-extract-target" data-target="${x.target}" data-sheet="${x.sheetIndex}">${esc(x.label)} · ${x.matches} campi</button>`).join("")}</div>`;}
  body+=`<div class="extract-grid"><div class="field"><label class="label">Dati da ricavare</label><select id="extractTarget">${targetOpts}</select></div>${ex.sheets?.length?`<div class="field"><label class="label">Foglio / tabella</label><select id="extractSheet">${sheetOpts}</select></div>`:""}</div>`;
  if(ex.warning)body+=`<div class="extract-status">${esc(ex.warning)}</div>`;
  if(ex.headers?.length){
    body+=`<div class="extract-map">${defs.map(([key,label])=>`<div class="extract-map-row"><label class="label">${esc(label)}</label><select data-extract-map="${key}"><option value="">Non importare</option>${ex.headers.map((h,i)=>`<option value="${i}" ${ex.mapping?.[key]===i?"selected":""}>${esc(h)}</option>`).join("")}</select></div>`).join("")}</div>`;
    const already=(ex.importedTargets||[]).includes(ex.target);
    body+=`<div class="extract-preview">${reviewTable(ex.headers,(ex.dataRows||[]).slice(0,5),"Nessuna riga rilevata")}</div><div class="actions-right" style="margin-top:12px"><button class="btn btn-primary" data-action="import-extracted" ${already?"disabled":""}>${already?"Sezione già importata":"Importa dati selezionati"}</button></div>`;
  } else if(ex.rawText){body+=`<div class="extract-status">Testo rilevato, ma non abbastanza strutturato per questa sezione. Puoi scegliere un'altra destinazione oppure incollare una tabella nel riquadro seguente.</div>`;}
  body+=`<div class="extract-paste"><label class="label">Tabella o testo copiato dal documento</label><textarea id="pasteTableText" placeholder="Incolla qui una tabella copiata dal PDF, dal gestionale o da un OCR. Sono accettati dati separati da tabulazioni, punto e virgola o virgole."></textarea><button class="btn btn-secondary" data-action="parse-pasted-table" style="margin-top:8px">Analizza contenuto incollato</button></div>`;
  return card("Ricava dati dal documento","",body);
}
function csvRows(text,forcedDelimiter=null){text=String(text||"").replace(/^\uFEFF/,"");const lines=text.split(/\r?\n/).filter(x=>x.trim()!=="");if(!lines.length)return[];let delim=forcedDelimiter;if(!delim){const cand=["\t",";",","];delim=cand.map(d=>[d,lines.slice(0,8).reduce((n,l)=>n+(l.split(d).length-1),0)]).sort((a,b)=>b[1]-a[1])[0][0];}
  const rows=[];let row=[],field="",q=false;for(let i=0;i<text.length;i++){const ch=text[i];if(q){if(ch==='"'&&text[i+1]==='"'){field+='"';i++;}else if(ch==='"')q=false;else field+=ch;}else if(ch==='"')q=true;else if(ch===delim){row.push(field.trim());field="";}else if(ch==='\n'){row.push(field.trim().replace(/\r$/,""));if(row.some(v=>v!==""))rows.push(row);row=[];field="";}else field+=ch;}row.push(field.trim().replace(/\r$/,""));if(row.some(v=>v!==""))rows.push(row);return rows;}
function xmlDecode(s){return String(s??"").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,"&");}
function xlsxColIndex(ref){const m=String(ref).match(/^([A-Z]+)/i);if(!m)return 0;let n=0;for(const ch of m[1].toUpperCase())n=n*26+(ch.charCodeAt(0)-64);return n-1;}
async function unzipXlsx(buf){const bytes=new Uint8Array(buf),dv=new DataView(buf);let e=-1;for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--){if(dv.getUint32(i,true)===0x06054b50){e=i;break}}if(e<0)throw new Error("File Excel non valido");const count=dv.getUint16(e+10,true),cd=dv.getUint32(e+16,true),dec=new TextDecoder();let p=cd;const out={};for(let k=0;k<count;k++){if(dv.getUint32(p,true)!==0x02014b50)break;const method=dv.getUint16(p+10,true),cs=dv.getUint32(p+20,true),fn=dv.getUint16(p+28,true),ex=dv.getUint16(p+30,true),cm=dv.getUint16(p+32,true),lo=dv.getUint32(p+42,true),name=dec.decode(bytes.slice(p+46,p+46+fn)),lfn=dv.getUint16(lo+26,true),lex=dv.getUint16(lo+28,true),st=lo+30+lfn+lex,raw=bytes.slice(st,st+cs);let data;if(method===0)data=raw;else if(method===8){const ds=new DecompressionStream("deflate-raw");data=new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(ds)).arrayBuffer());}else{p+=46+fn+ex+cm;continue}out[name]=data;p+=46+fn+ex+cm;}return out;}
function xlsxShared(xml){const out=[];for(const m of xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)){let s="";for(const t of m[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g))s+=xmlDecode(t[1]);out.push(s)}return out;}
function xlsxSheetRows(xml,shared){const rows=[];for(const m of xml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)){const a=m[1]||"",b=m[2]||"",ref=(a.match(/\br="([^"]+)"/)||[])[1]||"A1",ci=xlsxColIndex(ref),ri=Math.max(0,(parseInt((ref.match(/\d+/)||["1"])[0],10)||1)-1),type=(a.match(/\bt="([^"]+)"/)||[])[1]||"";let v="";const vm=b.match(/<v[^>]*>([\s\S]*?)<\/v>/),tm=b.match(/<t\b[^>]*>([\s\S]*?)<\/t>/);if(type==="inlineStr")v=tm?xmlDecode(tm[1]):"";else if(vm){const raw=xmlDecode(vm[1]);v=type==="s"?(shared[Number(raw)]??raw):raw}else if(tm)v=xmlDecode(tm[1]);while(rows.length<=ri)rows.push([]);while(rows[ri].length<=ci)rows[ri].push("");rows[ri][ci]=v;}return rows;}
async function parseXlsxFile(blob){const z=await unzipXlsx(await blob.arrayBuffer()),td=new TextDecoder(),shared=z["xl/sharedStrings.xml"]?xlsxShared(td.decode(z["xl/sharedStrings.xml"])):[];let sheetMeta=[],rels={};if(z["xl/workbook.xml"]){const wb=td.decode(z["xl/workbook.xml"]);for(const m of wb.matchAll(/<sheet\b[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"[^>]*\/>/g))sheetMeta.push({name:xmlDecode(m[1]),rid:m[2]});}if(z["xl/_rels/workbook.xml.rels"]){const rr=td.decode(z["xl/_rels/workbook.xml.rels"]);for(const m of rr.matchAll(/<Relationship\b[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g))rels[m[1]]=m[2];}const sheets=[];for(const s of sheetMeta){let t=rels[s.rid]||"";t=t.replace(/^\//,"");if(!t.startsWith("xl/"))t="xl/"+t.replace(/^\.\//,"");if(z[t])sheets.push({name:s.name,rows:xlsxSheetRows(td.decode(z[t]),shared)});}if(!sheets.length){for(const n of Object.keys(z).filter(n=>/^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort())sheets.push({name:n.split("/").pop(),rows:xlsxSheetRows(td.decode(z[n]),shared)});}return sheets;}
const PDFJS_CDN="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const PDFJS_WORKER_CDN="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
const TESSERACT_CDN="https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
const TESSERACT_WORKER_CDN="https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js";
const TESSERACT_CORE_CDN="https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1";
const TESSERACT_LANG_CDN="https://tessdata.projectnaptha.com/4.0.0";
function setImportProgress(msg,pct=null){const box=$("#importProgress"),txt=$("#importProgressText"),bar=$("#importProgressBar");if(box)box.hidden=false;if(txt)txt.textContent=msg;if(bar&&pct!==null)bar.style.width=`${Math.max(0,Math.min(100,pct))}%`;}
function clearImportProgress(){const box=$("#importProgress");if(box)box.hidden=true;}
function loadExternalScript(src,globalName){return new Promise((resolve,reject)=>{if(globalThis[globalName]){resolve(globalThis[globalName]);return;}const old=[...document.scripts].find(s=>s.src===src);if(old){if(globalThis[globalName]){resolve(globalThis[globalName]);return;}old.addEventListener("load",()=>resolve(globalThis[globalName]),{once:true});old.addEventListener("error",reject,{once:true});return;}const s=document.createElement("script");s.src=src;s.async=true;s.crossOrigin="anonymous";s.onload=()=>resolve(globalThis[globalName]);s.onerror=()=>reject(new Error(`Impossibile caricare ${globalName}`));document.head.appendChild(s);});}
async function ensurePdfJs(){
  if(!globalThis.pdfjsLib)await loadExternalScript(PDFJS_CDN,"pdfjsLib");
  // Loading the worker also as a normal script lets PDF.js use its fake-worker path
  // when the demo is opened from file://, avoiding a cross-origin Worker failure.
  if(!globalThis.pdfjsWorker){try{await loadExternalScript(PDFJS_WORKER_CDN,"pdfjsWorker");}catch(e){console.warn("PDF worker preload",e);}}
  if(globalThis.pdfjsLib?.GlobalWorkerOptions)globalThis.pdfjsLib.GlobalWorkerOptions.workerSrc=PDFJS_WORKER_CDN;
  return globalThis.pdfjsLib;
}
async function ensureTesseract(){if(!globalThis.Tesseract)await loadExternalScript(TESSERACT_CDN,"Tesseract");return globalThis.Tesseract;}
function pageRangeLabel(pages){if(!pages?.length)return "";return pages.length<=8?pages.join(", "):`${pages.slice(0,4).join(", ")} … ${pages.slice(-2).join(", ")}`;}
async function pdfJsRead(blob){const lib=await ensurePdfJs(),data=new Uint8Array(await blob.arrayBuffer());const pdf=await lib.getDocument({data}).promise,pages=[];for(let n=1;n<=pdf.numPages;n++){setImportProgress(`Lettura PDF: pagina ${n}/${pdf.numPages}`,Math.round(n/pdf.numPages*28));const page=await pdf.getPage(n),tc=await page.getTextContent(),parts=[];for(const item of tc.items||[]){if(item.str)parts.push(item.str);if(item.hasEOL)parts.push("\n");else parts.push(" ");}pages.push({number:n,text:parts.join("").replace(/[ \t]+\n/g,"\n")});}return {pdf,pages,rawText:pages.map(p=>`[[PAGE ${p.number}]]\n${p.text}`).join("\n")};}
function ocrPagesForType(tipo,n){let p=[];if(tipo==="PUA")p=[1,7,8,9,10,11,12,13,14,15];else if(tipo==="Registro concimazioni")p=Array.from({length:Math.min(n,10)},(_,i)=>i+1);else if(tipo==="Registro trattamenti")p=Array.from({length:Math.min(n,6)},(_,i)=>i+1);else p=Array.from({length:Math.min(n,10)},(_,i)=>i+1);return [...new Set(p.filter(x=>x>=1&&x<=n))];}
function ocrRotation(tipo,pageNo){if(tipo==="Registro concimazioni")return 90;if(tipo==="Registro trattamenti"&&pageNo>1)return -90;return 0;}
function ocrPsm(tipo){return tipo==="Registro trattamenti"?"6":"11";}
function matrixFromWords(words,canvasWidth,canvasHeight){if(!Array.isArray(words)||!words.length)return[];const ws=words.filter(w=>(w.text||"").trim()&&w.bbox).map(w=>({...w,cx:(w.bbox.x0+w.bbox.x1)/2,cy:(w.bbox.y0+w.bbox.y1)/2})).sort((a,b)=>a.cy-b.cy||a.bbox.x0-b.bbox.x0);const lines=[];const tol=Math.max(8,Math.min(18,(canvasHeight||1200)*.006));for(const w of ws){let line=lines.filter(l=>Math.abs(l.cy-w.cy)<=tol).sort((a,b)=>Math.abs(a.cy-w.cy)-Math.abs(b.cy-w.cy))[0];if(!line){line={cy:w.cy,words:[]};lines.push(line);}line.words.push(w);line.cy=line.words.reduce((s,x)=>s+x.cy,0)/line.words.length;}return lines.sort((a,b)=>a.cy-b.cy).map(l=>{const arr=l.words.sort((a,b)=>a.bbox.x0-b.bbox.x0);const cells=[];let cur="",last=null;for(const w of arr){const gap=last===null?0:w.bbox.x0-last;if(last!==null&&gap>Math.max(28,canvasWidth*.023)){cells.push(cur.trim());cur="";}cur+=(cur?" ":"")+w.text;last=w.bbox.x1;}if(cur.trim())cells.push(cur.trim());return cells;}).filter(r=>r.some(Boolean));}
function ocrLineGroups(page){const words=(page?.words||[]).filter(w=>(w.text||"").trim()&&w.bbox).map(w=>({...w,cy:(w.bbox.y0+w.bbox.y1)/2})).sort((a,b)=>a.cy-b.cy||a.bbox.x0-b.bbox.x0),lines=[],tol=Math.max(8,Math.min(18,(page?.height||1500)*.006));for(const w of words){let line=lines.filter(l=>Math.abs(l.cy-w.cy)<=tol).sort((a,b)=>Math.abs(a.cy-w.cy)-Math.abs(b.cy-w.cy))[0];if(!line){line={cy:w.cy,words:[]};lines.push(line);}line.words.push(w);line.cy=line.words.reduce((s,x)=>s+x.cy,0)/line.words.length;}for(const l of lines){l.words.sort((a,b)=>a.bbox.x0-b.bbox.x0);l.text=l.words.map(w=>w.text).join(" ");}return lines.sort((a,b)=>a.cy-b.cy);}
function bandWords(line,width,a,b){return (line?.words||[]).filter(w=>{const x=((w.bbox.x0+w.bbox.x1)/2)/(width||1);return x>=a&&x<b;});}
function bandText(line,width,a,b){return bandWords(line,width,a,b).map(w=>w.text).join(" ").trim();}
function numericToken(s){const m=String(s||"").replace(/[\]\[{}|]/g,"").match(/-?\d+(?:[.,]\d+)?/);return m?parseNumberLocal(m[0]):"";}
function allNumericBand(line,width,a,b){return bandWords(line,width,a,b).map(w=>numericToken(w.text)).filter(v=>typeof v==="number");}
async function ocrPdf(blob,meta,pdfInfo){
  const T=await ensureTesseract(),pdf=pdfInfo?.pdf||await (await ensurePdfJs()).getDocument({data:new Uint8Array(await blob.arrayBuffer())}).promise,pages=ocrPagesForType(meta.tipo,pdf.numPages),sheets=[],texts=[],ocrPageData=[];
  setImportProgress(`OCR: preparo pagine ${pageRangeLabel(pages)}`,30);
  let worker=null;
  const opts={workerPath:TESSERACT_WORKER_CDN,corePath:TESSERACT_CORE_CDN,langPath:TESSERACT_LANG_CDN,workerBlobURL:true,logger:m=>{if(m.status==="recognizing text"&&typeof m.progress==="number")setImportProgress(`OCR in corso…`,35+Math.round(m.progress*58/Math.max(1,pages.length)));}};
  try{worker=await T.createWorker("ita",1,opts);await worker.setParameters?.({tessedit_pageseg_mode:ocrPsm(meta.tipo),preserve_interword_spaces:"1"});}catch(e){console.warn("Worker OCR",e);worker=null;}
  for(let i=0;i<pages.length;i++){
    const n=pages[i];setImportProgress(`OCR pagina ${n} (${i+1}/${pages.length})`,35+Math.round(i/pages.length*58));
    const page=await pdf.getPage(n),rot=(page.rotate||0)+ocrRotation(meta.tipo,n),vp=page.getViewport({scale:2.5,rotation:rot});
    const canvas=document.createElement("canvas");canvas.width=Math.round(vp.width);canvas.height=Math.round(vp.height);await page.render({canvasContext:canvas.getContext("2d",{alpha:false}),viewport:vp}).promise;
    let txt="",words=[];
    if(meta.tipo==="Registro trattamenti"&&worker){
      await worker.setParameters?.({tessedit_pageseg_mode:"6",preserve_interword_spaces:"1"});
      const rt=await worker.recognize(canvas);txt=rt?.data?.text||"";
      await worker.setParameters?.({tessedit_pageseg_mode:"11",preserve_interword_spaces:"1"});
      const rw=await worker.recognize(canvas);words=rw?.data?.words||[];
    }else{
      let res;if(worker)res=await worker.recognize(canvas);else res=await T.recognize(canvas,"ita",opts);
      const data=res?.data||{};txt=data.text||"";words=data.words||[];
    }
    texts.push(`[[PAGE ${n}]]\n${txt}`);ocrPageData.push({number:n,text:txt,words,width:canvas.width,height:canvas.height});
    const mat=matrixFromWords(words,canvas.width,canvas.height);if(mat.length)sheets.push({name:`OCR pagina ${n}`,rows:mat});
    canvas.width=1;canvas.height=1;
  }
  try{await worker?.terminate?.();}catch{}
  return {rawText:texts.join("\n"),sheets,pages:ocrPageData};
}
function findFirst(text,res){for(const re of res){const m=String(text||"").match(re);if(m)return (m[1]||m[0]||"").trim();}return "";}
function normalizeCropName(s){const x=String(s||"").toUpperCase();if(/USO NON AGRICOLO|TARE|MANUFATT|SIEPI|FASCE ALBERATE/.test(x))return "";if(/GRANTURCO|\bMAIS\b|\bMAS\b/.test(x))return "Mais";if(/\bSOIA\b/.test(x))return "Soia";if(/LEGUMINOSE DA GRANELLA/.test(x))return "Leguminose da granella";if(/GRANO.*TENERO|FRUMENTO.*TENERO/.test(x))return "Frumento tenero";if(/ERBA MEDICA/.test(x))return "Erba medica";if(/ERBAIO/.test(x))return "Erbaio";if(/ZUCCA/.test(x))return "Zucca";return String(s||"").split(" - ")[0].trim();}
function standardAnagraficaSheet(meta,text){const cuaa=findFirst(text,[/\b(?:CUAA\s*)?(\d{11})\b/i]),rag=findFirst(text,[/(SOCIETA['’]?\s+AGRICOLA[^\n]{2,80})/i,/Ragione\s+sociale\s*[:\-]?\s*([^\n]{2,90})/i]),loc=String(text||"").match(/\b([A-ZÀ-Ü][A-ZÀ-Ü '\-]{2,35})\s*\(([A-Z]{2})\)/);const comune=loc?loc[1].trim():"",provincia=loc?loc[2]:"";if(!cuaa&&!rag&&!comune)return null;return {name:"Anagrafica riconosciuta",target:"azienda",rows:[["Ragione sociale","CUAA / codice fiscale","Comune","Provincia"],[rag,cuaa,comune,provincia]]};}
function parseAvepaPiano(meta,text){const sheets=[],ana=standardAnagraficaSheet(meta,text);if(ana)sheets.push(ana);const anno=Number(findFirst(text,[/Campagna\s+(20\d{2})/i]))||Number(meta.anno)||new Date().getFullYear(),agg=new Map();const lines=String(text||"").split(/\n+/);for(const ln of lines){const m=ln.match(/^\s*\d{1,2}\s+\d{5}\s+\d+\s+\d+\s+(.+?)\s+\d+\s+\([0-9\-]+\)\s+(\d+)\s+(non irrigua|irrigua)\b/i);if(!m)continue;const crop=normalizeCropName(m[1]);if(!crop)continue;const area=Number(m[2])/10000,irr=/^irrigua$/i.test(m[3]);const z=agg.get(crop)||{area:0,irr:0};z.area+=area;if(irr)z.irr+=area;agg.set(crop,z);}if(agg.size){const rows=[["Anno / campagna","Coltura","Superficie (ha)","Irrigazione","Azotofissatrice","Note"]];for(const [crop,z] of agg){const az=/soia|erba medica|legumin/i.test(crop)?"Sì":"No",irr=z.irr<=.00001?"No":Math.abs(z.irr-z.area)<.0001?"Sì":"Parziale";rows.push([anno,crop,Number(z.area.toFixed(4)),irr,az,z.irr?`Superficie irrigua rilevata: ${z.irr.toFixed(4)} ha`:""]);}sheets.push({name:"Piano colturale aggregato AVEPA",target:"colture",rows});}return sheets;}
function parsePuaInventory(meta,ocrPages){const pg=(ocrPages||[]).find(p=>p.number===8);if(!pg)return null;const lines=ocrLineGroups(pg),rows=[["Anno","Categoria animale","Sistema di stabulazione","Capi","N prodotto (kg)","Liquame (m³)","Letame / materiale palabile (t)","Letame / materiale palabile (m³)","Fosforo (kg)","Note"]],anno=Number(meta.anno)||new Date().getFullYear();for(const l of lines){if(!/(Libera in box su pavimento fessurato|Libera con lettiera anche in zona di alimentazione|Libera su lettiera inclinata|Libera con lettiera solo in area di riposo)/i.test(l.text))continue;const near=lines.filter(n=>Math.abs(n.cy-l.cy)<pg.height*.025).sort((a,b)=>Math.abs(a.cy-l.cy)-Math.abs(b.cy-l.cy));let nums=null;for(const n of near){const capi=numericToken(bandText(n,pg.width,.565,.615));const nprod=numericToken(bandText(n,pg.width,.615,.665));if(typeof capi==="number"&&typeof nprod==="number"){nums=n;break;}}if(!nums)continue;const capi=numericToken(bandText(nums,pg.width,.565,.615)),nprod=numericToken(bandText(nums,pg.width,.615,.665)),liq=numericToken(bandText(nums,pg.width,.665,.72)),letT=numericToken(bandText(nums,pg.width,.72,.78)),letM3=numericToken(bandText(nums,pg.width,.78,.84)),p=numericToken(bandText(nums,pg.width,.84,.94));const label=bandText(l,pg.width,0,.56)||l.text.trim();rows.push([anno,"Vitelloni (> 6 mesi)",label,capi,nprod,liq,letT,letM3,p,"Riconosciuto dal quadro zootecnico PUA; verificare prima dell'importazione"]);}return rows.length>1?{name:"Consistenza zootecnica PUA",target:"consistenza",rows}:null;}
function parsePuaProfile(meta,text,ocrPages=[]){const sheets=[],ana=standardAnagraficaSheet(meta,text);if(ana)sheets.push(ana);const anno=Number(meta.anno)||new Date().getFullYear();const nprod=findFirst(text,[/azoto\s+prodotto\s+in\s+azienda[\s\S]{0,180}?pari\s*a\s*kg\s*([0-9.,]+)/i,/azoto\s+prodotto[\s\S]{0,100}?([0-9]{3,7})\s*kg/i]);const water=findFirst(text,[/m[c³3][^\n]{0,12}anno\s*[:\s]*([0-9.,]+)/i,/Stima dei consumi idrici[\s\S]{0,150}?([0-9]{2,}(?:[.,][0-9]+)?)/i,/([0-9.,]+)\s*m[c³3]\s*\/\s*anno/i]);if(nprod||water)sheets.push({name:"Bilancio N e acqua PUA",target:"bilancio_n",rows:[["Anno","N prodotto in azienda (kg N)","Acqua abbeveraggio (m³/anno)"],[anno,nprod,water]]});
const inv=parsePuaInventory(meta,ocrPages);if(inv)sheets.push(inv);
const storRows=[["Anno","Tipo refluo","Sistema stoccaggio","Copertura","Capacità / volume","Unità","Note"]];for(const pg of (ocrPages||[])){if(pg.number<13||pg.number>15)continue;for(const l of ocrLineGroups(pg)){if(!/(concimaia|vasca|fosse?\s+sottostanti|lagone)/i.test(l.text))continue;const vals=(l.words||[]).map(w=>numericToken(w.text)).filter(v=>typeof v==="number");const plausible=vals.find(v=>v>=50&&v<100000);if(plausible===undefined)continue;const cover=/\bSI\b/i.test(l.text)?"Sì":/\bNO\b/i.test(l.text)?"No":"",system=bandText(l,pg.width,0,.58).replace(/\s+/g," ").trim()||l.text.replace(/\s+/g," ").trim();storRows.push([anno,/concimaia/i.test(l.text)?"Letame":"Liquame",system,cover,plausible,"m³","Riconosciuto dal PUA; verificare volume e copertura"]);}}
if(storRows.length>1)sheets.push({name:"Stoccaggi riconosciuti PUA",target:"reflui",rows:storRows});return sheets;}
function pageBlocks(text){const arr=[];for(const m of String(text||"").matchAll(/\[\[PAGE\s+(\d+)\]\]\s*([\s\S]*?)(?=\[\[PAGE\s+\d+\]\]|$)/g))arr.push({page:Number(m[1]),text:m[2]});return arr;}
function treatmentPageMeta(text){const out={},blocks=pageBlocks(text);let currentCrop="",currentSurface="";for(const pb of blocks){const cm=pb.text.match(/(MA[I1]?S|MAS|SOIA(?:\s*2[°º]?\s*(?:RACC\.?|RACCOLTO))?|FRUMENTO(?:\s+TENERO)?|GRANO(?:\s+TENERO)?|ERBA\s+MEDICA|ZUCCA)/i);let crop=cm?normalizeCropName(cm[1]):"";if(!crop&&/2[°º]?\s*(?:racc|raccolto)/i.test(pb.text)&&currentCrop==="Soia")crop="Soia";const sm=pb.text.match(/SUPERFICIE\s*(?:\(ha\))?[\s\S]{0,100}?([0-9]+[.,][0-9]{3,5})/i);let surface=sm?parseNumberLocal(sm[1]):"";if(crop)currentCrop=crop;if(surface)currentSurface=surface;out[pb.page]={crop:currentCrop,surface:currentSurface};}return out;}
function parseTreatmentProfile(meta,text,ocrPages=[]){const rows=[["Data","Coltura","Superficie (ha)","Categoria","Prodotto commerciale","Dose","Unità dose","Quantità totale","Note"]],pmeta=treatmentPageMeta(text);if(ocrPages?.length){for(const pg of ocrPages){const pm=pmeta[pg.number]||{crop:"",surface:""};for(const l of ocrLineGroups(pg)){const ds=bandText(l,pg.width,0,.16),dm=ds.match(/\d{1,2}(?:[-–]\d{1,2})?[\/-]\d{1,2}[\/-]20\d{2}/);if(!dm)continue;let prod=bandText(l,pg.width,.16,.30).replace(/^[|:;\-\s]+|[|:;\-\s]+$/g,"").trim();if(!prod||/^(ddt|idt|iddt|nuova cooperativa|cooperativa agricola)/i.test(prod))continue;const qb=bandText(l,pg.width,.30,.36),qty=numericToken(qb),um=(qb.match(/\b(kg|lt|it|lit|l|gr|g|ml)\b/i)||[])[1]||"";const sb=bandText(l,pg.width,.36,.44),sv=numericToken(sb);let surface=typeof sv==="number"?sv:pm.surface;let surfaceWarn="";if(typeof surface==="number"&&typeof pm.surface==="number"&&surface>pm.surface*1.05){surfaceWarn=`Superficie OCR incoerente (${surface} ha); usata superficie coltura ${pm.surface} ha.`;surface=pm.surface;}let cat=bandText(l,pg.width,.44,.59).replace(/\s+/g," ").trim().replace(/\s+Antonio.*$/i,"").trim();const dose=typeof qty==="number"&&typeof surface==="number"&&surface>0?Number((qty/surface).toFixed(5)):"";let firstDate=dm[0].replace(/^(\d{1,2})[-–](\d{1,2})([\/-])/,'$1$3');let unit=um; if(/^(it|lt|lit|l)$/i.test(unit))unit="L";else if(/^gr$/i.test(unit))unit="g";rows.push([normalizeDateImport(firstDate),pm.crop,surface,cat,prod,dose,unit?`${unit}/ha`:"",qty,[dm[0]!==firstDate?`Intervallo originale: ${dm[0]}`:"",surfaceWarn].filter(Boolean).join(" ")]);}}return rows.length>1?[{name:"Trattamenti riconosciuti",target:"trattamenti",rows}]:[];}
// Fallback for copied/plain OCR text without word geometry.
for(const pb of pageBlocks(text)){const pm=pmeta[pb.page]||{crop:"",surface:""};for(const ln0 of pb.text.split(/\n+/)){const ln=ln0.replace(/\s+/g," ").trim(),dm=ln.match(/(\d{1,2}(?:[-–]\d{1,2})?[\/-]\d{1,2}[\/-]20\d{2})/);if(!dm)continue;const rest=ln.slice(dm.index+dm[0].length).trim(),qm=rest.match(/(.+?)\s+(\d+(?:[.,]\d+)?)\s*(kg|lt|it|lit|l|litri?|gr|g|ml)\b\s*([0-9]+(?:[.,][0-9]+)?)?/i);if(!qm)continue;const prod=qm[1].trim(),qty=parseNumberLocal(qm[2]),surface=qm[4]?parseNumberLocal(qm[4]):pm.surface,dose=typeof qty==="number"&&typeof surface==="number"&&surface>0?Number((qty/surface).toFixed(5)):"";rows.push([normalizeDateImport(dm[1].replace(/^(\d{1,2})[-–](\d{1,2})([\/-])/,'$1$3')),pm.crop,surface,"",prod,dose,`${qm[3]}/ha`,qty,""]);}}return rows.length>1?[{name:"Trattamenti riconosciuti",target:"trattamenti",rows}]:[];}

function cropSectionsFromOcrPage(pg){const lines=ocrLineGroups(pg),sections=[];for(let i=0;i<lines.length;i++){const t=lines[i].text;let crop="";if(/Mais\s*\(classe|\bMAIS\b/i.test(t))crop="Mais";else if(/Frumento tenero/i.test(t))crop="Frumento tenero";else if(/Leguminose da granella/i.test(t))crop="Leguminose da granella";else if(/\bSOIA\b/i.test(t))crop="Soia";if(!crop)continue;let surface="";for(let j=Math.max(0,i-5);j<Math.min(lines.length,i+7);j++){for(const w of lines[j].words||[]){const n=numericToken(w.text);if(typeof n==="number"&&n>.05&&n<500&&/[.,]/.test(w.text||"")){surface=n;}}
}sections.push({cy:lines[i].cy,crop,surface});}return sections.sort((a,b)=>a.cy-b.cy);}
function nearestCropSection(sections,cy){let out=null;for(const s of sections){if(s.cy<=cy+15)out=s;else break;}return out||sections[0]||{crop:"",surface:""};}
function dateFromBand(line,width){const s=bandText(line,width,0,.095),ms=[...s.matchAll(/\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}/g)].map(m=>normalizeDateImport(m[0])).filter(Boolean).sort();return ms[0]||"";}
function parseFertilizationProfile(meta,text,ocrPages=[]){const rows=[["Data","Anno","Coltura","Superficie (ha)","Tipo input","Prodotto / materiale","Quantità","Unità","N totale","P2O5","Tecnica di distribuzione","Note"]],anno=Number(meta.anno)||Number(findFirst(text,[/Anno\s+(20\d{2})/i]))||new Date().getFullYear();for(const pg of ocrPages||[]){const lines=ocrLineGroups(pg),sections=cropSectionsFromOcrPage(pg);for(const l of lines){const lt=l.text.replace(/\s+/g," ").trim(),sec=nearestCropSection(sections,l.cy);if(/\b(liquame|letame|digestato)\b/i.test(lt)){const prod=bandText(l,pg.width,.085,.37)||((lt.match(/(liquame[^0-9]{0,70}|letame[^0-9]{0,70}|digestato[^0-9]{0,70})/i)||[])[1]||"");const surface=numericToken(bandText(l,pg.width,.37,.43))||sec.surface;const qty=numericToken(bandText(l,pg.width,.43,.49));const nTot=numericToken(bandText(l,pg.width,.49,.535));const mode=bandText(l,pg.width,.63,.77);const p2=numericToken(bandText(l,pg.width,.89,.93));rows.push([dateFromBand(l,pg.width),anno,sec.crop,surface,"Organico",prod.trim(),qty,"m³",nTot,p2,mode,"Riga riconosciuta dal registro: verificare i valori prima dell'importazione"]);continue;}
if(/\b(urea|solfato|nitrato|fosfato|phitogreen|dap\b|concime|fertilizzante)\b/i.test(lt)&&!/(Sottosezione|Denominazione)/i.test(lt)){const prod=bandText(l,pg.width,.085,.40)||lt;const qty=numericToken(bandText(l,pg.width,.42,.49));const ub=bandText(l,pg.width,.46,.51),um=ub.match(/\b(kg|t|q|m3|m³|l|lt)\b/i);const unit=um?um[1]:"kg";const surface=numericToken(bandText(l,pg.width,.50,.58))||sec.surface;const nTot=numericToken(bandText(l,pg.width,.58,.65));const p2=numericToken(bandText(l,pg.width,.84,.91));if(qty!==""||nTot!=="")rows.push([dateFromBand(l,pg.width),anno,sec.crop,surface,"Minerale",prod.trim(),qty,unit,nTot,p2,"","Riga riconosciuta dal registro: verificare i valori prima dell'importazione"]);}}
}return rows.length>1?[{name:"Concimazioni riconosciute",target:"concimazioni",rows}]:[];}
function identifyProfile(meta,text){const t=String(text||"").toUpperCase();if(meta.tipo==="Piano Utilizzo / Fascicolo AVEPA"||/PIANO UTILIZZO|FASCICOLO AZIENDALE/.test(t))return {id:"avepa",label:"Piano Utilizzo / Fascicolo AVEPA"};if(meta.tipo==="Registro trattamenti"||/REGISTRO DEI TRATTAMENTI/.test(t))return {id:"trattamenti",label:"Registro trattamenti"};if(meta.tipo==="Registro concimazioni"||/REGISTRO DELLE CONCIMAZIONI|APPORTI IN AZOTO/.test(t))return {id:"concimazioni",label:"Registro concimazioni"};if(meta.tipo==="PUA"||/CONSISTENZA ZOOTECNICA|EFFLUENTI DI AZOTO|QUADRO D/.test(t))return {id:"pua",label:"PUA Veneto"};return {id:"generic",label:meta.tipo||"Documento generico"};}
function profileSheets(meta,text,ocrPages=[]){const p=identifyProfile(meta,text);let sheets=[];if(p.id==="avepa")sheets=parseAvepaPiano(meta,text);else if(p.id==="pua")sheets=parsePuaProfile(meta,text,ocrPages);else if(p.id==="trattamenti")sheets=parseTreatmentProfile(meta,text,ocrPages);else if(p.id==="concimazioni")sheets=parseFertilizationProfile(meta,text,ocrPages);return {profile:p,sheets};}

async function loosePdfText(blob){try{const s=new TextDecoder("latin1").decode(new Uint8Array(await blob.arrayBuffer())),parts=[];for(const m of s.matchAll(/\(([^()]*(?:\\.[^()]*)*)\)\s*Tj/g))parts.push(m[1].replace(/\\([()\\])/g,"$1"));for(const m of s.matchAll(/\[((?:.|\n|\r)*?)\]\s*TJ/g)){for(const x of m[1].matchAll(/\(([^()]*(?:\\.[^()]*)*)\)/g))parts.push(x[1].replace(/\\([()\\])/g,"$1"));}return parts.join("\n");}catch{return ""}}
async function localImageText(blob){
  try{
    if(!("TextDetector" in globalThis)||!("createImageBitmap" in globalThis))return "";
    const bitmap=await createImageBitmap(blob),detector=new TextDetector(),blocks=await detector.detect(bitmap);
    bitmap.close?.();return (blocks||[]).map(x=>x.rawValue||"").filter(Boolean).join("\n");
  }catch{return "";}
}
async function documentSheets(meta,blob){
  const name=(meta.filename||blob.name||"").toLowerCase(),mime=(meta.mime||blob.type||"").toLowerCase();
  if(name.endsWith(".xlsx"))return {sheets:await parseXlsxFile(blob),warning:"",profileLabel:"Excel / foglio dati",ocrUsed:false};
  if(name.endsWith(".csv")||name.endsWith(".tsv")||name.endsWith(".txt")){const text=await blob.text();return {sheets:[{name:"Dati",rows:csvRows(text,name.endsWith(".tsv")?"\t":null)}],rawText:text,warning:"",profileLabel:"Tabella testo",ocrUsed:false};}
  if(name.endsWith(".xls"))return {sheets:[],rawText:"",warning:"Il vecchio formato .xls non viene letto direttamente. Salvalo come .xlsx/CSV.",profileLabel:"Excel legacy",ocrUsed:false};
  if(name.endsWith(".pdf")||mime==="application/pdf"){
    let digital={rawText:"",pages:[],pdf:null},sheets=[],warning="",ocrUsed=false,ocrPages=[];
    try{digital=await pdfJsRead(blob);}catch(e){console.warn("PDF.js",e);digital.rawText=await loosePdfText(blob);}
    let text=digital.rawText||"";let profile=identifyProfile(meta,text);const meaningful=text.replace(/\[\[PAGE[^\]]+\]\]/g,"").replace(/\s/g,"").length;
    const needsOcr=meaningful<500 && ["PUA","Registro concimazioni","Registro trattamenti","Fascicolo aziendale","Piano Utilizzo / Fascicolo AVEPA"].includes(meta.tipo);
    if(needsOcr){try{setImportProgress("PDF scannerizzato: avvio OCR locale…",38);const o=await ocrPdf(blob,meta,digital);ocrUsed=true;text=[text,o.rawText].filter(Boolean).join("\n");sheets.push(...(o.sheets||[]));profile=identifyProfile(meta,text);warning="OCR eseguito nel browser. Verifica i valori riconosciuti prima dell'importazione.";}catch(e){console.error(e);warning=`OCR non riuscito: ${String(e?.message||e).slice(0,180)}. Se stai usando il file DEMO, prova il pacchetto webapp tramite AVVIA_LCA.bat oppure la versione HTTPS.`;}}
    const derived=profileSheets(meta,text,digital.ocrPages||[]);if(derived.sheets?.length)sheets.unshift(...derived.sheets);
    if(!sheets.length&&text&&(text.includes("\t")||text.includes(";")))sheets=[{name:"Testo PDF",rows:csvRows(text)}];
    clearImportProgress();return {sheets,rawText:text,warning:warning||(derived.sheets?.length?"Dati riconosciuti dal profilo del documento. Conferma sempre la mappatura prima dell'importazione.":"Testo PDF estratto: scegli una sezione e verifica i campi."),profileLabel:derived.profile?.label||profile.label,ocrUsed};
  }
  if(mime.startsWith("image/")||/\.(jpg|jpeg|png|webp|heic|heif)$/i.test(name)){
    let text=await localImageText(blob),ocrUsed=false,warning="";
    if(!text){try{const T=await ensureTesseract();setImportProgress("OCR della foto in corso…",20);let worker=null;try{worker=await T.createWorker("ita",1,{logger:m=>{if(m.status==="recognizing text")setImportProgress("OCR della foto in corso…",20+Math.round((m.progress||0)*75));}});const r=await worker.recognize(blob);text=r?.data?.text||"";await worker.terminate();ocrUsed=true;}catch{const r=await T.recognize(blob,"ita");text=r?.data?.text||"";ocrUsed=true;}warning="Testo riconosciuto dalla foto. Controlla attentamente i valori.";}catch(e){console.error(e);warning="Foto salvata, ma OCR non disponibile. Riprova quando l'app è connessa a internet.";}}
    const derived=profileSheets(meta,text);clearImportProgress();return {sheets:derived.sheets||[],rawText:text,warning,profileLabel:derived.profile?.label||meta.tipo,ocrUsed};
  }
  clearImportProgress();return {sheets:[],rawText:"",warning:"Formato non tabellare. Puoi incollare nel riquadro i dati estratti dal documento.",profileLabel:meta.tipo||"Documento",ocrUsed:false};
}
async function startDocumentExtraction(meta,blob){
  try{
    const parsed=await documentSheets(meta,blob),target=defaultExtractionTarget(meta.tipo),originalSheets=parsed.sheets||[];
    state.documentExtraction={docId:meta.id,docType:meta.tipo,filename:meta.filename,target,sheets:originalSheets,originalSheets,rawText:parsed.rawText||"",sheetIndex:0,warning:parsed.warning||"",profileLabel:parsed.profileLabel||meta.tipo,ocrUsed:!!parsed.ocrUsed,importedTargets:[]};
    state.documentExtraction.candidates=candidateTargets(state.documentExtraction);
    if(state.documentExtraction.candidates.length){const d=state.documentExtraction.candidates.find(x=>x.target===target)||state.documentExtraction.candidates[0];state.documentExtraction.target=d.target;state.documentExtraction.sheetIndex=d.sheetIndex;}
    prepareExtraction(state.documentExtraction);state.screen="documents";render();toast("Documento pronto per l'estrazione dei dati.");
  }catch(e){console.error(e);clearImportProgress();toast("Non è stato possibile analizzare il documento.");}
}
async function extractSavedDocument(id){const c=activeCompany(),meta=c?.documents?.find(x=>x.id===id);if(!meta)return;try{const blob=await getDocBlob(id);if(!blob){toast("File non trovato.");return}await startDocumentExtraction(meta,blob);}catch{toast("Impossibile leggere il documento.")}}
function parsePastedExtraction(){const txt=$("#pasteTableText")?.value||"";if(!txt.trim()){toast("Incolla prima una tabella o del testo.");return}const ex=state.documentExtraction;if(!ex)return;const rows=csvRows(txt);ex.rawText=txt;ex.originalSheets=rows.length&&Math.max(...rows.map(r=>r.length))>1?[{name:"Contenuto incollato",rows}]:[];ex.sheets=ex.originalSheets;ex.sheetIndex=0;ex.warning="Contenuto incollato: controllare la corrispondenza dei campi prima dell’importazione.";ex.candidates=candidateTargets(ex);prepareExtraction(ex);render();}
function parseNumberLocal(v){if(v===null||v===undefined)return "";let s=String(v).trim();if(!s)return "";s=s.replace(/\s/g,"");if(/^[-+]?\d{1,3}(\.\d{3})+,\d+$/.test(s))s=s.replace(/\./g,"").replace(",",".");else if(/^[-+]?\d+,\d+$/.test(s))s=s.replace(",",".");else if(/^[-+]?\d{1,3}(\.\d{3})+$/.test(s))s=s.replace(/\./g,"");const n=Number(s);return Number.isFinite(n)?n:String(v).trim();}
function normalizeDateImport(v){if(v===null||v===undefined||v==="")return "";if(typeof v==="number"||(typeof v==="string"&&/^\d+(\.\d+)?$/.test(v))){const n=Number(v);if(n>20000&&n<80000){const d=new Date(Date.UTC(1899,11,30)+Math.round(n)*86400000);return d.toISOString().slice(0,10)}}const s=String(v).trim();let m=s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);if(m){let y=Number(m[3]);if(y<100)y+=2000;return `${String(y).padStart(4,"0")}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;}m=s.match(/^(\d{4})[\/.-](\d{1,2})[\/.-](\d{1,2})$/);if(m)return `${m[1]}-${m[2].padStart(2,"0")}-${m[3].padStart(2,"0")}`;return s;}
function importValue(v,type){if(type==="number")return parseNumberLocal(v);if(type==="date")return normalizeDateImport(v);return String(v??"").trim();}
function collectExtractionMapping(){const map={};$$('[data-extract-map]').forEach(s=>{if(s.value!=="")map[s.dataset.extractMap]=Number(s.value)});return map;}
function importExtractedRows(){
  const c=activeCompany(),ex=state.documentExtraction;if(!c||!ex?.headers?.length){toast("Nessuna tabella pronta da importare.");return;}
  const defs=extractionDefs(ex.target),map=collectExtractionMapping();if(!Object.keys(map).length){toast("Seleziona almeno una colonna da importare.");return;}
  const docId=ex.docId,doc=(c.documents||[]).find(d=>d.id===docId),source={tipo:"Documento ufficiale",qualita:"Documento ufficiale",documentoId:docId};
  const rows=[];for(const row of ex.dataRows||[]){const obj={};let filled=0;for(const [key,label,type] of defs){if(map[key]===undefined)continue;const val=importValue(row[map[key]],type);obj[key]=val;if(val!=="")filled++;}if(filled)rows.push(obj);}if(!rows.length){toast("Nessuna riga utile rilevata.");return;}
  updateCompany(c.id,x=>{
    if(ex.target==="azienda"){
      const r=rows[0];x.general=x.general||{};for(const k of ["ragioneSociale","cuaa","comune","provincia","sauHa","satHa","superficieIrrigataHa","consistenzaCapi"])if(r[k]!==undefined&&r[k]!=="")x.general[k]=r[k];
    } else if(ex.target==="colture"){
      x.crops=x.crops||[];const groups={};rows.forEach(r=>{const y=String(r.anno||doc?.anno||new Date().getFullYear());(groups[y]=groups[y]||[]).push(r)});for(const [anno,rs] of Object.entries(groups)){x.crops.push({id:uid(),companyId:x.id,anno,source:{...source},rows:rs.map(r=>({id:uid(),coltura:r.coltura||"",superficie:r.superficie||"",prodotto:r.prodotto||"",note:r.note||"",irrigazione:r.irrigazione||"",irrigazioneM3Ha:r.irrigazioneM3Ha||"",resa:r.resa||"",azotofissatrice:r.azotofissatrice||"",nFissazioneKgHa:r.nFissazioneKgHa||""}))});}
    } else if(ex.target==="concimazioni"){
      x.fertilizationRecords=x.fertilizationRecords||[];rows.forEach(r=>x.fertilizationRecords.push({id:uid(),companyId:x.id,data:r.data||"",anno:r.anno||doc?.anno||"",coltura:r.coltura||"",superficieHa:r.superficieHa||"",tipoInput:r.tipoInput||"",prodotto:r.prodotto||"",quantita:r.quantita||"",unita:r.unita||"",nTotale:r.nTotale||"",tan:r.tan||"",p2o5:r.p2o5||"",pTotale:r.pTotale||"",tecnica:r.tecnica||"",incorporazioneOre:r.incorporazioneOre||"",source:{...source},note:r.note||""}));
    } else if(ex.target==="partite"){
      x.batches=x.batches||[];rows.forEach(r=>x.batches.push({id:uid(),companyId:x.id,codice:r.codice||`IMP-${String(x.batches.length+1).padStart(3,"0")}`,dataIngresso:r.dataIngresso||"",dataUscita:r.dataUscita||"",capiEntrati:r.capiEntrati||"",capiUsciti:r.capiUsciti||"",capiMorti:r.capiMorti||"",sesso:r.sesso||"",tipoGenetico:r.tipoGenetico||"",pesoIngresso:r.pesoIngresso||"",pesoUscita:r.pesoUscita||"",razioneId:"",source:{...source},note:r.note||""}));
    } else if(ex.target==="trattamenti"){
      x.cropTreatments=x.cropTreatments||[];rows.forEach(r=>x.cropTreatments.push({id:uid(),companyId:x.id,data:r.data||"",coltura:r.coltura||"",superficieHa:r.superficieHa||"",categoria:r.categoria||"",prodotto:r.prodotto||"",principioAttivo:r.principioAttivo||"",dose:r.dose||"",unitaDose:r.unitaDose||"",quantitaTotale:r.quantitaTotale||"",source:{...source},note:r.note||""}));
    } else if(ex.target==="irrigazione"){
      x.irrigationRecords=x.irrigationRecords||[];rows.forEach(r=>x.irrigationRecords.push({id:uid(),companyId:x.id,anno:r.anno||doc?.anno||"",coltura:r.coltura||"",superficieHa:r.superficieHa||"",volumeM3:r.volumeM3||"",m3Ha:r.m3Ha||"",fonteAcqua:r.fonteAcqua||"",sistema:r.sistema||"",metodoStima:r.metodoStima||"",elettricitaKWh:r.elettricitaKWh||"",gasolioL:r.gasolioL||"",source:{...source},note:r.note||""}));
    } else if(ex.target==="consistenza"){
      x.livestockInventoryRecords=x.livestockInventoryRecords||[];rows.forEach(r=>x.livestockInventoryRecords.push({id:uid(),companyId:x.id,anno:r.anno||doc?.anno||"",categoria:r.categoria||"",sistemaStabulazione:r.sistemaStabulazione||"",capi:r.capi||"",nProdottoKg:r.nProdottoKg||"",liquameM3:r.liquameM3||"",letameT:r.letameT||"",letameM3:r.letameM3||"",fosforoKg:r.fosforoKg||"",source:{...source},note:r.note||""}));
      const tot=rows.reduce((s,r)=>s+(Number(r.capi)||0),0);if(tot){x.general=x.general||{};x.general.consistenzaCapi=tot;}
    } else if(ex.target==="bilancio_n"){
      x.nitrogenBalanceRecords=x.nitrogenBalanceRecords||[];rows.forEach(r=>x.nitrogenBalanceRecords.push({id:uid(),companyId:x.id,anno:r.anno||doc?.anno||"",nProdottoKg:r.nProdottoKg||"",acquaAbbeveraggioM3:r.acquaAbbeveraggioM3||"",source:{...source},note:r.note||""}));
    } else if(ex.target==="reflui"){
      x.manureSystems=x.manureSystems||[];rows.forEach(r=>x.manureSystems.push({id:uid(),companyId:x.id,anno:r.anno||doc?.anno||"",stallaId:"",tipoRefluo:r.tipoRefluo||"",quotaPercentuale:r.quotaPercentuale||"",sistemaStabulazione:r.sistemaStabulazione||"",rimozione:r.rimozione||"",sistemaStoccaggio:r.sistemaStoccaggio||"",copertura:r.copertura||"",capacita:r.capacita||"",durataGiorni:r.durataGiorni||"",quantitaAnnua:r.quantitaAnnua||"",unita:r.unita||"",nTotale:r.nTotale||"",tanPercentN:r.tanPercentN||"",sostanzaSecca:r.sostanzaSecca||"",vs:r.vs||"",biogas:"",separazione:"",source:{...source},note:r.note||""}));
    } else if(ex.target==="energia"){
      x.energyRecords=x.energyRecords||[];rows.forEach(r=>x.energyRecords.push({id:uid(),companyId:x.id,anno:r.anno||doc?.anno||"",elettricitaKWh:r.elettricitaKWh||"",fotovoltaicoKWh:r.fotovoltaicoKWh||"",gasolioL:r.gasolioL||"",metanoM3:r.metanoM3||"",gplL:r.gplL||"",acquaM3:r.acquaM3||"",source:{...source},note:r.note||""}));
    } else if(ex.target==="analisi_reflui"){
      x.manureAnalyses=x.manureAnalyses||[];rows.forEach(r=>x.manureAnalyses.push({id:uid(),companyId:x.id,data:r.data||"",tipoRefluo:r.tipoRefluo||"",nTotale:r.nTotale||"",tan:r.tan||"",pTotale:r.pTotale||"",p2o5:r.p2o5||"",sostanzaSecca:r.sostanzaSecca||"",vs:r.vs||"",unita:r.unita||"",laboratorio:r.laboratorio||"",source:{...source},note:r.note||""}));
    } else if(ex.target==="analisi_alimenti"){
      x.feedAnalyses=x.feedAnalyses||[];rows.forEach(r=>x.feedAnalyses.push({id:uid(),companyId:x.id,data:r.data||"",alimento:r.alimento||"",sostanzaSecca:r.sostanzaSecca||"",proteinaGrezza:r.proteinaGrezza||"",nTotale:r.nTotale||"",ndf:r.ndf||"",ceneri:r.ceneri||"",energiaLorda:r.energiaLorda||"",digeribilita:r.digeribilita||"",laboratorio:r.laboratorio||"",source:{...source},note:r.note||""}));
    }
    const dm=(x.documents||[]).find(d=>d.id===docId);if(dm){dm.importedCount=(dm.importedCount||0)+rows.length;dm.importedTargets=Array.from(new Set([...(dm.importedTargets||[]),ex.target]));dm.lastExtractionTarget=ex.target;dm.lastExtractionAt=new Date().toISOString();}
  });
  ex.importedTargets=Array.from(new Set([...(ex.importedTargets||[]),ex.target]));toast(`${rows.length} record importati. Puoi ricavare altre sezioni dallo stesso documento.`);render();
}

function displayValue(v){
  if(v===null||v===undefined||v==="")return "—";
  if(v===true)return "Sì"; if(v===false)return "No";
  return String(v);
}
function reviewTable(headers,rows,empty="Nessun dato inserito"){
  if(!rows?.length)return `<div class="empty-state">${esc(empty)}</div>`;
  return `<div class="review-table-wrap"><table class="review-table"><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(v=>`<td>${esc(displayValue(v))}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}
function reviewKV(obj,labels){
  const rows=labels.map(([k,l])=>[l,deepGet(obj,k)]).filter(r=>r[1]!==""&&r[1]!==null&&r[1]!==undefined);
  return reviewTable(["Campo","Valore"],rows,"Nessun dato compilato in questa sezione");
}
function linkedDocName(c,id){const d=(c.documents||[]).find(x=>x.id===id);return d?(d.filename||d.descrizione||d.tipo):"";}
function linkedRationName(c,id){const r=(c.rations||[]).find(x=>x.id===id);return r?r.titolo||"Razione":"";}
function linkedStableName(c,id){const r=(c.stables||[]).find(x=>x.id===id);return r?r.nome||"Stalla":"";}
function sourceCols(c,s){return [s?.tipo||"",s?.qualita||"",linkedDocName(c,s?.documentoId)];}
function reviewSection(title,count,body,open=false){
  return `<details class="review-section" ${open?"open":""}><summary><div><strong>${esc(title)}</strong><span>${count} ${count===1?"record":"record"}</span></div><span class="review-chevron">⌄</span></summary><div class="review-section-body">${body}</div></details>`;
}
function renderReview(){
  const c=activeCompany();
  if(!c){main.innerHTML=header("Dati inseriti","Seleziona o crea prima un’azienda")+`<div class="empty-state">Nessuna azienda disponibile.<br><br><button class="btn btn-primary" data-nav="company">Crea azienda</button></div>`;return;}
  const batches=(c.batches||[]).map(b=>{const z=calcBatch(b);return [b.codice,b.dataIngresso,b.dataUscita,b.capiEntrati,b.capiUsciti,b.capiMorti,b.sesso,b.tipoGenetico,b.pesoIngresso,b.pesoUscita,z.days,z.adg!=null?z.adg.toFixed(3):"",linkedRationName(c,b.razioneId),...sourceCols(c,b.source),b.note]});
  const stables=(c.stables||[]).map(x=>[x.nome,x.ristallo,x.struttura?.apertaChiusa,x.struttura?.dimensioni,x.struttura?.altezza,x.struttura?.orientamento,x.struttura?.infermeria,x.struttura?.tipoCopertura,x.struttura?.ventilazioneForzata,x.condizioni?.pulizia,x.condizioni?.deterioramento]);
  const boxes=(c.boxes||[]).map(x=>[x.nome,linkedStableName(c,x.stableId),x.caratteristiche?.nBox,x.caratteristiche?.capiPerBox,x.caratteristiche?.tipoGenetico,x.caratteristiche?.sesso,x.caratteristiche?.pavimento,x.caratteristiche?.lettiera,x.caratteristiche?.nAbbeveratoi,x.condizioni?.puliziaBox,x.condizioni?.puliziaAnimali]);
  const rations=[];(c.rations||[]).forEach(r=>(r.rows||[]).forEach((x,i)=>rations.push([r.dataRilievo,r.titolo,r.tipoGeneticoSesso,i+1,x.materiaPrima,x.kgCapoGiorno,x.approvvigionamento,x.origine])));
  const manure=(c.manureSystems||[]).map(x=>[x.anno,linkedStableName(c,x.stallaId),x.tipoRefluo,x.quotaPercentuale,x.sistemaStabulazione,x.rimozione,x.sistemaStoccaggio,x.copertura,x.durataGiorni,x.quantitaAnnua,x.unita,x.nTotale,x.tanPercentN,x.sostanzaSecca,x.vs,x.biogas,x.separazione,...sourceCols(c,x.source),x.note]);
  const fertilization=(c.fertilizationRecords||[]).map(x=>[x.data,x.anno,x.coltura,x.superficieHa,x.tipoInput,x.prodotto,x.quantita,x.unita,x.nTotale,x.tan,x.p2o5,x.pTotale,x.tecnica,x.incorporazioneOre,...sourceCols(c,x.source),x.note]);
  const crops=[];(c.crops||[]).forEach(p=>(p.rows||[]).forEach((x,i)=>crops.push([p.anno,i+1,x.coltura,x.superficie,x.prodotto,x.irrigazione,x.irrigazioneM3Ha,x.resa,x.azotofissatrice,x.nFissazioneKgHa,x.note])));
  const treatments=(c.cropTreatments||[]).map(x=>[x.data,x.coltura,x.superficieHa,x.categoria,x.prodotto,x.principioAttivo,x.dose,x.unitaDose,x.quantitaTotale,...sourceCols(c,x.source),x.note]);
  const irrigation=(c.irrigationRecords||[]).map(x=>[x.anno,x.coltura,x.superficieHa,x.volumeM3,x.m3Ha,x.fonteAcqua,x.sistema,x.metodoStima,x.elettricitaKWh,x.gasolioL,...sourceCols(c,x.source),x.note]);
  const energy=(c.energyRecords||[]).map(x=>[x.anno,x.elettricitaKWh,x.fotovoltaicoKWh,x.gasolioL,x.metanoM3,x.gplL,x.acquaM3,...sourceCols(c,x.source),x.note]);
  const manureAnalyses=(c.manureAnalyses||[]).map(x=>[x.data,x.tipoRefluo,x.nTotale,x.tan,x.pTotale,x.p2o5,x.sostanzaSecca,x.vs,x.unita,x.laboratorio,...sourceCols(c,x.source),x.note]);
  const livestockInv=(c.livestockInventoryRecords||[]).map(x=>[x.anno,x.categoria,x.sistemaStabulazione,x.capi,x.nProdottoKg,x.liquameM3,x.letameT,x.letameM3,x.fosforoKg,...sourceCols(c,x.source),x.note]);
  const nitrogenBal=(c.nitrogenBalanceRecords||[]).map(x=>[x.anno,x.nProdottoKg,x.acquaAbbeveraggioM3,...sourceCols(c,x.source),x.note]);
  const feedAnalyses=(c.feedAnalyses||[]).map(x=>[x.data,x.alimento,x.sostanzaSecca,x.proteinaGrezza,x.nTotale,x.ndf,x.ceneri,x.energiaLorda,x.digeribilita,x.laboratorio,...sourceCols(c,x.source),x.note]);
  const biogas=[];(c.biogasRations||[]).forEach(r=>(r.rows||[]).forEach((x,i)=>biogas.push([r.dataRilievo,i+1,x.materiaPrima,x.kgGiorno,x.autoprodotto,x.origine])));
  const docs=(c.documents||[]).map(x=>[x.tipo,x.anno,x.filename,x.descrizione,x.note,x.addedAt?new Date(x.addedAt).toLocaleString("it-IT"):""]);
  const aziendaLabels=[
    ["general.dataRilievo","Data rilievo"],["general.ragioneSociale","Ragione sociale"],["general.cuaa","CUAA / codice fiscale"],["general.tipo","Tipo azienda"],["general.comune","Comune"],["general.provincia","Provincia"],["general.sauHa","SAU (ha)"],["general.satHa","SAT (ha)"],["general.superficieIrrigataHa","Superficie irrigata (ha)"],["general.consistenzaCapi","Consistenza bovini (capi)"],
    ["personale.addettiFamiliari","Addetti familiari"],["personale.ruoliFamiliari","Ruoli familiari"],["personale.istruzioneFamiliari","Istruzione familiari"],["personale.formazioneFamiliari","Formazione familiari"],["personale.argomentiFamiliari","Argomenti formazione familiari"],
    ["personale.addettiSalariati","Addetti salariati"],["personale.ruoliSalariati","Ruoli salariati"],["personale.istruzioneSalariati","Istruzione salariati"],["personale.formazioneSalariati","Formazione salariati"],["personale.argomentiSalariati","Argomenti formazione salariati"],
    ["personale.veterinario","Veterinario"],["personale.armadietto","Armadietto medicinali"],["personale.alimentarista","Alimentarista"],
    ["strutture.nStalle","Numero stalle"],["strutture.stallaCondizionamento","Stalla di condizionamento"],["strutture.concimaiaCoperta","Concimaia coperta"],["strutture.vascaCoperta","Vasca coperta"],["strutture.materialeLettiera","Materiale lettiera"],["strutture.qLettiera","Quantità lettiera (q/anno)"],["strutture.conformitaElettrico","Conformità impianto elettrico"],["strutture.approvvigionamentoIdrico","Approvvigionamento idrico"],["strutture.analisiAcqua","Analisi acqua"]
  ];
  const managementLabels=[
    ["carroModelloMarca","Carro miscelatore: modello/marca"],["carroSemoventeTrainato","Carro semovente/trainato"],["carroVerticaleOrizzontale","Carro verticale/orizzontale"],["controlloMoscheRoditori","Controllo mosche/roditori"],["freqAsportazioneDeiezioni","Frequenza asportazione deiezioni"],["freqPuliziaMangiatoia","Frequenza pulizia mangiatoia"],["ispezioneGiornaliera","Ispezione giornaliera"],["rimozioneRefluoVasca","Rimozione refluo vasca"],["trinciapaglia","Trinciapaglia"],["biogas","Biogas"],["produzioneBiogasKW","Produzione biogas (kW)"],["usoTuttoLetame","Tutto il letame a biogas"],["usoTuttoLiquame","Tutto il liquame a biogas"],["fotovoltaico","Fotovoltaico"],["produzioneFotovoltaicoKW","Produzione fotovoltaico (kW)"],["consumiElettricita","Consumi elettricità"],["consumiGasolio","Consumi gasolio"]
  ];
  main.innerHTML=header("Dati inseriti",`Azienda: ${esc(c.general.ragioneSociale)}`,"Riepilogo azienda")+
    `<div class="context-bar"><div class="context-copy"><strong>Azienda visualizzata</strong><span>Il riepilogo riguarda una sola azienda alla volta</span></div>${activeSelect()}<span class="badge">ID: ${esc(companyExcelId(c))}</span><div class="actions-right"><button class="btn btn-primary" data-action="export-xlsx">Esporta Excel azienda</button></div></div>`+
    `<div class="review-intro"><div><span>Ultimo aggiornamento</span><strong>${c.updatedAt?new Date(c.updatedAt).toLocaleString("it-IT"):"—"}</strong></div><div><span>Partite</span><strong>${batches.length}</strong></div><div><span>Stalle</span><strong>${stables.length}</strong></div><div><span>Documenti</span><strong>${docs.length}</strong></div></div>`+
    reviewSection("Azienda e personale",1,reviewKV(c,aziendaLabels),true)+
    reviewSection("Management",1,reviewKV(c.management||{},managementLabels),true)+
    reviewSection("Consistenza zootecnica da documenti",livestockInv.length,reviewTable(["Anno","Categoria","Stabulazione","Capi","N prodotto kg","Liquame m3","Letame t","Letame m3","P kg","Fonte","Qualità","Documento","Note"],livestockInv))+
    reviewSection("Bilancio N / dati PUA",nitrogenBal.length,reviewTable(["Anno","N prodotto kg","Acqua abbeveraggio m3/anno","Fonte","Qualità","Documento","Note"],nitrogenBal))+
    reviewSection("Partite animali",batches.length,reviewTable(["Codice","Ingresso","Uscita","Capi entrati","Capi usciti","Morti","Sesso","Genetica","Peso ingresso kg","Peso uscita kg","Giorni","ADG kg/d","Razione","Fonte","Qualità","Documento","Note"],batches))+
    reviewSection("Stalle",stables.length,reviewTable(["Nome","Ristallo","Aperta/chiusa","Dimensioni","Altezza","Orientamento","Infermeria","Copertura","Vent. forzata","Pulizia","Deterioramento"],stables))+
    reviewSection("Gruppi di box",boxes.length,reviewTable(["Gruppo","Stalla","N. box","Capi/box","Genetica","Sesso","Pavimento","Lettiera","Abbeveratoi","Pulizia box","Pulizia animali"],boxes))+
    reviewSection("Razioni animali",rations.length,reviewTable(["Data","Razione","Tipo genetico/sesso","Riga","Materia prima","kg/capo/giorno","Approvvigionamento","Origine"],rations))+
    reviewSection("Reflui e stoccaggi",manure.length,reviewTable(["Anno","Stalla","Refluo","Quota %","Stabulazione","Rimozione","Stoccaggio","Copertura","Giorni","Quantità","Unità","N totale","TAN %N","SS %","VS %","Biogas","Separazione","Fonte","Qualità","Documento","Note"],manure))+
    reviewSection("Concimazioni da registri",fertilization.length,reviewTable(["Data","Anno","Coltura","ha","Tipo input","Prodotto","Quantità","Unità","N totale","TAN","P2O5","P totale","Tecnica","Interramento h","Fonte","Qualità","Documento","Note"],fertilization))+
    reviewSection("Piano colturale",crops.length,reviewTable(["Anno","Riga","Coltura","ha","Prodotto","Irrigazione","m3/ha","Resa","Azotofissatrice","N fissato kg/ha","Note"],crops))+
    reviewSection("Trattamenti colturali",treatments.length,reviewTable(["Data","Coltura","ha","Categoria","Prodotto","Principio attivo","Dose","Unità dose","Quantità totale","Fonte","Qualità","Documento","Note"],treatments))+
    reviewSection("Irrigazione",irrigation.length,reviewTable(["Anno","Coltura","ha","Volume m3","m3/ha","Fonte acqua","Sistema","Metodo dato","kWh","Gasolio L","Fonte","Qualità","Documento","Note"],irrigation))+
    reviewSection("Energia, combustibili e acqua",energy.length,reviewTable(["Anno","Elettricità kWh","Fotovoltaico kWh","Gasolio L","Metano m3","GPL L","Acqua m3","Fonte","Qualità","Documento","Note"],energy))+
    reviewSection("Analisi reflui",manureAnalyses.length,reviewTable(["Data","Refluo","N totale","TAN","P totale","P2O5","SS %","VS %","Unità","Laboratorio","Fonte","Qualità","Documento","Note"],manureAnalyses))+
    reviewSection("Analisi alimenti",feedAnalyses.length,reviewTable(["Data","Alimento","SS %","PG %","N %","NDF %","Ceneri %","GE MJ/kg","Digeribilità %","Laboratorio","Fonte","Qualità","Documento","Note"],feedAnalyses))+
    reviewSection("Razione biogas",biogas.length,reviewTable(["Data","Riga","Materia prima","kg/giorno","Autoprodotto","Origine"],biogas))+
    reviewSection("Documenti aziendali",docs.length,reviewTable(["Tipo","Anno","File","Descrizione","Note","Aggiunto il"],docs));
}

function currentDraft(){
  if(state.screen==="company"||state.screen==="companyManagement")return state.draft;
  if(state.screen==="stable")return state.stableDraft;
  if(state.screen==="box")return state.boxDraft;
  if(state.screen==="ration")return state.rationDraft;
  if(state.screen==="crops")return state.cropsDraft;
  if(state.screen==="biogas")return state.biogasDraft;
  if(state.screen==="batch")return state.batchDraft;
  if(state.screen==="manure")return state.manureDraft;
  if(state.screen==="spreading")return state.spreadingDraft;
  if(state.screen==="agro")return state.agroDraft;
  if(state.screen==="documents")return state.documentDraft;
  return null;
}
function bindChange(el){
  const path=el.dataset.bind;if(!path)return;
  const draft=currentDraft();if(!draft)return;
  if(el.type==="radio"&&!el.checked)return;
  deepSet(draft,path,el.value);
}
function saveCompany(){
  const c=state.draft;
  if(!c.general.ragioneSociale.trim()){toast("Inserisci la Ragione sociale prima di salvare.");return}
  upsertCompany(c); toast("Azienda salvata.");
  state.draft=null; state.screen="stable"; state.stableDraft=newStableDraft(); render();
}
function saveStable(goBox=false){
  const c=activeCompany(), s=state.stableDraft;
  if(!c)return;
  if(!s.nome.trim()){toast("Inserisci il nome della stalla.");return}
  s.companyId=c.id;
  updateCompany(c.id,x=>{x.stables=x.stables||[];x.stables.push(JSON.parse(JSON.stringify(s)))});
  toast("Stalla salvata.");
  if(goBox){ state.screen="box";state.boxDraft=newBoxDraft();state.boxDraft.stableId=s.id;render(); }
  else{ state.stableDraft=newStableDraft(); render(); }
}
function saveBox(){
  const c=activeCompany(), b=state.boxDraft;if(!c)return;
  if(!b.stableId){toast("Seleziona la stalla.");return}
  if(!b.nome.trim()){toast("Inserisci l’ID / nome del gruppo box.");return}
  b.companyId=c.id;
  updateCompany(c.id,x=>{x.boxes=x.boxes||[];x.boxes.push(JSON.parse(JSON.stringify(b)))});
  toast("Gruppo box salvato."); state.boxDraft=newBoxDraft(); render();
}
function saveRation(){
  const c=activeCompany(), r=state.rationDraft;if(!c)return;
  if(!r.dataRilievo||!r.titolo.trim()||!r.tipoGeneticoSesso.trim()){toast("Compila Data rilievo, Nome/tipo razione e Tipo genetico/sesso.");return}
  const clean={...r,companyId:c.id,rows:r.rows.filter(x=>x.materiaPrima.trim())};
  if(!clean.rows.length){toast("Inserisci almeno una materia prima.");return}
  updateCompany(c.id,x=>{x.rations=x.rations||[];x.rations.push(JSON.parse(JSON.stringify(clean)))});
  toast("Razione salvata."); state.rationDraft=newRationDraft(); render();
}
function saveCrops(){
  const c=activeCompany(), x=state.cropsDraft;if(!c)return;
  const rows=x.rows.filter(r=>r.coltura.trim());
  if(!x.anno||!rows.length){toast("Compila Anno campagna e almeno una coltura.");return}
  updateCompany(c.id,cx=>{cx.crops=cx.crops||[];cx.crops.push({...JSON.parse(JSON.stringify(x)),rows})});
  toast("Piano colturale salvato."); state.cropsDraft=newCropsDraft(); render();
}
function saveBiogas(){
  const c=activeCompany(), x=state.biogasDraft;if(!c)return;
  const rows=x.rows.filter(r=>r.materiaPrima.trim());
  if(!x.dataRilievo||!rows.length){toast("Compila Data rilievo e almeno una materia prima.");return}
  updateCompany(c.id,cx=>{cx.biogasRations=cx.biogasRations||[];cx.biogasRations.push({...JSON.parse(JSON.stringify(x)),rows})});
  toast("Razione biogas salvata."); state.biogasDraft=newBiogasDraft(); render();
}


function saveBatch(){const c=activeCompany(),b=state.batchDraft;if(!c)return;if(!b.codice.trim()){toast("Inserisci un codice partita.");return}b.companyId=c.id;updateCompany(c.id,x=>{x.batches=x.batches||[];x.batches.push(JSON.parse(JSON.stringify(b)))});toast("Partita salvata.");state.batchDraft=newBatchDraft();render();}
function saveManure(){const c=activeCompany(),m=state.manureDraft;if(!c)return;if(!m.tipoRefluo||!m.sistemaStoccaggio.trim()){toast("Indica almeno tipo di refluo e sistema di stoccaggio.");return}m.companyId=c.id;updateCompany(c.id,x=>{x.manureSystems=x.manureSystems||[];x.manureSystems.push(JSON.parse(JSON.stringify(m)))});toast("Percorso refluo salvato.");state.manureDraft=newManureDraft();render();}
function saveSpreading(){const c=activeCompany(),s=state.spreadingDraft;if(!c)return;if(!s.coltura.trim()||!s.tipoInput){toast("Indica almeno coltura e tipo di input.");return}s.companyId=c.id;updateCompany(c.id,x=>{x.spreadingEvents=x.spreadingEvents||[];x.spreadingEvents.push(JSON.parse(JSON.stringify(s)))});toast("Applicazione salvata.");state.spreadingDraft=newSpreadingDraft();render();}
function saveAgro(){const c=activeCompany(),a=state.agroDraft;if(!c)return;if(a.mode==="trattamento"){const t=a.treatment;if(!t.coltura.trim()||!t.prodotto.trim()){toast("Indica coltura e prodotto.");return}updateCompany(c.id,x=>{x.cropTreatments=x.cropTreatments||[];x.cropTreatments.push(JSON.parse(JSON.stringify(t)))})}else{const i=a.irrigation;if(!i.coltura.trim()||(!i.volumeM3&&!i.m3Ha)){toast("Indica coltura e volume irriguo.");return}updateCompany(c.id,x=>{x.irrigationRecords=x.irrigationRecords||[];x.irrigationRecords.push(JSON.parse(JSON.stringify(i)))})}toast("Dato colturale salvato.");state.agroDraft=newAgroDraft();state.agroDraft.mode=a.mode;render();}
async function saveDocument(analyze=false){const c=activeCompany(),d=state.documentDraft;if(!c)return;const f=$("#documentFile")?.files?.[0];if(!f){toast("Seleziona un file da allegare.");return}d.companyId=c.id;d.filename=f.name;d.mime=f.type;d.size=f.size;d.addedAt=new Date().toISOString();try{await putDocBlob(d.id,f);updateCompany(c.id,x=>{x.documents=x.documents||[];x.documents.push(JSON.parse(JSON.stringify(d)))});const meta={...d};state.documentDraft=newDocumentDraft();if(analyze){await startDocumentExtraction(meta,f)}else{toast("Documento salvato.");render()}}catch(e){console.error(e);toast("Impossibile salvare il documento.")}}
async function downloadDocument(id){try{const blob=await getDocBlob(id);if(!blob){toast("File non trovato nel dispositivo.");return}const c=activeCompany();const meta=c?.documents?.find(d=>d.id===id);const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=meta?.filename||"documento";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),600)}catch{toast("Impossibile aprire il documento.")}}
async function removeDocument(id){const c=activeCompany();if(!c||!confirm("Eliminare questo documento dal dispositivo?"))return;try{await deleteDocBlob(id)}catch{}updateCompany(c.id,x=>{x.documents=(x.documents||[]).filter(d=>d.id!==id)});toast("Documento eliminato.");render();}

async function compressImage(file){
  const data=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file)});
  const img=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=data});
  const max=1280, scale=Math.min(1,max/Math.max(img.width,img.height));
  const canvas=document.createElement("canvas"); canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);
  canvas.getContext("2d").drawImage(img,0,0,canvas.width,canvas.height);
  return canvas.toDataURL("image/jpeg",.76);
}
function download(name,content,type){
  const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement("a");
  a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500);
}
function exportJSON(){download("backup_raccolta_LCA.json",JSON.stringify(db(),null,2),"application/json");}
function flatten(o,p="",rows=[]){
  if(Array.isArray(o)){o.forEach((v,i)=>flatten(v,p?`${p}.${i}`:String(i),rows));return rows}
  if(o&&typeof o==="object"){Object.entries(o).forEach(([k,v])=>flatten(v,p?`${p}.${k}`:k,rows));return rows}
  rows.push([p,o??""]);return rows;
}

function excelNum(v){
  if(v===null||v===undefined||v==="")return "";
  const n=Number(String(v).replace(",","."));return Number.isFinite(n)?n:v;
}
function excelScalar(v){
  if(v===null||v===undefined)return "";
  if(typeof v==="number")return Number.isFinite(v)?v:"";
  if(typeof v==="boolean")return v?"Sì":"No";
  return excelNum(v);
}
function excelIdToken(v){
  return String(v||"AZIENDA")
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .toUpperCase().replace(/[^A-Z0-9]+/g,"_")
    .replace(/^_+|_+$/g,"").slice(0,48)||"AZIENDA";
}
function companyExcelId(c){
  return excelIdToken(c?.general?.ragioneSociale||"AZIENDA");
}
function recordExcelId(prefix,index,subIndex=null){
  const n=String(index+1).padStart(3,"0");
  if(subIndex===null||subIndex===undefined)return `${prefix}-${n}`;
  return `${prefix}-${n}-${String(subIndex+1).padStart(2,"0")}`;
}
function sheetSingleRecord(companyName, companyId, defs, obj, recordId){
  const headers=["ID azienda","Azienda","ID record",...defs.map(d=>d[1])];
  const values=[companyId,companyName,recordId,...defs.map(d=>{
    const getter=typeof d[2]==="function"?d[2]:(x=>deepGet(x,d[0]));
    return excelScalar(getter(obj));
  })];
  return [headers,values];
}
function sheetRecords(companyName,companyId,defs,records,idFn){
  const headers=["ID azienda","Azienda","ID record",...defs.map(d=>d[1])];
  const rows=[headers];
  (records||[]).forEach((r,i)=>{
    const rid=typeof idFn==="function"?idFn(r,i):recordExcelId("REC",i);
    const vals=defs.map(d=>{
      const getter=typeof d[2]==="function"?d[2]:(x=>deepGet(x,d[0]));
      return excelScalar(getter(r));
    });
    rows.push([companyId,companyName,rid,...vals]);
  });
  return rows;
}
function companyExcelSheets(c){
  const companyName=c.general?.ragioneSociale||"Azienda senza nome", companyId=companyExcelId(c);
  const docName=id=>linkedDocName(c,id), rationName=id=>linkedRationName(c,id), stableName=id=>linkedStableName(c,id);
  const sourceValue=(s,key)=>key==="documento"?docName(s?.documentoId):(s?.[key]||"");
  const sheets=[];

  sheets.push({name:"Riepilogo",rows:[[
    "ID azienda","Azienda","ID record","Comune","Provincia","Data rilievo","Ultimo aggiornamento","N. partite","N. stalle","N. gruppi box","N. razioni animali","N. percorsi reflui","N. piani colturali","N. trattamenti","N. irrigazioni","N. consumi energia/acqua","N. analisi reflui","N. analisi alimenti","N. consistenze zootecniche","N. bilanci N","N. documenti"
  ],[
    companyId,companyName,"RIE-001",c.general?.comune||"",c.general?.provincia||"",c.general?.dataRilievo||"",c.updatedAt||"",
    (c.batches||[]).length,(c.stables||[]).length,(c.boxes||[]).length,(c.rations||[]).length,(c.manureSystems||[]).length,(c.crops||[]).length,(c.cropTreatments||[]).length,(c.irrigationRecords||[]).length,(c.energyRecords||[]).length,(c.manureAnalyses||[]).length,(c.feedAnalyses||[]).length,(c.livestockInventoryRecords||[]).length,(c.nitrogenBalanceRecords||[]).length,(c.documents||[]).length
  ]]});

  const aziendaDefs=[
    ["general.dataRilievo","Data rilievo"],["general.ragioneSociale","Ragione sociale"],["general.cuaa","CUAA / codice fiscale"],["general.tipo","Tipo azienda"],["general.comune","Comune"],["general.provincia","Provincia"],["general.sauHa","SAU (ha)"],["general.satHa","SAT (ha)"],["general.superficieIrrigataHa","Superficie irrigata (ha)"],["general.consistenzaCapi","Consistenza bovini (capi)"],
    ["personale.addettiFamiliari","Addetti familiari"],["personale.ruoliFamiliari","Ruoli familiari"],["personale.istruzioneFamiliari","Istruzione familiari"],["personale.formazioneFamiliari","Formazione familiari"],["personale.argomentiFamiliari","Argomenti formazione familiari"],
    ["personale.addettiSalariati","Addetti salariati"],["personale.ruoliSalariati","Ruoli salariati"],["personale.istruzioneSalariati","Istruzione salariati"],["personale.formazioneSalariati","Formazione salariati"],["personale.argomentiSalariati","Argomenti formazione salariati"],["personale.veterinario","Veterinario"],["personale.armadietto","Armadietto medicinali"],["personale.alimentarista","Alimentarista"],
    ["strutture.nStalle","Numero stalle"],["strutture.stallaCondizionamento","Stalla di condizionamento"],["strutture.concimaiaCoperta","Concimaia coperta"],["strutture.vascaCoperta","Vasca coperta"],["strutture.materialeLettiera","Materiale lettiera"],["strutture.qLettiera","Quantità lettiera (q/anno)"],["strutture.conformitaElettrico","Conformità impianto elettrico"],["strutture.approvvigionamentoIdrico","Approvvigionamento idrico"],["strutture.analisiAcqua","Analisi acqua"]
  ];
  sheets.push({name:"Azienda",rows:sheetSingleRecord(companyName,companyId,aziendaDefs,c,"AZI-001")});

  const managementDefs=[["carroModelloMarca","Carro miscelatore: modello/marca"],["carroSemoventeTrainato","Carro semovente/trainato"],["carroVerticaleOrizzontale","Carro verticale/orizzontale"],["controlloMoscheRoditori","Controllo mosche e roditori"],["freqAsportazioneDeiezioni","Frequenza asportazione deiezioni"],["freqPuliziaMangiatoia","Frequenza pulizia mangiatoia"],["ispezioneGiornaliera","Ispezione giornaliera"],["rimozioneRefluoVasca","Rimozione refluo vasca"],["trinciapaglia","Trinciapaglia"],["biogas","Biogas"],["produzioneBiogasKW","Produzione biogas (kW)"],["usoTuttoLetame","Uso tutto letame nel biogas"],["usoTuttoLiquame","Uso tutto liquame nel biogas"],["fotovoltaico","Fotovoltaico"],["produzioneFotovoltaicoKW","Produzione fotovoltaico (kW)"],["consumiElettricita","Consumi elettricità (kWh/anno)"],["consumiGasolio","Consumi gasolio (L/anno)"]];
  sheets.push({name:"Management",rows:sheetSingleRecord(companyName,companyId,managementDefs,c.management||{},"MGT-001")});

  const livestockDefs=[["anno","Anno"],["categoria","Categoria animale"],["sistemaStabulazione","Sistema di stabulazione"],["capi","Capi"],["nProdottoKg","N prodotto (kg)"],["liquameM3","Liquame (m3)"],["letameT","Letame / materiale palabile (t)"],["letameM3","Letame / materiale palabile (m3)"],["fosforoKg","Fosforo (kg)"],["_src","Fonte dato",x=>sourceValue(x.source,"tipo")],["_qual","Qualità dato",x=>sourceValue(x.source,"qualita")],["_doc","Documento",x=>sourceValue(x.source,"documento")],["note","Note"]];
  sheets.push({name:"Consistenza zootecnica",rows:sheetRecords(companyName,companyId,livestockDefs,c.livestockInventoryRecords||[],(x,i)=>recordExcelId("ZOO",i))});
  const nbalDefs=[["anno","Anno"],["nProdottoKg","N prodotto in azienda (kg N)"],["acquaAbbeveraggioM3","Acqua abbeveraggio (m3/anno)"],["_src","Fonte dato",x=>sourceValue(x.source,"tipo")],["_qual","Qualità dato",x=>sourceValue(x.source,"qualita")],["_doc","Documento",x=>sourceValue(x.source,"documento")],["note","Note"]];
  sheets.push({name:"Bilancio N input",rows:sheetRecords(companyName,companyId,nbalDefs,c.nitrogenBalanceRecords||[],(x,i)=>recordExcelId("NBL",i))});

  const batchDefs=[
    ["codice","Codice partita"],["dataIngresso","Data ingresso"],["dataUscita","Data uscita"],["capiEntrati","Capi entrati"],["capiUsciti","Capi usciti"],["capiMorti","Capi morti"],["sesso","Sesso"],["tipoGenetico","Tipo genetico / razza"],["pesoIngresso","Peso medio ingresso (kg)"],["pesoUscita","Peso medio uscita (kg)"],
    ["_days","Permanenza (giorni)",b=>calcBatch(b).days??""],["_gain","Accrescimento totale medio (kg/capo)",b=>calcBatch(b).gain??""],["_adg","ADG (kg/capo/giorno)",b=>calcBatch(b).adg!=null?Number(calcBatch(b).adg.toFixed(5)):""],
    ["_ration","Razione associata",b=>rationName(b.razioneId)],["_src","Fonte dato",b=>sourceValue(b.source,"tipo")],["_qual","Qualità dato",b=>sourceValue(b.source,"qualita")],["_doc","Documento",b=>sourceValue(b.source,"documento")],["note","Note"]
  ];
  sheets.push({name:"Partite",rows:sheetRecords(companyName,companyId,batchDefs,c.batches||[],(b,i)=>recordExcelId("PAR",i))});

  const stableDefs=[
    ["nome","Nome stalla"],["ristallo","Ristallo"],["struttura.apertaChiusa","Aperta / chiusa"],["struttura.dimensioni","Dimensioni"],["struttura.altezza","Altezza (m)"],["struttura.orientamento","Orientamento"],["struttura.corsia","Corsia (m)"],["struttura.infermeria","Infermeria"],["struttura.dimensionamentoInfermeria","Dimensionamento infermeria"],["struttura.nBoxInfermeria","N. box infermeria"],["struttura.tipoStabulazioneInfermeria","Stabulazione infermeria"],["struttura.faldeTetto","Falde tetto"],["struttura.tipoCopertura","Tipo copertura"],["struttura.isolamentoTermico","Isolamento termico"],["struttura.spessoreIsolante","Spessore isolante (cm)"],["struttura.cupolino","Cupolino"],["struttura.ombreggiamento","Ombreggiamento"],["struttura.paddock","Paddock"],["struttura.fonteIdrica","Fonte idrica"],["struttura.riscaldamentoAcqua","Riscaldamento acqua"],["struttura.trattamentiAcqua","Trattamenti acqua"],["struttura.nLuci","N. luci"],["struttura.tipoLuci","Tipo luci"],["struttura.correnteAriaFredda","Corrente aria fredda"],["struttura.ventilazioneForzata","Ventilazione forzata"],["struttura.regolazioneVentilazione","Regolazione ventilazione"],["struttura.modalitaControllo","Controllo ventilazione"],["struttura.nVentilatori","N. ventilatori"],["struttura.tipoVentilatori","Tipo ventilatori"],["condizioni.pulizia","Pulizia"],["condizioni.deterioramento","Deterioramento"],["condizioni.attrezzature","Attrezzature"],["condizioni.polveroso","Ambiente polveroso"],["condizioni.odori","Cattivi odori"]
  ];
  sheets.push({name:"Stalle",rows:sheetRecords(companyName,companyId,stableDefs,c.stables||[],(x,i)=>recordExcelId("STA",i))});

  const boxDefs=[["nome","Gruppo box"],["_stable","Stalla",x=>stableName(x.stableId)],["_stableId","ID stalla",x=>{const i=(c.stables||[]).findIndex(s=>s.id===x.stableId);return i>=0?recordExcelId("STA",i):""}],["caratteristiche.nBox","N. box"],["caratteristiche.dimensioni","Dimensioni"],["caratteristiche.capiPerBox","Capi / box"],["caratteristiche.tipoGenetico","Tipo genetico"],["caratteristiche.sesso","Sesso"],["caratteristiche.boxPaddock","Box con paddock"],["caratteristiche.dimPaddock","Dimensioni paddock"],["caratteristiche.coperturaPaddock","Copertura paddock (%)"],["caratteristiche.corridoio","Corridoio"],["caratteristiche.pavimento","Pavimento"],["caratteristiche.lettiera","Lettiera"],["caratteristiche.mangiatoia","Mangiatoia"],["caratteristiche.irraggiamento","Irraggiamento diretto"],["caratteristiche.vieFuga","Vie di fuga"],["caratteristiche.autocatture","Autocatture"],["caratteristiche.nAbbeveratoi","N. abbeveratoi"],["caratteristiche.tipoAbbeveratoi","Tipo abbeveratoi"],["condizioni.puliziaBox","Pulizia box"],["condizioni.scivolosita","Scivolosità"],["condizioni.puliziaMangiatoia","Pulizia mangiatoia"],["condizioni.puliziaAbbeveratoio","Pulizia abbeveratoio"],["condizioni.puliziaAnimali","Pulizia animali"],["condizioni.cancellate","Stato cancellate"]];
  sheets.push({name:"Gruppi box",rows:sheetRecords(companyName,companyId,boxDefs,c.boxes||[],(x,i)=>recordExcelId("BOX",i))});

  const rationItems=[];(c.rations||[]).forEach((r,ri)=>(r.rows||[]).forEach((x,i)=>rationItems.push({...x,parent:r,rationIndex:ri,ingredientIndex:i})));
  const rationDefs=[["_date","Data rilievo",x=>x.parent.dataRilievo],["_ration","Razione",x=>x.parent.titolo],["_gen","Tipo genetico / sesso",x=>x.parent.tipoGeneticoSesso],["_n","Ingrediente n.",x=>x.ingredientIndex+1],["materiaPrima","Materia prima"],["kgCapoGiorno","kg/capo/giorno"],["approvvigionamento","Approvvigionamento"],["origine","Origine"],["_cm","Cartellino mangime",x=>x.parent.cartellinoMangime?"Presente":""],["_ci","Cartellino integratore",x=>x.parent.cartellinoIntegratore?"Presente":""]];
  sheets.push({name:"Razioni animali",rows:sheetRecords(companyName,companyId,rationDefs,rationItems,(x,i)=>recordExcelId("RAZ",x.rationIndex,x.ingredientIndex))});

  const manureDefs=[["anno","Anno"],["_stable","Stalla",x=>stableName(x.stallaId)],["tipoRefluo","Tipo refluo"],["quotaPercentuale","Quota (%)"],["sistemaStabulazione","Stabulazione / pavimento"],["rimozione","Rimozione"],["sistemaStoccaggio","Sistema stoccaggio"],["copertura","Copertura"],["durataGiorni","Durata (giorni)"],["quantitaAnnua","Quantità annua"],["unita","Unità"],["nTotale","N totale"],["tanPercentN","TAN (% N)"],["sostanzaSecca","Sostanza secca (%)"],["vs","VS (%)"],["biogas","Biogas"],["separazione","Separazione"],["_src","Fonte dato",x=>sourceValue(x.source,"tipo")],["_qual","Qualità dato",x=>sourceValue(x.source,"qualita")],["_doc","Documento",x=>sourceValue(x.source,"documento")],["note","Note"]];
  sheets.push({name:"Reflui stoccaggi",rows:sheetRecords(companyName,companyId,manureDefs,c.manureSystems||[],(x,i)=>recordExcelId("REF",i))});
  const fertDefs=[["data","Data"],["anno","Anno"],["coltura","Coltura"],["superficieHa","Superficie (ha)"],["tipoInput","Tipo input"],["prodotto","Prodotto / materiale"],["quantita","Quantità"],["unita","Unità"],["nTotale","N totale"],["tan","TAN"],["p2o5","P2O5"],["pTotale","P totale"],["tecnica","Tecnica"],["incorporazioneOre","Interramento (ore)"],["_src","Fonte dato",x=>sourceValue(x.source,"tipo")],["_qual","Qualità dato",x=>sourceValue(x.source,"qualita")],["_doc","Documento",x=>sourceValue(x.source,"documento")],["note","Note"]];
  sheets.push({name:"Concimazioni",rows:sheetRecords(companyName,companyId,fertDefs,c.fertilizationRecords||[],(x,i)=>recordExcelId("CON",i))});

  const cropItems=[];(c.crops||[]).forEach((p,pi)=>(p.rows||[]).forEach((x,i)=>cropItems.push({...x,parent:p,planIndex:pi,cropIndex:i})));
  const cropDefs=[["_year","Anno campagna",x=>x.parent.anno],["_n","Riga",x=>x.cropIndex+1],["coltura","Coltura"],["superficie","Superficie (ha)"],["prodotto","Prodotto ottenuto"],["irrigazione","Irrigazione"],["irrigazioneM3Ha","Irrigazione (m3/ha)"],["resa","Resa"],["azotofissatrice","Azotofissatrice"],["nFissazioneKgHa","N fissato (kg N/ha)"],["note","Note"]];
  sheets.push({name:"Piano colturale",rows:sheetRecords(companyName,companyId,cropDefs,cropItems,(x,i)=>recordExcelId("COL",x.planIndex,x.cropIndex))});

  const treatmentDefs=[["data","Data"],["coltura","Coltura"],["superficieHa","Superficie (ha)"],["categoria","Categoria"],["prodotto","Prodotto"],["principioAttivo","Principio attivo"],["dose","Dose"],["unitaDose","Unità dose"],["quantitaTotale","Quantità totale"],["_src","Fonte dato",x=>sourceValue(x.source,"tipo")],["_qual","Qualità dato",x=>sourceValue(x.source,"qualita")],["_doc","Documento",x=>sourceValue(x.source,"documento")],["note","Note"]];
  sheets.push({name:"Trattamenti",rows:sheetRecords(companyName,companyId,treatmentDefs,c.cropTreatments||[],(x,i)=>recordExcelId("TRT",i))});

  const irrigationDefs=[["anno","Anno"],["coltura","Coltura"],["superficieHa","Superficie (ha)"],["volumeM3","Volume (m3)"],["m3Ha","m3/ha"],["fonteAcqua","Fonte acqua"],["sistema","Sistema"],["metodoStima","Metodo determinazione volume"],["elettricitaKWh","Elettricità (kWh)"],["gasolioL","Gasolio (L)"],["_src","Fonte dato",x=>sourceValue(x.source,"tipo")],["_qual","Qualità dato",x=>sourceValue(x.source,"qualita")],["_doc","Documento",x=>sourceValue(x.source,"documento")],["note","Note"]];
  sheets.push({name:"Irrigazione",rows:sheetRecords(companyName,companyId,irrigationDefs,c.irrigationRecords||[],(x,i)=>recordExcelId("IRR",i))});

  const energyDefs=[["anno","Anno"],["elettricitaKWh","Elettricità acquistata (kWh)"],["fotovoltaicoKWh","Fotovoltaico prodotto (kWh)"],["gasolioL","Gasolio (L)"],["metanoM3","Metano (m3)"],["gplL","GPL (L)"],["acquaM3","Acqua (m3)"],["_src","Fonte dato",x=>sourceValue(x.source,"tipo")],["_qual","Qualità dato",x=>sourceValue(x.source,"qualita")],["_doc","Documento",x=>sourceValue(x.source,"documento")],["note","Note"]];
  sheets.push({name:"Energia acqua",rows:sheetRecords(companyName,companyId,energyDefs,c.energyRecords||[],(x,i)=>recordExcelId("ENE",i))});

  const manureAnalysisDefs=[["data","Data"],["tipoRefluo","Tipo refluo"],["nTotale","N totale"],["tan","TAN / N ammoniacale"],["pTotale","P totale"],["p2o5","P2O5"],["sostanzaSecca","Sostanza secca (%)"],["vs","VS (%)"],["unita","Unità / base"],["laboratorio","Laboratorio"],["_src","Fonte dato",x=>sourceValue(x.source,"tipo")],["_qual","Qualità dato",x=>sourceValue(x.source,"qualita")],["_doc","Documento",x=>sourceValue(x.source,"documento")],["note","Note"]];
  sheets.push({name:"Analisi reflui",rows:sheetRecords(companyName,companyId,manureAnalysisDefs,c.manureAnalyses||[],(x,i)=>recordExcelId("ARE",i))});

  const feedAnalysisDefs=[["data","Data"],["alimento","Alimento / materia prima"],["sostanzaSecca","Sostanza secca (%)"],["proteinaGrezza","Proteina grezza (%)"],["nTotale","N totale (%)"],["ndf","NDF (%)"],["ceneri","Ceneri (%)"],["energiaLorda","Energia lorda (MJ/kg)"],["digeribilita","Digeribilità (%)"],["laboratorio","Laboratorio"],["_src","Fonte dato",x=>sourceValue(x.source,"tipo")],["_qual","Qualità dato",x=>sourceValue(x.source,"qualita")],["_doc","Documento",x=>sourceValue(x.source,"documento")],["note","Note"]];
  sheets.push({name:"Analisi alimenti",rows:sheetRecords(companyName,companyId,feedAnalysisDefs,c.feedAnalyses||[],(x,i)=>recordExcelId("AAL",i))});


  const bioItems=[];(c.biogasRations||[]).forEach((r,ri)=>(r.rows||[]).forEach((x,i)=>bioItems.push({...x,parent:r,rationIndex:ri,rowIndex:i})));
  const bioDefs=[["_date","Data rilievo",x=>x.parent.dataRilievo],["_n","Riga",x=>x.rowIndex+1],["materiaPrima","Materia prima"],["kgGiorno","kg/giorno"],["autoprodotto","Autoprodotto"],["origine","Origine"]];
  sheets.push({name:"Razione biogas",rows:sheetRecords(companyName,companyId,bioDefs,bioItems,(x,i)=>recordExcelId("BIO",x.rationIndex,x.rowIndex))});

  const docDefs=[["tipo","Tipo documento"],["anno","Anno"],["filename","Nome file"],["descrizione","Descrizione"],["note","Note"],["addedAt","Data inserimento"]];
  sheets.push({name:"Documenti",rows:sheetRecords(companyName,companyId,docDefs,c.documents||[],(x,i)=>recordExcelId("DOC",i))});
  return sheets;
}
function xmlSafe(v){return String(v??"").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
function excelCol(n){let s="";for(let x=n;x>0;x=Math.floor((x-1)/26))s=String.fromCharCode(65+(x-1)%26)+s;return s;}
function cellXml(v,r,c,style=0){const ref=excelCol(c)+r;if(typeof v==="number"&&Number.isFinite(v))return `<c r="${ref}"${style?` s="${style}"`:""}><v>${v}</v></c>`;const t=xmlSafe(v);return `<c r="${ref}" t="inlineStr"${style?` s="${style}"`:""}><is><t xml:space="preserve">${t}</t></is></c>`;}
function sheetXml(rows){
  const cols=Math.max(1,...rows.map(r=>r.length));
  const widths=Array.from({length:cols},(_,i)=>{let m=i===0?18:12;for(const row of rows){m=Math.max(m,Math.min(i===0?38:30,String(row[i]??"").length+2));}return m;});
  const colXml=widths.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join("");
  const rowXml=rows.map((row,ri)=>`<row r="${ri+1}">${row.map((v,ci)=>cellXml(v,ri+1,ci+1,ri===0?1:0)).join("")}</row>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"/></sheetViews><cols>${colXml}</cols><sheetData>${rowXml}</sheetData></worksheet>`;
}
function sanitizeSheetName(name,used){let n=String(name).replace(/[\\\/?*\[\]:]/g," ").trim().slice(0,31)||"Foglio";let base=n,i=2;while(used.has(n)){const suf=` ${i++}`;n=(base.slice(0,31-suf.length)+suf);}used.add(n);return n;}
let crcTable=null;function crc32(bytes){if(!crcTable){crcTable=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?0xEDB88320^(c>>>1):c>>>1;crcTable[n]=c>>>0;}}let c=0xFFFFFFFF;for(const b of bytes)c=crcTable[(c^b)&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0;}
function zipHeader(size,crc,nameLen,offset,central=false){const len=central?46:30,b=new Uint8Array(len),v=new DataView(b.buffer);let o=0;const u16=x=>{v.setUint16(o,x,true);o+=2},u32=x=>{v.setUint32(o,x>>>0,true);o+=4};u32(central?0x02014b50:0x04034b50);if(central)u16(20);u16(20);u16(0);u16(0);u16(0);u16(0);u32(crc);u32(size);u32(size);u16(nameLen);u16(0);if(central){u16(0);u16(0);u16(0);u32(0);u32(offset);}return b;}
function concatBytes(parts){const n=parts.reduce((a,b)=>a+b.length,0),out=new Uint8Array(n);let o=0;for(const p of parts){out.set(p,o);o+=p.length;}return out;}
function zipStore(files){const enc=new TextEncoder(),locals=[],centrals=[];let offset=0;for(const f of files){const name=enc.encode(f.name),data=typeof f.data==="string"?enc.encode(f.data):f.data,crc=crc32(data),lh=zipHeader(data.length,crc,name.length,offset,false);locals.push(lh,name,data);const ch=zipHeader(data.length,crc,name.length,offset,true);centrals.push(ch,name);offset+=lh.length+name.length+data.length;}const centralOffset=offset,central=concatBytes(centrals),e=new Uint8Array(22),v=new DataView(e.buffer);v.setUint32(0,0x06054b50,true);v.setUint16(4,0,true);v.setUint16(6,0,true);v.setUint16(8,files.length,true);v.setUint16(10,files.length,true);v.setUint32(12,central.length,true);v.setUint32(16,centralOffset,true);v.setUint16(20,0,true);return new Blob([...locals,central,e],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});}
function makeXlsxBlob(sheets){
  const used=new Set(),safe=sheets.map(s=>({...s,name:sanitizeSheetName(s.name,used)}));
  const files=[];
  const overrides=safe.map((s,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("");
  files.push({name:"[Content_Types].xml",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${overrides}</Types>`});
  files.push({name:"_rels/.rels",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`});
  files.push({name:"xl/workbook.xml",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>${safe.map((s,i)=>`<sheet name="${xmlSafe(s.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join("")}</sheets></workbook>`});
  files.push({name:"xl/_rels/workbook.xml.rels",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${safe.map((s,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join("")}<Relationship Id="rId${safe.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`});
  files.push({name:"xl/styles.xml",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Cambria"/><family val="2"/></font><font><b/><sz val="11"/><name val="Cambria"/><family val="2"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`});
  safe.forEach((s,i)=>files.push({name:`xl/worksheets/sheet${i+1}.xml`,data:sheetXml(s.rows)}));
  return zipStore(files);
}
function safeFileName(s){return String(s||"azienda").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9_-]+/g,"_").replace(/^_+|_+$/g,"").slice(0,70)||"azienda";}
function exportCompanyXlsx(){const c=activeCompany();if(!c){toast("Seleziona un’azienda da esportare.");return}try{const blob=makeXlsxBlob(companyExcelSheets(c));const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`GrInnZoVe_${safeFileName(c.general?.ragioneSociale)}_dati_LCA.xlsx`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),800);toast("Excel aziendale generato.");}catch(e){console.error(e);toast("Errore durante la generazione del file Excel.");}}

function importJSON(file){
  const reader=new FileReader();reader.onload=()=>{try{const x=JSON.parse(reader.result);if(!x||!Array.isArray(x.companies))throw 0;saveDB(x);ensureActive();toast("Backup importato.");render()}catch{toast("File di backup non valido.")}};reader.readAsText(file);
}

document.addEventListener("input",e=>bindChange(e.target));
document.addEventListener("change",async e=>{
  bindChange(e.target);
  if(e.target.id==="activeCompanySelect"){
    setActiveId(e.target.value);
    if(state.screen==="stable")state.stableDraft=newStableDraft();
    if(state.screen==="box")state.boxDraft=newBoxDraft();
    if(state.screen==="ration")state.rationDraft=newRationDraft();
    if(state.screen==="crops")state.cropsDraft=newCropsDraft();
    if(state.screen==="biogas")state.biogasDraft=newBiogasDraft();
    if(state.screen==="batch")state.batchDraft=newBatchDraft();
    if(state.screen==="manure")state.manureDraft=newManureDraft();
    if(state.screen==="spreading")state.spreadingDraft=newSpreadingDraft();
    if(state.screen==="agro")state.agroDraft=newAgroDraft();
    if(state.screen==="documents")state.documentDraft=newDocumentDraft();
    render();return;
  }
  if(e.target.id==="stableSelect"&&state.boxDraft){state.boxDraft.stableId=e.target.value;return}
  if(e.target.id==="extractTarget"&&state.documentExtraction){state.documentExtraction.target=e.target.value;state.documentExtraction.sheetIndex=0;state.documentExtraction.sheets=state.documentExtraction.originalSheets||[];prepareExtraction(state.documentExtraction);render();return}
  if(e.target.id==="extractSheet"&&state.documentExtraction){state.documentExtraction.sheetIndex=Number(e.target.value)||0;prepareExtraction(state.documentExtraction);render();return}
  if(e.target.dataset.extractMap&&state.documentExtraction){state.documentExtraction.mapping=state.documentExtraction.mapping||{};if(e.target.value==="")delete state.documentExtraction.mapping[e.target.dataset.extractMap];else state.documentExtraction.mapping[e.target.dataset.extractMap]=Number(e.target.value);return}
  if(e.target.dataset.agromode&&state.agroDraft){state.agroDraft.mode=e.target.dataset.agromode;render();return}
  if(e.target.dataset.photo&&e.target.files?.[0]){
    try{
      const img=await compressImage(e.target.files[0]);
      state.rationDraft[e.target.dataset.photo]=img; render();
      toast("Immagine acquisita.");
    }catch{toast("Impossibile leggere l’immagine.");}
  }
});
document.addEventListener("click",e=>{
  const nav=e.target.closest("[data-nav]");if(nav){goto(nav.dataset.nav);$("#sidebar").classList.remove("open");return}
  const b=e.target.closest("[data-action]");if(!b)return;
  const a=b.dataset.action;
  if(a==="new-company")goto("company");
  if(a==="company-next"){if(!state.draft.general.ragioneSociale.trim()){toast("Inserisci almeno la Ragione sociale.");return}state.screen="companyManagement";render()}
  if(a==="company-back"){state.screen="company";render()}
  if(a==="save-company")saveCompany();
  if(a==="save-stable")saveStable(false);
  if(a==="save-stable-box")saveStable(true);
  if(a==="save-box")saveBox();
  if(a==="save-ration")saveRation();
  if(a==="save-crops")saveCrops();
  if(a==="save-biogas")saveBiogas();
  if(a==="save-batch")saveBatch();
  if(a==="save-manure")saveManure();
  if(a==="save-spreading")saveSpreading();
  if(a==="save-agro")saveAgro();
  if(a==="save-document")saveDocument(false);
  if(a==="save-analyze-document")saveDocument(true);
  if(a==="pick-extract-target"&&state.documentExtraction){state.documentExtraction.target=b.dataset.target;state.documentExtraction.sheetIndex=Number(b.dataset.sheet)||0;state.documentExtraction.sheets=state.documentExtraction.originalSheets||[];prepareExtraction(state.documentExtraction);render();return;}
  if(a==="extract-document")extractSavedDocument(b.dataset.id);
  if(a==="parse-pasted-table")parsePastedExtraction();
  if(a==="import-extracted")importExtractedRows();
  if(a==="download-document")downloadDocument(b.dataset.id);
  if(a==="delete-document")removeDocument(b.dataset.id);
  if(a==="add-ration-row"){state.rationDraft.rows.push(emptyRationRow());render()}
  if(a==="remove-ration-row"){state.rationDraft.rows.splice(Number(b.dataset.index),1);render()}
  if(a==="add-crop-row"){state.cropsDraft.rows.push(emptyCropRow());render()}
  if(a==="remove-crop-row"){state.cropsDraft.rows.splice(Number(b.dataset.index),1);render()}
  if(a==="add-biogas-row"){state.biogasDraft.rows.push(emptyBiogasRow());render()}
  if(a==="remove-biogas-row"){state.biogasDraft.rows.splice(Number(b.dataset.index),1);render()}
  if(a==="remove-photo"){state.rationDraft[b.dataset.key]="";render()}
  if(a==="export-json")exportJSON();
  if(a==="export-xlsx")exportCompanyXlsx();
  if(a==="import-json")$("#backupImport").click();
});
$("#homeBtn").addEventListener("click",()=>goto("home"));
$("#menuBtn").addEventListener("click",()=>$("#sidebar").classList.toggle("open"));
$("#backupImport").addEventListener("change",e=>{if(e.target.files?.[0])importJSON(e.target.files[0]);e.target.value=""});
document.addEventListener("click",e=>{if(innerWidth<=800&&!e.target.closest("#sidebar")&&!e.target.closest("#menuBtn"))$("#sidebar").classList.remove("open")});

if("serviceWorker" in navigator && (location.protocol==="https:"||location.hostname==="localhost"||location.hostname==="127.0.0.1")){
  navigator.serviceWorker.register("sw.js").catch(()=>{});
}
ensureActive();updateStorageChip();render();
