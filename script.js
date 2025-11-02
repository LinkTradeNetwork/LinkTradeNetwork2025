// API helper function - points to your Google Apps Script
async function postJSON(data) {
  try {
    const response = await fetch('https://script.google.com/macros/s/AKfycbzXuEhYvkD8Kzu_X6K32shXtJjxAdysAyuAA5p-Y1BlAefAjFxLJp2dRAJ_yE7G1EGL/exec', {
      method: 'POST',
      mode: 'no-cors', // Required for Google Apps Script
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    // Note: 'no-cors' mode means we can't read the response
    // Google Apps Script will handle the logic server-side
    return { success: true };
  } catch (error) {
    console.error('API Error:', error);
    return { success: false, error: error.message };
  }
}