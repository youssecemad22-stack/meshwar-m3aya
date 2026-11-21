#!/usr/bin/env python3
import sys

def edit(path, pairs):
    with open(path, encoding='utf-8') as f:
        s = f.read()
    for i, (old, new) in enumerate(pairs):
        n = s.count(old)
        if n != 1:
            print(f'FAIL {path} pair {i}: found {n} occurrences of {old[:80]!r}')
            sys.exit(1)
        s = s.replace(old, new)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(s)
    print(f'OK {path}: {len(pairs)} edits')

# ---------------- ui.js: add icons ----------------
edit('ui.js', [(
""" gift:'<path d="M4 11h16v10H4zM3 7h18v4H3zM12 7v14"/><path d="M12 7H8a3 3 0 1 1 3-3Zm0 0h4a3 3 0 1 0-3-3Z"/>',

};""",
""" gift:'<path d="M4 11h16v10H4zM3 7h18v4H3zM12 7v14"/><path d="M12 7H8a3 3 0 1 1 3-3Zm0 0h4a3 3 0 1 0-3-3Z"/>',
 bell:'<path d="M6 9a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7"/><path d="M10 20a2 2 0 0 0 4 0"/>',
 chat:'<path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5Z"/>',
 moon:'<path d="M20 13A8 8 0 1 1 11 4a6.5 6.5 0 0 0 9 9Z"/>',

};""")])

# ---------------- index.html: CSS + theme toggle button ----------------
edit('index.html', [
(
".cm{display:flex;flex-wrap:wrap;gap:6px}",
".cm{display:flex;flex-wrap:wrap;gap:6px}\n.cmrow{display:flex;gap:8px;margin-top:8px}\n.cmrow input{flex:1;min-width:0;margin:0}"
),
(
"""<button class="bellb" aria-label="الإشعارات" onclick="nsh()">""",
"""<button class="bellb" aria-label="الوضع الليلي" title="الوضع الليلي" onclick="thToggle()"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 13A8 8 0 1 1 11 4a6.5 6.5 0 0 0 9 9Z"/></svg></button><button class="bellb" aria-label="الإشعارات" onclick="nsh()">"""
),
])

# ---------------- sw.js: version bump ----------------
edit('sw.js', [(
"const VERSION = 'meshwar-pwa-20261121-places-3';",
"const VERSION = 'meshwar-pwa-20261121-features-1';"
)])

# ---------------- app.js ----------------
pairs = []

# globals
pairs.append((
"let wst={s:1,a:100,c:false,m:null,go:0,t:'n'},chatMsgs=[],chatBid=null,IS_ADMIN=false,RT_SUM={},MYRATES=[],ADM=null;",
"let wst={s:1,a:100,c:false,m:null,go:0,t:'n'},chatMsgs=[],chatBid=null,IS_ADMIN=false,RT_SUM={},MYRATES=[],ADM=null;\nlet RAL=[],REFCOUNT=null,REFMINE=null,DPUB={},DCHAT={},DCHAT_OPEN={},CHAT_SEEN={};"
))

# loadNames: also fetch trips from driver_public_stats
pairs.append((
"  try{const{data:rs}=await sb.from('driver_ratings_summary').select('driver_id,avg,count').in('driver_id',ids);(rs||[]).forEach(x=>RT_SUM[x.driver_id]=x)}catch(e){}}",
"  try{const{data:rs}=await sb.from('driver_ratings_summary').select('driver_id,avg,count').in('driver_id',ids);(rs||[]).forEach(x=>RT_SUM[x.driver_id]=x)}catch(e){}\n  try{const{data:ps}=await sb.from('driver_public_stats').select('driver_id,trips').in('driver_id',ids);(ps||[]).forEach(x=>DPUB[x.driver_id]=x.trips||0)}catch(e){}}"
))

# refreshRides: check alerts after rides load
pairs.append((
"  RIDES=data.map(adaptRide).filter(r=>R[r.r]&&DROP[r.dr||0]&&Array.isArray(r.pts)&&r.pts.length&&r.pts.every(p=>PTS[p]));MYRIDES=RIDES.filter(r=>r.mine);\n}",
"  RIDES=data.map(adaptRide).filter(r=>R[r.r]&&DROP[r.dr||0]&&Array.isArray(r.pts)&&r.pts.length&&r.pts.every(p=>PTS[p]));MYRIDES=RIDES.filter(r=>r.mine);alertCheck();\n}"
))

# refreshAll: include alerts + referrals
pairs.append((
"async function refreshAll(notify){await Promise.all([refreshRides(),refreshMyBooks(notify),refreshTx(),refreshRqs(),refreshMyRatings()]);await refreshPax(notify)}",
"async function refreshAll(notify){await Promise.all([refreshRides(),refreshMyBooks(notify),refreshTx(),refreshRqs(),refreshMyRatings(),refreshAlerts(),refreshRef()]);await refreshPax(notify)}"
))

# card(): trips count next to rating
pairs.append((
"${RT_SUM[r.driver]?`<span class=\"mu\" style=\"color:#F59E0B\">★ ${RT_SUM[r.driver].avg} (${RT_SUM[r.driver].count})</span>`:''}",
"${RT_SUM[r.driver]?`<span class=\"mu\" style=\"color:#F59E0B\">★ ${RT_SUM[r.driver].avg} (${RT_SUM[r.driver].count})</span>`:''}${DPUB[r.driver]>0?`<span class=\"mu\"> · ${DPUB[r.driver]} رحلة</span>`:''}"
))

# det(): correct rating label + trips
pairs.append((
"<div class=\"mu\">★ ${rt}${tr?' · '+tr+' رحلة':''}</div>",
"<div class=\"mu\">★ ${rt}${tr?' · '+tr+' تقييم':''}${DPUB[r.driver]>0?' · '+DPUB[r.driver]+' رحلة مكتملة':''}</div>"
))

# wkc(): show ride days with the weekly price
pairs.append((
"function wkc(){const e=$('wks');if(e)e.textContent=$('wk').checked?'5 أيام = '+Math.round(off*5*.9)+' جنيه بدل '+off*5+' (خصم 10%)':''}",
"function wkc(){const e=$('wks');if(!e)return;const r=RIDES.find(x=>x.id===bk),dys=r&&r.days&&r.days.length&&r.days.length<7?' · بيشتغل: '+dayStr(r.days):'';e.textContent=$('wk').checked?'5 أيام = '+Math.round(off*5*.9)+' جنيه بدل '+off*5+' (خصم 10%)'+dys:''}"
))

# payReview: days row when weekly
pairs.append((
"${wkf?`<div class=\"row\"><span class=\"mu\">اشتراك أسبوعي ×5 (خصم 10%)</span><b>${tot} جنيه</b></div>`:''}",
"${wkf?`<div class=\"row\"><span class=\"mu\">اشتراك أسبوعي ×5 (خصم 10%)</span><b>${tot} جنيه</b></div>${r.days&&r.days.length?`<div class=\"row\"><span class=\"mu\">بيشتغل أيام</span><b>${dayStr(r.days)}</b></div>`:''}`:''}"
))

# trip2: WhatsApp share button
pairs.append((
"""<div class="row"><button class="btn g" onclick="shr()">شارك الرحلة</button><a class="btn sos" """,
"""<div class="row"><button class="btn g" onclick="shr()">شارك الرحلة</button><button class="btn g" onclick="shrWa()">واتساب</button><a class="btn sos" """
))

# shr(): add shrWa after it
pairs.append((
"""function shr(){const t=S.trip,x='أنا في مشوار '+R[t.rt].n+' مع '+t.who+'، '+t.car+' '+t.col+'، لوحة '+t.pl+'. نقطة الركوب '+PTS[t.p]+' الساعة '+t.t+'.';""",
"""function shrWa(){const t=S.trip;if(!t)return;const x='أنا في مشوار معايا 🚗\\nالطريق: '+R[t.rt].n+'\\nالسواق: '+t.who+'\\nالعربية: '+t.car+' '+t.col+' · لوحة '+t.pl+'\\nالركوب: '+PTS[t.p]+' الساعة '+t.t+(t.wk?'\\nاشتراك أسبوعي':'')+'\\nمن تطبيق مشوار معايا: '+location.origin+location.pathname;window.open('https://wa.me/?text='+encodeURIComponent(uiText(x)),'_blank')}
function shr(){const t=S.trip,x='أنا في مشوار '+R[t.rt].n+' مع '+t.who+'، '+t.car+' '+t.col+'، لوحة '+t.pl+'. نقطة الركوب '+PTS[t.p]+' الساعة '+t.t+'.';"""
))

# loadChat: new-message notification
pairs.append((
"async function loadChat(bid){chatBid=bid;const{data}=await sb.from('messages').select('*').eq('booking_id',bid).order('created_at');chatMsgs=data||[]}",
"async function loadChat(bid){chatBid=bid;const{data}=await sb.from('messages').select('*').eq('booking_id',bid).order('created_at');const msgs=data||[];if(CHAT_SEEN['r'+bid]!==undefined&&msgs.length>CHAT_SEEN['r'+bid]){const nw=msgs[msgs.length-1];if(nw&&nw.sender!==ME)ntf('رسالة جديدة من السواق: '+nw.body)}CHAT_SEEN['r'+bid]=msgs.length;chatMsgs=msgs}"
))

# chatH: input row + icon
pairs.append((
"""function chatH(){return `<div class="card" style="margin:0"><div class="ct">${uiIcon('user')}<b>رسائل السواق</b></div><div class="msgs">${chatMsgs.length?chatMsgs.map(m=>`<div class="msg ${m.sender===ME?'me':''}">${esc(m.body)}</div>`).join(''):'<span class="mu">لا توجد رسائل بعد.</span>'}</div><div class="cm">${['أنا واقف عند النقطة','هتأخر 5 دقايق','أنت فين؟'].map(x=>`<button onclick="say('${x}')">${x}</button>`).join('')}</div></div>`}""",
"""function chatH(){return `<div class="card" style="margin:0"><div class="ct">${uiIcon('chat')}<b>شات السواق</b></div><div class="msgs">${chatMsgs.length?chatMsgs.map(m=>`<div class="msg ${m.sender===ME?'me':''}">${esc(m.body)}</div>`).join(''):'<span class="mu">لا توجد رسائل بعد. كلم السواق من هنا بدل ما تتبادلوا أرقام.</span>'}</div><div class="cm">${['أنا واقف عند النقطة','هتأخر 5 دقايق','أنت فين؟'].map(x=>`<button onclick="say('${x}')">${x}</button>`).join('')}</div><div class="cmrow"><input id="cin" aria-label="اكتب رسالة للسواق" placeholder="اكتب رسالتك..." onkeydown="if(event.key==='Enter')say()"><button class="btn g" style="min-height:40px;padding:0 14px" onclick="say()">إرسال</button></div></div>`}"""
))

# say: free text support + reload
pairs.append((
"async function say(x){if(!chatBid)return;chatMsgs.push({sender:ME,body:x});const sh=$('tsh');if(sh)sh.dataset.sig='';renderTrip();await sb.from('messages').insert({booking_id:chatBid,body:x})}",
"""async function say(x){if(!chatBid)return;const inp=$('cin'),body=x||(inp?inp.value.trim():'');if(!body)return;chatMsgs.push({sender:ME,body});const sh=$('tsh');if(sh)sh.dataset.sig='';renderTrip();await sb.from('messages').insert({booking_id:chatBid,body});await loadChat(chatBid);const sh2=$('tsh');if(sh2)sh2.dataset.sig='';renderTrip()}"""
))

# miniChat: real driver-side chat
pairs.append((
"function miniChat(x){return ''}",
"""function miniChat(x){const open=DCHAT_OPEN[x.id],msgs=DCHAT[x.id]||[];
if(!open)return `<button class="btn g" style="min-height:34px;padding:0 12px" onclick="event.stopPropagation();dchatOpen(${x.id})">فتح الشات</button>`;
return `<div style="border-top:1px dashed var(--bd);padding-top:8px;margin-top:6px" onclick="event.stopPropagation()"><div class="msgs">${msgs.length?msgs.map(m=>`<div class="msg ${m.sender===ME?'me':''}">${esc(m.body)}</div>`).join(''):'<span class="mu">لا توجد رسائل بعد. كلم الراكب من هنا بدل ما تتبادلوا أرقام.</span>'}</div><div class="cm">${['أنا في الطريق','وصلت للنقطة','هستنى 3 دقايق'].map(s=>`<button onclick="event.stopPropagation();sayD(${x.id},'${s}')">${s}</button>`).join('')}</div><div class="cmrow"><input id="dcin${x.id}" aria-label="اكتب رسالة للراكب" placeholder="اكتب رسالة للراكب..." onkeydown="if(event.key==='Enter')sayD(${x.id})"><button class="btn g" style="min-height:40px;padding:0 14px" onclick="event.stopPropagation();sayD(${x.id})">إرسال</button></div></div>`}
async function dchatOpen(bid){DCHAT_OPEN[bid]=true;render();await loadDchat(bid);render()}
async function loadDchat(bid){const{data}=await sb.from('messages').select('*').eq('booking_id',bid).order('created_at');const msgs=data||[];if(CHAT_SEEN['d'+bid]!==undefined&&msgs.length>CHAT_SEEN['d'+bid]){const nw=msgs[msgs.length-1];if(nw&&nw.sender!==ME)ntf('رسالة جديدة من الراكب: '+nw.body)}CHAT_SEEN['d'+bid]=msgs.length;DCHAT[bid]=msgs}
async function sayD(bid,quick){const inp=$('dcin'+bid),body=quick||(inp?inp.value.trim():'');if(!body)return;DCHAT[bid]=[...(DCHAT[bid]||[]),{sender:ME,body}];render();await sb.from('messages').insert({booking_id:bid,body});await loadDchat(bid);render()}"""
))

# poll: refresh open driver chats
pairs.append((
"async function poll(){try{await refreshAll(true);await refreshVerification(true);if(!$('v1').hidden||!$('v2').hidden)render();",
"async function poll(){try{await refreshAll(true);await refreshVerification(true);const dopen=Object.keys(DCHAT_OPEN);if(dopen.length)await Promise.all(dopen.map(b=>loadDchat(+b)));if(!$('v1').hidden||!$('v2').hidden)render();"
))

# route alerts + referrals: new section after refreshRqs
pairs.append((
"async function loadProfile(){",
"""// ---------- route alerts & referrals ----------
async function refreshAlerts(){if(!ME)return;try{const{data,error}=await sb.from('route_alerts').select('*').order('created_at',{ascending:false}).limit(20);if(!error)RAL=data||[]}catch(e){}}
function alertMatch(a){return RIDES.find(r=>publicRide(r)&&!r.mine&&r.pts.some(p=>pMt(p,a.p))&&dMt(r.dr,a.d)&&(!a.t||Math.abs(mn(pt(r,r.pts[0]))-mn(a.t))<=45))}
function alertCheck(){if(!RAL.length||!RIDES.length)return;S.alSeen=S.alSeen||{};let hit=null;RAL.forEach(a=>{const r=alertMatch(a);if(!r)return;const k=a.id+':'+r.id;if(S.alSeen[k])return;S.alSeen[k]=1;hit={a,r}});if(!hit)return;save();const txt='ظهر مشوار على خطك: '+pl1(hit.a.p)+' ← '+pl2(hit.a.d)+(hit.a.t?' حوالي '+hit.a.t:'')+' · '+hit.r.price+' جنيه';ntf(txt);try{if(typeof Notification!=='undefined'&&Notification.permission==='granted')new Notification('مشوار معايا',{body:txt})}catch(e){}}
function alertForm(){const f=$('f').value,d=$('df').value;$('bk').innerHTML=`<div class="card pkcard"><div class="row"><h2>تنبيه المشاوير</h2><button class="btn g" onclick="closeBk()">إغلاق</button></div><p class="mu">حدد خطك وهنبّهك أول ما سواق ينشر مشوار مناسب عليه. التنبيه بيشتغل وانت فاتح التطبيق.</p>${f!==''&&d!==''?`<div class="card" style="margin:0;background:var(--soft)"><b>${esc(pl1(+f))} ← ${esc(pl2(+d))}</b><label for="alt">الميعاد التقريبي (اختياري)</label><input id="alt" type="time" value="07:30"><button class="btn" onclick="alertAdd()">فعّل التنبيه على الخط ده</button></div>`:'<p class="mu">اختار نقطة الركوب والوصول من الصفحة الرئيسية الأول وبعدين افتح التنبيهات تاني.</p>'}<b>تنبيهاتك الشغالة</b>${RAL.length?RAL.map(a=>`<div class="row"><div><b style="font-weight:400">${esc(pl1(a.p))} ← ${esc(pl2(a.d))}</b><div class="mu">${a.t?'حوالي '+a.t:'أي وقت'}</div></div><button class="btn g" style="min-height:36px" onclick="alertDel(${a.id})">إلغاء</button></div>`).join(''):'<span class="mu">مفيش تنبيهات لسه.</span>'}</div>`}
async function alertAdd(){const f=$('f').value,d=$('df').value;if(f===''||d==='')return toast('اختار نقطة الركوب والوصول الأول.');const t=norm(($('alt')||{}).value||'');
const{error}=await sb.from('route_alerts').insert({p:+f,d:+d,t:t||null});if(error)return toast(error.message);
try{if(typeof Notification!=='undefined'&&Notification.permission==='default')Notification.requestPermission()}catch(e){}
await refreshAlerts();alertForm();toast('اتفعل التنبيه. هنبّهك أول ما مشوار مناسب يظهر.')}
async function alertDel(id){await sb.from('route_alerts').delete().eq('id',id);await refreshAlerts();alertForm()}
async function refreshRef(){if(!ME)return;try{const[{count},{data:mine}]=await Promise.all([sb.from('referrals').select('*',{count:'exact',head:true}).eq('referrer_id',ME).eq('rewarded',true),sb.from('referrals').select('id').eq('referred_id',ME).limit(1)]);REFCOUNT=count||0;REFMINE=(mine||[]).length>0}catch(e){}}
async function refApply(code){const c=String(code||($('refin')?$('refin').value:'')).trim().toUpperCase();if(!c)return toast('اكتب الكود الأول.');
const{data,error}=await sb.rpc('apply_referral',{p_code:c});
if(error)return toast(error.message);
S.refPending=null;save();await loadProfile();await refreshTx();await refreshRef();profR();
if(data&&data.rewarded===false)toast('الكود اتسجل، بس صاحبك وصل للحد الأقصى للمكافآت.');
else toast('كسبت 20 جنيه رصيد من الدعوة 🎉')}
async function refFromLink(){const q=new URLSearchParams(location.search),rc=(q.get('ref')||'').replace(/[^A-Za-z0-9]/g,'').toUpperCase();
if(q.has('ref')||q.has('from')||q.has('to')){try{history.replaceState(null,'',location.pathname)}catch(e){}}
if(!rc||!ME)return;S.refPending=rc;save();
if(REFMINE)return;
if(ME_ANON){toast('اللينك فيه كود دعوة. احفظ حسابك بالإيميل من صفحة حسابي عشان تطبقه وتكسب 20 جنيه.');return}
refApply(rc)}
async function loadProfile(){"""
))

# routeTools: add alert button
pairs.append((
"""<button class="pp2 pkplace" onclick="routeBroaden()"><span class="pkplaceicon">${uiIcon('search')}</span><span class="pkplacetext"><b>وسّع البحث لكل المنطقة</b><span class="mu">شوف نقط تانية بدل نقطة واحدة</span></span></button></div>`}""",
"""<button class="pp2 pkplace" onclick="routeBroaden()"><span class="pkplaceicon">${uiIcon('search')}</span><span class="pkplacetext"><b>وسّع البحث لكل المنطقة</b><span class="mu">شوف نقط تانية بدل نقطة واحدة</span></span></button><button class="pp2 pkplace" onclick="alertForm()"><span class="pkplaceicon">${uiIcon('bell')}</span><span class="pkplacetext"><b>نبّهني لما يظهر مشوار</b><span class="mu">إشعار أول ما سواق ينشر على خطك</span></span></button></div>`}"""
))

# profile: theme via applyTheme
pairs.append((
"function profR(){const e=$('prof');if(!PROFILE){e.innerHTML='<p class=\"mu\">بنحمّل حسابك...</p>';return}\nconst P=PROFILE,d=document.documentElement;if(S.th)d.dataset.theme=S.th;else delete d.dataset.theme;",
"function profR(){const e=$('prof');if(!PROFILE){e.innerHTML='<p class=\"mu\">بنحمّل حسابك...</p>';return}\nconst P=PROFILE;applyTheme();"
))

# profile: invite card + redeem card
pairs.append((
"""<div class="card"><div class="ct">${uiIcon('gift')}<b>ادعي صحابك</b></div><span class="mu">شارك التطبيق مع أصدقائك ليتعرفوا عليه.</span><div class="cp"><span>${esc(P.ref_code||'')}</span><button class="btn g" style="min-height:36px" onclick="cpy('${P.ref_code}')">نسخ الكود</button></div><button class="btn" onclick="inv()">ابعت الدعوة</button></div>`+help()+""",
"""<div class="card"><div class="ct">${uiIcon('gift')}<b>ادعي صحابك واكسبوا</b></div><span class="mu">ابعت كودك لصحابك: هو يكسب 20 جنيه رصيد عمولة وانت كمان، أول ما يحفظ حسابه بالإيميل. بحد أقصى 10 مكافآت.</span><div class="cp"><span>${esc(P.ref_code||'')}</span><button class="btn g" style="min-height:36px" onclick="cpy('${P.ref_code}')">نسخ الكود</button></div><button class="btn" onclick="inv()">ابعت الدعوة</button>${REFCOUNT!==null?`<span class="mu">مكافآتك لحد دلوقتي: ${REFCOUNT} من 10</span>`:''}</div>
<div class="card"><div class="ct">${uiIcon('gift')}<b>عندك كود دعوة؟</b></div>${REFMINE?'<span class="mu">اتطبق كود دعوة على حسابك ✓</span>':`<div class="cmrow"><input id="refin" dir="ltr" aria-label="كود الدعوة" placeholder="مثال: MM0A7F" style="text-transform:uppercase"><button class="btn" style="min-height:40px;padding:0 14px" onclick="refApply()">طبّق الكود</button></div><span class="mu">هتكسب 20 جنيه رصيد عمولة. لازم حسابك يكون محفوظ بالإيميل.</span>${S.refPending?`<button class="btn g" onclick="refApply('${S.refPending}')">طبّق كود اللينك: ${esc(S.refPending)}</button>`:''}`}</div>`+help()+"""
))

# inv(): link with ref param + reward mention
pairs.append((
"function inv(){const x='جرّب مشوار معايا لمشاركة المشاوير من الهرم لزايد: '+location.href+' — كود الدعوة: '+PROFILE.ref_code;",
"function inv(){const u=location.origin+location.pathname+'?ref='+PROFILE.ref_code;const x='جرّب مشوار معايا لمشاركة المشاوير في القاهرة والجيزة: '+u+' — كود الدعوة: '+PROFILE.ref_code+' وهتكسب 20 جنيه رصيد';"
))

# theme helpers near helpers (anchor on toast definition)
pairs.append((
"function toast(t){const e=$('toast');",
"""function applyTheme(){const d=document.documentElement;if(S.th)d.dataset.theme=S.th;else delete d.dataset.theme;const dark=S.th==='dark'||(S.th!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);const m=document.querySelector('meta[name="theme-color"]');if(m)m.content=dark?'#101C19':'#0B4F4A'}
function thToggle(){const cur=S.th==='dark'||(S.th!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);S.th=cur?'light':'dark';save();applyTheme();if(PROFILE)profR();toast(cur?'الوضع الفاتح اتفعل':'الوضع الليلي اتفعل 🌙')}
function toast(t){const e=$('toast');"""
))

# boot: applyTheme + refFromLink
pairs.append((
"  render();tab(1);routeFromLink();",
"  applyTheme();render();tab(1);routeFromLink();refFromLink();"
))

edit('app.js', pairs)
print('ALL EDITS APPLIED')
