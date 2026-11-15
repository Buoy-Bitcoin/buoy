/* The V4V pop-up: opens from any link or button marked data-v4v, closes with the cross, the Escape key or a click outside. */
(function(){
'use strict';
var d=document.getElementById('v4v-pop'); if(!d||!d.showModal)return;
document.addEventListener('click',function(e){
  var t=e.target.closest('[data-v4v]');
  if(t){e.preventDefault();d.showModal();return;}
  if(e.target.closest('[data-close]')||e.target===d)d.close();
});
var c=document.getElementById('copy-ln');
c.addEventListener('click',function(){
  navigator.clipboard.writeText(document.getElementById('ln').textContent).then(function(){c.textContent='Copied';setTimeout(function(){c.textContent='Copy'},1600);});
});
})();
