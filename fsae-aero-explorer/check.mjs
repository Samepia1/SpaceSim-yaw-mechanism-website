import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const data=JSON.parse(fs.readFileSync('dist/data.json','utf8'));
assert.equal(new Set(data.records.map(r=>r.id)).size,data.records.length,'Record IDs must be unique');
assert.equal(data.records.filter(r=>r.source==='WT').length,72);
assert.equal(data.records.filter(r=>r.source==='CFD 26').length,12);
assert.equal(data.sources.length,8);
for(const r of data.records){assert.ok(r.fields.length);assert.ok(r.row>0);assert.ok(Number.isFinite(r.speed));if(r.source==='WT'){assert.equal(r.down,-Number(r.fields.find(f=>f.column==='L').value));assert.ok(Math.abs(r.speed-r.mph*.44704)<1e-8)}}
for(const s of data.sources)assert.ok(fs.existsSync('dist/'+s.url));
const elements=new Map(),listeners={};
function elem(id){if(!elements.has(id))elements.set(id,{innerHTML:'',value:'',textContent:'',hidden:false,style:{},classList:{toggle(){}},focus(){},showModal(){},close(){},setSelectionRange(){}});return elements.get(id)}
const sandbox={console,Number,String,Map,Set,Math,JSON,Array,URL,Blob,setTimeout,clearTimeout,location:{hash:''},history:{replaceState(){}},document:{querySelector:elem,querySelectorAll:()=>[],addEventListener:(n,f)=>{(listeners[n]??=[]).push(f)},getElementById:elem},window:{scrollTo(){},innerWidth:1440,innerHeight:1000},fetch:async()=>({ok:true,json:async()=>data})};
vm.createContext(sandbox);vm.runInContext(fs.readFileSync('dist/app.js','utf8'),sandbox);await new Promise(r=>setTimeout(r,10));
let n=0;
for(const source of ['WT','CFD 25','CFD 26','Corrected','All'])for(const view of ['coverage','yaw','speed','forces','cfd','diagnostics']){
 vm.runInContext(`Object.assign(state,{source:${JSON.stringify(source)},config:'All',view:${JSON.stringify(view)},speed:'All',yaw:'All'});render()`,sandbox);
 const html=elem('#main').innerHTML;assert.ok(html.length>100);assert.ok(!/NaN|undefined/.test(html),source+' '+view+' invalid output');assert.ok(!/Infinity/.test(html));n++;
}
vm.runInContext("Object.assign(state,{source:'WT',view:'yaw',config:'Baseline',physical:true,relative:true,asymmetry:true});render()",sandbox);
assert.ok(!/NaN|undefined/.test(elem('#main').innerHTML));
vm.runInContext("Object.assign(state,{view:'speed',reference:true});render()",sandbox);
assert.ok(elem('#main').innerHTML.includes('V²'));
vm.runInContext("Object.assign(state,{view:'coverage',source:'WT',config:'All',speed:'46.3',yaw:'4'});render()",sandbox);
assert.equal(vm.runInContext('filtered().length',sandbox),3);
vm.runInContext("Object.assign(state,{view:'cfd',matchMetric:'down'});render()",sandbox);
const pairs=vm.runInContext('matches()',sandbox);assert.ok(pairs.length>5);for(const {c,w}of pairs){assert.equal(c.yaw,w.yaw);assert.ok(Math.abs(c.speed-w.speed)<=.15)}
for(const r of data.records){vm.runInContext(`inspect(${JSON.stringify(r.id)})`,sandbox);assert.ok(elem('#inspector').innerHTML.includes(r.file));}
for(const view of Object.keys({coverage:1,yaw:1,speed:1,forces:1,cfd:1,diagnostics:1})){vm.runInContext(`state.source='WT';state.speed='46.3';state.yaw='20';state.view='${view}';render()`,sandbox);assert.ok(!/NaN|undefined/.test(elem('#main').innerHTML));}
console.log(JSON.stringify({records:data.records.length,uniqueIDs:true,windTunnelPoints:72,sourceFiles:8,viewSourceChecks:n,matchedCases:pairs.length,recordInspectors:data.records.length,status:'passed'}));
