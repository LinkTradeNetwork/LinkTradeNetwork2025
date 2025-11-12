<!-- LinkTradeNetwork API and UI Scripts -->
<script>
// ===== API CONFIG =====
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzwVf_ufRkBRmmGDX2AGuk9Fyegn3YrWcXJuUcENVKNIAi087lZezYTX8PJMFLa4Qe6vA/exec';
// No custom headers -> avoids CORS preflight on Apps Script
async function postJSON(data) {
  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify(data),
      redirect: 'follow'
    });
    const text = await res.text();
    try { return JSON.parse(text); } catch { return { success:false, error:text }; }
  } catch (err) {
    console.error('API Error:', err);
    return { success:false, error: String(err && err.message || err) };
  }
}

// Helper functions for API actions
function signup({ name, email, consent, userAgent }) {
  return postJSON({ action:'signup', name, email, consent, userAgent });
}

function verify({ email, code }) {
  return postJSON({ action:'verify', email, code });
}

function resend({ email, name }) {
  return postJSON({ action:'resend', email, name });
}

function signin({ email, userAgent }) {
  return postJSON({ action:'signin', email, userAgent });
}

// DOM Helpers
const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

// Helper to show/hide messages
function showMsg(el, text, type) {
  el.textContent = text;
  el.className = `msg ${type} show`;
}

function hideMsg(el) {
  el.className = 'msg';
}

// Run when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Tabs
  const tabSignup = $('#tab-signup');
  const tabSignin = $('#tab-signin');
  const cardTitle = $('#cardTitle');
  const cardSub   = $('#cardSub');
  const joinStep  = $('#joinStep');
  const signinStep= $('#signinStep');

  tabSignup.onclick = () => {
    tabSignup.classList.add('active'); 
    tabSignin.classList.remove('active');
    cardTitle.innerHTML = '<span class="title-logo">LTN</span><span>Sign Up</span>';
    cardSub.textContent   = 'Create your account and join skilled trade professionals nationwide';
    joinStep.style.display = 'block';
    signinStep.style.display = 'none';
    hideMsg($('#signinMsg'));
  };

  tabSignin.onclick = () => {
    tabSignin.classList.add('active'); 
    tabSignup.classList.remove('active');
    cardTitle.innerHTML = '<span class="title-logo">LTN</span><span>Sign In</span>';
    cardSub.textContent   = 'Welcome back! Sign in to access your account';
    joinStep.style.display = 'none';
    signinStep.style.display = 'block';
    hideMsg($('#joinMsg'));
    $('#otpStep').classList.remove('show');
  };

  // Sign Up elements
  const joinBtn=$('#joinBtn'), joinMsg=$('#joinMsg');
  const otpBox=$('#otpStep'), otpMsg=$('#otpMsg'), otpEmail=$('#otpEmail');
  const verifyBtn=$('#verifyBtn'), resendBtn=$('#resendBtn');
  const firstNameInput=$('#firstName'), lastNameInput=$('#lastName'), emailInput=$('#email'), consent=$('#consent');
  const codeInputs=$$('#otpStep input');

  // Sign In elements
  const signinEmail=$('#signinEmail'), signinBtn=$('#signinBtn'), signinMsg=$('#signinMsg');

  let currentEmail='', currentFirstName='', currentLastName='';

  function code(){return codeInputs.map(i=>i.value).join('');}

  // OTP input handling
  codeInputs.forEach((inp,i)=>{
    inp.addEventListener('input',()=>{
      inp.value=inp.value.replace(/\D/g,'');
      if(inp.value && i<5) codeInputs[i+1].focus();
    });
    inp.addEventListener('keydown',(e)=>{
      if(e.key==='Backspace' && !inp.value && i>0){
        codeInputs[i-1].focus();
      }
    });
    // Paste handling
    inp.addEventListener('paste',(e)=>{
      e.preventDefault();
      const paste = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g,'');
      if(paste.length===6){
        codeInputs.forEach((input,idx)=>{
          input.value = paste[idx] || '';
        });
        codeInputs[5].focus();
      }
    });
  });

  // Sign Up: request code
  joinBtn.onclick=async()=>{
    const firstName=(firstNameInput.value||"").trim();
    const lastName=(lastNameInput.value||"").trim();
    const email=(emailInput.value||"").trim().toLowerCase();
    
    if(!firstName||!lastName||!email){
      showMsg(joinMsg, 'Please fill in all fields', 'err');
      return;
    }
    
    if(!consent.checked){
      showMsg(joinMsg, 'Please agree to the Terms & Conditions', 'err');
      return;
    }
    
    showMsg(joinMsg, 'Sending verification code...', 'ok');
    joinBtn.disabled=true;
    
    const fullName = `${firstName} ${lastName}`;
    
    try{
      const r = await signup({
        name: fullName,
        email,
        consent: true,
        userAgent: navigator.userAgent
      });
      
      if(r.success){
        currentEmail=email;
        currentFirstName=firstName;
        currentLastName=lastName;
        otpEmail.textContent=email;
        otpBox.classList.add('show');
        hideMsg(joinMsg);
        codeInputs[0].focus();
        
        // Store email for later use
        localStorage.setItem('userEmail', email);
      }else{
        throw new Error(r.error||'Failed to send code');
      }
    }catch(e){
      showMsg(joinMsg, e.message, 'err');
    }
    
    joinBtn.disabled=false;
  };

  // Sign Up: verify OTP
  verifyBtn.onclick=async()=>{
    const c=code();
    
    if(c.length!==6){
      showMsg(otpMsg, 'Please enter the complete 6-digit code', 'err');
      return;
    }
    
    verifyBtn.disabled=true;
    verifyBtn.textContent='Verifying...';
    
    try{
      const r = await verify({
        email: currentEmail,
        code: c
      });
      
      if(r.success){
        localStorage.setItem('ltn_user', JSON.stringify({
          firstName: currentFirstName,
          lastName:  currentLastName,
          name:      `${currentFirstName} ${currentLastName}`,
          email:     currentEmail
        }));
        
        otpBox.classList.remove('show');
        const doneStep = $('#doneStep');
        doneStep.style.display='block';
        doneStep.classList.add('show');
        
        setTimeout(()=>{ 
          window.location.replace("/front.html"); 
        }, 1200);
      }else{
        throw new Error(r.error||'Invalid or expired code');
      }
    }catch(e){
      showMsg(otpMsg, e.message, 'err');
      codeInputs.forEach(inp=>inp.value='');
      codeInputs[0].focus();
    }
    
    verifyBtn.disabled=false;
    verifyBtn.textContent='Verify & Continue';
  };

  // Sign Up: resend OTP
  resendBtn.onclick=async()=>{
    const fullName = `${currentFirstName} ${currentLastName}`;
    resendBtn.disabled=true;
    resendBtn.textContent='Sending...';
    
    try{
      const r = await resend({
        email: currentEmail,
        name: fullName
      });
      
      showMsg(otpMsg, r.success ? 'New code sent to your email!' : 'Failed to resend code', r.success ? 'ok' : 'err');
      
      if(r.success){
        codeInputs.forEach(inp=>inp.value='');
        codeInputs[0].focus();
      }
    }catch(e){
      showMsg(otpMsg, e.message, 'err');
    }
    
    setTimeout(()=>{
      resendBtn.disabled=false;
      resendBtn.textContent='Resend Code';
    }, 3000);
  };

  // Sign In: no OTP — backend checks Verified
  signinBtn.onclick=async()=>{
    const email=(signinEmail.value||"").trim().toLowerCase();
    
    if(!email){
      showMsg(signinMsg, 'Please enter your email address', 'err');
      return;
    }
    
    signinBtn.disabled = true;
    signinBtn.textContent = 'Signing in...';
    showMsg(signinMsg, 'Signing you in...', 'ok');
    
    try{
      const r = await signin({
        email,
        userAgent: navigator.userAgent
      });
      
      if(r.success){
        localStorage.setItem('ltn_user', JSON.stringify({ 
          email, 
          name: (r.user && r.user.name) || "" 
        }));
        localStorage.setItem('userEmail', email);
        
        showMsg(signinMsg, 'Success! Redirecting...', 'ok');
        
        setTimeout(()=>{
          window.location.replace("/front.html");
        }, 800);
      }else{
        // If backend says this email needs OTP, flip to Sign Up tab
        if (r.requiresOtp) {
          tabSignup.click();
          showMsg(joinMsg, r.error || 'Please sign up to receive a verification code', 'err');
          emailInput.value = email;
          firstNameInput.focus();
        } else {
          showMsg(signinMsg, r.error || 'Unable to sign in', 'err');
        }
      }
    }catch(e){
      showMsg(signinMsg, 'Connection error. Please try again.', 'err');
    }
    
    signinBtn.disabled = false;
    signinBtn.textContent = 'Sign In';
  };

  // Enter key handlers
  firstNameInput.addEventListener('keypress', e => {
    if(e.key==='Enter') lastNameInput.focus();
  });
  lastNameInput.addEventListener('keypress', e => {
    if(e.key==='Enter') emailInput.focus();
  });
  emailInput.addEventListener('keypress', e => {
    if(e.key==='Enter') joinBtn.click();
  });
  signinEmail.addEventListener('keypress', e => {
    if(e.key==='Enter') signinBtn.click();
  });
});
</script>
