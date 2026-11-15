/* Homepage: show the service logos in the water, let the visitor pick two, link to that comparison page.
   The list of services and their logos come from js/logos.js, which build.mjs writes from data/services.json. */
(function(){
'use strict';
const S=window.BUOY_SERVICES||[], LOGOS=window.BUOY_LOGOS||{};
const byId=id=>S.find(s=>s.id===id);
const pairUrl=(a,b)=>'compare/'+[a,b].sort().join('-vs-');

const tiles=document.getElementById('tiles'), pick=document.getElementById('pick');
let sel=[];

tiles.innerHTML=S.map(s=>`<button type="button" class="tile" data-id="${s.id}" aria-pressed="false"><span class="mark" style="-webkit-mask-image:url(${LOGOS[s.id]});mask-image:url(${LOGOS[s.id]})"></span><span class="vh">${s.name}</span></button>`).join('');

function render(){
  const ss=sel.map(byId);
  if(ss.length===2)pick.innerHTML=`<a class="go" href="${pairUrl(ss[0].id,ss[1].id)}">Compare ${ss[0].name} and ${ss[1].name} <span aria-hidden="true">&rarr;</span></a><button type="button" class="clear" data-clear>Clear</button>`;
  else if(ss.length===1)pick.innerHTML=`<span>${ss[0].name} picked. Pick one more.</span>`;
  else pick.innerHTML='<span>Pick two services to compare</span>';
  tiles.classList.toggle('full',ss.length===2);
  tiles.querySelectorAll('.tile').forEach(b=>b.setAttribute('aria-pressed',String(sel.includes(b.dataset.id))));
}
tiles.addEventListener('click',e=>{
  const b=e.target.closest('.tile'); if(!b)return;
  const id=b.dataset.id;
  sel=sel.includes(id)?sel.filter(x=>x!==id):[...sel,id].slice(-2);
  render();
});
pick.addEventListener('click',e=>{if(e.target.closest('[data-clear]')){sel=[];render();}});
render();
})();
