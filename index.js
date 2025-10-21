/* index.js — registration via gateway, no localStorage auto-login */
(function(){
  const registerPanel = document.getElementById('memberRegisterPanel');
  if(!registerPanel) return;

  // Ensure confirm field exists (non-visual change).
  const pwd1 = registerPanel.querySelector('input[type="password"]');
  let pwd2 = registerPanel.querySelector('#memberRegisterPasswordConfirm');
  if(pwd1 && !pwd2){
    pwd2 = document.createElement('input');
    pwd2.type = 'password';
    pwd2.id = 'memberRegisterPasswordConfirm';
    pwd2.placeholder = 'Confirm Password';
    pwd2.autocomplete = 'new-password';
    pwd2.required = true;
    if(pwd1.className) pwd2.className = pwd1.className;
    pwd1.insertAdjacentElement('afterend', pwd2);
  }

  // Helper status
  function status(msg, opts={}){
    const c = document.querySelector('.member-auth-status');
    if(c){ c.textContent = String(msg||''); c.setAttribute('data-type', opts.error ? 'error':'ok'); }
    else { (opts.error ? console.error : console.log)(msg); }
  }

  // Find enclosing form
  let form = registerPanel.closest('form') || document.getElementById('memberForm');
  if(!form) return;

  form.addEventListener('submit', async (e) => {
    const submitter = e.submitter || document.activeElement;
    const action = submitter && submitter.dataset && submitter.dataset.action ? submitter.dataset.action : '';
    if(action !== 'register') return;

    e.preventDefault();
    e.stopImmediatePropagation();

    const nameEl   = registerPanel.querySelector('input[name="display_name"], #memberRegisterName, input[placeholder*="Display Name" i], input[placeholder*="Name" i]');
    const emailEl  = registerPanel.querySelector('input[type="email"], input[name="email"], #memberRegisterEmail');
    const avatarEl = registerPanel.querySelector('input[name="avatar_url"], #memberRegisterAvatar');

    const display_name = (nameEl && nameEl.value || '').trim();
    const email        = (emailEl && emailEl.value || '').trim();
    const password     = pwd1 ? pwd1.value : '';
    const confirm      = pwd2 ? pwd2.value : '';
    const avatar_url   = (avatarEl && avatarEl.value || '').trim();

    if(!display_name || !email || !password){
      if(!window.__fillWarn){ window.__fillWarn=true; status('Please fill all required fields.', {error:true}); setTimeout(()=>window.__fillWarn=false,500); }
      return;
    }
    if(password !== confirm){
      if(!window.__pwWarn){ window.__pwWarn=true; status('Passwords do not match.', {error:true}); setTimeout(()=>window.__pwWarn=false,500); }
      try{ pwd2 && pwd2.focus(); }catch(_){}
      return;
    }

    const fd = new FormData();
    fd.set('display_name', display_name);
    fd.set('email', email);
    fd.set('password', password);
    fd.set('confirm', confirm);
    fd.set('avatar_url', avatar_url);

    try{
      const res = await fetch('/gateway.php?action=add-member', { method: 'POST', body: fd });
      const text = await res.text();
      let data;
      try{ data = JSON.parse(text); }catch{ data = { success:false, error:'Invalid server response', raw:text }; }
      if(data && data.success){
        status('Account created successfully.');
        // Do not auto-login.
      } else {
        status((data && data.error) || 'Registration failed.', {error:true});
      }
    } catch(err){
      console.error(err);
      status('Server error during registration.', {error:true});
    }
  }, { capture: true });
})();
