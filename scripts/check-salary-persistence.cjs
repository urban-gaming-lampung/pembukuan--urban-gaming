const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
require.extensions['.ts'] = (m, file) => m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, file);
const { mergeSalaryEdits, sameSalaryValue } = require('../src/lib/salaryPersistence.ts');
const clone = x => structuredClone(x);
const base = [{ id: 'month', bulanTahun: '09/26', gajiPokok: 1500000, gajiTambahan: [{ id: 'bonus', nominal: 100, ket: 'Bonus', status: 'belum' }], gajiPengurangan: [{ id: 'p1', _idempKey: 'late1', nominal: 50, isDibatalkan: false }] }];
let checks = 0;
function check(name, fn) { fn(); checks++; console.log('PASS '+name); }
check('map key order is irrelevant', () => assert(sameSalaryValue({a:1,b:2},{b:2,a:1})));
check('automatic penalties merge with canceled penalty and new bonus', () => {
 const edit=clone(base),remote=clone(base);
 edit[0].gajiPengurangan[0].isDibatalkan=true;edit[0].gajiTambahan.push({id:'local',nominal:70});
 remote[0].gajiPengurangan.push({id:'p2',_idempKey:'late2',nominal:20,isDibatalkan:false});remote[0].updatedAt=99;
 const saved=mergeSalaryEdits(base,base,edit,remote)[0];
 assert.equal(saved.gajiPengurangan.length,2);assert.equal(saved.gajiPengurangan[0].isDibatalkan,true);assert.equal(saved.gajiTambahan.length,2);
 assert.equal(remote[0].gajiPengurangan[0].isDibatalkan,false);
});
check('remote bonus and cancellation survive unrelated edit', () => {
 const edit=clone(base),remote=clone(base);edit[0].buktiTransfer='image';remote[0].gajiTambahan.push({id:'remote',nominal:80});remote[0].gajiPengurangan[0].isDibatalkan=true;
 const saved=mergeSalaryEdits(base,base,edit,remote)[0];assert.equal(saved.gajiTambahan.length,2);assert.equal(saved.gajiPengurangan[0].isDibatalkan,true);
});
check('same field conflicting edit rejects', () => {
 const edit=clone(base),remote=clone(base);edit[0].gajiTambahan[0].nominal=200;remote[0].gajiTambahan[0].nominal=300;
 assert.throws(()=>mergeSalaryEdits(base,base,edit,remote),/Bagian gaji/);
});
check('same item different fields merge', () => {
 const edit=clone(base),remote=clone(base);edit[0].gajiTambahan[0].nominal=200;remote[0].gajiTambahan[0].status='sudah';
 const item=mergeSalaryEdits(base,base,edit,remote)[0].gajiTambahan[0];assert.equal(item.nominal,200);assert.equal(item.status,'sudah');
});
check('zero salary is retained', () => {const edit=clone(base);edit[0].gajiPokok='0';assert.equal(mergeSalaryEdits(base,base,edit,base)[0].gajiPokok,0);});
check('automatic stub generated while editing merges', () => {
 const edit=clone(base);edit[0].gajiPengurangan[0].isDibatalkan=true;
 assert.equal(mergeSalaryEdits([],base,edit,base)[0].gajiPengurangan[0].isDibatalkan,true);
});
check('remote month survives', () => assert.equal(mergeSalaryEdits(base,base,base,[...base,{id:'other',bulanTahun:'08/26'}]).length,2));
check('explicit item deletion preserves remote additions', () => {
 const edit=clone(base),remote=clone(base);edit[0].gajiTambahan=[];remote[0].gajiTambahan.push({id:'new',nominal:80});
 assert.deepEqual(mergeSalaryEdits(base,base,edit,remote)[0].gajiTambahan.map(x=>x.id),['new']);
});
check('concurrent edits prevent item deletion', () => {
 const edit=clone(base),remote=clone(base);edit[0].gajiTambahan=[];remote[0].gajiTambahan[0].nominal=900;
 assert.throws(()=>mergeSalaryEdits(base,base,edit,remote),/Bagian gaji/);
});
async function retryChecks() {
 let attempts=0,advance=true;
 const fake={runTransaction:async(_,cb)=>{attempts++;const result=await cb({get:async()=>({data:()=>({salaryRevision:attempts===1?1:2})})});if(attempts===1)throw Object.assign(new Error('denied'),{code:'permission-denied'});return result;},getDocFromServer:async()=>({data:()=>({salaryRevision:advance?2:1})})};
 const file=require.resolve('../src/lib/salaryPersistence.ts');const m=new Module(file,module);m.filename=file;m.paths=module.paths;
 const original=m.require.bind(m);m.require=id=>id==='firebase/firestore'?fake:original(id);
 m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,file);
 const ref={};await m.exports.runSalaryTransaction({},async tx=>{await tx.get(ref);return 42;});assert.equal(attempts,2);console.log('PASS revision race retries');checks++;
 attempts=0;advance=false;await assert.rejects(m.exports.runSalaryTransaction({},tx=>tx.get(ref)),/denied/);assert.equal(attempts,1);console.log('PASS actual permission failure is not retried');checks++;
 console.log(checks+' salary persistence checks passed.');
}
retryChecks().catch(e=>{console.error(e);process.exitCode=1;});
