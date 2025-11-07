<script>
// ===== API CONFIG =====
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzVSFBDBpxaAljquQ0gB2Ih3OGlGJY1kRPgwobHMgFk-2xpKQm1EMpBwEUH0nbzdwe1/exec';

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

/* Optional helpers if you want to call from other pages:
   await signup({ name, email, consent:true, userAgent:navigator.userAgent })
   await verify({ email, code })
   await resend({ email, name })
*/
function signup({ name, email, consent, userAgent }) {
  return postJSON({ action:'signup', name, email, consent, userAgent });
}
function verify({ email, code }) {
  return postJSON({ action:'verify', email, code });
}
function resend({ email, name }) {
  return postJSON({ action:'resend', email, name });
}
</script>
