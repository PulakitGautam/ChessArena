const KEY='jester14_arena_v1',$=i=>document.getElementById(i);
const PC={w:{k:'♔',q:'♕',r:'♖',b:'♗',n:'♘',p:'♙'},b:{k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'}};
let data=load(),cur=null,chess=null,sel=null,targets=[],flip=false,match=null,view='home';
const ready=typeof Chess==='function';chess=ready?new Chess():null;if(!ready)$('libAlert').hidden=false;

function load(){try{const d=JSON.parse(localStorage.getItem(KEY));if(d&&Array.isArray(d.tournaments)&&Array.isArray(d.players)){d.templates=Array.isArray(d.templates)?d.templates:[];d.tournaments.forEach(t=>{t.withdrawn=t.withdrawn||[];t.rounds.forEach(r=>r.pairings.forEach(p=>{if(p.black==null||p.result==='BYE'){p.bye=true;p.black=null;p.result=null}}))});return d}}catch(e){}return{tournaments:[],players:[],templates:[]}}
function save(){if(RO){toast('This is a view-only link');return}try{localStorage.setItem(KEY,JSON.stringify(data))}catch(e){toast('Could not save. Browser storage may be full or blocked.')}renderAll();queueSync()}
const uid=()=>Math.random().toString(36).slice(2,9);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let tt;function toast(s){const t=$('toast');t.textContent=s;t.classList.add('show');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('show'),2300)}
const getT=()=>data.tournaments.find(t=>t.id===cur);
const name=pid=>data.players.find(p=>p.id===pid)?.name||'Unknown';
const done=p=>p.bye||!!p.result;
const games=t=>t.rounds.reduce((n,r)=>n+r.pairings.filter(p=>!p.bye&&p.result).length,0);
const pk=(a,b)=>[a,b].sort().join('|');
const FMT={swiss:'Swiss system',roundrobin:'Round robin',knockout:'Knockout'};
const isKO=()=>data.tournaments.find(t=>t.id===match?.t)?.format==='knockout';
const KODRAW='Knockout games need a winner. Play a tiebreak and record that result.';
function champ(t){if(t.format!=='knockout')return null;const l=t.rounds[t.rounds.length-1];if(!l||l.pairings.length!==1||!done(l.pairings[0]))return null;const p=l.pairings[0];return p.bye?p.white:p.result==='1-0'?p.white:p.result==='0-1'?p.black:null}

function go(v){view=v;document.querySelectorAll('.view').forEach(x=>x.classList.toggle('active',x.id==='view-'+v));document.querySelectorAll('.nav button').forEach(x=>x.classList.toggle('active',x.dataset.view===v||(v==='detail'&&x.dataset.view==='tournaments')));
const T={home:['Your chess HQ','Welcome to the Arena'],tournaments:['Your events','Tournaments'],players:['Player directory','Players'],detail:['Tournament workspace',getT()?.name||'Tournament'],boardview:['Make your move','Chessboard']}[v];$('eyebrow').textContent=T[0];$('pageTitle').textContent=T[1];window.scrollTo(0,0)}

/* scoring */
function scores(t){const o={};t.players.forEach(p=>o[p]={id:p,score:0,w:0,d:0,l:0,bh:0,opp:[],bye:false});
for(const r of t.rounds)for(const p of r.pairings){if(p.bye){if(o[p.white]){o[p.white].score++;o[p.white].bye=true}continue}if(!p.result)continue;const a=o[p.white],b=o[p.black];if(!a||!b)continue;a.opp.push(p.black);b.opp.push(p.white);
if(p.result==='1-0'){a.score++;a.w++;b.l++}else if(p.result==='0-1'){b.score++;b.w++;a.l++}else{a.score+=.5;b.score+=.5;a.d++;b.d++}}
t.players.forEach(p=>o[p].bh=o[p].opp.reduce((n,x)=>n+(o[x]?.score||0),0));return o}
function standings(t){const s=scores(t);return t.players.map(p=>({...s[p],name:name(p),out:t.withdrawn.includes(p)})).sort((a,b)=>b.score-a.score||b.bh-a.bh||b.w-a.w||a.name.localeCompare(b.name))}
const fmt=n=>n%1?String(n).replace('.5','½').replace(/^0½/,'½'):String(n);

/* Swiss pairing with backtracking so rematches are avoided whenever possible */
function solve(pool,played,allow){if(!pool.length)return[];const[a,...rest]=pool;for(const b of rest){if(!allow&&played.has(pk(a,b)))continue;const r=solve(rest.filter(x=>x!==b),played,allow);if(r)return[[a,b],...r]}return null}
/* Round robin (circle method) and knockout (seeded bracket) */
const mk=([a,b])=>(a==null||b==null)?{white:a??b,black:null,bye:true,result:null,pgn:''}:{white:a,black:b,result:null,pgn:''};
function genRR(t,act){
  if(!t.schedule){const arr=act.slice();if(arr.length%2)arr.push(null);const n=arr.length,rounds=[];
    for(let r=0;r<n-1;r++){const pr=[];for(let i=0;i<n/2;i++){let a=arr[i],b=arr[n-1-i];if((r+i)%2)[a,b]=[b,a];pr.push([a,b])}rounds.push(pr);arr.splice(1,0,arr.pop())}
    t.schedule=rounds;t.maxRounds=rounds.length}
  const r=t.schedule[t.rounds.length]||[];
  return r.filter(([a,b])=>!(a&&t.withdrawn.includes(a))&&!(b&&t.withdrawn.includes(b))).map(mk)}
function genKO(t,act){
  if(!t.rounds.length){const n=act.length;let size=2;while(size<n)size*=2;let ord=[1,2];while(ord.length<size)ord=ord.flatMap(x=>[x,ord.length*2+1-x]);
    t.maxRounds=Math.log2(size);const seat=ord.map(x=>x<=n?act[x-1]:null),pr=[];for(let i=0;i<size;i+=2)pr.push([seat[i],seat[i+1]]);return pr.map(mk)}
  const w=t.rounds[t.rounds.length-1].pairings.map(p=>p.bye||p.result==='1-0'?p.white:p.black),pr=[];
  for(let i=0;i<w.length;i+=2)pr.push([w[i],w[i+1]]);return pr.map(mk)}
function genRound(t){const act=t.players.filter(p=>!t.withdrawn.includes(p));
if(act.length<2)return toast('Add at least two active players first');
if(t.rounds.length>=t.maxRounds)return toast('All planned rounds are already generated');
const last=t.rounds[t.rounds.length-1];if(last&&!last.pairings.every(done))return toast('Record every result in the last round first');
const fm=t.format||'swiss';
if(fm!=='swiss'){const list=fm==='roundrobin'?genRR(t,act):genKO(t,act);if(!list.length)return toast('No games to play this round');t.rounds.push({number:t.rounds.length+1,pairings:list});t.status='active';save();return toast(`Round ${t.rounds.length} generated`)}
const order=standings(t).filter(s=>act.includes(s.id)).map(s=>s.id),played=new Set(),hadBye=new Set();
t.rounds.forEach(r=>r.pairings.forEach(p=>p.bye?hadBye.add(p.white):played.add(pk(p.white,p.black))));
let bye=null,pairs=null;
if(order.length%2){const cands=order.slice().reverse().sort((a,b)=>hadBye.has(a)-hadBye.has(b));
for(const c of cands){const r=solve(order.filter(x=>x!==c),played,false);if(r){bye=c;pairs=r;break}}
if(!pairs){bye=cands[0];pairs=solve(order.filter(x=>x!==bye),played,true)}}
else pairs=solve(order,played,false)||solve(order,played,true);
const wc=p=>t.rounds.reduce((n,r)=>n+r.pairings.filter(x=>!x.bye&&x.white===p).length-r.pairings.filter(x=>!x.bye&&x.black===p).length,0);
const list=pairs.map(([a,b])=>wc(a)>wc(b)?{white:b,black:a,result:null,pgn:''}:{white:a,black:b,result:null,pgn:''});
if(bye)list.push({white:bye,black:null,bye:true,result:null,pgn:''});
t.rounds.push({number:t.rounds.length+1,pairings:list});t.status='active';save();toast(`Round ${t.rounds.length} generated`)}

/* rendering */
function tCard(t){const st=t.status==='finished'?'Finished':t.rounds.length?`Round ${t.rounds.length}`:'Setup';
return `<button class="card" data-open="${t.id}"><div class="row" style="justify-content:space-between;align-items:start"><h4>${esc(t.name)}</h4><span class="pill ${t.status==='finished'?'gold':'green'}">${st}</span></div><p>${t.players.length} players · ${t.rounds.length}/${t.maxRounds} rounds · ${games(t)} results</p><p style="margin-top:12px">${new Date(t.created).toLocaleDateString()}</p></button>`}
function renderAll(){$('sT').textContent=data.tournaments.length;$('sP').textContent=data.players.length;$('sG').textContent=data.tournaments.reduce((n,t)=>n+games(t),0);$('sA').textContent=data.tournaments.filter(t=>t.status!=='finished').length;
const all=data.tournaments.slice().reverse();
$('recent').innerHTML=all.slice(0,6).map(tCard).join('')||`<div class="empty" style="grid-column:1/-1"><b>No tournaments yet</b><p>Create one, or load the demo to see how it works.</p></div>`;
$('allT').innerHTML=all.map(tCard).join('')||`<div class="empty" style="grid-column:1/-1">No tournaments yet. Create one to begin.</div>`;
$('tCount').textContent=`${all.length} event${all.length===1?'':'s'}`;
$('gList').innerHTML=data.players.map(p=>`<span class="chip">${esc(p.name)}<button data-rm-player="${p.id}" aria-label="Remove ${esc(p.name)}">×</button></span>`).join('')||'<span class="muted">No saved players yet.</span>';
if(cur&&getT())renderDetail();else if(view==='detail')go('tournaments');
renderBoard();renderMatchSel();renderTpls()}

function renderDetail(){const t=getT();if(!t)return;if(view==='detail')$('pageTitle').textContent=t.name;
$('dName').textContent=t.name;$('dMeta').textContent=`${FMT[t.format||'swiss']}${t.clock&&t.clock!=='off'?' · Clock '+t.clock:''} · Created ${new Date(t.created).toLocaleDateString()}${champ(t)?' · Champion: '+name(champ(t)):''}${RO?' · Live view, refreshes every 15 seconds':''}`;
$('dRound').textContent=`${t.rounds.length}/${t.maxRounds}`;$('dPlayers').textContent=t.players.length;$('dGames').textContent=games(t);$('dStatus').textContent=t.status==='finished'?'Finished':t.rounds.length?'Active':'Setup';
const rc=$('roundCount');rc.innerHTML='';for(let i=Math.max(1,t.rounds.length);i<=15;i++)rc.add(new Option(i,i));rc.value=String(t.maxRounds);rc.disabled=(t.format||'swiss')!=='swiss';$('tClock').value=t.clock||'off';
$('evPlayers').innerHTML=t.players.map(p=>`<span class="chip ${t.withdrawn.includes(p)?'out':''}">${esc(name(p))}<button data-rm-event="${p}" aria-label="${t.rounds.length?'Withdraw or restore':'Remove'} ${esc(name(p))}">${t.rounds.length?(t.withdrawn.includes(p)?'↺':'⏏'):'×'}</button></span>`).join('')||'<span class="muted">Add players to begin.</span>';
const rows=standings(t);
$('standings').innerHTML=rows.length?`<table><thead><tr><th>#</th><th>Player</th><th>Pts</th><th>W</th><th>D</th><th>L</th><th>Buch.</th></tr></thead><tbody>${rows.map((p,i)=>`<tr><td class="rank r${i+1}">${i+1}</td><td>${esc(p.name)}${p.bye?' <span class="pill gold">Bye</span>':''}${p.out?' <span class="pill">Withdrawn</span>':''}</td><td><b>${fmt(p.score)}</b></td><td>${p.w}</td><td>${p.d}</td><td>${p.l}</td><td>${fmt(p.bh)}</td></tr>`).join('')}</tbody></table>`:'<div class="empty">Standings appear after you add players.</div>';
$('rounds').innerHTML=t.rounds.length?t.rounds.slice().reverse().map(r=>`<div style="margin-bottom:16px"><div class="head" style="margin:0 0 6px"><b>Round ${r.number}</b><span class="pill ${r.pairings.every(done)?'green':''}">${r.pairings.filter(done).length}/${r.pairings.length} complete</span></div>${r.pairings.map((p,i)=>p.bye?`<div class="pairing"><span class="pname">${esc(name(p.white))}</span><span class="vs">gets</span><span style="color:var(--gold)">Bye · 1 point</span><span></span></div>`:`<div class="pairing"><span class="pname">${esc(name(p.white))}</span><span class="vs">vs</span><span class="pname r">${esc(name(p.black))}</span><div class="btns"><button data-play="${r.number}:${i}">Board</button>${[['1-0','1–0'],['1/2-1/2','½'],['0-1','0–1']].map(([v,l])=>`<button class="${p.result===v?'sel':''}" data-score="${r.number}:${i}:${v}" aria-pressed="${p.result===v}">${l}</button>`).join('')}</div></div>`).join('')}</div>`).join(''):'<div class="empty"><b>No pairings yet</b><p>Add at least two players, then generate Round 1.</p></div>';
const last=t.rounds[t.rounds.length-1];
$('genRound').disabled=t.status==='finished'||t.rounds.length>=t.maxRounds||t.players.length<2||(last&&!last.pairings.every(done));
$('finish').disabled=t.status==='finished';$('reopen').disabled=t.status!=='finished';
const ids=rows.map(r=>r.id);
$('cross').innerHTML=t.rounds.length?`<table><thead><tr><th></th>${rows.map((r,i)=>`<th class="x" title="${esc(r.name)}">${i+1}</th>`).join('')}</tr></thead><tbody>${rows.map((r,i)=>`<tr><th>${i+1}. ${esc(r.name)}</th>${ids.map((o,j)=>{if(i===j)return'<td class="x muted">·</td>';let c='';t.rounds.forEach(rd=>rd.pairings.forEach(p=>{if(p.bye||!p.result)return;if(p.white===r.id&&p.black===o)c+=({'1-0':'1','0-1':'0','1/2-1/2':'½'})[p.result];else if(p.white===o&&p.black===r.id)c+=({'1-0':'0','0-1':'1','1/2-1/2':'½'})[p.result]}));return`<td class="x">${c}</td>`}).join('')}</tr>`).join('')}</tbody></table>`:'<div class="muted">The crosstable fills in as results come in.</div>'}

/* modal forms (replace browser pop-ups) */
const dlg=$('dlg'),dform=$('dlgForm');let dsubmit=null;
function closeModal(){if(dlg.open)dlg.close()}
function modal({title,body,ok='Save',cancel='Cancel',danger=false,hideFooter=false,onSubmit,onOpen}){
  $('dlgTitle').textContent=title;$('dlgBody').innerHTML=body;$('dlgBody').onclick=null;
  const b=$('dlgOk');b.textContent=ok;b.className=danger?'danger-fill':'primary';$('dlgCancel').textContent=cancel;$('dlgFoot').hidden=hideFooter;
  dsubmit=onSubmit||null;if(!dlg.open)dlg.showModal();if(onOpen)onOpen();
  const f=dlg.querySelector('[autofocus],#dlgBody input,#dlgBody textarea,.pbtn,#dlgCancel');if(f)f.focus()}
dform.addEventListener('submit',e=>{e.preventDefault();if(!dsubmit)return closeModal();if(dsubmit(new FormData(dform))!==false)closeModal()});
$('dlgCancel').onclick=$('dlgX').onclick=closeModal;
dlg.addEventListener('click',e=>{if(e.target===dlg)closeModal()});
function ferr(id,msg){const el=$(id);el.setAttribute('aria-invalid','true');let e=el.parentElement.querySelector('.ferr');if(!e){e=document.createElement('div');e.className='ferr';e.setAttribute('role','alert');el.parentElement.appendChild(e)}e.textContent=msg;el.focus()}
function ask(title,msg,ok,fn,danger=true){modal({title,ok,danger,body:`<p class="dmsg">${esc(msg)}</p>`,onSubmit:()=>{fn()}})}
function pickPromo(color,cb){let chosen=false;const N={q:'Queen',r:'Rook',b:'Bishop',n:'Knight'};
  dlg.addEventListener('close',()=>{if(!chosen){sel=null;targets=[];renderBoard()}},{once:true});
  modal({title:'Promote your pawn',hideFooter:true,body:`<div class="promo">${['q','r','b','n'].map(t=>`<button type="button" class="pbtn" data-p="${t}" aria-label="${N[t]}"><svg class="pc ${color}" viewBox="0 0 45 45" aria-hidden="true"><use href="#${t}"/></svg><span>${N[t]}</span></button>`).join('')}</div>`,
    onOpen(){$('dlgBody').onclick=e=>{const b=e.target.closest('.pbtn');if(!b)return;chosen=true;closeModal();cb(b.dataset.p)}}})}

/* actions */
function addGlobal(n){n=n.trim().slice(0,40);if(!n)return null;let p=data.players.find(x=>x.name.toLowerCase()===n.toLowerCase());if(!p){p={id:uid(),name:n};data.players.push(p)}return p}
/* tournament templates */
const BUILTIN=[
  {id:'b-club',name:'Club night',format:'swiss',maxRounds:5,clock:'10+0',players:[],builtin:true},
  {id:'b-blitz',name:'Blitz Swiss',format:'swiss',maxRounds:7,clock:'3+2',players:[],builtin:true},
  {id:'b-rr',name:'Rapid round robin',format:'roundrobin',maxRounds:5,clock:'15+10',players:[],builtin:true},
  {id:'b-ko',name:'Quick knockout',format:'knockout',maxRounds:5,clock:'5+0',players:[],builtin:true}];
const tpls=()=>[...BUILTIN,...(data.templates||[])];
const clockOpts=sel=>`<option value="off"${sel==='off'?' selected':''}>No clock</option>`+Object.keys(TC).filter(k=>k!=='off').map(k=>`<option value="${k}"${sel===k?' selected':''}>${k}</option>`).join('');
const tplSummary=x=>`${FMT[x.format]||'Swiss system'}${x.format==='swiss'?` · ${x.maxRounds} rounds`:''} · ${x.clock==='off'?'no clock':x.clock}${x.players&&x.players.length?` · ${x.players.length} players`:''}`;
function renderTpls(){const el=$('tplList');if(!el)return;
  el.innerHTML=tpls().map(x=>`<div class="tpl"><div><b>${esc(x.name)}</b><small>${esc(tplSummary(x))}${x.builtin?' · built-in':''}</small></div><div class="row"><button type="button" data-use-tpl="${x.id}">Use</button>${x.builtin?'':`<button type="button" class="danger" data-del-tpl="${x.id}">Delete</button>`}</div></div>`).join('')}
function newTournament(tplId){
  const F=[['swiss','Swiss','Players with similar scores meet each round. Best for larger events.'],['roundrobin','Round robin','Everyone plays everyone once. Best for small groups.'],['knockout','Knockout','Lose and you are out. Quick, with a single champion.']];
  const T=tpls();let tplPlayers=[];const mine=data.templates||[];
  modal({title:'New tournament',ok:'Create tournament',
    body:`<div class="field"><label for="fName">Tournament name</label><input type="text" id="fName" name="name" maxlength="60" value="Chess Arena Championship" autocomplete="off"></div>
<div class="field"><label for="fTpl">Start from a template</label><select id="fTpl" name="tpl"><option value="">Blank tournament</option><optgroup label="Built-in">${BUILTIN.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('')}</optgroup>${mine.length?`<optgroup label="Your templates">${mine.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('')}</optgroup>`:''}</select><div class="fhelp" id="fTplNote">A template fills in the format, rounds, clock and players. You can still change everything.</div></div>
<fieldset class="fmts"><legend>Format</legend>${F.map((f,i)=>`<label class="fmt"><input type="radio" name="fmt" value="${f[0]}"${i?'':' checked'}><span><b>${f[1]}</b><small>${f[2]}</small></span></label>`).join('')}</fieldset>
<div class="twof" style="margin-top:14px"><div class="field" id="fRoundsWrap"><label for="fRounds">Swiss rounds</label><select id="fRounds" name="rounds">${[3,4,5,6,7,8,9].map(n=>`<option${n===5?' selected':''}>${n}</option>`).join('')}</select></div><div class="field"><label for="fClock">Default clock</label><select id="fClock" name="clock">${clockOpts('off')}</select></div></div>`,
    onOpen(){
      const sync=()=>{$('fRoundsWrap').hidden=dform.querySelector('[name=fmt]:checked').value!=='swiss'};
      dform.querySelectorAll('[name=fmt]').forEach(r=>r.addEventListener('change',sync));
      const fill=()=>{const x=T.find(y=>y.id===$('fTpl').value);tplPlayers=x?(x.players||[]):[];
        if(!x){$('fTplNote').textContent='A template fills in the format, rounds, clock and players. You can still change everything.';return}
        dform.querySelector(`[name=fmt][value="${x.format}"]`).checked=true;$('fRounds').value=String(x.maxRounds||5);$('fClock').value=x.clock||'off';sync();$('fTplNote').textContent=tplSummary(x)};
      $('fTpl').addEventListener('change',fill);
      if(tplId){$('fTpl').value=tplId;fill()}else sync();
      $('fName').select()},
    onSubmit(fd){const n=String(fd.get('name')).trim();if(!n){ferr('fName','Please enter a tournament name');return false}
      const t={format:fd.get('fmt')||'swiss',id:uid(),name:n,created:new Date().toISOString(),maxRounds:+fd.get('rounds')||5,clock:fd.get('clock')||'off',status:'setup',players:[],rounds:[],withdrawn:[]};
      tplPlayers.forEach(nm=>{const p=addGlobal(nm);if(p&&!t.players.includes(p.id))t.players.push(p.id)});
      data.tournaments.push(t);cur=t.id;save();go('detail');toast('Tournament created')}})}
function saveTemplate(){const t=getT();if(!t)return;
  modal({title:'Save as template',ok:'Save template',
    body:`<div class="field"><label for="fTn">Template name</label><input type="text" id="fTn" name="name" maxlength="40" value="${esc(t.name)}" autocomplete="off"></div><label class="chk"><input type="checkbox" name="pl" checked> Include the player list (${t.players.length})</label>`,
    onOpen(){$('fTn').select()},
    onSubmit(fd){const n=String(fd.get('name')).trim();if(!n){ferr('fTn','Give the template a name');return false}
      const x={id:uid(),name:n,format:t.format||'swiss',maxRounds:t.maxRounds||5,clock:t.clock||'off',players:fd.get('pl')?t.players.map(name):[]};
      data.templates=(data.templates||[]).filter(y=>y.name.toLowerCase()!==n.toLowerCase());data.templates.push(x);save();toast('Template saved')}})}
$('tClock').onchange=e=>{const t=getT();if(t){t.clock=e.target.value;save()}};
$('saveTpl').onclick=saveTemplate;

function addEvPlayers(){const t=getT();if(!t)return;
  if(t.status==='finished')return toast('Reopen the tournament to add players');
  if(t.rounds.length&&(t.format||'swiss')!=='swiss')return toast('Players cannot be added to this format after Round 1');
  const avail=data.players.filter(p=>!t.players.includes(p.id));
  modal({title:'Add players',ok:'Add players',
    body:`<div class="field"><label for="fNames">Player names</label><textarea id="fNames" name="names" rows="5" placeholder="One name per line, or separate with commas"></textarea><div class="fhelp">New names are also saved to your player directory.</div></div>`+(avail.length?`<div class="field"><label>Quick add from your directory</label><div class="chips" id="qa">${avail.map(p=>`<button type="button" class="chip qa" data-n="${esc(p.name)}">${esc(p.name)}</button>`).join('')}</div></div>`:''),
    onOpen(){const q=$('qa');if(q)q.addEventListener('click',e=>{const b=e.target.closest('.qa');if(!b)return;const ta=$('fNames');ta.value=(ta.value.trim()?ta.value.trim()+'\n':'')+b.dataset.n;b.disabled=true;ta.focus()})},
    onSubmit(fd){const names=String(fd.get('names')).split(/[\n,]+/).map(x=>x.trim()).filter(Boolean);
      if(!names.length){ferr('fNames','Enter at least one name');return false}
      let n=0;names.forEach(x=>{const p=addGlobal(x);if(p&&!t.players.includes(p.id)){t.players.push(p.id);n++}});
      save();toast(n?`${n} player${n===1?'':'s'} added`:'Those players are already in this tournament')}})}
function rmEvPlayer(pid){const t=getT();if(!t)return;if(!t.rounds.length){t.players=t.players.filter(x=>x!==pid)}else if(t.withdrawn.includes(pid)){t.withdrawn=t.withdrawn.filter(x=>x!==pid)}else{return ask('Withdraw player',`Withdraw ${name(pid)}? They will be skipped in new pairings but keep their results.`,'Withdraw',()=>{t.withdrawn.push(pid);save()})}save()}
function rmGlobal(pid){const used=data.tournaments.some(t=>t.players.includes(pid));if(used)return toast('This player is in a tournament, so they cannot be removed from the directory');data.players=data.players.filter(p=>p.id!==pid);save()}
function scoreMatch(k,res){if(getT()?.format==='knockout'&&res==='1/2-1/2')return toast(KODRAW);const[rn,ix]=k.split(':'),p=getT()?.rounds.find(r=>r.number===+rn)?.pairings[+ix];if(!p||p.bye)return;p.result=p.result===res?null:res;save()}
function loadDemo(){ask('Load demo tournament','This adds a sample tournament with six players so you can try the app. You can delete it at any time.','Load demo',loadDemoNow,false)}
function loadDemoNow(){const ids=['Magnus Bot','Stockfish Jr','Claude','GPT Knight','Gemini Rook','Llama Bishop'].map(n=>addGlobal(n).id);
const t={id:uid(),name:'Demo Tournament',created:new Date().toISOString(),maxRounds:4,status:'setup',players:ids,rounds:[],withdrawn:[]};data.tournaments.push(t);cur=t.id;
const res=['1-0','1/2-1/2','0-1'];for(let i=0;i<2;i++){genRound(t);t.rounds[t.rounds.length-1].pairings.forEach(p=>{if(!p.bye)p.result=res[Math.floor(Math.random()*3)]})}genRound(t);save();go('detail');toast('Demo loaded. Round 3 is open for you to play.')}

/* board */
const pair=()=>{if(!match)return null;return data.tournaments.find(t=>t.id===match.t)?.rounds.find(r=>r.number===match.r)?.pairings[match.i]||null};
function overInfo(){if(clock.over)return clock.over;if(!ready||!chess.game_over())return null;if(chess.in_checkmate()){const w=chess.turn()==='w'?'Black':'White';return{res:w==='White'?'1-0':'0-1',text:`Checkmate · ${w} wins`}}
if(chess.in_stalemate())return{res:'1/2-1/2',text:'Draw by stalemate'};if(chess.insufficient_material())return{res:'1/2-1/2',text:'Draw · insufficient material'};if(chess.in_threefold_repetition())return{res:'1/2-1/2',text:'Draw by repetition'};return{res:'1/2-1/2',text:'Draw · 50-move rule'}}
function loadMatch(tid,rn,ix){if(!ready)return;const t=data.tournaments.find(x=>x.id===tid),p=t?.rounds.find(r=>r.number===rn)?.pairings[ix];if(!p||p.bye)return;
cur=tid;match={t:tid,r:rn,i:ix};chess=new Chess();setTcFor(t);clockReset();if(p.pgn){try{chess.load_pgn(p.pgn)}catch(e){}}sel=null;targets=[];$('bTitle').textContent=`${name(p.white)} vs ${name(p.black)}`;go('boardview');renderBoard();renderMatchSel()}
function renderMatchSel(){const s=$('matchSel');let o='<option value="practice">Practice board (not a tournament game)</option>';
data.tournaments.forEach(t=>t.rounds.forEach(r=>r.pairings.forEach((p,i)=>{if(!p.bye)o+=`<option value="${t.id}|${r.number}|${i}">${esc(t.name)} · R${r.number}: ${esc(name(p.white))} vs ${esc(name(p.black))}${p.result?' ✓':''}</option>`})));
s.innerHTML=o;s.value=match?`${match.t}|${match.r}|${match.i}`:'practice';if(match&&s.value!==`${match.t}|${match.r}|${match.i}`){match=null;s.value='practice'}}
function renderBoard(){const el=$('board');el.innerHTML='';if(!ready)return;
const files=flip?'hgfedcba':'abcdefgh',ranks=flip?[1,2,3,4,5,6,7,8]:[8,7,6,5,4,3,2,1],hist=chess.history({verbose:true}),lm=hist[hist.length-1];
ranks.forEach((rk,ri)=>[...files].forEach((f,fi)=>{const sq=f+rk,pc=chess.get(sq),b=document.createElement('button');
b.className='sq '+((f.charCodeAt(0)-97+rk)%2===0?'dark':'light')+(sel===sq?' sel':'')+(targets.includes(sq)?(pc?' cap':' legal'):'')+(lm&&(lm.from===sq||lm.to===sq)?' last':'');
b.dataset.sq=sq;b.setAttribute('aria-label',sq+(pc?` ${pc.color==='w'?'white':'black'} ${pc.type}`:''));
b.innerHTML=(pc?`<svg class="pc ${pc.color}" viewBox="0 0 45 45" aria-hidden="true"><use href="#${pc.type}"/></svg>`:'')+(fi===0?`<i class="rk">${rk}</i>`:'')+(ri===7?`<i class="fl">${f}</i>`:'');
b.onclick=()=>clickSq(sq);el.appendChild(b)}));
const o=overInfo(),tn=$('turn');tn.textContent=o?o.text:(chess.turn()==='w'?'White':'Black')+' to move';tn.className='turn'+(o?' over':chess.turn()==='b'?' black':'');
const p=pair();$('bStatus').textContent=o?(p?(p.result?'Game over. Result is recorded for this match.':'Game over.'):'Game over. Pick a tournament match to record it.'):chess.in_check()?'Check!':sel?`Selected ${sel}. Choose a highlighted square.`:'Select a piece, then a legal destination.';
const h=chess.history();let m='';for(let i=0;i<h.length;i+=2)m+=`<div class="mrow"><span>${i/2+1}.</span><span>${esc(h[i])}</span><span>${esc(h[i+1]||'')}</span></div>`;$('moveHist').innerHTML=m||'<span class="muted">No moves yet.</span>';
$('undo').disabled=!h.length}
function clickSq(sq){if(noClick)return;const pc=chess.get(sq);if(sel&&targets.includes(sq)){move(sel,sq);return}
if(pc&&pc.color===chess.turn()){sel=sq;targets=chess.moves({square:sq,verbose:true}).map(m=>m.to)}else{sel=null;targets=[]}renderBoard()}
function move(from,to){if(clock.over)return toast(clock.over.text);if(clock.paused)return toast('The clock is paused. Resume to keep playing.');if(AI.on&&AI.busy)return toast('The AI is thinking');const ms=chess.moves({square:from,verbose:true}).filter(m=>m.to===to);
if(ms.some(m=>m.flags.includes('p')))return pickPromo(chess.turn(),pr=>doMove(from,to,pr));
doMove(from,to)}
function doMove(from,to,promo){const m=chess.move({from,to,promotion:promo});if(!m)return toast('That move is not legal');after()}
function after(){clockMove();sel=null;targets=[];renderBoard();finish(overInfo());if(AI.on&&!overInfo())setTimeout(aiStep,Math.max(50,(+$('aiDelay').value||0)*1000))}
function finish(o){if(!o)return;const p=pair();if(p&&!p.result){if(isKO()&&o.res==='1/2-1/2')return toast('Drawn. '+KODRAW);p.pgn=chess.pgn();p.result=o.res;save();toast(o.text+' · result recorded')}else toast(o.text)}
function typed(){const v=$('moveIn').value.trim();if(!v||!ready)return;if(clock.over)return toast(clock.over.text);if(clock.paused)return toast('The clock is paused. Resume to keep playing.');if(AI.on&&AI.busy)return toast('The AI is thinking');let m=null;
if(/^[a-h][1-8][a-h][1-8][qrbn]?$/i.test(v)){const l=v.toLowerCase();m=chess.move({from:l.slice(0,2),to:l.slice(2,4),promotion:l[4]||'q'})}else m=chess.move(v,{sloppy:true});
if(!m)return toast('Move not recognised or illegal');$('moveIn').value='';after()}
function saveMoves(){const p=pair();if(!p)return toast('Choose a tournament match first');p.pgn=chess.pgn();const o=overInfo();if(o&&!p.result)p.result=o.res;save();toast('Moves saved to match')}
function setResult(r){if(isKO()&&r==='1/2-1/2')return toast(KODRAW);const p=pair();if(!p)return toast('Pick a tournament match first');p.result=r;save();toast('Result recorded')}
function copy(text,msg){
  const fb=()=>modal({title:'Copy this text',ok:'Done',cancel:'Close',body:`<div class="field"><label for="fCopy">Select all and copy</label><textarea id="fCopy" readonly rows="4">${esc(text)}</textarea></div>`,onOpen(){const t=$('fCopy');t.focus();t.select()}});
  if(!navigator.clipboard)return fb();navigator.clipboard.writeText(text).then(()=>toast(msg)).catch(fb)}
function copyPrompt(){const s=chess.turn()==='w'?'White':'Black';copy(`You are playing a legal game of standard chess as ${s}. Return exactly ONE move in SAN notation (for example Nf3, exd5, O-O, or e8=Q), with no explanation. Choose a strong move.\nCurrent position (FEN): ${chess.fen()}\nMoves so far (PGN): ${chess.pgn()||'(none)'}\nYour move:`,'AI prompt copied')}
function dl(text,file,type){const a=document.createElement('a'),u=URL.createObjectURL(new Blob([text],{type}));a.href=u;a.download=file;a.click();URL.revokeObjectURL(u)}
function dlPgn(){if(!chess.history().length)return toast('No moves to export yet');const c=new Chess();c.load_pgn(chess.pgn());const p=pair(),t=match&&data.tournaments.find(x=>x.id===match.t),o=overInfo();
c.header('Event',t?t.name:'Practice game','Site','Chess Arena','Date',new Date().toISOString().slice(0,10).replace(/-/g,'.'),'Round',p?String(match.r):'-','White',p?name(p.white):'White','Black',p?name(p.black):'Black','Result',(p&&p.result)||(o?o.res:'*'));
dl(c.pgn(),'jester14-game.pgn','application/x-chess-pgn');toast('PGN downloaded')}
function importData(f){if(!f)return;const r=new FileReader();r.onload=()=>{try{const d=JSON.parse(r.result);if(!Array.isArray(d.tournaments)||!Array.isArray(d.players))throw 0;
return ask('Import backup',`Import ${d.tournaments.length} tournament(s) and ${d.players.length} player(s)? This replaces all data on this device.`,'Replace my data',()=>{localStorage.setItem(KEY,JSON.stringify(d));data=load();cur=null;match=null;if(ready)chess=new Chess();save();go('home');toast('Backup imported')})}catch(e){toast('That file is not a valid Arena backup')}};r.readAsText(f)}

/* wiring */
document.addEventListener('click',e=>{const g=s=>e.target.closest(s);let x;
if(x=g('[data-view]'))return go(x.dataset.view);
if(x=g('[data-open]')){cur=x.dataset.open;renderDetail();return go('detail')}
if(x=g('[data-score]')){const[a,b,...c]=x.dataset.score.split(':');return scoreMatch(a+':'+b,c.join(':'))}
if(x=g('[data-play]')){const[a,b]=x.dataset.play.split(':');return loadMatch(cur,+a,+b)}
if(x=g('[data-rm-player]'))return rmGlobal(x.dataset.rmPlayer);
if(x=g('[data-rm-event]'))return rmEvPlayer(x.dataset.rmEvent);
if(x=g('[data-use-tpl]'))return newTournament(x.dataset.useTpl);
if(x=g('[data-del-tpl]')){const id=x.dataset.delTpl,tp=(data.templates||[]).find(y=>y.id===id);if(tp)ask('Delete template',`Delete the template "${tp.name}"?`,'Delete',()=>{data.templates=data.templates.filter(y=>y.id!==id);save()});return}
if(x=g('[data-result]'))return setResult(x.dataset.result)});
$('newT').onclick=$('heroNew').onclick=newTournament;$('heroDemo').onclick=loadDemo;
$('exportBtn').onclick=()=>{dl(JSON.stringify(data,null,2),'jester14-arena-backup.json','application/json');toast('Backup exported')};
$('importBtn').onclick=()=>$('importFile').click();$('importFile').onchange=e=>{importData(e.target.files[0]);e.target.value=''};
$('gAdd').onclick=()=>{const p=addGlobal($('gName').value);if(p){$('gName').value='';save();toast('Player saved')}};$('gName').onkeydown=e=>{if(e.key==='Enter')$('gAdd').click()};
$('addEv').onclick=addEvPlayers;$('genRound').onclick=()=>{const t=getT();if(t)genRound(t)};
$('roundCount').onchange=e=>{const t=getT();if(t){t.maxRounds=+e.target.value;save()}};
$('rename').onclick=()=>{const t=getT();if(!t)return;modal({title:'Rename tournament',ok:'Save',body:`<div class="field"><label for="fRen">Tournament name</label><input type="text" id="fRen" name="name" maxlength="60" value="${esc(t.name)}" autocomplete="off"></div>`,onOpen(){$('fRen').select()},onSubmit(fd){const n=String(fd.get('name')).trim();if(!n){ferr('fRen','Name cannot be empty');return false}t.name=n;save()}})};
$('delT').onclick=()=>{const t=getT();if(!t)return;ask('Delete tournament',`Delete "${t.name}" and all its rounds? This cannot be undone.`,'Delete tournament',()=>{if(sb&&user&&t.owner===user.id)sb.from('tournaments').delete().eq('id',t.id).then(()=>{});data.tournaments=data.tournaments.filter(x=>x.id!==t.id);if(match&&match.t===t.id){match=null;if(ready)chess=new Chess()}cur=null;save();go('tournaments')})};
$('finish').onclick=()=>{const t=getT();if(t){t.status='finished';save();toast('Tournament finished')}};$('reopen').onclick=()=>{const t=getT();if(t){t.status='active';save()}};
$('flip').onclick=()=>{flip=!flip;renderBoard();drawClock()};$('undo').onclick=()=>{clockPause();chess.undo();sel=null;targets=[];renderBoard()};
$('reset').onclick=()=>ask('Reset board','Reset the board to the starting position? Moves not saved to a match will be lost.','Reset board',()=>{chess=new Chess();clockReset();sel=null;targets=[];renderBoard()});
$('play').onclick=typed;$('moveIn').onkeydown=e=>{if(e.key==='Enter')typed()};$('saveMoves').onclick=saveMoves;
$('copyFen').onclick=()=>copy(chess.fen(),'FEN copied');$('copyPrompt').onclick=copyPrompt;$('dlPgn').onclick=dlPgn;
$('matchSel').onchange=e=>{const v=e.target.value;if(v==='practice'){match=null;chess=new Chess();clockReset();sel=null;targets=[];$('bTitle').textContent='Practice board';renderBoard();return}const[t,r,i]=v.split('|');loadMatch(t,+r,+i)};
/* ---------- AI vs AI ---------- */
const AI={on:false,busy:false};
const AIK='jester14_ai_cfg',AIIDS=['aiWp','aiWm','aiWk','aiBp','aiBm','aiBk','aiBase','aiDelay','aiLegal'];
try{const c=JSON.parse(localStorage.getItem(AIK)||'{}');AIIDS.forEach(i=>{if(i in c){const el=$(i);if(el.type==='checkbox')el.checked=c[i];else el.value=c[i]}})}catch(e){}
$('aiPanel').addEventListener('input',()=>{try{const c={};AIIDS.forEach(i=>{const el=$(i);c[i]=el.type==='checkbox'?el.checked:el.value});localStorage.setItem(AIK,JSON.stringify(c))}catch(e){}});
const aiSide=c=>{const k=c==='w'?'W':'B';return{prov:$('ai'+k+'p').value,model:$('ai'+k+'m').value.trim(),key:$('ai'+k+'k').value.trim()}};
function aiStop(){AI.on=false;const b=$('aiStart');b.textContent='Start AI game';b.classList.add('primary')}
async function askModel(cfg,prompt){
  const ctl=new AbortController(),to=setTimeout(()=>ctl.abort(),60000);
  try{
    let url,headers,body;
    if(cfg.prov==='anthropic'){url='https://api.anthropic.com/v1/messages';headers={'content-type':'application/json','x-api-key':cfg.key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'};body={model:cfg.model,max_tokens:200,messages:[{role:'user',content:prompt}]}}
    else{url=($('aiBase').value.trim()||'https://api.openai.com/v1').replace(/\/$/,'')+'/chat/completions';headers={'content-type':'application/json',authorization:'Bearer '+cfg.key};body={model:cfg.model,messages:[{role:'user',content:prompt}]}}
    const r=await fetch(url,{method:'POST',headers,body:JSON.stringify(body),signal:ctl.signal});
    if(!r.ok)throw new Error(r.status+' '+(await r.text()).slice(0,200));
    const d=await r.json();
    return cfg.prov==='anthropic'?(d.content||[]).map(x=>x.text||'').join(' '):(d.choices?.[0]?.message?.content||'');
  }finally{clearTimeout(to)}
}
function parseMove(text){
  const L=chess.moves({verbose:true});
  for(const raw of String(text).replace(/[\n,;]/g,' ').split(/\s+/)){
    const t=raw.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9+#=-]+$/g,'').replace(/0/g,'O').replace(/[+#]/g,'');if(!t)continue;
    for(const m of L)if(m.san.replace(/[+#]/g,'')===t||(m.from+m.to+(m.promotion||''))===t.toLowerCase())return m}
  return null}
async function aiStep(){
  if(!AI.on||AI.busy||!ready)return;
  if(overInfo()){aiStop();return}
  const c=chess.turn(),cfg=aiSide(c),nm=c==='w'?'White':'Black';
  if(cfg.prov==='human'){$('bStatus').textContent=`${nm} is human. Make your move.`;return}
  if(!cfg.model||!cfg.key){aiStop();return toast(`Enter a model name and API key for ${nm}`)}
  AI.busy=true;let mv=null,bad='',err=null;
  try{
    for(let i=0;i<3&&!mv&&AI.on;i++){
      $('bStatus').textContent=`${nm} (${cfg.model}) is thinking…`+(i?` attempt ${i+1} of 3`:'');
      const text=await askModel(cfg,`You are playing chess as ${nm}. Reply with exactly one legal move in SAN (for example Nf3, exd5, O-O, e8=Q) and nothing else.\nFEN: ${chess.fen()}\nMoves so far: ${chess.pgn()||'(none)'}`+($('aiLegal').checked?`\nLegal moves: ${chess.moves().join(', ')}`:'')+(bad?`\nYour previous answer "${bad}" was not a legal move. Try again.`:''));
      mv=parseMove(text);if(!mv)bad=String(text).trim().slice(0,40)
    }
  }catch(e){err=e}
  AI.busy=false;
  if(!AI.on)return;
  if(err){aiStop();return toast('AI error: '+(err.name==='AbortError'?'the request timed out':err.message))}
  if(!mv){aiStop();const o={res:c==='w'?'0-1':'1-0',text:`${nm} lost: no legal move after 3 tries`};clock.over=o;renderBoard();finish(o);return}
  chess.move({from:mv.from,to:mv.to,promotion:mv.promotion});after()}
$('aiStart').onclick=()=>{
  if(AI.on){aiStop();$('bStatus').textContent='AI game stopped.';return}
  if(!ready)return;if(overInfo())return toast('This game is over. Reset the board or pick another match.');
  AI.on=true;$('aiStart').textContent='Stop AI game';$('aiStart').classList.remove('primary');aiStep()};
$('aiForget').onclick=()=>{$('aiWk').value=$('aiBk').value='';$('aiPanel').dispatchEvent(new Event('input'));toast('Keys cleared from this device')};

/* ---------- Chess clock ---------- */
const clock={on:false,base:0,inc:0,w:0,b:0,run:null,last:0,started:false,over:null,t:null,paused:null};
const TC={off:null,'1+0':[60,0],'3+0':[180,0],'3+2':[180,2],'5+0':[300,0],'5+3':[300,3],'10+0':[600,0],'10+5':[600,5],'15+10':[900,10],'30+0':[1800,0]};
const left=c=>clock[c]-(clock.run===c?Date.now()-clock.last:0);
const fmtC=ms=>{ms=Math.max(0,ms);if(ms<20000)return(ms/1000).toFixed(1);const s=Math.ceil(ms/1000);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};
function clockReset(){aiStop();const v=TC[$('tc').value];clearInterval(clock.t);clock.on=!!v;clock.base=v?v[0]*1000:0;clock.inc=v?v[1]*1000:0;clock.w=clock.b=clock.base;clock.run=null;clock.paused=null;clock.started=false;clock.over=null;drawClock()}
function clockPause(){aiStop();if(clock.run){clock[clock.run]=left(clock.run);clock.run=null}clearInterval(clock.t);clock.paused=null;clock.started=false;clock.over=null;drawClock()}
function drawClock(){const box=document.querySelector('.clocks');box.hidden=!clock.on;$('clockCtl').hidden=!clock.on;if(!clock.on)return;$('clkPause').textContent=clock.paused?'Resume':'Pause';$('clkPause').disabled=!(clock.run||clock.paused);
$('clkB').style.order=flip?2:0;$('clkW').style.order=flip?0:2;
for(const c of['w','b']){const el=$(c==='w'?'clkW':'clkB'),ms=left(c);el.textContent=(c==='w'?'White ':'Black ')+fmtC(ms);
el.classList.toggle('run',clock.run===c);el.classList.toggle('paused',!!clock.paused);el.classList.toggle('low',ms<10000&&ms>0);el.classList.toggle('flag',!!clock.over&&clock.over.flag===c)}}
function tick(){if(clock.run&&!clock.over&&left(clock.run)<=0){const loser=clock.run;clock[loser]=0;clock.run=null;clearInterval(clock.t);
clock.over={res:loser==='w'?'0-1':'1-0',text:`${loser==='w'?'White':'Black'} lost on time`,flag:loser};renderBoard();finish(clock.over)}drawClock()}
function clockMove(){if(!clock.on||clock.over||clock.paused)return;const mover=chess.turn()==='w'?'b':'w';
if(clock.run===mover)clock[mover]=left(mover)+clock.inc;
clock.started=true;clearInterval(clock.t);
if(chess.game_over()){clock.run=null}else{clock.run=chess.turn();clock.last=Date.now();clock.t=setInterval(tick,100)}
drawClock()}
function clockHold(){if(!clock.on||clock.over||!clock.run)return;aiStop();clock[clock.run]=left(clock.run);clock.paused=clock.run;clock.run=null;clearInterval(clock.t);drawClock()}
function clockResume(){if(!clock.paused)return;clock.run=clock.paused;clock.paused=null;clock.last=Date.now();clearInterval(clock.t);clock.t=setInterval(tick,100);drawClock()}
function clockAdjust(c,ms){if(!clock.on)return;if(clock.over)return toast('The game is over');clock[c]=Math.max(1000,left(c)+ms);if(clock.run===c)clock.last=Date.now();drawClock();toast(`${c==='w'?'White':'Black'} ${ms>0?'+':'−'}1 minute`)}
$('clkPause').onclick=()=>clock.paused?clockResume():clockHold();
$('clockCtl').addEventListener('click',e=>{const b=e.target.closest('[data-adj]');if(!b)return;const[c,v]=b.dataset.adj.split(':');clockAdjust(c,+v)});
let tcPrev=$('tc').value;
function setTcFor(t){const v=(t&&t.clock)||'off';$('tc').value=[...$('tc').options].some(o=>o.value===v)?v:'off';tcPrev=$('tc').value}
$('tc').onchange=()=>{const v=$('tc').value;
  if(clock.on&&chess.history().length&&!clock.over){
    dlg.addEventListener('close',()=>{if($('tc').value!==tcPrev)$('tc').value=tcPrev},{once:true});
    ask('Change the time control?','This resets both clocks to the new time. The game itself carries on.','Reset clocks',()=>{tcPrev=v;clockReset();toast('Clocks reset. They start again on the next move.')},false);return}
  tcPrev=v;clockReset();if(chess.history().length)toast('Clock set. It starts on the next move.')};
clockReset();

/* ---------- Drag and drop (click-to-move still works) ---------- */
let drag=null,noClick=false;
const boardEl=$('board');
boardEl.addEventListener('pointerdown',e=>{
  if(!ready||e.button>0||clock.over||clock.paused)return;
  const el=e.target.closest('.sq');if(!el)return;
  const sq=el.dataset.sq,pc=chess.get(sq);
  if(!pc||pc.color!==chess.turn())return;
  drag={sq,x:e.clientX,y:e.clientY,on:false,id:e.pointerId};
});
boardEl.addEventListener('pointermove',e=>{
  if(!drag)return;
  if(!drag.on){
    if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<6)return;
    drag.on=true;sel=drag.sq;targets=chess.moves({square:sel,verbose:true}).map(m=>m.to);renderBoard();
    try{boardEl.setPointerCapture(drag.id)}catch(_){}
    const src=boardEl.querySelector(`[data-sq="${sel}"]`),svg=src.querySelector('.pc'),r=src.getBoundingClientRect();
    svg.style.opacity='.3';
    drag.w=r.width*1.08;
    drag.g=svg.cloneNode(true);
    drag.g.style.cssText=`position:fixed;left:0;top:0;z-index:50;pointer-events:none;opacity:1;width:${drag.w}px;height:${drag.w}px;filter:drop-shadow(0 8px 10px #0007)`;
    document.body.appendChild(drag.g);
  }
  drag.g.style.transform=`translate(${e.clientX-drag.w/2}px,${e.clientY-drag.w/2}px)`;
});
function endDrag(e,commit){
  if(!drag)return;const d=drag;drag=null;
  if(!d.on)return;
  d.g.remove();noClick=true;setTimeout(()=>{noClick=false},0);
  const to=commit?document.elementFromPoint(e.clientX,e.clientY)?.closest('.sq')?.dataset.sq:null;
  if(to&&targets.includes(to))move(sel,to);else{sel=null;targets=[];renderBoard()}
}
boardEl.addEventListener('pointerup',e=>endDrag(e,true));
boardEl.addEventListener('pointercancel',e=>endDrag(e,false));

/* ---------- Cloud sync (Supabase) ---------- */
const SB_URL='https://cwpahhtyfbeibddxftwk.supabase.co',SB_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN3cGFoaHR5ZmJlaWJkZHhmdHdrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIxODQ5MzUsImV4cCI6MjEwNzc2MDkzNX0.ZVJTADxzjO50DAznfLa2nJzmAyVeQAWkUZwc5_8jcHg';
const sb=(window.supabase&&!SB_URL.includes('YOUR-'))?supabase.createClient(SB_URL,SB_KEY):null;
let user=null,RO=false,syncT=null;const pushed={};
const sharedId=new URLSearchParams(location.search).get('t');
const sig=t=>JSON.stringify({...t,rev:0});
function queueSync(){if(!sb||!user||RO||!navigator.onLine)return;clearTimeout(syncT);syncT=setTimeout(push,900)}
async function push(){
  const rows=[];
  for(const t of data.tournaments){
    if(t.owner&&t.owner!==user.id)continue;
    t.owner=user.id;
    t.names=Object.fromEntries(t.players.map(p=>[p,name(p)]));
    const s=sig(t);if(pushed[t.id]===s)continue;
    t.rev=(t.rev||0)+1;pushed[t.id]=s;
    rows.push({id:t.id,owner:user.id,data:t,updated_at:new Date().toISOString()});
  }
  if(!rows.length)return;
  const{error}=await sb.from('tournaments').upsert(rows);
  if(error){rows.forEach(r=>delete pushed[r.id]);toast('Cloud sync failed. Your data is still saved on this device.');return}
  try{localStorage.setItem(KEY,JSON.stringify(data))}catch(e){}
}
async function pull(){
  const{data:rows,error}=await sb.from('tournaments').select('data').eq('owner',user.id);
  if(error)return toast('Could not load your cloud data');
  for(const{data:rt}of rows){
    const i=data.tournaments.findIndex(t=>t.id===rt.id);
    if(i<0||(rt.rev||0)>(data.tournaments[i].rev||0)){
      if(i<0)data.tournaments.push(rt);else data.tournaments[i]=rt;
      pushed[rt.id]=sig(rt);
    }
    Object.entries(rt.names||{}).forEach(([pid,n])=>{if(!data.players.some(p=>p.id===pid))data.players.push({id:pid,name:n})});
  }
  save();toast('Synced with your account');
}
function setUser(u){const was=user;user=u;$('authBtn').textContent=u?`Sign out (${u.email||u.user_metadata?.user_name||'account'})`:'Sign in with GitHub';if(u&&(!was||was.id!==u.id))pull()}
async function initAuth(){
  if(!sb){$('authBtn').hidden=true;$('shareBtn').hidden=true;return}
  const{data:{session}}=await sb.auth.getSession();setUser(session?.user||null);
  sb.auth.onAuthStateChange((_e,s)=>setUser(s?.user||null));
}
$('authBtn').onclick=async()=>{
  if(user){await sb.auth.signOut();return}
  const{error}=await sb.auth.signInWithOAuth({provider:'github',options:{redirectTo:location.origin+location.pathname}});
  if(error)toast('Could not start sign-in: '+error.message);
};
$('shareBtn').onclick=()=>{const t=getT();
  if(!sb)return toast('Cloud sync is not configured yet');
  if(!user)return toast('Sign in first so this tournament is saved online');
  if(!t||t.owner!==user.id)return toast('Still syncing. Try again in a moment');
  copy(`${location.origin}${location.pathname}?t=${t.id}`,'Share link copied')};
async function loadShared(){
  RO=true;document.body.classList.add('ro');
  if(!sb){RO=false;document.body.classList.remove('ro');toast('Cloud sync is not configured');return renderAll()}
  const fetchIt=async()=>{
    const{data:row,error}=await sb.from('tournaments').select('data').eq('id',sharedId).maybeSingle();
    if(error||!row){toast(navigator.onLine?'Tournament not found':'You are offline. Live links need an internet connection.');return false}
    const t=row.data;
    data={tournaments:[t],players:Object.entries(t.names||{}).map(([id,n])=>({id,name:n}))};cur=t.id;renderAll();return true};
  if(await fetchIt()){go('detail');setInterval(fetchIt,15000)}else{renderAll();go('home')}
}
/* ---------- Offline and install ---------- */
function netUI(){$('netBadge').hidden=navigator.onLine}
addEventListener('offline',()=>{netUI();toast('You are offline. Everything is saved on this device.')});
addEventListener('online',()=>{netUI();toast('Back online');if(sb&&user&&!RO)push()});
netUI();
let installEv=null;
addEventListener('beforeinstallprompt',e=>{e.preventDefault();installEv=e;$('installBtn').hidden=false});
$('installBtn').onclick=async()=>{if(!installEv)return;installEv.prompt();await installEv.userChoice;installEv=null;$('installBtn').hidden=true};
addEventListener('appinstalled',()=>{$('installBtn').hidden=true;toast('App installed')});
if('serviceWorker' in navigator&&location.protocol!=='file:')addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
if(sharedId)loadShared();else{renderAll();initAuth()}
