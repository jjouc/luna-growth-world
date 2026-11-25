'use strict';
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dateKey=(d=new Date())=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
const localDate=key=>new Date(key+'T12:00:00');
const prettyDate=key=>localDate(key).toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'short'});
const uid=()=>crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2);
const tasks=[
 {name:'写一页字',icon:'✎',text:'认真写完一页字，看看自己喜欢的那个字。'},
 {name:'读一本故事',icon:'📖',text:'读一本故事，和家长聊聊喜欢的角色。'},
 {name:'认字',icon:'🌷',text:'完成今天与家长约定的认字内容。'},
 {name:'背一首古诗',icon:'☾',text:'背一首古诗，感受诗里的小世界。'},
 {name:'读英语',icon:'Aa',text:'完成今天约定的英语朗读。'},
 {name:'学思维',icon:'🧩',text:'完成今天约定的思维练习。'},
 {name:'读英语绘本',icon:'✧',text:'读一本英语绘本，收下一根魔法棒。'}
];
const cardTypes=[
 {id:'dishes',name:'洗碗卡',icon:'🍽️',kind:'chore',description:'完成一次洗碗任务，和家长约定适合自己的范围。'},
 {id:'shoes',name:'摆鞋子卡',icon:'👟',kind:'chore',description:'把家里的鞋子整理摆放一次。'},
 {id:'tv-30',name:'看电视半小时卡',icon:'📺',kind:'leisure',description:'看电视 30 分钟，和家长约定使用时间。'},
 {id:'tv-60',name:'看电视一小时卡',icon:'📺',kind:'leisure',description:'看电视 60 分钟，和家长约定使用时间。'},
 {id:'playground',name:'游乐场卡',icon:'🎠',kind:'outing',description:'加入待安排清单，和家长一起安排一次游乐场活动。'},
 {id:'hike',name:'爬山卡',icon:'⛰️',kind:'outing',description:'加入待安排清单，和家长一起安排一次爬山活动。'},
 {id:'table',name:'擦桌子卡',icon:'🧽',kind:'chore',description:'擦干净一次桌子，家长确认完成。'}
];
const themes=[
 ['雪花城堡','一月 · 白雪的邀请','#f2ecf7','#dcd5ec','#d9e6ef'],
 ['玫瑰花园','二月 · 玫瑰的约定','#fae7ef','#f1c7d8','#e1d7ee'],
 ['樱花小径','三月 · 春风来信','#f9e9ef','#f0c9dc','#d9e9df'],
 ['蝴蝶山谷','四月 · 蝴蝶的舞会','#eef0dc','#d7e5b7','#e2d9ef'],
 ['铃兰秘境','五月 · 藏在花里的心愿','#e6f0e5','#c8dfcd','#dce7f3'],
 ['珍珠海湾','六月 · 美人鱼的歌','#e5f1f4','#c7e3e8','#e3d6ef'],
 ['星光舞会','七月 · 星星也会跳舞','#f1e9f7','#daceef','#f4dcdf'],
 ['向日葵庄园','八月 · 金色的小冒险','#faf0d9','#eee0aa','#dfe8df'],
 ['月光湖畔','九月 · 月亮的礼物','#eceaf8','#d9d6ef','#d0e2ef'],
 ['南瓜马车','十月 · 出发去城堡','#f9eadc','#f0d3b6','#dfdedf'],
 ['枫叶森林','十一月 · 秋日的秘密','#f6e5df','#ecc9be','#e1ddd8'],
 ['冬日水晶宫','十二月 · 一封魔法来信','#edeaf7','#d8d4eb','#d4e5ee']
];
const defaultState=()=>({version:1,settings:{nickname:'Luna'},days:{},wishes:[
 {id:'family-game',name:'一起玩喜欢的游戏',description:'和爸爸或妈妈一起玩半小时。',cost:8,icon:'🎮'},
 {id:'family-movie',name:'家庭电影之夜',description:'选一部喜欢的电影，一起看。',cost:12,icon:'🎬'},
 {id:'little-adventure',name:'周末小冒险',description:'和家长一起约定一次户外活动。',cost:15,icon:'🌳'}
],redemptions:[],draws:[],backupAt:null});
let state,db,page='garden',selectedDate=dateKey(),monthOffset=0,busy=false,pendingImport=null,toastTimer;
const dayData=(key=selectedDate)=>state.days[key]||{tasks:Array(7).fill(false)};
const crownsFor=day=>(day?.tasks||[]).slice(0,6).filter(Boolean).length;
const wandsFor=day=>day?.tasks?.[6]?1:0;
const crownEarned=(s=state)=>Object.values(s.days).reduce((sum,d)=>sum+crownsFor(d),0);
const crownSpent=(s=state)=>s.redemptions.reduce((sum,r)=>sum+r.cost,0);
const crownBalance=(s=state)=>crownEarned(s)-crownSpent(s);
const wandEarned=(s=state)=>Object.values(s.days).reduce((sum,d)=>sum+wandsFor(d),0);
const wandBalance=(s=state)=>wandEarned(s)-s.draws.length;
function validateState(raw){
 const s=structuredClone(raw),fail=()=>{throw new Error('备份内容不完整或格式不正确，请使用童话花园导出的备份。');};
 const str=(v,max)=>typeof v==='string'&&v.length<=max;
 const integer=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
 const date=v=>str(v,10)&&/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(v)&&!isNaN(localDate(v))&&dateKey(localDate(v))===v&&v>='2000-01-01'&&v<='2100-12-31';
 const stamp=v=>str(v,40)&&!isNaN(Date.parse(v));
 if(!s||s.version!==1||!s.settings||!str(s.settings.nickname,30)||!s.settings.nickname.trim())fail();
 if(!s.days||typeof s.days!=='object'||Array.isArray(s.days)||Object.keys(s.days).length>37000)fail();
 for(const [key,d] of Object.entries(s.days))if(!date(key)||!d||!Array.isArray(d.tasks)||d.tasks.length!==7||!d.tasks.every(v=>typeof v==='boolean'))fail();
 for(const key of ['wishes','redemptions','draws']){
  if(!Array.isArray(s[key])||s[key].length>10000)fail();const ids=new Set();
  for(const r of s[key]){if(!r||!str(r.id,100)||!r.id||ids.has(r.id))fail();ids.add(r.id);}
 }
 for(const r of s.wishes)if(!str(r.name,60)||!r.name.trim()||!str(r.description,200)||!integer(r.cost,1,10000)||!str(r.icon,20))fail();
 for(const r of s.redemptions)if(!str(r.wishId,100)||!str(r.name,60)||!r.name.trim()||!integer(r.cost,1,10000)||!stamp(r.createdAt)||(r.fulfilledAt!==null&&!stamp(r.fulfilledAt)))fail();
 for(const r of s.draws)if(!cardTypes.some(c=>c.id===r.cardId)||r.cost!==1||r.currency!=='wand'||!stamp(r.createdAt)||(r.usedAt!==null&&!stamp(r.usedAt)))fail();
 if((s.backupAt!==null&&!stamp(s.backupAt))||crownBalance(s)<0||wandBalance(s)<0)fail();return s;
}
function openDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open('luna-growth-world',1);r.onupgradeneeded=()=>r.result.createObjectStore('data');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
function readDB(){return new Promise((resolve,reject)=>{const r=db.transaction('data').objectStore('data').get('state');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
function writeDB(next){return new Promise((resolve,reject)=>{const tx=db.transaction('data','readwrite'),store=tx.objectStore('data'),r=store.get('state');let conflict;
 r.onsuccess=()=>{try{if(r.result&&JSON.stringify(validateState(r.result))!==JSON.stringify(state))throw new Error('另一窗口更新了花园，请刷新后再操作。');store.put(next,'state');}catch(e){conflict=e;tx.abort();}};
 tx.oncomplete=()=>resolve();tx.onerror=()=>reject(conflict||tx.error);tx.onabort=()=>reject(conflict||tx.error||new Error('保存被中断。'));
});}
async function commit(mutator,message,close=false){if(busy)return false;busy=true;$('#save-state').textContent='正在保存…';try{const next=structuredClone(state);mutator(next);validateState(next);await writeDB(next);state=next;if(close)$('#editor').close();render();$('#save-state').textContent='已保存在此设备';if(message)toast(message);return true;}catch(e){$('#save-state').textContent='保存失败';if($('#editor').open)formError(e.message);else toast(e.message);return false;}finally{busy=false;}}
function requireToday(){if(selectedDate!==dateKey())throw new Error('这一天已经结束，只能查看，不能补打卡或修改任务。');}
function toast(message){clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').hidden=false;toastTimer=setTimeout(()=>$('#toast').hidden=true,4000);}
function formError(message){let el=$('.form-error',$('#editor'));if(!el){el=document.createElement('p');el.className='form-error';el.setAttribute('role','alert');$('#dialog-content').append(el);}el.textContent=message;}
function dialog(title,body){$('#dialog-content').innerHTML='<div class="dialog-heading"><h2 id="dialog-title">'+esc(title)+'</h2><button class="close-button" data-close aria-label="关闭">×</button></div>'+body;if(!$('#editor').open)$('#editor').showModal();}
function confirmDialog(title,text,action,id,label='确认'){dialog(title,'<p class="dialog-text">'+esc(text)+'</p><div class="dialog-actions"><button class="secondary" data-close>取消</button><button class="primary" data-action="'+action+'" data-id="'+esc(id||'')+'">'+esc(label)+'</button></div>');}
function go(next){if(!['garden','wishes'].includes(next))return;page=next;location.hash=next;render();}
function render(){if(!state)return;$('.brand strong').textContent=state.settings.nickname+' 的童话花园';$('#greeting').textContent=state.settings.nickname+' 的小小冒险';$('#crown-balance').textContent=crownBalance();$('#wand-balance').textContent=wandBalance();$$('.nav-button').forEach(b=>{b.classList.toggle('active',b.dataset.page===page);if(b.dataset.page===page)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});$('#content').innerHTML=page==='wishes'?renderWishes():renderGarden();}
function castle(){return '<svg viewBox="0 0 200 200" fill="none" aria-hidden="true"><path d="M30 89h37v79H30zM133 89h37v79h-37z" fill="#dbc9e9"/><path d="M64 74h72v94H64z" fill="#f5dfdf"/><path d="M20 89l29-42 29 42zM122 89l29-42 29 42z" fill="#b29cc8"/><path d="M55 74l45-53 45 53z" fill="#d8a7b9"/><path d="M100 22V6m0 0l25 6-25 7" stroke="#dcb870" stroke-width="4" stroke-linecap="round"/><path d="M86 168v-34a14 14 0 0128 0v34" fill="#c59baa"/><path d="M44 109h10v17H44zM146 109h10v17h-10zM93 84h14v23H93z" fill="#fff7dc"/><path d="M20 169h160" stroke="#a995b3" stroke-width="4" stroke-linecap="round"/><path d="M42 144h12M146 144h12" stroke="#b8a2cd" stroke-width="3"/></svg>';}
function monthDates(){const first=localDate(dateKey());first.setDate(1);first.setMonth(first.getMonth()+monthOffset);return Array.from({length:new Date(first.getFullYear(),first.getMonth()+1,0).getDate()},(_,i)=>{const d=new Date(first);d.setDate(i+1);return dateKey(d);});}
function renderGarden(){
 const dates=monthDates(),theme=themes[localDate(dates[0]).getMonth()],cols=matchMedia('(max-width:560px)').matches?5:7,rows=Math.ceil(dates.length/cols),height=rows*126+80;
 const points=dates.map((key,i)=>{const row=Math.floor(i/cols),col=row%2?cols-1-i%cols:i%cols;return {key,x:11+78*col/(cols-1),y:65+row*126};});
 let path='M '+points[0].x*10+' '+points[0].y;points.slice(1).forEach((p,i)=>{const prev=points[i];if(p.y===prev.y)path+=' L '+p.x*10+' '+p.y;else{const edge=p.x>50?55:-55;path+=' C '+(prev.x*10+edge)+' '+prev.y+' '+(p.x*10+edge)+' '+p.y+' '+p.x*10+' '+p.y;}});
 const visited=dates.filter(key=>crownsFor(state.days[key])+wandsFor(state.days[key])>0).length;
 return '<section class="garden"><div class="page-heading"><div><p class="eyebrow">'+esc(theme[1])+'</p><h1>'+esc(theme[0])+'</h1><p>故事从今天开始，每一小步都值得珍藏。</p></div><button class="primary today-entry" data-action="open-today">✧ 今天的小任务</button></div><div class="map-panel"><div class="map-toolbar"><div class="month-navigation"><button class="month-arrow" data-action="prev-month" aria-label="上个月" '+(dates[0]<='2000-01-01'?'disabled':'')+'>‹</button><strong>'+localDate(dates[0]).toLocaleDateString('zh-CN',{year:'numeric',month:'long'})+'</strong><button class="month-arrow" data-action="next-month" aria-label="下个月" '+(monthOffset>=0?'disabled':'')+'>›</button></div><span class="map-count">本月探索 <strong>'+visited+'</strong> 天</span></div><div class="fairy-map" style="--map-height:'+height+'px;--ground:'+theme[2]+';--petal:'+theme[3]+';--pond:'+theme[4]+'"><div class="map-lake"></div><span class="map-castle">'+castle()+'</span>'+Array.from({length:rows},(_,i)=>'<span class="map-flower" style="left:3%;top:'+(i*126+110)+'px">✿</span><span class="map-sparkle" style="right:3%;top:'+(i*126+108)+'px">✧</span>').join('')+'<svg class="map-route" viewBox="0 0 1000 '+height+'" preserveAspectRatio="none" aria-hidden="true"><path class="route-shadow" d="'+path+'"/><path class="route-fill" d="'+path+'"/><path class="route-dots" d="'+path+'"/></svg>'+points.map((p,i)=>{const d=state.days[p.key],crowns=crownsFor(d),wands=wandsFor(d),today=p.key===dateKey(),future=p.key>dateKey();return '<button class="day-node'+(today?' is-today':'')+(future?' is-future':'')+(crowns+wands?' explored':'')+'" data-action="open-day" data-date="'+p.key+'" style="left:'+p.x+'%;top:'+p.y+'px" aria-label="'+prettyDate(p.key)+'，'+(future?'还没到这一天':'获得 '+crowns+' 个皇冠、'+wands+' 根魔法棒')+'" '+(future?'disabled':'')+'>'+(today?'<span class="today-label">你在这里</span>':'')+'<span class="node-surface">'+(i===dates.length-1?'♛':i+1)+'</span><span class="node-caption">'+(today?'今天':i+1+'日')+'</span>'+(!future?'<span class="day-rewards"><span class="crown-symbol" aria-hidden="true">♛</span>'+crowns+'<span class="wand-symbol" aria-hidden="true">✧</span>'+wands+'</span>':'<span class="future-dot">·</span>')+'</button>';}).join('')+'</div><div class="map-legend"><span><i class="legend-today"></i>今天</span><span><i class="legend-explored"></i>已收获</span><span>♛ 皇冠 · ✧ 魔法棒</span></div></div><p class="map-note">每天最多 6 个皇冠和 1 根魔法棒。只在当天打卡，过去的冒险保留查看。</p></section>';
}
function dayDialog(){const d=dayData(),active=selectedDate===dateKey(),count=d.tasks.filter(Boolean).length;dialog(prettyDate(selectedDate)+'的小任务','<div class="day-summary"><p>'+(!active?'这一天已结束，仅查看记录。':'每完成一项，就收下属于自己的小奖励。')+'</p><strong>'+count+' / 7</strong></div><div class="task-list">'+tasks.map((t,i)=>'<article class="task'+(i===6?' wand-task':'')+(d.tasks[i]?' done':'')+'"><span class="task-icon" aria-hidden="true">'+t.icon+'</span><div class="task-copy"><h3>'+t.name+'</h3><p>'+t.text+'</p></div><button class="task-button" data-action="task" data-index="'+i+'" aria-label="'+t.name+'：'+(d.tasks[i]?'已完成，点击修正':i===6?'领取魔法棒':'领取皇冠')+'" aria-pressed="'+d.tasks[i]+'" '+(!active?'disabled':'')+'><span class="'+(i===6?'wand-symbol':'crown-symbol')+'" aria-hidden="true">'+(i===6?'✧':'♛')+'</span><span>'+(d.tasks[i]?'已完成':active?'做到了':'已结束')+'</span></button></article>').join('')+'</div><div class="day-footer"><span>收获 <b>'+crownsFor(d)+'</b> 个皇冠 · <b>'+wandsFor(d)+'</b> 根魔法棒</span><button class="secondary" data-close>回到花园</button></div>');}
function renderWishes(){const history=state.redemptions.slice().sort((a,b)=>b.createdAt.localeCompare(a.createdAt)),cards=state.draws.slice().sort((a,b)=>b.createdAt.localeCompare(a.createdAt));return '<section><div class="page-heading"><div><p class="eyebrow">把小小努力，变成喜欢的时光</p><h1>心愿商店</h1><p>皇冠兑换心愿，魔法棒打开惊喜。</p></div><button class="secondary" data-action="new-wish">＋ 约定心愿</button></div><div class="blind-box"><div class="box-art" aria-hidden="true"><span>🎁</span><i>✧</i></div><div><p class="eyebrow">一根魔法棒，一份小惊喜</p><h2>魔法礼盒</h2><p>使用 1 根魔法棒，随机抽一张卡。</p><button class="primary" data-action="draw-box" '+(wandBalance()<1?'disabled':'')+'>✧ 1 根魔法棒抽一次</button><button class="text-button" data-action="box-rules">看看礼盒里有什么</button></div></div><div class="shop-summary"><span>♛ 可用皇冠 <strong>'+crownBalance()+'</strong></span><span>累计获得 '+crownEarned()+' · 已兑换 '+crownSpent()+'</span></div><div class="wish-grid">'+(state.wishes.length?state.wishes.map(r=>'<article class="wish-card"><div class="wish-art" aria-hidden="true">'+esc(r.icon)+'</div><div class="wish-copy"><h3>'+esc(r.name)+'</h3><p>'+esc(r.description)+'</p><div class="wish-bottom"><span class="price">♛ '+r.cost+'</span><button class="primary" data-action="redeem" data-id="'+esc(r.id)+'" '+(crownBalance()<r.cost?'disabled':'')+'>'+(crownBalance()>=r.cost?'兑换心愿':'还差 '+(r.cost-crownBalance()))+'</button></div></div></article>').join(''):'<div class="empty">先和家长约定一份喜欢的心愿吧。</div>')+'</div><p class="gentle-note">日常陪伴、拥抱与基本玩耍时间照常，不需要兑换。</p><section class="panel"><div class="section-heading"><h2>我的魔法卡片</h2><span>'+cards.filter(r=>!r.usedAt).length+' 张待使用 / 完成</span></div><p class="small">出游卡进入待安排清单；家务卡完成一次任务，完成后由家长核销。</p>'+(cards.length?'<div class="card-list">'+cards.map(r=>{const card=cardTypes.find(c=>c.id===r.cardId);return '<article class="collected-card'+(r.usedAt?' used':'')+'"><span class="card-icon" aria-hidden="true">'+card.icon+'</span><div><h3>'+card.name+'</h3><p>'+card.description+'</p><small>'+new Date(r.createdAt).toLocaleDateString('zh-CN')+' · '+(r.usedAt?'已核销':card.kind==='outing'?'待安排':'待使用 / 完成')+'</small></div>'+(r.usedAt?'<span class="status-tag">已核销</span>':'<button class="secondary" data-action="use-card" data-id="'+esc(r.id)+'">家长核销</button>')+'</article>';}).join('')+'</div>':'<div class="empty">第一张魔法卡片，正在等你打开。</div>')+'</section><section class="panel"><h2>已经兑换的心愿</h2>'+(history.length?history.map(r=>'<div class="history-line"><div><strong>'+esc(r.name)+'</strong><small>'+new Date(r.createdAt).toLocaleDateString('zh-CN')+' · '+r.cost+' 个皇冠 · '+(r.fulfilledAt?'已兑现':'待家长兑现')+'</small></div>'+(r.fulfilledAt?'<span class="status-tag">已兑现</span>':'<div class="history-actions"><button class="secondary" data-action="fulfill" data-id="'+esc(r.id)+'">确认兑现</button><button class="text-button" data-action="cancel-redemption" data-id="'+esc(r.id)+'">取消</button></div>')+'</div>').join(''):'<div class="empty">在这里珍藏已经兑换的小期待。</div>')+'</section></section>';}
function settingsDialog(){dialog('家长设置与备份','<form id="settings-form"><label class="field">妹妹的昵称<input name="nickname" maxlength="30" required value="'+esc(state.settings.nickname)+'"></label><button type="submit" class="primary full-width">保存昵称</button></form><section class="setting-section"><h3>一起约定的心愿</h3>'+state.wishes.map(r=>'<div class="wish-setting"><span>'+esc(r.icon)+' '+esc(r.name)+' <small>♛ '+r.cost+'</small></span><div><button class="text-button" data-action="edit-wish" data-id="'+esc(r.id)+'">编辑</button><button class="text-button" data-action="delete-wish" data-id="'+esc(r.id)+'">移除</button></div></div>').join('')+'<button class="secondary" data-action="new-wish">＋ 添加心愿</button></section><section class="setting-section"><h3>备份童话花园</h3><p class="small">记录只保存在当前设备的浏览器里。建议每周导出一份备份；换设备前先导出，再从新入口导入。</p><div class="backup-buttons"><button class="primary" data-action="export">导出备份</button><button class="secondary" data-action="import">导入备份</button><button class="secondary" data-action="persist">申请持久保存</button></div><p class="small">'+(state.backupAt?'上次导出：'+new Date(state.backupAt).toLocaleString('zh-CN'):'还没有导出备份')+'</p></section><section class="setting-section"><h3>安装与离线</h3><p class="small" id="offline-status">正在检查离线状态…</p><p class="small">安卓平板首次联网打开 HTTPS 网址后，在支持 PWA 的浏览器里选择“安装应用”或“添加到主屏幕”。哥哥与妹妹使用各自的入口。</p><p class="small">家长入口用于区分操作，没有密码锁。清除网站数据可能丢失记录；持久保存不能代替备份。</p></section>');updateOfflineStatus();}
async function updateOfflineStatus(){const el=$('#offline-status');if(!el)return;if(!window.isSecureContext||!('serviceWorker'in navigator)){el.textContent='正式使用需要 HTTPS；电脑 localhost 可预览。';return;}try{const r=await navigator.serviceWorker.getRegistration(),cache=await caches.open('luna-growth-world-v1'),ready=await cache.match('./index.html');if(el.isConnected)el.textContent=r?.active&&ready?'离线文件已准备好，可以断网打开。':'离线文件正在准备，请保持联网后再查看。';}catch{if(el.isConnected)el.textContent='暂时无法检查，请保持联网后再查看。';}}
function wishDialog(id){const r=id?state.wishes.find(r=>r.id===id):{name:'',description:'',cost:8,icon:'🎁'};if(!r)return;dialog(id?'修改心愿':'一起约定心愿','<form id="wish-form" data-id="'+esc(id||'')+'"><label class="field">心愿名称<input name="name" maxlength="60" required value="'+esc(r.name)+'" placeholder="例如：一起玩一次过家家"></label><label class="field">具体约定<textarea name="description" maxlength="200" placeholder="约定时长、时间或范围。">'+esc(r.description)+'</textarea></label><div class="form-grid"><label class="field">需要的皇冠<input name="cost" type="number" min="1" max="10000" step="1" required value="'+r.cost+'"></label><label class="field">心愿图标<select name="icon">'+['🎁','🎮','🎬','🌳','🎠','📚','🎨','🧸','🧩','🍰'].map(v=>'<option'+(r.icon===v?' selected':'')+'>'+v+'</option>').join('')+'</select></label></div><div class="dialog-actions"><button type="button" class="secondary" data-close>取消</button><button type="submit" class="primary">保存心愿</button></div></form>');}
function boxRules(){dialog('魔法礼盒里的七种卡','<div class="box-rules">'+cardTypes.map(c=>'<div><span aria-hidden="true">'+c.icon+'</span><p><strong>'+c.name+'</strong><small>'+c.description+'</small></p></div>').join('')+'</div><p class="small">每种卡机会相同，都是 1/7，可以重复。使用 1 根魔法棒抽一次；确认后结果会保存，不能取消或退回魔法棒重抽。</p><div class="dialog-actions"><button class="primary" data-close>知道啦</button></div>');}
function chooseCard(){const range=4294967296,limit=Math.floor(range/cardTypes.length)*cardTypes.length,value=new Uint32Array(1);do{crypto.getRandomValues(value);}while(value[0]>=limit);return cardTypes[value[0]%cardTypes.length];}

document.addEventListener('click',async event=>{
 const b=event.target.closest('button');if(!b)return;if(b.hasAttribute('data-close')){$('#editor').close();return;}if(b.dataset.page){go(b.dataset.page);return;}if(b.id==='settings-btn'){settingsDialog();return;}if(b.id==='wallet-btn'){go('wishes');return;}
 const action=b.dataset.action,id=b.dataset.id;if(!action||busy)return;
 if(['task','undo-task'].includes(action)&&selectedDate!==dateKey()){toast('过期日期只能查看，不能再打卡。');return;}
 if(action==='open-today'){selectedDate=dateKey();monthOffset=0;page='garden';render();dayDialog();}
 if(action==='open-day'){const key=b.dataset.date;if(key&&key<=dateKey()&&monthDates().includes(key)){selectedDate=key;dayDialog();}}
 if(action==='prev-month'&&monthDates()[0]>'2000-01-01'){monthOffset--;render();}
 if(action==='next-month'&&monthOffset<0){monthOffset++;render();}
 if(action==='task'){
  const i=Number(b.dataset.index);if(!Number.isInteger(i)||i<0||i>=7)return;const d=dayData();if(d.tasks[i]){confirmDialog('修正这条记录？','只用于修正误点。已经用于兑换的皇冠或魔法棒不能产生负余额。','undo-task',String(i),'修正记录');return;}
  const ok=await commit(s=>{requireToday();const day=s.days[selectedDate] ||= structuredClone(d);if(day.tasks[i])throw new Error('这项任务今天已经领取，不能重复。');day.tasks[i]=true;},i===6?'收获 1 根魔法棒！':'收获 1 个皇冠！');if(ok)dayDialog();
 }
 if(action==='undo-task'){
  const i=Number(id);const ok=await commit(s=>{requireToday();if(!Number.isInteger(i)||i<0||i>=7||!s.days[selectedDate]?.tasks[i])throw new Error('这条任务没有完成。');if((i===6?wandBalance(s):crownBalance(s))<1)throw new Error('这份奖励已经用于兑换，不能产生负余额。');s.days[selectedDate].tasks[i]=false;},'记录已修正。',true);if(ok)dayDialog();
 }
 if(action==='new-wish')wishDialog();if(action==='edit-wish')wishDialog(id);
 if(action==='delete-wish')confirmDialog('移除这份心愿？','商店里不再展示它，过去的兑换记录仍然保留。','confirm-delete-wish',id,'移除');
 if(action==='confirm-delete-wish')await commit(s=>s.wishes=s.wishes.filter(r=>r.id!==id),'心愿已移除。',true);
 if(action==='redeem'){const r=state.wishes.find(r=>r.id===id);if(r&&crownBalance()>=r.cost)confirmDialog('兑换「'+r.name+'」？','使用 '+r.cost+' 个皇冠，兑换后还剩 '+(crownBalance()-r.cost)+' 个。请和家长确认这个约定。','confirm-redeem',id,'确认兑换');}
 if(action==='confirm-redeem')await commit(s=>{const r=s.wishes.find(r=>r.id===id);if(!r||crownBalance(s)<r.cost)throw new Error('皇冠不足，或这份心愿已经修改。');s.redemptions.push({id:uid(),wishId:r.id,name:r.name,cost:r.cost,createdAt:new Date().toISOString(),fulfilledAt:null});},'心愿已兑换，和家长一起安排吧。',true);
 if(action==='fulfill')confirmDialog('家长确认：心愿已兑现？','确认这份心愿已经完成，留下你们一起的好时光。','confirm-fulfill',id,'已经兑现');
 if(action==='confirm-fulfill')await commit(s=>{const r=s.redemptions.find(r=>r.id===id);if(r&&!r.fulfilledAt)r.fulfilledAt=new Date().toISOString();},'这份小期待已兑现。',true);
 if(action==='cancel-redemption')confirmDialog('取消这次兑换？','尚未兑现的心愿可以取消，皇冠会按原数量退回。','confirm-cancel-redemption',id,'取消兑换');
 if(action==='confirm-cancel-redemption')await commit(s=>s.redemptions=s.redemptions.filter(r=>r.id!==id||r.fulfilledAt),'兑换已取消，皇冠已退回。',true);
 if(action==='box-rules')boxRules();
 if(action==='draw-box'){if(wandBalance()<1){toast('还没有魔法棒，读完英语绘本就能获得。');return;}confirmDialog('打开一份魔法礼盒？','使用 1 根魔法棒，随机抽一张卡。结果保存到卡片清单，确认后不能取消或重抽。','confirm-draw','','确认抽取');}
 if(action==='confirm-draw'){
  let card;const ok=await commit(s=>{if(wandBalance(s)<1)throw new Error('魔法棒不足。');card=chooseCard();s.draws.push({id:uid(),cardId:card.id,cost:1,currency:'wand',createdAt:new Date().toISOString(),usedAt:null});},'',true);
  if(ok)dialog('你抽到了！','<div class="card-reveal"><span aria-hidden="true">'+card.icon+'</span><h3>'+card.name+'</h3><p>'+card.description+'</p><small>已经放入你的魔法卡片清单。</small></div><div class="dialog-actions"><button class="primary" data-close>收好卡片</button></div>');
 }
 if(action==='use-card'){const r=state.draws.find(r=>r.id===id);if(r&&!r.usedAt){const c=cardTypes.find(c=>c.id===r.cardId);confirmDialog('家长确认 · '+c.name,'确认这张卡的家务或活动已经完成，核销后保留历史记录。','confirm-use-card',id,'确认完成');}}
 if(action==='confirm-use-card')await commit(s=>{const r=s.draws.find(r=>r.id===id);if(r&&!r.usedAt)r.usedAt=new Date().toISOString();},'魔法卡片已核销。',true);
 if(action==='export')await exportBackup();if(action==='import')$('#import-file').click();
 if(action==='confirm-import'){if(!pendingImport)return;const imported=pendingImport;const ok=await commit(s=>{Object.keys(s).forEach(key=>delete s[key]);Object.assign(s,imported);},'童话花园已恢复。',true);if(ok)pendingImport=null;}
 if(action==='persist'){try{const granted=await navigator.storage?.persist?.();toast(granted?'已允许持久保存，仍请定期备份。':'浏览器暂未授予持久保存，请继续定期备份。');}catch{toast('此浏览器不支持申请持久保存，请定期备份。');}}
});
document.addEventListener('submit',async event=>{const form=event.target;event.preventDefault();if(busy||!form.checkValidity())return;const data=new FormData(form);
 if(form.id==='settings-form'){const nickname=data.get('nickname').trim();if(!nickname){formError('请填写妹妹的昵称。');return;}await commit(s=>s.settings.nickname=nickname,'昵称已保存。',true);}
 if(form.id==='wish-form'){const name=data.get('name').trim();if(!name){formError('请填写心愿名称。');return;}const wish={id:form.dataset.id||uid(),name,description:data.get('description').trim(),cost:Number(data.get('cost')),icon:data.get('icon')};await commit(s=>{const i=s.wishes.findIndex(r=>r.id===wish.id);if(i<0)s.wishes.push(wish);else s.wishes[i]=wish;},'心愿已约定。',true);}
});
async function exportBackup(){const stamp=new Date().toISOString(),exported=structuredClone(state);exported.backupAt=stamp;const blob=new Blob([JSON.stringify({app:'luna-growth-world',exportedAt:stamp,data:exported},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Luna童话花园备份-'+dateKey()+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);const ok=await commit(s=>s.backupAt=stamp,'已发起下载，请确认备份文件保存成功。');if(ok)settingsDialog();}
$('#import-file').addEventListener('change',async event=>{const file=event.target.files[0];event.target.value='';if(!file)return;try{if(file.size>10*1024*1024)throw new Error('请选择小于 10 MB 的备份。');const raw=JSON.parse(await file.text());if(raw.app!=='luna-growth-world')throw new Error('这不是妹妹童话花园的备份。');pendingImport=validateState(raw.data);confirmDialog('恢复这座童话花园？','备份包含 '+Object.keys(pendingImport.days).length+' 天任务、'+pendingImport.redemptions.length+' 次心愿兑换、'+pendingImport.draws.length+' 张魔法卡片。导入会替换此入口的现有记录，请先导出当前备份。','confirm-import','','替换并恢复');}catch(e){pendingImport=null;toast('导入失败：'+e.message);}});
$('#editor').addEventListener('close',()=>pendingImport=null);
window.addEventListener('hashchange',()=>{const next=location.hash.slice(1);if(['garden','wishes'].includes(next)){page=next;render();}});
let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(page==='garden')render();},120);});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&state)render();});
async function init(){try{db=await openDB();const saved=await readDB();state=saved?validateState(saved):defaultState();db.onversionchange=()=>{db.close();toast('花园已在另一个页面更新，请刷新。');};page=location.hash==='#wishes'?'wishes':'garden';render();$('#save-state').textContent='已保存在此设备';if('serviceWorker'in navigator&&window.isSecureContext&&location.protocol!=='file:')navigator.serviceWorker.register('./sw.js').catch(()=>toast('离线文件尚未准备好，当前可以联网使用。'));}catch(e){$('#save-state').textContent='本地存储未能打开';$('#content').innerHTML='<div class="empty"><h2>暂时无法打开童话花园</h2><p>请使用普通浏览模式，通过网页服务打开，并确认设备有可用存储空间。不会覆盖已有数据。</p><p>'+esc(e.message)+'</p></div>';}}
init();
