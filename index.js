/* index.js — final verified build */
(function(){
  const regPanel=document.getElementById('memberRegisterPanel');if(!regPanel)return;
  const pwd1=regPanel.querySelector('input[type="password"]');let pwd2=regPanel.querySelector('#memberRegisterPasswordConfirm');
  if(pwd1&&!pwd2){pwd2=document.createElement('input');pwd2.type='password';pwd2.id='memberRegisterPasswordConfirm';pwd2.placeholder='Confirm Password';pwd2.required=true;pwd1.insertAdjacentElement('afterend',pwd2);}
  const status=(m,e=false)=>{if(window.showStatus)showStatus(m,{error:e});else e?console.error(m):console.log(m);};
  const form=regPanel.closest('form')||document.getElementById('memberForm');if(!form)return;
  form.addEventListener('submit',async ev=>{
    const sub=ev.submitter||document.activeElement;if(!sub||sub.dataset.action!=='register')return;
    ev.preventDefault();ev.stopImmediatePropagation();
    const name=regPanel.querySelector('[name="display_name"],#memberRegisterName')?.value.trim()||'';
    const email=regPanel.querySelector('[type="email"],[name="email"],#memberRegisterEmail')?.value.trim()||'';
    const avatar=regPanel.querySelector('[name="avatar_url"],#memberRegisterAvatar')?.value.trim()||'';
    const p1=pwd1?.value||'',p2=pwd2?.value||'';
    if(!name||!email||!p1){status('Please fill all required fields.',true);return;}
    if(p1!==p2){status('Passwords do not match.',true);return;}
    const fd=new FormData();fd.set('display_name',name);fd.set('email',email);fd.set('password',p1);fd.set('confirm',p2);fd.set('avatar_url',avatar);
    try{
      const res=await fetch('/gateway.php?action=add-member',{method:'POST',body:fd});
      const txt=await res.text();let data;
      try{data=JSON.parse(txt);}catch{data={success:false,error:'Invalid server response',raw:txt};}
      if(data.success)status('Account created successfully.');
      else status(data.error||'Registration failed.',true);
    }catch(err){status('Network or server error.',true);console.error(err);}
  },{capture:true});
})();