/* index.js — fixed registration, routed via gateway.php */
(function(){
  const regPanel = document.getElementById('memberRegisterPanel');
  if(!regPanel) return;

  const pwd1 = regPanel.querySelector('input[type="password"]');
  let pwd2 = regPanel.querySelector('#memberRegisterPasswordConfirm');
  if(pwd1 && !pwd2){
    pwd2 = document.createElement('input');
    pwd2.type = 'password';
    pwd2.id = 'memberRegisterPasswordConfirm';
    pwd2.placeholder = 'Confirm Password';
    pwd2.required = true;
    if(pwd1.className) pwd2.className = pwd1.className;
    pwd1.insertAdjacentElement('afterend', pwd2);
  }

  const status = (msg, error=false) => {
    if(window.showStatus) showStatus(msg, {error});
    else error ? console.error(msg) : console.log(msg);
  };

  const form = regPanel.closest('form') || document.getElementById('memberForm');
  if(!form) return;

  form.addEventListener('submit', async e => {
    const sub = e.submitter || document.activeElement;
    if(!sub || sub.dataset.action !== 'register') return;

    e.preventDefault(); e.stopImmediatePropagation();
    const name = regPanel.querySelector('input[name="display_name"], #memberRegisterName')?.value.trim() || '';
    const email = regPanel.querySelector('input[type="email"], input[name="email"], #memberRegisterEmail')?.value.trim() || '';
    const avatar = regPanel.querySelector('input[name="avatar_url"], #memberRegisterAvatar')?.value.trim() || '';
    const p1 = pwd1?.value || '';
    const p2 = pwd2?.value || '';

    if(!name || !email || !p1){
      if(!window.__fillWarn){window.__fillWarn=true;status('Please fill all required fields.',true);setTimeout(()=>window.__fillWarn=false,500);} return;
    }
    if(p1!==p2){
      if(!window.__pwWarn){window.__pwWarn=true;status('Passwords do not match.',true);setTimeout(()=>window.__pwWarn=false,500);} return;
    }

    const fd=new FormData();
    fd.set('display_name',name);fd.set('email',email);fd.set('password',p1);fd.set('confirm',p2);fd.set('avatar_url',avatar);
    try{
      const res=await fetch('/gateway.php?action=add-member',{method:'POST',body:fd});
      const text=await res.text();let data;
      try{data=JSON.parse(text);}catch{data={success:false,error:'Invalid server response',raw:text};}
      if(data.success){status('Account created successfully.');}
      else{status(data.error||'Registration failed.',true);}
    }catch(err){console.error(err);status('Server error during registration.',true);}
  },{capture:true});
})();